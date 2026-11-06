import { bearerToken, getAdminServices } from "../_lib/firebaseAdmin";

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ error: "يلزم تسجيل الدخول أولًا" });
    const { auth, db } = getAdminServices();
    const decoded = await auth.verifyIdToken(token);
    const adminProfile = await db.collection("users").doc(decoded.uid).get();
    if (adminProfile.data()?.role !== "admin") return res.status(403).json({ error: "هذه العملية للمدير فقط" });

    const snapshot = await db.collection("quizzes").get();
    let migrated = 0, skipped = 0;
    for (let offset = 0; offset < snapshot.docs.length; offset += 250) {
      const docs = snapshot.docs.slice(offset, offset + 250);
      const keys = await db.getAll(...docs.map(d => db.collection("quizAnswerKeys").doc(d.id)));
      const batch = db.batch();
      let writes = 0;
      for (let i = 0; i < docs.length; i++) {
        const quizDoc = docs[i];
        const data = quizDoc.data();
        const questions = data.questions;
        if (!Array.isArray(questions) || !questions.length || keys[i].exists ||
            !questions.every((q: any) => Number.isInteger(q?.answer) && Array.isArray(q?.options) && q.answer >= 0 && q.answer < q.options.length)) {
          skipped++;
          continue;
        }
        const answers = questions.map((q: any) => q.answer);
        const publicQuestions = questions.map(({ answer: _answer, ...q }: any) => q);
        batch.set(db.collection("quizAnswerKeys").doc(quizDoc.id), {
          quizId: quizDoc.id, answers, migratedAt: new Date(), migratedBy: decoded.uid,
        });
        batch.update(quizDoc.ref, { questions: publicQuestions });
        writes += 2;
        migrated++;
      }
      if (writes) await batch.commit();
    }
    return res.status(200).json({ migrated, skipped, message: "تم ترحيل مفاتيح الإجابات إلى مجموعة خاصة بالمدير والخادم" });
  } catch (error: any) {
    if (error?.message?.startsWith("SERVER_CONFIG_")) {
      console.error("Quiz migration server configuration is incomplete:", error.message);
      return res.status(503).json({ error: "خدمة الخادم لم تكتمل إعداداتها بعد" });
    }
    console.error("Quiz migration failed:", error);
    return res.status(500).json({ error: "تعذّر ترحيل الاختبارات" });
  }
}
