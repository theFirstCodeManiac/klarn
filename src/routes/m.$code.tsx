import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  DataPacket_Kind,
  type LocalAudioTrack,
  type RemoteParticipant,
  type RemoteTrackPublication,
  type Participant,
} from "livekit-client";
import { toast } from "sonner";
import {
  Mic,
  MicOff,
  PhoneOff,
  Copy,
  Users,
  Sparkles,
  Radio,
} from "lucide-react";
import {
  joinMeeting,
  hostMuteAll,
  hostMuteParticipant,
  hostReleaseMute,
  saveTranscriptLine,
  endMeeting,
} from "@/lib/meetings.functions";

export const Route = createFileRoute("/m/$code")({
  head: () => ({ meta: [{ title: "Meeting · Klarn" }] }),
  component: MeetingRoom,
});

type Caption = { id: string; identity: string; name: string; text: string; final: boolean; at: number };

// Web Speech API type (only Chrome/Edge/Safari expose this)
type SpeechRecognitionEvent = {
  resultIndex: number;
  results: {
    length: number;
    [i: number]: { 0: { transcript: string }; isFinal: boolean; length: number };
  };
};

function MeetingRoom() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const joinFn = useServerFn(joinMeeting);
  const muteAllFn = useServerFn(hostMuteAll);
  const mutePartFn = useServerFn(hostMuteParticipant);
  const releaseFn = useServerFn(hostReleaseMute);
  const saveLineFn = useServerFn(saveTranscriptLine);
  const endFn = useServerFn(endMeeting);

  const roomRef = useRef<Room | null>(null);
  const localTrackRef = useRef<LocalAudioTrack | null>(null);
  const recRef = useRef<{ stop?: () => void } | null>(null);
  const [state, setState] = useState<"connecting" | "live" | "ended" | "error">("connecting");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [forceMuted, setForceMuted] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<
    { identity: string; name: string; speaking: boolean; forceMuted: boolean; isLocal: boolean }[]
  >([]);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function connect() {
      try {
        const info = await joinFn({ data: { code } });
        if (cancelled) return;
        setMeetingId(info.meeting.id);
        setIsHost(info.isHost);
        setDisplayName(info.displayName);
        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });
        roomRef.current = room;

        room.on(RoomEvent.ParticipantConnected, updateParticipants);
        room.on(RoomEvent.ParticipantDisconnected, updateParticipants);
        room.on(RoomEvent.ActiveSpeakersChanged, updateParticipants);
        room.on(RoomEvent.ParticipantMetadataChanged, (metadataStr, participant) => {
          try {
            const meta = metadataStr ? JSON.parse(metadataStr) : {};
            if (participant?.identity === info.identity) {
              setForceMuted(Boolean(meta.forceMuted));
              if (meta.forceMuted && localTrackRef.current) {
                localTrackRef.current.mute();
                setMuted(true);
              }
            }
          } catch {}
          updateParticipants();
        });
        room.on(RoomEvent.TrackMuted, updateParticipants);
        room.on(RoomEvent.TrackUnmuted, updateParticipants);
        room.on(RoomEvent.Disconnected, () => setState("ended"));
        room.on(
          RoomEvent.DataReceived,
          (payload: Uint8Array, participant?: RemoteParticipant) => {
            try {
              const msg = JSON.parse(new TextDecoder().decode(payload));
              if (msg.t === "caption" && participant) {
                pushCaption({
                  id: msg.id,
                  identity: participant.identity,
                  name: participant.name || "Guest",
                  text: msg.text,
                  final: !!msg.final,
                  at: Date.now(),
                });
              }
            } catch {}
          },
        );

        await room.connect(info.wsUrl, info.token);

        // Publish mic with noise suppression + echo cancellation
        const track = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });
        localTrackRef.current = track;
        await room.localParticipant.publishTrack(track, {
          name: "microphone",
          source: Track.Source.Microphone,
          dtx: true,
          red: true,
        });

        // Autoplay remote audio
        room.on(RoomEvent.TrackSubscribed, (_track, pub: RemoteTrackPublication) => {
          if (pub.kind === Track.Kind.Audio) {
            const el = pub.track?.attach();
            if (el) {
              el.setAttribute("playsinline", "true");
              (el as HTMLAudioElement).autoplay = true;
              document.body.appendChild(el);
            }
          }
        });

        function updateParticipants() {
          if (!roomRef.current) return;
          const r = roomRef.current;
          const list: {
            identity: string;
            name: string;
            speaking: boolean;
            forceMuted: boolean;
            isLocal: boolean;
          }[] = [];
          const collect = (p: Participant, isLocal: boolean) => {
            let fm = false;
            try {
              fm = p.metadata ? Boolean(JSON.parse(p.metadata).forceMuted) : false;
            } catch {}
            list.push({
              identity: p.identity,
              name: p.name || p.identity.slice(0, 6),
              speaking: p.isSpeaking,
              forceMuted: fm,
              isLocal,
            });
          };
          collect(r.localParticipant, true);
          r.remoteParticipants.forEach((p) => collect(p, false));
          setParticipants(list);
        }

        updateParticipants();
        setState("live");
        startCaptions(info.identity, info.displayName, info.meeting.id);
      } catch (e) {
        console.error(e);
        setError((e as Error).message);
        setState("error");
      }
    }
    connect();
    return () => {
      cancelled = true;
      recRef.current?.stop?.();
      const t = localTrackRef.current;
      if (t) t.stop();
      roomRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  function pushCaption(c: Caption) {
    setCaptions((prev) => {
      // replace non-final caption for same identity
      const filtered = prev.filter((p) => !(p.identity === c.identity && !p.final && !c.final ? false : p.identity === c.identity && !p.final));
      // Simpler: keep last 6, remove non-final of same identity if a new one arrives
      const cleaned = prev.filter((p) => p.identity !== c.identity || p.final);
      const next = [...cleaned, c].slice(-8);
      return next;
    });
  }

  function startCaptions(identity: string, name: string, mId: string) {
    const W = window as unknown as {
      SpeechRecognition?: new () => unknown;
      webkitSpeechRecognition?: new () => unknown;
    };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) {
      toast.message("Live captions aren't supported in this browser (try Chrome).");
      return;
    }
    const rec = new Ctor() as {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: (e: SpeechRecognitionEvent) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
      stop: () => void;
    };
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    let stopped = false;
    rec.onresult = (event: SpeechRecognitionEvent) => {
      if (muted || forceMuted) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const transcript = r[0].transcript.trim();
        if (!transcript) continue;
        const isFinal = r.isFinal;
        const id = `${identity}-${Date.now()}-${i}`;
        const room = roomRef.current;
        if (room) {
          const payload = new TextEncoder().encode(
            JSON.stringify({ t: "caption", id, text: transcript, final: isFinal }),
          );
          room.localParticipant.publishData(payload, { reliable: false });
        }
        pushCaption({
          id,
          identity,
          name,
          text: transcript,
          final: isFinal,
          at: Date.now(),
        });
        if (isFinal) {
          saveLineFn({ data: { meetingId: mId, text: transcript, speakerName: name } }).catch(
            () => {},
          );
        }
      }
    };
    rec.onerror = () => {};
    rec.onend = () => {
      if (!stopped) {
        try {
          rec.start();
        } catch {}
      }
    };
    try {
      rec.start();
    } catch {}
    recRef.current = {
      stop: () => {
        stopped = true;
        try {
          rec.stop();
        } catch {}
      },
    };
  }

  async function toggleMic() {
    if (forceMuted && muted) {
      toast.error("Muted by host. Ask the host to unmute you.");
      return;
    }
    const t = localTrackRef.current;
    if (!t) return;
    if (muted) {
      await t.unmute();
      setMuted(false);
    } else {
      await t.mute();
      setMuted(true);
    }
  }

  async function leave() {
    recRef.current?.stop?.();
    roomRef.current?.disconnect();
    navigate({ to: "/app" });
  }

  async function endForAll() {
    if (!meetingId) return;
    try {
      await endFn({ data: { meetingId } });
      toast.success("Meeting ended. Notes are being prepared.");
      leave();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const shareUrl = useMemo(
    () => (typeof window === "undefined" ? "" : `${window.location.origin}/m/${code}`),
    [code],
  );

  if (state === "connecting") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-mint/15 text-mint">
            <Radio className="h-6 w-6 animate-pulse" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Connecting to the room…</p>
        </div>
      </main>
    );
  }
  if (state === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="text-center">
          <p className="text-lg font-semibold">Couldn't join</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => navigate({ to: "/app" })}
            className="mt-4 rounded-xl bg-mint px-4 py-2 text-sm font-semibold text-mint-foreground"
          >
            Back to dashboard
          </button>
        </div>
      </main>
    );
  }
  if (state === "ended") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="text-center">
          <p className="font-display text-2xl font-bold">You left the meeting</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {isHost ? "Notes are being generated — check your dashboard shortly." : "Hope it went well."}
          </p>
          <button
            onClick={() => navigate({ to: "/app" })}
            className="mt-4 rounded-xl bg-mint px-4 py-2 text-sm font-semibold text-mint-foreground"
          >
            Back to dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-mint" style={{ animation: "rec-pulse 1.6s infinite" }} />
          <span className="font-display text-sm font-semibold">Live · {code}</span>
        </div>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(shareUrl);
            toast.success("Invite link copied");
          }}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Copy className="h-3.5 w-3.5" /> Copy link
        </button>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden p-6">
          {/* Captions overlay */}
          <div className="pointer-events-none absolute inset-x-0 top-6 mx-auto flex max-w-2xl flex-col items-center gap-2 px-6">
            {captions.map((c) => (
              <div
                key={c.id}
                className="glass rounded-2xl px-4 py-2 text-center text-sm shadow-xl"
                style={{ animation: "fade-up 0.2s ease-out", opacity: c.final ? 1 : 0.75 }}
              >
                <span className="mr-1.5 text-xs font-semibold text-mint">{c.name}</span>
                <span>{c.text}</span>
              </div>
            ))}
          </div>

          {/* Speaker visualization */}
          <div className="flex h-40 items-end justify-center gap-1.5">
            {Array.from({ length: 22 }).map((_, i) => {
              const anySpeaking = participants.some((p) => p.speaking);
              return (
                <span
                  key={i}
                  className="block w-2 rounded-full bg-mint"
                  style={{
                    height: `${anySpeaking ? 40 + ((i * 53) % 60) : 8}%`,
                    animation: anySpeaking
                      ? `wave-pulse 0.8s ease-in-out ${i * 0.04}s infinite`
                      : undefined,
                    transition: "height 0.2s",
                    opacity: 0.65 + ((i * 37) % 35) / 100,
                  }}
                />
              );
            })}
          </div>

          <p className="mt-8 text-xs text-muted-foreground">
            {forceMuted ? "Muted by host" : muted ? "You're muted" : "You're live"}
          </p>
        </section>

        <aside className="border-t border-border p-4 md:w-80 md:border-l md:border-t-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> In the room · {participants.length}
          </div>
          <ul className="mt-3 space-y-1.5">
            {participants.map((p) => (
              <li
                key={p.identity}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                  p.speaking ? "border-mint/60 bg-mint/10" : "border-border/60"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      p.speaking ? "bg-mint" : "bg-muted-foreground/40"
                    }`}
                  />
                  <span>{p.name}{p.isLocal ? " (you)" : ""}</span>
                  {p.forceMuted && <MicOff className="h-3 w-3 text-destructive" />}
                </div>
                {isHost && !p.isLocal && (
                  <button
                    onClick={async () => {
                      if (!meetingId) return;
                      if (p.forceMuted) {
                        await releaseFn({ data: { meetingId, targetIdentity: p.identity } });
                        toast.success(`${p.name} can unmute themselves`);
                      } else {
                        await mutePartFn({ data: { meetingId, targetIdentity: p.identity } });
                        toast.success(`Muted ${p.name}`);
                      }
                    }}
                    className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary/60"
                  >
                    {p.forceMuted ? "Release" : "Mute"}
                  </button>
                )}
              </li>
            ))}
          </ul>

          {isHost && (
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <button
                onClick={async () => {
                  if (!meetingId) return;
                  await muteAllFn({ data: { meetingId } });
                  toast.success("Muted everyone");
                }}
                className="w-full rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm font-medium hover:bg-secondary"
              >
                Mute all
              </button>
              <button
                onClick={async () => {
                  if (!meetingId) return;
                  await releaseFn({ data: { meetingId } });
                  toast.success("Everyone can unmute themselves");
                }}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-secondary/60"
              >
                Release all mutes
              </button>
              <button
                onClick={endForAll}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-destructive/90 px-3 py-2 text-sm font-semibold text-destructive-foreground"
              >
                <Sparkles className="h-4 w-4" /> End meeting & generate notes
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* Bottom controls */}
      <footer className="flex items-center justify-center gap-4 border-t border-border bg-card/50 px-6 py-4">
        <button
          onClick={toggleMic}
          disabled={forceMuted && muted}
          className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition ${
            muted ? "bg-destructive text-destructive-foreground" : "bg-mint text-mint-foreground"
          } disabled:opacity-60`}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
        <button
          onClick={leave}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg"
          aria-label="Leave meeting"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </footer>
    </main>
  );
}
