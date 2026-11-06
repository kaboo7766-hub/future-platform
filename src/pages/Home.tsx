import { Link } from "react-router-dom";
import { useSite, Characters, TeachersSection, TestimonialsSection, ContactSection } from "./HomeExtras";
const chips = [["🖥️", "تعليم تفاعلي بجودة عالية"], ["💬", "متابعة مباشرة من المعلمين"], ["📊", "تقارير دورية لولي الأمر"], ["📝", "أنشطة واختبارات ذكية"]];
const features = [
  ["🎬", "دروس تفاعلية", "فيديو وملفات وتدريبات لكل درس"], ["✅", "اختبارات فورية", "تصحيح تلقائي ونتيجة في لحظتها"],
  ["🎮", "ألعاب تعليمية", "حروف وحساب وذاكرة بأصوات تشجيع"], ["👨‍👩‍👧", "متابعة ولي الأمر", "تقدم الأبناء ونقاط القوة والضعف"],
  ["🏆", "نقاط وشهادات", "شارات إنجاز وشهادة عند إكمال المادة"], ["🔒", "تجربة آمنة", "صلاحيات منفصلة وحماية لبيانات الطلاب"],
];
const stages = ["التأسيس", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس"];
const why = [["🚀", "تطوير المهارات"], ["🕒", "تعلّم في أي وقت"], ["📈", "متابعة مستمرة"], ["🛡️", "بيئة تعليمية آمنة"], ["🧩", "محتوى ممتع"], ["🌍", "من أي مكان"]];
const faqs = [
  ["هل المنصة مجانية؟", "نعم، المنصة مجانية حاليًا، وقد تُضاف اشتراكات اختيارية لاحقًا من الإدارة."],
  ["من يستطيع التسجيل؟", "الطلاب وأولياء الأمور بحساب مباشر، والمعلمون بطلب يعتمده مدير المنصة."],
  ["كيف يتابع ولي الأمر ابنه؟", "تربط الإدارة حساب ولي الأمر بحساب ابنه، فتظهر له الدروس المكتملة ونتائج الاختبارات والواجبات."],
  ["على أي أجهزة تعمل؟", "على الهاتف والجهاز اللوحي والكمبيوتر من المتصفح."],
];
export default function Home() {
  const { t, r, c } = useSite();
  return (<main>
    <section className="hero2"><div className="hero2-in">
      <div>
        <span className="badge">منصة عربية صُنعت من أجلك</span>
        <h1 className="h-title">منصة <span>المستقبل</span> التعليمية</h1>
        <p className="h-sub">تعلّم أينما كنت… وتقدّم بثقة</p>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <Link to="/login" className="btn">ابدأ مجانًا</Link><Link to="/login" className="btn ghost">تسجيل الدخول</Link></div>
      </div>
      <div>
        <div className="mock" aria-hidden="true"><b>🌟 لوحة الطالب</b>
          <div className="row2"><div className="tile c0" /><div className="tile c1" /><div className="tile c2" /></div>
          <div className="pb"><i style={{ width: "75%" }} /></div><div className="pb"><i style={{ width: "45%" }} /></div><div className="pb"><i style={{ width: "60%" }} /></div>
          <div className="kids">🧒 📚 👧</div></div>
        <div className="chips">{chips.map(([i, t]) => <div key={t}><span>{i}</span>{t}</div>)}</div>
      </div>
    </div></section>
    <section className="wrap"><h2 className="sec">منصة تعليمية عربية متكاملة</h2>
      <div className="grid">{features.map(([i, t, d]) => <div className="feat" key={t}><div className="ic">{i}</div><b>{t}</b><p>{d}</p></div>)}</div></section>
    <Characters />
    <section className="band"><h2>من التأسيس إلى السادس الابتدائي</h2><p>بيئة تعليمية تجمع المتعة والمعرفة</p>
      <div className="stages">{stages.map(s => <div className="stage" key={s}>{s}</div>)}</div></section>
    <TeachersSection items={t} />
    <section className="wrap"><h2 className="sec">لماذا تختار المنصة؟</h2>
      <div className="why">{why.map(([i, t]) => <div key={t}><span>{i}</span>{t}</div>)}</div></section>
    <TestimonialsSection items={r} />
    <section className="wrap"><h2 className="sec">الأسئلة الشائعة</h2>
      {faqs.map(([q, a]) => <details className="faq" key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>
    <ContactSection c={c} />
    <section className="wrap"><div className="cta"><div><h2>ابدأ رحلتك التعليمية الآن</h2><p>وكن جزءًا من مجتمع المتعلمين والمبدعين</p></div>
      <Link to="/login" className="btn">سجّل الآن</Link></div></section>
    <footer className="foot">© منصة المستقبل التعليمية</footer>
  </main>);
}
