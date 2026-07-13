import { createFileRoute, Link } from "@tanstack/react-router";
import { Mic, Waves, Radio, Sparkles, ShieldCheck, Download } from "lucide-react";

export const Route = createFileRoute("/")(({
  head: () => ({
    meta: [
      { title: "Klarn — Crystal-clear voice meetings with live captions" },
      {
        name: "description",
        content:
          "Free voice meetings with noise cancellation, live captions, host mute controls, live recording, and AI-generated notes.",
      },
    ],
  }),
  component: LandingPage,
}));

function Waveform() {
  const bars = Array.from({ length: 32 });
  return (
    <div className="flex h-44 items-end justify-center gap-1 sm:h-60">
      {bars.map((_, i) => (
        <span
          key={i}
          className="block w-1.5 rounded-full sm:w-2"
          style={{
            height: "100%",
            background: `linear-gradient(to top, oklch(0.82 0.18 165), oklch(0.60 0.18 200))`,
            animation: `wave-pulse 1.6s ease-in-out ${i * 0.048}s infinite`,
            opacity: 0.45 + ((i * 41) % 55) / 100,
          }}
        />
      ))}
    </div>
  );
}

const features = [
  { icon: Waves, title: "Noise cancellation", body: "Barking dogs, cafés, keyboards — filtered out in real time via echo cancellation & noise suppression." },
  { icon: Radio, title: "Live captions", body: "Every speaker transcribed as they talk, streamed to everyone in the room instantly." },
  { icon: ShieldCheck, title: "Host controls", body: "Mute one person or the whole room with a tap. Locks stay locked until you release them." },
  { icon: Mic, title: "Scales past 6", body: "Powered by a cloud SFU — no mesh degradation no matter how big the room gets." },
  { icon: Sparkles, title: "AI notes bot", body: "Summary, decisions, and action items land in your dashboard after every call — powered by Gemini." },
  { icon: Download, title: "Live recordings", body: "One-tap record during any call. Download the audio file the moment you hang up." },
];

function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden">
      {/* Ambient background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute -top-32 -left-32 h-[560px] w-[560px] rounded-full"
          style={{
            background: "radial-gradient(circle, oklch(0.82 0.18 165 / 18%) 0%, transparent 70%)",
            animation: "orb-drift-a 18s ease-in-out infinite",
            filter: "blur(2px)",
          }}
        />
        <div
          className="absolute top-1/3 -right-40 h-[480px] w-[480px] rounded-full"
          style={{
            background: "radial-gradient(circle, oklch(0.55 0.18 240 / 14%) 0%, transparent 70%)",
            animation: "orb-drift-b 22s ease-in-out infinite",
            filter: "blur(2px)",
          }}
        />
        <div
          className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full"
          style={{
            background: "radial-gradient(circle, oklch(0.70 0.16 190 / 10%) 0%, transparent 70%)",
            animation: "orb-drift-c 16s ease-in-out infinite",
            filter: "blur(2px)",
          }}
        />
      </div>

      {/* Nav */}
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: "linear-gradient(135deg, oklch(0.82 0.18 165), oklch(0.60 0.18 200))" }}
          >
            <Mic className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="font-display text-xl font-semibold">Klarn</span>
        </div>
        <Link
          to="/auth"
          className="rounded-xl px-5 py-2 text-sm font-semibold transition-all duration-200 hover:scale-105"
          style={{
            background: "linear-gradient(135deg, oklch(0.82 0.18 165), oklch(0.70 0.18 185))",
            color: "oklch(0.13 0.04 265)",
            boxShadow: "0 4px 20px oklch(0.82 0.18 165 / 30%)",
          }}
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-4xl px-6 pb-16 pt-8 text-center sm:pt-14">
        <span
          className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium"
          style={{
            borderColor: "oklch(0.82 0.18 165 / 35%)",
            background: "oklch(0.82 0.18 165 / 8%)",
            color: "oklch(0.82 0.18 165)",
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: "oklch(0.82 0.18 165)",
              animation: "rec-pulse 1.6s infinite",
            }}
          />
          Free forever · No downloads to join
        </span>

        <h1
          className="mt-7 font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl"
          style={{ animation: "slide-up 0.6s ease-out both" }}
        >
          Voice meetings,{" "}
          <span
            style={{
              background: "linear-gradient(135deg, oklch(0.82 0.18 165), oklch(0.65 0.18 200))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            without the noise.
          </span>
        </h1>
        <p
          className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          style={{ animation: "slide-up 0.6s ease-out 0.1s both" }}
        >
          Host or join instantly with a link. Background noise cancelled, live captions as you talk,
          recording with one tap, and AI-generated notes waiting when you hang up.
        </p>

        <div
          className="mt-9 flex flex-wrap justify-center gap-3"
          style={{ animation: "slide-up 0.6s ease-out 0.2s both" }}
        >
          <Link
            to="/auth"
            className="rounded-xl px-7 py-3.5 text-sm font-semibold transition-all duration-200 hover:scale-105 hover:brightness-110"
            style={{
              background: "linear-gradient(135deg, oklch(0.82 0.18 165), oklch(0.70 0.18 185))",
              color: "oklch(0.13 0.04 265)",
              boxShadow: "0 8px 32px oklch(0.82 0.18 165 / 35%)",
            }}
          >
            Start a meeting
          </Link>
          <Link
            to="/auth"
            className="rounded-xl border px-7 py-3.5 text-sm font-semibold transition-all duration-200 hover:scale-105"
            style={{
              borderColor: "oklch(1 0 0 / 12%)",
              background: "oklch(1 0 0 / 5%)",
              backdropFilter: "blur(12px)",
            }}
          >
            Join a meeting
          </Link>
        </div>

        {/* Waveform card */}
        <div
          className="mt-14"
          style={{ animation: "slide-up 0.7s ease-out 0.3s both" }}
        >
          <div
            className="relative overflow-hidden rounded-3xl p-8"
            style={{
              background: "linear-gradient(135deg, oklch(0.18 0.035 260), oklch(0.15 0.03 265))",
              border: "1px solid oklch(1 0 0 / 10%)",
              boxShadow: "0 32px 80px oklch(0 0 0 / 50%), inset 0 1px 0 oklch(1 0 0 / 10%)",
              animation: "float-y 6s ease-in-out infinite",
            }}
          >
            {/* Subtle inner glow */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, oklch(0.82 0.18 165 / 40%), transparent)" }}
            />
            <Waveform />
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: "oklch(0.82 0.18 165)", animation: "rec-pulse 1.6s infinite" }}
              />
              Live noise-cancelled audio
            </div>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="relative mx-auto grid max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, body }, idx) => (
          <div
            key={title}
            className="group relative overflow-hidden rounded-2xl p-5 transition-all duration-300"
            style={{
              background: "linear-gradient(135deg, oklch(0.18 0.035 260), oklch(0.16 0.03 265))",
              border: "1px solid oklch(1 0 0 / 9%)",
              animation: `fade-up 0.5s ease-out ${idx * 0.07}s both`,
              transformStyle: "preserve-3d",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform =
                "perspective(700px) rotateX(-2deg) rotateY(2deg) translateY(-5px)";
              (e.currentTarget as HTMLElement).style.borderColor = "oklch(0.82 0.18 165 / 30%)";
              (e.currentTarget as HTMLElement).style.boxShadow =
                "0 20px 50px oklch(0 0 0 / 40%), 0 0 30px oklch(0.82 0.18 165 / 8%)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "";
              (e.currentTarget as HTMLElement).style.borderColor = "";
              (e.currentTarget as HTMLElement).style.boxShadow = "";
            }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                background: "linear-gradient(135deg, oklch(0.82 0.18 165 / 20%), oklch(0.60 0.18 200 / 15%))",
                border: "1px solid oklch(0.82 0.18 165 / 25%)",
              }}
            >
              <Icon className="h-5 w-5" style={{ color: "oklch(0.82 0.18 165)" }} />
            </div>
            <h3 className="mt-4 font-display text-base font-semibold">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>

      <footer className="relative border-t border-border py-8 text-center text-xs text-muted-foreground">
        Klarn · Free voice meetings for everyone
      </footer>
    </main>
  );
}
