import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut, Mic, Plus, Sparkles, ArrowRight, Clock, Radio, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createMeeting, listMyMeetings } from "@/lib/meetings.functions";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Dashboard · Klarn" }] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listMyMeetings);
  const createFn = useServerFn(createMeeting);
  const [joinCode, setJoinCode] = useState("");
  const [title, setTitle] = useState("");
  const [botOn, setBotOn] = useState(true);

  const { data: meetings } = useQuery({
    queryKey: ["meetings"],
    queryFn: () => listFn(),
  });

  const create = useMutation({
    mutationFn: async () =>
      createFn({ data: { title: title.trim() || "Untitled meeting", notes_bot_enabled: botOn } }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      navigate({ to: "/m/$code", params: { code: m.code } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [me, setMe] = useState<{ email?: string | null; display_name?: string | null } | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session?.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("email, display_name")
        .eq("id", data.session.user.id)
        .maybeSingle();
      setMe(p ?? { email: data.session.user.email });
    });
  }, []);

  const displayName = me?.display_name || me?.email || "";

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      {/* Ambient orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute -top-24 -left-24 h-[400px] w-[400px] rounded-full"
          style={{
            background: "radial-gradient(circle, oklch(0.82 0.18 165 / 10%) 0%, transparent 70%)",
            animation: "orb-drift-a 20s ease-in-out infinite",
          }}
        />
        <div
          className="absolute top-1/2 -right-32 h-[350px] w-[350px] rounded-full"
          style={{
            background: "radial-gradient(circle, oklch(0.55 0.18 240 / 8%) 0%, transparent 70%)",
            animation: "orb-drift-b 24s ease-in-out infinite",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-4xl px-5 py-8">
        {/* Header */}
        <header
          className="flex items-center justify-between"
          style={{ animation: "fade-up 0.4s ease-out both" }}
        >
          <Link to="/" className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{
                background: "linear-gradient(135deg, oklch(0.82 0.18 165), oklch(0.60 0.18 200))",
                boxShadow: "0 4px 12px oklch(0.82 0.18 165 / 25%)",
              }}
            >
              <Mic className="h-4 w-4 text-white" />
            </div>
            <span className="font-display text-lg font-semibold">Klarn</span>
          </Link>

          <div className="flex items-center gap-3">
            {displayName && (
              <div className="hidden sm:flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold uppercase"
                  style={{
                    background: "linear-gradient(135deg, oklch(0.82 0.18 165 / 25%), oklch(0.60 0.18 200 / 20%))",
                    border: "1px solid oklch(0.82 0.18 165 / 30%)",
                    color: "oklch(0.82 0.18 165)",
                  }}
                >
                  {displayName[0]}
                </div>
                <span className="text-xs text-muted-foreground">{displayName}</span>
              </div>
            )}
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/" });
              }}
              className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Welcome */}
        <div
          className="mt-8"
          style={{ animation: "fade-up 0.4s ease-out 0.05s both" }}
        >
          <h1 className="font-display text-2xl font-bold">
            {displayName ? `Hey, ${(me?.display_name || me?.email?.split("@")[0]) ?? "there"} 👋` : "Dashboard"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Start or join a meeting below.</p>
        </div>

        {/* Action cards */}
        <section
          className="mt-6 grid gap-4 sm:grid-cols-2"
          style={{ animation: "fade-up 0.4s ease-out 0.1s both" }}
        >
          {/* Start a meeting */}
          <div
            className="relative overflow-hidden rounded-2xl p-6"
            style={{
              background: "linear-gradient(145deg, oklch(0.20 0.04 260), oklch(0.17 0.03 265))",
              border: "1px solid oklch(1 0 0 / 11%)",
              boxShadow: "0 8px 32px oklch(0 0 0 / 30%)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, oklch(0.82 0.18 165 / 40%), transparent)" }}
            />
            <h2 className="flex items-center gap-2 font-display text-base font-semibold">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{
                  background: "oklch(0.82 0.18 165 / 18%)",
                  border: "1px solid oklch(0.82 0.18 165 / 25%)",
                }}
              >
                <Plus className="h-4 w-4" style={{ color: "oklch(0.82 0.18 165)" }} />
              </div>
              Start a meeting
            </h2>
            <input
              id="meeting-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Meeting title (optional)"
              className="mt-4 w-full rounded-xl py-3 px-4 text-sm outline-none transition-all"
              style={{
                background: "oklch(1 0 0 / 6%)",
                border: "1px solid oklch(1 0 0 / 10%)",
                color: "inherit",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "oklch(0.82 0.18 165 / 40%)";
                e.target.style.boxShadow = "0 0 0 3px oklch(0.82 0.18 165 / 10%)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "oklch(1 0 0 / 10%)";
                e.target.style.boxShadow = "";
              }}
            />
            <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground select-none">
              <input
                type="checkbox"
                checked={botOn}
                onChange={(e) => setBotOn(e.target.checked)}
                className="accent-mint h-4 w-4 rounded"
              />
              <Sparkles className="h-3.5 w-3.5" style={{ color: "oklch(0.82 0.18 165)" }} />
              AI notes bot (Gemini summary after call)
            </label>
            <button
              id="start-meeting-btn"
              onClick={() => create.mutate()}
              disabled={create.isPending}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-all duration-200 disabled:opacity-50 hover:brightness-110 hover:scale-[1.02]"
              style={{
                background: "linear-gradient(135deg, oklch(0.82 0.18 165), oklch(0.70 0.18 185))",
                color: "oklch(0.13 0.04 265)",
                boxShadow: "0 4px 20px oklch(0.82 0.18 165 / 30%)",
              }}
            >
              {create.isPending ? (
                <>
                  <span
                    className="h-4 w-4 rounded-full border-2 border-current border-t-transparent"
                    style={{ animation: "spin-slow 0.7s linear infinite" }}
                  />
                  Creating…
                </>
              ) : (
                "Start meeting"
              )}
            </button>
          </div>

          {/* Join a meeting */}
          <div
            className="relative overflow-hidden rounded-2xl p-6"
            style={{
              background: "linear-gradient(145deg, oklch(0.19 0.035 260), oklch(0.17 0.03 265))",
              border: "1px solid oklch(1 0 0 / 10%)",
              boxShadow: "0 8px 32px oklch(0 0 0 / 25%)",
            }}
          >
            <h2 className="flex items-center gap-2 font-display text-base font-semibold">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{
                  background: "oklch(0.55 0.18 240 / 18%)",
                  border: "1px solid oklch(0.55 0.18 240 / 25%)",
                }}
              >
                <Mic className="h-4 w-4" style={{ color: "oklch(0.65 0.18 230)" }} />
              </div>
              Join a meeting
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const code = joinCode.trim().toLowerCase();
                if (!code) return;
                navigate({ to: "/m/$code", params: { code } });
              }}
              className="mt-4 space-y-3"
            >
              <input
                id="join-code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="abc-def-ghi"
                className="w-full rounded-xl py-3 px-4 text-center font-display text-lg tracking-widest outline-none transition-all"
                style={{
                  background: "oklch(1 0 0 / 6%)",
                  border: "1px solid oklch(1 0 0 / 10%)",
                  color: "inherit",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "oklch(0.65 0.18 230 / 40%)";
                  e.target.style.boxShadow = "0 0 0 3px oklch(0.65 0.18 230 / 10%)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "oklch(1 0 0 / 10%)";
                  e.target.style.boxShadow = "";
                }}
              />
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02]"
                style={{
                  background: "oklch(1 0 0 / 8%)",
                  border: "1px solid oklch(1 0 0 / 12%)",
                }}
              >
                Join
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </section>

        {/* Meetings list */}
        <section
          className="mt-10"
          style={{ animation: "fade-up 0.4s ease-out 0.2s both" }}
        >
          <h2 className="mb-4 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Your meetings
          </h2>
          <div className="space-y-2">
            {(meetings ?? []).length === 0 ? (
              <div
                className="flex flex-col items-center justify-center rounded-2xl py-16 text-center"
                style={{ border: "1px dashed oklch(1 0 0 / 14%)" }}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ background: "oklch(0.82 0.18 165 / 10%)", border: "1px solid oklch(0.82 0.18 165 / 20%)" }}
                >
                  <Radio className="h-5 w-5" style={{ color: "oklch(0.82 0.18 165)" }} />
                </div>
                <p className="mt-4 text-sm font-medium">No meetings yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Start your first meeting above</p>
              </div>
            ) : (
              meetings!.map((m, i) => (
                <Link
                  key={m.id}
                  to="/app/meetings/$id"
                  params={{ id: m.id }}
                  className="group flex items-center justify-between rounded-xl px-4 py-3.5 transition-all duration-200"
                  style={{
                    background: "oklch(1 0 0 / 3%)",
                    border: "1px solid oklch(1 0 0 / 8%)",
                    animation: `fade-up 0.35s ease-out ${i * 0.04}s both`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "oklch(0.82 0.18 165 / 35%)";
                    (e.currentTarget as HTMLElement).style.background = "oklch(0.82 0.18 165 / 5%)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "oklch(1 0 0 / 8%)";
                    (e.currentTarget as HTMLElement).style.background = "oklch(1 0 0 / 3%)";
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: m.ended_at
                          ? "oklch(0.65 0.02 250 / 12%)"
                          : "oklch(0.82 0.18 165 / 14%)",
                        border: m.ended_at
                          ? "1px solid oklch(0.65 0.02 250 / 20%)"
                          : "1px solid oklch(0.82 0.18 165 / 25%)",
                      }}
                    >
                      {m.ended_at ? (
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: "oklch(0.82 0.18 165)", animation: "rec-pulse 1.6s infinite" }}
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-sm">{m.title}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{m.code}</span>
                        <span>·</span>
                        <Calendar className="h-3 w-3" />
                        <span>
                          {m.ended_at
                            ? new Date(m.ended_at).toLocaleString()
                            : m.started_at
                            ? "In progress"
                            : new Date(m.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
