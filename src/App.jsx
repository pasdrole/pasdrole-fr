import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Plus, X, ArrowLeft, Search, Home, LayoutGrid, Users, Shield, Star, Mail,
  TrendingUp, TrendingDown, Minus, Calendar, Crown, ChevronRight, ImageUp, LogIn, LogOut, UserCircle,
  FileJson, Check, AlertTriangle, Trash2, Eye, EyeOff, Wand2, Pencil, Skull,
} from "lucide-react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";
import { supabase } from "./supabaseClient";
import * as api from "./api";
import { CRITERIA } from "./api";

const C = {
  bg: "#0B0A0D", panel: "#151318", panel2: "#1B1820", border: "#2A2630", borderHover: "#3B3544",
  gold: "#F0B429", goldSoft: "#FFD466", text: "#F5F2EC", dim: "#9A93A6", dim2: "#635C70",
  green: "#3FB878", red: "#E0574A",
};

// Correspondance page interne <-> URL propre (pour le référencement et le partage de liens).
const PAGE_PATHS = { home: "/", ranking: "/classements", comics: "/humoristes", contact: "/contact", mine: "/mon-espace", admin: "/admin" };

const GENRE_OPTIONS = [
  "Sketch", "Satire", "Stand-up", "Imitation", "Impro", "Parodie", "Absurde",
  "Autodérision", "Storytelling", "Chronique", "Cynisme", "Provocation",
  "Observation", "Société", "Politique", "Introspection", "Féminisme",
  "Digital", "One-man-show", "Duo", "Jeu de mots", "Poésie", "Ironie",
  "Physique", "Franc-parler", "Punchlines", "Acteur",
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
function GoldButton({ children, onClick, disabled, full, type = "button" }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      width: full ? "100%" : undefined, background: disabled ? C.border : `linear-gradient(145deg, ${C.goldSoft}, ${C.gold})`,
      color: disabled ? C.dim2 : "#1A1509", border: "none", padding: "11px 20px", borderRadius: 9,
      fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 1, cursor: disabled ? "not-allowed" : "pointer",
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
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) {
          try { await api.createProfile(data.user.id, pseudo.trim()); } catch (e) { /* pseudo peut-être déjà pris */ }
        }
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
function perCriteriaAvg(ratings) {
  const out = {};
  CRITERIA.forEach((c) => {
    const vals = ratings.map((v) => v[c.key]).filter((v) => typeof v === "number");
    out[c.key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
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
function overallAvg(ratings) {
  const per = perCriteriaAvg(ratings);
  const vals = Object.values(per).filter((v) => v > 0);
  return { avg10: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0, votes: ratings.length };
}
// Tendance récente d'un humoriste : compare sa moyenne actuelle (toutes notes) à sa moyenne
// telle qu'elle était il y a `days` jours (calculée sur les seules notes déjà présentes à
// cette date, via leur updated_at). Ne nécessite aucun stockage d'historique supplémentaire.
// Retourne null si pas assez de recul (humoriste trop récent / toutes les notes sont récentes).
function trendFor(ratings, days = 7) {
  if (!ratings || !ratings.length) return null;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const older = ratings.filter((r) => r.updated_at && new Date(r.updated_at).getTime() < cutoff);
  if (!older.length) return null;
  const { avg10: currentAvg } = overallAvg(ratings);
  const { avg10: prevAvg } = overallAvg(older);
  if (!currentAvg || !prevAvg) return null;
  return { delta: currentAvg - prevAvg };
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
          const stable = trend && Math.abs(trend.delta) < 0.05;
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
              <div title="Évolution sur 7 jours" style={{
                position: "absolute", top: 10, right: 10, display: "flex", alignItems: "center", gap: 2,
                fontSize: 10.5, fontWeight: 700, color: stable ? C.dim2 : trend.delta > 0 ? C.green : C.red,
              }}>
                {stable ? <Minus size={11} /> : trend.delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {!stable && (trend.delta > 0 ? "+" : "") + trend.delta.toFixed(1).replace(".", ",")}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "center", marginTop: 10, marginBottom: 12 }}>
              <PhotoPlaceholder size={58} label={c.nom} imgSrc={c.photo_url} />
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
            <PhotoPlaceholder size={50} label={c.nom} imgSrc={c.photo_url} />
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
  // Petit plus SEO/UX : le titre d'onglet reflète le genre consulté, remis à zéro en quittant la page.
  useEffect(() => {
    const prev = document.title;
    document.title = `Humoristes ${genre || ""} — PasDrôle.fr`;
    return () => { document.title = prev; };
  }, [genre]);
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

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const c = await api.fetchComicById(comicId);
      setComic(c);
      setLoading(false); // la fiche peut s'afficher dès qu'on a l'humoriste

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

      if (user) {
        const [mr, mrv] = await Promise.allSettled([
          api.fetchMyRating(comicId, user.id),
          api.fetchMyReview(comicId, user.id),
        ]);
        if (mr.status === "fulfilled" && mr.value) {
          setMyRating(mr.value);
          setDraft(Object.fromEntries(CRITERIA.map((c) => [c.key, mr.value[c.key]])));
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

  const { avg10, votes } = overallAvg(ratings);
  const per = perCriteriaAvg(ratings);
  const radarData = CRITERIA.map((c) => ({ subject: c.label, value: per[c.key] || 0, fullMark: 10 }));
  const canSubmitRating = CRITERIA.every((c) => typeof draft[c.key] === "number" && draft[c.key] > 0);

  const submitRating = async () => {
    if (!user) return onRequireAuth();
    setSaving(true);
    try {
      await api.upsertRating(comicId, user.id, draft);
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
              <PhotoPlaceholder size={88} label={comic.nom} imgSrc={comic.photo_url} />
              <div>
                <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, color: C.text, margin: 0 }}>{comic.nom}</h1>
                <div style={{ display: "flex", gap: 7, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <CountryPill pays={comic.pays} />
                  {genreList.map((g) => (
                    <ClickablePill key={g} title={`Voir tous les humoristes ${g}`} onClick={() => onOpenGenre(g)}>{g}</ClickablePill>
                  ))}
                  <Pill>depuis {comic.debut}</Pill>
                  {computeAge(comic.date_naissance) !== null && <Pill>{computeAge(comic.date_naissance)} ans</Pill>}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 0", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, marginBottom: 18, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, color: C.gold }}>{avg10 > 0 ? avg10.toFixed(1).replace(".", ",") : "—"}<span style={{ fontSize: 16, color: C.dim2, fontFamily: "Inter" }}>/10</span></span>
              <Micros value={avg10} size={18} />
              <span style={{ fontSize: 12, color: C.dim2 }}>{votes} vote{votes !== 1 ? "s" : ""}</span>
            </div>
            <p style={{ color: C.dim, fontSize: 14, lineHeight: 1.7, marginBottom: 14 }}>{comic.bio}</p>
            {comic.spectacles?.length > 0 && <div style={{ fontSize: 13, color: C.dim2, marginBottom: 10 }}><strong style={{ color: C.text }}>Spectacles :</strong> {comic.spectacles.join(", ")}</div>}

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
            {CRITERIA.map((c) => (
              <div key={c.key} style={{ marginBottom: 15 }}>
                <span style={{ fontSize: 13, color: C.text, display: "block", marginBottom: 6 }}>{c.label}</span>
                <div style={{ display: "flex", gap: 1 }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <button key={n} onClick={() => setDraft({ ...draft, [c.key]: n })} style={{ background: "none", border: "none", cursor: "pointer", padding: 1, flexShrink: 0 }}>
                      <MicIcon size={22} filled={(draft[c.key] || 0) >= n} />
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
      <button onClick={onLaunch} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
        background: `linear-gradient(120deg, ${C.panel2}, ${C.panel})`, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: "22px 20px", cursor: "pointer", textAlign: "center",
      }}>
        <CrossedSwords size={26} />
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1, color: C.text }}>
          QUI L'EMPORTE ? <span style={{ color: C.gold }}>LANCER UN DUEL</span>
        </span>
        <CrossedSwords size={26} />
      </button>
    </section>
  );
}
function StatBox({ icon, label, comic, count, accent }) {
  return (
    <div style={{ flex: "1 1 220px", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: `${accent}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 10.5, color: C.dim2, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
        {comic ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PhotoPlaceholder size={26} label={comic.nom} imgSrc={comic.photo_url} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: C.text, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{comic.nom}</div>
              <div style={{ fontSize: 11, color: accent }}>{count} duel{count !== 1 ? "s" : ""}</div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: C.dim2 }}>Pas encore de duels</div>
        )}
      </div>
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
        <StatBox icon={<Crown size={16} color={C.gold} />} label="Plus grand vainqueur" comic={stats.allTime.topWinner?.comic} count={stats.allTime.topWinner?.count} accent={C.gold} />
        <StatBox icon={<Skull size={16} color={C.red} />} label="Plus grand loser" comic={stats.allTime.topLoser?.comic} count={stats.allTime.topLoser?.count} accent={C.red} />
        <StatBox icon={<TrendingUp size={16} color={C.green} />} label="Vainqueur de la semaine" comic={stats.lastWeek.topWinner?.comic} count={stats.lastWeek.topWinner?.count} accent={C.green} />
        <StatBox icon={<TrendingDown size={16} color={C.red} />} label="Loser de la semaine" comic={stats.lastWeek.topLoser?.comic} count={stats.lastWeek.topLoser?.count} accent={C.red} />
      </div>
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
        <PhotoPlaceholder size={84} label={comic.nom} imgSrc={comic.photo_url} />
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
        <GoldButton onClick={onNewMatch}>Nouveau duel</GoldButton>
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
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const toggleGenre = (g) => {
    const current = (form.genres || "").split(",").map((s) => s.trim()).filter(Boolean);
    const next = current.includes(g) ? current.filter((x) => x !== g) : [...current, g];
    setForm({ ...form, genres: next.join(", ") });
  };

  const save = async () => {
    setSaving(true);
    setErr("");
    try {
      await api.updateComic(comic.id, {
        nom: form.nom.trim(), pays: form.pays, debut: form.debut, genres: form.genres, bio: form.bio,
        date_naissance: form.date_naissance || null,
        spectacles: form.spectaclesRaw.split(",").map((s) => s.trim()).filter(Boolean),
      });
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

        {err && <div style={{ color: C.red, fontSize: 12, marginBottom: 12 }}>{err}</div>}
        <GoldButton full disabled={saving} onClick={save}>{saving ? "Enregistrement..." : "Enregistrer"}</GoldButton>
      </div>
    </div>
  );
}

function AdminPage({ onRefreshPublic, onOpenComic }) {
  const [comics, setComics] = useState([]);
  const [form, setForm] = useState({ nom: "", pays: "France", debut: "", genres: "", bio: "", spectaclesRaw: "", date_naissance: "" });
  const [bulkRaw, setBulkRaw] = useState("");
  const [birthDatesRaw, setBirthDatesRaw] = useState("");
  const [birthDatesResult, setBirthDatesResult] = useState(null);
  const [uploadingPhotoId, setUploadingPhotoId] = useState(null);
  const [videoSearchComic, setVideoSearchComic] = useState(null);
  const [editComic, setEditComic] = useState(null);
  const [adminTab, setAdminTab] = useState("humoristes");
  const [sortAlpha, setSortAlpha] = useState(false);
  const [pendingReviews, setPendingReviews] = useState([]);

  const loadPendingReviews = useCallback(async () => {
    try { setPendingReviews(await api.fetchPendingReviews()); } catch (e) { console.error(e); }
  }, []);
  useEffect(() => { loadPendingReviews(); }, [loadPendingReviews]);

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
    await api.createComic({
      nom: form.nom.trim(), pays: form.pays, debut: form.debut, genres: form.genres, bio: form.bio,
      date_naissance: form.date_naissance || null,
      spectacles: form.spectaclesRaw.split(",").map((s) => s.trim()).filter(Boolean), status,
    });
    setForm({ nom: "", pays: "France", debut: "", genres: "", bio: "", spectaclesRaw: "", date_naissance: "" });
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
      </div>

      {adminTab === "avis" ? (
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
          <div style={{ maxHeight: 560, overflowY: "auto" }}>
            {(sortAlpha ? [...comics].sort((a, b) => a.nom.localeCompare(b.nom, "fr")) : comics).map((c) => (
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
      const staticEntry = Object.entries(PAGE_PATHS).find(([, p]) => p === `/${path}`);
      if (staticEntry) { setNav({ page: staticEntry[0] }); return; }
      const c = comics.find((x) => x.slug === path);
      if (c) setNav({ page: "detail", id: c.id, slug: c.slug });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [comics]);

  // Ouvre une fiche ET met à jour l'URL du navigateur avec son slug (ex: /gad-elmaleh).
  const openComic = useCallback((id) => {
    const c = comics.find((x) => x.id === id);
    const slug = c?.slug;
    if (slug) window.history.pushState({}, "", `/${slug}`);
    setNav({ page: "detail", id, slug });
  }, [comics]);

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

  // Change de page ET met à jour l'URL du navigateur (accueil, classements, humoristes, contact, mon espace, admin).
  const goToPage = useCallback((page) => {
    const path = PAGE_PATHS[page] || "/";
    if (window.location.pathname !== path) window.history.pushState({}, "", path);
    setNav({ page });
  }, []);

  const comicsWithStats = useMemo(() => comics.map((c) => {
    const ratings = ratingsByComic[c.id] || [];
    return { ...c, ...overallAvg(ratings), trend: trendFor(ratings) };
  }), [comics, ratingsByComic]);
  const filtered = useMemo(() => query.trim() ? comicsWithStats.filter((c) => c.nom.toLowerCase().includes(query.toLowerCase())) : comicsWithStats, [comicsWithStats, query]);

  const logout = async () => { await supabase.auth.signOut(); goToPage("home"); };

  if (loading) {
    return <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: C.text }}>Ouverture du rideau...</div>
    </div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Inter, sans-serif" }}>
      <style>{`* { box-sizing: border-box; } body { margin: 0; } ::-webkit-scrollbar { height: 6px; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }`}</style>

      <Header nav={nav} navigate={goToPage} query={query} setQuery={setQuery} user={user} profile={profile} onOpenAuth={() => setShowAuth(true)} onLogout={logout} comicsWithStats={comicsWithStats} onOpenComic={openComic} />

      {nav.page === "home" && (
        <>
          <Hero comicsWithStats={comicsWithStats} />
          <TopStrip comicsWithStats={comicsWithStats} onOpen={openComic} limit={5} title="TOP 5 DU MOMENT" />
          <MatchCTA onLaunch={openRandomMatch} />
          <MatchLeaderboard comics={comics} />
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
        <ComicDetail comicId={nav.id} user={user} onBack={() => goToPage("home")} onRequireAuth={() => setShowAuth(true)} onOpenGenre={openGenre} />
      )}
      {nav.page === "mine" && user && <MyActivityPage user={user} profile={profile} onOpenComic={openComic} />}
      {nav.page === "contact" && <ContactPage />}
      {nav.page === "admin" && profile?.role === "admin" && <AdminPage onRefreshPublic={loadPublicComics} onOpenComic={openComic} />}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onAuthed={refreshAuth} />}

      <footer style={{ borderTop: `1px solid ${C.border}`, marginTop: 20, padding: "24px", textAlign: "center", color: C.dim2, fontSize: 12 }}>
        © 2026 PasDrôle.fr
      </footer>
    </div>
  );
}
