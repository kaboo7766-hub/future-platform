import { FormEvent, useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { useAuth } from "../auth/AuthContext";
import { db } from "../firebase";

type Post = { id: string; kind: "lesson" | "review"; title: string; body: string; author: string; subject?: string; createdAt?: any };
type Comment = { id: string; postId: string; uid: string; author: string; text: string; createdAt?: any };
type Reaction = { id: string; postId: string; uid: string; author: string; emoji: string };
const EMOJIS = ["👍", "❤️", "😂", "👏", "🌟"];

function timeLabel(value: any) {
  if (!value?.toDate) return "منشور حديث";
  return value.toDate().toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
}

export default function SocialFeed() {
  const { profile } = useAuth();
  const [lessons, setLessons] = useState<Post[]>([]);
  const [reviews, setReviews] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;
    const base = collection(db, "lessons");
    const classIds = profile.classIds ?? [];
    const lessonQuery = profile.role === "admin" ? base
      : profile.role === "teacher"
        ? (classIds.length ? query(base, where("classId", "in", classIds.slice(0, 30)), where("published", "==", true)) : query(base, where("classId", "==", "__none__")))
        : profile.role === "student" && profile.classId
          ? query(base, where("classId", "==", profile.classId), where("published", "==", true))
          : null;
    const unsubLessons = lessonQuery ? onSnapshot(lessonQuery, snap => {
      setLessons(snap.docs.map(d => {
        const x = d.data();
        return { id: "lesson_" + d.id, kind: "lesson" as const, title: String(x.title ?? "درس جديد"), body: String(x.description ?? "درس جديد متاح الآن."), author: String(x.teacherName ?? "فريق منصة المستقبل"), subject: String(x.subjectName ?? ""), createdAt: x.createdAt };
      }));
    }, () => setError("تعذر تحميل الدروس المنشورة. تحقق من صلاحيات قراءة الدروس.")) : (() => { setLessons([]); return () => {}; })();
    const unsubReviews = onSnapshot(collection(db, "siteTestimonials"), snap => setReviews(snap.docs.map(d => {
      const x = d.data();
      return { id: "review_" + d.id, kind: "review" as const, title: "رأي من آراء مجتمعنا", body: String(x.text ?? ""), author: String(x.author ?? "أحد أفراد المجتمع") };
    })), () => setError("تعذر تحميل آراء المعلمين."));
    const unsubComments = onSnapshot(collection(db, "socialComments"), snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment))), () => {});
    const unsubReactions = onSnapshot(collection(db, "socialReactions"), snap => setReactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reaction))), () => {});
    return () => { unsubLessons(); unsubReviews(); unsubComments(); unsubReactions(); };
  }, [profile?.uid, profile?.role, profile?.classId, profile?.classIds]);

  const posts = useMemo(() => [...lessons, ...reviews], [lessons, reviews]);
  const myUid = profile?.uid ?? "";
  const react = async (postId: string, emoji: string) => {
    if (!profile) return;
    const id = postId + "_" + profile.uid;
    const existing = reactions.find(r => r.id === id);
    try {
      if (existing?.emoji === emoji) await deleteDoc(doc(db, "socialReactions", id));
      else await setDoc(doc(db, "socialReactions", id), { postId, uid: profile.uid, author: profile.name, emoji, createdAt: serverTimestamp() });
    } catch { setError("لم نتمكن من حفظ التفاعل. تحقق من صلاحيات قاعدة البيانات."); }
  };
  const sendComment = async (event: FormEvent<HTMLFormElement>, postId: string) => {
    event.preventDefault();
    if (!profile) return;
    const text = (drafts[postId] ?? "").trim();
    if (!text || text.length > 500) return;
    setBusy(postId); setError("");
    try {
      await addDoc(collection(db, "socialComments"), { postId, uid: profile.uid, author: profile.name, text, createdAt: serverTimestamp() });
      setDrafts(p => ({ ...p, [postId]: "" }));
    } catch { setError("تعذر إرسال التعليق. قد تحتاج قواعد Firestore إلى النشر أولًا."); }
    finally { setBusy(""); }
  };

  return <section className="social-feed" aria-label="آخر الدروس وآراء مجتمع المنصة">
    <div className="social-feed-heading"><div><span>🌟 مجتمع التعلّم</span><h2>آخر الدروس وآراء المعلمين</h2><p>تابع الجديد، شارك رأيك، وشجّع زملاءك.</p></div><span className="social-live">● تحديث مباشر</span></div>
    {error && <p className="err" role="alert">{error}</p>}
    {posts.length === 0 && <div className="social-empty"><span>📚</span><b>لا توجد منشورات حتى الآن</b><small>ستظهر هنا الدروس المنشورة وآراء المجتمع.</small></div>}
    {posts.map(post => {
      const postComments = comments.filter(c => c.postId === post.id).sort((a,b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      const postReactions = reactions.filter(r => r.postId === post.id);
      const mine = postReactions.find(r => r.uid === myUid);
      return <article className="social-post" key={post.id}>
        <div className="social-post-author"><div className={post.kind === "lesson" ? "social-avatar lesson" : "social-avatar"}>{post.kind === "lesson" ? "📚" : "👩‍🏫"}</div><div><b>{post.author}</b><small>{post.kind === "lesson" ? "درس جديد" : "رأي من مجتمع المنصة"} · {timeLabel(post.createdAt)}</small></div></div>
        <div className="social-post-content">{post.kind === "lesson" && <span className="social-kind">درس تعليمي {post.subject ? "· " + post.subject : ""}</span>}<h3>{post.title}</h3><p>{post.body}</p></div>
        <div className="social-reaction-summary"><span>{postReactions.length ? "👍 ❤️ 👏" : "كن أول من يتفاعل"}</span><span>{postReactions.length} تفاعل · {postComments.length} تعليق</span></div>
        <div className="social-actions">{EMOJIS.map(emoji => <button key={emoji} type="button" className={mine?.emoji === emoji ? "selected" : ""} onClick={() => void react(post.id, emoji)} aria-label={"تفاعل " + emoji}>{emoji}</button>)}<button type="button" className="social-comment-toggle" onClick={() => setExpanded(p => ({ ...p, [post.id]: !p[post.id] }))}>💬 التعليقات</button></div>
        {expanded[post.id] && <div className="social-comments"><div className="social-comment-list">{postComments.map(c => <div className="social-comment" key={c.id}><span className="social-comment-avatar">{c.author?.slice(0,1) || "؟"}</span><div><b>{c.author}</b><p>{c.text}</p></div></div>)}{postComments.length === 0 && <small className="note">لا توجد تعليقات بعد. ابدأ الحوار.</small>}</div>
          <form className="social-comment-form" onSubmit={e => void sendComment(e, post.id)}><input aria-label="اكتب تعليقك" placeholder="اكتب تعليقًا..." value={drafts[post.id] ?? ""} maxLength={500} onChange={e => setDrafts(p => ({ ...p, [post.id]: e.target.value }))} /><button className="btn" type="submit" disabled={busy === post.id || !(drafts[post.id] ?? "").trim()}>إرسال</button></form>
        </div>}
      </article>;
    })}
  </section>;
}
