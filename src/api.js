import { supabase } from "./supabaseClient";

export const CRITERIA = [
  { key: "ecriture", label: "Écriture" },
  { key: "jeu_de_scene", label: "Jeu de scène" },
  { key: "originalite", label: "Originalité" },
  { key: "presence", label: "Présence scénique" },
  { key: "interaction", label: "Interaction public" },
  { key: "regularite", label: "Régularité" },
];

function slugify(nom) {
  return nom.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
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

export async function createComic(comic) {
  const payload = { ...comic, slug: slugify(comic.nom) + "-" + Math.random().toString(36).slice(2, 6) };
  const { data, error } = await supabase.from("comics").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function bulkCreateComics(comics) {
  const payload = comics.map((c) => ({ ...c, slug: slugify(c.nom) + "-" + Math.random().toString(36).slice(2, 6) }));
  const { data, error } = await supabase.from("comics").insert(payload).select();
  if (error) throw error;
  return data;
}

export async function updateComicStatus(id, status) {
  const { error } = await supabase.from("comics").update({ status }).eq("id", id);
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

// ---------- Notes ----------
export async function fetchRatingsForComic(comicId) {
  const { data, error } = await supabase.from("ratings").select("*").eq("comic_id", comicId);
  if (error) throw error;
  return data;
}

export async function fetchMyRating(comicId, userId) {
  const { data, error } = await supabase.from("ratings").select("*").eq("comic_id", comicId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

// "Upsert" = crée la note si elle n'existe pas, la met à jour sinon.
// Combiné à la contrainte unique(comic_id, user_id) posée dans le schéma SQL,
// ça garantit qu'un compte n'a jamais plus d'une note par humoriste.
export async function upsertRating(comicId, userId, values) {
  const { error } = await supabase.from("ratings").upsert(
    { comic_id: comicId, user_id: userId, ...values, updated_at: new Date().toISOString() },
    { onConflict: "comic_id,user_id" }
  );
  if (error) throw error;
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
const RESEND_EMAIL_URL = "https://gltyvhjhormviwkpjrkw.functions.supabase.co/resend-email";
const SUPABASE_ANON_KEY = "sb_publishable_E2jgrQt2fn1-a0dETLwuVA_knh429uQ";

async function sendAdminEmail(subject, text) {
  try {
    await fetch(RESEND_EMAIL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
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

// ---------- "Mes avis" — tout ce qu'un compte a noté/commenté ----------
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
