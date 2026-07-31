import React, { useMemo, useState } from "react";

/**
 * Modèle d'économie du canal indépendant.
 *
 * Question à laquelle ce composant répond : le canal indépendant peut-il financer un poste, et à
 * partir de quand ? Les données observées viennent de MITMIT, les hypothèses sont saisies. Le modèle
 * projette une FOURCHETTE (Wilson 95 %) et non un chiffre unique, parce que l'échantillon actuel est
 * trop petit pour autre chose.
 *
 * Deux écarts assumés avec la version d'origine :
 *  - les couleurs passent par les variables de thème du cockpit, pour suivre le mode sombre et les
 *    fonds colorés au lieu d'imposer un blanc fixe ;
 *  - la lecture des prospects et des devis suit le modèle réel de MITMIT (clés `independant` /
 *    `specialiste`, statuts `a_qualifier` / `converti`…), qu'une comparaison sur les libellés
 *    accentués ne retrouvait pas.
 */

const TYPES_INDEP = ["independant", "specialiste"];
// Statuts qui signifient « pas encore contacté » : tout le reste vaut contact établi.
const STATUTS_NON_CONTACTE = new Set(["", "a_qualifier", "a_contacter"]);
// Un devis au statut brouillon, envoyé ou refusé n'est pas une commande.
const STATUTS_GAGNES = new Set(["accepte", "expediee", "livre"]);

const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

// Profil de réassort du jouet et du loisir créatif indépendant : creux estival, concentration de
// septembre à novembre. Hypothèse de travail, à corriger dès que douze mois d'historique existent.
const SAISON_DEFAUT = [3, 4, 6, 7, 6, 5, 2, 10, 15, 18, 16, 8];

const eur = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0);
const pct = (n, d = 1) => `${(Number.isFinite(n) ? n * 100 : 0).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d })} %`;

/**
 * Intervalle de Wilson à 95 %. Choisi plutôt que l'intervalle normal parce qu'il reste valide sur de
 * très petits échantillons et ne produit jamais de borne négative.
 */
function wilson(k, n, z = 1.96) {
  if (!n || n <= 0) return { p: 0, bas: 0, haut: 0 };
  const p = k / n;
  const d = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / d;
  const marge = (z / d) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { p, bas: Math.max(0, centre - marge), haut: Math.min(1, centre + marge) };
}

function projeter({ tauxConversion, gisement, contactsParMois, contactsDejaFaits, comptesDejaActifs, panierAnnuel, margeBrute, coutMensuel, delaiEncaissement, saison, horizon, moisDepart }) {
  const poidsTotal = saison.reduce((a, b) => a + b, 0) || 100;
  const lignes = [];
  let contactsCumules = contactsDejaFaits;
  let comptes = comptesDejaActifs;
  let margeCumulee = 0;
  let coutCumule = 0;
  const facturesEnAttente = [];

  for (let i = 0; i < horizon; i++) {
    const idxMois = (moisDepart + i) % 12;
    const poids = saison[idxMois] / poidsTotal;

    // Nouveaux comptes, plafonnés par le gisement restant.
    const restant = Math.max(0, gisement - contactsCumules);
    const contactsCeMois = Math.min(contactsParMois, restant);
    contactsCumules += contactsCeMois;
    comptes += contactsCeMois * tauxConversion;

    // Le portefeuille actif dépense son panier annuel, réparti selon la saisonnalité.
    const caFacture = comptes * panierAnnuel * poids;
    facturesEnAttente.push(caFacture);

    // Encaissement décalé du délai de règlement.
    const lag = Math.round(delaiEncaissement);
    const caEncaisse = i - lag >= 0 ? facturesEnAttente[i - lag] : 0;

    const marge = caEncaisse * margeBrute;
    margeCumulee += marge;
    coutCumule += coutMensuel;
    lignes.push({ i, label: MOIS[idxMois], comptes, caFacture, caEncaisse, marge, margeCumulee, coutCumule, solde: margeCumulee - coutCumule, couvertureMensuelle: coutMensuel > 0 ? marge / coutMensuel : 0 });
  }

  return {
    lignes,
    premierMoisRentable: lignes.find((l) => l.couvertureMensuelle >= 1),
    caRegimeCroisiere: Math.min(gisement, contactsCumules) * tauxConversion * panierAnnuel,
  };
}

const Bloc = ({ titre, sous, children, accent }) => (
  <div className="card" style={{ borderLeft: `3px solid ${accent || "var(--blue)"}`, marginBottom: 14 }}>
    <div className="sec-h"><h3 className="pu-display">{titre}</h3></div>
    {sous && <p style={{ margin: "-4px 0 12px", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{sous}</p>}
    {children}
  </div>
);

const Champ = ({ label, valeur, onChange, suffixe, aide, pas = 1, min = 0 }) => (
  <div className="fld" style={{ marginBottom: 12 }}>
    <label>{label}</label>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input type="number" value={valeur} min={min} step={pas} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} style={{ maxWidth: 150 }} />
      {suffixe && <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{suffixe}</span>}
    </div>
    {aide && <span style={{ display: "block", fontSize: 11, color: "var(--muted)", marginTop: 4, lineHeight: 1.45 }}>{aide}</span>}
  </div>
);

const TONS = {
  rouge: { fond: "rgba(255,90,69,.12)", texte: "var(--red)" },
  vert: { fond: "rgba(43,182,115,.12)", texte: "var(--green)" },
  jaune: { fond: "rgba(248,177,51,.15)", texte: "#8A6300" },
  bleu: { fond: "var(--blue-l)", texte: "var(--blue)" },
};

const Chiffre = ({ label, valeur, note, ton }) => {
  const c = TONS[ton] || TONS.bleu;
  return (
    <div style={{ background: c.fond, borderRadius: 10, padding: "12px 14px", flex: "1 1 170px", minWidth: 0 }}>
      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, marginBottom: 5 }}>{label}</div>
      <div className="tnum" style={{ fontSize: 21, fontWeight: 800, color: c.texte, lineHeight: 1.15 }}>{valeur}</div>
      {note && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5, lineHeight: 1.4 }}>{note}</div>}
    </div>
  );
};

/** Marge cumulée contre coût cumulé. SVG natif, aucune dépendance. */
const Courbe = ({ lignes, coutMensuel }) => {
  if (!lignes.length) return null;
  const L = 640, H = 190, mg = { t: 12, r: 12, b: 26, g: 54 };
  const max = Math.max(...lignes.map((l) => Math.max(l.margeCumulee, l.coutCumule)), coutMensuel * 6, 1);
  const x = (i) => mg.g + (i / Math.max(1, lignes.length - 1)) * (L - mg.g - mg.r);
  const y = (v) => H - mg.b - (v / max) * (H - mg.t - mg.b);
  const trace = (cle) => lignes.map((l, i) => `${i ? "L" : "M"}${x(i)},${y(l[cle])}`).join(" ");
  const croisement = lignes.find((l) => l.solde >= 0);
  return (
    <svg viewBox={`0 0 ${L} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Marge brute cumulée encaissée comparée au coût salarial cumulé">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={mg.g} x2={L - mg.r} y1={y(max * f)} y2={y(max * f)} stroke="var(--line)" strokeWidth="1" />
          <text x={mg.g - 7} y={y(max * f) + 3.5} textAnchor="end" fontSize="9.5" fill="var(--muted)">{Math.round((max * f) / 1000)}k</text>
        </g>
      ))}
      <path d={trace("coutCumule")} fill="none" stroke="var(--red)" strokeWidth="2" strokeDasharray="5 3" />
      <path d={trace("margeCumulee")} fill="none" stroke="var(--blue)" strokeWidth="2.5" />
      {croisement && (
        <g>
          <circle cx={x(croisement.i)} cy={y(croisement.margeCumulee)} r="4.5" fill="#F8B133" stroke="var(--card)" strokeWidth="1.5" />
          <text x={x(croisement.i)} y={y(croisement.margeCumulee) - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill="#8A6300">équilibre</text>
        </g>
      )}
      {lignes.map((l, i) => (i % 3 === 0 ? <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9.5" fill="var(--muted)">{l.label}</text> : null))}
    </svg>
  );
};

export default function ModeleCanalIndependants({ prospects = [], deals = [], accounts = [] }) {
  // Données observées, lues dans MITMIT. Un prospect « contacté » est un prospect sorti des statuts
  // d'entrée ; « transformé » suppose une commande réellement gagnée, pas une simple conversion en
  // fiche établissement, sans quoi le taux mesurerait la saisie et non la vente.
  const auto = useMemo(() => {
    const indeps = (prospects || []).filter((p) => TYPES_INDEP.includes(String(p.type || "")));
    const contactes = indeps.filter((p) => !STATUTS_NON_CONTACTE.has(String(p.statut || ""))).length;
    const comptesGagnes = new Set((deals || []).filter((d) => STATUTS_GAGNES.has(String(d.statut || ""))).map((d) => d.accountId).filter(Boolean));
    const transformes = indeps.filter((p) => p.accountId && comptesGagnes.has(p.accountId)).length;
    return { contactes, transformes, total: indeps.length, dispo: indeps.length > 0 };
  }, [prospects, deals]);

  const [manuel, setManuel] = useState(false);
  const [contactes, setContactes] = useState(auto.contactes || 40);
  const [transformes, setTransformes] = useState(auto.transformes || 4);
  const nContacts = manuel ? contactes : auto.contactes;
  const nTransformes = manuel ? transformes : auto.transformes;

  // Hypothèses.
  const [gisement, setGisement] = useState(2000);
  const [panierAnnuel, setPanierAnnuel] = useState(900);
  const [margeBrute, setMargeBrute] = useState(50);
  const [coutMensuel, setCoutMensuel] = useState(3100);
  const [contactsParMois, setContactsParMois] = useState(80);
  const [delaiEncaissement, setDelaiEncaissement] = useState(1.5);
  const [horizon, setHorizon] = useState(24);
  const [moisDepart, setMoisDepart] = useState(new Date().getMonth());
  const [saison, setSaison] = useState(SAISON_DEFAUT);
  const [ouvert, setOuvert] = useState(false);

  const w = useMemo(() => wilson(nTransformes, nContacts), [nTransformes, nContacts]);

  const scenarios = useMemo(() => {
    const base = { gisement, contactsParMois, contactsDejaFaits: nContacts, comptesDejaActifs: nTransformes, panierAnnuel, margeBrute: margeBrute / 100, coutMensuel, delaiEncaissement, saison, horizon, moisDepart };
    return { bas: projeter({ ...base, tauxConversion: w.bas }), central: projeter({ ...base, tauxConversion: w.p }), haut: projeter({ ...base, tauxConversion: w.haut }) };
  }, [w, gisement, contactsParMois, nContacts, nTransformes, panierAnnuel, margeBrute, coutMensuel, delaiEncaissement, saison, horizon, moisDepart]);

  // Le chiffre décisif. Le bon dénominateur n'est pas le gisement brut mais le potentiel réellement
  // convertible, gisement multiplié par le taux : démarcher 2 000 points de vente ne donne pas
  // 2 000 comptes.
  const seuil = useMemo(() => {
    const coutAnnuel = coutMensuel * 12;
    const margeParCompte = panierAnnuel * (margeBrute / 100);
    if (margeParCompte <= 0) return { comptes: Infinity, partGisement: Infinity, effortBas: Infinity, effortCentral: Infinity, effortHaut: Infinity };
    const comptes = coutAnnuel / margeParCompte;
    const effort = (taux) => { const potentiel = gisement * taux; return potentiel > 0 ? comptes / potentiel : Infinity; };
    return { comptes, partGisement: gisement > 0 ? comptes / gisement : Infinity, effortBas: effort(w.bas), effortCentral: effort(w.p), effortHaut: effort(w.haut) };
  }, [coutMensuel, panierAnnuel, margeBrute, gisement, w]);

  const verdict = useMemo(() => {
    const { effortBas, effortCentral, effortHaut } = seuil;
    if (!Number.isFinite(effortCentral)) return { ton: "rouge", texte: "Paramètres incomplets, ou aucun contact enregistré : le taux de transformation ne peut pas être estimé." };
    if (effortBas > 1 && effortHaut > 1) return { ton: "rouge", texte: "Même dans l'hypothèse la plus favorable de la fourchette, le potentiel convertible du gisement ne suffit pas à financer le poste. Sur ce canal seul, la conclusion est ferme et ne dépend plus de la performance commerciale : c'est une contrainte de taille de marché." };
    if (effortBas > 1) return { ton: "jaune", texte: "L'échantillon ne permet pas de trancher. Dans l'hypothèse basse, le canal ne peut pas financer le poste, même en démarchant la France entière. Dans l'hypothèse haute, il le peut confortablement. Ces deux mondes sont compatibles avec les mêmes données, et c'est précisément le problème : il faut plus de contacts pour resserrer la fourchette, pas plus d'analyse." };
    if (effortCentral > 0.5) return { ton: "jaune", texte: "Le canal peut financer le poste, mais en captant plus de la moitié de tout ce qui est convertible en France. Cela suppose une couverture nationale complète et plusieurs années. Réaliste pour un temps partiel, tendu pour un temps plein immédiat." };
    return { ton: "vert", texte: "Le seuil est atteignable sans hypothèse héroïque. La contrainte restante est le décalage de trésorerie entre le coût salarial mensuel et l'encaissement, pas la viabilité du canal." };
  }, [seuil]);

  const modifierSaison = (i, v) => setSaison((s) => { const n = [...s]; n[i] = Math.max(0, v); return n; });
  const equilibre = (s) => (s.premierMoisRentable ? `${s.premierMoisRentable.i + 1} mois` : "hors horizon");
  const accentVerdict = verdict.ton === "rouge" ? "var(--red)" : verdict.ton === "vert" ? "var(--green)" : "#F8B133";

  return (
    <div>
      <div className="card" style={{ marginBottom: 14, borderLeft: `3px solid ${accentVerdict}` }}>
        <div className="sec-h">
          <h3 className="pu-display">Le canal indépendant peut-il financer un poste ?</h3>
          <button className="btn btn-g btn-s" onClick={() => setOuvert((v) => !v)}>{ouvert ? "Masquer le détail" : "Voir le détail et les hypothèses"}</button>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Chiffre label="Taux de transformation observé" valeur={pct(w.p)} note={`${nTransformes} compte(s) gagné(s) sur ${nContacts} indépendant(s) contacté(s)`} />
          <Chiffre label="Fourchette réelle (95 %)" valeur={`${pct(w.bas)} à ${pct(w.haut)}`} ton="jaune" note="L'incertitude que porte réellement la donnée" />
          <Chiffre label="Comptes actifs nécessaires" valeur={Number.isFinite(seuil.comptes) ? Math.ceil(seuil.comptes).toLocaleString("fr-FR") : "—"} ton={verdict.ton} note="Pour que la marge brute annuelle couvre le coût annuel du poste" />
          <Chiffre label="Équilibre atteint en" valeur={equilibre(scenarios.central)} ton={verdict.ton} note="Scénario central, sur l'horizon retenu" />
        </div>
        <p style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 12, marginBottom: 0 }}>{verdict.texte}</p>
      </div>

      {ouvert && (<>
        <Bloc titre="1 · Données observées" sous="Reprises de MITMIT sur les prospects de type Indépendant et Spécialiste. Un prospect est « contacté » dès qu'il sort des statuts d'entrée ; il est « transformé » lorsque son compte porte une commande acceptée, expédiée ou livrée.">
          {auto.dispo && (
            <label style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12, fontSize: 12.5 }}>
              <input type="checkbox" checked={manuel} onChange={(e) => setManuel(e.target.checked)} style={{ width: 15, height: 15 }} />
              Saisir les valeurs à la main plutôt que de les lire dans MITMIT
            </label>
          )}
          {!auto.dispo && <div className="empty" style={{ marginBottom: 12 }}>Aucun prospect indépendant ou spécialiste enregistré : les valeurs ci-dessous sont saisies à la main.</div>}
          <div className="row2">
            <Champ label="Indépendants contactés" valeur={nContacts} onChange={(v) => { setManuel(true); setContactes(v); }} aide={auto.dispo ? `${auto.total} prospect(s) de ce type dans MITMIT.` : null} />
            <Champ label="Comptes transformés" valeur={nTransformes} onChange={(v) => { setManuel(true); setTransformes(v); }} aide="Un compte ayant passé au moins une commande." />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Chiffre label="Taux ponctuel" valeur={pct(w.p)} note="Ce que montre l'échantillon brut" />
            <Chiffre label="Fourchette réelle (95 %)" valeur={`${pct(w.bas)} à ${pct(w.haut)}`} ton="jaune" note={`Amplitude de ${(w.bas > 0 ? w.haut / w.bas : 0).toFixed(1)}×.`} />
          </div>
        </Bloc>

        <Bloc titre="2 · Hypothèses" sous="Chacune est discutable. Les deux qui pèsent le plus sont le gisement et le panier annuel." accent="#F8B133">
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0 18px" }}>
            <Champ label="Gisement national adressable" valeur={gisement} onChange={setGisement} pas={50} suffixe="points de vente" aide="Magasins de jouets indépendants, loisirs créatifs, papeteries diversifiées." />
            <Champ label="Panier annuel par compte actif" valeur={panierAnnuel} onChange={setPanierAnnuel} pas={50} suffixe="€ HT" aide="Première commande plus réassort de bobines et de livrets sur douze mois." />
            <Champ label="Marge brute nette de logistique" valeur={margeBrute} onChange={setMargeBrute} suffixe="%" aide="Marge produit diminuée de la préparation de commande et du transport franco." />
            <Champ label="Coût employeur mensuel" valeur={coutMensuel} onChange={setCoutMensuel} pas={100} suffixe="€ chargés" />
            <Champ label="Contacts nouveaux par mois" valeur={contactsParMois} onChange={setContactsParMois} pas={10} aide="Rythme de prospection soutenable." />
            <Champ label="Délai d'encaissement" valeur={delaiEncaissement} onChange={setDelaiEncaissement} pas={0.5} suffixe="mois" aide="30 jours fin de mois équivaut à environ 1,5 mois." />
          </div>
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Saisonnalité du réassort (part du CA annuel, en %)</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {MOIS.map((m, i) => (
                <label key={m} style={{ textAlign: "center", fontSize: 10.5, color: "var(--muted)" }}>
                  <span style={{ display: "block", marginBottom: 3 }}>{m}</span>
                  <input type="number" value={saison[i]} min={0} onChange={(e) => modifierSaison(i, parseFloat(e.target.value) || 0)} style={{ width: 50, padding: "5px 4px", textAlign: "center", fontSize: 12 }} />
                </label>
              ))}
            </div>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, lineHeight: 1.45 }}>Profil par défaut du jouet indépendant : creux estival, concentration de septembre à novembre. Hypothèse de travail, à remplacer par l'historique réel dès que douze mois seront disponibles.</p>
          </div>
          <div className="row2" style={{ marginTop: 6 }}>
            <Champ label="Horizon de projection" valeur={horizon} onChange={setHorizon} suffixe="mois" />
            <div className="fld"><label>Mois de départ</label><select value={moisDepart} onChange={(e) => setMoisDepart(parseInt(e.target.value, 10))} style={{ maxWidth: 150 }}>{MOIS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select></div>
          </div>
        </Bloc>

        <Bloc titre="3 · Le seuil décisif" sous="Le chiffre qui tranche le débat, avant toute projection." accent={accentVerdict}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Chiffre label="Comptes actifs nécessaires" valeur={Number.isFinite(seuil.comptes) ? Math.ceil(seuil.comptes).toLocaleString("fr-FR") : "—"} note="Pour couvrir le coût annuel du poste" ton={verdict.ton} />
            <Chiffre label="Marge brute par compte et par an" valeur={eur(panierAnnuel * (margeBrute / 100))} />
            <Chiffre label="Part du gisement brut" valeur={pct(seuil.partGisement, 1)} note="Trompeur seul : démarcher n'est pas convertir" />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <Chiffre label="Effort si taux bas" valeur={Number.isFinite(seuil.effortBas) ? pct(seuil.effortBas, 0) : "hors d'atteinte"} ton={seuil.effortBas > 1 ? "rouge" : "jaune"} note="Part du potentiel convertible à capter" />
            <Chiffre label="Effort si taux central" valeur={Number.isFinite(seuil.effortCentral) ? pct(seuil.effortCentral, 0) : "hors d'atteinte"} ton={seuil.effortCentral > 1 ? "rouge" : seuil.effortCentral > 0.5 ? "jaune" : "vert"} note="Part du potentiel convertible à capter" />
            <Chiffre label="Effort si taux haut" valeur={Number.isFinite(seuil.effortHaut) ? pct(seuil.effortHaut, 0) : "hors d'atteinte"} ton={seuil.effortHaut > 1 ? "rouge" : "vert"} note="Part du potentiel convertible à capter" />
          </div>
        </Bloc>

        <Bloc titre="4 · Projection" sous="Marge brute encaissée cumulée contre coût salarial cumulé, scénario central.">
          <Courbe lignes={scenarios.central.lignes} coutMensuel={coutMensuel} />
          <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--muted)", marginTop: 4, marginBottom: 14 }}>
            <span><span style={{ display: "inline-block", width: 16, height: 2, background: "var(--blue)", verticalAlign: "middle", marginRight: 5 }} />Marge brute cumulée</span>
            <span><span style={{ display: "inline-block", width: 16, height: 2, background: "var(--red)", verticalAlign: "middle", marginRight: 5 }} />Coût salarial cumulé</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead><tr><th style={{ textAlign: "left" }}>Scénario</th><th style={{ textAlign: "right" }}>Taux retenu</th><th style={{ textAlign: "right" }}>CA régime de croisière</th><th style={{ textAlign: "right" }}>Équilibre mensuel atteint en</th></tr></thead>
              <tbody>
                {[["Borne basse", w.bas, scenarios.bas], ["Central", w.p, scenarios.central], ["Borne haute", w.haut, scenarios.haut]].map(([nom, taux, s], i) => (
                  <tr key={nom} style={{ background: i === 1 ? "rgba(248,177,51,.12)" : "transparent" }}>
                    <td style={{ fontWeight: i === 1 ? 800 : 400 }}>{nom}</td>
                    <td className="tnum" style={{ textAlign: "right" }}>{pct(taux)}</td>
                    <td className="tnum" style={{ textAlign: "right" }}>{eur(s.caRegimeCroisiere)}</td>
                    <td className="tnum" style={{ textAlign: "right" }}>{equilibre(s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 12, marginBottom: 0, lineHeight: 1.55 }}>L'écart entre borne basse et borne haute est la vraie information de ce tableau. Tant qu'il reste large, aucune décision ne peut s'appuyer sur le scénario central seul. Il se resserre en augmentant le nombre de contacts, pas en affinant les hypothèses.</p>
        </Bloc>

        <Bloc titre="5 · Ce que le modèle ne dit pas" accent="var(--muted)">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7 }}>
            <li>Il suppose qu'un compte transformé reste actif. L'attrition de première année sur le commerce indépendant est réelle et n'est pas modélisée.</li>
            <li>Il ignore les impayés. Sur ce canal, provisionner deux à trois pour cent du chiffre d'affaires est prudent.</li>
            <li>Il attribue au canal indépendant la totalité du coût du poste. Si ce poste couvre d'autres missions, le seuil réel est plus bas.</li>
            <li>Le taux de transformation observé sur les premiers contacts est presque toujours supérieur au taux à l'échelle : les cibles les plus faciles ont été traitées en premier.</li>
          </ul>
        </Bloc>
      </>)}
    </div>
  );
}
