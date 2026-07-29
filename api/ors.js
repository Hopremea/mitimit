import { verifyToken } from "@clerk/backend";

// Relais serveur pour OpenRouteService — calcul d'ISOCHRONES (« quels prospects à moins de N
// minutes d'ici ? »). La clé ORS_API_KEY reste cote serveur : elle n'est jamais envoyee au
// navigateur, comme la cle Anthropic.
//
// Plan gratuit OpenRouteService : ~500 requetes d'isochrones par jour, 40 par minute. Largement
// suffisant pour un usage commercial individuel.
export const config = { maxDuration: 30 };

// Bornes de securite : au-dela, la reponse devient enorme et le service public est inutilement charge.
const MAX_MINUTES = 120;
const MAX_LOCATIONS = 1;

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Methode non autorisee" }); return; }

  const key = process.env.ORS_API_KEY;
  if (!key) { res.status(500).json({ error: "ORS_API_KEY manquante cote serveur. Creez une cle gratuite sur openrouteservice.org, puis ajoutez-la dans les variables d'environnement Vercel." }); return; }

  // Authentification Clerk obligatoire (meme exigence que les autres relais).
  const clerkSecret = process.env.CLERK_SECRET_KEY;
  if (!clerkSecret) { res.status(500).json({ error: "Authentification non configuree cote serveur." }); return; }
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) { res.status(401).json({ error: "Non authentifie." }); return; }
  try { await verifyToken(token, { secretKey: clerkSecret }); }
  catch (e) { res.status(401).json({ error: "Session invalide ou expiree." }); return; }

  const body = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {});
  const lat = Number(body.lat), lng = Number(body.lng);
  const minutes = Math.min(Math.max(Number(body.minutes) || 30, 1), MAX_MINUTES);
  const profil = ["driving-car", "cycling-regular", "foot-walking"].includes(body.profil) ? body.profil : "driving-car";
  if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) { res.status(400).json({ error: "Coordonnees invalides." }); return; }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    // ORS attend les coordonnees en [longitude, latitude] — l'inverse de l'usage courant.
    const up = await fetch("https://api.openrouteservice.org/v2/isochrones/" + profil, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: key, Accept: "application/geo+json" },
      body: JSON.stringify({ locations: [[lng, lat]].slice(0, MAX_LOCATIONS), range: [minutes * 60], range_type: "time" }),
      signal: controller.signal,
    });
    const txt = await up.text();
    if (!up.ok) {
      // On remonte un motif lisible plutot que le JSON brut d'ORS.
      let motif = "";
      try { const j = JSON.parse(txt); motif = (j.error && (j.error.message || j.error)) || j.message || ""; } catch (e) { motif = txt.slice(0, 160); }
      res.status(up.status === 403 || up.status === 401 ? 502 : up.status).json({ error: "OpenRouteService : " + (motif || "erreur " + up.status) });
      return;
    }
    res.status(200).setHeader("Content-Type", "application/json");
    res.send(txt);
  } catch (e) {
    const msg = e && e.name === "AbortError" ? "Calcul d'isochrone : delai depasse." : "Service d'isochrones indisponible : " + (e && e.message ? e.message : String(e));
    res.status(502).json({ error: msg });
  } finally {
    clearTimeout(timer);
  }
}
