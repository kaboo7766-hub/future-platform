import { useEffect, useMemo, useState } from "react";

const AR = "أ ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي".split(" ");
const AR_NAMES = ["ألف","باء","تاء","ثاء","جيم","حاء","خاء","دال","ذال","راء","زاي","سين","شين","صاد","ضاد","طاء","ظاء","عين","غين","فاء","قاف","كاف","لام","ميم","نون","هاء","واو","ياء"];
const EN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const EN_NAMES = ["ay","bee","see","dee","ee","eff","jee","aitch","eye","jay","kay","ell","em","en","oh","pee","cue","ar","ess","tee","you","vee","double you","ex","why","zee"];
const AR_NUMBERS = ["صفر","واحد","اثنان","ثلاثة","أربعة","خمسة","ستة","سبعة","ثمانية","تسعة","عشرة","أحد عشر","اثنا عشر"];
const EN_NUMBERS = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve"];

function speak(text: string, language: "ar" | "en") {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return false;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang.toLowerCase() === (language === "ar" ? "ar-eg" : "en-us"))
      || voices.find(v => v.lang.toLowerCase().startsWith(language === "ar" ? "ar" : "en"));
    if (preferred) utterance.voice = preferred;
    utterance.lang = preferred?.lang || (language === "ar" ? "ar-EG" : "en-US");
    utterance.rate = 0.82;
    utterance.pitch = 1.04;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch { return false; }
}

export default function LearningTables() {
  const [tab, setTab] = useState<"ar" | "en" | "multiply">("ar");
  const [selectedTable, setSelectedTable] = useState(1);
  const [soundError, setSoundError] = useState("");
  const [voicesReady, setVoicesReady] = useState(false);
  useEffect(() => {
    if (!("speechSynthesis" in window)) { setSoundError("المتصفح لا يدعم النطق الصوتي. جرّب Chrome على الهاتف."); return; }
    const update = () => setVoicesReady(true);
    update();
    window.speechSynthesis.addEventListener?.("voiceschanged", update);
    return () => { window.speechSynthesis.cancel(); window.speechSynthesis.removeEventListener?.("voiceschanged", update); };
  }, []);
  const arabicRows = useMemo(() => AR.map((letter, i) => ({ letter, name: AR_NAMES[i], index: i + 1 })), []);
  const englishRows = useMemo(() => EN.map((letter, i) => ({ letter, name: EN_NAMES[i], index: i + 1 })), []);
  const say = (text: string, lang: "ar" | "en") => {
    if (!speak(text, lang)) setSoundError("تعذّر تشغيل الصوت على هذا المتصفح.");
    else setSoundError("");
  };
  const arabic = (n: number) => AR_NUMBERS[n] || String(n);
  const english = (n: number) => EN_NUMBERS[n] || String(n);

  return <section className="panel learning-tables-page">
    <header className="learning-tables-hero">
      <span className="learning-spark">✨ تعلّم بالصوت</span>
      <h2>🔤 الحروف وجداول الضرب</h2>
      <p>اضغط على أي حرف أو عملية حسابية لتسمع نطقها بصوت الجهاز.</p>
      <small>استخدم زر 🔊 للاستماع، ويمكنك إعادة النطق أكثر من مرة.</small>
    </header>
    <div className="learning-tabs" role="tablist" aria-label="أقسام التعلّم">
      <button type="button" className={tab === "ar" ? "active" : ""} onClick={() => setTab("ar")}>🇪🇬 الحروف العربية</button>
      <button type="button" className={tab === "en" ? "active" : ""} onClick={() => setTab("en")}>🇬🇧 الحروف الإنجليزية</button>
      <button type="button" className={tab === "multiply" ? "active" : ""} onClick={() => setTab("multiply")}>✖️ جدول الضرب</button>
    </div>
    {soundError && <p className="err" role="alert">{soundError}</p>}
    {!soundError && <p className="learning-sound-note">🔊 الصوت يستخدم محرك النطق والأصوات المثبتة على جهازك ومتصفحك. {voicesReady ? "تم تحميل إعدادات الصوت." : "يتم تجهيز الصوت..."}</p>}
    {tab === "ar" && <div className="learning-letter-section" dir="rtl">
      <h3>الحروف العربية</h3><p>اضغط على الحرف لسماع اسمه.</p>
      <div className="learning-letter-grid">{arabicRows.map(item => <button type="button" className="learning-letter-card arabic" key={item.letter} onClick={() => say(item.name, "ar")} aria-label={`استمع إلى حرف ${item.name}`}><strong>{item.letter}</strong><span>{item.name}</span><small>🔊 استمع</small></button>)}</div>
      <button type="button" className="btn learning-repeat-all" onClick={() => say(AR_NAMES.join("، ثم "), "ar")}>🔊 استمع إلى الحروف كلها بالترتيب</button>
    </div>}
    {tab === "en" && <div className="learning-letter-section" dir="ltr">
      <h3>English Alphabet</h3><p>Tap a letter to hear its name.</p>
      <div className="learning-letter-grid">{englishRows.map(item => <button type="button" className="learning-letter-card english" key={item.letter} onClick={() => say(item.name, "en")} aria-label={`Hear letter ${item.letter}`}><strong>{item.letter}</strong><span>{item.letter}</span><small>🔊 Listen</small></button>)}</div>
      <button type="button" className="btn learning-repeat-all" onClick={() => say(EN_NAMES.join(", "), "en")}>🔊 Listen to all letters in order</button>
    </div>}
    {tab === "multiply" && <div className="learning-multiply-section" dir="rtl">
      <h3>جدول الضرب من 1 إلى 12</h3>
      <p>اختر جدولًا، ثم اضغط على العملية لتسمع: كام في كام، والناتج.</p>
      <div className="multiplication-selector learning-table-selector">{Array.from({length:12},(_,i)=>i+1).map(n=><button type="button" key={n} className={selectedTable===n?"active":""} aria-pressed={selectedTable===n} onClick={() => setSelectedTable(n)}>جدول {n}</button>)}</div>
      <div className="learning-table-card">
        <h4>⭐ جدول ضرب {selectedTable}</h4>
        <div className="learning-operation-list">{Array.from({length:12},(_,i)=>i+1).map(n => {
          const result = selectedTable * n;
          const spoken = `${arabic(selectedTable)} ضرب ${arabic(n)} يساوي ${arabic(result)}`;
          const spokenEn = `${english(selectedTable)} times ${english(n)} equals ${english(result)}`;
          return <button type="button" key={n} className="learning-operation" onClick={() => say(spoken, "ar")} aria-label={`استمع إلى ${selectedTable} ضرب ${n}`}>
            <span><b>{selectedTable} × {n}</b><small>اضغط لسماع العملية والناتج</small></span><strong>= {result}</strong><span className="learning-audio-icon">🔊</span>
          </button>;
        })}</div>
        <div className="learning-dual-audio">
          <button type="button" className="btn" onClick={() => say(Array.from({length:12},(_,i)=>`${arabic(selectedTable)} ضرب ${arabic(i+1)} يساوي ${arabic(selectedTable*(i+1))}`).join("، ثم "), "ar")}>🔊 استمع للجدول بالعربية</button>
          <button type="button" className="btn ghost" onClick={() => say(Array.from({length:12},(_,i)=>`${english(selectedTable)} times ${english(i+1)} equals ${english(selectedTable*(i+1))}`).join(". "), "en")}>🔊 Listen in English</button>
        </div>
      </div>
    </div>}
    <p className="learning-footnote">ملاحظة: جودة الصوت ونوعه يعتمدان على الأصوات المتاحة في الهاتف والمتصفح. للحصول على أفضل نطق، افتح المنصة من Google Chrome وتأكد من تثبيت صوت عربي وصوت إنجليزي في إعدادات تحويل النص إلى كلام بالجهاز.</p>
  </section>;
}
