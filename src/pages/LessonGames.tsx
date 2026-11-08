import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

interface LessonGame { id: string; title: string; description?: string; classId: string; published?: boolean; gameWords?: string[]; active?: boolean }
type QuestionType = "fill" | "tf" | "choice" | "first" | "scramble";
type Question = { type: QuestionType; prompt: string; answer: string; shown: string; options: string[]; emoji: string };
const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);
const stages = Array.from({ length: 10 }, (_, i) => i + 1);
const mascots = ["🐼", "🦊", "🐸", "🦄", "🦁", "🐯"];
const scenes = ["🌈", "☀️", "⭐", "🎈", "🪁", "🦋", "🌻", "🚀", "🍭", "🎨"];
const normalize = (value: string) => value.trim().toLocaleLowerCase("ar").replace(/[ًٌٍَُِّْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه");
const uniqueWords = (words: string[], answer: string) => shuffle([answer, ...shuffle(words.filter(w => normalize(w) !== normalize(answer))).slice(0, 3)]);
const scramble = (word: string) => {
  const chars = Array.from(word).filter(ch => ch.trim());
  if (chars.length < 2) return chars.join(" ");
  let mixed = shuffle(chars);
  if (mixed.join("") === chars.join("")) mixed = [...mixed.slice(1), mixed[0]];
  return mixed.join("  ");
};

function makeQuestion(lesson: LessonGame, stage: number, index: number): Question {
  const words = (lesson.gameWords ?? []).map(w => w.trim()).filter(Boolean).slice(0, 100);
  const bank = words.length ? words : [lesson.title];
  const answer = bank[(stage * 7 + index) % bank.length];
  const emoji = scenes[(stage + index) % scenes.length];
  const kind = (index + stage - 1) % 5;
  if (kind === 0) {
    const chars = Array.from(answer);
    const target = Math.min(chars.length - 1, Math.max(0, Math.floor(chars.length / (stage < 4 ? 2 : 3))));
    const clue = [...chars];
    if (chars.length > 1) clue[target] = "ـ";
    return { type: "fill", prompt: "أكمل الحروف الناقصة لتكوين كلمة من الدرس", answer, shown: clue.join(" "), options: [], emoji };
  }
  if (kind === 1) {
    const other = bank.find(w => normalize(w) !== normalize(answer)) ?? answer;
    const isTrue = bank.length < 2 || (stage + index) % 2 === 0;
    return { type: "tf", prompt: "هل الكلمتان متطابقتان؟", answer: isTrue ? "صح" : "خطأ", shown: `الكلمة المطلوبة: ${answer}   |   الكلمة المعروضة: ${isTrue ? answer : other}`, options: ["صح", "خطأ"], emoji };
  }
  if (kind === 2) return { type: "choice", prompt: "فك الحروف واختر الكلمة الصحيحة", answer, shown: scramble(answer), options: uniqueWords(bank, answer), emoji };
  if (kind === 3) {
    const first = Array.from(answer).find(ch => ch.trim()) ?? answer[0];
    const letters = Array.from(new Set(bank.map(w => Array.from(w).find(ch => ch.trim()) ?? w[0]).filter(Boolean)));
    return { type: "first", prompt: "اختر الحرف الذي تبدأ به الكلمة", answer: first, shown: answer, options: shuffle([first, ...shuffle(letters.filter(ch => ch !== first)).slice(0, 3)]), emoji };
  }
  return { type: "scramble", prompt: "رتّب الحروف واكتب الكلمة كما وردت في الدرس", answer, shown: scramble(answer), options: [], emoji };
}

export default function LessonGames() {
  const { profile } = useAuth();
  const [lessons, setLessons] = useState<LessonGame[]>([]);
  const [activeSessionIds, setActiveSessionIds] = useState<string[]>([]);
  const [sessionStudentUids, setSessionStudentUids] = useState<Record<string, string[]>>({});
  const [classNames, setClassNames] = useState<Record<string, string>>({});
  const [studentsByClass, setStudentsByClass] = useState<Record<string, { uid: string; name: string }[]>>({});
  const [selectedStudents, setSelectedStudents] = useState<Record<string, string[]>>({});
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
  const [notice, setNotice] = useState("");
  const [busyLesson, setBusyLesson] = useState("");

  useEffect(() => {
    if (!profile) return;
    if (profile.role === "student") {
      if (!profile.classId) { setLessons([]); return; }
      const activeQuery = query(collection(db, "lessonGameSessions"), where("classId", "==", profile.classId), where("active", "==", true), where("selectedStudentUids", "array-contains", profile.uid));
      return onSnapshot(activeQuery, snap => {
        setActiveSessionIds(snap.docs.map(d => d.id));
        setLessons(snap.docs.map(d => ({ id: d.id, ...d.data(), active: true } as LessonGame)).filter(l => Array.isArray(l.gameWords) && l.gameWords!.length > 0));
      }, () => setLessons([]));
    }
    if (profile.role !== "admin" && profile.role !== "teacher") { setLessons([]); return; }
    const ids = profile.role === "teacher" ? (profile.classIds ?? []) : [];
    const lessonsQuery = profile.role === "admin"
      ? collection(db, "lessons")
      : ids.length ? query(collection(db, "lessons"), where("classId", "in", ids.slice(0, 30))) : query(collection(db, "lessons"), where("classId", "==", "__none__"));
    const sessionsQuery = profile.role === "admin"
      ? collection(db, "lessonGameSessions")
      : ids.length ? query(collection(db, "lessonGameSessions"), where("classId", "in", ids.slice(0, 30))) : query(collection(db, "lessonGameSessions"), where("classId", "==", "__none__"));
    const stopLessons = onSnapshot(lessonsQuery, snap => setLessons(snap.docs.map(d => ({ id: d.id, ...d.data() } as LessonGame)).filter(l => Array.isArray(l.gameWords) && l.gameWords!.length > 0)), () => setLessons([]));
    const stopSessions = onSnapshot(sessionsQuery, snap => {
      setActiveSessionIds(snap.docs.filter(d => d.data().active === true).map(d => d.id));
      setSessionStudentUids(Object.fromEntries(snap.docs.map(d => [d.id, Array.isArray(d.data().selectedStudentUids) ? d.data().selectedStudentUids : []])));
    }, () => {});
    return () => { stopLessons(); stopSessions(); };
  }, [profile?.uid, profile?.role, profile?.classId, profile?.classIds]);

  useEffect(() => {
    const classIds = [...new Set(lessons.map(lesson => lesson.classId).filter(Boolean))];
    if (!classIds.length) { setStudentsByClass({}); return; }
    const stops = classIds.map(classId => onSnapshot(
      query(collection(db, "users"), where("classId", "==", classId), where("role", "==", "student")),
      snap => setStudentsByClass(old => ({ ...old, [classId]: snap.docs.map(d => ({ uid: d.id, name: String(d.data().name || d.data().email || "طالب") })).sort((a,b) => a.name.localeCompare(b.name, "ar")) })),
      () => setStudentsByClass(old => ({ ...old, [classId]: [] }))
    ));
    return () => stops.forEach(stop => stop());
  }, [lessons.map(lesson => lesson.classId).sort().join("|")]);

  useEffect(() => onSnapshot(collection(db, "classes"), snap => {
    const names: Record<string, string> = {};
    snap.docs.forEach(d => { names[d.id] = String(d.data().name ?? ""); });
    setClassNames(names);
  }, () => setClassNames({})), []);

  useEffect(() => {
    if (profile?.role === "student" && selected && !lessons.some(l => l.id === selected.id)) {
      setSelected(null); setQuestion(null); setFinished(false); setNotice("انتهى وقت اللعبة، أغلق المعلم اللعبة أو انتهت الحصة.");
    }
  }, [lessons, profile?.role, selected?.id]);

  const toggleGame = async (lesson: LessonGame) => {
    if (!profile || (profile.role !== "admin" && profile.role !== "teacher")) return;
    const isActive = activeSessionIds.includes(lesson.id);
    const chosen = selectedStudents[lesson.id] ?? [];
    const savedSelection = sessionStudentUids[lesson.id] ?? [];
    if (!isActive && chosen.length === 0) { setNotice("اختر طالبًا واحدًا على الأقل قبل فتح اللعبة."); return; }
    setBusyLesson(lesson.id);
    try {
      await setDoc(doc(db, "lessonGameSessions", lesson.id), {
        lessonId: lesson.id, classId: lesson.classId, title: lesson.title,
        description: lesson.description ?? "", gameWords: lesson.gameWords ?? [],
        active: !isActive, selectedStudentUids: isActive ? savedSelection : chosen, openedBy: profile.uid,
        openedAt: !isActive ? serverTimestamp() : null,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setNotice(isActive ? "تم إيقاف المشاركة." : `تم فتح اللعبة لـ ${chosen.length} طالبًا محددًا.`);
    } catch (error) {
      console.error("Could not change lesson game availability", error);
      setNotice("لم نتمكن من تغيير حالة اللعبة. تأكد من نشر قواعد Firestore الجديدة.");
    } finally { setBusyLesson(""); }
  };

  const start = (lesson: LessonGame, level: number) => {
    if (profile?.role === "student" && !lesson.active) return;
    setNotice(""); setSelected(lesson); setStage(level); setQuestionIndex(0); setScore(0);
    setQuestion(makeQuestion(lesson, level, 0)); setTyped(""); setPicked(""); setFeedback(""); setFinished(false);
  };
  const submitAnswer = () => {
    if (!selected || !question || picked) return;
    const value = question.type === "fill" || question.type === "scramble" ? typed : picked;
    if (!value.trim()) return;
    const correct = normalize(value) === normalize(question.answer);
    setScore(s => s + (correct ? 1 : 0)); setPicked(value);
    setFeedback(correct ? "أحسنت! إجابة رائعة 🎉" : `الإجابة الصحيحة: ${question.answer}`);
  };
  const chooseOption = (option: string) => {
    if (!question || picked) return;
    const correct = normalize(option) === normalize(question.answer);
    setPicked(option); setScore(s => s + (correct ? 1 : 0));
    setFeedback(correct ? "إجابة صحيحة! برافو 🎉" : `الإجابة الصحيحة: ${question.answer}`);
  };
  const nextQuestion = () => {
    if (!selected) return;
    if (questionIndex === 9) {
      setFinished(true);
      if (score >= 6) setUnlocked(old => ({ ...old, [selected.id]: Math.max(old[selected.id] ?? 1, Math.min(10, stage + 1)) }));
      return;
    }
    const next = questionIndex + 1;
    setQuestionIndex(next); setQuestion(makeQuestion(selected, stage, next));
    setTyped(""); setPicked(""); setFeedback("");
  };
  const closeGame = () => { setSelected(null); setQuestion(null); setFinished(false); };

  if (selected && finished) return <section className="lesson-game-panel">
    <div className="lesson-game-mascot" aria-hidden="true">{score >= 6 ? "🏆" : "🐣"}</div>
    <div className="lesson-game-celebrate">{score >= 6 ? "أحسنت يا بطل!" : "محاولة جميلة! هيا نعيدها"}</div>
    <h3>{selected.title} · المرحلة {stage}</h3><p className="lesson-game-final-score">{score} من 10 ⭐</p>
    <p>{score >= 6 ? "اجتزت المرحلة. يمكنك متابعة اللعب ما دام المعلم فاتح اللعبة." : "تحتاج إلى 6 إجابات صحيحة على الأقل لاجتياز المرحلة."}</p>
    <div className="lesson-game-actions"><button className="btn" onClick={() => start(selected, stage)}>إعادة المرحلة</button><button className="link" onClick={closeGame}>العودة للألعاب</button></div>
  </section>;

  if (selected && question) {
    const textEntry = question.type === "fill" || question.type === "scramble";
    return <section className="lesson-game-panel lesson-adventure" dir="rtl">
      <div className="lesson-game-top"><button className="link" onClick={closeGame}>← رجوع للدروس</button><b>المرحلة {stage} من 10</b><b>⭐ {score}</b></div>
      <div className="lesson-adventure-scene" aria-hidden="true"><span className="lesson-adventure-sun">☀️</span><span className="lesson-adventure-mascot">{mascots[(stage - 1) % mascots.length]}</span><span className="lesson-adventure-star">✨</span></div>
      <div className="lesson-adventure-progress"><i style={{ width: `${(questionIndex + 1) * 10}%` }} /></div>
      <div className="lesson-adventure-meta"><span>{classNames[selected.classId] || "مرحلتك التعليمية"}</span><span>{selected.title}</span><span>السؤال {questionIndex + 1} / 10</span></div>
      <h3>{question.prompt}</h3><div className="lesson-adventure-clue"><span className="lesson-adventure-emoji">{question.emoji}</span><strong>{question.shown}</strong></div>
      {textEntry ? <div className="lesson-fill-area"><label htmlFor="lesson-game-answer">{question.type === "fill" ? "اكتب الكلمة بعد إكمال الحروف" : "اكتب الكلمة بعد ترتيب الحروف"}</label><input id="lesson-game-answer" autoComplete="off" value={typed} disabled={!!picked} onChange={e => setTyped(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !picked) submitAnswer(); }} placeholder="اكتب إجابتك هنا..." /></div> :
        <div className="lesson-game-options lesson-true-false">{question.options.map((option, i) => <button type="button" key={`${option}-${i}`} disabled={!!picked} className={picked ? normalize(option) === normalize(question.answer) ? "correct" : normalize(option) === normalize(picked) ? "wrong" : "" : ""} onClick={() => chooseOption(option)}>{option === "صح" ? "✅ صح" : option === "خطأ" ? "❌ خطأ" : option}</button>)}</div>}
      {textEntry && !picked && <button type="button" className="btn lesson-submit-answer" disabled={!typed.trim()} onClick={submitAnswer}>تحقق من الإجابة ✨</button>}
      {feedback && <div className={feedback.startsWith("أحسنت") || feedback.startsWith("إجابة صحيحة") ? "lesson-game-feedback success" : "lesson-game-feedback"} role="status">{feedback}</div>}
      {picked && <button type="button" className="btn lesson-next-question" onClick={nextQuestion}>{questionIndex === 9 ? "عرض النتيجة 🏆" : "السؤال التالي ←"}</button>}
      <div className="lesson-adventure-footer" aria-hidden="true">🌈 ⭐ 🦋 🎈 ⭐ 🌈</div>
    </section>;
  }

  // Hide the entire games page from students until a teacher/admin opens a session for them.
  if (profile?.role === "student" && lessons.length === 0 && !selected) return null;

  return <section className="lesson-games">
    <div className="lesson-games-heading"><div><span>🎯 ألعاب من دروسك</span><h3>{profile?.role === "student" ? "لعبة الحصة التعليمية" : "التحكم في ألعاب الحصص"}</h3><p>{profile?.role === "student" ? "اللعبة تظهر هنا فقط عندما يفتحها المعلم أو مدير المدرسة أثناء الدرس." : "شغّل اللعبة بنفسك أو شاركها مع الطلاب الذين تختارهم أثناء الحصة."}</p></div><div className="lesson-games-character" aria-hidden="true">🦄</div></div>
    {notice && <p className="note" role="status">{notice}</p>}
    {!lessons.length ? <p className="note">{profile?.role === "student" ? "لا توجد لعبة مفتوحة الآن. انتظر حتى يفتح المعلم لعبة الدرس أثناء الحصة 😊" : "لا توجد دروس تحتوي على كلمات ألعاب. أضف كلمات الدرس أولًا من صفحة إدارة الدروس."}</p> :
      <div className="lesson-games-grid">{lessons.map(lesson => {
        const openLevel = unlocked[lesson.id] ?? 1;
        const isStudent = profile?.role === "student";
        return <article className="lesson-game-card" key={lesson.id}>
          <div className="lesson-game-card-icon">📚🎮</div><h4>{lesson.title}</h4><p>{lesson.description || "لعبة وأسئلة تفاعلية من محتوى الدرس"}</p>
          <div className="lesson-game-meta"><span>🧩 {lesson.gameWords?.length ?? 0} كلمة</span><span>✏️ 5 أنماط أسئلة</span></div>
          {isStudent ? <button className="btn" onClick={() => start(lesson, openLevel)}>ابدأ اللعبة مع المعلم 🚀</button> :
            <div className="lesson-game-manager-controls">\n              <button className="btn" onClick={() => start(lesson, openLevel)}>تشغيل اللعبة ▶️</button>
              <div className="lesson-game-actions"><span>{activeSessionIds.includes(lesson.id) ? "🟢 تمت مشاركة اللعبة" : "🔒 غير مشاركة مع الطلاب"}</span><button className="btn" disabled={busyLesson === lesson.id} onClick={() => toggleGame(lesson)}>{busyLesson === lesson.id ? "جارٍ التنفيذ..." : activeSessionIds.includes(lesson.id) ? "إغلاق اللعبة عن الطلاب" : "مشاركة مع الطلاب 🎮"}</button></div>
              {!activeSessionIds.includes(lesson.id) && <div className="lesson-game-student-picker"><div className="lesson-game-picker-heading"><b>اختر الطلاب المسموح لهم باللعب</b><span>{(selectedStudents[lesson.id] ?? []).length} محدد</span></div>
                <div className="lesson-game-picker-actions"><button type="button" className="link" onClick={() => setSelectedStudents(old => ({ ...old, [lesson.id]: (studentsByClass[lesson.classId] ?? []).map(student => student.uid) }))}>تحديد الكل</button><button type="button" className="link" onClick={() => setSelectedStudents(old => ({ ...old, [lesson.id]: [] }))}>إلغاء التحديد</button></div>
                <div className="lesson-game-student-list">{(studentsByClass[lesson.classId] ?? []).map(student => <label key={student.uid}><input type="checkbox" checked={(selectedStudents[lesson.id] ?? []).includes(student.uid)} onChange={e => setSelectedStudents(old => ({ ...old, [lesson.id]: e.target.checked ? [...(old[lesson.id] ?? []), student.uid] : (old[lesson.id] ?? []).filter(uid => uid !== student.uid) }))} /><span>{student.name}</span></label>)}
                {!(studentsByClass[lesson.classId] ?? []).length && <small>لا يوجد طلاب مسجلون في هذا الفصل حتى الآن.</small>}</div>
              </div>}
            </div>}
        </article>;
      })}</div>}
  </section>;
}
