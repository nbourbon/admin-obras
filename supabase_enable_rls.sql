-- Harden the backend-only Supabase database.
-- The frontend uses FastAPI and a direct server-side DATABASE_URL, not the
-- anon/authenticated Data API, so public API roles receive no table access.

ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.project_member_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rubros ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.participant_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exchange_rate_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.note_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.note_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vote_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.contribution_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.contribution_absorptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.avance_obra ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.balance_movements ENABLE ROW LEVEL SECURITY;

-- Remove existing Data API access. The server-side postgres/service role is
-- intentionally unaffected.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Prevent objects created by the application role in the future from being
-- exposed automatically through the Data API.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- Verification: this should return zero rows for the application tables above.
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND c.relname IN (
      'users',
      'projects',
      'project_members',
      'project_member_history',
      'providers',
      'categories',
      'rubros',
      'expenses',
      'participant_payments',
      'exchange_rate_log',
      'notes',
      'note_participants',
      'note_comments',
      'vote_options',
      'user_votes',
      'contributions',
      'contribution_payments',
      'contribution_absorptions',
      'avance_obra',
      'balance_movements'
  )
  AND c.relrowsecurity = false
ORDER BY c.relname;

-- Verification: this should return zero rows. A row means one of the Data API
-- roles still has a data-changing or reading privilege on an application table.
SELECT c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND (
    has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
    OR has_table_privilege(
      'authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE'
    )
  )
ORDER BY c.relname;
