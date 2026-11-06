import { useState } from "react";
import { useAuth, Role } from "../auth/AuthContext";
import ClassPicker from "./ClassPicker";
interface Step { icon: string; title: string; text: string; extra?: "class" }
const STEPS: Partial<Record<Role, Step[]>> = {
  student: [
    { icon: "👋", title: "أهلًا بك في منصة المستقبل!", text: "هنا تتعلم باللعب: دروس واختبارات وألعاب ونقاط." },
    { icon: "🏫", title: "اختر صفك", text: "اختر صفك الدراسي لتظهر لك دروسه فقط.", extra: "class" },
    { icon: "📚", title: "الدروس والتقدم", text: "افتح الدرس ثم اضغط «تم الإكمال» ليزيد شريط تقدمك، وتستطيع المتابعة من حيث توقفت." },
    { icon: "📝", title: "الاختبارات والواجبات", text: "حلّ اختبار الدرس واعرف درجتك فورًا، وسلّم واجباتك من قسم الواجبات." },
    { icon: "🎮", title: "ألعاب ونقاط وشهادات", text: "العب واجمع النقاط والشارات، وعند إكمال مادة تحصل على شهادة باسمك." },
  ],
  teacher: [
    { icon: "👩‍🏫", title: "أهلًا بك يا معلم!", text: "تم اعتماد حسابك. هذه جولة سريعة قبل أن تبدأ." },
    { icon: "🎬", title: "إضافة الدروس", text: "من «إضافة درس» اختر الصف والمادة، وضع رابط الفيديو أو الملف (YouTube أو Drive أو غيرهما)، ثم فعّل «نشر الدرس»." },
    { icon: "📝", title: "الاختبارات والواجبات", text: "أنشئ اختبارًا لكل درس، وأضف الواجبات وصحّح تسليمات الطلاب من قسم الواجبات، وسيصل الطالب إشعار بدرجته." },
    { icon: "📣", title: "الإعلانات", text: "من الجرس أعلى الصفحة يمكنك إرسال إعلان عام لكل الطلاب وأولياء الأمور." },
  ],
  parent: [
    { icon: "👨‍👩‍👧", title: "أهلًا بك يا ولي الأمر!", text: "هنا تتابع تقدم أبنائك خطوة بخطوة." },
    { icon: "🔗", title: "ربط حساب ابنك", text: "تتواصل إدارة المنصة مع حضرتك لربط حسابك بحساب ابنك. بعد الربط يظهر ابنك في لوحتك." },
    { icon: "📊", title: "ماذا ستتابع؟", text: "الدروس المكتملة، ونتائج الاختبارات، ونقاط القوة والضعف، والواجبات المسلَّمة ودرجاتها، والإشعارات." },
  ],
  admin: [
    { icon: "🛠️", title: "أهلًا بك أيها المدير!", text: "لديك تحكم كامل في المنصة. هذه خطوات الإعداد الأولى." },
    { icon: "🏫", title: "الصفوف والمواد أولًا", text: "من «الصفوف والمواد» أضف صفوف المنصة ومواد الدراسة قبل إضافة الدروس." },
    { icon: "✅", title: "اعتماد المعلمين", text: "من «المستخدمون» يظهر طلب كل معلم جديد بزر «اعتماد كمعلم». ويمكنك أيضًا تغيير أي دور." },
    { icon: "🔗", title: "ربط أولياء الأمور", text: "من نفس القسم اربط كل ولي أمر بحساب ابنه ليتابع تقدمه." },
  ],
};

export default function Onboarding() {
  const { profile, setOnboarded } = useAuth();
  const steps = STEPS[profile!.role] ?? [];
  const [i, setI] = useState(0); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  if (!steps.length) return null;
  const s = steps[i], last = i === steps.length - 1;
  const finish = async () => {
    setBusy(true); setErr("");
    try { await setOnboarded(); } catch { setErr("تعذّر الحفظ، حاول مرة أخرى"); setBusy(false); }
  };
  return (<div className="overlay"><div className="onb" role="dialog" aria-modal="true" aria-label="جولة تعريفية">
    <div className="icon pop" key={i}>{s.icon}</div><h2>{s.title}</h2><p>{s.text}</p>
    {s.extra === "class" && <ClassPicker />}
    <div className="dots" aria-hidden="true">{steps.map((_, k) => <span key={k} className={k === i ? "on" : ""} />)}</div>
    {err && <p className="err" role="alert">{err}</p>}
    <div className="row" style={{ justifyContent: "center" }}>
      {i > 0 && <button className="mini" onClick={() => setI(i - 1)}>السابق</button>}
      {last ? <button className="btn" disabled={busy} onClick={finish}>{busy ? "لحظة…" : "ابدأ الآن 🚀"}</button>
            : <button className="btn" onClick={() => setI(i + 1)}>التالي</button>}
    </div>
    {!last && <button className="link" disabled={busy} onClick={finish}>تخطّي الجولة</button>}
  </div></div>);
}
