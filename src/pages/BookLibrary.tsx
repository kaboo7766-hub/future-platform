import { useEffect, useMemo, useState } from "react";

type System = "general" | "azhar";
type Book = { id: string; title: string; url: string };
type CatalogResponse = {
  system: System;
  grade: number;
  schoolYear: string;
  source: string;
  checkedAt: string;
  books: Book[];
  message?: string;
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
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setCatalog(null);
    setSelectedId("");
    setPage(1);
    setZoom(100);

    fetch(`/api/books/catalog?system=${system}&grade=${grade}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "تعذّر تحميل فهرس الكتب.");
        return data as CatalogResponse;
      })
      .then(data => {
        setCatalog(data);
        setSelectedId(data.books[0]?.id ?? "");
      })
      .catch(reason => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "تعذّر تحميل الكتب حاليًا.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [system, grade]);

  const selected = useMemo(
    () => catalog?.books.find(book => book.id === selectedId) ?? null,
    [catalog, selectedId],
  );
  const viewerUrl = selected ? `${selected.url}#page=${page}&zoom=${zoom}` : "";

  return <section className="panel" dir="rtl">
    <header className="admin-box-heading">
      <div>
        <span className="curriculum-kicker">منصة المستقبل التعليمية</span>
        <h2>📚 مكتبة الكتب المدرسية</h2>
        <p>اختر النظام والصف، ثم افتح الكتاب داخل المنصة دون الانتقال إلى صفحة الفهرس.</p>
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

    {loading ? <p role="status">جارٍ البحث عن ملفات الكتب الرسمية والتحقق منها…</p> : null}
    {error && <p className="err" role="alert">{error}</p>}

    {!loading && catalog && <>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", margin: "16px 0" }}>
        <b>{catalog.books.length.toLocaleString("ar-EG")} كتاب متاح للعرض</b>
        <small>العام الدراسي {catalog.schoolYear}</small>
      </div>

      {catalog.books.length > 0 ? <>
        <label style={{ display: "block", marginBottom: 12 }}>اختر الكتاب
          <select value={selectedId} onChange={event => {
            setSelectedId(event.target.value);
            setPage(1);
            setZoom(100);
          }} style={{ width: "100%", marginTop: 6 }}>
            {catalog.books.map(book => <option key={book.id} value={book.id}>{book.title}</option>)}
          </select>
        </label>

        {selected && <section className="book-reader" aria-label="قارئ الكتاب داخل المنصة">
          <div className="row" style={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <strong>{selected.title}</strong>
            <div className="row" style={{ alignItems: "center", flexWrap: "wrap", gap: 6 }}>
              <button className="mini" type="button" onClick={() => setPage(value => Math.max(1, value - 1))}>الصفحة السابقة</button>
              <span aria-live="polite">صفحة {page}</span>
              <button className="mini" type="button" onClick={() => setPage(value => value + 1)}>الصفحة التالية</button>
              <button className="mini" type="button" onClick={() => setZoom(value => Math.max(60, value - 10))}>−</button>
              <span>{zoom}%</span>
              <button className="mini" type="button" onClick={() => setZoom(value => Math.min(180, value + 10))}>+</button>
            </div>
          </div>
          <div style={{ width: "100%", height: "min(78vh, 900px)", minHeight: 480, marginTop: 12, background: "#e5e7eb", borderRadius: 12, overflow: "hidden" }}>
            <iframe
              key={viewerUrl}
              src={viewerUrl}
              title={selected.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              style={{ width: "100%", height: "100%", border: 0, background: "#fff" }}
              allow="fullscreen"
            />
          </div>
          <p className="note">يعرض القارئ ملف PDF من خادم الجهة التعليمية الرسمي. أزرار الصفحات والتكبير تعتمد على دعم عارض PDF في متصفح الجهاز.</p>
        </section>}
      </> : <p className="note">{catalog.message || "لا توجد ملفات PDF مباشرة تم التحقق منها لهذا الصف حاليًا."}</p>}
    </>}

    <p className="note" style={{ marginTop: 14 }}>
      لا تحفظ المنصة نسخًا من الكتب ولا تعيد رفعها؛ يتم عرض الملف من خادم الجهة التعليمية بعد التحقق من أنه PDF وعلى نطاق رسمي. قد لا تسمح بعض الخوادم بعرض الملف داخل إطار؛ عندها لن يظهر الكتاب حتى يتوفر رابط يسمح بالتضمين.
    </p>
  </section>;
}
