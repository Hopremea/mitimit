import { verifyToken } from "@clerk/backend";
import { createClient } from "@supabase/supabase-js";

// Dépôt d'une pièce jointe volumineuse, hors du relais Vercel.
//
// Vercel plafonne le corps d'une requête de fonction à 4,5 Mo, et le base64 gonfle un fichier d'un
// tiers : au-delà de ~3 Mo, un document envoyé à /api/gmail-draft était rejeté par la plateforme
// avant même d'atteindre le code. Pour accepter les 25 Mo de Gmail, le navigateur ne fait donc plus
// transiter le fichier par nos fonctions : il l'envoie DIRECTEMENT au stockage Supabase, muni d'une
// autorisation d'écriture à usage unique délivrée ici. /api/gmail-draft le relit ensuite côté
// serveur, où aucune limite de corps de requête ne s'applique.
//
// POST /api/piece { name }            -> { bucket, path, token }   (autorisation d'envoi signée)
// POST /api/piece { path, del: true } -> { ok: true }               (suppression après usage)
export const BUCKET = "pieces-jointes";
// Les documents joints sont éphémères : passé ce délai, ils ne servent plus aucune vague en cours.
const TTL_MS = 7 * 24 * 3600 * 1000;

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) return null;
  return createClient(url, svc, { auth: { persistSession: false } });
}

// Le seau est privé : les documents ne sont lisibles que par la clé de service, jamais par une URL
// publique devinable. Créé à la volée pour ne rien exiger d'une configuration manuelle.
async function ensureBucket(sb) {
  try {
    const { data } = await sb.storage.getBucket(BUCKET);
    if (data) return;
  } catch (e) { /* seau absent : on le crée ci-dessous */ }
  try { await sb.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 26 * 1024 * 1024 }); }
  catch (e) { /* course entre deux appels : un « existe déjà » n'est pas une erreur */ }
}

// Ménage opportuniste des documents périmés, à chaque nouveau dépôt : sans cela, le seau enflerait
// indéfiniment au fil des vagues.
async function purgeOld(sb) {
  try {
    const { data } = await sb.storage.from(BUCKET).list("", { limit: 200, sortBy: { column: "created_at", order: "asc" } });
    const vieux = (data || []).filter((f) => f && f.created_at && (Date.now() - new Date(f.created_at).getTime()) > TTL_MS).map((f) => f.name);
    if (vieux.length) await sb.storage.from(BUCKET).remove(vieux);
  } catch (e) { /* le ménage ne doit jamais faire échouer un dépôt */ }
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Methode non autorisee" }); return; }

  const clerkSecret = process.env.CLERK_SECRET_KEY;
  if (clerkSecret) {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) { res.status(401).json({ error: "Non authentifie." }); return; }
    try { await verifyToken(token, { secretKey: clerkSecret }); }
    catch (e) { res.status(401).json({ error: "Session invalide ou expiree." }); return; }
  }

  const sb = admin();
  if (!sb) { res.status(503).json({ error: "Stockage non configuré côté serveur (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)." }); return; }

  let body = {};
  try { body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}); } catch (e) {}

  // Suppression après usage : le chemin est vérifié pour rester dans le seau des pièces jointes.
  if (body.del) {
    const path = String(body.path || "").replace(/^\/+/, "");
    if (!path || path.includes("..")) { res.status(400).json({ error: "Chemin invalide." }); return; }
    try { await sb.storage.from(BUCKET).remove([path]); res.status(200).json({ ok: true }); }
    catch (e) { res.status(502).json({ error: "Suppression impossible : " + ((e && e.message) || String(e)) }); }
    return;
  }

  const nom = String(body.name || "document.pdf").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || "document.pdf";
  const path = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8) + "-" + nom;

  try {
    await ensureBucket(sb);
    await purgeOld(sb);
    const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) throw error;
    res.status(200).json({ bucket: BUCKET, path, token: data.token, signedUrl: data.signedUrl });
  } catch (e) {
    res.status(502).json({ error: "Dépôt indisponible : " + ((e && e.message) || String(e)) });
  }
}
