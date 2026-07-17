-- Sécurisation de la table d'état partagé MITMIT (cockpit_state).
--
-- Contexte : le navigateur utilise la clé ANON de Supabase (VITE_SUPABASE_ANON_KEY). Cette clé est
-- PUBLIQUE — elle est visible dans le bundle JavaScript livré au navigateur. Tant que la table n'a
-- pas de Row Level Security stricte, TOUTE personne récupérant cette clé peut lire et écrire
-- l'intégralité de la base partagée.
--
-- Correctif : faire transiter les lectures/écritures par le relais serveur « /api/state »
-- (authentifié par Clerk, utilisant la clé SERVICE ROLE côté serveur), et BLOQUER tout accès direct
-- via la clé anon. Le rôle service_role contourne le RLS : le relais garde donc l'accès complet.
--
-- À exécuter dans Supabase → SQL Editor.

alter table public.cockpit_state enable row level security;

-- Aucune policy accordée aux rôles « anon » et « authenticated » => tout accès direct par la clé anon
-- (lecture, écriture, realtime) est refusé. Seul le service_role (via /api/state) peut lire/écrire.

-- Nettoyage d'éventuelles anciennes policies permissives :
drop policy if exists "public read"  on public.cockpit_state;
drop policy if exists "public write" on public.cockpit_state;
drop policy if exists "anon all"     on public.cockpit_state;

-- OPTION intermédiaire (moins stricte) — si vous souhaitez, en transition, garder la LECTURE directe
-- par le client tout en bloquant l'ÉCRITURE directe, décommentez la policy ci-dessous. À terme,
-- préférez l'option stricte ci-dessus (aucune policy anon) avec /api/state pour lecture ET écriture.
-- create policy "anon read shared only" on public.cockpit_state
--   for select to anon using (id = 'shared');
