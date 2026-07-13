import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Sparkles, FileText, ListChecks, MessageSquare } from "lucide-react";
import { getMeetingDetail } from "@/lib/meetings.functions";

export const Route = createFileRoute("/_authenticated/app/meetings/$id")({
  head: () => ({ meta: [{ title: "Meeting notes · Klarn" }] }),
  component: MeetingDetail,
});

type ActionItem = { task: string; owner?: string | null };

function MeetingDetail() {
  const { id } = Route.useParams();
  const getDetail = useServerFn(getMeetingDetail);
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["meeting", id],
    queryFn: () => getDetail({ data: { id } }),
    refetchInterval: (q) => (q.state.data?.notes?.status === "pending" ? 3000 : false),
  });

  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  if (!data) return null;

  const { meeting, notes, lines } = data;
  const items = (notes?.action_items ?? []) as ActionItem[];

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <button
        onClick={() => navigate({ to: "/app" })}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </button>
      <h1 className="mt-4 font-display text-3xl font-bold">{meeting.title}</h1>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="font-mono">{meeting.code}</span>
        {meeting.ended_at ? (
          <span>· Ended {new Date(meeting.ended_at).toLocaleString()}</span>
        ) : (
          <>
            <span>· Live</span>
            <Link to="/m/$code" params={{ code: meeting.code }} className="rounded-md bg-mint/15 px-2 py-0.5 text-mint">
              Rejoin
            </Link>
          </>
        )}
      </div>

      <section className="mt-6 space-y-4">
        <div className="glass rounded-2xl p-5">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-widest text-mint">
            <Sparkles className="h-4 w-4" /> AI Summary
          </h2>
          {notes?.status === "pending" ? (
            <p className="mt-3 text-sm text-muted-foreground">
              The notes bot is still writing. This usually takes under a minute after the meeting ends…
            </p>
          ) : notes?.status === "empty" ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No transcript was captured. Enable captions next time to get AI notes.
            </p>
          ) : notes?.status === "error" ? (
            <p className="mt-3 text-sm text-destructive">Notes generation failed.</p>
          ) : (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
              {notes?.summary || "No summary yet."}
            </p>
          )}
        </div>

        {(() => {
          const decisions = (notes?.decisions ?? []) as string[];
          if (decisions.length === 0) return null;
          return (
            <div className="glass rounded-2xl p-5">
              <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-widest text-mint">
                <ListChecks className="h-4 w-4" /> Decisions
              </h2>
              <ul className="mt-3 space-y-1.5 text-sm">
                {decisions.map((d, i) => (
                  <li key={i}>• {d}</li>
                ))}
              </ul>
            </div>
          );
        })()}

        {items.length > 0 && (
          <div className="glass rounded-2xl p-5">
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-widest text-mint">
              <FileText className="h-4 w-4" /> Action items
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {items.map((it, i) => (
                <li key={i} className="rounded-lg border border-border/60 p-3">
                  <div>{it.task}</div>
                  {it.owner ? (
                    <div className="mt-0.5 text-xs text-muted-foreground">Owner: {it.owner}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="glass rounded-2xl p-5">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-widest text-mint">
            <MessageSquare className="h-4 w-4" /> Transcript
          </h2>
          {lines.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No captions were captured.</p>
          ) : (
            <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto text-sm">
              {lines.map((l, i) => (
                <div key={i}>
                  <span className="font-semibold text-foreground">
                    {l.speaker_name || "Someone"}:
                  </span>{" "}
                  <span className="text-muted-foreground">{l.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
