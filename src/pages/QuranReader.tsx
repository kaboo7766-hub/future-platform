import { useEffect, useMemo, useState } from "react";

type Ayah = { id?: number; number: number; surah?: number; page_number?: number; text: string; marker?: string };
const API = "https://api.quranpedia.net/v1";
const SURAHS = [
"الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"
];

export default function QuranReader() {
  const [surah, setSurah] = useState(1);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tafsirAyah, setTafsirAyah] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setAyahs([]); setTafsirAyah(null);
    fetch(`${API}/mushafs/1/${surah}`)
      .then(async response => {
        if (!response.ok) throw new Error("تعذّر تحميل السورة من مصدر المصحف.");
        return response.json();
      })
      .then(data => {
        const rows = Array.isArray(data) ? data : Array.isArray(data?.ayahs) ? data.ayahs : [];
        if (!rows.length) throw new Error("لم تصل آيات هذه السورة. حاول مرة أخرى.");
        if (active) setAyahs(rows.map((item: Ayah) => ({ ...item, number: Number(item.number) })));
      })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : "حدث خطأ أثناء تحميل المصحف."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [surah]);

  const filteredSurahs = useMemo(() => SURAHS.map((name, i) => ({ id: i + 1, name })).filter(s => s.name.includes(query.trim())), [query]);
  const selectedName = SURAHS[surah - 1];

  return <section className="panel quran-reader" dir="rtl">
    <header className="quran-hero">
      <span className="quran-kicker">📖 نور وهداية</span>
      <h2>القرآن الكريم والتفسير</h2>
      <p>مصحف كامل برواية حفص عن عاصم، مع إمكانية فتح تفسير كل آية على حدة.</p>
      <div className="quran-stats"><span>114 سورة</span><span>مصحف حفص</span><span>تفسير لكل آية</span></div>
    </header>

    <div className="quran-tools">
      <label className="quran-surah-label" htmlFor="quran-surah-search">اختر السورة</label>
      <input id="quran-surah-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث باسم السورة…" />
      <div className="quran-surah-grid" role="list" aria-label="قائمة سور القرآن الكريم">
        {filteredSurahs.map(item => <button type="button" role="listitem" key={item.id} className={surah === item.id ? "active" : ""} onClick={() => { setSurah(item.id); setQuery(""); }}>
          <span>{item.id}</span><b>{item.name}</b>
        </button>)}
      </div>
    </div>

    <div className="quran-current-heading">
      <div><small>السورة المختارة</small><h3>{selectedName}</h3></div>
      <span>{loading ? "جارٍ التحميل…" : ayahs.length ? `${ayahs.length} آية` : ""}</span>
    </div>

    {error && <div className="quran-error" role="alert"><p>{error}</p><button className="btn" onClick={() => setSurah(s => s)}>إعادة المحاولة</button></div>}
    {loading && <p className="quran-loading" role="status">جارٍ تحميل آيات سورة {selectedName}…</p>}

    {!loading && !error && <div className="quran-ayah-list">
      {ayahs.map(ayah => <article className={tafsirAyah === ayah.number ? "quran-ayah selected" : "quran-ayah"} key={ayah.id ?? `${surah}-${ayah.number}`}>
        <div className="quran-ayah-number">{ayah.number.toLocaleString("ar-EG")}</div>
        <p className="quran-ayah-text">{ayah.text}</p>
        <div className="quran-ayah-actions">
          <span>{ayah.page_number ? `صفحة ${ayah.page_number.toLocaleString("ar-EG")}` : `آية ${ayah.number.toLocaleString("ar-EG")}`}</span>
          <button type="button" className="quran-tafsir-button" aria-expanded={tafsirAyah === ayah.number} onClick={() => setTafsirAyah(current => current === ayah.number ? null : ayah.number)}>
            {tafsirAyah === ayah.number ? "إخفاء التفسير" : "📚 تفسير الآية"}
          </button>
        </div>
        {tafsirAyah === ayah.number && <div className="quran-tafsir-panel">
          <h4>تفسير سورة {selectedName} — الآية {ayah.number.toLocaleString("ar-EG")}</h4>
          <p>يعرض التفسير الخاص بهذه الآية من موسوعة القرآن الكريم.</p>
          <iframe title={`تفسير سورة ${selectedName} الآية ${ayah.number}`} src={`https://api.quranpedia.net/embed?surah=${surah}&ayah=${ayah.number}&type=tafsir`} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
          <a href={`https://api.quranpedia.net/embed?surah=${surah}&ayah=${ayah.number}&type=tafsir`} target="_blank" rel="noopener noreferrer">فتح التفسير في صفحة مستقلة</a>
        </div>}
      </article>)}
    </div>}
    <footer className="quran-source">النص القرآني والتفسير يُحمّلان مباشرة من مصادرهما، ولا يتم تخزينهما في Firebase Storage. المصدر: <a href="https://quranpedia.net" target="_blank" rel="noopener noreferrer">موسوعة القرآن الكريم</a>.</footer>
  </section>;
}
