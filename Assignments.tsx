import { useEffect, useState } from "react";
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
export interface A { id: string; title: string; description: string; dueDate: string }
export interface S { id: string; assignmentId: string; uid: string; studentName: string; text: string; link?: string; grade?: number; feedback?: string }
const okLink = (u: string) => { if (!u) return true; try { return new URL(u).protocol === "https:"; } catch { return false; } };
type Msg = { ok: boolean; t: string } | null;

function StudentCard({ a, sub }: { a: A; sub?: S }) {
  const { profile } = useAuth();
  const [text, setText] = useState(sub?.text ?? ""), [link, setLink] = useState(sub?.link ?? "");
  const [msg, setMsg] = useState<Msg>(null), [busy, setBusy] = useState(false);
  const graded = sub?.grade !== undefined;
  const submit = async () => {
    if (!text.trim()) return setMsg({ ok: false, t: "اكتب إجابتك أولًا" });
    if (!okLink(link)) return setMsg({ ok: false, t: "الرابط يجب أن يبدأ بـ https" });
    setBusy(true);
    try {
      await setDoc(doc(db, "submissions", `${a.id}_${profile!.uid}`), { assignmentId: a.id, uid: profile!.uid, studentName: profile!.name, text: text.trim(), link: link.trim(), submittedAt: serverTimestamp() });
      setMsg({ ok: true, t: "تم تسليم الواجب" });
    } catch { setMsg({ ok: false, t: "تعذّر التسليم، حاول مرة أخرى" }); } finally { setBusy(false); }
  };
  return (<div className="panel"><b>{a.title}</b> <small>آخر موعد: {a.dueDate || "—"}</small><p>{a.description}</p>
    {graded && <p className="ok">الدرجة: {sub!.grade} من 100 {sub!.feedback && `— ${sub!.feedback}`}</p>}
    <textarea disabled={graded} placeholder="إجابتك" value={text} onChange={e => setText(e.target.value)} maxLength={2000} />
    <input disabled={graded} dir="ltr" placeholder="رابط مرفق اختياري https://..." value={link} onChange={e => setLink(e.target.value)} />
    {!graded && <button className="btn" disabled={busy} onClick={submit}>{sub ? "تحديث التسليم" : "تسليم"}</button>}
    {msg && <p className={msg.ok ? "ok" : "err"} role="alert">{msg.t}</p>}</div>);
}

function GradeRow({ s }: { s: S }) {
  const [g, setG] = useState(s.grade?.toString() ?? ""), [fb, setFb] = useState(s.feedback ?? "");
  const [msg, setMsg] = useState<Msg>(null);
  const { profile } = useAuth();
  const save = async () => {
    const n = Number(g);
    if (g === "" || !Number.isFinite(n) || n < 0 || n > 100) return setMsg({ ok: false, t: "الدرجة من 0 إلى 100" });
    try {
      await updateDoc(doc(db, "submissions", s.id), { grade: n, feedback: fb.trim(), gradedAt: serverTimestamp() });
      await addDoc(collection(db, "notifications"), { audience: s.uid, title: "تم تصحيح واجبك", body: `الدرجة: ${n} من 100`, at: serverTimestamp(), createdBy: profile!.uid });
      setMsg({ ok: true, t: "تم الحفظ وإشعار الطالب" });
    } catch { setMsg({ ok: false, t: "تعذّر الحفظ" }); }
  };
  return (<div className="q"><b>{s.studentName}</b><p>{s.text}</p>
    {s.link && <a href={s.link} target="_blank" rel="noopener noreferrer">المرفق</a>}
    <div className="row"><input type="number" min={0} max={100} placeholder="الدرجة" value={g} onChange={e => setG(e.target.value)} />
      <input placeholder="ملاحظة" value={fb} onChange={e => setFb(e.target.value)} /><button className="btn" onClick={save}>حفظ</button></div>
    {msg && <p className={msg.ok ? "ok" : "err"} role="alert">{msg.t}</p>}</div>);
}

export default function Assignments({ staff }: { staff: boolean }) {
  const { profile } = useAuth(); const uid = profile!.uid;
  const [as, setAs] = useState<A[] | null>(null); const [subs, setSubs] = useState<S[]>([]);
  const [f, setF] = useState({ title: "", description: "", dueDate: "" }); const [msg, setMsg] = useState<Msg>(null);
  useEffect(() => {
    const a = onSnapshot(collection(db, "assignments"), s => setAs(s.docs.map(d => ({ id: d.id, ...d.data() } as A)).sort((x, y) => (x.dueDate || "9").localeCompare(y.dueDate || "9"))), () => setAs([]));
    const q = staff ? collection(db, "submissions") : query(collection(db, "submissions"), where("uid", "==", uid));
    const b = onSnapshot(q, s => setSubs(s.docs.map(d => ({ id: d.id, ...d.data() } as S))), () => {});
    return () => { a(); b(); };
  }, [staff, uid]);
  const create = async () => {
    if (!f.title.trim()) return setMsg({ ok: false, t: "اكتب عنوان الواجب" });
    try {
      await addDoc(collection(db, "assignments"), { ...f, title: f.title.trim(), createdBy: uid, createdAt: serverTimestamp() });
      await addDoc(collection(db, "notifications"), { audience: "all", title: "واجب جديد", body: f.title.trim(), at: serverTimestamp(), createdBy: uid });
      setF({ title: "", description: "", dueDate: "" }); setMsg({ ok: true, t: "تم إنشاء الواجب وإرسال إشعار" });
    } catch { setMsg({ ok: false, t: "تعذّر إنشاء الواجب" }); }
  };
  if (!as) return <p>جارٍ تحميل الواجبات…</p>;
  return (<section><h3>الواجبات</h3>
    {staff && <div className="panel"><input placeholder="عنوان الواجب" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
      <textarea placeholder="الوصف" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
      <input type="date" value={f.dueDate} onChange={e => setF({ ...f, dueDate: e.target.value })} />
      <button className="btn" onClick={create}>إنشاء الواجب</button>{msg && <p className={msg.ok ? "ok" : "err"} role="alert">{msg.t}</p>}</div>}
    {as.length === 0 && <p className="note">لا توجد واجبات حاليًا.</p>}
    {as.map(a => staff
      ? <div className="panel" key={a.id}><b>{a.title}</b> <small>({subs.filter(s => s.assignmentId === a.id).length} تسليم)</small>
          {subs.filter(s => s.assignmentId === a.id).map(s => <GradeRow key={s.id + (s.grade ?? "")} s={s} />)}</div>
      : <StudentCard key={a.id} a={a} sub={subs.find(s => s.assignmentId === a.id)} />)}
  </section>);
}
