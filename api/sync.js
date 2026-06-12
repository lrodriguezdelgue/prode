// api/sync.js — La Scalonetta · Sync de resultados
// Fuente: worldcup26.ir/get/games (gratis, sin key)
// Fallback: football-data.org (token gratuito opcional)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SYNC_SECRET   = process.env.SYNC_SECRET;
const FD_TOKEN      = process.env.FOOTBALL_DATA_TOKEN; // opcional

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- MAPA inglés → español ----------
const NAME_MAP = {
  "Mexico": "México", "South Africa": "Sudáfrica",
  "South Korea": "Corea del Sur", "Czech Republic": "Rep. Checa",
  "Canada": "Canadá", "Switzerland": "Suiza",
  "Qatar": "Catar", "Bosnia and Herzegovina": "Bosnia y H.", "Bosnia & Herzegovina": "Bosnia y H.",
  "Brazil": "Brasil", "Morocco": "Marruecos", "Scotland": "Escocia", "Haiti": "Haití",
  "United States": "Estados Unidos", "USA": "Estados Unidos",
  "Australia": "Australia", "Paraguay": "Paraguay",
  "Turkey": "Türkiye", "Türkiye": "Türkiye",
  "Germany": "Alemania", "Ecuador": "Ecuador",
  "Ivory Coast": "Costa de Marfil", "Côte d'Ivoire": "Costa de Marfil",
  "Curaçao": "Curazao", "Curacao": "Curazao",
  "Netherlands": "Países Bajos", "Japan": "Japón",
  "Tunisia": "Túnez", "Sweden": "Suecia",
  "Belgium": "Bélgica", "Egypt": "Egipto",
  "Iran": "Irán", "New Zealand": "Nueva Zelanda",
  "Spain": "España", "Uruguay": "Uruguay",
  "Saudi Arabia": "Arabia Saudí", "Cape Verde": "Cabo Verde",
  "France": "Francia", "Senegal": "Senegal",
  "Norway": "Noruega", "Iraq": "Irak",
  "Argentina": "Argentina", "Austria": "Austria",
  "Algeria": "Argelia", "Jordan": "Jordania",
  "Portugal": "Portugal", "Colombia": "Colombia",
  "Uzbekistan": "Uzbekistán",
  "DR Congo": "R.D. Congo", "Congo DR": "R.D. Congo",
  "Democratic Republic of the Congo": "R.D. Congo",
  "Democratic Republic of Congo": "R.D. Congo",
  "England": "Inglaterra", "Croatia": "Croacia",
  "Panama": "Panamá", "Ghana": "Ghana",
};
const normalize = (name) => NAME_MAP[name?.trim()] || name?.trim() || "";

// ---------- FIXTURE INDEX: [matchId, home_es, away_es] ----------
const FIXTURE_INDEX = [
  ["A-0","México","Sudáfrica"],["A-1","Corea del Sur","Rep. Checa"],
  ["A-2","Rep. Checa","Sudáfrica"],["A-3","México","Corea del Sur"],
  ["A-4","México","Rep. Checa"],["A-5","Sudáfrica","Corea del Sur"],
  ["B-6","Canadá","Bosnia y H."],["B-7","Catar","Suiza"],
  ["B-8","Suiza","Bosnia y H."],["B-9","Canadá","Catar"],
  ["B-10","Suiza","Canadá"],["B-11","Bosnia y H.","Catar"],
  ["C-12","Brasil","Marruecos"],["C-13","Haití","Escocia"],
  ["C-14","Brasil","Haití"],["C-15","Escocia","Marruecos"],
  ["C-16","Escocia","Brasil"],["C-17","Marruecos","Haití"],
  ["D-18","Estados Unidos","Paraguay"],["D-19","Australia","Türkiye"],
  ["D-20","Türkiye","Paraguay"],["D-21","Estados Unidos","Australia"],
  ["D-22","Türkiye","Estados Unidos"],["D-23","Paraguay","Australia"],
  ["E-24","Alemania","Curazao"],["E-25","Costa de Marfil","Ecuador"],
  ["E-26","Alemania","Costa de Marfil"],["E-27","Ecuador","Curazao"],
  ["E-28","Ecuador","Alemania"],["E-29","Curazao","Costa de Marfil"],
  ["F-30","Países Bajos","Japón"],["F-31","Suecia","Túnez"],
  ["F-32","Países Bajos","Suecia"],["F-33","Túnez","Japón"],
  ["F-34","Túnez","Países Bajos"],["F-35","Japón","Suecia"],
  ["G-36","Bélgica","Egipto"],["G-37","Irán","Nueva Zelanda"],
  ["G-38","Bélgica","Irán"],["G-39","Nueva Zelanda","Egipto"],
  ["G-40","Nueva Zelanda","Bélgica"],["G-41","Egipto","Irán"],
  ["H-42","España","Cabo Verde"],["H-43","Arabia Saudí","Uruguay"],
  ["H-44","España","Arabia Saudí"],["H-45","Uruguay","Cabo Verde"],
  ["H-46","Uruguay","España"],["H-47","Cabo Verde","Arabia Saudí"],
  ["I-48","Francia","Senegal"],["I-49","Irak","Noruega"],
  ["I-50","Francia","Irak"],["I-51","Noruega","Senegal"],
  ["I-52","Noruega","Francia"],["I-53","Senegal","Irak"],
  ["J-54","Argentina","Argelia"],["J-55","Austria","Jordania"],
  ["J-56","Argentina","Austria"],["J-57","Jordania","Argelia"],
  ["J-58","Jordania","Argentina"],["J-59","Argelia","Austria"],
  ["K-60","Portugal","R.D. Congo"],["K-61","Uzbekistán","Colombia"],
  ["K-62","Portugal","Uzbekistán"],["K-63","Colombia","R.D. Congo"],
  ["K-64","Colombia","Portugal"],["K-65","R.D. Congo","Uzbekistán"],
  ["L-66","Inglaterra","Croacia"],["L-67","Ghana","Panamá"],
  ["L-68","Inglaterra","Ghana"],["L-69","Panamá","Croacia"],
  ["L-70","Panamá","Inglaterra"],["L-71","Croacia","Ghana"],
];

function buildLookup() {
  const map = {};
  for (const [id, home, away] of FIXTURE_INDEX) {
    map[`${home}|${away}`] = { id, fixtureHome: home };
    map[`${away}|${home}`] = { id, fixtureHome: home }; // invertido
  }
  return map;
}

// score → L/E/V desde perspectiva del home del fixture
function toCode(homeGoals, awayGoals, fixtureHome, apiHome) {
  const inverted = fixtureHome !== apiHome;
  const h = inverted ? awayGoals : homeGoals;
  const a = inverted ? homeGoals : awayGoals;
  if (h > a) return "L";
  if (h < a) return "V";
  return "E";
}

// ---------- FUENTE 1: worldcup26.ir ----------
async function fetchWC26() {
  const res = await fetch("https://worldcup26.ir/get/games", {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`worldcup26.ir HTTP ${res.status}`);
  const data = await res.json();
  const games = Array.isArray(data) ? data : (data.games || data.matches || data.data || []);
  return games;
}

function parseWC26(games, lookup) {
  const grupos = {};
  let synced = 0;
  for (const g of games) {
    // "finished" viene como string "TRUE"/"FALSE" o boolean
    const fin = g.finished === true || String(g.finished).toUpperCase() === "TRUE";
    if (!fin) continue;
    const hs = Number(g.home_score);
    const as_ = Number(g.away_score);
    if (isNaN(hs) || isNaN(as_)) continue;
    const home = normalize(g.home_team_name_en || g.home_team || "");
    const away = normalize(g.away_team_name_en || g.away_team || "");
    const match = lookup[`${home}|${away}`];
    if (!match) { console.warn("Sin match para:", home, "vs", away); continue; }
    grupos[match.id] = toCode(hs, as_, match.fixtureHome, home);
    synced++;
  }
  return { grupos, synced };
}

// ---------- FUENTE 2: football-data.org (fallback) ----------
async function fetchFD() {
  if (!FD_TOKEN) throw new Error("No FOOTBALL_DATA_TOKEN");
  const res = await fetch(
    "https://api.football-data.org/v4/competitions/WC/matches?season=2026",
    { headers: { "X-Auth-Token": FD_TOKEN }, signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`football-data.org HTTP ${res.status}`);
  const data = await res.json();
  return data.matches || [];
}

function parseFD(matches, lookup) {
  const grupos = {};
  let synced = 0;
  for (const m of matches) {
    if (m.status !== "FINISHED") continue;
    const hs = m.score?.fullTime?.home;
    const as_ = m.score?.fullTime?.away;
    if (hs === null || hs === undefined) continue;
    const home = normalize(m.homeTeam?.name || "");
    const away = normalize(m.awayTeam?.name || "");
    const match = lookup[`${home}|${away}`];
    if (!match) { console.warn("Sin match FD:", home, "vs", away); continue; }
    grupos[match.id] = toCode(Number(hs), Number(as_), match.fixtureHome, home);
    synced++;
  }
  return { grupos, synced };
}

// ---------- HANDLER ----------
export default async function handler(req, res) {
  if (req.headers["x-sync-secret"] !== SYNC_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const lookup = buildLookup();
  let grupos = {}, synced = 0, source = "none";

  try {
    const games = await fetchWC26();
    console.log(`worldcup26.ir: ${games.length} partidos`);
    ({ grupos, synced } = parseWC26(games, lookup));
    source = "worldcup26.ir";
  } catch (e1) {
    console.warn("worldcup26.ir falló:", e1.message, "→ intentando football-data.org");
    try {
      const matches = await fetchFD();
      ({ grupos, synced } = parseFD(matches, lookup));
      source = "football-data.org";
    } catch (e2) {
      return res.status(502).json({ error: "Ambas fuentes fallaron", details: e2.message });
    }
  }

  if (synced === 0) {
    return res.status(200).json({ message: "Sin resultados finalizados todavía", synced: 0, source });
  }

  // Leer y mergear con lo existente
  const KEY = "scalonetta:results";
  const { data: existing } = await supabase.from("kv").select("value").eq("key", KEY).single();
  const current = existing?.value || { grupos: {}, ko: {}, champion: null, bonus: {} };

  const merged = {
    ...current,
    grupos: { ...current.grupos, ...grupos },
  };

  const { error } = await supabase.from("kv").upsert({ key: KEY, value: merged });
  if (error) return res.status(500).json({ error: "DB write failed", details: error.message });

  console.log(`Sync OK: ${synced} resultados (fuente: ${source})`);
  return res.status(200).json({ synced, source, grupos });
}
