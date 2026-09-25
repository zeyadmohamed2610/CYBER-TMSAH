-- Migration 9: Seed exact official timetable for Helwan Int'l Technological University
-- Faculty of Technology in Cairo | Cyber-Security Technology | Year 2 | Term 1 2026/2027

-- 1. Ensure table constraint allows periods up to 12
ALTER TABLE public.published_schedule DROP CONSTRAINT IF EXISTS published_schedule_period_check;
ALTER TABLE public.published_schedule ADD CONSTRAINT published_schedule_period_check CHECK (period BETWEEN 1 AND 12);

-- 2. Clear old schedule data
DELETE FROM public.published_schedule;

-- 3. Helper procedure to insert multi-section lecture
CREATE OR REPLACE FUNCTION pg_temp.insert_lecture(
  p_sections integer[],
  p_day text,
  p_period integer,
  p_subject text,
  p_instructor text,
  p_room text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  s integer;
BEGIN
  FOREACH s IN ARRAY p_sections LOOP
    INSERT INTO public.published_schedule (section, day, period, subject, instructor, room, entry_type, is_holiday, is_training)
    VALUES (s, p_day, p_period, p_subject, p_instructor, p_room, 'lecture', false, false)
    ON CONFLICT (section, day, period) 
    DO UPDATE SET subject = EXCLUDED.subject, instructor = EXCLUDED.instructor, room = EXCLUDED.room, entry_type = EXCLUDED.entry_type;
  END LOOP;
END;
$$;

-- Helper procedure to insert single or dual section entry
CREATE OR REPLACE FUNCTION pg_temp.insert_entry(
  p_sections integer[],
  p_day text,
  p_period integer,
  p_subject text,
  p_instructor text,
  p_room text,
  p_type text DEFAULT 'section'
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  s integer;
BEGIN
  FOREACH s IN ARRAY p_sections LOOP
    INSERT INTO public.published_schedule (section, day, period, subject, instructor, room, entry_type, is_holiday, is_training)
    VALUES (s, p_day, p_period, p_subject, p_instructor, p_room, p_type, false, false)
    ON CONFLICT (section, day, period) 
    DO UPDATE SET subject = EXCLUDED.subject, instructor = EXCLUDED.instructor, room = EXCLUDED.room, entry_type = EXCLUDED.entry_type;
  END LOOP;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- FRIDAY (الجمعة)
-- ══════════════════════════════════════════════════════════════════════════════
-- P1 (09:00 - 10:00)
SELECT pg_temp.insert_lecture(ARRAY[1,2,3,4], 'الجمعة', 1, 'Programming For Cyber-Security', 'Dr. Abeer Hassan', 'A-New');
SELECT pg_temp.insert_entry(ARRAY[7,8], 'الجمعة', 1, '(1) Programming For Cyber Security', 'Eng. Karim Adel', 'A02', 'section');
SELECT pg_temp.insert_entry(ARRAY[14,15], 'الجمعة', 1, '(2) Programming For Cyber Security', 'Eng. Karim Adel', 'G204', 'section');

-- P2 (10:00 - 11:00)
SELECT pg_temp.insert_lecture(ARRAY[6,7,8], 'الجمعة', 2, 'Programming For Cyber-Security', 'Dr. Abeer Hassan', 'A-New');
SELECT pg_temp.insert_entry(ARRAY[10,11], 'الجمعة', 2, '(1) Programming For Cyber Security', 'Eng. Karim Adel', 'A02', 'section');
SELECT pg_temp.insert_entry(ARRAY[12,13], 'الجمعة', 2, '(2) Programming For Cyber Security', 'Eng. Karim Adel', 'G204', 'section');

-- P3 (11:00 - 12:00)
SELECT pg_temp.insert_lecture(ARRAY[11,12,13], 'الجمعة', 3, 'Programming For Cyber-Security', 'Dr. Abeer Hassan', 'A-New');
SELECT pg_temp.insert_entry(ARRAY[8,9], 'الجمعة', 3, '(1) Programming For Cyber Security', 'Eng. Karim Adel', 'A02', 'section');

-- P4 (02:00 - 03:00)
SELECT pg_temp.insert_lecture(ARRAY[1,2,3], 'الجمعة', 4, 'Internet Application Development', 'Dr. Finan Nasy', 'G205');
SELECT pg_temp.insert_entry(ARRAY[8,9], 'الجمعة', 4, '(2) Programming For Cyber Security', 'Eng. Karim Adel', 'G204', 'section');
SELECT pg_temp.insert_entry(ARRAY[14], 'الجمعة', 4, '(1) Programming For Cyber Security', 'Eng. Karim Adel', 'A02', 'section');

-- P5 (03:00 - 04:00)
SELECT pg_temp.insert_lecture(ARRAY[5,6,7], 'الجمعة', 5, 'Internet Application Development', 'Dr. Finan Nasy', 'G205');
SELECT pg_temp.insert_entry(ARRAY[10,11], 'الجمعة', 5, '(2) Programming For Cyber Security', 'Eng. Karim Adel', 'G204', 'section');
SELECT pg_temp.insert_entry(ARRAY[12], 'الجمعة', 5, '(1) Programming For Cyber Security', 'Eng. Karim Adel', 'A02', 'section');

-- P6 (04:00 - 05:00)
SELECT pg_temp.insert_lecture(ARRAY[9,10,11], 'الجمعة', 6, 'Internet Application Development', 'Dr. Finan Nasy', 'G205');
SELECT pg_temp.insert_entry(ARRAY[13], 'الجمعة', 6, '(1) Programming For Cyber Security', 'Eng. Karim Adel', 'A02', 'section');

-- P7 (05:00 - 06:00)
SELECT pg_temp.insert_entry(ARRAY[9,10], 'الجمعة', 7, '(2) Programming For Cyber Security', 'Eng. Karim Adel', 'A02', 'section');
SELECT pg_temp.insert_lecture(ARRAY[12,13,14,15], 'الجمعة', 7, 'Internet Application Development', 'Dr. Finan Nasy', 'G205');

-- P8 (06:00 - 07:00)
SELECT pg_temp.insert_entry(ARRAY[14,15], 'الجمعة', 8, '(1) Programming For Cyber Security', 'Eng. Karim Adel', 'A02', 'section');

-- P9 (07:00 - 08:00) - Online for all sections
SELECT pg_temp.insert_lecture(ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], 'الجمعة', 9, 'Occupational Safety and Health', 'Dr. Hussen Al-Saved', 'O.L');

-- ══════════════════════════════════════════════════════════════════════════════
-- SUNDAY (الأحد)
-- ══════════════════════════════════════════════════════════════════════════════
-- P1 (09:00 - 10:00)
SELECT pg_temp.insert_lecture(ARRAY[1,2,3,4], 'الاحد', 1, 'Network Security Protocol', 'Dr. Alaa Al-Shenhaby', 'A304');
SELECT pg_temp.insert_entry(ARRAY[7], 'الاحد', 1, '(1) Network Security Protocol', 'Eng. Omar', 'A01', 'section');

-- P2 (10:00 - 11:00)
SELECT pg_temp.insert_lecture(ARRAY[5,6,7], 'الاحد', 2, 'Network Security Protocol', 'Dr. Alaa Al-Shenhaby', 'A304');

-- P3 (11:00 - 12:00)
SELECT pg_temp.insert_lecture(ARRAY[9,10,11], 'الاحد', 3, 'Network Security Protocol', 'Dr. Alaa Al-Shenhaby', 'A304');

-- P4 (12:00 - 01:00)
SELECT pg_temp.insert_lecture(ARRAY[12,13,14,15], 'الاحد', 4, 'Network Security Protocol', 'Dr. Alaa Al-Shenhaby', 'A304');

-- P5 (01:00 - 02:00)
SELECT pg_temp.insert_entry(ARRAY[7], 'الاحد', 5, '(1) Internet Application Development', 'Eng. Habiba', 'A01', 'section');

-- P8 (04:00 - 05:00)
SELECT pg_temp.insert_entry(ARRAY[2], 'الاحد', 8, '(1) Artificial Intelligence', 'Eng. Mahmoud', 'A02', 'section');

-- P9 (05:00 - 06:00)
SELECT pg_temp.insert_entry(ARRAY[2], 'الاحد', 9, '(1) Artificial Intelligence', 'Eng. Mahmoud', 'A02', 'section');
SELECT pg_temp.insert_entry(ARRAY[5,6], 'الاحد', 9, '(2) Artificial Intelligence', 'Eng. Mario', 'G201', 'section');

-- P10 (06:00 - 07:00)
SELECT pg_temp.insert_entry(ARRAY[1], 'الاحد', 10, '(1) Network Security Protocol', 'Eng. Omnia', 'A01', 'section');
SELECT pg_temp.insert_entry(ARRAY[3], 'الاحد', 10, '(2) Secured Network', 'Eng. Rodina', 'G204', 'section');
SELECT pg_temp.insert_entry(ARRAY[7,8], 'الاحد', 10, '(2) Artificial Intelligence', 'Eng. Mario', 'G201', 'section');
SELECT pg_temp.insert_entry(ARRAY[9], 'الاحد', 10, '(2) Network Security Protocol', 'Eng. Omar', 'A202', 'section');

-- P11 (07:00 - 08:00) - Online for all sections
SELECT pg_temp.insert_lecture(ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], 'الاحد', 11, 'History of Technology', 'Dr. Heba Gamal', 'O.N');

-- ══════════════════════════════════════════════════════════════════════════════
-- MONDAY (الاثنين)
-- ══════════════════════════════════════════════════════════════════════════════
-- P2 (10:00 - 11:00)
SELECT pg_temp.insert_entry(ARRAY[2], 'الاثنين', 2, '(1) Internet Application Development', 'Eng. Walaa Gomaa', 'A02', 'section');

-- P4 (12:00 - 01:00)
SELECT pg_temp.insert_entry(ARRAY[3], 'الاثنين', 4, '(1) Internet Applications Development', 'Eng. Walaa Gomaa', 'A01', 'section');

-- P5 (01:00 - 02:00)
SELECT pg_temp.insert_entry(ARRAY[2], 'الاثنين', 5, '(2) Internet Applications Development', 'Eng. Walaa Gomaa', 'G202', 'section');
SELECT pg_temp.insert_entry(ARRAY[4], 'الاثنين', 5, '(1) Internet Applications Development', 'Eng. Walaa Gomaa', 'A01', 'section');

-- P6 (02:00 - 03:00)
SELECT pg_temp.insert_entry(ARRAY[3], 'الاثنين', 6, '(2) Internet Applications Development', 'Eng. Walaa Gomaa', 'G202', 'section');
SELECT pg_temp.insert_entry(ARRAY[5], 'الاثنين', 6, '(1) Internet Application Development', 'Eng. Habiba', 'A01', 'section');

-- P7 (03:00 - 04:00)
SELECT pg_temp.insert_entry(ARRAY[3], 'الاثنين', 7, '(1) Internet Applications Development', 'Eng. Walaa Gomaa', 'A01', 'section');
SELECT pg_temp.insert_entry(ARRAY[5], 'الاثنين', 7, '(2) Internet Applications Development', 'Eng. Walaa Gomaa', 'G202', 'section');
SELECT pg_temp.insert_entry(ARRAY[9], 'الاثنين', 7, '(2) Artificial Intelligence', 'Eng. Mario', 'G201', 'section');

-- P8 (04:00 - 05:00)
SELECT pg_temp.insert_entry(ARRAY[1], 'الاثنين', 8, '(2) Network Security Protocol', 'Eng. Omnia', 'G202', 'section');
SELECT pg_temp.insert_entry(ARRAY[10], 'الاثنين', 8, '(1) Artificial Intelligence', 'Eng. Mahmoud', 'A202', 'section');
SELECT pg_temp.insert_entry(ARRAY[10], 'الاثنين', 8, '(2) Secured Network', 'Eng. Rodina', 'F-SEMINAR', 'section');
SELECT pg_temp.insert_entry(ARRAY[12,13], 'الاثنين', 8, '(1) Secured Network', 'Eng. Mohannad', 'G204', 'section');

-- P9 (05:00 - 06:00)
SELECT pg_temp.insert_entry(ARRAY[8], 'الاثنين', 9, 'Internet Applications Development', 'Eng. Habiba', 'G203', 'section');
SELECT pg_temp.insert_entry(ARRAY[9], 'الاثنين', 9, '(2) Network Security Protocol', 'Eng. Omar', 'A02', 'section');
SELECT pg_temp.insert_entry(ARRAY[11], 'الاثنين', 9, '(2) Network Security Protocol', 'Eng. Omar', 'A01', 'section');
SELECT pg_temp.insert_entry(ARRAY[12,13], 'الاثنين', 9, '(1) Artificial Intelligence', 'Eng. Mario', 'A202', 'section');
SELECT pg_temp.insert_entry(ARRAY[15], 'الاثنين', 9, '(1) Secured Network', 'Eng. Mohannad', 'G201', 'section');

-- P10 (06:00 - 07:00)
SELECT pg_temp.insert_entry(ARRAY[1], 'الاثنين', 10, '(2) Secured Network', 'Eng. Rodina', 'A202', 'section');
SELECT pg_temp.insert_entry(ARRAY[2], 'الاثنين', 10, '(2) Artificial Intelligence', 'Eng. Mahmoud', 'G203', 'section');
SELECT pg_temp.insert_entry(ARRAY[3], 'الاثنين', 10, '(1) Network Security Protocol', 'Eng. Omnia', 'G205', 'section');
SELECT pg_temp.insert_entry(ARRAY[5], 'الاثنين', 10, '(2) Network Security Protocol', 'Eng. Omar', 'G203', 'section');
SELECT pg_temp.insert_entry(ARRAY[9], 'الاثنين', 10, '(2) Secured Network', 'Eng. Mohannad', 'G202', 'section');
SELECT pg_temp.insert_entry(ARRAY[10,11], 'الاثنين', 10, '(1) Network Security Protocol', 'Eng. Omar', 'G204', 'section');
SELECT pg_temp.insert_entry(ARRAY[15], 'الاثنين', 10, '(2) Internet Applications Development', 'Eng. Rodina', 'A01', 'section');

-- P11 (07:00 - 08:00)
SELECT pg_temp.insert_entry(ARRAY[1], 'الاثنين', 11, '(2) Artificial Intelligence', 'Eng. Mahmoud', 'G203', 'section');
SELECT pg_temp.insert_entry(ARRAY[4], 'الاثنين', 11, '(1) Artificial Intelligence', 'Eng. Mahmoud', 'A202', 'section');
SELECT pg_temp.insert_entry(ARRAY[10], 'الاثنين', 11, '(2) Network Security Protocol', 'Eng. Omar', 'A02', 'section');
SELECT pg_temp.insert_entry(ARRAY[11], 'الاثنين', 11, 'Internet Application Development', 'Eng. Habiba', 'A01', 'section');
SELECT pg_temp.insert_entry(ARRAY[15], 'الاثنين', 11, '(1) Network Security Protocol', 'Eng. Omar', 'G205', 'section');

-- ══════════════════════════════════════════════════════════════════════════════
-- TUESDAY (الثلاثاء)
-- ══════════════════════════════════════════════════════════════════════════════
-- P1 (09:00 - 10:00)
SELECT pg_temp.insert_entry(ARRAY[1], 'الثلاثاء', 1, '(1) Artificial Intelligence', 'Eng. Mahmoud', 'A01', 'section');
SELECT pg_temp.insert_entry(ARRAY[4], 'الثلاثاء', 1, '(1) Artificial Intelligence', 'Eng. Mahmoud', 'A01', 'section');

-- P2 (10:00 - 11:00)
SELECT pg_temp.insert_entry(ARRAY[2], 'الثلاثاء', 2, '(1) Programming For Cyber Security', 'Eng. Habiba', 'A01', 'section');
SELECT pg_temp.insert_entry(ARRAY[8], 'الثلاثاء', 2, '(2) Secured Network', 'Eng. Rodina', 'A01', 'section');

-- P3 (11:00 - 12:00)
SELECT pg_temp.insert_entry(ARRAY[6], 'الثلاثاء', 3, '(1) Programming For Cyber Security', 'Eng. Walaa Gomaa', 'A01', 'section');
SELECT pg_temp.insert_entry(ARRAY[12], 'الثلاثاء', 3, '(2) Artificial Intelligence', 'Eng. Mario', 'A01', 'section');

-- P4 (12:00 - 01:00)
SELECT pg_temp.insert_entry(ARRAY[3], 'الثلاثاء', 4, '(1) Programming For Cyber Security', 'Eng. Mahmoud', 'A01', 'section');
SELECT pg_temp.insert_entry(ARRAY[9], 'الثلاثاء', 4, '(1) Internet Application Development', 'Eng. Habiba', 'A02', 'section');

-- P5 (01:00 - 02:00)
SELECT pg_temp.insert_entry(ARRAY[4], 'الثلاثاء', 5, '(1) Programming For Cyber Security(1)', 'Eng. Walaa Gomaa', 'A01', 'section');
SELECT pg_temp.insert_entry(ARRAY[5], 'الثلاثاء', 5, '(1) Network Security Protocol', 'Eng. Omar', 'A02', 'section');
SELECT pg_temp.insert_entry(ARRAY[12], 'الثلاثاء', 5, '(1) Internet Application Development', 'Eng. Habiba', 'A01', 'section');

-- P6 (02:00 - 03:00)
SELECT pg_temp.insert_entry(ARRAY[2], 'الثلاثاء', 6, '(2) Programming For Cyber Security(2)', 'Eng. Walaa Gomaa', 'A202', 'section');
SELECT pg_temp.insert_entry(ARRAY[4], 'الثلاثاء', 6, '(2) Programming For Cyber Security(1)', 'Eng. Habiba', 'A01', 'section');
SELECT pg_temp.insert_entry(ARRAY[8], 'الثلاثاء', 6, '(1) Internet Applications Development', 'Eng. Habiba', 'A02', 'section');
SELECT pg_temp.insert_entry(ARRAY[13], 'الثلاثاء', 6, '(2) Network Security Protocol', 'Eng. Omar', 'A02', 'section');

-- P7 (03:00 - 04:00)
SELECT pg_temp.insert_entry(ARRAY[2], 'الثلاثاء', 7, '(1) Programming For Cyber Security', 'Eng. Habiba', 'G201', 'section');
SELECT pg_temp.insert_entry(ARRAY[3], 'الثلاثاء', 7, '(2) Programming For Cyber Security(1)', 'Eng. Walaa Gomaa', 'A202', 'section');
SELECT pg_temp.insert_entry(ARRAY[14], 'الثلاثاء', 7, '(1) Internet Applications Development', 'Eng. Habiba', 'F-SEMINAR', 'section');

-- P8 (04:00 - 05:00)
SELECT pg_temp.insert_entry(ARRAY[2], 'الثلاثاء', 8, '(1) Network Security Protocol', 'Eng. Omnia', 'A01', 'section');
SELECT pg_temp.insert_entry(ARRAY[3], 'الثلاثاء', 8, '(2) Network Security Protocol', 'Eng. Omnia', 'A02', 'section');
SELECT pg_temp.insert_entry(ARRAY[5], 'الثلاثاء', 8, '(2) Programming For Cyber Security(2)', 'Eng. Walaa Gomaa', 'A202', 'section');
SELECT pg_temp.insert_entry(ARRAY[6], 'الثلاثاء', 8, '(2) Network Security Protocol', 'Eng. Omar', 'G202', 'section');
SELECT pg_temp.insert_entry(ARRAY[7], 'الثلاثاء', 8, '(2) Network Security Protocol', 'Eng. Omnia', 'A02', 'section');
SELECT pg_temp.insert_entry(ARRAY[12], 'الثلاثاء', 8, '(2) Secured Network', 'Eng. Rodina', 'A01', 'section');

-- P9 (05:00 - 06:00)
SELECT pg_temp.insert_entry(ARRAY[2], 'الثلاثاء', 9, '(2) Network Security Protocol', 'Eng. Omnia', 'G205', 'section');
SELECT pg_temp.insert_entry(ARRAY[4], 'الثلاثاء', 9, '(1) Secured Network', 'Eng. Rodina', 'F-SEMINAR', 'section');
SELECT pg_temp.insert_entry(ARRAY[5], 'الثلاثاء', 9, '(1) Network Security Protocol', 'Eng. Omar', 'A202', 'section');
SELECT pg_temp.insert_entry(ARRAY[13], 'الثلاثاء', 9, '(1) Internet Application Development', 'Eng. Habiba', 'A02', 'section');
SELECT pg_temp.insert_entry(ARRAY[14], 'الثلاثاء', 9, '(2) Network Security Protocol', 'Eng. Omar', 'A01', 'section');

-- P10 (06:00 - 07:00)
SELECT pg_temp.insert_entry(ARRAY[6], 'الثلاثاء', 10, '(1) Secured Network', 'Eng. Rodina', 'F-SEMINAR', 'section');
SELECT pg_temp.insert_entry(ARRAY[8], 'الثلاثاء', 10, '(1) Artificial Intelligence', 'Eng. Mario', 'A01', 'section');
SELECT pg_temp.insert_entry(ARRAY[11], 'الثلاثاء', 10, '(1) Secured Network', 'Eng. Mohannad', 'G204', 'section');
SELECT pg_temp.insert_entry(ARRAY[12], 'الثلاثاء', 10, '(2) Network Security Protocol', 'Eng. Omar', 'A01', 'section');

-- P11 (07:00 - 08:00)
SELECT pg_temp.insert_entry(ARRAY[6], 'الثلاثاء', 11, '(1) Artificial Intelligence', 'Eng. Mario', 'A01', 'section');
SELECT pg_temp.insert_entry(ARRAY[8], 'الثلاثاء', 11, '(1) Secured Network', 'Eng. Mohannad', 'A02', 'section');
SELECT pg_temp.insert_entry(ARRAY[14], 'الثلاثاء', 11, '(2) Secured Network', 'Eng. Mohannad', 'A01', 'section');

-- ══════════════════════════════════════════════════════════════════════════════
-- WEDNESDAY (الأربعاء)
-- ══════════════════════════════════════════════════════════════════════════════
-- P1 (09:00 - 10:00)
SELECT pg_temp.insert_entry(ARRAY[13], 'الاربعاء', 1, '(2) Secured Network', 'Eng. Mohannad', 'A02', 'section');
SELECT pg_temp.insert_entry(ARRAY[14], 'الاربعاء', 1, '(2) Artificial Intelligence', 'Eng. Mario', 'A01', 'section');

-- P2 (10:00 - 11:00)
SELECT pg_temp.insert_entry(ARRAY[13], 'الاربعاء', 2, '(2) Artificial Intelligence', 'Eng. Mario', 'A01', 'section');

-- P3 (11:00 - 12:00)
SELECT pg_temp.insert_lecture(ARRAY[5,6,7,8], 'الاربعاء', 3, 'Artificial Intelligence', 'Dr. Muhammed Ramadan', 'G204');

-- P4 (12:00 - 01:00)
SELECT pg_temp.insert_lecture(ARRAY[1,2,3,4], 'الاربعاء', 4, 'Specialized English', 'Dr. Ahmed Hassan', 'A-New');
SELECT pg_temp.insert_lecture(ARRAY[9,10,11], 'الاربعاء', 4, 'Artificial Intelligence', 'Dr. Muhammed Ramadan', 'G204');

-- P5 (01:00 - 02:00)
SELECT pg_temp.insert_entry(ARRAY[1], 'الاربعاء', 5, '(1) Internet Applications Development', 'Eng. Walaa Gomaa', 'A02', 'section');
SELECT pg_temp.insert_entry(ARRAY[2], 'الاربعاء', 5, '(1) Secured Network', 'Eng. Rodina', 'A01', 'section');
SELECT pg_temp.insert_lecture(ARRAY[5,6,7,8], 'الاربعاء', 5, 'Specialized English', 'Dr. Ahmed Hassan', 'A-New');
SELECT pg_temp.insert_entry(ARRAY[11], 'الاربعاء', 5, '(1) Artificial Intelligence', 'Eng. Mario', 'A01', 'section');
SELECT pg_temp.insert_lecture(ARRAY[12,13,14,15], 'الاربعاء', 5, 'Artificial Intelligence', 'Dr. Muhammed Ramadan', 'G204');

-- P6 (02:00 - 03:00)
SELECT pg_temp.insert_lecture(ARRAY[1,2,3,4], 'الاربعاء', 6, 'Artificial Intelligence', 'Dr. Muhammed Ramadan', 'G204');
SELECT pg_temp.insert_entry(ARRAY[5], 'الاربعاء', 6, '(2) Secured Network', 'Eng. Rodina', 'A01', 'section');
SELECT pg_temp.insert_lecture(ARRAY[12,13,14,15], 'الاربعاء', 6, 'Specialized English', 'Dr. Ahmed Hassan', 'A-New');

-- P7 (03:00 - 04:00)
SELECT pg_temp.insert_entry(ARRAY[1], 'الاربعاء', 7, '(1) Programming For Cyber Security', 'Eng. Walaa Gomaa', 'A01', 'section');
SELECT pg_temp.insert_entry(ARRAY[2], 'الاربعاء', 7, '(1) Secured Network', 'Eng. Rodina', 'A02', 'section');
SELECT pg_temp.insert_lecture(ARRAY[5,6,7,8], 'الاربعاء', 7, 'Secure Network', 'Dr. Muhammed Ramadan', 'A-New');
SELECT pg_temp.insert_entry(ARRAY[9], 'الاربعاء', 7, '(1) Secured Network', 'Eng. Mohannad', 'A02', 'section');
SELECT pg_temp.insert_entry(ARRAY[10], 'الاربعاء', 7, '(1) Internet Applications Development', 'Eng. Habiba', 'G204', 'section');
SELECT pg_temp.insert_entry(ARRAY[14], 'الاربعاء', 7, '(1) Artificial Intelligence', 'Eng. Mario', 'A01', 'section');

-- P8 (04:00 - 05:00)
SELECT pg_temp.insert_lecture(ARRAY[1,2,3,4], 'الاربعاء', 8, 'Secure Network', 'Dr. Muhammed Ramadan', 'A-New');
SELECT pg_temp.insert_entry(ARRAY[5], 'الاربعاء', 8, '(1) Artificial Intelligence', 'Eng. Mario', 'A01', 'section');
SELECT pg_temp.insert_entry(ARRAY[10], 'الاربعاء', 8, '(2) Internet Applications Development', 'Eng. Habiba', 'G204', 'section');

-- P9 (05:00 - 06:00)
SELECT pg_temp.insert_entry(ARRAY[1], 'الاربعاء', 9, '(1) Secured Network', 'Eng. Rodina', 'A01', 'section');
SELECT pg_temp.insert_entry(ARRAY[4], 'الاربعاء', 9, '(2) Secured Network', 'Eng. Rodina', 'A01', 'section');
SELECT pg_temp.insert_entry(ARRAY[9], 'الاربعاء', 9, '(2) Artificial Intelligence', 'Eng. Mario', 'A02', 'section');
SELECT pg_temp.insert_lecture(ARRAY[12,13,14,15], 'الاربعاء', 9, 'Secure Network', 'Dr. Muhammed Ramadan', 'A-New');

-- P10 (06:00 - 07:00)
SELECT pg_temp.insert_entry(ARRAY[3], 'الاربعاء', 10, '(1) Secured Network', 'Eng. Rodina', 'A01', 'section');
SELECT pg_temp.insert_entry(ARRAY[4], 'الاربعاء', 10, '(2) Network Security Protocol', 'Eng. Omnia', 'A01', 'section');
SELECT pg_temp.insert_entry(ARRAY[6], 'الاربعاء', 10, '(1) Artificial Intelligence', 'Eng. Mario', 'A02', 'section');
SELECT pg_temp.insert_entry(ARRAY[12], 'الاربعاء', 10, '(1) Network Security Protocol', 'Eng. Omar', 'A202', 'section');

-- ══════════════════════════════════════════════════════════════════════════════
-- SATURDAY & THURSDAY (السبت والخميس: إجازة)
-- ══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE s integer;
BEGIN
  FOR s IN 1..15 LOOP
    INSERT INTO public.published_schedule (section, day, period, subject, instructor, room, entry_type, is_holiday, is_training)
    VALUES (s, 'السبت', 1, '', '', '', 'lecture', true, false)
    ON CONFLICT (section, day, period) DO UPDATE SET is_holiday = true;

    INSERT INTO public.published_schedule (section, day, period, subject, instructor, room, entry_type, is_holiday, is_training)
    VALUES (s, 'الخميس', 1, '', '', '', 'lecture', true, false)
    ON CONFLICT (section, day, period) DO UPDATE SET is_holiday = true;
  END LOOP;
END $$;
