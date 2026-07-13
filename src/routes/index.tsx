import { createFileRoute, Link } from "@tanstack/react-router";
import { Mic, Waves, Radio, Sparkles, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Klarn — Crystal-clear voice meetings with live captions" },
      {
        name: "description",
        content:
          "Free voice meetings with noise cancellation, live captions, host mute controls, recording, and AI-generated notes.",
      },
    ],
  }),
  component: LandingPage,
});

function Waveform() {
  const bars = Array.from({ length: 28 });
  return (
    <div className="flex h-40 items-end justify-center gap-1.5 sm:h-56">
      {bars.map((_, i) => (
        <span
          key={i}
          className="block w-1.5 rounded-full bg-mint sm:w-2"
          style={{
            height: "100%",
            animation: `wave-pulse 1.4s ease-in-out ${i * 0.05}s infinite`,
            opacity: 0.5 + ((i * 37) % 50) / 100,
          }}
        />
      ))}
    </div>
  );
}

function LandingPage() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <img src="/icon-512.png" alt="" width={36} height={36} className="h-9 w-9 rounded-lg" />
          <span className="font-display text-xl font-semibold">Klarn</span>
        </div>
        <Link
          to="/auth"
          className="rounded-xl bg-mint px-4 py-2 text-sm font-semibold text-mint-foreground shadow-lg shadow-mint/20"
        >
          Sign in
        </Link>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-16 pt-8 text-center sm:pt-16">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs text-mint">
          <span className="h-1.5 w-1.5 rounded-full bg-mint" style={{ animation: "rec-pulse 1.6s infinite" }} />
          Free forever · No downloads to join
        </span>
        <h1 className="mt-6 font-display text-4xl font-bold leading-tight sm:text-6xl">
          Voice meetings, without the noise.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Host or join instantly with a link. Background noise cancelled, live captions as you talk,
          and AI-generated notes waiting when you hang up.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/auth"
            className="rounded-xl bg-mint px-6 py-3 text-sm font-semibold text-mint-foreground shadow-xl shadow-mint/25"
          >
            Start a meeting
          </Link>
          <Link
            to="/auth"
            className="rounded-xl border border-border bg-secondary/40 px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary/70"
          >
            Join a meeting
          </Link>
        </div>

        <div className="mt-14 rounded-3xl border border-border bg-card/60 p-8 shadow-2xl">
          <Waveform />
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { icon: Waves, title: "Noise cancellation", body: "Barking dogs, cafés, keyboards — filtered out in real time." },
          { icon: Radio, title: "Live captions", body: "Every speaker transcribed as they talk, for everyone in the room." },
          { icon: ShieldCheck, title: "Host controls", body: "Mute one person or the whole room. Locked until you release them." },
          { icon: Mic, title: "Scales past 6", body: "Powered by a cloud SFU — no mesh degradation as the room grows." },
          { icon: Sparkles, title: "AI notes bot", body: "Summary, decisions, and action items land in your dashboard after every call." },
          { icon: Radio, title: "Recordings", body: "One-tap record. Files are private to the host." },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-border bg-card/50 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint/15 text-mint">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-base font-semibold">{title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Klarn · Free voice meetings for everyone
      </footer>
    </main>
  );
}
