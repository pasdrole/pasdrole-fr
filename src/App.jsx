import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus, X, ArrowLeft, Search, Home, LayoutGrid, Users, Shield,
  TrendingUp, Calendar, Crown, ChevronRight, ImageUp, LogIn, LogOut, UserCircle,
  FileJson, Check, AlertTriangle, Trash2, Eye, EyeOff, Wand2,
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
function Pill({ children }) { return <span style={{ fontSize: 11, background: C.panel2, border: `1px solid ${C.border}`, padding: "4px 11px", borderRadius: 20, color: C.dim }}>{children}</span>; }
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
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, maxWidth: 380, width: "100%", padding: 28 }}>
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

        <GoldButton full disabled={loading || !email || !password} onClick={submit}>
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
function Header({ nav, setNav, query, setQuery, user, profile, onOpenAuth, onLogout }) {
  const items = [
    { key: "home", label: "Accueil", icon: Home },
    { key: "ranking", label: "Classements", icon: LayoutGrid },
    { key: "comics", label: "Humoristes", icon: Users },
  ];
  return (
    <header style={{ background: "rgba(21,19,24,0.9)", backdropFilter: "blur(14px)", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 1220, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <div onClick={() => setNav({ page: "home" })} style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <img src="/logo-mike.png" alt="PasDrôle.fr" style={{ height: 168, width: "auto" }} />
          <div style={{ fontSize: 10.5, color: C.text, letterSpacing: 1.4, textAlign: "center" }}>LE CLASSEMENT DES HUMORISTES PAR LE PUBLIC</div>
        </div>
        <nav style={{ display: "flex", gap: 2 }}>
          {items.map((it) => (
            <button key={it.key} onClick={() => setNav({ page: it.key })} style={{
              display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer",
              padding: "9px 13px", borderRadius: 7, color: nav.page === it.key ? C.gold : C.dim,
              borderBottom: nav.page === it.key ? `2px solid ${C.gold}` : "2px solid transparent",
              fontSize: 13, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1,
            }}><it.icon size={13} /> {it.label.toUpperCase()}</button>
          ))}
          {profile?.role === "admin" && (
            <button onClick={() => setNav({ page: "admin" })} style={{
              display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer",
              padding: "9px 13px", borderRadius: 7, color: nav.page === "admin" ? C.gold : C.dim,
              borderBottom: nav.page === "admin" ? `2px solid ${C.gold}` : "2px solid transparent",
              fontSize: 13, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1,
            }}><Shield size={13} /> ADMIN</button>
          )}
        </nav>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 9, padding: "8px 13px", minWidth: 180 }}>
            <Search size={14} color={C.dim2} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher..."
              style={{ background: "none", border: "none", outline: "none", color: C.text, fontSize: 13, width: "100%" }} />
          </div>
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setNav({ page: "mine" })} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: C.text, fontSize: 12.5 }}>
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
function overallAvg(ratings) {
  const per = perCriteriaAvg(ratings);
  const vals = Object.values(per).filter((v) => v > 0);
  return { avg10: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0, votes: ratings.length };
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
  const ranked = useMemo(() => [...comicsWithStats].sort((a, b) => b.avg10 - a.avg10).slice(0, limit), [comicsWithStats, limit]);
  return (
    <section style={{ maxWidth: 1220, margin: "0 auto", padding: "40px 24px 0" }}>
      <SectionTitle>{title}</SectionTitle>
      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 12 }}>
        {ranked.map((c, i) => (
          <button key={c.id} onClick={() => onOpen(c.id)} style={{
            flex: "0 0 168px", background: `linear-gradient(165deg, ${C.panel2}, ${C.panel})`,
            border: `1px solid ${i === 0 ? "rgba(240,180,41,0.5)" : C.border}`, borderRadius: 14, padding: "18px 14px", cursor: "pointer", position: "relative", textAlign: "left",
          }}>
            <div style={{ position: "absolute", top: 10, left: 10, width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 800, background: i === 0 ? `linear-gradient(145deg, ${C.goldSoft}, ${C.gold})` : C.panel2, color: i === 0 ? "#1A1509" : C.dim2, border: i === 0 ? "none" : `1px solid ${C.border}` }}>
              {i === 0 ? <Crown size={12} /> : i + 1}
            </div>
            <div style={{ display: "flex", justifyContent: "center", marginTop: 10, marginBottom: 12 }}>
              <PhotoPlaceholder size={58} label={c.nom} imgSrc={c.photo_url} />
            </div>
            <div style={{ color: C.text, fontSize: 13.5, fontWeight: 600, textAlign: "center", marginBottom: 6 }}>{c.nom}</div>
            <div style={{ textAlign: "center", color: C.gold, fontFamily: "'Bebas Neue', sans-serif", fontSize: 18 }}>{c.avg10 > 0 ? c.avg10.toFixed(1).replace(".", ",") : "—"} ★</div>
            <div style={{ textAlign: "center", color: C.dim2, fontSize: 10.5 }}>({c.votes})</div>
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

/* ---------- Detail page with rating + review, edit own ---------- */
function ComicDetail({ comicId, user, onBack, onRequireAuth }) {
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

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const c = await api.fetchComicById(comicId);
      setComic(c);
      setLoading(false); // la fiche peut s'afficher dès qu'on a l'humoriste

      const [r, rv] = await Promise.allSettled([
        api.fetchRatingsForComic(comicId),
        api.fetchReviewsForComic(comicId),
      ]);
      setRatings(r.status === "fulfilled" ? r.value : []);
      setReviews(rv.status === "fulfilled" ? rv.value : []);
      if (r.status === "rejected") console.error("Erreur notes:", r.reason);
      if (rv.status === "rejected") console.error("Erreur avis:", rv.reason);

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
      await api.upsertReview(comicId, user.id, reviewDraft.trim());
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
                <div style={{ display: "flex", gap: 7, marginTop: 8, flexWrap: "wrap" }}>
                  <Pill>{comic.pays}</Pill><Pill>depuis {comic.debut}</Pill>{comic.genres && <Pill>{comic.genres}</Pill>}
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
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Mon espace ---------- */
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
function AdminPage({ onRefreshPublic }) {
  const [comics, setComics] = useState([]);
  const [form, setForm] = useState({ nom: "", pays: "France", debut: "", genres: "", bio: "", spectaclesRaw: "" });
  const [bulkRaw, setBulkRaw] = useState("");

  const load = useCallback(async () => setComics(await api.fetchAllComicsAdmin()), []);
  useEffect(() => { load(); }, [load]);

  const quickAdd = async (status) => {
    if (!form.nom.trim()) return;
    await api.createComic({
      nom: form.nom.trim(), pays: form.pays, debut: form.debut, genres: form.genres, bio: form.bio,
      spectacles: form.spectaclesRaw.split(",").map((s) => s.trim()).filter(Boolean), status,
    });
    setForm({ nom: "", pays: "France", debut: "", genres: "", bio: "", spectaclesRaw: "" });
    await load(); onRefreshPublic();
  };

  const doBulkImport = async () => {
    const trimmed = bulkRaw.trim();
    if (!trimmed) return;
    let rows = [];
    if (trimmed.startsWith("[")) {
      rows = JSON.parse(trimmed);
    } else {
      const lines = trimmed.split("\n").filter((l) => l.trim());
      const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(",");
        const row = {};
        header.forEach((h, idx) => (row[h] = (cells[idx] || "").trim()));
        rows.push({ nom: row.nom, pays: row.pays, debut: row.debut, genres: row.genres, bio: row.bio, spectacles: (row.spectacles || "").split(";").filter(Boolean) });
      }
    }
    const existing = new Set(comics.map((c) => c.nom.toLowerCase()));
    const toAdd = rows.filter((r) => r.nom && !existing.has(r.nom.toLowerCase())).map((r) => ({ ...r, status: "draft" }));
    if (toAdd.length) await api.bulkCreateComics(toAdd);
    setBulkRaw(""); await load(); onRefreshPublic();
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

  return (
    <div style={{ maxWidth: 1220, margin: "0 auto", padding: "32px 24px 60px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <Shield size={22} color={C.gold} />
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: C.text, letterSpacing: 1, margin: 0 }}>PANNEAU ADMIN</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22 }}>
            <SectionTitle>AJOUT RAPIDE</SectionTitle>
            {["nom", "pays", "debut", "genres", "spectaclesRaw"].map((k) => (
              <input key={k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder={k}
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, marginBottom: 10 }} />
            ))}
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
        </div>

        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22 }}>
          <SectionTitle right={
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={publishAll} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 20, background: "rgba(63,184,120,0.15)", color: C.green, border: "none", cursor: "pointer" }}>Tout publier</button>
              <button onClick={draftAll} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 20, background: "rgba(154,147,166,0.15)", color: C.dim, border: "none", cursor: "pointer" }}>Tout brouillon</button>
              <span style={{ fontSize: 12, color: C.dim2 }}>{comics.length} au total</span>
            </div>
          }>BASE DES HUMORISTES</SectionTitle>
          <div style={{ maxHeight: 560, overflowY: "auto" }}>
            {comics.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", borderBottom: `1px solid ${C.border}` }}>
                <PhotoPlaceholder size={36} label={c.nom} imgSrc={c.photo_url} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{c.nom}</div>
                  <div style={{ fontSize: 11, color: C.dim2 }}>{c.pays || "—"}</div>
                </div>
                <button onClick={() => toggleStatus(c)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, padding: "5px 10px", borderRadius: 20, background: c.status === "draft" ? "rgba(154,147,166,0.15)" : "rgba(63,184,120,0.15)", color: c.status === "draft" ? C.dim : C.green, border: "none", cursor: "pointer" }}>
                  {c.status === "draft" ? <EyeOff size={11} /> : <Eye size={11} />} {c.status === "draft" ? "Brouillon" : "Publié"}
                </button>
                <button onClick={() => remove(c.id)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={15} color={C.dim2} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
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

  const comicsWithStats = useMemo(() => comics.map((c) => ({ ...c, ...overallAvg(ratingsByComic[c.id] || []) })), [comics, ratingsByComic]);
  const filtered = useMemo(() => query.trim() ? comicsWithStats.filter((c) => c.nom.toLowerCase().includes(query.toLowerCase())) : comicsWithStats, [comicsWithStats, query]);

  const logout = async () => { await supabase.auth.signOut(); setNav({ page: "home" }); };

  if (loading) {
    return <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: C.text }}>Ouverture du rideau...</div>
    </div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Inter, sans-serif" }}>
      <style>{`* { box-sizing: border-box; } body { margin: 0; } ::-webkit-scrollbar { height: 6px; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }`}</style>

      <Header nav={nav} setNav={setNav} query={query} setQuery={setQuery} user={user} profile={profile} onOpenAuth={() => setShowAuth(true)} onLogout={logout} />

      {nav.page === "home" && (
        <>
          <Hero comicsWithStats={comicsWithStats} />
          <TopStrip comicsWithStats={comicsWithStats} onOpen={(id) => setNav({ page: "detail", id })} limit={10} />
          <ComicGrid comicsWithStats={filtered} onOpen={(id) => setNav({ page: "detail", id })} title={query ? "RÉSULTATS" : "TOUS LES HUMORISTES"} />
        </>
      )}
      {nav.page === "ranking" && <TopStrip comicsWithStats={comicsWithStats} onOpen={(id) => setNav({ page: "detail", id })} limit={comicsWithStats.length} title="CLASSEMENT COMPLET" />}
      {nav.page === "comics" && <ComicGrid comicsWithStats={filtered} onOpen={(id) => setNav({ page: "detail", id })} title="HUMORISTES" />}
      {nav.page === "detail" && (
        <ComicDetail comicId={nav.id} user={user} onBack={() => setNav({ page: "home" })} onRequireAuth={() => setShowAuth(true)} />
      )}
      {nav.page === "mine" && user && <MyActivityPage user={user} profile={profile} onOpenComic={(id) => setNav({ page: "detail", id })} />}
      {nav.page === "admin" && profile?.role === "admin" && <AdminPage onRefreshPublic={loadPublicComics} />}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onAuthed={refreshAuth} />}

      <footer style={{ borderTop: `1px solid ${C.border}`, marginTop: 20, padding: "24px", textAlign: "center", color: C.dim2, fontSize: 12 }}>
        © 2026 PasDrôle.fr
      </footer>
    </div>
  );
}
