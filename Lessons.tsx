import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import Quiz, { QuizDoc } from "./Quiz";
export interface Lesson { id: string; title: string; description: string; classId: string; subjectId: string; order: number; type: string; url: string; published: boolean }
interface Prog { lessonId: string; completed?: boolean; openedAtMs?: number }
const Bar = ({ v }: { v: number }) => <div className="bar-track" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${v}%` }} /></div>;

export default function Lessons({ staff }: { staff: boolean }) {
  const { profile } = useAuth(); const uid = profile!.uid; const cid = profile!.classId;
  const [items, setItems] = useState<Lesson[] | null>(null);
  const [prog, setProg] = useState<Record<string, Prog>>({});
  const [quizzes, setQuizzes] = useState<QuizDoc[]>([]);
  const [subjects, setSubjects] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<QuizDoc | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    const q = staff ? collection(db, "lessons")
      : cid ? query(collection(db, "lessons"), where("published", "==", true), where("classId", "==", cid))
      : query(collection(db, "lessons"), where("published", "==", true));
    return onSnapshot(q, s => setItems(s.docs.map(d => ({ id: d.id, ...d.data() } as Lesson)).sort((a, b) => a.order - b.order)), () => setErr("تعذّر تحميل الدروس"));
  }, [staff, cid]);
  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, "progress"), where("uid", "==", uid)), s => { const m: Record<string, Prog> = {}; s.docs.forEach(d => { const x = d.data() as Prog; m[x.lessonId] = x; }); setProg(m); });
    const u2 = onSnapshot(query(collection(db, "quizzes"), where("published", "==", true)), s => setQuizzes(s.docs.map(d => ({ id: d.id, ...d.data() } as QuizDoc))));
    const u3 = onSnapshot(collection(db, "subjects"), s => { const m: Record<string, string> = {}; s.docs.forEach(d => (m[d.id] = d.data().name)); setSubjects(m); });
    return () => { u1(); u2(); u3(); };
  }, [uid]);
  const mark = (l: Lesson, patch: Partial<Prog>) =>
    setDoc(doc(db, "progress", `${uid}_${l.id}`), { uid, lessonId: l.id, subjectId: l.subjectId, ...patch, updatedAt: serverTimestamp() }, { merge: true }).catch(() => setErr("تعذّر حفظ التقدم"));

  const stats = useMemo(() => {
    const pub = (items ?? []).filter(l => l.published);
    const done = pub.filter(l => prog[l.id]?.completed);
    const bySubject = Object.entries(pub.reduce<Record<string, Lesson[]>>((a, l) => ((a[l.subjectId] ??= []).push(l), a), {}))
      .map(([id, ls]: [string, Lesson[]]) => ({ name: subjects[id] ?? "مادة", pct: Math.round(100 * ls.filter(l => prog[l.id]?.completed).length / ls.length) }));
    const last = pub.filter(l => !prog[l.id]?.completed && prog[l.id]?.openedAtMs).sort((a, b) => prog[b.id].openedAtMs! - prog[a.id].openedAtMs!)[0];
    return { pct: pub.length ? Math.round(100 * done.length / pub.length) : 0, bySubject, last };
  }, [items, prog, subjects]);

  if (err) return <p className="err" role="alert">{err}</p>;
  if (!items) return <p>جارٍ تحميل الدروس…</p>;
  if (open) return <Quiz quiz={open} onClose={() => setOpen(null)} />;
  if (!items.length) return <p className="note">لا توجد دروس منشورة بعد.</p>;
  const openLesson = (l: Lesson) => { if (!staff) mark(l, { openedAtMs: Date.now() }); window.open(l.url, "_blank", "noopener,noreferrer"); };
  return (<>
    {!staff && <section className="panel"><h3>تقدّمك: {stats.pct}%</h3><Bar v={stats.pct} />
      {stats.bySubject.map(s => <div key={s.name}><small>{s.name} — {s.pct}%</small><Bar v={s.pct} /></div>)}
      {stats.last && <button className="btn" onClick={() => openLesson(stats.last!)}>أكمل من حيث توقفت: {stats.last.title}</button>}
    </section>}
    <h3>الدروس</h3>
    <div className="grid">{items.map((l, i) => { const qz = quizzes.find(q => q.lessonId === l.id); const done = prog[l.id]?.completed; return (
      <div key={l.id} className={`card c${i % 4}`}>
        <b>{done && "✅ "}{l.title}</b><small>{l.description}</small>{!l.published && <em>مسودة</em>}
        <button className="mini" onClick={() => openLesson(l)}>فتح الدرس</button>
        {!staff && !done && <button className="mini" onClick={() => mark(l, { completed: true })}>تم الإكمال</button>}
        {!staff && qz && <button className="mini" onClick={() => setOpen(qz)}>الاختبار</button>}
      </div>); })}</div>
  </>);
}
