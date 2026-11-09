import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import Quiz, { QuizDoc } from "./Quiz";

interface ResultRow {
  id: string;
  quizId: string;
  score: number;
  total: number;
  attempts?: number;
}

export default function StudentQuizzes() {
  const { profile } = useAuth();
  const uid = profile?.uid ?? "";
  const classId = profile?.classId ?? "";
  const [quizzes, setQuizzes] = useState<QuizDoc[] | null>(null);
  const [results, setResults] = useState<Record<string, ResultRow>>({});
  const [lessonTitles, setLessonTitles] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<QuizDoc | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uid) return;
    if (!classId) {
      setQuizzes([]);
      setLessonTitles({});
      return;
    }

    const quizQuery = query(collection(db, "quizzes"), where("classId", "==", classId), where("published", "==", true));
    const lessonQuery = query(collection(db, "lessons"), where("classId", "==", classId), where("published", "==", true));
    const resultQuery = query(collection(db, "quizResults"), where("uid", "==", uid));

    const stopQuizzes = onSnapshot(quizQuery, snapshot => {
      const rows = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as QuizDoc))
        .filter(q => Array.isArray(q.questions) && q.questions.length > 0)
        .sort((a, b) => a.title.localeCompare(b.title, "ar"));
      setQuizzes(rows);
      setError("");
    }, () => {
      setQuizzes([]);
      setError("تعذّر تحميل اختبارات صفك. تحقق من الاتصال وصلاحيات قاعدة البيانات.");
    });

    const stopLessons = onSnapshot(lessonQuery, snapshot => {
      const titles: Record<string, string> = {};
      snapshot.docs.forEach(d => { titles[d.id] = String(d.data().title ?? "درس"); });
      setLessonTitles(titles);
    }, () => setLessonTitles({}));

    const stopResults = onSnapshot(resultQuery, snapshot => {
      const next: Record<string, ResultRow> = {};
      snapshot.docs.forEach(d => {
        const row = { id: d.id, ...d.data() } as ResultRow;
        if (!row.quizId) return;
        const old = next[row.quizId];
        if (!old || Number(row.score) > Number(old.score)) next[row.quizId] = row;
      });
      setResults(next);
    }, () => setError("تعذّر تحميل نتائج اختباراتك."));

    return () => { stopQuizzes(); stopLessons(); stopResults(); };
  }, [uid, classId]);

  if (selected) return <Quiz quiz={selected} onClose={() => setSelected(null)} />;

  if (!classId) return <section className="panel" dir="rtl">
    <h2>📝 اختبارات الصف</h2>
    <p className="note">لم يتم ربط حسابك بصف دراسي بعد. اطلب من المعلم أو الإدارة تحديد صفك حتى تظهر الاختبارات المخصصة لك.</p>
  </section>;

  if (!quizzes) return <section className="panel" role="status">جارٍ تحميل اختبارات الصف…</section>;

  return <section className="panel student-quiz-center" dir="rtl">
    <header className="admin-box-heading">
      <div><h2>📝 اختبارات الصف</h2><p>الاختبارات المنشورة لصفك فقط، ونتائجك محفوظة في حسابك.</p></div>
      <b>{quizzes.length.toLocaleString("ar-EG")} اختبار</b>
    </header>
    {error && <p className="err" role="alert">{error}</p>}
    {quizzes.length === 0 ? <p className="note">لا توجد اختبارات منشورة لصفك حاليًا.</p> :
      <div className="grid">
        {quizzes.map((quiz, index) => {
          const result = results[quiz.id];
          const lessonTitle = lessonTitles[quiz.lessonId] ?? "اختبار مرتبط بدرس";
          const canRetake = quiz.allowRetake === true;
          return <article className={"card c" + (index % 4)} key={quiz.id}>
            <span>📘 {lessonTitle}</span><h3>{quiz.title}</h3><p>{quiz.questions.length} سؤال</p>
            {result ? <p className="ok">أفضل نتيجة محفوظة: {result.score} من {result.total}</p> : <p className="note">لم تؤدِّ هذا الاختبار بعد.</p>}
            {typeof result?.attempts === "number" && <small>عدد المحاولات: {result.attempts}</small>}
            <button className="mini" onClick={() => setSelected(quiz)}>
              {result && !canRetake ? "عرض النتيجة" : result ? "إعادة الاختبار" : "ابدأ الاختبار"}
            </button>
          </article>;
        })}
      </div>}
  </section>;
}
