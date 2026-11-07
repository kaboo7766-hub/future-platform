import { useState } from "react";

type Kind = "letters-ar" | "letters-en" | "multiply" | "divide" | "add" | "subtract" | "count";
type Question = { prompt: string; options: string[]; answer: string };
const AR = "أ ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي".split(" ");
const EN = "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z".split(" ");
const shuffle = <T,>(a:T[]) => [...a].sort(() => Math.random() - .5);
const names: Record<Kind,string> = { "letters-ar":"الحروف العربية","letters-en":"الحروف الإنجليزية",multiply:"جدول الضرب",divide:"القسمة",add:"الجمع",subtract:"الطرح",count:"العدّ" };
const icons: Record<Kind,string> = { "letters-ar":"أب","letters-en":"ABC",multiply:"✖️",divide:"➗",add:"➕",subtract:"➖",count:"🍎" };
function makeQuestion(kind:Kind, grade:number, stage:number):Question {
  if (kind === "letters-ar" || kind === "letters-en") {
    const bank = kind === "letters-ar" ? AR : EN, answer = bank[Math.floor(Math.random()*bank.length)];
    return {prompt: kind === "letters-ar" ? "اختر الحرف الصحيح" : "Choose the correct letter", answer, options:shuffle([answer,...shuffle(bank.filter(x=>x!==answer)).slice(0,3)])};
  }
  if (kind === "count") {
    const n=1+Math.floor(Math.random()*Math.min(50,grade*stage*3+4)), answer=String(n);
    const set=new Set([n]); while(set.size<4)set.add(Math.max(1,n+Math.floor(Math.random()*9)-4));
    return {prompt:"🍎 🍎 🍎  عدّ واختر العدد (تخيّل عدد الصور)",answer,options:shuffle([...set].map(String))};
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
  const [kind,setKind]=useState<Kind|null>(null),[stage,setStage]=useState(1),[unlocked,setUnlocked]=useState<Record<string,number>>({}),[q,setQ]=useState<Question|null>(null),[index,setIndex]=useState(0),[score,setScore]=useState(0),[picked,setPicked]=useState(""),[result,setResult]=useState("");
  const [selectedTable,setSelectedTable]=useState(1);
  const key = kind ? `${grade}-${kind}` : "";
  const open = kind ? (unlocked[key]??1) : 1;
  const start=(k:Kind,s:number)=>{setKind(k);setStage(s);setIndex(0);setScore(0);setPicked("");setResult("");setQ(makeQuestion(k,grade,s));};
  const choose=(v:string)=>{if(picked||!kind||!q)return;setPicked(v);const next=score+(v===q.answer?1:0);setScore(next);
    window.setTimeout(()=>{if(index===9){const passed=next>=6;setResult(passed?"🏆 ممتاز! اجتزت المرحلة":"💪 حاول مرة أخرى، تحتاج 6 إجابات صحيحة من 10");if(passed)setUnlocked(old=>({...old,[key]:Math.max(old[key]??1,Math.min(5,stage+1))}));}
    else{setIndex(i=>i+1);setQ(makeQuestion(kind,grade,stage));setPicked("");}},650);
  };
  const games:Kind[]=["letters-ar","letters-en","add","subtract","multiply","divide","count"];
  return <section className="foundation-games">
    <div className="lesson-games-heading"><div><span>🌟 ألعاب التأسيس الأساسية</span><h3>مغامرات من 5 مراحل لكل لعبة</h3><p>كل صف له مستوى مناسب، وتزداد الأسئلة صعوبة تدريجيًا من المرحلة الأولى إلى الخامسة.</p></div><div className="lesson-games-character">🚀</div></div>
    {!kind ? <div className="games-grid">{games.map(k=><article className="game-card" key={k}><span className="game-icon">{icons[k]}</span><b>{names[k]}</b><small>الصف {grade} · 5 مراحل متدرجة</small><div className="lesson-stage-row">{[1,2,3,4,5].map(n=><span key={n} className={n<= (unlocked[`${grade}-${k}`]??1)?"stage-open":"stage-locked"}>{n<=(unlocked[`${grade}-${k}`]??1)?"⭐":"🔒"} {n}</span>)}</div><button className="btn" onClick={()=>start(k,Math.min(unlocked[`${grade}-${k}`]??1,5))}>ابدأ اللعب 🚀</button></article>)}</div> :
    <div className="active-game"><div className="active-game-head"><h3>{names[kind]} · الصف {grade} · المرحلة {stage} من 5</h3><button className="link" onClick={()=>{setKind(null);setResult("");}}>رجوع للألعاب</button></div>
      {!result ? <><div className="game-progress"><span>السؤال {index+1} من 10</span><b>⭐ {score}</b></div><div className="game-progress-track"><i style={{width:`${(index+1)*10}%`}}/></div><h3 className="big">{q?.prompt}</h3><div className="opts">{q?.options.map((v,i)=><button key={i} className={`opt ${picked?(v===q.answer?"good":v===picked?"bad":""):""}`} onClick={()=>choose(v)}>{v}</button>)}</div>{picked&&<p className="pop">{picked===q?.answer?"إجابة صحيحة 🎉":"الإجابة الصحيحة: "+q?.answer}</p>}</> :
      <><h3 className="big">{result}</h3><p>نتيجتك: {score} من 10</p><div className="lesson-game-actions"><button className="btn" onClick={()=>start(kind,stage)}>إعادة المرحلة</button>{score>=6&&stage<5&&<button className="btn" onClick={()=>start(kind,stage+1)}>المرحلة التالية ⭐</button>}<button className="link" onClick={()=>{setKind(null);setResult("");}}>قائمة الألعاب</button></div></>}
    </div>}
    <div className="foundation-tables">
      <h3>📚 جداول التعلّم والحفظ</h3>
      <h4>جدول الحروف العربية</h4><div className="alphabet-table" dir="rtl">{AR.map((letter,i)=><span key={letter}><b>{letter}</b><small>{i+1}</small></span>)}</div>
      <h4>English Alphabet Table</h4><div className="alphabet-table" dir="ltr">{EN.map((letter,i)=><span key={letter}><b>{letter}</b><small>{i+1}</small></span>)}</div>
      <h4>جداول الضرب من جدول 1 إلى جدول 12</h4>
      <p className="multiplication-intro">اختر جدولًا واحدًا لعرضه وحفظه، وكل جدول مستقل ومرتب من × 1 إلى × 12.</p>
      <div className="multiplication-selector" dir="rtl">{Array.from({length:12},(_,i)=>i+1).map(n=><button type="button" key={n} className={selectedTable===n?"active":""} aria-pressed={selectedTable===n} onClick={()=>setSelectedTable(n)}>جدول {n}</button>)}</div>
      <div className="single-multiplication-table" dir="rtl">
        <h5>⭐ جدول ضرب {selectedTable}</h5>
        <ol>{Array.from({length:12},(_,i)=>i+1).map(n=><li key={n}><span>{selectedTable} × {n}</span><b>{selectedTable*n}</b></li>)}</ol>
      </div>
    </div>
  </section>;
}
