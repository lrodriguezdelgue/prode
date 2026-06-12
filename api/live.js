// api/live.js — La Scalonetta · Partidos EN VIVO
// Proxy a worldcup26.ir para evitar CORS desde el browser.
// El frontend lo llama cada 60s. Cache de 30s en el edge de Vercel.

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
const es = (n) => NAME_MAP[n?.trim()] || n?.trim() || "?";

export default async function handler(req, res) {
  try {
    const r = await fetch("https://worldcup26.ir/get/games", {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`upstream HTTP ${r.status}`);
    const data = await r.json();
    const games = Array.isArray(data) ? data : (data.games || data.matches || data.data || []);

    const live = games
      .filter(g => String(g.time_elapsed).toLowerCase() === "live")
      .map(g => ({
        home: es(g.home_team_name_en || g.home_team),
        away: es(g.away_team_name_en || g.away_team),
        hs: Number(g.home_score) || 0,
        as: Number(g.away_score) || 0,
        group: g.group || "",
      }));

    // Cache 30s en el edge de Vercel → aunque 50 usuarios pollen,
    // worldcup26.ir recibe como mucho 2 requests por minuto.
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ live, ts: Date.now() });
  } catch (e) {
    res.setHeader("Cache-Control", "s-maxage=30");
    return res.status(200).json({ live: [], error: e.message, ts: Date.now() });
  }
}
