import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

type ArcadeId = "billiards" | "basketball" | "memory" | "maze" | "bubbles" | "racing";
type Arcade = { id: ArcadeId; title: string; icon: string; description: string };
type Session = { id: string; classId: string; gameId: ArcadeId; title: string; active: boolean; selectedStudentUids: string[] };
const ARCADES: Arcade[] = [
 { id:"billiards", title:"البلياردو", icon:"🎱", description:"وجّه العصا وصوّب الكرة نحو الجيوب" },
 { id:"basketball", title:"تحدي السلة", icon:"🏀", description:"اختر قوة التصويب وحاول تسجيل أكبر عدد" },
 { id:"memory", title:"تحدي الذاكرة", icon:"🧠", description:"اكشف البطاقات وطابق الصور المتشابهة" },
 { id:"maze", title:"المتاهة", icon:"🧩", description:"اعثر على الطريق الصحيح إلى الكنز" },
 { id:"bubbles", title:"فقاعات الألوان", icon:"🫧", description:"اختر اللون الصحيح واجمع النقاط" },
 { id:"racing", title:"سباق النجوم", icon:"🏎️", description:"تفادَ العقبات واجمع النجوم" }
];
const shuffle = <T,>(a:T[]) => [...a].sort(()=>Math.random()-.5);
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
  {game.id==="billiards"&&<div className="arcade-table"><div className="pool-pocket p1"/><div className="pool-pocket p2"/><div className="pool-pocket p3"/><div className="pool-pocket p4"/><div className="pool-pocket p5"/><div className="pool-pocket p6"/><span className="pool-ball white" style={{left:"28%",top:"52%"}}>⚪</span><span className="pool-ball" style={{left:"66%",top:"42%"}}>🎱</span><span className="pool-ball" style={{left:"72%",top:"60%"}}>🟡</span><span className="pool-ball" style={{left:"62%",top:"66%"}}>🔴</span></div>}
  {game.id==="billiards"&&<div className="arcade-controls"><label>زاوية التصويب <input type="range" min="0" max="100" value={power} onChange={e=>setPower(Number(e.target.value))}/></label><button className="btn" onClick={()=>action(Math.random()<(power>35&&power<85?.72:.35),15)}>اضرب الكرة 🎱</button></div>}
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
 if(playing)return <PlayArcade game={playing} onExit={()=>setPlaying(null)}/>;
 if(profile?.role==="student")return <section className="panel arcade-hub"><h2>🎮 ألعابك المفتوحة</h2><p>الألعاب التي فتحها المعلم أو المدير لك فقط تظهر هنا.</p>{sessions.length===0?<p className="note">لا توجد ألعاب مفتوحة لك الآن. انتظر المعلم 😊</p>:<div className="arcade-cards">{sessions.map(s=>{const game=ARCADES.find(g=>g.id===s.gameId);return game?<article className="arcade-card" key={s.id}><span>{game.icon}</span><h3>{game.title}</h3><p>{game.description}</p><button className="btn" onClick={()=>setPlaying(game)}>ابدأ اللعب 🚀</button></article>:null;})}</div>}</section>;
 if(!isStaff)return null;
 return <section className="panel arcade-hub"><div className="arcade-heading"><div><span>🎮 مكتبة الألعاب</span><h2>تحكم المعلم والمدير في الألعاب</h2><p>اختر الفصل والطلاب، ثم افتح اللعبة لهم أثناء الحصة. لا تظهر الألعاب لبقية الطلاب.</p></div><span>🏆</span></div>
 <label className="arcade-field">الفصل الدراسي<select value={classId} onChange={e=>{setClassId(e.target.value);setSelectedStudents([]);}}>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 <div className="arcade-student-picker"><div className="arcade-picker-head"><b>الطلاب المسموح لهم</b><span>{selectedStudents.length} محدد</span></div><div className="arcade-picker-actions"><button className="link" onClick={()=>setSelectedStudents(students.map(s=>s.uid))}>تحديد الكل</button><button className="link" onClick={()=>setSelectedStudents([])}>إلغاء التحديد</button></div><div className="arcade-students">{students.map(s=><label key={s.uid}><input type="checkbox" checked={selectedStudents.includes(s.uid)} onChange={e=>setSelectedStudents(old=>e.target.checked?[...old,s.uid]:old.filter(x=>x!==s.uid))}/>{s.name}</label>)}{students.length===0&&<small>لا يوجد طلاب في هذا الفصل.</small>}</div></div>
 {notice&&<p role="status" className="note">{notice}</p>}
 <div className="arcade-cards">{ARCADES.map(g=>{const id=classId+"_"+g.id,active=sessions.some(s=>s.id===id&&s.active);return <article className="arcade-card" key={g.id}><span>{g.icon}</span><h3>{g.title}</h3><p>{g.description}</p><small>{active?"🟢 مفتوحة للطلاب المحددين":"🔒 مغلقة"}</small><button className="btn" disabled={!classId||busy===id} onClick={()=>toggle(g,active)}>{busy===id?"جارٍ الحفظ...":(active?"إغلاق اللعبة":"فتح اللعبة للطلاب المحددين")}</button></article>;})}</div>
 </section>;
}
