import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to Klarn" },
      { name: "description", content: "Sign in to Klarn with your email and a 6-digit code." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/app" });
    });
  }, [navigate]);

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Check your email for a 6-digit code");
    setStage("otp");
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otp.trim(),
      type: "email",
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("You're in");
    navigate({ to: "/app" });
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="glass w-full max-w-md rounded-3xl p-8">
        <div className="flex items-center gap-2.5">
          <img src="/icon-512.png" alt="" width={40} height={40} className="h-10 w-10 rounded-lg" />
          <span className="font-display text-lg font-semibold">Klarn</span>
        </div>
        <h1 className="mt-6 font-display text-2xl font-bold">
          {stage === "email" ? "Sign in with email" : "Enter your code"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {stage === "email"
            ? "We'll send a 6-digit code to your email. No password needed."
            : `We sent a 6-digit code to ${email}. It expires soon.`}
        </p>

        {stage === "email" ? (
          <form onSubmit={sendOtp} className="mt-6 space-y-3">
            <input
              type="email"
              required
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full rounded-xl bg-mint px-4 py-3 text-sm font-semibold text-mint-foreground shadow-lg shadow-mint/20 disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="mt-6 space-y-3">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-xl border border-border bg-input px-4 py-3 text-center font-display text-2xl tracking-[0.5em] outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full rounded-xl bg-mint px-4 py-3 text-sm font-semibold text-mint-foreground shadow-lg shadow-mint/20 disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Verify & continue"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStage("email");
                setOtp("");
              }}
              className="w-full rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
