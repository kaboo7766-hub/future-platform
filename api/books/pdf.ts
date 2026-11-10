const OFFICIAL_HOSTS = ["moe.gov.eg", "azhar.gov.eg"];
function isAllowed(url: URL) {
  return url.protocol === "https:" && OFFICIAL_HOSTS.some(host =>
    url.hostname === host || url.hostname.endsWith("." + host)
  );
}
export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const raw = typeof req.query?.url === "string" ? req.query.url : "";
  let target: URL;
  try { target = new URL(raw); } catch { return res.status(400).json({ error: "رابط الكتاب غير صالح." }); }
  if (!isAllowed(target)) return res.status(403).json({ error: "مصدر الكتاب غير مسموح به." });
  try {
    const upstream = await fetch(target, {
      headers: { "User-Agent": "FuturePlatformBookReader/1.0", Accept: "application/pdf,*/*;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    let finalUrl: URL;
    try { finalUrl = new URL(upstream.url || target.href); } catch { return res.status(502).json({ error: "تعذّر التحقق من مصدر الملف." }); }
    if (!isAllowed(finalUrl)) return res.status(403).json({ error: "تم رفض تحويل الملف إلى مصدر غير رسمي." });
    if (!upstream.ok) return res.status(502).json({ error: "المصدر الرسمي لم يرسل الكتاب حاليًا." });
    const contentType = (upstream.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("application/pdf") && !/\\.pdf(?:$|[?#])/i.test(finalUrl.href)) {
      return res.status(415).json({ error: "الرابط لا يعيد ملف PDF قابلًا للعرض." });
    }
    const length = Number(upstream.headers.get("content-length") || 0);
    if (length > 40 * 1024 * 1024) return res.status(413).json({ error: "حجم الكتاب أكبر من الحد المسموح للعرض." });
    const data = Buffer.from(await upstream.arrayBuffer());
    if (data.length > 40 * 1024 * 1024) return res.status(413).json({ error: "حجم الكتاب أكبر من الحد المسموح للعرض." });
    if (data.length < 5 || data.subarray(0, 5).toString("ascii") !== "%PDF-") {
      return res.status(415).json({ error: "الملف المستلم ليس PDF صالحًا." });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="school-book.pdf"');
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.status(200).send(data);
  } catch (error) {
    console.error("Book PDF proxy failed:", error);
    return res.status(502).json({ error: "تعذّر جلب الكتاب من المصدر الرسمي. قد يمنع المصدر عرض الملف عبر المنصة." });
  }
}
