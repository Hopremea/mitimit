import { verifyToken } from "@clerk/backend";

// Relais serveur pour l'API Message Batches d'Anthropic (traitement par LOT).
// Les mêmes requêtes qu'en direct, mais facturées 50 % MOINS CHER sur les tokens, en échange d'un
// traitement asynchrone (généralement moins d'une heure, 24 h au maximum). C'est exactement le
// profil de l'enrichissement de masse des prospects, qui tourne déjà en tâche de fond.
//
// La clé ANTHROPIC_API_KEY reste cote serveur, comme pour /api/claude.
export const config = { maxDuration: 60 };

const API = "https://api.anthropic.com/v1/messages/batches";
const MAX_REQUESTS = 500; // borne de sécurité : bien en deçà des 100 000 autorisés par l'API

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Methode non autorisee" }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: "ANTHROPIC_API_KEY manquante cote serveur." }); return; }

  // Authentification Clerk obligatoire (même exigence que le relais IA direct).
  const clerkSecret = process.env.CLERK_SECRET_KEY;
  if (!clerkSecret) { res.status(500).json({ error: "Authentification non configuree cote serveur." }); return; }
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) { res.status(401).json({ error: "Non authentifie." }); return; }
  try { await verifyToken(token, { secretKey: clerkSecret }); }
  catch (e) { res.status(401).json({ error: "Session invalide ou expiree." }); return; }

  const body = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {});
  const action = String(body.action || "");
  const H = { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" };

  try {
    // --- Créer un lot ---
    if (action === "create") {
      const requests = Array.isArray(body.requests) ? body.requests : [];
      if (!requests.length) { res.status(400).json({ error: "Aucune requete dans le lot." }); return; }
      if (requests.length > MAX_REQUESTS) { res.status(400).json({ error: "Lot trop volumineux (max " + MAX_REQUESTS + ")." }); return; }
      const up = await fetch(API, { method: "POST", headers: H, body: JSON.stringify({ requests }) });
      const txt = await up.text();
      res.status(up.status).setHeader("Content-Type", "application/json");
      res.send(txt);
      return;
    }

    // --- Etat d'avancement d'un lot ---
    if (action === "status") {
      const id = String(body.id || "");
      if (!id) { res.status(400).json({ error: "Identifiant de lot manquant." }); return; }
      const up = await fetch(API + "/" + encodeURIComponent(id), { headers: H });
      const txt = await up.text();
      res.status(up.status).setHeader("Content-Type", "application/json");
      res.send(txt);
      return;
    }

    // --- Résultats d'un lot terminé ---
    // L'API renvoie du JSONL (une ligne par requête) : on le convertit en tableau JSON pour le client.
    if (action === "results") {
      const id = String(body.id || "");
      if (!id) { res.status(400).json({ error: "Identifiant de lot manquant." }); return; }
      const meta = await fetch(API + "/" + encodeURIComponent(id), { headers: H });
      if (!meta.ok) { res.status(meta.status).send(await meta.text()); return; }
      const info = await meta.json();
      if (info.processing_status !== "ended") { res.status(200).json({ pending: true, processing_status: info.processing_status, request_counts: info.request_counts || null }); return; }
      if (!info.results_url) { res.status(200).json({ pending: false, results: [] }); return; }
      const r = await fetch(info.results_url, { headers: H });
      if (!r.ok) { res.status(r.status).send(await r.text()); return; }
      const jsonl = await r.text();
      const results = [];
      for (const line of jsonl.split("\n")) {
        const t = line.trim(); if (!t) continue;
        try { results.push(JSON.parse(t)); } catch (e) { /* ligne illisible : ignorée */ }
      }
      res.status(200).json({ pending: false, results, request_counts: info.request_counts || null });
      return;
    }

    // --- Annuler un lot en cours ---
    if (action === "cancel") {
      const id = String(body.id || "");
      if (!id) { res.status(400).json({ error: "Identifiant de lot manquant." }); return; }
      const up = await fetch(API + "/" + encodeURIComponent(id) + "/cancel", { method: "POST", headers: H });
      const txt = await up.text();
      res.status(up.status).setHeader("Content-Type", "application/json");
      res.send(txt);
      return;
    }

    res.status(400).json({ error: "Action inconnue : " + action });
  } catch (e) {
    res.status(502).json({ error: "Relais lot indisponible : " + (e && e.message ? e.message : String(e)) });
  }
}
