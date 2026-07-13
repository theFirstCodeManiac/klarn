import { createServerFn } from "@tanstack/react-start";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function livekitEnv() {
  const url = process.env.LIVEKIT_URL!;
  const apiKey = process.env.LIVEKIT_API_KEY!;
  const apiSecret = process.env.LIVEKIT_API_SECRET!;
  // LiveKit server SDK needs an HTTP(S) URL, not the wss URL, for RoomService.
  const httpUrl = url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
  return { url, httpUrl, apiKey, apiSecret };
}

function randomCode() {
  // e.g. "khn-92m-vtq" (short shareable code)
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const grab = (n: number) =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `${grab(3)}-${grab(3)}-${grab(3)}`;
}

/** Host: create a new meeting. Returns { code }. */
export const createMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      title: z.string().min(1).max(120).default("Untitled meeting"),
      notes_bot_enabled: z.boolean().default(true),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    for (let i = 0; i < 5; i++) {
      const code = randomCode();
      const { data: row, error } = await supabase
        .from("meetings")
        .insert({
          code,
          host_id: userId,
          title: data.title,
          notes_bot_enabled: data.notes_bot_enabled,
        })
        .select("id, code")
        .single();
      if (!error && row) {
        // seed a pending notes row so we can update it later
        await supabase
          .from("meeting_notes")
          .insert({ meeting_id: row.id, status: "pending" });
        return row;
      }
    }
    throw new Error("Could not create meeting");
  });

/** Get meeting by code (for the join screen). */
export const getMeetingByCode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ code: z.string().min(1) }).parse)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("meetings")
      .select("id, code, title, host_id, notes_bot_enabled, ended_at, started_at")
      .eq("code", data.code)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Meeting not found");
    return row;
  });

/** Mint a LiveKit access token and register the participant. */
export const joinMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ code: z.string() }).parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: meeting, error } = await supabase
      .from("meetings")
      .select("id, code, host_id, title, notes_bot_enabled, ended_at")
      .eq("code", data.code)
      .maybeSingle();
    if (error) throw error;
    if (!meeting) throw new Error("Meeting not found");
    if (meeting.ended_at) throw new Error("This meeting has ended");

    // upsert participant
    await supabase.from("meeting_participants").insert({
      meeting_id: meeting.id,
      user_id: userId,
    });

    // mark started_at if host is first
    if (meeting.host_id === userId) {
      await supabase
        .from("meetings")
        .update({ started_at: new Date().toISOString() })
        .eq("id", meeting.id)
        .is("started_at", null);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", userId)
      .maybeSingle();

    const isHost = meeting.host_id === userId;
    const displayName = profile?.display_name || profile?.email || "Guest";

    const { url, apiKey, apiSecret } = livekitEnv();
    const at = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: displayName,
      ttl: "2h",
    });
    at.addGrant({
      room: meeting.id,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: isHost,
      roomCreate: isHost,
    });

    return {
      token: await at.toJwt(),
      wsUrl: url,
      meeting: { id: meeting.id, code: meeting.code, title: meeting.title, host_id: meeting.host_id, notes_bot_enabled: meeting.notes_bot_enabled },
      identity: userId,
      displayName,
      isHost,
    };
  });

/** Host mutes a participant's mic. */
export const hostMuteParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ meetingId: z.string().uuid(), targetIdentity: z.string() }).parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: meeting } = await supabase
      .from("meetings")
      .select("host_id")
      .eq("id", data.meetingId)
      .maybeSingle();
    if (!meeting || meeting.host_id !== userId) throw new Error("Only the host can mute participants");

    const { httpUrl, apiKey, apiSecret } = livekitEnv();
    const svc = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    // fetch tracks and mute all audio pubs for target
    const participants = await svc.listParticipants(data.meetingId);
    const target = participants.find((p) => p.identity === data.targetIdentity);
    if (target) {
      for (const t of target.tracks) {
        if (t.type === 0 /* AUDIO */ || t.source === 1 /* MICROPHONE */) {
          await svc.mutePublishedTrack(data.meetingId, data.targetIdentity, t.sid, true);
        }
      }
    }
    // mark forced-muted in metadata so client can hide unmute button
    const meta = JSON.stringify({ forceMuted: true, at: Date.now() });
    await svc.updateParticipant(data.meetingId, data.targetIdentity, meta);
    return { ok: true };
  });

/** Host mutes everyone except themselves. */
export const hostMuteAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ meetingId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: meeting } = await supabase
      .from("meetings")
      .select("host_id")
      .eq("id", data.meetingId)
      .maybeSingle();
    if (!meeting || meeting.host_id !== userId) throw new Error("Only the host can mute all");

    const { httpUrl, apiKey, apiSecret } = livekitEnv();
    const svc = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    const participants = await svc.listParticipants(data.meetingId);
    for (const p of participants) {
      if (p.identity === userId) continue;
      for (const t of p.tracks) {
        if (t.type === 0 || t.source === 1) {
          try {
            await svc.mutePublishedTrack(data.meetingId, p.identity, t.sid, true);
          } catch (e) {
            console.error("mute failed", p.identity, e);
          }
        }
      }
      const meta = JSON.stringify({ forceMuted: true, at: Date.now() });
      try {
        await svc.updateParticipant(data.meetingId, p.identity, meta);
      } catch {}
    }
    return { ok: true };
  });

/** Host releases the forced-mute lock on a participant (or all). */
export const hostReleaseMute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ meetingId: z.string().uuid(), targetIdentity: z.string().optional() }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: meeting } = await supabase
      .from("meetings")
      .select("host_id")
      .eq("id", data.meetingId)
      .maybeSingle();
    if (!meeting || meeting.host_id !== userId) throw new Error("Only the host");

    const { httpUrl, apiKey, apiSecret } = livekitEnv();
    const svc = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    const participants = await svc.listParticipants(data.meetingId);
    for (const p of participants) {
      if (data.targetIdentity && p.identity !== data.targetIdentity) continue;
      if (p.identity === userId) continue;
      try {
        await svc.updateParticipant(data.meetingId, p.identity, JSON.stringify({ forceMuted: false }));
      } catch {}
    }
    return { ok: true };
  });

/** Save a final transcript line. Called client-side by the current speaker. */
export const saveTranscriptLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      meetingId: z.string().uuid(),
      text: z.string().min(1).max(2000),
      speakerName: z.string().max(120).optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("transcript_lines").insert({
      meeting_id: data.meetingId,
      speaker_id: userId,
      speaker_name: data.speakerName ?? null,
      text: data.text,
    });
    if (error) throw error;
    return { ok: true };
  });

/** End a meeting (host only). Triggers AI notes generation. */
export const endMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ meetingId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: meeting } = await supabase
      .from("meetings")
      .select("id, host_id, notes_bot_enabled")
      .eq("id", data.meetingId)
      .maybeSingle();
    if (!meeting || meeting.host_id !== userId) throw new Error("Only the host can end the meeting");

    await supabase
      .from("meetings")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", meeting.id);

    // best effort: shut down livekit room
    try {
      const { httpUrl, apiKey, apiSecret } = livekitEnv();
      const svc = new RoomServiceClient(httpUrl, apiKey, apiSecret);
      await svc.deleteRoom(meeting.id);
    } catch (e) {
      console.error("deleteRoom", e);
    }

    if (meeting.notes_bot_enabled) {
      await generateNotesInternal(supabase, meeting.id);
    }
    return { ok: true };
  });

async function generateNotesInternal(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  meetingId: string,
) {
  const { data: lines } = await supabase
    .from("transcript_lines")
    .select("speaker_name, text, ts")
    .eq("meeting_id", meetingId)
    .order("ts", { ascending: true });

  if (!lines || lines.length === 0) {
    await supabase
      .from("meeting_notes")
      .update({ status: "empty", summary: "No transcript was captured during this meeting." })
      .eq("meeting_id", meetingId);
    return;
  }

  const transcript = lines
    .map((l) => `${l.speaker_name ?? "Someone"}: ${l.text}`)
    .join("\n");

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    await supabase
      .from("meeting_notes")
      .update({ status: "error", summary: "AI notes unavailable (API key missing)." })
      .eq("meeting_id", meetingId);
    return;
  }

  const systemPrompt =
    "You are a professional meeting-notes assistant. Given a raw meeting transcript, return concise structured JSON with fields: summary (2-4 sentences), topics (string[]), decisions (string[]), action_items (array of {task, owner}). Owner may be null. Never invent facts.";

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Transcript:\n\n${transcript}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_notes",
              description: "Return structured meeting notes",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  topics: { type: "array", items: { type: "string" } },
                  decisions: { type: "array", items: { type: "string" } },
                  action_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        task: { type: "string" },
                        owner: { type: ["string", "null"] },
                      },
                      required: ["task"],
                    },
                  },
                },
                required: ["summary", "topics", "decisions", "action_items"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_notes" } },
      }),
    });
    if (!res.ok) throw new Error(`AI ${res.status}`);
    const json = await res.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    const args = call ? JSON.parse(call.function.arguments) : null;
    if (!args) throw new Error("No notes returned");
    await supabase
      .from("meeting_notes")
      .update({
        status: "ready",
        summary: args.summary ?? null,
        topics: args.topics ?? [],
        decisions: args.decisions ?? [],
        action_items: args.action_items ?? [],
        updated_at: new Date().toISOString(),
      })
      .eq("meeting_id", meetingId);
  } catch (e) {
    console.error("notes generation failed", e);
    await supabase
      .from("meeting_notes")
      .update({ status: "error", summary: "Failed to generate notes." })
      .eq("meeting_id", meetingId);
  }
}

/** List meetings I hosted. */
export const listMyMeetings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("meetings")
      .select("id, code, title, started_at, ended_at, created_at, notes_bot_enabled")
      .eq("host_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  });

/** Get meeting detail + notes. */
export const getMeetingDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { data: meeting } = await context.supabase
      .from("meetings")
      .select("id, code, title, host_id, notes_bot_enabled, started_at, ended_at, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!meeting) throw new Error("Not found");
    const { data: notes } = await context.supabase
      .from("meeting_notes")
      .select("*")
      .eq("meeting_id", data.id)
      .maybeSingle();
    const { data: lines } = await context.supabase
      .from("transcript_lines")
      .select("speaker_name, text, ts")
      .eq("meeting_id", data.id)
      .order("ts", { ascending: true });
    return { meeting, notes, lines: lines ?? [] };
  });
