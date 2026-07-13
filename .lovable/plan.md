# Meet-style Voice Calling App

Web app where users sign up with email + OTP, host or join voice-only meetings via shareable links, get live captions, record sessions, and receive AI-generated meeting notes automatically. Installable as a PWA.

## Scope

**In**
- Email + 6-digit OTP auth (Lovable Cloud) — no magic link
- Create meeting → shareable `/m/<code>` link
- Real-time voice via **LiveKit Cloud SFU** — scales cleanly to large rooms (not mesh)
- Server-side noise suppression + echo cancellation (LiveKit Krisp noise filter + browser AEC)
- Live subtitles: each speaker's own mic transcribed in-browser (Web Speech API), broadcast to all peers via LiveKit data channels
- Host controls: mute one participant / mute everyone; muted users cannot self-unmute until host releases them (enforced server-side via LiveKit `mute_track` + room metadata)
- Self mute/unmute (when not force-muted)
- Participant list with live speaking indicator (LiveKit `isSpeaking`)
- **Meeting recording**: server-side composite audio recording via LiveKit Egress → stored in Lovable Cloud Storage, listed in host dashboard with playback + download
- **AI Notes Bot (on by default)**: ingests the live transcript stream and on meeting end generates structured notes (summary, decisions, action items, topics) via Lovable AI. Host can toggle off per meeting.
- **Installable PWA**: real web app manifest, icons, install prompt captured on load. The 2-second popup uses that captured `beforeinstallprompt` event to trigger the native install flow on Android/desktop Chromium; iOS gets a "Tap Share → Add to Home Screen" instruction card (iOS has no programmatic install). Modal reappears on every load until the app is installed (detected via `matchMedia('(display-mode: standalone)')` + `appinstalled` event).
- Fully free, no paywall

**Honest scope notes**
- The PWA is an installable web app — not a native App Store binary. That's what "download the app" means here.
- Web Speech API captions require Chrome/Edge/Safari; Firefox users see "captions unavailable in this browser" (recording + AI notes still work).

## Technical approach

**Voice + scaling (no degradation past 6)** — **LiveKit Cloud** SFU. Each client uploads one audio stream; the server fans it out. Scales to 100+ per room. Needs `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` — I'll request these via `add_secret` once approved (free tier is enough for dev + light prod).

**Auth** — Lovable Cloud email OTP (`signInWithOtp` with 6-digit token, `verifyOtp`). Trigger auto-creates `profiles` row.

**Room tokens** — Server function mints short-lived LiveKit JWTs scoped to room + identity; host gets `roomAdmin`.

**Noise suppression** — LiveKit `KrispNoiseFilter` on the client + `echoCancellation`/`autoGainControl` in `getUserMedia`.

**Captions** — `webkitSpeechRecognition` transcribes each speaker's own mic locally, publishes over LiveKit data channels. Everyone renders bubbles bound to speaker identity. Same stream feeds the notes bot.

**Host mute enforcement** — Server fn uses LiveKit server SDK to `mutePublishedTrack(...)` + writes `forceMutedUntil` into participant metadata. Client disables self-unmute button when metadata says force-muted. Only host clears it.

**Recording** — Server fn starts LiveKit **Room Composite Egress** to MP4 audio, uploads to private Lovable Cloud Storage bucket `recordings`; inserts row in `recordings` table. Host sees list + signed-URL playback.

**AI Notes Bot**
1. Meeting create → `meeting_notes` row with `status='pending'`.
2. Transcript final chunks appended to `transcript_lines` via server fn.
3. Meeting end (host ends, or last participant leaves) → server fn pulls all lines, calls Lovable AI (`google/gemini-3-flash-preview`) for `{ summary, decisions[], action_items[], topics[] }`, saves to `meeting_notes.content`, sets `status='ready'`.
4. Notes visible on meeting detail page; exportable as Markdown.

**PWA / installability**
- `public/manifest.webmanifest`: name, short_name, `display: "standalone"`, theme_color, background_color, icons (192, 512, maskable 512).
- Generated app icons via image gen (mint waveform mark on midnight).
- `<link rel="manifest">`, `theme-color`, `apple-touch-icon` in `__root.tsx` head.
- **No service worker** (no offline support asked for; per PWA skill, manifest-only is enough for installability and avoids preview breakage).
- Client-side install controller:
  - Captures `beforeinstallprompt` on load, stores it.
  - After 2s on every mount, opens the promo modal.
  - "Install app" button calls the stored prompt → native install dialog. If none is available (iOS Safari, or Firefox), modal shows platform-specific instructions ("Share → Add to Home Screen").
  - Hides the modal permanently once `matchMedia('(display-mode: standalone)')` is true or `appinstalled` fires.

## Data model

```
profiles(id uuid pk → auth.users, email, display_name)
meetings(id uuid pk, code text unique, host_id uuid, title, notes_bot_enabled bool default true,
         started_at, ended_at)
meeting_participants(id, meeting_id, user_id, joined_at, left_at)
transcript_lines(id, meeting_id, speaker_id, text, is_final, ts)
recordings(id, meeting_id, storage_path, duration_seconds, created_at)
meeting_notes(id, meeting_id unique, status, summary, decisions jsonb, action_items jsonb, topics jsonb)
```
Plus GRANTs, RLS (host full access; participants read-only to rooms they joined), private `recordings` storage bucket.

## Routes

- `/` — landing
- `/auth` — email + OTP
- `/app` — dashboard: new meeting, past meetings (recordings + notes badges), join by code
- `/m/$code` — meeting room
- `/app/meetings/$id` — post-meeting: playback, AI notes, transcript
- `/download` — install instructions per platform (also used as PWA `start_url` target so installed launches land on `/app` after auth)

## Design direction

Dark, modern, high-contrast. Midnight `oklch(0.18 0.03 260)`, electric mint `oklch(0.82 0.16 165)`, glass cards. Animated waveform landing, pill controls, floating caption bubbles, pulsing red dot when recording. Space Grotesk headings + Inter body. No purple.

## Build order

1. Enable Lovable Cloud → schema, RLS, profile trigger, recordings bucket
2. Request `LIVEKIT_*` secrets via `add_secret`
3. Design system in `src/styles.css`
4. Generate PWA icons, add manifest + head tags, install controller + install modal
5. Email OTP auth + `/auth` + root session listener
6. `_authenticated` layout + `/app` dashboard + meeting creation
7. LiveKit token server fn + meeting room UI (join, audio, participant list, self mute)
8. Host controls (mute one / mute all / end meeting) via LiveKit server SDK
9. Captions: Web Speech + data channels + overlay
10. Recording start/stop via Egress; storage + `recordings` list
11. AI notes bot: transcript capture + end-of-meeting summarization + notes page
12. Landing page
13. SEO metadata, `sitemap.xml`, `robots.txt`, `llms.txt`

Approve and I'll build it end-to-end.
