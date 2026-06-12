// api/sync.js — La Scalonetta · Sync de resultados
// Fuente: worldcup26.ir (gratis, sin key) con fallback a football-data.org
// Ejecutado cada hora por GitHub Actions

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SYNC_SECRET   = process.env.SYNC_SECRET;
const FD_TOKEN      = process.env.FOOTBALL_DATA_TOKEN; // opcional, free en football-data.org

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- MAPA: inglés → español (nombres usados en la app) ----------
const NAME_MAP = {
  // Grupo A
  "Mexico": "México", "South Africa": "Sudáfrica",
  "South Korea": "Corea del Sur", "Czech Republic": "Rep. Checa",
  // Grupo B
  "Canada": "Canadá", "Switzerland": "Suiza",
  "Qatar": "Catar", "Bosnia & Herzegovina": "Bosnia y H.", "Bosnia and Herzegovina": "Bosnia y H.",
  // Grupo C
  "Brazil": "Brasil", "Morocco": "Marruecos", "Scotland": "Escocia", "Haiti": "Haití",
  // Grupo D
  "USA": "Estados Unidos", "United States": "Estados Unidos",
  "Australia": "Australia", "Paraguay": "Paraguay",
  "Turkey": "Türkiye", "Türkiye": "Türkiye",
  // Grupo E
  "Germany": "Alemania", "Ecuador": "Ecuador",
  "Ivory Coast": "Costa de Marfil", "Côte d'Ivoire": "Costa de Marfil",
  "Curaçao": "Curazao", "Curacao": "Curazao",
  // Grupo F
  "Netherlands": "Países Bajos", "Japan": "Japón",
  "Tunisia": "Túnez", "Sweden": "Suecia",
  // Grupo G
  "Belgium": "Bélgica", "Egypt": "Egipto",
  "Iran": "Irán", "New Zealand": "Nueva Zelanda",
  // Grupo H
  "Spain": "España", "Uruguay": "Uruguay",
  "Saudi Arabia": "Arabia Saudí", "Cape Verde": "Cabo Verde",
  // Grupo I
  "France": "Francia", "Senegal": "Senegal",
  "Norway": "Noruega", "Iraq": "Irak",
  // Grupo J
  "Argentina": "Argentina", "Austria": "Austria",
  "Algeria": "Argelia", "Jordan": "Jordania",
  // Grupo K
  "Portugal": "Portugal", "Colombia": "Colombia",
  "Uzbekistan": "Uzbekistán", "DR Congo": "R.D. Congo",
  "Congo DR": "R.D. Congo", "Democratic Republic of Congo": "R.D. Congo",
  // Grupo L
  "England": "Inglaterra", "Croatia": "Croacia",
  "Panama": "Panamá", "Ghana": "Ghana",
};

const normalize = (name) => NAME_MAP[name] || name;

// Fixture de la app: lista de partidos con su ID interno
// Necesario para mapear "Mexico vs South Africa" → ID "A-0"
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

// Construir lookup: "home|away" → matchId (en ambas direcciones)
function buildMatchLookup() {
  const map = {};
  for (const [id, home, away] of FIXTURE_INDEX) {
    map[`${home}|${away}`] = id;
    map[`${away}|${home}`] = id; // para cuando la API invierta home/away
  }
  return map;
}

// Interpretar score → L/E/V desde perspectiva del home del fixture
function toCode(homeGoals, awayGoals, fixtureHome, apiHome) {
  // Si la API tiene los equipos invertidos respecto al fixture, invertimos el resultado
  const inverted = (fixtureHome !== apiHome);
  const h = inverted ? awayGoals : homeGoals;
  const a = inverted ? homeGoals : awayGoals;
  if (h > a) return "L";
  if (h < a) return "V";
  return "E";
}

// ---------- FUENTE 1: worldcup26.ir ----------
async function fetchFromWC26() {
  const res = await fetch("https://worldcup26.ir/get/games", {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`worldcup26.ir status ${res.status}`);
  const data = await res.json();
  // Estructura esperada: array de partidos con home_team, away_team, home_score, away_score, status
  const games = Array.isArray(data) ? data : (data.games || data.matches || data.data || []);
  return games;
}

// ---------- FUENTE 2: football-data.org (requiere token gratuito) ----------
async function fetchFromFD() {
  if (!FD_TOKEN) throw new Error("No FOOTBALL_DATA_TOKEN configured");
  const res = await fetch(
    "https://api.football-data.org/v4/competitions/WC/matches?season=2026",
    {
      headers: { "X-Auth-Token": FD_TOKEN },
      signal: AbortSignal.timeout(8000),
    }
  );
  if (!res.ok) throw new Error(`football-data.org status ${res.status}`);
  const data = await res.json();
  return (data.matches || []);
}

// Parsear respuesta de worldcup26.ir
function parseWC26(games, lookup) {
  const grupos = {};
  let synced = 0;
  for (const g of games) {
    // Campos posibles según la doc: home_team, away_team, home_score, away_score, status, result
    const home = normalize(g.home_team || g.team1 || g.homeTeam || "");
    const away = normalize(g.away_team || g.team2 || g.awayTeam || "");
    const status = (g.status || g.state || "").toUpperCase();
    const finished = status === "FINISHED" || status === "FT" || status === "COMPLETED" || status === "PLAYED";
    if (!finished) continue;
    const hs = g.home_score ?? g.score1 ?? g.homeScore ?? null;
    const as_ = g.away_score ?? g.score2 ?? g.awayScore ?? null;
    if (hs === null || as_ === null) continue;
    const id = lookup[`${home}|${away}`];
    if (!id) { console.warn("Sin match para:", home, "vs", away); continue; }
    const fixtureHome = FIXTURE_INDEX.find(f => f[0] === id)?.[1];
    grupos[id] = toCode(Number(hs), Number(as_), fixtureHome, home);
    synced++;
  }
  return { grupos, synced };
}

// Parsear respuesta de football-data.org
function parseFD(matches, lookup) {
  const grupos = {};
  let synced = 0;
  for (const m of matches) {
    if (m.status !== "FINISHED") continue;
    const home = normalize(m.homeTeam?.name || m.homeTeam?.shortName || "");
    const away = normalize(m.awayTeam?.name || m.awayTeam?.shortName || "");
    const hs = m.score?.fullTime?.home ?? null;
    const as_ = m.score?.fullTime?.away ?? null;
    if (hs === null || as_ === null) continue;
    const id = lookup[`${home}|${away}`];
    if (!id) { console.warn("Sin match FD para:", home, "vs", away); continue; }
    const fixtureHome = FIXTURE_INDEX.find(f => f[0] === id)?.[1];
    grupos[id] = toCode(Number(hs), Number(as_), fixtureHome, home);
    synced++;
  }
  return { grupos, synced };
}

// ---------- HANDLER ----------
export default async function handler(req, res) {
  // Verificar secret
  if (req.headers["x-sync-secret"] !== SYNC_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const lookup = buildMatchLookup();
  let grupos = {};
  let synced = 0;
  let source = "none";

  // Intentar fuente 1
  try {
    const games = await fetchFromWC26();
    console.log(`worldcup26.ir: ${games.length} partidos recibidos`);
    ({ grupos, synced } = parseWC26(games, lookup));
    source = "worldcup26.ir";
  } catch (e1) {
    console.warn("worldcup26.ir falló:", e1.message, "— intentando football-data.org");
    try {
      const matches = await fetchFromFD();
      console.log(`football-data.org: ${matches.length} partidos recibidos`);
      ({ grupos, synced } = parseFD(matches, lookup));
      source = "football-data.org";
    } catch (e2) {
      console.error("Ambas fuentes fallaron:", e2.message);
      return res.status(502).json({ error: "Ambas fuentes fallaron", details: e2.message });
    }
  }

  if (synced === 0) {
    return res.status(200).json({ message: "Sin resultados finalizados todavía", synced: 0, source });
  }

  // Leer resultados actuales y mergear (no pisar lo que ya estaba)
  const KEY = "scalonetta:results";
  const { data: existing } = await supabase.from("kv").select("value").eq("key", KEY).single();
  const current = existing?.value || { grupos: {}, ko: {}, champion: null, bonus: {} };

  // Solo actualizar los que encontramos (no borrar KO ni campeón)
  const merged = {
    ...current,
    grupos: { ...current.grupos, ...grupos },
  };

  const { error } = await supabase.from("kv").upsert({ key: KEY, value: merged });
  if (error) {
    console.error("Supabase error:", error);
    return res.status(500).json({ error: "DB write failed", details: error.message });
  }

  console.log(`Sync OK: ${synced} resultados escritos (fuente: ${source})`);
  return res.status(200).json({ synced, source, grupos });
}
