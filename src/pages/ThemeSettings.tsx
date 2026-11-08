import { useEffect, useState } from "react";
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
 { name: "داكن", colors: { navy: "#111827", navy2: "#374151", bg: "#111827", ink: "#f9fafb", panel: "#1f2937", line: "#4b5563", accent: "#60a5fa" } },
];
const fields: [keyof Colors, string][] = [["navy","لون الشريط الرئيسي"],["navy2","اللون الأساسي للأزرار"],["accent","لون الروابط والتأكيد"],["bg","لون خلفية المنصة"],["panel","لون البطاقات"],["ink","لون الكتابة"],["line","لون الحدود"]];
export default function ThemeSettings() {
 const { profile } = useAuth();
 const [colors,setColors]=useState<Colors>(defaults); const [saving,setSaving]=useState(false); const [message,setMessage]=useState("");
 useEffect(()=>onSnapshot(doc(db,"siteSettings","theme"),snap=>{if(snap.exists()){const saved=snap.data();setColors({navy:String(saved.primary??defaults.navy),navy2:String(saved.secondary??defaults.navy2),bg:String(saved.background??defaults.bg),ink:String(saved.text??defaults.ink),accent:String(saved.accent??defaults.accent)});}}),[]);
 if(profile?.role!=="admin")return <section className="panel"><h2>غير مسموح</h2><p>هذا القسم متاح لمدير المنصة فقط.</p></section>;
 const save=async(next:Colors)=>{setSaving(true);setMessage("");try{await setDoc(doc(db,"siteSettings","theme"),{primary:next.navy,secondary:next.navy2,background:next.bg,text:next.ink,accent:next.accent,updatedAt:new Date().toISOString()});setColors(next);setMessage("تم حفظ ألوان المنصة بنجاح.");}catch{setMessage("تعذر الحفظ. تأكد من نشر قواعد Firestore الجديدة واتصال الإنترنت.");}finally{setSaving(false);}};
 return <section className="panel theme-settings">
  <h2>🎨 تخصيص ألوان المنصة</h2><p>اختر الألوان التي تظهر لجميع مستخدمي منصة المستقبل.</p>
  <h3>قوالب ألوان جاهزة</h3><div className="theme-presets">{presets.map(p=><button type="button" key={p.name} className="theme-preset" onClick={()=>setColors(p.colors)}><span>{p.name}</span><i style={{background:p.colors.navy}}/><i style={{background:p.colors.navy2}}/><i style={{background:p.colors.bg,border:"1px solid #bbb"}}/></button>)}</div>
  <h3>تحكم يدوي في كل لون</h3><div className="theme-fields">{fields.map(([key,label])=><label key={key} className="theme-color-field"><span>{label}</span><input aria-label={label} type="color" value={colors[key]} onChange={e=>setColors(old=>({...old,[key]:e.target.value}))}/><code>{colors[key]}</code></label>)}</div>
  <div className="theme-preview" style={{background:colors.bg,color:colors.ink,borderColor:colors.line}}><strong>معاينة الألوان</strong><div className="theme-preview-bar" style={{background:colors.navy}}>منصة المستقبل التعليمية</div><div className="theme-preview-card" style={{background:colors.panel,borderColor:colors.line}}>مثال على بطاقة داخل المنصة <button type="button" style={{background:colors.navy2}}>زر تجريبي</button><a style={{color:colors.accent}}>رابط تجريبي</a></div></div>
  <div className="theme-actions"><button className="btn" type="button" disabled={saving} onClick={()=>void save(colors)}>{saving?"جارٍ الحفظ…":"💾 حفظ وتطبيق الألوان"}</button><button className="btn ghost" type="button" disabled={saving} onClick={()=>setColors(defaults)}>استعادة الافتراضي</button></div>
  {message&&<p role="status" className="theme-message">{message}</p>}
 </section>;
}