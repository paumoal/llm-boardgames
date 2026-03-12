import { useState, useCallback, useEffect, useRef } from "react";

// ============================================================
// GAME DEFINITIONS - Based on actual GDL rulesheet formats
// ============================================================

const GAME_DEFS = {
  tictactoe: {
    name: "Tic-Tac-Toe",
    desc: "Classic 3x3. Get three in a row. Moves: mark(row,col) rows/cols 1-3.",
    roles: ["x", "o"], playerCount: 2, category: "classic",
    initState: () => {
      const s = [];
      for (let r = 1; r <= 3; r++) for (let c = 1; c <= 3; c++) s.push(["cell", String(r), String(c), "b"]);
      s.push(["control", "x"]); return s;
    },
    getControl: s => { const c = s.find(f => f[0] === "control"); return c ? c[1] : null; },
    getLegalMoves: s => {
      const ctrl = s.find(f => f[0] === "control"); if (!ctrl) return [];
      return s.filter(f => f[0] === "cell" && f[3] === "b").map(f => ["mark", f[1], f[2]]);
    },
    applyMove: (s, m) => {
      const p = s.find(f => f[0] === "control")[1], nx = p === "x" ? "o" : "x";
      return [...s.filter(f => !(f[0] === "cell" && f[1] === m[1] && f[2] === m[2]) && f[0] !== "control"),
        ["cell", m[1], m[2], p], ["control", nx]];
    },
    checkTerminal: s => {
      const g = {}; s.forEach(f => { if (f[0] === "cell") g[`${f[1]},${f[2]}`] = f[3]; });
      const lines = [[[1,1],[1,2],[1,3]],[[2,1],[2,2],[2,3]],[[3,1],[3,2],[3,3]],
        [[1,1],[2,1],[3,1]],[[1,2],[2,2],[3,2]],[[1,3],[2,3],[3,3]],
        [[1,1],[2,2],[3,3]],[[1,3],[2,2],[3,1]]];
      for (const l of lines) {
        const v = l.map(([r,c]) => g[`${r},${c}`]);
        if (v[0] !== "b" && v[0] === v[1] && v[1] === v[2]) return { over: true, winner: v[0] };
      }
      if (Object.values(g).every(v => v !== "b")) return { over: true, winner: null };
      return { over: false };
    },
    formatMove: m => `mark(${m[1]},${m[2]})`,
  },
  suicide: {
    name: "Suicide Tic-Tac-Toe", desc: "Anti TTT. Three in a row loses!",
    roles: ["x", "o"], playerCount: 2, category: "classic",
    initState: () => GAME_DEFS.tictactoe.initState(),
    getControl: s => GAME_DEFS.tictactoe.getControl(s),
    getLegalMoves: s => GAME_DEFS.tictactoe.getLegalMoves(s),
    applyMove: (s, m) => GAME_DEFS.tictactoe.applyMove(s, m),
    checkTerminal: s => {
      const r = GAME_DEFS.tictactoe.checkTerminal(s);
      if (r.over && r.winner) return { over: true, winner: r.winner === "x" ? "o" : "x" };
      return r;
    },
    formatMove: m => `mark(${m[1]},${m[2]})`,
  },
  connect4: {
    name: "Connect 4", desc: "Drop pieces in 8 columns (6 rows). Connect four. Moves: drop(col).",
    roles: ["red", "blue"], playerCount: 2, category: "classic",
    initState: () => {
      const s = [];
      for (let c = 1; c <= 8; c++) for (let r = 1; r <= 6; r++) s.push(["cell", String(c), String(r), "b"]);
      s.push(["control", "red"]); return s;
    },
    getControl: s => { const c = s.find(f => f[0] === "control"); return c ? c[1] : null; },
    getLegalMoves: s => {
      const mv = [];
      for (let c = 1; c <= 8; c++) {
        if (s.filter(f => f[0]==="cell"&&f[1]===String(c)).some(f => f[3]==="b")) mv.push(["drop", String(c)]);
      }
      return mv;
    },
    applyMove: (s, m) => {
      const col = m[1], p = s.find(f=>f[0]==="control")[1], nx = p==="red"?"blue":"red";
      const cc = s.filter(f=>f[0]==="cell"&&f[1]===col).sort((a,b)=>Number(a[2])-Number(b[2]));
      const tgt = cc.find(f => f[3]==="b");
      if (!tgt) return s;
      return [...s.filter(f=>!(f[0]==="cell"&&f[1]===col&&f[2]===tgt[2])&&f[0]!=="control"),
        ["cell",col,tgt[2],p],["control",nx]];
    },
    checkTerminal: s => {
      const g={}; s.forEach(f=>{if(f[0]==="cell")g[`${f[1]},${f[2]}`]=f[3];});
      for(let c=1;c<=8;c++) for(let r=1;r<=6;r++){
        const v=g[`${c},${r}`]; if(!v||v==="b") continue;
        for(const[dc,dr]of[[1,0],[0,1],[1,1],[1,-1]]){
          let ok=true;
          for(let i=1;i<4;i++){if(g[`${c+dc*i},${r+dr*i}`]!==v){ok=false;break;}}
          if(ok) return {over:true,winner:v};
        }
      }
      if(!Object.values(g).some(v=>v==="b")) return {over:true,winner:null};
      return {over:false};
    },
    formatMove: m => `drop(${m[1]})`,
  },
  notconnect4: {
    name: "Not Connect 4", desc: "Anti-Connect 4. Connecting four LOSES!",
    roles: ["red", "blue"], playerCount: 2, category: "classic",
    initState: ()=>GAME_DEFS.connect4.initState(),
    getControl: s=>GAME_DEFS.connect4.getControl(s),
    getLegalMoves: s=>GAME_DEFS.connect4.getLegalMoves(s),
    applyMove: (s,m)=>GAME_DEFS.connect4.applyMove(s,m),
    checkTerminal: s => {
      const r=GAME_DEFS.connect4.checkTerminal(s);
      if(r.over&&r.winner) return {over:true,winner:r.winner==="red"?"blue":"red"};
      return r;
    },
    formatMove: m=>`drop(${m[1]})`,
  },
  alquerque: {
    name: "Alquerque", desc: "5x5 grid. Capture all enemy pieces. Moves: move(r1,c1,r2,c2) or jump(r1,c1,mr,mc,r2,c2). Roles: red, black.",
    roles: ["red","black"], playerCount: 2, category: "strategy",
    _doublets: (()=>{
      const d=[];
      for(let r=1;r<=5;r++) for(let c=1;c<=4;c++){d.push([r,c,r,c+1]);d.push([r,c+1,r,c]);}
      for(let r=1;r<=4;r++) for(let c=1;c<=5;c++){d.push([r,c,r+1,c]);d.push([r+1,c,r,c]);}
      const sl=[[3,1,2,2],[2,2,1,3],[5,1,4,2],[4,2,3,3],[3,3,2,4],[2,4,1,5],[5,3,4,4],[4,4,3,5]];
      const bs=[[3,1,4,2],[4,2,5,3],[1,1,2,2],[2,2,3,3],[3,3,4,4],[4,4,5,5],[1,3,2,4],[2,4,3,5]];
      for(const[a,b,c,e]of[...sl,...bs]){d.push([a,b,c,e]);d.push([c,e,a,b]);}
      return d;
    })(),
    initState: ()=>{
      const s=[];
      for(let r=1;r<=2;r++)for(let c=1;c<=5;c++)s.push(["cell",String(r),String(c),"black"]);
      for(let c=1;c<=5;c++)s.push(["cell","3",String(c),"blank"]);
      for(let r=4;r<=5;r++)for(let c=1;c<=5;c++)s.push(["cell",String(r),String(c),"red"]);
      s.push(["score","red","0"],["score","black","0"],["control","red"],["step","1"]);
      return s;
    },
    getControl: s=>{const c=s.find(f=>f[0]==="control");return c?c[1]:null;},
    getLegalMoves: function(s){
      const role=this.getControl(s),opp=role==="red"?"black":"red";
      const at=(r,c)=>{const f=s.find(f=>f[0]==="cell"&&f[1]===String(r)&&f[2]===String(c));return f?f[3]:null;};
      const jumps=[];
      for(const[ur,uc,xr,xc]of this._doublets){
        if(at(ur,uc)!==role)continue;if(at(xr,xc)!==opp)continue;
        const yr=xr+(xr-ur),yc=xc+(xc-uc);
        if(yr<1||yr>5||yc<1||yc>5)continue;if(at(yr,yc)!=="blank")continue;
        jumps.push(["jump",String(ur),String(uc),String(xr),String(xc),String(yr),String(yc)]);
      }
      if(jumps.length>0)return jumps;
      const mv=[];
      for(const[ur,uc,xr,xc]of this._doublets){
        if(at(ur,uc)!==role||at(xr,xc)!=="blank")continue;
        mv.push(["move",String(ur),String(uc),String(xr),String(xc)]);
      }
      return mv;
    },
    applyMove: (s,m)=>{
      const role=s.find(f=>f[0]==="control")[1],nx=role==="red"?"black":"red";
      let ns=s.filter(f=>f[0]!=="control"&&f[0]!=="step");
      const sv=Number((s.find(f=>f[0]==="step")||["step","1"])[1]);
      ns.push(["step",String(sv+1)]);
      if(m[0]==="move"){
        ns=ns.filter(f=>!(f[0]==="cell"&&f[1]===m[1]&&f[2]===m[2]));
        ns=ns.filter(f=>!(f[0]==="cell"&&f[1]===m[3]&&f[2]===m[4]));
        ns.push(["cell",m[1],m[2],"blank"],["cell",m[3],m[4],role]);
      }else{
        ns=ns.filter(f=>!(f[0]==="cell"&&f[1]===m[1]&&f[2]===m[2]));
        ns=ns.filter(f=>!(f[0]==="cell"&&f[1]===m[3]&&f[2]===m[4]));
        ns=ns.filter(f=>!(f[0]==="cell"&&f[1]===m[5]&&f[2]===m[6]));
        ns.push(["cell",m[1],m[2],"blank"],["cell",m[3],m[4],"blank"],["cell",m[5],m[6],role]);
        const sf=ns.find(f=>f[0]==="score"&&f[1]===role);
        if(sf){const sc=Number(sf[2]);ns=ns.filter(f=>!(f[0]==="score"&&f[1]===role));ns.push(["score",role,String(sc+10)]);}
      }
      ns.push(["control",nx]);return ns;
    },
    checkTerminal: function(s){
      const sr=s.find(f=>f[0]==="score"&&f[1]==="red"),sb=s.find(f=>f[0]==="score"&&f[1]==="black");
      if(sr&&Number(sr[2])>=100)return{over:true,winner:"red"};
      if(sb&&Number(sb[2])>=100)return{over:true,winner:"black"};
      const st=s.find(f=>f[0]==="step");if(st&&Number(st[1])>=30)return{over:true,winner:null};
      if(this.getLegalMoves(s).length===0){const c=this.getControl(s);return{over:true,winner:c==="red"?"black":"red"};}
      return{over:false};
    },
    formatMove: m=>`${m[0]}(${m.slice(1).join(",")})`,
  },
  breakthrough: {
    name: "Breakthrough", desc: "8x8 board. Race pawns forward. White reaches row 8 or black row 1 to win. Moves: move(x,y,x2,y2).",
    roles:["white","black"],playerCount:2,category:"strategy",
    initState: ()=>{
      const s=[];
      for(let x=1;x<=8;x++){s.push(["cell",String(x),"1","white"]);s.push(["cell",String(x),"2","white"]);}
      for(let x=1;x<=8;x++){s.push(["cell",String(x),"7","black"]);s.push(["cell",String(x),"8","black"]);}
      s.push(["control","white"]);return s;
    },
    getControl: s=>{const c=s.find(f=>f[0]==="control");return c?c[1]:null;},
    getLegalMoves: s=>{
      const role=s.find(f=>f[0]==="control")[1],dir=role==="white"?1:-1;
      const at=(x,y)=>s.find(f=>f[0]==="cell"&&f[1]===String(x)&&f[2]===String(y));
      const mv=[];
      for(const f of s){
        if(f[0]!=="cell"||f[3]!==role)continue;
        const x=Number(f[1]),y=Number(f[2]),ny=y+dir;
        if(ny<1||ny>8)continue;
        if(!at(x,ny))mv.push(["move",String(x),String(y),String(x),String(ny)]);
        for(const dx of[-1,1]){
          const nx=x+dx;if(nx<1||nx>8)continue;
          const t=at(nx,ny);if(!t||t[3]!==role)mv.push(["move",String(x),String(y),String(nx),String(ny)]);
        }
      }
      return mv;
    },
    applyMove: (s,m)=>{
      const role=s.find(f=>f[0]==="control")[1],nx=role==="white"?"black":"white";
      return [...s.filter(f=>!(f[0]==="cell"&&f[1]===m[1]&&f[2]===m[2])&&!(f[0]==="cell"&&f[1]===m[3]&&f[2]===m[4])&&f[0]!=="control"),
        ["cell",m[3],m[4],role],["control",nx]];
    },
    checkTerminal: s=>{
      if(s.some(f=>f[0]==="cell"&&f[2]==="8"&&f[3]==="white"))return{over:true,winner:"white"};
      if(s.some(f=>f[0]==="cell"&&f[2]==="1"&&f[3]==="black"))return{over:true,winner:"black"};
      if(!s.some(f=>f[0]==="cell"&&f[3]==="white"))return{over:true,winner:"black"};
      if(!s.some(f=>f[0]==="cell"&&f[3]==="black"))return{over:true,winner:"white"};
      return{over:false};
    },
    formatMove: m=>`move(${m.slice(1).join(",")})`,
  },
  buttonsandlights: {
    name: "Buttons & Lights", desc: "Single player. 3 lights (p,q,r), 3 buttons (a,b,c). Turn all on in 6 steps. a=toggle p, b=swap(p,q), c=swap(q,r).",
    roles:["robot"],playerCount:1,category:"puzzle",
    initState: ()=>[["step","1"],["control","robot"]],
    getControl: ()=>"robot",
    getLegalMoves: ()=>[["a"],["b"],["c"]],
    applyMove: (s,m)=>{
      const h=x=>s.some(f=>f.length===1&&f[0]===x);
      let p=h("p"),q=h("q"),r=h("r");
      if(m[0]==="a")p=!p;
      else if(m[0]==="b"){const op=p;p=q;q=op;}
      else if(m[0]==="c"){const oq=q;q=r;r=oq;}
      const sv=Number((s.find(f=>f[0]==="step")||["step","1"])[1]);
      const ns=[["step",String(sv+1)],["control","robot"]];
      if(p)ns.push(["p"]);if(q)ns.push(["q"]);if(r)ns.push(["r"]);
      return ns;
    },
    checkTerminal: s=>{
      const h=x=>s.some(f=>f.length===1&&f[0]===x);
      if(h("p")&&h("q")&&h("r"))return{over:true,winner:"robot"};
      const sv=Number((s.find(f=>f[0]==="step")||["step","1"])[1]);
      if(sv>=7)return{over:true,winner:null};
      return{over:false};
    },
    formatMove: m=>m[0],
  },
  hamilton: {
    name: "Hamilton", desc: "Visit all 20 nodes on a dodecahedral graph starting at 'a'. Moves: move(node).",
    roles:["robot"],playerCount:1,category:"puzzle",
    _conn:{a:["b","e","h"],b:["a","c","j"],c:["b","d","l"],d:["c","e","n"],e:["a","d","f"],f:["e","g","o"],g:["f","h","q"],h:["a","g","i"],i:["h","j","r"],j:["b","i","k"],k:["j","l","s"],l:["c","k","m"],m:["l","n","t"],n:["d","m","o"],o:["n","f","p"],p:["o","q","t"],q:["g","p","r"],r:["i","q","s"],s:["k","r","t"],t:["m","s","p"]},
    initState: ()=>[["location","a"],["visited","a"],["score","1"],["step","1"],["control","robot"]],
    getControl: ()=>"robot",
    getLegalMoves: function(s){const loc=s.find(f=>f[0]==="location");return loc?(this._conn[loc[1]]||[]).map(n=>["move",n]):[];},
    applyMove: function(s,m){
      const dest=m[1],vis=s.some(f=>f[0]==="visited"&&f[1]===dest);
      let ns=s.filter(f=>f[0]!=="location"&&f[0]!=="step");
      ns.push(["location",dest]);
      if(!vis){ns.push(["visited",dest]);
        const sm={0:1,1:2,2:4,4:6,6:9,9:12,12:16,16:20,20:25,25:30,30:36,36:42,42:49,49:56,56:64,64:72,72:81,81:90,90:100};
        const sf=ns.find(f=>f[0]==="score");
        if(sf){const c=Number(sf[1]),n=sm[c]!==undefined?sm[c]:c;ns=ns.filter(f=>f[0]!=="score");ns.push(["score",String(n)]);}
      }
      const sv=Number((s.find(f=>f[0]==="step")||["step","1"])[1]);
      ns=ns.filter(f=>f[0]!=="step");ns.push(["step",String(sv+1)]);
      return ns;
    },
    checkTerminal: s=>{
      const sv=Number((s.find(f=>f[0]==="step")||["step","1"])[1]);
      if(sv>=20)return{over:true,winner:s.filter(f=>f[0]==="visited").length>=20?"robot":null};
      return{over:false};
    },
    formatMove: m=>`move(${m[1]})`,
  },
  hex: {
    name: "Hex 7x7", desc: "Place stones on 7x7 hex grid. Red connects rows a-g (top-bottom), black connects cols 1-7 (left-right). Moves: place(row,col).",
    roles:["red","black"],playerCount:2,category:"strategy",
    _rows:["a","b","c","d","e","f","g"],_cols:["1","2","3","4","5","6","7"],
    initState: ()=>[["step","1"],["control","red"]],
    getControl: s=>{const c=s.find(f=>f[0]==="control");return c?c[1]:null;},
    getLegalMoves: function(s){
      const mv=[];
      for(const r of this._rows)for(const c of this._cols)
        if(!s.some(f=>f[0]==="cell"&&f[1]===r&&f[2]===c))mv.push(["place",r,c]);
      return mv;
    },
    applyMove: (s,m)=>{
      const role=s.find(f=>f[0]==="control")[1],nx=role==="red"?"black":"red";
      let ns=s.filter(f=>f[0]!=="control"&&f[0]!=="step");
      ns.push(["cell",m[1],m[2],role],["control",nx]);
      const sv=Number((s.find(f=>f[0]==="step")||["step","1"])[1]);
      ns.push(["step",String(sv+1)]);return ns;
    },
    checkTerminal: function(s){
      const rows=this._rows,cols=this._cols;
      const adj=(r1,c1,r2,c2)=>{
        const ri1=rows.indexOf(r1),ci1=cols.indexOf(c1),ri2=rows.indexOf(r2),ci2=cols.indexOf(c2);
        const dr=ri2-ri1,dc=ci2-ci1;
        return(dr===0&&Math.abs(dc)===1)||(Math.abs(dr)===1&&dc===0)||(dr===1&&dc===-1)||(dr===-1&&dc===1);
      };
      const bfs=(pl,st,en)=>{
        const cells=s.filter(f=>f[0]==="cell"&&f[3]===pl);
        const starts=cells.filter(f=>st(f[1],f[2]));
        const vis=new Set();const q=[...starts];
        for(const x of starts)vis.add(`${x[1]},${x[2]}`);
        while(q.length>0){const cur=q.shift();if(en(cur[1],cur[2]))return true;
          for(const o of cells){const k=`${o[1]},${o[2]}`;if(!vis.has(k)&&adj(cur[1],cur[2],o[1],o[2])){vis.add(k);q.push(o);}}
        }return false;
      };
      if(bfs("red",(r,c)=>r==="a",(r,c)=>r==="g"))return{over:true,winner:"red"};
      if(bfs("black",(r,c)=>c==="1",(r,c)=>c==="7"))return{over:true,winner:"black"};
      return{over:false};
    },
    formatMove: m=>`place(${m[1]},${m[2]})`,
  },
  hunter: {
    name: "Hunter", desc: "Single player. Knight captures pawns on 5x3 grid in 15 moves. Moves: move(fromR,fromC,toR,toC).",
    roles:["robot"],playerCount:1,category:"puzzle",
    initState: ()=>{
      const s=[["cell","1","1","knight"]];
      for(let r=1;r<=5;r++)for(let c=1;c<=3;c++){if(r===1&&c===1)continue;s.push(["cell",String(r),String(c),"pawn"]);}
      s.push(["captures","0"],["step","1"],["control","robot"]);return s;
    },
    getControl: ()=>"robot",
    getLegalMoves: function(s){
      const kn=s.find(f=>f[0]==="cell"&&f[3]==="knight");if(!kn)return[];
      const kr=Number(kn[1]),kc=Number(kn[2]);
      return[[1,2],[1,-2],[-1,2],[-1,-2],[2,1],[2,-1],[-2,1],[-2,-1]]
        .map(([dr,dc])=>[kr+dr,kc+dc]).filter(([r,c])=>r>=1&&r<=5&&c>=1&&c<=3)
        .map(([r,c])=>["move",String(kr),String(kc),String(r),String(c)]);
    },
    applyMove: (s,m)=>{
      const tgt=s.find(f=>f[0]==="cell"&&f[1]===m[3]&&f[2]===m[4]);
      let ns=s.filter(f=>!(f[0]==="cell"&&f[1]===m[1]&&f[2]===m[2])&&!(f[0]==="cell"&&f[1]===m[3]&&f[2]===m[4])&&f[0]!=="step");
      ns.push(["cell",m[3],m[4],"knight"],["cell",m[1],m[2],"blank"]);
      if(tgt&&tgt[3]==="pawn"){const cf=ns.find(f=>f[0]==="captures");if(cf){const c=Number(cf[1]);ns=ns.filter(f=>f[0]!=="captures");ns.push(["captures",String(c+1)]);}}
      const sv=Number((s.find(f=>f[0]==="step")||["step","1"])[1]);
      ns.push(["step",String(sv+1)]);return ns;
    },
    checkTerminal: s=>{const sv=Number((s.find(f=>f[0]==="step")||["step","1"])[1]);if(sv>=16)return{over:true,winner:null};return{over:false};},
    formatMove: m=>`move(${m.slice(1).join(",")})`,
  },
  lines: {
    name: "Lines", desc: "Diamond-shaped board. Place to gain row/col/diagonal majorities. Moves: place(row,col). Roles: red, blue.",
    roles:["red","blue"],playerCount:2,category:"strategy",
    _vc:[["a","5"],["a","6"],["a","7"],["a","8"],["a","9"],["b","4"],["b","5"],["b","6"],["b","7"],["b","9"],["c","3"],["c","4"],["c","5"],["c","6"],["c","7"],["c","8"],["c","9"],["d","2"],["d","3"],["d","4"],["d","5"],["d","7"],["d","8"],["d","9"],["e","1"],["e","3"],["e","5"],["e","6"],["e","7"],["e","8"],["e","9"],["f","1"],["f","2"],["f","3"],["f","4"],["f","6"],["f","7"],["f","8"],["g","1"],["g","2"],["g","3"],["g","4"],["g","5"],["g","6"],["g","7"],["h","1"],["h","2"],["h","3"],["h","4"],["h","6"],["i","1"],["i","2"],["i","3"],["i","4"],["i","5"]],
    initState: ()=>[["control","red"]],
    getControl: s=>{const c=s.find(f=>f[0]==="control");return c?c[1]:null;},
    getLegalMoves: function(s){return this._vc.filter(([r,c])=>!s.some(f=>f[0]==="cell"&&f[1]===r&&f[2]===c)).map(([r,c])=>["place",r,c]);},
    applyMove: (s,m)=>{
      const role=s.find(f=>f[0]==="control")[1],nx=role==="red"?"blue":"red";
      return[...s.filter(f=>f[0]!=="control"),["cell",m[1],m[2],role],["control",nx]];
    },
    checkTerminal: function(s){if(this.getLegalMoves(s).length===0)return{over:true,winner:null};return{over:false};},
    formatMove: m=>`place(${m[1]},${m[2]})`,
  },
};

// ============================================================
// BOARD RENDERERS
// ============================================================
function TTTBoard({state,onMove,active}){
  const g={};state.forEach(f=>{if(f[0]==="cell")g[`${f[1]},${f[2]}`]=f[3];});
  return <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5,width:234,margin:"0 auto"}}>
    {[1,2,3].map(r=>[1,2,3].map(c=>{
      const v=g[`${r},${c}`]||"b",sym=v==="x"?"✕":v==="o"?"○":"";
      return <button key={`${r}${c}`} onClick={()=>active&&v==="b"&&onMove(["mark",String(r),String(c)])}
        style={{width:73,height:73,fontSize:30,fontWeight:900,border:"2px solid #3a3052",borderRadius:10,
          cursor:active&&v==="b"?"pointer":"default",
          background:v==="x"?"#ffeaa7":v==="o"?"#dfe6e9":"rgba(255,255,255,.05)",
          color:v==="x"?"#d63031":v==="o"?"#0984e3":"#555"}}>{sym}</button>;
    }))}
  </div>;
}

function C4Board({state,onMove,active,cols=8,rows=6}){
  const g={};state.forEach(f=>{if(f[0]==="cell")g[`${f[1]},${f[2]}`]=f[3];});
  return <div style={{background:"#2d3436",borderRadius:14,padding:10,display:"inline-block"}}>
    {Array.from({length:rows},(_,i)=>rows-i).map(r=>
      <div key={r} style={{display:"flex",gap:4,marginBottom:4}}>
        {Array.from({length:cols},(_,i)=>i+1).map(c=>{
          const v=g[`${c},${r}`]||"b";
          return <div key={c} onClick={()=>active&&onMove(["drop",String(c)])}
            style={{width:32,height:32,borderRadius:"50%",cursor:active?"pointer":"default",
              background:v==="red"?"#e74c3c":v==="blue"?"#3498db":"#636e72",
              boxShadow:v!=="b"?"inset 0 -3px 6px rgba(0,0,0,.3)":"inset 0 3px 6px rgba(0,0,0,.5)"}}/>;
        })}
      </div>
    )}
  </div>;
}

function AlqBoard({state,onMove,active,game}){
  const[sel,setSel]=useState(null);
  const role=game.getControl(state);const moves=active?game.getLegalMoves(state):[];
  const at=(r,c)=>{const f=state.find(f=>f[0]==="cell"&&f[1]===String(r)&&f[2]===String(c));return f?f[3]:null;};
  const sz=56,pad=28,pos=(r,c)=>({x:(c-1)*sz+pad,y:(r-1)*sz+pad});
  const lines=[],dr=new Set();
  for(const[a,b,c,d]of game._doublets){const k=`${Math.min(a*10+b,c*10+d)}-${Math.max(a*10+b,c*10+d)}`;if(dr.has(k))continue;dr.add(k);const p1=pos(a,b),p2=pos(c,d);lines.push(<line key={k} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#8e7c68" strokeWidth={1.5}/>);}
  const click=(r,c)=>{if(!active)return;if(sel){const m=moves.find(mv=>{
    if(mv[0]==="move")return mv[1]===String(sel[0])&&mv[2]===String(sel[1])&&mv[3]===String(r)&&mv[4]===String(c);
    if(mv[0]==="jump")return mv[1]===String(sel[0])&&mv[2]===String(sel[1])&&mv[5]===String(r)&&mv[6]===String(c);return false;});
    if(m){onMove(m);setSel(null);return;}}if(at(r,c)===role)setSel([r,c]);else setSel(null);};
  return <svg width={sz*4+pad*2} height={sz*4+pad*2} style={{background:"#f5ecd7",borderRadius:12}}>
    {lines}
    {[1,2,3,4,5].map(r=>[1,2,3,4,5].map(c=>{
      const p=pos(r,c),v=at(r,c),isSel=sel&&sel[0]===r&&sel[1]===c;
      const isTgt=sel&&moves.some(mv=>{
        if(mv[0]==="move")return mv[1]===String(sel[0])&&mv[2]===String(sel[1])&&mv[3]===String(r)&&mv[4]===String(c);
        if(mv[0]==="jump")return mv[1]===String(sel[0])&&mv[2]===String(sel[1])&&mv[5]===String(r)&&mv[6]===String(c);return false;});
      return <g key={`${r}${c}`} onClick={()=>click(r,c)} style={{cursor:active?"pointer":"default"}}>
        {isTgt&&<circle cx={p.x} cy={p.y} r={18} fill="none" stroke="#2ecc71" strokeWidth={3} strokeDasharray="4"/>}
        {v&&v!=="blank"?<circle cx={p.x} cy={p.y} r={14} fill={v==="black"?"#2c3e50":"#c0392b"} stroke={isSel?"#f1c40f":"rgba(0,0,0,.2)"} strokeWidth={isSel?3:1.5}/>
        :<circle cx={p.x} cy={p.y} r={4} fill="#bbb"/>}
      </g>;
    }))}
  </svg>;
}

function BrkBoard({state,onMove,active,game}){
  const[sel,setSel]=useState(null);const role=game.getControl(state);const moves=active?game.getLegalMoves(state):[];
  const at=(x,y)=>state.find(f=>f[0]==="cell"&&f[1]===String(x)&&f[2]===String(y));
  const click=(x,y)=>{if(!active)return;if(sel){const m=moves.find(mv=>mv[1]===String(sel[0])&&mv[2]===String(sel[1])&&mv[3]===String(x)&&mv[4]===String(y));
    if(m){onMove(m);setSel(null);return;}}const c=at(x,y);if(c&&c[3]===role)setSel([x,y]);else setSel(null);};
  return <div style={{display:"inline-block",background:"#4e342e",borderRadius:8,padding:4}}>
    {[8,7,6,5,4,3,2,1].map(y=><div key={y} style={{display:"flex"}}>
      <span style={{width:16,textAlign:"center",color:"#a1887f",fontSize:10,lineHeight:"30px"}}>{y}</span>
      {[1,2,3,4,5,6,7,8].map(x=>{const v=at(x,y);const isSel=sel&&sel[0]===x&&sel[1]===y;
        const isTgt=sel&&moves.some(mv=>mv[1]===String(sel[0])&&mv[2]===String(sel[1])&&mv[3]===String(x)&&mv[4]===String(y));
        return <div key={x} onClick={()=>click(x,y)} style={{width:30,height:30,background:(x+y)%2===0?"#d7ccc8":"#8d6e63",
          display:"flex",alignItems:"center",justifyContent:"center",cursor:active?"pointer":"default",
          outline:isSel?"2px solid #f1c40f":isTgt?"2px solid #2ecc71":"none"}}>
          {v&&<div style={{width:22,height:22,borderRadius:"50%",background:v[3]==="white"?"#fafafa":"#263238",border:v[3]==="white"?"2px solid #bbb":"2px solid #111"}}/>}
        </div>;})}
    </div>)}
  </div>;
}

function BLBoard({state,onMove,active}){
  const h=x=>state.some(f=>f.length===1&&f[0]===x);const step=state.find(f=>f[0]==="step");
  return <div style={{textAlign:"center"}}>
    <div style={{display:"flex",gap:20,justifyContent:"center",marginBottom:18}}>
      {["p","q","r"].map(l=><div key={l} style={{width:56,height:56,borderRadius:"50%",background:h(l)?"#f1c40f":"#2c3e50",
        boxShadow:h(l)?"0 0 18px #f39c12":"inset 0 2px 8px rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:20,fontWeight:700,color:h(l)?"#2c3e50":"#7f8c8d",border:"3px solid #555"}}>{l.toUpperCase()}</div>)}
    </div>
    <div style={{display:"flex",gap:10,justifyContent:"center"}}>
      {["a","b","c"].map(b=><button key={b} onClick={()=>active&&onMove([b])}
        style={{width:60,height:40,borderRadius:8,border:"2px solid #7c6fae",background:"rgba(124,111,174,.2)",color:"#c4b5fd",fontSize:15,fontWeight:700,cursor:active?"pointer":"default"}}>{b.toUpperCase()}</button>)}
    </div>
    <div style={{color:"#9ca3af",fontSize:12,marginTop:10}}>Step: {step?step[1]:"1"}/6</div>
  </div>;
}

function HamBoard({state,onMove,active,game}){
  const loc=state.find(f=>f[0]==="location"),cur=loc?loc[1]:null;
  const vis=state.filter(f=>f[0]==="visited").map(f=>f[1]);const moves=active?game.getLegalMoves(state):[];const mn=moves.map(m=>m[1]);
  const np={a:[160,20],b:[260,55],c:[295,150],d:[260,250],e:[160,290],f:[60,250],g:[25,150],h:[60,55],i:[105,105],j:[215,105],k:[255,175],l:[215,250],m:[160,230],n:[105,250],o:[65,175],p:[110,195],q:[85,138],r:[145,118],s:[195,175],t:[160,172]};
  const edges=new Set(),el=[];
  for(const[n,nbrs]of Object.entries(game._conn))for(const nb of nbrs){const k=[n,nb].sort().join("-");if(edges.has(k))continue;edges.add(k);
    const[x1,y1]=np[n]||[0,0],[x2,y2]=np[nb]||[0,0];el.push(<line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#555" strokeWidth={1.5}/>);}
  return <svg width={330} height={320} style={{background:"#1a1a2e",borderRadius:12}}>
    {el}{Object.keys(game._conn).map(n=>{const[x,y]=np[n]||[0,0];const isC=n===cur,isV=vis.includes(n),isM=mn.includes(n);
      return <g key={n} onClick={()=>active&&isM&&onMove(["move",n])} style={{cursor:active&&isM?"pointer":"default"}}>
        <circle cx={x} cy={y} r={15} fill={isC?"#e74c3c":isV?"#636e72":isM?"#27ae60":"#444"} stroke={isM?"#2ecc71":"none"} strokeWidth={2}/>
        <text x={x} y={y+4} textAnchor="middle" fill="#fff" fontSize={10} fontWeight={700}>{n}</text>
      </g>;})}
  </svg>;
}

function HexBoard({state,onMove,active,game}){
  const rows=game._rows,cols=game._cols,R=14,H=R*Math.sqrt(3);
  const ctr=(r,c)=>{const ri=rows.indexOf(r),ci=cols.indexOf(c);return{x:48+ci*R*1.8+ri*R*.9,y:28+ri*H*.85};};
  const hp=(cx,cy)=>{let p=[];for(let a=0;a<6;a++){const ang=(Math.PI/180)*(60*a-30);p.push(`${cx+R*Math.cos(ang)},${cy+R*Math.sin(ang)}`);}return p.join(" ");};
  const cc=(r,c)=>{const f=state.find(f=>f[0]==="cell"&&f[1]===r&&f[2]===c);return f?f[3]:null;};
  return <svg width={360} height={240} style={{background:"#f5f0dc",borderRadius:12}}>
    <text x={130} y={13} fill="#c0392b" fontSize={10} fontWeight={700}>RED (a→g)</text>
    <text x={6} y={130} fill="#2c3e50" fontSize={9} fontWeight={700} transform="rotate(-90,6,130)">BLACK</text>
    {rows.map(r=>cols.map(c=>{const{x,y}=ctr(r,c);const v=cc(r,c);
      return <polygon key={`${r}${c}`} points={hp(x,y)} fill={v==="red"?"#e74c3c":v==="black"?"#2c3e50":"#e8e0c8"}
        stroke="#999" strokeWidth={1} onClick={()=>active&&!v&&onMove(["place",r,c])} style={{cursor:active&&!v?"pointer":"default"}}/>;
    }))}
  </svg>;
}

function HntBoard({state,onMove,active,game}){
  const moves=active?game.getLegalMoves(state):[];
  const at=(r,c)=>{const f=state.find(f=>f[0]==="cell"&&f[1]===String(r)&&f[2]===String(c));return f?f[3]:null;};
  const cap=state.find(f=>f[0]==="captures"),step=state.find(f=>f[0]==="step");
  return <div style={{textAlign:"center"}}>
    <div style={{display:"inline-grid",gridTemplateColumns:"repeat(3,1fr)",gap:4}}>
      {[1,2,3,4,5].map(r=>[1,2,3].map(c=>{const v=at(r,c);
        const isTgt=moves.some(m=>m[3]===String(r)&&m[4]===String(c));
        return <div key={`${r}${c}`} onClick={()=>active&&isTgt&&onMove(moves.find(m=>m[3]===String(r)&&m[4]===String(c)))}
          style={{width:46,height:46,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",
            background:v==="knight"?"#c0392b":v==="pawn"?"#f39c12":isTgt?"rgba(46,204,113,.3)":"#2c3e50",
            border:isTgt?"2px dashed #2ecc71":"2px solid #444",cursor:active&&isTgt?"pointer":"default",fontSize:20}}>
          {v==="knight"?"♞":v==="pawn"?"♟":""}
        </div>;
      }))}
    </div>
    <div style={{color:"#9ca3af",fontSize:11,marginTop:6}}>Captures: {cap?cap[1]:0} | Step: {step?step[1]:1}/15</div>
  </div>;
}

function LnsBoard({state,onMove,active,game}){
  const cc=(r,c)=>{const f=state.find(f=>f[0]==="cell"&&f[1]===r&&f[2]===c);return f?f[3]:null;};
  const allR=["a","b","c","d","e","f","g","h","i"],allC=["1","2","3","4","5","6","7","8","9"];
  return <div style={{display:"inline-block"}}>
    {allR.map(r=><div key={r} style={{display:"flex",gap:2,marginBottom:2}}>
      <span style={{width:12,fontSize:9,color:"#888",lineHeight:"24px"}}>{r}</span>
      {allC.map(c=>{const valid=game._vc.some(([vr,vc])=>vr===r&&vc===c);
        if(!valid)return <div key={c} style={{width:24,height:24}}/>;
        const v=cc(r,c);return <div key={c} onClick={()=>active&&!v&&onMove(["place",r,c])}
          style={{width:24,height:24,borderRadius:3,background:v==="red"?"#e74c3c":v==="blue"?"#3498db":"rgba(255,255,255,.08)",
            border:v?"1px solid rgba(255,255,255,.15)":"1px solid #555",cursor:active&&!v?"pointer":"default"}}/>;
      })}
    </div>)}
  </div>;
}

function BatBoard({state,onMove,active,game}){
  const[sel,setSel]=useState(null);const role=game.getControl(state);const moves=active?game.getLegalMoves(state):[];
  const at=(x,y)=>state.find(f=>f[0]==="cell"&&f[1]===String(x)&&f[2]===String(y));
  const click=(x,y)=>{if(!active)return;if(sel){const m=moves.find(mv=>mv[1]===String(sel[0])&&mv[2]===String(sel[1])&&mv[3]===String(x)&&mv[4]===String(y));
    if(m){onMove(m);setSel(null);return;}}const c=at(x,y);if(c&&c[4]===role)setSel([x,y]);else setSel(null);};
  return <div style={{display:"inline-block",background:"#2d3436",borderRadius:8,padding:8}}>
    {[5,4,3,2,1].map(y=><div key={y} style={{display:"flex",gap:3,marginBottom:3}}>
      {[1,2,3,4,5].map(x=>{const c=at(x,y);const isSel=sel&&sel[0]===x&&sel[1]===y;
        const isTgt=sel&&moves.some(mv=>mv[1]===String(sel[0])&&mv[2]===String(sel[1])&&mv[3]===String(x)&&mv[4]===String(y));
        return <div key={x} onClick={()=>click(x,y)} style={{width:40,height:40,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",
          background:c?(c[4]==="red"?"#c0392b":"#27ae60"):"#636e72",
          border:isSel?"3px solid #f1c40f":isTgt?"3px solid #81ecec":"2px solid #444",
          color:"#fff",fontWeight:700,fontSize:16,cursor:active?"pointer":"default"}}>{c?c[3]:""}</div>;
      })}
    </div>)}
  </div>;
}

function GameBoard({gameKey,state,onMove,active,game}){
  const p={state,onMove,active,game};
  switch(gameKey){
    case"tictactoe":case"suicide":return<TTTBoard {...p}/>;
    case"connect4":case"notconnect4":return<C4Board {...p}/>;
    case"alquerque":return<AlqBoard {...p}/>;
    case"battleofnumbers":return<BatBoard {...p}/>;
    case"breakthrough":return<BrkBoard {...p}/>;
    case"buttonsandlights":return<BLBoard {...p}/>;
    case"hamilton":return<HamBoard {...p}/>;
    case"hex":return<HexBoard {...p}/>;
    case"hunter":return<HntBoard {...p}/>;
    case"lines":return<LnsBoard {...p}/>;
    default:return<pre style={{color:"#ccc",fontSize:10}}>{JSON.stringify(state,null,1)}</pre>;
  }
}

// ============================================================
// LLM + RANDOM AI
// ============================================================
function countTokens(t){return Math.ceil(t.split(/\s+/).length*1.3);}

async function llmMove(game,gk,state,model){
  const ctrl=game.getControl(state),legal=game.getLegalMoves(state);
  if(!legal.length)return null;
  const formatted=legal.map((m,i)=>`${i}: ${game.formatMove(m)}`);
  try{
    const resp=await fetch("/api/llm/move",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({model,game_name:game.name,game_desc:game.desc,board:state,role:ctrl,
        legal_moves:legal,legal_moves_formatted:formatted})});
    const data=await resp.json();
    const idx=data.move_index??0;
    return{move:legal[idx>=0&&idx<legal.length?idx:0],reason:data.reason||"",
      time:data.time||0,tokens:data.tokens||{input:0,output:0}};
  }catch(e){return{move:legal[Math.floor(Math.random()*legal.length)],reason:"API error: "+e.message,time:0,tokens:{input:0,output:0}};}
}

function randomAI(game,state){
  const legal=game.getLegalMoves(state);if(!legal.length)return null;
  return{move:legal[Math.floor(Math.random()*legal.length)],reason:"Random",time:0,tokens:{input:0,output:0}};
}

// ============================================================
// MAIN APP
// ============================================================
const GAME_LIST=Object.keys(GAME_DEFS);
const MODELS=[{id:"claude-sonnet-4-20250514",name:"Claude Sonnet 4"},{id:"random",name:"Random AI (Demo)"}];

export default function App(){
  const[screen,setScreen]=useState("menu");
  const[selGame,setSelGame]=useState(null);
  const[gState,setGState]=useState(null);
  const[players,setPlayers]=useState({});
  const[log,setLog]=useState([]);
  const[moveLog,setMoveLog]=useState([]);
  const[matchId,setMatchId]=useState("");
  const[thinking,setThinking]=useState(false);
  const[result,setResult]=useState(null);
  const[totTok,setTotTok]=useState({i:0,o:0});
  const logRef=useRef(null);
  const busy=useRef(false);

  useEffect(()=>{if(logRef.current)logRef.current.scrollTop=logRef.current.scrollHeight;},[log]);
  const game=selGame?GAME_DEFS[selGame]:null;

  const startGame=async()=>{
    const s=game.initState();setGState(s);setLog([`🎮 ${game.name} started`]);
    setMoveLog([]);setResult(null);setTotTok({i:0,o:0});busy.current=false;
    // Create match in DB
    const mid=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
    setMatchId(mid);
    try{
      const r=await fetch("/api/match",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({game:selGame,player1_model:players[game.roles[0]]||"human",
          player2_model:players[game.roles[1]]||players[game.roles[0]]||"human"})});
      const d=await r.json();if(d.match_id)setMatchId(d.match_id);
    }catch(e){console.log("DB offline, using local ID");}
    setScreen("play");
  };

  const addRec=(role,move,valid,win,model,time,board,legals,reason,tok)=>{
    const rec={id:Date.now().toString(),id_match:matchId,player:role,move:JSON.stringify(move),
      valid:valid?1:0,win:win?1:0,model,execution_time:time.toFixed(4),timestamp:new Date().toISOString(),
      board:JSON.stringify(board),legalMoves:JSON.stringify(legals),game:selGame,reason,
      tokens_input:tok?.input||0,tokens_output:tok?.output||0};
    setMoveLog(p=>[...p,rec]);
    if(tok)setTotTok(p=>({i:p.i+(tok.input||0),o:p.o+(tok.output||0)}));
    // Persist to backend DB (fire-and-forget)
    fetch("/api/move",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({match_id:matchId,player:role,move,valid:valid?1:0,win:win?1:0,
        model,execution_time:time,board,legal_moves:legals,game:selGame,reason,
        tokens_input:tok?.input||0,tokens_output:tok?.output||0})}).catch(()=>{});
  };

  const processMove=useCallback(async(move,ai=null)=>{
    if(!gState||result)return;
    const role=game.getControl(gState),legals=game.getLegalMoves(gState);
    const isLegal=legals.some(m=>JSON.stringify(m)===JSON.stringify(move));
    const pType=players[role]||"human",mName=pType==="human"?"human":pType;
    if(!isLegal){
      setLog(l=>[...l,`❌ Invalid: ${game.formatMove(move)}`]);
      addRec(role,move,false,false,mName,ai?.time||0,gState,legals,ai?.reason||"Invalid",ai?.tokens);
      if(pType!=="human"&&legals.length>0){await processMove(legals[0],{...ai,reason:"Fallback"});}
      return;
    }
    const ns=game.applyMove(gState,move);
    setLog(l=>[...l,`${role}: ${game.formatMove(move)}${ai?.reason?` — "${ai.reason}"`:"" }`]);
    const term=game.checkTerminal(ns);
    addRec(role,move,true,term.over&&term.winner===role,mName,ai?.time||0,ns,legals,ai?.reason||"",ai?.tokens);
    setGState(ns);
    if(term.over){setResult(term);setLog(l=>[...l,term.winner?`🏆 ${term.winner} wins!`:"🤝 Game over"]);busy.current=false;
      fetch("/api/match/"+matchId+"/end",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({winner:term.winner||null})}).catch(()=>{});
      return;}
    const nxRole=game.getControl(ns),nxP=players[nxRole];
    if(nxP&&nxP!=="human"){await doAI(ns,nxRole,nxP);}else{busy.current=false;}
  },[gState,result,game,players,matchId,selGame]);

  const doAI=useCallback(async(state,role,modelId)=>{
    if(busy.current)return;busy.current=true;setThinking(true);
    await new Promise(r=>setTimeout(r,250));
    const ai=modelId==="random"?randomAI(game,state):await llmMove(game,selGame,state,modelId);
    setThinking(false);busy.current=false;
    if(ai&&ai.move)await processMove(ai.move,ai);
  },[game,selGame]);

  useEffect(()=>{
    if(screen!=="play"||!gState||result||thinking||busy.current)return;
    const role=game?.getControl(gState),p=players[role];
    if(p&&p!=="human")doAI(gState,role,p);
  },[screen,gState,result,thinking]);

  const dlCSV=()=>{
    // Try backend download first, fallback to local data
    window.open("/api/match/"+matchId+"/csv","_blank");
  };

  const isHuman=gState&&game&&players[game.getControl(gState)]==="human";

  if(screen==="menu"){
    const cats={classic:"Classic Games",strategy:"Strategy Games",puzzle:"Puzzles (Single Player)"};
    return <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0c0c1d,#1a1a3e,#0d0d2b)",color:"#e8e6f0",fontFamily:"'Georgia',serif"}}>
      <div style={{maxWidth:860,margin:"0 auto",padding:"36px 20px"}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <h1 style={{fontSize:36,fontWeight:300,letterSpacing:6,color:"#c4b5fd",textShadow:"0 0 40px rgba(196,181,253,.3)",margin:0}}>LLM GAMELAB</h1>
          <div style={{width:100,height:2,background:"linear-gradient(90deg,transparent,#c4b5fd,transparent)",margin:"12px auto"}}/>
          <p style={{color:"#9ca3af",fontSize:12,letterSpacing:1}}>Pit language models against each other — or challenge them yourself</p>
        </div>
        {Object.entries(cats).map(([cat,title])=><div key={cat} style={{marginBottom:28}}>
          <h2 style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:"#7c6fae",borderBottom:"1px solid #2a2a4a",paddingBottom:5,marginBottom:12}}>{title}</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(185px,1fr))",gap:9}}>
            {GAME_LIST.filter(k=>GAME_DEFS[k].category===cat).map(k=><button key={k} onClick={()=>{setSelGame(k);setPlayers({});setScreen("setup");}}
              style={{background:"rgba(30,30,60,.7)",border:"1px solid #3a3a5c",borderRadius:10,padding:"13px 11px",textAlign:"left",cursor:"pointer",color:"#d1d5db"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="#7c6fae";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="#3a3a5c";}}>
              <div style={{fontSize:14,fontWeight:600,color:"#e2e0f0",marginBottom:3}}>{GAME_DEFS[k].name}</div>
              <div style={{fontSize:10,color:"#9ca3af",lineHeight:1.3}}>{GAME_DEFS[k].desc.slice(0,85)}…</div>
              <div style={{marginTop:5,fontSize:9,color:"#7c6fae"}}>{GAME_DEFS[k].playerCount===1?"Single Player":GAME_DEFS[k].roles.join(" vs ")}</div>
            </button>)}
          </div>
        </div>)}
      </div>
    </div>;
  }

  if(screen==="setup"){
    if(!Object.keys(players).length){const p={};game.roles.forEach(r=>p[r]="human");setPlayers(p);}
    return <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0c0c1d,#1a1a3e,#0d0d2b)",color:"#e8e6f0",fontFamily:"'Georgia',serif"}}>
      <div style={{maxWidth:480,margin:"0 auto",padding:"36px 20px"}}>
        <button onClick={()=>setScreen("menu")} style={{background:"none",border:"none",color:"#7c6fae",cursor:"pointer",fontSize:12,marginBottom:18}}>← Back</button>
        <h2 style={{fontSize:24,fontWeight:300,color:"#c4b5fd",marginBottom:4}}>{game.name}</h2>
        <p style={{color:"#9ca3af",fontSize:12,marginBottom:24}}>{game.desc}</p>
        <div style={{background:"rgba(30,30,60,.6)",borderRadius:12,padding:20,border:"1px solid #3a3a5c"}}>
          <h3 style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:"#7c6fae",marginTop:0,marginBottom:14}}>Players</h3>
          {game.roles.map(role=><div key={role} style={{marginBottom:12}}>
            <label style={{display:"block",fontSize:11,color:"#bbb",marginBottom:3}}>{role}</label>
            <select value={players[role]||"human"} onChange={e=>setPlayers(p=>({...p,[role]:e.target.value}))}
              style={{width:"100%",padding:"8px",borderRadius:6,border:"1px solid #3a3a5c",background:"#1a1a3e",color:"#e2e0f0",fontSize:12}}>
              <option value="human">🧑 Human</option>
              {MODELS.map(m=><option key={m.id} value={m.id}>🤖 {m.name}</option>)}
            </select>
          </div>)}
          <button onClick={startGame} style={{width:"100%",padding:10,borderRadius:7,border:"none",background:"linear-gradient(135deg,#7c6fae,#5b4f8c)",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",marginTop:6}}>Start Game</button>
          {game.playerCount===2&&<div style={{display:"flex",gap:7,marginTop:8}}>
            <button onClick={()=>{const p={};game.roles.forEach(r=>p[r]="random");setPlayers(p);}} style={{flex:1,padding:6,borderRadius:5,border:"1px solid #3a3a5c",background:"transparent",color:"#9ca3af",fontSize:10,cursor:"pointer"}}>AI vs AI</button>
            <button onClick={()=>{const p={};p[game.roles[0]]="human";p[game.roles[1]]="random";setPlayers(p);}} style={{flex:1,padding:6,borderRadius:5,border:"1px solid #3a3a5c",background:"transparent",color:"#9ca3af",fontSize:10,cursor:"pointer"}}>Human vs AI</button>
          </div>}
        </div>
      </div>
    </div>;
  }

  const curRole=gState?game.getControl(gState):null;
  return <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0c0c1d,#1a1a3e,#0d0d2b)",color:"#e8e6f0",fontFamily:"'Georgia',serif"}}>
    <div style={{maxWidth:640,margin:"0 auto",padding:"18px 14px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <button onClick={()=>setScreen("menu")} style={{background:"none",border:"none",color:"#7c6fae",cursor:"pointer",fontSize:11}}>← Menu</button>
        <h2 style={{fontSize:16,fontWeight:400,color:"#c4b5fd",margin:0}}>{game.name}</h2>
        <div style={{display:"flex",gap:5}}>
          {moveLog.length>0&&<button onClick={dlCSV} style={{background:"rgba(46,204,113,.2)",border:"1px solid #2ecc71",borderRadius:4,color:"#2ecc71",padding:"3px 8px",cursor:"pointer",fontSize:10}}>📥 CSV</button>}
          <button onClick={startGame} style={{background:"rgba(124,111,174,.2)",border:"1px solid #7c6fae",borderRadius:4,color:"#c4b5fd",padding:"3px 8px",cursor:"pointer",fontSize:10}}>↻</button>
        </div>
      </div>
      <div style={{background:"rgba(30,30,60,.6)",borderRadius:6,padding:"7px 12px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",border:"1px solid #3a3a5c",fontSize:11}}>
        <span>{result?(result.winner?<span style={{color:"#fbbf24"}}>🏆 {result.winner} wins!</span>:<span style={{color:"#9ca3af"}}>🤝 Over</span>):
          <span>Turn: <b style={{color:"#c4b5fd"}}>{curRole}</b> ({players[curRole]==="human"?"🧑":`🤖 ${players[curRole]==="random"?"Rnd":"Claude"}`})</span>}</span>
        <span style={{color:"#636e72",fontSize:10}}>Tok: {totTok.i+totTok.o} | Mv: {moveLog.length}</span>
        {thinking&&<span style={{color:"#7c6fae",fontSize:10}}>⏳ AI…</span>}
      </div>
      <div style={{background:"rgba(30,30,60,.4)",borderRadius:10,padding:18,display:"flex",justifyContent:"center",marginBottom:10,border:"1px solid #2a2a4a",minHeight:180}}>
        {gState&&<GameBoard gameKey={selGame} state={gState} onMove={m=>processMove(m)} active={isHuman&&!thinking&&!result} game={game}/>}
      </div>
      <div ref={logRef} style={{background:"rgba(20,20,40,.6)",borderRadius:6,padding:8,maxHeight:140,overflowY:"auto",border:"1px solid #2a2a4a"}}>
        <div style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"#5a5a7a",marginBottom:4}}>Log</div>
        {log.map((e,i)=><div key={i} style={{fontSize:10,color:"#9ca3af",padding:"1px 0"}}>{e}</div>)}
      </div>
    </div>
    <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}} select:focus,button:focus{outline:none} *{box-sizing:border-box}`}</style>
  </div>;
}
