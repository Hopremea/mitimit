import { verifyToken } from "@clerk/backend";
import { createDraft, gmailIsConfigured } from "../lib/gmail.js";

// Création d'un BROUILLON dans la boîte Gmail connectée (GOOGLE_USER_EMAIL). N'ENVOIE JAMAIS :
// le brouillon apparaît dans les brouillons Gmail, l'utilisateur le relit et l'envoie manuellement.
// Protégé par Clerk. Utilise le scope gmail.modify (déjà accordé).
//
// POST /api/gmail-draft { to, subject, body, appendSignature? } -> { ok:true, id, messageId }
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

  try {
    const result = await createDraft({ to, subject, body: text, appendSignature: body.appendSignature !== false });
    res.status(200).json({ ok: true, id: result.id, messageId: result.messageId });
  } catch (e) {
    res.status(502).json({ error: e && e.message ? e.message : String(e) });
  }
}
