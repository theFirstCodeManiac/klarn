import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
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
  Download,
  Flame,
  Volume2,
  VolumeX,
  RefreshCw,
  Clock,
  ChevronRight,
  FileText,
  MessageSquare
} from "lucide-react";
import {
  joinMeeting,
  hostMuteAll,
  hostMuteParticipant,
  hostReleaseMute,
  saveTranscriptLine,
  endMeeting,
  getMeetingDetail,
} from "@/lib/meetings.functions";

export const Route = createFileRoute("/m/$code")({
  head: () => ({ meta: [{ title: "Meeting · Klarn" }] }),
  component: MeetingRoom,
});

type Caption = { id: string; identity: string; name: string; text: string; final: boolean; at: number };

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
  const getDetailFn = useServerFn(getMeetingDetail);

  const roomRef = useRef<Room | null>(null);
  const localTrackRef = useRef<LocalAudioTrack | null>(null);
  const recRef = useRef<{ stop?: () => void } | null>(null);
  
  const [state, setState] = useState<"connecting" | "live" | "ended" | "error">("connecting");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [forceMuted, setForceMuted] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [participants, setParticipants] = useState<
    { identity: string; name: string; speaking: boolean; forceMuted: boolean; isLocal: boolean }[]
  >([]);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [displayName, setDisplayName] = useState("");

  // Visualizer Canvas & Web Audio context refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const visualizerContextRef = useRef<AudioContext | null>(null);
  const visualizerAnalyserRef = useRef<AnalyserNode | null>(null);

  // Live Recording Refs & State
  const audioContextRef = useRef<AudioContext | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const connectedTracksRef = useRef<Map<string, MediaStreamAudioSourceNode>>(new Map());
  const isRecordingRef = useRef(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);

  // Post-call details
  const [meetingDetail, setMeetingDetail] = useState<any>(null);
  const [pollingDetail, setPollingDetail] = useState(false);

  // Fast mic acquisition ref — starts requesting mic access immediately on mount in parallel to API calls
  const micPrewarmPromiseRef = useRef<Promise<LocalAudioTrack | null> | null>(null);

  useEffect(() => {
    // PREWARM MICROPHONE: Request user media instantly to pop up browser prompt
    micPrewarmPromiseRef.current = createLocalAudioTrack({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    }).catch((err) => {
      console.warn("Speculative prewarm mic access rejected or failed:", err);
      return null;
    });

    return () => {
      if (visualizerContextRef.current) {
        visualizerContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Web Audio Visualizer connector helper
  const connectStreamToVisualizer = (stream: MediaStream) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!visualizerContextRef.current) {
        const ctx = new AudioContextClass();
        visualizerContextRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        visualizerAnalyserRef.current = analyser;
      }
      
      const ctx = visualizerContextRef.current;
      const analyser = visualizerAnalyserRef.current;
      if (!ctx || !analyser) return;

      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
    } catch (err) {
      console.warn("Failed to connect stream to canvas visualizer:", err);
    }
  };

  // Recording Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Start Call Recording
  const startRecording = () => {
    try {
      recordedChunksRef.current = [];
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;
      const dest = ctx.createMediaStreamDestination();
      destinationRef.current = dest;

      const sources = new Map<string, MediaStreamAudioSourceNode>();

      // Connect local mic track
      if (localTrackRef.current?.mediaStreamTrack) {
        const track = localTrackRef.current.mediaStreamTrack;
        const stream = new MediaStream([track]);
        const source = ctx.createMediaStreamSource(stream);
        source.connect(dest);
        sources.set(`local-${track.id}`, source);
      }

      // Connect subscribed remote participant tracks
      if (roomRef.current) {
        roomRef.current.remoteParticipants.forEach((p) => {
          p.trackPublications.forEach((pub) => {
            if (pub.track && pub.kind === Track.Kind.Audio && pub.track.mediaStreamTrack) {
              const track = pub.track.mediaStreamTrack;
              const stream = new MediaStream([track]);
              const source = ctx.createMediaStreamSource(stream);
              source.connect(dest);
              sources.set(`${p.identity}-${track.id}`, source);
            }
          });
        });
      }

      connectedTracksRef.current = sources;

      const recorder = new MediaRecorder(dest.stream, { mimeType: "audio/webm" });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setRecordingUrl(url);
      };

      recorder.start(1000);
      setIsRecording(true);
      isRecordingRef.current = true;
      setRecordingDuration(0);
      toast.success("Call recording started");
    } catch (err) {
      console.error("Failed to start call recording:", err);
      toast.error("Recording not supported on this browser context");
    }
  };

  // Stop Call Recording
  const stopRecording = () => {
    if (recorderRef.current && isRecordingRef.current) {
      recorderRef.current.stop();
      setIsRecording(false);
      isRecordingRef.current = false;
      toast.success("Recording stopped. File will be ready after call ends.");
      setTimeout(() => {
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(() => {});
        }
      }, 500);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function connect() {
      try {
        const info = await joinFn({ data: { code } });
        if (cancelled) return;
        setMeetingId(info.meeting.id);
        setMeetingTitle(info.meeting.title);
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
        room.on(RoomEvent.Disconnected, () => {
          if (isRecordingRef.current && recorderRef.current) {
            recorderRef.current.stop();
          }
          setState("ended");
        });
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

        // Get prewarmed mic track or request immediately if it hasn't loaded yet
        let track = await micPrewarmPromiseRef.current;
        if (!track) {
          track = await createLocalAudioTrack({
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          });
        }
        localTrackRef.current = track;

        await room.localParticipant.publishTrack(track, {
          name: "microphone",
          source: Track.Source.Microphone,
          dtx: true,
          red: true,
        });

        // Feed local microphone stream to Canvas audio visualizer
        if (track.mediaStreamTrack) {
          const stream = new MediaStream([track.mediaStreamTrack]);
          connectStreamToVisualizer(stream);
        }

        // Autoplay remote audio and feed to recording mixer & visualizer
        room.on(RoomEvent.TrackSubscribed, (_track, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (pub.kind === Track.Kind.Audio) {
            const el = pub.track?.attach();
            if (el) {
              el.setAttribute("playsinline", "true");
              (el as HTMLAudioElement).autoplay = true;
              document.body.appendChild(el);
            }

            // Feed remote track to audio visualizer
            if (pub.track?.mediaStreamTrack) {
              const stream = new MediaStream([pub.track.mediaStreamTrack]);
              connectStreamToVisualizer(stream);

              // Dynamically mix remote track if call recording is active
              if (isRecordingRef.current && audioContextRef.current && destinationRef.current) {
                try {
                  const ctx = audioContextRef.current;
                  const dest = destinationRef.current;
                  const source = ctx.createMediaStreamSource(stream);
                  source.connect(dest);
                  connectedTracksRef.current.set(`${participant.identity}-${pub.track.mediaStreamTrack.id}`, source);
                } catch (e) {
                  console.warn("Failed dynamically mixing incoming audio stream:", e);
                }
              }
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
      if (isRecordingRef.current && recorderRef.current) {
        recorderRef.current.stop();
      }
      recRef.current?.stop?.();
      const t = localTrackRef.current;
      if (t) t.stop();
      roomRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Audio Canvas visualizer drawing loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      if (canvas && canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth || 320;
        canvas.height = canvas.parentElement.clientHeight || 320;
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      animId = requestAnimationFrame(draw);
      const analyser = visualizerAnalyserRef.current;
      const w = canvas.width;
      const h = canvas.height;

      // Dark background fill
      ctx.fillStyle = "rgba(15, 20, 36, 0.18)";
      ctx.fillRect(0, 0, w, h);

      const centerX = w / 2;
      const centerY = h / 2;
      const baseRadius = w < 400 ? 55 : 75;

      if (!analyser) {
        // Idle ambient glowing circle
        ctx.shadowBlur = 10;
        ctx.shadowColor = "rgba(120, 240, 200, 0.25)";
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius + Math.sin(Date.now() / 400) * 4, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(120, 240, 200, 0.15)";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.shadowBlur = 0;
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const radius = baseRadius + average * 0.45;

      // Pulse Glow
      ctx.shadowBlur = 12 + average * 0.25;
      ctx.shadowColor = "rgba(120, 240, 200, 0.6)";

      // Glowing core gradient
      const grad = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, radius);
      grad.addColorStop(0, "rgba(20, 28, 48, 0.85)");
      grad.addColorStop(0.5, "rgba(120, 240, 200, 0.12)");
      grad.addColorStop(1, "rgba(120, 240, 200, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw responsive audio ring lines
      const barCount = 72;
      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2;
        const dataIdx = Math.floor((i / barCount) * (bufferLength * 0.65));
        const val = dataArray[dataIdx] || 0;
        const barHeight = (val / 255) * 85;

        const x1 = centerX + Math.cos(angle) * radius;
        const y1 = centerY + Math.sin(angle) * radius;
        const x2 = centerX + Math.cos(angle) * (radius + barHeight);
        const y2 = centerY + Math.sin(angle) * (radius + barHeight);

        const lineGrad = ctx.createLinearGradient(x1, y1, x2, y2);
        lineGrad.addColorStop(0, "rgba(120, 240, 200, 0.95)");
        lineGrad.addColorStop(1, "rgba(50, 190, 255, 0.2)");

        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
    };

    draw();
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animId);
    };
  }, [state]);

  // Poll for AI summary notes when call ends
  useEffect(() => {
    if (state !== "ended" || !meetingId) return;

    setPollingDetail(true);
    let attempts = 0;
    const interval = setInterval(async () => {
      try {
        const detail = await getDetailFn({ data: { id: meetingId } });
        setMeetingDetail(detail);
        attempts++;
        if (detail?.notes?.status === "ready" || detail?.notes?.status === "error" || attempts > 20) {
          clearInterval(interval);
          setPollingDetail(false);
        }
      } catch (err) {
        console.error("Failed to retrieve meeting details:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [state, meetingId]);

  function pushCaption(c: Caption) {
    setCaptions((prev) => {
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
      toast.message("Live captions aren't supported in this browser (try Chrome/Edge).");
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
    if (isRecordingRef.current && recorderRef.current) {
      recorderRef.current.stop();
    }
    recRef.current?.stop?.();
    roomRef.current?.disconnect();
    setState("ended");
  }

  async function endForAll() {
    if (!meetingId) return;
    try {
      await endFn({ data: { meetingId } });
      toast.success("Meeting ended. Notes are being generated.");
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
      <main className="flex min-h-screen items-center justify-center px-6 bg-background">
        <div className="text-center relative">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-mint/10 text-mint border border-mint/20 relative">
            <span className="absolute inset-0 rounded-full bg-mint/10 animate-ping opacity-60" style={{ animationDuration: "2s" }} />
            <Radio className="h-8 w-8 animate-pulse" />
          </div>
          <p className="mt-6 text-sm font-medium tracking-wide text-muted-foreground">Pre-warming mic & connecting to room…</p>
        </div>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 bg-background">
        <div className="text-center max-w-md glass rounded-3xl p-8 border border-border">
          <p className="text-lg font-semibold text-foreground">Couldn't join room</p>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{error}</p>
          <button
            onClick={() => navigate({ to: "/app" })}
            className="mt-6 rounded-xl bg-mint px-6 py-3 text-sm font-semibold text-mint-foreground transition hover:brightness-110"
          >
            Back to dashboard
          </button>
        </div>
      </main>
    );
  }

  // POST CALL SUMMARY & TRANSCRIPT ENDED SCREEN
  if (state === "ended") {
    const detail = meetingDetail || {};
    const notes = detail.notes || {};
    const lines = detail.lines || [];
    const actionItems = notes.action_items || [];
    const decisions = notes.decisions || [];

    return (
      <main className="relative min-h-screen bg-background py-10 px-5 overflow-y-auto">

        <div className="relative mx-auto max-w-4xl" style={{ animation: "scale-in 0.5s ease-out both" }}>
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-border pb-6 gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
                Meeting Ended
              </span>
              <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
                {meetingTitle || "Untitled Meeting"}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground font-mono">Code: {code}</p>
            </div>
            <button
              onClick={() => navigate({ to: "/app" })}
              className="inline-flex items-center justify-center rounded-xl bg-mint px-5 py-3 text-sm font-semibold text-mint-foreground transition hover:brightness-110 hover:scale-[1.02]"
              style={{ boxShadow: "0 4px 16px oklch(0.82 0.18 165 / 25%)" }}
            >
              Back to dashboard
            </button>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {/* Left AI Summary Details */}
            <div className="md:col-span-2 space-y-6">
              {/* Summary Card */}
              <div className="relative overflow-hidden rounded-2xl p-6" style={{ background: "linear-gradient(145deg, oklch(0.20 0.035 260), oklch(0.17 0.03 265))", border: "1px solid oklch(1 0 0 / 11%)" }}>
                <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-mint">
                  <Sparkles className="h-4.5 w-4.5" /> AI Summary
                </h2>

                {pollingDetail || notes.status === "pending" ? (
                  <div className="mt-4 space-y-3 animate-pulse">
                    <div className="h-4 rounded bg-muted w-11/12" />
                    <div className="h-4 rounded bg-muted w-full" />
                    <div className="h-4 rounded bg-muted w-4/5" />
                    <p className="text-xs text-muted-foreground mt-4 italic">Refining meeting summary with Gemini...</p>
                  </div>
                ) : notes.status === "empty" ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    No transcript captured. Enable mic/captions to get summary.
                  </p>
                ) : notes.status === "error" ? (
                  <p className="mt-4 text-sm text-destructive font-medium">Failed to compile AI summary.</p>
                ) : (
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {notes.summary || "No summary captured for this session."}
                  </p>
                )}
              </div>

              {/* Decisions Card */}
              {decisions.length > 0 && (
                <div className="rounded-2xl p-6" style={{ background: "linear-gradient(145deg, oklch(0.20 0.035 260), oklch(0.17 0.03 265))", border: "1px solid oklch(1 0 0 / 11%)" }}>
                  <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-mint flex items-center gap-2">
                    <Flame className="h-4 w-4" /> Decisions Made
                  </h2>
                  <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                    {decisions.map((d: string, i: number) => (
                      <li key={i} className="flex gap-2 items-start">
                        <span className="text-mint font-bold">•</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Items Card */}
              {actionItems.length > 0 && (
                <div className="rounded-2xl p-6" style={{ background: "linear-gradient(145deg, oklch(0.20 0.035 260), oklch(0.17 0.03 265))", border: "1px solid oklch(1 0 0 / 11%)" }}>
                  <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-mint flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Action Items
                  </h2>
                  <div className="mt-4 space-y-3">
                    {actionItems.map((item: any, i: number) => (
                      <div key={i} className="rounded-xl border border-border bg-background/45 p-4 text-sm flex justify-between items-start gap-4">
                        <div className="font-medium text-foreground">{item.task}</div>
                        {item.owner && (
                          <span className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full bg-mint/10 text-mint font-semibold border border-mint/25">
                            {item.owner}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Side Downloads & Transcript Summary */}
            <div className="space-y-6">
              {/* Recording Card */}
              {recordingUrl && (
                <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: "linear-gradient(145deg, oklch(0.20 0.035 260), oklch(0.17 0.03 265))", border: "1px solid oklch(0.82 0.18 165 / 25%)", boxShadow: "0 8px 32px oklch(0.82 0.18 165 / 8%)" }}>
                  <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-mint">Recording</h2>
                  <p className="mt-2 text-xs text-muted-foreground">The composite audio recording of the entire call is ready.</p>
                  
                  <a
                    href={recordingUrl}
                    download={`meeting-${code}-recording.webm`}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-mint-foreground transition hover:brightness-110"
                    style={{ background: "linear-gradient(135deg, oklch(0.82 0.18 165), oklch(0.70 0.18 185))" }}
                  >
                    <Download className="h-4.5 w-4.5" /> Download Audio
                  </a>
                </div>
              )}

              {/* Local Captions Transcript Card */}
              <div className="rounded-2xl p-6 flex flex-col max-h-[460px]" style={{ background: "linear-gradient(145deg, oklch(0.20 0.035 260), oklch(0.17 0.03 265))", border: "1px solid oklch(1 0 0 / 11%)" }}>
                <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-mint flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Live Transcript
                </h2>
                
                <div className="mt-4 flex-1 overflow-y-auto space-y-3.5 pr-1.5 text-sm">
                  {lines.length === 0 ? (
                    captions.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No captions were captured.</p>
                    ) : (
                      captions.map((c, i) => (
                        <div key={i} className="text-xs leading-relaxed">
                          <span className="font-semibold text-foreground mr-1.5">{c.name}:</span>
                          <span className="text-muted-foreground">{c.text}</span>
                        </div>
                      ))
                    )
                  ) : (
                    lines.map((l: any, i: number) => (
                      <div key={i} className="text-xs leading-relaxed">
                        <span className="font-semibold text-foreground mr-1.5">{l.speaker_name || "Someone"}:</span>
                        <span className="text-muted-foreground">{l.text}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-background relative overflow-hidden">

      <header className="flex items-center justify-between border-b border-border bg-card/10 px-5 py-3 relative z-10">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-mint" style={{ animation: "rec-pulse 1.6s infinite" }} />
          <span className="font-display text-sm font-semibold tracking-wide">Live · {code}</span>
          {isRecording && (
            <span className="ml-3 flex items-center gap-1.5 rounded-md bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive animate-pulse border border-destructive/25">
              REC {formatDuration(recordingDuration)}
            </span>
          )}
        </div>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(shareUrl);
            toast.success("Invite link copied to clipboard");
          }}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground hover:bg-secondary/40"
        >
          <Copy className="h-3.5 w-3.5" /> Copy link
        </button>
      </header>

      <div className="flex flex-1 flex-col md:flex-row relative z-10">
        {/* Main visualizer and captions space */}
        <section className="relative flex flex-1 flex-col items-center justify-center p-6 min-h-[360px]">
          {/* Captions Overlay */}
          <div className="pointer-events-none absolute inset-x-0 top-6 mx-auto flex max-w-2xl flex-col items-center gap-2 px-6 z-20">
            {captions.map((c) => (
              <div
                key={c.id}
                className="glass rounded-2xl px-4 py-2 text-center text-sm shadow-xl"
                style={{ animation: "fade-up 0.2s ease-out", opacity: c.final ? 1 : 0.75 }}
              >
                <span className="mr-1.5 text-xs font-semibold text-mint">{c.name}</span>
                <span className="text-foreground/90">{c.text}</span>
              </div>
            ))}
          </div>

          {/* HTML5 Canvas Audio visualizer */}
          <div className="relative w-full max-w-[280px] sm:max-w-md aspect-square flex items-center justify-center">
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full rounded-full" />
            <div className="relative flex flex-col items-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-mint/10 border border-mint/20 text-mint">
                <Mic className="h-6 w-6" />
              </div>
              <p className="mt-3 text-xs tracking-wider text-muted-foreground uppercase font-semibold">
                {forceMuted ? "Muted by host" : muted ? "Muted" : "Microphone Live"}
              </p>
            </div>
          </div>
        </section>

        {/* Sidebar participant list */}
        <aside className="border-t border-border p-4 md:w-80 md:border-l md:border-t-0 bg-card/15 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Users className="h-4 w-4" /> In the room · {participants.length}
          </div>
          <ul className="mt-4 space-y-2">
            {participants.map((p) => (
              <li
                key={p.identity}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition-all duration-300 ${
                  p.speaking
                    ? "border-mint/50 bg-mint/10 shadow-lg shadow-mint/5"
                    : "border-border bg-background/30"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${
                      p.speaking ? "bg-mint animate-pulse" : "bg-muted-foreground/30"
                    }`}
                  />
                  <span className="truncate font-medium text-foreground">{p.name}{p.isLocal ? " (you)" : ""}</span>
                  {p.forceMuted && <MicOff className="h-3.5 w-3.5 text-destructive flex-shrink-0" />}
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
                    className="rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  >
                    {p.forceMuted ? "Release" : "Mute"}
                  </button>
                )}
              </li>
            ))}
          </ul>

          {isHost && (
            <div className="mt-6 space-y-2.5 border-t border-border pt-6">
              <button
                onClick={async () => {
                  if (!meetingId) return;
                  await muteAllFn({ data: { meetingId } });
                  toast.success("Muted everyone in the room");
                }}
                className="w-full rounded-xl border border-border bg-secondary/30 px-3.5 py-2.5 text-sm font-semibold hover:bg-secondary"
              >
                Mute all participants
              </button>
              <button
                onClick={async () => {
                  if (!meetingId) return;
                  await releaseFn({ data: { meetingId } });
                  toast.success("Everyone can now unmute");
                }}
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm text-muted-foreground hover:bg-secondary/40"
              >
                Release all mute locks
              </button>
              <button
                onClick={endForAll}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-destructive-foreground transition hover:brightness-110"
                style={{ background: "linear-gradient(135deg, oklch(0.65 0.22 25), oklch(0.55 0.22 25))" }}
              >
                <Sparkles className="h-4.5 w-4.5" /> End meeting & summarize
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* Footer controls bar */}
      <footer className="flex items-center justify-center gap-4 border-t border-border bg-card/25 backdrop-blur-md px-6 py-4 relative z-10">
        <button
          onClick={toggleMic}
          disabled={forceMuted && muted}
          className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition duration-200 hover:scale-105 disabled:opacity-50 ${
            muted
              ? "bg-destructive text-destructive-foreground"
              : "bg-mint text-mint-foreground"
          }`}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        {/* Live Recording button */}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition duration-200 hover:scale-105 ${
            isRecording
              ? "bg-destructive text-white border border-destructive/20 relative"
              : "bg-secondary text-foreground hover:bg-secondary/80 border border-border"
          }`}
          aria-label={isRecording ? "Stop recording" : "Record call"}
          title={isRecording ? "Stop recording" : "Record call"}
        >
          {isRecording ? (
            <>
              <span className="absolute inset-0 rounded-full bg-destructive/20 animate-ping opacity-60" style={{ animationDuration: "1.8s" }} />
              <div className="h-4 w-4 bg-white rounded-sm" />
            </>
          ) : (
            <Radio className="h-5 w-5 text-muted-foreground hover:text-foreground" />
          )}
        </button>

        <button
          onClick={leave}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition duration-200 hover:scale-105"
          aria-label="Leave meeting"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </footer>
    </main>
  );
}
