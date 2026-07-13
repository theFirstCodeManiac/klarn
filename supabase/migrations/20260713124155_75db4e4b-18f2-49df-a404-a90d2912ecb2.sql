
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled meeting',
  notes_bot_enabled boolean NOT NULL DEFAULT true,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meetings_host_idx ON public.meetings(host_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated can read meetings" ON public.meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated can create meetings" ON public.meetings FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY "host can update own meeting" ON public.meetings FOR UPDATE TO authenticated USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);
CREATE POLICY "host can delete own meeting" ON public.meetings FOR DELETE TO authenticated USING (auth.uid() = host_id);

CREATE TABLE public.meeting_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz
);
CREATE INDEX mp_meeting_idx ON public.meeting_participants(meeting_id);
CREATE INDEX mp_user_idx ON public.meeting_participants(user_id);
GRANT SELECT, INSERT, UPDATE ON public.meeting_participants TO authenticated;
GRANT ALL ON public.meeting_participants TO service_role;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own participation or as host" ON public.meeting_participants FOR SELECT TO authenticated
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_id AND m.host_id = auth.uid()));
CREATE POLICY "insert own participation" ON public.meeting_participants FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "update own participation" ON public.meeting_participants FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.transcript_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  speaker_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  speaker_name text,
  text text NOT NULL,
  ts timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tl_meeting_idx ON public.transcript_lines(meeting_id);
GRANT SELECT, INSERT ON public.transcript_lines TO authenticated;
GRANT ALL ON public.transcript_lines TO service_role;
ALTER TABLE public.transcript_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read transcripts" ON public.transcript_lines FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_id AND (m.host_id = auth.uid() OR EXISTS (SELECT 1 FROM public.meeting_participants p WHERE p.meeting_id = m.id AND p.user_id = auth.uid()))));
CREATE POLICY "participants insert transcripts" ON public.transcript_lines FOR INSERT TO authenticated
WITH CHECK (speaker_id = auth.uid() AND EXISTS (SELECT 1 FROM public.meeting_participants p WHERE p.meeting_id = transcript_lines.meeting_id AND p.user_id = auth.uid()));

CREATE TABLE public.recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rec_meeting_idx ON public.recordings(meeting_id);
GRANT SELECT, INSERT ON public.recordings TO authenticated;
GRANT ALL ON public.recordings TO service_role;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "host reads recordings" ON public.recordings FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_id AND m.host_id = auth.uid()));

CREATE TABLE public.meeting_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid UNIQUE NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  summary text,
  decisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.meeting_notes TO authenticated;
GRANT ALL ON public.meeting_notes TO service_role;
ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read notes" ON public.meeting_notes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_id AND (m.host_id = auth.uid() OR EXISTS (SELECT 1 FROM public.meeting_participants p WHERE p.meeting_id = m.id AND p.user_id = auth.uid()))));
