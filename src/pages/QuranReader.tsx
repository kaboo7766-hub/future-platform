import { useEffect, useMemo, useState } from "react";

type Ayah = {
  id: number;
  number: number;
  surah: number;
  page_number: number;
  text: string;
};
type Surah = { id: number; name: string; ayahs: Ayah[] };
type MushafResponse = { surahs?: Surah[] };

const API = "https://api.quranpedia.net/v1";
const AUDIO_BASE = "https://cdn.islamic.network/quran/audio/128";
const RECITERS = [
  { id: "ar.alafasy", name: "مشاري العفاسي" },
  { id: "ar.husary", name: "محمود خليل الحصري" },
  { id: "ar.minshawi", name: "محمد صديق المنشاوي" },
  { id: "ar.abdulbasit", name: "عبد الباسط عبد الصمد" },
];

function normalizeArabic(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[ـ\s،؛,.!?؟():؛۞۩]/g, "")
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

function similarity(expected: string, actual: string) {
  const a = normalizeArabic(expected);
  const b = normalizeArabic(actual);
  if (!a || !b) return 0;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return Math.max(0, Math.round((1 - row[b.length] / Math.max(a.length, b.length)) * 100));
}

export default function QuranReader() {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [reciter, setReciter] = useState("ar.alafasy");
  const [tafsirAyah, setTafsirAyah] = useState<number | null>(null);
  const [recordingAyah, setRecordingAyah] = useState<number | null>(null);
  const [speechText, setSpeechText] = useState("");
  const [speechScore, setSpeechScore] = useState<number | null>(null);
  const [speechError, setSpeechError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetch(`${API}/mushafs/11`)
      .then(async response => {
        if (!response.ok) throw new Error("تعذّر تحميل مصحف التجويد. تحقق من اتصال الإنترنت ثم أعد المحاولة.");
        return response.json() as Promise<MushafResponse>;
      })
      .then(data => {
        const rows = Array.isArray(data?.surahs) ? data.surahs : [];
        if (!rows.length) throw new Error("لم تصل بيانات المصحف من المصدر.");
        if (active) setSurahs(rows.map(s => ({
          ...s,
          ayahs: (s.ayahs || []).map(a => ({ ...a, id: Number(a.id), number: Number(a.number), surah: Number(a.surah || s.id), page_number: Number(a.page_number) }))
        })));
      })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : "حدث خطأ أثناء تحميل المصحف."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const allAyahs = useMemo(() => surahs.flatMap(s => s.ayahs), [surahs]);
  const pages = useMemo(() => Array.from(new Set(allAyahs.map(a => a.page_number).filter(Boolean))).sort((a, b) => a - b), [allAyahs]);
  const pageAyahs = useMemo(() => allAyahs.filter(a => a.page_number === page), [allAyahs, page]);
  const firstSurah = surahs.find(s => s.id === pageAyahs[0]?.surah);
  const lastSurah = surahs.find(s => s.id === pageAyahs[pageAyahs.length - 1]?.surah);
  const pageLabel = firstSurah?.id === lastSurah?.id ? firstSurah?.name : `${firstSurah?.name || ""} — ${lastSurah?.name || ""}`;

  function jumpToSurah(id: number) {
    const target = surahs.find(s => s.id === id)?.ayahs[0];
    if (target?.page_number) {
      setPage(target.page_number);
      setTafsirAyah(null);
      setSpeechScore(null);
      setSpeechText("");
    }
  }

  function startPractice(ayah: Ayah) {
    const speechWindow = window as any;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    setSpeechText("");
    setSpeechScore(null);
    setSpeechError("");
    if (!Recognition) {
      setSpeechError("المتصفح لا يدعم التعرف على الصوت. جرّب فتح المنصة بمتصفح Google Chrome وتأكد من السماح باستخدام الميكروفون.");
      return;
    }
    try {
      const recognition = new Recognition();
      recognition.lang = "ar-EG";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => setRecordingAyah(ayah.id);
      recognition.onerror = (event: any) => {
        setRecordingAyah(null);
        setSpeechError(event?.error === "not-allowed" ? "اسمح للمنصة باستخدام الميكروفون من إعدادات المتصفح." : "لم نتمكن من سماع القراءة بوضوح. حاول مرة أخرى.");
      };
      recognition.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript || "";
        setSpeechText(transcript);
        setSpeechScore(similarity(ayah.text, transcript));
        setRecordingAyah(null);
      };
      recognition.onend = () => setRecordingAyah(null);
      recognition.start();
    } catch {
      setRecordingAyah(null);
      setSpeechError("تعذر تشغيل الميكروفون. تحقق من أذونات المتصفح ثم حاول مرة أخرى.");
    }
  }

  return <section className="panel quran-reader" dir="rtl">
    <header className="quran-hero">
      <span className="quran-kicker">📖 نور وهداية</span>
      <h2>المصحف الشريف والتفسير والتلاوة</h2>
      <p>مصحف التجويد الملوّن مرتب من سورة الفاتحة إلى سورة الناس، مع التفسير والتدريب على القراءة.</p>
      <div className="quran-stats"><span>114 سورة</span><span>604 صفحة</span><span>رواية حفص</span><span>تجويد ملوّن</span></div>
    </header>

    <section className="quran-mushaf-section" aria-label="المصحف الشريف">
      <div className="quran-section-heading">
        <div><span>الجزء الأول من رحلة القراءة</span><h3>المصحف الشريف</h3></div>
        <label className="quran-jump">الانتقال إلى سورة
          <select value={pageAyahs[0]?.surah || 1} onChange={e => jumpToSurah(Number(e.target.value))}>
            {surahs.map(s => <option key={s.id} value={s.id}>{s.id}. {s.name}</option>)}
          </select>
        </label>
      </div>
      <div className="quran-tajweed-note">
        <b>مصحف التجويد الملوّن</b>
        <span>الألوان مأخوذة من نسخة مصحف التجويد المتاحة عبر مصدر النص. راجع دليل الألوان داخل المصحف للتعرّف على الأحكام.</span>
      </div>

      {loading && <p className="quran-loading" role="status">جارٍ تحميل المصحف كاملًا وترتيبه…</p>}
      {error && <div className="quran-error" role="alert"><p>{error}</p><button className="btn" onClick={() => window.location.reload()}>إعادة المحاولة</button></div>}

      {!loading && !error && pageAyahs.length > 0 && <>
        <div className="quran-page-top">
          <span>{pageLabel}</span>
          <b>صفحة {page.toLocaleString("ar-EG")} من 604</b>
        </div>
        <div className="quran-page">
          {pageAyahs.map((ayah, index) => {
            const surah = surahs.find(s => s.id === ayah.surah);
            const previous = pageAyahs[index - 1];
            const isSurahStart = !previous || previous.surah !== ayah.surah;
            return <div className="quran-page-ayah" key={ayah.id}>
              {isSurahStart && <div className="quran-surah-banner"><span>سورة</span><strong>{surah?.name}</strong></div>}
              {isSurahStart && ayah.surah !== 1 && ayah.surah !== 9 && <div className="quran-bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>}
              <span className="quran-uthmani-text">{ayah.text}</span>
              <span className="quran-ayah-end">۞{ayah.number.toLocaleString("ar-EG")}۞</span>
            </div>;
          })}
        </div>
        <div className="quran-page-controls">
          <button type="button" disabled={page <= 1} onClick={() => { setPage(p => Math.max(1, p - 1)); setTafsirAyah(null); }}>السابق</button>
          <span>صفحة {page.toLocaleString("ar-EG")} / 604</span>
          <button type="button" disabled={page >= 604} onClick={() => { setPage(p => Math.min(604, p + 1)); setTafsirAyah(null); }}>التالي</button>
        </div>
      </>}
    </section>

    {!loading && !error && pageAyahs.length > 0 && <section className="quran-learning-section">
      <div className="quran-section-heading">
        <div><span>استمع ثم اقرأ بصوتك</span><h3>التلاوة والتدريب على النطق</h3></div>
        <label className="quran-jump">القارئ
          <select value={reciter} onChange={e => setReciter(e.target.value)}>
            {RECITERS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
      </div>
      <p className="quran-practice-disclaimer">اختر الآية للاستماع إليها، ثم اضغط «تدرب على القراءة» وسجّل تلاوتك. النتيجة تقارن الكلمات التي تعرّف عليها المتصفح بالنص، وليست حكمًا دقيقًا على مخارج الحروف أو أحكام التجويد.</p>
      <div className="quran-practice-list">
        {pageAyahs.map(ayah => <article className="quran-practice-row" key={ayah.id}>
          <span className="quran-practice-number">{ayah.number.toLocaleString("ar-EG")}</span>
          <div className="quran-practice-actions">
            <audio controls preload="none" src={`${AUDIO_BASE}/${reciter}/${ayah.id}.mp3`} aria-label={`تلاوة الآية ${ayah.number}`} />
            <button type="button" onClick={() => startPractice(ayah)} disabled={recordingAyah === ayah.id}>
              {recordingAyah === ayah.id ? "🎙️ استمع لقراءتك…" : "🎤 تدرب على القراءة"}
            </button>
          </div>
          {speechError && recordingAyah === null && <p className="quran-speech-error">{speechError}</p>}
          {speechText && speechScore !== null && <div className="quran-speech-result">
            <b>ما التقطه الميكروفون:</b> <span>{speechText}</span>
            <strong>تطابق الكلمات التقريبي: {speechScore.toLocaleString("ar-EG")}٪</strong>
          </div>}
        </article>)}
      </div>
    </section>}

    {!loading && !error && pageAyahs.length > 0 && <section className="quran-tafsir-section">
      <div className="quran-section-heading">
        <div><span>تفسير الآيات حسب ترتيب المصحف</span><h3>التفسير</h3></div>
        <span className="quran-tafsir-count">{pageAyahs.length.toLocaleString("ar-EG")} آية في هذه الصفحة</span>
      </div>
      <p className="quran-tafsir-intro">التفسير موجود هنا أسفل المصحف، بالترتيب نفسه. افتح تفسير أي آية ليظهر داخل المنصة دون الانتقال إلى موقع آخر.</p>
      <div className="quran-tafsir-list">
        {pageAyahs.map(ayah => {
          const surah = surahs.find(s => s.id === ayah.surah);
          const open = tafsirAyah === ayah.id;
          return <article className={open ? "quran-tafsir-item open" : "quran-tafsir-item"} key={ayah.id}>
            <button type="button" className="quran-tafsir-toggle" aria-expanded={open} onClick={() => setTafsirAyah(open ? null : ayah.id)}>
              <span><b>{surah?.name} — الآية {ayah.number.toLocaleString("ar-EG")}</b><small>{ayah.text}</small></span>
              <strong>{open ? "إخفاء التفسير −" : "عرض التفسير +"}</strong>
            </button>
            {open && <iframe title={`تفسير ${surah?.name} الآية ${ayah.number}`} src={`https://api.quranpedia.net/embed?surah=${ayah.surah}&ayah=${ayah.number}&type=tafsir&lock=1&theme=light`} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />}
          </article>;
        })}
      </div>
    </section>}

    <footer className="quran-source">النص من مصحف التجويد الملوّن عبر موسوعة القرآن الكريم. التلاوة الصوتية من شبكة القرآن الكريم. لا يتم تخزين المصحف أو الصوت في Firebase Storage. <a href="https://quranpedia.net" target="_blank" rel="noopener noreferrer">مصدر المصحف والتفسير</a> · <a href="https://alquran.cloud/cdn" target="_blank" rel="noopener noreferrer">مصدر التلاوة</a>.</footer>
  </section>;
}
