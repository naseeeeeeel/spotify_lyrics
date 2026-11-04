// Spotify Authorization Code flow with PKCE. No client secret, no backend.

import type { PlaybackState, SpotifyDevice, SpotifyQueue, SpotifyTrack } from './types'

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? ''
const REDIRECT_URI = new URL(import.meta.env.BASE_URL, window.location.origin).toString()
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ')

const AUTH_KEY = 'lyrica_auth'
const VERIFIER_KEY = 'lyrica_verifier'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'

export const hasClientId = Boolean(CLIENT_ID)
export const redirectUri = REDIRECT_URI

export class SpotifyError extends Error {
  status?: number
  reason?: string
  retryAfter?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'SpotifyError'
    this.status = status
  }
}

interface StoredAuth {
  access_token: string
  refresh_token: string
  expires_at: number
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  error_description?: string
}

/* ---------------- PKCE helpers ---------------- */

const base64url = (buf: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

function randomString(length = 96): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(values, (v) => chars[v % chars.length]).join('')
}

async function sha256Challenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(digest)
}

/* ---------------- Token storage ---------------- */

function readAuth(): StoredAuth | null {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null') as StoredAuth | null
  } catch {
    return null
  }
}

function saveTokens(data: { access_token: string; refresh_token: string; expires_in: number }): void {
  const auth: StoredAuth = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  }
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth))
}

export const isLoggedIn = (): boolean => Boolean(readAuth())

export function logout(): void {
  localStorage.removeItem(AUTH_KEY)
  localStorage.removeItem(VERIFIER_KEY)
}

/* ---------------- Login / redirect ---------------- */

export async function login(): Promise<void> {
  const verifier = randomString()
  localStorage.setItem(VERIFIER_KEY, verifier)
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: await sha256Challenge(verifier),
  })
  window.location.href = `https://accounts.spotify.com/authorize?${params}`
}

// Cached so React StrictMode's double effect doesn't exchange the code twice.
let redirectPromise: Promise<boolean> | null = null

export function handleRedirect(): Promise<boolean> {
  if (redirectPromise) return redirectPromise
  redirectPromise = (async () => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const error = params.get('error')
    if (!code && !error) return false

    window.history.replaceState({}, '', REDIRECT_URI)
    if (error) throw new Error(error === 'access_denied' ? 'Spotify access was denied.' : error)

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: 'authorization_code',
        code: code ?? '',
        redirect_uri: REDIRECT_URI,
        code_verifier: localStorage.getItem(VERIFIER_KEY) || '',
      }),
    })
    const data = (await res.json()) as TokenResponse
    if (!res.ok) throw new Error(data.error_description || 'Could not complete sign-in.')
    saveTokens({ ...data, refresh_token: data.refresh_token ?? '' })
    localStorage.removeItem(VERIFIER_KEY)
    return true
  })()
  return redirectPromise
}

/* ---------------- Token refresh ---------------- */

let refreshing: Promise<string> | null = null

function refresh(refreshToken: string): Promise<string> {
  if (!refreshing) {
    refreshing = (async () => {
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: CLIENT_ID,
        }),
      })
      const data = (await res.json()) as TokenResponse
      if (!res.ok) {
        logout()
        throw new SpotifyError('Your session expired. Sign in again.', 401)
      }
      saveTokens({ ...data, refresh_token: data.refresh_token ?? refreshToken })
      return data.access_token
    })().finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

async function getToken(): Promise<string> {
  const auth = readAuth()
  if (!auth) throw new SpotifyError('Not signed in.', 401)
  if (Date.now() < auth.expires_at) return auth.access_token
  return refresh(auth.refresh_token)
}

/* ---------------- API wrapper ---------------- */

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT'
  body?: unknown
  retry?: boolean
}

interface ApiErrorBody {
  error?: { message?: string; reason?: string }
}

async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T | null> {
  const { method = 'GET', body, retry = true } = opts
  const token = await getToken()
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return null

  if (res.status === 401 && retry) {
    const auth = readAuth()
    if (auth) {
      await refresh(auth.refresh_token)
      return api<T>(path, { method, body, retry: false })
    }
  }

  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    const info = (data as ApiErrorBody | null)?.error
    const err = new SpotifyError(info?.message || `Spotify error ${res.status}`, res.status)
    err.reason = info?.reason
    err.retryAfter = Number(res.headers.get('Retry-After')) || undefined
    throw err
  }
  return data as T
}

/* ---------------- Endpoints ---------------- */

export const getPlayback = () => api<PlaybackState>('/me/player?additional_types=track')
export const getQueue = () => api<SpotifyQueue>('/me/player/queue')
export const pause = () => api('/me/player/pause', { method: 'PUT' })
export const resume = () => api('/me/player/play', { method: 'PUT' })
export const next = () => api('/me/player/next', { method: 'POST' })
export const previous = () => api('/me/player/previous', { method: 'POST' })
export const seek = (ms: number) =>
  api(`/me/player/seek?position_ms=${Math.round(ms)}`, { method: 'PUT' })
