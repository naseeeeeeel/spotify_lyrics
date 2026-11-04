import { hasClientId, login, redirectUri } from '../lib/spotify'
import Background from './Background'

export default function Login({ error }: { error: string | null }) {
  return (
    <div className="relative flex h-full items-center px-8 sm:px-16 lg:px-28">
      <Background url={null} />
      <main className="rise relative z-10 max-w-2xl">
        <h1 className="text-[clamp(4rem,14vw,10rem)] font-extrabold leading-[.85] tracking-[-0.05em]">
          Sing<br />along.
        </h1>
        <p className="mt-8 max-w-md text-lg text-white/70">
          Lyrica shows the lyrics of whatever you’re playing on Spotify, one word at a time, in time with the music.
        </p>

        {hasClientId ? (
          <button
            onClick={() => void login()}
            className="mt-10 rounded-full bg-white px-8 py-4 text-base font-semibold text-black transition hover:scale-[1.03] active:scale-95"
          >
            Connect Spotify
          </button>
        ) : (
          <div className="mt-10 max-w-md rounded-2xl bg-white/10 p-5 text-sm text-white/80 backdrop-blur">
            <p className="font-semibold text-white">Add your Spotify Client ID</p>
            <p className="mt-1">
              Copy <code>.env.example</code> to <code>.env</code>, set <code>VITE_SPOTIFY_CLIENT_ID</code>, and restart the dev server.
              Add <code className="break-all">{redirectUri}</code> as a redirect URI in your Spotify app.
            </p>
          </div>
        )}

        {error && <p className="mt-5 text-sm text-red-300">{error}</p>}
      </main>
    </div>
  )
}
