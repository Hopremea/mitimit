import { verifyToken, createClerkClient } from "@clerk/backend";
import { baseAdmin, echec } from "./db.js";

// Vérifie le jeton de session Clerk envoyé en en-tête « Authorization: Bearer … ».
// Renvoie { userId } ou null (la réponse 401 est alors déjà écrite).
export async function utilisateur(req, res) {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) return echec(res, 500, "Authentification non configurée côté serveur (CLERK_SECRET_KEY).");

  const entete = req.headers.authorization || "";
  const jeton = entete.startsWith("Bearer ") ? entete.slice(7) : "";
  if (!jeton) return echec(res, 401, "Non authentifié.");

  try {
    const claims = await verifyToken(jeton, { secretKey: secret });
    if (!claims || !claims.sub) return echec(res, 401, "Session invalide.");
    return { userId: claims.sub };
  } catch (e) {
    return echec(res, 401, "Session invalide ou expirée.");
  }
}

// Profil Clerk (e-mail, nom) — appelé seulement quand on écrit une fiche membre.
// Le jeton de session ne porte pas l'e-mail : il faut le demander à Clerk.
// Un échec ici n'est jamais bloquant : le membre est créé sans e-mail affichable.
export async function profil(userId) {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) return {};
  try {
    const clerk = createClerkClient({ secretKey: secret });
    const u = await clerk.users.getUser(userId);
    const principal = (u.emailAddresses || []).find((e) => e.id === u.primaryEmailAddressId);
    const email = (principal && principal.emailAddress) || (u.emailAddresses && u.emailAddresses[0] && u.emailAddresses[0].emailAddress) || null;
    const nom = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || null;
    return { email, nom };
  } catch (e) {
    return {};
  }
}

// Hiérarchie des rôles : un rang supérieur peut tout ce que peut un rang inférieur.
const RANG = { membre: 1, admin: 2, proprietaire: 3 };

export function auMoins(role, requis) {
  return (RANG[role] || 0) >= (RANG[requis] || 0);
}

// Résout l'organisation active : celle demandée en en-tête « X-Organisation », à condition
// que l'utilisateur en soit membre. C'est LE point de passage du cloisonnement — une requête
// ne peut désigner une organisation que si une fiche membre l'y rattache.
// Renvoie { sb, membre } ou null (réponse d'erreur déjà écrite).
export async function contexte(req, res, userId, roleRequis = "membre") {
  const sb = baseAdmin();
  if (!sb) return echec(res, 500, "Base non configurée côté serveur (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).");

  const orgId = String(req.headers["x-organisation"] || req.query.organisation || "").trim();
  if (!orgId) return echec(res, 400, "Aucune organisation sélectionnée.");

  const { data, error } = await sb
    .from("membres")
    .select("id, organisation_id, role, organisations ( id, nom, slug, plan, statut_abonnement, periode_fin )")
    .eq("clerk_user_id", userId)
    .eq("organisation_id", orgId)
    .maybeSingle();

  if (error) return echec(res, 502, "Base indisponible : " + error.message);
  // Même réponse qu'une organisation inexistante : ne pas révéler qu'un identifiant est valide.
  if (!data) return echec(res, 404, "Organisation introuvable.");
  if (!auMoins(data.role, roleRequis)) return echec(res, 403, "Votre rôle ne permet pas cette action.");

  return { sb, membre: data, organisation: data.organisations };
}
