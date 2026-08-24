import React from "react";
import { appel } from "../api.js";
import { Chargement, Erreur, useAction } from "../composants/Etat.jsx";

const LIBELLES = { proprietaire: "Propriétaire", admin: "Administrateur", membre: "Membre" };

export default function Equipe({ organisation, surDepart }) {
  const [donnees, setDonnees] = React.useState(null);
  const [erreurChargement, setErreurChargement] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("membre");
  const [lien, setLien] = React.useState("");
  const { enCours, erreur, lancer } = useAction();

  const charger = React.useCallback(async () => {
    setErreurChargement("");
    setDonnees(null);
    try {
      setDonnees(await appel("membres", { organisation: organisation.id }));
    } catch (e) {
      setErreurChargement(e.message);
    }
  }, [organisation.id]);

  React.useEffect(() => { charger(); setLien(""); }, [charger]);

  const monRole = donnees && donnees.moi ? donnees.moi.role : "membre";
  const peutAdministrer = monRole === "admin" || monRole === "proprietaire";

  async function inviter(e) {
    e.preventDefault();
    const r = await lancer(() =>
      appel("inviter", { methode: "POST", organisation: organisation.id, corps: { email: email.trim(), role } })
    );
    if (!r) return;
    setEmail("");
    // Aucun e-mail n'est envoyé par ce socle : le lien est affiché pour être transmis à la
    // main. Brancher un envoi automatique est un chantier à part (voir le README).
    setLien(window.location.origin + r.lien);
    charger();
  }

  async function agir(action, corps) {
    const r = await lancer(() => appel(action, { methode: "POST", organisation: organisation.id, corps }));
    if (r) charger();
    return r;
  }

  async function partir(membreId) {
    const r = await agir("retirer", { membreId });
    if (r) surDepart();
  }

  return (
    <div className="pile">
      <div>
        <h1>Équipe</h1>
        <p className="doux petit" style={{ margin: 0 }}>
          Qui a accès à « {organisation.nom} », et avec quel rôle.
        </p>
      </div>

      {peutAdministrer && (
        <form onSubmit={inviter} className="carte pile" style={{ gap: 12 }}>
          <h2>Inviter quelqu'un</h2>
          <div className="ligne" style={{ alignItems: "flex-end" }}>
            <div className="champ">
              <label htmlFor="email">Adresse e-mail</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="collegue@exemple.fr" />
            </div>
            <div style={{ flex: "0 1 180px" }}>
              <label htmlFor="role">Rôle</label>
              <select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="membre">Membre</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>
            <button type="submit" disabled={enCours || !email.trim()}>Inviter</button>
          </div>
          <Erreur message={erreur} />
          {lien && (
            <div className="message succes">
              Invitation créée. Transmettez ce lien : <code style={{ wordBreak: "break-all" }}>{lien}</code>
            </div>
          )}
        </form>
      )}

      <section className="carte">
        <h2>Membres</h2>
        {erreurChargement && <Erreur message={erreurChargement} surReessai={charger} />}
        {!erreurChargement && donnees === null && <Chargement />}
        {donnees && (
          <ul className="liste">
            {donnees.membres.map((m) => {
              const moi = donnees.moi && m.id === donnees.moi.id;
              return (
                <li key={m.id}>
                  <div style={{ minWidth: 0, flex: "1 1 200px" }}>
                    <strong>{m.nom || m.email || "Compte sans nom"}</strong>
                    {moi && <span className="doux petit"> — vous</span>}
                    {m.email && m.nom && <div className="doux petit">{m.email}</div>}
                  </div>

                  {peutAdministrer && !moi ? (
                    <select
                      aria-label={"Rôle de " + (m.nom || m.email || "ce membre")}
                      value={m.role}
                      disabled={enCours}
                      onChange={(e) => agir("role", { membreId: m.id, role: e.target.value })}
                      style={{ width: "auto", padding: "5px 9px", fontSize: 12.5 }}
                    >
                      <option value="membre">Membre</option>
                      <option value="admin">Administrateur</option>
                      {monRole === "proprietaire" && <option value="proprietaire">Propriétaire</option>}
                    </select>
                  ) : (
                    <span className="pastille">{LIBELLES[m.role]}</span>
                  )}

                  {moi ? (
                    <button className="danger mini pousse" disabled={enCours} onClick={() => partir(m.id)}>
                      Quitter
                    </button>
                  ) : peutAdministrer ? (
                    <button className="danger mini pousse" disabled={enCours} onClick={() => agir("retirer", { membreId: m.id })}>
                      Retirer
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {peutAdministrer && donnees && donnees.invitations.length > 0 && (
        <section className="carte">
          <h2>Invitations en attente</h2>
          <ul className="liste">
            {donnees.invitations.map((i) => (
              <li key={i.id}>
                <div style={{ minWidth: 0, flex: "1 1 200px" }}>
                  <strong>{i.email}</strong>
                  <div className="doux petit">
                    {LIBELLES[i.role]} · expire le {new Date(i.expire_le).toLocaleDateString("fr-FR")}
                  </div>
                </div>
                <button className="danger mini pousse" disabled={enCours} onClick={() => agir("revoquer", { id: i.id })}>
                  Révoquer
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
