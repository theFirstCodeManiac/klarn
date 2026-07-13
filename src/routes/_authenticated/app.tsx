import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut, Mic, Plus, Sparkles, ArrowRight } from "lucide-react";
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

  const [me, setMe] = useState<{ email?: string; display_name?: string } | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("email, display_name")
        .eq("id", data.user.id)
        .maybeSingle();
      setMe(p ?? { email: data.user.email });
    });
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-5 py-8">
      <header className="flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src="/icon-512.png" alt="" width={36} height={36} className="h-9 w-9 rounded-lg" />
          <span className="font-display text-lg font-semibold">Klarn</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {me?.display_name || me?.email}
          </span>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/" });
            }}
            className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Plus className="h-5 w-5 text-mint" /> Start a meeting
          </h2>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Meeting title (optional)"
            className="mt-4 w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={botOn}
              onChange={(e) => setBotOn(e.target.checked)}
              className="accent-mint"
            />
            <Sparkles className="h-3.5 w-3.5 text-mint" />
            AI notes bot (summary + action items after the call)
          </label>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="mt-4 w-full rounded-xl bg-mint px-4 py-3 text-sm font-semibold text-mint-foreground shadow-lg shadow-mint/20 disabled:opacity-50"
          >
            {create.isPending ? "Creating…" : "Start meeting"}
          </button>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Mic className="h-5 w-5 text-mint" /> Join a meeting
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
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="abc-def-ghi"
              className="w-full rounded-xl border border-border bg-input px-4 py-3 text-center font-display text-lg tracking-widest outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              className="w-full rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm font-semibold hover:bg-secondary"
            >
              Join
            </button>
          </form>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Your meetings
        </h2>
        <div className="space-y-2">
          {(meetings ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
              No meetings yet. Start your first one above.
            </p>
          ) : (
            meetings!.map((m) => (
              <Link
                key={m.id}
                to="/app/meetings/$id"
                params={{ id: m.id }}
                className="flex items-center justify-between rounded-xl border border-border bg-card/40 px-4 py-3 transition hover:border-mint/60"
              >
                <div>
                  <div className="font-medium">{m.title}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{m.code}</span>
                    <span>·</span>
                    <span>
                      {m.ended_at
                        ? `Ended ${new Date(m.ended_at).toLocaleString()}`
                        : m.started_at
                        ? "In progress"
                        : `Created ${new Date(m.created_at).toLocaleString()}`}
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
