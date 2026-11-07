import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

interface LessonGame { id: string; title: string; description?: string; classId: string; published?: boolean; gameWords?: string[] }
const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);
const stages = Array.from({ length: 10 }, (_, i) => i + 1);

export default function LessonGames() {
  const { profile } = useAuth();
  const [lessons, setLessons] = useState<LessonGame[]>([]);
  const [selected, setSelected] = useState<LessonGame | null>(null);
  const [stage, setStage] = useState(1);
  const [question, setQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [answer, setAnswer] = useState("");
  const [picked, setPicked] = useState("");
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

  const words = useMemo(() => (selected?.gameWords ?? []).map(w => w.trim()).filter(Boolean).slice(0, 100), [selected]);
  const currentWord = words.length ? words[((stage - 1) * 10 + question) % words.length] : "";
  const makeQuestion = (lesson: LessonGame, level: number, index: number) => {
    const bank = (lesson.gameWords ?? []).map(w => w.trim()).filter(Boolean).slice(0, 100);
    if (!bank.length) return;
    const correct = bank[((level - 1) * 10 + index) % bank.length];
    const distractors = shuffle(bank.filter(w => w !== correct)).slice(0, Math.min(3 + Math.floor((level - 1) / 3), 6));
    setAnswer(correct);
    setOptions(shuffle([correct, ...distractors]));
    setPicked("");
  };
  const begin = (lesson: LessonGame, level: number) => {
    setSelected(lesson); setStage(level); setQuestion(0); setScore(0); setFinished(false);
    makeQuestion(lesson, level, 0);
  };
  const choose = (value: string) => {
    if (picked || !selected) return;
    setPicked(value);
    const nextScore = score + (value === answer ? 1 : 0);
    setScore(nextScore);
    window.setTimeout(() => {
      if (question === 9) {
        setFinished(true);
        if (nextScore >= 6) setUnlocked(old => ({ ...old, [selected.id]: Math.max(old[selected.id] ?? 1, Math.min(10, stage + 1)) }));
      } else {
        setQuestion(n => n + 1);
        makeQuestion(selected, stage, question + 1);
      }
    }, 650);
  };

  if (selected && finished) return <section className="lesson-game-panel">
    <div className="lesson-game-celebrate">{score >= 6 ? "🏆 أحسنت يا بطل!" : "💪 حاول مرة أخرى!"}</div>
    <h3>{selected.title} · المرحلة {stage}</h3>
    <p>نتيجتك: {score} من 10</p>
    <p>{score >= 6 ? "اجتزت المرحلة وفتحت المرحلة التالية." : "تحتاج إلى 6 إجابات صحيحة على الأقل لفتح المرحلة التالية."}</p>
    <div className="lesson-game-actions">
      <button className="btn" onClick={() => begin(selected, stage)}>إعادة المرحلة</button>
      {score >= 6 && stage < 10 && <button className="btn" onClick={() => begin(selected, stage + 1)}>المرحلة التالية ⭐</button>}
      <button className="link" onClick={() => setSelected(null)}>العودة للدروس والألعاب</button>
    </div>
  </section>;

  if (selected) return <section className="lesson-game-panel">
    <div className="lesson-game-top"><button className="link" onClick={() => setSelected(null)}>← رجوع</button><b>المرحلة {stage} من 10</b><b>⭐ {score}</b></div>
    <div className="game-progress-track"><i style={{ width: `${(question + 1) * 10}%` }} /></div>
    <div className="lesson-game-mascot" aria-hidden="true">{stage < 4 ? "🐣" : stage < 8 ? "🦊" : "🦁"}</div>
    <h3>{stage <= 3 ? "اختر الكلمة المطابقة" : stage <= 6 ? "تحدي الكلمات: ركّز جيدًا!" : "تحدي الأبطال: اختر الكلمة الصحيحة!"}</h3>
    <div className="lesson-game-clue" dir="auto">{stage <= 3 ? `الكلمة: ${answer.slice(0, Math.max(1, answer.length - 1))}ـــ` : stage <= 6 ? answer.split("").reverse().join("  ") : `🔎 ${answer.length} حروف`}</div>
    <p>السؤال {question + 1} من 10</p>
    <div className="lesson-game-options">{options.map((word, i) => <button key={i} className={`lesson-word-option ${picked ? word === answer ? "correct" : word === picked ? "wrong" : "" : ""}`} onClick={() => choose(word)}>{word}</button>)}</div>
    {picked && <p className="lesson-game-feedback" role="status">{picked === answer ? "إجابة صحيحة! 🌟" : `الإجابة الصحيحة: ${answer}`}</p>}
  </section>;

  return <section className="lesson-games">
    <div className="lesson-games-heading"><div><span>🎯 ألعاب من دروسك</span><h3>حوّل الدرس إلى مغامرة!</h3><p>كل درس يضيف المعلم له كلمات يظهر هنا تلقائيًا في لعبة من 10 مراحل متدرجة.</p></div><div className="lesson-games-character">🦄</div></div>
    {!lessons.length ? <p className="note">لا توجد ألعاب دروس بعد. على المعلم إضافة كلمات الدرس من «الدروس والصفوف» (حتى 100 كلمة)، وستظهر اللعبة هنا تلقائيًا بعد حفظ الدرس ونشره للطلاب.</p> :
      <div className="lesson-games-grid">{lessons.map(lesson => {
        const count = Math.min(100, lesson.gameWords?.length ?? 0);
        const openLevel = unlocked[lesson.id] ?? 1;
        return <article className="lesson-game-card" key={lesson.id}>
          <div className="lesson-game-card-icon">📚🎮</div><h4>{lesson.title}</h4><p>{lesson.description || "لعبة كلمات من محتوى الدرس"}</p>
          <div className="lesson-game-meta"><span>🧩 {count} كلمة</span><span>🏁 10 مراحل</span></div>
          <div className="lesson-stage-row">{stages.map(n => <span key={n} className={n <= openLevel ? "stage-open" : "stage-locked"}>{n <= openLevel ? "⭐" : "🔒"} {n}</span>)}</div>
          <button className="btn" onClick={() => begin(lesson, Math.min(openLevel, 10))}>ابدأ اللعب 🚀</button>
        </article>;
      })}</div>}
  </section>;
}
