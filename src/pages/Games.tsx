import { useEffect, useRef, useState } from "react";
import { collection, doc, increment, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import LessonGames from "./LessonGames";
import FoundationGames from "./FoundationGames";
import ArcadeGames from "./ArcadeGames";
import GameAccessManager from "./GameAccessManager";

interface Q { prompt: string; options: string[]; answer: string; say?: { text: string; lang: string }; visual?: string }
type GameKey = "arLetters" | "enLetters" | "arNumbers" | "enNumbers" | "count" | "math" | "memory";
const AR = "أبتثجحخدذرزسشصضطظعغفقكلمنهوي".split(""), EN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const EMOJI = ["🍎","🐱","🚗","⭐","🌙","🐟","🌳","⚽","🦋","🍓"];
const DIGITS = ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"];
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
const speak = (text: string, lang: string) => { try { const u = new SpeechSynthesisUtterance(text); u.lang = lang; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch {} };
let actx: AudioContext | null = null;
const tone = (freqs: number[]) => { try { if (!actx) actx = new AudioContext(); const c = actx; freqs.forEach((f,i) => { const t=c.currentTime+i*.12,o=c.createOscillator(),g=c.createGain();o.frequency.value=f;o.connect(g);g.connect(c.destination);g.gain.setValueAtTime(.15,t);g.gain.exponentialRampToValueAtTime(.001,t+.11);o.start(t);o.stop(t+.12); }); } catch {} };
const fmt = (n:number, ar:boolean) => ar ? String(n).replace(/\d/g, d => DIGITS[Number(d)]) : String(n);
const numberQ = (grade:number, ar:boolean):Q => {
  const max = grade === 1 ? 10 : grade === 2 ? 20 : grade === 3 ? 50 : grade === 4 ? 100 : grade === 5 ? 500 : 1000;
  const n = 1 + Math.floor(Math.random()*max), answer = fmt(n,ar);
  const values = new Set([n]); while(values.size<4) values.add(Math.max(0,n+Math.floor(Math.random()*9)-4));
  return {prompt: ar ? "اختر الرقم الصحيح" : "Choose the correct number", options:shuffle([...values].map(v=>fmt(v,ar))), answer,
    say:canSpeak?{text:String(n),lang:ar?"ar-SA":"en-US"}:undefined};
};
const letterQ = (ar:boolean):Q => { const set=ar?AR:EN,t=set[Math.floor(Math.random()*set.length)]; return {prompt:ar?"اختر الحرف الذي تسمعه":"Choose the letter you hear",options:shuffle([t,...shuffle(set.filter(x=>x!==t)).slice(0,3)]),answer:t,say:canSpeak?{text:t,lang:ar?"ar-SA":"en-US"}:undefined}; };
const countQ = (grade:number):Q => { const max=grade===1?5:grade===2?10:grade===3?15:grade===4?20:grade===5?30:50,n=1+Math.floor(Math.random()*max),emoji=EMOJI[Math.floor(Math.random()*EMOJI.length)],s=new Set([n]);while(s.size<4)s.add(Math.max(0,n+Math.floor(Math.random()*7)-3));return {prompt:"عدّ الصور واختر العدد الصحيح",options:shuffle([...s].map(String)),answer:String(n),visual:emoji,say:canSpeak?{text:String(n),lang:"ar-SA"}:undefined,}; };
const mathQ = (grade:number):Q => {
  const max=grade===1?5:grade===2?10:grade===3?20:grade===4?50:grade===5?100:500;
  const subtract=grade>=2&&Math.random()<.35; let a=1+Math.floor(Math.random()*max),b=1+Math.floor(Math.random()*(grade===1?5:max));
  if(subtract&&a<b)[a,b]=[b,a]; const ans=subtract?a-b:a+b,values=new Set([ans]);while(values.size<4)values.add(Math.max(0,ans+Math.floor(Math.random()*9)-4));
  return {prompt:`${fmt(a,true)} ${subtract?"−":"+"} ${fmt(b,true)} = ؟`,options:shuffle([...values].map(v=>fmt(v,true))),answer:fmt(ans,true)};
};

function ChoiceGame({make,onDone,grade}:{make:()=>Q;onDone:(n:number)=>void;grade:number}) {
 const [i,setI]=useState(0),[score,setScore]=useState(0),[q,setQ]=useState<Q>(make),[picked,setPicked]=useState("");
 const alive=useRef(true); useEffect(()=>()=>{alive.current=false;},[]);
 useEffect(()=>{if(q.say)speak(q.say.text,q.say.lang);},[q]);
 const pick=(o:string)=>{if(picked)return;setPicked(o);const ok=o===q.answer,ns=score+(ok?1:0);tone(ok?[660,880,1100]:[220]);setScore(ns);window.setTimeout(()=>{if(!alive.current)return;if(i===9)return onDone(ns*5);setI(i+1);setQ(make());setPicked("");},850);};
 return <div className="game-play"><div className="game-progress"><span>الصف {grade} الابتدائي</span><b>السؤال {i+1} / 10 · ⭐ {score}</b></div><div className="game-progress-track"><i style={{width:`${(i+1)*10}%`}}/></div><h3 className="big">{q.prompt}</h3>{q.say&&<button className="mini" onClick={()=>speak(q.say!.text,q.say!.lang)}>🔊 اسمع مرة أخرى</button>}<div className="opts">{q.options.map((o,k)=><button key={k} className={`opt ${picked?(o===q.answer?"good":o===picked?"bad":""):""}`} onClick={()=>pick(o)}>{o}</button>)}</div>{picked&&<p className="pop" role="status">{picked===q.answer?"أحسنت! إجابة صحيحة 🎉":"حاول مرة أخرى في السؤال القادم 💪"}</p>}</div>;
}
function CountingGame({grade,onDone}:{grade:number;onDone:(n:number)=>void}) {
 const [round,setRound]=useState(0),[score,setScore]=useState(0),[q,setQ]=useState(()=>countQ(grade)),[picked,setPicked]=useState("");
 const pick=(v:string)=>{if(picked)return;setPicked(v);const next=score+(v===q.answer?1:0);setScore(next);tone(v===q.answer?[700,900]:[220]);window.setTimeout(()=>{if(round===9)onDone(next*5);else{setRound(x=>x+1);setQ(countQ(grade));setPicked("");}},800);};
 const count=Number(q.answer);return <div><p>عدّ الأشياء الظاهرة أمامك:</p><div className="counting-pictures" aria-label={`عدد الصور ${count}`}>{Array.from({length:count},(_,i)=><span key={i}>{q.visual ?? "⭐"}</span>)}</div><div className="opts">{q.options.map(o=><button key={o} className={`opt ${picked?(o===q.answer?"good":o===picked?"bad":""):""}`} onClick={()=>pick(o)}>{o}</button>)}</div><p>السؤال {round+1} من 10 · النتيجة {score}</p></div>;
}
const games:{id:GameKey;icon:string;title:string;desc:string}[]=[
 {id:"arLetters",icon:"🔤",title:"الحروف العربية",desc:"اسمع الحرف واختره من بين الحروف"},
 {id:"enLetters",icon:"🔠",title:"الحروف الإنجليزية",desc:"تعرّف على الحروف الإنجليزية بالصوت"},
 {id:"arNumbers",icon:"🔢",title:"الأرقام العربية",desc:"تعرّف على الأرقام ٠ ١ ٢ ٣"},
 {id:"enNumbers",icon:"🔟",title:"الأرقام الإنجليزية",desc:"تعرّف على الأرقام 1 2 3"},
 {id:"count",icon:"🍎",title:"عدّ الأشياء",desc:"عدّ الصور واختر العدد الصحيح"},
 {id:"math",icon:"➕",title:"الجمع والطرح",desc:"تدريبات حسابية تتدرج حسب الصف"},
 {id:"memory",icon:"🧠",title:"لعبة الذاكرة",desc:"طابق الصور المتشابهة"}
];
export default function Games() {
 const {profile}=useAuth();const uid=profile!.uid;
 const [pts,setPts]=useState(0),[grade,setGrade]=useState(1),[game,setGame]=useState<GameKey|null>(null),[res,setRes]=useState(""),[err,setErr]=useState("");
 const [gameAccess,setGameAccess]=useState({loading:profile?.role==="student",foundation:false,arcade:false,lesson:false});
 useEffect(()=>{
  if(profile?.role!=="student"){
   setGameAccess({loading:false,foundation:true,arcade:true,lesson:true});
   return;
  }
  if(!profile.classId){
   setGameAccess({loading:false,foundation:false,arcade:false,lesson:false});
   return;
  }
  setGameAccess({loading:true,foundation:false,arcade:false,lesson:false});
  const activeArcade=query(collection(db,"arcadeGameSessions"),
   where("classId","==",profile.classId),
   where("active","==",true),
   where("selectedStudentUids","array-contains",profile.uid));
  const activeLessons=query(collection(db,"lessonGameSessions"),
   where("classId","==",profile.classId),
   where("active","==",true),
   where("selectedStudentUids","array-contains",profile.uid));
  const stopArcade=onSnapshot(activeArcade,s=>{
   const foundation=s.docs.some(d=>d.id===profile.classId+"_foundation"&&d.data().gameId==="foundation");
   const arcade=s.docs.some(d=>d.data().gameId!=="foundation");
   setGameAccess(old=>({...old,loading:false,foundation,arcade}));
  },()=>setGameAccess(old=>({...old,loading:false,foundation:false,arcade:false})));
  const stopLessons=onSnapshot(activeLessons,s=>{
   setGameAccess(old=>({...old,loading:false,lesson:!s.empty}));
  },()=>setGameAccess(old=>({...old,loading:false,lesson:false})));
  return ()=>{stopArcade();stopLessons();};
 },[profile?.uid,profile?.role,profile?.classId]);
 useEffect(()=>onSnapshot(doc(db,"points",uid),s=>setPts(s.data()?.total??0),()=>{}),[uid]);
 const finish=async(n:number)=>{setGame(null);setRes(`انتهت اللعبة! ربحت ${n} نقطة 🎉`);setErr("");if(n>0)try{await setDoc(doc(db,"points",uid),{uid,total:increment(n),updatedAt:serverTimestamp()},{merge:true});}catch{setErr("تعذّر حفظ النقاط");}};
 const badges=[{min:50,t:"🥉 نجم صاعد"},{min:200,t:"🥈 بطل صغير"},{min:500,t:"🥇 خبير المستقبل"}];
 const make=()=>game==="arLetters"?letterQ(true):game==="enLetters"?letterQ(false):game==="arNumbers"?numberQ(grade,true):game==="enNumbers"?numberQ(grade,false):mathQ(grade);
 if(profile?.role==="parent")return <section className="panel games-hub" dir="rtl"><h2>🎮 الألعاب التعليمية</h2><p className="note">الألعاب مخصصة للطلاب، ويفتحها المعلم أو المدير للطلاب المحددين أثناء الدرس.</p></section>;
 if(profile?.role==="student"&&gameAccess.loading)return <section className="panel games-hub" dir="rtl"><h2>🎮 الألعاب التعليمية</h2><p role="status">جارٍ التحقق من صلاحية الألعاب…</p></section>;
 if(profile?.role==="student"&&!gameAccess.foundation&&!gameAccess.arcade&&!gameAccess.lesson)return <section className="panel games-hub" dir="rtl"><h2>🎮 الألعاب التعليمية</h2><p className="note">الألعاب مغلقة حاليًا 🔒<br/>ستظهر الألعاب هنا عندما يفتحها المعلم أو مدير المدرسة ويختار اسمك ضمن الطلاب المسموح لهم.</p></section>;
 return <section className="panel games-hub"><div className="games-heading"><div><span className="games-kicker">نتعلّم ونلعب</span><h2>🎮 ألعاب التأسيس التفاعلية</h2><p>اختار صفّك وابدأ مغامرة الحروف والأرقام والحساب</p></div><div className="games-score">⭐ <b>{pts}</b><small>نقاطك</small></div></div>
 <label className="grade-picker">اختر الصف الدراسي<select value={grade} onChange={e=>{setGrade(Number(e.target.value));setGame(null);setRes("");}}>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>الصف {n} الابتدائي</option>)}</select></label>
 <div className="badge-row">{badges.filter(b=>pts>=b.min).map(b=><span className="chip" key={b.min}>{b.t}</span>)}</div>
 {(profile?.role==="admin"||profile?.role==="teacher")&&<GameAccessManager />}
 {profile?.role!=="student"||gameAccess.foundation ? <FoundationGames grade={grade} /> : null}
 <LessonGames />
 <ArcadeGames />

 {game&&<div className="active-game"><div className="active-game-head"><h3>{games.find(g=>g.id===game)?.title} · الصف {grade}</h3><button className="link" onClick={()=>setGame(null)}>رجوع للألعاب</button></div>
 {game==="memory"?<MemoryGame onDone={finish}/>:game==="count"?<CountingGame grade={grade} onDone={finish}/>:<ChoiceGame key={`${game}-${grade}`} make={make} onDone={finish} grade={grade}/>}
 <button className="link" onClick={()=>setGame(null)}>إنهاء اللعبة</button></div>}
 {res&&<p className="ok pop" role="status">{res}</p>}{err&&<p className="err" role="alert">{err}</p>}
 </section>;
}
function MemoryGame({onDone}:{onDone:(n:number)=>void}) {
 const [cards]=useState(()=>shuffle([...EMOJI.slice(0,8),...EMOJI.slice(0,8)])),[open,setOpen]=useState<number[]>([]),[done,setDone]=useState<number[]>([]),[moves,setMoves]=useState(0);
 const flip=(k:number)=>{if(open.length===2||open.includes(k)||done.includes(k))return;const n=[...open,k];setOpen(n);if(n.length===2){setMoves(m=>m+1);if(cards[n[0]]===cards[n[1]]){tone([660,880]);setDone(d=>[...d,...n]);setOpen([]);}else window.setTimeout(()=>setOpen([]),800);}};
 const fired=useRef(false);useEffect(()=>{if(done.length===16&&!fired.current){fired.current=true;tone([660,880,1100,1320]);onDone(20);}},[done,onDone]);
 return <div><p>المحاولات: {moves}</p><div className="mem">{cards.map((e,k)=>{const show=open.includes(k)||done.includes(k);return <button key={k} className={`opt ${show?"good":""}`} aria-label={show?e:"بطاقة مقلوبة"} onClick={()=>flip(k)}>{show?e:"❓"}</button>;})}</div></div>;
}
