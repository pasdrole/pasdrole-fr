// Génère à la volée l'image "duel" utilisée comme og:image pour /combat/{id} : les deux
// humoristes côte à côte, séparés par une rature rouge en diagonale, avec un "VS" au milieu.
// Construite avec @vercel/og (moteur Satori), qui transforme du JSX/CSS en PNG.
import { ImageResponse } from "@vercel/og";

const SUPABASE_URL = "https://gltyvhjhormviwkpjrkw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsdHl2aGpob3Jtdml3a3Bqcmt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NTc1MzYsImV4cCI6MjEwMDIzMzUzNn0.VJRmK0Jpw8oJMxTvLr_9-oL6JTilg3X8MO54rTOBexw";

const C = { bg: "#0B0A0D", gold: "#F0B429", text: "#F5F2EC", red: "#E0574A" };

// Mêmes dégradés/initiales que l'avatar de secours utilisé ailleurs sur le site (App.jsx),
// pour rester cohérent visuellement quand un humoriste n'a pas de photo (ou une photo dans
// un format qu'on ne peut pas intégrer ici, voir plus bas).
const AVATAR_GRADIENTS = [
  ["#F0B429", "#C4402F"], ["#6C63C9", "#332C6B"], ["#3D9E7C", "#1A4636"], ["#D9695A", "#732A20"],
  ["#4A90B8", "#1C4256"], ["#B87FC9", "#54326B"], ["#E0A03F", "#7A4A1A"], ["#5FA8D3", "#264A63"],
];
function gradientFor(name) {
  let h = 0;
  for (let i = 0; i < (name || "?").length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length];
}
function initials(name) {
  return (name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

// Satori (le moteur derrière @vercel/og) ne sait décoder que le PNG et le JPEG pour les <img>
// intégrées — pas l'AVIF ni le WebP, ça fait planter la génération. Or plusieurs photos
// d'humoristes sont stockées en .avif dans le Storage Supabase (cf. discussion sur og:image).
// Plutôt que de dépendre d'une conversion serveur (sharp & consorts, pas fiable partout sur
// Vercel), on vérifie le format réel de chaque photo : si c'est du PNG/JPEG on l'intègre en
// data URI, sinon on retombe sur l'avatar dégradé + initiales, qui a l'avantage de toujours
// fonctionner quel que soit le format d'origine.
async function loadPhotoAsDataUri(url) {
  if (!url) return null;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const contentType = resp.headers.get("content-type") || "";
    if (!/image\/(png|jpe?g)/i.test(contentType)) return null;
    const buf = await resp.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    return `data:${contentType};base64,${b64}`;
  } catch (e) {
    return null;
  }
}

function Half({ comic, photoDataUri }) {
  const [c1, c2] = gradientFor(comic?.nom);
  return (
    <div style={{ width: 600, height: 630, display: "flex", position: "relative", overflow: "hidden", background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
      {photoDataUri ? (
        <img src={photoDataUri} width={600} height={630} style={{ objectFit: "cover", position: "absolute", top: 0, left: 0 }} />
      ) : (
        <div style={{ width: 600, height: 630, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 160, fontWeight: 800, color: "rgba(255,255,255,0.85)", display: "flex" }}>{initials(comic?.nom)}</div>
        </div>
      )}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, height: 210, display: "flex", alignItems: "flex-end",
        background: "linear-gradient(to top, rgba(11,10,13,0.95), rgba(11,10,13,0))",
        padding: "0 36px 32px",
      }}>
        <div style={{ fontSize: 40, fontWeight: 800, color: C.text, display: "flex" }}>{comic?.nom || "???"}</div>
      </div>
    </div>
  );
}

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  let comicA = null;
  let comicB = null;
  if (id) {
    try {
      const qs = new URLSearchParams({
        select: "comic_a:comics!combats_comic_a_id_fkey(nom,photo_url),comic_b:comics!combats_comic_b_id_fkey(nom,photo_url)",
        id: `eq.${id}`,
      });
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/combats?${qs.toString()}`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      });
      const rows = await resp.json();
      const c = Array.isArray(rows) ? rows[0] : null;
      if (c) {
        comicA = c.comic_a;
        comicB = c.comic_b;
      }
    } catch (e) {
      // comicA/comicB restent null -> rendu générique (avatars + "???") ci-dessous.
    }
  }

  const [photoA, photoB] = await Promise.all([
    loadPhotoAsDataUri(comicA?.photo_url),
    loadPhotoAsDataUri(comicB?.photo_url),
  ]);

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", background: C.bg, position: "relative" }}>
        <Half comic={comicA} photoDataUri={photoA} />
        <Half comic={comicB} photoDataUri={photoB} />

        {/* Rature rouge en diagonale qui sépare les deux combattants */}
        <div style={{
          position: "absolute", left: -80, top: 278, width: 1360, height: 36,
          background: C.red, transform: "rotate(-9deg)", display: "flex",
          boxShadow: "0 0 30px rgba(224,87,74,0.6)",
        }} />

        {/* VS au centre, posé sur la rature */}
        <div style={{
          position: "absolute", left: 500, top: 265, width: 200, height: 100,
          display: "flex", alignItems: "center", justifyContent: "center",
          transform: "rotate(-9deg)", fontSize: 52, fontWeight: 900, color: C.text,
          textShadow: "0 0 18px rgba(0,0,0,0.9)",
        }}>VS</div>

        {/* Bandeau du site en haut */}
        <div style={{
          position: "absolute", top: 24, left: 0, right: 0, display: "flex", justifyContent: "center",
          fontSize: 22, fontWeight: 700, letterSpacing: 4, color: C.gold,
        }}>PASDRÔLE.FR · SUR LE RING</div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
