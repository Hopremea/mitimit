import React from "react";
import { UserButton } from "@clerk/clerk-react";
import { Lien, useRoute } from "../routeur.jsx";

// Cadre commun des écrans privés : marque, sélecteur d'organisation, onglets, compte.
export default function Coquille({ organisations, active, surChangement, children }) {
  const { chemin } = useRoute();

  const onglets = [
    { vers: "/app", texte: "Tableau de bord" },
    { vers: "/equipe", texte: "Équipe" },
    { vers: "/facturation", texte: "Facturation" },
  ];

  return (
    <>
      <nav className="barre">
        <Lien vers="/app" className="marque">MATMAT</Lien>

        {organisations.length > 0 && (
          <select
            aria-label="Organisation active"
            value={active ? active.id : ""}
            onChange={(e) => surChangement(e.target.value)}
            style={{ width: "auto", maxWidth: 210, padding: "6px 9px", fontSize: 13.5, fontWeight: 650 }}
          >
            {organisations.map((o) => (
              <option key={o.id} value={o.id}>{o.nom}</option>
            ))}
          </select>
        )}

        <div className="onglets">
          {onglets.map((o) => (
            <Lien key={o.vers} vers={o.vers} className="onglet" aria-current={chemin === o.vers ? "page" : undefined}>
              {o.texte}
            </Lien>
          ))}
        </div>

        <div className="pousse" style={{ display: "flex", alignItems: "center" }}>
          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>
      <main className="contenu">{children}</main>
    </>
  );
}
