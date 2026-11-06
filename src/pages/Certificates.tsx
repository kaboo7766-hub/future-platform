import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
interface Cert { id: string; subjectId: string; subjectName: string; studentName: string; number: string; ms: number }
const newNumber = () => "FM-" + Array.from(crypto.getRandomValues(new Uint8Array(6))).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();

export default function Certificates() {
  const { profile } = useAuth(); const uid = profile!.uid, cid = profile!.classId;
  const [lessons, setLessons] = useState<{ id: string; subjectId: string }[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [subjects, setSubjects] = useState<Record<string, string>>({});
  const [certs, setCerts] = useState<Cert[]>([]);
  const [view, setView] = useState<Cert | null>(null); const [err, setErr] = useState("");
  useEffect(() => {
    const lq = cid ? query(collection(db, "lessons"), where("published", "==", true), where("classId", "==", cid)) : query(collection(db, "lessons"), where("published", "==", true));
    const a = onSnapshot(lq, s => setLessons(s.docs.map(d => ({ id: d.id, subjectId: d.data().subjectId }))), () => {});
    const b = onSnapshot(query(collection(db, "progress"), where("uid", "==", uid)), s => setDone(new Set(s.docs.filter(d => d.data().completed).map(d => d.data().lessonId))), () => {});
    const c = onSnapshot(collection(db, "subjects"), s => { const o: Record<string, string> = {}; s.docs.forEach(d => (o[d.id] = d.data().name)); setSubjects(o); }, () => {});
    const d = onSnapshot(query(collection(db, "certificates"), where("uid", "==", uid)), s => setCerts(s.docs.map(x => ({ id: x.id, ...x.data(), ms: x.data().issuedAt?.toMillis?.() ?? Date.now() } as Cert))), () => {});
    return () => { a(); b(); c(); d(); };
  }, [uid, cid]);
  const eligible = useMemo(() => {
    const g: Record<string, string[]> = {};
    lessons.forEach(l => (g[l.subjectId] ??= []).push(l.id));
    return Object.entries(g).filter(([sid, ids]) => ids.every(i => done.has(i)) && !certs.some(c => c.subjectId === sid)).map(([sid]) => sid);
  }, [lessons, done, certs]);
  const issue = async (sid: string) => {
    setErr("");
    try { await setDoc(doc(db, "certificates", `${uid}_${sid}`), { uid, studentName: profile!.name, subjectId: sid, subjectName: subjects[sid] ?? "مادة", number: newNumber(), issuedAt: serverTimestamp() }); }
    catch { setErr("تعذّر إصدار الشهادة"); }
  };
  if (view) return (<section><div className="cert"><h2>🌟 منصة المستقبل التعليمية 🌟</h2><p>شهادة إتمام</p>
    <p>تشهد المنصة بأن الطالب/ـة</p><h1>{view.studentName}</h1><p>قد أتمّ/ت بنجاح جميع دروس مادة</p><h2>{view.subjectName}</h2>
    <p>تاريخ الإصدار: {new Date(view.ms).toLocaleDateString("ar-EG")}</p><p dir="ltr">رقم الشهادة: {view.number}</p></div>
    <div className="row noprint"><button className="btn" onClick={() => window.print()}>طباعة / حفظ PDF</button><button className="link" onClick={() => setView(null)}>رجوع</button></div></section>);
  if (!certs.length && !eligible.length && !err) return null;
  return (<section className="panel"><h3>شهاداتي</h3>
    {eligible.map(sid => <p key={sid}>أتممت جميع دروس {subjects[sid] ?? "المادة"}! <button className="btn" onClick={() => issue(sid)}>إصدار الشهادة</button></p>)}
    {certs.map(c => <p key={c.id}>📜 {c.subjectName} — <span dir="ltr">{c.number}</span> <button className="mini" onClick={() => setView(c)}>عرض وطباعة</button></p>)}
    {err && <p className="err" role="alert">{err}</p>}</section>);
}
