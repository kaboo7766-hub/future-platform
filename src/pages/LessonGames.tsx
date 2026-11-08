import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

interface LessonGame { id: string; title: string; description?: string; classId: string; published?: boolean; gameWords?: string[] }
type Question = { type: "fill" | "tf"; prompt: string; answer: string; shown: string; options: string[]; emoji: string };
const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);
const stages = Array.from({ length: 10 }, (_, i) => i + 1);
const mascots = ["🐼", "🦊", "🐸", "🦄", "🦁", "🐯"];
const scenes = ["🌈", "☀️", "⭐", "🎈", "🪁", "🦋", "🌻", "🚀", "🍭", "🎨"];
const normalize = (value: string) => value.trim().toLocaleLowerCase("ar").replace(/[ًٌٍَُِّْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه");

function makeQuestion(lesson: LessonGame, stage: number, index: number): Question {
  const words = (lesson.gameWords ?? []).map(w => w.trim()).filter(Boolean).slice(0, 100);
  const bank = words.length ? words : [lesson.title];
  const answer = bank[(stage * 7 + index) % bank.length];
  const emoji = scenes[(stage + index) % scenes.length];
  if (index % 2 === 0) {
    const chars = Array.from(answer);
    const hiddenIndex = Math.min(chars.length - 1, Math.max(0, Math.floor(chars.length / (stage < 4 ? 2 : 3))));
    const clue = [...chars];
    if (chars.length > 1) clue[hiddenIndex] = "ـ";
    return { type: "fill", prompt: "أكمل الكلمة الناقصة", answer, shown: clue.join(" "), options: shuffle([answer, ...shuffle(bank.filter(w => normalize(w) !== normalize(answer))).slice(0, 3)]), emoji };
  }
  const isTrue = (stage + index) % 3 !== 0 || bank.length < 2;
  const other = bank.find(w => normalize(w) !== normalize(answer)) ?? answer;
  const statement = isTrue ? answer : other;
  return { type: "tf", prompt: "هل الكلمة المعروضة هي الكلمة المطلوبة؟", answer: isTrue ? "صح" : "خطأ", shown: `الكلمة المطلوبة: ${answer}   |   المعروضة: ${statement}`, options: ["صح", "خطأ"], emoji };
}

export default function LessonGames() {
  const { profile } = useAuth();
  const [lessons, setLessons] = useState<LessonGame[]>([]);
  const [classNames, setClassNames] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<LessonGame | null>(null);
  const [stage, setStage] = useState(1);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState("");
  const [feedback, setFeedback] = useState("");
  const [unlocked, setUnlocked] = useState<Record<string, number>>({});
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!profile) return;
    let q;
    if (profile.role === "admin") q = collection(db, "lessons");
    else if (profile.role === "teacher") {
      const ids = profile.classIds ?? [];
      q = ids.length ? query(collection(db, "lessons"), where("classId", "in", ids.slice(0, 30))) : query(collection(db, "lessons"), where("classId", "==", "__none__"));
    } else if (profile.role === "student" && profile.classId) {
      q = query(collection(db, "lessons"), where("classId", "==", profile.classId), where("published", "==", true));
    } else return;
    return onSnapshot(q, snap => setLessons(snap.docs.map(d => ({ id: d.id, ...d.data() } as LessonGame)).filter(l => Array.isArray(l.gameWords) && l.gameWords!.length > 0)), () => setLessons([]));
  }, [profile?.uid, profile?.role, profile?.classId, profile?.classIds]);

  useEffect(() => onSnapshot(collection(db, "classes"), snap => {
    const names: Record<string, string> = {};
    snap.docs.forEach(d => { names[d.id] = String(d.data().name ?? ""); });
    setClassNames(names);
  }, () => setClassNames({})), []);

  const start = (lesson: LessonGame, level: number) => {
    setSelected(lesson); setStage(level); setQuestionIndex(0); setScore(0);
    setQuestion(makeQuestion(lesson, level, 0)); setTyped(""); setPicked(""); setFeedback(""); setFinished(false);
  };
  const submitAnswer = () => {
    if (!selected || !question || picked) return;
    const value = question.type === "fill" ? typed : picked;
    if (!value.trim()) return;
    const correct = question.type === "fill" ? normalize(value) === normalize(question.answer) : value === question.answer;
    const nextScore = score + (correct ? 1 : 0);
    setScore(nextScore);
    setPicked(value);
    setFeedback(correct ? "أحسنت! إجابة رائعة 🎉" : `الإجابة الصحيحة: ${question.answer}`);
  };
  const nextQuestion = () => {
    if (!selected) return;
    if (questionIndex === 9) {
      setFinished(true);
      if (score >= 6) setUnlocked(old => ({ ...old, [selected.id]: Math.max(old[selected.id] ?? 1, Math.min(10, stage + 1)) }));
      return;
    }
    const next = questionIndex + 1;
    setQuestionIndex(next);
    setQuestion(makeQuestion(selected, stage, next));
    setTyped(""); setPicked(""); setFeedback("");
  };
  const closeGame = () => { setSelected(null); setQuestion(null); setFinished(false); };

  if (selected && finished) return <section className="lesson-game-panel">
    <div className="lesson-game-mascot" aria-hidden="true">{score >= 6 ? "🏆" : "🐣"}</div>
    <div className="lesson-game-celebrate">{score >= 6 ? "أحسنت يا بطل!" : "محاولة جميلة! هيا نعيدها"}</div>
    <h3>{selected.title} · المرحلة {stage}</h3>
    <p className="lesson-game-final-score">{score} من 10 ⭐</p>
    <p>{score >= 6 ? "اجتزت المرحلة وفتحت المرحلة التالية." : "تحتاج إلى 6 إجابات صحيحة على الأقل لفتح المرحلة التالية."}</p>
    <div className="lesson-game-actions">
      <button className="btn" onClick={() => start(selected, stage)}>إعادة المرحلة</button>
      {score >= 6 && stage < 10 && <button className="btn" onClick={() => start(selected, stage + 1)}>المرحلة التالية ⭐</button>}
      <button className="link" onClick={closeGame}>العودة للألعاب</button>
    </div>
  </section>;

  if (selected && question) return <section className="lesson-game-panel lesson-adventure" dir="rtl">
    <div className="lesson-game-top"><button className="link" onClick={closeGame}>← رجوع للدروس</button><b>المرحلة {stage} من 10</b><b>⭐ {score}</b></div>
    <div className="lesson-adventure-scene" aria-hidden="true"><span className="lesson-adventure-sun">☀️</span><span className="lesson-adventure-mascot">{mascots[(stage - 1) % mascots.length]}</span><span className="lesson-adventure-star">✨</span></div>
    <div className="lesson-adventure-progress"><i style={{ width: `${(questionIndex + 1) * 10}%` }} /></div>
    <div className="lesson-adventure-meta"><span>{classNames[selected.classId] || "مرحلتك التعليمية"}</span><span>{selected.title}</span><span>السؤال {questionIndex + 1} / 10</span></div>
    <h3>{question.prompt}</h3>
    <div className="lesson-adventure-clue"><span className="lesson-adventure-emoji">{question.emoji}</span><strong>{question.shown}</strong></div>
    {question.type === "fill" ? <div className="lesson-fill-area">
      <label htmlFor="lesson-game-answer">اكتب الكلمة الصحيحة</label>
      <input id="lesson-game-answer" autoComplete="off" value={typed} disabled={!!picked} onChange={e => setTyped(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !picked) submitAnswer(); }} placeholder="اكتب إجابتك هنا..." />
      {!picked && <div className="lesson-word-choices">{question.options.map((word, i) => <button type="button" key={i} onClick={() => setTyped(word)}>{word}</button>)}</div>}
    </div> : <div className="lesson-game-options lesson-true-false">
      {question.options.map((option, i) => <button type="button" key={option} disabled={!!picked} className={picked ? option === question.answer ? "correct" : option === picked ? "wrong" : "" : ""} onClick={() => { if (!picked) { setPicked(option); const correct = option === question.answer; setScore(s => s + (correct ? 1 : 0)); setFeedback(correct ? "إجابة صحيحة! برافو 🎉" : `الإجابة الصحيحة: ${question.answer}`); } }}>{option === "صح" ? "✅ صح" : "❌ خطأ"}</button>)}
    </div>}
    {question.type === "fill" && !picked && <button type="button" className="btn lesson-submit-answer" disabled={!typed.trim()} onClick={submitAnswer}>تحقق من الإجابة ✨</button>}
    {feedback && <div className={feedback.startsWith("أحسنت") || feedback.startsWith("إجابة صحيحة") ? "lesson-game-feedback success" : "lesson-game-feedback"} role="status">{feedback}</div>}
    {picked && <button type="button" className="btn lesson-next-question" onClick={nextQuestion}>{questionIndex === 9 ? "عرض النتيجة 🏆" : "السؤال التالي ←"}</button>}
    <div className="lesson-adventure-footer" aria-hidden="true">🌈 ⭐ 🦋 🎈 ⭐ 🌈</div>
  </section>;

  return <section className="lesson-games">
    <div className="lesson-games-heading"><div><span>🎯 ألعاب من دروسك</span><h3>حوّل كل درس إلى مغامرة تعليمية!</h3><p>أسئلة أكمل وصح أو خطأ مرتبطة بكلمات الدرس، برسومات كرتونية ومراحل تتدرج حسب الصف.</p></div><div className="lesson-games-character" aria-hidden="true">🦄</div></div>
    {!lessons.length ? <p className="note">لا توجد ألعاب دروس بعد. على المعلم إضافة كلمات الدرس من «الدروس والصفوف» (حتى 100 كلمة)، وستظهر اللعبة هنا تلقائيًا بعد حفظ الدرس ونشره للطلاب.</p> :
      <div className="lesson-games-grid">{lessons.map(lesson => {
        const count = Math.min(100, lesson.gameWords?.length ?? 0);
        const openLevel = unlocked[lesson.id] ?? 1;
        return <article className="lesson-game-card" key={lesson.id}>
          <div className="lesson-game-card-icon">📚🎮</div><h4>{lesson.title}</h4><p>{lesson.description || "لعبة وأسئلة تفاعلية من محتوى الدرس"}</p>
          <div className="lesson-game-meta"><span>🧩 {count} كلمة</span><span>🏁 10 مراحل</span><span>✏️ أكمل وصح/خطأ</span></div>
          <div className="lesson-stage-row">{stages.map(n => <span key={n} className={n <= openLevel ? "stage-open" : "stage-locked"}>{n <= openLevel ? "⭐" : "🔒"} {n}</span>)}</div>
          <button className="btn" onClick={() => start(lesson, Math.min(openLevel, 10))}>ابدأ المغامرة 🚀</button>
        </article>;
      })}</div>}
  </section>;
}
