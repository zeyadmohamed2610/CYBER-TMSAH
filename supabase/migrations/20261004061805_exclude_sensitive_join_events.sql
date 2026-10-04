BEGIN;
-- Pending request hashes are readable only by private approval workers, never a live stream.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='join_requests') THEN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.join_requests;
 END IF;
END $$;
COMMIT;
