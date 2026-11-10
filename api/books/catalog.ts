function cleanText(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ").trim();
}

function allowedOfficialPdf(url: URL, system: string) {
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:") return false;
  if (system === "general") return host === "moe.gov.eg" || host.endsWith(".moe.gov.eg");
  return host === "azhar.gov.eg" || host.endsWith(".azhar.gov.eg");
}

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const system = req.query?.system === "azhar" ? "azhar" : req.query?.system === "general" ? "general" : "";
  const grade = Number(req.query?.grade);
  if (!system || !Number.isInteger(grade) || grade < 1 || grade > 6) {
    return res.status(400).json({ error: "حدد النظام والصف من 1 إلى 6." });
  }

  const catalogUrl = `https://miskeg.app/books/${system}-primary-${grade}/`;
  try {
    const page = await fetch(catalogUrl, {
      headers: { "User-Agent": "FuturePlatformBookCatalog/1.0", Accept: "text/html" },
      signal: AbortSignal.timeout(12000),
    });
    if (!page.ok) return res.status(502).json({ error: "تعذّر الوصول إلى فهرس الكتب حاليًا." });
    const html = await page.text();
    const anchors = [...html.matchAll(/<a\b([^>]*)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)];
    const books: Array<{ id: string; title: string; url: string }> = [];
    const seen = new Set<string>();

    for (const match of anchors) {
      const rawHref = match[2].replace(/&amp;/g, "&");
      let target: URL;
      try { target = new URL(rawHref, catalogUrl); } catch { continue; }
      if (!allowedOfficialPdf(target, system) || seen.has(target.href)) continue;

      const surrounding = html.slice(Math.max(0, (match.index ?? 0) - 1800), match.index ?? 0);
      const headingMatches = [...surrounding.matchAll(/<(?:h[1-6]|strong|b)[^>]*>([\s\S]*?)<\/(?:h[1-6]|strong|b)>/gi)];
      const anchorLabel = cleanText(match[4]);
      const heading = headingMatches.length ? cleanText(headingMatches[headingMatches.length - 1][1]) : "";
      const title = (heading && heading.length < 130 ? heading : anchorLabel) || `كتاب الصف ${grade}`;

      let isPdf = /\.pdf(?:$|[?#])/i.test(target.href);
      if (!isPdf) {
        try {
          const head = await fetch(target.href, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(7000) });
          isPdf = (head.headers.get("content-type") || "").toLowerCase().includes("application/pdf");
          if (head.url) target = new URL(head.url);
        } catch { /* keep unverified links out of the student library */ }
      }
      if (!isPdf || !allowedOfficialPdf(target, system)) continue;
      seen.add(target.href);
      books.push({ id: `${system}-g${grade}-${books.length + 1}`, title, url: target.href });
      if (books.length >= 40) break;
    }

    return res.status(200).json({
      system, grade, schoolYear: "2026-2027",
      source: catalogUrl, checkedAt: new Date().toISOString(),
      books,
      message: books.length ? "" : "لم يتم استخراج روابط PDF مباشرة قابلة للتحقق لهذا الصف. لم نعرض روابط غير مؤكدة.",
    });
  } catch (error) {
    console.error("Book catalog lookup failed:", error);
    return res.status(502).json({ error: "تعذّر تحميل الكتب الآن. حاول مرة أخرى لاحقًا." });
  }
}
