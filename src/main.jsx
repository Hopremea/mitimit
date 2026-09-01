import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// Connecteur Clerk DÉBRANCHÉ (mise en réserve du logiciel, septembre 2026) : plus d'écran de
// connexion, plus de jeton de session. L'accès au site se protège désormais au niveau de
// l'hébergeur (Vercel → Settings → Deployment Protection), sans service tiers.

// Garde-fou : capture toute erreur de rendu et affiche un écran de secours
// (au lieu d'une page blanche), avec rechargement. Les données restent en lieu sûr (localStorage).
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { try { console.error("Erreur de rendu :", error, info); } catch (e) {} }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", background: "#fff8ea", color: "#16203a" }}>
        <div style={{ maxWidth: 460, background: "#fff", border: "1px solid #ece3d2", borderRadius: 18, padding: "26px 24px", boxShadow: "0 12px 40px rgba(20,32,58,.14)", textAlign: "center" }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>⚠️</div>
          <h1 style={{ fontSize: 19, margin: "0 0 8px" }}>Une erreur inattendue est survenue</h1>
          <p style={{ fontSize: 14, color: "#6b7589", lineHeight: 1.55, margin: "0 0 18px" }}>
            Vos données sont en sécurité (sauvegardées localement). Rechargez la page pour reprendre : l'application rouvre sur l'accueil.
          </p>
          {/* Le rechargement remet l'application sur l'onglet d'accueil : sans cela, l'écran qui vient
              de planter serait rouvert aussitôt et l'erreur réapparaîtrait, donnant l'impression que le
              bouton ne fait rien. Seul le repère de navigation est effacé, jamais les données. */}
          <button onClick={() => { try { localStorage.removeItem("penup_nav"); } catch (e) {} try { const u = new URL(window.location.href); u.searchParams.set("_v", Date.now().toString(36)); window.location.replace(u.toString()); } catch (e) { window.location.reload(); } }}
            style={{ border: "none", cursor: "pointer", fontWeight: 800, fontSize: 14, color: "#fff", padding: "11px 20px", borderRadius: 12, background: "linear-gradient(135deg,#3F60AA,#2f4c86)", fontFamily: "inherit" }}>
            Recharger l'application
          </button>
        </div>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(<ErrorBoundary><App /></ErrorBoundary>);

// PWA : enregistrement du service worker (app-shell en cache, lancement rapide, mode hors-ligne de
// secours, installation sur l'écran d'accueil). Sans effet en développement local sans HTTPS.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((e) => { try { console.warn("SW non enregistré :", e); } catch (x) {} });
  });
}
