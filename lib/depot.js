import { createClient } from "@supabase/supabase-js";

// Dépôt des pièces jointes volumineuses, hors du relais Vercel.
//
// Vercel plafonne le corps d'une requête de fonction à 4,5 Mo, et le base64 gonfle un fichier d'un
// tiers : au-delà de ~3 Mo, un document envoyé à /api/gmail-draft était rejeté par la plateforme
// avant même d'atteindre le code. Pour accepter les 25 Mo de Gmail, le navigateur ne fait donc plus
// transiter le fichier par nos fonctions : il l'envoie DIRECTEMENT au stockage Supabase, muni d'une
// autorisation d'écriture à usage unique. /api/gmail-draft le relit ensuite côté serveur, où aucune
// limite de corps de requête ne s'applique.
//
// Ce module vit dans lib/ et non dans api/ : Vercel compte chaque fichier de api/ comme une fonction
// serverless, et le plan du projet « hopreme » en autorise 12 par déploiement. Le point d'entrée est
// l'action « piece » du routeur /api/outils.
export const BUCKET = "pieces-jointes";
// Les documents joints sont éphémères : passé ce délai, ils ne servent plus aucune vague en cours.
const TTL_MS = 7 * 24 * 3600 * 1000;

export function storageAdmin() {
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

// Chemin de dépôt : toujours vérifié avant usage, pour rester dans le seau des pièces jointes.
export function cheminValide(brut) {
  const path = String(brut || "").replace(/^\/+/, "");
  return (!path || path.includes("..")) ? null : path;
}

// Délivre une autorisation d'envoi signée, à usage unique.
export async function creerDepot(sb, nomBrut) {
  const nom = String(nomBrut || "document.pdf").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || "document.pdf";
  const path = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8) + "-" + nom;
  await ensureBucket(sb);
  await purgeOld(sb);
  const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return { bucket: BUCKET, path, token: data.token, signedUrl: data.signedUrl };
}

export async function supprimerDepot(sb, path) {
  await sb.storage.from(BUCKET).remove([path]);
}
