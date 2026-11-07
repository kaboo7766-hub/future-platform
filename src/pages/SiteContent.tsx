import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useSite, Contact, SiteTheme } from "./HomeExtras";
type Msg = { ok: boolean; t: string } | null;
const blank: Contact = { email: "", phone: "", whatsapp: "", facebook: "", instagram: "", youtube: "" };
const DEFAULT_THEME: SiteTheme = { primary: "#18267a", secondary: "#2b44c9", background: "#f3f6ff", text: "#14213d", accent: "#2446c8" };
function imageToData(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return reject(new Error("اختر صورة JPG أو PNG أو WEBP."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("تعذرت قراءة الصورة."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("ملف الصورة غير صالح."));
      img.onload = () => {
        const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("تعذر تجهيز الصورة."));
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let data = canvas.toDataURL("image/jpeg", 0.72);
        if (data.length > 560000) {
          const small = document.createElement("canvas"); small.width = Math.round(canvas.width * .7); small.height = Math.round(canvas.height * .7);
          const c = small.getContext("2d"); if (!c) return reject(new Error("تعذر ضغط الصورة."));
          c.fillStyle = "#fff"; c.fillRect(0, 0, small.width, small.height); c.drawImage(canvas, 0, 0, small.width, small.height);
          data = small.toDataURL("image/jpeg", .58);
        }
        if (data.length > 560000) return reject(new Error("الصورة كبيرة جدًا؛ اختر صورة أصغر."));
        resolve(data);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
export default function SiteContent() {
  const { t, r, c, theme, banners } = useSite();
  const [tf, setTf] = useState({ name: "", subject: "", bio: "" }), [rf, setRf] = useState({ author: "", text: "" });
  const [cf, setCf] = useState<Contact>(blank), [themeForm, setThemeForm] = useState<SiteTheme>(DEFAULT_THEME);
  const [bannerTitle, setBannerTitle] = useState(""), [bannerData, setBannerData] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  useEffect(() => { if (c) setCf({ ...blank, ...c }); }, [c]);
  useEffect(() => { setThemeForm({ ...DEFAULT_THEME, ...theme }); }, [theme]);
  const run = async (fn: () => Promise<unknown>, ok: string) => { setMsg(null); try { await fn(); setMsg({ ok: true, t: ok }); } catch { setMsg({ ok: false, t: "تعذّر الحفظ، تحقق من الصلاحيات واتصال الإنترنت." }); } };
  const addT = () => {
    if (!tf.name.trim() || !tf.subject.trim()) return setMsg({ ok: false, t: "اكتب اسم المدرس والمادة" });
    void run(async () => { await addDoc(collection(db, "siteTeachers"), { name: tf.name.trim(), subject: tf.subject.trim(), bio: tf.bio.trim() }); setTf({ name: "", subject: "", bio: "" }); }, "تمت إضافة المدرس");
  };
  const addR = () => {
    if (!rf.text.trim()) return setMsg({ ok: false, t: "اكتب نص الرأي" });
    void run(async () => { await addDoc(collection(db, "siteTestimonials"), { author: rf.author.trim() || "ولي أمر", text: rf.text.trim() }); setRf({ author: "", text: "" }); }, "تمت إضافة الرأي");
  };
  const saveC = () => {
    const bad = (u?: string) => !!u && !u.startsWith("https://");
    if (bad(cf.facebook) || bad(cf.instagram) || bad(cf.youtube)) return setMsg({ ok: false, t: "روابط التواصل الاجتماعي يجب أن تبدأ بـ https://" });
    if (cf.email && !cf.email.includes("@")) return setMsg({ ok: false, t: "البريد الإلكتروني غير صحيح" });
    void run(() => setDoc(doc(db, "siteSettings", "contact"), cf), "تم حفظ بيانات التواصل");
  };
  const saveTheme = () => void run(() => setDoc(doc(db, "siteSettings", "theme"), themeForm), "تم حفظ ألوان المنصة وتطبيقها على الصفحات.");
  const addBanner = () => {
    if (!bannerData) return setMsg({ ok: false, t: "اختر صورة أولًا." });
    if (banners.length >= 5) return setMsg({ ok: false, t: "يمكنك إضافة 5 صور كحد أقصى؛ احذف صورة قديمة أولًا." });
    void run(async () => {
      await addDoc(collection(db, "siteSettings"), { type: "banner", title: bannerTitle.trim(), imageData: bannerData, order: banners.length, createdAt: new Date().toISOString() });
      setBannerTitle(""); setBannerData("");
      const input = document.getElementById("site-banner-file") as HTMLInputElement | null; if (input) input.value = "";
    }, "تمت إضافة الصورة إلى واجهة المنصة.");
  };
  const inp = (k: keyof Contact, ph: string, ltr = true) => <input dir={ltr ? "ltr" : undefined} placeholder={ph} value={cf[k] ?? ""} onChange={e => setCf({ ...cf, [k]: e.target.value })} />;
  const colorInput = (key: keyof SiteTheme, label: string) => <label className="theme-color"><span>{label}</span><input aria-label={label} type="color" value={themeForm[key]} onChange={e => setThemeForm({ ...themeForm, [key]: e.target.value })} /><code>{themeForm[key]}</code></label>;
  return (<section className="panel"><h3>محتوى الصفحة الرئيسية</h3>
    <h4>🎨 التحكم في ألوان المنصة</h4>
    <p className="note">اختر الألوان التي تحبها، ثم اضغط حفظ. ستتغير ألوان المنصة عند المدير والمعلم والطالب والصفحة الرئيسية.</p>
    <div className="theme-controls">{colorInput("primary", "اللون الأساسي")}{colorInput("secondary", "اللون الثانوي")}{colorInput("background", "لون الخلفية")}{colorInput("text", "لون الكتابة")}{colorInput("accent", "لون الأزرار والروابط")}</div>
    <div className="row"><button type="button" className="btn" onClick={saveTheme}>حفظ الألوان</button><button type="button" className="btn ghost" onClick={() => setThemeForm(DEFAULT_THEME)}>استعادة الألوان الأصلية</button></div>
    <h4>🖼️ صور الأطفال في واجهة المنصة</h4>
    <p className="note">ارفع صورًا تعليمية أو كرتونية مناسبة للأطفال لتظهر في الصفحة الرئيسية. الصور تُضغط وتُحفظ في Firestore، بدون Firebase Storage. الحد الأقصى 5 صور.</p>
    <input placeholder="عنوان قصير للصورة (اختياري)" value={bannerTitle} onChange={e => setBannerTitle(e.target.value)} />
    <label htmlFor="site-banner-file">اختيار صورة من الجهاز (JPG / PNG / WEBP)</label>
    <input id="site-banner-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={async e => {
      const file = e.target.files?.[0]; if (!file) return;
      try { setBannerData(await imageToData(file)); setMsg({ ok: true, t: "تم تجهيز الصورة؛ اضغط إضافة الصورة لحفظها." }); }
      catch (error) { setBannerData(""); setMsg({ ok: false, t: error instanceof Error ? error.message : "تعذّر تجهيز الصورة." }); e.currentTarget.value = ""; }
    }} />
    {bannerData && <img className="banner-preview" src={bannerData} alt="معاينة الصورة قبل الإضافة" />}
    <button type="button" className="btn" onClick={addBanner}>إضافة الصورة للواجهة</button>
    <div className="site-banner-list">{banners.map((x) => <article className="site-banner-item" key={x.id}><img src={x.imageData} alt={x.title || "صورة واجهة"} /><div><b>{x.title || "صورة بدون عنوان"}</b><button type="button" className="mini" onClick={() => void run(() => deleteDoc(doc(db, "siteSettings", x.id)), "تم حذف الصورة من الواجهة.")}>حذف الصورة</button></div></article>)}</div>
    <h4>إضافة مدرس</h4>
    <input placeholder="اسم المدرس" value={tf.name} onChange={e => setTf({ ...tf, name: e.target.value })} />
    <input placeholder="المادة" value={tf.subject} onChange={e => setTf({ ...tf, subject: e.target.value })} />
    <input placeholder="نبذة قصيرة (اختياري)" value={tf.bio} onChange={e => setTf({ ...tf, bio: e.target.value })} />
    <button className="btn" onClick={addT}>إضافة المدرس</button>
    <p>{t.map(x => <span key={x.id} className="chip">{x.name}<button aria-label="حذف" onClick={() => void run(() => deleteDoc(doc(db, "siteTeachers", x.id)), "تم الحذف")}>×</button></span>)}</p>
    <h4>إضافة رأي ولي أمر (رأي حقيقي بموافقة صاحبه)</h4>
    <input placeholder="الاسم أو الوصف (مثال: ولي أمر طالب)" value={rf.author} onChange={e => setRf({ ...rf, author: e.target.value })} />
    <textarea placeholder="نص الرأي" value={rf.text} onChange={e => setRf({ ...rf, text: e.target.value })} />
    <button className="btn" onClick={addR}>إضافة الرأي</button>
    <p>{r.map(x => <span key={x.id} className="chip">{x.author}<button aria-label="حذف" onClick={() => void run(() => deleteDoc(doc(db, "siteTestimonials", x.id)), "تم الحذف")}>×</button></span>)}</p>
    <h4>بيانات التواصل</h4>
    {inp("phone", "رقم الهاتف")}{inp("whatsapp", "رقم واتساب بالصيغة الدولية")}{inp("email", "البريد الإلكتروني")}
    {inp("facebook", "رابط فيسبوك https://...")}{inp("instagram", "رابط إنستجرام https://...")}{inp("youtube", "رابط يوتيوب https://...")}
    <button className="btn" onClick={saveC}>حفظ بيانات التواصل</button>
    {msg && <p className={msg.ok ? "ok" : "err"} role="alert">{msg.t}</p>}
  </section>);
}
