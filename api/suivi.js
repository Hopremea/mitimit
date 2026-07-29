import { verifyToken } from "@clerk/backend";

// Relais serveur pour l'API « Suivi » de La Poste / Colissimo. La cle LAPOSTE_API_KEY reste cote
// serveur. Elle s'obtient gratuitement sur developer.laposte.fr (produit « Suivi »).
export const config = { maxDuration: 30 };

// Un numero de suivi La Poste / Colissimo : 11 a 15 caracteres alphanumeriques (ex. 6A123456789FR).
const NUM_VALIDE = /^[A-Z0-9]{8,20}$/i;

// Traduction des codes d'etape en libelle court et en indicateur « livre / en cours / probleme »,
// pour un affichage lisible dans la fiche commande.
function etatDepuisCode(code) {
  const c = String(code || "").toUpperCase();
  if (["DI1", "DI2"].includes(c)) return { etat: "livre", label: "Livré" };
  if (["ET1", "ET2", "ET3", "ET4", "EP1", "PC1", "PC2"].includes(c)) return { etat: "en_cours", label: "En cours d'acheminement" };
  if (["DO1", "DO2", "DO3"].includes(c)) return { etat: "attente", label: "En attente de retrait" };
  if (["ND1", "AG1", "RE1"].includes(c)) return { etat: "probleme", label: "Incident de livraison" };
  return { etat: "en_cours", label: "" };
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Methode non autorisee" }); return; }

  const key = process.env.LAPOSTE_API_KEY;
  if (!key) { res.status(500).json({ error: "LAPOSTE_API_KEY manquante cote serveur. Creez une cle gratuite sur developer.laposte.fr (produit « Suivi »), puis ajoutez-la dans les variables d'environnement Vercel." }); return; }

  const clerkSecret = process.env.CLERK_SECRET_KEY;
  if (!clerkSecret) { res.status(500).json({ error: "Authentification non configuree cote serveur." }); return; }
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) { res.status(401).json({ error: "Non authentifie." }); return; }
  try { await verifyToken(token, { secretKey: clerkSecret }); }
  catch (e) { res.status(401).json({ error: "Session invalide ou expiree." }); return; }

  const body = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {});
  const num = String(body.numero || "").trim().replace(/\s/g, "");
  if (!NUM_VALIDE.test(num)) { res.status(400).json({ error: "Numero de suivi invalide (8 a 20 caracteres alphanumeriques)." }); return; }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const up = await fetch("https://api.laposte.fr/suivi/v2/idships/" + encodeURIComponent(num) + "?lang=fr_FR", {
      headers: { "X-Okapi-Key": key, Accept: "application/json" },
      signal: controller.signal,
    });
    const txt = await up.text();
    let j = null; try { j = JSON.parse(txt); } catch (e) {}
    if (!up.ok) {
      const motif = (j && (j.message || j.returnMessage)) || ("erreur " + up.status);
      // 404 = numero inconnu : ce n'est pas une panne, on le dit clairement.
      res.status(up.status === 404 ? 200 : 502).json(up.status === 404
        ? { introuvable: true, error: "Numero inconnu du service de suivi (colis pas encore pris en charge ?)." }
        : { error: "La Poste : " + motif });
      return;
    }
    // La reponse encapsule le colis dans « shipment ».
    const sh = (j && (j.shipment || (j.shipments && j.shipments[0]))) || null;
    if (!sh) { res.status(200).json({ introuvable: true, error: "Aucune information de suivi pour ce numero." }); return; }
    const evts = (sh.event || sh.events || []).map((e) => ({
      date: String(e.date || "").slice(0, 10),
      heure: String(e.date || "").slice(11, 16),
      libelle: e.label || "",
      code: e.code || "",
    }));
    const dernier = evts[0] || null;
    const st = etatDepuisCode(dernier && dernier.code);
    res.status(200).json({
      numero: sh.idShip || num,
      produit: sh.product || "",
      etat: st.etat,
      etatLabel: st.label || (dernier && dernier.libelle) || "",
      dernierEvenement: dernier,
      evenements: evts.slice(0, 12),
      livreLe: sh.timeline ? (sh.timeline.find((t) => t.status && /livr/i.test(t.shortLabel || "")) || {}).date || "" : "",
      url: sh.url || "",
    });
  } catch (e) {
    const msg = e && e.name === "AbortError" ? "Suivi : delai depasse." : "Service de suivi indisponible : " + (e && e.message ? e.message : String(e));
    res.status(502).json({ error: msg });
  } finally {
    clearTimeout(timer);
  }
}
