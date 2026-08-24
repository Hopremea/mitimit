import React from "react";
import { SignedIn, SignedOut, useAuth } from "@clerk/clerk-react";
import { useRoute } from "./routeur.jsx";
import { appel } from "./api.js";
import { Chargement, Erreur } from "./composants/Etat.jsx";
import Coquille from "./composants/Coquille.jsx";
import Accueil from "./pages/Accueil.jsx";
import Bienvenue from "./pages/Bienvenue.jsx";
import Rejoindre from "./pages/Rejoindre.jsx";
import Tableau from "./pages/Tableau.jsx";
import Equipe from "./pages/Equipe.jsx";
import Facturation from "./pages/Facturation.jsx";

const CLE_ORG = "matmat.organisation";

export default function App() {
  const { chemin, naviguer } = useRoute();

  // La page d'invitation vit hors du chargement du contexte : on doit pouvoir l'ouvrir
  // sans compte, puisque c'est justement l'écran qui en fait créer un.
  if (chemin === "/rejoindre") {
    return <Rejoindre surAdhesion={(o) => { memoriser(o.id); window.location.assign("/app"); }} />;
  }

  return (
    <>
      <SignedOut>
        <Accueil />
      </SignedOut>
      <SignedIn>
        <Connecte chemin={chemin} naviguer={naviguer} />
      </SignedIn>
    </>
  );
}

// localStorage peut lever (navigation privée verrouillée, stockage désactivé) : l'organisation
// active est un confort, jamais une condition de fonctionnement.
function memoriser(id) {
  try { localStorage.setItem(CLE_ORG, id); } catch (e) { /* sans mémoire, on repart sur la première */ }
}
function memorisee() {
  try { return localStorage.getItem(CLE_ORG); } catch (e) { return null; }
}

function Connecte({ chemin, naviguer }) {
  const { isLoaded } = useAuth();
  const [contexte, setContexte] = React.useState(null);
  const [erreur, setErreur] = React.useState("");
  const [activeId, setActiveId] = React.useState(() => memorisee());

  const charger = React.useCallback(async () => {
    setErreur("");
    try {
      setContexte(await appel("contexte"));
    } catch (e) {
      setErreur(e.message);
    }
  }, []);

  // Attendre isLoaded : appelé plus tôt, /api/contexte partirait sans jeton et reviendrait 401.
  React.useEffect(() => { if (isLoaded) charger(); }, [isLoaded, charger]);

  if (erreur) {
    return (
      <main className="contenu" style={{ maxWidth: 520, paddingTop: "12vh" }}>
        <div className="carte"><Erreur message={erreur} surReessai={charger} /></div>
      </main>
    );
  }
  if (!contexte) return <main className="contenu"><Chargement /></main>;

  const organisations = contexte.organisations || [];

  if (organisations.length === 0) {
    return (
      <Bienvenue
        surCreation={async (nom) => {
          const r = await appel("creer", { methode: "POST", corps: { nom } });
          memoriser(r.organisation.id);
          setActiveId(r.organisation.id);
          setContexte({ ...contexte, organisations: [r.organisation] });
          naviguer("/app");
        }}
      />
    );
  }

  // L'organisation mémorisée peut ne plus exister (départ, suppression) : on retombe alors
  // sur la première, plutôt que d'afficher un écran vide sans explication.
  const active = organisations.find((o) => o.id === activeId) || organisations[0];

  function changer(id) {
    memoriser(id);
    setActiveId(id);
  }

  let ecran;
  if (chemin === "/equipe") {
    ecran = <Equipe organisation={active} surDepart={() => { changer(""); charger(); naviguer("/app"); }} />;
  } else if (chemin === "/facturation") {
    ecran = <Facturation organisation={active} role={active.role} />;
  } else {
    ecran = <Tableau organisation={active} />;
  }

  return (
    <Coquille organisations={organisations} active={active} surChangement={changer}>
      {ecran}
    </Coquille>
  );
}
