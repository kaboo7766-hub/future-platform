import { ChangeEvent, useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

type Colors = { navy: string; navy2: string; bg: string; ink: string; panel: string; line: string; accent: string };
const defaults: Colors = { navy: "#18267a", navy2: "#2b44c9", bg: "#f3f6ff", ink: "#14213d", panel: "#ffffff", line: "#d9e1f5", accent: "#2446c8" };
const presets: { name: string; colors: Colors }[] = [
  { name: "أزرق تعليمي", colors: defaults },
  { name: "أخضر هادئ", colors: { navy: "#14532d", navy2: "#15803d", bg: "#f0fdf4", ink: "#173326", panel: "#ffffff", line: "#bbf7d0", accent: "#16a34a" } },
  { name: "بنفسجي", colors: { navy: "#4c1d95", navy2: "#7c3aed", bg: "#f5f3ff", ink: "#2e1065", panel: "#ffffff", line: "#ddd6fe", accent: "#7c3aed" } },
  { name: "وردي للأطفال", colors: { navy: "#9d174d", navy2: "#db2777", bg: "#fff1f7", ink: "#500724", panel: "#ffffff", line: "#fbcfe8", accent: "#db2777" } },
  { name: "سماوي", colors: { navy: "#075985", navy2: "#0284c7", bg: "#ecfeff", ink: "#164e63", panel: "#ffffff", line: "#a5f3fc", accent: "#0891b2" } },
  { name: "داكن", colors: { navy: "#111827", navy2: "#374151", bg: "#111827", ink: "#f9fafb", panel: "#1f2937", line: "#4b5563", accent: "#60a5fa" } },
];
const fields: [keyof Colors, string][] = [
  ["navy", "لون الشريط الرئيسي"], ["navy2", "لون الأزرار"], ["accent", "لون الروابط والتأكيد"],
  ["bg", "لون خلفية المنصة"], ["panel", "لون البطاقات"], ["ink", "لون الكتابة"], ["line", "لون الحدود"],
];

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return reject(new Error("اختر صورة JPG أو PNG أو WEBP."));
    if (file.size > 12 * 1024 * 1024) return reject(new Error("حجم الصورة الأصلي كبير جدًا؛ اختر صورة أقل من 12 ميجابايت."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("تعذرت قراءة الصورة من الجهاز."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("ملف الصورة غير صالح."));
      image.onload = () => {
        let scale = Math.min(1, 1400 / Math.max(image.width, image.height));
        let quality = 0.76;
        let data = "";
        for (let attempt = 0; attempt < 12; attempt++) {
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext("2d");
          if (!context) return reject(new Error("تعذر تجهيز الصورة."));
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          data = canvas.toDataURL("image/jpeg", quality);
          if (data.length <= 245000) return resolve(data);
          if (quality > 0.48) quality -= 0.08;
          else { scale *= 0.82; quality = 0.58; }
        }
        if (data.length <= 245000) resolve(data);
        else reject(new Error("الصورة ما زالت كبيرة بعد الضغط. اختر صورة أصغر أو بدقة أقل."));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function ThemeSettings() {
  const { profile } = useAuth();
  const [colors, setColors] = useState<Colors>(defaults);
  const [backgroundImage, setBackgroundImage] = useState("");
  const [brandImage, setBrandImage] = useState("");
  const [fontFamily, setFontFamily] = useState("Cairo, system-ui, sans-serif");
  const [fontScale, setFontScale] = useState("1");
  const [iconTheme, setIconTheme] = useState("colorful");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<"background" | "brand" | "">("");
  const [message, setMessage] = useState("");

  useEffect(() => onSnapshot(doc(db, "themeSettings", "global"), snapshot => {
    if (snapshot.exists()) {
      const saved = snapshot.data();
      setColors({
        navy: String(saved.navy ?? defaults.navy), navy2: String(saved.navy2 ?? defaults.navy2),
        bg: String(saved.bg ?? defaults.bg), ink: String(saved.ink ?? defaults.ink),
        panel: String(saved.panel ?? defaults.panel), line: String(saved.line ?? defaults.line),
        accent: String(saved.accent ?? defaults.accent),
      });
      setBackgroundImage(typeof saved.backgroundImageData === "string" ? saved.backgroundImageData : "");
      setBrandImage(typeof saved.brandImageData === "string" ? saved.brandImageData : "");
      setFontFamily(typeof saved.fontFamily === "string" ? saved.fontFamily : "Cairo, system-ui, sans-serif");
      setFontScale(["0.95", "1", "1.08", "1.15"].includes(String(saved.fontScale)) ? String(saved.fontScale) : "1");
      setIconTheme(["colorful", "soft", "minimal", "large"].includes(String(saved.iconTheme)) ? String(saved.iconTheme) : "colorful");
    }
    setLoading(false);
  }, () => { setLoading(false); setMessage("تعذر تحميل إعدادات الخلفيات. تحقق من الاتصال."); }), []);

  if (profile?.role !== "admin") return <section className="panel"><h2>غير مسموح</h2><p>هذا القسم متاح لمدير المنصة فقط.</p></section>;

  const handleImage = async (event: ChangeEvent<HTMLInputElement>, kind: "background" | "brand") => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(kind);
    setMessage("");
    try {
      const data = await compressImage(file);
      if (kind === "background") setBackgroundImage(data);
      else setBrandImage(data);
      setMessage("تم تجهيز الصورة ومعاينتها. اضغط حفظ وتطبيق لتظهر للجميع.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تجهيز الصورة.");
      event.target.value = "";
    } finally { setUploading(""); }
  };

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      await setDoc(doc(db, "themeSettings", "global"), {
        ...colors,
        backgroundImageData: backgroundImage || null,
        brandImageData: brandImage || null,
        fontFamily, fontScale: Number(fontScale), iconTheme,
        updatedAt: new Date().toISOString(),
        updatedBy: profile.uid,
      });
      setMessage("تم حفظ الخلفيات والألوان وتطبيقها على المنصة لجميع المستخدمين.");
    } catch {
      setMessage("تعذر الحفظ. تأكد من اتصال الإنترنت وأن قواعد Firestore تسمح للمدير بتعديل إعدادات الخلفية.");
    } finally { setSaving(false); }
  };

  const colorInput = (key: keyof Colors, label: string) => (
    <label key={key} className="theme-color-field">
      <span>{label}</span><input aria-label={label} type="color" value={colors[key]} onChange={event => setColors(old => ({ ...old, [key]: event.target.value }))} />
      <code>{colors[key]}</code>
    </label>
  );

  return <section className="panel theme-settings">
    <h2>🎨 إدارة الثيمات والخلفيات</h2>
    <p>هذا القسم خاص بالمدير فقط. غيّر الألوان والخطوط والأيقونات والخلفيات، ثم احفظ لتظهر التغييرات عند جميع المستخدمين.</p>
    {loading && <p role="status">جارٍ تحميل الإعدادات المحفوظة…</p>}

    <h3>1. الألوان الأساسية</h3>
    <div className="theme-presets">
      {presets.map(p => <button type="button" key={p.name} className="theme-preset" onClick={() => setColors(p.colors)}>
        <span>{p.name}</span><i style={{ background: p.colors.navy }} /><i style={{ background: p.colors.navy2 }} /><i style={{ background: p.colors.bg, border: "1px solid #bbb" }} />
      </button>)}
    </div>
    <h3>تعديل كل لون يدويًا</h3>
    <div className="theme-fields">{fields.map(([key, label]) => colorInput(key, label))}</div>

    <h3>2. ثيمات الخطوط وطريقة الكتابة</h3>
    <div className="theme-style-controls">
      <label className="theme-style-field">نوع الخط
        <select value={fontFamily} onChange={event => setFontFamily(event.target.value)}>
          <option value="Cairo, system-ui, sans-serif">القاهرة (Cairo)</option>
          <option value="Tahoma, Arial, sans-serif">Tahoma</option>
          <option value="Arial, sans-serif">Arial</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="system-ui, sans-serif">خط الجهاز الافتراضي</option>
        </select>
      </label>
      <label className="theme-style-field">حجم الكتابة
        <select value={fontScale} onChange={event => setFontScale(event.target.value)}>
          <option value="0.95">صغير</option><option value="1">متوسط</option>
          <option value="1.08">كبير</option><option value="1.15">كبير جدًا</option>
        </select>
      </label>
    </div>
    <div className="theme-typography-preview" style={{ fontFamily, fontSize: `calc(1rem * ${fontScale})` }}>
      <strong>منصة المستقبل التعليمية</strong><p>نتعلم ونبدع ونحقق النجاح معًا.</p><small>معاينة شكل العناوين والنصوص داخل المنصة</small>
    </div>

    <h3>3. ثيمات الأيقونات</h3>
    <div className="theme-icon-options">
      {[
        { id: "colorful", name: "ملونة للأطفال", icon: "🌈" },
        { id: "soft", name: "ناعمة ومستديرة", icon: "🫧" },
        { id: "minimal", name: "بسيطة وهادئة", icon: "✦" },
        { id: "large", name: "كبيرة وواضحة", icon: "⭐" },
      ].map(option => <button type="button" key={option.id} className={iconTheme === option.id ? "theme-icon-choice selected" : "theme-icon-choice"} onClick={() => setIconTheme(option.id)}>
        <span>{option.icon}</span><b>{option.name}</b><small>{iconTheme === option.id ? "الثيم المختار" : "اختيار الثيم"}</small>
      </button>)}
    </div>

    <div className="theme-upload-grid">
      <article className="theme-upload-card">
        <h3>4. خلفية المنصة بالكامل</h3>
        <p>تظهر خلف صفحات المنصة والأقسام.</p>
        <label className="theme-upload-button">📷 اختر صورة الخلفية من الجهاز
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => void handleImage(event, "background")} />
        </label>
        {uploading === "background" && <p role="status">جارٍ ضغط الصورة…</p>}
        <div className="theme-image-preview theme-background-preview" style={{ backgroundColor: colors.bg, backgroundImage: backgroundImage ? `linear-gradient(rgba(10,25,50,.12),rgba(10,25,50,.12)),url("${backgroundImage}")` : undefined }}>
          {!backgroundImage && <span>معاينة خلفية المنصة</span>}
        </div>
        {backgroundImage && <button type="button" className="btn ghost" onClick={() => setBackgroundImage("")}>إزالة صورة الخلفية</button>}
      </article>

      <article className="theme-upload-card">
        <h3>5. الصورة خلف اسم المنصة</h3>
        <p>تظهر خلف اسم «منصة المستقبل التعليمية» في الشريط العلوي.</p>
        <label className="theme-upload-button">🖼️ اختر صورة اسم المنصة من الجهاز
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => void handleImage(event, "brand")} />
        </label>
        {uploading === "brand" && <p role="status">جارٍ ضغط الصورة…</p>}
        <div className="theme-brand-preview" style={{ backgroundImage: brandImage ? `linear-gradient(120deg,rgba(9,30,55,.72),rgba(9,30,55,.35)),url("${brandImage}")` : undefined }}>
          <strong>منصة المستقبل التعليمية</strong>
        </div>
        {brandImage && <button type="button" className="btn ghost" onClick={() => setBrandImage("")}>إزالة صورة الاسم</button>}
      </article>
    </div>

    <div className="theme-preview" style={{ background: colors.bg, color: colors.ink, borderColor: colors.line }}>
      <strong>معاينة الألوان</strong><div className="theme-preview-bar" style={{ background: colors.navy }}>منصة المستقبل التعليمية</div>
      <div className="theme-preview-card" style={{ background: colors.panel, borderColor: colors.line }}>
        مثال على بطاقة داخل المنصة <button type="button" style={{ background: colors.navy2 }}>زر تجريبي</button><a style={{ color: colors.accent }}>رابط تجريبي</a>
      </div>
    </div>
    <div className="theme-actions">
      <button className="btn" type="button" disabled={saving || loading || !!uploading} onClick={() => void save()}>{saving ? "جارٍ الحفظ…" : "💾 حفظ وتطبيق على المنصة"}</button>
      <button className="btn ghost" type="button" disabled={saving} onClick={() => { setColors(defaults); setBackgroundImage(""); setBrandImage(""); setFontFamily("Cairo, system-ui, sans-serif"); setFontScale("1"); setIconTheme("colorful"); }}>استعادة الشكل الافتراضي</button>
    </div>
    {message && <p role="status" className="theme-message">{message}</p>}
    <p className="note">ملاحظة: لتجنب Firebase Storage المدفوع، يتم ضغط الصور وحفظها داخل إعدادات Firestore. احتفظ بصور صغيرة الحجم؛ الحد الأقصى بعد الضغط 245 كيلوبايت لكل صورة.</p>
  </section>;
}
