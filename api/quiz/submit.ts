import { FieldValue } from "firebase-admin/firestore";
import { bearerToken, getAdminServices } from "../_lib/firebaseAdmin";

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ error: "يلزم تسجيل الدخول أولًا" });
    const { auth, db } = getAdminServices();
    const decoded = await auth.verifyIdToken(token);
    const userRef = db.collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists || userSnap.data()?.role !== "student") {
      return res.status(403).json({ error: "هذه الخدمة متاحة لحسابات الطلاب فقط" });
    }

    const quizId = typeof req.body?.quizId === "string" ? req.body.quizId.trim() : "";
    const answers = req.body?.answers;
    if (!quizId || quizId.length > 150 || !Array.isArray(answers) || answers.length > 50 ||
        !answers.every((n: unknown) => Number.isInteger(n) && n >= 0 && n <= 20)) {
      return res.status(400).json({ error: "بيانات الإجابة غير صحيحة" });
    }

    const quizRef = db.collection("quizzes").doc(quizId);
    const keyRef = db.collection("quizAnswerKeys").doc(quizId);
    const [quizSnap, keySnap] = await Promise.all([quizRef.get(), keyRef.get()]);
    if (!quizSnap.exists || quizSnap.data()?.published !== true) {
      return res.status(404).json({ error: "الاختبار غير متاح حاليًا" });
    }
    if (!keySnap.exists) return res.status(409).json({ error: "لم يتم تجهيز مفتاح إجابات هذا الاختبار بعد. تواصل مع الإدارة." });

    const quiz = quizSnap.data()!;
    const questions = quiz.questions;
    const correct = keySnap.data()?.answers;
    if (!Array.isArray(questions) || !Array.isArray(correct) || questions.length < 1 ||
        questions.length !== correct.length || answers.length !== questions.length) {
      return res.status(400).json({ error: "عدد الإجابات لا يطابق عدد أسئلة الاختبار" });
    }
    for (let i = 0; i < questions.length; i++) {
      if (!Array.isArray(questions[i]?.options) || !Number.isInteger(correct[i]) ||
          correct[i] < 0 || correct[i] >= questions[i].options.length ||
          answers[i] >= questions[i].options.length) {
        return res.status(409).json({ error: "بيانات الاختبار تحتاج مراجعة من الإدارة" });
      }
    }

    const score = answers.reduce((sum: number, answer: number, i: number) => sum + (answer === correct[i] ? 1 : 0), 0);
    const resultRef = db.collection("quizResults").doc(`${quizId}_${decoded.uid}`);
    // Account for results created by the older client version, which used random document IDs.
    const legacyResults = await db.collection("quizResults")
      .where("uid", "==", decoded.uid).where("quizId", "==", quizId).get();
    if (!legacyResults.empty && quiz.allowRetake !== true) {
      return res.status(409).json({ error: "لقد أديت هذا الاختبار من قبل ولا يسمح بإعادته" });
    }
    const legacyBest = legacyResults.docs.reduce<number>((best, d) => Math.max(best, Number(d.data().score ?? 0)), 0);
    const result = await db.runTransaction(async (tx) => {
      const old = await tx.get(resultRef);
      if (old.exists && quiz.allowRetake !== true) {
        const error = new Error("ALREADY_SUBMITTED");
        throw error;
      }
      const bestScore = Math.max(legacyBest, old.exists ? Number(old.data()?.score ?? 0) : 0, score);
      const attempts = Number(old.data()?.attempts ?? 0) + 1;
      tx.set(resultRef, {
        uid: decoded.uid,
        quizId,
        lessonId: quiz.lessonId,
        score: bestScore,
        total: questions.length,
        attempts,
        at: FieldValue.serverTimestamp(),
      }, { merge: true });
      return { score: bestScore, total: questions.length, attempts };
    });
    return res.status(200).json(result);
  } catch (error: any) {
    if (error?.message === "ALREADY_SUBMITTED") return res.status(409).json({ error: "لقد أديت هذا الاختبار من قبل ولا يسمح بإعادته" });
    if (error?.message?.startsWith("SERVER_CONFIG_")) {
      console.error("Quiz API server configuration is incomplete:", error.message);
      return res.status(503).json({ error: "خدمة التصحيح لم تكتمل إعداداتها بعد. أبلغ الإدارة." });
    }
    console.error("Quiz submission failed:", error);
    return res.status(500).json({ error: "حدث خطأ أثناء تصحيح الاختبار. حاول مرة أخرى." });
  }
}
