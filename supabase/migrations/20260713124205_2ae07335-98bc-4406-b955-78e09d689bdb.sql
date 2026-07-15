REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
-- 1. Create the 'meeting_transcript_lines' table
CREATE TABLE IF NOT EXISTS public.meeting_transcript_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
    speaker_name TEXT NOT NULL,
    text TEXT NOT NULL,
    final BOOLEAN DEFAULT FALSE,
    "timestamp" TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create the 'meeting_notes' table
CREATE TABLE IF NOT EXISTS public.meeting_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
    summary TEXT,
    action_items TEXT,
    "timestamp" TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create the 'meeting_recordings' table
CREATE TABLE IF NOT EXISTS public.meeting_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    file_url TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ DEFAULT NOW()
);