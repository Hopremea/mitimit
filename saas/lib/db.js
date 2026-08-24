import { createClient } from "@supabase/supabase-js";

// Client Supabase « service role » : il contourne la RLS, il ne doit donc JAMAIS être
// construit ailleurs que dans une fonction /api, et jamais atteindre le navigateur.
// Toute fonction qui l'utilise doit avoir vérifié le jeton Clerk avant (voir lib/auth.js).
export function baseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) return null;
  return createClient(url, svc, { auth: { persistSession: false } });
}

// Réponse d'erreur uniforme : le navigateur n'a qu'un seul champ à lire, « error ».
export function echec(res, code, message) {
  res.status(code).json({ error: message });
  return null;
}

// Corps JSON tolérant : selon le runtime, req.body arrive déjà objet ou encore en texte.
export function corps(req) {
  try {
    return typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  } catch (e) {
    return {};
  }
}
