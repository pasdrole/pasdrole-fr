// Sert /combat/:id avec les balises SEO/Open Graph déjà remplies (title, description, og:image)
// AVANT que le JS ne s'exécute — indispensable car les robots qui génèrent les aperçus de lien
// (WhatsApp, Messenger, Twitter/X, Facebook, iMessage...) ne lancent pas notre React : ils ne
// lisent que le HTML brut renvoyé par le serveur. Le fix précédent (document.title / meta tags
// mis à jour via un useEffect côté client) fonctionne pour un vrai visiteur qui charge la page
// dans un navigateur, mais reste invisible pour ces robots — d'où l'aperçu générique constaté.
//
// On récupère le vrai index.html buildé (pour ne jamais désynchroniser le hash du bundle JS
// injecté par Vite), on y injecte les bonnes balises, puis on renvoie ce HTML à tout le monde
// (robots ET vrais visiteurs) : le script de l'app démarre normalement ensuite pour ces derniers.

const SUPABASE_URL = "https://gltyvhjhormviwkpjrkw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsdHl2aGpob3Jtdml3a3Bqcmt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NTc1MzYsImV4cCI6MjEwMDIzMzUzNn0.VJRmK0Jpw8oJMxTvLr_9-oL6JTilg3X8MO54rTOBexw";

const DEFAULT_TITLE = "PasDrôle.fr — Le classement des humoristes par le public";
const DEFAULT_DESCRIPTION = "Notez et classez vos humoristes préférés sur l'écriture, le jeu de scène, l'originalité et la présence scénique. Le classement des humoristes établi par le public.";

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export default async function handler(req, res) {
  const id = req.query.id;
  const origin = `https://${req.headers.host}`;

  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  let image = `${origin}/logo-mike.png`;
  const url = `${origin}/combat/${id || ""}`;

  if (id) {
    try {
      const qs = new URLSearchParams({
        select: "id,comic_a:comics!combats_comic_a_id_fkey(nom,photo_url),comic_b:comics!combats_comic_b_id_fkey(nom,photo_url)",
        id: `eq.${id}`,
      });
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/combats?${qs.toString()}`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      });
      const rows = await resp.json();
      const c = Array.isArray(rows) ? rows[0] : null;
      if (c && c.comic_a && c.comic_b) {
        title = `${c.comic_a.nom} vs ${c.comic_b.nom} — Sur le ring | PasDrôle.fr`;
        description = `${c.comic_a.nom} ou ${c.comic_b.nom} ? Découvre qui l'emporte dans ce combat sur PasDrôle.fr et vote à ton tour.`;
        image = c.comic_a.photo_url || c.comic_b.photo_url || image;
      }
    } catch (e) {
      // En cas de souci réseau/API, on garde les valeurs par défaut plutôt que de planter la page.
      console.error("Erreur récupération combat pour SEO:", e);
    }
  }

  let html;
  try {
    const htmlResp = await fetch(`${origin}/index.html`);
    html = await htmlResp.text();
  } catch (e) {
    res.status(502).send("Erreur serveur");
    return;
  }

  // Le index.html statique contient déjà quelques balises og:*/twitter:* de base (posées
  // pour le SEO générique de l'accueil) — on les retire d'abord pour ne pas se retrouver avec
  // des doublons (ex: deux og:site_name) une fois notre propre bloc réinjecté juste après.
  html = html
    .replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi, "")
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${escapeHtml(description)}">`)
    .replace(
      "</head>",
      `<meta property="og:site_name" content="PasDrôle.fr">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta name="twitter:card" content="summary_large_image">
</head>`
    );

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.status(200).send(html);
}
