// api/sync.js — La Scalonetta · Sync de resultados + auto-resolución de bracket R32
// Fuente primaria: openfootball/worldcup.json (raw.githubusercontent.com)
// Fallback:        football-data.org (token gratuito opcional)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SYNC_SECRET  = process.env.SYNC_SECRET;
const FD_TOKEN     = process.env.FOOTBALL_DATA_TOKEN; // opcional

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

// ---------- GROUP MATCHES POR GRUPO (para calcular standings) ----------
const GROUP_MATCHES_IDX = {
  A: [["A-0","México","Sudáfrica"],["A-1","Corea del Sur","Rep. Checa"],["A-2","Rep. Checa","Sudáfrica"],["A-3","México","Corea del Sur"],["A-4","México","Rep. Checa"],["A-5","Sudáfrica","Corea del Sur"]],
  B: [["B-6","Canadá","Bosnia y H."],["B-7","Catar","Suiza"],["B-8","Suiza","Bosnia y H."],["B-9","Canadá","Catar"],["B-10","Suiza","Canadá"],["B-11","Bosnia y H.","Catar"]],
  C: [["C-12","Brasil","Marruecos"],["C-13","Haití","Escocia"],["C-14","Brasil","Haití"],["C-15","Escocia","Marruecos"],["C-16","Escocia","Brasil"],["C-17","Marruecos","Haití"]],
  D: [["D-18","Estados Unidos","Paraguay"],["D-19","Australia","Türkiye"],["D-20","Türkiye","Paraguay"],["D-21","Estados Unidos","Australia"],["D-22","Türkiye","Estados Unidos"],["D-23","Paraguay","Australia"]],
  E: [["E-24","Alemania","Curazao"],["E-25","Costa de Marfil","Ecuador"],["E-26","Alemania","Costa de Marfil"],["E-27","Ecuador","Curazao"],["E-28","Ecuador","Alemania"],["E-29","Curazao","Costa de Marfil"]],
  F: [["F-30","Países Bajos","Japón"],["F-31","Suecia","Túnez"],["F-32","Países Bajos","Suecia"],["F-33","Túnez","Japón"],["F-34","Túnez","Países Bajos"],["F-35","Japón","Suecia"]],
  G: [["G-36","Bélgica","Egipto"],["G-37","Irán","Nueva Zelanda"],["G-38","Bélgica","Irán"],["G-39","Nueva Zelanda","Egipto"],["G-40","Nueva Zelanda","Bélgica"],["G-41","Egipto","Irán"]],
  H: [["H-42","España","Cabo Verde"],["H-43","Arabia Saudí","Uruguay"],["H-44","España","Arabia Saudí"],["H-45","Uruguay","Cabo Verde"],["H-46","Uruguay","España"],["H-47","Cabo Verde","Arabia Saudí"]],
  I: [["I-48","Francia","Senegal"],["I-49","Irak","Noruega"],["I-50","Francia","Irak"],["I-51","Noruega","Senegal"],["I-52","Noruega","Francia"],["I-53","Senegal","Irak"]],
  J: [["J-54","Argentina","Argelia"],["J-55","Austria","Jordania"],["J-56","Argentina","Austria"],["J-57","Jordania","Argelia"],["J-58","Jordania","Argentina"],["J-59","Argelia","Austria"]],
  K: [["K-60","Portugal","R.D. Congo"],["K-61","Uzbekistán","Colombia"],["K-62","Portugal","Uzbekistán"],["K-63","Colombia","R.D. Congo"],["K-64","Colombia","Portugal"],["K-65","R.D. Congo","Uzbekistán"]],
  L: [["L-66","Inglaterra","Croacia"],["L-67","Ghana","Panamá"],["L-68","Inglaterra","Ghana"],["L-69","Panamá","Croacia"],["L-70","Panamá","Inglaterra"],["L-71","Croacia","Ghana"]],
};

// ---------- STANDINGS ----------
// Devuelve { A: [{name, pts, gp, w, d, l}, ...sorted], B: [...], ... }
// Criterio de desempate: pts → H2H → sin GD (no disponible de L/E/V)
function computeGroupStandings(grupos) {
  const result = {};
  for (const [gId, matches] of Object.entries(GROUP_MATCHES_IDX)) {
    const teams = {};
    for (const [, h, a] of matches) {
      if (!teams[h]) teams[h] = { pts: 0, gp: 0, w: 0, d: 0, l: 0 };
      if (!teams[a]) teams[a] = { pts: 0, gp: 0, w: 0, d: 0, l: 0 };
    }
    for (const [matchId, h, a] of matches) {
      const code = grupos[matchId];
      if (!code) continue;
      teams[h].gp++;
      teams[a].gp++;
      if (code === "L") {
        teams[h].pts += 3; teams[h].w++;
        teams[a].l++;
      } else if (code === "E") {
        teams[h].pts += 1; teams[h].d++;
        teams[a].pts += 1; teams[a].d++;
      } else {
        teams[a].pts += 3; teams[a].w++;
        teams[h].l++;
      }
    }
    // Sort: pts desc → H2H
    const sorted = Object.entries(teams).sort(([na, sa], [nb, sb]) => {
      if (sb.pts !== sa.pts) return sb.pts - sa.pts;
      for (const [matchId, h, a] of matches) {
        if ((h === na && a === nb) || (h === nb && a === na)) {
          const code = grupos[matchId];
          if (!code) continue;
          const naIsHome = h === na;
          if (code === "L") return naIsHome ? -1 : 1; // na ganó
          if (code === "V") return naIsHome ? 1 : -1;  // nb ganó
        }
      }
      return 0; // empate total — necesitaría GD
    });
    result[gId] = sorted.map(([name, s]) => ({ name, ...s }));
  }
  return result;
}

// ---------- R32 PUROS (sin 3ros) ----------
// Los 8 cruces que no involucran a un 3er puesto
// Match 73: 2A vs 2B · 75: 1F vs 2C · 76: 1C vs 2F · 78: 2E vs 2I
// Match 83: 2K vs 2L · 84: 1H vs 2J · 86: 1J vs 2H · 88: 2D vs 2G
function resolvePureR32Matchups(standings) {
  const complete = (g) => {
    const s = standings[g];
    return s && s.length === 4 && s.every(t => t.gp === 3);
  };
  const p1 = (g) => standings[g]?.[0]?.name; // 1° puesto
  const p2 = (g) => standings[g]?.[1]?.name; // 2° puesto

  const matchups = [];

  if (complete("A") && complete("B") && p2("A") && p2("B"))
    matchups.push({ id: "R32-73", teamA: p2("A"), teamB: p2("B") });

  if (complete("F") && complete("C") && p1("F") && p2("C"))
    matchups.push({ id: "R32-75", teamA: p1("F"), teamB: p2("C") });

  if (complete("C") && complete("F") && p1("C") && p2("F"))
    matchups.push({ id: "R32-76", teamA: p1("C"), teamB: p2("F") });

  if (complete("E") && complete("I") && p2("E") && p2("I"))
    matchups.push({ id: "R32-78", teamA: p2("E"), teamB: p2("I") });

  if (complete("K") && complete("L") && p2("K") && p2("L"))
    matchups.push({ id: "R32-83", teamA: p2("K"), teamB: p2("L") });

  if (complete("H") && complete("J") && p1("H") && p2("J"))
    matchups.push({ id: "R32-84", teamA: p1("H"), teamB: p2("J") });

  if (complete("J") && complete("H") && p1("J") && p2("H"))
    matchups.push({ id: "R32-86", teamA: p1("J"), teamB: p2("H") });

  if (complete("D") && complete("G") && p2("D") && p2("G"))
    matchups.push({ id: "R32-88", teamA: p2("D"), teamB: p2("G") });

  return matchups;
}

// ---------- FOOTBALL-DATA.ORG: fetch cruces de eliminación ----------
async function fetchFDKnockout() {
  if (!FD_TOKEN) return [];
  const res = await fetch(
    "https://api.football-data.org/v4/competitions/WC/matches?season=2026",
    { headers: { "X-Auth-Token": FD_TOKEN }, signal: AbortSignal.timeout(10000) }
  );
  if (!res.ok) return [];
  const data = await res.json();
  // Solo matches de eliminación con equipos ya definidos
  return (data.matches || []).filter(m =>
    m.stage !== "GROUP_STAGE" &&
    m.homeTeam?.name && m.awayTeam?.name
  );
}

// Parsea los cruces de eliminación de FD para detectar los 8 con 3ros puestos.
// Los cruces puros (1° vs 2°) ya se resuelven desde standings.
// Los cruces con 3ros (1° vs 3°) se detectan aquí: uno de los equipos salió 3° en su grupo.
//
// Mapa: grupo del 1° puesto → match ID oficial
//   1A→R32-79, 1B→R32-85, 1D→R32-81, 1E→R32-74
//   1G→R32-82, 1I→R32-77, 1K→R32-87, 1L→R32-80
function parseFDKnockout3rdMatchups(fdKoMatches, standings) {
  const THIRD_SLOT_BY_WINNER_GROUP = {
    A: "R32-79", B: "R32-85", D: "R32-81", E: "R32-74",
    G: "R32-82", I: "R32-77", K: "R32-87", L: "R32-80",
  };

  // Posición de cada equipo (0=1°, 1=2°, 2=3°, 3=4°)
  const teamPos = {};
  for (const [gId, table] of Object.entries(standings)) {
    for (let i = 0; i < table.length; i++) {
      teamPos[table[i].name] = { group: gId, pos: i };
    }
  }

  const matchups = [];

  for (const m of fdKoMatches) {
    const home = normalize(m.homeTeam?.name || m.homeTeam?.shortName || "");
    const away = normalize(m.awayTeam?.name || m.awayTeam?.shortName || "");
    if (!home || !away) continue;
    const ph = teamPos[home];
    const pa = teamPos[away];
    if (!ph || !pa) continue;

    // Cruce 1° vs 3°
    if (ph.pos === 0 && pa.pos === 2) {
      const slotId = THIRD_SLOT_BY_WINNER_GROUP[ph.group];
      if (slotId) matchups.push({ id: slotId, teamA: home, teamB: away });
    } else if (pa.pos === 0 && ph.pos === 2) {
      const slotId = THIRD_SLOT_BY_WINNER_GROUP[pa.group];
      if (slotId) matchups.push({ id: slotId, teamA: away, teamB: home });
    }
  }
  return matchups;
}

// ---------- AUTO-RESOLVE BRACKET EN CONFIG ----------
async function resolveAndSaveR32Bracket(grupos) {
  const CONF_KEY = "scalonetta:config";

  const standings = computeGroupStandings(grupos);

  // 1. Cruces puros desde standings
  const pureMatchups = resolvePureR32Matchups(standings);

  // 2. Cruces con 3ros desde football-data.org
  let thirdMatchups = [];
  try {
    const fdKo = await fetchFDKnockout();
    if (fdKo.length > 0) {
      thirdMatchups = parseFDKnockout3rdMatchups(fdKo, standings);
    }
  } catch (e) {
    console.warn("FD knockout fetch error:", e.message);
  }

  const allResolved = [...pureMatchups, ...thirdMatchups];
  if (allResolved.length === 0) {
    console.log("R32: ningún cruce resuelto todavía.");
    return;
  }

  // 3. Cargar config actual
  const { data: confData } = await supabase.from("kv").select("value").eq("key", CONF_KEY).single();
  if (!confData?.value) {
    console.warn("R32: no se encontró config en Supabase.");
    return;
  }
  const config = confData.value;
  if (!config.ko?.R32) {
    console.warn("R32: config.ko.R32 no existe.");
    return;
  }

  // 4. Merge: solo agregar los que no existen aún (respeta ediciones manuales del admin)
  const existingIds = new Set((config.ko.R32.matchups || []).map(m => m.id));
  const newMatchups = allResolved.filter(m => !existingIds.has(m.id));

  if (newMatchups.length === 0) {
    console.log(`R32: nada nuevo (${config.ko.R32.matchups.length} cruces ya en config).`);
    return;
  }

  const merged = [...(config.ko.R32.matchups || []), ...newMatchups];
  merged.sort((a, b) => {
    const na = parseInt(a.id.replace("R32-", ""), 10);
    const nb = parseInt(b.id.replace("R32-", ""), 10);
    return na - nb;
  });

  config.ko.R32.matchups = merged;
  config.ko.R32.open = true; // auto-habilita picks de 16avos
  config.ko.R32.lock = "2026-06-28T15:45:00-03:00"; // 15 min antes del 1er partido (3PM ET = 4PM ARG)

  const { error } = await supabase.from("kv").upsert({ key: CONF_KEY, value: config });
  if (error) {
    console.error("R32 bracket save error:", error.message);
    return;
  }
  console.log(`R32 bracket: +${newMatchups.length} cruces nuevos (total: ${merged.length}/16). open=true.`);
}

// ---------- Lookup para sync de grupos ----------
function buildLookup() {
  const map = {};
  for (const [id, home, away] of FIXTURE_INDEX) {
    map[`${home}|${away}`] = { id, fixtureHome: home };
    map[`${away}|${home}`] = { id, fixtureHome: home };
  }
  return map;
}

function toCode(homeGoals, awayGoals, fixtureHome, apiHome) {
  const inverted = fixtureHome !== apiHome;
  const h = inverted ? awayGoals : homeGoals;
  const a = inverted ? homeGoals : awayGoals;
  if (h > a) return "L";
  if (h < a) return "V";
  return "E";
}

// ---------- FUENTE 1: openfootball (raw.githubusercontent.com) ----------
async function fetchOpenfootball() {
  const res = await fetch(
    "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json",
    { signal: AbortSignal.timeout(10000) }
  );
  if (!res.ok) throw new Error(`openfootball HTTP ${res.status}`);
  const data = await res.json();
  return data.matches || [];
}

function parseOpenfootball(matches, lookup) {
  const grupos = {};
  let synced = 0;
  const warnings = [];
  for (const m of matches) {
    const ft = m.score?.ft;
    if (!Array.isArray(ft) || ft.length < 2) continue;
    const hs = ft[0], as_ = ft[1];
    const home = normalize(m.team1);
    const away = normalize(m.team2);
    const match = lookup[`${home}|${away}`];
    if (!match) {
      warnings.push(`Sin match: "${m.team1}" vs "${m.team2}" → "${home}" vs "${away}"`);
      continue;
    }
    grupos[match.id] = toCode(hs, as_, match.fixtureHome, home);
    synced++;
  }
  if (warnings.length) console.warn("Openfootball warnings:", warnings);
  return { grupos, synced };
}

// ---------- FUENTE 2: football-data.org (fallback) ----------
async function fetchFD() {
  if (!FD_TOKEN) throw new Error("No FOOTBALL_DATA_TOKEN");
  const res = await fetch(
    "https://api.football-data.org/v4/competitions/WC/matches?season=2026",
    { headers: { "X-Auth-Token": FD_TOKEN }, signal: AbortSignal.timeout(10000) }
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
  const fromCron   = req.headers["x-sync-secret"] === SYNC_SECRET;
  const fromClient = req.query?.client === "1";
  if (!fromCron && !fromClient) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Cache breve para llamadas del front: si se llamó hace <90s, devolver datos actuales sin re-fetch
  if (fromClient) {
    const KEY = "scalonetta:results";
    const { data: existing } = await supabase.from("kv").select("value").eq("key", KEY).single();
    const current = existing?.value || { grupos: {}, ko: {}, champion: null, bonus: {} };
    const lastSync = current._lastSync || 0;
    if (Date.now() - lastSync < 90_000) {
      return res.status(200).json({ synced: 0, source: "cache", cached: true });
    }
  }

  const lookup = buildLookup();
  let grupos = {}, synced = 0, source = "none";

  try {
    const matches = await fetchOpenfootball();
    console.log(`openfootball: ${matches.length} partidos`);
    ({ grupos, synced } = parseOpenfootball(matches, lookup));
    source = "openfootball";
  } catch (e1) {
    console.warn("openfootball falló:", e1.message, "→ intentando football-data.org");
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

  // Leer, mergear y escribir resultados de grupos
  const KEY = "scalonetta:results";
  const { data: existing } = await supabase.from("kv").select("value").eq("key", KEY).single();
  const current = existing?.value || { grupos: {}, ko: {}, champion: null, bonus: {} };

  const merged = {
    ...current,
    grupos: { ...current.grupos, ...grupos },
    _lastSync: Date.now(),
  };

  const { error } = await supabase.from("kv").upsert({ key: KEY, value: merged });
  if (error) return res.status(500).json({ error: "DB write failed", details: error.message });

  console.log(`Sync OK: ${synced} resultados (fuente: ${source})`);

  // ── AUTO-RESOLUCIÓN DEL BRACKET R32 ──────────────────────────────────────
  // Se ejecuta ANTES de devolver la respuesta (fire-and-forget se mata en Vercel).
  try {
    await resolveAndSaveR32Bracket(merged.grupos);
  } catch (e) {
    console.error("resolveAndSaveR32Bracket error:", e.message);
    // No-fatal: el sync de resultados ya fue exitoso
  }

  return res.status(200).json({ synced, source, grupos });
}
