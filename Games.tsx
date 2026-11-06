import { useEffect, useRef, useState } from "react";
import { doc, increment, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";

interface Q { prompt: string; options: string[]; answer: string; say?: { text: string; lang: string } }
const AR = "أبتثجحخدذرزسشصضطظعغفقكلمنهوي".split(""), EN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
const speak = (text: string, lang: string) => { try { const u = new SpeechSynthesisUtterance(text); u.lang = lang; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch { /* ignore */ } };
let actx: AudioContext | null = null;
const tone = (freqs: number[]) => {
  try {
    if (!actx) actx = new AudioContext();
    const c = actx;
    freqs.forEach((f, i) => { const t = c.currentTime + i * 0.12, o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; o.connect(g); g.connect(c.destination); g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.11); o.start(t); o.stop(t + 0.12); });
  } catch { /* ignore */ }
};
const lettersQ = (lang: "ar" | "en") => (): Q => {
  const set = lang === "ar" ? AR : EN, t = set[Math.floor(Math.random() * set.length)];
  return { prompt: canSpeak ? "اضغط على الحرف الذي تسمعه" : `ابحث عن الحرف: ${t}`, options: shuffle([t, ...shuffle(set.filter(x => x !== t)).slice(0, 3)]), answer: t, say: canSpeak ? { text: t, lang: lang === "ar" ? "ar-SA" : "en-US" } : undefined };
};
const mathQ = (): Q => {
  const plus = Math.random() < 0.5; let a = 1 + Math.floor(Math.random() * 10), b = 1 + Math.floor(Math.random() * 10);
  if (!plus && a < b) [a, b] = [b, a];
  const ans = plus ? a + b : a - b, s = new Set([ans]);
  while (s.size < 4) { const c = ans + Math.floor(Math.random() * 7) - 3; if (c >= 0) s.add(c); }
  return { prompt: `${a} ${plus ? "+" : "−"} ${b} = ؟`, options: shuffle([...s].map(String)), answer: String(ans) };
};

function ChoiceGame({ make, onDone }: { make: () => Q; onDone: (points: number) => void }) {
  const [i, setI] = useState(0), [score, setScore] = useState(0), [q, setQ] = useState<Q>(make), [picked, setPicked] = useState("");
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => { if (q.say) speak(q.say.text, q.say.lang); }, [q]);
  const pick = (o: string) => {
    if (picked) return;
    setPicked(o); const ok = o === q.answer, ns = score + (ok ? 1 : 0);
    tone(ok ? [660, 880, 1100] : [220]); setScore(ns);
    setTimeout(() => { if (!alive.current) return; if (i === 9) return onDone(ns * 5); setI(i + 1); setQ(make()); setPicked(""); }, 900);
  };
  return (<div><p>السؤال {i + 1} من 10 — النتيجة: {score}</p><h3 className="big">{q.prompt}</h3>
    {q.say && <button className="mini" onClick={() => speak(q.say!.text, q.say!.lang)}>🔊 أعد الصوت</button>}
    <div className="opts">{q.options.map(o => <button key={o} className={`opt ${picked ? (o === q.answer ? "good" : o === picked ? "bad" : "") : ""}`} onClick={() => pick(o)}>{o}</button>)}</div>
    {picked && <p className="pop" role="status">{picked === q.answer ? "أحسنت! 🎉" : "حاول مرة أخرى في السؤال القادم 💪"}</p>}</div>);
}

const EMOJI = ["🍎", "🐱", "🚗", "⭐", "🌙", "🐟", "🌳", "⚽"];
function MemoryGame({ onDone }: { onDone: (points: number) => void }) {
  const [cards] = useState(() => shuffle([...EMOJI, ...EMOJI]));
  const [open, setOpen] = useState<number[]>([]), [done, setDone] = useState<number[]>([]), [moves, setMoves] = useState(0);
  const flip = (k: number) => {
    if (open.length === 2 || open.includes(k) || done.includes(k)) return;
    const n = [...open, k]; setOpen(n);
    if (n.length === 2) {
      setMoves(m => m + 1);
      if (cards[n[0]] === cards[n[1]]) { tone([660, 880]); setDone(d => [...d, ...n]); setOpen([]); } else setTimeout(() => setOpen([]), 800);
    }
  };
  const fired = useRef(false);
  useEffect(() => { if (done.length === 16 && !fired.current) { fired.current = true; tone([660, 880, 1100, 1320]); onDone(20); } }, [done, onDone]);
  return (<div><p>المحاولات: {moves}</p><div className="mem">{cards.map((e, k) => {
    const show = open.includes(k) || done.includes(k);
    return <button key={k} className={`opt ${show ? "good" : ""}`} aria-label={show ? e : "بطاقة مقلوبة"} onClick={() => flip(k)}>{show ? e : "❓"}</button>; })}</div></div>);
}

const BADGES = [{ min: 50, t: "🥉 نجم صاعد" }, { min: 200, t: "🥈 بطل صغير" }, { min: 500, t: "🥇 خبير المستقبل" }];
export default function Games() {
  const { profile } = useAuth(); const uid = profile!.uid;
  const [pts, setPts] = useState(0), [game, setGame] = useState<string | null>(null), [res, setRes] = useState(""), [err, setErr] = useState("");
  useEffect(() => onSnapshot(doc(db, "points", uid), s => setPts(s.data()?.total ?? 0), () => {}), [uid]);
  const finish = async (n: number) => {
    setGame(null); setRes(`انتهت اللعبة! ربحت ${n} نقطة 🎉`); setErr("");
    if (n > 0) try { await setDoc(doc(db, "points", uid), { uid, total: increment(n), updatedAt: serverTimestamp() }, { merge: true }); } catch { setErr("تعذّر حفظ النقاط"); }
  };
  const games: [string, string][] = [["ar", "🔤 الحروف العربية"], ["en", "🔠 الحروف الإنجليزية"], ["math", "➕ لعبة الحساب"], ["mem", "🧠 لعبة الذاكرة"]];
  return (<section className="panel"><h3>الألعاب التعليمية</h3>
    <p>نقاطك: <b>{pts}</b> {BADGES.filter(b => pts >= b.min).map(b => <span key={b.t} className="chip">{b.t}</span>)}</p>
    {!game && <div className="row" style={{ flexWrap: "wrap" }}>{games.map(([k, t]) => <button key={k} className="btn" onClick={() => { setRes(""); setGame(k); }}>{t}</button>)}</div>}
    {game === "ar" && <ChoiceGame make={lettersQ("ar")} onDone={finish} />}
    {game === "en" && <ChoiceGame make={lettersQ("en")} onDone={finish} />}
    {game === "math" && <ChoiceGame make={mathQ} onDone={finish} />}
    {game === "mem" && <MemoryGame onDone={finish} />}
    {game && <button className="link" onClick={() => setGame(null)}>إنهاء اللعبة</button>}
    {res && <p className="ok pop" role="status">{res}</p>}{err && <p className="err" role="alert">{err}</p>}</section>);
}
