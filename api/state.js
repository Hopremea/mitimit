import { verifyToken } from "@clerk/backend";
import { createClient } from "@supabase/supabase-js";
import bonCommandeHandler from "../lib/bonCommande.js";

// Relais serveur pour l'état partagé (table cockpit_state, ligne « shared »).
// Lecture/écriture via la clé SERVICE ROLE (jamais exposée au navigateur), protégé par Clerk.
//
// Objectif sécurité : permettre d'activer un RLS strict sur cockpit_state (aucun accès via la clé
// anon publique) tout en laissant l'application fonctionner. Le client appelle /api/state au lieu
// d'écrire directement avec la clé anon.
//
// Variables d'environnement (Vercel) :
//   SUPABASE_URL (ou VITE_SUPABASE_URL)  · SUPABASE_SERVICE_ROLE_KEY  · CLERK_SECRET_KEY
//
// GET  /api/state            -> { data, updated_at } | null
// POST /api/state { data }   -> { ok: true }   (upsert de la ligne « shared »)
export default async function handler(req, res) {
  // Bon de commande en ligne : même relais, même clé service role, logique dans lib/bonCommande.js.
  // Ce détour évite un treizième fichier dans api/ — au-delà de douze, le plan Hobby refuse le
  // déploiement entier. La page publique garde son URL lisible /commande (réécriture vercel.json),
  // et ce branchement précède la vérification Clerk : le dépôt par le client est nécessairement
  // public, les autres usages du bon de commande vérifient le jeton eux-mêmes.
  if (req.query && req.query.bdc) return bonCommandeHandler(req, res);

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) { res.status(500).json({ error: "Supabase service role non configuré côté serveur (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)." }); return; }

  // Authentification Clerk obligatoire dès que la clé est présente.
  const clerkSecret = process.env.CLERK_SECRET_KEY;
  if (clerkSecret) {
    const authHeader = req.headers.authorization || "";
    const tok = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!tok) { res.status(401).json({ error: "Non authentifie." }); return; }
    try { await verifyToken(tok, { secretKey: clerkSecret }); }
    catch (e) { res.status(401).json({ error: "Session invalide ou expiree." }); return; }
  }

  const sb = createClient(url, svc, { auth: { persistSession: false } });
  try {
    if (req.method === "GET") {
      const { data, error } = await sb.from("cockpit_state").select("data, updated_at").eq("id", "shared").maybeSingle();
      if (error) throw error;
      res.status(200).json(data || null);
      return;
    }
    if (req.method === "POST" || req.method === "PUT") {
      let body = {};
      try { body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}); } catch (e) {}
      if (!body || typeof body.data === "undefined") { res.status(400).json({ error: "Corps invalide (attendu { data })." }); return; }
      const { error } = await sb.from("cockpit_state").upsert({ id: "shared", data: body.data, updated_at: new Date().toISOString() }, { onConflict: "id" });
      if (error) throw error;
      res.status(200).json({ ok: true });
      return;
    }
    res.status(405).json({ error: "Methode non autorisee" });
  } catch (e) {
    res.status(502).json({ error: "Etat partage indisponible : " + (e && e.message ? e.message : String(e)) });
  }
}
