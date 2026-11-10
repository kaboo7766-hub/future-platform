import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

GlobalWorkerOptions.workerSrc = pdfWorker;

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string; error_description?: string }) => void;
            error_callback?: (error: { type?: string; message?: string }) => void;
          }) => { requestAccessToken: (options?: { prompt?: string }) => void };
        };
      };
    };
  }
}

type System = "general" | "azhar";
type Book = {
  id: string; title: string; subject: string; schoolYear: string; system: System;
  grade: number; driveUrl: string; driveFileId: string; published: boolean;
};
const grades = [
  { id: 1, label: "الصف الأول الابتدائي" }, { id: 2, label: "الصف الثاني الابتدائي" },
  { id: 3, label: "الصف الثالث الابتدائي" }, { id: 4, label: "الصف الرابع الابتدائي" },
  { id: 5, label: "الصف الخامس الابتدائي" }, { id: 6, label: "الصف السادس الابتدائي" },
];
const currentYear = "2026-2027";
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

function getDriveFileId(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.hostname !== "drive.google.com" && url.hostname !== "docs.google.com") return "";
    const id = url.searchParams.get("id") || url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || "";
    return /^[A-Za-z0-9_-]{10,}$/.test(id) ? id : "";
  } catch { return ""; }
}
function readerUrl(fileId: string) {
  return `/api/books/pdf?url=${encodeURIComponent(`https://drive.google.com/uc?export=download&id=${fileId}`)}`;
}
function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.getElementById("google-identity-services") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("تعذّر تحميل خدمة تسجيل الدخول إلى Google.")), { once: true });
      if (window.google?.accounts?.oauth2) resolve();
      return;
    }
    const script = document.createElement("script");
    script.id = "google-identity-services";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("تعذّر تحميل خدمة تسجيل الدخول إلى Google."));
    document.head.appendChild(script);
  });
}
function getGoogleDriveToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!googleClientId || !window.google?.accounts?.oauth2) {
      reject(new Error("ربط Google Drive غير مكتمل. يلزم إضافة VITE_GOOGLE_CLIENT_ID في إعدادات Vercel."));
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: response => {
        if (response.access_token) resolve(response.access_token);
        else reject(new Error(response.error_description || response.error || "لم تتم الموافقة على الوصول إلى Google Drive."));
      },
      error_callback: error => reject(new Error(error.message || "أُغلق تسجيل الدخول إلى Google قبل اكتماله.")),
    });
    client.requestAccessToken({ prompt: "consent" });
  });
}
async function uploadPdfToDrive(file: File, token: string): Promise<{ id: string; url: string }> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("اختر ملف PDF فقط.");
  }
  if (file.size > 40 * 1024 * 1024) throw new Error("حجم الملف أكبر من 40 ميجابايت.");
  const firstBytes = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (new TextDecoder().decode(firstBytes) !== "%PDF-") throw new Error("الملف المختار ليس PDF صالحًا.");
  const boundary = "futureplatform_" + crypto.randomUUID().replace(/-/g, "");
  const metadata = { name: file.name, mimeType: "application/pdf", appProperties: { source: "future-platform-school-books" } };
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
    file,
    `\r\n--${boundary}--`,
  ], { type: `multipart/related; boundary=${boundary}` });
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  const result = await response.json() as { id?: string; error?: { message?: string } };
  if (!response.ok || !result.id) throw new Error(result.error?.message || "فشل رفع الملف إلى Google Drive.");
  const permission = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(result.id)}/permissions?fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "anyone", role: "reader" }),
  });
  if (!permission.ok) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(result.id)}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
    const failure = await permission.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(failure.error?.message || "تم رفع الملف لكن تعذّر إتاحة قراءته للطلاب. راجع إعدادات المشاركة في Google Drive.");
  }
  return { id: result.id, url: `https://drive.google.com/file/d/${result.id}/view` };
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingFileId, setExistingFileId] = useState("");
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const renderRef = useRef<RenderTask | null>(null);

  useEffect(() => {
    void loadGoogleIdentityScript().catch(reason => console.warn(reason));
  }, []);

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
    setTitle(""); setSubject(""); setSelectedFile(null); setExistingFileId("");
    setPublished(true); setEditingId("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }
  function startEdit(book: Book) {
    setSchoolYear(book.schoolYear); setSystem(book.system); setGrade(book.grade);
    setTitle(book.title); setSubject(book.subject); setExistingFileId(book.driveFileId || getDriveFileId(book.driveUrl));
    setSelectedFile(null); setPublished(book.published); setEditingId(book.id);
    setNotice(""); setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }
  async function saveBook(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    if (!title.trim() || !subject.trim()) return setError("اكتب اسم الكتاب والمادة.");
    if (!selectedFile && !existingFileId) return setError("اختر ملف PDF من جهازك أولًا.");
    setSaving(true);
    let token = "";
    let uploaded: { id: string; url: string } | null = null;
    try {
      let fileId = existingFileId;
      let driveUrl = existingFileId ? `https://drive.google.com/file/d/${existingFileId}/view` : "";
      if (selectedFile) {
        await loadGoogleIdentityScript();
        token = await getGoogleDriveToken();
        uploaded = await uploadPdfToDrive(selectedFile, token);
        fileId = uploaded.id;
        driveUrl = uploaded.url;
      }
      const data = {
        title: title.trim(), subject: subject.trim(), schoolYear, system, grade,
        driveUrl, driveFileId: fileId, published,
        updatedAt: serverTimestamp(), updatedBy: profile?.uid ?? "",
        ...(editingId ? {} : { createdAt: serverTimestamp(), createdBy: profile?.uid ?? "" }),
      };
      if (editingId) await updateDoc(doc(db, "schoolBooks", editingId), data);
      else await addDoc(collection(db, "schoolBooks"), data);
      setNotice(editingId ? "تم حفظ تعديل الكتاب وملف PDF." : "تم رفع ملف PDF وإضافة الكتاب بنجاح.");
      resetForm();
    } catch (reason) {
      if (uploaded?.id && token) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(uploaded.id)}`, {
          method: "DELETE", headers: { Authorization: `Bearer ${token}` },
        }).catch(() => undefined);
      }
      setError(reason instanceof Error ? reason.message : "تعذّر حفظ الكتاب. تحقق من إعدادات Google Drive وصلاحيات المدير.");
    } finally { setSaving(false); }
  }
  async function removeBook(book: Book) {
    if (!window.confirm(`هل تريد حذف «${book.title}» من مكتبة المنصة؟ سيتم حذف سجل الكتاب فقط، وليس ملفه الأصلي من Google Drive.`)) return;
    try {
      await deleteDoc(doc(db, "schoolBooks", book.id));
      if (selectedId === book.id) setSelectedId("");
      setNotice("تم حذف سجل الكتاب من المنصة.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "تعذّر حذف الكتاب."); }
  }

  useEffect(() => {
    let cancelled = false;
    pdfRef.current = null; setPages(0); setPage(1); setPdfError("");
    if (!selected) return;
    setLoadingPdf(true);
    const task = getDocument({ url: readerUrl(selected.driveFileId || getDriveFileId(selected.driveUrl)), disableRange: true, disableStream: true });
    task.promise.then(pdf => {
      if (cancelled) { void pdf.destroy(); return; }
      pdfRef.current = pdf; setPages(pdf.numPages);
    }).catch(reason => {
      if (!cancelled) setPdfError(reason instanceof Error ? reason.message : "تعذّر عرض الملف. تأكد من مشاركة PDF للقراءة.");
    }).finally(() => { if (!cancelled) setLoadingPdf(false); });
    return () => { cancelled = true; pdfRef.current = null; void task.destroy(); };
  }, [selected?.id, selected?.driveFileId, selected?.driveUrl]);

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
      <h2>📚 مكتبة الكتب المدرسية</h2><p>ارفع ملفات PDF من جهازك مباشرة، وصنّفها حسب العام الدراسي والنظام والصف والمادة.</p></div></header>

    {isAdmin && <section className="panel" style={{ margin: "16px 0", background: "var(--panel, #f8fafc)" }}>
      <h3>{editingId ? "✏️ تعديل كتاب" : "➕ رفع كتاب PDF جديد"}</h3>
      <p className="note">اختر ملف PDF من الهاتف أو الكمبيوتر. سيُرفع إلى Google Drive المرتبط بحساب المدير، ثم يظهر للطلاب عند تفعيل النشر. لا تُستخدم Firebase Storage.</p>
      {!googleClientId && <p className="err" role="alert">إعداد ربط Google Drive غير مضاف بعد. يلزم إضافة VITE_GOOGLE_CLIENT_ID في إعدادات Vercel بعد إنشاء OAuth Client لتطبيق ويب في Google Cloud.</p>}
      <form onSubmit={saveBook} style={{ display: "grid", gap: 12 }}>
        <div className="curriculum-controls">
          <label>العام الدراسي<input required value={schoolYear} onChange={e => setSchoolYear(e.target.value)} placeholder="2026-2027" pattern="[0-9]{4}-[0-9]{4}" /></label>
          <label>النظام التعليمي<select value={system} onChange={e => setSystem(e.target.value as System)}><option value="general">التعليم العام</option><option value="azhar">التعليم الأزهري</option></select></label>
          <label>الصف الدراسي<select value={grade} onChange={e => setGrade(Number(e.target.value))}>{grades.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        </div>
        <div className="curriculum-controls">
          <label>المادة الدراسية<input required value={subject} onChange={e => setSubject(e.target.value)} placeholder="مثل: اللغة العربية" /></label>
          <label>اسم الكتاب<input required value={title} onChange={e => setTitle(e.target.value)} placeholder="مثل: كتاب الوزارة – الفصل الأول" /></label>
        </div>
        <label>ملف الكتاب PDF
          <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" onChange={e => setSelectedFile(e.target.files?.[0] ?? null)} />
        </label>
        {selectedFile && <p className="note">الملف المختار: {selectedFile.name} · {(selectedFile.size / (1024 * 1024)).toFixed(1)} ميجابايت</p>}
        {editingId && existingFileId && !selectedFile && <p className="note">سيتم الاحتفاظ بالملف الحالي. اختر ملفًا جديدًا فقط إذا أردت استبداله.</p>}
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} /> إظهار الكتاب للطلاب بعد الحفظ</label>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn" type="submit" disabled={saving || (!googleClientId && !!selectedFile)}>{saving ? "جارٍ رفع الملف وحفظ البيانات…" : editingId ? "حفظ التعديلات" : "رفع الكتاب وإضافته"}</button>
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
    </div> : <p className="note">لا توجد كتب مضافة لهذا العام والصف والنظام حتى الآن.</p>}

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
