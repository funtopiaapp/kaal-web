// Games: the board games families play on festival nights, as in the approved prototype
// (design/games/games-prototype.html). The virtue board (Paramapadam), the pit game (Pallanguzhi), the
// hunt game (Aadu Puli Aattam), the square race (Ashta Chamma), the line of three (Navakankari) and Bagh Chal,
// each under the user's tradition's own name. Free, with no stakes of any kind.
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
  // Level 1 sows a random pit four times in five, level 2 nearly half the time; level 3 always weighs its gain against the best reply.
  function plAI(s, rng, level){
    var moves=plLegal(s), best=null, bestScore=-1e9, me=s.turn;
    if((level||3)<3 && rng()<(level===1?0.8:0.45)) return moves[Math.floor(rng()*moves.length)];
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
  // Level 1 takes a goat only half the times it could, level 2 always, both otherwise moving at random; level 3 looks ahead.
  function apTigerAI(s, rng, level){
    var moves=apLegal(s), best=null, bs=-1e9;
    if((level||3)<3){
      var caps=moves.filter(function(m){ return m.cap!==undefined; });
      if(caps.length && (level===2 || rng()<0.5)) return caps[Math.floor(rng()*caps.length)];
      return moves[Math.floor(rng()*moves.length)];
    }
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

  /* ---------- Ashta Chamma (5x5 square race) ---------- */
  // Seat 0 sits at the bottom. Its path: home (bottom middle), anticlockwise round the outer ring, up into the inner ring,
  // clockwise round it, then the centre (index 24). Other seats turn the board a quarter at a time: bottom, right, top, left.
  var AC_PATH=[[4,2],[4,3],[4,4],[3,4],[2,4],[1,4],[0,4],[0,3],[0,2],[0,1],[0,0],[1,0],[2,0],[3,0],[4,0],[4,1],
               [3,1],[2,1],[1,1],[1,2],[1,3],[2,3],[3,3],[3,2],[2,2]];
  var AC_END=24, AC_OUTER=16, AC_PIECES=4, AC_EXTRA_CAP=3, AC_TURN_CAP=4000;
  var AC_SEATS={2:[0,2],3:[0,1,2],4:[0,1,2,3]};
  var AC_SAFE=[22,14,2,10,12]; // cell keys r*5+c: the four homes and the centre
  var AC_P={1:4/16,2:6/16,3:4/16,4:1/16,8:1/16};
  function acCell(seat, i){ var rc=AC_PATH[i], r=rc[0], c=rc[1]; for(var k=0;k<seat;k++){ var t=r; r=4-c; c=t; } return [r,c]; }
  function acKey(seat, i){ var rc=acCell(seat,i); return rc[0]*5+rc[1]; }
  function acSafe(key){ return AC_SAFE.indexOf(key)>=0; }
  // Four cowries: 1-3 mouths up move that many; all four up move 4, none up move 8, and both throw again.
  function acThrow(rng){ var shells=[], up=0; for(var i=0;i<4;i++){ var u=rng()<0.5; shells.push(u); if(u) up++; }
    var move = up===0 ? 8 : up; return {shells:shells, up:up, move:move, again: up===0 || up===4}; }
  function acNew(n){ n=n||2; var pos=[], cap=[]; for(var i=0;i<n;i++){ pos.push([0,0,0,0]); cap.push(false); }
    return {n:n, seats:AC_SEATS[n].slice(), pos:pos, cap:cap, turn:0, bonus:0, winner:null, throws:0, over:false}; }
  // Where a piece at index `from` lands with `roll`, or -1. Before its first capture a piece keeps circling the outer ring.
  function acDest(s, p, from, roll){
    if(from===AC_END) return -1;
    var to=from+roll;
    if(from<AC_OUTER && to>=AC_OUTER && !s.cap[p]) return to%AC_OUTER;
    return to>AC_END ? -1 : to;
  }
  function acPath(s, p, from, roll){ var out=[], circ = from<AC_OUTER && from+roll>=AC_OUTER && !s.cap[p];
    for(var i=1;i<=roll;i++) out.push(circ ? (from+i)%AC_OUTER : from+i); return out; }
  function acVictims(s, p, key){ var v=[]; if(acSafe(key)) return v;
    for(var q=0;q<s.n;q++) if(q!==p) for(var k=0;k<AC_PIECES;k++){ var i=s.pos[q][k]; if(i!==AC_END && acKey(s.seats[q],i)===key) v.push([q,k]); }
    return v; }
  function acLegal(s, roll){
    var out=[], p=s.turn, seen={};
    if(s.over) return out;
    for(var k=0;k<AC_PIECES;k++){ var from=s.pos[p][k]; if(seen[from]) continue; seen[from]=1;
      var to=acDest(s,p,from,roll); if(to<0) continue;
      out.push({piece:k, from:from, to:to, path:acPath(s,p,from,roll), caps:acVictims(s,p,acKey(s.seats[p],to))}); }
    return out;
  }
  // Apply a throw: `piece` is the piece index to move, or null when no move is legal (the throw passes).
  function acApply(s, roll, piece){
    if(s.over) throw new Error('game over');
    var L=acLegal(s,roll), p=s.turn, mv=null;
    if(piece===null || piece===undefined){ if(L.length) throw new Error('a move is possible'); }
    else { var from=s.pos[p][piece]; mv=L.filter(function(m){ return m.from===from; })[0]; if(!mv) throw new Error('illegal ashta chamma move'); mv={piece:piece, from:mv.from, to:mv.to, path:mv.path, caps:mv.caps}; }
    var pos=s.pos.map(function(a){ return a.slice(); }), cap=s.cap.slice(), again=false;
    if(mv){
      pos[p][piece]=mv.to;
      mv.caps.forEach(function(v){ pos[v[0]][v[1]]=0; });
      if(mv.caps.length) cap[p]=true;
      again = roll===4 || roll===8 || mv.caps.length>0;
    }
    var won = pos[p].every(function(i){ return i===AC_END; });
    var ns={n:s.n, seats:s.seats, pos:pos, cap:cap, turn:p, bonus:0, winner:null, throws:s.throws+1, over:false};
    var extra=false;
    if(won){ ns.winner=p; ns.over=true; }
    else if(again && s.bonus<AC_EXTRA_CAP){ ns.bonus=s.bonus+1; extra=true; }
    else { ns.turn=(p+1)%s.n; }
    if(!ns.over && ns.throws>=AC_TURN_CAP){ ns.over=true; ns.winner=-1; }
    return {state:ns, move:mv, extra:extra};
  }
  // Chance that some opponent piece lands on `key` with its next throw (a 4 or 8 also brings one more throw).
  function acDanger(s, p, key, skip){
    if(acSafe(key)) return 0;
    var d=0, rolls=[1,2,3,4,8];
    for(var q=0;q<s.n;q++) if(q!==p) for(var k=0;k<AC_PIECES;k++){ var i=s.pos[q][k]; if(i===AC_END) continue;
      if(skip && skip[q+','+k]) continue;
      var hit=0;
      rolls.forEach(function(r1){ var t=acDest(s,q,i,r1); if(t>=0 && acKey(s.seats[q],t)===key) hit+=AC_P[r1];
        if(r1===4||r1===8) rolls.forEach(function(r2){ var t2 = t>=0 ? acDest(s,q,t,r2) : -1; if(t2>=0 && acKey(s.seats[q],t2)===key) hit+=AC_P[r1]*AC_P[r2]; }); });
      d+=Math.min(hit,1); }
    return d;
  }
  // Chance that this piece, standing at `idx`, takes an opponent with its next throw.
  function acThreat(s, p, idx){
    var t=0; [1,2,3,4,8].forEach(function(r){ var to=acDest(s,p,idx,r); if(to>=0 && acVictims(s,p,acKey(s.seats[p],to)).length) t+=AC_P[r]; });
    return t;
  }
  // Level 1 moves at random. Level 2: a capture, then reaching the centre, then a safe square, else the piece furthest on.
  // Level 3 adds the risk of ending where an opponent can land next throw, and the chance of threatening one.
  function acAI(s, roll, rng, level){
    var L=acLegal(s,roll), p=s.turn; if(!L.length) return null;
    level=level||3;
    if(level===1) return L[Math.floor(rng()*L.length)].piece;
    var best=null, bs=-1e9, seat=s.seats[p];
    L.forEach(function(m){
      var key=acKey(seat,m.to), sc=0;
      if(m.caps.length) sc+=1000+50*m.caps.length;
      if(m.to===AC_END) sc+=500;
      else if(acSafe(key)) sc+=200;
      sc+=m.from;
      if(level>=3){
        var after=acApply(s,roll,m.piece).state, skip={};
        m.caps.forEach(function(v){ skip[v[0]+','+v[1]]=1; });
        var stack=s.pos[p].filter(function(i){ return i===m.to; }).length+1;
        if(m.to!==AC_END) sc-=420*acDanger(after,p,key)*stack;
        var here=s.pos[p].filter(function(i){ return i===m.from; }).length;
        if(m.from!==0) sc+=300*acDanger(s,p,acKey(seat,m.from))*(here===1?1:0.5);
        if(m.to!==AC_END) sc+=120*acThreat(after,p,m.to);
        if(m.to>=AC_OUTER && m.from<AC_OUTER) sc+=60;
        sc+=2*(m.to-m.from>0 ? m.to-m.from : 0);
      }
      sc+=rng()*0.5;
      if(sc>bs){ bs=sc; best=m.piece; }
    });
    return best;
  }

  /* ---------- Navakankari (nine men's morris) ---------- */
  // 24 points: ring r (0 outer, 1 middle, 2 inner), k 0..7 clockwise from the top-left corner; odd k are midpoints.
  var NM_N=24, NM_PIECES=9, NM_QUIET=50, NM_ADJ=[], NM_MILLS=[], NM_DIR=[[-1,-1],[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0]];
  (function(){
    for(var r=0;r<3;r++) for(var k=0;k<8;k++){ var a=[r*8+(k+1)%8, r*8+(k+7)%8]; if(k%2){ if(r>0) a.push((r-1)*8+k); if(r<2) a.push((r+1)*8+k); } NM_ADJ.push(a); }
    for(r=0;r<3;r++) for(k=0;k<8;k+=2) NM_MILLS.push([r*8+k, r*8+k+1, r*8+(k+2)%8]);
    for(k=1;k<8;k+=2) NM_MILLS.push([k, 8+k, 16+k]);
  })();
  function nmCoords(cx, cy, step){ var c=[]; for(var r=0;r<3;r++) for(var k=0;k<8;k++){ var h=(3-r)*step; c.push([cx+NM_DIR[k][0]*h, cy+NM_DIR[k][1]*h]); } return c; }
  function nmNew(){ var b=[]; for(var i=0;i<NM_N;i++) b.push(null); return {board:b, hand:[NM_PIECES,NM_PIECES], turn:0, plies:0, quiet:0, over:null}; }
  function nmOnBoard(b, p){ var n=0; for(var i=0;i<NM_N;i++) if(b[i]===p) n++; return n; }
  function nmCount(s, p){ return s.hand[p]+nmOnBoard(s.board,p); }
  function nmInMill(b, pt){ var p=b[pt]; if(p===null) return false;
    return NM_MILLS.some(function(M){ return M.indexOf(pt)>=0 && b[M[0]]===p && b[M[1]]===p && b[M[2]]===p; }); }
  function nmBase(s){
    var b=s.board, p=s.turn, out=[], i;
    if(s.hand[p]>0){ for(i=0;i<NM_N;i++) if(b[i]===null) out.push({to:i}); return out; }
    var fly=nmOnBoard(b,p)===3;
    for(i=0;i<NM_N;i++) if(b[i]===p){
      if(fly){ for(var j=0;j<NM_N;j++) if(b[j]===null) out.push({from:i,to:j}); }
      else NM_ADJ[i].forEach(function(j){ if(b[j]===null) out.push({from:i,to:j}); });
    }
    return out;
  }
  function nmLegal(s){
    if(s.over!==null) return [];
    var p=s.turn, o=1-p, out=[];
    nmBase(s).forEach(function(m){
      var b=s.board.slice(); if(m.from!==undefined) b[m.from]=null; b[m.to]=p;
      if(!nmInMill(b,m.to)){ out.push(m); return; }
      var opp=[], free=[]; for(var i=0;i<NM_N;i++) if(b[i]===o){ opp.push(i); if(!nmInMill(b,i)) free.push(i); }
      var can = free.length ? free : opp;
      if(!can.length){ out.push(m); return; }
      can.forEach(function(r){ var x={to:m.to, remove:r}; if(m.from!==undefined) x.from=m.from; out.push(x); });
    });
    return out;
  }
  function nmDo(s, m){
    var b=s.board.slice(), p=s.turn, hand=s.hand.slice();
    if(m.from===undefined) hand[p]--; else b[m.from]=null;
    b[m.to]=p; if(m.remove!==undefined) b[m.remove]=null;
    var ns={board:b, hand:hand, turn:1-p, plies:s.plies+1, quiet: m.remove!==undefined ? 0 : s.quiet+1, over:null};
    if(nmCount(ns,1-p)<3 || nmBase(ns).length===0) ns.over=p;
    else if(ns.quiet>=NM_QUIET) ns.over='draw';
    return ns;
  }
  function nmSame(a,b){ return a.to===b.to && a.from===b.from && a.remove===b.remove; }
  function nmApply(s, m){ if(!nmLegal(s).some(function(x){ return nmSame(x,m); })) throw new Error('illegal navakankari move '+JSON.stringify(m)); return nmDo(s,m); }
  function nmMakesMill(s, m){ var b=s.board.slice(); if(m.from!==undefined) b[m.from]=null; b[m.to]=s.turn; return nmInMill(b,m.to); }
  function nmOpenTwos(b, p){ var n=0, pts=[]; NM_MILLS.forEach(function(M){ var mine=0, e=-1; M.forEach(function(x){ if(b[x]===p) mine++; else if(b[x]===null) e=x; }); if(mine===2 && e>=0){ n++; pts.push(e); } }); return {n:n, pts:pts}; }
  function nmMills(b, p){ var n=0; NM_MILLS.forEach(function(M){ if(b[M[0]]===p && b[M[1]]===p && b[M[2]]===p) n++; }); return n; }
  function nmMobility(s, p){ var b=s.board, n=0; if(s.hand[p]>0) return 4; if(nmOnBoard(b,p)===3) return 6;
    for(var i=0;i<NM_N;i++) if(b[i]===p) NM_ADJ[i].forEach(function(j){ if(b[j]===null) n++; }); return n; }
  function nmEval(s, me){
    if(s.over===me) return 1e5; if(s.over===1-me) return -1e5; if(s.over==='draw') return 0;
    var o=1-me, b=s.board;
    return 100*(nmCount(s,me)-nmCount(s,o)) + 8*(nmMills(b,me)-nmMills(b,o)) + 6*(nmOpenTwos(b,me).n-nmOpenTwos(b,o).n) + (nmMobility(s,me)-nmMobility(s,o));
  }
  // Level 1 plays at random but takes a mill half the time it can. Level 2 always closes a mill, else blocks one, else random.
  // Level 3 looks two plies ahead: its move, then the reply that is worst for it.
  function nmAI(s, rng, level){
    var L=nmLegal(s), me=s.turn; if(!L.length) return null;
    level=level||3;
    var pick=function(a){ return a[Math.floor(rng()*a.length)]; };
    var mills=L.filter(function(m){ return m.remove!==undefined || nmMakesMill(s,m); });
    if(level===1) return (mills.length && rng()<0.5) ? pick(mills) : pick(L);
    if(level===2){
      if(mills.length){ var open=nmOpenTwos(s.board,1-me), hot=[];
        mills.forEach(function(m){ var c=open.pts.length && m.remove!==undefined && NM_MILLS.some(function(M){ return M.indexOf(m.remove)>=0 && open.pts.some(function(e){ return M.indexOf(e)>=0; }); }); if(c) hot.push(m); });
        return pick(hot.length ? hot : mills); }
      var threat=nmOpenTwos(s.board,1-me).pts, block=L.filter(function(m){ return threat.indexOf(m.to)>=0; });
      return pick(block.length ? block : L);
    }
    var best=null, bs=-1e9;
    L.forEach(function(m){
      var ns=nmDo(s,m), worst;
      if(ns.over!==null) worst=nmEval(ns,me);
      else { worst=1e9; nmLegal(ns).forEach(function(r){ var v=nmEval(nmDo(ns,r),me); if(v<worst) worst=v; }); }
      worst+=rng()*0.8;
      if(worst>bs){ bs=worst; best=m; }
    });
    return best;
  }

  /* ---------- Bagh Chal (5x5 grid, 4 tigers, 20 goats) ---------- */
  var BC_N=25, BC_GOATS=20, BC_WIN_CAPTURES=5, BC_MOVE_CAP=200, BC_ADJ=[], BC_JUMPS=[];
  (function(){
    for(var a=0;a<BC_N;a++){ var r=Math.floor(a/5), c=a%5, adj=[], jp=[];
      [[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(function(d){
        if(d[0]&&d[1]&&(r+c)%2) return;
        var r1=r+d[0], c1=c+d[1], r2=r+2*d[0], c2=c+2*d[1];
        if(r1<0||r1>4||c1<0||c1>4) return; adj.push(r1*5+c1);
        if(r2>=0&&r2<=4&&c2>=0&&c2<=4) jp.push([r1*5+c1, r2*5+c2]); });
      BC_ADJ.push(adj); BC_JUMPS.push(jp); }
  })();
  function bcNew(){ var b=[]; for(var i=0;i<BC_N;i++) b.push(null); b[0]=b[4]=b[20]=b[24]='T';
    return {board:b, placed:0, captured:0, turn:'G', plies:0, over:null}; }
  function bcLegal(s){
    var out=[], b=s.board, a, g;
    if(s.over) return out;
    if(s.turn==='T'){
      for(a=0;a<BC_N;a++) if(b[a]==='T'){
        BC_ADJ[a].forEach(function(n){ if(b[n]===null) out.push({from:a,to:n}); });
        BC_JUMPS[a].forEach(function(j){ if(b[j[0]]==='G' && b[j[1]]===null) out.push({from:a,to:j[1],cap:j[0]}); });
      }
    } else if(s.placed<BC_GOATS){ for(a=0;a<BC_N;a++) if(b[a]===null) out.push({to:a}); }
    else { for(g=0;g<BC_N;g++) if(b[g]==='G') BC_ADJ[g].forEach(function(n){ if(b[n]===null) out.push({from:g,to:n}); }); }
    return out;
  }
  function bcDo(s, m){
    var b=s.board.slice(), placed=s.placed, captured=s.captured;
    if(m.from===undefined){ b[m.to]='G'; placed++; }
    else { b[m.to]=b[m.from]; b[m.from]=null; if(m.cap!==undefined){ b[m.cap]=null; captured++; } }
    var ns={board:b, placed:placed, captured:captured, turn: s.turn==='T'?'G':'T', plies:s.plies+1, over:null};
    if(captured>=BC_WIN_CAPTURES) ns.over='tigers';
    else if(bcLegal(ns).length===0) ns.over = ns.turn==='T' ? 'goats' : 'tigers';
    else if(ns.plies>=BC_MOVE_CAP) ns.over='draw';
    return ns;
  }
  function bcSame(m,n){ return m.to===n.to && m.from===n.from && m.cap===n.cap; }
  function bcApply(s, m){ if(!bcLegal(s).some(function(x){ return bcSame(x,m); })) throw new Error('illegal bagh chal move '+JSON.stringify(m)); return bcDo(s,m); }
  function bcTigerMobility(b){ var n=0; for(var a=0;a<BC_N;a++) if(b[a]==='T'){ BC_ADJ[a].forEach(function(x){ if(b[x]===null) n++; }); BC_JUMPS[a].forEach(function(j){ if(b[j[0]]==='G'&&b[j[1]]===null) n+=3; }); } return n; }
  function bcCaptures(b){ var n=0; for(var a=0;a<BC_N;a++) if(b[a]==='T') BC_JUMPS[a].forEach(function(j){ if(b[j[0]]==='G'&&b[j[1]]===null) n++; }); return n; }
  function bcTigerMoves(b){ var n=0; for(var a=0;a<BC_N;a++) if(b[a]==='T'){ BC_ADJ[a].forEach(function(x){ if(b[x]===null) n++; }); BC_JUMPS[a].forEach(function(j){ if(b[j[0]]==='G'&&b[j[1]]===null) n++; }); } return n; }
  // Tigers, as in Aadu Puli: level 1 takes a goat half the times it can, level 2 always, both otherwise at random; level 3 looks at the goats' reply.
  function bcTigerAI(s, rng, level){
    var moves=bcLegal(s), best=null, bs=-1e9;
    if((level||3)<3){
      var caps=moves.filter(function(m){ return m.cap!==undefined; });
      if(caps.length && (level===2 || rng()<0.5)) return caps[Math.floor(rng()*caps.length)];
      return moves[Math.floor(rng()*moves.length)];
    }
    moves.forEach(function(m){
      var ns=bcDo(s,m), sc=0;
      if(m.cap!==undefined) sc+=20;
      if(ns.over==='tigers') sc+=1000; if(ns.over==='goats') sc-=1000;
      if(!ns.over){ var worst=1e9; bcLegal(ns).forEach(function(g){ var g2=bcDo(ns,g); var v= g2.over==='goats'?-500 : bcTigerMobility(g2.board); if(v<worst) worst=v; }); sc+=worst; }
      sc+=rng()*1.5;
      if(sc>bs){ bs=sc; best=m; }
    });
    return best;
  }
  // Goats: level 1 at random; level 2 never leaves a goat to be jumped if it can help it; level 3 also hems the tigers in,
  // counting every tiger reply.
  function bcGoatAI(s, rng, level){
    var L=bcLegal(s); if(!L.length) return null;
    level=level||3;
    if(level===1) return L[Math.floor(rng()*L.length)];
    var best=null, bs=-1e9;
    L.forEach(function(m){
      var ns=bcDo(s,m), sc;
      if(ns.over==='goats') sc=1e6;
      else {
        sc=-1000*bcCaptures(ns.board);
        if(level>=3 && !ns.over){
          sc-=4*bcTigerMoves(ns.board);
          var worst=0; bcLegal(ns).forEach(function(r){ var t2=bcDo(ns,r); var v = r.cap!==undefined ? 0 : bcCaptures(t2.board); if(v>worst) worst=v; });
          sc-=30*worst;
          if(m.from===undefined){ var rr=Math.floor(m.to/5), cc=m.to%5; if(rr===0||rr===4||cc===0||cc===4) sc+=3; }
        }
      }
      sc+=rng()*0.5;
      if(sc>bs){ bs=sc; best=m; }
    });
    return best;
  }
  function bcFreeTigers(s){ var b=s.board,n=0; for(var a=0;a<BC_N;a++) if(b[a]==='T'){ var can=BC_ADJ[a].some(function(x){return b[x]===null;}) || BC_JUMPS[a].some(function(j){return b[j[0]]==='G'&&b[j[1]]===null;}); if(can) n++; } return n; }

  return {LADDERS:LADDERS, SNAKES:SNAKES, throwCowries:throwCowries, ppMove:ppMove, ppNew:ppNew, ppApply:ppApply,
    plNew:plNew, plSide:plSide, plLegal:plLegal, plMove:plMove, plAI:plAI,
    AP_N:AP_N, ADJ:ADJ, JUMPS:JUMPS, LINES:LINES, apCoords:apCoords, apNew:apNew, apLegal:apLegal, apApply:apApply, apTigerAI:apTigerAI, apFreeTigers:apFreeTigers,
    AP_GOATS:AP_GOATS, AP_WIN_CAPTURES:AP_WIN_CAPTURES,
    AC_PATH:AC_PATH, AC_END:AC_END, AC_OUTER:AC_OUTER, AC_PIECES:AC_PIECES, AC_SEATS:AC_SEATS, AC_SAFE:AC_SAFE, acCell:acCell, acKey:acKey, acSafe:acSafe, acThrow:acThrow, acNew:acNew, acDest:acDest, acLegal:acLegal, acApply:acApply, acAI:acAI,
    NM_N:NM_N, NM_PIECES:NM_PIECES, NM_ADJ:NM_ADJ, NM_MILLS:NM_MILLS, nmCoords:nmCoords, nmNew:nmNew, nmCount:nmCount, nmOnBoard:nmOnBoard, nmInMill:nmInMill, nmLegal:nmLegal, nmApply:nmApply, nmMakesMill:nmMakesMill, nmAI:nmAI,
    BC_N:BC_N, BC_GOATS:BC_GOATS, BC_WIN_CAPTURES:BC_WIN_CAPTURES, BC_ADJ:BC_ADJ, BC_JUMPS:BC_JUMPS, bcNew:bcNew, bcLegal:bcLegal, bcApply:bcApply, bcTigerAI:bcTigerAI, bcGoatAI:bcGoatAI, bcFreeTigers:bcFreeTigers};
})();

// ---------------------------------------------------------------- names by tradition
const TAMILS = ['tamil', 'sri-lankan-tamil', 'malaysian-tamil', 'south-african-tamil'];
// The string key of each game's name in a tradition (pack culture id).
export function gameKey(game, c) {
  const south = TAMILS.includes(c) || c === 'malayalam';
  if (game === 'pp') return 'gm.g.' + (south || c === 'kannada' ? 'paramapadam' : c === 'telugu' ? 'vaikunthapali' : c === 'marathi' ? 'mokshaPatam' : 'gyanChaupar');
  if (game === 'pl') return 'gm.g.' + (c === 'kannada' ? 'aliGuliMane' : c === 'telugu' ? 'vamanaGuntalu' : 'pallanguzhi');
  if (game === 'ap') return 'gm.g.' + (c === 'kannada' ? 'huliGatta' : c === 'telugu' ? 'puliMeka' : 'aaduPuli');
  if (game === 'nm') return 'gm.g.navakankari';
  if (game === 'bc') return 'gm.g.baghChal';
  // 'ac', the square race
  return 'gm.g.' + (TAMILS.includes(c) ? 'dayakattam' : c === 'kannada' ? 'chowkaBara' : c === 'malayalam' ? 'thayam' : 'ashtaChamma');
}
// Vaikuntha Ekadashi under its names in the packs, whose night the virtue board is played.
export const VIGIL = /vaikunt|mukkoti|swargavathil/;

// ---------------------------------------------------------------- the screen
// GM.screen: null (the games home), 'pp', 'pl', 'ap', 'ac', 'nm' or 'bc'. The modes and the games in play are kept while the app is open.
export const GM = { screen: null };
let C = null, root = null, run = 0;
const SVGNS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, parent) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
const $ = id => root.querySelector('#gm-' + id);
const wait = ms => new Promise(r => setTimeout(r, ms));
// Animations off (html.still: the setting, or a lower-end device) is the same as the browser asking for less motion.
const still = () => document.documentElement.classList.contains('still') || matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  if (GM.screen === 'ac') return acScreen();
  if (GM.screen === 'nm') return nmScreen();
  if (GM.screen === 'bc') return bcScreen();
  return homeScreen();
}
function go(screen) { GM.screen = screen; showGames(root, C); scrollTo(0, 0); }

const ICONS = {
  pl: '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><rect x="3" y="11" width="34" height="18" rx="9" fill="var(--wood)"/><g fill="var(--pit)"><circle cx="10" cy="16" r="2.6"/><circle cx="16.7" cy="16" r="2.6"/><circle cx="23.3" cy="16" r="2.6"/><circle cx="30" cy="16" r="2.6"/><circle cx="10" cy="24" r="2.6"/><circle cx="16.7" cy="24" r="2.6"/><circle cx="23.3" cy="24" r="2.6"/><circle cx="30" cy="24" r="2.6"/></g><g fill="var(--seed-hi)"><ellipse cx="16.7" cy="24" rx="1.2" ry=".8"/><ellipse cx="30" cy="16" rx="1.2" ry=".8"/></g></svg>',
  ap: '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><g fill="none" stroke="var(--green)" stroke-width="1.4" stroke-linecap="round"><path d="M20 5 L5 35 M20 5 L35 35 M20 5 L15 35 M20 5 L25 35 M5 35 H35 M7 17 H33 M5 25 H35 M7 17 V25 M33 17 V25"/></g><circle cx="20" cy="5" r="2.6" fill="var(--clay)"/><circle cx="17.5" cy="25" r="2.2" fill="var(--paper)" stroke="var(--green)" stroke-width="1"/><circle cx="25" cy="17" r="2.2" fill="var(--paper)" stroke="var(--green)" stroke-width="1"/></svg>',
  ac: '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><rect x="5" y="5" width="30" height="30" fill="var(--sq-a)" stroke="var(--maroon)" stroke-width="1.2"/><path d="M11 5v30M17 5v30M23 5v30M29 5v30M5 11h30M5 17h30M5 23h30M5 29h30" stroke="var(--maroon)" stroke-width=".7" opacity=".55"/><path d="M17 17l6 6M23 17l-6 6M17 29l6 6M23 29l-6 6M17 5l6 6M23 5l-6 6M5 17l6 6M11 17l-6 6M29 17l6 6M35 17l-6 6" stroke="var(--maroon)" stroke-width="1"/><circle cx="26" cy="32" r="2.3" fill="var(--maroon)"/><circle cx="14" cy="8" r="2.3" fill="var(--green)"/></svg>',
  nm: '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><g fill="none" stroke="var(--ink)" stroke-width="1.3" opacity=".8"><rect x="5" y="5" width="30" height="30"/><rect x="11" y="11" width="18" height="18"/><rect x="16.5" y="16.5" width="7" height="7"/><path d="M20 5v11.5M20 23.5V35M5 20h11.5M23.5 20H35"/></g><circle cx="5" cy="5" r="2.7" fill="var(--maroon)"/><circle cx="20" cy="5" r="2.7" fill="var(--maroon)"/><circle cx="35" cy="5" r="2.7" fill="var(--maroon)"/><circle cx="29" cy="29" r="2.5" fill="var(--paper)" stroke="var(--green)" stroke-width="1.4"/><circle cx="11" cy="20" r="2.5" fill="var(--paper)" stroke="var(--green)" stroke-width="1.4"/></svg>',
  bc: '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><path d="M6 6h28M6 13h28M6 20h28M6 27h28M6 34h28M6 6v28M13 6v28M20 6v28M27 6v28M34 6v28M6 6L34 34M34 6L6 34M20 6L34 20L20 34L6 20Z" fill="none" stroke="var(--green)" stroke-width="1.1" stroke-linecap="round"/><circle cx="6" cy="6" r="3" fill="var(--clay)"/><circle cx="34" cy="6" r="3" fill="var(--clay)"/><circle cx="6" cy="34" r="3" fill="var(--clay)"/><circle cx="34" cy="34" r="3" fill="var(--clay)"/><circle cx="20" cy="20" r="2.4" fill="var(--paper)" stroke="var(--green)" stroke-width="1.1"/><circle cx="13" cy="27" r="2.4" fill="var(--paper)" stroke="var(--green)" stroke-width="1.1"/></svg>',
  pp: '<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><rect x="5" y="5" width="30" height="30" fill="var(--sq-a)" stroke="var(--gold-ink)" stroke-width="1"/><path d="M5 12.5h30M5 20h30M5 27.5h30M12.5 5v30M20 5v30M27.5 5v30" stroke="var(--gold-ink)" stroke-width=".5" opacity=".5"/><path d="M11 32 L20 10 M15 33 L24 11" stroke="var(--ladder)" stroke-width="1.4"/><path d="M13 27l4 1.6 M15 22l4 1.6 M17 17l4 1.6" stroke="var(--ladder)" stroke-width="1.2"/><path d="M31 9 c-6 4 3 8 -3 13 s3 7 -3 11" stroke="var(--snake)" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>',
};
const FAMS = [
  { g: 'pl', fam: 'gm.fam.pit', bg: 'var(--clay-soft)', go: 'background:var(--clay);color:var(--on-dark)', names: ['pallanguzhi', 'aliGuliMane', 'vamanaGuntalu'] },
  { g: 'ap', fam: 'gm.fam.hunt', bg: 'var(--green-soft)', go: 'background:var(--green);color:var(--paper)', names: ['aaduPuli', 'huliGatta', 'puliMeka', 'baghBandi'] },
  // Bagh Chal, the square board of the same hunt, sits under it.
  { g: 'bc', sub: true, title: 'gm.g.baghChal', line: 'gm.bc.card', bg: 'var(--green-soft)', go: 'background:var(--green);color:var(--paper)' },
  { g: 'ac', fam: 'gm.fam.race', bg: 'var(--maroon-soft)', go: 'background:var(--maroon);color:var(--paper)', names: ['ashtaChamma', 'chowkaBara', 'thayam', 'dayakattam'] },
  { g: 'nm', fam: 'gm.fam.mill', bg: 'var(--indigo-soft)', go: 'background:var(--ink);color:var(--paper)', names: ['navakankari', 'nineMen'] },
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
const how = (pre, n, more) => `<details class="gm-how"><summary>${esc(t('gm.howTo'))}</summary><ul>${[...Array(n)].map((_, i) => `<li>${esc(t(`gm.${pre}.how${i + 1}`))}</li>`).join('')}${more ? `<li>${esc(t(more))}</li>` : ''}</ul></details>`;
// How strongly the computer plays each game, 1 to 3, kept in this browser.
function level(g) { try { return +localStorage.getItem('kaal.gmLevel.' + g) || 1; } catch { return 1; } }
function setLevel(g, n) { try { localStorage.setItem('kaal.gmLevel.' + g, n); } catch {} }
const levelSeg = (g, hidden) => `<div class="gm-level" id="gm-levelbox"${hidden ? ' hidden' : ''}><span class="gm-sub">${esc(t('gm.level'))}</span>
  ${seg('level', [1, 2, 3].map(n => [n, `${n} · ${t('gm.lv.' + n)}`]), level(g))}</div>`;
// Choosing a level starts the game again at that level.
function wireLevel(g, busy, reset) {
  root.querySelectorAll('#gm-level button').forEach(b => b.onclick = () => {
    if (busy()) return;
    setLevel(g, +b.dataset.n);
    root.querySelectorAll('#gm-level button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    reset();
  });
}
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
  const tile = (g, sub, i) => `<button class="gm-tile rise" style="--i:${i}" data-go="${g}"><span class="ic" style="background:${FAMS.find(f => f.g === g).bg}">${ICONS[g]}</span><b>${esc(gname(g))}</b><span>${esc(sub)}</span></button>`;
  root.innerHTML = `<div class="gm">
    <div class="gm-title rise" style="--i:0"><span class="gm-sub">${esc(t('gm.tagline'))}</span><h1 class="serif">${esc(t('gm.menu'))}</h1></div>
    <div class="gm-hero rise" style="--i:1">${heroBoard()}
      <div class="gm-herotx">${eyebrow ? `<span class="gm-eyebrow">${esc(eyebrow)}</span>` : ''}
        <h3 class="serif">${esc(virtue)}</h3>${other && other !== virtue ? `<span class="gm-other" lang="${esc(C.packLang)}">${esc(other)}</span>` : ''}
        ${vk && !vk.today && vk.date ? `<span class="gm-when">${esc(vk.date)}</span>` : ''}
        <button class="gm-pill gold" data-go="pp">${esc(t(vk?.today ? 'gm.playTonight' : 'gm.play'))}</button></div></div>
    <p class="gm-sub gm-vigil">${esc(t('gm.vigil'))}</p>
    <div class="gm-sec rise" style="--i:2"><div class="gm-sech"><span class="gm-h serif">${esc(t('gm.fromTradition'))}</span><span class="gm-sub">${esc(C.cultureName)}</span></div>
      <div class="gm-hs">${tile('pl', t('gm.fam.pit'), 3)}${C.culture === 'nepali' ? tile('bc', t('gm.fam.hunt'), 4) : tile('ap', t('gm.fam.hunt'), 4)}${tile('pp', t('gm.fam.virtue'), 5)}${tile('ac', t('gm.fam.race'), 6)}</div></div>
    <div class="gm-fam"><span class="gm-h serif rise" style="--i:6">${esc(t('gm.families'))}</span>
      ${FAMS.map((f, i) => `<button class="gm-fcard${f.sub ? ' sub' : ''} rise" style="--i:${7 + i}" data-go="${f.g}">
        <span class="ic" style="background:${f.bg}">${ICONS[f.g]}</span>
        <span class="gm-tx"><span class="nm serif">${esc(t(f.title || f.fam))}</span><span class="rg">${esc(f.line ? t(f.line) : f.names.map(n => t('gm.g.' + n)).join(' · '))}</span></span>
        <span class="go" style="${f.go}">${esc(t('gm.play'))}</span></button>`).join('')}</div>
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
    const m = Rules.plAI(pl, Math.random, level('pl')), r2 = Rules.plMove(pl, m);
    if (!await plAnimate(my, 1, r2.events, r2.state, false)) return; pl = r2.state; plRender();
  }
  plBusy = false; plPrompt(); plRender();
}
function plReset() { pl = Rules.plNew(); plDisp = { pits: pl.pits.slice(), store: pl.store.slice() }; plBusy = false; plWant = null; plHand(0); $('auto').hidden = true; plPrompt(); plRender(); }
function plScreen() {
  root.innerHTML = `<div class="gm">${head('pl', 'gm.fam.pit')}
    ${seg('mode', [[1, t('gm.vsComputer')], [2, t('gm.nPlayers', 2)]], plHumans)}
    ${levelSeg('pl', plHumans !== 1)}
    <div class="gm-banner" id="gm-banner" aria-live="polite"></div>
    <div class="pl-board">
      <div class="pl-strip" id="gm-strip1"><span id="gm-n1"></span><b id="gm-s1">0</b></div>
      <div class="pl-row" id="gm-top"></div><div class="pl-row" id="gm-bot"></div>
      <div class="pl-strip" id="gm-strip0"><span id="gm-n0"></span><b id="gm-s0">0</b></div></div>
    <div class="gm-btns"><div class="gm-hand" id="gm-hand"></div><button class="gm-pill ghost" id="gm-auto" hidden>${esc(t('gm.pl.sowForMe'))}</button></div>
    ${how('pl', 7, 'gm.lvHow')}<button class="gm-pill ghost" id="gm-new">${esc(t('gm.newGame'))}</button></div>`;
  wireBack(); plBuild();
  // A round left in the middle of a move starts again; one left between moves carries on.
  if (!pl || plBusy) plReset();
  else { plWant = null; plDisp = { pits: pl.pits.slice(), store: pl.store.slice() }; plHand(0); $('auto').hidden = true; plPrompt(); plRender(); }
  $('auto').onclick = () => { plAutoRest = true; $('auto').hidden = true; if (plWant) { const d = plWant.done; plWant = null; d(); } };
  $('new').onclick = () => { if (!plBusy) plReset(); };
  wireLevel('pl', () => plBusy, plReset);
  root.querySelectorAll('#gm-mode button').forEach(b => b.onclick = () => {
    if (plBusy) return;
    plHumans = +b.dataset.n;
    root.querySelectorAll('#gm-mode button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    $('levelbox').hidden = plHumans !== 1;
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
function pieceEl(kind, parent) {
  const g = el('g', { class: 'piece' }, parent || $('pieces'));
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
  const m = Rules.apTigerAI(ap, Math.random, level('ap')); apDo(m);
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
    ${levelSeg('ap')}
    <div class="gm-counter"><span>${esc(t('gm.ap.placed'))} <b id="gm-placed">0</b>/15</span><span>${esc(t('gm.ap.taken'))} <b id="gm-taken">0</b>/6</span><span>${esc(t('gm.ap.free'))} <b id="gm-free">3</b></span></div>
    <div class="gm-boardwrap" style="background:var(--gold-soft)"><svg id="gm-board" viewBox="0 0 340 290" role="img" aria-label="${esc(gname('ap'))}"></svg></div>
    <div class="gm-banner" id="gm-banner" aria-live="polite"></div>
    ${how('ap', 5, 'gm.lvHow')}<button class="gm-pill ghost" id="gm-new">${esc(t('gm.newGame'))}</button></div>`;
  wireBack(); drawAP($('board'));
  // A game is kept between visits; a tiger caught mid-move moves again.
  if (!ap) apReset(my);
  else { apSel = null; apBusy = false; apPieces(); apBanner('', esc(ap.turn === 'T' ? t('gm.ap.tigersFirst') : goatPrompt())); apUI(); apComputer(my); }
  $('new').onclick = () => { if (!apBusy) apReset(run); };
  wireLevel('ap', () => apBusy, () => apReset(run));
}

// ---------------------------------------------------------------- Ashta Chamma
/* Seats go bottom, right, top, left; you sit at the bottom and the computer opposite. Each throw moves one piece. */
const AQ = 56, AO = 10, ACOL = ['var(--maroon)', 'var(--indigo-ink)', 'var(--green)', 'var(--gold-ink)'], OUTW = [[0, 1], [1, 0], [0, -1], [-1, 0]];
let acS = null, acDisp = null, acHumans = 1, acRoll = null, acMoves = null, acBusy = false, acGen = 0;
const acSolo = () => acHumans === 1;
const acCount = () => acSolo() ? 2 : acHumans;
const acName = p => acSolo() ? t(p ? 'gm.computer' : 'gm.you') : t('gm.player', p + 1);
const acIsComp = p => acSolo() && p === 1;
const acXY = key => [AO + (key % 5) * AQ + AQ / 2, AO + Math.floor(key / 5) * AQ + AQ / 2];
// A throw's work stops when a new game starts, or the screen goes.
const acOk = (my, gen) => alive(my) && gen === acGen;
function drawAC(svg) {
  svg.innerHTML = '';
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    const key = r * 5 + c, x = AO + c * AQ, y = AO + r * AQ, safe = Rules.acSafe(key), inner = r > 0 && r < 4 && c > 0 && c < 4;
    el('rect', { x, y, width: AQ, height: AQ, class: 'ac-sq' + (safe ? ' home' : inner ? ' in' : '') }, svg);
    if (safe) el('path', { d: `M${x + 5} ${y + 5}L${x + AQ - 5} ${y + AQ - 5}M${x + AQ - 5} ${y + 5}L${x + 5} ${y + AQ - 5}`, class: 'ac-x' }, svg);
  }
  el('rect', { x: AO + AQ, y: AO + AQ, width: 3 * AQ, height: 3 * AQ, fill: 'none', stroke: 'var(--maroon)', 'stroke-width': '2.6' }, svg);
  el('rect', { x: AO, y: AO, width: 5 * AQ, height: 5 * AQ, fill: 'none', stroke: 'var(--maroon)', 'stroke-width': '2.6' }, svg);
  el('g', { id: 'gm-acseats' }, svg); el('g', { id: 'gm-acmarks' }, svg); el('g', { id: 'gm-acpieces' }, svg);
  const hits = el('g', {}, svg);
  for (let k = 0; k < 25; k++) { const xy = acXY(k), h = el('rect', { x: xy[0] - AQ / 2, y: xy[1] - AQ / 2, width: AQ, height: AQ, class: 'ac-hit', id: 'gm-achit' + k, role: 'button', tabindex: '-1', 'aria-label': `${Math.floor(k / 5) + 1} · ${k % 5 + 1}` }, hits);
    h.addEventListener('click', () => acTap(k)); h.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); acTap(k); } }); }
}
function acBuild() {
  const pg = $('acpieces'), sg = $('acseats'); pg.innerHTML = ''; sg.innerHTML = '';
  for (let p = 0; p < acS.n; p++) {
    for (let k = 0; k < 4; k++) { const g = el('g', { class: 'acp', id: `gm-acp${p}-${k}` }, pg);
      el('circle', { r: '9', fill: ACOL[p], stroke: '#FFF8EC', 'stroke-width': '1.6' }, g);
      el('text', { y: '2.6', 'text-anchor': 'middle', 'font-size': '7', 'font-weight': '700', fill: '#FFFFFF' }, g).textContent = p + 1; }
    const seat = acS.seats[p], xy = acXY(Rules.acKey(seat, 0)), o = OUTW[seat], lx = xy[0] + o[0] * 22.5, ly = xy[1] + o[1] * 22.5 + (o[1] ? 2.6 : 0);
    el('text', { x: lx, y: ly, 'text-anchor': 'middle', class: 'ac-seat', fill: ACOL[p], transform: o[0] ? `rotate(${o[0] > 0 ? 90 : -90} ${lx} ${ly})` : '' }, sg).textContent = acName(p);
  }
}
// Pieces sharing a square sit side by side, smaller.
function acLayout(slide) {
  const groups = {};
  for (let p = 0; p < acS.n; p++) for (let k = 0; k < 4; k++) { const key = Rules.acKey(acS.seats[p], acDisp[p][k]); (groups[key] = groups[key] || []).push([p, k]); }
  Object.keys(groups).forEach(key => {
    const g = groups[key], n = g.length, cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols), sp = Math.min(20, 46 / cols), rad = Math.min(9, sp * 0.46), xy = acXY(+key);
    g.forEach((pk, i) => { const e = $(`acp${pk[0]}-${pk[1]}`), cx = xy[0] + ((i % cols) - (cols - 1) / 2) * sp, cy = xy[1] + (Math.floor(i / cols) - (rows - 1) / 2) * sp;
      e.classList.toggle('slide', !!(slide && slide[pk[0] + '-' + pk[1]]));
      e.style.transform = `translate(${cx.toFixed(1)}px,${cy.toFixed(1)}px) scale(${(rad / 9).toFixed(2)})`; });
  });
}
function acBanner(cls, txt) { const b = $('banner'); b.className = 'gm-banner' + (cls ? ' ' + cls : ''); b.textContent = txt; }
function acMarks() {
  const mg = $('acmarks'); mg.innerHTML = '';
  for (let k = 0; k < 25; k++) { const h = $('achit' + k); h.classList.remove('can'); h.setAttribute('tabindex', '-1'); }
  if (!acMoves) return;
  const seat = acS.seats[acS.turn];
  acMoves.forEach(m => { const a = Rules.acKey(seat, m.from), xa = acXY(a), xb = acXY(Rules.acKey(seat, m.to));
    el('rect', { x: xa[0] - AQ / 2 + 2.5, y: xa[1] - AQ / 2 + 2.5, width: AQ - 5, height: AQ - 5, rx: '6', class: 'ac-can' }, mg);
    el('circle', { cx: xb[0], cy: xb[1], r: '5.5', class: 'ac-dest' }, mg);
    const h = $('achit' + a); h.classList.add('can'); h.setAttribute('tabindex', '0'); });
}
const acThrowLine = p => acIsComp(p) ? t('gm.pp.computerThrowing') : acSolo() ? t('gm.pp.yourThrow') : t('gm.pp.toThrow', acName(p));
function acUI() {
  const who = acS.over && acS.winner >= 0 ? acS.winner : acS.turn;
  let line;
  if (acS.over) line = acS.winner >= 0 ? (acSolo() && who === 0 ? t('gm.youWin') : t('gm.wins', acName(who))) : t('gm.ac.draw');
  else if (!acIsComp(who) && (acMoves || (acBusy && acRoll !== null))) line = acSolo() ? t('gm.ac.yourMove') : t('gm.ac.toMove', acName(who));
  else line = acThrowLine(who);
  $('who').innerHTML = `<span class="gm-dot" style="background:${ACOL[who]}"></span><span>${esc(line)}</span>`;
  $('extra').textContent = !acS.over && acS.bonus > 0 ? t('gm.ac.extra', acS.bonus) : '';
  $('throw').disabled = acBusy || acS.over || acIsComp(acS.turn) || !!acMoves;
  $('throw').textContent = !acS.over && acIsComp(acS.turn) ? t('gm.pp.computerThrow') : t('gm.pp.throw');
  $('legend').innerHTML = acS.pos.map((pos, p) => `<span><b style="color:${ACOL[p]}">${esc(acName(p))}</b> ${esc(t('gm.ac.atCentre', pos.filter(i => i === Rules.AC_END).length))} · ${esc(t(acS.cap[p] ? 'gm.ac.innerOpen' : 'gm.ac.noCap'))}</span>`).join('');
}
function acStartText() { return t(acSolo() ? 'gm.ac.startSolo' : 'gm.ac.startMany'); }
function acEndText() { return acS.winner >= 0 ? t('gm.ac.won', acName(acS.winner)) : t('gm.ac.draw'); }
function acReset(my) {
  acGen++; acS = Rules.acNew(acCount()); acDisp = acS.pos.map(a => a.slice()); acRoll = null; acMoves = null; acBusy = false;
  acBuild(); acLayout(); acMarks(); showCowries([true, false, true, false]); $('n').textContent = '';
  acBanner('', acStartText()); acUI(); acNext(my);
}
// The computer throws on its own turn, after a breath.
function acNext(my) { if (!acS.over && acIsComp(acS.turn)) { const gen = acGen; wait(T(850)).then(() => { if (acOk(my, gen) && !acBusy && !acMoves) acThrow(my); }); } }
async function acThrow(my) {
  if (acBusy || acS.over || acMoves) return;
  const gen = acGen, p = acS.turn, c = Rules.acThrow(Math.random), cw = $('cowries');
  acBusy = true; acUI();
  $('n').textContent = ''; cw.classList.remove('tumble'); void cw.offsetWidth; cw.classList.add('tumble');
  await wait(T(350)); if (!acOk(my, gen)) return; showCowries(c.shells);
  await wait(T(380)); if (!acOk(my, gen)) return; cw.classList.remove('tumble');
  $('n').textContent = c.move; acRoll = c.move; acUI();
  const L = Rules.acLegal(acS, c.move), said = t('gm.ac.thrown', acName(p), c.move) + (c.up === 0 ? ' ' + t('gm.ac.noneUp') : c.up === 4 ? ' ' + t('gm.ac.allUp') : '');
  if (!L.length) { acBanner('', said + ' ' + t('gm.ac.pass')); await wait(T(1200)); if (!acOk(my, gen)) return; acFinish(my, Rules.acApply(acS, c.move, null), null); return; }
  if (acIsComp(p)) { acBanner('', said); await wait(T(450)); if (!acOk(my, gen)) return; acMove(my, Rules.acAI(acS, c.move, Math.random, level('ac'))); return; }
  if (L.length === 1) { acBanner('', said + ' ' + t('gm.ac.one')); await wait(T(550)); if (!acOk(my, gen)) return; acMove(my, L[0].piece); return; }
  acMoves = L; acBusy = false; acMarks();
  acBanner('', said + ' ' + t('gm.ac.tap')); acUI();
}
function acTap(key) {
  if (acBusy || !acMoves) return;
  const seat = acS.seats[acS.turn], m = acMoves.find(x => Rules.acKey(seat, x.from) === key);
  if (m) acMove(run, m.piece); else acBanner('', t('gm.ac.tapHint'));
}
async function acMove(my, piece) {
  const gen = acGen, p = acS.turn, roll = acRoll, before = acS, res = Rules.acApply(acS, roll, piece), m = res.move;
  acBusy = true; acMoves = null; acMarks(); acUI();
  const circ = m.from < Rules.AC_OUTER && m.from + roll >= Rules.AC_OUTER && !before.cap[p];
  for (let i = 0; i < m.path.length; i++) { acDisp[p][piece] = m.path[i]; acLayout(); await wait(T(170)); if (!acOk(my, gen)) return; }
  let msg = t('gm.ac.moved', acName(p), roll);
  if (m.to === Rules.AC_END) msg += ' ' + t('gm.ac.centre');
  else if (m.to >= Rules.AC_OUTER && m.from < Rules.AC_OUTER) msg += ' ' + t('gm.ac.inner');
  else if (circ) msg += ' ' + t('gm.ac.circle');
  if (m.caps.length) {
    msg += ' ' + t('gm.ac.sentHome');
    acBanner('vice', msg);
    await wait(T(380)); if (!acOk(my, gen)) return;
    const sl = {}; m.caps.forEach(v => { acDisp[v[0]][v[1]] = 0; sl[v[0] + '-' + v[1]] = 1; }); acLayout(sl);
    await wait(T(700)); if (!acOk(my, gen)) return;
  }
  acFinish(my, res, msg);
}
function acFinish(my, res, msg) {
  const p = acS.turn, roll = acRoll; acS = res.state; acDisp = acS.pos.map(a => a.slice()); acRoll = null; acBusy = false; acLayout();
  if (acS.over) acBanner('win', acEndText());
  else if (msg !== null) {
    const again = roll === 4 || roll === 8 || (res.move && res.move.caps.length);
    if (res.extra) msg += ' ' + (acSolo() && p === 0 ? t('gm.ac.again') : t('gm.ac.againOther', acName(p)));
    else if (again) msg += ' ' + t('gm.ac.capReached');
    acBanner(res.move && res.move.caps.length ? 'vice' : res.move && res.move.to === Rules.AC_END ? 'virtue' : '', msg);
  }
  acUI(); acNext(my);
}
function acScreen() {
  const my = run;
  root.innerHTML = `<div class="gm">${head('ac', 'gm.fam.race')}
    ${seg('mode', [[1, t('gm.vsComputer')], [2, t('gm.nPlayers', 2)], [3, '3'], [4, '4']], acHumans)}
    ${levelSeg('ac', !acSolo())}
    <div class="gm-status"><div class="gm-who" id="gm-who"></div><div class="gm-sub" id="gm-extra"></div></div>
    <div class="gm-boardwrap" style="background:var(--maroon-soft)"><svg id="gm-board" viewBox="0 0 300 300" role="img" aria-label="${esc(gname('ac'))}"></svg></div>
    <div class="gm-banner" id="gm-banner" aria-live="polite"></div>
    <div class="gm-btns"><button class="gm-pill clay" id="gm-throw"></button><div class="cowries" id="gm-cowries" aria-hidden="true"></div><span class="gm-throwN" id="gm-n"></span></div>
    <div class="gm-legend" id="gm-legend"></div>
    ${how('ac', 8, 'gm.lvHow')}<button class="gm-pill ghost" id="gm-new">${esc(t('gm.newGame'))}</button></div>`;
  wireBack(); drawAC($('board'));
  // A game is kept between visits. A throw caught half way is thrown again; one waiting for a tap still waits.
  if (!acS || acS.n !== acCount()) acReset(my);
  else {
    if (acBusy) { acBusy = false; acRoll = null; acMoves = null; }
    acDisp = acS.pos.map(a => a.slice()); acBuild(); acLayout(); acMarks(); showCowries([true, false, true, false]); $('n').textContent = acRoll ?? '';
    acBanner(acS.over ? 'win' : '', acS.over ? acEndText() : acMoves ? t('gm.ac.tap') : acS.throws ? acThrowLine(acS.turn) : acStartText());
    acUI(); acNext(my);
  }
  $('throw').onclick = () => { if (!acIsComp(acS.turn)) acThrow(run); };
  $('new').onclick = () => acReset(run);
  wireLevel('ac', () => false, () => acReset(run));
  root.querySelectorAll('#gm-mode button').forEach(b => b.onclick = () => {
    acHumans = +b.dataset.n;
    root.querySelectorAll('#gm-mode button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    $('levelbox').hidden = !acSolo();
    acReset(run);
  });
}

// ---------------------------------------------------------------- Navakankari
const NC = Rules.nmCoords(150, 150, 44);
let nmS = null, nmHumans = 1, nmSel = null, nmPend = null, nmBusy = false, nmGen = 0, nmIds = {};
const nmSolo = () => nmHumans === 1;
const nmHuman = p => !(nmSolo() && p === 1);
const nmName = p => nmSolo() ? t(p ? 'gm.computer' : 'gm.you') : t('gm.player', p + 1);
const nmOk = (my, gen) => alive(my) && gen === nmGen;
function drawNM(svg) {
  svg.innerHTML = '';
  for (let r = 0; r < 3; r++) { let d = ''; for (let k = 0; k < 8; k += 2) { const q = NC[r * 8 + k]; d += (k ? 'L' : 'M') + q[0] + ' ' + q[1]; } el('path', { d: d + 'Z', class: 'nm-line' }, svg); }
  for (let k = 1; k < 8; k += 2) { const a = NC[k], b = NC[16 + k]; el('path', { d: `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`, class: 'nm-line' }, svg); }
  el('g', { id: 'gm-nmmills' }, svg);
  for (let p = 0; p < Rules.NM_N; p++) el('circle', { cx: NC[p][0], cy: NC[p][1], r: '4.2', class: 'nm-pt' }, svg);
  el('g', { id: 'gm-nmtargets' }, svg); el('g', { id: 'gm-nmpieces' }, svg);
  const hits = el('g', {}, svg);
  for (let p = 0; p < Rules.NM_N; p++) { const h = el('circle', { cx: NC[p][0], cy: NC[p][1], r: '17', class: 'ap-hit', tabindex: '0', role: 'button', 'aria-label': String(p + 1) }, hits);
    h.addEventListener('click', () => nmTap(p)); h.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nmTap(p); } }); }
}
function nmPiece(p) {
  const g = el('g', { class: 'piece' }, $('nmpieces'));
  if (p === 0) { el('circle', { r: '11', class: 'rim', fill: 'var(--maroon)', stroke: '#FFF8EC', 'stroke-width': '1.6' }, g); el('circle', { r: '4.2', fill: 'none', stroke: '#FFF8EC', 'stroke-width': '1.3', opacity: '.85' }, g); }
  else { el('circle', { r: '11', class: 'rim', fill: 'var(--paper)', stroke: 'var(--green)', 'stroke-width': '3' }, g); el('circle', { r: '3.6', fill: 'var(--green)' }, g); }
  return g;
}
const nmPut = (g, p) => { g.style.transform = `translate(${NC[p][0]}px,${NC[p][1]}px)`; };
function nmPieces() {
  $('nmpieces').innerHTML = ''; $('nmmills').innerHTML = ''; nmIds = {};
  for (let p = 0; p < Rules.NM_N; p++) if (nmS.board[p] !== null) { const g = nmPiece(nmS.board[p]); nmPut(g, p); nmIds[p] = g; }
}
function nmBanner(cls, txt) { const b = $('banner'); b.className = 'gm-banner' + (cls ? ' ' + cls : ''); b.textContent = txt; }
const nmOptions = base => Rules.nmLegal(nmS).filter(m => m.to === base.to && m.from === base.from);
function nmUI() {
  let h = '';
  for (let p = 0; p < 2; p++) h += `<span><b style="color:${p ? 'var(--green)' : 'var(--maroon)'}">${esc(nmName(p))}</b> ${tb('gm.nm.toPlace', String(nmS.hand[p]))} · ${tb('gm.nm.onBoard', String(Rules.nmOnBoard(nmS.board, p)))}</span>`;
  if (nmS.hand[0] === 0 && nmS.hand[1] === 0) h += `<span>${tb('gm.nm.quiet', String(nmS.quiet))}</span>`;
  $('count').innerHTML = h;
  const tg = $('nmtargets'); tg.innerHTML = '';
  root.querySelectorAll('#gm-nmpieces .piece').forEach(x => x.classList.remove('sel', 'rm'));
  if (nmSel !== null && nmIds[nmSel]) { nmIds[nmSel].classList.add('sel'); const seen = {};
    Rules.nmLegal(nmS).forEach(m => { if (m.from === nmSel && !seen[m.to]) { seen[m.to] = 1; el('circle', { cx: NC[m.to][0], cy: NC[m.to][1], r: '6', class: 'ap-target' }, tg); } }); }
  if (nmPend) nmOptions(nmPend).forEach(m => { if (nmIds[m.remove]) nmIds[m.remove].classList.add('rm'); });
}
function nmShow(m) {
  if (m.from === undefined) { const g = nmPiece(nmS.turn); nmPut(g, m.to); nmIds[m.to] = g; }
  else { const pc = nmIds[m.from]; delete nmIds[m.from]; nmIds[m.to] = pc; nmPut(pc, m.to); }
}
// The new line of three lights up for a moment.
function nmFlash(m, p) {
  const b = nmS.board.slice(); if (m.from !== undefined) b[m.from] = null; b[m.to] = p; const mg = $('nmmills');
  Rules.NM_MILLS.forEach(M => { if (M.indexOf(m.to) >= 0 && M.every(x => b[x] === p)) {
    const a = NC[M[0]], c = NC[M[2]], line = el('path', { d: `M${a[0]} ${a[1]}L${c[0]} ${c[1]}`, class: 'nm-mill' }, mg);
    requestAnimationFrame(() => line.classList.add('on')); setTimeout(() => { line.classList.remove('on'); setTimeout(() => line.remove(), 350); }, T(1300)); } });
}
const nmGone = pt => { const v = nmIds[pt]; delete nmIds[pt]; if (v) { v.classList.remove('rm'); v.classList.add('gone'); setTimeout(() => v.remove(), 400); } };
const nmPhase = p => nmS.hand[p] > 0 ? 'place' : Rules.nmOnBoard(nmS.board, p) === 3 ? 'fly' : 'move';
function nmPrompt(prefix, cls) {
  prefix = prefix ? prefix + ' ' : '';
  if (nmS.over !== null) {
    if (nmS.over === 'draw') { nmBanner('win', prefix + t('gm.nm.draw')); return; }
    const w = nmS.over, why = t(Rules.nmCount(nmS, 1 - w) < 3 ? 'gm.nm.twoLeft' : 'gm.nm.noMove');
    nmBanner('win', prefix + (nmSolo() && w === 0 ? t('gm.youWin') : t('gm.wins', nmName(w))) + ' ' + why); return; }
  const p = nmS.turn, ph = nmPhase(p);
  if (!nmHuman(p)) { nmBanner(cls, prefix + t('gm.thinking')); return; }
  const who = nmSolo() ? t('gm.yourTurn') : t('gm.playerTurn', p + 1);
  nmBanner(cls, prefix + who + ' ' + t(ph === 'place' ? 'gm.nm.place' : ph === 'fly' ? 'gm.nm.fly' : 'gm.nm.move'));
}
function nmTap(pt) {
  if (nmBusy || nmS.over !== null || !nmHuman(nmS.turn)) return;
  const p = nmS.turn, L = Rules.nmLegal(nmS);
  if (nmPend) { const mv = nmOptions(nmPend).find(m => m.remove === pt);
    if (mv) nmCommit(run, mv); else nmBanner('virtue', t('gm.nm.mill')); return; }
  if (nmS.hand[p] > 0) { if (nmS.board[pt] !== null) { nmBanner('', t('gm.nm.pointTaken')); return; } nmTry({ to: pt }); return; }
  if (nmS.board[pt] === p) { nmSel = nmSel === pt ? null : pt;
    if (nmSel !== null && !L.some(m => m.from === pt)) { nmBanner('', t('gm.nm.noRoom')); nmSel = null; }
    nmUI(); return; }
  if (nmSel !== null && nmS.board[pt] === null) {
    if (L.some(m => m.from === nmSel && m.to === pt)) { const base = { from: nmSel, to: pt }; nmSel = null; nmTry(base); }
    else nmBanner('', t('gm.nm.alongLine'));
  }
}
// A move that makes a mill waits for the piece to take, unless only one can be taken.
function nmTry(base) {
  const opts = nmOptions(base), p = nmS.turn; nmShow(base);
  if (opts.length === 1) { if (opts[0].remove !== undefined) nmFlash(opts[0], p); nmCommit(run, opts[0]); return; }
  nmPend = base; nmFlash(base, p); nmUI();
  nmBanner('virtue', t('gm.nm.mill'));
}
async function nmCommit(my, m) {
  const gen = nmGen; nmPend = null; nmBusy = true;
  if (m.remove !== undefined) nmGone(m.remove);
  nmS = Rules.nmApply(nmS, m); nmUI();
  const said = m.remove !== undefined ? t('gm.nm.taken') : '';
  if (!nmHuman(nmS.turn) && nmS.over === null) { nmPrompt(said, ''); await wait(T(650)); if (!nmOk(my, gen)) return; nmComputer(my); return; }
  nmBusy = false; nmPrompt(said, ''); nmUI();
}
async function nmComputer(my) {
  const gen = nmGen, p = nmS.turn, m = Rules.nmAI(nmS, Math.random, level('nm'));
  nmBusy = true; nmShow(m);
  let said = t(m.from === undefined ? 'gm.nm.compPlaced' : 'gm.nm.compMoved');
  if (m.remove !== undefined) { nmFlash(m, p); nmBanner('vice', t('gm.nm.compMill')); await wait(T(900)); if (!nmOk(my, gen)) return;
    nmGone(m.remove); said = t('gm.nm.taken'); }
  nmS = Rules.nmApply(nmS, m); nmBusy = false; nmPrompt(said, m.remove !== undefined ? 'vice' : ''); nmUI();
}
function nmReset(my) {
  nmGen++; nmS = Rules.nmNew(); nmSel = null; nmPend = null; nmBusy = false; nmPieces();
  nmUI(); nmPrompt(t(nmSolo() ? 'gm.nm.youFirst' : 'gm.nm.p1First'), '');
}
function nmScreen() {
  const my = run;
  root.innerHTML = `<div class="gm">${head('nm', 'gm.fam.mill')}
    ${seg('mode', [[1, t('gm.vsComputer')], [2, t('gm.nPlayers', 2)]], nmHumans)}
    ${levelSeg('nm', !nmSolo())}
    <div class="gm-counter" id="gm-count"></div>
    <div class="gm-boardwrap" style="background:var(--gold-soft)"><svg id="gm-board" viewBox="0 0 300 300" role="img" aria-label="${esc(gname('nm'))}"></svg></div>
    <div class="gm-banner" id="gm-banner" aria-live="polite"></div>
    ${how('nm', 6, 'gm.lvHow')}<button class="gm-pill ghost" id="gm-new">${esc(t('gm.newGame'))}</button></div>`;
  wireBack(); drawNM($('board'));
  // A game is kept between visits; a move left half made is made again.
  if (!nmS) nmReset(my);
  else {
    nmGen++; nmBusy = false; nmSel = null; nmPend = null; nmPieces(); nmUI(); nmPrompt('', '');
    if (nmS.over === null && !nmHuman(nmS.turn)) { const gen = nmGen; nmBusy = true; wait(T(650)).then(() => { if (nmOk(my, gen)) nmComputer(my); }); }
  }
  $('new').onclick = () => nmReset(run);
  wireLevel('nm', () => false, () => nmReset(run));
  root.querySelectorAll('#gm-mode button').forEach(b => b.onclick = () => {
    nmHumans = +b.dataset.n;
    root.querySelectorAll('#gm-mode button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    $('levelbox').hidden = !nmSolo();
    nmReset(run);
  });
}

// ---------------------------------------------------------------- Bagh Chal
/* bcMode: 'G' you play the goats, 'T' the tigers, '2' two people pass the phone. */
const BX = p => [30 + 60 * (p % 5), 30 + 60 * Math.floor(p / 5)];
let bcS = null, bcMode = 'G', bcSel = null, bcBusy = false, bcGen = 0, bcIds = {};
const bcHuman = side => bcMode === '2' || bcMode === side;
const bcOk = (my, gen) => alive(my) && gen === bcGen;
function drawBC(svg) {
  svg.innerHTML = ''; let d = '';
  for (let i = 0; i < 5; i++) d += `M30 ${30 + 60 * i}H270 M${30 + 60 * i} 30V270 `;
  d += 'M30 30L270 270 M270 30L30 270 M150 30L270 150L150 270L30 150Z';
  el('path', { d, class: 'bc-line' }, svg);
  for (let p = 0; p < Rules.BC_N; p++) { const c = BX(p); el('circle', { cx: c[0], cy: c[1], r: '4', class: 'bc-pt' }, svg); }
  el('g', { id: 'gm-bctargets' }, svg); el('g', { id: 'gm-bcpieces' }, svg);
  const hits = el('g', {}, svg);
  for (let p = 0; p < Rules.BC_N; p++) { const c = BX(p), h = el('circle', { cx: c[0], cy: c[1], r: '24', class: 'ap-hit', tabindex: '0', role: 'button', 'aria-label': `${Math.floor(p / 5) + 1} · ${p % 5 + 1}` }, hits);
    h.addEventListener('click', () => bcTap(p)); h.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bcTap(p); } }); }
}
const bcPut = (g, p) => { const c = BX(p); g.style.transform = `translate(${c[0]}px,${c[1]}px) scale(1.15)`; };
function bcPieces() {
  const pg = $('bcpieces'); pg.innerHTML = ''; bcIds = {};
  for (let p = 0; p < Rules.BC_N; p++) if (bcS.board[p]) { const g = pieceEl(bcS.board[p], pg); bcPut(g, p); bcIds[p] = g; }
}
function bcBanner(cls, txt) { const b = $('banner'); b.className = 'gm-banner' + (cls ? ' ' + cls : ''); b.textContent = txt; }
// said: { text, took } what just happened, put before the prompt.
function bcPrompt(said) {
  const pre = said?.text ? said.text + ' ' : '', cls = said?.took ? 'vice' : '';
  if (bcS.over === 'goats') { bcBanner('win', pre + t('gm.ap.goatsWin')); return; }
  if (bcS.over === 'tigers') { bcBanner('win', pre + t(bcS.captured >= Rules.BC_WIN_CAPTURES ? 'gm.bc.tigersWin' : 'gm.ap.tigersBlock')); return; }
  if (bcS.over === 'draw') { bcBanner('', pre + t('gm.ap.draw')); return; }
  if (!bcHuman(bcS.turn)) { bcBanner(cls, pre + t('gm.thinking')); return; }
  const who = bcMode === '2' ? t(bcS.turn === 'G' ? 'gm.bc.goatsMove' : 'gm.bc.tigersMove') : t('gm.yourTurn');
  const what = t(bcS.turn === 'T' ? 'gm.bc.tigerTurn' : bcS.placed < Rules.BC_GOATS ? 'gm.ap.place' : 'gm.ap.move');
  bcBanner(cls, pre + who + ' ' + what);
}
function bcUI() {
  $('placed').textContent = bcS.placed; $('taken').textContent = bcS.captured; $('free').textContent = Rules.bcFreeTigers(bcS);
  const tg = $('bctargets'); tg.innerHTML = '';
  root.querySelectorAll('#gm-bcpieces .piece.sel').forEach(x => x.classList.remove('sel'));
  if (bcSel !== null && bcIds[bcSel]) { bcIds[bcSel].classList.add('sel');
    Rules.bcLegal(bcS).forEach(m => { if (m.from === bcSel) { const c = BX(m.to); el('circle', { cx: c[0], cy: c[1], r: '7', class: 'ap-target' }, tg); } }); }
}
// Makes the move on the board and in the rules; says so when a goat was taken.
function bcMove(m) {
  if (m.from === undefined) { const g = pieceEl('G', $('bcpieces')); bcPut(g, m.to); bcIds[m.to] = g; }
  else { const pc = bcIds[m.from]; delete bcIds[m.from]; bcIds[m.to] = pc; bcPut(pc, m.to);
    if (m.cap !== undefined) { const v = bcIds[m.cap]; delete bcIds[m.cap]; v.classList.add('gone'); setTimeout(() => v.remove(), 400); } }
  bcS = Rules.bcApply(bcS, m);
  return m.cap !== undefined ? { text: t('gm.ap.tigerTook'), took: true } : null;
}
async function bcComputer(my, said) {
  const gen = bcGen;
  while (!bcS.over && !bcHuman(bcS.turn)) {
    bcBusy = true; bcPrompt(said); bcUI(); await wait(T(600)); if (!bcOk(my, gen)) return;
    const m = bcS.turn === 'T' ? Rules.bcTigerAI(bcS, Math.random, level('bc')) : Rules.bcGoatAI(bcS, Math.random, level('bc'));
    said = bcMove(m) || { text: t(bcS.turn === 'G' ? 'gm.ap.tigerMoved' : m.from === undefined ? 'gm.bc.compPlaced' : 'gm.bc.goatMoved') };
  }
  bcBusy = false; bcPrompt(said); bcUI();
}
function bcTap(p) {
  if (bcBusy || bcS.over || !bcHuman(bcS.turn)) return;
  const legal = Rules.bcLegal(bcS), side = bcS.turn;
  if (side === 'G' && bcS.placed < Rules.BC_GOATS) {
    if (bcS.board[p] !== null) { bcBanner('', t('gm.ap.pointTaken')); return; }
    bcAfter(run, bcMove({ to: p })); return; }
  if (bcS.board[p] === side) { bcSel = bcSel === p ? null : p;
    if (bcSel !== null && !legal.some(m => m.from === p)) { bcBanner('', t(side === 'G' ? 'gm.ap.noFree' : 'gm.bc.tigerStuck')); bcSel = null; }
    bcUI(); return; }
  if (bcSel !== null && bcS.board[p] === null) {
    const mv = legal.find(m => m.from === bcSel && m.to === p);
    if (mv) { bcSel = null; bcAfter(run, bcMove(mv)); }
    else bcBanner('', t(side === 'G' ? 'gm.ap.oneStep' : 'gm.bc.tigerHow'));
  }
}
function bcAfter(my, said) { bcUI(); if (!bcS.over && !bcHuman(bcS.turn)) bcComputer(my, said); else bcPrompt(said); }
function bcReset(my) {
  bcGen++; bcS = Rules.bcNew(); bcSel = null; bcBusy = false; bcPieces();
  bcUI(); if (!bcHuman(bcS.turn)) bcComputer(my, null); else bcPrompt(bcMode === '2' ? { text: t('gm.bc.goatsFirst') } : null);
}
function bcScreen() {
  const my = run;
  root.innerHTML = `<div class="gm">${head('bc', 'gm.fam.hunt')}
    ${seg('mode', [['G', t('gm.bc.goatsVs')], ['T', t('gm.bc.tigersVs')], ['2', t('gm.nPlayers', 2)]], bcMode)}
    ${levelSeg('bc', bcMode === '2')}
    <div class="gm-counter"><span>${esc(t('gm.ap.placed'))} <b id="gm-placed">0</b>/${Rules.BC_GOATS}</span><span>${esc(t('gm.ap.taken'))} <b id="gm-taken">0</b>/${Rules.BC_WIN_CAPTURES}</span><span>${esc(t('gm.ap.free'))} <b id="gm-free">4</b></span></div>
    <div class="gm-boardwrap" style="background:var(--green-soft)"><svg id="gm-board" viewBox="0 0 300 300" role="img" aria-label="${esc(gname('bc'))}"></svg></div>
    <div class="gm-banner" id="gm-banner" aria-live="polite"></div>
    ${how('bc', 6, 'gm.lvHow')}<button class="gm-pill ghost" id="gm-new">${esc(t('gm.newGame'))}</button></div>`;
  wireBack(); drawBC($('board'));
  // A game is kept between visits; the computer, caught mid-move, moves again.
  if (!bcS) bcReset(my);
  else { bcGen++; bcSel = null; bcBusy = false; bcPieces(); bcUI(); if (!bcS.over && !bcHuman(bcS.turn)) bcComputer(my, null); else bcPrompt(null); }
  $('new').onclick = () => bcReset(run);
  wireLevel('bc', () => false, () => bcReset(run));
  root.querySelectorAll('#gm-mode button').forEach(b => b.onclick = () => {
    bcMode = b.dataset.n;
    root.querySelectorAll('#gm-mode button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    $('levelbox').hidden = bcMode === '2';
    bcReset(run);
  });
}
