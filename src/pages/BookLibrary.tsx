import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

GlobalWorkerOptions.workerSrc = pdfWorker;

type System = "general" | "azhar";
type Book = {
  id: string; title: string; subject: string; schoolYear: string; system: System;
  grade: number; driveUrl: string; published: boolean;
};
const grades = [
  { id: 1, label: "الصف الأول الابتدائي" }, { id: 2, label: "الصف الثاني الابتدائي" },
  { id: 3, label: "الصف الثالث الابتدائي" }, { id: 4, label: "الصف الرابع الابتدائي" },
  { id: 5, label: "الصف الخامس الابتدائي" }, { id: 6, label: "الصف السادس الابتدائي" },
];
const currentYear = "2026-2027";
function driveFileId(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.hostname !== "drive.google.com" && url.hostname !== "docs.google.com") return "";
    const id = url.searchParams.get("id") || url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || "";
    return /^[A-Za-z0-9_-]{10,}$/.test(id) ? id : "";
  } catch { return ""; }
}
function readerUrl(value: string) {
  const id = driveFileId(value);
  if (id) return `/api/books/pdf?url=${encodeURIComponent(`https://drive.google.com/uc?export=download&id=${id}`)}`;
  return `/api/books/pdf?url=${encodeURIComponent(value)}`;
}
export default function BookLibrary() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [books, setBooks] = useState<Book[]>([]);
  const [schoolYear, setSchoolYear] = useState(currentYear);
  const [system, setSystem] = useState<System>("general");
  const [grade, setGrade] = useState(1);
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [published, setPublished] = useState(true);
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const renderRef = useRef<RenderTask | null>(null);

  useEffect(() => {
    if (!profile) return;
    const q = isAdmin
      ? query(collection(db, "schoolBooks"), orderBy("schoolYear", "desc"))
      : query(collection(db, "schoolBooks"), where("published", "==", true));
    return onSnapshot(q, snapshot => {
      setBooks(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Book)));
    }, reason => setError("تعذّر تحميل الكتب: " + reason.message));
  }, [profile?.uid, isAdmin]);

  const visibleBooks = useMemo(() => books.filter(book =>
    book.schoolYear === schoolYear && book.system === system && book.grade === grade &&
    (isAdmin || book.published)
  ).sort((a, b) => a.subject.localeCompare(b.subject, "ar") || a.title.localeCompare(b.title, "ar")), [books, schoolYear, system, grade, isAdmin]);
  const selected = visibleBooks.find(book => book.id === selectedId) ?? null;

  function resetForm() {
    setTitle(""); setSubject(""); setDriveUrl(""); setPublished(true); setEditingId("");
  }
  function startEdit(book: Book) {
    setSchoolYear(book.schoolYear); setSystem(book.system); setGrade(book.grade);
    setTitle(book.title); setSubject(book.subject); setDriveUrl(book.driveUrl);
    setPublished(book.published); setEditingId(book.id); setNotice(""); setError("");
  }
  async function saveBook(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    if (!title.trim() || !subject.trim()) return setError("اكتب اسم الكتاب والمادة.");
    if (!driveFileId(driveUrl)) return setError("ضع رابط مشاركة Google Drive صحيحًا للملف، وتأكد أن صلاحية الوصول «أي شخص لديه الرابط». لا تضع رابط مجلد.");
    setSaving(true);
    const data = {
      title: title.trim(), subject: subject.trim(), schoolYear, system, grade,
      driveUrl: driveUrl.trim(), driveFileId: driveFileId(driveUrl),
      published, updatedAt: serverTimestamp(), updatedBy: profile?.uid ?? "",
      ...(editingId ? {} : { createdAt: serverTimestamp(), createdBy: profile?.uid ?? "" }),
    };
    try {
      if (editingId) await updateDoc(doc(db, "schoolBooks", editingId), data);
      else await addDoc(collection(db, "schoolBooks"), data);
      setNotice(editingId ? "تم تعديل بيانات الكتاب." : "تمت إضافة الكتاب بنجاح.");
      resetForm();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذّر حفظ الكتاب. تحقق من صلاحيات المدير.");
    } finally { setSaving(false); }
  }
  async function removeBook(book: Book) {
    if (!window.confirm(`هل تريد حذف «${book.title}» من مكتبة المنصة؟ لن يُحذف الملف من Google Drive.`)) return;
    try {
      await deleteDoc(doc(db, "schoolBooks", book.id));
      if (selectedId === book.id) setSelectedId("");
      setNotice("تم حذف سجل الكتاب من المنصة، والملف الأصلي ما زال في Drive.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "تعذّر حذف الكتاب."); }
  }

  useEffect(() => {
    let cancelled = false;
    pdfRef.current = null; setPages(0); setPage(1); setPdfError("");
    if (!selected) return;
    setLoadingPdf(true);
    const task = getDocument({ url: readerUrl(selected.driveUrl), disableRange: true, disableStream: true });
    task.promise.then(pdf => {
      if (cancelled) { void pdf.destroy(); return; }
      pdfRef.current = pdf; setPages(pdf.numPages);
    }).catch(reason => {
      if (!cancelled) setPdfError(reason instanceof Error ? reason.message : "تعذّر عرض الملف. تأكد من مشاركة PDF للعامة.");
    }).finally(() => { if (!cancelled) setLoadingPdf(false); });
    return () => { cancelled = true; pdfRef.current = null; void task.destroy(); };
  }, [selected?.id, selected?.driveUrl]);

  useEffect(() => {
    let cancelled = false; const pdf = pdfRef.current; const canvas = canvasRef.current;
    if (!pdf || !canvas || !selected) return;
    renderRef.current?.cancel();
    pdf.getPage(page).then(pdfPage => {
      if (cancelled) return;
      const viewport = pdfPage.getViewport({ scale: (zoom / 100) * 1.15 });
      const context = canvas.getContext("2d"); if (!context) throw new Error("تعذّر تجهيز عارض الصفحات.");
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * ratio); canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${Math.floor(viewport.width)}px`; canvas.style.height = `${Math.floor(viewport.height)}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const task = pdfPage.render({ canvasContext: context, viewport }); renderRef.current = task; return task.promise;
    }).catch(reason => { if (!cancelled && reason?.name !== "RenderingCancelledException") setPdfError("تعذّر رسم الصفحة."); });
    return () => { cancelled = true; renderRef.current?.cancel(); };
  }, [page, zoom, selected?.id, pages]);

  return <section className="panel" dir="rtl">
    <header className="admin-box-heading"><div><span className="curriculum-kicker">منصة المستقبل التعليمية</span>
      <h2>📚 مكتبة الكتب المدرسية</h2><p>الكتب التي يضيفها مدير المنصة، مصنفة حسب العام الدراسي والنظام والصف والمادة.</p></div></header>

    {isAdmin && <section className="panel" style={{ margin: "16px 0", background: "var(--panel, #f8fafc)" }}>
      <h3>{editingId ? "✏️ تعديل بيانات كتاب" : "➕ إضافة كتاب جديد"}</h3>
      <p className="note">ارفع ملف PDF إلى Google Drive أولًا، ثم اجعل المشاركة «أي شخص لديه الرابط – مشاهد»، والصق رابط الملف هنا. لا تستخدم رابط مجلد.</p>
      <form onSubmit={saveBook} style={{ display: "grid", gap: 12 }}>
        <div className="curriculum-controls">
          <label>العام الدراسي<input required value={schoolYear} onChange={e => setSchoolYear(e.target.value)} placeholder="2026-2027" /></label>
          <label>النظام التعليمي<select value={system} onChange={e => setSystem(e.target.value as System)}><option value="general">التعليم العام</option><option value="azhar">التعليم الأزهري</option></select></label>
          <label>الصف الدراسي<select value={grade} onChange={e => setGrade(Number(e.target.value))}>{grades.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        </div>
        <div className="curriculum-controls">
          <label>المادة الدراسية<input required value={subject} onChange={e => setSubject(e.target.value)} placeholder="مثل: اللغة العربية" /></label>
          <label>اسم الكتاب<input required value={title} onChange={e => setTitle(e.target.value)} placeholder="مثل: كتاب الوزارة – الفصل الأول" /></label>
        </div>
        <label>رابط مشاركة ملف PDF من Google Drive<input required type="url" value={driveUrl} onChange={e => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/file/d/..." dir="ltr" /></label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} /> إظهار الكتاب للطلاب بعد الحفظ</label>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn" type="submit" disabled={saving}>{saving ? "جارٍ الحفظ…" : editingId ? "حفظ التعديلات" : "إضافة الكتاب"}</button>
          {editingId && <button className="mini" type="button" onClick={resetForm}>إلغاء التعديل</button>}
        </div>
      </form>
      {notice && <p role="status">{notice}</p>}
      {error && <p className="err" role="alert">{error}</p>}
    </section>}

    <div className="curriculum-controls">
      <label>العام الدراسي<input value={schoolYear} onChange={e => setSchoolYear(e.target.value)} placeholder="2026-2027" /></label>
      <label>النظام التعليمي<select value={system} onChange={e => setSystem(e.target.value as System)}><option value="general">التعليم العام</option><option value="azhar">التعليم الأزهري</option></select></label>
      <label>الصف الدراسي<select value={grade} onChange={e => setGrade(Number(e.target.value))}>{grades.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    </div>

    {error && !isAdmin && <p className="err" role="alert">{error}</p>}
    <div style={{ margin: "16px 0" }}><b>{visibleBooks.length.toLocaleString("ar-EG")} كتاب</b> <small>للعام {schoolYear}</small></div>
    {visibleBooks.length ? <div className="book-catalog-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
      {visibleBooks.map(book => <article key={book.id} className="panel" style={{ padding: 12 }}>
        <small>{book.subject} · {book.published ? "منشور" : "مسودة"}</small>
        <h4>{book.title}</h4>
        <button type="button" className={selectedId === book.id ? "btn" : "mini"} onClick={() => { setSelectedId(book.id); setPage(1); setZoom(100); }}>📖 قراءة الكتاب</button>
        {isAdmin && <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <button className="mini" type="button" onClick={() => startEdit(book)}>تعديل</button>
          <button className="mini" type="button" onClick={() => void removeBook(book)}>حذف</button>
        </div>}
      </article>)}
    </div> : <p className="note">لا توجد كتب مضافة لهذا العام والصف والمادة حتى الآن.</p>}

    {selected && <section className="book-reader" aria-label="قارئ PDF داخل المنصة" style={{ marginTop: 18 }}>
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <strong>{selected.title}</strong><div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <button className="mini" type="button" disabled={page <= 1 || loadingPdf} onClick={() => setPage(v => Math.max(1, v - 1))}>السابق</button>
          <span>{page} / {pages || "—"}</span>
          <button className="mini" type="button" disabled={!pages || page >= pages || loadingPdf} onClick={() => setPage(v => Math.min(pages, v + 1))}>التالي</button>
          <button className="mini" type="button" onClick={() => setZoom(v => Math.max(60, v - 10))}>−</button><span>{zoom}%</span>
          <button className="mini" type="button" onClick={() => setZoom(v => Math.min(180, v + 10))}>+</button>
        </div>
      </div>
      {loadingPdf && <p role="status">جارٍ تحميل الكتاب…</p>}
      {pdfError && <p className="err" role="alert">{pdfError}</p>}
      <div style={{ width: "100%", maxHeight: "72vh", overflow: "auto", marginTop: 12, padding: 10, background: "#e5e7eb", borderRadius: 12, textAlign: "center" }}>
        <canvas ref={canvasRef} aria-label={`صفحة ${page} من كتاب ${selected.title}`} style={{ display: "block", maxWidth: "100%", height: "auto", margin: "0 auto", background: "#fff" }} />
      </div>
      <p className="note">يتم عرض صفحات PDF داخل المنصة. لا يتم تحويل الطالب إلى موقع خارجي.</p>
    </section>}
  </section>;
}
