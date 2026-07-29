import { verifyToken } from "@clerk/backend";
import { createDraft, gmailIsConfigured } from "../lib/gmail.js";

// Création d'un BROUILLON dans la boîte Gmail connectée (GOOGLE_USER_EMAIL). N'ENVOIE JAMAIS :
// le brouillon apparaît dans les brouillons Gmail, l'utilisateur le relit et l'envoie manuellement.
// Protégé par Clerk. Utilise le scope gmail.modify (déjà accordé).
//
// POST /api/gmail-draft { to, subject, body, appendSignature?, attachments? } -> { ok:true, id, messageId }
// attachments : [{ filename, mimeType, contentBase64 }]

// Vercel plafonne le corps d'une requête de fonction à 4,5 Mo. Le base64 gonfle un fichier d'environ
// un tiers : au-delà de ~3 Mo de fichier, la requête est rejetée par la plateforme AVANT d'atteindre
// ce code, avec une erreur illisible. On borne donc en amont pour rendre un message explicite.
const MAX_PIECE = 3 * 1024 * 1024;
const MAX_TOTAL = 3.2 * 1024 * 1024;
const MAX_NB = 3;

// Décodage prudent : une chaîne base64 invalide ne doit pas produire une pièce jointe corrompue
// silencieusement, mais une erreur nette. On accepte une data-URL complète comme du base64 nu.
function decodeAttachments(list) {
  const out = [];
  let total = 0;
  for (const a of list) {
    const nom = String((a && a.filename) || "").trim().replace(/[\r\n"\\/]/g, "").slice(0, 120);
    if (!nom) throw new Error("Pièce jointe sans nom de fichier.");
    let b64 = String((a && (a.contentBase64 || a.content)) || "");
    const virgule = b64.indexOf(",");
    if (b64.startsWith("data:") && virgule > 0) b64 = b64.slice(virgule + 1);
    b64 = b64.replace(/\s/g, "");
    if (!b64) throw new Error("Pièce jointe « " + nom + " » vide.");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) throw new Error("Pièce jointe « " + nom + " » : contenu illisible.");
    const buf = Buffer.from(b64, "base64");
    if (!buf.length) throw new Error("Pièce jointe « " + nom + " » vide après décodage.");
    if (buf.length > MAX_PIECE) throw new Error("« " + nom + " » dépasse 3 Mo (" + (buf.length / 1048576).toFixed(1) + " Mo). Allégez le fichier.");
    total += buf.length;
    if (total > MAX_TOTAL) throw new Error("Pièces jointes trop volumineuses au total (max 3,2 Mo).");
    out.push({ filename: nom, mimeType: String((a && a.mimeType) || "application/octet-stream").replace(/[\r\n;"]/g, "").slice(0, 100), content: buf });
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
  try { attachments = decodeAttachments(brut); }
  catch (e) { res.status(400).json({ error: e && e.message ? e.message : String(e) }); return; }

  try {
    const result = await createDraft({ to, subject, body: text, appendSignature: body.appendSignature !== false, attachments });
    res.status(200).json({ ok: true, id: result.id, messageId: result.messageId });
  } catch (e) {
    res.status(502).json({ error: e && e.message ? e.message : String(e) });
  }
}
