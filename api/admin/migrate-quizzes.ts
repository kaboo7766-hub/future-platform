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
    let migrated = 0;
    let sanitized = 0;
    let skipped = 0;

    for (let offset = 0; offset < snapshot.docs.length; offset += 250) {
      const docs = snapshot.docs.slice(offset, offset + 250);
      const keys = await db.getAll(...docs.map(d => db.collection("quizAnswerKeys").doc(d.id)));
      const batch = db.batch();
      let writes = 0;

      for (let i = 0; i < docs.length; i++) {
        const quizDoc = docs[i];
        const questions = quizDoc.data().questions;
        if (!Array.isArray(questions) || !questions.length) {
          skipped++;
          continue;
        }

        const containsPublicAnswers = questions.some((question: any) =>
          question && Object.prototype.hasOwnProperty.call(question, "answer")
        );

        // A prior key may already exist while old answers are still exposed in the public quiz.
        // Always remove those fields when a trusted key is present.
        if (keys[i].exists) {
          if (containsPublicAnswers) {
            const publicQuestions = questions.map(({ answer: _answer, ...question }: any) => question);
            batch.update(quizDoc.ref, { questions: publicQuestions });
            writes++;
            sanitized++;
          } else {
            skipped++;
          }
          continue;
        }

        const validAnswers = questions.every((question: any) =>
          Number.isInteger(question?.answer) &&
          Array.isArray(question?.options) &&
          question.answer >= 0 &&
          question.answer < question.options.length
        );
        if (!validAnswers) {
          skipped++;
          continue;
        }

        const answers = questions.map((question: any) => question.answer);
        const publicQuestions = questions.map(({ answer: _answer, ...question }: any) => question);
        batch.set(db.collection("quizAnswerKeys").doc(quizDoc.id), {
          quizId: quizDoc.id,
          answers,
          migratedAt: new Date(),
          migratedBy: decoded.uid,
        });
        batch.update(quizDoc.ref, { questions: publicQuestions });
        writes += 2;
        migrated++;
        sanitized++;
      }

      if (writes) await batch.commit();
    }

    return res.status(200).json({
      migrated,
      sanitized,
      skipped,
      message: "تم تأمين مفاتيح الإجابات وإزالة الإجابات الصحيحة من بيانات الاختبارات العامة",
    });
  } catch (error: any) {
    if (error?.message?.startsWith("SERVER_CONFIG_")) {
      console.error("Quiz migration server configuration is incomplete:", error.message);
      return res.status(503).json({ error: "خدمة الخادم لم تكتمل إعداداتها بعد" });
    }
    console.error("Quiz migration failed:", error);
    return res.status(500).json({ error: "تعذّر ترحيل الاختبارات" });
  }
}
