import { utilisateur, profil, contexte } from "../lib/auth.js";
import { echec } from "../lib/db.js";
import { stripe, stripeConfigure } from "../lib/stripe.js";

// Abonnement de l'organisation active : état, souscription, portail de gestion.
//
// L'application n'encaisse rien elle-même : la carte est saisie sur les pages hébergées par
// Stripe (Checkout, puis le portail client). Aucun numéro de carte ne traverse ce code, et
// c'est le webhook — pas le retour de navigateur — qui fait foi pour marquer un compte payé.

// Origine publique du site, pour les URL de retour de Stripe. Déduite de la requête si la
// variable n'est pas fournie : sans elle, un déploiement de préversion renverrait l'utilisateur
// vers la production après paiement.
function origine(req) {
  if (process.env.APP_URL) return String(process.env.APP_URL).replace(/\/+$/, "");
  const hote = req.headers["x-forwarded-host"] || req.headers.host;
  const protocole = req.headers["x-forwarded-proto"] || "https";
  return `${protocole}://${hote}`;
}

export default async function handler(req, res) {
  const action = String((req.query && req.query.action) || "").trim();

  const u = await utilisateur(req, res);
  if (!u) return;

  // Toucher à l'argent est réservé au propriétaire : un admin gère l'équipe, pas la carte.
  const roleRequis = action === "etat" ? "membre" : "proprietaire";
  const ctx = await contexte(req, res, u.userId, roleRequis);
  if (!ctx) return;

  if (!stripeConfigure() && action !== "etat") {
    return echec(res, 503, "Facturation non configurée côté serveur (STRIPE_SECRET_KEY + STRIPE_PRICE_ID).");
  }

  try {
    if (action === "etat") return etat(res, ctx);
    if (action === "souscrire") return await souscrire(req, res, u, ctx);
    if (action === "portail") return await portail(req, res, ctx);
    return echec(res, 400, "Action inconnue : « " + action + " ».");
  } catch (e) {
    return echec(res, 502, "Facturation indisponible : " + (e && e.message ? e.message : String(e)));
  }
}

function etat(res, ctx) {
  const o = ctx.organisation || {};
  const actif = o.statut_abonnement === "actif" || o.statut_abonnement === "essai";
  res.status(200).json({
    plan: o.plan || "gratuit",
    statut: o.statut_abonnement || "inactif",
    periode_fin: o.periode_fin || null,
    actif,
    // Le propriétaire ne voit le bouton « gérer » que si un compte Stripe existe déjà.
    client: Boolean(o.stripe_customer_id),
    configure: stripeConfigure(),
  });
}

// Retrouve ou crée le client Stripe de l'organisation. L'identifiant est mémorisé en base :
// sans cela, chaque souscription créerait un doublon et l'historique de facturation se perdrait.
async function clientStripe(u, ctx) {
  if (ctx.organisation.stripe_customer_id) return ctx.organisation.stripe_customer_id;

  const p = await profil(u.userId);
  const client = await stripe("/customers", {
    name: ctx.organisation.nom,
    email: p.email || undefined,
    // Le webhook arrive sans contexte de session : ces métadonnées lui disent quelle
    // organisation mettre à jour.
    metadata: { organisation_id: ctx.organisation.id },
  });

  const { error } = await ctx.sb
    .from("organisations")
    .update({ stripe_customer_id: client.id })
    .eq("id", ctx.organisation.id);
  if (error) throw new Error(error.message);

  return client.id;
}

async function souscrire(req, res, u, ctx) {
  if (req.method !== "POST") return echec(res, 405, "Méthode non autorisée.");

  const client = await clientStripe(u, ctx);
  const base = origine(req);

  const session = await stripe("/checkout/sessions", {
    mode: "subscription",
    customer: client,
    "line_items": [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${base}/facturation?paiement=ok`,
    cancel_url: `${base}/facturation?paiement=annule`,
    client_reference_id: ctx.organisation.id,
    subscription_data: { metadata: { organisation_id: ctx.organisation.id } },
    metadata: { organisation_id: ctx.organisation.id },
  });

  res.status(200).json({ url: session.url });
}

async function portail(req, res, ctx) {
  if (req.method !== "POST") return echec(res, 405, "Méthode non autorisée.");
  if (!ctx.organisation.stripe_customer_id) return echec(res, 409, "Aucun abonnement à gérer pour le moment.");

  const session = await stripe("/billing_portal/sessions", {
    customer: ctx.organisation.stripe_customer_id,
    return_url: `${origine(req)}/facturation`,
  });

  res.status(200).json({ url: session.url });
}
