import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useAuth } from "../auth/AuthContext";

export interface Question { type: "mcq" | "tf"; text: string; options: string[]; answer: number }
export interface QuizDoc { id: string; lessonId: string; title: string; questions: Omit<Question, "answer">[]; allowRetake: boolean; published: boolean }

export default function Quiz({ quiz, onClose }: { quiz: QuizDoc; onClose: () => void }) {
  const { profile } = useAuth();
  const total = quiz.questions.length;
  const [ans, setAns] = useState<number[]>(Array(total).fill(-1));
  const [score, setScore] = useState<number | null>(null);
  const [prev, setPrev] = useState<number | null | undefined>(undefined);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => {
    getDocs(query(collection(db, "quizResults"), where("uid", "==", profile!.uid), where("quizId", "==", quiz.id)))
      .then(s => setPrev(s.empty ? null : Math.max(...s.docs.map(d => d.data().score as number))))
      .catch(() => setPrev(null));
  }, [quiz.id, profile]);
  const submit = async () => {
    if (ans.includes(-1)) return setErr("أجب عن كل الأسئلة أولًا");
    const user = auth.currentUser;
    if (!user) return setErr("انتهت جلسة الدخول، سجّل الدخول مرة أخرى");
    setErr(""); setBusy(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quizId: quiz.id, answers: ans }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذّر تصحيح الاختبار");
      setScore(data.score);
      setPrev(data.score);
    } catch (e) { setErr(e instanceof Error ? e.message : "تعذّر حفظ النتيجة، حاول مرة أخرى"); }
    finally { setBusy(false); }
  };
  if (prev === undefined) return <section className="panel">جارٍ التحميل…</section>;
  if (prev !== null && !quiz.allowRetake && score === null)
    return <section className="panel"><h3>{quiz.title}</h3><p>أنهيت هذا الاختبار. درجتك: {prev} من {total}</p><button className="btn" onClick={onClose}>إغلاق</button></section>;
  return (<section className="panel"><h3>{quiz.title}</h3>
    {quiz.questions.map((q, i) => (<fieldset key={i} className="q"><legend>{i + 1}. {q.text}</legend>
      {q.options.map((o, j) => <label key={j}><input type="radio" name={`q${i}`} disabled={score !== null}
        checked={ans[i] === j} onChange={() => setAns(a => a.map((v, k) => (k === i ? j : v)))} /> {o}</label>)}
    </fieldset>))}
    {err && <p className="err" role="alert">{err}</p>}
    {score === null
      ? <button className="btn" disabled={busy} onClick={submit}>{busy ? "جارٍ التصحيح…" : "تسليم الاختبار"}</button>
      : <p className="ok"><b>درجتك: {score} من {total}</b></p>}
    <button className="link" onClick={onClose}>إغلاق</button>
  </section>);
}
