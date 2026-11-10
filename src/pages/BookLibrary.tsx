import { useEffect, useMemo, useState } from "react";

type System = "general" | "azhar";
type CatalogGrade = {
  gradeId: string;
  gradeName: string;
  officialBookCount: number;
  catalogUrl: string;
  availability: string;
  subjects: string[];
  note: string;
};
type SourceCatalog = {
  schoolYear: string;
  checkedAt: string;
  systems: Array<{
    systemId: string;
    systemName: string;
    officialPortal: string;
    officialBooksPortal?: string;
    grades: CatalogGrade[];
  }>;
};

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
  const [catalog, setCatalog] = useState<SourceCatalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/primary-curriculum-sources-2026-2027.json", { cache: "no-store" })
      .then(response => {
        if (!response.ok) throw new Error("تعذّر تحميل فهرس الكتب.");
        return response.json() as Promise<SourceCatalog>;
      })
      .then(data => {
        if (active) setCatalog(data);
      })
      .catch(() => {
        if (active) setCatalogError("تعذّر تحميل تفاصيل الكتب حاليًا. يمكنك فتح المكتبة الرسمية مباشرة.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const selected = useMemo(() => grades.find(item => item.id === grade)!, [grade]);
  const systemData = catalog?.systems.find(item =>
    system === "azhar" ? item.systemId === "azhar" : item.systemId === "general_education"
  );
  const gradeData = systemData?.grades.find(item => item.gradeId === `g${grade}`);
  const officialUrl = systemData?.officialPortal ?? (
    system === "azhar"
      ? "https://mtrl.azhar.gov.eg/education/"
      : "https://studentbooks.moe.gov.eg/Books"
  );
  const catalogUrl = gradeData?.catalogUrl ?? (
    system === "azhar"
      ? `https://miskeg.app/books/azhar-primary-${grade}/`
      : `https://miskeg.app/books/general-primary-${grade}/`
  );

  return <section className="panel" dir="rtl">
    <header className="admin-box-heading">
      <div>
        <span className="curriculum-kicker">منصة المستقبل التعليمية</span>
        <h2>📚 مكتبة الكتب المدرسية</h2>
        <p>اختر النظام والصف لعرض فهرس الكتب المتاحة للعام الدراسي 2026–2027.</p>
      </div>
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
      <h3>{gradeData?.gradeName ?? selected.label} — {system === "general" ? "التعليم العام" : "التعليم الأزهري"}</h3>
      {loading ? <p>جارٍ تحميل بيانات الكتب…</p> : gradeData ? <>
        <p><b>{gradeData.officialBookCount} كتابًا</b> مسجلًا في الفهرس الحالي.</p>
        <p><b>المواد:</b> {gradeData.subjects.join("، ")}</p>
        <p>{gradeData.note}</p>
        <p className="note">
          {gradeData.availability === "term1_catalogued"
            ? "المتاح في هذا الفهرس حاليًا كتب الترم الأول فقط؛ لا نعرض الترم الثاني على أنه متاح قبل نشره."
            : "الفهرس يعرض كتب العام الدراسي، مع ضرورة مراجعة خطة المعاهد والمواد المقررة لكل صف."}
        </p>
        <small>آخر مراجعة مسجلة للفهرس: {catalog?.checkedAt ?? "غير محدد"}</small>
      </> : <p className="note">لم تتوفر تفاصيل هذا الصف في ملف الفهرس. استخدم بوابة الجهة التعليمية الرسمية.</p>}
      {catalogError && <p className="note" role="status">{catalogError}</p>}
      <div className="row" style={{ flexWrap: "wrap", gap: 10, marginTop: 12 }}>
        <a className="btn" href={catalogUrl} target="_blank" rel="noopener noreferrer">📖 تصفح كتب الصف وفتح ملفات PDF</a>
        <a className="btn" href={officialUrl} target="_blank" rel="noopener noreferrer">🏛️ بوابة الجهة التعليمية الرسمية</a>
      </div>
    </article>

    <p className="note" style={{ marginTop: 14 }}>
      الكتب تُفتح من فهرس روابط يشير إلى خوادم الوزارة أو قطاع المعاهد الأزهرية؛ المنصة لا تخزن نسخًا غير مصرح بها. هذا الفهرس لا يعني أن شرح كل درس أو امتحاناته قد أُضيفت بعد. سيتم اعتماد الدروس والاختبارات بعد مطابقتها مع الكتاب وخطة التوزيع الرسمية.
    </p>
  </section>;
}
