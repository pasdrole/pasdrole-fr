import { supabase } from "./supabaseClient";

function slugify(nom) {
  return nom.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Génère un slug propre (ex: "gad-elmaleh") en évitant les doublons ; si le nom existe déjà,
// ajoute -2, -3, etc. plutôt qu'un suffixe aléatoire, pour garder des URL lisibles.
async function generateUniqueSlug(nom, existingSlugs) {
  const base = slugify(nom);
  let candidate = base;
  let i = 2;
  while (existingSlugs.has(candidate)) {
    candidate = `${base}-${i}`;
    i++;
  }
  existingSlugs.add(candidate);
  return candidate;
}

// ---------- Humoristes ----------
export async function fetchPublishedComics() {
  const { data, error } = await supabase.from("comics").select("*").eq("status", "published").order("nom");
  if (error) throw error;
  return data;
}

export async function fetchAllComicsAdmin() {
  const { data, error } = await supabase.from("comics").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchComicById(id) {
  const { data, error } = await supabase.from("comics").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function fetchComicBySlug(slug) {
  const { data, error } = await supabase.from("comics").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createComic(comic) {
  const { data: existing, error: e0 } = await supabase.from("comics").select("slug");
  if (e0) throw e0;
  const existingSlugs = new Set((existing || []).map((c) => c.slug));
  const slug = await generateUniqueSlug(comic.nom, existingSlugs);
  const payload = { ...comic, slug };
  const { data, error } = await supabase.from("comics").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function bulkCreateComics(comics) {
  const { data: existing, error: e0 } = await supabase.from("comics").select("slug");
  if (e0) throw e0;
  const existingSlugs = new Set((existing || []).map((c) => c.slug));
  const payload = [];
  for (const c of comics) {
    const slug = await generateUniqueSlug(c.nom, existingSlugs);
    payload.push({ ...c, slug });
  }
  const { data, error } = await supabase.from("comics").insert(payload).select();
  if (error) throw error;
  return data;
}

// Migration à lancer une fois : régénère un slug propre pour TOUS les humoristes déjà en
// base (utile pour ceux créés avant ce changement, qui ont un slug avec suffixe aléatoire).
export async function regenerateAllSlugs() {
  const { data: allComics, error } = await supabase.from("comics").select("id, nom").order("nom");
  if (error) throw error;
  const existingSlugs = new Set();
  const results = [];
  for (const c of allComics) {
    const slug = await generateUniqueSlug(c.nom, existingSlugs);
    const { error: upErr } = await supabase.from("comics").update({ slug }).eq("id", c.id);
    results.push({ nom: c.nom, slug, status: upErr ? "error" : "ok" });
  }
  return results;
}

// Met à jour uniquement la date de naissance d'humoristes déjà existants (identifiés par
// leur nom exact), sans toucher au reste de la fiche (photo, bio, etc.).
export async function bulkUpdateBirthDates(updates) {
  const { data: allComics, error } = await supabase.from("comics").select("id, nom");
  if (error) throw error;
  const idByName = Object.fromEntries(allComics.map((c) => [c.nom.toLowerCase().trim(), c.id]));

  const results = [];
  for (const u of updates) {
    const id = idByName[u.nom.toLowerCase().trim()];
    if (!id) { results.push({ nom: u.nom, status: "not_found" }); continue; }
    const { error: upErr } = await supabase.from("comics").update({ date_naissance: u.date_naissance }).eq("id", id);
    results.push({ nom: u.nom, status: upErr ? "error" : "ok" });
  }
  return results;
}

export async function updateComicStatus(id, status) {
  const { error } = await supabase.from("comics").update({ status }).eq("id", id);
  if (error) throw error;
}

// Édition complète d'une fiche déjà existante (admin) — nom, pays, genres, bio, spectacles, date de naissance.
export async function updateComic(id, fields) {
  const { error } = await supabase.from("comics").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteComic(id) {
  const { error } = await supabase.from("comics").delete().eq("id", id);
  if (error) throw error;
}

// Upload une photo dans le bucket Storage "image", puis met à jour photo_url sur l'humoriste.
export async function uploadComicPhoto(comicId, file) {
  const ext = file.name.split(".").pop();
  const path = `${comicId}-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("image").upload(path, file, { upsert: true });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from("image").getPublicUrl(path);
  const { error: updErr } = await supabase.from("comics").update({ photo_url: data.publicUrl }).eq("id", comicId);
  if (updErr) throw updErr;
  return data.publicUrl;
}

// ---------- Catégories & critères ----------
export async function fetchCategories() {
  const { data, error } = await supabase.from("categories").select("*").order("priority");
  if (error) throw error;
  return data;
}

export async function fetchCriteriaByCategory(categoryId) {
  const { data, error } = await supabase.from("criteria").select("*").eq("category_id", categoryId).order("display_order");
  if (error) throw error;
  return data;
}

// Catégorie primaire d'un comic (celle avec la priorité la plus basse parmi ses tags).
// Retourne null si le comic n'a encore aucune catégorie assignée.
export async function fetchComicCategory(comicId) {
  const { data, error } = await supabase.from("comic_primary_category").select("*").eq("comic_id", comicId).maybeSingle();
  if (error) throw error;
  return data;
}

// Select simple côté admin : remplace toute(s) catégorie(s) existante(s) du comic par une seule.
export async function setComicCategory(comicId, categoryId) {
  const { error: delErr } = await supabase.from("comic_categories").delete().eq("comic_id", comicId);
  if (delErr) throw delErr;
  if (!categoryId) return;
  const { error } = await supabase.from("comic_categories").insert({ comic_id: comicId, category_id: categoryId });
  if (error) throw error;
}

// ---------- Notes ----------
// Chaque ligne "ratings" porte déjà score_global (moyenne calculée par trigger côté DB).
// rating_scores(score, criteria(slug,label)) permet d'afficher le détail par critère
// (radar chart, relecture du formulaire) sans requête supplémentaire.
export async function fetchRatingsForComic(comicId) {
  const { data, error } = await supabase
    .from("ratings")
    .select("*, rating_scores(criteria_id, score, criteria(slug,label))")
    .eq("comic_id", comicId);
  if (error) throw error;
  return data;
}

export async function fetchMyRating(comicId, userId) {
  const { data, error } = await supabase
    .from("ratings")
    .select("*, rating_scores(criteria_id, score, criteria(slug,label))")
    .eq("comic_id", comicId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// "Upsert" = crée la note si elle n'existe pas, la met à jour sinon (même logique qu'avant,
// contrainte unique(comic_id, user_id) sur ratings). categoryId est stocké en snapshot sur la
// ligne ratings ; criteriaList est la grille utilisée (déjà chargée côté composant) ;
// scoresBySlug est du type { ecriture: 8, jeu_scene: 7, interaction_public: 9 }.
export async function upsertRating(comicId, userId, categoryId, criteriaList, scoresBySlug) {
  const { data: ratingRow, error } = await supabase
    .from("ratings")
    .upsert(
      { comic_id: comicId, user_id: userId, category_id: categoryId, updated_at: new Date().toISOString() },
      { onConflict: "comic_id,user_id" }
    )
    .select()
    .single();
  if (error) throw error;

  const scoreRows = criteriaList
    .filter((c) => typeof scoresBySlug[c.slug] === "number")
    .map((c) => ({ rating_id: ratingRow.id, criteria_id: c.id, score: scoresBySlug[c.slug] }));

  const { error: scoresErr } = await supabase
    .from("rating_scores")
    .upsert(scoreRows, { onConflict: "rating_id,criteria_id" });
  if (scoresErr) throw scoresErr;

  return ratingRow;
}

// ---------- Avis ----------
// IMPORTANT : pas de jointure automatique "profiles(pseudo)" ici -- il n'y a pas
// de vraie clé étrangère entre reviews et profiles en base, donc Supabase refuse
// cette syntaxe (erreur 400). On récupère les avis, puis les pseudos, séparément.
export async function fetchReviewsForComic(comicId) {
  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("comic_id", comicId)
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!reviews || !reviews.length) return [];

  const userIds = [...new Set(reviews.map((r) => r.user_id))];
  const { data: profiles, error: e2 } = await supabase
    .from("profiles")
    .select("id, pseudo")
    .in("id", userIds);
  if (e2) throw e2;

  const pseudoById = Object.fromEntries((profiles || []).map((p) => [p.id, p.pseudo]));
  return reviews.map((r) => ({ ...r, profiles: { pseudo: pseudoById[r.user_id] || "Anonyme" } }));
}

export async function fetchMyReview(comicId, userId) {
  const { data, error } = await supabase.from("reviews").select("*").eq("comic_id", comicId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

// Le webhook natif Supabase (schéma supabase_functions) n'est pas disponible sur ce
// projet, donc on appelle directement la fonction d'email depuis le client, en best-effort
// (un échec de notification ne doit jamais empêcher l'action principale de fonctionner).
const RESEND_EMAIL_URL = "https://gltyvhjhormviwkpjrkw.supabase.co/functions/v1/notify-review";
const SUPABASE_ANON_KEY = "sb_publishable_E2jgrQt2fn1-a0dETLwuVA_knh429uQ";

async function sendAdminEmail(subject, text) {
  try {
    await fetch(RESEND_EMAIL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify({ subject, text }),
    });
  } catch (e) {
    console.error("Erreur envoi email admin:", e);
  }
}

// Chaque publication/modification repasse en attente de validation.
export async function upsertReview(comicId, userId, content, comicNom) {
  const { error } = await supabase.from("reviews").upsert(
    { comic_id: comicId, user_id: userId, content, status: "pending", updated_at: new Date().toISOString() },
    { onConflict: "comic_id,user_id" }
  );
  if (error) throw error;
  sendAdminEmail(
    `Nouvel avis à valider — ${comicNom || "un humoriste"}`,
    `Un nouvel avis attend validation sur ${comicNom || "un humoriste"}.\n\n"${content}"\n\nVa dans l'admin > Avis sur pasdrole.fr pour le valider ou le refuser.`
  );
}

// ---------- Contact ----------
export async function submitContactMessage(name, email, message) {
  const { error } = await supabase.from("contact_messages").insert({ name, email, message });
  if (error) throw error;
  sendAdminEmail(
    `Nouveau message de contact — ${name}`,
    `De : ${name} (${email})\n\n${message}`
  );
}

// ---------- Modération des avis (admin) ----------
// Derniers avis validés, tous humoristes confondus (widget accueil).
export async function fetchLatestReviews(limit = 6) {
  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("*, comics(id, nom, photo_url)")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!reviews || !reviews.length) return [];

  const userIds = [...new Set(reviews.map((r) => r.user_id))];
  const { data: profiles, error: e2 } = await supabase.from("profiles").select("id, pseudo").in("id", userIds);
  if (e2) throw e2;

  const pseudoById = Object.fromEntries((profiles || []).map((p) => [p.id, p.pseudo]));
  return reviews.map((r) => ({ ...r, profiles: { pseudo: pseudoById[r.user_id] || "Anonyme" } }));
}

export async function fetchPendingReviews() {
  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("*, comics(nom)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!reviews || !reviews.length) return [];

  const userIds = [...new Set(reviews.map((r) => r.user_id))];
  const { data: profiles, error: e2 } = await supabase
    .from("profiles")
    .select("id, pseudo")
    .in("id", userIds);
  if (e2) throw e2;

  const pseudoById = Object.fromEntries((profiles || []).map((p) => [p.id, p.pseudo]));
  return reviews.map((r) => ({ ...r, profiles: { pseudo: pseudoById[r.user_id] || "Anonyme" } }));
}

export async function updateReviewStatus(reviewId, status) {
  const { error } = await supabase.from("reviews").update({ status }).eq("id", reviewId);
  if (error) throw error;
}

export async function deleteReview(comicId, userId) {
  const { error } = await supabase.from("reviews").delete().eq("comic_id", comicId).eq("user_id", userId);
  if (error) throw error;
}

// ---------- Vidéos YouTube ----------
export async function searchYouTubeVideos(query) {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("Clé API YouTube manquante (VITE_YOUTUBE_API_KEY).");
  const params = new URLSearchParams({
    part: "snippet", q: query, type: "video", maxResults: "5", key: apiKey,
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return (data.items || []).map((item) => ({
    youtube_video_id: item.id.videoId,
    title: item.snippet.title,
    thumbnail_url: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || "",
  }));
}

export async function saveComicVideos(comicId, videos) {
  const payload = videos.map((v) => ({
    comic_id: comicId, youtube_video_id: v.youtube_video_id, title: v.title, thumbnail_url: v.thumbnail_url,
  }));
  const { error } = await supabase.from("comic_videos").insert(payload);
  if (error) throw error;
}

export async function fetchVideosForComic(comicId) {
  const { data, error } = await supabase.from("comic_videos").select("*").eq("comic_id", comicId).order("created_at");
  if (error) throw error;
  return data;
}

export async function deleteComicVideo(videoId) {
  const { error } = await supabase.from("comic_videos").delete().eq("id", videoId);
  if (error) throw error;
}

export async function fetchVideoRatings(videoId) {
  const { data, error } = await supabase.from("video_ratings").select("rating").eq("video_id", videoId);
  if (error) throw error;
  return data;
}

export async function fetchMyVideoRating(videoId, userId) {
  const { data, error } = await supabase.from("video_ratings").select("*").eq("video_id", videoId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertVideoRating(videoId, userId, rating) {
  const { error } = await supabase.from("video_ratings").upsert(
    { video_id: videoId, user_id: userId, rating, updated_at: new Date().toISOString() },
    { onConflict: "video_id,user_id" }
  );
  if (error) throw error;
}

// ---------- Mode Match (duels) ----------
// Récupère les votes déjà enregistrés pour un duel précis (comicAId/comicBId doivent être
// passés dans un ordre cohérent — voir orderMatchPair côté App.jsx — pour que tous les votes
// d'un même duel, peu importe qui a initié le duel, retombent sur la même paire en base.
export async function fetchMatchVotes(comicAId, comicBId) {
  const { data, error } = await supabase
    .from("match_votes")
    .select("winner_id")
    .eq("comic_a_id", comicAId)
    .eq("comic_b_id", comicBId);
  if (error) throw error;
  return data;
}

export async function submitMatchVote(comicAId, comicBId, winnerId) {
  const { error } = await supabase.from("match_votes").insert({ comic_a_id: comicAId, comic_b_id: comicBId, winner_id: winnerId });
  if (error) throw error;
}

// Tous les votes de duels (pour calculer les classements "plus grand vainqueur / loser").
// Volume raisonnable tant que le mode Match reste un gadget viral ; à revoir avec une vraie
// requête d'agrégation SQL si ça grossit beaucoup.
export async function fetchAllMatchVotes() {
  const { data, error } = await supabase.from("match_votes").select("comic_a_id, comic_b_id, winner_id, created_at");
  if (error) throw error;
  return data;
}

// ---------- "Mes avis" — tout ce qu'un compte a noté/commenté ----------
export async function fetchActiveCombat() {
  const { data, error } = await supabase
    .from("combats")
    .select(`
      id, comic_a_id, comic_b_id, started_at,
      comic_a:comics!combats_comic_a_id_fkey(id, nom, photo_url, slug),
      comic_b:comics!combats_comic_b_id_fkey(id, nom, photo_url, slug)
    `)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { count: votesA } = await supabase.from("match_votes").select("*", { count: "exact", head: true }).eq("combat_id", data.id).eq("winner_id", data.comic_a_id);
  const { count: votesB } = await supabase.from("match_votes").select("*", { count: "exact", head: true }).eq("combat_id", data.id).eq("winner_id", data.comic_b_id);
  return { ...data, votesA: votesA || 0, votesB: votesB || 0 };
}

export async function fetchLastCombat() {
  const { data, error } = await supabase
    .from("combats")
    .select(`
      id, ended_at, votes_a, votes_b,
      comic_a:comics!combats_comic_a_id_fkey(id, nom, photo_url, slug),
      comic_b:comics!combats_comic_b_id_fkey(id, nom, photo_url, slug),
      winner:comics!combats_winner_id_fkey(id, nom, photo_url, slug)
    `)
    .eq("is_active", false)
    .order("ended_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchCombatHistory() {
  const { data, error } = await supabase
    .from("combats")
    .select(`
      id, ended_at, votes_a, votes_b,
      comic_a:comics!combats_comic_a_id_fkey(id, nom, photo_url, slug),
      comic_b:comics!combats_comic_b_id_fkey(id, nom, photo_url, slug),
      winner:comics!combats_winner_id_fkey(id, nom, photo_url, slug)
    `)
    .eq("is_active", false)
    .order("ended_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Vote "Sur le ring" : passe par l'Edge Function combat-vote plutôt qu'un insert direct,
// pour que la vérification anti-fraude (IP hashée côté serveur + empreinte navigateur) soit
// infalsifiable depuis le client. Le mode Match public (duels aléatoires) reste en insert direct.
const COMBAT_VOTE_URL = "https://gltyvhjhormviwkpjrkw.supabase.co/functions/v1/combat-vote";

export async function submitCombatVote(combatId, comicAId, comicBId, winnerId, fingerprint) {
  const res = await fetch(COMBAT_VOTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "apikey": SUPABASE_ANON_KEY },
    body: JSON.stringify({ combat_id: combatId, comic_a_id: comicAId, comic_b_id: comicBId, winner_id: winnerId, fingerprint }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (body.error === "already_voted") {
      const err = new Error("already_voted");
      err.code = "already_voted";
      throw err;
    }
    throw new Error(body.error || "Erreur lors du vote");
  }
}

export async function fetchComicsForCombatAdmin() {
  const { data, error } = await supabase.from("comics").select("id, nom").eq("status", "published").order("nom");
  if (error) throw error;
  return data || [];
}

export async function launchCombat(comicAId, comicBId) {
  const { error } = await supabase.from("combats").insert({ comic_a_id: comicAId, comic_b_id: comicBId });
  if (error) throw error;
}

export async function closeCombat(combat) {
  const { count: votesA } = await supabase.from("match_votes").select("*", { count: "exact", head: true }).eq("combat_id", combat.id).eq("winner_id", combat.comic_a_id);
  const { count: votesB } = await supabase.from("match_votes").select("*", { count: "exact", head: true }).eq("combat_id", combat.id).eq("winner_id", combat.comic_b_id);
  const winnerId = (votesA || 0) >= (votesB || 0) ? combat.comic_a_id : combat.comic_b_id;
  const { error } = await supabase.from("combats").update({
    is_active: false, ended_at: new Date().toISOString(), winner_id: winnerId, votes_a: votesA || 0, votes_b: votesB || 0,
  }).eq("id", combat.id);
  if (error) throw error;
}

export async function fetchMyActivity(userId) {
  const [{ data: ratings, error: e1 }, { data: reviews, error: e2 }] = await Promise.all([
    supabase.from("ratings").select("*, comics(id, nom)").eq("user_id", userId),
    supabase.from("reviews").select("*, comics(id, nom)").eq("user_id", userId),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return { ratings, reviews };
}

// ---------- Profil / rôle ----------
export async function fetchMyProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createProfile(userId, pseudo) {
  const { error } = await supabase.from("profiles").insert({ id: userId, pseudo });
  if (error) throw error;
}

// ---------- Streamers (Indice de Forme) ----------
// Phase privée : ces fonctions alimentent des pages non liées dans la nav et en noindex,
// tant que l'outreach auprès des streamers (voir plan produit) n'est pas fait.

export async function fetchTrackedStreamersAdmin() {
  const { data, error } = await supabase.from("streamers").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addTrackedStreamer(twitchLogin) {
  const login = twitchLogin.trim().toLowerCase();
  if (!login) throw new Error("Login Twitch requis");
  const { error } = await supabase.from("streamers").insert({ twitch_login: login, slug: login, tracked: true });
  if (error) throw error;
}

export async function setStreamerTracked(id, tracked) {
  const { error } = await supabase.from("streamers").update({ tracked }).eq("id", id);
  if (error) throw error;
}

export async function deleteStreamer(id) {
  const { error } = await supabase.from("streamers").delete().eq("id", id);
  if (error) throw error;
}

// Classement "Top Forme" : le dernier score connu de chaque streamer suivi.
export async function fetchStreamersRanking() {
  const { data: streamers, error } = await supabase
    .from("streamers").select("id, twitch_login, slug, nom_affiche, avatar_url, verified, followers_count").eq("tracked", true);
  if (error) throw error;
  if (!streamers || !streamers.length) return [];

  const { data: scores, error: scoresError } = await supabase
    .from("streamer_score_history")
    .select("streamer_id, score_forme, momentum, is_provisional, computed_at")
    .in("streamer_id", streamers.map((s) => s.id))
    .order("computed_at", { ascending: false });
  if (scoresError) throw scoresError;

  const latestByStreamer = {};
  (scores || []).forEach((s) => { if (!latestByStreamer[s.streamer_id]) latestByStreamer[s.streamer_id] = s; });

  return streamers
    .map((s) => ({ ...s, score: latestByStreamer[s.id] || null }))
    .filter((s) => s.score) // pas encore de score = pas assez de streams clos, hors classement
    .sort((a, b) => b.score.score_forme - a.score.score_forme);
}

// Fiche détail d'un streamer : infos + historique de score (pour le sparkline) + derniers streams.
export async function fetchStreamerDetail(twitchLogin) {
  const { data: streamer, error } = await supabase.from("streamers").select("*").eq("twitch_login", twitchLogin.toLowerCase()).maybeSingle();
  if (error) throw error;
  if (!streamer) return null;

  const [{ data: history }, { data: streams }, { data: baseline }] = await Promise.all([
    supabase.from("streamer_score_history").select("*").eq("streamer_id", streamer.id).order("computed_at", { ascending: true }).limit(20),
    supabase.from("streams").select("*").eq("streamer_id", streamer.id).in("status", ["provisoire", "consolide"]).order("started_at", { ascending: false }).limit(10),
    supabase.from("streamer_baselines").select("*").eq("streamer_id", streamer.id).maybeSingle(),
  ]);

  return { streamer, history: history || [], streams: streams || [], baseline };
}

// Marque un stream comme "événement" (exclu du calcul de forme, gardé pour les records) — admin uniquement.
export async function setStreamEventTag(streamId, isEvent) {
  const { error } = await supabase.from("streams").update({ is_event: isEvent }).eq("id", streamId);
  if (error) throw error;
}

// Construit l'URL d'autorisation Twitch pour le programme "Streamer vérifié" (opt-in followers).
// client_id est public par nature (visible dans toute app OAuth), safe à exposer côté front.
const TWITCH_CLIENT_ID = import.meta.env.VITE_TWITCH_CLIENT_ID || "";
export function getTwitchConnectUrl(streamerId) {
  const params = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    redirect_uri: "https://pasdrole.fr/auth/twitch/callback",
    response_type: "code",
    scope: "moderator:read:followers",
    state: streamerId,
  });
  return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
}

// ---------- Notation des VOD streamers (même pattern que video_ratings pour les comédiens) ----------
export async function fetchStreamVodRatings(streamId) {
  const { data, error } = await supabase.from("stream_vod_ratings").select("rating").eq("stream_id", streamId);
  if (error) throw error;
  return data;
}

export async function fetchMyStreamVodRating(streamId, userId) {
  const { data, error } = await supabase.from("stream_vod_ratings").select("*").eq("stream_id", streamId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertStreamVodRating(streamId, userId, rating) {
  const { error } = await supabase.from("stream_vod_ratings").upsert(
    { stream_id: streamId, user_id: userId, rating, updated_at: new Date().toISOString() },
    { onConflict: "stream_id,user_id" }
  );
  if (error) throw error;
}
