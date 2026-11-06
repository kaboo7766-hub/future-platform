import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useSite, Contact } from "./HomeExtras";
type Msg = { ok: boolean; t: string } | null;
const blank: Contact = { email: "", phone: "", whatsapp: "", facebook: "", instagram: "", youtube: "" };
export default function SiteContent() {
  const { t, r, c } = useSite();
  const [tf, setTf] = useState({ name: "", subject: "", bio: "" }), [rf, setRf] = useState({ author: "", text: "" });
  const [cf, setCf] = useState<Contact>(blank); const [msg, setMsg] = useState<Msg>(null);
  useEffect(() => { if (c) setCf({ ...blank, ...c }); }, [c]);
  const run = async (fn: () => Promise<unknown>, ok: string) => { setMsg(null); try { await fn(); setMsg({ ok: true, t: ok }); } catch { setMsg({ ok: false, t: "تعذّر الحفظ، تحقق من الصلاحيات" }); } };
  const addT = () => {
    if (!tf.name.trim() || !tf.subject.trim()) return setMsg({ ok: false, t: "اكتب اسم المدرس والمادة" });
    run(async () => { await addDoc(collection(db, "siteTeachers"), { name: tf.name.trim(), subject: tf.subject.trim(), bio: tf.bio.trim() }); setTf({ name: "", subject: "", bio: "" }); }, "تمت إضافة المدرس");
  };
  const addR = () => {
    if (!rf.text.trim()) return setMsg({ ok: false, t: "اكتب نص الرأي" });
    run(async () => { await addDoc(collection(db, "siteTestimonials"), { author: rf.author.trim() || "ولي أمر", text: rf.text.trim() }); setRf({ author: "", text: "" }); }, "تمت إضافة الرأي");
  };
  const saveC = () => {
    const bad = (u?: string) => !!u && !u.startsWith("https://");
    if (bad(cf.facebook) || bad(cf.instagram) || bad(cf.youtube)) return setMsg({ ok: false, t: "روابط التواصل الاجتماعي يجب أن تبدأ بـ https://" });
    if (cf.email && !cf.email.includes("@")) return setMsg({ ok: false, t: "البريد الإلكتروني غير صحيح" });
    run(() => setDoc(doc(db, "siteSettings", "contact"), cf), "تم حفظ بيانات التواصل");
  };
  const inp = (k: keyof Contact, ph: string, ltr = true) => <input dir={ltr ? "ltr" : undefined} placeholder={ph} value={cf[k] ?? ""} onChange={e => setCf({ ...cf, [k]: e.target.value })} />;
  return (<section className="panel"><h3>محتوى الصفحة الرئيسية</h3>
    <h4>إضافة مدرس</h4>
    <input placeholder="اسم المدرس" value={tf.name} onChange={e => setTf({ ...tf, name: e.target.value })} />
    <input placeholder="المادة" value={tf.subject} onChange={e => setTf({ ...tf, subject: e.target.value })} />
    <input placeholder="نبذة قصيرة (اختياري)" value={tf.bio} onChange={e => setTf({ ...tf, bio: e.target.value })} />
    <button className="btn" onClick={addT}>إضافة المدرس</button>
    <p>{t.map(x => <span key={x.id} className="chip">{x.name}<button aria-label="حذف" onClick={() => run(() => deleteDoc(doc(db, "siteTeachers", x.id)), "تم الحذف")}>×</button></span>)}</p>
    <h4>إضافة رأي ولي أمر (رأي حقيقي بموافقة صاحبه)</h4>
    <input placeholder="الاسم أو الوصف (مثال: ولي أمر طالب)" value={rf.author} onChange={e => setRf({ ...rf, author: e.target.value })} />
    <textarea placeholder="نص الرأي" value={rf.text} onChange={e => setRf({ ...rf, text: e.target.value })} />
    <button className="btn" onClick={addR}>إضافة الرأي</button>
    <p>{r.map(x => <span key={x.id} className="chip">{x.author}<button aria-label="حذف" onClick={() => run(() => deleteDoc(doc(db, "siteTestimonials", x.id)), "تم الحذف")}>×</button></span>)}</p>
    <h4>بيانات التواصل</h4>
    {inp("phone", "رقم الهاتف")}{inp("whatsapp", "رقم واتساب بالصيغة الدولية")}{inp("email", "البريد الإلكتروني")}
    {inp("facebook", "رابط فيسبوك https://...")}{inp("instagram", "رابط إنستجرام https://...")}{inp("youtube", "رابط يوتيوب https://...")}
    <button className="btn" onClick={saveC}>حفظ بيانات التواصل</button>
    {msg && <p className={msg.ok ? "ok" : "err"} role="alert">{msg.t}</p>}
  </section>);
}
