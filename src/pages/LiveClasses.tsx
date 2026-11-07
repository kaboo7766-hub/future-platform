import { FormEvent, useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, Query, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

type SchoolClass = { id: string; name: string };
type LiveClass = { id: string; title: string; description?: string; classId: string; provider: "zoom" | "meet"; meetingUrl: string; startsAt: string; durationMinutes: number; published: boolean; createdBy: string; createdByName?: string };
const blank = () => ({ title: "", description: "", classId: "", provider: "meet" as "zoom" | "meet", meetingUrl: "", startsAt: "", durationMinutes: 45, published: true });
const validMeetingUrl = (value: string, provider: "zoom" | "meet") => {
  try { const u = new URL(value.trim()); if (u.protocol !== "https:") return false;
    return provider === "zoom" ? /(^|\\.)zoom\\.us$/i.test(u.hostname) : u.hostname.toLowerCase() === "meet.google.com";
  } catch { return false; }
};
const displayDate = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ar-EG", { dateStyle: "full", timeStyle: "short" }); };

export default function LiveClasses() {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [meetings, setMeetings] = useState<LiveClass[]>([]);
  const [form, setForm] = useState(blank());
  const [editing, setEditing] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const role = profile?.role;
  const ids = profile?.classIds ?? [];
  const isStaff = role === "admin" || role === "teacher";
  const availableClasses = role === "admin" ? classes : classes.filter(c => ids.includes(c.id));

  useEffect(() => onSnapshot(collection(db, "classes"), s => setClasses(s.docs.map(d => ({ id: d.id, name: String(d.data().name || "صف") }))), () => setMessage({ ok:false, text:"تعذر تحميل الصفوف." })), []);
  useEffect(() => {
    if (!profile) return;
    let meetingQuery: Query = collection(db, "liveClasses");
    if (role === "teacher" && ids.length) meetingQuery = query(collection(db, "liveClasses"), where("classId", "in", ids.slice(0, 30)));
    else if (role === "student" && profile.classId) meetingQuery = query(collection(db, "liveClasses"), where("classId", "==", profile.classId), where("published", "==", true));
    else if (role !== "admin") { setMeetings([]); return; }
    return onSnapshot(meetingQuery, s => setMeetings(s.docs.map(d => ({ id:d.id, ...d.data() } as LiveClass)).sort((a,b) => a.startsAt.localeCompare(b.startsAt))), () => setMessage({ ok:false, text:"تعذر تحميل الحصص. تأكد من قواعد Firestore." }));
  }, [profile?.uid, role, profile?.classId, ids.join("|")]);

  const now = Date.now();
  const upcoming = meetings.filter(m => Number.isNaN(Date.parse(m.startsAt)) || Date.parse(m.startsAt) >= now - 60 * 60 * 1000);
  const past = meetings.filter(m => !Number.isNaN(Date.parse(m.startsAt)) && Date.parse(m.startsAt) < now - 60 * 60 * 1000);
  const reset = () => { setForm(blank()); setEditing(""); };
  const save = async (e: FormEvent) => {
    e.preventDefault(); setMessage(null); if (!profile) return;
    if (!form.title.trim() || !form.classId || !form.startsAt || !form.meetingUrl.trim()) return setMessage({ ok:false, text:"أكمل اسم الحصة والصف والموعد والرابط." });
    if (role === "teacher" && !ids.includes(form.classId)) return setMessage({ ok:false, text:"لا يمكنك إضافة حصة لصف غير مخصص لك." });
    if (!validMeetingUrl(form.meetingUrl, form.provider)) return setMessage({ ok:false, text:form.provider === "zoom" ? "أدخل رابط Zoom صحيحًا يبدأ بـ https:// وينتهي بنطاق zoom.us." : "أدخل رابط Google Meet صحيحًا مثل https://meet.google.com/xxx-xxxx-xxx." });
    setBusy(true);
    const payload = { title:form.title.trim(), description:form.description.trim(), classId:form.classId, provider:form.provider, meetingUrl:form.meetingUrl.trim(), startsAt:form.startsAt, durationMinutes:form.durationMinutes, published:form.published, updatedAt:serverTimestamp() };
    try {
      if (editing) await updateDoc(doc(db, "liveClasses", editing), payload);
      else await addDoc(collection(db, "liveClasses"), { ...payload, createdBy:profile.uid, createdByName:profile.name, createdAt:serverTimestamp() });
      setMessage({ ok:true, text:editing ? "تم تحديث الحصة بنجاح." : "تمت إضافة الحصة ونشرها للطلاب." }); reset();
    } catch { setMessage({ ok:false, text:"لم يتم حفظ الحصة. تأكد من صلاحيات Firestore وأن الصف مخصص لك." }); }
    finally { setBusy(false); }
  };
  const edit = (m: LiveClass) => { setEditing(m.id); setForm({ title:m.title, description:m.description || "", classId:m.classId, provider:m.provider, meetingUrl:m.meetingUrl, startsAt:m.startsAt, durationMinutes:m.durationMinutes || 45, published:m.published }); setMessage(null); window.scrollTo({ top:0, behavior:"smooth" }); };
  const remove = async (m: LiveClass) => { if (!window.confirm("هل تريد حذف الحصة الافتراضية؟")) return; try { await deleteDoc(doc(db, "liveClasses", m.id)); setMessage({ ok:true, text:"تم حذف الحصة." }); } catch { setMessage({ ok:false, text:"تعذر حذف الحصة. تحقق من الصلاحيات." }); } };
  const className = (id: string) => classes.find(c => c.id === id)?.name || "الصف الدراسي";
  return <section className="live-hub" dir="rtl">
    <header className="live-hero"><div><span className="live-kicker">تعليم مباشر من أي مكان</span><h2>🎥 الفصول الافتراضية</h2><p>{isStaff ? "أضف مواعيد حصصك وروابط Zoom أو Google Meet ليصل إليها طلاب صفوفك بسهولة." : "تابع مواعيد حصصك المباشرة واضغط دخول الحصة في موعدها."}</p></div><div className="live-hero-icon">💻</div></header>
    {isStaff && <form className="live-form" onSubmit={save}>
      <div className="live-form-head"><div><h3>{editing ? "تعديل الحصة" : "إضافة حصة مباشرة جديدة"}</h3><p>الرابط الذي تضيفه سيظهر لطلاب الصف المحدد فقط.</p></div>{editing && <button type="button" className="mini" onClick={reset}>إلغاء التعديل</button>}</div>
      <div className="live-form-grid">
        <label>عنوان الحصة<input required maxLength={100} placeholder="مثال: شرح درس الكسور" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
        <label>الصف الدراسي<select required value={form.classId} onChange={e=>setForm({...form,classId:e.target.value})}><option value="">اختر الصف</option>{availableClasses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>منصة الاجتماع<select value={form.provider} onChange={e=>setForm({...form,provider:e.target.value as "zoom"|"meet",meetingUrl:""})}><option value="meet">Google Meet</option><option value="zoom">Zoom</option></select></label>
        <label>رابط الحصة<input required dir="ltr" type="url" placeholder={form.provider === "zoom" ? "https://zoom.us/j/..." : "https://meet.google.com/xxx-xxxx-xxx"} value={form.meetingUrl} onChange={e=>setForm({...form,meetingUrl:e.target.value})}/></label>
        <label>موعد الحصة<input required type="datetime-local" value={form.startsAt} onChange={e=>setForm({...form,startsAt:e.target.value})}/></label>
        <label>مدة الحصة بالدقائق<input type="number" min={10} max={240} value={form.durationMinutes} onChange={e=>setForm({...form,durationMinutes:Math.max(10,Math.min(240,Math.round(Number(e.target.value)||45)))})}/></label>
        <label className="live-full">وصف أو تعليمات للطلاب<textarea rows={2} maxLength={400} placeholder="جهّز الكتاب والكراسة قبل بدء الحصة..." value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
      </div>
      <label className="live-publish"><input type="checkbox" checked={form.published} onChange={e=>setForm({...form,published:e.target.checked})}/> إظهار الحصة للطلاب الآن</label>
      <div className="live-actions"><button className="btn" disabled={busy}>{busy ? "جارٍ الحفظ..." : editing ? "حفظ التعديلات" : "إضافة الحصة"}</button></div>
    </form>}
    {message && <p className={message.ok ? "ok" : "err"} role="status">{message.text}</p>}
    <div className="live-section-title"><h3>{role === "student" ? "حصصي المباشرة" : "الحصص القادمة"}</h3><span>{upcoming.length} حصة</span></div>
    {upcoming.length === 0 && <div className="live-empty"><span>📅</span><b>لا توجد حصص قادمة حاليًا</b><small>{role === "student" ? "عندما يضيف معلمك حصة لصفك ستظهر هنا." : "أضف أول حصة مباشرة ليتمكن الطلاب من الانضمام."}</small></div>}
    <div className="live-cards">{upcoming.filter(m => role !== "student" || m.published).map(m=><article className="live-card" key={m.id}>
      <div className={"live-provider " + m.provider}>{m.provider === "zoom" ? "📹 Zoom" : "📞 Google Meet"}</div><h3>{m.title}</h3><p className="live-class-name">📚 {className(m.classId)}</p>
      <div className="live-meta"><span>🗓️ {displayDate(m.startsAt)}</span><span>⏱️ {m.durationMinutes} دقيقة</span></div>{m.description && <p className="live-description">{m.description}</p>}
      {m.published ? <a className="btn live-join" href={m.meetingUrl} target="_blank" rel="noopener noreferrer">دخول الحصة الآن ↗</a> : <span className="live-draft">غير منشورة للطلاب</span>}
      {isStaff && (role === "admin" || m.createdBy === profile?.uid) && <div className="live-manage-actions"><button type="button" className="mini" onClick={()=>edit(m)}>تعديل</button><button type="button" className="mini danger" onClick={()=>void remove(m)}>حذف</button></div>}
    </article>)}</div>
    {isStaff && past.length > 0 && <details className="live-past"><summary>الحصص السابقة ({past.length})</summary><div className="live-cards">{past.map(m=><article className="live-card past" key={m.id}><div className="live-provider">{m.provider === "zoom" ? "Zoom" : "Google Meet"}</div><h3>{m.title}</h3><p>{className(m.classId)} · {displayDate(m.startsAt)}</p>{role === "admin" || m.createdBy === profile?.uid ? <button className="mini" onClick={()=>edit(m)}>تعديل</button> : null}</article>)}</div></details>}
  </section>;
}