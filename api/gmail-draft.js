import { verifyToken } from "@clerk/backend";
import { createClient } from "@supabase/supabase-js";
import { createDraft, gmailIsConfigured } from "../lib/gmail.js";
import { BUCKET } from "./piece.js";

// Création d'un BROUILLON dans la boîte Gmail connectée (GOOGLE_USER_EMAIL). N'ENVOIE JAMAIS :
// le brouillon apparaît dans les brouillons Gmail, l'utilisateur le relit et l'envoie manuellement.
// Protégé par Clerk. Utilise le scope gmail.modify (déjà accordé).
//
// POST /api/gmail-draft { to, subject, body, appendSignature?, attachments? } -> { ok:true, id, messageId }
// attachments : [{ filename, mimeType, contentBase64 }]

// Deux chemins d'arrivée pour un document :
//   - « storagePath » : le navigateur l'a déposé directement dans le stockage (voir /api/piece), et on
//     le relit ici côté serveur. C'est la voie normale, qui autorise les 25 Mo admis par Gmail — le
//     fichier ne traverse jamais le corps d'une requête Vercel.
//   - base64 dans la requête : voie de repli, bornée par le plafond de 4,5 Mo de la plateforme. Le
//     base64 gonflant d'un tiers, un fichier de plus de ~3 Mo serait rejeté avant d'atteindre ce code.
const MAX_PIECE = 25 * 1024 * 1024;      // limite de Gmail
const MAX_TOTAL = 25 * 1024 * 1024;
const MAX_INLINE = 3 * 1024 * 1024;      // limite de la voie de repli (corps de requête)
const MAX_NB = 3;

function storageAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) return null;
  return createClient(url, svc, { auth: { persistSession: false } });
}

// Décodage prudent : une chaîne base64 invalide ne doit pas produire une pièce jointe corrompue
// silencieusement, mais une erreur nette. On accepte une data-URL complète comme du base64 nu.
async function decodeAttachments(list) {
  const out = [];
  let total = 0;
  const sb = storageAdmin();
  for (const a of list) {
    const nom = String((a && a.filename) || "").trim().replace(/[\r\n"\\/]/g, "").slice(0, 120);
    if (!nom) throw new Error("Pièce jointe sans nom de fichier.");
    const mime = String((a && a.mimeType) || "application/octet-stream").replace(/[\r\n;"]/g, "").slice(0, 100);
    // Voie sans clé de service : le navigateur a déposé le document avec sa propre session et nous
    // transmet une URL signée, à durée limitée. Le serveur n'a alors besoin d'aucun accès Supabase.
    const url = String((a && a.storageUrl) || "").trim();
    if (url) {
      if (!/^https:\/\//i.test(url)) throw new Error("URL de document invalide.");
      const r = await fetch(url);
      if (!r.ok) throw new Error("Document « " + nom + " » introuvable dans le dépôt (renvoyez-le).");
      const buf = Buffer.from(await r.arrayBuffer());
      if (!buf.length) throw new Error("Document « " + nom + " » vide.");
      if (buf.length > MAX_PIECE) throw new Error("« " + nom + " » dépasse 25 Mo (" + (buf.length / 1048576).toFixed(1) + " Mo), la limite de Gmail.");
      total += buf.length;
      if (total > MAX_TOTAL) throw new Error("Pièces jointes trop volumineuses au total (max 25 Mo, limite de Gmail).");
      out.push({ filename: nom, mimeType: mime, content: buf });
      continue;
    }
    // Voie avec clé de service : le document a été déposé via une autorisation signée, on le relit ici.
    const chemin = String((a && a.storagePath) || "").replace(/^\/+/, "");
    if (chemin) {
      if (!sb) throw new Error("Stockage non configuré côté serveur : impossible de relire « " + nom + " ».");
      if (chemin.includes("..")) throw new Error("Chemin de pièce jointe invalide.");
      const { data, error } = await sb.storage.from(BUCKET).download(chemin);
      if (error || !data) throw new Error("Document « " + nom + " » introuvable dans le dépôt (renvoyez-le).");
      const buf = Buffer.from(await data.arrayBuffer());
      if (!buf.length) throw new Error("Document « " + nom + " » vide.");
      if (buf.length > MAX_PIECE) throw new Error("« " + nom + " » dépasse 25 Mo (" + (buf.length / 1048576).toFixed(1) + " Mo), la limite de Gmail.");
      total += buf.length;
      if (total > MAX_TOTAL) throw new Error("Pièces jointes trop volumineuses au total (max 25 Mo, limite de Gmail).");
      out.push({ filename: nom, mimeType: mime, content: buf });
      continue;
    }
    let b64 = String((a && (a.contentBase64 || a.content)) || "");
    const virgule = b64.indexOf(",");
    if (b64.startsWith("data:") && virgule > 0) b64 = b64.slice(virgule + 1);
    b64 = b64.replace(/\s/g, "");
    if (!b64) throw new Error("Pièce jointe « " + nom + " » vide.");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) throw new Error("Pièce jointe « " + nom + " » : contenu illisible.");
    const buf = Buffer.from(b64, "base64");
    if (!buf.length) throw new Error("Pièce jointe « " + nom + " » vide après décodage.");
    if (buf.length > MAX_INLINE) throw new Error("« " + nom + " » dépasse 3 Mo par cette voie (" + (buf.length / 1048576).toFixed(1) + " Mo) : au-delà, le document doit passer par le dépôt.");
    total += buf.length;
    if (total > MAX_TOTAL) throw new Error("Pièces jointes trop volumineuses au total (max 25 Mo, limite de Gmail).");
    out.push({ filename: nom, mimeType: mime, content: buf });
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Methode non autorisee" });
    return;
  }

  const clerkSecret = process.env.CLERK_SECRET_KEY;
  if (clerkSecret) {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) { res.status(401).json({ error: "Non authentifie." }); return; }
    try { await verifyToken(token, { secretKey: clerkSecret }); }
    catch (e) { res.status(401).json({ error: "Session invalide ou expiree." }); return; }
  }

  if (!gmailIsConfigured()) {
    res.status(503).json({
      error: "Gmail non connecté côté serveur. Configurez l'intégration (GOOGLE_CLIENT_ID/SECRET, GOOGLE_USER_EMAIL, GOOGLE_REFRESH_TOKEN).",
    });
    return;
  }

  let body = {};
  try { body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}); } catch (e) {}
  const to = (body.to || "").trim();
  const subject = (body.subject || "").trim();
  const text = body.body || "";
  if (!to || !subject) { res.status(400).json({ error: "Destinataire et objet requis." }); return; }

  const brut = Array.isArray(body.attachments) ? body.attachments : [];
  if (brut.length > MAX_NB) { res.status(400).json({ error: "Trop de pièces jointes (max " + MAX_NB + ")." }); return; }
  let attachments = [];
  // Une pièce jointe invalide est une erreur de la demande, pas une panne du service : 400, et le
  // brouillon n'est pas créé du tout — mieux vaut aucun brouillon qu'un brouillon amputé du document.
  try { attachments = await decodeAttachments(brut); }
  catch (e) { res.status(400).json({ error: e && e.message ? e.message : String(e) }); return; }

  try {
    const result = await createDraft({ to, subject, body: text, appendSignature: body.appendSignature !== false, attachments });
    res.status(200).json({ ok: true, id: result.id, messageId: result.messageId });
  } catch (e) {
    res.status(502).json({ error: e && e.message ? e.message : String(e) });
  }
}
