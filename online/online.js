/* ===== Kompass-Spiele ONLINE: Konto, Freunde, Einladungen, Räume ===== */
(function(){
'use strict';
const CFG=window.ONLINE_CONFIG;const qs=new URLSearchParams(location.search);
const MOCK=qs.has('mock')||(()=>{try{return localStorage.getItem('bs-mock')==='1'}catch(e){return false}})();
if(qs.has('mock'))try{localStorage.setItem('bs-mock','1')}catch(e){}
const AVATARS=['🦊','🐼','🐯','🐸','🐵','🦁','🐨','🐰','🐶','🐱','🐲','🦄','🤖','👾','⚽','🚀','🐧','🦖','🐙','🦉'];
const PRESETS=['👋 Hallo!','🎮 Spielst du mit?','⏳ Gleich!','✅ Okay!','👍 Gut gespielt!','🎉 Gewonnen!','😅 Nochmal?','😂','❤️','👋 Tschüss!'];
const EMAIL_DOMAIN='@spieler.kompassapps.de';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const low=n=>n.toLowerCase();
const okName=n=>/^[A-Za-z0-9_]{3,16}$/.test(n);
const rid=(n=6)=>{const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<n;i++)s+=c[Math.floor(Math.random()*c.length)];return s;};
const now=()=>Date.now();
/* ---------- Backend: Firebase ---------- */
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s);});}
async function firebaseBackend(){const V='10.12.2',B=`https://www.gstatic.com/firebasejs/${V}/`;
  await loadScript(B+'firebase-app-compat.js');await Promise.all([loadScript(B+'firebase-auth-compat.js'),loadScript(B+'firebase-database-compat.js')]);
  const app=firebase.initializeApp(CFG);const db=firebase.database(),auth=firebase.auth();
  return {
    name:'firebase',
    onAuth:cb=>auth.onAuthStateChanged(u=>cb(u?u.uid:null)),
    signUp:async(name,pw)=>{const c=await auth.createUserWithEmailAndPassword(low(name)+EMAIL_DOMAIN,pw);return c.user.uid;},
    signIn:async(name,pw)=>{const c=await auth.signInWithEmailAndPassword(low(name)+EMAIL_DOMAIN,pw);return c.user.uid;},
    signOut:()=>auth.signOut(),
    get:async p=>(await db.ref(p).once('value')).val(),
    set:(p,v)=>db.ref(p).set(v),
    update:(p,o)=>db.ref(p).update(o),
    remove:p=>db.ref(p).remove(),
    push:async(p,v)=>{const r=db.ref(p).push();await r.set(v);return r.key;},
    on:(p,cb)=>{const r=db.ref(p);const h=s=>cb(s.val());r.on('value',h);return()=>r.off('value',h);},
    prefix:async(p,q)=>(await db.ref(p).orderByKey().startAt(q).endAt(q+'').limitToFirst(12).once('value')).val()||{},
    presence:(uid,data)=>{const r=db.ref('presence/'+uid);db.ref('.info/connected').on('value',s=>{if(!s.val())return;r.onDisconnect().update({online:false,last:firebase.database.ServerValue.TIMESTAMP});r.update({...data,online:true,last:firebase.database.ServerValue.TIMESTAMP});});},
    inc:(p,n=1)=>db.ref(p).set(firebase.database.ServerValue.increment(n)).catch(()=>{}),
    errText:e=>({'auth/email-already-in-use':'Diesen Namen gibt es schon.','auth/invalid-credential':'Name oder Passwort falsch.','auth/wrong-password':'Name oder Passwort falsch.','auth/user-not-found':'Diesen Namen gibt es nicht.','auth/weak-password':'Das Passwort braucht mindestens 6 Zeichen.','auth/too-many-requests':'Zu viele Versuche – warte kurz.','auth/network-request-failed':'Keine Internetverbindung.'}[e&&e.code]||('Fehler: '+(e&&e.message||e)))};}
/* ---------- Backend: Test-Speicher (nur zum Ausprobieren, ?mock=1) ---------- */
function mockBackend(){const K='bs-mockdb';const read=()=>{try{return JSON.parse(localStorage.getItem(K))||{}}catch(e){return{}}};const write=d=>{localStorage.setItem(K,JSON.stringify(d));fire();};
  const parts=p=>p.split('/').filter(Boolean);const getP=(d,p)=>parts(p).reduce((o,k)=>o==null?undefined:o[k],d);
  const setP=(d,p,v)=>{const ks=parts(p);let o=d;for(let i=0;i<ks.length-1;i++){if(typeof o[ks[i]]!=='object'||o[ks[i]]==null)o[ks[i]]={};o=o[ks[i]];}if(v==null)delete o[ks[ks.length-1]];else o[ks[ks.length-1]]=JSON.parse(JSON.stringify(v));};
  const subs=new Set();let last={};const fire=()=>{const d=read();for(const s of subs){const v=JSON.stringify(getP(d,s.p)??null);if(v!==s.last){s.last=v;s.cb(JSON.parse(v));}}};
  addEventListener('storage',e=>{if(e.key===K)fire();});setInterval(fire,700);
  let authCb=null;const uidS=()=>sessionStorage.getItem('bs-mockuid');
  return {name:'mock',onAuth:cb=>{authCb=cb;setTimeout(()=>cb(uidS()),0);},
    signUp:async(name,pw)=>{const d=read();d._auth=d._auth||{};if(d._auth[low(name)])throw{code:'auth/email-already-in-use'};if(pw.length<6)throw{code:'auth/weak-password'};const uid='u'+rid(10);d._auth[low(name)]={uid,pw};write(d);sessionStorage.setItem('bs-mockuid',uid);setTimeout(()=>authCb&&authCb(uid),0);return uid;},
    signIn:async(name,pw)=>{const a=(read()._auth||{})[low(name)];if(!a||a.pw!==pw)throw{code:'auth/invalid-credential'};sessionStorage.setItem('bs-mockuid',a.uid);setTimeout(()=>authCb&&authCb(a.uid),0);return a.uid;},
    signOut:async()=>{sessionStorage.removeItem('bs-mockuid');authCb&&authCb(null);},
    get:async p=>getP(read(),p)??null,
    set:async(p,v)=>{const d=read();setP(d,p,v);write(d);},
    update:async(p,o)=>{const d=read();for(const [k,v] of Object.entries(o))setP(d,p.replace(/\/$/,'')+'/'+k,v);write(d);},
    remove:async p=>{const d=read();setP(d,p,null);write(d);},
    push:async(p,v)=>{const k='k'+now().toString(36)+rid(4);const d=read();setP(d,p+'/'+k,v);write(d);return k;},
    on:(p,cb)=>{const s={p,cb,last:undefined};subs.add(s);setTimeout(()=>{const v=JSON.stringify(getP(read(),p)??null);s.last=v;cb(JSON.parse(v));},0);return()=>subs.delete(s);},
    prefix:async(p,q)=>{const o=getP(read(),p)||{};const r={};Object.keys(o).filter(k=>k.startsWith(q)).sort().slice(0,12).forEach(k=>r[k]=o[k]);return r;},
    presence:(uid,data)=>{const up=()=>{const d=read();setP(d,'presence/'+uid,{...(getP(d,'presence/'+uid)||{}),...data,online:true,last:now()});write(d);};up();addEventListener('beforeunload',()=>{const d=read();setP(d,'presence/'+uid+'/online',false);localStorage.setItem(K,JSON.stringify(d));});},
    inc:async(p,n=1)=>{const d=read();setP(d,p,(getP(d,p)||0)+n);write(d);},
    errText:e=>({'auth/email-already-in-use':'Diesen Namen gibt es schon.','auth/invalid-credential':'Name oder Passwort falsch.','auth/weak-password':'Das Passwort braucht mindestens 6 Zeichen.'}[e&&e.code]||'Fehler')};}
/* ---------- Zustand ---------- */
const O=window.ONLINE={available:!!(CFG||MOCK),me:null,friends:{},presence:{},requests:{},invites:{},blocks:{},msgs:{},listeners:{},B:null};
const emit=(ev,d)=>(O.listeners[ev]||[]).forEach(f=>{try{f(d)}catch(e){console.error(e)}});
O.on=(ev,f)=>{(O.listeners[ev]=O.listeners[ev]||[]).push(f);};
let unsub=[];const presUnsub={};
O.ready=(async()=>{if(!O.available)return false;try{O.B=MOCK?mockBackend():await firebaseBackend();}catch(e){console.warn('Online nicht verfügbar',e);O.available=false;return false;}
  O.B.onAuth(async uid=>{unsub.forEach(f=>f());unsub=[];Object.values(presUnsub).forEach(f=>f());for(const k in presUnsub)delete presUnsub[k];
    if(!uid){O.me=null;O.friends={};O.requests={};O.invites={};emit('change');return;}
    const prof=await O.B.get('users/'+uid);O.me={uid,name:prof?.name||'?',av:prof?.av||'🦊'};
    O.B.presence(uid,{name:O.me.name,av:O.me.av,game:GAME.id||null,title:GAME.title||null,room:null});
    unsub.push(O.B.on('friends/'+uid,v=>{O.friends=v||{};watchPresence();emit('change');}));
    unsub.push(O.B.on('requests/'+uid,v=>{O.requests=v||{};emit('change');}));
    unsub.push(O.B.on('blocks/'+uid,v=>{O.blocks=v||{};emit('change');}));
    unsub.push(O.B.on('invites/'+uid,v=>{const old=O.invites;O.invites=v||{};for(const [k,iv] of Object.entries(O.invites))if(!old[k]&&now()-iv.ts<10*60e3&&!O.blocks[iv.from])showInvite(k,iv);emit('change');}));
    unsub.push(O.B.on('inbox/'+uid,v=>{const old=O.msgs;O.msgs=v||{};for(const [k,m] of Object.entries(O.msgs))if(!old[k]&&now()-m.ts<60e3&&!O.blocks[m.from])toast(`${esc(m.av||'')} <b>${esc(m.name)}</b>: ${esc(PRESETS[m.k]||'')}`);}));
    emit('change');if(pendingRoom){const r=pendingRoom;pendingRoom=null;NET._autoJoin(r);}});
  return true;})();
function watchPresence(){for(const fid of Object.keys(O.friends))if(!presUnsub[fid])presUnsub[fid]=O.B.on('presence/'+fid,v=>{O.presence[fid]=v||{};emit('change');});
  for(const fid of Object.keys(presUnsub))if(!O.friends[fid]){presUnsub[fid]();delete presUnsub[fid];delete O.presence[fid];}}
/* ---------- Konto ---------- */
O.signUp=async(name,pw,av)=>{name=name.trim();if(!okName(name))throw new Error('Der Name braucht 3–16 Zeichen: nur Buchstaben (ohne ä/ö/ü), Zahlen und _');
  let uid;try{uid=await O.B.signUp(name,pw);}catch(e){throw new Error(O.B.errText(e));}
  try{await O.B.set('users/'+uid,{name,av,created:now()});await O.B.set('usernames/'+low(name),uid);}catch(e){throw new Error('Konto angelegt, aber Speichern fehlgeschlagen ('+(e.code||e.message)+'). Bitte die Datenbank-Regeln in Firebase prüfen.');}O.me={uid,name,av};emit('change');return uid;};
O.signIn=async(name,pw)=>{try{await O.B.signIn(name.trim(),pw);}catch(e){throw new Error(O.B.errText(e));}};
O.signOut=async()=>{if(O.me)await O.B.update('presence/'+O.me.uid,{online:false});await O.B.signOut();};
O.setAvatar=async av=>{O.me.av=av;await O.B.update('users/'+O.me.uid,{av});await O.B.update('presence/'+O.me.uid,{av});emit('change');};
/* ---------- Freunde ---------- */
O.search=async q=>{q=low(q.trim());if(q.length<1)return [];const r=await O.B.prefix('usernames',q);const out=[];for(const [n,uid] of Object.entries(r)){if(uid===O.me.uid)continue;const u=await O.B.get('users/'+uid);out.push({uid,name:u?.name||n,av:u?.av||'🙂'});}return out;};
O.request=async(uid)=>{if(O.friends[uid])return;const theirs=O.requests[uid];if(theirs)return O.accept(uid);await O.B.set(`requests/${uid}/${O.me.uid}`,{name:O.me.name,av:O.me.av,ts:now()});await O.B.set(`sent/${O.me.uid}/${uid}`,true);};
O.accept=async(uid)=>{const r=O.requests[uid];const u=await O.B.get('users/'+uid);await O.B.set(`friends/${O.me.uid}/${uid}`,{name:u?.name||r?.name,av:u?.av||r?.av||'🙂',since:now()});await O.B.set(`friends/${uid}/${O.me.uid}`,{name:O.me.name,av:O.me.av,since:now()});await O.B.remove(`requests/${O.me.uid}/${uid}`);await O.B.remove(`sent/${uid}/${O.me.uid}`);};
O.decline=async uid=>{await O.B.remove(`requests/${O.me.uid}/${uid}`);};
O.unfriend=async uid=>{await O.B.remove(`friends/${O.me.uid}/${uid}`);await O.B.remove(`friends/${uid}/${O.me.uid}`);};
O.block=async uid=>{await O.unfriend(uid);await O.B.remove(`requests/${O.me.uid}/${uid}`);await O.B.set(`blocks/${O.me.uid}/${uid}`,true);};
O.send=async(uid,k)=>{await O.B.push(`inbox/${uid}`,{from:O.me.uid,name:O.me.name,av:O.me.av,k,ts:now()});};
O.status=fid=>{const p=O.presence[fid]||{};if(!p.online||now()-(p.last||0)>36e5*12&&!p.online)return {on:false,txt:'offline',cls:'off'};if(p.room&&p.title)return {on:true,txt:'spielt '+p.title,cls:'game',room:p.room,game:p.game};if(p.title)return {on:true,txt:'in '+p.title,cls:'on'};return {on:true,txt:'online',cls:'on'};};
/* ---------- Spiel-Kontext ---------- */
const GAME={id:null,title:null,url:null};
const path=location.pathname.replace(/index\.html$/,'');const seg=path.split('/').filter(Boolean);
GAME.id=seg.length?seg[seg.length-1]:null;GAME.title=GAME.id?(document.title||GAME.id):null;
/* ---------- Räume (für die Spiele) ---------- */
let pendingRoom=qs.get('room');
const NET=window.NET={room:null,roomId:null,seat:-1,_opts:null,_unsub:null,
  supported:()=>O.available,
  setup(opts){this._opts=opts;},// opts:{game,title,min,max,onStart(room,seat),onState(state,room),onPlayers(room)}
  async create(){await O.ready;if(!O.me){openPanel('login');return null;}const o=this._opts;const id=rid();
    await O.B.set('rooms/'+id,{game:GAME.id,title:o.title||GAME.title,host:O.me.uid,max:o.max||2,min:o.min||2,status:'wait',created:now(),players:{[O.me.uid]:{name:O.me.name,av:O.me.av,seat:0,ts:now()}}});
    this._enter(id,0);lobby(true);return id;},
  async _autoJoin(id){await O.ready;if(!O.me){pendingRoom=id;openPanel('login','Melde dich an, um dem Spiel beizutreten.');return;}
    if(!this._opts){toast('Dieses Spiel kann man noch nicht online spielen.');return;}const r=await O.B.get('rooms/'+id);if(!r){toast('Dieser Raum existiert nicht mehr.');return;}
    const mine=r.players&&r.players[O.me.uid];if(mine){this._enter(id,mine.seat);if(r.status==='wait')lobby(r.host===O.me.uid);return;}
    const n=Object.keys(r.players||{}).length;if(r.status!=='wait'||n>=r.max){toast('Das Spiel ist schon voll oder läuft bereits. 😕');return;}
    const used=Object.values(r.players||{}).map(p=>p.seat);let seat=0;while(used.includes(seat))seat++;
    await O.B.update(`rooms/${id}/players/${O.me.uid}`,{name:O.me.name,av:O.me.av,seat,ts:now()});this._enter(id,seat);lobby(false);},
  join(id){return this._autoJoin(id);},
  _enter(id,seat){this.roomId=id;this.seat=seat;if(this._unsub)this._unsub();let started=false,lastRev=-1;
    O.B.update('presence/'+O.me.uid,{room:id,game:GAME.id,title:this._opts.title||GAME.title});
    try{history.replaceState(null,'',location.pathname+'?room='+id);}catch(e){}
    this._unsub=O.B.on('rooms/'+id,r=>{if(!r){if(this.roomId===id){toast('Der Raum wurde geschlossen.');this.leave(true);}return;}this.room=r;this._live=r.live||{};const lj=JSON.stringify(r.live||null);const onlyLive=lj!==this._lastLive&&this._lastRoomNoLive===JSON.stringify({...r,live:null});this._lastLive=lj;this._lastRoomNoLive=JSON.stringify({...r,live:null});if(onlyLive&&started)return;updLobby();
      if(r.status==='play'&&!started){started=true;closeLobby();if(r.host===O.me.uid)O.statInc('o');this._opts.onStart&&this._opts.onStart(r,this.seat);}
      if(r.state&&r.rev!==lastRev&&started){lastRev=r.rev;if(r.by!==O.me.uid||r.forceAll)this._opts.onState&&this._opts.onState(r.state,r);}
      if(r.status==='wait'&&started){started=false;lastRev=-1;if(this._opts&&this._opts.onStart)lobby(r.host===O.me.uid);}
      if(started&&this._opts.onData){const dj=JSON.stringify(r.data||null);if(dj!==this._lastData){this._lastData=dj;this._opts.onData(r.data||{},r);}}
      this._opts.onPlayers&&this._opts.onPlayers(r);});},
  async start(){if(!this.room||this.room.host!==O.me.uid)return;await O.B.update('rooms/'+this.roomId,{status:'play',startedAt:now()});},
  seed(){const r=this.room||{};const str=(this.roomId||'x')+'|'+(r.startedAt||0);let h=2166136261;for(const c of str){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;},
  rng(seed){let a=(seed??this.seed())>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};},
  seeded(fn){const orig=Math.random;Math.random=this.rng();try{return fn();}finally{Math.random=orig;}},
  live(obj){if(!this.roomId||!O.me)return;const t=now();if(t-(this._lt||0)<110)return;this._lt=t;O.B.update('rooms/'+this.roomId+'/live',{[O.me.uid]:{...obj,t}});},
  others(){const out=[];const L=this._live||{};this._gh=this._gh||{};for(const p of this.players()){if(!O.me||p.uid===O.me.uid)continue;const d=L[p.uid];if(!d)continue;let g=this._gh[p.uid];if(!g){g=this._gh[p.uid]={...d};}
      const k=Math.min(1,(now()-(g._t||now()))/1000*12);g._t=now();for(const [kk,v] of Object.entries(d)){if(typeof v==='number'&&typeof g[kk]==='number'&&(kk==='x'||kk==='y')&&Math.abs(v-g[kk])<400)g[kk]+=(v-g[kk])*k;else g[kk]=v;}
      out.push({uid:p.uid,name:p.name,av:p.av,seat:p.seat,...g});}return out;},
  me(){return O.me;},
  async put(key,val){if(!this.roomId)return;await O.B.update('rooms/'+this.roomId+'/data',{[key]:val});},
  async clearData(){if(!this.roomId)return;this._lastData=null;await O.B.remove('rooms/'+this.roomId+'/data');},
  async send(state){if(!this.roomId)return;await O.B.update('rooms/'+this.roomId,{state,rev:now()+Math.random(),by:O.me.uid,forceAll:false});},
  async again(){if(!this.roomId)return;await O.B.update('rooms/'+this.roomId,{state:null,rev:0,status:'wait'});if(this.room.host===O.me.uid)lobby(true);else lobby(false);},
  async leave(silent){const id=this.roomId;if(this._unsub)this._unsub();this._unsub=null;this.roomId=null;this.room=null;this.seat=-1;closeLobby();
    try{history.replaceState(null,'',location.pathname);}catch(e){}
    if(id&&O.me){await O.B.remove(`rooms/${id}/players/${O.me.uid}`);const r=await O.B.get('rooms/'+id);if(r&&(!r.players||!Object.keys(r.players).length||r.host===O.me.uid))await O.B.remove('rooms/'+id);await O.B.update('presence/'+O.me.uid,{room:null});}},
  players(){return Object.entries(this.room?.players||{}).map(([uid,p])=>({uid,...p})).sort((a,b)=>a.seat-b.seat);},
  isHost(){return this.room&&O.me&&this.room.host===O.me.uid;},
  async invite(fid){await O.B.set(`invites/${fid}/${this.roomId}`,{from:O.me.uid,name:O.me.name,av:O.me.av,game:GAME.id,title:this._opts.title||GAME.title,ts:now()});toast('Einladung gesendet! 📨');}};
/* ---------- Online-Wettkampf für Einzelspiele ---------- */
const RACE={on:false,done:false,iv:null,opts:null,shown:false};
NET.race=function(opts){RACE.opts=opts;if(!O.available)return;
  const mount=()=>{const m=opts.mount?document.querySelector(opts.mount):document.body;if(!m||document.getElementById('raceBtn'))return;injectCss();const d=document.createElement('div');d.className='on-card';d.id='raceBtn';d.style.marginBottom='12px';
    d.innerHTML=`<div class="on-row"><span style="font-size:28px">🏁</span><div class="on-sp"><b>Online-Wettkampf</b><div class="on-note">Spielt gleichzeitig mit Freunden – wer schafft ${opts.lower?'die beste Zeit':'die meisten Punkte'}?</div></div><button class="on-btn p">Starten</button></div>`;
    d.querySelector('button').onclick=()=>NET.create();if(opts.mount)m.prepend(d);else{const h=document.querySelector('#app > header')||document.querySelector('header');const idea=document.querySelector('#app > .idea');(idea||h).after(d);}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
  // End-Funktionen umhüllen
  for(const [fn,get] of Object.entries(opts.ends||{})){const orig=window[fn];if(typeof orig!=='function')continue;window[fn]=function(){try{if(RACE.on&&!RACE.done){const v=get.apply(null,arguments);if(v!==undefined&&v!==null)raceDone(v);}}catch(e){console.warn(e)}return orig.apply(this,arguments);};}
  NET.setup({title:opts.title,min:2,max:8,
    onStart(room,seat){NET._gh={};NET._live={};RACE.on=true;RACE.done=false;RACE.shown=false;NET.clearData&&0;closeRaceRes();try{NET.seeded(()=>opts.start());}catch(e){console.error(e)}raceBoard();clearInterval(RACE.iv);
      RACE.iv=setInterval(()=>{if(!RACE.on||RACE.done)return;let v=0;try{v=opts.score();}catch(e){}if(v!=null&&v!==RACE.last){RACE.last=v;NET.put('sc/'+O.me.uid,{s:v,d:false,n:O.me.name,a:O.me.av});}},1000);
      NET.put('sc/'+O.me.uid,{s:0,d:false,n:O.me.name,a:O.me.av});},
    onData(d){raceBoard(d);if(opts.onData)try{opts.onData(d)}catch(e){console.warn(e)}},
    onPlayers(r){if(r.status==='wait'&&RACE.on){RACE.on=false;clearInterval(RACE.iv);const b=document.getElementById('raceBoard');if(b)b.remove();}}});};
/* ---------- Online ZUSAMMEN spielen (gemeinsame Welt) ---------- */
NET.coop=function(opts){if(!O.available)return;
  const mount=()=>{const m=opts.mount?document.querySelector(opts.mount):document.body;if(!m||document.getElementById('raceBtn'))return;injectCss();const d=document.createElement('div');d.className='on-card';d.id='raceBtn';d.style.marginBottom='12px';
    d.innerHTML=`<div class="on-row"><span style="font-size:28px">👥</span><div class="on-sp"><b>${esc(opts.label||'Online zusammen spielen')}</b><div class="on-note">${esc(opts.note||'Alle spielen gemeinsam in derselben Welt.')}</div></div><button class="on-btn p">Starten</button></div>`;
    d.querySelector('button').onclick=()=>NET.create();if(opts.mount)m.prepend(d);else{const h=document.querySelector('#app > header')||document.querySelector('header');const idea=document.querySelector('#app > .idea');(idea||h).after(d);}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
  NET.setup({title:opts.title,min:opts.min||2,max:opts.max||4,
    onStart(room,seat){NET._gh={};NET._live={};try{NET.seeded(()=>opts.start(room,seat));}catch(e){console.error(e)}},
    onState:opts.onState,
    onData(d,r){if(opts.onData)try{opts.onData(d,r)}catch(e){console.warn(e)}},
    onPlayers(r){if(opts.onPlayers)try{opts.onPlayers(r)}catch(e){}if(r.status==='wait'&&opts.stop)try{opts.stop()}catch(e){}}});};
NET.drawGhost=function(c,o,pt,size){if(!pt)return;size=size||26;const sc=(c.getTransform?c.getTransform().a:1)||1,cw=c.canvas.width/sc,ch=c.canvas.height/sc;let [x,y]=pt;const off=x<-10||y<-10||x>cw+10||y>ch+10;x=Math.max(14,Math.min(cw-14,x));y=Math.max(size/2+16,Math.min(ch-14,y));
  c.save();c.globalAlpha=off?.55:.9;c.font=size+'px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(o.av||'🙂',x,y);c.font='900 11px Nunito,sans-serif';const t=(off?(pt[1]<0?'▲ ':pt[1]>ch?'▼ ':''):'')+o.name;const w=c.measureText(t).width+8;c.fillStyle='rgba(0,0,0,.65)';c.fillRect(x-w/2,y-size/2-17,w,14);c.fillStyle='#fff';c.fillText(t,x,y-size/2-10);c.restore();};
NET.ghostify=function(o){const fn=o.draw||'draw';const orig=window[fn];if(typeof orig!=='function')return;window[fn]=function(){const r=orig.apply(this,arguments);try{if(NET.active()){const p=o.pos();if(p)NET.live(p);const c=typeof o.ctx==='function'?o.ctx():o.ctx;if(c)for(const g of NET.others()){if(o.paint)o.paint(c,g);else NET.drawGhost(c,g,o.map(g),o.size);}}}catch(e){}return r;};};
NET.raceOn=()=>!!(typeof RACE!=='undefined'&&RACE.on&&NET.active());
/* Gleichschritt: alle beantworten dieselbe Frage, dann geht es gemeinsam weiter */
NET.step=function(i,ok,maxMs){if(!NET.active())return Promise.resolve();const me=O.me.uid,key='qa/'+String(i).padStart(4,'0');NET.put(key+'/'+me,ok?1:0);
  injectCss();let bar=document.getElementById('stepBar');if(!bar){bar=document.createElement('div');bar.id='stepBar';bar.style.cssText='position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:9998;background:rgba(15,18,28,.92);color:#fff;border-radius:16px;padding:8px 14px;font:800 14px Nunito,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35);max-width:94vw;text-align:center';document.body.appendChild(bar);}
  const t0=Date.now();maxMs=maxMs||25000;
  return new Promise(res=>{const tick=()=>{const d=(NET.room&&NET.room.data&&NET.room.data.qa&&NET.room.data.qa[String(i).padStart(4,'0')])||{};const sc=(NET.room&&NET.room.data&&NET.room.data.sc)||{};const pl=NET.players().filter(p=>p.uid===me||!(sc[p.uid]&&sc[p.uid].d));
      const all=pl.every(p=>d[p.uid]!=null);const left=Math.max(0,Math.ceil((maxMs-(Date.now()-t0))/1000));
      bar.innerHTML=pl.map(p=>`${esc(p.av||'')} ${esc(p.name)} ${d[p.uid]==null?'⏳':d[p.uid]?'✅':'❌'}`).join(' &nbsp;·&nbsp; ')+(all?'':`<div style="font-size:11px;opacity:.75;font-weight:700">Warte auf die anderen … ${left}s</div>`);
      if(all||Date.now()-t0>maxMs){setTimeout(()=>{bar.remove();res();},all?1300:0);return;}setTimeout(tick,250);};tick();});};
/* Ereignisse für Rundenspiele: in Reihenfolge, eigene werden übersprungen */
NET.evReset=function(){this._evDone=0;};
NET.emit=function(ev){if(!NET.active())return;const n=this._evDone||0;this._evDone=n+1;NET.put('e/'+String(n).padStart(5,'0'),{...ev,by:O.me.uid});};
NET.evPump=function(fn){const d=(NET.room&&NET.room.data&&NET.room.data.e)||{};let n=this._evDone||0;while(d[String(n).padStart(5,'0')]){const ev=d[String(n).padStart(5,'0')];n++;this._evDone=n;if(ev.by!==O.me.uid){try{fn(ev);}catch(e){console.warn(e);}}}};
NET.myUid=()=>O.me&&O.me.uid;
NET.active=()=>!!(NET.roomId&&NET.room&&NET.room.status==='play');
function raceDone(v){RACE.done=true;clearInterval(RACE.iv);NET.put('sc/'+O.me.uid,{s:v,d:true,n:O.me.name,a:O.me.av});toast('🏁 Fertig! Warte auf die anderen …');}
NET.raceDone=v=>{if(RACE.on&&!RACE.done)raceDone(v);};NET._race=RACE;
function raceBoard(d){if(!RACE.on)return;injectCss();d=d||(NET.room&&NET.room.data)||{};const sc=d.sc||{};const lower=RACE.opts.lower;const unit=RACE.opts.unit||'';
  const pl=NET.players().map(p=>({...p,...(sc[p.uid]||{s:0,d:false})}));pl.sort((a,b)=>(lower?(a.d?a.s:1e12)-(b.d?b.s:1e12):b.s-a.s));
  let b=document.getElementById('raceBoard');if(!b){b=document.createElement('div');b.id='raceBoard';b.style.cssText='position:fixed;left:8px;top:8px;z-index:85;background:var(--card,#1b1f27);border:2px solid var(--acc,#ff8a1a);border-radius:14px;padding:6px 10px;font-size:13px;max-width:200px;box-shadow:0 6px 18px #0007;opacity:.93;cursor:pointer';b.onclick=()=>b.classList.toggle('mini');document.body.appendChild(b);}
  const fmt=v=>RACE.opts.fmt?RACE.opts.fmt(v):Math.round(v).toLocaleString('de-DE');
  b.innerHTML=`<b>🏁 Wettkampf</b>`+pl.map((p,i)=>`<div style="display:flex;gap:6px;align-items:center;margin-top:3px"><span>${i===0?'🥇':i===1?'🥈':i===2?'🥉':'·'}</span><span>${esc(p.av||'')}</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}${p.uid===O.me.uid?' (du)':''}</span><b>${p.d||!lower?fmt(p.s):'…'}</b>${p.d?'✓':''}</div>`).join('');
  const all=pl.length>1&&pl.every(p=>p.d);if(all&&!RACE.shown){RACE.shown=true;setTimeout(()=>raceResult(pl),900);}}
let raceRes=null;function closeRaceRes(){if(raceRes){raceRes.remove();raceRes=null;}}
function raceResult(pl){closeRaceRes();const fmt=v=>RACE.opts.fmt?RACE.opts.fmt(v):Math.round(v).toLocaleString('de-DE');const meWin=pl[0].uid===O.me.uid;
  raceRes=document.createElement('div');raceRes.className='on-ov';raceRes.innerHTML=`<div class="on-sheet" style="text-align:center"><div style="font-size:54px">${meWin?'🏆':'🏁'}</div><h2>${esc(pl[0].name)} gewinnt den Wettkampf!</h2><div class="on-list" style="text-align:left">${pl.map((p,i)=>`<div class="on-it">${['🥇','🥈','🥉'][i]||(i+1)+'.'} ${avHTML(p.av)}<div class="t"><b>${esc(p.name)}${p.uid===O.me.uid?' (du)':''}</b></div><b>${fmt(p.s)} ${esc(RACE.opts.unit||'')}</b></div>`).join('')}</div>
    <div class="on-row" style="justify-content:center;margin-top:10px">${NET.isHost()?'<button class="on-btn p" id="rcAgain">🔄 Nochmal (gleiche Gruppe)</button>':'<span class="on-note">Der Gastgeber kann eine neue Runde starten.</span>'}<button class="on-btn" id="rcLeave">Verlassen</button></div></div>`;document.body.appendChild(raceRes);
  if(meWin){try{window.confetti&&confetti();window.sWin&&sWin();}catch(e){}}
  const a=raceRes.querySelector('#rcAgain');if(a)a.onclick=async()=>{closeRaceRes();await NET.clearData();RACE.on=false;NET.again();};raceRes.querySelector('#rcLeave').onclick=()=>{closeRaceRes();RACE.on=false;const b=document.getElementById('raceBoard');if(b)b.remove();NET.leave();};}
/* ---------- Oberfläche ---------- */
const css=`.on-fab{position:fixed;right:14px;bottom:14px;z-index:80;width:56px;height:56px;border-radius:50%;border:2px solid var(--line,#333);background:var(--card,#1b1f27);color:var(--txt,#fff);font-size:26px;box-shadow:0 6px 18px #0006;cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.on-hb{position:relative}.on-hb b{position:absolute;top:-6px;right:-6px;background:#e0453a;color:#fff;font-size:11px;border-radius:999px;padding:1px 5px;font-family:system-ui}
.on-fab b{position:absolute;top:-4px;right:-4px;background:#e0453a;color:#fff;font-size:12px;border-radius:999px;padding:1px 6px;font-family:system-ui}
.on-ov{position:fixed;inset:0;z-index:90;background:#0009;display:flex;align-items:flex-end;justify-content:center}
.on-sheet{background:var(--bg,#12151b);color:var(--txt,#fff);width:min(560px,100%);max-height:88vh;overflow:auto;border-radius:22px 22px 0 0;padding:16px 16px 26px;box-shadow:0 -10px 30px #0008}
@media(min-width:700px){.on-ov{align-items:center}.on-sheet{border-radius:22px}}
.on-sheet h2{margin:0 0 10px;font-size:20px}.on-x{float:right;background:none;border:0;color:var(--mut,#aaa);font-size:24px;cursor:pointer}
.on-in{width:100%;box-sizing:border-box;font:inherit;font-size:17px;font-weight:700;padding:11px 12px;border-radius:12px;border:1px solid var(--line,#333);background:var(--bg2,#0c0e12);color:var(--txt,#fff);margin:4px 0 10px}
.on-btn{font:inherit;font-weight:800;padding:10px 14px;border-radius:12px;border:1px solid var(--line,#333);background:var(--card,#1b1f27);color:var(--txt,#fff);cursor:pointer}
.on-btn.p{background:var(--acc,#ff8a1a);border-color:var(--acc,#ff8a1a);color:var(--acc-ink,#14181e)}.on-btn.red{color:#ff6b6b}.on-btn:disabled{opacity:.45}
.on-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.on-sp{flex:1}
.on-av{width:46px;height:46px;border-radius:50%;background:var(--card2,#222833);display:flex;align-items:center;justify-content:center;font-size:26px;position:relative;flex:none}
.on-av i{position:absolute;right:-1px;bottom:-1px;width:13px;height:13px;border-radius:50%;border:2px solid var(--bg,#12151b);background:#777}.on-av i.on{background:#2fa35a}.on-av i.game{background:#2f7de1}
.on-list{display:grid;gap:8px;margin:8px 0}.on-it{display:flex;gap:10px;align-items:center;background:var(--card,#1b1f27);border:1px solid var(--line,#333);border-radius:14px;padding:8px 10px;cursor:pointer}
.on-it .t{flex:1;min-width:0}.on-it .t b{display:block}.on-it .t small{color:var(--mut,#aaa)}.on-it .t small.game{color:#5aa8ff;font-weight:800}
.on-strip{display:flex;gap:12px;overflow-x:auto;padding:4px 2px 8px;scrollbar-width:none}.on-strip::-webkit-scrollbar{display:none}
.on-fr{width:70px;flex:none;text-align:center;cursor:pointer}.on-fr .on-av{width:58px;height:58px;font-size:32px;margin:0 auto 4px}.on-fr b{display:block;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.on-fr small{display:block;font-size:11px;color:var(--mut,#aaa);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.on-fr small.game{color:#5aa8ff;font-weight:800}
.on-empty{border:2px dashed var(--line,#333);border-radius:16px;padding:16px;text-align:center;color:var(--mut,#aaa);cursor:pointer}
.on-empty b{color:var(--txt,#fff);display:block;font-size:16px;margin-bottom:4px}
.on-card{background:var(--card,#1b1f27);border:1px solid var(--line,#333);border-radius:18px;padding:14px;margin-bottom:12px}
.on-tag{display:inline-block;background:#e0453a;color:#fff;border-radius:999px;font-size:12px;padding:1px 7px;margin-left:4px}
.on-avs{display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:6px;margin:6px 0 10px}.on-avs button{font-size:24px;padding:6px 0;border-radius:12px;border:2px solid transparent;background:var(--card2,#222833);cursor:pointer}.on-avs button.on{border-color:var(--acc,#ff8a1a)}
.on-pre{display:grid;grid-template-columns:1fr 1fr;gap:6px}.on-pre button{font:inherit;font-weight:700;padding:9px;border-radius:12px;border:1px solid var(--line,#333);background:var(--card2,#222833);color:var(--txt,#fff);cursor:pointer;text-align:left}
.on-toast{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:100;background:var(--card,#1b1f27);color:var(--txt,#fff);border:2px solid var(--acc,#ff8a1a);border-radius:16px;padding:10px 14px;box-shadow:0 8px 24px #0008;max-width:92vw;font-weight:700;animation:onIn .3s}
@keyframes onIn{from{transform:translate(-50%,-30px);opacity:0}}
.on-err{color:#ff6b6b;font-weight:800;min-height:20px}.on-note{color:var(--mut,#aaa);font-size:13px}
.on-seat{display:flex;align-items:center;gap:8px;padding:6px 0}`;
function injectCss(){if(document.getElementById('on-css'))return;const s=document.createElement('style');s.id='on-css';s.textContent=css;document.head.appendChild(s);}
function toast(h,ms=3500){injectCss();const d=document.createElement('div');d.className='on-toast';d.innerHTML=h;document.body.appendChild(d);setTimeout(()=>d.remove(),ms);try{window.tone&&tone(880,.08);}catch(e){}}
O.toast=toast;
let sheet=null;function closeSheet(){if(sheet){sheet.remove();sheet=null;}}
function openSheet(html,onBind){injectCss();closeSheet();sheet=document.createElement('div');sheet.className='on-ov';sheet.innerHTML=`<div class="on-sheet"><button class="on-x" data-x>✕</button>${html}</div>`;document.body.appendChild(sheet);
  sheet.addEventListener('click',e=>{if(e.target===sheet||e.target.closest('[data-x]'))closeSheet();});onBind&&onBind(sheet);}
function avHTML(av,cls){return `<span class="on-av">${esc(av||'🙂')}${cls?`<i class="${cls}"></i>`:''}</span>`;}
function reqCount(){return Object.keys(O.requests||{}).filter(k=>!O.blocks[k]).length;}
function friendList(){return Object.entries(O.friends).filter(([id])=>!O.blocks[id]).map(([id,f])=>({id,...f,st:O.status(id),av:(O.presence[id]||{}).av||f.av})).sort((a,b)=>(b.st.on-a.st.on)||((b.st.cls==='game')-(a.st.cls==='game'))||a.name.localeCompare(b.name));}
/* Panels */
function openPanel(view,msg){if(!O.available){openSheet(`<h2>🌐 Online mit Freunden</h2><p>Der Online-Modus wird gerade eingerichtet. Bald könnt ihr hier Freunde hinzufügen und zusammen spielen!</p>`);return;}
  if(!O.me&&view!=='signup')view='login';
  if(view==='login'||view==='signup'){const su=view==='signup';let av=AVATARS[Math.floor(Math.random()*AVATARS.length)];
    openSheet(`<h2>${su?'✨ Konto erstellen':'🔑 Anmelden'}</h2>${msg?`<p>${esc(msg)}</p>`:''}<label class="on-note">Benutzername</label><input class="on-in" id="onN" maxlength="16" autocomplete="username" placeholder="z. B. Isajah_2017"><label class="on-note">Passwort ${su?'(mind. 6 Zeichen – gut merken!)':''}</label><input class="on-in" id="onP" type="password" autocomplete="${su?'new-password':'current-password'}">
      ${su?`<label class="on-note">Wähle dein Bild</label><div class="on-avs" id="onAv">${AVATARS.map(a=>`<button data-a="${a}" class="${a===av?'on':''}">${a}</button>`).join('')}</div><p class="on-note">⚠️ Benutze nicht deinen echten Nachnamen oder deine Adresse im Benutzernamen.</p>`:''}
      <div class="on-err" id="onE"></div><div class="on-row"><button class="on-btn p" id="onGo">${su?'Konto erstellen':'Anmelden'}</button><span class="on-sp"></span><button class="on-btn" id="onSw">${su?'Ich habe schon ein Konto':'Neues Konto erstellen'}</button></div>`,s=>{
      const avs=s.querySelector('#onAv');if(avs)avs.onclick=e=>{const b=e.target.closest('button');if(!b)return;av=b.dataset.a;avs.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));};
      s.querySelector('#onSw').onclick=()=>openPanel(su?'login':'signup',msg);
      const go=async()=>{const n=s.querySelector('#onN').value,p=s.querySelector('#onP').value,E=s.querySelector('#onE');E.textContent='';const b=s.querySelector('#onGo');b.disabled=true;
        try{if(su)await O.signUp(n,p,av);else await O.signIn(n,p);closeSheet();toast(su?`Willkommen, <b>${esc(n)}</b>! 🎉`:`Hallo <b>${esc(n)}</b>! 👋`);}catch(e){E.textContent=e.message;}b.disabled=false;};
      s.querySelector('#onGo').onclick=go;s.querySelector('#onP').onkeydown=e=>{if(e.key==='Enter')go();};setTimeout(()=>s.querySelector('#onN').focus(),60);});return;}
  if(view==='search'){openSheet(`<h2>➕ Freunde suchen</h2><p class="on-note">Gib den Benutzernamen deines Freundes ein.</p><input class="on-in" id="onQ" placeholder="Name eingeben …" autocomplete="off"><div class="on-list" id="onR"></div>`,s=>{
      let t=null;const q=s.querySelector('#onQ'),R=s.querySelector('#onR');const run=async()=>{const v=q.value.trim();if(!v){R.innerHTML='';return;}R.innerHTML='<p class="on-note">Suche …</p>';const res=(await O.search(v)).filter(u=>!O.blocks[u.uid]);
        const sent=await O.B.get('sent/'+O.me.uid)||{};
        R.innerHTML=res.length?res.map(u=>{const st=O.friends[u.uid]?'<span class="on-note">✅ Freund</span>':O.requests[u.uid]?`<button class="on-btn p" data-acc="${u.uid}">Annehmen</button>`:sent[u.uid]?'<span class="on-note">📨 Anfrage gesendet</span>':`<button class="on-btn p" data-add="${u.uid}">➕ Hinzufügen</button>`;return `<div class="on-it">${avHTML(u.av)}<div class="t"><b>${esc(u.name)}</b></div>${st}</div>`;}).join(''):'<p class="on-note">Niemand mit diesem Namen gefunden. Schreibweise prüfen!</p>';};
      q.oninput=()=>{clearTimeout(t);t=setTimeout(run,300);};setTimeout(()=>q.focus(),60);
      R.onclick=async e=>{const a=e.target.closest('[data-add]'),c=e.target.closest('[data-acc]');if(a){a.disabled=true;await O.request(a.dataset.add);toast('Freundschaftsanfrage gesendet! 📨');run();}if(c){await O.accept(c.dataset.acc);toast('Ihr seid jetzt Freunde! 🎉');run();}};});return;}
  if(view==='requests'){const rs=Object.entries(O.requests).filter(([id])=>!O.blocks[id]);openSheet(`<h2>📨 Freundschaftsanfragen</h2><div class="on-list" id="onRq">${rs.length?rs.map(([id,r])=>`<div class="on-it">${avHTML(r.av)}<div class="t"><b>${esc(r.name)}</b><small>möchte dein Freund sein</small></div><button class="on-btn p" data-acc="${id}">✓</button><button class="on-btn" data-dec="${id}">✕</button></div>`).join(''):'<p class="on-note">Keine neuen Anfragen.</p>'}</div>`,s=>{
      s.querySelector('#onRq').onclick=async e=>{const a=e.target.closest('[data-acc]'),d=e.target.closest('[data-dec]');if(a){await O.accept(a.dataset.acc);toast('Ihr seid jetzt Freunde! 🎉');openPanel('requests');}if(d){await O.decline(d.dataset.dec);openPanel('requests');}};});return;}
  if(view==='me'){let av=O.me.av;openSheet(`<h2>${esc(O.me.av)} ${esc(O.me.name)}</h2><label class="on-note">Dein Bild ändern</label><div class="on-avs" id="onAv">${AVATARS.map(a=>`<button data-a="${a}" class="${a===av?'on':''}">${a}</button>`).join('')}</div><div class="on-row"><button class="on-btn red" id="onOut">Abmelden</button></div>`,s=>{
      s.querySelector('#onAv').onclick=async e=>{const b=e.target.closest('button');if(!b)return;await O.setAvatar(b.dataset.a);openPanel('me');};s.querySelector('#onOut').onclick=async()=>{await O.signOut();closeSheet();};});return;}
  // Standard: Freundesliste
  const fl=friendList();openSheet(`<h2>👥 Freunde <span class="on-note">(${fl.length})</span></h2>${meBar()}<div class="on-row" style="margin:8px 0"><button class="on-btn p" data-v="search">➕ Freunde suchen</button><button class="on-btn" data-v="requests">📨 Anfragen${reqCount()?`<span class="on-tag">${reqCount()}</span>`:''}</button></div>
    <div class="on-list">${fl.length?fl.map(f=>`<div class="on-it" data-f="${f.id}">${avHTML(f.av,f.st.cls)}<div class="t"><b>${esc(f.name)}</b><small class="${f.st.cls==='game'?'game':''}">${esc(f.st.txt)}</small></div>${f.st.room?'<button class="on-btn p" data-join="'+f.id+'">Beitreten</button>':''}</div>`).join(''):emptyHTML()}</div>`,s=>bindCommon(s));}
function meBar(){return `<div class="on-it" data-v="me">${avHTML(O.me.av,'on')}<div class="t"><b>${esc(O.me.name)}</b><small>Das bist du · tippen zum Ändern</small></div></div>`;}
function emptyHTML(){return `<div class="on-empty" data-v="search"><b>Noch keine Freunde 🙁</b>Dann füge welche hinzu! Tippe hier und such nach ihrem Benutzernamen. ➕</div>`;}
function bindCommon(s){s.addEventListener('click',e=>{const v=e.target.closest('[data-v]');if(v){openPanel(v.dataset.v);return;}const j=e.target.closest('[data-join]');if(j){e.stopPropagation();joinFriend(j.dataset.join);return;}const f=e.target.closest('[data-f]');if(f)friendCard(f.dataset.f);});}
function joinFriend(fid){const st=O.status(fid);if(!st.room)return toast('Dein Freund ist gerade in keinem Spiel.');const url=`/${st.game}/?room=${st.room}`;if(location.pathname.replace(/\/$/,'').endsWith('/'+st.game)&&window.NET&&NET._opts){closeSheet();NET.join(st.room);}else location.href=url;}
function friendCard(fid){const f=O.friends[fid];if(!f)return;const st=O.status(fid);const av=(O.presence[fid]||{}).av||f.av;const canInv=NET.roomId&&NET.isHost();
  openSheet(`<div style="text-align:center"><div class="on-av" style="width:84px;height:84px;font-size:48px;margin:0 auto 6px">${esc(av)}<i class="${st.cls}"></i></div><h2 style="margin:0">${esc(f.name)}</h2><p class="${st.cls==='game'?'':'on-note'}" style="${st.cls==='game'?'color:#5aa8ff;font-weight:800':''}">${esc(st.txt)}</p></div>
    <div class="on-row" style="justify-content:center;margin-bottom:12px">${st.room?`<button class="on-btn p" data-join="${fid}">🎮 Beitreten</button>`:''}${canInv?`<button class="on-btn p" id="onInv">📨 In mein Spiel einladen</button>`:''}</div>
    <div class="on-note" style="margin-bottom:6px">Nachricht schicken:</div><div class="on-pre" id="onPre">${PRESETS.map((p,i)=>`<button data-k="${i}">${p}</button>`).join('')}</div>
    <div class="on-row" style="margin-top:14px"><button class="on-btn" data-back>‹ Zurück</button><span class="on-sp"></span><button class="on-btn red" id="onRm">Entfernen</button><button class="on-btn red" id="onBl">🚫 Blockieren</button></div>`,s=>{
    s.querySelector('[data-back]').onclick=()=>openPanel('friends');const j=s.querySelector('[data-join]');if(j)j.onclick=()=>joinFriend(fid);const inv=s.querySelector('#onInv');if(inv)inv.onclick=()=>{NET.invite(fid);};
    s.querySelector('#onPre').onclick=async e=>{const b=e.target.closest('button');if(!b)return;await O.send(fid,+b.dataset.k);toast('Gesendet: '+esc(PRESETS[+b.dataset.k]));};
    s.querySelector('#onRm').onclick=async()=>{if(confirm(f.name+' als Freund entfernen?')){await O.unfriend(fid);openPanel('friends');}};
    s.querySelector('#onBl').onclick=async()=>{if(confirm(f.name+' blockieren? Er/sie kann dir dann keine Anfragen oder Nachrichten mehr schicken.')){await O.block(fid);openPanel('friends');}};});}
function showInvite(key,iv){injectCss();const d=document.createElement('div');d.className='on-toast';d.style.pointerEvents='auto';d.innerHTML=`🎮 ${esc(iv.av||'')} <b>${esc(iv.name)}</b> lädt dich zu <b>${esc(iv.title)}</b> ein!<div class="on-row" style="margin-top:8px;justify-content:center"><button class="on-btn p">Beitreten</button><button class="on-btn">Nein danke</button></div>`;document.body.appendChild(d);
  try{window.tone&&[660,880,1100].forEach((f,k)=>tone(f,.1,k*.1));}catch(e){}
  const [yes,no]=d.querySelectorAll('button');const done=()=>{d.remove();O.B.remove(`invites/${O.me.uid}/${key}`);};
  yes.onclick=()=>{done();if(location.pathname.replace(/\/$/,'').endsWith('/'+iv.game)&&NET._opts)NET.join(key);else location.href=`/${iv.game}/?room=${key}`;};no.onclick=done;setTimeout(()=>{if(d.isConnected)d.remove();},30000);}
/* Lobby für Spiele */
let lob=null;
function lobby(isHost){injectCss();closeLobby();lob=document.createElement('div');lob.className='on-ov';lob.innerHTML=`<div class="on-sheet" id="onLob"></div>`;document.body.appendChild(lob);updLobby();}
function closeLobby(){if(lob){lob.remove();lob=null;}}
function updLobby(){if(!lob||!NET.room)return;const r=NET.room,host=NET.isHost();const pl=NET.players();const n=pl.length;const fl=friendList();
  lob.querySelector('#onLob').innerHTML=`<h2>🌐 ${esc(r.title)} – online</h2><p class="on-note">Raum-Code: <b>${esc(NET.roomId)}</b></p>
    <div class="on-card"><div class="on-note">Spieler (${n}/${r.max})</div>${pl.map(p=>`<div class="on-seat">${avHTML(p.av,'on')}<b>${esc(p.name)}</b>${p.uid===r.host?'<span class="on-note">👑 Gastgeber</span>':''}</div>`).join('')}${n<r.max?'<div class="on-seat on-note">⏳ Warte auf Mitspieler …</div>':''}</div>
    ${host&&n<r.max?`<div class="on-note">Freunde einladen:</div><div class="on-list">${fl.length?fl.map(f=>`<div class="on-it">${avHTML(f.av,f.st.cls)}<div class="t"><b>${esc(f.name)}</b><small>${esc(f.st.txt)}</small></div><button class="on-btn p" data-inv="${f.id}">📨 Einladen</button></div>`).join(''):emptyHTML()}</div>`:''}
    <div class="on-row" style="margin-top:12px">${host?`<button class="on-btn p" id="onStart" ${n>=(r.min||2)?'':'disabled'}>▶ Spiel starten</button>`:'<span class="on-note">Der Gastgeber startet gleich das Spiel …</span>'}<span class="on-sp"></span><button class="on-btn red" id="onLeave">Verlassen</button></div>`;
  const L=lob.querySelector('#onLob');L.onclick=e=>{const i=e.target.closest('[data-inv]');if(i){NET.invite(i.dataset.inv);i.disabled=true;i.textContent='✓ Eingeladen';}const v=e.target.closest('[data-v]');if(v)openPanel(v.dataset.v);};
  const st=L.querySelector('#onStart');if(st)st.onclick=()=>NET.start();L.querySelector('#onLeave').onclick=()=>{NET.leave();};}
/* Hub-Box & Freunde-Knopf */
function renderHub(){const box=document.getElementById('onlineBox');if(!box)return;injectCss();
  if(!O.available){box.innerHTML=`<div class="on-card"><b>🌐 Online mit Freunden</b><p class="on-note" style="margin:4px 0 0">Kommt bald: Konto erstellen, Freunde hinzufügen und zusammen spielen!</p></div>`;return;}
  if(!O.me){box.innerHTML=`<div class="on-card"><div class="on-row"><span style="font-size:30px">🌐</span><div class="on-sp"><b>Online mit Freunden spielen</b><div class="on-note">Erstelle ein Konto, füge Freunde hinzu und tritt ihren Spielen bei!</div></div></div><div class="on-row" style="margin-top:10px"><button class="on-btn p" data-v="signup">✨ Konto erstellen</button><button class="on-btn" data-v="login">🔑 Anmelden</button></div></div>`;
    box.onclick=e=>{const v=e.target.closest('[data-v]');if(v)openPanel(v.dataset.v);};return;}
  const fl=friendList();const rc=reqCount();
  box.innerHTML=`<div class="on-card"><div class="on-row" style="margin-bottom:8px"><div class="on-it" data-v="me" style="padding:4px 8px;border:0;background:none">${avHTML(O.me.av,'on')}<div class="t"><b>${esc(O.me.name)}</b><small>online</small></div></div><span class="on-sp"></span><button class="on-btn" data-v="requests">📨${rc?`<span class="on-tag">${rc}</span>`:''}</button><button class="on-btn p" data-v="search">➕ Freunde</button></div>
    <div class="on-note" style="font-weight:800;margin-bottom:4px">👥 Freunde (${fl.length})${fl.filter(f=>f.st.on).length?` · ${fl.filter(f=>f.st.on).length} online`:''}</div>
    ${fl.length?`<div class="on-strip">${fl.map(f=>`<div class="on-fr" data-f="${f.id}">${avHTML(f.av,f.st.cls)}<b>${esc(f.name)}</b><small class="${f.st.cls==='game'?'game':''}">${esc(f.st.txt)}</small>${f.st.room?`<button class="on-btn p" data-join="${f.id}" style="padding:3px 8px;font-size:12px;margin-top:3px">Beitreten</button>`:''}</div>`).join('')}</div>`:emptyHTML()}</div>`;
  box.onclick=null;if(!box._b){box._b=1;bindCommon(box);}}
function renderFab(){if(document.getElementById('onlineBox'))return;if(!O.available)return;injectCss();let f=document.getElementById('onFab');if(!f){f=document.createElement('button');f.id='onFab';f.title='Freunde';f.onclick=()=>openPanel('friends');const hb=document.querySelector('.hbtns');if(hb){f.className='ib on-hb';hb.prepend(f);}else{f.className='on-fab';document.body.appendChild(f);}}
  const rc=O.me?reqCount():0;const on=O.me?friendList().filter(x=>x.st.on).length:0;f.innerHTML=(O.me?'👥':'🌐')+(rc?`<b>${rc}</b>`:on?`<b style="background:#2fa35a">${on}</b>`:'');}
O.on('change',()=>{renderHub();renderFab();if(sheet&&sheet.querySelector('.on-list')&&!sheet.querySelector('#onQ')&&!sheet.querySelector('#onPre')){/* Liste live aktualisieren */const h=sheet.querySelector('h2');if(h&&h.textContent.startsWith('👥'))openPanel('friends');}updLobby();});

/* ---------- Anonyme Statistik (keine Namen, keine Konten) ---------- */
const STAT_ID=GAME.id||'start';
function dayKey(t=new Date()){return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');}
let lastAct=Date.now();['pointerdown','keydown','touchstart'].forEach(e=>addEventListener(e,()=>lastAct=Date.now(),{passive:true}));
O.statInc=(f)=>{if(!O.B||!O.B.inc||STAT_ID==='statistik')return;const d=dayKey();O.B.inc(`stats/g/${STAT_ID}/${f}`);O.B.inc(`stats/d/${d}/${STAT_ID}/${f}`);};
O.ready.then(ok=>{if(!ok||STAT_ID==='statistik'||!/^[a-z0-9-]{1,40}$/.test(STAT_ID))return;
  O.statInc('v');const now=new Date();O.B.inc(`stats/h/${now.getHours()}`);O.B.inc(`stats/w/${now.getDay()}`);O.B.inc(`stats/dev/${/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)?'handy':'computer'}`);
  setInterval(()=>{if(document.visibilityState==='visible'&&Date.now()-lastAct<120000)O.statInc('m');},60000);});
O.openPanel=openPanel;
function boot(){renderHub();renderFab();O.ready.then(ok=>{renderHub();renderFab();});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
