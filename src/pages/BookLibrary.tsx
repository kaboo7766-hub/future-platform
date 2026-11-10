import { useEffect, useMemo, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorker;

type System = "general" | "azhar";
type Book = { id: string; title: string; url: string };
type CatalogResponse = {
  system: System;
  grade: number;
  schoolYear: string;
  books: Book[];
  message?: string;
};

const SCHOOL_YEARS = ["2026-2027"];
const grades = [
  { id: 1, label: "الصف الأول الابتدائي" },
  { id: 2, label: "الصف الثاني الابتدائي" },
  { id: 3, label: "الصف الثالث الابتدائي" },
  { id: 4, label: "الصف الرابع الابتدائي" },
  { id: 5, label: "الصف الخامس الابتدائي" },
  { id: 6, label: "الصف السادس الابتدائي" },
];

export default function BookLibrary() {
  const [schoolYear, setSchoolYear] = useState(SCHOOL_YEARS[0]);
  const [system, setSystem] = useState<System>("general");
  const [grade, setGrade] = useState(1);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const renderRef = useRef<RenderTask | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setCatalog(null);
    setSelectedId("");
    setPage(1);
    setZoom(100);
    fetch(`/api/books/catalog?system=${system}&grade=${grade}&schoolYear=${schoolYear}`, {
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
        setSelectedId("");
      })
      .catch(reason => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "تعذّر تحميل الكتب حاليًا.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [schoolYear, system, grade]);

  const selected = useMemo(
    () => catalog?.books.find(book => book.id === selectedId) ?? null,
    [catalog, selectedId],
  );

  useEffect(() => {
    let cancelled = false;
    pdfRef.current = null;
    setPages(0);
    setPage(1);
    setPdfError("");
    if (!selected) return;
    setLoadingPdf(true);
    const task = getDocument({
      url: `/api/books/pdf?url=${encodeURIComponent(selected.url)}`,
      disableRange: true,
      disableStream: true,
      withCredentials: true,
    });
    task.promise.then(pdf => {
      if (cancelled) { void pdf.destroy(); return; }
      pdfRef.current = pdf;
      setPages(pdf.numPages);
      setPage(1);
    }).catch(reason => {
      if (!cancelled) setPdfError(reason instanceof Error ? reason.message : "تعذّر عرض الكتاب داخل المنصة.");
    }).finally(() => {
      if (!cancelled) setLoadingPdf(false);
    });
    return () => {
      cancelled = true;
      pdfRef.current = null;
      void task.destroy();
    };
  }, [selected]);

  useEffect(() => {
    let cancelled = false;
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas || !selected) return;
    renderRef.current?.cancel();
    pdf.getPage(page).then(pdfPage => {
      if (cancelled) return;
      const viewport = pdfPage.getViewport({ scale: (zoom / 100) * 1.15 });
      const context = canvas.getContext("2d");
      if (!context) throw new Error("تعذّر تجهيز عارض الصفحات.");
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const task = pdfPage.render({ canvasContext: context, viewport });
      renderRef.current = task;
      return task.promise;
    }).catch(reason => {
      if (!cancelled && reason?.name !== "RenderingCancelledException") {
        setPdfError("تعذّر رسم الصفحة. جرّب إعادة فتح الكتاب.");
      }
    });
    return () => { cancelled = true; renderRef.current?.cancel(); };
  }, [page, zoom, selected, pages]);

  return <section className="panel" dir="rtl">
    <header className="admin-box-heading">
      <div>
        <span className="curriculum-kicker">منصة المستقبل التعليمية</span>
        <h2>📚 مكتبة الكتب المدرسية</h2>
        <p>اختر السنة الدراسية ثم النظام والصف، وبعدها اختر الكتاب لقراءته هنا داخل المنصة.</p>
      </div>
    </header>

    <div className="curriculum-controls">
      <label>السنة الدراسية
        <select value={schoolYear} onChange={event => setSchoolYear(event.target.value)}>
          {SCHOOL_YEARS.map(year => <option key={year} value={year}>{year}</option>)}
        </select>
      </label>
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

    {loading && <p role="status">جارٍ تحميل فهرس كتب سنة {schoolYear}…</p>}
    {error && <p className="err" role="alert">{error}</p>}

    {!loading && catalog && <>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", margin: "16px 0" }}>
        <b>فهرس {catalog.books.length.toLocaleString("ar-EG")} كتاب</b>
        <small>السنة الدراسية {catalog.schoolYear}</small>
      </div>
      {catalog.books.length ? <>
        <div className="book-catalog-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
          {catalog.books.map(book => <button key={book.id} type="button"
            className={selectedId === book.id ? "btn" : "mini"}
            aria-pressed={selectedId === book.id}
            onClick={() => { setSelectedId(book.id); setPage(1); setZoom(100); setPdfError(""); }}
            style={{ minHeight: 54, whiteSpace: "normal" }}>
            📘 {book.title}
          </button>)}
        </div>
      </> : <p className="note">{catalog.message || "لا توجد كتب موثقة في هذا الفهرس حتى الآن."}</p>}
    </>}

    {selected && <section className="book-reader" aria-label="قارئ PDF داخل منصة المستقبل" style={{ marginTop: 18 }}>
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <strong>{selected.title}</strong>
        <div className="row" style={{ alignItems: "center", flexWrap: "wrap", gap: 6 }}>
          <button className="mini" type="button" disabled={page <= 1 || loadingPdf} onClick={() => setPage(value => Math.max(1, value - 1))}>السابق</button>
          <span aria-live="polite">{page} / {pages || "—"}</span>
          <button className="mini" type="button" disabled={!pages || page >= pages || loadingPdf} onClick={() => setPage(value => Math.min(pages, value + 1))}>التالي</button>
          <button className="mini" type="button" onClick={() => setZoom(value => Math.max(60, value - 10))}>−</button>
          <span>{zoom}%</span>
          <button className="mini" type="button" onClick={() => setZoom(value => Math.min(180, value + 10))}>+</button>
        </div>
      </div>
      {loadingPdf && <p role="status">جارٍ تحميل الكتاب داخل المنصة…</p>}
      {pdfError && <p className="err" role="alert">{pdfError}</p>}
      <div style={{ width: "100%", maxHeight: "72vh", overflow: "auto", marginTop: 12, padding: 10, background: "#e5e7eb", borderRadius: 12, textAlign: "center" }}>
        <canvas ref={canvasRef} aria-label={`صفحة ${page} من كتاب ${selected.title}`}
          style={{ display: "block", maxWidth: "100%", height: "auto", margin: "0 auto", background: "#fff", boxShadow: "0 2px 12px #0002" }} />
      </div>
      <p className="note">الكتاب يُعرض صفحةً صفحة داخل المنصة، ولا يفتح موقعًا خارجيًا عند اختياره.</p>
    </section>}

    <p className="note" style={{ marginTop: 14 }}>
      الفهارس مرتبطة بالسنة الدراسية المختارة. ستُضاف أي سنة أخرى بعد توفير روابط كتبها والتحقق منها؛ لا نعرض كتب سنة على أنها تابعة لسنة مختلفة.
    </p>
  </section>;
}
