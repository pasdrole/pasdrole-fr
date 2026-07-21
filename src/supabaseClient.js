import { createClient } from "@supabase/supabase-js";

// ⚠️ Ces valeurs viennent de variables d'environnement (voir .env.example).
// La clé "anon" est PUBLIQUE par conception — ce n'est pas un secret à cacher,
// la vraie protection vient des règles de sécurité (Row Level Security) posées
// dans supabase-schema.sql. Ne jamais mettre la clé "service_role" ici.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://gltyvhjhormviwkpjrkw.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsdHl2aGpob3Jtdml3a3Bqcmt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NTc1MzYsImV4cCI6MjEwMDIzMzUzNn0.VJRmK0Jpw8oJMxTvLr_9-oL6JTilg3X8MO54rTOBexw";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
