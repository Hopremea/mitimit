import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { Routeur } from "./routeur.jsx";
import { brancherJeton } from "./api.js";
import App from "./App.jsx";
import "./styles.css";

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Garde-fou : une erreur de rendu affiche un écran de secours plutôt qu'une page blanche.
class Filet extends React.Component {
  constructor(props) { super(props); this.state = { erreur: null }; }
  static getDerivedStateFromError(erreur) { return { erreur }; }
  componentDidCatch(erreur, infos) { try { console.error("Erreur de rendu :", erreur, infos); } catch (e) {} }
  render() {
    if (!this.state.erreur) return this.props.children;
    return (
      <div className="contenu" style={{ maxWidth: 460, paddingTop: "14vh", textAlign: "center" }}>
        <div className="carte">
          <h1 style={{ fontSize: 19 }}>Une erreur inattendue est survenue</h1>
          <p className="doux petit">Vos données sont intactes côté serveur. Rechargez la page pour reprendre.</p>
          <button onClick={() => window.location.replace("/")}>Recharger</button>
        </div>
      </div>
    );
  }
}

// Pont : expose le lecteur de jeton Clerk au module api.js, qui le joint à chaque appel.
function PontJeton() {
  const { getToken } = useAuth();
  React.useEffect(() => {
    brancherJeton(getToken);
    return () => brancherJeton(null);
  }, [getToken]);
  return null;
}

function Racine() {
  // Sans clé Clerk, l'application ne peut pas fonctionner : toute donnée est rattachée à un
  // utilisateur. On le dit franchement plutôt que d'afficher une coquille vide inexplicable.
  if (!CLERK_KEY) {
    return (
      <div className="contenu" style={{ maxWidth: 520, paddingTop: "12vh" }}>
        <div className="carte">
          <h1 style={{ fontSize: 19 }}>Authentification non configurée</h1>
          <p className="doux petit">
            Définissez <code>VITE_CLERK_PUBLISHABLE_KEY</code> dans les variables d'environnement,
            puis redéployez. Voir le <code>README.md</code> du dossier <code>saas/</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={CLERK_KEY} afterSignOutUrl="/">
      <PontJeton />
      <Filet>
        <Routeur>
          <App />
        </Routeur>
      </Filet>
    </ClerkProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Racine />);
