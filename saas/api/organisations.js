import crypto from "node:crypto";
import { utilisateur, profil, contexte, auMoins } from "../lib/auth.js";
import { baseAdmin, echec, corps } from "../lib/db.js";

// Toute la gestion des locataires en UNE fonction, aiguillée par « ?action= ».
//
// Vercel compte chaque fichier de api/ comme une fonction serverless, et le plan Hobby en
// autorise douze par projet — le cockpit MITMIT a déjà buté dessus. Regrouper les actions
// proches garde de la marge pour les vraies fonctions métier à venir.
//
// Invariant de sécurité : aucune action ne lit ni n'écrit une ligne sans passer par
// contexte(), qui n'accepte une organisation que si l'appelant y a une fiche membre.

export default async function handler(req, res) {
  const action = String((req.query && req.query.action) || "").trim();

  // Seule exception à l'authentification : l'aperçu d'une invitation. La personne invitée
  // n'a pas encore de compte — c'est justement l'écran qui lui en fait créer un. Le jeton
  // du lien ne donne accès qu'au nom de l'organisation et au rôle proposé, rien d'autre.
  if (action === "invitation") {
    try {
      return await lireInvitation(req, res);
    } catch (e) {
      return echec(res, 502, "Service indisponible : " + (e && e.message ? e.message : String(e)));
    }
  }

  const u = await utilisateur(req, res);
  if (!u) return; // 401 déjà écrit

  try {
    switch (action) {
      case "contexte":       return await lireContexte(req, res, u);
      case "creer":          return await creerOrganisation(req, res, u);
      case "membres":        return await listerMembres(req, res, u);
      case "inviter":        return await inviter(req, res, u);
      case "rejoindre":      return await rejoindre(req, res, u);
      case "revoquer":       return await revoquer(req, res, u);
      case "role":           return await changerRole(req, res, u);
      case "retirer":        return await retirer(req, res, u);
      case "ressources":     return await listerRessources(req, res, u);
      case "ressource-creer":    return await creerRessource(req, res, u);
      case "ressource-retirer":  return await retirerRessource(req, res, u);
      default:
        return echec(res, 400, "Action inconnue : « " + action + " ».");
    }
  } catch (e) {
    return echec(res, 502, "Service indisponible : " + (e && e.message ? e.message : String(e)));
  }
}

// ------------------------------------------------------------------ contexte de démarrage
// Premier appel de l'application : « qui suis-je, et à quelles organisations j'appartiens ? »
async function lireContexte(req, res, u) {
  const sb = baseAdmin();
  if (!sb) return echec(res, 500, "Base non configurée côté serveur.");

  const { data, error } = await sb
    .from("membres")
    .select("role, organisations ( id, nom, slug, plan, statut_abonnement, periode_fin )")
    .eq("clerk_user_id", u.userId)
    .order("rejoint_le", { ascending: true });

  if (error) return echec(res, 502, "Base indisponible : " + error.message);

  const organisations = (data || [])
    .filter((m) => m.organisations)
    .map((m) => ({ ...m.organisations, role: m.role }));

  res.status(200).json({ utilisateur: { id: u.userId }, organisations });
}

// ------------------------------------------------------------------ création d'une organisation
// Identifiant lisible dérivé du nom. En cas de collision, on suffixe : deux clients peuvent
// légitimement s'appeler pareil, ça ne doit pas faire échouer une inscription.
function versSlug(nom) {
  return String(nom || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 40) || "organisation";
}

async function creerOrganisation(req, res, u) {
  if (req.method !== "POST") return echec(res, 405, "Méthode non autorisée.");

  const { nom } = corps(req);
  const propre = String(nom || "").trim().slice(0, 80);
  if (!propre) return echec(res, 400, "Le nom de l'organisation est obligatoire.");

  const sb = baseAdmin();
  if (!sb) return echec(res, 500, "Base non configurée côté serveur.");

  const base = versSlug(propre);
  let organisation = null;
  let derniereErreur = null;

  for (let essai = 0; essai < 5 && !organisation; essai++) {
    const slug = essai === 0 ? base : `${base}-${crypto.randomBytes(2).toString("hex")}`;
    const { data, error } = await sb
      .from("organisations")
      .insert({ nom: propre, slug })
      .select("id, nom, slug, plan, statut_abonnement, periode_fin")
      .single();
    // 23505 = violation d'unicité : le slug est pris, on réessaie avec un suffixe.
    if (error && error.code === "23505") { derniereErreur = error; continue; }
    if (error) return echec(res, 502, "Création impossible : " + error.message);
    organisation = data;
  }

  if (!organisation) return echec(res, 502, "Création impossible : " + (derniereErreur ? derniereErreur.message : "identifiant indisponible."));

  const p = await profil(u.userId);
  const { error: erreurMembre } = await sb.from("membres").insert({
    organisation_id: organisation.id,
    clerk_user_id: u.userId,
    email: p.email || null,
    nom: p.nom || null,
    role: "proprietaire",
  });

  if (erreurMembre) {
    // Sans fiche membre, l'organisation serait orpheline : personne ne pourrait plus jamais
    // y accéder ni la supprimer. On défait donc la création plutôt que de laisser ce déchet.
    await sb.from("organisations").delete().eq("id", organisation.id);
    return echec(res, 502, "Création impossible : " + erreurMembre.message);
  }

  res.status(200).json({ organisation: { ...organisation, role: "proprietaire" } });
}

// ------------------------------------------------------------------ équipe
async function listerMembres(req, res, u) {
  const ctx = await contexte(req, res, u.userId);
  if (!ctx) return;

  const [membres, invitations] = await Promise.all([
    ctx.sb.from("membres")
      .select("id, clerk_user_id, email, nom, role, rejoint_le")
      .eq("organisation_id", ctx.membre.organisation_id)
      .order("rejoint_le", { ascending: true }),
    ctx.sb.from("invitations")
      .select("id, email, role, expire_le, cree_le")
      .eq("organisation_id", ctx.membre.organisation_id)
      .is("accepte_le", null)
      .order("cree_le", { ascending: false }),
  ]);

  if (membres.error) return echec(res, 502, "Base indisponible : " + membres.error.message);
  if (invitations.error) return echec(res, 502, "Base indisponible : " + invitations.error.message);

  res.status(200).json({
    membres: membres.data || [],
    invitations: invitations.data || [],
    moi: { id: ctx.membre.id, role: ctx.membre.role },
  });
}

async function inviter(req, res, u) {
  if (req.method !== "POST") return echec(res, 405, "Méthode non autorisée.");
  const ctx = await contexte(req, res, u.userId, "admin");
  if (!ctx) return;

  const { email, role } = corps(req);
  const adresse = String(email || "").trim().toLowerCase();
  // Contrôle volontairement large : un e-mail valide n'est prouvé que par sa réception.
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(adresse)) return echec(res, 400, "Adresse e-mail invalide.");

  const rang = role === "admin" ? "admin" : "membre";
  const jeton = crypto.randomBytes(24).toString("base64url");

  const { data, error } = await ctx.sb
    .from("invitations")
    .insert({
      organisation_id: ctx.membre.organisation_id,
      email: adresse,
      role: rang,
      jeton,
      cree_par: u.userId,
    })
    .select("id, email, role, expire_le, cree_le")
    .single();

  if (error && error.code === "23505") return echec(res, 409, "Une invitation est déjà en attente pour cette adresse.");
  if (error) return echec(res, 502, "Invitation impossible : " + error.message);

  // Le jeton n'est renvoyé qu'ICI, à la personne qui invite, pour qu'elle transmette le lien.
  // Il n'apparaît jamais dans la liste des invitations : la relire ne doit pas donner un accès.
  res.status(200).json({ invitation: data, lien: `/rejoindre?jeton=${jeton}` });
}

async function revoquer(req, res, u) {
  if (req.method !== "POST") return echec(res, 405, "Méthode non autorisée.");
  const ctx = await contexte(req, res, u.userId, "admin");
  if (!ctx) return;

  const { id } = corps(req);
  if (!id) return echec(res, 400, "Invitation non précisée.");

  const { error } = await ctx.sb
    .from("invitations")
    .delete()
    .eq("id", id)
    .eq("organisation_id", ctx.membre.organisation_id); // cloisonnement : jamais l'invitation d'un autre client

  if (error) return echec(res, 502, "Révocation impossible : " + error.message);
  res.status(200).json({ ok: true });
}

// Aperçu du lien d'invitation, avant d'accepter : on montre le nom de l'organisation
// et rien d'autre — le jeton ne doit pas devenir une fenêtre sur les données du client.
async function lireInvitation(req, res) {
  const sb = baseAdmin();
  if (!sb) return echec(res, 500, "Base non configurée côté serveur.");

  const jeton = String((req.query && req.query.jeton) || "").trim();
  if (!jeton) return echec(res, 400, "Lien d'invitation incomplet.");

  const { data, error } = await sb
    .from("invitations")
    .select("id, role, expire_le, accepte_le, organisations ( id, nom )")
    .eq("jeton", jeton)
    .maybeSingle();

  if (error) return echec(res, 502, "Base indisponible : " + error.message);
  if (!data || !data.organisations) return echec(res, 404, "Invitation introuvable.");
  if (data.accepte_le) return echec(res, 410, "Cette invitation a déjà été utilisée.");
  if (new Date(data.expire_le) < new Date()) return echec(res, 410, "Cette invitation a expiré.");

  res.status(200).json({ organisation: data.organisations.nom, role: data.role });
}

async function rejoindre(req, res, u) {
  if (req.method !== "POST") return echec(res, 405, "Méthode non autorisée.");

  const sb = baseAdmin();
  if (!sb) return echec(res, 500, "Base non configurée côté serveur.");

  const { jeton } = corps(req);
  if (!jeton) return echec(res, 400, "Lien d'invitation incomplet.");

  const { data: inv, error } = await sb
    .from("invitations")
    .select("id, organisation_id, role, expire_le, accepte_le, organisations ( id, nom, slug, plan, statut_abonnement, periode_fin )")
    .eq("jeton", String(jeton))
    .maybeSingle();

  if (error) return echec(res, 502, "Base indisponible : " + error.message);
  if (!inv || !inv.organisations) return echec(res, 404, "Invitation introuvable.");
  if (inv.accepte_le) return echec(res, 410, "Cette invitation a déjà été utilisée.");
  if (new Date(inv.expire_le) < new Date()) return echec(res, 410, "Cette invitation a expiré.");

  const p = await profil(u.userId);
  const { error: erreurMembre } = await sb.from("membres").insert({
    organisation_id: inv.organisation_id,
    clerk_user_id: u.userId,
    email: p.email || null,
    nom: p.nom || null,
    role: inv.role,
  });

  // 23505 : déjà membre. Ce n'est pas un échec du point de vue de l'utilisateur — il voulait
  // entrer, il est dedans. On consomme l'invitation et on le laisse passer.
  if (erreurMembre && erreurMembre.code !== "23505") {
    return echec(res, 502, "Adhésion impossible : " + erreurMembre.message);
  }

  await sb.from("invitations").update({ accepte_le: new Date().toISOString() }).eq("id", inv.id);

  res.status(200).json({ organisation: { ...inv.organisations, role: inv.role } });
}

// Nombre de propriétaires restants : sert à interdire de vider une organisation de tout
// propriétaire, ce qui la rendrait ingérable (plus personne pour facturer ni inviter).
async function proprietairesRestants(sb, organisationId, sauf) {
  const { data, error } = await sb
    .from("membres")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("role", "proprietaire");
  if (error) throw new Error(error.message);
  return (data || []).filter((m) => m.id !== sauf).length;
}

async function changerRole(req, res, u) {
  if (req.method !== "POST") return echec(res, 405, "Méthode non autorisée.");
  const ctx = await contexte(req, res, u.userId, "admin");
  if (!ctx) return;

  const { membreId, role } = corps(req);
  if (!membreId || !["proprietaire", "admin", "membre"].includes(role)) {
    return echec(res, 400, "Membre ou rôle invalide.");
  }
  // Seul un propriétaire peut créer un autre propriétaire : sinon un admin s'auto-promeut.
  if (role === "proprietaire" && !auMoins(ctx.membre.role, "proprietaire")) {
    return echec(res, 403, "Seul un propriétaire peut nommer un propriétaire.");
  }

  const { data: cible, error: erreurCible } = await ctx.sb
    .from("membres").select("id, role")
    .eq("id", membreId).eq("organisation_id", ctx.membre.organisation_id).maybeSingle();
  if (erreurCible) return echec(res, 502, "Base indisponible : " + erreurCible.message);
  if (!cible) return echec(res, 404, "Membre introuvable.");

  // Un admin ne peut pas rétrograder un propriétaire — sans quoi la hiérarchie ne tient plus.
  if (cible.role === "proprietaire" && !auMoins(ctx.membre.role, "proprietaire")) {
    return echec(res, 403, "Seul un propriétaire peut modifier un propriétaire.");
  }
  if (cible.role === "proprietaire" && role !== "proprietaire" && (await proprietairesRestants(ctx.sb, ctx.membre.organisation_id, cible.id)) === 0) {
    return echec(res, 409, "L'organisation doit garder au moins un propriétaire.");
  }

  const { error } = await ctx.sb.from("membres").update({ role })
    .eq("id", membreId).eq("organisation_id", ctx.membre.organisation_id);
  if (error) return echec(res, 502, "Modification impossible : " + error.message);
  res.status(200).json({ ok: true });
}

async function retirer(req, res, u) {
  if (req.method !== "POST") return echec(res, 405, "Méthode non autorisée.");
  const ctx = await contexte(req, res, u.userId);
  if (!ctx) return;

  const { membreId } = corps(req);
  if (!membreId) return echec(res, 400, "Membre non précisé.");

  const soiMeme = membreId === ctx.membre.id;
  // Chacun peut partir de lui-même ; retirer quelqu'un d'autre demande le rang admin.
  if (!soiMeme && !auMoins(ctx.membre.role, "admin")) {
    return echec(res, 403, "Votre rôle ne permet pas cette action.");
  }

  const { data: cible, error: erreurCible } = await ctx.sb
    .from("membres").select("id, role")
    .eq("id", membreId).eq("organisation_id", ctx.membre.organisation_id).maybeSingle();
  if (erreurCible) return echec(res, 502, "Base indisponible : " + erreurCible.message);
  if (!cible) return echec(res, 404, "Membre introuvable.");

  if (cible.role === "proprietaire" && !soiMeme && !auMoins(ctx.membre.role, "proprietaire")) {
    return echec(res, 403, "Seul un propriétaire peut retirer un propriétaire.");
  }
  if (cible.role === "proprietaire" && (await proprietairesRestants(ctx.sb, ctx.membre.organisation_id, cible.id)) === 0) {
    return echec(res, 409, "L'organisation doit garder au moins un propriétaire.");
  }

  const { error } = await ctx.sb.from("membres").delete()
    .eq("id", membreId).eq("organisation_id", ctx.membre.organisation_id);
  if (error) return echec(res, 502, "Retrait impossible : " + error.message);
  res.status(200).json({ ok: true });
}

// ------------------------------------------------------------------ ressources (EXEMPLE)
// Ces trois actions ne servent qu'à démontrer le cloisonnement : chaque requête est filtrée
// sur l'organisation du contexte. Remplacez-les par vos actions métier, en gardant ce filtre.
async function listerRessources(req, res, u) {
  const ctx = await contexte(req, res, u.userId);
  if (!ctx) return;

  const { data, error } = await ctx.sb
    .from("ressources")
    .select("id, titre, note, cree_le")
    .eq("organisation_id", ctx.membre.organisation_id)
    .order("cree_le", { ascending: false })
    .limit(200);

  if (error) return echec(res, 502, "Base indisponible : " + error.message);
  res.status(200).json({ ressources: data || [] });
}

async function creerRessource(req, res, u) {
  if (req.method !== "POST") return echec(res, 405, "Méthode non autorisée.");
  const ctx = await contexte(req, res, u.userId);
  if (!ctx) return;

  const { titre, note } = corps(req);
  const propre = String(titre || "").trim().slice(0, 120);
  if (!propre) return echec(res, 400, "Le titre est obligatoire.");

  const { data, error } = await ctx.sb
    .from("ressources")
    .insert({
      organisation_id: ctx.membre.organisation_id,
      titre: propre,
      note: String(note || "").trim().slice(0, 500) || null,
      cree_par: u.userId,
    })
    .select("id, titre, note, cree_le")
    .single();

  if (error) return echec(res, 502, "Création impossible : " + error.message);
  res.status(200).json({ ressource: data });
}

async function retirerRessource(req, res, u) {
  if (req.method !== "POST") return echec(res, 405, "Méthode non autorisée.");
  const ctx = await contexte(req, res, u.userId);
  if (!ctx) return;

  const { id } = corps(req);
  if (!id) return echec(res, 400, "Ressource non précisée.");

  const { error } = await ctx.sb.from("ressources").delete()
    .eq("id", id).eq("organisation_id", ctx.membre.organisation_id);
  if (error) return echec(res, 502, "Suppression impossible : " + error.message);
  res.status(200).json({ ok: true });
}
