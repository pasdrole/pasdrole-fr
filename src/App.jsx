import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Plus, X, ArrowLeft, Search, Home, LayoutGrid, Users, Shield, Star, Mail,
  TrendingUp, TrendingDown, Minus, Calendar, Crown, ChevronRight, ImageUp, LogIn, LogOut, UserCircle,
  FileJson, Check, AlertTriangle, Trash2, Eye, EyeOff, Wand2, Pencil, Skull, ExternalLink, Globe, Share, Video,
} from "lucide-react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { supabase } from "./supabaseClient";
import * as api from "./api";

const C = {
  bg: "#0B0A0D", panel: "#151318", panel2: "#1B1820", border: "#2A2630", borderHover: "#3B3544",
  gold: "#F0B429", goldSoft: "#FFD466", text: "#F5F2EC", dim: "#9A93A6", dim2: "#635C70",
  green: "#3FB878", red: "#E0574A",
};

// Correspondance page interne <-> URL propre (pour le référencement et le partage de liens).
const PAGE_PATHS = { home: "/", ranking: "/classements", comics: "/humoristes", contact: "/contact", mine: "/mon-espace", admin: "/admin", streamers: "/streamers" };

// Rubrique Streamers : masquée au public tant que la donnée n'est pas assez riche.
// Passe ce flag à true quand tu veux la rouvrir à tout le monde.
// En attendant, seul le compte admin continue de la voir (nav + pages), pour pouvoir la tester.
const STREAMERS_PUBLIC = false;

// Empreinte navigateur simple (anti-fraude "Sur le ring", en complément de l'IP vérifiée côté serveur).
// Ne cherche pas à être infalsifiable — juste à rendre le "vider son localStorage pour revoter" inefficace.
// Calculée une fois et mise en cache en session (pas besoin de la recalculer à chaque vote).
let _browserFingerprintCache = null;
async function getBrowserFingerprint() {
  if (_browserFingerprintCache) return _browserFingerprintCache;
  try {
    const raw = [
      navigator.userAgent, navigator.language, screen.width, screen.height, screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.hardwareConcurrency || "",
    ].join("|");
    const data = new TextEncoder().encode(raw);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    _browserFingerprintCache = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {
    _browserFingerprintCache = "fp-unavailable";
  }
  return _browserFingerprintCache;
}

const GENRE_OPTIONS = [
  "Sketch", "Satire", "Stand-up", "Imitation", "Impro", "Parodie", "Absurde",
  "Autodérision", "Storytelling", "Chronique", "Cynisme", "Provocation",
  "Observation", "Société", "Politique", "Introspection", "Féminisme",
  "Digital", "One-man-show", "Duo", "Jeu de mots", "Poésie", "Ironie",
  "Physique", "Franc-parler", "Punchlines", "Acteur", "Créateur de contenu",
];

// Expressions disponibles pour Mike (comic.expression_redaction) — illustrations dédiées
// dans public/ (une tête détourée par expression, cf. planche de style du mascot).
const MIKE_EXPRESSIONS = [
  { slug: "heureux", label: "Heureux", emoji: "😄", file: "01_heureux.svg" },
  { slug: "surpris", label: "Drôlement surpris", emoji: "😲", file: "02_drolement_surpris.svg" },
  { slug: "sceptique", label: "Sceptique", emoji: "🤨", file: "03_sceptique.svg" },
  { slug: "blase", label: "Blasé", emoji: "😑", file: "04_blase.svg" },
  { slug: "mdr", label: "Mort de rire", emoji: "🤣", file: "05_mort_de_rire.svg" },
  { slug: "decu", label: "Déçu", emoji: "😞", file: "06_decu.svg" },
  { slug: "colere", label: "En colère", emoji: "😠", file: "07_en_colere.svg" },
  { slug: "reflexion", label: "Réflexion", emoji: "🤔", file: "08_reflexion.svg" },
  { slug: "choque", label: "Choqué", emoji: "😱", file: "09_choque.svg" },
  { slug: "fier", label: "Fier", emoji: "😌", file: "10_fier.svg" },
  { slug: "dormeur", label: "Dormeur", emoji: "😴", file: "11_dormeur.svg" },
  { slug: "sarcastique", label: "Sarcastique", emoji: "😏", file: "12_sarcastique.svg" },
];
const MIKE_EXPRESSION_BY_SLUG = Object.fromEntries(MIKE_EXPRESSIONS.map((e) => [e.slug, e]));

// Poses "pleine figure" disponibles dans public/ (non utilisées ailleurs pour l'instant —
// réserve pour de futurs états de l'UI : chargement, page vide, confirmation...).
const MIKE_POSES = [
  { slug: "presente_la_note", label: "Présente la note", file: "01_presente_la_note.svg" },
  { slug: "reflechit", label: "Réfléchit", file: "02_reflechit.svg" },
  { slug: "applaudit", label: "Applaudit", file: "03_applaudit.svg" },
  { slug: "pouce_en_lair", label: "Pouce en l'air", file: "04_pouce_en_lair.svg" },
  { slug: "bof", label: "Bof...", file: "05_bof.svg" },
  { slug: "facepalm", label: "Facepalm", file: "06_facepalm.svg" },
];

// Correspondances pour retrouver le pays à partir d'un code court (FR, BE...) éventuellement stocké en base.
const COUNTRY_ALIASES = {
  "fr": "france", "be": "belgique", "ch": "suisse", "ca": "canada", "us": "états-unis", "ma": "maroc",
  "dz": "algérie", "tn": "tunisie", "ci": "côte d'ivoire", "sn": "sénégal", "cd": "congo", "gb": "royaume-uni",
  "uk": "royaume-uni", "it": "italie", "es": "espagne", "de": "allemagne", "lb": "liban", "pt": "portugal",
  "nl": "pays-bas", "algerie": "algérie", "etats-unis": "états-unis", "cote d'ivoire": "côte d'ivoire",
  "senegal": "sénégal", "reunion": "réunion", "haiti": "haïti",
};

// Drapeaux dessinés en SVG (couleurs officielles) — contrairement aux emoji 🇫🇷, ça s'affiche
// toujours correctement, même sur les configs Windows/navigateurs qui n'ont pas la police idoine.
const FLAG_DEFS = {
  "france": { dir: "v", colors: ["#0055A4", "#FFFFFF", "#EF4135"] },
  "belgique": { dir: "v", colors: ["#000000", "#FAE042", "#ED2939"] },
  "suisse": { dir: "cross", colors: ["#FF0000", "#FFFFFF"] },
  "canada": { dir: "v", colors: ["#FF0000", "#FFFFFF", "#FF0000"] },
  "maroc": { dir: "solid", colors: ["#C1272D"] },
  "algérie": { dir: "v", colors: ["#006233", "#FFFFFF"] },
  "tunisie": { dir: "solid", colors: ["#E70013"] },
  "côte d'ivoire": { dir: "v", colors: ["#F77F00", "#FFFFFF", "#009E60"] },
  "sénégal": { dir: "v", colors: ["#00853F", "#FDEF42", "#E31B23"] },
  "congo": { dir: "v", colors: ["#007FFF", "#F7D618", "#CE1021"] },
  "royaume-uni": { dir: "solid", colors: ["#00247D"] },
  "italie": { dir: "v", colors: ["#009246", "#FFFFFF", "#CE2B37"] },
  "espagne": { dir: "h", colors: ["#AA151B", "#F1BF00", "#AA151B"] },
  "allemagne": { dir: "h", colors: ["#000000", "#DD0000", "#FFCE00"] },
  "liban": { dir: "h", colors: ["#ED1C24", "#FFFFFF", "#ED1C24"] },
  "portugal": { dir: "v", colors: ["#046A38", "#DA291C"] },
  "pays-bas": { dir: "h", colors: ["#AE1C28", "#FFFFFF", "#21468B"] },
  "états-unis": { dir: "h", colors: ["#B22234", "#FFFFFF", "#3C3B6E"] },
  "réunion": { dir: "v", colors: ["#0055A4", "#FFFFFF", "#EF4135"] },
  "haïti": { dir: "h", colors: ["#00209F", "#D21034"] },
};

function FlagIcon({ pays, size = 18 }) {
  const key = (pays || "").trim().toLowerCase();
  const resolved = FLAG_DEFS[key] ? key : COUNTRY_ALIASES[key];
  const def = FLAG_DEFS[resolved];
  const w = size, h = Math.round(size * 0.72);
  const wrap = { display: "inline-block", width: w, height: h, borderRadius: 2, overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)", flexShrink: 0, verticalAlign: "middle" };
  if (!def) return <span title={pays} style={{ ...wrap, background: C.border }} />;
  if (def.dir === "solid") {
    return <span style={wrap}><svg width={w} height={h}><rect width={w} height={h} fill={def.colors[0]} /></svg></span>;
  }
  if (def.dir === "cross") {
    return (
      <span style={wrap}>
        <svg width={w} height={h}>
          <rect width={w} height={h} fill={def.colors[0]} />
          <rect x={w * 0.42} y={h * 0.15} width={w * 0.16} height={h * 0.7} fill={def.colors[1]} />
          <rect x={w * 0.2} y={h * 0.42} width={w * 0.6} height={h * 0.16} fill={def.colors[1]} />
        </svg>
      </span>
    );
  }
  const n = def.colors.length;
  const stripeW = w / n, stripeH = h / n;
  return (
    <span style={wrap}>
      <svg width={w} height={h}>
        {def.colors.map((c, i) => def.dir === "v"
          ? <rect key={i} x={i * stripeW} y={0} width={stripeW + 0.5} height={h} fill={c} />
          : <rect key={i} x={0} y={i * stripeH} width={w} height={stripeH + 0.5} fill={c} />
        )}
      </svg>
    </span>
  );
}
function CountryPill({ pays }) {
  return (
    <span style={{ fontSize: 11, background: C.panel2, border: `1px solid ${C.border}`, padding: "4px 11px 4px 6px", borderRadius: 20, color: C.dim, display: "inline-flex", alignItems: "center", gap: 6 }}>
      <FlagIcon pays={pays} size={16} /> {pays}
    </span>
  );
}

function slugifyGenre(g) {
  return (g || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/* ---------- SEO : titre, meta description, Open Graph, JSON-LD ---------- */
const SITE_NAME = "PasDrôle.fr";
const DEFAULT_TITLE = "PasDrôle.fr — Le classement des humoristes par le public";
const DEFAULT_DESCRIPTION = "Notez et classez vos humoristes préférés sur l'écriture, le jeu de scène, l'originalité et la présence scénique. Le classement des humoristes établi par le public.";
const DEFAULT_IMAGE = () => `${window.location.origin}/logo-mike.png`;

function upsertMeta(attr, key, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}
// Met à jour le titre d'onglet + la meta description + les balises Open Graph (aperçu de lien
// sur WhatsApp/Facebook/X/etc.). À appeler à chaque changement de page/fiche.
function applySEO({ title, description, image, url, noindex } = {}) {
  const t = title || DEFAULT_TITLE;
  const d = (description || DEFAULT_DESCRIPTION).slice(0, 160);
  document.title = t;
  upsertMeta("name", "description", d);
  upsertMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");
  upsertMeta("property", "og:site_name", SITE_NAME);
  upsertMeta("property", "og:type", "website");
  upsertMeta("property", "og:title", t);
  upsertMeta("property", "og:description", d);
  upsertMeta("property", "og:image", image || DEFAULT_IMAGE());
  upsertMeta("property", "og:url", url || window.location.href);
  upsertMeta("name", "twitter:card", "summary_large_image");
}
// Injecte/retire un bloc de données structurées schema.org (JSON-LD) — permet à Google
// d'afficher directement la note ⭐ dans les résultats de recherche pour une fiche humoriste.
function setJSONLD(id, data) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}
function removeJSONLD(id) {
  document.getElementById(id)?.remove();
}

const AVATAR_GRADIENTS = [
  ["#F0B429", "#C4402F"], ["#6C63C9", "#332C6B"], ["#3D9E7C", "#1A4636"], ["#D9695A", "#732A20"],
  ["#4A90B8", "#1C4256"], ["#B87FC9", "#54326B"], ["#E0A03F", "#7A4A1A"], ["#5FA8D3", "#264A63"],
];
function gradientFor(name) {
  let h = 0;
  for (let i = 0; i < (name || "?").length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length];
}
function initials(name) { return (name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase(); }

/* ---------- Atoms ---------- */
function MicIcon({ size = 14, filled }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" fill={filled ? C.gold : "none"} stroke={C.gold} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke={C.gold} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <line x1="12" x2="12" y1="19" y2="22" stroke={C.gold} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function Micros({ value, size = 14, max = 10 }) {
  const filled = Math.round(value);
  return (
    <div style={{ display: "flex", gap: 1 }}>
      {Array.from({ length: max }).map((_, i) => (
        <MicIcon key={i} size={size} filled={i < filled} />
      ))}
    </div>
  );
}
function PhotoPlaceholder({ size = 44, label, imgSrc }) {
  if (imgSrc) return <img src={imgSrc} alt={label || ""} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div title={label} style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: C.panel2, border: `1.5px dashed ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <ImageUp size={Math.max(12, size * 0.32)} color={C.dim2} strokeWidth={1.5} />
    </div>
  );
}
function Avatar({ name, size = 44, glow = false }) {
  const [c1, c2] = gradientFor(name);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      {glow && <div style={{ position: "absolute", inset: -6, borderRadius: "50%", background: `radial-gradient(circle, ${c1}55, transparent 70%)` }} />}
      <div style={{ position: "relative", width: size, height: size, borderRadius: "50%", background: `linear-gradient(145deg, ${c1}, ${c2})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: size * 0.34, color: "#fff", boxShadow: "0 6px 16px -4px rgba(0,0,0,0.5)" }}>
        {initials(name)}
      </div>
    </div>
  );
}
function VideoStars({ value, size = 14, interactive = false, onRate }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!interactive}
          onClick={() => onRate && onRate(n)}
          style={{ background: "none", border: "none", padding: 1, cursor: interactive ? "pointer" : "default" }}
        >
          <Star size={size} fill={value >= n ? C.gold : "none"} stroke={C.gold} strokeWidth={1.4} />
        </button>
      ))}
    </div>
  );
}
function Pill({ children }) { return <span style={{ fontSize: 11, background: C.panel2, border: `1px solid ${C.border}`, padding: "4px 11px", borderRadius: 20, color: C.dim }}>{children}</span>; }
function ClickablePill({ children, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        fontSize: 11, background: "rgba(240,180,41,0.12)", border: `1px solid rgba(240,180,41,0.4)`,
        padding: "4px 11px", borderRadius: 20, color: C.gold, cursor: "pointer",
        fontFamily: "inherit", transition: "background 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(240,180,41,0.22)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(240,180,41,0.12)")}
    >
      {children}
    </button>
  );
}
function SectionTitle({ children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ width: 8, height: 8, background: C.gold, transform: "rotate(45deg)", borderRadius: 2 }} />
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 21, letterSpacing: 1.5, color: C.text, margin: 0 }}>{children}</h2>
      </div>
      {right}
    </div>
  );
}
function GoldButton({ children, onClick, disabled, full, type = "button", pulse = false }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      width: full ? "100%" : undefined,
      background: disabled ? C.border : pulse ? `linear-gradient(145deg, #4FD98E, ${C.green})` : `linear-gradient(145deg, ${C.goldSoft}, ${C.gold})`,
      color: disabled ? C.dim2 : "#0D1F16", border: "none", padding: "11px 20px", borderRadius: 9,
      fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1, cursor: disabled ? "not-allowed" : "pointer",
      animation: pulse ? "pdPulse 1.6s ease-out infinite" : "none", transition: "background 0.3s ease",
    }}>{children}</button>
  );
}

/* ---------- Auth ---------- */
function AuthModal({ onClose, onAuthed }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr(""); setInfo(""); setLoading(true);
    try {
      if (mode === "signup") {
        if (!pseudo.trim()) throw new Error("Choisis un pseudo.");
        // Le pseudo passe par les métadonnées signUp : le trigger serveur handle_new_user()
        // crée le profil à l'insertion du compte, sans dépendre d'une session active côté client
        // (qui n'existe pas encore tant que l'email n'est pas confirmé).
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { pseudo: pseudo.trim() } } });
        if (error) throw error;
        setInfo("Compte créé. Vérifie ta boîte mail pour confirmer ton adresse avant de te connecter.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthed();
        onClose();
      }
    } catch (e) {
      setErr(e.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 16 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, maxWidth: 380, width: "100%", padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: C.text, margin: 0, letterSpacing: 1 }}>
            {mode === "login" ? "CONNEXION" : "CRÉER UN COMPTE"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.dim} /></button>
        </div>

        {mode === "signup" && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: C.dim, display: "block", marginBottom: 5 }}>Pseudo</label>
            <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Ton pseudo public"
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13 }} />
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: C.dim, display: "block", marginBottom: 5 }}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@exemple.com"
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: C.dim, display: "block", marginBottom: 5 }}>Mot de passe</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13 }} />
        </div>

        {err && <div style={{ color: C.red, fontSize: 12, marginBottom: 12 }}>{err}</div>}
        {info && <div style={{ color: C.green, fontSize: 12, marginBottom: 12 }}>{info}</div>}

        <GoldButton full disabled={loading || !email || !password || (mode === "signup" && !pseudo.trim())} onClick={submit}>
          {loading ? "..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
        </GoldButton>

        <p style={{ textAlign: "center", fontSize: 12, color: C.dim2, marginTop: 16 }}>
          {mode === "login" ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
          <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErr(""); setInfo(""); }} style={{ background: "none", border: "none", color: C.gold, cursor: "pointer", fontSize: 12 }}>
            {mode === "login" ? "Créer un compte" : "Se connecter"}
          </button>
        </p>
      </div>
    </div>
  );
}

/* ---------- Header ---------- */
function Header({ nav, navigate, query, setQuery, user, profile, onOpenAuth, onLogout, comicsWithStats, onOpenComic }) {
  const items = [
    { key: "home", label: "Accueil", icon: Home },
    { key: "ranking", label: "Classements", icon: LayoutGrid },
    { key: "comics", label: "Humoristes", icon: Users },
    ...(STREAMERS_PUBLIC || profile?.role === "admin" ? [{ key: "streamers", label: "Streamers", icon: Video }] : []),
    { key: "contact", label: "Contact", icon: Mail },
  ];
  const [showDropdown, setShowDropdown] = useState(false);
  const suggestions = query.trim()
    ? (comicsWithStats || []).filter((c) => c.nom.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : [];

  const pickSuggestion = (id) => {
    onOpenComic(id);
    setQuery("");
    setShowDropdown(false);
  };

  return (
    <header style={{ background: "rgba(21,19,24,0.9)", backdropFilter: "blur(14px)", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 1220, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <div onClick={() => navigate("home")} style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <img src="/logo-mike.png" alt="PasDrôle.fr" style={{ height: 168, width: "auto" }} />
          <div style={{ fontSize: 10.5, color: C.text, letterSpacing: 1.4, textAlign: "center" }}>LE CLASSEMENT DES HUMORISTES PAR LE PUBLIC</div>
        </div>
        <nav style={{ display: "flex", gap: 2 }}>
          {items.map((it) => (
            <button key={it.key} onClick={() => navigate(it.key)} style={{
              display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer",
              padding: "9px 13px", borderRadius: 7, color: nav.page === it.key ? C.gold : C.dim,
              borderBottom: nav.page === it.key ? `2px solid ${C.gold}` : "2px solid transparent",
              fontSize: 13, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1,
            }}><it.icon size={13} /> {it.label.toUpperCase()}</button>
          ))}
          {profile?.role === "admin" && (
            <button onClick={() => navigate("admin")} style={{
              display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer",
              padding: "9px 13px", borderRadius: 7, color: nav.page === "admin" ? C.gold : C.dim,
              borderBottom: nav.page === "admin" ? `2px solid ${C.gold}` : "2px solid transparent",
              fontSize: 13, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1,
            }}><Shield size={13} /> ADMIN</button>
          )}
        </nav>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 9, padding: "8px 13px", minWidth: 180 }}>
              <Search size={14} color={C.dim2} />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                placeholder="Rechercher..."
                style={{ background: "none", border: "none", outline: "none", color: C.text, fontSize: 13, width: "100%" }}
              />
            </div>
            {showDropdown && query.trim() && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", zIndex: 60, boxShadow: "0 12px 24px -8px rgba(0,0,0,0.5)" }}>
                {suggestions.length === 0 ? (
                  <div style={{ padding: "12px 14px", fontSize: 12.5, color: C.dim2 }}>Aucun résultat</div>
                ) : (
                  suggestions.map((c) => (
                    <button
                      key={c.id}
                      onMouseDown={() => pickSuggestion(c.id)}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", borderBottom: `1px solid ${C.border}` }}
                    >
                      <PhotoPlaceholder size={28} label={c.nom} imgSrc={c.photo_url} />
                      <span style={{ fontSize: 13, color: C.text }}>{c.nom}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => navigate("mine")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: C.text, fontSize: 12.5 }}>
                <UserCircle size={16} color={C.gold} /> {profile?.pseudo || "Mon compte"}
              </button>
              <button onClick={onLogout} title="Se déconnecter" style={{ background: "none", border: "none", cursor: "pointer" }}>
                <LogOut size={16} color={C.dim2} />
              </button>
            </div>
          ) : (
            <button onClick={onOpenAuth} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 14px", cursor: "pointer", color: C.text, fontSize: 12.5 }}>
              <LogIn size={14} /> Connexion
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/* ---------- Rating helpers ---------- */
// Moyenne par critère (pour le radar chart d'une fiche) — nécessite la grille de critères
// du comic concerné (dynamique selon sa catégorie), et les ratings avec leur rating_scores
// imbriqué (voir api.fetchRatingsForComic).
function perCriteriaAvg(ratings, criteriaList) {
  const out = {};
  (criteriaList || []).forEach((c) => {
    const vals = [];
    (ratings || []).forEach((r) => {
      const rs = (r.rating_scores || []).find((s) => s.criteria_id === c.id);
      if (rs && typeof rs.score === "number") vals.push(rs.score);
    });
    out[c.slug] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  });
  return out;
}
function computeAge(dateNaissance) {
  if (!dateNaissance) return null;
  const birth = new Date(dateNaissance);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}
// Moyenne générale d'un comic : chaque ligne "ratings" porte déjà score_global
// (calculé par trigger côté DB à partir des 3 critères de sa catégorie), donc on
// peut agréger tous les votes d'un comic peu importe leur catégorie/grille.
function overallAvg(ratings) {
  const vals = (ratings || []).map((r) => r.score_global).filter((v) => typeof v === "number" && v > 0);
  return { avg10: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0, votes: (ratings || []).length };
}
// Évolution au classement d'un humoriste : compare son rang actuel (parmi tous les humoristes
// déjà notés, triés par moyenne générale) au rang qu'il aurait eu il y a `days` jours, recalculé
// à partir des seules notes déjà présentes à cette date (via leur updated_at). Ne nécessite aucun
// stockage d'historique supplémentaire. `comics` doit contenir { id, avg10, votes, ratings }.
// Retourne une Map id -> { delta } (delta > 0 = a gagné des places), ou null si pas assez de recul.
function computeRankTrends(comics, days = 7) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const currentRanked = comics
    .filter((c) => c.votes > 0)
    .sort((a, b) => b.avg10 - a.avg10 || b.votes - a.votes);
  const currentRank = new Map(currentRanked.map((c, i) => [c.id, i + 1]));

  const previousRanked = comics
    .map((c) => {
      const older = (c.ratings || []).filter((r) => r.updated_at && new Date(r.updated_at).getTime() < cutoff);
      if (!older.length) return null;
      const { avg10, votes } = overallAvg(older);
      return votes > 0 ? { id: c.id, avg10, votes } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.avg10 - a.avg10 || b.votes - a.votes);
  const previousRank = new Map(previousRanked.map((c, i) => [c.id, i + 1]));

  const trends = new Map();
  comics.forEach((c) => {
    const cur = currentRank.get(c.id);
    const prev = previousRank.get(c.id);
    trends.set(c.id, cur && prev ? { delta: prev - cur } : null);
  });
  return trends;
}

/* ---------- Hero / listing ---------- */
function Hero({ comicsWithStats }) {
  const allVotes = comicsWithStats.reduce((s, c) => s + c.votes, 0);
  const avgs = comicsWithStats.map((c) => c.avg10).filter((v) => v > 0);
  const globalAvg = avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : 0;
  return (
    <div style={{ borderBottom: `1px solid ${C.border}`, background: `linear-gradient(180deg, #0E0C11, ${C.bg})` }}>
      <div style={{ maxWidth: 1220, margin: "0 auto", padding: "56px 24px 44px", display: "flex", gap: 40, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 420px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: C.gold, letterSpacing: 1.5, fontWeight: 600, marginBottom: 18, textTransform: "uppercase" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.gold }} /> Notation par critères · communauté publique
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, lineHeight: 0.98, letterSpacing: 0.5, color: C.text, margin: 0 }}>
            NOTEZ. CLASSEZ.<br />FAITES ENTENDRE<br /><span style={{ color: C.gold }}>VOTRE RIRE.</span>
          </h1>
          <p style={{ color: C.dim, fontSize: 15.5, marginTop: 18, maxWidth: 440, lineHeight: 1.6 }}>
            PasDrôle.fr référence les humoristes français et internationaux, notés par le public sur l'écriture, le jeu de scène, l'originalité et la présence.
          </p>
        </div>
        <div style={{ background: `linear-gradient(165deg, ${C.panel2}, ${C.panel})`, border: `1px solid ${C.border}`, borderRadius: 16, padding: "24px 28px", minWidth: 240 }}>
          <div style={{ fontSize: 11, color: C.dim2, letterSpacing: 1.2, textTransform: "uppercase" }}>La note moyenne générale</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, color: C.gold, margin: "6px 0 2px" }}>
            {globalAvg > 0 ? globalAvg.toFixed(1).replace(".", ",") : "—"} <span style={{ fontSize: 16, color: C.dim2, fontFamily: "Inter" }}>/10</span>
          </div>
          <Micros value={globalAvg} />
          <div style={{ fontSize: 11.5, color: C.dim2, marginTop: 8 }}>Basée sur {allVotes} vote{allVotes !== 1 ? "s" : ""}</div>
        </div>
      </div>
    </div>
  );
}

function TopStrip({ comicsWithStats, onOpen, limit = 10, title = "TOP DU MOMENT" }) {
  const ranked = useMemo(() => [...comicsWithStats].sort((a, b) => b.avg10 - a.avg10 || b.votes - a.votes).slice(0, limit), [comicsWithStats, limit]);
  // Le rang (1, 2, 3...) n'a de sens que pour les humoristes déjà notés — on numérote
  // uniquement ceux-là, les autres n'affichent aucun badge de classement.
  let voteRank = 0;
  return (
    <section style={{ maxWidth: 1220, margin: "0 auto", padding: "40px 24px 0" }}>
      <SectionTitle>{title}</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
        {ranked.map((c) => {
          const trend = c.trend;
          const stable = trend && trend.delta === 0;
          const hasVotes = c.votes > 0;
          const rank = hasVotes ? ++voteRank : null;
          return (
          <button key={c.id} onClick={() => onOpen(c.id)} style={{
            background: `linear-gradient(165deg, ${C.panel2}, ${C.panel})`,
            border: `1px solid ${rank === 1 ? "rgba(240,180,41,0.5)" : C.border}`, borderRadius: 14, padding: "18px 14px", cursor: "pointer", position: "relative", textAlign: "left",
          }}>
            {rank !== null && (
              <div style={{ position: "absolute", top: 10, left: 10, width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 800, background: rank === 1 ? `linear-gradient(145deg, ${C.goldSoft}, ${C.gold})` : C.panel2, color: rank === 1 ? "#1A1509" : C.dim2, border: rank === 1 ? "none" : `1px solid ${C.border}` }}>
                {rank === 1 ? <Crown size={12} /> : rank}
              </div>
            )}
            {trend && (
              <div title="Évolution au classement sur 7 jours" style={{
                position: "absolute", top: 10, right: 10, display: "flex", alignItems: "center", gap: 2,
                fontSize: 10.5, fontWeight: 700, color: stable ? C.dim2 : trend.delta > 0 ? C.green : C.red,
              }}>
                {stable ? <Minus size={11} /> : trend.delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {!stable && (trend.delta > 0 ? "+" : "-") + Math.abs(trend.delta)}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "center", marginTop: 10, marginBottom: 12 }}>
              <PhotoPlaceholder size={74} label={c.nom} imgSrc={c.photo_url} />
            </div>
            <div style={{ color: C.text, fontSize: 13.5, fontWeight: 600, textAlign: "center", marginBottom: 6 }}>{c.nom}</div>
            <div style={{ textAlign: "center", color: C.gold, fontFamily: "'Bebas Neue', sans-serif", fontSize: 18 }}>{c.avg10 > 0 ? c.avg10.toFixed(1).replace(".", ",") : "—"}<span style={{ fontSize: 11, color: C.dim2, fontFamily: "Inter" }}>/10</span></div>
            <div style={{ textAlign: "center", color: C.dim2, fontSize: 10.5 }}>({c.votes})</div>
          </button>
          );
        })}
      </div>
    </section>
  );
}

function LatestReviews({ onOpen }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.fetchLatestReviews(6)
      .then(setReviews)
      .catch((e) => console.error("Erreur derniers avis:", e))
      .finally(() => setLoading(false));
  }, []);

  if (loading || reviews.length === 0) return null;

  return (
    <section style={{ maxWidth: 1220, margin: "0 auto", padding: "40px 24px 0" }}>
      <SectionTitle>DERNIERS AVIS</SectionTitle>
      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 12 }}>
        {reviews.map((r) => (
          <button key={r.id} onClick={() => onOpen(r.comics?.id)} style={{
            flex: "0 0 260px", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14,
            padding: 16, cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <PhotoPlaceholder size={34} label={r.comics?.nom} imgSrc={r.comics?.photo_url} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: C.text, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.comics?.nom}</div>
                <div style={{ fontSize: 11, color: C.gold }}>{r.profiles?.pseudo || "Anonyme"}</div>
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.5, margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.content}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

function ComicGrid({ comicsWithStats, onOpen, title }) {
  return (
    <section style={{ maxWidth: 1220, margin: "0 auto", padding: "40px 24px" }}>
      <SectionTitle>{title} ({comicsWithStats.length})</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 16 }}>
        {comicsWithStats.map((c) => (
          <button key={c.id} onClick={() => onOpen(c.id)} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, cursor: "pointer", textAlign: "left", display: "flex", gap: 14, alignItems: "flex-start" }}>
            <PhotoPlaceholder size={74} label={c.nom} imgSrc={c.photo_url} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: C.text, fontSize: 14.5, fontWeight: 700, marginBottom: 3 }}>{c.nom}</div>
              <div style={{ color: C.dim2, fontSize: 11.5, marginBottom: 10 }}>{c.pays} · depuis {c.debut}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color: C.gold }}>{c.avg10 > 0 ? c.avg10.toFixed(1).replace(".", ",") : "—"}</span>
                <span style={{ fontSize: 11, color: C.dim2 }}>({c.votes} votes)</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ---------- Page liste par genre ---------- */
function GenrePage({ genre, comicsWithStats, onOpen }) {
  const list = useMemo(
    () => comicsWithStats.filter((c) =>
      (c.genres || "").split(",").map((s) => s.trim().toLowerCase()).includes((genre || "").toLowerCase())
    ),
    [comicsWithStats, genre]
  );
  useEffect(() => {
    applySEO({
      title: `Humoristes ${genre || ""} — Classement | ${SITE_NAME}`,
      description: `Découvrez tous les humoristes de type ${genre || ""} notés par le public sur ${SITE_NAME} : ${list.slice(0, 6).map((c) => c.nom).join(", ")}.`,
      url: `${window.location.origin}/genre/${slugifyGenre(genre)}`,
    });
    return () => applySEO();
  }, [genre, list]);
  return <ComicGrid comicsWithStats={list} onOpen={onOpen} title={`GENRE · ${(genre || "").toUpperCase()}`} />;
}

/* ---------- Detail page with rating + review, edit own ---------- */
/* ---------- Bloc vidéo (embed + notation dédiée) ---------- */
function VideoBlock({ video, user, onRequireAuth }) {
  const [allRatings, setAllRatings] = useState([]);
  const [myRating, setMyRating] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await api.fetchVideoRatings(video.id);
      setAllRatings(all);
      if (user) {
        const mine = await api.fetchMyVideoRating(video.id, user.id);
        setMyRating(mine?.rating || 0);
      }
    } catch (e) {
      console.error("Erreur notes vidéo:", e);
    }
  }, [video.id, user]);

  useEffect(() => { load(); }, [load]);

  const avg = allRatings.length ? allRatings.reduce((a, b) => a + b.rating, 0) / allRatings.length : 0;

  const rate = async (n) => {
    if (!user) return onRequireAuth();
    setSaving(true);
    try {
      await api.upsertVideoRating(video.id, user.id, n);
      setMyRating(n);
      await load();
    } catch (e) {
      console.error("Erreur enregistrement note vidéo:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
        <iframe
          src={`https://www.youtube.com/embed/${video.youtube_video_id}`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
        />
      </div>
      <div style={{ fontSize: 12.5, color: C.text, marginBottom: 6 }}>{video.title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <VideoStars value={myRating} size={16} interactive={!saving} onRate={rate} />
        <span style={{ fontSize: 11, color: C.dim2 }}>
          {avg > 0 ? `${avg.toFixed(1)}/5 (${allRatings.length} vote${allRatings.length !== 1 ? "s" : ""})` : "Pas encore noté"}
        </span>
      </div>
    </div>
  );
}

/* ---------- Réseaux sociaux (fiche publique) ---------- */
// Icônes de marque en SVG (couleurs officielles) — pas de dépendance externe, se fond
// dans le thème sombre. Chaque icône reste reconnaissable même en petite taille.
const SOCIAL_ICON_DEFS = {
  instagram: {
    label: "Instagram",
    gradient: "linear-gradient(135deg, #f9ce34, #ee2a7b, #6228d7)",
    svg: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="5" stroke="#fff" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4.2" stroke="#fff" strokeWidth="1.8" />
        <circle cx="17.2" cy="6.8" r="1.1" fill="#fff" />
      </svg>
    ),
  },
  youtube: {
    label: "YouTube",
    gradient: "linear-gradient(135deg, #ff4e50, #cc1f2b)",
    svg: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="2.5" y="5.5" width="19" height="13" rx="4" stroke="#fff" strokeWidth="1.8" />
        <path d="M10 9.2v5.6l5-2.8-5-2.8Z" fill="#fff" />
      </svg>
    ),
  },
  twitch: {
    label: "Twitch",
    gradient: "linear-gradient(135deg, #9b6cff, #6339c9)",
    svg: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M5 3 3.5 6.8v12.7h4.3V22l3.4-2.5h3L19.8 14V3H5Z" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
        <line x1="13.3" y1="6.8" x2="13.3" y2="11.8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="9.3" y1="6.8" x2="9.3" y2="11.8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  tiktok: {
    label: "TikTok",
    gradient: "linear-gradient(135deg, #25f4ee, #111, #fe2c55)",
    svg: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M14 3c.4 2.2 1.9 3.7 4.2 3.9v3c-1.5.1-2.9-.4-4.2-1.3v6.7a5.3 5.3 0 1 1-5.3-5.3c.3 0 .6 0 .9.1v3.1a2.3 2.3 0 1 0 1.6 2.1V3H14Z" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    ),
  },
  twitter: {
    label: "X",
    gradient: "linear-gradient(135deg, #333, #000)",
    svg: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M4 4l16 16M20 4 4 20" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  allocine: {
    label: "AlloCiné",
    gradient: "linear-gradient(135deg, #ffcc00, #e6a800)",
    svg: <Star size={15} fill="#fff" stroke="#fff" />,
  },
  wikipedia: {
    label: "Wikipédia",
    gradient: "linear-gradient(135deg, #4a4a4a, #1a1a1a)",
    svg: <span style={{ fontFamily: "serif", fontWeight: 700, fontSize: 13, color: "#fff" }}>W</span>,
  },
  website: { label: "Site officiel", gradient: `linear-gradient(135deg, ${C.goldSoft}, ${C.gold})`, svg: <Globe size={15} color="#1A1509" /> },
  spotify: {
    label: "Spotify",
    gradient: "linear-gradient(135deg, #2ee06a, #1a9e46)",
    svg: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9.2" stroke="#fff" strokeWidth="1.6" />
        <path d="M7 10.2c3-.9 7-.6 9.2.9M7.4 13c2.5-.7 5.6-.5 7.6.7M7.8 15.7c2-.5 4.4-.4 6 .5" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  facebook: {
    label: "Facebook",
    gradient: "linear-gradient(135deg, #4a7ce0, #2952a3)",
    svg: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M14 22v-8h2.7l.4-3.4H14V8.4c0-1 .3-1.6 1.7-1.6H17V3.8c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.8H8v3.4h2.6V22H14Z" fill="#fff" />
      </svg>
    ),
  },
  ticketing: { label: "Billetterie", gradient: `linear-gradient(135deg, ${C.goldSoft}, ${C.gold})`, svg: <ExternalLink size={14} color="#1A1509" /> },
  imdb: { label: "IMDb", gradient: "linear-gradient(135deg, #f5c518, #d4a800)", svg: <span style={{ fontWeight: 800, fontSize: 10, color: "#000" }}>IMDb</span> },
};
function formatFollowerCountPublic(count) {
  if (!count) return null;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(".0", "").replace(".", ",")} M`;
  if (count >= 1_000) return `${Math.round(count / 1000)} K`;
  return String(count);
}
function SocialLinksRow({ comicId }) {
  const [links, setLinks] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("social_links")
      .select("id, platform, url, follower_count")
      .eq("comedian_id", comicId)
      .eq("verification_status", "verified")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("Erreur chargement liens sociaux:", error);
        setLinks(data || []);
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [comicId]);

  if (!loaded || links.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
      {links.map((link) => {
        const def = SOCIAL_ICON_DEFS[link.platform] || { label: link.platform, gradient: C.panel2, svg: <ExternalLink size={14} color="#fff" /> };
        const followers = formatFollowerCountPublic(link.follower_count);
        return (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: 9, textDecoration: "none",
              background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 30,
              padding: "6px 14px 6px 6px", transition: "transform 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = C.borderHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = C.border; }}
          >
            <span style={{
              width: 30, height: 30, borderRadius: "50%", background: def.gradient,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              boxShadow: "0 2px 8px -2px rgba(0,0,0,0.5)",
            }}>
              {def.svg}
            </span>
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
              <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{def.label}</span>
              {followers && <span style={{ fontSize: 10.5, color: C.dim2 }}>{followers} abonnés</span>}
            </span>
          </a>
        );
      })}
    </div>
  );
}

// Encart "avis de la rédaction" : note + petit mot rédigés à la main par l'équipe PasDrôle,
// distincts des votes/avis publics (comic.note_redaction / comic.avis_redaction, remplis
// depuis l'admin). Ne s'affiche que si l'un des deux champs a été renseigné.
function RedactionCard({ comic }) {
  if (comic.note_redaction == null && !comic.avis_redaction) return null;
  return (
    <div style={{
      background: `linear-gradient(165deg, ${C.panel2}, ${C.panel})`,
      border: `1px solid rgba(240,180,41,0.35)`, borderRadius: 14, padding: 22,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <img src="/logo-mike_tete.png" alt="Mike, mascotte PasDrôle" style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0 }} />
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 1, color: C.gold }}>L'AVIS DE MIKE</span>
      </div>
      {comic.note_redaction != null && (() => {
        const expression = MIKE_EXPRESSION_BY_SLUG[comic.expression_redaction];
        // Reprend le look du panneau du logo (fond noir, liseré doré) que Mike "brandit" —
        // son expression (choisie par l'admin) déborde légèrement sur le panneau, comme sa
        // tête sur le logo principal.
        return (
          <div style={{ display: "flex", alignItems: "center", marginBottom: comic.avis_redaction ? 16 : 2 }}>
            {expression && (
              <img src={`/${expression.file}`} alt={expression.label} title={expression.label} style={{
                width: 54, height: 54, objectFit: "contain", flexShrink: 0, position: "relative", zIndex: 1,
                marginRight: -14, filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.6))",
              }} />
            )}
            <div style={{
              background: "#141018", border: `2px solid ${C.gold}`, borderRadius: 10,
              padding: expression ? "9px 16px 9px 24px" : "9px 16px", display: "flex", alignItems: "baseline", gap: 3,
            }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: C.gold, lineHeight: 1 }}>
                {Number(comic.note_redaction).toFixed(1).replace(".", ",")}
              </span>
              <span style={{ fontSize: 13, color: C.goldSoft, fontFamily: "Inter" }}>/10</span>
            </div>
          </div>
        );
      })()}
      {comic.avis_redaction && (
        <p style={{ color: C.dim, fontSize: 13, lineHeight: 1.6, margin: 0 }}>{comic.avis_redaction}</p>
      )}
    </div>
  );
}

function ComicDetail({ comicId, user, onBack, onRequireAuth, onOpenGenre }) {
  const [comic, setComic] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [myRating, setMyRating] = useState(null);
  const [myReview, setMyReview] = useState(null);
  const [draft, setDraft] = useState({});
  const [reviewDraft, setReviewDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [videos, setVideos] = useState([]);
  const [category, setCategory] = useState(null); // { category_id, category_slug, category_label }
  const [criteria, setCriteria] = useState([]); // grille de critères (3) de la catégorie du comic
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${window.location.origin}/${comic.slug}`;
    if (navigator.share) {
      try { await navigator.share({ title: `${comic.nom} — PasDrôle.fr`, url }); return; } catch (e) { /* annulé */ }
    }
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const c = await api.fetchComicById(comicId);
      setComic(c);
      setLoading(false); // la fiche peut s'afficher dès qu'on a l'humoriste

      // Catégorie + grille de critères de CE comic (nécessaire avant d'afficher le
      // formulaire de notation et le radar chart, qui sont dynamiques par catégorie).
      try {
        const cat = await api.fetchComicCategory(comicId);
        setCategory(cat);
        if (cat) setCriteria(await api.fetchCriteriaByCategory(cat.category_id));
        else setCriteria([]);
      } catch (e) {
        console.error("Erreur chargement catégorie/critères:", e);
        setCategory(null);
        setCriteria([]);
      }
      applySEO({
        title: `${c.nom} — Notes et avis | ${SITE_NAME}`,
        description: c.bio || `Découvrez les notes et avis du public sur ${c.nom}, humoriste ${c.pays || ""}.`,
        image: c.photo_url,
        url: `${window.location.origin}/${c.slug}`,
      });

      const [r, rv, vids] = await Promise.allSettled([
        api.fetchRatingsForComic(comicId),
        api.fetchReviewsForComic(comicId),
        api.fetchVideosForComic(comicId),
      ]);
      setRatings(r.status === "fulfilled" ? r.value : []);
      setReviews(rv.status === "fulfilled" ? rv.value : []);
      setVideos(vids.status === "fulfilled" ? vids.value : []);
      if (r.status === "rejected") console.error("Erreur notes:", r.reason);
      if (rv.status === "rejected") console.error("Erreur avis:", rv.reason);
      if (vids.status === "rejected") console.error("Erreur vidéos:", vids.reason);

      // Une fois les notes connues, on affine le titre et on publie les données structurées
      // (schema.org Person + AggregateRating) pour que Google puisse afficher la note ⭐ directement.
      if (r.status === "fulfilled" && r.value.length > 0) {
        const { avg10: a, votes: v } = overallAvg(r.value);
        applySEO({
          title: `${c.nom} — Noté ${a.toFixed(1).replace(".", ",")}/10 par le public | ${SITE_NAME}`,
          description: c.bio || `Découvrez les notes et avis du public sur ${c.nom}, humoriste ${c.pays || ""}.`,
          image: c.photo_url,
          url: `${window.location.origin}/${c.slug}`,
        });
        setJSONLD("jsonld-comic", {
          "@context": "https://schema.org",
          "@type": "Person",
          "name": c.nom,
          "image": c.photo_url || undefined,
          "url": `${window.location.origin}/${c.slug}`,
          "jobTitle": "Humoriste",
          "nationality": c.pays || undefined,
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": a.toFixed(1),
            "bestRating": "10",
            "worstRating": "0",
            "ratingCount": v,
          },
        });
      } else {
        removeJSONLD("jsonld-comic");
      }

      if (user) {
        const [mr, mrv] = await Promise.allSettled([
          api.fetchMyRating(comicId, user.id),
          api.fetchMyReview(comicId, user.id),
        ]);
        if (mr.status === "fulfilled" && mr.value) {
          setMyRating(mr.value);
          const scoresBySlug = {};
          (mr.value.rating_scores || []).forEach((rs) => {
            if (rs.criteria?.slug) scoresBySlug[rs.criteria.slug] = rs.score;
          });
          setDraft(scoresBySlug);
        }
        if (mrv.status === "fulfilled" && mrv.value) {
          setMyReview(mrv.value);
          setReviewDraft(mrv.value.content);
        }
      }
    } catch (e) {
      console.error("Erreur chargement fiche:", e);
      setLoadError("Impossible de charger cette fiche.");
      setLoading(false);
    }
  }, [comicId, user]);

  useEffect(() => { load(); }, [load]);

  // Remet le titre/meta par défaut et retire les données structurées en quittant la fiche.
  useEffect(() => {
    return () => { removeJSONLD("jsonld-comic"); applySEO(); };
  }, [comicId]);

  const { avg10, votes } = overallAvg(ratings);
  const per = perCriteriaAvg(ratings, criteria);
  const radarData = criteria.map((c) => ({ subject: c.label, value: per[c.slug] || 0, fullMark: 10 }));
  const canSubmitRating = criteria.length > 0 && criteria.every((c) => typeof draft[c.slug] === "number" && draft[c.slug] > 0);

  const submitRating = async () => {
    if (!user) return onRequireAuth();
    if (!category) { alert("Cet humoriste n'a pas encore de catégorie assignée — contacte l'admin."); return; }
    setSaving(true);
    try {
      await api.upsertRating(comicId, user.id, category.category_id, criteria, draft);
      await load();
    } catch (e) {
      console.error("Erreur enregistrement note:", e);
      alert("Impossible d'enregistrer la note : " + (e.message || "erreur inconnue"));
    } finally {
      setSaving(false);
    }
  };
  const submitReview = async () => {
    if (!user) return onRequireAuth();
    if (!reviewDraft.trim()) return;
    setSaving(true);
    try {
      await api.upsertReview(comicId, user.id, reviewDraft.trim(), comic?.nom);
      await load();
    } catch (e) {
      console.error("Erreur enregistrement avis:", e);
      alert("Impossible d'enregistrer l'avis : " + (e.message || "erreur inconnue"));
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return <div style={{ padding: 60, textAlign: "center", color: C.red }}>{loadError}</div>;
  }
  if (loading || !comic) {
    return <div style={{ padding: 60, textAlign: "center", color: C.dim }}>Chargement...</div>;
  }

  const genreList = (comic.genres || "").split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <div style={{ maxWidth: 1220, margin: "0 auto", padding: "24px 24px 60px" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: C.gold, fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1, marginBottom: 18, padding: 0 }}>
        <ArrowLeft size={16} /> RETOUR
      </button>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 420px" }}>
          <div style={{ background: `linear-gradient(165deg, ${C.panel2}, ${C.panel})`, border: `1px solid ${C.border}`, borderRadius: 18, padding: 30 }}>
            <div style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
              <PhotoPlaceholder size={100} label={comic.nom} imgSrc={comic.photo_url} />
              <div>
                <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, color: C.text, margin: 0 }}>{comic.nom}</h1>
                <div style={{ marginTop: 8 }}><CountryPill pays={comic.pays} /></div>
                <div style={{ display: "flex", gap: 7, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                  {genreList.map((g) => (
                    <ClickablePill key={g} title={`Voir tous les humoristes ${g}`} onClick={() => onOpenGenre(g)}>{g}</ClickablePill>
                  ))}
                  <Pill>depuis {comic.debut}</Pill>
                  {computeAge(comic.date_naissance) !== null && <Pill>{computeAge(comic.date_naissance)} ans</Pill>}
                </div>
                <button onClick={share} style={{ display: "flex", alignItems: "center", gap: 6, background: `linear-gradient(145deg, ${C.goldSoft}, ${C.gold})`, border: "none", borderRadius: 9, padding: "8px 16px", cursor: "pointer", color: "#1A1509", fontSize: 12.5, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, marginTop: 10 }}>
                  <Share size={15} /> {copied ? "LIEN COPIÉ !" : "PARTAGER CETTE FICHE"}
                </button>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 0", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, marginBottom: 18, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, color: C.gold }}>{avg10 > 0 ? avg10.toFixed(1).replace(".", ",") : "—"}<span style={{ fontSize: 16, color: C.dim2, fontFamily: "Inter" }}>/10</span></span>
              <Micros value={avg10} size={18} />
              <span style={{ fontSize: 12, color: C.dim2 }}>{votes} vote{votes !== 1 ? "s" : ""}</span>
            </div>
            <p style={{ color: C.dim, fontSize: 14, lineHeight: 1.7, marginBottom: 14 }}>{comic.bio}</p>
            {comic.spectacles?.length > 0 && <div style={{ fontSize: 13, color: C.dim2, marginBottom: 10 }}><strong style={{ color: C.text }}>Spectacles :</strong> {comic.spectacles.join(", ")}</div>}
            <SocialLinksRow comicId={comicId} />

            {votes > 0 ? (
              <div style={{ marginTop: 22, height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="75%">
                    <PolarGrid stroke={C.border} />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: C.dim, fontSize: 11 }} />
                    <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
                    <Radar dataKey="value" stroke={C.gold} fill={C.gold} fillOpacity={0.32} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ marginTop: 20, padding: 24, textAlign: "center", color: C.dim2, fontSize: 13, border: `1px dashed ${C.border}`, borderRadius: 12 }}>
                Pas encore de vote — sois le premier à noter {comic.nom.split(" ")[0]}.
              </div>
            )}

            {videos.length > 0 && (
              <div style={{ marginTop: 26 }}>
                <SectionTitle>VIDÉOS ({videos.length})</SectionTitle>
                {videos.map((v) => (
                  <VideoBlock key={v.id} video={v} user={user} onRequireAuth={onRequireAuth} />
                ))}
              </div>
            )}

            {/* Avis */}
            <div style={{ marginTop: 26 }}>
              <SectionTitle>AVIS ({reviews.length})</SectionTitle>
              {reviews.length === 0 && <div style={{ color: C.dim2, fontSize: 13 }}>Aucun avis pour l'instant.</div>}
              {reviews.map((r) => (
                <div key={r.id} style={{ padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 12.5, color: C.gold, fontWeight: 600, marginBottom: 4 }}>{r.profiles?.pseudo || "Anonyme"}</div>
                  <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.5 }}>{r.content}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ flex: "0 1 320px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22 }}>
            <SectionTitle>{myRating ? "MODIFIER MA NOTE" : "NOTER CET HUMORISTE"}</SectionTitle>
            {category && <div style={{ fontSize: 11, color: C.dim2, marginBottom: 12 }}>Grille · {category.category_label}</div>}
            {criteria.length === 0 && (
              <div style={{ fontSize: 12.5, color: C.dim2, marginBottom: 12 }}>Aucune catégorie assignée pour l'instant — notation indisponible.</div>
            )}
            {criteria.map((c) => (
              <div key={c.id} style={{ marginBottom: 15 }}>
                <span style={{ fontSize: 13, color: C.text, display: "block", marginBottom: 6 }}>{c.label}</span>
                <div style={{ display: "flex", gap: 1 }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <button key={n} onClick={() => setDraft({ ...draft, [c.slug]: n })} style={{ background: "none", border: "none", cursor: "pointer", padding: 1, flexShrink: 0 }}>
                      <MicIcon size={22} filled={(draft[c.slug] || 0) >= n} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <GoldButton full disabled={!canSubmitRating || saving} onClick={submitRating}>{myRating ? "Mettre à jour ma note" : "Valider la note"}</GoldButton>
            {!user && <div style={{ fontSize: 11.5, color: C.dim2, marginTop: 10, textAlign: "center" }}>Connexion requise pour voter</div>}
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22 }}>
            <SectionTitle>{myReview ? "MODIFIER MON AVIS" : "LAISSER UN AVIS"}</SectionTitle>
            <textarea value={reviewDraft} onChange={(e) => setReviewDraft(e.target.value)} rows={4} placeholder="Ton avis sur cet humoriste..."
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, resize: "vertical", marginBottom: 12 }} />
            <GoldButton full disabled={!reviewDraft.trim() || saving} onClick={submitReview}>{myReview ? "Mettre à jour mon avis" : "Publier mon avis"}</GoldButton>
            {myReview?.status === "pending" && <div style={{ fontSize: 11.5, color: C.gold, marginTop: 10, textAlign: "center" }}>En attente de validation par l'équipe</div>}
            {myReview?.status === "rejected" && <div style={{ fontSize: 11.5, color: C.red, marginTop: 10, textAlign: "center" }}>Cet avis n'a pas été validé</div>}
          </div>

          <RedactionCard comic={comic} />
        </div>
      </div>
    </div>
  );
}

/* ---------- Mode Match (duels) ---------- */
// Ordonne toujours la paire de la même façon (par slug alphabétique) pour que tous les votes
// d'un même duel — peu importe qui l'a lancé — retombent sur la même ligne en base.
function orderMatchPair(a, b) {
  return a.slug < b.slug ? [a, b] : [b, a];
}
function matchSlugFor(a, b) {
  const [first, second] = orderMatchPair(a, b);
  return `${first.slug}-vs-${second.slug}`;
}
function CrossedSwords({ size = 22, color = C.gold }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 3l8 8M21 3l-8 8M6 21l6-6M18 21l-6-6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.6" fill={color} />
    </svg>
  );
}
function MatchCTA({ onLaunch }) {
  return (
    <section style={{ maxWidth: 1220, margin: "0 auto", padding: "40px 24px 0" }}>
      <SectionTitle>DUEL AU HASARD</SectionTitle>
      <button onClick={onLaunch} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
        background: `linear-gradient(120deg, ${C.panel2}, ${C.panel})`, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: "22px 20px", cursor: "pointer", textAlign: "center",
      }}>
        <CrossedSwords size={26} />
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1, color: C.text }}>
          <span style={{ color: C.gold }}>DUEL ALÉATOIRE</span>
        </span>
        <CrossedSwords size={26} />
      </button>
      <div style={{ textAlign: "center", fontSize: 11.5, color: C.dim2, marginTop: 8 }}>
        Votez, et le gagnant lance automatiquement un nouveau combat aléatoire !
      </div>
    </section>
  );
}
function StatBox({ icon, label, comic, count, accent, suffix }) {
  return (
    <div style={{ flex: "1 1 220px", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 18px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10, minHeight: 190 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: `${accent}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ fontSize: 10.5, color: C.dim2, letterSpacing: 0.8, textTransform: "uppercase" }}>{label}</div>
      </div>
      {comic ? (
        <>
          <PhotoPlaceholder size={76} label={comic.nom} imgSrc={comic.photo_url} />
          <div>
            <div style={{ fontSize: 15, color: C.text, fontWeight: 700 }}>{comic.nom}</div>
            <div style={{ fontSize: 12, color: accent, marginTop: 2 }}>{count} duel{count !== 1 ? "s" : ""} {suffix}{count !== 1 ? "s" : ""}</div>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12.5, color: C.dim2, marginTop: 20 }}>Pas encore de duels</div>
      )}
    </div>
  );
}
function MatchLeaderboard({ comics }) {
  const [votes, setVotes] = useState(null);

  useEffect(() => {
    api.fetchAllMatchVotes().then(setVotes).catch((e) => { console.error("Erreur stats duels:", e); setVotes([]); });
  }, []);

  const stats = useMemo(() => {
    if (!votes) return null;
    const comicById = Object.fromEntries(comics.map((c) => [c.id, c]));
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const tally = (rows) => {
      const wins = {}, losses = {};
      rows.forEach((v) => {
        const loserId = v.winner_id === v.comic_a_id ? v.comic_b_id : v.comic_a_id;
        wins[v.winner_id] = (wins[v.winner_id] || 0) + 1;
        losses[loserId] = (losses[loserId] || 0) + 1;
      });
      const top = (obj) => {
        const entries = Object.entries(obj).sort((a, b) => b[1] - a[1]);
        if (!entries.length) return null;
        const [id, count] = entries[0];
        return comicById[id] ? { comic: comicById[id], count } : null;
      };
      return { topWinner: top(wins), topLoser: top(losses) };
    };

    const allTime = tally(votes);
    const lastWeek = tally(votes.filter((v) => new Date(v.created_at).getTime() >= weekAgo));
    return { allTime, lastWeek };
  }, [votes, comics]);

  if (!stats) return null;

  return (
    <section style={{ maxWidth: 1220, margin: "0 auto", padding: "18px 24px 0" }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <StatBox icon={<Crown size={16} color={C.gold} />} label="Plus grand vainqueur" comic={stats.allTime.topWinner?.comic} count={stats.allTime.topWinner?.count} accent={C.gold} suffix="gagné" />
        <StatBox icon={<Skull size={16} color={C.red} />} label="Plus grand loser" comic={stats.allTime.topLoser?.comic} count={stats.allTime.topLoser?.count} accent={C.red} suffix="perdu" />
        <StatBox icon={<TrendingUp size={16} color={C.green} />} label="Vainqueur de la semaine" comic={stats.lastWeek.topWinner?.comic} count={stats.lastWeek.topWinner?.count} accent={C.green} suffix="gagné" />
        <StatBox icon={<TrendingDown size={16} color={C.red} />} label="Loser de la semaine" comic={stats.lastWeek.topLoser?.comic} count={stats.lastWeek.topLoser?.count} accent={C.red} suffix="perdu" />
      </div>
    </section>
  );
}
// Les 3 vignettes duel : gagnant de la semaine calendaire précédente (lundi 00:00 -> lundi 00:00),
// gagnant du mois civil précédent, et le N°1 all-time (le plus de victoires en duel cumulées).
function getMondayParis(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function DuelWinnerCard({ label, icon, data }) {
  return (
    <div style={{ flex: "1 1 220px", background: `linear-gradient(165deg, ${C.panel2}, ${C.panel})`, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 18px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 8, minHeight: 190 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {icon}
        <div style={{ fontSize: 10.5, color: C.dim2, letterSpacing: 0.8, textTransform: "uppercase" }}>{label}</div>
      </div>
      {data ? (
        <>
          <PhotoPlaceholder size={76} label={data.nom} imgSrc={data.photo_url} />
          <div>
            <div style={{ fontSize: 15, color: C.text, fontWeight: 700 }}>{data.nom}</div>
            <div style={{ fontSize: 12, color: C.gold, marginTop: 2 }}>{data.votes} victoire{data.votes !== 1 ? "s" : ""}</div>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12.5, color: C.dim2, marginTop: 20 }}>Pas encore de données</div>
      )}
    </div>
  );
}
function DuelWinnersStrip({ comics }) {
  const [weekWinner, setWeekWinner] = useState(null);
  const [monthWinner, setMonthWinner] = useState(null);
  const [allTimeWinner, setAllTimeWinner] = useState(null);

  useEffect(() => {
    api.fetchAllMatchVotes().then((votes) => {
      const comicById = Object.fromEntries(comics.map((c) => [c.id, c]));
      const topFrom = (rows) => {
        if (!rows.length) return null;
        const wins = {};
        rows.forEach((v) => { wins[v.winner_id] = (wins[v.winner_id] || 0) + 1; });
        const [id, count] = Object.entries(wins).sort((a, b) => b[1] - a[1])[0];
        return comicById[id] ? { ...comicById[id], votes: count } : null;
      };

      const now = new Date();
      const thisMonday = getMondayParis(now);
      const lastMonday = new Date(thisMonday); lastMonday.setDate(lastMonday.getDate() - 7);
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      setWeekWinner(topFrom(votes.filter((v) => { const t = new Date(v.created_at); return t >= lastMonday && t < thisMonday; })));
      setMonthWinner(topFrom(votes.filter((v) => { const t = new Date(v.created_at); return t >= lastMonthStart && t < thisMonthStart; })));
      setAllTimeWinner(topFrom(votes));
    }).catch((e) => console.error("Erreur vignettes duel:", e));
  }, [comics]);

  return (
    <section style={{ maxWidth: 1220, margin: "0 auto", padding: "18px 24px 0" }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <DuelWinnerCard label="Gagnant semaine précédente" icon={<Calendar size={16} color={C.gold} />} data={weekWinner} />
        <DuelWinnerCard label="Gagnant mois précédent" icon={<Calendar size={16} color={C.gold} />} data={monthWinner} />
        <DuelWinnerCard label="N°1 de tous les temps" icon={<Crown size={16} color={C.gold} />} data={allTimeWinner} />
      </div>
    </section>
  );
}

// "Combat du moment" : un duel choisi manuellement en admin, dont les votes sont comptabilisés
// jusqu'à clôture manuelle. Le résultat du dernier combat clôturé reste affiché en permanence
// sous la zone de vote (qu'un nouveau combat soit lancé ou non), et ouvre l'historique complet au clic.
function CombatDuMoment({ onOpenComic }) {
  const [combat, setCombat] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [voting, setVoting] = useState(false);

  const load = useCallback(async () => {
    const active = await api.fetchActiveCombat().catch((e) => { console.error("Erreur combat actif:", e); return null; });
    setCombat(active);
    setHasVoted(active ? !!localStorage.getItem(`combat_voted:${active.id}`) : false);
    api.fetchLastCombat().then(setLastResult).catch((e) => console.error("Erreur dernier combat:", e));
  }, []);

  useEffect(() => { load(); }, [load]);

  const vote = async (winnerId) => {
    if (!combat || hasVoted || voting) return;
    setVoting(true);
    try {
      const fingerprint = await getBrowserFingerprint();
      await api.submitCombatVote(combat.id, combat.comic_a_id, combat.comic_b_id, winnerId, fingerprint);
      localStorage.setItem(`combat_voted:${combat.id}`, "1");
      setHasVoted(true);
      const refreshed = await api.fetchActiveCombat();
      setCombat(refreshed);
    } catch (e) {
      if (e.code === "already_voted") {
        // Déjà voté depuis cette IP/empreinte (autre appareil, cache vidé...) : on aligne
        // l'état local plutôt que d'afficher une erreur, l'utilisateur a bien "déjà voté".
        localStorage.setItem(`combat_voted:${combat.id}`, "1");
        setHasVoted(true);
      } else {
        console.error("Erreur vote combat:", e);
      }
    } finally {
      setVoting(false);
    }
  };

  const openHistory = async () => {
    try { setHistory(await api.fetchCombatHistory()); setShowHistory(true); }
    catch (e) { console.error("Erreur historique combats:", e); }
  };

  if (!combat && !lastResult) return null; // rien à afficher tant qu'aucun combat n'a jamais été lancé

  const totalVotes = combat ? combat.votesA + combat.votesB : 0;
  const pctA = totalVotes > 0 ? Math.round((combat.votesA / totalVotes) * 100) : 50;
  const pctB = 100 - pctA;

  return (
    <section style={{ maxWidth: 1220, margin: "0 auto", padding: "40px 24px 0" }}>
      <SectionTitle>SUR LE RING</SectionTitle>

      {combat ? (
        <div style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
          <MatchFighterCard comic={combat.comic_a} picked={hasVoted} isWinner={combat.votesA >= combat.votesB} pct={pctA} disabled={hasVoted || voting} onPick={() => vote(combat.comic_a_id)} />
          <CrossedSwords size={26} />
          <MatchFighterCard comic={combat.comic_b} picked={hasVoted} isWinner={combat.votesB > combat.votesA} pct={pctB} disabled={hasVoted || voting} onPick={() => vote(combat.comic_b_id)} />
        </div>
      ) : (
        <div style={{ color: C.dim2, fontSize: 13, textAlign: "center", padding: "20px 0" }}>Aucun combat en cours pour le moment.</div>
      )}

      {lastResult && (
        <button onClick={openHistory} style={{
          marginTop: 22, width: "100%", textAlign: "left", cursor: "pointer",
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px",
        }}>
          <div style={{ fontSize: 10.5, color: C.dim2, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12, textAlign: "center" }}>
            Dernier combat — cliquez pour voir l'historique complet
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
            <div style={{ textAlign: "center" }}>
              <PhotoPlaceholder size={52} label={lastResult.comic_a.nom} imgSrc={lastResult.comic_a.photo_url} />
              <div style={{ fontSize: 12.5, color: C.text, marginTop: 6 }}>{lastResult.comic_a.nom}</div>
              <div style={{ fontSize: 11, color: C.dim2 }}>{lastResult.votes_a} votes</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <Crown size={20} color={C.gold} />
              <div style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>{lastResult.winner?.nom}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <PhotoPlaceholder size={52} label={lastResult.comic_b.nom} imgSrc={lastResult.comic_b.photo_url} />
              <div style={{ fontSize: 12.5, color: C.text, marginTop: 6 }}>{lastResult.comic_b.nom}</div>
              <div style={{ fontSize: 11, color: C.dim2 }}>{lastResult.votes_b} votes</div>
            </div>
          </div>
        </button>
      )}

      {showHistory && (
        <div onClick={() => setShowHistory(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, maxWidth: 640, width: "100%", maxHeight: "80vh", overflowY: "auto", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: C.text, letterSpacing: 1, margin: 0 }}>HISTORIQUE DES COMBATS</h3>
              <button onClick={() => setShowHistory(false)} style={{ background: "none", border: "none", color: C.dim, fontSize: 24, cursor: "pointer", lineHeight: 1 }}><X size={22} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {history.map((c) => {
                const total = c.votes_a + c.votes_b;
                const pA = total > 0 ? Math.round((c.votes_a / total) * 100) : 50;
                return (
                  <div key={c.id} style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 11, color: C.dim2, marginBottom: 8 }}>
                      {new Date(c.ended_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <PhotoPlaceholder size={38} label={c.comic_a.nom} imgSrc={c.comic_a.photo_url} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                          <span style={{ color: c.winner?.id === c.comic_a.id ? C.gold : C.text, fontWeight: c.winner?.id === c.comic_a.id ? 700 : 400 }}>{c.comic_a.nom}</span>
                          <span style={{ color: c.winner?.id === c.comic_b.id ? C.gold : C.text, fontWeight: c.winner?.id === c.comic_b.id ? 700 : 400 }}>{c.comic_b.nom}</span>
                        </div>
                        <div style={{ height: 6, background: C.bg, borderRadius: 10, overflow: "hidden", display: "flex" }}>
                          <div style={{ width: `${pA}%`, background: C.gold }} />
                          <div style={{ width: `${100 - pA}%`, background: C.dim2 }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: C.dim2, marginTop: 4 }}>
                          <span>{c.votes_a} votes</span>
                          <span>{c.votes_b} votes</span>
                        </div>
                      </div>
                      <PhotoPlaceholder size={38} label={c.comic_b.nom} imgSrc={c.comic_b.photo_url} />
                    </div>
                  </div>
                );
              })}
              {history.length === 0 && <div style={{ color: C.dim2, fontSize: 13, textAlign: "center", padding: "30px 0" }}>Aucun combat clôturé pour l'instant.</div>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function MatchFighterCard({ comic, picked, isWinner, pct, disabled, onPick }) {
  return (
    <button onClick={onPick} disabled={disabled} style={{
      flex: "1 1 200px", maxWidth: 260, background: `linear-gradient(165deg, ${C.panel2}, ${C.panel})`,
      border: `1.5px solid ${picked && isWinner ? C.gold : C.border}`, borderRadius: 18, padding: "26px 18px",
      cursor: disabled ? "default" : "pointer", textAlign: "center", position: "relative",
    }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <PhotoPlaceholder size={200} label={comic.nom} imgSrc={comic.photo_url} />
      </div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 19, color: C.text, letterSpacing: 0.5, marginBottom: picked ? 12 : 0 }}>{comic.nom}</div>
      {picked && (
        <>
          <div style={{ height: 8, background: C.bg, borderRadius: 20, overflow: "hidden", marginBottom: 6 }}>
            <div style={{ width: `${pct}%`, height: "100%", background: isWinner ? `linear-gradient(90deg, ${C.goldSoft}, ${C.gold})` : C.dim2, transition: "width 0.4s ease" }} />
          </div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: isWinner ? C.gold : C.dim }}>{pct}%</div>
        </>
      )}
    </button>
  );
}
function MatchPage({ comicA, comicB, matchSlug, onNewMatch }) {
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myPick, setMyPick] = useState(null); // id de l'humoriste choisi par ce visiteur
  const [copied, setCopied] = useState(false);
  const storageKey = `match_voted:${matchSlug}`;

  useEffect(() => {
    applySEO({
      title: `${comicA.nom} vs ${comicB.nom} — Qui l'emporte ? | ${SITE_NAME}`,
      description: `${comicA.nom} ou ${comicB.nom} ? Vote pour ton humoriste préféré dans ce duel sur ${SITE_NAME}.`,
      image: comicA.photo_url || comicB.photo_url,
      url: `${window.location.origin}/match/${matchSlug}`,
    });
    return () => applySEO();
  }, [comicA, comicB, matchSlug]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ordA, ordB] = orderMatchPair(comicA, comicB);
      const v = await api.fetchMatchVotes(ordA.id, ordB.id);
      setVotes(v);
    } catch (e) {
      console.error("Erreur chargement duel:", e);
    } finally {
      setLoading(false);
    }
  }, [comicA, comicB]);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    setMyPick(saved || null);
    load();
  }, [load, storageKey]);

  const vote = async (winner) => {
    if (myPick) return;
    setMyPick(winner.id);
    localStorage.setItem(storageKey, winner.id);
    try {
      const [ordA, ordB] = orderMatchPair(comicA, comicB);
      await api.submitMatchVote(ordA.id, ordB.id, winner.id);
      await load();
    } catch (e) {
      console.error("Erreur vote duel:", e);
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/match/${matchSlug}`;
    if (navigator.share) {
      try { await navigator.share({ title: `${comicA.nom} vs ${comicB.nom} — PasDrôle.fr`, url }); return; } catch (e) { /* annulé */ }
    }
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const total = votes.length;
  const votesFor = (id) => votes.filter((v) => v.winner_id === id).length;
  const pctFor = (id) => (total ? Math.round((votesFor(id) / total) * 100) : 0);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 60px", textAlign: "center" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 22 }}>
        <CrossedSwords size={20} />
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 2, color: C.dim }}>MODE MATCH</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, flexWrap: "wrap" }}>
        <MatchFighterCard comic={comicA} picked={!!myPick} isWinner={myPick === comicA.id} pct={pctFor(comicA.id)} disabled={!!myPick || loading} onPick={() => vote(comicA)} />
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: C.dim2 }}>VS</div>
        <MatchFighterCard comic={comicB} picked={!!myPick} isWinner={myPick === comicB.id} pct={pctFor(comicB.id)} disabled={!!myPick || loading} onPick={() => vote(comicB)} />
      </div>

      {myPick ? (
        <div style={{ marginTop: 22, color: C.dim2, fontSize: 12.5 }}>{total} vote{total !== 1 ? "s" : ""} sur ce duel</div>
      ) : (
        <div style={{ marginTop: 22, color: C.dim2, fontSize: 12.5 }}>Clique sur ton préféré</div>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 26, flexWrap: "wrap" }}>
        <GoldButton onClick={onNewMatch} pulse={!!myPick}>Nouveau duel</GoldButton>
        <button onClick={share} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${C.border}`, borderRadius: 9, padding: "11px 20px", cursor: "pointer", color: C.text, fontSize: 13, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>
          {copied ? "LIEN COPIÉ !" : "PARTAGER"}
        </button>
      </div>
    </div>
  );
}
function MyActivityPage({ user, profile, onOpenComic }) {
  const [data, setData] = useState(null);
  useEffect(() => { if (user) api.fetchMyActivity(user.id).then(setData); }, [user]);
  if (!data) return <div style={{ padding: 60, textAlign: "center", color: C.dim }}>Chargement...</div>;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px 60px" }}>
      <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: C.text, letterSpacing: 1 }}>MON ESPACE</h1>
      <p style={{ color: C.dim, fontSize: 13, marginBottom: 24 }}>Connecté en tant que {profile?.pseudo}. Tes notes et avis, modifiables à tout moment.</p>

      <SectionTitle>MES NOTES ({data.ratings.length})</SectionTitle>
      {data.ratings.length === 0 && <div style={{ color: C.dim2, fontSize: 13, marginBottom: 24 }}>Tu n'as encore noté personne.</div>}
      {data.ratings.map((r) => (
        <button key={r.id} onClick={() => onOpenComic(r.comics.id)} style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "10px 0", borderBottom: `1px solid ${C.border}`, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
          <span style={{ color: C.text, fontSize: 13.5 }}>{r.comics?.nom}</span>
          <span style={{ color: C.gold, fontSize: 12 }}>Modifier →</span>
        </button>
      ))}

      <div style={{ marginTop: 30 }}>
        <SectionTitle>MES AVIS ({data.reviews.length})</SectionTitle>
        {data.reviews.length === 0 && <div style={{ color: C.dim2, fontSize: 13 }}>Tu n'as encore laissé aucun avis.</div>}
        {data.reviews.map((r) => (
          <button key={r.id} onClick={() => onOpenComic(r.comics.id)} style={{ display: "block", width: "100%", padding: "10px 0", borderBottom: `1px solid ${C.border}`, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
            <div style={{ color: C.text, fontSize: 13.5, marginBottom: 4 }}>{r.comics?.nom}</div>
            <div style={{ color: C.dim, fontSize: 12.5 }}>{r.content}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Admin ---------- */
/* ---------- Onglet Admin : validation des liens sociaux ---------- */
const SOCIAL_PLATFORM_LABELS = {
  instagram: "Instagram", twitch: "Twitch", youtube: "YouTube", tiktok: "TikTok",
  twitter: "X / Twitter", allocine: "AlloCiné", imdb: "IMDb", wikipedia: "Wikipédia",
  website: "Site officiel", spotify: "Spotify", facebook: "Facebook", ticketing: "Billetterie",
};
const SOCIAL_CONFIDENCE_LABELS = {
  certain: { label: "Certain", color: C.green },
  probable: { label: "Probable", color: C.gold },
  incertain: { label: "Incertain", color: C.red },
};
function formatFollowerCount(count) {
  if (count === null || count === undefined) return "—";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(".0", "").replace(".", ",")} M`;
  if (count >= 1_000) return `${Math.round(count / 1000)} K`;
  return String(count);
}
function SocialLinksTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editUrl, setEditUrl] = useState("");
  const [busyIds, setBusyIds] = useState(new Set());
  const [platformFilter, setPlatformFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("social_links")
      .select("id, platform, url, follower_count, confidence, created_at, comedian_id, comics(nom)")
      .eq("verification_status", "pending")
      .order("created_at", { ascending: true });
    if (fetchError) setError(fetchError.message);
    else setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setBusy = (id, isBusy) => setBusyIds((prev) => {
    const next = new Set(prev);
    if (isBusy) next.add(id); else next.delete(id);
    return next;
  });

  const decide = async (id, status) => {
    setBusy(id, true);
    const { error: updateError } = await supabase.from("social_links").update({ verification_status: status }).eq("id", id);
    if (updateError) { setError(updateError.message); setBusy(id, false); return; }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const startEdit = (row) => { setEditingId(row.id); setEditUrl(row.url || ""); };
  const cancelEdit = () => { setEditingId(null); setEditUrl(""); };
  const saveEdit = async (id) => {
    setBusy(id, true);
    const { error: updateError } = await supabase.from("social_links").update({ url: editUrl.trim() }).eq("id", id);
    if (updateError) { setError(updateError.message); setBusy(id, false); return; }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, url: editUrl.trim() } : r)));
    setBusy(id, false);
    cancelEdit();
  };

  const visibleRows = platformFilter === "all" ? rows : rows.filter((r) => r.platform === platformFilter);
  const platformCounts = rows.reduce((acc, r) => { acc[r.platform] = (acc[r.platform] || 0) + 1; return acc; }, {});

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, maxWidth: 820 }}>
      <SectionTitle right={<span style={{ fontSize: 12, color: C.dim2 }}>{rows.length} en attente</span>}>LIENS SOCIAUX À VALIDER</SectionTitle>

      {error && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 14 }}>{error}</div>}

      {rows.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
          <button onClick={() => setPlatformFilter("all")} style={{
            fontSize: 11.5, padding: "5px 12px", borderRadius: 20, cursor: "pointer",
            border: `1px solid ${platformFilter === "all" ? C.gold : C.border}`,
            background: platformFilter === "all" ? "rgba(240,180,41,0.15)" : "transparent",
            color: platformFilter === "all" ? C.gold : C.dim,
          }}>Tous ({rows.length})</button>
          {Object.entries(platformCounts).map(([platform, count]) => (
            <button key={platform} onClick={() => setPlatformFilter(platform)} style={{
              fontSize: 11.5, padding: "5px 12px", borderRadius: 20, cursor: "pointer",
              border: `1px solid ${platformFilter === platform ? C.gold : C.border}`,
              background: platformFilter === platform ? "rgba(240,180,41,0.15)" : "transparent",
              color: platformFilter === platform ? C.gold : C.dim,
            }}>{SOCIAL_PLATFORM_LABELS[platform] || platform} ({count})</button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ color: C.dim2, fontSize: 13, textAlign: "center", padding: "40px 0" }}>Chargement...</div>
      ) : visibleRows.length === 0 ? (
        <div style={{ color: C.dim2, fontSize: 13, textAlign: "center", padding: "40px 0" }}>
          {rows.length === 0 ? "Rien à valider pour le moment." : "Aucun résultat pour ce filtre."}
        </div>
      ) : (
        visibleRows.map((row) => {
          const isBusy = busyIds.has(row.id);
          const conf = SOCIAL_CONFIDENCE_LABELS[row.confidence] || SOCIAL_CONFIDENCE_LABELS.probable;
          const isEditing = editingId === row.id;
          return (
            <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 4px", borderBottom: `1px solid ${C.border}`, opacity: isBusy ? 0.5 : 1 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: C.text, fontWeight: 600, marginBottom: 4 }}>{row.comics?.nom || "Nom inconnu"}</div>
                {isEditing ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} autoFocus
                      style={{ flex: 1, boxSizing: "border-box", padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12.5 }} />
                    <button onClick={() => saveEdit(row.id)} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 20, background: "rgba(63,184,120,0.15)", color: C.green, border: "none", cursor: "pointer" }}>OK</button>
                    <button onClick={cancelEdit} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 20, background: "rgba(154,147,166,0.15)", color: C.dim, border: "none", cursor: "pointer" }}>Annuler</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12, color: C.dim2 }}>
                    <span style={{ color: C.dim }}>{SOCIAL_PLATFORM_LABELS[row.platform] || row.platform}</span>
                    <a href={row.url} target="_blank" rel="noreferrer" style={{ color: C.gold, textDecoration: "none", wordBreak: "break-all" }}>{row.url}</a>
                    <span>{formatFollowerCount(row.follower_count)} abonnés</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: conf.color, textTransform: "uppercase", letterSpacing: 0.5 }}>{conf.label}</span>
                  </div>
                )}
              </div>
              {!isEditing && (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => decide(row.id, "verified")} disabled={isBusy} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 20, background: "rgba(63,184,120,0.15)", color: C.green, border: "none", cursor: "pointer" }}>Valider</button>
                  <button onClick={() => startEdit(row)} disabled={isBusy} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 20, background: "rgba(154,147,166,0.15)", color: C.dim, border: "none", cursor: "pointer" }}>Corriger</button>
                  <button onClick={() => decide(row.id, "rejected")} disabled={isBusy} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 20, background: "rgba(224,87,74,0.15)", color: C.red, border: "none", cursor: "pointer" }}>Rejeter</button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
/* ---------- Recherche vidéos YouTube (admin) ---------- */
/* ---------- Contact ---------- */
function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    setSending(true);
    try {
      await api.submitContactMessage(name.trim(), email.trim(), message.trim());
      setSent(true);
      setName(""); setEmail(""); setMessage("");
    } catch (e) {
      setErr(e.message || "Une erreur est survenue.");
    } finally {
      setSending(false);
    }
  };

  const canSubmit = name.trim() && email.trim() && message.trim() && !sending;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 24px 60px" }}>
      <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, color: C.text, letterSpacing: 1, marginBottom: 6 }}>CONTACT</h1>
      <p style={{ color: C.dim, fontSize: 14, marginBottom: 26 }}>Une question, une suggestion, un souci sur une fiche ? Écris-nous.</p>

      {sent ? (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 26, textAlign: "center" }}>
          <div style={{ color: C.green, fontSize: 15, marginBottom: 6 }}>Message envoyé !</div>
          <div style={{ color: C.dim, fontSize: 13 }}>On te répond dès que possible.</div>
        </div>
      ) : (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 26 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: C.dim, display: "block", marginBottom: 5 }}>Nom</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ton nom"
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13 }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: C.dim, display: "block", marginBottom: 5 }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@exemple.com"
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13 }} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 12, color: C.dim, display: "block", marginBottom: 5 }}>Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder="Ton message..."
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, resize: "vertical" }} />
          </div>
          {err && <div style={{ color: C.red, fontSize: 12, marginBottom: 14 }}>{err}</div>}
          <GoldButton full disabled={!canSubmit} onClick={submit}>{sending ? "Envoi..." : "Envoyer"}</GoldButton>
        </div>
      )}
    </div>
  );
}

function StreamVodBlock({ stream, user, onRequireAuth }) {
  const [allRatings, setAllRatings] = useState([]);
  const [myRating, setMyRating] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await api.fetchStreamVodRatings(stream.id);
      setAllRatings(all);
      if (user) {
        const mine = await api.fetchMyStreamVodRating(stream.id, user.id);
        setMyRating(mine?.rating || 0);
      }
    } catch (e) {
      console.error("Erreur notes VOD:", e);
    }
  }, [stream.id, user]);

  useEffect(() => { load(); }, [load]);

  const avg = allRatings.length ? allRatings.reduce((a, b) => a + b.rating, 0) / allRatings.length : 0;

  const rate = async (n) => {
    if (!user) return onRequireAuth();
    setSaving(true);
    try {
      await api.upsertStreamVodRating(stream.id, user.id, n);
      setMyRating(n);
      await load();
    } catch (e) {
      console.error("Erreur enregistrement note VOD:", e);
    } finally {
      setSaving(false);
    }
  };

  // Miniature Twitch : le template renvoyé par l'API contient %{width}x%{height} à remplacer.
  const thumbUrl = stream.vod_thumbnail_url ? stream.vod_thumbnail_url.replace("%{width}", "440").replace("%{height}", "248") : null;
  const vodUrl = stream.vod_video_id ? `https://www.twitch.tv/videos/${stream.vod_video_id}` : null;

  return (
    <div style={{ marginBottom: 22 }}>
      <a href={vodUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 10, overflow: "hidden", marginBottom: 8, background: C.panel2 }}>
        {thumbUrl && <img src={thumbUrl} alt={stream.vod_title || "VOD"} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.15)" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#9146FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ExternalLink size={18} color="#fff" />
          </div>
        </div>
      </a>
      <div style={{ fontSize: 12.5, color: C.text, marginBottom: 2 }}>{stream.vod_title || `Stream du ${new Date(stream.started_at).toLocaleDateString("fr-FR")}`}</div>
      <div style={{ fontSize: 11, color: C.dim2, marginBottom: 6 }}>{new Date(stream.started_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long" })}{stream.vod_views != null ? ` · ${stream.vod_views.toLocaleString("fr-FR")} vues` : ""}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <VideoStars value={myRating} size={16} interactive={!saving} onRate={rate} />
        <span style={{ fontSize: 11, color: C.dim2 }}>
          {avg > 0 ? `${avg.toFixed(1)}/5 (${allRatings.length} vote${allRatings.length !== 1 ? "s" : ""})` : "Pas encore noté"}
        </span>
      </div>
    </div>
  );
}

// ---------- Streamers (Indice de Forme) — phase privée : pages non liées dans la nav,
// en noindex, accessibles seulement par URL directe (admin, ou lien envoyé en outreach). ----------

function scoreLabel(score) {
  if (score >= 80) return { text: "En pleine bourre", color: C.green };
  if (score >= 60) return { text: "En forme", color: C.gold };
  if (score >= 40) return { text: "Rythme habituel", color: C.dim };
  return { text: "En retrait", color: C.red };
}

function StreamerScoreBadge({ score, size = 15 }) {
  const label = scoreLabel(score);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: size * 2.4, color: label.color, lineHeight: 1 }}>{Math.round(score)}</div>
      <div style={{ fontSize: size * 0.8, color: label.color }}>{label.text}</div>
    </div>
  );
}

function StreamersRankingPage({ onOpenStreamer }) {
  const [ranking, setRanking] = useState(null);

  const load = useCallback(() => {
    api.fetchStreamersRanking().then(setRanking).catch((e) => { console.error("Erreur classement streamers:", e); setRanking([]); });
  }, []);

  useEffect(() => {
    applySEO({ title: `Streamers | ${SITE_NAME}`, description: "Tous les streamers suivis par PasDrôle, en direct ou non, avec leur classement de forme.", url: `${window.location.origin}/streamers` });
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  if (ranking === null) return <div style={{ padding: 60, textAlign: "center", color: C.dim }}>Chargement...</div>;

  const formatDuree = (startedAt) => {
    const mins = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}`;
  };

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 24px 60px" }}>
      <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, color: C.text, letterSpacing: 1, marginBottom: 6 }}>STREAMERS</h1>
      <p style={{ color: C.dim, fontSize: 14, marginBottom: 26 }}>Qui est en direct maintenant, et qui performe le mieux sur ses 5 derniers lives.</p>

      {ranking.length === 0 ? (
        <div style={{ color: C.dim2, fontSize: 13 }}>Aucun streamer suivi pour l'instant.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ranking.map((s) => {
            const label = s.score ? scoreLabel(s.score.score_forme) : null;
            return (
              <div key={s.id} onClick={() => onOpenStreamer(s.twitch_login)} style={{
                display: "flex", alignItems: "center", gap: 14, background: C.panel,
                border: `1px solid ${s.live ? C.red : C.border}`, borderRadius: 12, padding: "14px 18px", cursor: "pointer",
              }}>
                <div style={{ position: "relative" }}>
                  <PhotoPlaceholder size={44} label={s.nom_affiche || s.twitch_login} imgSrc={s.avatar_url} />
                  {s.live && (
                    <span style={{
                      position: "absolute", bottom: -3, right: -3, width: 14, height: 14, borderRadius: "50%",
                      background: C.red, border: `2px solid ${C.panel}`,
                    }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{s.nom_affiche || s.twitch_login}</span>
                    {s.verified && <Check size={13} color={C.green} />}
                    {s.live && (
                      <span style={{ fontSize: 10, color: "#fff", background: C.red, borderRadius: 8, padding: "1px 7px", fontWeight: 700, letterSpacing: 0.3 }}>
                        ● EN DIRECT
                      </span>
                    )}
                    {s.score?.is_provisional && <span style={{ fontSize: 10, color: C.dim2, background: C.panel2, borderRadius: 8, padding: "1px 7px" }}>provisoire</span>}
                  </div>
                  <div style={{ fontSize: 12, color: label ? label.color : C.dim2 }}>
                    {s.live ? `En direct depuis ${formatDuree(s.live.started_at)}` : label ? label.text : "Pas encore assez de données"}
                  </div>
                  {s.verified && s.followers_count != null && (
                    <div style={{ fontSize: 11, color: C.dim2 }}>{s.followers_count.toLocaleString("fr-FR")} followers</div>
                  )}
                </div>
                {s.score && <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: label.color }}>{Math.round(s.score.score_forme)}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StreamerDetailPage({ twitchLogin, onBack, user, onRequireAuth }) {
  const [data, setData] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const load = useCallback(() => {
    api.fetchStreamerDetail(twitchLogin).then(setData).catch((e) => console.error("Erreur fiche streamer:", e));
  }, [twitchLogin]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!data?.streamer) return;
    applySEO({
      title: `${data.streamer.nom_affiche || data.streamer.twitch_login} — Indice de Forme | ${SITE_NAME}`,
      description: `Suivi de forme de ${data.streamer.nom_affiche || data.streamer.twitch_login} sur ses derniers lives Twitch.`,
      noindex: true,
    });
  }, [data]);

  if (!data) return <div style={{ padding: 60, textAlign: "center", color: C.dim }}>Chargement...</div>;
  const { streamer, history, streams } = data;
  const latestScore = history[history.length - 1];
  const sparkData = history.map((h) => ({ date: new Date(h.computed_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), score: Math.round(h.score_forme) }));

  const connectTwitch = () => {
    setConnecting(true);
    window.location.href = api.getTwitchConnectUrl(streamer.id);
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 60px" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 13, marginBottom: 18, padding: 0 }}>
        <ArrowLeft size={15} /> Retour
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}>
        <PhotoPlaceholder size={64} label={streamer.nom_affiche || streamer.twitch_login} imgSrc={streamer.avatar_url} />
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: C.text, letterSpacing: 1, margin: 0 }}>{streamer.nom_affiche || streamer.twitch_login}</h1>
            {streamer.verified && <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.green }}><Check size={13} /> Vérifié</span>}
          </div>
          <div style={{ fontSize: 12.5, color: C.dim2 }}>twitch.tv/{streamer.twitch_login}{streamer.verified && streamer.followers_count != null ? ` · ${streamer.followers_count.toLocaleString("fr-FR")} followers` : ""}</div>
        </div>
      </div>

      {latestScore ? (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, marginBottom: 20 }}>
          <StreamerScoreBadge score={latestScore.score_forme} />
          {latestScore.is_provisional && <div style={{ fontSize: 11.5, color: C.dim2, marginTop: 6 }}>Classement provisoire — encore peu de streams enregistrés.</div>}
          {sparkData.length > 1 && (
            <div style={{ height: 120, marginTop: 16 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.dim2 }} axisLine={{ stroke: C.border }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: C.dim2 }} axisLine={false} tickLine={false} width={26} />
                  <Tooltip contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="score" stroke={C.gold} strokeWidth={2} dot={{ r: 3, fill: C.gold }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ) : (
        <div style={{ color: C.dim2, fontSize: 13, marginBottom: 20 }}>Pas encore assez de streams clos pour calculer un score.</div>
      )}

      {!streamer.verified && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12.5, color: C.dim, maxWidth: 420 }}>Ce streamer n'a pas encore connecté son compte Twitch (badge vérifié + nombre de followers).</div>
          <button onClick={connectTwitch} disabled={connecting} style={{
            display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, padding: "9px 16px", borderRadius: 20, border: "none", cursor: "pointer",
            background: "#9146FF", color: "#fff", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, opacity: connecting ? 0.6 : 1,
          }}><ExternalLink size={13} /> CONNECTER TWITCH</button>
        </div>
      )}

      <SectionTitle>DERNIERS STREAMS</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {streams.map((s) => (
          s.vod_video_id ? (
            <StreamVodBlock key={s.id} stream={s} user={user} onRequireAuth={onRequireAuth} />
          ) : (
            <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", fontSize: 12.5 }}>
              <span style={{ color: C.dim }}>{new Date(s.started_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>
              <span style={{ color: C.text }}>{s.viewers_moyens ? Math.round(s.viewers_moyens).toLocaleString("fr-FR") : "—"} viewers moy.</span>
              <span style={{ color: C.dim2 }}>Pic {s.pic_viewers ? Math.round(s.pic_viewers).toLocaleString("fr-FR") : "—"}</span>
              {s.is_event && <span style={{ fontSize: 10, color: C.gold, background: "rgba(240,180,41,0.12)", borderRadius: 8, padding: "1px 7px" }}>événement</span>}
              {s.is_outlier_flagged && !s.is_event && <span style={{ fontSize: 10, color: C.red, background: "rgba(224,87,74,0.12)", borderRadius: 8, padding: "1px 7px" }}>pic atypique</span>}
              <span style={{ fontSize: 10, color: C.dim2 }}>VOD pas encore dispo (48-96h)</span>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

// ---------- Admin : gestion des streamers suivis ----------
function LiveStreamsPanel() {
  const [live, setLive] = useState(null);

  const load = useCallback(async () => {
    try { setLive(await api.fetchLiveStreams()); } catch (e) { console.error(e); setLive([]); }
  }, []);
  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  const formatDuree = (startedAt) => {
    const mins = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}`;
  };

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, maxWidth: 720, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: live && live.length ? C.red : C.dim2, display: "inline-block" }} />
        <SectionTitle>EN DIRECT MAINTENANT {live ? `(${live.length})` : ""}</SectionTitle>
      </div>
      {live === null && <div style={{ fontSize: 12.5, color: C.dim }}>Chargement...</div>}
      {live && live.length === 0 && <div style={{ fontSize: 12.5, color: C.dim }}>Aucun streamer suivi n'est en direct actuellement.</div>}
      {live && live.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {live.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 13, color: C.text }}>
                {s.nomAffiche} <span style={{ fontSize: 11, color: C.dim2 }}>· en direct depuis {formatDuree(s.startedAt)}</span>
              </div>
              <div style={{ fontSize: 12.5, color: C.gold, fontWeight: 600 }}>
                {s.viewers != null ? `${s.viewers.toLocaleString("fr-FR")} viewers` : "—"}
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 10.5, color: C.dim2, marginTop: 12 }}>Actualisé automatiquement toutes les 60 secondes.</div>
    </div>
  );
}

function StreamersAdminTab({ onOpenStreamer }) {
  const [streamers, setStreamers] = useState([]);
  const [newLogin, setNewLogin] = useState("");
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try { setStreamers(await api.fetchTrackedStreamersAdmin()); } catch (e) { console.error(e); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    setErr("");
    if (!newLogin.trim()) return;
    setAdding(true);
    try { await api.addTrackedStreamer(newLogin); setNewLogin(""); await load(); }
    catch (e) { setErr(e.message || "Erreur lors de l'ajout"); }
    finally { setAdding(false); }
  };

  const toggleTracked = async (s) => { await api.setStreamerTracked(s.id, !s.tracked); await load(); };
  const remove = async (s) => {
    if (!window.confirm(`Retirer ${s.twitch_login} du suivi ? Son historique sera supprimé.`)) return;
    await api.deleteStreamer(s.id); await load();
  };

  return (
    <div>
      <LiveStreamsPanel />
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, maxWidth: 720 }}>
        <SectionTitle>STREAMERS SUIVIS ({streamers.length})</SectionTitle>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input value={newLogin} onChange={(e) => setNewLogin(e.target.value)} placeholder="login Twitch (ex: kenji_stream)"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            style={{ flex: 1, padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13 }} />
          <GoldButton onClick={handleAdd} disabled={adding}>{adding ? "Ajout..." : "Ajouter"}</GoldButton>
        </div>
        {err && <div style={{ color: C.red, fontSize: 12, marginBottom: 14 }}>{err}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {streamers.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
              <div onClick={() => onOpenStreamer(s.twitch_login)} style={{ cursor: "pointer", fontSize: 13, color: C.text }}>
                {s.twitch_login} {s.verified && <Check size={12} color={C.green} style={{ verticalAlign: "middle" }} />} {!s.tracked && <span style={{ fontSize: 10.5, color: C.dim2 }}>(en pause)</span>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => toggleTracked(s)} style={{ fontSize: 11, padding: "5px 12px", borderRadius: 16, border: "none", cursor: "pointer", background: C.panel2, color: C.dim }}>
                  {s.tracked ? "Mettre en pause" : "Réactiver"}
                </button>
                <button onClick={() => remove(s)} style={{ fontSize: 11, padding: "5px 10px", borderRadius: 16, border: "none", cursor: "pointer", background: "rgba(224,87,74,0.12)", color: C.red }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VideoSearchModal({ comic, onClose }) {
  const [query, setQuery] = useState(`${comic.nom} humour spectacle`);
  const [results, setResults] = useState([]);
  const [existing, setExisting] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const loadExisting = useCallback(async () => {
    try { setExisting(await api.fetchVideosForComic(comic.id)); } catch (e) { console.error(e); }
  }, [comic.id]);
  useEffect(() => { loadExisting(); }, [loadExisting]);

  const search = async () => {
    setLoading(true); setErr(""); setResults([]);
    try {
      const r = await api.searchYouTubeVideos(query);
      setResults(r);
    } catch (e) {
      setErr(e.message || "Erreur de recherche");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (videoId) => setSelected((s) => ({ ...s, [videoId]: !s[videoId] }));

  const saveSelected = async () => {
    const toSave = results.filter((r) => selected[r.youtube_video_id]);
    if (!toSave.length) return;
    setLoading(true);
    try {
      await api.saveComicVideos(comic.id, toSave);
      setSelected({});
      setResults([]);
      await loadExisting();
    } catch (e) {
      setErr(e.message || "Erreur d'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  const removeExisting = async (videoId) => {
    await api.deleteComicVideo(videoId);
    await loadExisting();
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto", padding: 26 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: C.text, margin: 0 }}>VIDÉOS — {comic.nom}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.dim} /></button>
        </div>

        {existing.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: C.dim2, marginBottom: 8 }}>Déjà enregistrées ({existing.length})</div>
            {existing.map((v) => (
              <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                {v.thumbnail_url && <img src={v.thumbnail_url} alt="" style={{ width: 50, height: 32, objectFit: "cover", borderRadius: 4 }} />}
                <div style={{ flex: 1, fontSize: 12, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.title}</div>
                <button onClick={() => removeExisting(v.id)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={14} color={C.dim2} /></button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13 }} />
          <GoldButton onClick={search} disabled={loading}>{loading ? "..." : "Chercher"}</GoldButton>
        </div>

        {err && <div style={{ color: C.red, fontSize: 12, marginBottom: 12 }}>{err}</div>}

        {results.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: C.dim2, marginBottom: 8 }}>Résultats — coche celles à ajouter</div>
            {results.map((r) => (
              <label key={r.youtube_video_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", cursor: "pointer" }}>
                <input type="checkbox" checked={!!selected[r.youtube_video_id]} onChange={() => toggle(r.youtube_video_id)} />
                {r.thumbnail_url && <img src={r.thumbnail_url} alt="" style={{ width: 50, height: 32, objectFit: "cover", borderRadius: 4 }} />}
                <div style={{ flex: 1, fontSize: 12, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
              </label>
            ))}
            <div style={{ marginTop: 14 }}>
              <GoldButton full onClick={saveSelected} disabled={loading}>Enregistrer la sélection</GoldButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EditComicModal({ comic, onClose, onSaved }) {
  const [form, setForm] = useState({
    nom: comic.nom || "", pays: comic.pays || "", debut: comic.debut || "",
    genres: comic.genres || "", bio: comic.bio || "",
    spectaclesRaw: (comic.spectacles || []).join(", "),
    date_naissance: comic.date_naissance || "",
    category_id: "",
    note_redaction: comic.note_redaction != null ? String(comic.note_redaction) : "",
    avis_redaction: comic.avis_redaction || "",
    expression_redaction: comic.expression_redaction || "",
  });
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [socialLinks, setSocialLinks] = useState([]);
  const [newPlatform, setNewPlatform] = useState("instagram");
  const [newUrl, setNewUrl] = useState("");
  const [newFollowers, setNewFollowers] = useState("");
  const [savingLink, setSavingLink] = useState(false);

  const loadSocialLinks = useCallback(async () => {
    const { data, error } = await supabase
      .from("social_links")
      .select("id, platform, url, follower_count, verification_status")
      .eq("comedian_id", comic.id)
      .order("platform");
    if (error) console.error("Erreur chargement liens sociaux:", error);
    else setSocialLinks(data || []);
  }, [comic.id]);

  // Charge la liste des catégories + la catégorie actuelle du comic (select pré-rempli).
  useEffect(() => {
    (async () => {
      try {
        const [cats, current] = await Promise.all([api.fetchCategories(), api.fetchComicCategory(comic.id)]);
        setCategories(cats);
        if (current) setForm((f) => ({ ...f, category_id: current.category_id }));
      } catch (e) {
        console.error("Erreur chargement catégories:", e);
      }
    })();
    loadSocialLinks();
  }, [comic.id, loadSocialLinks]);

  // Ajoute un lien social directement en statut "verified" — c'est l'admin qui le rentre
  // à la main, pas besoin de repasser par la file de validation.
  const addSocialLink = async () => {
    if (!newUrl.trim()) return;
    setSavingLink(true);
    try {
      const { error } = await supabase.from("social_links").upsert({
        comedian_id: comic.id,
        platform: newPlatform,
        url: newUrl.trim(),
        follower_count: newFollowers ? parseInt(newFollowers, 10) : null,
        verification_status: "verified",
        confidence: "certain",
        source: "admin_manual",
        followers_updated_at: new Date().toISOString(),
      }, { onConflict: "comedian_id,platform" });
      if (error) throw error;
      setNewUrl(""); setNewFollowers("");
      await loadSocialLinks();
    } catch (e) {
      setErr(e.message || "Erreur lors de l'ajout du lien.");
    } finally {
      setSavingLink(false);
    }
  };

  const removeSocialLink = async (id) => {
    const { error } = await supabase.from("social_links").delete().eq("id", id);
    if (error) { setErr(error.message); return; }
    await loadSocialLinks();
  };

  const toggleGenre = (g) => {
    const current = (form.genres || "").split(",").map((s) => s.trim()).filter(Boolean);
    const next = current.includes(g) ? current.filter((x) => x !== g) : [...current, g];
    setForm({ ...form, genres: next.join(", ") });
  };

  const save = async () => {
    setSaving(true);
    setErr("");
    try {
      const noteRedactionValue = form.note_redaction.trim() === "" ? null : Number(form.note_redaction.replace(",", "."));
      if (noteRedactionValue !== null && (isNaN(noteRedactionValue) || noteRedactionValue < 0 || noteRedactionValue > 10)) {
        throw new Error("La note de Mike doit être comprise entre 0 et 10.");
      }
      await api.updateComic(comic.id, {
        nom: form.nom.trim(), pays: form.pays, debut: form.debut, genres: form.genres, bio: form.bio,
        date_naissance: form.date_naissance || null,
        spectacles: form.spectaclesRaw.split(",").map((s) => s.trim()).filter(Boolean),
        note_redaction: noteRedactionValue,
        avis_redaction: form.avis_redaction.trim() || null,
        expression_redaction: form.expression_redaction || null,
      });
      await api.setComicCategory(comic.id, form.category_id || null);
      await onSaved();
      onClose();
    } catch (e) {
      setErr(e.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, maxWidth: 560, width: "100%", maxHeight: "88vh", overflowY: "auto", padding: 26 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: C.text, margin: 0 }}>MODIFIER — {comic.nom}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} color={C.dim} /></button>
        </div>

        {["nom", "pays", "debut"].map((k) => (
          <input key={k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder={k}
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, marginBottom: 10 }} />
        ))}

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: C.dim2, marginBottom: 5 }}>Date de naissance</div>
          <input type="date" value={form.date_naissance || ""} onChange={(e) => setForm({ ...form, date_naissance: e.target.value })}
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13 }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: C.dim2, marginBottom: 5 }}>Catégorie (détermine la grille de notation)</div>
          <select value={form.category_id || ""} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13 }}>
            <option value="">— Non classé —</option>
            {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: C.dim2, marginBottom: 6 }}>Genres (clique pour ajouter/retirer)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {GENRE_OPTIONS.map((g) => {
              const selected = (form.genres || "").split(",").map((s) => s.trim()).includes(g);
              return (
                <button key={g} type="button" onClick={() => toggleGenre(g)} style={{
                  fontSize: 11.5, padding: "5px 12px", borderRadius: 20, cursor: "pointer",
                  border: `1px solid ${selected ? C.gold : C.border}`,
                  background: selected ? "rgba(240,180,41,0.15)" : "transparent",
                  color: selected ? C.gold : C.dim,
                }}>{g}</button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.dim2, marginBottom: 5 }}>Spectacles (séparés par des virgules)</div>
          <input value={form.spectaclesRaw} onChange={(e) => setForm({ ...form, spectaclesRaw: e.target.value })}
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13 }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: C.dim2, marginBottom: 5 }}>Bio</div>
          <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={4}
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, resize: "vertical" }} />
        </div>

        <div style={{ marginBottom: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.dim2, marginBottom: 10 }}>Note de Mike (optionnel — affichée avec Mike sur la fiche publique)</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <input type="number" min="0" max="10" step="0.1" value={form.note_redaction}
              onChange={(e) => setForm({ ...form, note_redaction: e.target.value })} placeholder="Note /10, ex: 7.5"
              style={{ flex: 1, boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13 }} />
            <select value={form.expression_redaction} onChange={(e) => setForm({ ...form, expression_redaction: e.target.value })}
              style={{ flex: 1, boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13 }}>
              <option value="">— Expression —</option>
              {MIKE_EXPRESSIONS.map((exp) => <option key={exp.slug} value={exp.slug}>{exp.emoji} {exp.label}</option>)}
            </select>
            {form.expression_redaction && MIKE_EXPRESSION_BY_SLUG[form.expression_redaction] && (
              <img src={`/${MIKE_EXPRESSION_BY_SLUG[form.expression_redaction].file}`} alt="" style={{ width: 40, height: 40, objectFit: "contain", flexShrink: 0 }} />
            )}
          </div>
          <textarea value={form.avis_redaction} onChange={(e) => setForm({ ...form, avis_redaction: e.target.value })} rows={4}
            placeholder="Le petit mot de Mike sur cet humoriste..."
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, resize: "vertical" }} />
        </div>

        <div style={{ marginBottom: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.dim2, marginBottom: 10 }}>Réseaux sociaux</div>

          {socialLinks.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {socialLinks.map((link) => (
                <div key={link.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                  <span style={{
                    fontSize: 10.5, padding: "3px 9px", borderRadius: 12, flexShrink: 0,
                    background: link.verification_status === "verified" ? "rgba(63,184,120,0.15)" : "rgba(154,147,166,0.15)",
                    color: link.verification_status === "verified" ? C.green : C.dim,
                  }}>{SOCIAL_ICON_DEFS[link.platform]?.label || link.platform}</span>
                  <a href={link.url} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 0, fontSize: 12, color: C.gold, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link.url}</a>
                  {link.follower_count && <span style={{ fontSize: 11, color: C.dim2, flexShrink: 0 }}>{formatFollowerCountPublic(link.follower_count)}</span>}
                  <button onClick={() => removeSocialLink(link.id)} style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}><Trash2 size={13} color={C.dim2} /></button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 6 }}>
            <select value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)}
              style={{ flexShrink: 0, width: 130, boxSizing: "border-box", padding: "8px 8px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12 }}>
              {Object.entries(SOCIAL_ICON_DEFS).map(([key, def]) => <option key={key} value={key}>{def.label}</option>)}
            </select>
            <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="URL du profil"
              style={{ flex: 1, minWidth: 0, boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12 }} />
            <input value={newFollowers} onChange={(e) => setNewFollowers(e.target.value.replace(/\D/g, ""))} placeholder="Abonnés"
              style={{ width: 78, flexShrink: 0, boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12 }} />
            <button onClick={addSocialLink} disabled={!newUrl.trim() || savingLink} style={{
              flexShrink: 0, fontSize: 12, padding: "8px 14px", borderRadius: 8, border: "none", cursor: newUrl.trim() ? "pointer" : "not-allowed",
              background: newUrl.trim() ? C.gold : C.border, color: newUrl.trim() ? "#1A1509" : C.dim2, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 0.5,
            }}>Ajouter</button>
          </div>
        </div>

        {err && <div style={{ color: C.red, fontSize: 12, marginBottom: 12 }}>{err}</div>}
        <GoldButton full disabled={saving} onClick={save}>{saving ? "Enregistrement..." : "Enregistrer"}</GoldButton>
      </div>
    </div>
  );
}

function AdminCombatTab() {
  const [comics, setComics] = useState([]);
  const [comicA, setComicA] = useState("");
  const [comicB, setComicB] = useState("");
  const [activeCombat, setActiveCombat] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setComics(await api.fetchComicsForCombatAdmin());
    setActiveCombat(await api.fetchActiveCombat());
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleLaunch = async () => {
    if (!comicA || !comicB || comicA === comicB) { alert("Choisis deux humoristes différents."); return; }
    setLoading(true);
    try { await api.launchCombat(comicA, comicB); setComicA(""); setComicB(""); await load(); }
    catch (e) { alert("Erreur : " + e.message); }
    finally { setLoading(false); }
  };

  const handleClose = async () => {
    if (!activeCombat) return;
    setLoading(true);
    try { await api.closeCombat(activeCombat); await load(); }
    catch (e) { alert("Erreur : " + e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, maxWidth: 720 }}>
      <SectionTitle>COMBAT DU MOMENT</SectionTitle>
      {activeCombat ? (
        <div>
          <div style={{ fontSize: 13, color: C.dim, marginBottom: 14 }}>
            Combat actif : <strong style={{ color: C.text }}>{activeCombat.comic_a.nom}</strong> vs <strong style={{ color: C.text }}>{activeCombat.comic_b.nom}</strong>
            {" "}({activeCombat.votesA} / {activeCombat.votesB} votes)
          </div>
          <button onClick={handleClose} disabled={loading} style={{
            fontSize: 12.5, padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer",
            background: "rgba(224,87,74,0.15)", color: C.red, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, opacity: loading ? 0.6 : 1,
          }}>CLÔTURER CE COMBAT</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select value={comicA} onChange={(e) => setComicA(e.target.value)} style={{ flex: "1 1 200px", padding: 10, borderRadius: 8, background: C.panel2, border: `1px solid ${C.border}`, color: C.text }}>
            <option value="">Humoriste A</option>
            {comics.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <select value={comicB} onChange={(e) => setComicB(e.target.value)} style={{ flex: "1 1 200px", padding: 10, borderRadius: 8, background: C.panel2, border: `1px solid ${C.border}`, color: C.text }}>
            <option value="">Humoriste B</option>
            {comics.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <button onClick={handleLaunch} disabled={loading} style={{
            fontSize: 12.5, padding: "10px 18px", borderRadius: 20, border: "none", cursor: "pointer",
            background: C.gold, color: "#1A1509", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, opacity: loading ? 0.6 : 1,
          }}>LANCER LE COMBAT</button>
        </div>
      )}
    </div>
  );
}

function AdminPage({ onRefreshPublic, onOpenComic, onOpenStreamer }) {
  const [comics, setComics] = useState([]);
  const [form, setForm] = useState({ nom: "", pays: "France", debut: "", genres: "", bio: "", spectaclesRaw: "", date_naissance: "", category_id: "" });
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.fetchCategories().then(setCategories).catch((e) => console.error("Erreur chargement catégories:", e));
  }, []);
  const [bulkRaw, setBulkRaw] = useState("");
  const [birthDatesRaw, setBirthDatesRaw] = useState("");
  const [birthDatesResult, setBirthDatesResult] = useState(null);
  const [uploadingPhotoId, setUploadingPhotoId] = useState(null);
  const [videoSearchComic, setVideoSearchComic] = useState(null);
  const [editComic, setEditComic] = useState(null);
  const [adminTab, setAdminTab] = useState("humoristes");
  // Persisté en localStorage : AdminPage est démonté à chaque fois qu'on quitte /admin
  // (voir App.jsx), un simple useState repartirait donc à false à chaque retour.
  const [sortAlpha, setSortAlpha] = useState(() => localStorage.getItem("pasdrole_admin_sortAlpha") === "1");
  useEffect(() => { localStorage.setItem("pasdrole_admin_sortAlpha", sortAlpha ? "1" : "0"); }, [sortAlpha]);
  const [adminSearch, setAdminSearch] = useState("");
  const [pendingReviews, setPendingReviews] = useState([]);
  const [pendingSocialCount, setPendingSocialCount] = useState(0);

  const loadPendingReviews = useCallback(async () => {
    try { setPendingReviews(await api.fetchPendingReviews()); } catch (e) { console.error(e); }
  }, []);
  useEffect(() => { loadPendingReviews(); }, [loadPendingReviews]);

  // Compte les liens sociaux en attente pour le badge de l'onglet (indépendant du composant
  // SocialLinksTab, qui ne monte que quand cet onglet est actif).
  useEffect(() => {
    supabase
      .from("social_links")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "pending")
      .then(({ count }) => setPendingSocialCount(count || 0))
      .catch((e) => console.error("Erreur comptage liens sociaux:", e));
  }, [adminTab]);

  const moderateReview = async (id, status) => {
    await api.updateReviewStatus(id, status);
    await loadPendingReviews();
  };

  const load = useCallback(async () => setComics(await api.fetchAllComicsAdmin()), []);
  useEffect(() => { load(); }, [load]);

  const handlePhotoUpload = async (comicId, file) => {
    if (!file) return;
    setUploadingPhotoId(comicId);
    try {
      await api.uploadComicPhoto(comicId, file);
      await load(); onRefreshPublic();
    } catch (e) {
      console.error("Erreur upload photo:", e);
      alert("Impossible d'uploader la photo : " + (e.message || "erreur inconnue"));
    } finally {
      setUploadingPhotoId(null);
    }
  };

  const quickAdd = async (status) => {
    if (!form.nom.trim()) return;
    const created = await api.createComic({
      nom: form.nom.trim(), pays: form.pays, debut: form.debut, genres: form.genres, bio: form.bio,
      date_naissance: form.date_naissance || null,
      spectacles: form.spectaclesRaw.split(",").map((s) => s.trim()).filter(Boolean), status,
    });
    if (form.category_id) {
      try { await api.setComicCategory(created.id, form.category_id); } catch (e) { console.error("Erreur assignation catégorie:", e); }
    }
    setForm({ nom: "", pays: "France", debut: "", genres: "", bio: "", spectaclesRaw: "", date_naissance: "", category_id: "" });
    await load(); onRefreshPublic();
  };

  // Parseur CSV "propre" : respecte les guillemets, donc une virgule DANS
  // "Sketch, Parodie" ne casse plus le découpage des colonnes suivantes.
  const parseCSVLine = (line) => {
    const result = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else { inQuotes = false; }
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ",") { result.push(cur); cur = ""; }
        else cur += ch;
      }
    }
    result.push(cur);
    return result;
  };

  const doBulkImport = async () => {
    const trimmed = bulkRaw.trim();
    if (!trimmed) return;
    let rows = [];
    if (trimmed.startsWith("[")) {
      rows = JSON.parse(trimmed);
    } else {
      const lines = trimmed.split("\n").filter((l) => l.trim());
      const header = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
      for (let i = 1; i < lines.length; i++) {
        const cells = parseCSVLine(lines[i]);
        const row = {};
        header.forEach((h, idx) => (row[h] = (cells[idx] || "").trim()));
        rows.push({ nom: row.nom, pays: row.pays, debut: row.debut, genres: row.genres, bio: row.bio, date_naissance: row.date_naissance || null, spectacles: (row.spectacles || "").split(";").filter(Boolean) });
      }
    }
    const existing = new Set(comics.map((c) => c.nom.toLowerCase()));
    const toAdd = rows.filter((r) => r.nom && !existing.has(r.nom.toLowerCase())).map((r) => ({ ...r, status: "draft" }));
    if (toAdd.length) await api.bulkCreateComics(toAdd);
    setBulkRaw(""); await load(); onRefreshPublic();
  };

  const doBirthDatesImport = async () => {
    const trimmed = birthDatesRaw.trim();
    if (!trimmed) return;
    const lines = trimmed.split("\n").filter((l) => l.trim());
    const header = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
    const updates = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = parseCSVLine(lines[i]);
      const row = {};
      header.forEach((h, idx) => (row[h] = (cells[idx] || "").trim()));
      if (row.nom && row.date_naissance) updates.push({ nom: row.nom, date_naissance: row.date_naissance });
    }
    const results = await api.bulkUpdateBirthDates(updates);
    setBirthDatesResult(results);
    await load(); onRefreshPublic();
  };

  const toggleStatus = async (c) => { await api.updateComicStatus(c.id, c.status === "draft" ? "published" : "draft"); await load(); onRefreshPublic(); };
  const remove = async (id) => { await api.deleteComic(id); await load(); onRefreshPublic(); };
  const publishAll = async () => {
    await Promise.all(comics.filter((c) => c.status === "draft").map((c) => api.updateComicStatus(c.id, "published")));
    await load(); onRefreshPublic();
  };
  const draftAll = async () => {
    await Promise.all(comics.filter((c) => c.status === "published").map((c) => api.updateComicStatus(c.id, "draft")));
    await load(); onRefreshPublic();
  };
  const deleteAll = async () => {
    if (!window.confirm(`Supprimer les ${comics.length} humoristes ? Cette action est irréversible.`)) return;
    await Promise.all(comics.map((c) => api.deleteComic(c.id)));
    await load(); onRefreshPublic();
  };
  const regenerateSlugs = async () => {
    if (!window.confirm("Régénérer les URL (slugs) de tous les humoristes ? À ne faire qu'une fois.")) return;
    const results = await api.regenerateAllSlugs();
    const errors = results.filter((r) => r.status === "error");
    alert(errors.length ? `Terminé avec ${errors.length} erreur(s).` : `${results.length} URL régénérées avec succès.`);
    await load(); onRefreshPublic();
  };

  return (
    <div style={{ maxWidth: 1220, margin: "0 auto", padding: "32px 24px 60px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <Shield size={22} color={C.gold} />
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: C.text, letterSpacing: 1, margin: 0 }}>PANNEAU ADMIN</h1>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button onClick={() => setAdminTab("humoristes")} style={{
          fontSize: 12.5, padding: "8px 16px", borderRadius: 20, border: "none", cursor: "pointer",
          background: adminTab === "humoristes" ? C.gold : C.panel2, color: adminTab === "humoristes" ? "#1A1509" : C.dim,
          fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1,
        }}>HUMORISTES</button>
        <button onClick={() => setAdminTab("avis")} style={{
          fontSize: 12.5, padding: "8px 16px", borderRadius: 20, border: "none", cursor: "pointer",
          background: adminTab === "avis" ? C.gold : C.panel2, color: adminTab === "avis" ? "#1A1509" : C.dim,
          fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, display: "flex", alignItems: "center", gap: 6,
        }}>AVIS {pendingReviews.length > 0 && <span style={{ background: adminTab === "avis" ? "#1A1509" : C.red, color: adminTab === "avis" ? C.gold : "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10.5 }}>{pendingReviews.length}</span>}</button>
        <button onClick={() => setAdminTab("liens")} style={{
          fontSize: 12.5, padding: "8px 16px", borderRadius: 20, border: "none", cursor: "pointer",
          background: adminTab === "liens" ? C.gold : C.panel2, color: adminTab === "liens" ? "#1A1509" : C.dim,
          fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, display: "flex", alignItems: "center", gap: 6,
        }}>LIENS SOCIAUX {pendingSocialCount > 0 && <span style={{ background: adminTab === "liens" ? "#1A1509" : C.red, color: adminTab === "liens" ? C.gold : "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10.5 }}>{pendingSocialCount}</span>}</button>
        <button onClick={() => setAdminTab("combat")} style={{
          fontSize: 12.5, padding: "8px 16px", borderRadius: 20, border: "none", cursor: "pointer",
          background: adminTab === "combat" ? C.gold : C.panel2, color: adminTab === "combat" ? "#1A1509" : C.dim,
          fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1,
        }}>COMBAT</button>
        <button onClick={() => setAdminTab("streamers")} style={{
          fontSize: 12.5, padding: "8px 16px", borderRadius: 20, border: "none", cursor: "pointer",
          background: adminTab === "streamers" ? C.gold : C.panel2, color: adminTab === "streamers" ? "#1A1509" : C.dim,
          fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1,
        }}>STREAMERS</button>
      </div>

      {adminTab === "combat" ? (
        <AdminCombatTab />
      ) : adminTab === "streamers" ? (
        <StreamersAdminTab onOpenStreamer={onOpenStreamer} />
      ) : adminTab === "avis" ? (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, maxWidth: 720 }}>
          <SectionTitle>AVIS EN ATTENTE ({pendingReviews.length})</SectionTitle>
          {pendingReviews.length === 0 && <div style={{ color: C.dim2, fontSize: 13 }}>Aucun avis en attente de validation.</div>}
          {pendingReviews.map((r) => (
            <div key={r.id} style={{ padding: "14px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={{ fontSize: 12.5, color: C.gold, fontWeight: 600 }}>{r.profiles?.pseudo || "Anonyme"}</span>
                <span style={{ fontSize: 11, color: C.dim2 }}>sur {r.comics?.nom || "?"}</span>
              </div>
              <p style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginBottom: 10 }}>{r.content}</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => moderateReview(r.id, "approved")} style={{ fontSize: 11.5, padding: "6px 14px", borderRadius: 20, background: "rgba(63,184,120,0.15)", color: C.green, border: "none", cursor: "pointer" }}>Valider</button>
                <button onClick={() => moderateReview(r.id, "rejected")} style={{ fontSize: 11.5, padding: "6px 14px", borderRadius: 20, background: "rgba(224,87,74,0.15)", color: C.red, border: "none", cursor: "pointer" }}>Refuser</button>
              </div>
            </div>
          ))}
        </div>
      ) : adminTab === "liens" ? (
        <SocialLinksTab />
      ) : (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22 }}>
            <SectionTitle>AJOUT RAPIDE</SectionTitle>
            {["nom", "pays", "debut", "spectaclesRaw"].map((k) => (
              <input key={k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder={k}
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, marginBottom: 10 }} />
            ))}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: C.dim2, marginBottom: 5 }}>Date de naissance (pour l'âge auto)</div>
              <input type="date" value={form.date_naissance} onChange={(e) => setForm({ ...form, date_naissance: e.target.value })}
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13 }} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: C.dim2, marginBottom: 5 }}>Catégorie (détermine la grille de notation)</div>
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13 }}>
                <option value="">— Non classé —</option>
                {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.dim2, marginBottom: 6 }}>Genres (clique pour sélectionner)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {GENRE_OPTIONS.map((g) => {
                  const selected = (form.genres || "").split(",").map((s) => s.trim()).includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        const current = (form.genres || "").split(",").map((s) => s.trim()).filter(Boolean);
                        const next = selected ? current.filter((x) => x !== g) : [...current, g];
                        setForm({ ...form, genres: next.join(", ") });
                      }}
                      style={{
                        fontSize: 11.5, padding: "5px 12px", borderRadius: 20, cursor: "pointer",
                        border: `1px solid ${selected ? C.gold : C.border}`,
                        background: selected ? "rgba(240,180,41,0.15)" : "transparent",
                        color: selected ? C.gold : C.dim,
                      }}
                    >{g}</button>
                  );
                })}
              </div>
            </div>
            <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} placeholder="Bio"
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, marginBottom: 12, resize: "vertical" }} />
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><GoldButton full onClick={() => quickAdd("published")}>Publier</GoldButton></div>
              <div style={{ flex: 1 }}><GoldButton full onClick={() => quickAdd("draft")}>Brouillon</GoldButton></div>
            </div>
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22 }}>
            <SectionTitle>IMPORT EN MASSE</SectionTitle>
            <textarea value={bulkRaw} onChange={(e) => setBulkRaw(e.target.value)} rows={8} placeholder="nom,pays,debut,genres,bio,spectacles"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12, fontFamily: "monospace", marginBottom: 14 }} />
            <GoldButton full onClick={doBulkImport}>Importer (en brouillon)</GoldButton>
          </div>

          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22 }}>
            <SectionTitle>METTRE À JOUR LES DATES DE NAISSANCE</SectionTitle>
            <p style={{ fontSize: 11.5, color: C.dim2, marginBottom: 10 }}>Met à jour uniquement la date de naissance des humoristes déjà existants (identifiés par leur nom exact) — ne touche à rien d'autre.</p>
            <textarea value={birthDatesRaw} onChange={(e) => setBirthDatesRaw(e.target.value)} rows={6} placeholder="nom,date_naissance"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12, fontFamily: "monospace", marginBottom: 14 }} />
            <GoldButton full onClick={doBirthDatesImport}>Mettre à jour</GoldButton>
            {birthDatesResult && (
              <div style={{ marginTop: 14, fontSize: 12 }}>
                <div style={{ color: C.green, marginBottom: 4 }}>{birthDatesResult.filter((r) => r.status === "ok").length} mis à jour</div>
                {birthDatesResult.filter((r) => r.status === "not_found").length > 0 && (
                  <div style={{ color: C.red }}>
                    Non trouvés : {birthDatesResult.filter((r) => r.status === "not_found").map((r) => r.nom).join(", ")}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22 }}>
          <SectionTitle right={
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={publishAll} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 20, background: "rgba(63,184,120,0.15)", color: C.green, border: "none", cursor: "pointer" }}>Tout publier</button>
              <button onClick={draftAll} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 20, background: "rgba(154,147,166,0.15)", color: C.dim, border: "none", cursor: "pointer" }}>Tout brouillon</button>
              <button onClick={deleteAll} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 20, background: "rgba(224,87,74,0.15)", color: C.red, border: "none", cursor: "pointer" }}>Tout supprimer</button>
              <button onClick={() => setSortAlpha((s) => !s)} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 20, background: sortAlpha ? "rgba(240,180,41,0.15)" : "rgba(154,147,166,0.15)", color: sortAlpha ? C.gold : C.dim, border: "none", cursor: "pointer" }}>A-Z</button>
              <button onClick={regenerateSlugs} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 20, background: "rgba(154,147,166,0.15)", color: C.dim, border: "none", cursor: "pointer" }}>Régénérer URLs</button>
              <span style={{ fontSize: 12, color: C.dim2 }}>{comics.length} au total</span>
            </div>
          }>BASE DES HUMORISTES</SectionTitle>
          <div style={{ position: "relative", marginBottom: 14 }}>
            <Search size={14} color={C.dim2} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              value={adminSearch}
              onChange={(e) => setAdminSearch(e.target.value)}
              placeholder="Rechercher un humoriste..."
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 34px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12.5 }}
            />
            {adminSearch && (
              <button onClick={() => setAdminSearch("")} title="Effacer" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", display: "flex" }}>
                <X size={14} color={C.dim2} />
              </button>
            )}
          </div>
          <div style={{ maxHeight: 560, overflowY: "auto" }}>
            {(sortAlpha ? [...comics].sort((a, b) => a.nom.localeCompare(b.nom, "fr")) : comics)
              .filter((c) => c.nom.toLowerCase().includes(adminSearch.trim().toLowerCase()))
              .map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", borderBottom: `1px solid ${C.border}` }}>
                <label style={{ position: "relative", cursor: "pointer", flexShrink: 0 }} title="Cliquer pour changer la photo">
                  <PhotoPlaceholder size={36} label={c.nom} imgSrc={c.photo_url} />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(c.id, e.target.files?.[0])}
                    style={{ display: "none" }}
                  />
                  {uploadingPhotoId === c.id && (
                    <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: C.gold }}>...</div>
                  )}
                </label>
                <div onClick={() => onOpenComic(c.id)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }} title="Voir la fiche publique">
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{c.nom}</div>
                  <div style={{ fontSize: 11, color: C.dim2 }}>{c.pays || "—"}</div>
                </div>
                <button onClick={() => toggleStatus(c)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, padding: "5px 10px", borderRadius: 20, background: c.status === "draft" ? "rgba(154,147,166,0.15)" : "rgba(63,184,120,0.15)", color: c.status === "draft" ? C.dim : C.green, border: "none", cursor: "pointer" }}>
                  {c.status === "draft" ? <EyeOff size={11} /> : <Eye size={11} />} {c.status === "draft" ? "Brouillon" : "Publié"}
                </button>
                <button onClick={() => setEditComic(c)} title="Modifier la fiche" style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer" }}><Pencil size={15} color={C.dim2} /></button>
                <button onClick={() => setVideoSearchComic(c)} style={{ fontSize: 10.5, padding: "5px 10px", borderRadius: 20, background: "rgba(240,180,41,0.12)", color: C.gold, border: "none", cursor: "pointer" }}>
                  Vidéos
                </button>
                <button onClick={() => remove(c.id)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={15} color={C.dim2} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}
      {videoSearchComic && <VideoSearchModal comic={videoSearchComic} onClose={() => setVideoSearchComic(null)} />}
      {editComic && <EditComicModal comic={editComic} onClose={() => setEditComic(null)} onSaved={async () => { await load(); onRefreshPublic(); }} />}
    </div>
  );
}

/* ---------- App ---------- */
export default function App() {
  const [nav, setNav] = useState({ page: "home" });
  const [query, setQuery] = useState("");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [comics, setComics] = useState([]);
  const [ratingsByComic, setRatingsByComic] = useState({});
  const [loading, setLoading] = useState(true);

  const loadPublicComics = useCallback(async () => {
    const list = await api.fetchPublishedComics();
    setComics(list);
    const ratingsMap = {};
    await Promise.all(list.map(async (c) => { ratingsMap[c.id] = await api.fetchRatingsForComic(c.id); }));
    setRatingsByComic(ratingsMap);
    setLoading(false);
  }, []);

  const refreshAuth = useCallback(async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    setUser(u || null);
    if (u) setProfile(await api.fetchMyProfile(u.id));
    else setProfile(null);
  }, []);

  useEffect(() => {
    loadPublicComics();
    refreshAuth();
    const { data: sub } = supabase.auth.onAuthStateChange(() => refreshAuth());
    return () => sub.subscription.unsubscribe();
  }, [loadPublicComics, refreshAuth]);

  // Au premier chargement, si l'URL correspond à une fiche (ex: /gad-elmaleh) ou une page
  // statique connue (ex: /classements), on ouvre directement la bonne page.
  useEffect(() => {
    const path = window.location.pathname.replace(/^\/|\/$/g, "");
    if (!path || path.startsWith("genre/") || path.startsWith("match/")) return; // gérés par l'effet dédié ci-dessous, une fois les humoristes chargés
    if (path.startsWith("streamers/")) { setNav({ page: "streamerDetail", twitchLogin: path.slice("streamers/".length) }); return; }
    const staticEntry = Object.entries(PAGE_PATHS).find(([, p]) => p === `/${path}`);
    if (staticEntry) { setNav({ page: staticEntry[0] }); return; }
    api.fetchComicBySlug(path).then((c) => {
      if (c) setNav({ page: "detail", id: c.id, slug: c.slug });
    }).catch((e) => console.error("Erreur résolution URL:", e));
  }, []);

  // Résout un lien direct/partagé /genre/xxx OU /match/xxx-vs-yyy une fois les humoristes
  // chargés (il faut connaître leurs slugs pour retrouver de qui il s'agit).
  const genreResolvedRef = useRef(false);
  useEffect(() => {
    if (genreResolvedRef.current || !comics.length) return;
    const path = window.location.pathname.replace(/^\/|\/$/g, "");
    if (path.startsWith("genre/")) {
      const slug = path.slice("genre/".length);
      const allGenres = new Set();
      comics.forEach((c) => (c.genres || "").split(",").map((s) => s.trim()).filter(Boolean).forEach((g) => allGenres.add(g)));
      const match = [...allGenres].find((g) => slugifyGenre(g) === slug);
      if (match) setNav({ page: "genre", genre: match });
    } else if (path.startsWith("match/")) {
      const slug = path.slice("match/".length);
      const [slugA, slugB] = slug.split("-vs-");
      const a = comics.find((c) => c.slug === slugA);
      const b = comics.find((c) => c.slug === slugB);
      if (a && b) setNav({ page: "match", comicAId: a.id, comicBId: b.id, matchSlug: slug });
    }
    genreResolvedRef.current = true;
  }, [comics]);

  // Gère le bouton précédent/suivant du navigateur.
  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname.replace(/^\/|\/$/g, "");
      if (!path) { setNav({ page: "home" }); return; }
      if (path.startsWith("genre/")) {
        const slug = path.slice("genre/".length);
        const allGenres = new Set();
        comics.forEach((c) => (c.genres || "").split(",").map((s) => s.trim()).filter(Boolean).forEach((g) => allGenres.add(g)));
        const match = [...allGenres].find((g) => slugifyGenre(g) === slug);
        if (match) setNav({ page: "genre", genre: match });
        return;
      }
      if (path.startsWith("match/")) {
        const slug = path.slice("match/".length);
        const [slugA, slugB] = slug.split("-vs-");
        const a = comics.find((c) => c.slug === slugA);
        const b = comics.find((c) => c.slug === slugB);
        if (a && b) setNav({ page: "match", comicAId: a.id, comicBId: b.id, matchSlug: slug });
        return;
      }
      if (path.startsWith("streamers/")) { setNav({ page: "streamerDetail", twitchLogin: path.slice("streamers/".length) }); return; }
      const staticEntry = Object.entries(PAGE_PATHS).find(([, p]) => p === `/${path}`);
      if (staticEntry) { setNav({ page: staticEntry[0] }); return; }
      const c = comics.find((x) => x.slug === path);
      if (c) setNav({ page: "detail", id: c.id, slug: c.slug });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [comics]);

  // Ouvre une fiche ET met à jour l'URL du navigateur avec son slug (ex: /gad-elmaleh).
  // On mémorise la page d'origine complète (from) pour que le bouton "retour" de la fiche
  // ramène là d'où on vient (admin, classement, genre...) plutôt que systématiquement l'accueil.
  // Si on ouvre une fiche depuis une autre fiche (ex: lien "voir aussi"), on garde le "from"
  // d'origine au lieu d'écraser avec "detail".
  const openComic = useCallback((id) => {
    const c = comics.find((x) => x.id === id);
    const slug = c?.slug;
    if (slug) window.history.pushState({}, "", `/${slug}`);
    setNav((prev) => ({ page: "detail", id, slug, from: prev.page === "detail" ? prev.from : prev }));
  }, [comics]);

  // Reconstitue l'URL correspondant à une page de nav donnée (utilisé pour le retour).
  const pathForNav = useCallback((n) => {
    if (!n) return "/";
    if (n.page === "genre") return `/genre/${slugifyGenre(n.genre)}`;
    if (n.page === "match") return `/match/${n.matchSlug}`;
    if (n.page === "detail") return n.slug ? `/${n.slug}` : "/";
    if (n.page === "streamerDetail") return `/streamers/${n.twitchLogin}`;
    return PAGE_PATHS[n.page] || "/";
  }, []);

  // Retour depuis une fiche : revient sur la page d'où on est venu (admin, classement, etc.)
  // au lieu de toujours revenir à l'accueil.
  const goBack = useCallback(() => {
    setNav((prev) => {
      const target = prev.from || { page: "home" };
      const path = pathForNav(target);
      if (window.location.pathname !== path) window.history.pushState({}, "", path);
      return target;
    });
  }, [pathForNav]);

  // Tire un duel aléatoire parmi les humoristes publiés et ouvre directement la page du duel
  // (1 clic depuis l'accueil, pas d'étape intermédiaire). Évite de retomber sur le duel précédent.
  const lastMatchRef = useRef(null);
  const openRandomMatch = useCallback(() => {
    if (comics.length < 2) return;
    let a, b, slug;
    let attempts = 0;
    do {
      a = comics[Math.floor(Math.random() * comics.length)];
      do { b = comics[Math.floor(Math.random() * comics.length)]; } while (b.id === a.id);
      slug = matchSlugFor(a, b);
      attempts++;
    } while (slug === lastMatchRef.current && attempts < 8);
    lastMatchRef.current = slug;
    window.history.pushState({}, "", `/match/${slug}`);
    setNav({ page: "match", comicAId: a.id, comicBId: b.id, matchSlug: slug });
  }, [comics]);
  const openGenre = useCallback((genre) => {
    const slug = slugifyGenre(genre);
    window.history.pushState({}, "", `/genre/${slug}`);
    setNav({ page: "genre", genre });
  }, []);

  // Ouvre la fiche d'un streamer (module Streamers, phase privée — accessible par URL directe).
  const openStreamerDetail = useCallback((twitchLogin) => {
    window.history.pushState({}, "", `/streamers/${twitchLogin}`);
    setNav((prev) => ({ page: "streamerDetail", twitchLogin, from: prev.page === "streamerDetail" ? prev.from : prev }));
  }, []);

  // Change de page ET met à jour l'URL du navigateur (accueil, classements, humoristes, contact, mon espace, admin).
  const goToPage = useCallback((page) => {
    const path = PAGE_PATHS[page] || "/";
    if (window.location.pathname !== path) window.history.pushState({}, "", path);
    setNav({ page });
  }, []);

  const comicsWithStats = useMemo(() => {
    const base = comics.map((c) => {
      const ratings = ratingsByComic[c.id] || [];
      return { ...c, ...overallAvg(ratings), ratings };
    });
    const rankTrends = computeRankTrends(base);
    return base.map((c) => ({ ...c, trend: rankTrends.get(c.id) || null }));
  }, [comics, ratingsByComic]);
  const filtered = useMemo(() => query.trim() ? comicsWithStats.filter((c) => c.nom.toLowerCase().includes(query.toLowerCase())) : comicsWithStats, [comicsWithStats, query]);

  const logout = async () => { await supabase.auth.signOut(); goToPage("home"); };

  // SEO des pages "statiques" (celles qui n'ont pas leur propre logique de titre/meta comme
  // ComicDetail, GenrePage ou MatchPage, qui gèrent ça elles-mêmes).
  useEffect(() => {
    if (nav.page === "home") applySEO();
    else if (nav.page === "ranking") applySEO({ title: `Classement complet des humoristes | ${SITE_NAME}`, description: "Le classement complet de tous les humoristes notés par le public, du mieux noté au moins bien noté.", url: `${window.location.origin}/classements` });
    else if (nav.page === "comics") applySEO({ title: `Tous les humoristes | ${SITE_NAME}`, description: "Parcourez la liste complète des humoristes référencés sur PasDrôle.fr.", url: `${window.location.origin}/humoristes` });
    else if (nav.page === "contact") applySEO({ title: `Contact | ${SITE_NAME}`, url: `${window.location.origin}/contact` });
  }, [nav.page]);

  if (loading) {
    return <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: C.text }}>Ouverture du rideau...</div>
    </div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Inter, sans-serif" }}>
      <style>{`* { box-sizing: border-box; } body { margin: 0; } ::-webkit-scrollbar { height: 6px; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; } @keyframes pdPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(63,184,120,0.55); } 50% { box-shadow: 0 0 0 9px rgba(63,184,120,0); } }`}</style>

      <Header nav={nav} navigate={goToPage} query={query} setQuery={setQuery} user={user} profile={profile} onOpenAuth={() => setShowAuth(true)} onLogout={logout} comicsWithStats={comicsWithStats} onOpenComic={openComic} />

      {nav.page === "home" && (
        <>
          <Hero comicsWithStats={comicsWithStats} />
          <TopStrip comicsWithStats={comicsWithStats} onOpen={openComic} limit={7} title="TOP DU MOMENT" />
          <CombatDuMoment onOpenComic={openComic} />
          <MatchCTA onLaunch={openRandomMatch} />
          <DuelWinnersStrip comics={comics} />
          <LatestReviews onOpen={openComic} />
        </>
      )}
      {nav.page === "ranking" && <TopStrip comicsWithStats={comicsWithStats} onOpen={openComic} limit={comicsWithStats.length} title="CLASSEMENT COMPLET" />}
      {nav.page === "comics" && <ComicGrid comicsWithStats={filtered} onOpen={openComic} title="HUMORISTES" />}
      {nav.page === "genre" && <GenrePage genre={nav.genre} comicsWithStats={comicsWithStats} onOpen={openComic} />}
      {nav.page === "match" && (() => {
        const comicA = comics.find((c) => c.id === nav.comicAId);
        const comicB = comics.find((c) => c.id === nav.comicBId);
        if (!comicA || !comicB) return <div style={{ padding: 60, textAlign: "center", color: C.dim }}>Chargement du duel...</div>;
        return <MatchPage comicA={comicA} comicB={comicB} matchSlug={nav.matchSlug} onNewMatch={openRandomMatch} />;
      })()}
      {nav.page === "detail" && (
        <ComicDetail comicId={nav.id} user={user} onBack={goBack} onRequireAuth={() => setShowAuth(true)} onOpenGenre={openGenre} />
      )}
      {nav.page === "mine" && user && <MyActivityPage user={user} profile={profile} onOpenComic={openComic} />}
      {nav.page === "contact" && <ContactPage />}
      {nav.page === "streamers" && (STREAMERS_PUBLIC || profile?.role === "admin") && <StreamersRankingPage onOpenStreamer={openStreamerDetail} />}
      {nav.page === "streamerDetail" && (STREAMERS_PUBLIC || profile?.role === "admin") && <StreamerDetailPage twitchLogin={nav.twitchLogin} onBack={goBack} user={user} onRequireAuth={() => setShowAuth(true)} />}
      {nav.page === "admin" && profile?.role === "admin" && <AdminPage onRefreshPublic={loadPublicComics} onOpenComic={openComic} onOpenStreamer={openStreamerDetail} />}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onAuthed={refreshAuth} />}

      <footer style={{ borderTop: `1px solid ${C.border}`, marginTop: 20, padding: "24px", textAlign: "center", color: C.dim2, fontSize: 12 }}>
        © 2026 PasDrôle.fr
      </footer>
    </div>
  );
}
