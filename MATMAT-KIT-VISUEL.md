# MATMAT — Kit visuel repris de MITMIT

Les **30 meilleures fonctionnalités visuelles** de MITMIT, extraites du code réel
(`index.html`, `src/App.jsx`, `public/manifest.webmanifest`, `public/sw.js`), avec le
code à copier tel quel dans MATMAT.

**Mode d'emploi** : ouvrez Claude Code dans le dépôt MATMAT et donnez-lui ce fichier.
Chaque fiche est autonome : l'effet obtenu, le code, et ce qu'il faut renommer.

**À renommer partout** : `MITMIT` → `MATMAT`, `pu-root` → `mm-root`, `pu-display` →
`mm-display`, `PEN'UP 3D` → la marque de MATMAT. Les couleurs `--blue/--yellow/--red`
sont la charte PEN'UP : remplacez les hex, gardez les rôles.

---

## Table des 30

| # | Fonctionnalité | Type |
|---|---|---|
| 1 | Jetons de design (couleurs, typo, chiffres tabulaires) | Socle |
| 2 | Fond à halos radiaux superposés | Socle |
| 3 | 21 thèmes de fond (unis, dégradés, conique) | Thème |
| 4 | 14 motifs SVG tuilés en arrière-plan | Thème |
| 5 | Accent automatique accordé au fond | Thème |
| 6 | Mode sombre à voile calculé (contraste WCAG garanti) | Thème |
| 7 | Sélecteur de thème (couleur × motif × accent) | Thème |
| 8 | Verre liquide (liquid glass) | Surface |
| 9 | Micro-trame de points sur le contenu | Surface |
| 10 | Barre latérale collante, et les deux emplacements de logo | Structure |
| 11 | L'horloge météo intégrée | Structure |
| 12 | Navigation groupée, item actif en dégradé, compteurs | Structure |
| 13 | Famille complète de boutons (7 variantes) | Contrôle |
| 14 | Micro-interactions au survol (lift, scale, reflet balayant) | Animation |
| 15 | Frétillement d'icône + secousse d'alerte | Animation |
| 16 | Chiffres qui s'épaississent au survol | Animation |
| 17 | Tuiles d'indicateur : apparition en cascade + compteur animé | Donnée |
| 18 | Squelettes scintillants au démarrage à froid | Chargement |
| 19 | Écran de démarrage en HTML/CSS pur (avant React) | Chargement |
| 20 | Gerbe de confettis « filaments » au clic | Plaisir |
| 21 | Palette de commandes ⌘K | Navigation |
| 22 | Carte d'aperçu au survol prolongé (650 ms) | Info |
| 23 | Infobulles riches en portail, bornées à l'écran | Info |
| 24 | Fenêtres modales (voile flouté + entrée « pop ») | Info |
| 25 | Assistant flottant à mascotte | Assistant |
| 26 | Pastilles d'état (synchro, tâches IA) | Feedback |
| 27 | Kanban : colonnes en verre + barre de défilement dessinée | Donnée |
| 28 | Entonnoir animé ⇄ camembert, effet « pile de cartes » | Donnée |
| 29 | Impression professionnelle (document + rapport) | Sortie |
| 30 | Accessibilité, responsive et PWA | Fondation |

---

## 1. Jetons de design

**L'effet** : une charte tenue par des variables CSS, deux polices (une d'affichage à
fort caractère, une de lecture), et des chiffres qui ne dansent pas.

```css
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

:root{
  --blue:#3F60AA; --blue-d:#2f4c86; --blue-l:#eef2fb;
  --yellow:#FFD212; --yellow-d:#F8B133; --orange:#F8B133;
  --red:#FF5A45; --red-mid:#E94D44; --red-d:#CD2A24; --red-l:#ffe9e5;
  --cream:#FFF8EA; --green:#2bb673; --amber:#F8B133;
  --ink:#16203a; --muted:#5b6478; --bg:#fff8ea; --card:#fff; --line:#ece3d2;
}
*{box-sizing:border-box;}
html,body,#root{margin:0;padding:0;}
body{background:var(--bg);}
.mm-root{font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:var(--ink);min-height:100vh;display:flex;font-size:14px;}
.mm-display{font-family:'Bricolage Grotesque','Plus Jakarta Sans',sans-serif;letter-spacing:-.01em;}
.tnum{font-variant-numeric:tabular-nums;}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px;box-shadow:0 1px 2px rgba(20,32,58,.04);}
```

**Pourquoi c'est bon** : `.tnum` sur tout chiffre affiché empêche la largeur de varier
quand une valeur change (compteurs, montants, horloge). `.mm-display` réserve la police
à caractère aux titres et aux nombres : le corps de texte reste lisible.

**Pour MATMAT** : gardez la structure `--ink / --muted / --bg / --card / --line`, c'est
elle qui rend le mode sombre trivial (voir #6).

---

## 2. Fond à halos radiaux superposés

**L'effet** : trois halos de couleur très dilués aux angles de la page. Un aplat uni
paraît plat ; ces halos donnent de la profondeur sans jamais gêner la lecture.

```css
.mm-root{
  background:
    radial-gradient(1100px 560px at 100% -8%, rgba(63,96,170,.10), transparent 55%),
    radial-gradient(900px 520px at -8% 6%, rgba(255,210,18,.22), transparent 55%),
    radial-gradient(820px 520px at 112% 116%, rgba(255,90,69,.14), transparent 55%),
    var(--bg);
}
.mm-root.dark{
  background:
    radial-gradient(1100px 560px at 100% -8%, rgba(63,96,170,.16), transparent 55%),
    radial-gradient(900px 520px at -8% 6%, rgba(255,210,18,.05), transparent 55%),
    radial-gradient(820px 520px at 112% 116%, rgba(255,90,69,.06), transparent 55%),
    var(--bg);
}
```

**Règle** : en sombre, les halos chauds descendent à 5-6 % d'opacité. Au-delà, ils virent
au sale.

---

## 3. Vingt-et-un thèmes de fond

**L'effet** : l'utilisateur choisit son fond, uni, dégradé linéaire, radial ou conique.
Chaque thème déclare sa couleur de trait (`stroke`, pour le motif de #4), une couleur
unie de repli (`meta`, pour `<meta name="theme-color">` qui n'accepte pas les dégradés),
et s'il est sombre.

```js
const THEME_COLORS = [
  { id:"cream",    label:"Crème",        bg:"#fff8ea", stroke:"#FF5A45", dark:false },
  { id:"plain",    label:"Gris clair",   bg:"#f4f6fb", stroke:"#cfd8ea", dark:false },
  { id:"sage",     label:"Vert sauge",   bg:"#eaf2e6", stroke:"#6fa564", dark:false },
  { id:"mint",     label:"Menthe",       bg:"#e2f3ec", stroke:"#3fb68a", dark:false },
  { id:"peach",    label:"Pêche",        bg:"#fdeadf", stroke:"#e8916b", dark:false },
  { id:"lavender", label:"Lavande",      bg:"#efeafb", stroke:"#9b87d4", dark:false },
  { id:"cottoncandy", label:"Barbe à papa", bg:"linear-gradient(135deg,#ffe3f1 0%,#e7ecff 55%,#e0fbff 100%)", meta:"#f1e6fb", stroke:"#c98fc4", dark:false },
  { id:"peachsky", label:"Ciel pêche",   bg:"radial-gradient(120% 120% at 20% 0%,#fff3da 0%,#ffd9c0 45%,#ffbcd0 100%)", meta:"#ffd0c4", stroke:"#e6896f", dark:false },
  { id:"mintglow", label:"Halo menthe",  bg:"radial-gradient(120% 120% at 80% 10%,#f3fff6 0%,#cdf6e2 45%,#a7e8df 100%)", meta:"#bdeede", stroke:"#3fa78a", dark:false },
  { id:"yellow",   label:"Jaune",        bg:"#FFD212", stroke:"#3F60AA", dark:false },
  { id:"blue",     label:"Bleu",         bg:"#3F60AA", stroke:"#ffffff", dark:true },
  { id:"red",      label:"Rouge",        bg:"#FF5A45", stroke:"#ffffff", dark:true },
  { id:"forest",   label:"Vert forêt",   bg:"#1f5e44", stroke:"#3a7d60", dark:true },
  { id:"plum",     label:"Prune",        bg:"#5b3a6e", stroke:"#7d5a90", dark:true },
  { id:"midnight", label:"Bleu nuit",    bg:"#1b2440", stroke:"#34406b", dark:true },
  { id:"sunset",   label:"Coucher de soleil", bg:"linear-gradient(135deg,#ff9a5a 0%,#ff5a8c 50%,#a84bd6 100%)", meta:"#ff6f8b", stroke:"rgba(255,255,255,.85)", dark:true },
  { id:"ocean",    label:"Océan",        bg:"linear-gradient(160deg,#1fb6c9 0%,#2f6fd0 55%,#2a3b8f 100%)", meta:"#2a72c4", stroke:"rgba(255,255,255,.8)", dark:true },
  { id:"aurora",   label:"Aurore",       bg:"linear-gradient(150deg,#0f2a4a 0%,#1f6e6a 45%,#3fae8e 75%,#7be0a8 100%)", meta:"#1f6e6a", stroke:"rgba(255,255,255,.78)", dark:true },
  { id:"grape",    label:"Raisin",       bg:"linear-gradient(150deg,#3a1c5e 0%,#6a2fa0 55%,#b94bd6 100%)", meta:"#6e35a2", stroke:"rgba(255,255,255,.82)", dark:true },
  { id:"ember",    label:"Braise",       bg:"radial-gradient(130% 130% at 15% 15%,#ffae3b 0%,#ff5a45 45%,#a01f3c 100%)", meta:"#e6452f", stroke:"rgba(255,255,255,.85)", dark:true },
  { id:"steel",    label:"Acier",        bg:"conic-gradient(from 220deg at 30% 20%,#2c3550 0%,#3f4f7a 30%,#23304f 60%,#1a2238 100%)", meta:"#2b3656", stroke:"rgba(255,255,255,.72)", dark:true },
];
```

Le thème s'applique par une classe sur la racine : `class="mm-root color-ocean pat-dots acc-auto"`.
Le CSS est **généré** au chargement (une règle par thème), pas écrit à la main.

**Le détail qui compte** : sur un fond foncé en mode clair, tout le texte hors carte
passe en blanc, mais **redevient sombre à l'intérieur des cartes**. Sans cette règle, un
thème « Bleu » rend les formulaires illisibles.

```js
// Texte clair hors carte sur les fonds foncés, sombre dans les surfaces claires.
const DARK_BG_TEXT = THEME_COLORS.filter(c=>c.dark).map(c=>`
.mm-root.color-${c.id}:not(.dark) .main{color:#fff;--ink:#fff;--muted:rgba(255,255,255,.82);--line:rgba(255,255,255,.30);text-shadow:0 1px 2px rgba(0,0,0,.22);}
.mm-root.color-${c.id}:not(.dark) .main .card,.mm-root.color-${c.id}:not(.dark) .modal,.mm-root.color-${c.id}:not(.dark) .main input,.mm-root.color-${c.id}:not(.dark) .main select,.mm-root.color-${c.id}:not(.dark) .main textarea{color:var(--ink);--ink:#16203a;--muted:#5b6478;--line:#ece3d2;text-shadow:none;}
`).join("");
```

---

## 4. Quatorze motifs SVG tuilés

**L'effet** : un motif discret répété derrière tout le contenu — tirets, pois, étoiles,
quadrillage, confettis, vagues, nid d'abeille, chevrons, croix, écailles, bulles, lignes
obliques, Memphis. Chaque motif est une **fonction** qui reçoit une couleur et renvoie un
`data:` SVG : il se reteinte automatiquement selon le fond choisi.

```js
const svgUrl = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

const dotsSVG   = (c) => svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='54' height='54'><circle cx='9' cy='9' r='2.4' fill='${c}'/><circle cx='36' cy='27' r='2.4' fill='${c}'/></svg>`);
const gridSVG   = (c) => svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><path d='M44 0H0v44' fill='none' stroke='${c}' stroke-width='1'/></svg>`);
const wavesSVG  = (c) => svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='80' height='44'><path d='M0 22c10-14 30-14 40 0s30 14 40 0' fill='none' stroke='${c}' stroke-width='2'/></svg>`);
const chevronSVG= (c) => svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='40' height='24'><path d='M0 18L10 6l10 12L30 6l10 12' fill='none' stroke='${c}' stroke-width='2'/></svg>`);
// … dashSVG, starsSVG, triSVG, honeycombSVG, crossSVG, scalesSVG, bubblesSVG, diagLinesSVG, memphisSVG

const THEME_PATTERNS = [
  { id:"none",      label:"Aucun",           fn:null },
  { id:"dash",      label:"Tirets",          fn:dashSVG,      size:"24px 16px",     op:.42 },
  { id:"memphis",   label:"Memphis",         fn:memphisSVG,   size:"220px 220px",   op:.60 },
  { id:"dots",      label:"Pois",            fn:dotsSVG,      size:"54px 54px",     op:.40 },
  { id:"stars",     label:"Étoiles",         fn:starsSVG,     size:"120px 120px",   op:.32 },
  { id:"grid",      label:"Quadrillage",     fn:gridSVG,      size:"44px 44px",     op:.60 },
  { id:"tri",       label:"Confettis",       fn:triSVG,       size:"110px 110px",   op:.45 },
  { id:"waves",     label:"Vagues",          fn:wavesSVG,     size:"80px 44px",     op:.50 },
  { id:"honeycomb", label:"Nid d'abeille",   fn:honeycombSVG, size:"27.71px 48px",  op:.40 },
  { id:"chevron",   label:"Chevrons",        fn:chevronSVG,   size:"40px 24px",     op:.42 },
  { id:"cross",     label:"Croix",           fn:crossSVG,     size:"48px 48px",     op:.45 },
  { id:"scales",    label:"Écailles",        fn:scalesSVG,    size:"48px 48px",     op:.40 },
  { id:"bubbles",   label:"Bulles",          fn:bubblesSVG,   size:"90px 90px",     op:.40 },
  { id:"diaglines", label:"Lignes obliques", fn:diagLinesSVG, size:"24px 24px",     op:.40 },
];
```

Le motif est peint par un pseudo-élément **fixe** sous tout le contenu :

```css
.mm-root::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;background-repeat:repeat;}
.mm-root.dark::before{opacity:.2;}
```

Et la génération CSS, une règle par couple couleur × motif :

```js
const THEME_BG_CSS = THEME_COLORS.map((c) =>
  `.mm-root.color-${c.id}:not(.dark){background:${c.bg};}` +
  THEME_PATTERNS.filter(p=>p.fn).map(p =>
    `.mm-root.color-${c.id}:not(.dark).pat-${p.id}::before{background-image:${p.fn(c.stroke)};background-size:${p.size};opacity:${p.op};}`
  ).join("")
).join("\n")
// En sombre, le motif est retracé en blanc translucide pour rester visible.
+ "\n" + THEME_PATTERNS.filter(p=>p.fn).map(p =>
  `.mm-root.dark.pat-${p.id}::before{background-image:${p.fn("rgba(255,255,255,.62)")};background-size:${p.size};opacity:${p.op};}`
).join("\n");
```

---

## 5. Accent automatique accordé au fond

**L'effet** : la couleur des boutons de la barre du haut et des filtres actifs est
choisie **pour ressortir sur le fond en place** — jaune sur fond foncé, bleu sur fond
jaune, corail sur fond clair. L'utilisateur peut aussi forcer un accent.

```js
const AUTO_ACCENT_BY_BG = {
  cream:{c:"#FF5A45",cd:"#cd2a24",t:"#fff"},    plain:{c:"#3F60AA",cd:"#2c4582",t:"#fff"},
  sage:{c:"#E25A4D",cd:"#c23e32",t:"#fff"},     mint:{c:"#0EA5A4",cd:"#0b8281",t:"#fff"},
  peach:{c:"#E94D6B",cd:"#cc2f4f",t:"#fff"},    lavender:{c:"#7c5cf0",cd:"#5f3fd0",t:"#fff"},
  yellow:{c:"#3F60AA",cd:"#2c4582",t:"#fff"},   blue:{c:"#FFD212",cd:"#dcae00",t:"#16203a"},
  red:{c:"#FFD212",cd:"#dcae00",t:"#16203a"},   forest:{c:"#F8B133",cd:"#dc9412",t:"#16203a"},
  plum:{c:"#FFD212",cd:"#dcae00",t:"#16203a"},  midnight:{c:"#38bdf8",cd:"#0ea5e9",t:"#06283a"},
  sunset:{c:"#21d4b4",cd:"#13b39a",t:"#08312a"},ocean:{c:"#F8B133",cd:"#dc9412",t:"#16203a"},
  aurora:{c:"#ff6f8b",cd:"#e84f6e",t:"#fff"},   grape:{c:"#FFD212",cd:"#dcae00",t:"#16203a"},
  ember:{c:"#22d3c4",cd:"#12b3a6",t:"#06302b"}, steel:{c:"#38bdf8",cd:"#0ea5e9",t:"#06283a"},
};

const AUTO_ACCENT_CSS = THEME_COLORS.map((c) => {
  const a = AUTO_ACCENT_BY_BG[c.id];
  return `.mm-root.acc-auto.color-${c.id} .topbar .btn-ghost{background:${a.c};color:${a.t};border-color:${a.cd};}
.mm-root.acc-auto.color-${c.id} .topbar .btn-ghost:hover{background:${a.cd};border-color:${a.cd};}
.mm-root.acc-auto.color-${c.id} .main .chip.on{background:${a.c};color:${a.t};border-color:${a.cd};}`;
}).join("\n");
```

Quatorze accents manuels sont proposés en plus, dont trois **dégradés** :

```js
{ id:"gradsun",   label:"Dégradé soleil", c:"linear-gradient(135deg,#ff8a4c,#ff4d8d)", cd:"#e23d72", t:"#fff" },
{ id:"gradocean", label:"Dégradé océan",  c:"linear-gradient(135deg,#2bb6c9,#2f6fd0)", cd:"#2a5fb0", t:"#fff" },
{ id:"gradgold",  label:"Dégradé or",     c:"linear-gradient(135deg,#FFD212,#F8B133)", cd:"#dc9412", t:"#16203a" },
```

---

## 6. Mode sombre à voile calculé (le plus malin du lot)

**Le problème** : en sombre, on veut garder le fond choisi visible. Un voile noir fixe à
80 % éteint complètement les dégradés des thèmes déjà sombres.

**La solution** : pour chaque thème, on calcule le voile **le plus léger** qui garde le
texte au-dessus du seuil WCAG AA (4,5:1), en simulant le pire cas — une tuile translucide
à 42 % posée sur le fond voilé. Un thème ajouté plus tard obtient son voile tout seul.

```js
const VOILE_RVB  = [9, 13, 24];
const DARK_INK   = [232, 237, 245], DARK_MUTED = [148, 160, 184];
const DARK_TUILE = [38, 50, 74], DARK_TUILE_A = 0.42;

const lumRelative = ([r,g,b]) => { const f=(v)=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);}; return .2126*f(r)+.7152*f(g)+.0722*f(b); };
const contrasteRvb = (a,b) => { const x=lumRelative(a), y=lumRelative(b); const h=Math.max(x,y), l=Math.min(x,y); return (h+.05)/(l+.05); };
const melangeRvb = (dessus,alpha,dessous) => dessus.map((v,i)=>alpha*v+(1-alpha)*dessous[i]);
const hexRvb = (h) => [1,3,5].map(i=>parseInt(h.slice(i,i+2),16));

function voileSombre(bg){
  const teintes = (String(bg).match(/#[0-9a-fA-F]{6}/g)||[]).map(hexRvb);
  if(!teintes.length) return .8;
  const lisible = (a) => teintes.every((t)=>{
    const fond = melangeRvb(DARK_TUILE, DARK_TUILE_A, melangeRvb(VOILE_RVB, a, t));
    return contrasteRvb(DARK_INK, fond) >= 4.5 && contrasteRvb(DARK_MUTED, fond) >= 4.5;
  });
  for(let a=15; a<=90; a++) if(lisible(a/100)) return a/100;
  return .9;
}

// Une couleur unie doit devenir une IMAGE pour s'empiler sous le voile.
const bgEnImage = (bg) => (/gradient\(/.test(bg) ? bg : `linear-gradient(${bg},${bg})`);
// .mm-root.dark.color-X { background: linear-gradient(rgba(9,13,24,V),rgba(9,13,24,V)), <bgEnImage>; background-attachment:fixed; }
```

La palette sombre elle-même :

```css
.mm-root.dark{--ink:#e8edf5;--muted:#94a0b8;--bg:#0e1422;--card:#171f33;--line:#28324a;--blue-l:#1d2945;}
/* Transition douce au changement de thème */
.card,.cmdk,.topbar,.sb,.col,.cal-cell,.kpi,.main{transition:background-color .32s ease,border-color .32s ease,color .28s ease;}
```

---

## 7. Sélecteur de thème

**L'effet** : un bouton palette ouvre un panneau à trois sections — une grille de
pastilles de couleur 6 colonnes (chaque pastille **peinte avec son propre fond**, dégradé
compris), une liste de motifs avec **vignette d'aperçu du motif réel**, et des puces
d'accent avec pastille ronde (l'accent « auto » est une roue conique).

```jsx
function ThemeMenu({ color, pattern, accent, onColor, onPattern, onAccent }) {
  const [open, setOpen] = useState(false);
  return (<div style={{position:"relative"}}>
    <button className="btn btn-ghost btn-s" onClick={()=>setOpen(o=>!o)} title="Thème"><Palette size={15}/></button>
    {open && (<>
      <div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,zIndex:40}}/>
      <div style={{position:"absolute",right:0,top:"calc(100% + 6px)",zIndex:50,background:"var(--card)",border:"1px solid var(--line)",borderRadius:12,boxShadow:"0 12px 30px rgba(20,32,58,.18)",padding:10,width:260,maxHeight:"78vh",overflowY:"auto"}}>

        <div style={{gridTemplateColumns:"repeat(6,1fr)",display:"grid",gap:6}}>
          {THEME_COLORS.map(c=>(
            <button key={c.id} onClick={(e)=>{burstConfetti(e.clientX,e.clientY);onColor(c.id);}} title={c.label}
              style={{width:"100%",aspectRatio:"1 / 1",borderRadius:8,cursor:"pointer",background:c.bg,
                border:color===c.id?"2px solid var(--blue)":"1px solid var(--line)",
                boxShadow:color===c.id?"0 0 0 2px var(--blue-l)":"none",display:"grid",placeItems:"center"}}>
              {color===c.id && <CheckCircle2 size={14} color={c.dark?"#fff":"#16203a"}/>}
            </button>))}
        </div>

        {THEME_PATTERNS.map(p=>(
          <button key={p.id} onClick={()=>onPattern(p.id)} style={{/* … */}}>
            {/* vignette : le motif lui-même, à l'échelle */}
            <span style={{width:22,height:22,borderRadius:6,border:"1px solid var(--line)",
              background: p.fn ? `#fff ${p.fn("#5b6478")}` : "#fff",
              backgroundSize: p.fn ? "22px 22px" : undefined, backgroundRepeat:"repeat"}}/>
            {p.label}
          </button>))}

        {THEME_ACCENTS.map(a=>(
          <button key={a.id} onClick={()=>onAccent(a.id)} title={a.label} style={{/* puce arrondie */}}>
            <span style={{width:14,height:14,borderRadius:"50%",border:"1px solid var(--line)",
              background: a.c || "conic-gradient(#3F60AA,#FFD212,#FF5A45,#2bb673,#7c5cf0,#3F60AA)"}}/>
            {a.label}
          </button>))}
      </div></>)}
  </div>);
}
```

---

## 8. Verre liquide (liquid glass)

**L'effet** : cartes, boutons secondaires, pastilles de filtre et colonnes deviennent des
panneaux translucides qui laissent transparaître le motif de fond en flou, avec un reflet
spéculaire en haut. C'est ce qui fait tenir les 21 thèmes ensemble.

```css
.glass{
  background:rgba(255,255,255,.5)!important;
  -webkit-backdrop-filter:blur(22px) saturate(185%);
  backdrop-filter:blur(22px) saturate(185%);
  border:1px solid rgba(255,255,255,.6);
  box-shadow:0 8px 30px rgba(20,32,58,.12),
             inset 0 1px 0 rgba(255,255,255,.72),
             inset 0 -1px 1px rgba(255,255,255,.18);
  position:relative;
}
/* Reflet spéculaire sur le haut de la surface */
.glass::after{content:"";position:absolute;inset:0 0 auto 0;height:42%;
  background:linear-gradient(180deg,rgba(255,255,255,.5),rgba(255,255,255,0));
  pointer-events:none;opacity:.55;z-index:0;border-radius:inherit;}
.glass>*{position:relative;z-index:1;}

/* Version allégée pour les contrôles */
.glass-ctl{-webkit-backdrop-filter:blur(12px) saturate(155%);backdrop-filter:blur(12px) saturate(155%);}

.mm-root.dark .glass{background:rgba(23,31,51,.5)!important;border-color:rgba(255,255,255,.12);
  box-shadow:0 8px 30px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.09);}
.mm-root.dark .glass::after{background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,0));opacity:.6;}
```

**Le réglage clé** : `saturate(155-185%)` en plus du flou. Sans la saturation, le verre
paraît gris et mort.

---

## 9. Micro-trame de points

**L'effet** : une trame de points à 2,8 % d'opacité sur la zone de contenu. Invisible
consciemment, elle enlève l'aspect « page blanche vide ».

```css
.main{flex:1;min-width:0;padding:26px 30px 60px;position:relative;z-index:1;}
.main::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;
  background-image:radial-gradient(currentColor 0.5px, transparent 0.6px);
  background-size:22px 22px;opacity:.028;}
```

`currentColor` : la trame suit automatiquement la couleur du texte, donc le mode sombre.

---

## 10. Barre latérale collante, et les deux emplacements de logo

**L'effet** : la barre reste en place au défilement et porte **deux logos, à deux endroits qui ne
disent pas la même chose**.

- **En haut, le logo du logiciel.** C'est l'outil qu'on ouvre, il se présente en premier : vignette
  carrée, filet de marque, nom, et sous-titre développant le sigle.
- **Tout en bas, le logo de l'entreprise**, cliquable vers son site. Il ne signe pas l'outil, il
  signe le propriétaire. Il est poussé en bas par `margin-top:auto`, donc collé au pied de la barre
  quelle que soit la longueur du menu — et jamais au milieu de la navigation.

```css
.sb{width:240px;flex:0 0 240px;padding:22px 16px;position:sticky;top:0;height:100vh;
  display:flex;flex-direction:column;gap:6px;              /* colonne flex : indispensable au margin-top:auto */
  background:linear-gradient(180deg,#fffdf8,#fffaf0);
  border-right:1px solid var(--line);overflow-y:auto;z-index:2;}
.mm-root.dark .sb{background:linear-gradient(180deg,#181f34,#141a2c);}

/* --- Emplacement 1 : le logo du logiciel, en haut --- */
.brand{display:flex;flex-direction:column;align-items:flex-start;gap:9px;padding:2px 6px 16px;}
.brand-accent{height:5px;width:100%;border-radius:6px;border:1px solid rgba(22,32,58,.10);
  background:linear-gradient(90deg,var(--blue) 0 33.33%,#ffffff 33.33% 66.66%,var(--red) 66.66% 100%);}
.brand small{color:var(--muted);font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;}

/* --- Emplacement 2 : le logo de l'entreprise, en pied --- */
.sb-brandfoot{margin-top:auto;padding:6px 8px 12px;display:block;}   /* auto = mange tout l'espace libre */
.sb-brandfoot img{width:100%;max-width:160px;height:auto;display:block;margin:0 auto;transition:opacity .15s;}
.sb-brandfoot:hover img{opacity:.78;}                                 /* seul indice qu'il est cliquable */
.sb-foot{padding:12px 8px 0;border-top:1px solid var(--line);color:var(--muted);font-size:11px;}
```

Le balisage, dans l'ordre exact où les blocs se succèdent — c'est cet ordre qui produit le placement :

```jsx
<aside className="sb">
  {/* 1 · logo du logiciel */}
  <div className="brand">
    <img src="/logo-matmat.png" alt="MATMAT"
      style={{ width: 88, height: 88, maxWidth: 88, borderRadius: 20, alignSelf: "center" }} />
    <div className="brand-accent" />
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <small style={{ letterSpacing: ".12em" }}>MATMAT · Poste de pilotage</small>
      <span style={{ fontSize: 9.5, color: "var(--muted)", fontWeight: 600, lineHeight: 1.3,
        textTransform: "none", letterSpacing: 0 }} title="Le petit nom du logiciel">
        Module d'Analyse, Tarification, Marges &amp; Traitement</span>
    </div>
  </div>

  <SidebarStatus />          {/* 2 · horloge météo, cf. #11 */}
  <nav className="nav">…</nav>

  {/* 3 · logo de l'entreprise, poussé en bas par margin-top:auto */}
  <a className="sb-brandfoot" href="https://exemple.com" target="_blank" rel="noreferrer"
     title="Ouvrir le site exemple.com">
    <img src="/logo-entreprise.png" alt="Nom de l'entreprise — exemple.com" />
  </a>

  <div className="sb-foot">Raison sociale · Ville<br />Mention légale courte.</div>
</aside>
```

**Deux règles de placement à ne pas perdre.**

`margin-top:auto` ne fonctionne que si `.sb` est un conteneur flex en colonne. C'est ce qui rend le
placement robuste : ajoutez dix entrées de menu, le logo reste en bas ; retirez-en huit, il y reste
aussi. Une marge fixe aurait demandé un réglage à chaque changement de menu.

`rel="noreferrer"` sur le lien externe, toujours — avec `target="_blank"`, son absence donne à la
page ouverte une référence sur la vôtre.

**Où loger le fichier du logo.** Deux stratégies, et le choix se fait sur une seule question : *qui
doit le lire ?*

| Besoin | Où | Pourquoi |
|---|---|---|
| Uniquement l'interface | fichier dans `public/`, appelé par son URL | le navigateur le met en cache, il ne pèse pas sur le bundle |
| Interface **et** serveur (documents imprimés, page publique, e-mail) | module partagé exportant une **data URI base64** | une seule source ; le recopier figerait deux versions du même logo |

```js
// lib/logoEntreprise.js — lisible des DEUX côtés : le bundle de l'interface ET le code serveur.
// Une image référencée par URL ne convient pas ici : un document généré côté serveur, ou un PDF
// imprimé, n'a pas de contexte de page pour la résoudre.
export const LOGO_DATA_URI = "data:image/png;base64,iVBORw0KGgo…";
```

**Piège évité, noté dans le code source** : ne jamais passer la barre en `position:fixed` pour la
faire flotter — cela lui crée un contexte d'empilement qui la place devant les menus surgissants de
la barre du haut. `sticky` + `z-index:2` suffit.

---

## 11. L'horloge météo intégrée

**L'effet** : en haut de la barre latérale, l'heure qui avance à la seconde, la date en toutes
lettres, et la météo du lieu où l'on se trouve avec son émoji. Aucune interaction, aucune clé d'API,
aucun réglage — et l'écran cesse d'avoir l'air d'une capture figée.

```css
.sb-status{margin:2px 6px 12px;padding:10px 12px;border-radius:13px;
  background:linear-gradient(135deg,rgba(63,96,170,.12),rgba(255,210,18,.10));
  border:1px solid var(--line);}
.sb-status-time{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:23px;line-height:1;color:var(--ink);}
.sb-status-date{font-size:11.5px;color:var(--muted);text-transform:capitalize;margin-top:3px;}
.sb-status-weather{font-size:12px;color:var(--ink);font-weight:700;margin-top:7px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
```

Le composant complet, à copier tel quel :

```jsx
// Volet d'état en haut du menu latéral : heure (vivante), date et météo locale.
// Open-Meteo, gratuit et sans clé. La géolocalisation est FACULTATIVE : refusée, indisponible ou
// laissée sans réponse, on retombe sur une position par défaut et la météo s'affiche quand même.
function SidebarStatus() {
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState(null);      // { temp, code }

  // 1 · l'heure, une fois par seconde.
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  // 2 · la météo, une fois localisé, puis toutes les 30 minutes.
  useEffect(() => {
    let cancelled = false, coords = null, timer = null, fbTimer = null;
    const load = async () => {
      if (!coords) return;
      try {
        const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=" + coords.lat
          + "&longitude=" + coords.lon + "&current=temperature_2m,weather_code");
        const d = await r.json();
        if (!cancelled && d && d.current)
          setWeather({ temp: Math.round(d.current.temperature_2m), code: d.current.weather_code });
      } catch (e) {}                                  // pas de réseau : le bandeau reste sur « météo… »
    };
    const start = (lat, lon) => {
      if (cancelled) return;
      if (fbTimer) { clearTimeout(fbTimer); fbTimer = null; }
      coords = { lat, lon }; load(); timer = setInterval(load, 1800000);   // 30 min
    };
    const fallback = () => start(48.8566, 2.3522);    // repli : capitale du pays
    try {
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => start(pos.coords.latitude, pos.coords.longitude),
          () => fallback(),                            // refus explicite
          { timeout: 6000, maximumAge: 1800000 });
        // SECOND repli, celui qu'on oublie : l'invite de géolocalisation peut rester à l'écran sans
        // réponse — ni acceptée, ni refusée. Aucun des deux rappels ci-dessus ne se déclenche alors,
        // et la météo n'arriverait jamais. Au bout de 7 s, on part sur la position par défaut.
        fbTimer = setTimeout(() => { if (!coords && !cancelled) fallback(); }, 7000);
      } else fallback();
    } catch (e) { fallback(); }
    return () => { cancelled = true; if (timer) clearInterval(timer); if (fbTimer) clearTimeout(fbTimer); };
  }, []);

  const time = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const w = weather ? wmoMeta(weather.code) : null;
  return (<div className="sb-status">
    <div className="sb-status-time tnum">{time}</div>          {/* tnum : l'heure ne tressaute pas */}
    <div className="sb-status-date">{date}</div>
    {weather
      ? <div className="sb-status-weather" title={w.l}>{w.e} {weather.temp}°C{w.l ? " · " + w.l : ""}</div>
      : <div className="sb-status-weather" style={{ opacity: .6 }}>🌡️ météo…</div>}
  </div>);
}
```

Et la table de conversion du code météo WMO — la seule chose qu'Open-Meteo renvoie, et qu'il faut
traduire soi-même :

```js
function wmoMeta(code) {
  if (code === 0) return { e: "☀️", l: "Ensoleillé" };
  if (code === 1 || code === 2) return { e: "🌤️", l: "Éclaircies" };
  if (code === 3) return { e: "☁️", l: "Couvert" };
  if (code === 45 || code === 48) return { e: "🌫️", l: "Brouillard" };
  if (code >= 51 && code <= 57) return { e: "🌦️", l: "Bruine" };
  if (code >= 61 && code <= 67) return { e: "🌧️", l: "Pluie" };
  if (code >= 71 && code <= 77) return { e: "🌨️", l: "Neige" };
  if (code >= 80 && code <= 82) return { e: "🌧️", l: "Averses" };
  if (code >= 85 && code <= 86) return { e: "🌨️", l: "Averses de neige" };
  if (code >= 95) return { e: "⛈️", l: "Orage" };
  return { e: "🌡️", l: "" };                                   // code inconnu : thermomètre neutre
}
```

**Les cinq points qui font que ça tient.**

1. **Trois chemins vers une position, jamais zéro.** Accord, refus, et — le cas oublié — l'invite
   laissée sans réponse. Sans le repli à 7 s, un utilisateur qui ignore la demande n'a jamais de
   météo, et rien ne le lui dit.
2. **Un drapeau `cancelled` et le nettoyage des deux minuteurs** au démontage. Sans eux, la barre
   latérale démontée continue de solliciter le réseau toutes les 30 minutes.
3. **`.tnum` sur l'heure** (`font-variant-numeric: tabular-nums`). Sans lui, la largeur change à
   chaque seconde et le bloc entier tressaute.
4. **`text-transform: capitalize` sur la date** : `toLocaleDateString` renvoie « lundi 25 août » en
   minuscule.
5. **L'échec est muet, pas vide.** Pas de réseau, pas de position : le bandeau affiche « 🌡️ météo… »
   à 60 % d'opacité. Une erreur rouge pour une information d'agrément serait hors de proportion.

**Pour MATMAT** : changez la position de repli pour celle de votre pays, et la locale `fr-FR` si
l'interface n'est pas en français — les libellés WMO sont à traduire à la main, ils ne viennent pas
de l'API.

---

## 12. Navigation groupée, item actif en dégradé, compteurs

```css
.nav{display:flex;flex-direction:column;gap:3px;margin-top:4px;}
.nav-group{margin:14px 0 4px;padding:0 12px;font-size:10px;font-weight:800;color:var(--muted);
  text-transform:uppercase;letter-spacing:.08em;opacity:.7;}
.nav button{display:flex;align-items:center;gap:11px;width:100%;border:0;background:transparent;
  cursor:pointer;padding:9px 11px;border-radius:11px;color:var(--muted);font-weight:600;
  font-size:13px;font-family:inherit;transition:.18s;text-align:left;}
.nav button:hover{background:var(--blue-l);color:var(--blue);}
.nav button.on{background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;
  box-shadow:0 6px 18px rgba(63,96,170,.28);}   /* ombre TEINTÉE de l'accent */
.nav button.on svg{color:#fff;}
.nav .cnt{margin-left:auto;font-size:11px;background:rgba(255,255,255,.25);padding:1px 7px;border-radius:9px;}
.nav button:not(.on) .cnt{background:#eef1f7;color:var(--muted);}
.nav button:not(.on):hover{transform:translateX(2px);}   /* glissement latéral au survol */
```

**Le détail** : l'ombre de l'item actif est teintée de sa propre couleur
(`rgba(63,96,170,.28)`), pas en noir. C'est ce qui donne l'impression que le bouton
« éclaire » le fond.

---

## 13. Famille complète de boutons

Sept variantes, un seul socle. Chaque bouton coloré porte un **liseré blanc interne**
(`0 0 0 1.5px rgba(255,255,255,.55)`) qui le détache de n'importe quel fond, y compris les
thèmes en dégradé.

```css
.btn{display:inline-flex;align-items:center;gap:7px;border:0;cursor:pointer;font-family:inherit;
  font-weight:700;font-size:13px;padding:10px 15px;border-radius:11px;transition:.18s;}
.btn:disabled{opacity:.5;cursor:not-allowed;}
.btn-s{padding:7px 11px;font-size:12.5px;}

/* Principal */
.btn-p{background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;
  box-shadow:0 0 0 1.5px rgba(255,255,255,.55),0 6px 16px rgba(63,96,170,.3);}
.btn-p:hover{transform:translateY(-1px);box-shadow:0 0 0 1.5px rgba(255,255,255,.55),0 9px 22px rgba(63,96,170,.4);}

/* Jaune */
.btn-y{background:var(--yellow);color:#5a3d00;box-shadow:0 0 0 1.5px rgba(255,255,255,.55),0 6px 16px rgba(248,187,32,.35);}

/* Rouge */
.btn-r{background:linear-gradient(135deg,var(--red),var(--red-d));color:#fff;
  box-shadow:0 0 0 1.5px rgba(255,255,255,.55),0 6px 16px rgba(255,90,69,.32);}
.btn-r:hover{filter:brightness(1.07);transform:translateY(-1px);}

/* Verre (secondaire) */
.btn-g{background:rgba(255,255,255,.5);-webkit-backdrop-filter:blur(12px) saturate(155%);
  backdrop-filter:blur(12px) saturate(155%);color:var(--ink);border:1px solid rgba(255,255,255,.6);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 2px 8px rgba(20,32,58,.06);}
.btn-g:hover{border-color:var(--blue);color:var(--blue);background:rgba(255,255,255,.66);}

/* Fantôme (barre du haut, reçoit l'accent auto) */
.btn-ghost{background:rgba(255,255,255,.4);-webkit-backdrop-filter:blur(12px) saturate(150%);
  backdrop-filter:blur(12px) saturate(150%);color:var(--ink);border:1px solid rgba(255,255,255,.55);}

/* IA / action spéciale : dégradé bicolore + ombre d'accent */
.btn-ai{background:linear-gradient(120deg,var(--blue),var(--orange));color:#fff;border:0;font-weight:800;
  box-shadow:0 0 0 1.5px rgba(255,255,255,.55),0 5px 16px rgba(248,177,51,.34);
  text-shadow:0 1px 2px rgba(22,32,58,.32);}
.btn-ai:hover{transform:translateY(-1px);filter:brightness(1.05);}

/* Enregistrer : grand, dégradé sur trois arrêts */
.btn-save{display:inline-flex;align-items:center;gap:8px;border:none;cursor:pointer;font-weight:800;
  font-size:14px;color:#fff;padding:12px 20px;border-radius:13px;
  background:linear-gradient(100deg,var(--blue) 0%,#5a78c4 45%,var(--orange) 100%);
  box-shadow:0 0 0 1.5px rgba(255,255,255,.55),0 4px 16px rgba(63,96,170,.34);
  transition:transform .08s ease, box-shadow .18s ease;letter-spacing:.01em;white-space:nowrap;}
.btn-save:active{transform:translateY(0);box-shadow:0 3px 12px rgba(63,96,170,.34);}

/* Destructif discret */
.btn-d{background:#fff;color:var(--red);border:1px solid #f3d2d6;}
.btn-d:hover{background:#FFE9E5;}
```

Et les pastilles de filtre, en verre elles aussi :

```css
.chip{border:1px solid rgba(255,255,255,.6);background:rgba(255,255,255,.48);
  -webkit-backdrop-filter:blur(12px) saturate(155%);backdrop-filter:blur(12px) saturate(155%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.6);border-radius:20px;padding:7px 13px;
  font-size:12.5px;font-weight:600;color:var(--muted);cursor:pointer;transition:.15s;}
.chip.on{background:var(--blue);color:#fff;border-color:var(--blue);backdrop-filter:none;}
/* Densité réduite dans un panneau replié, portée par le CONTENEUR, pas par chaque bouton */
.filtres-compacts .chip{padding:4px 11px;font-size:11.5px;}
```

---

## 14. Micro-interactions au survol

**L'effet** : tout élément cliquable se soulève, grossit légèrement, et un **reflet
balaie sa surface de droite à gauche**. Le tout sous `prefers-reduced-motion:
no-preference`, donc désactivable par le système.

```css
@media (prefers-reduced-motion: no-preference){
  .btn{will-change:transform;}
  .btn:not(:disabled):hover{transform:translateY(-1px) scale(1.025);}
  .btn:not(:disabled):active{transform:translateY(0) scale(.97);transition-duration:.06s;}
  .btn-ai:not(:disabled):hover{transform:translateY(-1px) scale(1.035);}

  /* Flèches qui glissent dans le sens de l'action */
  .btn svg,.back svg,.lnk svg{transition:transform .18s cubic-bezier(.2,.8,.2,1);}
  .back:hover svg{transform:translateX(-3px);}
  .lnk:hover svg{transform:translateX(2px);}

  /* Soulignement de lien qui se déploie depuis la gauche */
  .lnk{position:relative;text-decoration:none;}
  .lnk::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1.5px;background:currentColor;
    border-radius:2px;transform:scaleX(0);transform-origin:left;opacity:.85;
    transition:transform .22s cubic-bezier(.2,.8,.2,1);}
  .lnk:hover::after{transform:scaleX(1);}

  /* Étoile favori : rebond élastique + rotation */
  .star{transition:transform .18s cubic-bezier(.34,1.56,.64,1);}
  .star:hover{transform:scale(1.18) rotate(-8deg);}
  .star:active{transform:scale(.9);}

  /* REFLET BALAYANT — le clou du spectacle */
  .btn,.btn-save,.tile,.badge,.kpi{position:relative;overflow:hidden;}
  .btn::after,.btn-save::after,.tile::after,.badge::after,.kpi::after{
    content:"";position:absolute;top:-12%;bottom:-12%;width:42%;left:120%;
    background:linear-gradient(100deg,transparent,rgba(255,255,255,.5),transparent);
    transform:skewX(-16deg);pointer-events:none;opacity:0;z-index:3;}
  .btn:not(:disabled):hover::after,.tile:hover::after,.badge:hover::after,.kpi:hover::after{
    animation:shineLR .6s ease;}
  @keyframes shineLR{0%{left:120%;opacity:0;}15%{opacity:1;}100%{left:-70%;opacity:0;}}

  /* Lignes de liste : surlignage + très léger grossissement */
  .hrow{transition:background .12s ease,transform .16s cubic-bezier(.2,.8,.2,1),box-shadow .18s ease;}
  .hrow:hover{transform:scale(1.012);box-shadow:0 4px 14px rgba(20,32,58,.10);position:relative;z-index:1;}
  .tile:hover{transform:translateY(-3px) scale(1.012);}
  .kpi:hover{transform:translateY(-2px) scale(1.014);box-shadow:0 12px 26px rgba(20,32,58,.12);}
  .badge{transition:transform .18s cubic-bezier(.34,1.56,.64,1);}
  .badge:hover{transform:scale(1.09);}
}
```

**La courbe** : `cubic-bezier(.2,.8,.2,1)` partout pour le mouvement, et
`cubic-bezier(.34,1.56,.64,1)` (dépassement élastique) pour les éléments joueurs.

---

## 15. Frétillement d'icône + secousse d'alerte

```css
@keyframes iconWiggle{
  0%,100%{transform:translateY(-1px) scale(1.06) rotate(0);}
  25%{transform:translateY(-1px) scale(1.06) rotate(-8deg);}
  75%{transform:translateY(-1px) scale(1.06) rotate(8deg);}
}
.iconbtn:not(:disabled):hover{animation:iconWiggle .34s ease;}

@keyframes shakeX{
  0%,100%{transform:translateX(0);} 18%{transform:translateX(-2px);} 38%{transform:translateX(2px);}
  58%{transform:translateX(-1.5px);} 78%{transform:translateX(1.5px);}
}
.dup-warn:hover,.alert-shake:hover{animation:shakeX .42s ease;}
```

```css
.iconbtn{border:1px solid rgba(255,255,255,.5);background:rgba(242,244,249,.55);
  -webkit-backdrop-filter:blur(12px) saturate(155%);backdrop-filter:blur(12px) saturate(155%);
  width:32px;height:32px;border-radius:9px;display:grid;place-items:center;cursor:pointer;color:var(--muted);}
.iconbtn:not(:disabled):hover{transform:translateY(-1px) scale(1.06);box-shadow:0 4px 12px rgba(20,32,58,.12);}
.iconbtn:not(:disabled):active{transform:translateY(0) scale(.94);transition-duration:.06s;}
```

---

## 16. Chiffres qui s'épaississent au survol

Petit détail, gros effet de vivant : au survol d'une tuile ou d'une ligne, les valeurs
chiffrées passent en gras. Le `!important` bat le style en ligne.

```css
.tile:hover .tnum,.hrow:hover .tnum,.kpi:hover .val,.kpi:hover .tnum{font-weight:800!important;}
.tnum:hover{font-weight:900!important;}
```

Fonctionne uniquement parce que `.tnum` impose `font-variant-numeric:tabular-nums` : la
largeur ne bouge pas malgré la graisse.

---

## 17. Tuiles d'indicateur : cascade + compteur animé

```css
.grid{display:grid;gap:16px;}
.kpis{grid-template-columns:repeat(auto-fit,minmax(180px,1fr));}
.kpi{position:relative;overflow:hidden;opacity:0;transform:translateY(10px);animation:rise .5s forwards;}
@keyframes rise{to{opacity:1;transform:none;}}
.kpi .ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;margin-bottom:12px;}
.kpi .lab{color:var(--muted);font-size:12px;font-weight:600;}
.kpi .val{font-size:24px;margin-top:2px;}
.kpi .sub{font-size:11.5px;color:var(--muted);margin-top:4px;display:flex;align-items:center;gap:5px;}
```

Décalez `animationDelay` de 60 ms par tuile pour la cascade. Et le compteur qui monte,
avec décélération cubique :

```jsx
function useCountUp(value, duration = 850){
  const [n,setN] = useState(0); const fromRef = useRef(0);
  useEffect(()=>{
    let raf, start; const from = fromRef.current; const to = Number(value)||0;
    const tick = (t)=>{
      if(start===undefined) start = t;
      const p = Math.min(1,(t-start)/duration);
      setN(from + (to-from) * (1 - Math.pow(1-p,3)));   // ease-out cubique
      if(p<1) raf = requestAnimationFrame(tick); else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(raf);
  },[value,duration]);
  return n;
}
```

**Le détail** : `fromRef` mémorise la valeur atteinte. À la mise à jour suivante, le
compteur repart **de là**, pas de zéro.

Et une tuile d'état à trois niveaux (actif / partiel / à activer), avec un liseré haut qui
passe en pointillés quand la donnée manque :

```jsx
function KpiTile({label, value, note, color, state, big}){
  const top = state==="ok" ? (color||"var(--blue)") : state==="partiel" ? "var(--amber)" : "var(--line)";
  return (<div className="card" style={{borderTop:`3px solid ${top}`, ...(state==="todo"?{borderTopStyle:"dashed"}:{})}}>
    <div style={{fontSize:12,color:"var(--muted)",fontWeight:700}}>{label}</div>
    <div className="mm-display tnum" style={{fontSize:big?30:25,fontWeight:800,
      color:state==="ok"?(color||"var(--ink)"):"var(--muted)",marginTop:4}}>
      {state==="ok" ? value : "—"}
    </div>
    {note && <div style={{fontSize:11.5,color:"var(--muted)",marginTop:5,lineHeight:1.45}}>{note}</div>}
  </div>);
}
```

---

## 18. Squelettes scintillants

```css
.skel{background:linear-gradient(90deg,var(--line) 25%,rgba(255,255,255,.55) 37%,var(--line) 63%);
  background-size:400% 100%;animation:shimmer 1.4s ease infinite;border-radius:10px;}
.mm-root.dark .skel{background:linear-gradient(90deg,#222c44 25%,#2c3650 37%,#222c44 63%);background-size:400% 100%;}
@keyframes shimmer{0%{background-position:100% 0;}100%{background-position:0 0;}}
```

```jsx
{coldStart && (
  <div className="fade" aria-busy="true" aria-label="Chargement…">
    <div className="skel" style={{height:28,width:220,marginBottom:18}}/>
    <div className="grid kpis" style={{marginBottom:16}}>
      {Array.from({length:4}).map((_,i)=>(
        <div key={i} className="card" style={{height:96}}>
          <div className="skel" style={{height:14,width:"55%",marginBottom:12}}/>
          <div className="skel" style={{height:26,width:"40%"}}/>
        </div>))}
    </div>
    <div className="card" style={{height:240}}>
      <div className="skel" style={{height:16,width:180,marginBottom:14}}/>
      <div className="skel" style={{height:168,width:"100%"}}/>
    </div>
  </div>
)}
```

Le squelette doit **reproduire la mise en page réelle** (une barre de titre, 4 tuiles, un
graphique), sinon le passage au contenu produit un saut visuel.

---

## 19. Écran de démarrage en HTML/CSS pur

**L'effet** : entre l'ouverture de l'onglet et le démarrage de React, la page n'est pas
blanche. L'écran vit dans `index.html`, en HTML et CSS seuls, **à l'intérieur de `#root`**
— React le remplace en s'installant, sans une ligne de code pour l'enlever.

```html
<style>
  #demarrage{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;
    justify-content:center;gap:20px;background:#fff8ea;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;}
  #demarrage .logo{width:120px;height:120px;animation:mm-tournoie 1.6s linear infinite;transform-origin:50% 50%;}
  @keyframes mm-tournoie{to{transform:rotate(360deg);}}
  #demarrage .nom{font-weight:800;font-size:17px;letter-spacing:.16em;color:#3F60AA;}
  #demarrage .txt{font-size:12.5px;font-weight:600;color:#8b8578;margin-top:-12px;}
  @media(prefers-color-scheme:dark){#demarrage{background:#14182a;}#demarrage .nom{color:#8ea6e0;}#demarrage .txt{color:#79809a;}}
  @media(prefers-reduced-motion:reduce){#demarrage .logo{animation:none;}}
</style>

<div id="root">
  <div id="demarrage" role="status" aria-label="Chargement de MATMAT">
    <svg class="logo" viewBox="0 0 130 130" aria-hidden="true">
      <!-- votre marque, en SVG inline : aucune requête réseau -->
    </svg>
    <div class="nom">MATMAT</div>
    <div class="txt">Chargement…</div>
  </div>
</div>

<noscript style="display:block;max-width:460px;margin:14vh auto;padding:24px;font-family:system-ui,sans-serif;color:#16203a;text-align:center;line-height:1.55;">
  <strong>JavaScript est requis.</strong><br/>Activez-le dans votre navigateur, puis rechargez la page.
</noscript>
```

Trois règles : SVG **inline** (pas de `<img src>`, ce serait une requête), la couleur de
fond doit être **la même** que celle de l'application, et le mode sombre système est géré
ici aussi — sinon flash blanc.

---

## 20. Gerbe de confettis au clic

**L'effet** : chaque clic de menu ou de couleur projette 18 petits bâtonnets colorés qui
retombent. Rendu dans un portail sur `<body>`, en `position:fixed`, `pointer-events:none`.
Trajectoires portées par des variables CSS pour que l'animation reste entièrement en GPU.

```css
.confetti{position:fixed;border-radius:3px;pointer-events:none;will-change:transform,opacity;}
@keyframes confettiFly{
  0%{opacity:0;transform:translate(-50%,-50%) rotate(0) scaleX(.5);}
  12%{opacity:1;}
  100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy) + 70px)) rotate(var(--rot)) scaleX(1);}
}
```

```jsx
let _host = null;
export function burstConfetti(x, y){ if(_host) _host(x, y); }

function ConfettiHost(){
  const [bursts, setBursts] = useState([]);
  useEffect(()=>{
    _host = (x,y)=>{
      try{ if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; }catch(e){}
      const COLORS = ["#3F60AA","#FFD212","#FF5A45","#2bb673","#7c5cf0","#0EA5A4","#F8B133","#E94D6B"];
      const parts = Array.from({length:18},(_,i)=>{
        const ang  = Math.random()*Math.PI*2;
        const dist = 45 + Math.random()*95;
        return { dx:Math.cos(ang)*dist,
                 dy:Math.sin(ang)*dist - 25 - Math.random()*35,   // biais vers le haut
                 rot:Math.random()*720-360, len:9+Math.random()*15,
                 color:COLORS[i%COLORS.length], delay:Math.random()*70 };
      });
      const id = "fb_"+Math.random().toString(36).slice(2,8);
      setBursts(b=>[...b,{id,x,y,parts}]);
      setTimeout(()=>setBursts(b=>b.filter(z=>z.id!==id)), 1200);
    };
    return ()=>{ _host = null; };
  },[]);
  if(!bursts.length) return null;
  return createPortal(
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9998,overflow:"hidden"}} aria-hidden="true">
      {bursts.map(bz => bz.parts.map((p,i)=>(
        <span key={bz.id+"_"+i} className="confetti"
          style={{left:bz.x,top:bz.y,width:p.len,height:3.5,background:p.color,
            animation:`confettiFly 1.05s cubic-bezier(.15,.7,.3,1) ${p.delay}ms forwards`,
            "--dx":p.dx+"px","--dy":p.dy+"px","--rot":p.rot+"deg"}}/>
      )))}
    </div>, document.body);
}
```

**Le point d'architecture** : `_host` est une variable module, pas un contexte React.
N'importe quel bouton appelle `burstConfetti(e.clientX, e.clientY)` sans rien câbler.

**Dans MATMAT** : remplacez les bâtonnets par une forme qui parle de votre produit.

---

## 21. Palette de commandes ⌘K

**L'effet** : `Ctrl/Cmd + K` ouvre une recherche unique sur toutes les entités, groupée
par catégorie, entièrement pilotable au clavier (↑↓ / Entrée / Esc), avec un pied de
fenêtre qui rappelle les raccourcis.

```css
.cmdk-ov{position:fixed;inset:0;background:rgba(22,32,58,.55);backdrop-filter:blur(4px);
  z-index:60;display:flex;justify-content:center;padding-top:8vh;animation:fade .15s ease;}
.cmdk{background:var(--card);width:min(620px,92vw);max-height:72vh;border-radius:18px;
  box-shadow:0 30px 80px rgba(20,32,58,.4);display:flex;flex-direction:column;overflow:hidden;animation:pop .2s ease;}
.cmdk input{border:0;outline:0;padding:18px 20px;font-size:15px;font-family:inherit;
  background:transparent;color:var(--ink);border-bottom:1px solid var(--line);}
.cmdk-list{flex:1;overflow:auto;padding:8px;}
.cmdk-cat{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;
  letter-spacing:.05em;padding:8px 10px 4px;}
.cmdk-item{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:9px;cursor:pointer;font-size:13.5px;}
.cmdk-item:hover,.cmdk-item.sel{background:var(--blue-l);}
.cmdk-item:hover{transform:translateX(2px);}
.cmdk-item .meta{margin-left:auto;font-size:11.5px;color:var(--muted);}
.cmdk-foot{padding:9px 14px;border-top:1px solid var(--line);font-size:11px;color:var(--muted);display:flex;gap:14px;}
```

```jsx
const onKey = (e) => {
  if(e.key==="ArrowDown"){ e.preventDefault(); setSel(s=>Math.min(flat.length-1, s+1)); }
  else if(e.key==="ArrowUp"){ e.preventDefault(); setSel(s=>Math.max(0, s-1)); }
  else if(e.key==="Enter" && flat[sel]){ e.preventDefault(); onPick(flat[sel]); }
};
// Deux structures : `results` groupé par catégorie pour l'affichage,
// `flat` à plat pour la sélection au clavier. Indispensable.
<div className="cmdk-foot"><span>↑↓ Naviguer</span><span>↵ Ouvrir</span><span>Esc Fermer</span></div>
```

**À ne pas oublier** : la première catégorie est **Actions** (« Créer un… », « Ouvrir
la… »), pas des données. C'est ce qui transforme une recherche en palette de commandes.

---

## 22. Carte d'aperçu au survol prolongé

**L'effet** : rester 650 ms sur une ligne fait apparaître une fiche compacte — icône
colorée, titre, sous-titre, badge, paires clé/valeur, note en pied — avec un liseré haut
à la couleur de l'entité. Elle se **retourne toute seule** pour ne jamais sortir de
l'écran, et disparaît au moindre défilement.

```css
.dwell-card{position:fixed;z-index:45;pointer-events:none;width:max-content;max-width:300px;min-width:212px;
  padding:12px 13px;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:14px;
  box-shadow:0 1px 2px rgba(15,23,42,.06),0 16px 40px -12px rgba(15,23,42,.32);
  font-size:12.5px;line-height:1.4;border-top:3px solid var(--dw-accent,#3F60AA);}
@media (prefers-reduced-motion: no-preference){
  .dwell-card{animation:dwellIn .16s cubic-bezier(.2,.8,.3,1) both;transform-origin:top left;}}
@keyframes dwellIn{from{opacity:0;transform:translateY(5px) scale(.97);}to{opacity:1;transform:none;}}
.dwell-head{display:flex;align-items:flex-start;gap:9px;}
.dwell-ic{flex-shrink:0;width:26px;height:26px;border-radius:8px;display:inline-flex;
  align-items:center;justify-content:center;color:#fff;}
.dwell-title{font-weight:800;font-size:13.5px;letter-spacing:-.01em;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;max-width:188px;}
.dwell-sub{color:var(--muted);font-size:12px;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.dwell-badge{flex-shrink:0;font-size:10.5px;font-weight:800;padding:2px 7px;border-radius:999px;
  color:var(--bdg);background:color-mix(in srgb, var(--bdg) 14%, transparent);}
.dwell-rows{margin-top:10px;padding-top:9px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:5px;}
.dwell-row{display:flex;gap:10px;align-items:baseline;justify-content:space-between;}
.dwell-k{color:var(--muted);font-size:11.5px;font-weight:600;flex-shrink:0;}
.dwell-v{font-weight:600;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:178px;}
.dwell-foot{margin-top:9px;padding-top:8px;border-top:1px solid var(--line);color:var(--muted);
  font-size:11.5px;font-style:italic;}
```

```jsx
function useDwellPreview(){
  const [preview,setPreview] = useState(null);
  const timer = useRef(null);
  const clear = ()=>{ if(timer.current){clearTimeout(timer.current);timer.current=null;} };
  useEffect(()=>()=>clear(),[]);
  // Le moindre défilement ou redimensionnement fait disparaître la carte : elle est en
  // position fixe, elle se retrouverait sinon posée à côté de sa ligne d'origine.
  useEffect(()=>{
    if(!preview) return;
    const hide = ()=>{ clear(); setPreview(null); };
    window.addEventListener("scroll",hide,true); window.addEventListener("resize",hide);
    return ()=>{ window.removeEventListener("scroll",hide,true); window.removeEventListener("resize",hide); };
  },[preview]);
  const bind = (build) => ({
    onMouseEnter:(e)=>{ clear(); const px=e.clientX, py=e.clientY;
      timer.current = setTimeout(()=>{ const d = typeof build==="function"?build():build; if(d) setPreview({x:px,y:py,data:d}); }, 650); },
    onMouseLeave:()=>{ clear(); setPreview(null); },
  });
  return { bind, hide:()=>{clear();setPreview(null);}, node: preview ? <PreviewCard {...preview}/> : null };
}

// Retournement automatique : on mesure APRÈS le rendu, en gardant la carte invisible.
useEffect(()=>{
  const el = ref.current; if(!el) return;
  const r = el.getBoundingClientRect(); const m = 12, vw = innerWidth, vh = innerHeight;
  let left = x+16, top = y+16;
  if(left + r.width + m > vw) left = x - r.width - 16;
  if(left < m) left = m;
  if(top + r.height + m > vh) top = vh - r.height - m;
  if(top < m) top = m;
  setPos({left, top, ready:true});
},[x,y,data]);
// … style={{ visibility: pos.ready ? "visible" : "hidden" }}
```

**Usage** : `<div {...dwell.bind(()=>({title:…, subtitle:…, badge:…, rows:[…], accent:"#7c5cf0"}))}>`

---

## 23. Infobulles riches en portail

**L'effet** : au survol d'un triangle d'alerte ou d'une barre de graphique, un panneau
explicatif apparaît, borné à l'écran, **rendu sur `document.body`** — il passe donc
au-dessus de toutes les cartes voisines.

```css
.hoverpop{position:fixed;z-index:9999;background:#fff;color:#3a4358;border:1px solid #e2e7f0;
  border-radius:12px;padding:10px 12px;font-size:12px;line-height:1.5;text-align:left;
  box-shadow:0 12px 32px rgba(20,32,58,.26);pointer-events:none;font-family:inherit;}
.warntip{position:relative;display:inline-flex;align-items:center;cursor:help;flex-shrink:0;}
.warntip-pop{display:block;position:fixed;z-index:9999;background:#fff;color:#3a4358;
  border:1px solid #f0c36d;border-radius:10px;padding:9px 11px;font-size:11.5px;line-height:1.5;
  font-weight:500;box-shadow:0 10px 28px rgba(20,32,58,.28);pointer-events:none;}
```

```jsx
function useHoverPop(){
  const [pop,setPop] = useState(null);
  const open = (e, content, width = 320) => {
    const r = e.currentTarget.getBoundingClientRect();
    const W = Math.min(width, window.innerWidth - 16);
    const x = Math.max(8, Math.min(r.left + r.width/2 - W/2, window.innerWidth - W - 8));
    const below = r.bottom + 260 <= window.innerHeight;    // bascule au-dessus si ça ne tient pas
    setPop({x, w:W, content, top: below ? r.bottom+8 : null,
            bottom: below ? null : window.innerHeight - r.top + 8});
  };
  const node = pop ? createPortal(
    <div className="hoverpop" style={{left:pop.x,width:pop.w,
      top: pop.top ?? "auto", bottom: pop.bottom ?? "auto"}}>{pop.content}</div>, document.body) : null;
  return { open, close:()=>setPop(null), node };
}
```

**La raison du portail** (commentée dans le source de MITMIT) : chaque tuile crée son
propre contexte d'empilement. Une infobulle rendue dans la tuile est tronquée par ses
bords, quel que soit son `z-index`.

---

## 24. Fenêtres modales

```css
.ov{position:fixed;inset:0;background:rgba(22,32,58,.45);backdrop-filter:blur(3px);
  display:grid;place-items:center;z-index:50;animation:fade .2s ease;padding:20px;}
.modal{background:#fff;border-radius:20px;width:min(560px,100%);max-height:92vh;overflow:auto;
  box-shadow:0 30px 80px rgba(20,32,58,.35);animation:pop .25s ease;}
@keyframes pop{from{transform:scale(.96) translateY(8px);opacity:0;}to{transform:none;opacity:1;}}
@keyframes fade{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}

/* L'en-tête reste visible quand le corps défile */
.modal-h{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;
  border-bottom:1px solid var(--line);position:sticky;top:0;background:#fff;z-index:2;}
.modal-b{padding:20px;display:flex;flex-direction:column;gap:14px;}

/* Champs de formulaire */
.fld{display:flex;flex-direction:column;gap:5px;}
.fld label{font-size:12px;font-weight:600;color:var(--muted);}
.fld input,.fld select,.fld textarea{border:1px solid var(--line);border-radius:10px;padding:9px 11px;
  font-family:inherit;font-size:13.5px;width:100%;background:#fff;}
.fld input:focus,.fld select:focus,.fld textarea:focus{outline:0;border-color:var(--blue);}
.fld input::placeholder{color:var(--muted);opacity:.75;}
.row2{display:flex;gap:12px;}.row2>*{flex:1;min-width:0;}

/* Transition de vue entre onglets */
.fade{animation:viewIn .42s cubic-bezier(.2,.8,.2,1);}
@keyframes viewIn{from{opacity:0;transform:translateY(11px) scale(.992);}to{opacity:1;transform:none;}}
```

---

## 25. Assistant flottant à mascotte

**L'effet** : un bouton rond de 58 px en bas à droite, portant une mascotte, ouvre un
panneau de discussion de 370 × 520. En-tête en dégradé, bulles alignées gauche/droite,
suggestions rapides en puces, dictée vocale, et surtout : les actions proposées
apparaissent en **cartes à appliquer d'un clic** (« ✓ Appliqué » / « ⚠ Refusé »).

```jsx
{/* Bouton flottant */}
<button onClick={()=>setOpen(v=>!v)} title="Assistant"
  style={{position:"fixed",bottom:22,right:22,width:58,height:58,borderRadius:"50%",
    border:"3px solid #fff",boxShadow:"0 6px 22px rgba(22,32,58,.28)",cursor:"pointer",
    padding:0,overflow:"hidden",background:"#fff",zIndex:60}}>
  {open ? <span style={{fontSize:24}}>✕</span>
        : <img src={MASCOT_URI} alt="Assistant" style={{width:"100%",height:"100%",objectFit:"contain",padding:3}}/>}
</button>

{/* Panneau */}
{open && (
<div style={{position:"fixed",bottom:92,right:22,width:370,maxWidth:"calc(100vw - 32px)",
  height:520,maxHeight:"calc(100vh - 130px)",background:"var(--card)",borderRadius:18,
  boxShadow:"0 16px 48px rgba(22,32,58,.3)",display:"flex",flexDirection:"column",
  overflow:"hidden",zIndex:60,border:"1px solid var(--line)"}}>

  <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",
    background:"linear-gradient(135deg,#3F60AA,#5b8def)",color:"#fff"}}>
    <span style={{width:34,height:34,borderRadius:"50%",overflow:"hidden",background:"#fff",border:"2px solid #fff"}}>
      <img src={MASCOT_URI} alt="" style={{width:"100%",height:"100%",objectFit:"contain",padding:1}}/></span>
    <div style={{lineHeight:1.2}}>
      <div style={{fontWeight:800,fontSize:14.5}}>Assistant MATMAT</div>
      <div style={{fontSize:11,opacity:.85}}>Lit vos données</div></div>
  </div>

  {/* Bulles */}
  <div ref={scrollRef} style={{flex:1,overflowY:"auto",padding:"12px 12px 6px",
    display:"flex",flexDirection:"column",gap:8,background:"var(--bg)"}}>
    {msgs.map((m,i)=>(
      <div key={i} style={{alignSelf: m.role==="user"?"flex-end":"flex-start", maxWidth:"85%"}}>
        <div style={{padding:"8px 11px",borderRadius:13,fontSize:13,lineHeight:1.45,whiteSpace:"pre-wrap",
          background: m.role==="user"?"#3F60AA":"var(--card)",
          color: m.role==="user"?"#fff":"var(--ink)",
          border: m.role==="user"?"none":"1px solid var(--line)"}}>{m.text}</div>
      </div>))}
    {busy && <div style={{alignSelf:"flex-start",padding:"8px 11px",borderRadius:13,fontSize:13,
      background:"var(--card)",border:"1px solid var(--line)",color:"var(--muted)"}}>L'assistant réfléchit…</div>}
  </div>

  {/* Suggestions rapides */}
  <div style={{padding:"6px 10px",display:"flex",gap:5,flexWrap:"wrap",
    borderTop:"1px solid var(--line)",background:"var(--card)"}}>
    {quick.map(q=><button key={q} onClick={()=>send(q)} style={{fontSize:11,color:"var(--muted)",
      background:"var(--bg)",border:"1px solid var(--line)",borderRadius:20,padding:"3px 9px",cursor:"pointer"}}>{q}</button>)}
  </div>
</div>)}
```

Et le fil de discussion en bulles, version « historique d'échanges » :

```css
.thread{display:flex;flex-direction:column;gap:10px;}
.msg{display:flex;width:100%;} .msg-in{justify-content:flex-start;} .msg-out{justify-content:flex-end;}
.msg-bubble{max-width:86%;min-width:200px;border:1px solid var(--line);border-radius:16px;
  padding:9px 12px;background:#fff;position:relative;}
.msg-in .msg-bubble{border-top-left-radius:5px;background:#f5f7fb;}   /* coin « épinglé » côté émetteur */
.msg-out .msg-bubble{border-top-right-radius:5px;background:#eef3ff;}
.msg-body{font-size:12.5px;color:var(--muted);margin-top:3px;line-height:1.5;white-space:pre-wrap;
  overflow-wrap:anywhere;word-break:break-word;min-width:0;}   /* anywhere : les longues URL ne débordent plus */
```

---

## 26. Pastilles d'état

**L'effet** : dans la barre du haut, des pastilles arrondies pleine couleur annoncent
l'état de synchronisation et les tâches en cours. L'icône tourne pendant l'action.

```jsx
const SS = {
  saving:  { l:"Enregistrement…",           c:"#a06a06",     I:RefreshCw },
  saved:   { l:"Synchronisé",               c:"#1d8956",     I:CheckCircle2 },
  remote:  { l:"Mis à jour par un collègue",c:"var(--blue)", I:Users },
  offline: { l:"Hors ligne",                c:"var(--red)",  I:AlertTriangle },
};
const style = {display:"inline-flex",alignItems:"center",gap:6,fontSize:11.5,fontWeight:700,
  color:"#fff",background:m.c,border:"1px solid "+m.c,borderRadius:20,padding:"5px 11px",whiteSpace:"nowrap"};
<Ic size={13} className={state==="saving" ? "spin" : undefined}/>
```

```css
.spin{animation:spin 1s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
.badge{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;
  padding:3px 9px;border-radius:20px;}
.dot{width:7px;height:7px;border-radius:50%;}
```

**Une leçon apprise, notée dans le source** : hors ligne, MITMIT affichait un grand
bandeau d'alerte qui apparaissait et disparaissait à chaque tentative de reconnexion,
**décalant toute la page toutes les quelques secondes**. Il a été remplacé par cette
pastille, cliquable pour réessayer, avec le message rassurant dans l'infobulle. Ne
faites jamais entrer et sortir un bloc du flux à intervalle régulier.

Badge coloré générique, teinte dérivée d'une seule couleur :

```jsx
const Badge = ({color, children}) => (
  <span className="badge" style={{background: color+"18", color: darkenHex(color)}}>
    <i className="dot" style={{background: color}}/>{children}
  </span>);
```

Et l'indicateur de tâches en arrière-plan :

```jsx
<span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:11.5,fontWeight:700,
  color:"#fff",background:"#7c5cf0",borderRadius:20,padding:"5px 11px"}}>
  <Sparkles size={13} className="spin"/>{label}{prog}
</span>
```

---

## 27. Kanban : colonnes en verre + barre de défilement dessinée

**L'effet** : au-delà de trois fiches, une colonne défile sur place au lieu de s'allonger.
La barre native est masquée au profit d'une barre dessinée, **visible en permanence** (les
barres natives de macOS et Linux disparaissent au repos).

```css
.kan{display:grid;grid-template-columns:repeat(5,1fr);gap:13px;}
.col{background:rgba(255,255,255,.5);
  -webkit-backdrop-filter:blur(14px) saturate(160%);backdrop-filter:blur(14px) saturate(160%);
  border:1px solid rgba(255,255,255,.55);border-radius:16px;padding:11px;min-height:120px;
  box-shadow:0 6px 22px rgba(20,32,58,.08);}
.col-h{display:flex;align-items:center;gap:7px;font-weight:700;font-size:12.5px;margin-bottom:10px;}
.col-h .cnt{margin-left:auto;color:var(--muted);font-weight:600;}

.col-scroll{position:relative;}
.col-body{overflow-y:auto;overscroll-behavior:contain;padding-right:13px;
  scrollbar-width:none;-ms-overflow-style:none;}
.col-body::-webkit-scrollbar{width:0;height:0;}
.col-sb{position:absolute;top:0;right:0;bottom:0;width:7px;border-radius:7px;
  background:rgba(20,32,58,.08);cursor:pointer;}
.col-sb-th{position:absolute;left:0;right:0;border-radius:7px;background:rgba(20,32,58,.3);
  cursor:grab;transition:background .15s ease;}
.col-sb-th:hover{background:rgba(20,32,58,.48);}
.col-sb-th:active{cursor:grabbing;background:rgba(20,32,58,.55);}

/* Fiches */
.deal-card{background:#fff;border:1px solid var(--line);border-radius:11px;padding:10px;
  margin-bottom:8px;cursor:pointer;transition:.12s;}
.deal-card:hover{transform:translateY(-1px);box-shadow:0 5px 14px rgba(20,32,58,.08);}
.acc-card{background:#fff;border:1px solid var(--line);border-radius:13px;padding:12px;margin-bottom:9px;
  cursor:pointer;transition:.16s;border-left:4px solid var(--blue);}   /* liseré de catégorie */
.acc-card:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(20,32,58,.1);}
```

**La hauteur** est mesurée sur la 3e fiche **réellement rendue** (les cartes n'ont pas
toutes la même taille), jamais devinée en dur.

---

## 28. Entonnoir animé ⇄ camembert, effet « pile de cartes »

**L'entonnoir** : chaque barre a une largeur proportionnelle, animée sur 550 ms avec une
courbe très décélérée. La couleur porte une ombre de sa propre teinte.

```jsx
const w = 34 + 66 * (r.count / maxCount);   // jamais moins de 34 % : une étape vide reste lisible
<div className="funbar" style={{
  width: w+"%", minWidth:60, height:42, borderRadius:9,
  background: r.count ? r.color : "var(--bg)",
  color: r.count ? onColor(r.color) : "var(--muted)",
  boxShadow: r.count ? "0 2px 8px "+r.color+"55" : "none",
  display:"flex",alignItems:"center",justifyContent:"center",gap:8,
  transition:"width .55s cubic-bezier(.22,1,.36,1), transform .16s cubic-bezier(.2,.8,.2,1), filter .16s ease"}}>
  <span className="mm-display tnum" style={{fontSize:18,fontWeight:800}}>{r.count}</span>
  <span style={{fontSize:11,opacity:.85}}>{pct(r.count)}%</span>
</div>
```

```css
.funbar{transition:transform .16s cubic-bezier(.2,.8,.2,1),filter .16s ease,box-shadow .16s ease;}
.funbar:hover{transform:scale(1.02);filter:brightness(1.07) saturate(1.06);box-shadow:0 6px 18px rgba(20,32,58,.22);}
```

Un sélecteur segmenté bascule vers un camembert (Recharts, `innerRadius:56 / outerRadius:94`,
`paddingAngle:2`) avec légende cliquable à droite.

**L'effet « pile de cartes »** : un groupe replié se présente comme une liasse de fiches,
par empilement de plusieurs ombres décalées. La pile s'épaissit au survol.

```css
.tile.pile{box-shadow:
   4px 4px 0 -1px rgba(255,255,255,.52), 4px 4px 0 0 var(--line),
   9px 9px 0 -1px rgba(255,255,255,.38), 9px 9px 0 0 var(--line),
   inset 0 1px 0 rgba(255,255,255,.6), 0 4px 16px rgba(20,32,58,.07);}
.tile.pile:hover{box-shadow:
   6px 6px 0 -1px rgba(255,255,255,.52), 6px 6px 0 0 var(--line),
  13px 13px 0 -1px rgba(255,255,255,.38),13px 13px 0 0 var(--line),
   inset 0 1px 0 rgba(255,255,255,.6), 0 8px 22px rgba(20,32,58,.12);}
.mm-root.dark .tile.pile{box-shadow:
   4px 4px 0 -1px rgba(38,50,74,.8), 4px 4px 0 0 var(--line),
   9px 9px 0 -1px rgba(38,50,74,.6), 9px 9px 0 0 var(--line), 0 4px 16px rgba(0,0,0,.35);}
```

**Attention** (piège noté dans le source) : ne posez **pas** de fond opaque sur les
« feuilles » du dessous. Sur un thème coloré, la tuile est translucide et son texte est
blanc ; un fond opaque le rendrait illisible. Les feuilles reprennent la même teinte
translucide que la tuile.

Les tuiles de base, et les jauges :

```css
.tile{cursor:pointer;color:var(--ink);background:rgba(255,255,255,.52);
  -webkit-backdrop-filter:blur(16px) saturate(170%);backdrop-filter:blur(16px) saturate(170%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 4px 16px rgba(20,32,58,.06);
  transition:transform .16s ease, box-shadow .16s ease, border-color .16s ease, background .16s ease;}
.tile:hover{transform:translateY(-3px);box-shadow:0 12px 26px rgba(20,32,58,.14);
  border-color:#cfdcf3;background:var(--bg);}

.bar{height:7px;border-radius:6px;background:#eef1f7;overflow:hidden;}
.bar>i{display:block;height:100%;border-radius:6px;transition:width .7s cubic-bezier(.2,.8,.2,1);}
```

Une jauge complète, couleur choisie par seuil :

```jsx
function Gauge({label, pct, valueText, color, hint}){
  const c = color || (pct>=75 ? "var(--green)" : pct>=40 ? "var(--amber)" : "var(--red)");
  return (<div style={{marginBottom:18}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5}}>
      <span style={{fontSize:12.5,fontWeight:700}}>{label}</span>
      <span className="tnum mm-display" style={{fontSize:13,color:c,fontWeight:800}}>{valueText}</span></div>
    <div style={{height:9,background:"#eef2fb",borderRadius:6,overflow:"hidden"}}>
      <div style={{width:Math.max(2,Math.min(100,pct))+"%",height:"100%",background:c,borderRadius:6,transition:"width .4s"}}/></div>
    {hint && <div style={{fontSize:10.5,color:"var(--muted)",marginTop:3}}>{hint}</div>}
  </div>);
}
```

Enfin, la mise en avant d'un élément qui vient d'apparaître — un anneau qui pulse, tracé
en `outline` et non en `box-shadow` (les tuiles définissent déjà leur ombre, l'anneau s'y
perdrait ; et `overflow:hidden` ne rogne pas un `outline`) :

```css
.flash-target{animation:prospectFlash 1.25s ease-in-out 0s 3;position:relative;z-index:2;border-radius:12px;}
@keyframes prospectFlash{
  0%,100%{outline:3px solid rgba(248,177,51,0);outline-offset:2px;}
  50%{outline:3px solid rgba(248,177,51,.95);outline-offset:5px;}
}
/* En mouvement réduit, l'anneau reste fixe : c'est un repère, il ne doit pas dépendre de l'animation. */
@media (prefers-reduced-motion: reduce){
  .flash-target{outline:3px solid rgba(248,177,51,.95)!important;outline-offset:4px!important;}
}
```

---

## 29. Impression professionnelle

**L'effet** : `Ctrl+P` produit soit le document seul (devis, facture), soit l'écran de
rapport en cours — jamais l'interface. Avec en-têtes de tableau répétés, aucun bloc coupé
en deux, et les aplats de couleur conservés.

```css
@media print{
  /* La marge est portée par la PAGE, jamais par le document : un padding n'habille
     que le début et la fin du flux, la page 2 démarrerait collée au bord haut. */
  @page{margin:13mm 14mm;}

  /* Sans ceci, le PDF perd tous les fonds colorés */
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}

  /* Le fond de l'application est peint par html/body sur TOUTE la feuille : à neutraliser */
  html,body{background:#fff!important;background-image:none!important;}

  /* Cas 1 — un document est ouvert : <body class="doc-print">, on masque tout le reste */
  body.doc-print > *:not(.print-doc-overlay){display:none!important;}
  body.doc-print .print-doc-overlay{position:static!important;inset:auto!important;display:block!important;
    background:#fff!important;backdrop-filter:none!important;padding:0!important;z-index:auto!important;}
  body.doc-print .print-doc-overlay .doc{position:static!important;max-height:none!important;
    overflow:visible!important;box-shadow:none!important;border-radius:0!important;width:100%!important;}

  /* Cas 2 — impression d'un écran de rapport */
  body:not(.doc-print) *{visibility:hidden!important;}
  body:not(.doc-print) .print-area,body:not(.doc-print) .print-area *{visibility:visible!important;}
  body:not(.doc-print) .print-area{position:absolute!important;left:0;top:0;width:100%;padding:0;}

  .no-print{display:none!important;}

  /* Sauts de page soignés */
  .doc-bloc,.print-eviter-coupure{break-inside:avoid!important;page-break-inside:avoid!important;}
  .devis-doc thead{display:table-header-group;}   /* en-tête répété sur chaque page */
  .devis-doc tfoot{display:table-footer-group;}
  .devis-doc tr,.devis-doc td,.devis-doc th{break-inside:avoid!important;page-break-inside:avoid!important;}
  .devis-doc h1,.devis-doc h2,.devis-doc h3{break-after:avoid;page-break-after:avoid;}
  .devis-doc p,.devis-doc li{orphans:3;widows:3;}
  .devis-doc img,.devis-doc svg{break-inside:avoid;max-width:100%;}
  .print-area .card,.print-area .kpi,.print-area .hrow,.print-area table tr{break-inside:avoid;}
}
```

**Pourquoi une classe sur `<body>` et non `:has()`** : `:has()` est inégalement supporté
au moment de l'impression. La classe est posée en JS à l'ouverture du document.

Et le document lui-même :

```css
.doc{background:#fff;width:min(800px,100%);max-height:92vh;overflow:auto;border-radius:14px;
  box-shadow:0 30px 80px rgba(20,32,58,.35);}
.devis-doc{padding:40px;color:#1a1a2e;font-size:13px;}
.devis-doc table{width:100%;border-collapse:collapse;margin:16px 0;}
.devis-doc th{background:#f4f6fb;text-align:left;padding:9px 10px;font-size:11px;
  text-transform:uppercase;color:#6b7589;border-bottom:2px solid var(--blue);}
.devis-doc td{padding:9px 10px;border-bottom:1px solid #eef1f7;}
```

---

## 30. Accessibilité, responsive et PWA

### Accessibilité

```css
/* Anneau de focus clavier visible, sans gêner la souris */
.nav button:focus-visible,.btn:focus-visible,.chip:focus-visible,.iconbtn:focus-visible,a:focus-visible{
  outline:2px solid var(--blue);outline-offset:2px;border-radius:8px;}

/* Respect du réglage système « réduire les animations » — une seule règle pour toute l'application */
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{
    animation-duration:.001ms!important;animation-iteration-count:1!important;
    transition-duration:.001ms!important;scroll-behavior:auto!important;}
}
```

### Responsive : tiroir + voile + barre mobile

```css
.mobilebar{display:none;} .sb-scrim{display:none;}

@media(max-width:900px){
  .mm-root{display:block;}
  .sb{position:fixed;top:0;left:0;width:268px;max-width:84vw;height:100vh;flex:none;z-index:90;
    transform:translateX(-100%);transition:transform .26s cubic-bezier(.4,0,.2,1);
    box-shadow:0 24px 60px rgba(20,32,58,.4);}
  .mm-root.nav-open .sb{transform:translateX(0);}
  .sb-scrim{display:block;position:fixed;inset:0;background:rgba(20,32,58,.5);z-index:85;
    opacity:0;pointer-events:none;transition:opacity .26s;backdrop-filter:blur(2px);}
  .mm-root.nav-open .sb-scrim{opacity:1;pointer-events:auto;}
  .main{padding:0 14px 54px;min-height:100vh;}
  .mobilebar{display:flex;align-items:center;gap:11px;position:sticky;top:0;z-index:40;
    background:var(--bg);margin:0 -14px 12px;padding:9px 12px;border-bottom:1px solid var(--line);}
  .mobilebar .mtitle{flex:1;min-width:0;font-weight:800;font-size:16px;
    font-family:'Bricolage Grotesque',sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .main .grid{grid-template-columns:1fr!important;}
  .row2{flex-direction:column;} .kan{grid-template-columns:1fr;}
  .card{padding:14px;border-radius:16px;}
  .iconbtn{width:36px;height:36px;}                       /* cibles tactiles agrandies */
  .mobilebar .iconbtn,.navarrows .iconbtn{width:40px;height:40px;}
}

@media(max-width:560px){
  html,body{overflow-x:hidden;}
  .btn{min-height:42px;} .chip{min-height:34px;}
  .fld input,.fld select,.fld textarea{min-height:42px;font-size:14px;}  /* 14px : pas de zoom iOS */
  /* Les filtres deviennent un bandeau qui défile, au lieu d'un empilement qui mange la hauteur */
  .filtbar .grp{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;}
  .filtbar .grp::-webkit-scrollbar{display:none;}
  .filtbar .grp>*{flex:0 0 auto;}
  /* Les tableaux défilent à l'intérieur d'eux-mêmes plutôt que de déborder la page */
  .tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}
}
```

**Deux commandes flottantes utiles**, empilées sur le même axe vertical que l'assistant
(22 + 58/2 = 51 px du bord droit) pour former une colonne et non un amas :

```css
/* Flèches haut/bas — z-index 35 : au-dessus du contenu, sous la barre d'actions (40) et les modales (50) */
.scrollarrows{position:fixed;right:32px;bottom:92px;z-index:35;display:flex;flex-direction:column;gap:8px;}
.scrollarrows button{width:38px;height:38px;display:grid;place-items:center;border-radius:50%;
  cursor:pointer;color:var(--blue);background:var(--card);border:1px solid var(--line);
  box-shadow:0 4px 14px rgba(20,32,58,.16);
  transition:transform .16s cubic-bezier(.2,.8,.2,1),box-shadow .18s ease,opacity .18s ease;}
.scrollarrows button:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 24px rgba(20,32,58,.24);}
/* Bout de course : la flèche s'efface sans disparaître, la paire ne saute pas d'un cran */
.scrollarrows button:disabled{opacity:.32;cursor:default;box-shadow:none;}
@media (max-width:760px){.scrollarrows{right:34px;}.scrollarrows button{width:34px;height:34px;}}
```

Les flèches ne s'affichent que si la page défile vraiment, avec un `ResizeObserver` sur
`document.body` — le contenu change de hauteur sans défilement ni redimensionnement
(filtre appliqué, fiche dépliée) et les flèches resteraient sinon dans un état faux.
Marge de 4 px : les hauteurs sous-pixel d'un zoom navigateur laissent sinon les deux
flèches actives en permanence.

Barre d'actions groupées, centrée en bas :

```jsx
<div className="bulkbar" style={{position:"fixed",left:"50%",transform:"translateX(-50%)",bottom:18,
  zIndex:40,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",justifyContent:"center",
  maxWidth:"min(960px, 94vw)",background:"var(--card)",border:"1px solid var(--line)",
  borderRadius:14,boxShadow:"0 12px 40px rgba(20,32,58,.28)",padding:"10px 14px"}}>
```

### PWA

`index.html` :

```html
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="apple-touch-icon" href="/icon-192.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="MATMAT" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="theme-color" content="#3F60AA" />
<meta name="color-scheme" content="light dark" />
```

`manifest.webmanifest` :

```json
{
  "name": "MATMAT", "short_name": "MATMAT", "lang": "fr",
  "start_url": "/", "scope": "/", "display": "standalone", "orientation": "portrait-primary",
  "background_color": "#fff8ea", "theme_color": "#3F60AA",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

`sw.js` — réseau d'abord pour la navigation, cache d'abord pour les fichiers empreintés :

```js
const CACHE = "matmat-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install",  e => e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys()
  .then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));

self.addEventListener("fetch", (e) => {
  const req = e.request; if(req.method!=="GET") return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;   // ne jamais intercepter les tiers
  if(url.pathname.startsWith("/api/")) return;      // les relais serveur vont droit au réseau

  if(req.mode === "navigate"){                      // réseau d'abord, cache en repli hors ligne
    e.respondWith(fetch(req).then(res=>{ const c=res.clone(); caches.open(CACHE).then(k=>k.put("/index.html",c)); return res; })
      .catch(()=>caches.match("/index.html")));
    return;
  }
  if(url.pathname.startsWith("/assets/")){          // fichiers empreintés Vite : immuables
    e.respondWith(caches.match(req).then(hit => hit ||
      fetch(req).then(res=>{ const c=res.clone(); caches.open(CACHE).then(k=>k.put(req,c)); return res; })));
  }
});
```

Enregistrement dans `main.jsx` :

```js
if("serviceWorker" in navigator){
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(()=>{}));
}
```

### Filet de sécurité au rendu

Une erreur React ne doit jamais produire une page blanche :

```jsx
class ErrorBoundary extends React.Component {
  constructor(p){ super(p); this.state = {error:null}; }
  static getDerivedStateFromError(error){ return {error}; }
  render(){
    if(!this.state.error) return this.props.children;
    return (<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      padding:24,fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",background:"#fff8ea",color:"#16203a"}}>
      <div style={{maxWidth:460,background:"#fff",border:"1px solid #ece3d2",borderRadius:18,
        padding:"26px 24px",boxShadow:"0 12px 40px rgba(20,32,58,.14)",textAlign:"center"}}>
        <div style={{fontSize:30,marginBottom:8}}>⚠️</div>
        <h1 style={{fontSize:19,margin:"0 0 8px"}}>Une erreur inattendue est survenue</h1>
        <p style={{fontSize:14,color:"#6b7589",lineHeight:1.55,margin:"0 0 18px"}}>
          Vos données sont en sécurité. Rechargez la page pour reprendre.</p>
        <button onClick={rechargerSurAccueil} style={{border:"none",cursor:"pointer",fontWeight:800,
          fontSize:14,color:"#fff",padding:"11px 20px",borderRadius:12,
          background:"linear-gradient(135deg,#3F60AA,#2f4c86)",fontFamily:"inherit"}}>
          Recharger l'application</button>
      </div></div>);
  }
}
```

**Le détail** : le rechargement doit **effacer le repère de navigation** et repartir sur
l'accueil. Sinon l'écran qui vient de planter est rouvert aussitôt, l'erreur réapparaît, et
le bouton donne l'impression de ne rien faire.

---

## Ordre de portage conseillé pour MATMAT

1. **Socle** (#1, #2, #9, #13, #24) — jetons, fond, boutons, modales. Une journée, tout
   le reste en dépend.
2. **Vie** (#14, #15, #16, #17, #20) — les micro-interactions. C'est ce qui fait dire
   « c'est agréable ».
3. **Chargement** (#18, #19) — squelettes et écran de démarrage. Effet immédiat sur la
   perception de vitesse.
4. **Thèmes** (#3 à #7) — le gros morceau, mais entièrement généré : environ 250 lignes.
5. **Verre** (#8, #27, #28) — après les thèmes, sinon le verre n'a rien à laisser voir.
6. **Navigation & info** (#10, #11, #12, #21, #22, #23, #26).
7. **Assistant** (#25) si MATMAT a une IA.
8. **Fondations** (#29, #30) — impression, accessibilité, PWA. À ne pas garder pour la
   fin : le responsive rattrapé après coup coûte trois fois plus cher.

## Ce qui n'est PAS à copier tel quel

- Les couleurs `--blue #3F60AA` / `--yellow #FFD212` / `--red #FF5A45` : c'est la charte
  PEN'UP 3D. Gardez les **rôles** (primaire, attention, danger), changez les valeurs.
- Le filet tricolore bleu/blanc/rouge de #10, la mascotte de #25, les bobines de #19, les
  bâtonnets « filaments » de #20 : ce sont des signatures de marque. Trouvez leur
  équivalent MATMAT.
- Le vocabulaire métier (devis, prospects, établissements, entonnoir commercial) : les
  composants sont réutilisables, les libellés non.
