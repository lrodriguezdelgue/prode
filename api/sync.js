// api/sync.js
// Vercel serverless function: trae resultados de openfootball y los escribe en Supabase.
// Se llama desde GitHub Actions cada hora.

// Mapa de nombres en inglés (openfootball) → español (nuestra app)
const NAME_MAP = {
  'Mexico':'México','South Africa':'Sudáfrica','South Korea':'Corea del Sur',
  'Korea Republic':'Corea del Sur','Czech Republic':'Rep. Checa','Czechia':'Rep. Checa',
  'Canada':'Canadá','Switzerland':'Suiza','Qatar':'Catar',
  'Bosnia and Herzegovina':'Bosnia y H.','Bosnia':'Bosnia y H.',
  'Brazil':'Brasil','Morocco':'Marruecos','Scotland':'Escocia','Haiti':'Haití',
  'United States':'Estados Unidos','USA':'Estados Unidos',
  'Australia':'Australia','Paraguay':'Paraguay','Turkey':'Türkiye','Türkiye':'Türkiye',
  'Germany':'Alemania','Ecuador':'Ecuador',
  "Côte d'Ivoire":'Costa de Marfil','Ivory Coast':'Costa de Marfil',
  'Curaçao':'Curazao','Curacao':'Curazao',
  'Netherlands':'Países Bajos','Holland':'Países Bajos',
  'Japan':'Japón','Tunisia':'Túnez','Sweden':'Suecia',
  'Belgium':'Bélgica','Iran':'Irán','Egypt':'Egipto','New Zealand':'Nueva Zelanda',
  'Spain':'España','Uruguay':'Uruguay','Saudi Arabia':'Arabia Saudí',
  'Cape Verde':'Cabo Verde',
  'France':'Francia','Senegal':'Senegal','Norway':'Noruega','Iraq':'Irak',
  'Argentina':'Argentina','Austria':'Austria','Algeria':'Argelia','Jordan':'Jordania',
  'Portugal':'Portugal','Colombia':'Colombia','Uzbekistan':'Uzbekistán',
  'DR Congo':'R.D. Congo','Congo DR':'R.D. Congo','Democratic Republic of Congo':'R.D. Congo',
  'England':'Inglaterra','Croatia':'Croacia','Panama':'Panamá','Ghana':'Ghana',
};
const t = (name) => NAME_MAP[name] || name;

// FIXTURE replicado para lookup (home, away en español → matchId)
// matchId = "${grupo}-${índice_global_en_FIXTURE}"
const FIXTURE_LIST = [
  // A
  ['México','Sudáfrica'],['Corea del Sur','Rep. Checa'],['Rep. Checa','Sudáfrica'],
  ['México','Corea del Sur'],['México','Rep. Checa'],['Sudáfrica','Corea del Sur'],
  // B
  ['Canadá','Bosnia y H.'],['Catar','Suiza'],['Suiza','Bosnia y H.'],
  ['Canadá','Catar'],['Suiza','Canadá'],['Bosnia y H.','Catar'],
  // C
  ['Brasil','Marruecos'],['Haití','Escocia'],['Brasil','Haití'],
  ['Escocia','Marruecos'],['Escocia','Brasil'],['Marruecos','Haití'],
  // D
  ['Estados Unidos','Paraguay'],['Australia','Türkiye'],['Türkiye','Paraguay'],
  ['Estados Unidos','Australia'],['Türkiye','Estados Unidos'],['Paraguay','Australia'],
  // E
  ['Alemania','Curazao'],['Costa de Marfil','Ecuador'],['Alemania','Costa de Marfil'],
  ['Ecuador','Curazao'],['Ecuador','Alemania'],['Curazao','Costa de Marfil'],
  // F
  ['Países Bajos','Japón'],['Suecia','Túnez'],['Países Bajos','Suecia'],
  ['Túnez','Japón'],['Túnez','Países Bajos'],['Japón','Suecia'],
  // G
  ['Bélgica','Egipto'],['Irán','Nueva Zelanda'],['Bélgica','Irán'],
  ['Nueva Zelanda','Egipto'],['Nueva Zelanda','Bélgica'],['Egipto','Irán'],
  // H
  ['España','Cabo Verde'],['Arabia Saudí','Uruguay'],['España','Arabia Saudí'],
  ['Uruguay','Cabo Verde'],['Uruguay','España'],['Cabo Verde','Arabia Saudí'],
  // I
  ['Francia','Senegal'],['Irak','Noruega'],['Francia','Irak'],
  ['Noruega','Senegal'],['Noruega','Francia'],['Senegal','Irak'],
  // J
  ['Argentina','Argelia'],['Austria','Jordania'],['Argentina','Austria'],
  ['Jordania','Argelia'],['Jordania','Argentina'],['Argelia','Austria'],
  // K
  ['Portugal','R.D. Congo'],['Uzbekistán','Colombia'],['Portugal','Uzbekistán'],
  ['Colombia','R.D. Congo'],['Colombia','Portugal'],['R.D. Congo','Uzbekistán'],
  // L
  ['Inglaterra','Croacia'],['Ghana','Panamá'],['Inglaterra','Ghana'],
  ['Panamá','Croacia'],['Panamá','Inglaterra'],['Croacia','Ghana'],
];
const GROUPS = 'AAAAAA BBBBBB CCCCCC DDDDDD EEEEEE FFFFFF GGGGGG HHHHHH IIIIII JJJJJJ KKKKKK LLLLLL'.replace(/ /g,'');
// lookup: "Equipo1|Equipo2" (sorted) → { matchId, fixtureHome, fixtureAway }
const FIXTURE_LOOKUP = {};
FIXTURE_LIST.forEach(([home,away],i)=>{
  const key=[home,away].sort().join('|');
  FIXTURE_LOOKUP[key]={matchId:`${GROUPS[i]}-${i}`,fixtureHome:home,fixtureAway:away};
});

function findGroupMatch(team1es, team2es){
  const key=[team1es,team2es].sort().join('|');
  return FIXTURE_LOOKUP[key]||null;
}

function groupResult(score, team1es, team2es, fixtureHome){
  // score.ft = [team1Goals, team2Goals]
  const [g1,g2]=score.ft||score;
  const homeGoals = fixtureHome===team1es?g1:g2;
  const awayGoals = fixtureHome===team1es?g2:g1;
  return homeGoals>awayGoals?'L':homeGoals<awayGoals?'V':'E';
}

function koWinner(score, team1es, team2es){
  const [g1,g2]=score.ft||score;
  if(g1!==g2) return g1>g2?team1es:team2es;
  // AET o penales
  if(score.aet){const[a1,a2]=score.aet;if(a1!==a2)return a1>a2?team1es:team2es;}
  if(score.pen){const[p1,p2]=score.pen;if(p1!==p2)return p1>p2?team1es:team2es;}
  return null;
}

async function supabaseGet(baseUrl, anonKey, kvKey){
  const url=`${baseUrl}/rest/v1/kv?key=eq.${encodeURIComponent(kvKey)}&select=value`;
  const r=await fetch(url,{headers:{apikey:anonKey,Authorization:`Bearer ${anonKey}`}});
  const rows=await r.json();
  return rows?.[0]?.value||null;
}

async function supabaseUpsert(baseUrl, anonKey, kvKey, value){
  const url=`${baseUrl}/rest/v1/kv`;
  await fetch(url,{
    method:'POST',
    headers:{apikey:anonKey,Authorization:`Bearer ${anonKey}`,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},
    body:JSON.stringify({key:kvKey,value,updated_at:new Date().toISOString()}),
  });
}

export default async function handler(req, res){
  // Protección: verificar el secreto
  const secret=req.headers['x-sync-secret']||req.query.secret;
  if(!process.env.SYNC_SECRET||secret!==process.env.SYNC_SECRET){
    return res.status(401).json({error:'Unauthorized'});
  }

  const SUPABASE_URL=process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY=process.env.VITE_SUPABASE_ANON_KEY;
  if(!SUPABASE_URL||!SUPABASE_KEY){
    return res.status(500).json({error:'Missing Supabase env vars'});
  }

  try{
    // 1) Traer datos de openfootball
    const r=await fetch('https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json');
    const data=await r.json();
    const matches=(data.matches||[]).filter(m=>m.score);

    if(!matches.length){
      return res.status(200).json({message:'No results yet',synced:0});
    }

    // 2) Leer resultados actuales de Supabase
    let results=await supabaseGet(SUPABASE_URL,SUPABASE_KEY,'scalonetta:results');
    if(!results) results={grupos:{},ko:{},champion:null};
    if(!results.grupos) results.grupos={};
    if(!results.ko) results.ko={};

    // 3) Leer config para matchups de eliminación
    const config=await supabaseGet(SUPABASE_URL,SUPABASE_KEY,'scalonetta:config')||{};

    let synced=0;

    for(const m of matches){
      const t1es=t(m.team1);
      const t2es=t(m.team2);
      const score=m.score;
      const isGroup=!!m.group;

      if(isGroup){
        const found=findGroupMatch(t1es,t2es);
        if(!found) continue;
        const res=groupResult(score,t1es,t2es,found.fixtureHome);
        if(results.grupos[found.matchId]!==res){
          results.grupos[found.matchId]=res;
          synced++;
        }
      } else {
        // Eliminación: buscar en config.ko
        if(!config.ko) continue;
        const winner=koWinner(score,t1es,t2es);
        if(!winner) continue;
        for(const [phase,phaseData] of Object.entries(config.ko||{})){
          for(const mu of (phaseData.matchups||[])){
            if((mu.teamA===t1es&&mu.teamB===t2es)||(mu.teamA===t2es&&mu.teamB===t1es)){
              if(!results.ko[phase]) results.ko[phase]={};
              if(results.ko[phase][mu.id]!==winner){
                results.ko[phase][mu.id]=winner;
                synced++;
              }
            }
          }
        }
      }
    }

    // 4) Guardar solo si hubo cambios
    if(synced>0){
      await supabaseUpsert(SUPABASE_URL,SUPABASE_KEY,'scalonetta:results',results);
    }

    return res.status(200).json({
      message: synced>0?`Sincronizados ${synced} resultados`:'Sin cambios nuevos',
      synced,
      total_with_scores:matches.length
    });

  } catch(e){
    console.error('Sync error:',e);
    return res.status(500).json({error:e.message});
  }
}
