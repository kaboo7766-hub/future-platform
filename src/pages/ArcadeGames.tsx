import { useEffect, useMemo, useRef, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

type ArcadeId = "eightball" | "basketball" | "memory" | "maze" | "bubbles" | "racing";
type Arcade = { id: ArcadeId; title: string; icon: string; description: string };
type Session = { id: string; classId: string; gameId: ArcadeId; title: string; active: boolean; selectedStudentUids: string[] };
type ExternalGame = { id: string; title: string; url: string; description?: string; icon?: string; published?: boolean; embed?: boolean };
type ExternalSession = { id: string; classId: string; gameId: string; title: string; url: string; active: boolean; embed?: boolean; selectedStudentUids: string[] };
const ARCADES: Arcade[] = [
 { id:"basketball", title:"تحدي السلة", icon:"🏀", description:"اختر قوة التصويب وحاول تسجيل أكبر عدد" },
 { id:"memory", title:"تحدي الذاكرة", icon:"🧠", description:"اكشف البطاقات وطابق الصور المتشابهة" },
 { id:"maze", title:"المتاهة", icon:"🧩", description:"اعثر على الطريق الصحيح إلى الكنز" },
 { id:"bubbles", title:"فقاعات الألوان", icon:"🫧", description:"اختر اللون الصحيح واجمع النقاط" },
 { id:"racing", title:"سباق النجوم", icon:"🏎️", description:"تفادَ العقبات واجمع النجوم" }
];
const shuffle = <T,>(a:T[]) => [...a].sort(()=>Math.random()-.5);
type PoolBall = { id:number; x:number; y:number; vx:number; vy:number; color:string; label:string; stripe?:boolean };
const POOL_COLORS=["#f5d547","#2877d4","#d93434","#7b3fa1","#ed8c25","#299b62","#8c2433","#171717","#f5d547","#2877d4","#d93434","#7b3fa1","#ed8c25","#299b62","#8c2433"];
function EightBallPool(){
 const makeRack=():PoolBall[]=>{
  const colors=POOL_COLORS, balls:PoolBall[]=[{id:0,x:205,y:250,vx:0,vy:0,color:"#fff",label:"",stripe:false}];
  const spots=[[0,0],[1,-18],[1,18],[2,-36],[2,0],[2,36],[3,-54],[3,-18],[3,18],[3,54],[4,-72],[4,-36],[4,0],[4,36],[4,72]];
  spots.forEach(([col,dy],i)=>balls.push({id:i+1,x:600+col*31,y:250+dy,vx:0,vy:0,color:i===7?"#111":colors[i],label:String(i+1),stripe:i>=8}));
  return balls;
 };
 const ballsRef=useRef<PoolBall[]>(makeRack()),frameRef=useRef<number|null>(null);
 const [balls,setBalls]=useState<PoolBall[]>(ballsRef.current),[angle,setAngle]=useState(0),[power,setPower]=useState(55),[moving,setMoving]=useState(false),[message,setMessage]=useState("وجّه العصا واضبط القوة ثم اضغط «اضرب»."),[score,setScore]=useState(0),[turn,setTurn]=useState(1),[won,setWon]=useState(false);
 const pockets=[[35,35],[450,30],[865,35],[35,465],[450,470],[865,465]];
 const reset=()=>{ballsRef.current=makeRack();setBalls(ballsRef.current);setScore(0);setTurn(1);setWon(false);setMoving(false);setMessage("جولة جديدة! وجّه العصا واضبط القوة.");};
 useEffect(()=>{
  let alive=true;
  const tick=()=>{
   if(!alive)return;
   let active=false, pocketed=0, scratched=false;
   const next=ballsRef.current.map(b=>({...b}));
   for(let i=0;i<next.length;i++){
    const b=next[i]; if(Math.hypot(b.vx,b.vy)>.08)active=true;
    b.x+=b.vx;b.y+=b.vy;b.vx*=.986;b.vy*=.986;
    if(b.x<54||b.x>846){b.x=Math.max(54,Math.min(846,b.x));b.vx*=-.82;}
    if(b.y<54||b.y>446){b.y=Math.max(54,Math.min(446,b.y));b.vy*=-.82;}
    for(let j=i+1;j<next.length;j++){
     const o=next[j],dx=o.x-b.x,dy=o.y-b.y,dist=Math.hypot(dx,dy),min=22;
     if(dist>0&&dist<min){const nx=dx/dist,ny=dy/dist,overlap=(min-dist)/2;b.x-=nx*overlap;b.y-=ny*overlap;o.x+=nx*overlap;o.y+=ny*overlap;const rel=(b.vx-o.vx)*nx+(b.vy-o.vy)*ny;if(rel>0){b.vx-=rel*nx;b.vy-=rel*ny;o.vx+=rel*nx;o.vy+=rel*ny;}}
    }
   }
   const remaining=next.filter(b=>{
    const pocket=pockets.some(([x,y])=>Math.hypot(b.x-x,b.y-y)<32);
    if(pocket){if(b.id!==0)pocketed++;else scratched=true;return false;}return true;
   });
   if(scratched){remaining.push({id:0,x:205,y:250,vx:0,vy:0,color:"#fff",label:""});setMessage("⚠️ دخلت الكرة البيضاء؛ أُعيدت إلى مكان البداية.");}
   if(pocketed){setScore(v=>v+pocketed*10);setMessage(pocketed+" كرة دخلت الجيب! أحسنت 🎉");if(remaining.some(b=>b.id===8)===false){setWon(true);setMessage("🎱 أدخلت الكرة السوداء! فزت بالجولة.");}}
   ballsRef.current=remaining;
   if(alive){setBalls(remaining);if(active){frameRef.current=requestAnimationFrame(tick);}else{setMoving(false);}}
  };
  if(moving)frameRef.current=requestAnimationFrame(tick);
  return ()=>{alive=false;if(frameRef.current!==null)cancelAnimationFrame(frameRef.current);};
 },[moving]);
 const shoot=()=>{
  if(moving||won)return;
  const cue=ballsRef.current.find(b=>b.id===0);if(!cue){reset();return;}
  const radians=angle*Math.PI/180,speed=power*.19;
  ballsRef.current=ballsRef.current.map(b=>b.id===0?{...b,vx:Math.cos(radians)*speed,vy:Math.sin(radians)*speed}:b);
  setTurn(v=>v+1);setMessage("الكرات تتحرك...");setMoving(true);
 };
 const cue=balls.find(b=>b.id===0);
 return <div className="pool-game" dir="rtl">
  <div className="pool-game-stats"><b>🎱 8 Ball Pool</b><span>⭐ {score}</span><span>الدور {turn}</span></div>
  <svg viewBox="0 0 900 500" role="img" aria-label="طاولة 8 Ball Pool تفاعلية" className="pool-board" width="100%" style={{display:"block",maxWidth:900,margin:"0 auto"}}>
   <rect x="8" y="8" width="884" height="484" rx="32" fill="#633b24"/><rect x="30" y="30" width="840" height="440" rx="18" fill="#08784d" stroke="#d7b477" strokeWidth="10"/>
   {pockets.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="24" fill="#101010" stroke="#b58a52" strokeWidth="5"/>)}
   {cue&&<line x1={cue.x-Math.cos(angle*Math.PI/180)*105} y1={cue.y-Math.sin(angle*Math.PI/180)*105} x2={cue.x- Math.cos(angle*Math.PI/180)*25} y2={cue.y-Math.sin(angle*Math.PI/180)*25} stroke="#e5c18b" strokeWidth="7" strokeLinecap="round"/>}
   {balls.map(b=><g key={b.id}><circle cx={b.x} cy={b.y} r="11" fill={b.stripe?"#fff":b.color} stroke="#222" strokeWidth="1.5"/>{b.stripe&&<path d={`M ${b.x-9} ${b.y-4} Q ${b.x} ${b.y-8} ${b.x+9} ${b.y-4} L ${b.x+9} ${b.y+4} Q ${b.x} ${b.y+8} ${b.x-9} ${b.y+4} Z`} fill={b.color}/>}{b.label&&<text x={b.x} y={b.y+3.5} textAnchor="middle" fontSize="9" fontWeight="bold" fill={b.id===8?"white":"#111"}>{b.label}</text>}</g>)}
  </svg>
  <p className="pool-message" aria-live="polite">{message}</p>
  <div className="pool-controls" style={{display:"grid",gap:12,maxWidth:520,margin:"12px auto"}}>
   <label style={{display:"grid",gap:6}}>زاوية التصويب: {angle}°<input type="range" min="-75" max="75" value={angle} disabled={moving||won} onChange={e=>setAngle(Number(e.target.value))}/></label>
   <label style={{display:"grid",gap:6}}>قوة الضربة: {power}%<input type="range" min="10" max="100" value={power} disabled={moving||won} onChange={e=>setPower(Number(e.target.value))}/></label>
   <button className="btn" disabled={moving||won||!cue} onClick={shoot}>اضرب الكرة 🎱</button>
   <button className="link" onClick={reset}>إعادة اللعبة</button>
  </div>
  <small>الهدف: وجّه الكرة البيضاء نحو الكرات الملوّنة وأسقطها في الجيوب. أدخل الكرة السوداء للفوز.</small>
 </div>;
}

function PlayArcade({game,onExit}:{game:Arcade;onExit:()=>void}) {
 const [score,setScore]=useState(0),[round,setRound]=useState(0),[message,setMessage]=useState("ابدأ اللعب واجمع النقاط!");
 const [cards,setCards]=useState(()=>shuffle(["🍎","🚀","🐱","⭐","🍎","🚀","🐱","⭐"]));
 const [opened,setOpened]=useState<number[]>([]),[matched,setMatched]=useState<number[]>([]);
 const [target,setTarget]=useState(()=>["🔴","🔵","🟡","🟢"][Math.floor(Math.random()*4)]);
 const [power,setPower]=useState(60),[lane,setLane]=useState(1);
 const [position,setPosition]=useState(0);
 const [mazeStep,setMazeStep]=useState(0);
 const [finished,setFinished]=useState(false);
 const reset=()=>{setScore(0);setRound(0);setMessage("جولة جديدة! بالتوفيق ⭐");setOpened([]);setMatched([]);setCards(shuffle(["🍎","🚀","🐱","⭐","🍎","🚀","🐱","⭐"]));setTarget(["🔴","🔵","🟡","🟢"][Math.floor(Math.random()*4)]);setPosition(0);setMazeStep(0);setFinished(false);};
 const finishRound=(points:number,success:boolean)=>{const next=score+points;setScore(next);setRound(r=>r+1);setMessage(success?"أحسنت! حركة رائعة 🎉":"حاول مرة أخرى، أنت تستطيع 💪");if(round>=9)setFinished(true);};
 const memoryPick=(i:number)=>{if(opened.length>=2||opened.includes(i)||matched.includes(i))return;const next=[...opened,i];setOpened(next);if(next.length===2){if(cards[next[0]]===cards[next[1]]){setMatched(m=>[...m,...next]);setScore(s=>s+10);setMessage("تطابق رائع! +10 ⭐");}else setMessage("ليست متطابقة، حاول مجددًا");window.setTimeout(()=>setOpened([]),650);setRound(r=>r+1);}};
 const action=(ok:boolean,points=10)=>{finishRound(ok?points:0,ok);setTarget(["🔴","🔵","🟡","🟢"][Math.floor(Math.random()*4)]);};
 return <section className="arcade-play" dir="rtl">
  <div className="arcade-play-head"><button className="link" onClick={onExit}>← العودة للألعاب</button><b>{game.icon} {game.title}</b><strong>⭐ {score}</strong></div>
  <p className="arcade-instruction">{message}</p>
  {game.id==="eightball"&&<EightBallPool/>}
  {game.id==="basketball"&&<div className="basket-court"><div className="basket-hoop">🏀<span>🧺</span></div><div className="basket-player">🏃</div><div className="basket-ball">🏀</div></div>}
  {game.id==="basketball"&&<div className="arcade-controls"><label>قوة الرمية <input type="range" min="1" max="100" value={power} onChange={e=>setPower(Number(e.target.value))}/><b>{power}%</b></label><button className="btn" onClick={()=>action(Math.abs(power-68)<24,20)}>صوّب نحو السلة 🏀</button></div>}
  {game.id==="memory"&&<div className="arcade-memory">{cards.map((c,i)=><button key={i} className="arcade-memory-card" disabled={matched.includes(i)} onClick={()=>memoryPick(i)}>{opened.includes(i)||matched.includes(i)?c:"❔"}</button>)}</div>}
  {game.id==="maze"&&<div className="arcade-maze"><div className="maze-grid">{Array.from({length:16},(_,i)=><span key={i} className={i===mazeStep?"maze-player":i===15?"maze-goal":([2,5,6,9,12].includes(i)?"maze-wall":"")}>{i===mazeStep?"🧒":i===15?"🏆":[2,5,6,9,12].includes(i)?"🧱":""}</span>)}</div><div className="maze-buttons"><button onClick={()=>setMazeStep(s=>Math.max(0,s-4))}>⬆️</button><button onClick={()=>setMazeStep(s=>Math.max(0,s-1))}>⬅️</button><button onClick={()=>setMazeStep(s=>Math.min(15,s+4))}>⬇️</button><button onClick={()=>setMazeStep(s=>Math.min(15,s+1))}>➡️</button></div>{mazeStep===15&&<button className="btn" onClick={()=>{finishRound(20,true);setMazeStep(0);}}>وصلت للكنز! 🏆</button>}</div>}
  {game.id==="bubbles"&&<div className="arcade-bubbles"><b>اللون المطلوب: {target}</b><div>{["🔴","🔵","🟡","🟢","🟣","🟠"].map((c,i)=><button key={i} onClick={()=>action(c===target,10)}>{c}</button>)}</div></div>}
  {game.id==="racing"&&<div className="arcade-race"><div className="race-track"><span style={{left:`${18+lane*28}%`,bottom:`${position*7}%`}}>🏎️</span><b style={{left:"20%",top:"22%"}}>🚧</b><b style={{left:"72%",top:"48%"}}>⭐</b></div><div className="maze-buttons"><button onClick={()=>setLane(l=>Math.max(0,l-1))}>⬅️</button><button onClick={()=>{setPosition(p=>p+1);action(Math.random()>.25,10);}}>انطلق 🚦</button><button onClick={()=>setLane(l=>Math.min(2,l+1))}>➡️</button></div></div>}
  <div className="arcade-progress"><span>الجولات: {Math.min(round,10)} / 10</span><span>النقاط: {score}</span></div>
  {finished&&<div className="arcade-finish"><h3>أحسنت يا بطل! 🏆</h3><p>نتيجتك: {score} نقطة</p><button className="btn" onClick={reset}>العب مرة أخرى</button></div>}
 </section>;
}
export default function ArcadeGames(){
 const {profile}=useAuth();
 const [classes,setClasses]=useState<{id:string;name:string}[]>([]);
 const [classId,setClassId]=useState("");
 const [students,setStudents]=useState<{uid:string;name:string}[]>([]);
 const [selectedStudents,setSelectedStudents]=useState<string[]>([]);
 const [sessions,setSessions]=useState<Session[]>([]);
 const [externalGames,setExternalGames]=useState<ExternalGame[]>([]);
 const [externalSessions,setExternalSessions]=useState<ExternalSession[]>([]);
 const [externalTitle,setExternalTitle]=useState(""); const [externalUrl,setExternalUrl]=useState(""); const [externalDescription,setExternalDescription]=useState(""); const [externalIcon,setExternalIcon]=useState("🌐"); const [externalEmbed,setExternalEmbed]=useState(false); const [externalBusy,setExternalBusy]=useState(""); const [externalPlaying,setExternalPlaying]=useState<ExternalGame|null>(null);
 const [playing,setPlaying]=useState<Arcade|null>(null);
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState("");
 const isStaff=profile?.role==="admin"||profile?.role==="teacher";
 useEffect(()=>{
  if(!profile)return;
  if(profile.role==="student"&&profile.classId){
   const q=query(collection(db,"arcadeGameSessions"),where("classId","==",profile.classId),where("active","==",true),where("selectedStudentUids","array-contains",profile.uid));
   return onSnapshot(q,s=>setSessions(s.docs.map(d=>({id:d.id,...d.data()} as Session))),()=>setSessions([]));
  }
  if(!isStaff)return;
  const q=collection(db,"classes");
  const allowed=profile.role==="teacher"?(profile.classIds??[]):null;
  return onSnapshot(q,s=>{const list=s.docs.filter(d=>!allowed||allowed.includes(d.id)).map(d=>({id:d.id,name:String(d.data().name??"فصل")}));setClasses(list);if(!classId&&list[0])setClassId(list[0].id);},()=>setClasses([]));
 },[profile?.uid,profile?.role,profile?.classId,(profile?.classIds??[]).join("|")]);
 useEffect(()=>{
  if(!isStaff||!classId)return;
  const q=query(collection(db,"users"),where("classId","==",classId),where("role","==","student"));
  return onSnapshot(q,s=>setStudents(s.docs.map(d=>({uid:d.id,name:String(d.data().name??d.data().email??"طالب")})).sort((a,b)=>a.name.localeCompare(b.name,"ar"))),()=>setStudents([]));
 },[isStaff,classId]);
 useEffect(()=>{
  if(!isStaff||!classId)return;
  const q=query(collection(db,"arcadeGameSessions"),where("classId","==",classId));
  return onSnapshot(q,s=>setSessions(s.docs.map(d=>({id:d.id,...d.data()} as Session))),()=>setSessions([]));
 },[isStaff,classId]);
 useEffect(()=>{
  if(!profile)return;
  const q=profile.role==="student"?query(collection(db,"externalGameSessions"),where("classId","==",profile.classId??"__none__"),where("active","==",true),where("selectedStudentUids","array-contains",profile.uid)):collection(db,"externalGames");
  return onSnapshot(q,s=>{if(profile.role==="student")setExternalSessions(s.docs.map(d=>({id:d.id,...d.data()} as ExternalSession)));else setExternalGames(s.docs.map(d=>({id:d.id,...d.data()} as ExternalGame)).filter(g=>g.published!==false));},()=>{setExternalGames([]);setExternalSessions([]);});
 },[profile?.uid,profile?.role,profile?.classId]);
 useEffect(()=>{if(!isStaff||!classId)return;const q=query(collection(db,"externalGameSessions"),where("classId","==",classId));return onSnapshot(q,s=>setExternalSessions(s.docs.map(d=>({id:d.id,...d.data()} as ExternalSession))),()=>setExternalSessions([]));},[isStaff,classId]);
 const addExternalGame=async()=>{const title=externalTitle.trim(),url=externalUrl.trim();if(!title||!/^https:\/\//i.test(url)){setNotice("اكتب اسم اللعبة ورابطًا يبدأ بـ https://");return;}if(profile?.role!=="admin")return;setExternalBusy("add");try{const id=doc(collection(db,"externalGames")).id;await setDoc(doc(db,"externalGames",id),{title,url,description:externalDescription.trim().slice(0,300),icon:externalIcon.trim()||"🌐",embed:externalEmbed,published:true,createdBy:profile.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});setExternalTitle("");setExternalUrl("");setExternalDescription("");setExternalIcon("🌐");setExternalEmbed(false);setNotice("تمت إضافة اللعبة إلى المكتبة بنجاح.");}catch(e){console.error(e);setNotice("تعذرت إضافة اللعبة. تحقق من صلاحيات المدير واتصال Firestore.");}finally{setExternalBusy("");}};
 const removeExternalGame=async(game:ExternalGame)=>{if(profile?.role!=="admin"||!window.confirm("هل تريد حذف اللعبة من مكتبة المنصة؟"))return;setExternalBusy(game.id);try{await deleteDoc(doc(db,"externalGames",game.id));setNotice("تم حذف اللعبة.");}catch(e){console.error(e);setNotice("تعذر حذف اللعبة.");}finally{setExternalBusy("");}};
 const toggleExternal=async(game:ExternalGame,active:boolean)=>{if(!profile||!classId)return;const id=classId+"_"+game.id,existing=externalSessions.find(s=>s.id===id),recipients=active?(existing?.selectedStudentUids??selectedStudents):selectedStudents;if(!active&&!recipients.length){setNotice("حدد طالبًا واحدًا على الأقل قبل فتح اللعبة.");return;}setExternalBusy(id);try{await setDoc(doc(db,"externalGameSessions",id),{classId,gameId:game.id,title:game.title,url:game.url,embed:game.embed===true,active:!active,selectedStudentUids:recipients,openedBy:profile.uid,updatedAt:serverTimestamp(),...(!active?{openedAt:serverTimestamp()}: {})},{merge:true});setNotice(active?"تم إغلاق اللعبة عن الطلاب.":"تم فتح اللعبة للطلاب المحددين فقط.");}catch(e){console.error(e);setNotice("تعذر مشاركة اللعبة. تحقق من قواعد Firestore.");}finally{setExternalBusy("");}};
 const toggle=async(game:Arcade,active:boolean)=>{
  if(!profile||!classId)return;
  const id=classId+"_"+game.id;
  const existing=sessions.find(s=>s.id===id);
  const recipients=active?(existing?.selectedStudentUids??selectedStudents):selectedStudents;
  if(!active&&!recipients.length){setNotice("حدد طالبًا واحدًا على الأقل قبل فتح اللعبة.");return;}
  setBusy(id);setNotice("");
  try{
   await setDoc(doc(db,"arcadeGameSessions",id),{
    classId,gameId:game.id,title:game.title,
    active:!active,
    selectedStudentUids:recipients,
    openedBy:profile.uid,updatedAt:serverTimestamp(),
    ...(!active?{openedAt:serverTimestamp()}: {})
   },{merge:true});
   setNotice(active?"تم إغلاق اللعبة.":"تم فتح اللعبة للطلاب المحددين فقط.");
  }
  catch{setNotice("تعذر تحديث اللعبة. تحقق من قواعد Firestore الخاصة بالألعاب.");}
  finally{setBusy("");}
 };
 if(externalPlaying)return <section className="panel arcade-external-play" dir="rtl"><div className="arcade-play-head"><button className="link" onClick={()=>setExternalPlaying(null)}>← العودة للألعاب</button><b>{externalPlaying.icon||"🌐"} {externalPlaying.title}</b><a className="btn" href={externalPlaying.url} target="_blank" rel="noopener noreferrer">فتح اللعبة في نافذة جديدة ↗</a></div>{externalPlaying.embed?<iframe title={externalPlaying.title} src={externalPlaying.url} referrerPolicy="no-referrer" allow="fullscreen; autoplay; gamepad" sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups" style={{width:"100%",minHeight:"70vh",border:"1px solid var(--line)",borderRadius:16,background:"#fff"}}/>:<p className="note">اللعبة تفتح في نافذة خارجية.</p>}</section>;
 if(playing)return <PlayArcade game={playing} onExit={()=>setPlaying(null)}/>;
 if(profile?.role==="student")return <section className="panel arcade-hub"><h2>🎮 ألعابك المفتوحة</h2><p>الألعاب التي فتحها المعلم أو المدير لك فقط تظهر هنا.</p>{sessions.length===0&&externalSessions.length===0?<p className="note">لا توجد ألعاب مفتوحة لك الآن. انتظر المعلم 😊</p>:<div className="arcade-cards">{sessions.map(s=>{const game=ARCADES.find(g=>g.id===s.gameId);return game?<article className="arcade-card" key={s.id}><span>{game.icon}</span><h3>{game.title}</h3><p>{game.description}</p><button className="btn" onClick={()=>setPlaying(game)}>ابدأ اللعب 🚀</button></article>:null;})}{externalSessions.map(s=><article className="arcade-card" key={s.id}><span>🌐</span><h3>{s.title}</h3><p>لعبة خارجية شاركها المعلم معك</p><button className="btn" onClick={()=>setExternalPlaying({id:s.gameId,title:s.title,url:s.url,embed:s.embed})}>ابدأ اللعب 🚀</button></article>)}</div>}</section>;
 if(!isStaff)return null;
 return <section className="panel arcade-hub"><div className="arcade-heading"><div><span>🎮 مكتبة الألعاب</span><h2>تحكم المعلم والمدير في الألعاب</h2><p>يمكنك تشغيل أي لعبة بنفسك، أو مشاركتها بشكل مستقل مع الطلاب الذين تختارهم أثناء الحصة.</p></div><span>🏆</span></div>
 <label className="arcade-field">الفصل الدراسي<select value={classId} onChange={e=>{setClassId(e.target.value);setSelectedStudents([]);}}>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 <div className="arcade-student-picker"><div className="arcade-picker-head"><b>اختر الطلاب عند مشاركة اللعبة</b><span>{selectedStudents.length} محدد</span></div><div className="arcade-picker-actions"><button className="link" onClick={()=>setSelectedStudents(students.map(s=>s.uid))}>تحديد الكل</button><button className="link" onClick={()=>setSelectedStudents([])}>إلغاء التحديد</button></div><div className="arcade-students">{students.map(s=><label key={s.uid}><input type="checkbox" checked={selectedStudents.includes(s.uid)} onChange={e=>setSelectedStudents(old=>e.target.checked?[...old,s.uid]:old.filter(x=>x!==s.uid))}/>{s.name}</label>)}{students.length===0&&<small>لا يوجد طلاب في هذا الفصل.</small>}</div></div>
 {notice&&<p role="status" className="note">{notice}</p>}
 <div className="arcade-cards">{ARCADES.map(g=>{const id=classId+"_"+g.id,active=sessions.some(s=>s.id===id&&s.active);return <article className="arcade-card" key={g.id}><span>{g.icon}</span><h3>{g.title}</h3><p>{g.description}</p><small>{active?"🟢 تمت مشاركة اللعبة":"🔒 غير مشاركة مع الطلاب"}</small><div className="arcade-card-actions"><button className="btn" onClick={()=>setPlaying(g)}>تشغيل اللعبة ▶️</button><button className="btn" disabled={!classId||busy===id} onClick={()=>toggle(g,active)}>{busy===id?"جارٍ الحفظ...":(active?"إيقاف المشاركة":"مشاركة مع الطلاب")}</button></div></article>;})}</div>

 <section className="arcade-external-manager" dir="rtl"><div className="arcade-heading"><div><span>🌐 ألعاب من الإنترنت</span><h2>إضافة لعبة برابط خارجي</h2><p>ألصق رابط اللعبة لتظهر في مكتبة الألعاب، ثم شاركها مع طلاب محددين.</p></div><span>🔗</span></div>
 {profile?.role==="admin"&&<div className="arcade-external-form"><label className="arcade-field">اسم اللعبة<input value={externalTitle} onChange={e=>setExternalTitle(e.target.value)} maxLength={100} placeholder="اسم اللعبة"/></label><label className="arcade-field">رابط اللعبة<input type="url" dir="ltr" value={externalUrl} onChange={e=>setExternalUrl(e.target.value)} placeholder="https://example.com/game"/></label><label className="arcade-field">وصف مختصر<input value={externalDescription} onChange={e=>setExternalDescription(e.target.value)} maxLength={300}/></label><label className="arcade-field">رمز اللعبة<input value={externalIcon} onChange={e=>setExternalIcon(e.target.value)} maxLength={8}/></label><label><input type="checkbox" checked={externalEmbed} onChange={e=>setExternalEmbed(e.target.checked)}/> عرض داخل المنصة إن كان الموقع يسمح بالتضمين</label><button className="btn" disabled={externalBusy==="add"} onClick={addExternalGame}>{externalBusy==="add"?"جارٍ الإضافة...":"إضافة اللعبة +"}</button></div>}
 {externalGames.length===0&&<p className="note">لا توجد ألعاب خارجية مضافة بعد.</p>}<div className="arcade-cards">{externalGames.map(g=>{const id=classId+"_"+g.id,active=externalSessions.some(s=>s.id===id&&s.active);return <article className="arcade-card" key={g.id}><span>{g.icon||"🌐"}</span><h3>{g.title}</h3><p>{g.description||"لعبة خارجية"}</p><a href={g.url} target="_blank" rel="noopener noreferrer">معاينة الرابط ↗</a><div className="arcade-card-actions"><button className="btn" onClick={()=>setExternalPlaying(g)}>تجربة اللعبة</button>{isStaff&&<button className="btn" disabled={!classId||externalBusy===id} onClick={()=>toggleExternal(g,active)}>{active?"إغلاق عن الطلاب":"مشاركة مع الطلاب"}</button>}{profile?.role==="admin"&&<button className="link" onClick={()=>removeExternalGame(g)}>حذف</button>}</div></article>;})}</div></section> </section>;
}
