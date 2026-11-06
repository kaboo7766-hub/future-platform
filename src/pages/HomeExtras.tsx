import { useEffect, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
export interface Teacher { id: string; name: string; subject: string; bio: string }
export interface Testimonial { id: string; author: string; text: string }
export interface Contact { email?: string; phone?: string; whatsapp?: string; facebook?: string; instagram?: string; youtube?: string }

export function useSite() {
  const [t, setT] = useState<Teacher[]>([]), [r, setR] = useState<Testimonial[]>([]), [c, setC] = useState<Contact | null>(null);
  useEffect(() => {
    const e = () => {};
    const a = onSnapshot(collection(db, "siteTeachers"), s => setT(s.docs.map(d => ({ id: d.id, ...d.data() } as Teacher))), e);
    const b = onSnapshot(collection(db, "siteTestimonials"), s => setR(s.docs.map(d => ({ id: d.id, ...d.data() } as Testimonial))), e);
    const k = onSnapshot(doc(db, "siteSettings", "contact"), s => setC((s.data() as Contact | undefined) ?? null), e);
    return () => { a(); b(); k(); };
  }, []);
  return { t, r, c };
}
const https = (u?: string) => (u && u.startsWith("https://") ? u : "");
export function contactLinks(c: Contact | null) {
  if (!c) return [];
  const L: { href: string; label: string }[] = [];
  if (c.phone) L.push({ href: `tel:${c.phone.replace(/[^+\d]/g, "")}`, label: `📞 ${c.phone}` });
  if (c.whatsapp) L.push({ href: `https://wa.me/${c.whatsapp.replace(/\D/g, "")}`, label: "💬 واتساب" });
  if (c.email) L.push({ href: `mailto:${c.email}`, label: `✉️ ${c.email}` });
  if (https(c.facebook)) L.push({ href: c.facebook!, label: "فيسبوك" });
  if (https(c.instagram)) L.push({ href: c.instagram!, label: "إنستجرام" });
  if (https(c.youtube)) L.push({ href: c.youtube!, label: "يوتيوب" });
  return L;
}

export function Characters() {
  return (<section className="chars"><h2>رفاقك في رحلة التعلّم</h2><div className="char-row">
    <div className="char"><svg viewBox="0 0 120 120" role="img" aria-label="البومة الذكية"><ellipse cx="60" cy="72" rx="34" ry="36" fill="#8d6e63" /><ellipse cx="60" cy="80" rx="22" ry="24" fill="#d7ccc8" /><circle cx="46" cy="58" r="13" fill="#fff" /><circle cx="74" cy="58" r="13" fill="#fff" /><circle cx="46" cy="59" r="6" fill="#1d2a44" /><circle cx="74" cy="59" r="6" fill="#1d2a44" /><path d="M54 68 L66 68 L60 78 Z" fill="#ffb300" /><rect x="34" y="28" width="52" height="8" rx="2" fill="#18267a" /><path d="M44 28 L60 14 L76 28 Z" fill="#18267a" /><circle cx="60" cy="14" r="3" fill="#ffd166" /></svg>
      <p className="bubble">أنا بومة! سأعلّمك الحروف</p></div>
    <div className="char"><svg viewBox="0 0 120 120" role="img" aria-label="الروبوت الصغير"><rect x="28" y="38" width="64" height="54" rx="14" fill="#7bdff2" /><rect x="38" y="48" width="44" height="26" rx="8" fill="#fff" /><circle cx="50" cy="61" r="6" fill="#2446c8" /><circle cx="70" cy="61" r="6" fill="#2446c8" /><path d="M50 82 Q60 90 70 82" stroke="#14213d" strokeWidth="3" fill="none" strokeLinecap="round" /><rect x="57" y="22" width="6" height="16" fill="#14213d" /><circle cx="60" cy="20" r="6" fill="#ff6b6b" /><rect x="18" y="52" width="10" height="24" rx="5" fill="#2446c8" /><rect x="92" y="52" width="10" height="24" rx="5" fill="#2446c8" /><rect x="40" y="92" width="14" height="14" rx="4" fill="#14213d" /><rect x="66" y="92" width="14" height="14" rx="4" fill="#14213d" /></svg>
      <p className="bubble">أنا روبوت! نلعب مع الأرقام</p></div>
    <div className="char"><svg viewBox="0 0 120 120" role="img" aria-label="النجمة المرحة"><polygon points="60,14 71.8,45.8 105.6,47.1 79,68.2 88.2,100.9 60,82 31.8,100.9 41,68.2 14.4,47.1 48.2,45.8" fill="#ffd166" stroke="#f0a500" strokeWidth="3" strokeLinejoin="round" /><circle cx="50" cy="58" r="4" fill="#14213d" /><circle cx="70" cy="58" r="4" fill="#14213d" /><path d="M50 68 Q60 78 70 68" stroke="#14213d" strokeWidth="3" fill="none" strokeLinecap="round" /></svg>
      <p className="bubble">وأنا نجمة! اجمع النقاط معي</p></div>
  </div></section>);
}
export function TeachersSection({ items }: { items: Teacher[] }) {
  if (!items.length) return null;
  return (<section className="wrap"><h2 className="sec">المدرسون</h2><div className="grid">{items.map(x => (
    <div className="feat" key={x.id}><div className="avatar">{x.name.slice(0, 1)}</div><b>{x.name}</b><p>{x.subject}</p><small>{x.bio}</small></div>))}</div></section>);
}
export function TestimonialsSection({ items }: { items: Testimonial[] }) {
  if (!items.length) return null;
  return (<section className="wrap"><h2 className="sec">آراء أولياء الأمور</h2><div className="grid">{items.map(x => (
    <blockquote className="quote" key={x.id}>“{x.text}”<footer>— {x.author}</footer></blockquote>))}</div></section>);
}
export function ContactSection({ c }: { c: Contact | null }) {
  const links = contactLinks(c);
  if (!links.length) return null;
  return (<section className="wrap"><h2 className="sec">تواصل معنا</h2><div className="contact">{links.map(l => (
    <a key={l.href} className="btn" href={l.href} {...(l.href.startsWith("https") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{l.label}</a>))}</div></section>);
}
