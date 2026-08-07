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

// ---------- Notes ----------

export async function fetchReviewsForComic(comicId) {
  const { data: reviews, error } = await supabase.from("reviews").select("*").eq("comic_id", comicId).order("created_at", { ascending: false });
  if (error) throw error;
  if (!reviews.length) return [];
  const userIds = [...new Set(reviews.map((r) => r.user_id))];
  const { data: profiles, error: e2 } = await supabase.from("profiles").select("id, pseudo").in("id", userIds);
  if (e2) throw e2;
  const pseudoById = Object.fromEntries((profiles || []).map((p) => [p.id, p.pseudo]));
  return reviews.map((r) => ({ ...r, profiles: { pseudo: pseudoById[r.user_id] || "Anonyme" } }));
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
export async function fetchReviewsForComic(comicId) {
  const { data, error } = await supabase.from("reviews").select("*, profiles(pseudo)").eq("comic_id", comicId).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchMyReview(comicId, userId) {
  const { data, error } = await supabase.from("reviews").select("*").eq("comic_id", comicId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertReview(comicId, userId, content) {
  const { error } = await supabase.from("reviews").upsert(
    { comic_id: comicId, user_id: userId, content, updated_at: new Date().toISOString() },
    { onConflict: "comic_id,user_id" }
  );
  if (error) throw error;
}

export async function deleteReview(comicId, userId) {
  const { error } = await supabase.from("reviews").delete().eq("comic_id", comicId).eq("user_id", userId);
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
