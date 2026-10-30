// Games: the board games families play on festival nights, as in the approved prototype
// (design/games/games-prototype.html). The virtue board (Paramapadam), the pit game (Pallanguzhi) and the
// hunt game (Aadu Puli Aattam), each under the user's tradition's own name. Free, with no stakes of any kind.
// The rules are pure functions without the DOM; the screens draw into the element app.js hands over.

// ---------------------------------------------------------------- rules (ported as they are from the prototype)
export const Rules = (function () {
  /* ---------- Paramapadam ---------- */
  var LADDERS = {3:[39,'Kindness'],10:[29,'Truth'],28:[69,'Patience'],40:[80,'Devotion'],47:[67,'Generosity'],73:[87,'Humility']};
  var SNAKES  = {16:[5,'Anger'],45:[8,'Greed'],64:[23,'Pride'],90:[50,'Envy'],98:[58,'Laziness']};
  function throwCowries(rng){
    var shells=[], up=0;
    for(var i=0;i<6;i++){ var u = rng()<0.5; shells.push(u); if(u) up++; }
    return {shells:shells, up:up, move: up===0 ? 6 : up};
  }
  function ppMove(pos, roll){
    if(roll<1||roll>6) throw new Error('bad roll');
    if(pos+roll>100) return {path:[], landed:pos, jump:null, final:pos, overshoot:true, win:false};
    var path=[]; for(var s=pos+1;s<=pos+roll;s++) path.push(s);
    var landed=pos+roll, jump=null;
    if(LADDERS[landed]) jump={kind:'virtue', to:LADDERS[landed][0], name:LADDERS[landed][1]};
    else if(SNAKES[landed]) jump={kind:'vice', to:SNAKES[landed][0], name:SNAKES[landed][1]};
    var final = jump ? jump.to : landed;
    return {path:path, landed:landed, jump:jump, final:final, overshoot:false, win: final===100};
  }
  function ppNew(n){ var pos=[]; for(var i=0;i<(n||2);i++) pos.push(0); return {pos:pos, turn:0, winner:null, throws:0}; }
  function ppApply(st, roll){
    if(st.winner!==null) throw new Error('game over');
    var m = ppMove(st.pos[st.turn], roll);
    var pos = st.pos.slice(); pos[st.turn]=m.final;
    var winner = m.win ? st.turn : null;
    return {state:{pos:pos, turn: winner!==null ? st.turn : (st.turn+1)%st.pos.length, winner:winner, throws:st.throws+1}, move:m};
  }

  /* ---------- Pallanguzhi ---------- */
  var PL_N=14, PL_SEEDS=5, PL_RELAY_CAP=80, PL_TURN_CAP=400, PL_QUIET=12;
  function plNew(){ var p=[]; for(var i=0;i<PL_N;i++) p.push(PL_SEEDS); return {pits:p, store:[0,0], turn:0, over:false, winner:null, turns:0, quiet:0}; }
  function plSide(i){ return i<7 ? 0 : 1; }
  function plLegal(s){ var r=[]; if(s.over) return r; for(var i=s.turn*7;i<s.turn*7+7;i++) if(s.pits[i]>0) r.push(i); return r; }
  function plMove(s, pit){
    if(s.over || plSide(pit)!==s.turn || s.pits[pit]===0) throw new Error('illegal pallanguzhi move '+pit);
    var pits=s.pits.slice(), store=s.store.slice(), me=s.turn, ev=[];
    var hand=pits[pit]; pits[pit]=0; ev.push({t:'pick',pit:pit,n:hand});
    var pos=pit, relays=0;
    for(;;){
      while(hand>0){
        pos=(pos+1)%PL_N; pits[pos]++; hand--; ev.push({t:'drop',pit:pos});
        if(pits[pos]===4){ store[me]+=4; pits[pos]=0; ev.push({t:'pasu',pit:pos,n:4}); }
      }
      var nx=(pos+1)%PL_N;
      if(pits[nx]>0){
        if(relays>=PL_RELAY_CAP){ ev.push({t:'rest'}); break; }
        hand=pits[nx]; pits[nx]=0; pos=nx; relays++; ev.push({t:'pick',pit:nx,n:hand}); continue;
      }
      var cap=(nx+1)%PL_N, n=pits[cap]; pits[cap]=0; store[me]+=n;
      ev.push({t:'capture',pit:cap,n:n,empty:nx});
      break;
    }
    var gained=store[me]-s.store[me];
    var next={pits:pits, store:store, turn:1-me, over:false, winner:null, turns:s.turns+1, quiet: gained>0 ? 0 : (s.quiet||0)+1};
    if(plLegal(next).length===0 || next.quiet>=PL_QUIET || next.turns>=PL_TURN_CAP){
      for(var i=0;i<PL_N;i++){ store[plSide(i)]+=pits[i]; pits[i]=0; }
      next.over=true; next.winner = store[0]>store[1]?0 : store[1]>store[0]?1 : -1;
      ev.push({t:'end', quiet: next.quiet>=PL_QUIET});
    }
    return {state:next, events:ev};
  }
  function plAI(s, rng){
    var moves=plLegal(s), best=null, bestScore=-1e9, me=s.turn;
    moves.forEach(function(m){
      var r=plMove(s,m), gain=r.state.store[me]-s.store[me], reply=0;
      if(!r.state.over){ plLegal(r.state).forEach(function(o){ var rr=plMove(r.state,o); reply=Math.max(reply, rr.state.store[1-me]-r.state.store[1-me]); }); }
      else { gain += (r.state.winner===me?50:r.state.winner===1-me?-50:0); }
      var sc=gain-0.6*reply+rng()*0.5;
      if(sc>bestScore){ bestScore=sc; best=m; }
    });
    return best;
  }

  /* ---------- Aadu Puli Aattam (23-point triangle) ---------- */
  // index 0 apex; rows 1..3 have 6 points (j=0 left side, 1..4 on the four lines from the apex, 5 right side); row 4 (base) has 4 points 19..22.
  function P(r,j){ return 1+(r-1)*6+j; }
  var LINES=[], k, r;
  for(k=0;k<4;k++) LINES.push([0,P(1,k+1),P(2,k+1),P(3,k+1),19+k]);
  for(r=1;r<=3;r++) LINES.push([P(r,0),P(r,1),P(r,2),P(r,3),P(r,4),P(r,5)]);
  LINES.push([19,20,21,22]);
  LINES.push([P(1,0),P(2,0),P(3,0)]); LINES.push([P(1,5),P(2,5),P(3,5)]);
  var AP_N=23, ADJ=[], JUMPS=[];
  for(var i=0;i<AP_N;i++){ ADJ.push([]); JUMPS.push([]); }
  LINES.forEach(function(L){
    for(var a=0;a<L.length-1;a++){ ADJ[L[a]].push(L[a+1]); ADJ[L[a+1]].push(L[a]); }
    for(var b=0;b<L.length-2;b++){ JUMPS[L[b]].push([L[b+1],L[b+2]]); JUMPS[L[b+2]].push([L[b+1],L[b]]); }
  });
  var CK=[-3,-1,1,3];
  function apCoords(u,h,ox,oy){
    var c=[]; c[0]=[ox,oy];
    for(var r=1;r<=3;r++){ c[P(r,0)]=[ox-11*u,oy+r*h]; for(var k=0;k<4;k++) c[P(r,k+1)]=[ox+CK[k]*r*u,oy+r*h]; c[P(r,5)]=[ox+11*u,oy+r*h]; }
    for(k=0;k<4;k++) c[19+k]=[ox+CK[k]*4*u,oy+4*h];
    return c;
  }
  var AP_GOATS=15, AP_WIN_CAPTURES=6, AP_MOVE_CAP=200;
  function apNew(){ var b=[]; for(var i=0;i<AP_N;i++) b.push(null); b[0]='T'; b[P(1,2)]='T'; b[P(1,3)]='T';
    return {board:b, placed:0, captured:0, turn:'T', plies:0, over:null}; }
  function apLegal(s){
    var out=[], b=s.board;
    if(s.over) return out;
    if(s.turn==='T'){
      for(var a=0;a<AP_N;a++) if(b[a]==='T'){
        ADJ[a].forEach(function(n){ if(b[n]===null) out.push({from:a,to:n}); });
        JUMPS[a].forEach(function(j){ if(b[j[0]]==='G' && b[j[1]]===null) out.push({from:a,to:j[1],cap:j[0]}); });
      }
    } else if(s.placed<AP_GOATS){
      for(var p=0;p<AP_N;p++) if(b[p]===null) out.push({to:p});
    } else {
      for(var g=0;g<AP_N;g++) if(b[g]==='G') ADJ[g].forEach(function(n){ if(b[n]===null) out.push({from:g,to:n}); });
    }
    return out;
  }
  function apSame(m,n){ return m.to===n.to && m.from===n.from && m.cap===n.cap; }
  function apApply(s, m){
    var legal=apLegal(s);
    if(!legal.some(function(x){return apSame(x,m);})) throw new Error('illegal aadu puli move '+JSON.stringify(m));
    var b=s.board.slice(), placed=s.placed, captured=s.captured;
    if(m.from===undefined){ b[m.to]='G'; placed++; }
    else { b[m.to]=b[m.from]; b[m.from]=null; if(m.cap!==undefined){ b[m.cap]=null; captured++; } }
    var ns={board:b, placed:placed, captured:captured, turn: s.turn==='T'?'G':'T', plies:s.plies+1, over:null};
    if(captured>=AP_WIN_CAPTURES) ns.over='tigers';
    else if(apLegal(ns).length===0) ns.over = ns.turn==='T' ? 'goats' : 'tigers';
    else if(ns.plies>=AP_MOVE_CAP) ns.over='draw';
    return ns;
  }
  function apTigerMobility(b){ var n=0; for(var a=0;a<AP_N;a++) if(b[a]==='T'){ ADJ[a].forEach(function(x){ if(b[x]===null) n++; }); JUMPS[a].forEach(function(j){ if(b[j[0]]==='G'&&b[j[1]]===null) n+=3; }); } return n; }
  function apTigerAI(s, rng){
    var moves=apLegal(s), best=null, bs=-1e9;
    moves.forEach(function(m){
      var ns=apApply(s,m), sc=0;
      if(m.cap!==undefined) sc+=20;
      if(ns.over==='tigers') sc+=1000; if(ns.over==='goats') sc-=1000;
      // look at goats' reply: assume goats pick the reply that leaves tigers least mobile
      if(!ns.over){ var worst=1e9; apLegal(ns).forEach(function(g){ var g2=apApply(ns,g); var v= g2.over==='goats'?-500 : apTigerMobility(g2.board); if(v<worst) worst=v; }); sc+=worst; }
      sc+=rng()*1.5;
      if(sc>bs){ bs=sc; best=m; }
    });
    return best;
  }
  function apFreeTigers(s){ var b=s.board,n=0; for(var a=0;a<AP_N;a++) if(b[a]==='T'){ var can=ADJ[a].some(function(x){return b[x]===null;}) || JUMPS[a].some(function(j){return b[j[0]]==='G'&&b[j[1]]===null;}); if(can) n++; } return n; }

  return {LADDERS:LADDERS, SNAKES:SNAKES, throwCowries:throwCowries, ppMove:ppMove, ppNew:ppNew, ppApply:ppApply,
    plNew:plNew, plSide:plSide, plLegal:plLegal, plMove:plMove, plAI:plAI,
    AP_N:AP_N, ADJ:ADJ, JUMPS:JUMPS, LINES:LINES, apCoords:apCoords, apNew:apNew, apLegal:apLegal, apApply:apApply, apTigerAI:apTigerAI, apFreeTigers:apFreeTigers,
    AP_GOATS:AP_GOATS, AP_WIN_CAPTURES:AP_WIN_CAPTURES};
})();

// ---------------------------------------------------------------- names by tradition
const TAMILS = ['tamil', 'sri-lankan-tamil', 'malaysian-tamil', 'south-african-tamil'];
// The string key of each game's name in a tradition (pack culture id).
export function gameKey(game, c) {
  const south = TAMILS.includes(c) || c === 'malayalam';
  if (game === 'pp') return 'gm.g.' + (south || c === 'kannada' ? 'paramapadam' : c === 'telugu' ? 'vaikunthapali' : c === 'marathi' ? 'mokshaPatam' : 'gyanChaupar');
  if (game === 'pl') return 'gm.g.' + (c === 'kannada' ? 'aliGuliMane' : c === 'telugu' ? 'vamanaGuntalu' : 'pallanguzhi');
  if (game === 'ap') return 'gm.g.' + (c === 'kannada' ? 'huliGatta' : c === 'telugu' ? 'puliMeka' : 'aaduPuli');
  return 'gm.g.' + (TAMILS.includes(c) ? 'dayakattam' : c === 'kannada' ? 'chowkaBara' : c === 'telugu' ? 'ashtaChamma' : c === 'malayalam' ? 'thayam' : 'chaupar');
}
// Vaikuntha Ekadashi under its names in the packs, whose night the virtue board is played.
export const VIGIL = /vaikunt|mukkoti|swargavathil/;

// ---------------------------------------------------------------- the screen
// GM.screen: null (the games home), 'pp', 'pl' or 'ap'. The modes and the games in play are kept while the app is open.
export const GM = { screen: null };
let C = null, root = null, run = 0;
const SVGNS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, parent) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
const $ = id => root.querySelector('#gm-' + id);
const wait = ms => new Promise(r => setTimeout(r, ms));
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const T = ms => still() ? Math.min(ms, 40) : ms;
// A screen's work stops when another screen, or another tab, takes its place.
const alive = my => my === run && root?.isConnected && C.active();
const t = (...a) => C.t(...a), esc = s => C.esc(s);
// Text with one part in bold: the part goes in as a marker and comes back wrapped.
const tb = (key, bold, ...args) => esc(t(key, '\u0001', ...args)).replace('\u0001', `<b>${esc(bold)}</b>`);
const lower = s => C.lang === 'en' ? s.toLowerCase() : s;
const vName = n => t((Rules.LADDERS[Object.keys(Rules.LADDERS).find(k => Rules.LADDERS[k][1] === n)] ? 'gm.v.' : 'gm.x.') + n.toLowerCase());
const gname = g => t(gameKey(g, C.culture));

// ctx: { t, tIn, esc, lang, culture, cultureName, packLang, loading, active: () => whether the games are still on screen,
//   vigil: () => Promise<{ name, when, today, date } | null> (the next Vaikuntha Ekadashi) }
export function showGames(el, ctx) {
  C = ctx; root = el; run++;
  if (GM.screen === 'pp') return ppScreen();
  if (GM.screen === 'pl') return plScreen();
  if (GM.screen === 'ap') return apScreen();
  return homeScreen();
}
function go(screen) { GM.screen = screen; showGames(root, C); scrollTo(0, 0); }

const ICONS = {
  pl: '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><rect x="3" y="11" width="34" height="18" rx="9" fill="var(--wood)"/><g fill="var(--pit)"><circle cx="10" cy="16" r="2.6"/><circle cx="16.7" cy="16" r="2.6"/><circle cx="23.3" cy="16" r="2.6"/><circle cx="30" cy="16" r="2.6"/><circle cx="10" cy="24" r="2.6"/><circle cx="16.7" cy="24" r="2.6"/><circle cx="23.3" cy="24" r="2.6"/><circle cx="30" cy="24" r="2.6"/></g><g fill="var(--seed-hi)"><ellipse cx="16.7" cy="24" rx="1.2" ry=".8"/><ellipse cx="30" cy="16" rx="1.2" ry=".8"/></g></svg>',
  ap: '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><g fill="none" stroke="var(--green)" stroke-width="1.4" stroke-linecap="round"><path d="M20 5 L5 35 M20 5 L35 35 M20 5 L15 35 M20 5 L25 35 M5 35 H35 M7 17 H33 M5 25 H35 M7 17 V25 M33 17 V25"/></g><circle cx="20" cy="5" r="2.6" fill="var(--clay)"/><circle cx="17.5" cy="25" r="2.2" fill="var(--paper)" stroke="var(--green)" stroke-width="1"/><circle cx="25" cy="17" r="2.2" fill="var(--paper)" stroke="var(--green)" stroke-width="1"/></svg>',
  race: '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><g fill="none" stroke="var(--maroon)" stroke-width="1.4"><path d="M15 3h10v12h12v10H25v12H15V25H3V15h12z"/><path d="M15 15h10v10H15z"/><path d="M18.3 3v12 M21.7 3v12 M18.3 25v12 M21.7 25v12 M3 18.3h12 M3 21.7h12 M25 18.3h12 M25 21.7h12" opacity=".5"/></g></svg>',
  pp: '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><rect x="5" y="5" width="30" height="30" fill="var(--sq-a)" stroke="var(--gold-ink)" stroke-width="1"/><path d="M5 12.5h30M5 20h30M5 27.5h30M12.5 5v30M20 5v30M27.5 5v30" stroke="var(--gold-ink)" stroke-width=".5" opacity=".5"/><path d="M11 32 L20 10 M15 33 L24 11" stroke="var(--ladder)" stroke-width="1.4"/><path d="M13 27l4 1.6 M15 22l4 1.6 M17 17l4 1.6" stroke="var(--ladder)" stroke-width="1.2"/><path d="M31 9 c-6 4 3 8 -3 13 s3 7 -3 11" stroke="var(--snake)" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>',
};
const FAMS = [
  { g: 'pl', fam: 'gm.fam.pit', bg: 'var(--clay-soft)', go: 'background:var(--clay);color:var(--on-dark)', names: ['pallanguzhi', 'aliGuliMane', 'vamanaGuntalu'] },
  { g: 'ap', fam: 'gm.fam.hunt', bg: 'var(--green-soft)', go: 'background:var(--green);color:var(--paper)', names: ['aaduPuli', 'huliGatta', 'puliMeka', 'baghBandi', 'baghChal'] },
  { g: 'race', fam: 'gm.fam.race', bg: 'var(--maroon-soft)', names: ['chaupar', 'chowkaBara', 'ashtaChamma', 'thayam', 'dayakattam'] },
  { g: 'pp', fam: 'gm.fam.virtue', bg: 'var(--gold-soft)', go: 'background:var(--gold-ink);color:var(--paper)', names: ['paramapadam', 'vaikunthapali', 'gyanChaupar', 'mokshaPatam'] },
];
// The virtue board in small, on the lacquer of the hero.
const heroBoard = () => `<svg width="104" height="120" viewBox="0 0 104 120" aria-hidden="true" style="flex:none;border-radius:12px;box-shadow:inset 0 0 0 1px rgba(232,194,90,.4)">
  <rect width="104" height="120" rx="12" fill="#1C1650"></rect>
  <g fill="none" stroke="#E8C25A" stroke-width="1" opacity=".55"><path d="M14 22h76v84H14z M14 43h76 M14 64h76 M14 85h76 M33 22v84 M52 22v84 M71 22v84"></path></g>
  <g stroke="#E8C25A" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M26 98 L60 30 M34 102 L68 34"></path><path d="M29 92l8 4 M33 84l8 4 M37 76l8 4 M41 68l8 4 M45 60l8 4 M49 52l8 4 M53 44l8 4"></path></g>
  <path d="M84 36 c-14 6 4 18 -10 26 s2 20 -12 28" stroke="#F3D98C" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"></path>
  <circle cx="84" cy="36" r="3.4" fill="#F3D98C"></circle>
  <text x="52" y="15" text-anchor="middle" font-family="ui-serif, Georgia, serif" font-size="9" font-weight="600" fill="#F3D98C">${esc(t('gm.pp.vaikuntha'))}</text></svg>`;
const how = (pre, n) => `<details class="gm-how"><summary>${esc(t('gm.howTo'))}</summary><ul>${[...Array(n)].map((_, i) => `<li>${esc(t(`gm.${pre}.how${i + 1}`))}</li>`).join('')}</ul></details>`;
const head = (g, fam) => `<button class="linkbtn" data-gm-back>‹ ${esc(t('gm.menu'))}</button>
  <div class="gm-title"><span class="gm-sub">${esc(t(fam))}</span><h2 class="serif">${esc(gname(g))}</h2></div>`;
function wireBack() { root.querySelector('[data-gm-back]').onclick = () => go(null); }
function seg(id, opts, on) {
  return `<div class="gm-seg" id="gm-${id}" role="group">${opts.map(([n, label]) => `<button data-n="${n}" aria-pressed="${n === on}">${esc(label)}</button>`).join('')}</div>`;
}

// ---------------------------------------------------------------- the games home
async function homeScreen() {
  const my = run;
  C.loading?.();
  const vk = await C.vigil().catch(() => null);
  if (!alive(my)) return;
  const virtue = gname('pp'), other = C.tIn && C.packLang !== C.lang ? C.tIn(C.packLang, gameKey('pp', C.culture)) : '';
  const eyebrow = vk ? (vk.today ? `${t('gm.tonight')} · ${vk.name}` : `${vk.name} · ${vk.when}`) : '';
  const tile = (g, sub, i) => g === 'race'
    ? `<button class="gm-tile rise" style="--i:${i}" aria-disabled="true" disabled><span class="ic" style="background:var(--maroon-soft)">${ICONS.race}</span><b>${esc(gname('race'))}</b><span class="soon">${esc(t('gm.coming'))}</span></button>`
    : `<button class="gm-tile rise" style="--i:${i}" data-go="${g}"><span class="ic" style="background:${FAMS.find(f => f.g === g).bg}">${ICONS[g]}</span><b>${esc(gname(g))}</b><span>${esc(sub)}</span></button>`;
  root.innerHTML = `<div class="gm">
    <div class="gm-title rise" style="--i:0"><span class="gm-sub">${esc(t('gm.tagline'))}</span><h1 class="serif">${esc(t('gm.menu'))}</h1></div>
    <div class="gm-hero rise" style="--i:1">${heroBoard()}
      <div class="gm-herotx">${eyebrow ? `<span class="gm-eyebrow">${esc(eyebrow)}</span>` : ''}
        <h3 class="serif">${esc(virtue)}</h3>${other && other !== virtue ? `<span class="gm-other" lang="${esc(C.packLang)}">${esc(other)}</span>` : ''}
        ${vk && !vk.today && vk.date ? `<span class="gm-when">${esc(vk.date)}</span>` : ''}
        <button class="gm-pill gold" data-go="pp">${esc(t(vk?.today ? 'gm.playTonight' : 'gm.play'))}</button></div></div>
    <p class="gm-sub gm-vigil">${esc(t('gm.vigil'))}</p>
    <div class="gm-sec rise" style="--i:2"><div class="gm-sech"><span class="gm-h serif">${esc(t('gm.fromTradition'))}</span><span class="gm-sub">${esc(C.cultureName)}</span></div>
      <div class="gm-hs">${tile('pl', t('gm.fam.pit'), 3)}${tile('ap', t('gm.fam.hunt'), 4)}${tile('pp', t('gm.fam.virtue'), 5)}${tile('race', '', 6)}</div></div>
    <div class="gm-fam"><span class="gm-h serif rise" style="--i:6">${esc(t('gm.families'))}</span>
      ${FAMS.map((f, i) => `<button class="gm-fcard rise" style="--i:${7 + i}" ${f.go ? `data-go="${f.g}"` : 'aria-disabled="true" disabled'}>
        <span class="ic" style="background:${f.bg}">${ICONS[f.g]}</span>
        <span class="gm-tx"><span class="nm serif">${esc(t(f.fam))}</span><span class="rg">${esc(f.names.map(n => t('gm.g.' + n)).join(' · '))}</span></span>
        ${f.go ? `<span class="go" style="${f.go}">${esc(t('gm.play'))}</span>` : `<span class="soon">${esc(t('gm.coming'))}</span>`}</button>`).join('')}</div>
    <p class="gm-note">${esc(t('gm.noStakes'))}</p></div>`;
  root.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
}

// ---------------------------------------------------------------- Paramapadam
const CELL = 30, PCOL = ['var(--maroon)', 'var(--indigo)', 'var(--green)', 'var(--gold-ink)'], OFF = [[-5, -4], [5, 4], [5, -4], [-5, 4]];
/* ppHumans 1 means you against the computer (two tokens, the second the computer's); 2 to 4 pass the phone round. */
let pp = null, ppHumans = 2, ppBusy = false;
const ppSolo = () => ppHumans === 1;
const ppCount = () => ppSolo() ? 2 : ppHumans;
const nm = p => ppSolo() ? t(p ? 'gm.computer' : 'gm.you') : t('gm.player', p + 1);
const isComputer = p => ppSolo() && p === 1;
function sqXY(n) { if (n === 0) return null; const r = Math.floor((n - 1) / 10), c = (r % 2 === 0) ? (n - 1) % 10 : 9 - (n - 1) % 10; return [c * CELL + CELL / 2, (9 - r) * CELL + CELL / 2]; }
function drawPP(svg) {
  svg.innerHTML = '';
  for (let n = 1; n <= 100; n++) { const r = Math.floor((n - 1) / 10), c = (r % 2 === 0) ? (n - 1) % 10 : 9 - (n - 1) % 10;
    el('rect', { x: c * CELL, y: (9 - r) * CELL, width: CELL, height: CELL, class: (r + c) % 2 ? 'pp-sq-b' : 'pp-sq-a' }, svg);
    el('text', { x: c * CELL + 3, y: (9 - r) * CELL + 9, class: 'pp-num' }, svg).textContent = n; }
  const top = sqXY(100), g = el('g', {}, svg);
  el('rect', { x: top[0] - 15, y: top[1] - 15, width: 30, height: 30, fill: 'var(--gold-bright)' }, g);
  const vt = el('text', { x: top[0], y: top[1] + 8, 'text-anchor': 'middle', 'font-family': 'ui-serif, Georgia, serif', 'font-size': '5.4', 'font-weight': '700', fill: '#11113E' }, g);
  vt.textContent = t('gm.pp.vaikuntha'); if (vt.textContent.length > 10) { vt.setAttribute('textLength', '27'); vt.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
  el('path', { d: 'M' + top[0] + ' ' + (top[1] - 7) + ' c3 3 3 6 0 8 c-3 -2 -3 -5 0 -8z M' + (top[0] - 6) + ' ' + (top[1] - 1) + ' c3 0 5 1 6 2 c-3 1 -5 0 -6 -2z M' + (top[0] + 6) + ' ' + (top[1] - 1) + ' c-3 0 -5 1 -6 2 c3 1 5 0 6 -2z', fill: '#7A2335' }, g);
  el('rect', { x: 0, y: 0, width: 300, height: 300, fill: 'none', stroke: 'var(--gold-ink)', 'stroke-width': '1.2' }, svg);
  const label = (x, y, txt, bg, fg) => { const w = txt.length * 4.1 + 8; x = Math.max(w / 2 + 2, Math.min(300 - w / 2 - 2, x)); const gg = el('g', {}, svg);
    el('rect', { x: x - w / 2, y: y - 6, width: w, height: 11, rx: 5.5, fill: bg, stroke: fg, 'stroke-width': '.6' }, gg);
    el('text', { x, y: y + 2.4, 'text-anchor': 'middle', class: 'pp-lab', fill: fg }, gg).textContent = txt; };
  // ladders
  Object.keys(Rules.LADDERS).forEach(k => {
    const a = sqXY(+k), b = sqXY(Rules.LADDERS[k][0]), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), px = -dy / L * 5, py = dx / L * 5;
    const gg = el('g', { stroke: 'var(--ladder)', 'stroke-width': '1.8', 'stroke-linecap': 'round', fill: 'none' }, svg);
    el('line', { x1: a[0] + px, y1: a[1] + py, x2: b[0] + px, y2: b[1] + py }, gg); el('line', { x1: a[0] - px, y1: a[1] - py, x2: b[0] - px, y2: b[1] - py }, gg);
    for (let s = 8; s < L - 4; s += 9) { const x = a[0] + dx * s / L, y = a[1] + dy * s / L; el('line', { x1: x + px, y1: y + py, x2: x - px, y2: y - py, 'stroke-width': '1.3' }, gg); }
    label(a[0] + dx * .5, a[1] + dy * .5, vName(Rules.LADDERS[k][1]), 'var(--gold-soft)', 'var(--gold-ink)');
  });
  // snakes: gentle wave from head to tail
  Object.keys(Rules.SNAKES).forEach(k => {
    const a = sqXY(+k), b = sqXY(Rules.SNAKES[k][0]), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
    const waves = Math.max(1.5, L / 45); let d = '';
    for (let i = 0; i <= 40; i++) { const f = i / 40, o = Math.sin(f * Math.PI * 2 * waves) * 6 * (1 - f * .5); d += (i ? 'L' : 'M') + (a[0] + dx * f + nx * o).toFixed(1) + ' ' + (a[1] + dy * f + ny * o).toFixed(1); }
    el('path', { d, stroke: 'var(--snake)', 'stroke-width': '4.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none', opacity: '.9' }, svg);
    el('circle', { cx: a[0], cy: a[1], r: '4.6', fill: 'var(--snake)' }, svg);
    el('circle', { cx: a[0] - 1.6, cy: a[1] - 1, r: '.9', fill: 'var(--paper)' }, svg); el('circle', { cx: a[0] + 1.6, cy: a[1] - 1, r: '.9', fill: 'var(--paper)' }, svg);
    label(a[0] + dx * .42, a[1] + dy * .42, vName(Rules.SNAKES[k][1]), 'var(--indigo-soft)', 'var(--snake)');
  });
  // start strip
  el('rect', { x: 0, y: 304, width: 300, height: 20, rx: 6, fill: 'var(--paper-2)' }, svg);
  el('text', { x: 90, y: 317, class: 'pp-num', 'font-size': '8' }, svg).textContent = t('gm.pp.start');
  // tokens
  for (let p = 0; p < 4; p++) { const tg = el('g', { class: 'tok', id: 'gm-tok' + p }, svg);
    el('circle', { r: '6.5', fill: PCOL[p], stroke: 'var(--paper)', 'stroke-width': '1.6' }, tg);
    el('text', { y: '2.6', 'text-anchor': 'middle', 'font-size': '7', 'font-weight': '700', fill: '#FFFFFF' }, tg).textContent = p + 1; }
}
function placeTok(p, n, slide) {
  const g = $('tok' + p), xy = n === 0 ? [16 + p * 18, 314] : sqXY(n), off = n === 0 ? [0, 0] : OFF[p];
  g.classList.toggle('slide', !!slide);
  g.style.transform = 'translate(' + (xy[0] + off[0]) + 'px,' + (xy[1] + off[1]) + 'px)';
}
const cowrieSVG = up => '<svg class="cowrie" viewBox="0 0 26 20" aria-hidden="true"><ellipse cx="13" cy="10" rx="11" ry="8" fill="var(--paper-2)" stroke="var(--gold-ink)" stroke-width="1"/>' +
  (up ? '<path d="M5 10 Q13 7.6 21 10 Q13 12.4 5 10z" fill="var(--wood-deep)"/><path d="M8 9.3v1.4M10.5 8.8v2.4M13 8.7v2.6M15.5 8.8v2.4M18 9.3v1.4" stroke="var(--paper)" stroke-width=".7"/>'
    : '<ellipse cx="13" cy="8.4" rx="6" ry="3.4" fill="var(--gold-soft)"/><circle cx="10" cy="7.6" r=".8" fill="var(--gold-ink)"/><circle cx="15" cy="9.2" r=".7" fill="var(--gold-ink)"/>') + '</svg>';
const showCowries = shells => { $('cowries').innerHTML = shells.map(cowrieSVG).join(''); };
function ppLegend() {
  let h = '';
  Object.keys(Rules.LADDERS).forEach(k => { h += `<span>${tb('gm.pp.lifts', vName(Rules.LADDERS[k][1]), +k, Rules.LADDERS[k][0])}</span>`; });
  Object.keys(Rules.SNAKES).forEach(k => { h += `<span>${tb('gm.pp.takes', vName(Rules.SNAKES[k][1]), +k, Rules.SNAKES[k][0])}</span>`; });
  $('legend').innerHTML = h;
}
function ppStatus() {
  const who = pp.winner !== null ? pp.winner : pp.turn;
  const line = pp.winner !== null ? t('gm.pp.reached', nm(who)) : isComputer(who) ? t('gm.pp.computerThrowing') : ppSolo() ? t('gm.pp.yourThrow') : t('gm.pp.toThrow', nm(who));
  $('who').innerHTML = `<span class="gm-dot" style="background:${PCOL[who]}"></span><span>${esc(line)}</span>`;
  $('pos').innerHTML = pp.pos.map((n, p) => `<span><span class="gm-dot" style="background:${PCOL[p]}"></span>${esc(n || t('gm.pp.start'))}</span>`).join('');
  $('throw').disabled = ppBusy || pp.winner !== null || isComputer(pp.turn);
  $('throw').textContent = isComputer(pp.turn) && pp.winner === null ? t('gm.pp.computerThrow') : t('gm.pp.throw');
}
function ppBanner(cls, html) { const b = $('banner'); b.className = 'gm-banner' + (cls ? ' ' + cls : ''); b.innerHTML = html; }
function ppReset() {
  pp = Rules.ppNew(ppCount()); ppBusy = false;
  for (let p = 0; p < 4; p++) { $('tok' + p).style.display = p < ppCount() ? '' : 'none'; placeTok(p, 0); }
  showCowries([true, false, true, false, false, true]); $('n').textContent = '';
  ppBanner('', esc(t('gm.pp.intro'))); ppStatus();
}
async function ppThrow(my) {
  if (ppBusy || pp.winner !== null) return; ppBusy = true; ppStatus();
  const who = pp.turn, c = Rules.throwCowries(Math.random), cw = $('cowries');
  $('n').textContent = ''; cw.classList.remove('tumble'); void cw.offsetWidth; cw.classList.add('tumble');
  await wait(T(350)); if (!alive(my)) return; showCowries(c.shells); await wait(T(380)); if (!alive(my)) return; cw.classList.remove('tumble');
  $('n').textContent = c.move;
  const res = Rules.ppApply(pp, c.move), m = res.move;
  if (m.overshoot) ppBanner('', esc(t('gm.pp.needExact', nm(who), 100 - pp.pos[who])));
  else {
    ppBanner('', esc(t('gm.pp.moved', nm(who), c.move) + (c.up === 0 ? ' ' + t('gm.pp.noneUp') : '')));
    for (let i = 0; i < m.path.length; i++) { placeTok(who, m.path[i]); await wait(T(170)); if (!alive(my)) return; }
    if (m.jump) {
      const n = vName(m.jump.name);
      if (m.jump.kind === 'virtue') ppBanner('virtue', `<b>${esc(n)}</b> ${esc(t('gm.pp.ladder', lower(n), m.landed, m.jump.to))}`);
      else ppBanner('vice', `<b>${esc(n)}</b> ${esc(t('gm.pp.snake', lower(n), m.landed, m.jump.to))}`);
      await wait(T(380)); if (!alive(my)) return; placeTok(who, m.jump.to, true); await wait(T(680)); if (!alive(my)) return;
    }
  }
  pp = res.state;
  if (pp.winner !== null) ppBanner('win', esc(t('gm.pp.reached', nm(who))));
  ppBusy = false; ppStatus();
  // The computer throws on its own turn, after a breath.
  if (pp.winner === null && isComputer(pp.turn)) { await wait(T(900)); if (alive(my) && isComputer(pp.turn) && !ppBusy) ppThrow(my); }
}
function ppScreen() {
  const my = run;
  root.innerHTML = `<div class="gm">${head('pp', 'gm.fam.virtue')}
    ${seg('mode', [[1, t('gm.vsComputer')], [2, t('gm.nPlayers', 2)], [3, '3'], [4, '4']], ppHumans)}
    <div class="gm-status"><div class="gm-who" id="gm-who"></div><div class="gm-pos" id="gm-pos"></div></div>
    <div class="gm-boardwrap"><svg id="gm-board" viewBox="0 0 300 324" role="img" aria-label="${esc(gname('pp'))}"></svg></div>
    <div class="gm-banner" id="gm-banner" aria-live="polite"></div>
    <div class="gm-btns"><button class="gm-pill clay" id="gm-throw"></button><div class="cowries" id="gm-cowries" aria-hidden="true"></div><span class="gm-throwN" id="gm-n"></span></div>
    <div class="gm-legend" id="gm-legend"></div>
    ${how('pp', 5)}<button class="gm-pill ghost" id="gm-new">${esc(t('gm.newGame'))}</button></div>`;
  wireBack();
  drawPP($('board')); ppLegend();
  // A game left in the middle of a throw starts again; one left between throws carries on.
  if (!pp || ppBusy || pp.pos.length !== ppCount()) ppReset();
  else {
    for (let p = 0; p < 4; p++) { $('tok' + p).style.display = p < ppCount() ? '' : 'none'; placeTok(p, pp.pos[p] || 0); }
    showCowries([true, false, true, false, false, true]); ppBanner(pp.winner !== null ? 'win' : '', esc(pp.winner !== null ? t('gm.pp.reached', nm(pp.winner)) : t('gm.pp.intro'))); ppStatus();
    if (pp.winner === null && isComputer(pp.turn)) wait(T(900)).then(() => { if (alive(my) && !ppBusy) ppThrow(my); });
  }
  $('throw').onclick = () => { if (!isComputer(pp.turn)) ppThrow(my); };
  root.querySelectorAll('#gm-mode button').forEach(b => b.onclick = () => {
    if (ppBusy) return;
    ppHumans = +b.dataset.n;
    root.querySelectorAll('#gm-mode button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    ppReset();
  });
  $('new').onclick = () => { if (!ppBusy) ppReset(); };
}

// ---------------------------------------------------------------- Pallanguzhi
/* A person sows by hand, one tap a seed, along the moves the rules already worked out; the computer sows by itself. */
let pl = null, plDisp = null, plBusy = false, plHumans = 1, plWant = null, plAutoRest = false;
const plSoloMode = () => plHumans === 1;
const plHuman = side => !(plSoloMode() && side === 1);
const plName = side => plSoloMode() ? t(side ? 'gm.computer' : 'gm.you') : t('gm.player', side + 1);
function seedPos(i) { const a = i * 2.39996, r = Math.sqrt(i + .6) * 5.4; return [30 + Math.cos(a) * r, 30 + Math.sin(a) * r, (i * 47) % 180]; }
function seedsSVG(n) { let s = '<svg viewBox="0 0 60 60" aria-hidden="true">'; const show = Math.min(n, 18);
  for (let i = 0; i < show; i++) { const p = seedPos(i); s += '<g transform="translate(' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ') rotate(' + p[2] + ')"><ellipse rx="5.2" ry="3.6" fill="var(--seed)"/><ellipse cx="-1.3" cy="-1" rx="2" ry="1.1" fill="var(--seed-hi)" opacity=".75"/></g>'; }
  return s + '</svg>'; }
const pit = i => $('pit' + i);
function plBuild() {
  const btn = i => `<button class="pit" id="gm-pit${i}"></button>`;
  $('top').innerHTML = [...Array(7)].map((_, c) => btn(13 - c)).join('');
  $('bot').innerHTML = [...Array(7)].map((_, c) => btn(c)).join('');
  for (let i = 0; i < 14; i++) pit(i).onclick = () => plTap(i);
}
const plCanStart = i => !plBusy && !pl.over && plHuman(pl.turn) && Rules.plSide(i) === pl.turn && pl.pits[i] > 0;
function plRender() {
  for (let i = 0; i < 14; i++) { const b = pit(i), want = plWant && plWant.pit === i;
    b.innerHTML = seedsSVG(plDisp.pits[i]) + '<span class="n">' + plDisp.pits[i] + '</span>';
    b.classList.toggle('next', !!want);
    b.classList.toggle('mine', !plWant && plCanStart(i));
    b.disabled = plWant ? !want : !plCanStart(i);
    b.setAttribute('aria-label', `${plName(Rules.plSide(i))} ${i < 7 ? i + 1 : 14 - i}: ${plDisp.pits[i]}`); }
  $('s0').textContent = plDisp.store[0]; $('s1').textContent = plDisp.store[1];
  $('n0').textContent = t('gm.pl.gathered', plName(0)); $('n1').textContent = t('gm.pl.gathered', plName(1));
  $('strip0').classList.toggle('turn', !pl.over && pl.turn === 0);
  $('strip1').classList.toggle('turn', !pl.over && pl.turn === 1);
}
function plHand(n) { $('hand').innerHTML = n > 0 ? seedsSVG(Math.min(n, 6)) + `<span>${esc(t('gm.pl.inHand', n))}</span>` : ''; }
function plBanner(cls, html) { const b = $('banner'); b.className = 'gm-banner' + (cls ? ' ' + cls : ''); b.innerHTML = html; }
/* Wait for the player to tap pit `i`, unless they asked to have the rest sown for them. */
function plAsk(i, ms) {
  if (plAutoRest) return wait(T(ms));
  return new Promise(res => { plWant = { pit: i, done: res }; plRender(); });
}
function plTap(i) {
  if (plWant) { if (plWant.pit === i) { const d = plWant.done; plWant = null; d(); } return; }
  if (plCanStart(i)) plTurn(i, run);
}
const unhot = () => root.querySelectorAll('.pit.hot').forEach(x => x.classList.remove('hot'));
async function plAnimate(my, who, events, final, manual) {
  const name = plName(who); let hand = 0, first = true;
  for (const e of events) {
    if (!alive(my)) return false;
    unhot();
    if (e.t === 'pick') {
      if (manual && !first) { plBanner('', esc(t('gm.pl.pickNext', e.n))); await plAsk(e.pit, 420); if (!alive(my)) return false; }
      plDisp.pits[e.pit] = 0; hand = e.n; plHand(hand); pit(e.pit).classList.add('hot');
      plRender(); if (!manual) await wait(T(420)); first = false; }
    else if (e.t === 'drop') {
      if (manual) { plBanner('', esc(t('gm.pl.drop', hand))); await plAsk(e.pit, 150); if (!alive(my)) return false; }
      plDisp.pits[e.pit]++; hand--; plHand(hand); pit(e.pit).classList.add('hot'); plRender(); if (!manual) await wait(T(170)); }
    else if (e.t === 'pasu') { plDisp.pits[e.pit] = 0; plDisp.store[who] += 4; pit(e.pit).classList.add('took'); plBanner('virtue', esc(t('gm.pl.pasu', name))); plRender(); await wait(T(750)); if (!alive(my)) return false; pit(e.pit).classList.remove('took'); }
    else if (e.t === 'capture') { pit(e.empty).classList.add('hot');
      if (manual && e.n) { plBanner('virtue', esc(t('gm.pl.takeTap', e.n))); await plAsk(e.pit, 500); if (!alive(my)) return false; }
      pit(e.pit).classList.add('took');
      plBanner(e.n ? 'virtue' : '', esc(e.n ? t('gm.pl.took', name, e.n) : t('gm.pl.tookNone')));
      plDisp.store[who] += e.n; plDisp.pits[e.pit] = 0; plRender(); await wait(T(800)); if (!alive(my)) return false; pit(e.pit).classList.remove('took'); }
    else if (e.t === 'rest') await wait(T(500));
  }
  unhot(); plHand(0); plDisp = { pits: final.pits.slice(), store: final.store.slice() };
  return true;
}
function plEndText() { const s = pl.store;
  if (pl.winner === -1) return t('gm.pl.even', s[0]);
  return t('gm.pl.over', plName(pl.winner), s[pl.winner], s[1 - pl.winner]); }
function plPrompt() {
  if (pl.over) plBanner('win', esc((pl.quiet >= 12 ? t('gm.pl.quiet') + ' ' : '') + plEndText()));
  else plBanner('', esc(t('gm.pl.turn', plName(pl.turn))));
}
async function plTurn(i, my) {
  plBusy = true; plAutoRest = false; $('auto').hidden = false; plRender();
  const r = Rules.plMove(pl, i);
  if (!await plAnimate(my, pl.turn, r.events, r.state, true)) return; pl = r.state;
  $('auto').hidden = true; plRender();
  while (!pl.over && !plHuman(pl.turn)) {
    plBanner('', esc(t('gm.pl.choosing'))); await wait(T(700)); if (!alive(my)) return;
    const m = Rules.plAI(pl, Math.random), r2 = Rules.plMove(pl, m);
    if (!await plAnimate(my, 1, r2.events, r2.state, false)) return; pl = r2.state; plRender();
  }
  plBusy = false; plPrompt(); plRender();
}
function plReset() { pl = Rules.plNew(); plDisp = { pits: pl.pits.slice(), store: pl.store.slice() }; plBusy = false; plWant = null; plHand(0); $('auto').hidden = true; plPrompt(); plRender(); }
function plScreen() {
  root.innerHTML = `<div class="gm">${head('pl', 'gm.fam.pit')}
    ${seg('mode', [[1, t('gm.vsComputer')], [2, t('gm.nPlayers', 2)]], plHumans)}
    <div class="gm-banner" id="gm-banner" aria-live="polite"></div>
    <div class="pl-board">
      <div class="pl-strip" id="gm-strip1"><span id="gm-n1"></span><b id="gm-s1">0</b></div>
      <div class="pl-row" id="gm-top"></div><div class="pl-row" id="gm-bot"></div>
      <div class="pl-strip" id="gm-strip0"><span id="gm-n0"></span><b id="gm-s0">0</b></div></div>
    <div class="gm-btns"><div class="gm-hand" id="gm-hand"></div><button class="gm-pill ghost" id="gm-auto" hidden>${esc(t('gm.pl.sowForMe'))}</button></div>
    ${how('pl', 7)}<button class="gm-pill ghost" id="gm-new">${esc(t('gm.newGame'))}</button></div>`;
  wireBack(); plBuild();
  // A round left in the middle of a move starts again; one left between moves carries on.
  if (!pl || plBusy) plReset();
  else { plWant = null; plDisp = { pits: pl.pits.slice(), store: pl.store.slice() }; plHand(0); $('auto').hidden = true; plPrompt(); plRender(); }
  $('auto').onclick = () => { plAutoRest = true; $('auto').hidden = true; if (plWant) { const d = plWant.done; plWant = null; d(); } };
  $('new').onclick = () => { if (!plBusy) plReset(); };
  root.querySelectorAll('#gm-mode button').forEach(b => b.onclick = () => {
    if (plBusy) return;
    plHumans = +b.dataset.n;
    root.querySelectorAll('#gm-mode button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    plReset();
  });
}

// ---------------------------------------------------------------- Aadu Puli Aattam
const AC = Rules.apCoords(13.5, 62, 170, 26);
let ap = null, apSel = null, apBusy = false, apIds = {};
function drawAP(svg) {
  svg.innerHTML = '';
  Rules.LINES.forEach(L => { let d = ''; L.forEach((p, i) => { d += (i ? 'L' : 'M') + AC[p][0] + ' ' + AC[p][1]; }); el('path', { d, class: 'ap-line' }, svg); });
  for (let p = 0; p < Rules.AP_N; p++) el('circle', { cx: AC[p][0], cy: AC[p][1], r: '3.2', class: 'ap-pt' }, svg);
  el('g', { id: 'gm-targets' }, svg); el('g', { id: 'gm-pieces' }, svg);
  const hits = el('g', {}, svg);
  for (let p = 0; p < Rules.AP_N; p++) { const h = el('circle', { cx: AC[p][0], cy: AC[p][1], r: '15', class: 'ap-hit', tabindex: '0', role: 'button', 'aria-label': String(p + 1) }, hits);
    h.addEventListener('click', () => apTap(p)); h.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apTap(p); } }); }
}
function pieceEl(kind) {
  const g = el('g', { class: 'piece' }, $('pieces'));
  if (kind === 'T') { el('circle', { r: '11', class: 'rim', fill: 'var(--clay)', stroke: 'var(--wood-deep)', 'stroke-width': '1.4' }, g);
    el('path', { d: 'M-9 -4 q3 1 4 4 M9 -4 q-3 1 -4 4 M-3 -10 q1 3 0 5 M3 -10 q-1 3 0 5 M-8 5 q3 0 4 3 M8 5 q-3 0 -4 3', stroke: '#2B1A10', 'stroke-width': '1.6', 'stroke-linecap': 'round', fill: 'none' }, g);
    el('circle', { cx: '-3', cy: '0', r: '1.1', fill: '#2B1A10' }, g); el('circle', { cx: '3', cy: '0', r: '1.1', fill: '#2B1A10' }, g); el('ellipse', { cx: '0', cy: '3.4', rx: '1.6', ry: '1.1', fill: '#2B1A10' }, g); }
  else { el('circle', { r: '9.5', class: 'rim', fill: 'var(--paper)', stroke: 'var(--green)', 'stroke-width': '1.6' }, g);
    el('path', { d: 'M-4 -3 q-3 -4 -6 -2 M4 -3 q3 -4 6 -2', stroke: 'var(--green)', 'stroke-width': '1.4', fill: 'none', 'stroke-linecap': 'round' }, g);
    el('circle', { cx: '-2.4', cy: '0', r: '1', fill: 'var(--green)' }, g); el('circle', { cx: '2.4', cy: '0', r: '1', fill: 'var(--green)' }, g); }
  return g;
}
const movePiece = (g, p) => { g.style.transform = 'translate(' + AC[p][0] + 'px,' + AC[p][1] + 'px)'; };
function apBanner(cls, html) { const b = $('banner'); b.className = 'gm-banner' + (cls ? ' ' + cls : ''); b.innerHTML = html; }
// The pieces drawn where the board has them (on a new game, or coming back to one).
function apPieces() {
  $('pieces').innerHTML = ''; apIds = {};
  for (let p = 0; p < Rules.AP_N; p++) if (ap.board[p]) { const g = pieceEl(ap.board[p]); movePiece(g, p); apIds[p] = g; }
}
function apReset(my) { ap = Rules.apNew(); apSel = null; apBusy = false; apPieces(); apBanner('', esc(t('gm.ap.tigersFirst'))); apUI(); apComputer(my); }
function apUI() {
  $('placed').textContent = ap.placed; $('taken').textContent = ap.captured; $('free').textContent = Rules.apFreeTigers(ap);
  const tg = $('targets'); tg.innerHTML = '';
  root.querySelectorAll('.piece.sel').forEach(x => x.classList.remove('sel'));
  if (apSel !== null && apIds[apSel]) { apIds[apSel].classList.add('sel');
    Rules.apLegal(ap).forEach(m => { if (m.from === apSel) el('circle', { cx: AC[m.to][0], cy: AC[m.to][1], r: '6', class: 'ap-target' }, tg); }); }
  if (ap.over === 'goats') apBanner('win', esc(t('gm.ap.goatsWin')));
  else if (ap.over === 'tigers') apBanner('win', esc(t(ap.captured >= Rules.AP_WIN_CAPTURES ? 'gm.ap.tigersWin' : 'gm.ap.tigersBlock')));
  else if (ap.over === 'draw') apBanner('', esc(t('gm.ap.draw')));
}
function apDo(m) {
  if (m.from === undefined) { const g = pieceEl('G'); movePiece(g, m.to); apIds[m.to] = g; }
  else { const pc = apIds[m.from]; delete apIds[m.from]; apIds[m.to] = pc; movePiece(pc, m.to);
    if (m.cap !== undefined) { const v = apIds[m.cap]; delete apIds[m.cap]; v.classList.add('gone'); setTimeout(() => v.remove(), 400); } }
  ap = Rules.apApply(ap, m);
}
const goatPrompt = () => t(ap.placed < Rules.AP_GOATS ? 'gm.ap.place' : 'gm.ap.move');
async function apComputer(my) {
  if (ap.over || ap.turn !== 'T') return;
  apBusy = true; await wait(T(550));
  if (!alive(my)) { apBusy = false; return; }
  const m = Rules.apTigerAI(ap, Math.random); apDo(m);
  apBusy = false;
  if (!ap.over) apBanner(m.cap !== undefined ? 'vice' : '', esc(t(m.cap !== undefined ? 'gm.ap.tigerTook' : 'gm.ap.tigerMoved') + ' ' + goatPrompt()));
  apUI();
}
function apTap(p) {
  if (apBusy || ap.over || ap.turn !== 'G') return;
  const legal = Rules.apLegal(ap), my = run;
  if (ap.placed < Rules.AP_GOATS) {
    if (ap.board[p] !== null) { apBanner('', esc(t('gm.ap.pointTaken'))); return; }
    apDo({ to: p }); apUI(); apComputer(my); return;
  }
  if (ap.board[p] === 'G') { apSel = (apSel === p) ? null : p;
    if (apSel !== null && !legal.some(m => m.from === p)) { apBanner('', esc(t('gm.ap.noFree'))); apSel = null; }
    apUI(); return; }
  if (apSel !== null && ap.board[p] === null) {
    const mv = legal.filter(m => m.from === apSel && m.to === p)[0];
    if (mv) { apSel = null; apDo(mv); apUI(); apComputer(my); }
    else apBanner('', esc(t('gm.ap.oneStep')));
  }
}
function apScreen() {
  const my = run;
  root.innerHTML = `<div class="gm">${head('ap', 'gm.fam.hunt')}
    <div class="gm-counter"><span>${esc(t('gm.ap.placed'))} <b id="gm-placed">0</b>/15</span><span>${esc(t('gm.ap.taken'))} <b id="gm-taken">0</b>/6</span><span>${esc(t('gm.ap.free'))} <b id="gm-free">3</b></span></div>
    <div class="gm-boardwrap" style="background:var(--gold-soft)"><svg id="gm-board" viewBox="0 0 340 290" role="img" aria-label="${esc(gname('ap'))}"></svg></div>
    <div class="gm-banner" id="gm-banner" aria-live="polite"></div>
    ${how('ap', 5)}<button class="gm-pill ghost" id="gm-new">${esc(t('gm.newGame'))}</button></div>`;
  wireBack(); drawAP($('board'));
  // A game is kept between visits; a tiger caught mid-move moves again.
  if (!ap) apReset(my);
  else { apSel = null; apBusy = false; apPieces(); apBanner('', esc(ap.turn === 'T' ? t('gm.ap.tigersFirst') : goatPrompt())); apUI(); apComputer(my); }
  $('new').onclick = () => { if (!apBusy) apReset(run); };
}
