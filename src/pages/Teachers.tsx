import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

interface Teacher { uid: string; name?: string; email?: string; role: string; classIds?: string[] }
interface SchoolClass { id: string; name: string }

export default function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const stopUsers = onSnapshot(collection(db, "users"), snap => {
      setTeachers(snap.docs.map(d => d.data() as Teacher)
        .filter(u => u.role === "teacher" || u.role === "pending")
        .sort((a, b) => (a.name || a.email || "").localeCompare(b.name || b.email || "", "ar")));
      setLoading(false);
    }, () => { setLoading(false); setMessage({ ok: false, text: "تعذّر تحميل المعلمين. تحقق من صلاحيات Firestore." }); });
    const stopClasses = onSnapshot(collection(db, "classes"), snap => {
      setClasses(snap.docs.map(d => ({ id: d.id, name: String(d.data().name || "صف دراسي") })));
    }, () => setMessage({ ok: false, text: "تعذّر تحميل الصفوف الدراسية." }));
    return () => { stopUsers(); stopClasses(); };
  }, []);

  const approve = async (teacher: Teacher) => {
    if (!teacher.uid || busy) return;
    setBusy(teacher.uid); setMessage(null);
    try {
      await updateDoc(doc(db, "users", teacher.uid), { role: "teacher" });
      setMessage({ ok: true, text: "تم اعتماد المعلم بنجاح. يمكنك الآن تحديد صفوفه." });
    } catch {
      setMessage({ ok: false, text: "تعذّر اعتماد المعلم. تحقق من صلاحيات المدير." });
    } finally { setBusy(null); }
  };

  const toggleClass = async (teacher: Teacher, classId: string) => {
    if (teacher.role !== "teacher" || busy) return;
    const current = teacher.classIds ?? [];
    const next = current.includes(classId) ? current.filter(id => id !== classId) : [...current, classId];
    setBusy(teacher.uid); setMessage(null);
    try {
      await updateDoc(doc(db, "users", teacher.uid), { classIds: next });
      setTeachers(old => old.map(t => t.uid === teacher.uid ? { ...t, classIds: next } : t));
      setMessage({ ok: true, text: "تم حفظ الصفوف المخصصة للمعلم." });
    } catch {
      setMessage({ ok: false, text: "تعذّر حفظ الصفوف. تأكد من نشر قواعد Firestore الأخيرة." });
    } finally { setBusy(null); }
  };

  const pending = teachers.filter(t => t.role === "pending");
  const approved = teachers.filter(t => t.role === "teacher");

  return <section className="panel" dir="rtl">
    <div className="admin-box-heading"><div><h3>إدارة المعلمين والصفوف</h3><p>اعتماد المعلمين وتحديد الصفوف التي يستطيع كل معلم إدارتها</p></div><b>{approved.length} معلم</b></div>
    <div className="admin-stat-grid">
      <article className="admin-stat-card admin-stat-purple"><div><b>{approved.length}</b><small>المعلمون المعتمدون</small></div></article>
      <article className="admin-stat-card admin-stat-orange"><div><b>{pending.length}</b><small>طلبات الاعتماد</small></div></article>
      <article className="admin-stat-card admin-stat-blue"><div><b>{classes.length}</b><small>الصفوف الدراسية</small></div></article>
    </div>
    {loading ? <p role="status">جارٍ تحميل بيانات المعلمين…</p> : <>
      {pending.length > 0 && <section className="admin-box"><h3>طلبات اعتماد المعلمين</h3>
        {pending.map(t => <div className="row" key={t.uid}>
          <span style={{ flex: 1, minWidth: 150 }}>{t.name || "معلم جديد"}<small dir="ltr" style={{ display: "block" }}>{t.email || t.uid}</small></span>
          <button className="btn" disabled={busy !== null} onClick={() => void approve(t)}>{busy === t.uid ? "جارٍ الاعتماد…" : "اعتماد كمعلم"}</button>
        </div>)}
      </section>}
      <h3>توزيع المعلمين على الصفوف</h3>
      {approved.length === 0 ? <p className="note">لا يوجد معلمون معتمدون حتى الآن.</p> : approved.map(t => <article className="admin-box" key={t.uid}>
        <div className="admin-box-heading"><div><b>{t.name || "بدون اسم"}</b><small dir="ltr" style={{ display: "block" }}>{t.email || t.uid}</small></div><span className="chip">{(t.classIds ?? []).length} صف</span></div>
        {classes.length === 0 ? <p className="note">أضف الصفوف أولًا من قسم «الدروس والصفوف».</p> :
          <div className="row" style={{ flexWrap: "wrap" }}>{classes.map(c => <label className="chip" key={c.id}>
            <input type="checkbox" checked={(t.classIds ?? []).includes(c.id)} disabled={busy !== null}
              onChange={() => void toggleClass(t, c.id)} /> {c.name}
          </label>)}</div>}
      </article>)}
    </>}
    {message && <p className={message.ok ? "ok" : "err"} role="status">{message.text}</p>}
  </section>;
}
