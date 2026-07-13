import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Mic, ArrowRight, Mail, RotateCcw, Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to Klarn" },
      { name: "description", content: "Sign in to Klarn using a magic link sent to your email." },
    ],
  }),
  component: AuthPage,
});

const REMEMBERED_EMAIL_KEY = "klarn_last_email";

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? "");
  const [stage, setStage] = useState<"checking" | "email" | "sent">("checking");
  const [loading, setLoading] = useState(false);

  // Synchronous local session check and active state change listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        navigate({ to: "/app" });
      } else {
        setStage("email");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate({ to: "/app" });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const redirectUrl = window.location.origin.includes("localhost")
      ? `${window.location.origin}/auth`
      : "https://klarn.vercel.app";

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: redirectUrl,
        shouldCreateUser: true,
      },
    });

    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim().toLowerCase());
    toast.success("Magic link sent!");
    setStage("sent");
  };

  if (stage === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-mint"
              style={{ animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0" aria-hidden>
        <div
          className="absolute -top-20 left-1/4 h-[400px] w-[400px] rounded-full"
          style={{
            background: "radial-gradient(circle, oklch(0.82 0.18 165 / 14%) 0%, transparent 70%)",
            animation: "orb-drift-a 14s ease-in-out infinite",
            filter: "blur(1px)",
          }}
        />
        <div
          className="absolute bottom-0 right-1/4 h-[300px] w-[300px] rounded-full"
          style={{
            background: "radial-gradient(circle, oklch(0.55 0.18 240 / 10%) 0%, transparent 70%)",
            animation: "orb-drift-b 18s ease-in-out infinite",
            filter: "blur(1px)",
          }}
        />
      </div>

      <div
        className="relative w-full max-w-md"
        style={{ animation: "slide-up 0.5s cubic-bezier(0.23, 1, 0.32, 1) both" }}
      >
        {/* Card */}
        <div
          className="relative overflow-hidden rounded-3xl p-8"
          style={{
            background: "linear-gradient(145deg, oklch(0.20 0.035 260), oklch(0.17 0.03 265))",
            border: "1px solid oklch(1 0 0 / 12%)",
            boxShadow: "0 32px 80px oklch(0 0 0 / 50%), inset 0 1px 0 oklch(1 0 0 / 10%)",
          }}
        >
          {/* Top glow line */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background: "linear-gradient(90deg, transparent, oklch(0.82 0.18 165 / 50%), transparent)",
              animation: "border-glow 3s ease-in-out infinite",
            }}
          />

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                background: "linear-gradient(135deg, oklch(0.82 0.18 165), oklch(0.60 0.18 200))",
                boxShadow: "0 4px 16px oklch(0.82 0.18 165 / 30%)",
              }}
            >
              <Mic className="h-5 w-5 text-white" />
            </div>
            <span className="font-display text-lg font-semibold">Klarn</span>
          </div>

          {stage === "email" ? (
            <>
              <h1 className="mt-7 font-display text-2xl font-bold">
                Welcome back
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your email — we'll send a secure login link. No password needed.
              </p>

              <form onSubmit={sendMagicLink} className="mt-7 space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoFocus
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl py-3 pl-10 pr-4 text-sm outline-none transition-all"
                    style={{
                      background: "oklch(1 0 0 / 6%)",
                      border: "1px solid oklch(1 0 0 / 12%)",
                      color: "inherit",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "oklch(0.82 0.18 165 / 50%)";
                      e.target.style.boxShadow = "0 0 0 3px oklch(0.82 0.18 165 / 12%)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "oklch(1 0 0 / 12%)";
                      e.target.style.boxShadow = "";
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-all duration-200 disabled:opacity-50 hover:brightness-110 hover:scale-[1.02]"
                  style={{
                    background: "linear-gradient(135deg, oklch(0.82 0.18 165), oklch(0.70 0.18 185))",
                    color: "oklch(0.13 0.04 265)",
                    boxShadow: "0 4px 20px oklch(0.82 0.18 165 / 30%)",
                  }}
                >
                  {loading ? (
                    <>
                      <span
                        className="h-4 w-4 rounded-full border-2 border-current border-t-transparent"
                        style={{ animation: "spin-slow 0.7s linear infinite" }}
                      />
                      Sending…
                    </>
                  ) : (
                    <>
                      Send magic link
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center mt-7">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-mint/10 border border-mint/20 text-mint mb-4">
                <Sparkles className="h-6 w-6 animate-pulse" />
              </div>
              <h1 className="font-display text-2xl font-bold">
                Check your email
              </h1>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                We've sent a magic login link to <br />
                <span className="font-semibold text-foreground">{email}</span>.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Click the button inside the email to sign in automatically.
              </p>

              <button
                type="button"
                onClick={() => setStage("email")}
                className="mt-8 flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-sm text-muted-foreground transition hover:text-foreground"
                style={{
                  border: "1px solid oklch(1 0 0 / 10%)",
                  background: "oklch(1 0 0 / 4%)",
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Use a different email
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
