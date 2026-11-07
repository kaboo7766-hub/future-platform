import { useEffect, useState, FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
interface Item { id: string; name: string }
interface LessonItem { id: string; title: string; description?: string; type?: string; published?: boolean; classId?: string; subjectId?: string; imageData?: string; gameWords?: string[] }
const HOSTS = ["youtube.com","www.youtube.com","youtu.be","drive.google.com","docs.google.com","res.cloudinary.com","vimeo.com","player.vimeo.com"];
const okUrl = (u: string) => { try { const x = new URL(u); return x.protocol === "https:" && HOSTS.includes(x.hostname); } catch { return false; } };
const blank = () => ({ title: "", description: "", classId: "", subjectId: "", order: 1, type: "video", url: "", imageData: "", published: false, gameWordsText: "" });

function useList(name: string) {
  const [l, setL] = useState<Item[]>([]);
  useEffect(() => onSnapshot(collection(db, name), s => setL(s.docs.map(d => ({ id: d.id, name: d.data().name })))), [name]);
  return l;
}
function fileAsImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return reject(new Error("اختر صورة بصيغة JPG أو PNG أو WEBP."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("تعذرت قراءة الصورة."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("ملف الصورة غير صالح."));
      img.onload = () => {
        const scale = Math.min(1, 1500 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("تعذر تجهيز الصورة."));
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let data = canvas.toDataURL("image/jpeg", 0.78);
        if (data.length > 650000) {
          const smaller = document.createElement("canvas");
          smaller.width = Math.max(1, Math.round(canvas.width * 0.72));
          smaller.height = Math.max(1, Math.round(canvas.height * 0.72));
          const c = smaller.getContext("2d");
          if (!c) return reject(new Error("تعذر ضغط الصورة."));
          c.fillStyle = "#ffffff"; c.fillRect(0, 0, smaller.width, smaller.height);
          c.drawImage(canvas, 0, 0, smaller.width, smaller.height);
          data = smaller.toDataURL("image/jpeg", 0.62);
        }
        if (data.length > 650000) return reject(new Error("الصورة كبيرة جدًا. اختر صورة أصغر."));
        resolve(data);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function Manage({ isAdmin }: { isAdmin: boolean }) {
  const { profile } = useAuth();
  const classes = useList("classes"), subjects = useList("subjects");
  const availableClasses = isAdmin ? classes : classes.filter(c => (profile?.classIds ?? []).includes(c.id));
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [f, setF] = useState(blank());
  const [nc, setNc] = useState(""), [ns, setNs] = useState("");
  useEffect(() => {
    const ids = profile?.classIds ?? [];
    const lessonQuery = isAdmin ? collection(db, "lessons")
      : ids.length ? query(collection(db, "lessons"), where("classId", "in", ids.slice(0, 30)))
      : query(collection(db, "lessons"), where("classId", "==", "__none__"));
    return onSnapshot(lessonQuery, s => setLessons(s.docs.map(d => ({ id: d.id, ...d.data() } as LessonItem)).sort((a,b)=>a.title.localeCompare(b.title,"ar"))),
      () => setMsg({ ok:false, t:"تعذّر تحميل قائمة دروس الصفوف المخصصة." }));
  }, [isAdmin, profile?.classIds]);
  const addName = async (col: string, v: string, reset: () => void) => {
    const name = v.trim();
    if (!name) return setMsg({ ok: false, t: "اكتب الاسم قبل الإضافة." });
    try { await addDoc(collection(db, col), { name }); reset(); setMsg({ ok: true, t: "تمت الإضافة بنجاح." }); }
    catch { setMsg({ ok: false, t: "تعذّرت الإضافة. تحقق من صلاحيات المدير واتصال الإنترنت." }); }
  };
  const removeCatalogItem = async (kind: "classes" | "subjects", id: string, name: string) => {
    if (!window.confirm(`هل تريد حذف ${kind === "classes" ? "الصف" : "المادة"} «${name}»؟`)) return;
    setMsg(null);
    try {
      const field = kind === "classes" ? "classId" : "subjectId";
      const used = await getDocs(query(collection(db, "lessons"), where(field, "==", id)));
      if (!used.empty) return setMsg({ ok: false, t: "لا يمكن حذف هذا العنصر لأنه مرتبط بدروس موجودة." });
      await deleteDoc(doc(db, kind, id)); setMsg({ ok: true, t: "تم الحذف." });
    } catch { setMsg({ ok: false, t: "تعذّر الحذف. تحقق من الصلاحيات." }); }
  };
  const save = async (e: FormEvent) => {
    e.preventDefault(); setMsg(null);
    if (!f.title.trim() || !f.classId || !f.subjectId) return setMsg({ ok: false, t: "أكمل اسم الدرس والصف والمادة." });
    if (!isAdmin && !(profile?.classIds ?? []).includes(f.classId)) return setMsg({ ok: false, t: "هذا الصف غير مخصص لحسابك من المدير." });
    const parsedGameWords = f.gameWordsText.split(/[،,\\n\\r]+/).map((word: string) => word.trim()).filter(Boolean);
    if (parsedGameWords.length > 100) return setMsg({ ok: false, t: "الحد الأقصى 100 كلمة للدرس." });
    const gameWords = parsedGameWords;
    if (f.type === "image") {
      if (!f.imageData && !okUrl(f.url)) return setMsg({ ok: false, t: "اختر صورة من جهازك أو أدخل رابط صورة https." });
    } else if (!okUrl(f.url)) return setMsg({ ok: false, t: "الرابط غير مسموح. استخدم رابط https من خدمة مدعومة." });
    try {
      const payload: Record<string, unknown> = {
        title: f.title.trim(), description: f.description.trim(), classId: f.classId,
        subjectId: f.subjectId, order: f.order, type: f.type, url: f.imageData ? "" : f.url.trim(),
        published: f.published, gameWords, createdBy: profile!.uid, createdAt: serverTimestamp()
      };
      if (f.imageData) payload.imageData = f.imageData;
      const ref = await addDoc(collection(db, "lessons"), payload);
      try { await addDoc(collection(db, "activityLogs"), { uid: profile!.uid, action: "lesson.create", target: ref.id, at: serverTimestamp() }); } catch { /* lesson was saved; activity log is secondary */ }
      setMsg({ ok: true, t: "تم حفظ الدرس بنجاح." }); setF(blank());
      const input = document.getElementById("lesson-image-file") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch { setMsg({ ok: false, t: "لم يتم حفظ الدرس. تحقق من صلاحيات Firestore واتصال الإنترنت." }); }
  };
  const removeLesson = async (lesson: LessonItem) => {
    if (!isAdmin) return;
    if (!window.confirm(`تأكيد حذف الدرس «${lesson.title}»؟ سيتم حذف الدرس فقط، مع الاحتفاظ بسجلات الحضور والتقدم والاختبارات المرتبطة به.`)) return;
    try { await deleteDoc(doc(db, "lessons", lesson.id)); setMsg({ ok: true, t: "تم حذف الدرس. السجلات التاريخية المرتبطة به ما زالت محفوظة." }); }
    catch { setMsg({ ok: false, t: "تعذّر حذف الدرس. تأكد من صلاحية المدير واتصال الإنترنت." }); }
  };
  return (<section className="panel">
    <h3>إضافة درس جديد</h3>
    <form onSubmit={save}>
      <input required placeholder="اسم الدرس" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
      <input placeholder="وصف مختصر" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
      <label>كلمات الدرس للألعاب (حتى 100 كلمة، افصل بين الكلمات بفاصلة أو سطر جديد)</label>
      <textarea rows={4} maxLength={12000} placeholder="مثال: شمس، قمر، نجمة، كوكب..." value={f.gameWordsText} onChange={e => setF({ ...f, gameWordsText: e.target.value })} />
      <small>ستتحول الكلمات تلقائيًا إلى لعبة لهذا الدرس، مقسمة إلى 10 مراحل متدرجة.</small>
      <select required value={f.classId} onChange={e => setF({ ...f, classId: e.target.value })}><option value="">الصف</option>{availableClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select required value={f.subjectId} onChange={e => setF({ ...f, subjectId: e.target.value })}><option value="">المادة</option>{subjects.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select value={f.type} onChange={e => setF({ ...f, type: e.target.value, url: "", imageData: "" })}><option value="video">فيديو</option><option value="pdf">PDF</option><option value="audio">صوت</option><option value="image">صورة</option></select>
      {f.type === "image" ? <>
        <label htmlFor="lesson-image-file">اختر صورة من الجهاز (JPG / PNG / WEBP)</label>
        <input id="lesson-image-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={async e => {
          const file = e.target.files?.[0]; if (!file) return;
          try { const imageData = await fileAsImage(file); setF(current => ({ ...current, imageData, url: "" })); setMsg({ ok: true, t: "تم تجهيز الصورة وضغطها. لن يتم استخدام Firebase Storage." }); }
          catch (error) { setMsg({ ok: false, t: error instanceof Error ? error.message : "تعذر تجهيز الصورة." }); e.currentTarget.value = ""; }
        }} />
        {f.imageData && <img src={f.imageData} alt="معاينة الصورة" style={{ maxWidth: "220px", maxHeight: "160px", objectFit: "contain", borderRadius: 12 }} />}
        <input dir="ltr" placeholder="أو رابط صورة https (اختياري)" value={f.url} onChange={e => setF({ ...f, url: e.target.value, imageData: "" })} />
      </> : <input required dir="ltr" placeholder="https://..." value={f.url} onChange={e => setF({ ...f, url: e.target.value })} />}
      <label>ترتيب الدرس</label><input type="number" min={1} value={f.order} onChange={e => setF({ ...f, order: +e.target.value })} />
      <label><input type="checkbox" checked={f.published} onChange={e => setF({ ...f, published: e.target.checked })} /> نشر الدرس</label>
      <button className="btn">حفظ الدرس</button>
    </form>
    {msg && <p className={msg.ok ? "ok" : "err"} role="alert">{msg.t}</p>}
    <h3>الدروس الحالية</h3>
    {!lessons.length && <p className="note">لا توجد دروس مسجلة حتى الآن.</p>}
    <div className="grid">{lessons.map(l => <article className="card" key={l.id}>
      <b>{l.title}</b><small>{l.description || "بدون وصف"} · {l.published ? "منشور" : "مسودة"}</small>
      {l.imageData && <img src={l.imageData} alt="" style={{ width: "100%", maxHeight: 110, objectFit: "cover", borderRadius: 8 }} />}
      {isAdmin && <button type="button" className="mini" onClick={() => void removeLesson(l)}>حذف الدرس</button>}
    </article>)}</div>
    {isAdmin && <><h3>الصفوف والمواد</h3>
      <div className="row"><input placeholder="صف جديد" value={nc} onChange={e => setNc(e.target.value)} /><button type="button" className="btn" onClick={() => void addName("classes", nc, () => setNc(""))}>إضافة</button></div>
      <div className="row"><input placeholder="مادة جديدة" value={ns} onChange={e => setNs(e.target.value)} /><button type="button" className="btn" onClick={() => void addName("subjects", ns, () => setNs(""))}>إضافة</button></div>
      <p>{classes.map(c => <span key={c.id} className="chip">{c.name}<button onClick={() => void removeCatalogItem("classes", c.id, c.name)} aria-label="حذف">×</button></span>)}</p>
      <p>{subjects.map(c => <span key={c.id} className="chip">{c.name}<button onClick={() => void removeCatalogItem("subjects", c.id, c.name)} aria-label="حذف">×</button></span>)}</p>
      <button type="button" className="link" onClick={() => setDoc(doc(db, "settings", "app"), { subscriptionsEnabled: false }, { merge: true })}>تهيئة إعدادات المنصة (اشتراكات معطّلة)</button></>}
  </section>);
}
