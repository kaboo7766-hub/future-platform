import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import ChildAssignments from "./ChildAssignments";
interface Les { id: string; title: string; subjectId: string }
interface Res { lessonId: string; score: number; total: number; at?: { toMillis(): number } | null }
const Bar = ({ v }: { v: number }) => <div className="bar-track" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${v}%` }} /></div>;

function Child({ id, lessons, subjects }: { id: string; lessons: Les[]; subjects: Record<string, string> }) {
  const [name, setName] = useState("");
  const [done, setDone] = useState<Set<string>>(new Set());
  const [res, setRes] = useState<Res[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    getDoc(doc(db, "users", id)).then(s => setName(s.data()?.name ?? "")).catch(() => setErr("تعذّر تحميل بيانات الابن"));
    const a = onSnapshot(query(collection(db, "progress"), where("uid", "==", id)), s => setDone(new Set(s.docs.filter(d => d.data().completed).map(d => d.data().lessonId))), () => setErr("تعذّر تحميل التقدم"));
    const b = onSnapshot(query(collection(db, "quizResults"), where("uid", "==", id)), s => setRes(s.docs.map(d => d.data() as Res)), () => setErr("تعذّر تحميل النتائج"));
    return () => { a(); b(); };
  }, [id]);
  const m = useMemo(() => {
    const byLesson = new Map(lessons.map(l => [l.id, l]));
    const pct = lessons.length ? Math.round(100 * lessons.filter(l => done.has(l.id)).length / lessons.length) : 0;
    const agg: Record<string, { s: number; t: number }> = {};
    res.forEach(r => { const sid = byLesson.get(r.lessonId)?.subjectId; if (sid) { const x = (agg[sid] ??= { s: 0, t: 0 }); x.s += r.score; x.t += r.total; } });
    const subj = Object.entries(agg).map(([id, x]) => ({ name: subjects[id] ?? "مادة", pct: Math.round(100 * x.s / x.t) }));
    const recent = [...res].sort((a, b) => (b.at?.toMillis() ?? 0) - (a.at?.toMillis() ?? 0)).slice(0, 5);
    return { pct, subj, recent, byLesson };
  }, [lessons, done, res, subjects]);
  return (<section className="panel"><h3>{name || "طالب"}</h3>{err && <p className="err" role="alert">{err}</p>}
    <p>الدروس المكتملة: {lessons.filter(l => done.has(l.id)).length} من {lessons.length}</p><Bar v={m.pct} />
    <h4>نقاط القوة والضعف (من نتائج الاختبارات)</h4>
    {m.subj.length === 0 ? <p className="note">لا توجد نتائج اختبارات بعد.</p> : <>
      <p className="ok">القوة: {m.subj.filter(s => s.pct >= 70).map(s => `${s.name} (${s.pct}%)`).join("، ") || "—"}</p>
      <p className="err">تحتاج دعمًا: {m.subj.filter(s => s.pct < 50).map(s => `${s.name} (${s.pct}%)`).join("، ") || "—"}</p></>}
    <h4>آخر النتائج</h4>
    {m.recent.length === 0 ? <p className="note">—</p> : m.recent.map((r, i) => <p key={i}>{m.byLesson.get(r.lessonId)?.title ?? "درس"}: {r.score} من {r.total}</p>)}
    <ChildAssignments id={id} />
  </section>);
}

export default function Parent() {
  const { profile } = useAuth(); const uid = profile!.uid;
  const [kids, setKids] = useState<string[] | null>(null);
  const [lessons, setLessons] = useState<Les[]>([]); const [subjects, setSubjects] = useState<Record<string, string>>({});
  useEffect(() => {
    const a = onSnapshot(query(collection(db, "parentLinks"), where("parentUid", "==", uid)), s => setKids(s.docs.map(d => d.data().studentUid)), () => setKids([]));
    const b = onSnapshot(query(collection(db, "lessons"), where("published", "==", true)), s => setLessons(s.docs.map(d => ({ id: d.id, title: d.data().title, subjectId: d.data().subjectId }))));
    const c = onSnapshot(collection(db, "subjects"), s => { const o: Record<string, string> = {}; s.docs.forEach(d => (o[d.id] = d.data().name)); setSubjects(o); });
    return () => { a(); b(); c(); };
  }, [uid]);
  if (!kids) return <p>جارٍ التحميل…</p>;
  if (!kids.length) return <p className="note">لم يُربط أي طالب بحسابك بعد. تواصل مع إدارة المنصة لربط ابنك.</p>;
  return <>{kids.map(k => <Child key={k} id={k} lessons={lessons} subjects={subjects} />)}</>;
}
