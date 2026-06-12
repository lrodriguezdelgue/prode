import React, { useState, useEffect, useMemo, useCallback } from "react";
import { sget, sset, sdel, slist } from "./db.js";

/* ============================================================
   LA SCALONETTA — Prode Mundial 2026
   - Almacenamiento en Supabase (base de datos real)
   - Login simple por usuario/contraseña (barrera social, no seguridad real)
   - Picks por fase con cierre automático por fecha
   - Grupos: gana/empata/pierde (2 pts) · Eliminación: quién pasa (3 pts) · Campeón (10 pts)
   - Todos ven los picks de todos en tiempo casi-real (refresco por polling)
============================================================ */

// ---------- DATOS REALES DEL SORTEO ----------
const GROUPS = [
  { id: "A", teams: [["México","🇲🇽"],["Sudáfrica","🇿🇦"],["Corea del Sur","🇰🇷"],["Rep. Checa","🇨🇿"]] },
  { id: "B", teams: [["Canadá","🇨🇦"],["Suiza","🇨🇭"],["Catar","🇶🇦"],["Bosnia y H.","🇧🇦"]] },
  { id: "C", teams: [["Brasil","🇧🇷"],["Marruecos","🇲🇦"],["Escocia","🏴"],["Haití","🇭🇹"]] },
  { id: "D", teams: [["Estados Unidos","🇺🇸"],["Australia","🇦🇺"],["Paraguay","🇵🇾"],["Türkiye","🇹🇷"]] },
  { id: "E", teams: [["Alemania","🇩🇪"],["Ecuador","🇪🇨"],["Costa de Marfil","🇨🇮"],["Curazao","🇨🇼"]] },
  { id: "F", teams: [["Países Bajos","🇳🇱"],["Japón","🇯🇵"],["Túnez","🇹🇳"],["Suecia","🇸🇪"]] },
  { id: "G", teams: [["Bélgica","🇧🇪"],["Irán","🇮🇷"],["Egipto","🇪🇬"],["Nueva Zelanda","🇳🇿"]] },
  { id: "H", teams: [["España","🇪🇸"],["Uruguay","🇺🇾"],["Arabia Saudí","🇸🇦"],["Cabo Verde","🇨🇻"]] },
  { id: "I", teams: [["Francia","🇫🇷"],["Senegal","🇸🇳"],["Noruega","🇳🇴"],["Irak","🇮🇶"]] },
  { id: "J", teams: [["Argentina","🇦🇷"],["Austria","🇦🇹"],["Argelia","🇩🇿"],["Jordania","🇯🇴"]] },
  { id: "K", teams: [["Portugal","🇵🇹"],["Colombia","🇨🇴"],["Uzbekistán","🇺🇿"],["R.D. Congo","🇨🇩"]] },
  { id: "L", teams: [["Inglaterra","🏴"],["Croacia","🇭🇷"],["Panamá","🇵🇦"],["Ghana","🇬🇭"]] },
];

const ALL_TEAMS = GROUPS.flatMap(g => g.teams.map(t => ({ name: t[0], flag: t[1], group: g.id })));
const flagOf = (name) => (ALL_TEAMS.find(t => t.name === name)?.flag || "🏳️");

// Fixture oficial con fecha/hora en horario ARGENTINA (-03:00).
// home/away por NOMBRE de equipo; cada uno con su kickoff ISO. Solo informativo (no controla locks).
// kickoff: ISO con offset -03:00.
const FIXTURE = [
  // GRUPO A
  ["A","México","Sudáfrica","2026-06-11T21:00:00+02:00"],
  ["A","Corea del Sur","Rep. Checa","2026-06-12T04:00:00+02:00"],
  ["A","Rep. Checa","Sudáfrica","2026-06-18T18:00:00+02:00"],
  ["A","México","Corea del Sur","2026-06-19T03:00:00+02:00"],
  ["A","México","Rep. Checa","2026-06-25T03:00:00+02:00"],
  ["A","Sudáfrica","Corea del Sur","2026-06-25T03:00:00+02:00"],
  // GRUPO B
  ["B","Canadá","Bosnia y H.","2026-06-12T21:00:00+02:00"],
  ["B","Catar","Suiza","2026-06-13T21:00:00+02:00"],
  ["B","Suiza","Bosnia y H.","2026-06-18T21:00:00+02:00"],
  ["B","Canadá","Catar","2026-06-19T00:00:00+02:00"],
  ["B","Suiza","Canadá","2026-06-24T21:00:00+02:00"],
  ["B","Bosnia y H.","Catar","2026-06-24T21:00:00+02:00"],
  // GRUPO C
  ["C","Brasil","Marruecos","2026-06-14T00:00:00+02:00"],
  ["C","Haití","Escocia","2026-06-14T03:00:00+02:00"],
  ["C","Brasil","Haití","2026-06-20T00:00:00+02:00"],
  ["C","Escocia","Marruecos","2026-06-20T03:00:00+02:00"],
  ["C","Escocia","Brasil","2026-06-25T00:00:00+02:00"],
  ["C","Marruecos","Haití","2026-06-25T00:00:00+02:00"],
  // GRUPO D
  ["D","Estados Unidos","Paraguay","2026-06-13T03:00:00+02:00"],
  ["D","Australia","Türkiye","2026-06-13T06:00:00+02:00"],
  ["D","Türkiye","Paraguay","2026-06-19T06:00:00+02:00"],
  ["D","Estados Unidos","Australia","2026-06-19T21:00:00+02:00"],
  ["D","Türkiye","Estados Unidos","2026-06-26T04:00:00+02:00"],
  ["D","Paraguay","Australia","2026-06-26T04:00:00+02:00"],
  // GRUPO E
  ["E","Alemania","Curazao","2026-06-14T19:00:00+02:00"],
  ["E","Costa de Marfil","Ecuador","2026-06-15T01:00:00+02:00"],
  ["E","Alemania","Costa de Marfil","2026-06-21T00:00:00+02:00"],
  ["E","Ecuador","Curazao","2026-06-21T02:00:00+02:00"],
  ["E","Ecuador","Alemania","2026-06-26T00:00:00+02:00"],
  ["E","Curazao","Costa de Marfil","2026-06-26T00:00:00+02:00"],
  // GRUPO F
  ["F","Países Bajos","Japón","2026-06-15T00:00:00+02:00"],
  ["F","Suecia","Túnez","2026-06-15T04:00:00+02:00"],
  ["F","Países Bajos","Suecia","2026-06-20T19:00:00+02:00"],
  ["F","Túnez","Japón","2026-06-20T06:00:00+02:00"],
  ["F","Túnez","Países Bajos","2026-06-26T01:00:00+02:00"],
  ["F","Japón","Suecia","2026-06-26T01:00:00+02:00"],
  // GRUPO G
  ["G","Bélgica","Egipto","2026-06-15T21:00:00+02:00"],
  ["G","Irán","Nueva Zelanda","2026-06-16T03:00:00+02:00"],
  ["G","Bélgica","Irán","2026-06-22T01:00:00+02:00"],
  ["G","Nueva Zelanda","Egipto","2026-06-22T03:00:00+02:00"],
  ["G","Nueva Zelanda","Bélgica","2026-06-27T00:00:00+02:00"],
  ["G","Egipto","Irán","2026-06-27T00:00:00+02:00"],
  // GRUPO H
  ["H","España","Cabo Verde","2026-06-15T18:00:00+02:00"],
  ["H","Arabia Saudí","Uruguay","2026-06-14T19:00:00+02:00"],
  ["H","España","Arabia Saudí","2026-06-21T18:00:00+02:00"],
  ["H","Uruguay","Cabo Verde","2026-06-21T20:00:00+02:00"],
  ["H","Uruguay","España","2026-06-27T02:00:00+02:00"],
  ["H","Cabo Verde","Arabia Saudí","2026-06-27T02:00:00+02:00"],
  // GRUPO I
  ["I","Francia","Senegal","2026-06-16T21:00:00+02:00"],
  ["I","Irak","Noruega","2026-06-17T00:00:00+02:00"],
  ["I","Francia","Irak","2026-06-22T23:00:00+02:00"],
  ["I","Noruega","Senegal","2026-06-23T02:00:00+02:00"],
  ["I","Noruega","Francia","2026-06-26T21:00:00+02:00"],
  ["I","Senegal","Irak","2026-06-26T21:00:00+02:00"],
  // GRUPO J — Argentina 🇦🇷
  ["J","Argentina","Argelia","2026-06-17T03:00:00+02:00"],
  ["J","Austria","Jordania","2026-06-17T06:00:00+02:00"],
  ["J","Argentina","Austria","2026-06-22T19:00:00+02:00"],
  ["J","Jordania","Argelia","2026-06-23T05:00:00+02:00"],
  ["J","Jordania","Argentina","2026-06-28T04:00:00+02:00"],
  ["J","Argelia","Austria","2026-06-28T04:00:00+02:00"],
  // GRUPO K
  ["K","Portugal","R.D. Congo","2026-06-17T19:00:00+02:00"],
  ["K","Uzbekistán","Colombia","2026-06-18T04:00:00+02:00"],
  ["K","Portugal","Uzbekistán","2026-06-23T19:00:00+02:00"],
  ["K","Colombia","R.D. Congo","2026-06-24T04:00:00+02:00"],
  ["K","Colombia","Portugal","2026-06-28T01:30:00+02:00"],
  ["K","R.D. Congo","Uzbekistán","2026-06-28T01:30:00+02:00"],
  // GRUPO L
  ["L","Inglaterra","Croacia","2026-06-17T16:00:00+02:00"],
  ["L","Ghana","Panamá","2026-06-17T19:00:00+02:00"],
  ["L","Inglaterra","Ghana","2026-06-23T16:00:00+02:00"],
  ["L","Panamá","Croacia","2026-06-23T19:00:00+02:00"],
  ["L","Panamá","Inglaterra","2026-06-27T18:00:00+02:00"],
  ["L","Croacia","Ghana","2026-06-27T18:00:00+02:00"],
];

const GROUP_MATCHES = FIXTURE.map(([group,home,away,kickoff],i) => ({
  id: `${group}-${i}`,
  group, kickoff,
  home, homeFlag: flagOf(home),
  away, awayFlag: flagOf(away),
}));

const KO_ORDER = ["R32","R16","QF","SF","TP","F"];
const KO_DEFAULT = {
  R32: { label:"16avos", lock:"2026-06-27T23:59:00-03:00", open:false, matchups:[] },
  R16: { label:"8vos",   lock:"2026-07-03T23:59:00-03:00", open:false, matchups:[] },
  QF:  { label:"Cuartos",lock:"2026-07-08T23:59:00-03:00", open:false, matchups:[] },
  SF:  { label:"Semis",  lock:"2026-07-13T23:59:00-03:00", open:false, matchups:[] },
  TP:  { label:"3er puesto", lock:"2026-07-17T23:59:00-03:00", open:false, matchups:[] },
  F:   { label:"Final",  lock:"2026-07-18T23:59:00-03:00", open:false, matchups:[] },
};
const DEFAULT_CONFIG = {
  adminUser: null,
  locks: { grupos: "2026-06-10T23:59:00-03:00" },
  ko: JSON.parse(JSON.stringify(KO_DEFAULT)),
};

const PTS = { grupo: 2, ko: 3, champ: 10 };

// ---------- PREGUNTAS BONUS / TRIVIA (cierran junto con grupos, NO suman al puntaje) ----------
// cat: "grupos" = se resuelve al terminar la fase de grupos · "mundial" = se resuelve al final del torneo
const BONUS_QUESTIONS = [
  // --- TRIVIA GRUPOS (se resuelven cuando termina la fase de grupos) ---
  { id:"arg_goles",   cat:"grupos", q:"¿Cuántos goles mete Argentina en fase de grupos?", opts:["0 a 3","4 a 6","7 o más"] },
  { id:"arg_1ro",     cat:"grupos", q:"¿Argentina sale 1ª en su grupo?", opts:["Sí","No"] },
  { id:"campeon_out", cat:"grupos", q:"¿Algún ex campeón del mundo queda eliminado en grupos?", opts:["Sí","No"] },
  { id:"grupo_muerte",cat:"grupos", q:"¿Cuál es el grupo de la muerte (más parejo)?", opts:["E","I","K","Otro"] },
  { id:"sorpresa",    cat:"grupos", q:"¿Hay una selección 'chica' que pasa de ronda como 1ª?", opts:["Sí","No"] },
  { id:"goles_fecha1",cat:"grupos", q:"¿Más de 40 goles en la 1ª fecha completa?", opts:["Sí","No"] },

  // --- TRIVIA MUNDIAL (se resuelven al final del torneo) ---
  { id:"arg_final",   cat:"mundial", q:"¿Argentina llega a la final?", opts:["Sí","No"] },
  { id:"final_pen",   cat:"mundial", q:"¿La final se define por penales?", opts:["Sí","No"] },
  { id:"goleador",    cat:"mundial", q:"¿De dónde sale el goleador del torneo?", opts:["Sudamérica","Europa","Otra confed."] },
  { id:"campeon_conf",cat:"mundial", q:"¿De qué confederación sale el campeón?", opts:["Sudamérica","Europa","Otra"] },
  { id:"messi_gol",   cat:"mundial", q:"¿Messi mete gol en el torneo?", opts:["Sí","No"] },
  { id:"local_semis", cat:"mundial", q:"¿Algún anfitrión (USA/MEX/CAN) llega a semis?", opts:["Sí","No"] },
];
const BONUS_GRUPOS  = BONUS_QUESTIONS.filter(q=>q.cat==="grupos");
const BONUS_MUNDIAL = BONUS_QUESTIONS.filter(q=>q.cat==="mundial");

// ---------- STORAGE HELPERS ----------
const K = {
  users: "scalonetta:users",
  config: "scalonetta:config",
  results: "scalonetta:results",
  picks: (u) => `scalonetta:picks:${u}`,
  picksPrefix: "scalonetta:picks:",
  snap: "scalonetta:ranksnap",
};

// ---------- ESTILO ----------
const C = {
  celeste:"#74ACDF", celesteDeep:"#2F6FB0", sol:"#F6B40E", solDeep:"#B97E06",
  ink:"#0C1E33", paper:"#F4F8FC", white:"#FFFFFF", line:"#D9E6F2",
  good:"#1B9E5A", bad:"#C0392B", mute:"#6B8299",
};
const Style = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Archivo:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; }
    .scl { font-family:'Archivo',sans-serif; color:${C.ink}; }
    .disp { font-family:'Bebas Neue',sans-serif; letter-spacing:.5px; }
    .sun { background:
      conic-gradient(from 0deg at 50% 50%, ${C.sol} 0 12deg, transparent 12deg 30deg) ;
      opacity:.18; }
    @keyframes pop { from{transform:scale(.96);opacity:0} to{transform:scale(1);opacity:1} }
    @keyframes slide { from{transform:translateY(8px);opacity:0} to{transform:translateY(0);opacity:1} }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
    .card { animation: slide .35s ease both; }
    .btnp { transition: transform .08s ease, filter .15s ease; }
    .btnp:active { transform: scale(.97); }
    .pickbtn { transition: all .12s ease; }
    input, select, button { font-family:'Archivo',sans-serif; }
    .scrollx::-webkit-scrollbar{height:8px}
    .scrollx::-webkit-scrollbar-thumb{background:${C.line};border-radius:8px}
  `}</style>
);

// ---------- COMPONENTES UI ----------
function Btn({ children, onClick, kind="primary", style={}, disabled }) {
  const base = { border:"none", borderRadius:12, padding:"12px 18px", fontWeight:800,
    fontSize:15, cursor: disabled?"not-allowed":"pointer", opacity:disabled?.5:1 };
  const kinds = {
    primary:{ background:`linear-gradient(135deg,${C.celeste},${C.celesteDeep})`, color:"#fff" },
    sol:{ background:`linear-gradient(135deg,${C.sol},${C.solDeep})`, color:"#3a2c00" },
    ghost:{ background:"#fff", color:C.celesteDeep, border:`2px solid ${C.line}` },
    danger:{ background:"#fff", color:C.bad, border:`2px solid ${C.bad}` },
  };
  return <button className="btnp" disabled={disabled} onClick={onClick} style={{...base,...kinds[kind],...style}}>{children}</button>;
}
function Pill({ children, bg=C.celeste, color="#fff" }) {
  return <span className="disp" style={{ background:bg, color, padding:"2px 10px", borderRadius:20, fontSize:14 }}>{children}</span>;
}

// ---------- AUTH ----------
function Auth({ onAuth, users }) {
  const [mode,setMode]=useState(Object.keys(users||{}).length?"login":"register");
  const [n,setN]=useState(""); const [p,setP]=useState(""); const [err,setErr]=useState("");
  const submit = async () => {
    setErr("");
    const display=n.trim();
    const user=display.toLowerCase();
    if(!user||!p) return setErr("Completá nombre y contraseña.");
    const cur = await sget(K.users,{}) || {};
    if(mode==="register"){
      if(cur[user]) return setErr("Ya hay alguien con ese nombre. Elegí otro.");
      const isFirst = Object.keys(cur).length===0;
      cur[user]={ pass:p, name:display, createdAt:Date.now() };
      await sset(K.users,cur);
      if(isFirst){ const cfg=await sget(K.config,DEFAULT_CONFIG)||DEFAULT_CONFIG; cfg.adminUser=user; await sset(K.config,cfg); }
      onAuth(user);
    } else {
      if(!cur[user]||cur[user].pass!==p) return setErr("Nombre o contraseña incorrectos.");
      onAuth(user);
    }
  };
  return (
    <div style={{ minHeight:"100vh", display:"grid", placeItems:"center", padding:20,
      background:`radial-gradient(1200px 500px at 50% -10%, ${C.celeste}, ${C.celesteDeep})` }}>
      <div className="card" style={{ width:"100%", maxWidth:420, background:"#fff", borderRadius:24, padding:28, boxShadow:"0 30px 60px rgba(12,30,51,.35)" }}>
        <div style={{ textAlign:"center", marginBottom:8 }}>
          <div className="disp" style={{ fontSize:46, lineHeight:.9, color:C.celesteDeep }}>LA SCALONETTA</div>
          <div style={{ color:C.mute, fontWeight:700, fontSize:13, letterSpacing:1 }}>PRODE · MUNDIAL 2026 🏆</div>
        </div>
        <div style={{ display:"flex", gap:8, margin:"18px 0" }}>
          <Btn kind={mode==="login"?"primary":"ghost"} style={{flex:1}} onClick={()=>setMode("login")}>Entrar</Btn>
          <Btn kind={mode==="register"?"primary":"ghost"} style={{flex:1}} onClick={()=>setMode("register")}>Crear cuenta</Btn>
        </div>
        <Input label={mode==="register"?"Tu nombre (así te van a ver todos)":"Tu nombre"} value={n} onChange={setN} placeholder="Ej: Juampi" name="scl-name" autoComplete="off"/>
        <Input label="Contraseña" type="password" value={p} onChange={setP} placeholder="no uses una real" name="scl-pass" autoComplete="new-password"/>
        {err && <div style={{ color:C.bad, fontWeight:700, fontSize:13, margin:"6px 0" }}>{err}</div>}
        <Btn kind="sol" style={{ width:"100%", marginTop:10 }} onClick={submit}>
          {mode==="register"?"Crear y entrar":"Entrar"}
        </Btn>
        {mode==="register" && Object.keys(users||{}).length===0 &&
          <div style={{ fontSize:12, color:C.mute, marginTop:12, textAlign:"center" }}>
            Sos el primero: vas a quedar como <b>admin</b> 👑
          </div>}
      </div>
    </div>
  );
}
function Input({ label, value, onChange, type="text", placeholder, name, autoComplete }) {
  return (
    <label style={{ display:"block", marginBottom:12 }}>
      <span style={{ fontSize:12, fontWeight:800, color:C.mute }}>{label}</span>
      <input type={type} value={value} placeholder={placeholder} name={name} autoComplete={autoComplete}
        data-1p-ignore="true" data-lpignore="true" data-form-type="other"
        onChange={e=>onChange(e.target.value)}
        style={{ width:"100%", marginTop:4, padding:"11px 12px", borderRadius:10, border:`2px solid ${C.line}`, fontSize:15, outline:"none" }}/>
    </label>
  );
}

// ---------- LOCK HELPERS ----------
const isPast = (iso) => { const t=Date.parse(iso); return !isNaN(t) && Date.now()>=t; };
const fmt = (iso) => { const d=new Date(iso); return isNaN(d)?"—":d.toLocaleString("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}); };
const fmtKick = (iso) => { const d=new Date(iso); if(isNaN(d)) return "—";
  const s=d.toLocaleString("es-AR",{weekday:"short",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"America/Argentina/Buenos_Aires"});
  return s.charAt(0).toUpperCase()+s.slice(1)+" hs (ARG)"; };

// ---------- SCORING ----------
function computeScores(users, allPicks, results) {
  const rows=[];
  for(const [uid,info] of Object.entries(users||{})){
    const pk = allPicks[uid] || {};
    let pts=0, hits=0;
    // grupos
    for(const m of GROUP_MATCHES){
      const r=results?.grupos?.[m.id]; const g=pk?.grupos?.[m.id];
      if(r && g && r===g){ pts+=PTS.grupo; hits++; }
    }
    // eliminación
    for(const ph of KO_ORDER){
      const rr=results?.ko?.[ph]||{}; const gg=pk?.ko?.[ph]||{};
      for(const mid of Object.keys(rr)){ if(gg[mid] && gg[mid]===rr[mid]){ pts+=PTS.ko; hits++; } }
    }
    // campeón
    const champHit = results?.champion && pk?.champion && results.champion===pk.champion;
    if(champHit) pts+=PTS.champ;
    // bonus: NO suma puntos (es solo para la joda). Contamos aciertos aparte para mostrar.
    let bonusHits=0;
    for(const q of BONUS_QUESTIONS){
      const r=results?.bonus?.[q.id]; const g=pk?.bonus?.[q.id];
      if(r && g && r===g){ bonusHits++; }
    }
    rows.push({ uid, name:info.name||uid, pts, hits, bonusHits, champHit, champ:pk?.champion });
  }
  rows.sort((a,b)=> b.pts-a.pts || b.hits-a.hits || a.name.localeCompare(b.name));
  return rows;
}

// ---------- TRIVIA (ranking aparte, NO afecta el puntaje general) ----------
// cat: "grupos" | "mundial". Devuelve filas ordenadas + flag de si ya hay resultados cargados.
function computeTrivia(users, allPicks, results, cat){
  const qs = BONUS_QUESTIONS.filter(q=>q.cat===cat);
  const resolved = qs.filter(q=>results?.bonus?.[q.id]);  // preguntas con respuesta oficial cargada
  const rows=[];
  for(const [uid,info] of Object.entries(users||{})){
    const pk=allPicks[uid]?.bonus||{};
    let hits=0, answered=0;
    for(const q of qs){
      if(pk[q.id]) answered++;
      const r=results?.bonus?.[q.id];
      if(r && pk[q.id] && pk[q.id]===r) hits++;
    }
    rows.push({ uid, name:info.name||uid, hits, answered });
  }
  rows.sort((a,b)=> b.hits-a.hits || b.answered-a.answered || a.name.localeCompare(b.name));
  return { rows, total:qs.length, resolved:resolved.length };
}

// ---------- RACHA 🔥 (aciertos consecutivos, cronológico) ----------
function computeStreak(pk, results){
  const seq=[];
  const resolved = GROUP_MATCHES.filter(m=>results?.grupos?.[m.id]).slice()
    .sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff));
  for(const m of resolved) seq.push({ pick: pk?.grupos?.[m.id], res: results.grupos[m.id] });
  for(const ph of KO_ORDER){
    const rr=results?.ko?.[ph]||{};
    for(const mid of Object.keys(rr)) seq.push({ pick: pk?.ko?.[ph]?.[mid], res: rr[mid] });
  }
  let streak=0;
  for(let i=seq.length-1;i>=0;i--){
    if(seq[i].pick && seq[i].pick===seq[i].res) streak++;
    else break;
  }
  return streak;
}

// ---------- BADGES (títulos de cargada) ----------
function computeBadges(users, allPicks, results){
  const resolved = GROUP_MATCHES.filter(m=>results?.grupos?.[m.id]);
  if(resolved.length<5) return {};
  const ids=Object.keys(users||{});
  // pick mayoritario por partido
  const majority={};
  for(const m of resolved){
    const cnt={L:0,E:0,V:0}; let tot=0;
    for(const uid of ids){ const p=allPicks[uid]?.grupos?.[m.id]; if(p){cnt[p]++;tot++;} }
    if(tot>=3) majority[m.id]=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];
  }
  const stats=[];
  for(const uid of ids){
    let hits=0, played=0, agree=0, agreeTot=0;
    for(const m of resolved){
      const p=allPicks[uid]?.grupos?.[m.id]; if(!p) continue;
      played++;
      if(p===results.grupos[m.id]) hits++;
      if(majority[m.id]!=null){ agreeTot++; if(p===majority[m.id]) agree++; }
    }
    if(played>=5) stats.push({uid,hits,played,agreeRate:agreeTot?agree/agreeTot:null});
  }
  if(stats.length<2) return {};
  const badges={}; const add=(uid,b)=>{ (badges[uid]=badges[uid]||[]).push(b); };
  const maxH=Math.max(...stats.map(s=>s.hits)), minH=Math.min(...stats.map(s=>s.hits));
  if(maxH>minH){
    stats.filter(s=>s.hits===maxH).forEach(s=>add(s.uid,"🎯 Oráculo"));
    stats.filter(s=>s.hits===minH).forEach(s=>add(s.uid,"🥶 Heladera"));
  }
  const wa = stats.filter(s=>s.agreeRate!=null);
  if(wa.length>=2){
    const maxA=Math.max(...wa.map(s=>s.agreeRate)), minA=Math.min(...wa.map(s=>s.agreeRate));
    if(maxA>minA){
      wa.filter(s=>s.agreeRate===maxA && maxA>=0.7).forEach(s=>add(s.uid,"🐑 Oveja"));
      wa.filter(s=>s.agreeRate===minA && minA<=0.45).forEach(s=>add(s.uid,"🃏 Kamikaze"));
    }
  }
  return badges;
}

// hash simple para detectar cambios de resultados (snapshot de ranking)
function hashStr(s){ let h=5381; for(let i=0;i<s.length;i++){ h=((h<<5)+h+s.charCodeAt(i))|0; } return String(h); }

// ============================================================
//  APP
// ============================================================
function AppInner(){
  const [ready,setReady]=useState(false);
  const [me,setMe]=useState(null);
  const [users,setUsers]=useState({});
  const [config,setConfig]=useState(DEFAULT_CONFIG);
  const [results,setResults]=useState({grupos:{},ko:{},champion:null});
  const [allPicks,setAllPicks]=useState({});
  const [snap,setSnap]=useState(null);
  const [tab,setTab]=useState("picks");
  const [toast,setToast]=useState("");
  const [lastUpdated,setLastUpdated]=useState(null);
  const [now,setNow]=useState(Date.now());
  const [liveGames,setLiveGames]=useState([]);
  const meRef = React.useRef(null);
  const myPicksRef = React.useRef(null);

  const refresh = useCallback(async ()=>{
    const u = await sget(K.users,{})||{};
    const cfgRaw = await sget(K.config,null);
    // merge defensivo: garantizar estructura completa aunque el storage tenga datos viejos/parciales
    const cfg = {
      adminUser: cfgRaw?.adminUser ?? null,
      locks: { ...DEFAULT_CONFIG.locks, ...(cfgRaw?.locks||{}) },
      ko: {},
    };
    for(const ph of KO_ORDER){
      cfg.ko[ph] = { ...KO_DEFAULT[ph], ...((cfgRaw?.ko||{})[ph]||{}) };
      if(!Array.isArray(cfg.ko[ph].matchups)) cfg.ko[ph].matchups = [];
    }
    const resRaw = await sget(K.results,null);
    const res = {
      grupos: resRaw?.grupos || {},
      ko: resRaw?.ko || {},
      champion: resRaw?.champion ?? null,
      bonus: resRaw?.bonus || {},
    };
    const picks={};
    try{
      const list = (await slist(K.picksPrefix));
      for(const key of (list||[])){
        const uid=key.replace(K.picksPrefix,"");
        const pk = await sget(key,{})||{};
        picks[uid] = { grupos: pk.grupos||{}, ko: pk.ko||{}, champion: pk.champion ?? null, bonus: pk.bonus||{} };
      }
    }catch{}
    // Proteger los picks propios recién guardados: si el storage trae menos data
    // que lo que tenemos en memoria local, no lo pisamos (evita perder picks por polling).
    const myId = meRef.current;
    if(myId && myPicksRef.current){
      const fromStore = picks[myId];
      const local = myPicksRef.current;
      const cnt = (o)=> (Object.keys(o?.grupos||{}).length + Object.keys(o?.ko||{}).reduce((a,ph)=>a+Object.keys(o.ko[ph]||{}).length,0) + (o?.champion?1:0) + Object.keys(o?.bonus||{}).length);
      if(!fromStore || cnt(local) > cnt(fromStore)){
        picks[myId] = local;
      }
    }
    // Snapshot de ranking: cuando cambian los resultados, el ranking anterior
    // queda guardado para mostrar movimiento ↑↓ en la tabla.
    try{
      const rows = computeScores(u, picks, res);
      const curRanks = {}; rows.forEach((r,i)=>{ curRanks[r.uid]=i+1; });
      const curHash = hashStr(JSON.stringify([res.grupos,res.ko,res.champion,res.bonus]));
      let sn = await sget(K.snap, null);
      if(!sn || sn.hash!==curHash){
        sn = { hash:curHash, ranks:curRanks, prevRanks: sn?.ranks || null };
        await sset(K.snap, sn);
      }
      setSnap(sn);
    }catch{}
    setUsers(u); setConfig(cfg); setResults(res); setAllPicks(picks);
    setLastUpdated(Date.now());
  },[]);

  useEffect(()=>{ (async()=>{ const saved=localStorage.getItem("scalonetta_user"); if(saved) setMe(saved); await refresh(); setReady(true); })(); },[refresh]);
  useEffect(()=>{
    const iv=setInterval(refresh, 25000);
    const tick=setInterval(()=>setNow(Date.now()), 30000);
    const onVis=()=>{ if(!document.hidden) refresh(); };
    document.addEventListener("visibilitychange",onVis);
    return ()=>{ clearInterval(iv); clearInterval(tick); document.removeEventListener("visibilitychange",onVis); };
  },[refresh]);

  // Partidos EN VIVO: polling al proxy propio cada 60s (cache 30s en Vercel)
  useEffect(()=>{
    let alive = true;
    const fetchLive = async ()=>{
      try{
        const r = await fetch("/api/live");
        const d = await r.json();
        if(alive) setLiveGames(d.live||[]);
      }catch{ if(alive) setLiveGames([]); }
    };
    fetchLive();
    const iv=setInterval(fetchLive, 60000);
    const onVis=()=>{ if(!document.hidden) fetchLive(); };
    document.addEventListener("visibilitychange",onVis);
    return ()=>{ alive=false; clearInterval(iv); document.removeEventListener("visibilitychange",onVis); };
  },[]);

  const flash=(m)=>{ setToast(m); setTimeout(()=>setToast(""),2600); };
  const isAdmin = me && config.adminUser===me;

  // guardar pick propio (robusto: confirma escritura y reintenta lectura)
  const myPicks = allPicks[me] || { grupos:{}, ko:{}, champion:null, bonus:{} };
  useEffect(()=>{ meRef.current=me; myPicksRef.current = myPicks; });
  const savePick = async (mutator) => {
    const cur = await sget(K.picks(me), {grupos:{},ko:{},champion:null,bonus:{}}) || {grupos:{},ko:{},champion:null,bonus:{}};
    if(!cur.grupos) cur.grupos={}; if(!cur.ko) cur.ko={}; if(!("champion" in cur)) cur.champion=null; if(!cur.bonus) cur.bonus={};
    mutator(cur);
    // optimista: mostramos ya
    setAllPicks(p=>({...p,[me]:cur}));
    const ok = await sset(K.picks(me), cur);
    if(!ok){ flash("⚠️ No se pudo guardar. Revisá tu conexión/cookies."); return false; }
    // verificación de lectura: confirmamos que quedó escrito
    const check = await sget(K.picks(me), null);
    if(!check){ flash("⚠️ Guardado no confirmado. Probá recargar."); return false; }
    flash("Guardado ✓");
    return true;
  };

  if(!ready) return <><Style/><div className="scl" style={{minHeight:"100vh",display:"grid",placeItems:"center",background:C.paper}}><div className="disp" style={{fontSize:30,color:C.celesteDeep}}>Cargando…</div></div></>;
  if(!me) return <><Style/><div className="scl"><Auth users={users} onAuth={async(u)=>{ localStorage.setItem("scalonetta_user",u); await refresh(); setMe(u); }}/></div></>;

  const gruposLocked = isPast(config.locks.grupos);

  return (
    <><Style/>
    <div className="scl" style={{ minHeight:"100vh", background:C.paper }}>
      {/* HEADER */}
      <div style={{ position:"relative", overflow:"hidden", background:`linear-gradient(135deg,${C.celeste},${C.celesteDeep})`, color:"#fff", padding:"18px 16px 16px" }}>
        <div style={{ position:"absolute", inset:0 }} className="sun"/>
        <div style={{ position:"relative", display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
          <div>
            <div className="disp" style={{ fontSize:34, lineHeight:.85 }}>LA SCALONETTA</div>
            <div style={{ fontSize:11, fontWeight:700, opacity:.9, letterSpacing:1 }}>PRODE · MUNDIAL 2026</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:13, fontWeight:800 }}>{users[me]?.name||me} {isAdmin?"👑":""}</div>
            <button onClick={()=>{ localStorage.removeItem("scalonetta_user"); setMe(null); }} style={{ background:"rgba(255,255,255,.2)", color:"#fff", border:"none", borderRadius:8, padding:"4px 10px", fontSize:12, fontWeight:700, cursor:"pointer", marginTop:4 }}>Salir</button>
          </div>
        </div>
      </div>

      {/* EN VIVO */}
      {liveGames.length>0 && (
        <div style={{ background:"#0C1E33", padding:"8px 12px", display:"flex", gap:10, overflowX:"auto", alignItems:"center" }} className="scrollx">
          <span style={{ display:"inline-flex", alignItems:"center", gap:5, flexShrink:0 }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:"#E53935", display:"inline-block", animation:"pulse 1.4s ease infinite" }}/>
            <span className="disp" style={{ color:"#fff", fontSize:15, letterSpacing:1 }}>EN VIVO</span>
          </span>
          {liveGames.map((g,i)=>(
            <span key={i} style={{ flexShrink:0, background:"rgba(255,255,255,.08)", borderRadius:20, padding:"4px 12px", color:"#fff", fontSize:13, fontWeight:700 }}>
              {flagOf(g.home)} {g.home} <b style={{color:C.sol}}>{g.hs}</b> – <b style={{color:C.sol}}>{g.as}</b> {g.away} {flagOf(g.away)}
            </span>
          ))}
        </div>
      )}

      {/* SYNC INDICATOR */}
      {lastUpdated && (
        <div style={{ background:C.celesteDeep, color:"rgba(255,255,255,.75)", fontSize:11, fontWeight:700, textAlign:"center", padding:"3px 0", letterSpacing:.3 }}>
          🔄 Actualizado {fmtAgo(lastUpdated, now)} · próxima sync en ~5 min
        </div>
      )}

      {/* TABS */}
      <div className="scrollx" style={{ display:"flex", gap:6, padding:"10px 12px", overflowX:"auto", position:"sticky", top:0, background:C.paper, zIndex:5, borderBottom:`1px solid ${C.line}` }}>
        {[["picks","Mis pronósticos"],["board","Tabla"],["all","Todos los picks"]].concat(isAdmin?[["admin","Admin 👑"]]:[]).map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} className="disp"
            style={{ whiteSpace:"nowrap", padding:"8px 14px", borderRadius:20, border:"none", cursor:"pointer", fontSize:16,
              background: tab===k?C.ink:"#fff", color: tab===k?"#fff":C.ink, boxShadow: tab===k?"none":`inset 0 0 0 2px ${C.line}` }}>{l}</button>
        ))}
      </div>

      <div style={{ maxWidth:760, margin:"0 auto", padding:"14px 12px 60px" }}>
        {tab==="picks" && <PicksTab {...{config,myPicks,savePick,gruposLocked,flash}}/>}
        {tab==="board" && <BoardTab {...{users,allPicks,results,me,config,snap}}/>}
        {tab==="all"   && <AllPicksTab {...{users,allPicks,results,config,me}}/>}
        {tab==="admin" && isAdmin && <AdminTab {...{config,setConfig,results,setResults,flash,refresh,users,allPicks,me}}/>}
      </div>

      {toast && <div className="disp" style={{ position:"fixed", bottom:18, left:"50%", transform:"translateX(-50%)", background:C.ink, color:"#fff", padding:"10px 18px", borderRadius:30, fontSize:16, boxShadow:"0 10px 30px rgba(0,0,0,.3)", zIndex:50 }}>{toast}</div>}
    </div>
    </>
  );
}

// ---------- TAB: MIS PRONÓSTICOS ----------
function PicksTab({ config, myPicks, savePick, gruposLocked, flash }){
  const [sub,setSub]=useState("grupos");
  return (
    <div className="card">
      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
        <SubTab id="grupos" cur={sub} set={setSub} label="Fase de grupos"/>
        <SubTab id="champ" cur={sub} set={setSub} label="Campeón 🏆"/>
        <SubTab id="bonus" cur={sub} set={setSub} label="Bonus ⭐"/>
        <SubTab id="ko" cur={sub} set={setSub} label="Eliminación"/>
      </div>

      {sub==="grupos" && (
        <>
          <LockBanner locked={gruposLocked} lockISO={config.locks.grupos} openText="Abierto · cierra"/>
          {GROUPS.map(g=>(
            <div key={g.id} style={{ background:"#fff", borderRadius:16, padding:"12px 12px 6px", marginBottom:12, boxShadow:`0 1px 0 ${C.line}` }}>
              <div className="disp" style={{ fontSize:20, color:C.celesteDeep, marginBottom:6 }}>Grupo {g.id}</div>
              {GROUP_MATCHES.filter(m=>m.group===g.id).map(m=>{
                const val=myPicks?.grupos?.[m.id];
                return (
                  <div key={m.id} style={{ padding:"8px 0", borderTop:`1px solid ${C.paper}` }}>
                    <div style={{ fontSize:13, fontWeight:700, marginBottom:2 }}>{m.homeFlag} {m.home} <span style={{color:C.mute}}>vs</span> {m.awayFlag} {m.away}</div>
                    <div style={{ fontSize:11, color:C.mute, marginBottom:6 }}>🗓️ {fmtKick(m.kickoff)}</div>
                    <div style={{ display:"flex", gap:6 }}>
                      {[["L",`Gana ${m.home}`],["E","Empate"],["V",`Gana ${m.away}`]].map(([code,lab])=>(
                        <button key={code} disabled={gruposLocked}
                          onClick={async()=>{ await savePick(p=>{p.grupos=p.grupos||{}; p.grupos[m.id]=code;}); }}
                          className="pickbtn"
                          style={{ flex:1, padding:"9px 4px", borderRadius:10, fontSize:12, fontWeight:800, cursor:gruposLocked?"not-allowed":"pointer",
                            border: val===code?`2px solid ${C.celesteDeep}`:`2px solid ${C.line}`,
                            background: val===code?C.celeste:"#fff", color: val===code?"#fff":C.ink, opacity:gruposLocked&&val!==code?.5:1 }}>
                          {lab}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </>
      )}

      {sub==="champ" && (
        <div style={{ background:"#fff", borderRadius:16, padding:16, boxShadow:`0 1px 0 ${C.line}` }}>
          <LockBanner locked={gruposLocked} lockISO={config.locks.grupos} openText="Elegí antes de que arranque · cierra"/>
          <div style={{ fontSize:14, color:C.mute, margin:"6px 0 10px" }}>Tu campeón vale <b style={{color:C.solDeep}}>{PTS.champ} puntos</b>. Se bloquea junto con la fase de grupos.</div>
          <select disabled={gruposLocked} value={myPicks?.champion||""}
            onChange={async(e)=>{ const val=e.target.value; if(!val) return; await savePick(p=>{p.champion=val;}); }}
            style={{ width:"100%", padding:"12px", borderRadius:10, border:`2px solid ${C.line}`, fontSize:16, fontWeight:700 }}>
            <option value="">— Elegí tu campeón —</option>
            {ALL_TEAMS.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(t=>(
              <option key={t.name} value={t.name}>{t.flag} {t.name}</option>
            ))}
          </select>
          {myPicks?.champion && <div className="disp" style={{ marginTop:14, fontSize:26, textAlign:"center", color:C.solDeep }}>{flagOf(myPicks.champion)} {myPicks.champion}</div>}
        </div>
      )}

      {sub==="bonus" && (
        <div style={{ background:"#fff", borderRadius:16, padding:16, boxShadow:`0 1px 0 ${C.line}` }}>
          <LockBanner locked={gruposLocked} lockISO={config.locks.grupos} openText="Elegí antes de que arranque · cierra"/>
          <div style={{ fontSize:14, color:C.mute, margin:"6px 0 14px" }}>Estas <b style={{color:C.solDeep}}>no suman al puntaje</b> — es una trivia aparte, para la joda. 😎 Hay <b>dos campeones honoríficos</b>: uno de Grupos 🏅 y uno del Mundial 🏆. Se cargan ahora y se bloquean con la fase de grupos.</div>
          {[["grupos","🏅 Trivia de Grupos","Se resuelven al terminar la fase de grupos."],["mundial","🏆 Trivia del Mundial","Se resuelven al final del torneo."]].map(([cat,titulo,desc])=>(
            <div key={cat} style={{ marginBottom:18 }}>
              <div className="disp" style={{ fontSize:20, color:C.celesteDeep, marginTop:6 }}>{titulo}</div>
              <div style={{ fontSize:12, color:C.mute, marginBottom:6 }}>{desc}</div>
              {BONUS_QUESTIONS.filter(q=>q.cat===cat).map(qn=>{
                const val=myPicks?.bonus?.[qn.id];
                return (
                  <div key={qn.id} style={{ padding:"10px 0", borderTop:`1px solid ${C.paper}` }}>
                    <div style={{ fontSize:14, fontWeight:700, marginBottom:8 }}>{qn.q}</div>
                    <div style={{ display:"flex", gap:6 }}>
                      {qn.opts.map(op=>(
                        <button key={op} disabled={gruposLocked}
                          onClick={async()=>{ await savePick(p=>{p.bonus=p.bonus||{}; p.bonus[qn.id]=op;}); }}
                          className="pickbtn"
                          style={{ flex:1, padding:"10px 4px", borderRadius:10, fontSize:13, fontWeight:800, cursor:gruposLocked?"not-allowed":"pointer",
                            border: val===op?`2px solid ${C.celesteDeep}`:`2px solid ${C.line}`,
                            background: val===op?C.celeste:"#fff", color: val===op?"#fff":C.ink, opacity:gruposLocked&&val!==op?.5:1 }}>
                          {op}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {sub==="ko" && <KoPicks {...{config,myPicks,savePick,flash}}/>}
    </div>
  );
}
function SubTab({id,cur,set,label}){
  return <button onClick={()=>set(id)} className="disp" style={{ padding:"7px 12px", borderRadius:14, border:"none", cursor:"pointer", fontSize:15,
    background:cur===id?C.celesteDeep:"#fff", color:cur===id?"#fff":C.ink, boxShadow:cur===id?"none":`inset 0 0 0 2px ${C.line}` }}>{label}</button>;
}
function LockBanner({ locked, lockISO, openText }){
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, background: locked?"#fdecea":"#eafaf1", borderRadius:10, padding:"8px 12px", marginBottom:12 }}>
      <span style={{ fontSize:18 }}>{locked?"🔒":"🟢"}</span>
      <span style={{ fontSize:13, fontWeight:700, color: locked?C.bad:C.good }}>
        {locked? "Cerrado — ya no se puede modificar." : `${openText} ${fmt(lockISO)}`}
      </span>
    </div>
  );
}
function KoPicks({ config, myPicks, savePick, flash }){
  const openPhases = KO_ORDER.filter(ph=>config.ko[ph]?.open && (config.ko[ph]?.matchups||[]).length);
  if(!openPhases.length) return <div style={{ background:"#fff", borderRadius:16, padding:20, textAlign:"center", color:C.mute, fontWeight:600 }}>
    Todavía no hay fases de eliminación abiertas. El admin las habilita cuando se conocen los cruces de cada ronda. ⚽</div>;
  return openPhases.map(ph=>{
    const f=config.ko[ph]; const locked=isPast(f.lock);
    return (
      <div key={ph} style={{ background:"#fff", borderRadius:16, padding:14, marginBottom:12, boxShadow:`0 1px 0 ${C.line}` }}>
        <div className="disp" style={{ fontSize:22, color:C.celesteDeep }}>{f.label} <Pill bg={C.sol} color="#3a2c00">{PTS.ko} pts c/u</Pill></div>
        <LockBanner locked={locked} lockISO={f.lock} openText="Abierto · cierra"/>
        {f.matchups.map(mu=>{
          const val=myPicks?.ko?.[ph]?.[mu.id];
          return (
            <div key={mu.id} style={{ padding:"8px 0", borderTop:`1px solid ${C.paper}` }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.mute, marginBottom:6 }}>¿Quién pasa?</div>
              <div style={{ display:"flex", gap:6 }}>
                {[mu.teamA,mu.teamB].map(tm=>(
                  <button key={tm} disabled={locked}
                    onClick={async()=>{ await savePick(p=>{p.ko=p.ko||{}; p.ko[ph]=p.ko[ph]||{}; p.ko[ph][mu.id]=tm;}); }}
                    className="pickbtn"
                    style={{ flex:1, padding:"11px 6px", borderRadius:10, fontSize:13, fontWeight:800, cursor:locked?"not-allowed":"pointer",
                      border: val===tm?`2px solid ${C.celesteDeep}`:`2px solid ${C.line}`,
                      background: val===tm?C.celeste:"#fff", color: val===tm?"#fff":C.ink, opacity:locked&&val!==tm?.5:1 }}>
                    {flagOf(tm)} {tm}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  });
}

// ---------- TAB: TABLA ----------
function BoardTab({ users, allPicks, results, me, snap }){
  const rows=useMemo(()=>computeScores(users,allPicks,results),[users,allPicks,results]);
  const badges=useMemo(()=>computeBadges(users,allPicks,results),[users,allPicks,results]);
  const medals=["🥇","🥈","🥉"];
  const prev = snap?.prevRanks || null;

  const shareWhatsApp = () => {
    const lines = rows.slice(0,10).map((r,i)=>`${medals[i]||(i+1)+"."} ${r.name} — ${r.pts} pts`);
    const txt = `🏆 LA SCALONETTA · Tabla\n\n${lines.join("\n")}\n\n¿Te la bancás? Entrá y jugá 👉 ${location.origin}`;
    if(navigator.share){ navigator.share({text:txt}).catch(()=>{}); }
    else { navigator.clipboard?.writeText(txt); alert("Tabla copiada \u2713 Pegala en el grupo de WhatsApp."); }
  };

  const Move = ({uid}) => {
    if(!prev || prev[uid]==null) return null;
    const now = rows.findIndex(r=>r.uid===uid)+1;
    const d = prev[uid]-now;
    if(d>0) return <span style={{color:C.good,fontSize:11,fontWeight:800}}>▲{d}</span>;
    if(d<0) return <span style={{color:C.bad,fontSize:11,fontWeight:800}}>▼{-d}</span>;
    return <span style={{color:C.mute,fontSize:11,fontWeight:800}}>=</span>;
  };

  return (
    <div className="card">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <div className="disp" style={{ fontSize:26, color:C.celesteDeep }}>Tabla general</div>
        {rows.length>0 && <Btn kind="sol" style={{padding:"8px 12px",fontSize:13}} onClick={shareWhatsApp}>📲 Compartir</Btn>}
      </div>
      {!rows.length && <div style={{color:C.mute}}>Todavía no hay jugadores.</div>}
      {rows.map((r,i)=>{
        const streak=computeStreak(allPicks[r.uid]||{}, results);
        const myBadges=badges[r.uid]||[];
        return (
        <div key={r.uid} style={{ display:"flex", alignItems:"center", gap:12, background: r.uid===me?C.celeste:"#fff", color:r.uid===me?"#fff":C.ink,
          borderRadius:14, padding:"12px 14px", marginBottom:8, boxShadow:`0 1px 0 ${C.line}` }}>
          <div style={{ width:34, textAlign:"center" }}>
            <div className="disp" style={{ fontSize:22, lineHeight:1 }}>{medals[i]||i+1}</div>
            <Move uid={r.uid}/>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:800 }}>{r.name} {r.champHit?"👑":""} {streak>=3?<span title={`Racha de ${streak}`}>{`🔥${streak}`}</span>:""}</div>
            <div style={{ fontSize:12, opacity:.8 }}>{r.hits} aciertos {r.bonusHits>0?`· ⭐${r.bonusHits} bonus`:""} {r.champ?`· campeón: ${flagOf(r.champ)} ${r.champ}`:""}</div>
            {myBadges.length>0 && <div style={{ fontSize:11, marginTop:3, display:"flex", gap:5, flexWrap:"wrap" }}>
              {myBadges.map(b=><span key={b} style={{ background:r.uid===me?"rgba(255,255,255,.22)":C.paper, padding:"1px 7px", borderRadius:20, fontWeight:700 }}>{b}</span>)}
            </div>}
          </div>
          <div className="disp" style={{ fontSize:30, color:r.uid===me?"#fff":C.solDeep }}>{r.pts}</div>
        </div>
        );
      })}
      <div style={{ fontSize:12, color:C.mute, marginTop:8 }}>Grupos: 2 pts · Eliminación: 3 pts · Campeón: 10 pts. Las preguntas bonus ⭐ no suman puntos (son para la joda). ▲▼ = cambio desde el último resultado · 🔥 = racha de aciertos. Se actualiza sola cada ~25 s.</div>

      <TriviaBoard {...{users,allPicks,results,me}}/>
    </div>
  );
}

// ---------- TRIVIA: rankings honoríficos (no afectan el puntaje) ----------
function TriviaBoard({ users, allPicks, results, me }){
  const cats=[
    { cat:"grupos",  titulo:"🏅 Trivia de Grupos",  champEmoji:"🏅" },
    { cat:"mundial", titulo:"🏆 Trivia del Mundial", champEmoji:"🏆" },
  ];
  return (
    <div style={{ marginTop:22 }}>
      <div className="disp" style={{ fontSize:24, color:C.solDeep, marginBottom:4 }}>Trivia 🎲</div>
      <div style={{ fontSize:12, color:C.mute, marginBottom:12 }}>Ranking aparte, solo por honor. No suma al prode. El que más acierta en cada tanda se lleva la mención de campeón. 👑</div>
      {cats.map(({cat,titulo,champEmoji})=>{
        const { rows, total, resolved } = computeTrivia(users,allPicks,results,cat);
        const decided = resolved>=total && total>0;
        const top = rows[0];
        const champs = decided && top ? rows.filter(r=>r.hits===top.hits && top.hits>0) : [];
        return (
          <div key={cat} style={{ background:"#fff", borderRadius:16, padding:14, marginBottom:12, boxShadow:`0 1px 0 ${C.line}` }}>
            <div className="disp" style={{ fontSize:19, color:C.celesteDeep }}>{titulo}</div>
            <div style={{ fontSize:11, color:C.mute, marginBottom:8 }}>{resolved}/{total} preguntas resueltas {decided?"· ¡definido!":"· en juego"}</div>
            {champs.length>0 && (
              <div style={{ background:`linear-gradient(135deg,${C.sol},${C.solDeep})`, color:"#3a2c00", borderRadius:12, padding:"10px 12px", marginBottom:10, fontWeight:800 }}>
                {champEmoji} Campeón de trivia: {champs.map(c=>c.name).join(" + ")} ({top.hits}/{total})
              </div>
            )}
            {rows.filter(r=>r.answered>0 || decided).slice(0,8).map((r,i)=>(
              <div key={r.uid} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 0", borderTop:i?`1px solid ${C.paper}`:"none" }}>
                <div className="disp" style={{ fontSize:16, width:22, textAlign:"center", color:C.mute }}>{i+1}</div>
                <div style={{ flex:1, fontWeight:r.uid===me?800:600, color:r.uid===me?C.celesteDeep:C.ink }}>{r.name}{r.uid===me?" (vos)":""}</div>
                <div style={{ fontSize:13, fontWeight:800, color:C.solDeep }}>{r.hits}<span style={{color:C.mute,fontWeight:600}}>/{total}</span></div>
              </div>
            ))}
            {rows.every(r=>r.answered===0) && !decided && <div style={{ fontSize:12, color:C.mute }}>Nadie contestó todavía.</div>}
          </div>
        );
      })}
    </div>
  );
}

// ---------- TAB: TODOS LOS PICKS ----------
function AllPicksTab({ users, allPicks, results, config, me }){
  const ids=Object.keys(users);
  const [view,setView]=useState("grupos");
  const gruposOpen = isPast(config.locks.grupos); // destapado al cerrar
  // ¿se puede ver el pick de 'uid' para esta fase? propio siempre; ajeno solo si la fase cerró
  const canSee = (uid, revealed) => uid===me || revealed;
  return (
    <div className="card">
      <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap" }}>
        <SubTab id="grupos" cur={view} set={setView} label="Grupos"/>
        <SubTab id="champ" cur={view} set={setView} label="Campeón"/>
        <SubTab id="bonus" cur={view} set={setView} label="Bonus"/>
        <SubTab id="ko" cur={view} set={setView} label="Eliminación"/>
      </div>
      {!ids.length && <div style={{color:C.mute}}>Sin jugadores aún.</div>}

      {view==="champ" && (
        <div style={{ background:"#fff", borderRadius:14, padding:14 }}>
          <div style={{ fontSize:12, color:C.mute, marginBottom:8 }}>El campeón es visible para todos desde que cada uno lo carga. 👀</div>
          {ids.map(uid=>(
            <div key={uid} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderTop:`1px solid ${C.paper}` }}>
              <b>{users[uid].name||uid}{uid===me?" (vos)":""}</b>
              <span>{allPicks[uid]?.champion? `${flagOf(allPicks[uid].champion)} ${allPicks[uid].champion}`:"—"}</span>
            </div>
          ))}
        </div>
      )}

      {view==="bonus" && (
        <>
          {!gruposOpen && <HiddenBanner lockISO={config.locks.grupos}/>}
          {[["grupos","🏅 Trivia de Grupos"],["mundial","🏆 Trivia del Mundial"]].map(([cat,titulo])=>(
            <div key={cat} style={{ marginBottom:6 }}>
              <div className="disp" style={{ fontSize:18, color:C.solDeep, marginTop:6, marginBottom:4 }}>{titulo}</div>
              {BONUS_QUESTIONS.filter(q=>q.cat===cat).map(qn=>{
                const res=results?.bonus?.[qn.id];
                return (
                  <div key={qn.id} className="scrollx" style={{ overflowX:"auto", marginBottom:12 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:C.celesteDeep, marginBottom:4 }}>{qn.q} {res && <Pill bg={C.good}>{res}</Pill>}</div>
                    <table style={{ borderCollapse:"collapse", width:"100%", fontSize:12, background:"#fff", borderRadius:10, overflow:"hidden" }}>
                      <thead><tr style={{ background:C.paper }}>{ids.map(uid=><th key={uid} style={cellH}>{(users[uid].name||uid).slice(0,6)}{uid===me?"*":""}</th>)}</tr></thead>
                      <tbody><tr>
                        {ids.map(uid=>{ const pk=allPicks[uid]?.bonus?.[qn.id]; const ok=res&&pk&&res===pk; const vis=canSee(uid,gruposOpen);
                          return <td key={uid} style={{...cell, background:vis&&ok?"#eafaf1":vis&&pk&&res?"#fdecea":"transparent", fontWeight:700, color:vis?C.ink:C.line}}>{!vis?"🔒":(pk||"·")}</td>; })}
                      </tr></tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          ))}
        </>
      )}

      {view==="grupos" && (
        <>
          {!gruposOpen && <HiddenBanner lockISO={config.locks.grupos}/>}
          {GROUPS.map(g=>(
            <div key={g.id} className="scrollx" style={{ overflowX:"auto", marginBottom:14 }}>
              <div className="disp" style={{ fontSize:18, color:C.celesteDeep, marginBottom:4 }}>Grupo {g.id}</div>
              <table style={tableSticky}>
                <thead><tr style={{ background:C.paper }}>
                  <th style={cellHSticky}>Partido</th><th style={cellH}>✔</th>{ids.map(uid=><th key={uid} style={cellH}>{(users[uid].name||uid).slice(0,6)}{uid===me?"*":""}</th>)}
                </tr></thead>
                <tbody>
                  {GROUP_MATCHES.filter(m=>m.group===g.id).map(m=>{
                    const res=results?.grupos?.[m.id];
                    // stats del grupo: cuántos votaron cada opción (solo si la fase cerró)
                    let statTxt="";
                    if(gruposOpen){
                      const c={L:0,E:0,V:0}; let tot=0;
                      for(const uid of ids){ const p=allPicks[uid]?.grupos?.[m.id]; if(p){c[p]++;tot++;} }
                      if(tot){ const pct=(n)=>Math.round(n/tot*100);
                        statTxt=`${m.home.slice(0,3)} ${pct(c.L)}% · X ${pct(c.E)}% · ${m.away.slice(0,3)} ${pct(c.V)}%`; }
                    }
                    return (
                      <tr key={m.id}>
                        <td style={cellSticky}>{m.homeFlag}{m.awayFlag} {m.home.slice(0,4)}/{m.away.slice(0,4)}{statTxt && <div style={{fontSize:9,color:C.mute,fontWeight:600}}>{statTxt}</div>}</td>
                        <td style={{...cell,fontWeight:800,color:C.celesteDeep}}>{res?codeLabelShort(res,m):"—"}</td>
                        {ids.map(uid=>{ const pk=allPicks[uid]?.grupos?.[m.id]; const ok=res&&pk&&res===pk; const vis=canSee(uid,gruposOpen);
                          return <td key={uid} style={{...cell, background: vis&&ok?"#eafaf1":vis&&pk&&res?"#fdecea":"transparent", fontWeight:700, color: vis?C.ink:C.line}}>{!vis?"🔒":(pk?codeLabelShort(pk,m):"·")}</td>; })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}

      {view==="ko" && KO_ORDER.filter(ph=>config.ko[ph]?.open).map(ph=>{
        const f=config.ko[ph]; const koOpen=isPast(f.lock);
        return (
          <div key={ph} className="scrollx" style={{ overflowX:"auto", marginBottom:14 }}>
            <div className="disp" style={{ fontSize:18, color:C.celesteDeep }}>{f.label}</div>
            {!koOpen && <HiddenBanner lockISO={f.lock}/>}
            <table style={tableSticky}>
              <thead><tr style={{ background:C.paper }}>
                <th style={cellHSticky}>Cruce</th><th style={cellH}>Pasó</th>{ids.map(uid=><th key={uid} style={cellH}>{(users[uid].name||uid).slice(0,6)}{uid===me?"*":""}</th>)}
              </tr></thead>
              <tbody>
                {(f.matchups||[]).map(mu=>{ const res=results?.ko?.[ph]?.[mu.id];
                  return (
                    <tr key={mu.id}>
                      <td style={cellSticky}>{flagOf(mu.teamA)}{mu.teamA.slice(0,4)} v {flagOf(mu.teamB)}{mu.teamB.slice(0,4)}</td>
                      <td style={{...cell,fontWeight:800,color:C.celesteDeep}}>{res?`${flagOf(res)}`:"—"}</td>
                      {ids.map(uid=>{ const pk=allPicks[uid]?.ko?.[ph]?.[mu.id]; const ok=res&&pk&&res===pk; const vis=canSee(uid,koOpen);
                        return <td key={uid} style={{...cell, background:vis&&ok?"#eafaf1":vis&&pk&&res?"#fdecea":"transparent"}}>{!vis?"🔒":(pk?flagOf(pk):"·")}</td>; })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
      <div style={{ fontSize:11, color:C.mute, marginTop:6 }}>🔒 = oculto hasta que cierre la fase. La columna con * es la tuya (siempre la ves).</div>
    </div>
  );
}
function HiddenBanner({ lockISO }){
  return <div style={{ display:"flex", alignItems:"center", gap:8, background:"#fff6e6", borderRadius:10, padding:"8px 12px", marginBottom:10 }}>
    <span style={{fontSize:18}}>🔒</span>
    <span style={{ fontSize:13, fontWeight:700, color:C.solDeep }}>Los pronósticos de los demás se destapan al cerrar la fase ({fmt(lockISO)}). Por ahora solo ves los tuyos.</span>
  </div>;
}
const cell={ padding:"6px 8px", borderTop:`1px solid ${C.paper}`, textAlign:"center", whiteSpace:"nowrap" };
const cellH={ padding:"6px 8px", textAlign:"center", fontSize:11, color:C.mute, whiteSpace:"nowrap" };
// Primera columna fija al hacer scroll horizontal (sticky).
// IMPORTANTE: requiere borderCollapse:"separate" en la <table> (con "collapse" el sticky se rompe).
const cellSticky={ ...cell, position:"sticky", left:0, background:"#fff", zIndex:2, textAlign:"left", minWidth:120, boxShadow:`2px 0 5px -2px rgba(12,30,51,.2)` };
const cellHSticky={ ...cellH, position:"sticky", left:0, background:C.paper, zIndex:3, textAlign:"left", minWidth:120, boxShadow:`2px 0 5px -2px rgba(12,30,51,.2)` };
const tableSticky={ borderCollapse:"separate", borderSpacing:0, width:"100%", fontSize:12, background:"#fff", borderRadius:10 };
function codeLabelShort(code,m){ return code==="L"?m.home.slice(0,3):code==="V"?m.away.slice(0,3):"X"; }

// ---------- TAB: ADMIN ----------
function AdminTab({ config, setConfig, results, setResults, flash, refresh, users, allPicks, me }){
  const [busy,setBusy]=useState(false);
  const saveConfig = async (cfg)=>{ setConfig({...cfg}); await sset(K.config,cfg); flash("Config guardada ✓"); };
  const saveResults = async (r)=>{ setResults({...r}); await sset(K.results,r); flash("Resultados guardados ✓"); };

  // borrar un usuario y sus picks
  const deleteUser = async (uid)=>{
    if(uid===me){ flash("No podés borrarte a vos mismo (sos admin)."); return; }
    if(!window.confirm(`¿Borrar a "${users[uid]?.name||uid}" y todos sus pronósticos? No se puede deshacer.`)) return;
    const u = await sget(K.users,{})||{}; delete u[uid]; await sset(K.users,u);
    try{ await sdel(K.picks(uid)); }catch{}
    flash("Usuario borrado ✓"); await refresh();
  };
  // reset total
  const resetAll = async ()=>{
    if(!window.confirm("⚠️ Esto BORRA TODO: usuarios, pronósticos, resultados y cruces. La app queda de cero. ¿Seguro?")) return;
    if(!window.confirm("Última confirmación: se pierde absolutamente todo y no se puede recuperar. ¿Confirmás?")) return;
    try{
      const u = await sget(K.users,{})||{};
      for(const uid of Object.keys(u)){ try{ await sdel(K.picks(uid)); }catch{} }
      try{ await sdel(K.users); }catch{}
      try{ await sdel(K.results); }catch{}
      try{ await sdel(K.config); }catch{}
    }catch{}
    flash("Todo reseteado. Recargá la página."); setTimeout(()=>window.location.reload(),1200);
  };

  const [secc,setSecc]=useState("fechas");

  return (
    <div className="card">
      <div className="scrollx" style={{ display:"flex", gap:6, marginBottom:14, overflowX:"auto" }}>
        <SubTab id="fechas" cur={secc} set={setSecc} label="Cierres"/>
        <SubTab id="cruces" cur={secc} set={setSecc} label="Cargar cruces"/>
        <SubTab id="resG" cur={secc} set={setSecc} label="Result. grupos"/>
        <SubTab id="resK" cur={secc} set={setSecc} label="Result. elim."/>
        <SubTab id="resB" cur={secc} set={setSecc} label="Result. bonus"/>
        <SubTab id="users" cur={secc} set={setSecc} label="Jugadores"/>
      </div>

      {secc==="users" && (
        <div style={{ background:"#fff", borderRadius:14, padding:14 }}>
          <div className="disp" style={{ fontSize:18, color:C.celesteDeep, marginBottom:8 }}>Jugadores ({Object.keys(users||{}).length})</div>
          {Object.keys(users||{}).length===0 && <div style={{color:C.mute,fontSize:13}}>Sin jugadores.</div>}
          {Object.entries(users||{}).map(([uid,info])=>(
            <div key={uid} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 0", borderTop:`1px solid ${C.paper}` }}>
              <span style={{ fontWeight:700, fontSize:14 }}>{info.name||uid} {uid===me?"👑 (vos)":""}</span>
              {uid!==me && <button onClick={()=>deleteUser(uid)} style={{ border:`2px solid ${C.bad}`, background:"#fff", color:C.bad, borderRadius:8, padding:"5px 12px", fontWeight:800, fontSize:12, cursor:"pointer" }}>Borrar</button>}
            </div>
          ))}
        </div>
      )}

      {secc==="fechas" && (
        <div style={{ background:"#fff", borderRadius:14, padding:14 }}>
          <p style={{fontSize:13,color:C.mute,marginTop:0}}>Definí cuándo se cierra cada fase. Formato fecha/hora local. Las fases se cierran solas al llegar la hora.</p>
          <DateRow label="Grupos + Campeón" value={config.locks.grupos} onChange={v=>{const c={...config};c.locks={...c.locks,grupos:v};saveConfig(c);}}/>
          {KO_ORDER.map(ph=>(
            <DateRow key={ph} label={config.ko[ph].label} value={config.ko[ph].lock}
              onChange={v=>{const c={...config};c.ko={...c.ko,[ph]:{...c.ko[ph],lock:v}};saveConfig(c);}}/>
          ))}
        </div>
      )}

      {secc==="cruces" && (
        <div style={{ background:"#fff", borderRadius:14, padding:14 }}>
          <p style={{fontSize:13,color:C.mute,marginTop:0}}>Cuando termina una fase y conocés los cruces, cargalos acá y tocá <b>Abrir</b>. Recién ahí los jugadores pueden pronosticar esa ronda.</p>
          {KO_ORDER.map(ph=>(
            <KoEditor key={ph} ph={ph} f={config.ko[ph]}
              onChange={(mu,open)=>{const c={...config};c.ko={...c.ko,[ph]:{...c.ko[ph],matchups:mu,open}};saveConfig(c);}}/>
          ))}
        </div>
      )}

      {secc==="resG" && (
        <div style={{ background:"#fff", borderRadius:14, padding:14 }}>
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:10, flexWrap:"wrap" }}>
            <Btn kind="sol" disabled={busy} onClick={async()=>{
              setBusy(true);
              const pend = GROUP_MATCHES.filter(m=>!results?.grupos?.[m.id]);
              const sug = await suggestGroupResults(pend.slice(0,72));
              if(sug && Object.keys(sug).length){ const r={...results,grupos:{...results.grupos,...sug}}; await saveResults(r); flash(`Sugeridos ${Object.keys(sug).length} ✓ revisá`); }
              else flash("No se pudo traer. Cargá a mano.");
              setBusy(false);
            }}>{busy?"Buscando…":"🔍 Sugerir desde la web"}</Btn>
            <span style={{fontSize:12,color:C.mute}}>Pre-llena lo ya jugado. Revisá siempre.</span>
          </div>
          <div style={{ marginBottom:10 }}>
            <span style={{fontSize:12,fontWeight:800,color:C.mute}}>Campeón (resultado final): </span>
            <select value={results.champion||""} onChange={e=>{const r={...results,champion:e.target.value};saveResults(r);}}
              style={{ padding:"8px", borderRadius:8, border:`2px solid ${C.line}`, fontWeight:700 }}>
              <option value="">—</option>{ALL_TEAMS.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(t=><option key={t.name} value={t.name}>{t.flag} {t.name}</option>)}
            </select>
          </div>
          {GROUPS.map(g=>(
            <div key={g.id} style={{ marginBottom:10 }}>
              <div className="disp" style={{ fontSize:16, color:C.celesteDeep }}>Grupo {g.id}</div>
              {GROUP_MATCHES.filter(m=>m.group===g.id).map(m=>(
                <div key={m.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"5px 0", fontSize:13, borderTop:`1px solid ${C.paper}` }}>
                  <span>{m.homeFlag}{m.home.slice(0,7)} v {m.away.slice(0,7)}{m.awayFlag}</span>
                  <span style={{ display:"flex", gap:4 }}>
                    {["L","E","V"].map(code=>(
                      <button key={code} onClick={()=>{const r={...results};r.grupos={...r.grupos,[m.id]:code};saveResults(r);}}
                        style={{ padding:"4px 9px", borderRadius:7, border:"none", cursor:"pointer", fontWeight:800, fontSize:12,
                          background: results?.grupos?.[m.id]===code?C.celesteDeep:C.paper, color:results?.grupos?.[m.id]===code?"#fff":C.ink }}>{code}</button>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {secc==="resK" && (
        <div style={{ background:"#fff", borderRadius:14, padding:14 }}>
          <p style={{fontSize:13,color:C.mute,marginTop:0}}>Marcá quién pasó en cada cruce ya jugado.</p>
          {KO_ORDER.filter(ph=>(config.ko[ph].matchups||[]).length).map(ph=>(
            <div key={ph} style={{ marginBottom:10 }}>
              <div className="disp" style={{ fontSize:16, color:C.celesteDeep }}>{config.ko[ph].label}</div>
              {config.ko[ph].matchups.map(mu=>(
                <div key={mu.id} style={{ display:"flex", gap:6, padding:"5px 0", borderTop:`1px solid ${C.paper}` }}>
                  {[mu.teamA,mu.teamB].map(tm=>(
                    <button key={tm} onClick={()=>{const r={...results};r.ko={...r.ko};r.ko[ph]={...(r.ko[ph]||{}),[mu.id]:tm};saveResults(r);}}
                      style={{ flex:1, padding:"7px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:700, fontSize:12,
                        background: results?.ko?.[ph]?.[mu.id]===tm?C.celesteDeep:C.paper, color:results?.ko?.[ph]?.[mu.id]===tm?"#fff":C.ink }}>
                      {flagOf(tm)} {tm}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {secc==="resB" && (
        <div style={{ background:"#fff", borderRadius:14, padding:14 }}>
          <p style={{fontSize:13,color:C.mute,marginTop:0}}>Marcá la respuesta correcta de cada pregunta de trivia cuando se resuelva. No afecta el puntaje general; define los campeones honoríficos 🏅🏆.</p>
          {[["grupos","🏅 Trivia de Grupos"],["mundial","🏆 Trivia del Mundial"]].map(([cat,titulo])=>(
            <div key={cat} style={{ marginBottom:14 }}>
              <div className="disp" style={{ fontSize:16, color:C.celesteDeep, marginTop:6 }}>{titulo}</div>
              {BONUS_QUESTIONS.filter(q=>q.cat===cat).map(qn=>(
                <div key={qn.id} style={{ padding:"8px 0", borderTop:`1px solid ${C.paper}` }}>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:6 }}>{qn.q}</div>
                  <div style={{ display:"flex", gap:6 }}>
                    {qn.opts.map(op=>(
                      <button key={op} onClick={()=>{const r={...results};r.bonus={...(r.bonus||{}),[qn.id]:op};saveResults(r);}}
                        style={{ flex:1, padding:"7px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:700, fontSize:12,
                          background: results?.bonus?.[qn.id]===op?C.celesteDeep:C.paper, color:results?.bonus?.[qn.id]===op?"#fff":C.ink }}>
                        {op}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div style={{ background:"#fff", borderRadius:14, padding:14, marginTop:14 }}>
        <div className="disp" style={{ fontSize:18, color:C.celesteDeep, marginBottom:6 }}>Exportar a planilla 📊</div>
        <div style={{ fontSize:13, color:C.mute, marginBottom:10 }}>Baja un CSV con todos los jugadores y sus pronósticos (grupos, campeón y eliminación). Lo abrís en Google Sheets / Excel. Sirve también como backup.</div>
        <Btn kind="sol" onClick={()=>exportCSV(config)}>⬇️ Descargar CSV con todos los picks</Btn>
      </div>

      <div style={{ background:"#fff", borderRadius:14, padding:14, marginTop:14, border:`2px solid ${C.bad}` }}>
        <div className="disp" style={{ fontSize:18, color:C.bad, marginBottom:6 }}>Zona peligrosa ⚠️</div>
        <div style={{ fontSize:13, color:C.mute, marginBottom:10 }}>Borra TODO (jugadores, picks, resultados y cruces) y deja la app de cero. Usalo para limpiar los datos de prueba antes de arrancar el Mundial. <b>No se puede deshacer.</b></div>
        <Btn kind="danger" onClick={resetAll}>🗑️ Resetear todo y empezar de cero</Btn>
      </div>

      <div style={{ fontSize:12, color:C.mute, marginTop:14, lineHeight:1.5 }}>
        📲 <b>Para que jueguen tus amigos:</b> compartí el link de esta app. Cada uno entra, crea su cuenta y agrega el sitio a la pantalla de inicio del celu (menú del navegador → “Agregar a inicio”).
      </div>
    </div>
  );
}

// Exportar todos los picks a CSV (lee storage en vivo)
async function exportCSV(config){
  const users = await sget(K.users,{})||{};
  const results = await sget(K.results,{grupos:{},ko:{},champion:null})||{grupos:{},ko:{},champion:null};
  const picks={};
  try{ const list=(await slist(K.picksPrefix)); for(const key of (list||[])){ const uid=key.replace(K.picksPrefix,""); picks[uid]=await sget(key,{})||{}; } }catch{}
  const esc=(v)=>`"${String(v??"").replace(/"/g,'""')}"`;
  const labelG=(code,m)=> code==="L"?`Gana ${m.home}`:code==="V"?`Gana ${m.away}`:code==="E"?"Empate":"";
  const rows=[];
  rows.push(["Tipo","Jugador","Fase/Grupo","Partido/Cruce","Pronóstico","Resultado real"].map(esc).join(","));
  for(const [uid,info] of Object.entries(users)){
    const name=info.name||uid; const pk=picks[uid]||{};
    rows.push(["Campeón",name,"—","Campeón (10 pts)",pk.champion||"",results.champion||""].map(esc).join(","));
    for(const q of BONUS_QUESTIONS){
      rows.push(["Bonus",name,"Bonus",q.q, pk?.bonus?.[q.id]||"", results?.bonus?.[q.id]||""].map(esc).join(","));
    }
    for(const m of GROUP_MATCHES){
      rows.push(["Grupo",name,`Grupo ${m.group}`,`${m.home} vs ${m.away}`, labelG(pk?.grupos?.[m.id],m), labelG(results?.grupos?.[m.id],m)].map(esc).join(","));
    }
    for(const ph of KO_ORDER){
      const f=config.ko[ph]; for(const mu of (f.matchups||[])){
        rows.push(["Eliminación",name,f.label,`${mu.teamA} vs ${mu.teamB}`, pk?.ko?.[ph]?.[mu.id]||"", results?.ko?.[ph]?.[mu.id]||""].map(esc).join(","));
      }
    }
  }
  const csv="\uFEFF"+rows.join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url; a.download=`la-scalonetta-picks-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}
function DateRow({ label, value, onChange }){
  const local = value? value.slice(0,16):"";
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, padding:"8px 0", borderTop:`1px solid ${C.paper}` }}>
      <span style={{ fontWeight:700, fontSize:14 }}>{label}</span>
      <input type="datetime-local" value={local} onChange={e=>onChange(e.target.value+":00-03:00")}
        style={{ padding:"7px", borderRadius:8, border:`2px solid ${C.line}`, fontSize:13 }}/>
    </div>
  );
}
function KoEditor({ ph, f, onChange }){
  const [mu,setMu]=useState(f.matchups||[]);
  const teams=ALL_TEAMS.slice().sort((a,b)=>a.name.localeCompare(b.name));
  const add=()=>setMu([...mu,{ id:`${ph}-${mu.length}-${Date.now()}`, teamA:"", teamB:"" }]);
  const upd=(i,k,v)=>{ const n=mu.slice(); n[i]={...n[i],[k]:v}; setMu(n); };
  const del=(i)=>setMu(mu.filter((_,j)=>j!==i));
  return (
    <div style={{ border:`1px solid ${C.line}`, borderRadius:12, padding:10, marginBottom:10 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span className="disp" style={{ fontSize:18, color:C.celesteDeep }}>{f.label} {f.open?<Pill bg={C.good}>ABIERTA</Pill>:<Pill bg={C.mute}>cerrada</Pill>}</span>
        <Btn kind="ghost" style={{padding:"6px 10px",fontSize:13}} onClick={add}>+ cruce</Btn>
      </div>
      {mu.map((x,i)=>(
        <div key={x.id} style={{ display:"flex", gap:5, alignItems:"center", marginTop:6 }}>
          <select value={x.teamA} onChange={e=>upd(i,"teamA",e.target.value)} style={selSm}><option value="">A</option>{teams.map(t=><option key={t.name}>{t.name}</option>)}</select>
          <span style={{fontSize:11,color:C.mute}}>vs</span>
          <select value={x.teamB} onChange={e=>upd(i,"teamB",e.target.value)} style={selSm}><option value="">B</option>{teams.map(t=><option key={t.name}>{t.name}</option>)}</select>
          <button onClick={()=>del(i)} style={{ border:"none", background:"#fdecea", color:C.bad, borderRadius:7, padding:"6px 9px", cursor:"pointer", fontWeight:800 }}>×</button>
        </div>
      ))}
      <div style={{ display:"flex", gap:6, marginTop:8 }}>
        <Btn kind="primary" style={{padding:"8px 12px",fontSize:13}} onClick={()=>onChange(mu.filter(x=>x.teamA&&x.teamB),false)}>Guardar</Btn>
        <Btn kind="sol" style={{padding:"8px 12px",fontSize:13}} onClick={()=>onChange(mu.filter(x=>x.teamA&&x.teamB),true)}>Guardar y abrir 🟢</Btn>
      </div>
    </div>
  );
}
const selSm={ flex:1, padding:"6px", borderRadius:7, border:`2px solid ${C.line}`, fontSize:12, minWidth:0 };

// ---------- AUTO-SUGERENCIA DE RESULTADOS (best-effort) ----------
async function suggestGroupResults(matches){
  if(!matches.length) return {};
  const list = matches.map(m=>`${m.id} | Grupo ${m.group}: ${m.home} (LOCAL) vs ${m.away} (VISITANTE)`).join("\n");
  const prompt = `Sos un asistente que devuelve resultados YA JUGADOS del Mundial de fútbol 2026.
Para cada partido de la lista, indicá: "L" si ganó el LOCAL, "E" si empató, "V" si ganó el VISITANTE.
Si un partido todavía no se jugó o no encontrás el resultado confiable, OMITILO (no lo incluyas).
Respondé EXCLUSIVAMENTE un objeto JSON válido sin texto adicional ni backticks, con la forma {"ID":"L|E|V"}.
Partidos:\n${list}`;
  try{
    const resp = await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"claude-sonnet-4-20250514", max_tokens:1500,
        messages:[{role:"user",content:prompt}],
        tools:[{type:"web_search_20250305",name:"web_search"}],
      }),
    });
    const data = await resp.json();
    const text = (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n");
    const clean = text.replace(/```json|```/g,"").trim();
    const start=clean.indexOf("{"), end=clean.lastIndexOf("}");
    if(start<0||end<0) return {};
    const obj = JSON.parse(clean.slice(start,end+1));
    const valid={}; for(const [k,v] of Object.entries(obj)){ if(["L","E","V"].includes(v) && matches.find(m=>m.id===k)) valid[k]=v; }
    return valid;
  }catch{ return {}; }
}

// ---------- HELPER: tiempo relativo ----------
function fmtAgo(ts, now){
  if(!ts) return null;
  const diff = Math.floor((now - ts) / 1000);
  if(diff < 10) return "ahora mismo";
  if(diff < 60) return `hace ${diff}s`;
  const m = Math.floor(diff / 60);
  if(m < 60) return `hace ${m} min`;
  return `hace ${Math.floor(m/60)}h`;
}

// ---------- ERROR BOUNDARY (evita pantalla en blanco) ----------
class ErrorBoundary extends React.Component {
  constructor(p){ super(p); this.state={err:null}; }
  static getDerivedStateFromError(err){ return {err}; }
  componentDidCatch(err,info){ console.error("La Scalonetta error:", err, info); }
  render(){
    if(this.state.err){
      return (
        <div className="scl" style={{ minHeight:"100vh", display:"grid", placeItems:"center", background:C.paper, padding:24 }}>
          <div style={{ background:"#fff", borderRadius:18, padding:24, maxWidth:440, textAlign:"center", boxShadow:"0 20px 50px rgba(12,30,51,.2)" }}>
            <div style={{ fontSize:40 }}>⚽😵</div>
            <div className="disp" style={{ fontSize:26, color:C.celesteDeep, margin:"6px 0" }}>Algo se rompió</div>
            <div style={{ fontSize:13, color:C.mute, marginBottom:14 }}>Probá recargar la página. Si sigue pasando, avisale al admin con una captura de esto:</div>
            <pre style={{ textAlign:"left", fontSize:11, background:C.paper, padding:10, borderRadius:8, overflow:"auto", color:C.bad }}>{String(this.state.err?.message||this.state.err)}</pre>
            <Btn kind="primary" style={{ marginTop:14 }} onClick={()=>window.location.reload()}>Recargar</Btn>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App(){
  return <><Style/><ErrorBoundary><AppInner/></ErrorBoundary></>;
}
