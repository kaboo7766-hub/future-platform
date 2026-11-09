import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

type Kind = "letters-ar" | "letters-en" | "multiply" | "divide" | "add" | "subtract" | "count";
type Question = { prompt: string; options: string[]; answer: string };
type GameSession = { id: string; gameId: string; active: boolean; selectedStudentUids: string[] };
const AR = "أ ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي".split(" ");
const EN = "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z".split(" ");
const shuffle = <T,>(a:T[]) => [...a].sort(() => Math.random() - .5);
const names: Record<Kind,string> = { "letters-ar":"الحروف العربية","letters-en":"الحروف الإنجليزية",multiply:"جدول الضرب",divide:"القسمة",add:"الجمع",subtract:"الطرح",count:"العدّ" };
const icons: Record<Kind,string> = { "letters-ar":"أب","letters-en":"ABC",multiply:"✖️",divide:"➗",add:"➕",subtract:"➖",count:"🍎" };
const sessionGameId = (kind: Kind) => "foundation-" + kind;
function makeQuestion(kind:Kind, grade:number, stage:number):Question {
  if (kind === "letters-ar" || kind === "letters-en") {
    const bank = kind === "letters-ar" ? AR : EN, answer = bank[Math.floor(Math.random()*bank.length)];
    return {prompt: kind === "letters-ar" ? "اختر الحرف الصحيح" : "Choose the correct letter", answer, options:shuffle([answer,...shuffle(bank.filter(x=>x!==answer)).slice(0,3)])};
  }
  if (kind === "count") {
    const n=1+Math.floor(Math.random()*Math.min(50,grade*stage*3+4)), answer=String(n);
    const set=new Set([n]); while(set.size<4)set.add(Math.max(1,n+Math.floor(Math.random()*9)-4));
    return {prompt:"🍎 🍎 🍎 عدّ واختر العدد",answer,options:shuffle([...set].map(String))};
  }
  const limit = Math.min(12, Math.max(2, grade + stage + 1));
  let a=1+Math.floor(Math.random()*limit), b=1+Math.floor(Math.random()*limit), answerNum=0, symbol="";
  if(kind==="multiply"){symbol="×";answerNum=a*b;}
  else if(kind==="divide"){symbol="÷";const divisor=b, quotient=1+Math.floor(Math.random()*limit);a=divisor*quotient;b=divisor;answerNum=quotient;}
  else if(kind==="subtract"){symbol="−";if(a<b)[a,b]=[b,a];answerNum=a-b;}
  else {symbol="+";answerNum=a+b;}
  const answer=String(answerNum),set=new Set([answerNum]);while(set.size<4)set.add(Math.max(0,answerNum+Math.floor(Math.random()*9)-4));
  return {prompt:`${a} ${symbol} ${b} = ؟`,answer,options:shuffle([...set].map(String))};
}
export default function FoundationGames({grade}:{grade:number}) {
  const { profile } = useAuth();
  const isStudent = profile?.role === "student";
  const isStaff = profile?.role === "admin" || profile?.role === "teacher";
  const [kind,setKind]=useState<Kind|null>(null),[stage,setStage]=useState(1),[unlocked,setUnlocked]=useState<Record<string,number>>({}),[q,setQ]=useState<Question|null>(null),[index,setIndex]=useState(0),[score,setScore]=useState(0),[picked,setPicked]=useState(""),[result,setResult]=useState("");
  const [classes,setClasses]=useState<{id:string;name:string}[]>([]);
  const [classId,setClassId]=useState("");
  const [students,setStudents]=useState<{uid:string;name:string}[]>([]);
  const [selectedStudents,setSelectedStudents]=useState<Record<string,string[]>>({});
  const [sessions,setSessions]=useState<GameSession[]>([]);
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState("");
  const games:Kind[]=["letters-ar","letters-en","add","subtract","multiply","divide","count"];
  const key = kind ? `${grade}-${kind}` : "";
  const open = kind ? (unlocked[key]??1) : 1;

  useEffect(()=>{
    if(!profile)return;
    if(isStudent){
      if(!profile.classId)return;
      const qy=query(collection(db,"arcadeGameSessions"),where("classId","==",profile.classId),where("active","==",true),where("selectedStudentUids","array-contains",profile.uid));
      return onSnapshot(qy,s=>setSessions(s.docs.map(d=>({id:d.id,...d.data()} as GameSession))),()=>setSessions([]));
    }
    if(!isStaff)return;
    const allowed=profile.role==="teacher"?(profile.classIds??[]):null;
    return onSnapshot(collection(db,"classes"),s=>{
      const rows=s.docs.filter(d=>!allowed||allowed.includes(d.id)).map(d=>({id:d.id,name:String(d.data().name??"فصل")}));
      setClasses(rows);setClassId(old=>old&&rows.some(r=>r.id===old)?old:(rows[0]?.id??""));
    },()=>setClasses([]));
  },[profile?.uid,profile?.role,profile?.classId,(profile?.classIds??[]).join("|")]);

  useEffect(()=>{
    if(!isStaff||!classId){setStudents([]);setSessions([]);return;}
    const stopStudents=onSnapshot(query(collection(db,"users"),where("classId","==",classId),where("role","==","student")),s=>setStudents(s.docs.map(d=>({uid:d.id,name:String(d.data().name??d.data().email??"طالب")})).sort((a,b)=>a.name.localeCompare(b.name,"ar"))),()=>setStudents([]));
    const stopSessions=onSnapshot(query(collection(db,"arcadeGameSessions"),where("classId","==",classId)),s=>setSessions(s.docs.map(d=>({id:d.id,...d.data()} as GameSession))),()=>setSessions([]));
    return ()=>{stopStudents();stopSessions();};
  },[isStaff,classId]);

  const start=(k:Kind,s:number)=>{setKind(k);setStage(s);setIndex(0);setScore(0);setPicked("");setResult("");setQ(makeQuestion(k,grade,s));};
  const choose=(v:string)=>{if(picked||!kind||!q)return;setPicked(v);const next=score+(v===q.answer?1:0);setScore(next);
    window.setTimeout(()=>{if(index===9){const passed=next>=6;setResult(passed?"🏆 ممتاز! اجتزت المرحلة":"💪 حاول مرة أخرى، تحتاج 6 إجابات صحيحة من 10");if(passed)setUnlocked(old=>({...old,[key]:Math.max(old[key]??1,Math.min(5,stage+1))}));}
    else{setIndex(i=>i+1);setQ(makeQuestion(kind,grade,stage));setPicked("");}},650);
  };
  const share=async(k:Kind)=>{
    if(!profile||!classId)return;
    const id=classId+"_"+sessionGameId(k), existing=sessions.find(s=>s.id===id), active=existing?.active===true;
    const chosen=selectedStudents[k]??[];
    if(!active&&!chosen.length){setNotice("حدد طالبًا واحدًا على الأقل لمشاركة هذه اللعبة.");return;}
    setBusy(k);setNotice("");
    try{
      await setDoc(doc(db,"arcadeGameSessions",id),{classId,gameId:sessionGameId(k),title:names[k],active:!active,selectedStudentUids:active?(existing?.selectedStudentUids??[]):chosen,openedBy:profile.uid,updatedAt:serverTimestamp(),...(!active?{openedAt:serverTimestamp()}: {})},{merge:true});
      setNotice(active?"تم إيقاف مشاركة اللعبة.":"تمت مشاركة اللعبة مع الطلاب المحددين.");
    }catch{setNotice("تعذر تغيير المشاركة. تحقق من قواعد Firestore المنشورة.");}
    finally{setBusy("");}
  };
  if(kind)return <section className="active-game"><div className="active-game-head"><h3>{names[kind]} · الصف {grade} · المرحلة {stage} من 5</h3><button className="link" onClick={()=>{setKind(null);setResult("");}}>رجوع للألعاب</button></div>
    {!result?<><div className="game-progress"><span>السؤال {index+1} من 10</span><b>⭐ {score}</b></div><div className="game-progress-track"><i style={{width:`${(index+1)*10}%`}}/></div><h3 className="big">{q?.prompt}</h3><div className="opts">{q?.options.map((v,i)=><button key={i} className={`opt ${picked?(v===q.answer?"good":v===picked?"bad":""):""}`} onClick={()=>choose(v)}>{v}</button>)}</div>{picked&&<p className="pop">{picked===q?.answer?"إجابة صحيحة 🎉":"الإجابة الصحيحة: "+q?.answer}</p>}</>:
    <><h3 className="big">{result}</h3><p>نتيجتك: {score} من 10</p><div className="lesson-game-actions"><button className="btn" onClick={()=>start(kind,stage)}>إعادة المرحلة</button>{score>=6&&stage<5&&<button className="btn" onClick={()=>start(kind,stage+1)}>المرحلة التالية ⭐</button>}<button className="link" onClick={()=>{setKind(null);setResult("");}}>قائمة الألعاب</button></div></>}
  </section>;
  if(!isStaff&&!isStudent)return null;
  const visibleForStudent=new Set(sessions.filter(s=>s.active&&s.gameId.startsWith("foundation-")).map(s=>s.gameId));
  const visibleGames=isStudent?games.filter(k=>visibleForStudent.has(sessionGameId(k))):games;
  return <section className="foundation-games">
    <div className="lesson-games-heading"><div><span>🌟 ألعاب التأسيس الأساسية</span><h3>مغامرات من 5 مراحل لكل لعبة</h3><p>{isStudent?"الألعاب التي شاركها المعلم معك فقط تظهر هنا.":"شغّل اللعبة بنفسك أو شارك كل لعبة بشكل مستقل مع الطلاب."}</p></div><div className="lesson-games-character">🚀</div></div>
    {isStaff&&<label className="arcade-field">الفصل الدراسي<select value={classId} onChange={e=>{setClassId(e.target.value);setSelectedStudents({});}}>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
    {notice&&<p className="note" role="status">{notice}</p>}
    {!visibleGames.length&&isStudent?<p className="note">لم يشارك المعلم معك لعبة حتى الآن. انتظر حتى يشاركها أثناء الحصة 😊</p>:null}
    <div className="games-grid">{visibleGames.map(k=>{
      const id=classId+"_"+sessionGameId(k), session=sessions.find(s=>s.id===id), active=!!session?.active;
      return <article className="game-card" key={k}><span className="game-icon">{icons[k]}</span><b>{names[k]}</b><small>الصف {grade} · 5 مراحل متدرجة</small>
        <div className="lesson-stage-row">{[1,2,3,4,5].map(n=><span key={n} className={n<=(unlocked[`${grade}-${k}`]??1)?"stage-open":"stage-locked"}>{n<=(unlocked[`${grade}-${k}`]??1)?"⭐":"🔒"} {n}</span>)}</div>
        <button className="btn" onClick={()=>start(k,Math.min(unlocked[`${grade}-${k}`]??1,5))}>{isStudent?"ابدأ اللعب 🚀":"تشغيل اللعبة ▶️"}</button>
        {isStaff&&<><small>{active?"🟢 تمت مشاركة اللعبة":"🔒 غير مشاركة مع الطلاب"}</small>
          {!active&&<div className="arcade-student-picker"><div className="arcade-picker-head"><b>اختر الطلاب للمشاركة</b><span>{(selectedStudents[k]??[]).length} محدد</span></div>
            <div className="arcade-picker-actions"><button type="button" className="link" onClick={()=>setSelectedStudents(old=>({...old,[k]:students.map(s=>s.uid)}))}>تحديد الكل</button><button type="button" className="link" onClick={()=>setSelectedStudents(old=>({...old,[k]:[]}))}>إلغاء التحديد</button></div>
            <div className="arcade-students">{students.map(s=><label key={s.uid}><input type="checkbox" checked={(selectedStudents[k]??[]).includes(s.uid)} onChange={e=>setSelectedStudents(old=>({...old,[k]:e.target.checked?[...(old[k]??[]),s.uid]:(old[k]??[]).filter(uid=>uid!==s.uid)}))}/>{s.name}</label>)}{!students.length&&<small>لا يوجد طلاب في هذا الفصل.</small>}</div>
          </div>}
          <button className="btn" disabled={!classId||busy===k||(!active&&!(selectedStudents[k]??[]).length)} onClick={()=>share(k)}>{busy===k?"جارٍ الحفظ...":active?"إيقاف المشاركة":"مشاركة مع الطلاب"}</button>
        </>}
      </article>;
    })}</div>
  </section>;
}
