import { createClient } from "@supabase/supabase-js";

// Las claves vienen de variables de entorno (las configurás en Vercel y en .env.local)
const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(URL, KEY);

// ---- API de almacenamiento (reemplaza window.storage del artifact) ----
// Mantiene la misma forma: get / set / delete / list sobre una tabla kv.

export async function sget(key, fallback = null) {
  try {
    const { data, error } = await supabase.from("kv").select("value").eq("key", key).maybeSingle();
    if (error) { console.warn("sget", key, error.message); return fallback; }
    return data ? data.value : fallback;
  } catch (e) { console.warn("sget catch", e); return fallback; }
}

export async function sset(key, value) {
  try {
    const { error } = await supabase.from("kv").upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) { console.warn("sset", key, error.message); return false; }
    return true;
  } catch (e) { console.warn("sset catch", e); return false; }
}

export async function sdel(key) {
  try {
    const { error } = await supabase.from("kv").delete().eq("key", key);
    return !error;
  } catch { return false; }
}

// Lista las claves que empiezan con un prefijo (equivalente a storage.list)
export async function slist(prefix) {
  try {
    const { data, error } = await supabase.from("kv").select("key").like("key", `${prefix}%`);
    if (error) { console.warn("slist", error.message); return []; }
    return (data || []).map((r) => r.key);
  } catch { return []; }
}
