-- ===========================================================
-- 20260101000600_schedules_and_materials_rpc.sql
-- Missing frontend tables, RPCs, and storage configuration
-- ===========================================================

-- ─────────────────────────────────────────────
-- TABLE: published_schedule
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.published_schedule (
  section     INTEGER NOT NULL CHECK (section BETWEEN 1 AND 30),
  day         TEXT NOT NULL,
  period      INTEGER NOT NULL CHECK (period BETWEEN 1 AND 8),
  subject     TEXT NOT NULL DEFAULT '',
  instructor  TEXT NOT NULL DEFAULT '',
  room        TEXT NOT NULL DEFAULT '',
  entry_type  TEXT NOT NULL DEFAULT 'lecture',
  is_holiday  BOOLEAN NOT NULL DEFAULT false,
  is_training BOOLEAN NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (section, day, period)
);

CREATE INDEX IF NOT EXISTS idx_published_schedule_section ON public.published_schedule(section);
CREATE INDEX IF NOT EXISTS idx_published_schedule_day ON public.published_schedule(day);
CREATE INDEX IF NOT EXISTS idx_published_schedule_sec_day ON public.published_schedule(section, day);

ALTER TABLE public.published_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all_published_schedule" ON public.published_schedule;
DROP POLICY IF EXISTS "public_read_published_schedule" ON public.published_schedule;

CREATE POLICY "owner_all_published_schedule" ON public.published_schedule
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "public_read_published_schedule" ON public.published_schedule
  FOR SELECT
  USING (true);

GRANT ALL ON public.published_schedule TO authenticated, service_role;
GRANT SELECT ON public.published_schedule TO anon;

-- ─────────────────────────────────────────────
-- TABLE: exam_schedules
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exam_schedules (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title              TEXT NOT NULL,
  exam_type          TEXT NOT NULL DEFAULT 'midterm',
  file_url           TEXT,
  file_name          TEXT,
  section            TEXT,
  exam_date          TEXT,
  exam_time          TEXT,
  subject_name       TEXT,
  instructor         TEXT,
  room               TEXT,
  day                TEXT,
  period             INTEGER,
  exam_location_type TEXT DEFAULT 'not_specified',
  uses_lecture_time  BOOLEAN DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exam_schedules_section ON public.exam_schedules(section);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_type ON public.exam_schedules(exam_type);

ALTER TABLE public.exam_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all_exam_schedules" ON public.exam_schedules;
DROP POLICY IF EXISTS "public_read_exam_schedules" ON public.exam_schedules;

CREATE POLICY "owner_all_exam_schedules" ON public.exam_schedules
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "public_read_exam_schedules" ON public.exam_schedules
  FOR SELECT
  USING (true);

GRANT ALL ON public.exam_schedules TO authenticated, service_role;
GRANT SELECT ON public.exam_schedules TO anon;

-- ─────────────────────────────────────────────
-- RPC: publish_all_schedule
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.publish_all_schedule(p_rows JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.published_schedule WHERE section > 0;
  
  INSERT INTO public.published_schedule (
    section, day, period, subject, instructor, room, entry_type, is_holiday, is_training, updated_at
  )
  SELECT 
    (r ->> 'section')::INTEGER,
    r ->> 'day',
    (r ->> 'period')::INTEGER,
    COALESCE(r ->> 'subject', ''),
    COALESCE(r ->> 'instructor', ''),
    COALESCE(r ->> 'room', ''),
    COALESCE(r ->> 'entry_type', 'lecture'),
    COALESCE((r ->> 'is_holiday')::BOOLEAN, false),
    COALESCE((r ->> 'is_training')::BOOLEAN, false),
    now()
  FROM jsonb_array_elements(p_rows) r
  WHERE COALESCE(r ->> 'subject', '') != '' 
     OR (r ->> 'is_holiday')::BOOLEAN IS TRUE 
     OR (r ->> 'is_training')::BOOLEAN IS TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_all_schedule(JSONB) TO authenticated, anon, service_role;

-- ─────────────────────────────────────────────
-- RPC: add_material, update_material, delete_material
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_material(
  p_slug text,
  p_title text,
  p_icon text DEFAULT '📚',
  p_instructor text DEFAULT '',
  p_second_instructor text DEFAULT NULL,
  p_teaching_assistants text[] DEFAULT '{}',
  p_articles jsonb DEFAULT '[]'::jsonb,
  p_sections_content jsonb DEFAULT '[]'::jsonb,
  p_pdf_url text DEFAULT NULL
)
RETURNS public.course_materials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mat public.course_materials;
BEGIN
  INSERT INTO public.course_materials (
    slug, title, icon, instructor, second_instructor, teaching_assistants, articles, sections_content, pdf_url
  )
  VALUES (
    p_slug, p_title, p_icon, p_instructor, p_second_instructor, p_teaching_assistants, p_articles, p_sections_content, p_pdf_url
  )
  RETURNING * INTO v_mat;
  RETURN v_mat;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_material(
  p_id uuid,
  p_title text,
  p_icon text DEFAULT '📚',
  p_instructor text DEFAULT '',
  p_second_instructor text DEFAULT NULL,
  p_teaching_assistants text[] DEFAULT '{}',
  p_articles jsonb DEFAULT '[]'::jsonb,
  p_sections_content jsonb DEFAULT '[]'::jsonb,
  p_pdf_url text DEFAULT NULL
)
RETURNS public.course_materials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mat public.course_materials;
BEGIN
  UPDATE public.course_materials SET
    title = p_title,
    icon = p_icon,
    instructor = p_instructor,
    second_instructor = p_second_instructor,
    teaching_assistants = p_teaching_assistants,
    articles = COALESCE(p_articles, articles),
    sections_content = COALESCE(p_sections_content, sections_content),
    pdf_url = COALESCE(p_pdf_url, pdf_url),
    updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_mat;
  RETURN v_mat;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_material(p_id uuid)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.course_materials WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_material(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], JSONB, JSONB, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_material(UUID, TEXT, TEXT, TEXT, TEXT, TEXT[], JSONB, JSONB, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_material(UUID) TO authenticated, service_role;

-- ─────────────────────────────────────────────
-- RPC ALIAS: set_session_expiry
-- Frontend calls set_session_expiry(p_session_id, p_expires_at)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_session_expiry(
  p_session_id UUID,
  p_expires_at TIMESTAMPTZ
)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  RETURN public.update_session_expiry(p_session_id, p_expires_at);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_session_expiry(UUID, TIMESTAMPTZ) TO authenticated, service_role;

-- ─────────────────────────────────────────────
-- STORAGE: exam-files bucket
-- ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('exam-files', 'exam-files', true, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$ BEGIN
  CREATE POLICY "Public Access exam-files" ON storage.objects
    FOR SELECT USING (bucket_id = 'exam-files');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated Upload exam-files" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'exam-files' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated Delete exam-files" ON storage.objects
    FOR DELETE USING (bucket_id = 'exam-files' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
