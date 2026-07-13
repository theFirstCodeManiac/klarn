import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, Waves, Radio, Sparkles, ShieldCheck, Download, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
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
});

// ─── Typewriter ───────────────────────────────────────────────
const PHRASES = [
  "Crystal-clear voice.",
  "No noise. No lag.",
  "AI notes after every call.",
  "Record any meeting.",
  "Join with a link.",
];

function Typewriter() {
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const phrase = PHRASES[phraseIdx];
    let timeout: ReturnType<typeof setTimeout>;
    if (!deleting && displayed.length < phrase.length) {
      timeout = setTimeout(() => setDisplayed(phrase.slice(0, displayed.length + 1)), 55);
    } else if (!deleting && displayed.length === phrase.length) {
      timeout = setTimeout(() => setDeleting(true), 2000);
    } else if (deleting && displayed.length > 0) {
      timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 30);
    } else if (deleting && displayed.length === 0) {
      setDeleting(false);
      setPhraseIdx((p) => (p + 1) % PHRASES.length);
    }
    return () => clearTimeout(timeout);
  }, [displayed, deleting, phraseIdx]);

  return (
    <span className="inline-block min-h-[1.2em]">
      <span
        style={{
          background: "linear-gradient(135deg, oklch(0.82 0.18 165), oklch(0.65 0.18 200))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {displayed}
      </span>
      <span
        className="ml-0.5 inline-block w-0.5 h-[0.9em] align-middle rounded-full bg-mint"
        style={{ animation: "typewriter-cursor 0.8s ease-in-out infinite" }}
      />
    </span>
  );
}

// ─── 3D Rotating Cube ─────────────────────────────────────────
function SpinningCube({ size = 60, duration = 8, reverse = false, color = "oklch(0.82 0.18 165 / 20%)", borderColor = "oklch(0.82 0.18 165 / 35%)" }: {
  size?: number; duration?: number; reverse?: boolean; color?: string; borderColor?: string;
}) {
  const style = {
    width: size, height: size,
    animation: `${reverse ? "cube-spin-reverse" : "cube-spin"} ${duration}s linear infinite`,
    transformStyle: "preserve-3d" as const,
    position: "relative" as const,
  };

  const face = (transform: string) => ({
    position: "absolute" as const,
    width: "100%", height: "100%",
    background: color,
    border: `1px solid ${borderColor}`,
    backdropFilter: "blur(4px)",
    transform,
  });

  const h = size / 2;

  return (
    <div style={style}>
      <div style={face(`rotateY(0deg)   translateZ(${h}px)`)} />
      <div style={face(`rotateY(180deg) translateZ(${h}px)`)} />
      <div style={face(`rotateY(90deg)  translateZ(${h}px)`)} />
      <div style={face(`rotateY(-90deg) translateZ(${h}px)`)} />
      <div style={face(`rotateX(90deg)  translateZ(${h}px)`)} />
      <div style={face(`rotateX(-90deg) translateZ(${h}px)`)} />
    </div>
  );
}

// ─── Star field ───────────────────────────────────────────────
function StarField({ count = 80 }: { count?: number }) {
  const stars = useRef(
    Array.from({ length: count }, (_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      r: 0.8 + Math.random() * 1.8,
      delay: Math.random() * 6,
      dur: 2 + Math.random() * 4,
    }))
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {stars.current.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.r,
            height: s.r,
            animation: `star-twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Comet ────────────────────────────────────────────────────
function Comet({ delay = 0, top = "20%" }: { delay?: number; top?: string }) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{ top, left: 0, animation: `comet-streak 7s linear ${delay}s infinite` }}
      aria-hidden
    >
      <div
        style={{
          width: 120,
          height: 2,
          background: "linear-gradient(90deg, transparent, oklch(0.82 0.18 165), white)",
          borderRadius: 999,
          boxShadow: "0 0 8px 2px oklch(0.82 0.18 165 / 60%)",
        }}
      />
    </div>
  );
}

// ─── Cars on a road ───────────────────────────────────────────
function RoadScene() {
  const cars = [
    { delay: 0,   y: 8,  color: "oklch(0.82 0.18 165)", w: 36, h: 14 },
    { delay: 2.5, y: 26, color: "oklch(0.65 0.18 230)", w: 44, h: 14 },
    { delay: 5,   y: 8,  color: "oklch(0.70 0.15 190)", w: 32, h: 14 },
    { delay: 7.5, y: 26, color: "oklch(0.82 0.18 165 / 60%)", w: 40, h: 14 },
  ];

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        height: 54,
        background: "linear-gradient(180deg, oklch(0.16 0.03 265) 0%, oklch(0.14 0.03 265) 100%)",
        border: "1px solid oklch(1 0 0 / 10%)",
      }}
      aria-hidden
    >
      {/* Road surface */}
      <div
        className="absolute inset-x-0"
        style={{
          top: "50%",
          height: 2,
          background: "oklch(1 0 0 / 8%)",
          transform: "translateY(-50%)",
        }}
      />
      {/* Dashed center line */}
      <div
        className="absolute inset-x-0"
        style={{
          top: "50%",
          height: 2,
          background: "repeating-linear-gradient(90deg, oklch(0.82 0.18 165 / 30%) 0px, oklch(0.82 0.18 165 / 30%) 16px, transparent 16px, transparent 32px)",
          transform: "translateY(-50%)",
          animation: "road-scroll 1.5s linear infinite",
        }}
      />
      {/* Cars */}
      {cars.map((c, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: c.y,
            width: c.w,
            height: c.h,
            background: c.color,
            borderRadius: 3,
            boxShadow: `0 0 10px ${c.color}`,
            animation: `car-drive 4s linear ${c.delay}s infinite`,
          }}
        >
          {/* Headlight glow */}
          <div style={{
            position: "absolute", right: -6, top: 2, width: 8, height: 10,
            background: `radial-gradient(ellipse, ${c.color} 0%, transparent 70%)`,
            opacity: 0.9,
          }} />
        </div>
      ))}
    </div>
  );
}

// ─── Galaxy Ring ──────────────────────────────────────────────
function GalaxyRing() {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      aria-hidden
      style={{ width: 600, height: 600 }}
    >
      {[1, 0.7, 0.45].map((scale, i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-full"
          style={{
            transform: `scale(${scale})`,
            border: "1px solid oklch(0.82 0.18 165 / 8%)",
            animation: `galaxy-spin ${18 + i * 10}s linear infinite`,
            transformOrigin: "center center",
          }}
        >
          {/* Dot on orbit */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: 6 - i,
              height: 6 - i,
              background: "oklch(0.82 0.18 165)",
              boxShadow: "0 0 8px oklch(0.82 0.18 165)",
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Canvas audio waveform ────────────────────────────────────
function Waveform() {
  const bars = Array.from({ length: 32 });
  return (
    <div className="flex h-36 items-end justify-center gap-1 sm:h-44">
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

// ─── Feature cards ────────────────────────────────────────────
const features = [
  { icon: Waves,      title: "Noise cancellation",  body: "Barking dogs, cafés, keyboards — filtered out in real time via echo cancellation & noise suppression." },
  { icon: Radio,      title: "Live captions",        body: "Every speaker transcribed as they talk, streamed to everyone in the room instantly." },
  { icon: ShieldCheck, title: "Host controls",       body: "Mute one person or the whole room with a tap. Locks stay locked until you release them." },
  { icon: Mic,        title: "Scales past 6",        body: "Powered by a cloud SFU — no mesh degradation no matter how big the room gets." },
  { icon: Sparkles,   title: "AI notes bot",         body: "Summary, decisions, and action items land in your dashboard after every call — powered by Gemini." },
  { icon: Download,   title: "Live recordings",      body: "One-tap record during any call. Download the audio file the moment you hang up." },
];

// ─── Main page ────────────────────────────────────────────────
function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-background">
      {/* Star field */}
      <StarField count={100} />

      {/* Comets */}
      <Comet delay={0} top="15%" />
      <Comet delay={3.5} top="55%" />
      <Comet delay={7} top="33%" />

      {/* Ambient orbs */}
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

      {/* ── Nav ── */}
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{
              background: "linear-gradient(135deg, oklch(0.82 0.18 165), oklch(0.60 0.18 200))",
              boxShadow: "0 4px 16px oklch(0.82 0.18 165 / 30%)",
            }}
          >
            <Mic className="h-4 w-4 text-white" />
          </div>
          <span className="font-display text-xl font-semibold">Klarn</span>
        </div>

        {/* Floating 3D cubes in nav */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center gap-8 opacity-25" aria-hidden>
          <SpinningCube size={18} duration={6} />
          <SpinningCube size={12} duration={9} reverse />
          <SpinningCube size={18} duration={7} />
        </div>

        <Link
          to="/auth"
          className="group flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-semibold transition-all duration-200 hover:scale-105"
          style={{
            background: "linear-gradient(135deg, oklch(0.82 0.18 165), oklch(0.70 0.18 185))",
            color: "oklch(0.13 0.04 265)",
            boxShadow: "0 4px 20px oklch(0.82 0.18 165 / 30%)",
          }}
        >
          Sign in <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </header>

      {/* ── Hero ── */}
      <section className="relative mx-auto max-w-4xl px-6 pb-12 pt-6 text-center sm:pt-12">
        {/* Galaxy ring behind hero text */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <GalaxyRing />
        </div>

        <div className="relative">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium"
            style={{
              borderColor: "oklch(0.82 0.18 165 / 35%)",
              background: "oklch(0.82 0.18 165 / 8%)",
              color: "oklch(0.82 0.18 165)",
              animation: "fade-in 0.5s ease-out both",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "oklch(0.82 0.18 165)", animation: "rec-pulse 1.6s infinite" }}
            />
            Free forever · No downloads to join
          </span>

          <h1
            className="mt-6 font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl"
            style={{ animation: "slide-up 0.6s ease-out 0.1s both" }}
          >
            Voice meetings,{" "}
            <br className="hidden sm:block" />
            <Typewriter />
          </h1>

          <p
            className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            style={{ animation: "slide-up 0.6s ease-out 0.2s both" }}
          >
            Host or join instantly with a link. Background noise cancelled, live captions as you talk,
            recording with one tap, and AI-generated notes waiting when you hang up.
          </p>

          <div
            className="mt-8 flex flex-wrap justify-center gap-3"
            style={{ animation: "slide-up 0.6s ease-out 0.3s both" }}
          >
            <Link
              to="/auth"
              className="group flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold transition-all duration-200 hover:scale-105 hover:brightness-110"
              style={{
                background: "linear-gradient(135deg, oklch(0.82 0.18 165), oklch(0.70 0.18 185))",
                color: "oklch(0.13 0.04 265)",
                boxShadow: "0 8px 32px oklch(0.82 0.18 165 / 35%)",
              }}
            >
              Start a meeting
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
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
        </div>
      </section>

      {/* ── 3D Cube showcase ── */}
      <section
        className="relative mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-12 px-6 py-10"
        aria-hidden
        style={{ animation: "fade-in 0.8s ease-out 0.5s both" }}
      >
        <SpinningCube size={72} duration={9} color="oklch(0.82 0.18 165 / 12%)" borderColor="oklch(0.82 0.18 165 / 35%)" />
        <SpinningCube size={48} duration={13} reverse color="oklch(0.55 0.18 240 / 12%)" borderColor="oklch(0.55 0.18 240 / 35%)" />
        <SpinningCube size={60} duration={10} color="oklch(0.70 0.16 190 / 12%)" borderColor="oklch(0.70 0.16 190 / 35%)" />
        <SpinningCube size={36} duration={7} reverse color="oklch(0.82 0.18 165 / 8%)" borderColor="oklch(0.82 0.18 165 / 25%)" />
        <SpinningCube size={80} duration={15} color="oklch(0.60 0.18 210 / 10%)" borderColor="oklch(0.60 0.18 210 / 28%)" />
      </section>

      {/* ── Waveform + Road ── */}
      <section className="relative mx-auto max-w-4xl px-6 pb-8" style={{ animation: "slide-up 0.7s ease-out 0.4s both" }}>
        <div
          className="relative overflow-hidden rounded-3xl p-8"
          style={{
            background: "linear-gradient(135deg, oklch(0.18 0.035 260), oklch(0.15 0.03 265))",
            border: "1px solid oklch(1 0 0 / 10%)",
            boxShadow: "0 32px 80px oklch(0 0 0 / 50%), inset 0 1px 0 oklch(1 0 0 / 10%)",
            animation: "float-y 6s ease-in-out infinite",
          }}
        >
          {/* Glow line */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, oklch(0.82 0.18 165 / 50%), transparent)" }}
          />
          <Waveform />
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "oklch(0.82 0.18 165)", animation: "rec-pulse 1.6s infinite" }} />
            Live noise-cancelled audio
          </div>
        </div>

        {/* Road scene below the card */}
        <div className="mt-4">
          <RoadScene />
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Meetings moving at full speed →
          </p>
        </div>
      </section>

      {/* ── Feature grid ── */}
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
            {/* Top glow */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity group-hover:opacity-100"
              style={{ background: "linear-gradient(90deg, transparent, oklch(0.82 0.18 165 / 45%), transparent)" }}
            />
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

      {/* ── Footer ── */}
      <footer className="relative border-t border-border py-8 text-center text-xs text-muted-foreground">
        Klarn · Free voice meetings for everyone
      </footer>
    </main>
  );
}
