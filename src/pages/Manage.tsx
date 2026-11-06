import { useEffect, useState, FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
interface Item { id: string; name: string }
const HOSTS = ["youtube.com","www.youtube.com","youtu.be","drive.google.com","docs.google.com","res.cloudinary.com","vimeo.com","player.vimeo.com"];
const okUrl = (u: string) => { try { const x = new URL(u); return x.protocol === "https:" && HOSTS.includes(x.hostname); } catch { return false; } };

function useList(name: string) {
  const [l, setL] = useState<Item[]>([]);
  useEffect(() => onSnapshot(collection(db, name), s => setL(s.docs.map(d => ({ id: d.id, name: d.data().name })))), [name]);
  return l;
}
export default function Manage({ isAdmin }: { isAdmin: boolean }) {
  const { profile } = useAuth();
  const classes = useList("classes"), subjects = useList("subjects");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [f, setF] = useState({ title: "", description: "", classId: "", subjectId: "", order: 1, type: "video", url: "", published: false });
  const [nc, setNc] = useState(""), [ns, setNs] = useState("");
  const addName = async (col: string, v: string, reset: () => void) => {
    const name = v.trim();
    if (!name) {
      setMsg({ ok: false, t: "اكتب الاسم قبل الإضافة." });
      return;
    }
    try {
      await addDoc(collection(db, col), { name });
      reset();
      setMsg({ ok: true, t: "تمت الإضافة بنجاح." });
    } catch {
      setMsg({ ok: false, t: "تعذّرت الإضافة. تحقق من صلاحيات المدير واتصال الإنترنت." });
    }
  };
  const removeCatalogItem = async (kind: "classes" | "subjects", id: string, name: string) => {
    if (!window.confirm(`هل تريد حذف ${kind === "classes" ? "الصف" : "المادة"} «${name}»؟`)) return;
    setMsg(null);
    try {
      const field = kind === "classes" ? "classId" : "subjectId";
      const used = await getDocs(query(collection(db, "lessons"), where(field, "==", id)));
      if (!used.empty) {
        setMsg({ ok: false, t: "لا يمكن حذف هذا العنصر لأنه مرتبط بدروس موجودة. انقل الدروس أو عالج ارتباطها أولًا." });
        return;
      }
      await deleteDoc(doc(db, kind, id));
      setMsg({ ok: true, t: "تم الحذف بعد التأكد من عدم ارتباطه بدروس." });
    } catch {
      setMsg({ ok: false, t: "تعذّر الحذف. تحقق من صلاحيات المدير واتصال الإنترنت." });
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault(); setMsg(null);
    if (!okUrl(f.url)) return setMsg({ ok: false, t: "الرابط غير مسموح. استخدم رابط https من خدمة مدعومة (YouTube، Drive، Cloudinary، Vimeo)." });
    if (!f.title.trim() || !f.classId || !f.subjectId) {
      setMsg({ ok: false, t: "أكمل اسم الدرس والصف والمادة." });
      return;
    }
    try {
      const ref = await addDoc(collection(db, "lessons"), {
        ...f, title: f.title.trim(), description: f.description.trim(),
        createdBy: profile!.uid, createdAt: serverTimestamp()
      });
      let warning = "";
      try {
        await addDoc(collection(db, "activityLogs"), {
          uid: profile!.uid, action: "lesson.create", target: ref.id, at: serverTimestamp()
        });
      } catch {
        warning = " (تعذّر تسجيل العملية في سجل الأنشطة)";
      }
      setMsg({ ok: true, t: `تم حفظ الدرس بنجاح.${warning}` });
      setF({ ...f, title: "", description: "", url: "" });
    } catch {
      setMsg({ ok: false, t: "لم يتم حفظ الدرس. تحقق من صلاحيات Firestore واتصال الإنترنت." });
    }
  };
  return (<section className="panel"><h3>إضافة درس</h3>
    <form onSubmit={save}>
      <input required placeholder="اسم الدرس" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
      <input placeholder="وصف مختصر" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
      <select required value={f.classId} onChange={e => setF({ ...f, classId: e.target.value })}><option value="">الصف</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select required value={f.subjectId} onChange={e => setF({ ...f, subjectId: e.target.value })}><option value="">المادة</option>{subjects.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select value={f.type} onChange={e => setF({ ...f, type: e.target.value })}><option value="video">فيديو</option><option value="pdf">PDF</option><option value="audio">صوت</option><option value="image">صورة</option></select>
      <input required dir="ltr" placeholder="https://..." value={f.url} onChange={e => setF({ ...f, url: e.target.value })} />
      <input type="number" min={1} value={f.order} onChange={e => setF({ ...f, order: +e.target.value })} />
      <label><input type="checkbox" checked={f.published} onChange={e => setF({ ...f, published: e.target.checked })} /> نشر الدرس</label>
      <button className="btn">حفظ الدرس</button>
    </form>
    {msg && <p className={msg.ok ? "ok" : "err"} role="alert">{msg.t}</p>}
    {isAdmin && <><h3>الصفوف والمواد</h3>
      <div className="row"><input placeholder="صف جديد" value={nc} onChange={e => setNc(e.target.value)} /><button className="btn" onClick={() => addName("classes", nc, () => setNc(""))}>إضافة</button></div>
      <div className="row"><input placeholder="مادة جديدة" value={ns} onChange={e => setNs(e.target.value)} /><button className="btn" onClick={() => addName("subjects", ns, () => setNs(""))}>إضافة</button></div>
      <p>{classes.map(c => <span key={c.id} className="chip">{c.name}<button onClick={() => void removeCatalogItem("classes", c.id, c.name)} aria-label="حذف">×</button></span>)}</p>
      <p>{subjects.map(c => <span key={c.id} className="chip">{c.name}<button onClick={() => void removeCatalogItem("subjects", c.id, c.name)} aria-label="حذف">×</button></span>)}</p>
      <button className="link" onClick={() => setDoc(doc(db, "settings", "app"), { subscriptionsEnabled: false }, { merge: true })}>تهيئة إعدادات المنصة (اشتراكات معطّلة)</button></>}
  </section>);
}
