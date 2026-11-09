import { useMemo, useState } from "react";

type System = "general" | "azhar";
const grades = [
  { id: 1, label: "الصف الأول الابتدائي" },
  { id: 2, label: "الصف الثاني الابتدائي" },
  { id: 3, label: "الصف الثالث الابتدائي" },
  { id: 4, label: "الصف الرابع الابتدائي" },
  { id: 5, label: "الصف الخامس الابتدائي" },
  { id: 6, label: "الصف السادس الابتدائي" },
];

export default function BookLibrary() {
  const [system, setSystem] = useState<System>("general");
  const [grade, setGrade] = useState(1);
  const selected = useMemo(() => grades.find(item => item.id === grade)!, [grade]);
  const catalogUrl = system === "azhar"
    ? `https://miskeg.app/books/azhar-primary-${grade}/`
    : `https://miskeg.app/books/general-primary-${grade}/`;
  const officialUrl = system === "azhar"
    ? "https://mtrl.azhar.gov.eg/education/"
    : "https://studentbooks.moe.gov.eg/Books";
  return <section className="panel" dir="rtl">
    <header className="admin-box-heading">
      <div><span className="curriculum-kicker">منصة المستقبل التعليمية</span><h2>📚 مكتبة الكتب المدرسية</h2>
        <p>اختر نظامك وصفك الدراسي لفتح الكتب المتاحة للعام الدراسي 2026–2027.</p></div>
    </header>
    <div className="curriculum-controls">
      <label>النظام التعليمي
        <select value={system} onChange={event => setSystem(event.target.value as System)}>
          <option value="general">التعليم العام</option>
          <option value="azhar">التعليم الأزهري</option>
        </select>
      </label>
      <label>الصف الدراسي
        <select value={grade} onChange={event => setGrade(Number(event.target.value))}>
          {grades.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
    </div>
    <article className="card c0" style={{ marginTop: 16 }}>
      <h3>{selected.label} — {system === "general" ? "التعليم العام" : "التعليم الأزهري"}</h3>
      <p>الكتب المعروضة من فهرس روابط الكتب، والملفات تفتح من المصدر الذي يستضيفها. بعض الفهارس تعرض كتب الترم الأول، بينما فهارس الأزهر قد تعرض كتب العام كاملًا.</p>
      <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
        <a className="btn" href={catalogUrl} target="_blank" rel="noopener noreferrer">📖 تصفح كتب الصف</a>
        <a className="btn" href={officialUrl} target="_blank" rel="noopener noreferrer">🏛️ المكتبة الرسمية للجهة التعليمية</a>
      </div>
    </article>
    <p className="note" style={{ marginTop: 14 }}>
      ملاحظة: هذه المكتبة تفتح الكتب المتاحة عبر فهرس الروابط والمواقع الرسمية، ولا تحفظ نسخًا غير مصرح بها داخل المنصة. سيتم ربط فهرس كل كتاب بوحداته ودروسه وامتحاناته بعد مطابقة طبعة 2026–2027.
    </p>
  </section>;
}
