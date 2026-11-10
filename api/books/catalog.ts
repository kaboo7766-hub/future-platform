function cleanText(value: string) {
  return value.replace(/<script[\\s\\S]*?<\\/script>/gi, " ")
    .replace(/<style[\\s\\S]*?<\\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/\\s+/g, " ").trim();
}

function allowedOfficialPdf(url: URL, system: string) {
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:") return false;
  if (system === "general") return host === "moe.gov.eg" || host.endsWith(".moe.gov.eg");
  return host === "azhar.gov.eg" || host.endsWith(".azhar.gov.eg");
}
function allowedCatalogPage(url: URL) {
  const host = url.hostname.toLowerCase();
  return url.protocol === "https:" &&
    (host === "miskeg.app" || host.endsWith(".miskeg.app") ||
     host === "moe.gov.eg" || host.endsWith(".moe.gov.eg") ||
     host === "azhar.gov.eg" || host.endsWith(".azhar.gov.eg"));
}

async function verifyPdf(url: URL, system: string): Promise<URL | null> {
  // Some official document servers reject HEAD requests. Try HEAD first, then a
  // small ranged GET. The browser receives only the verified official URL.
  try {
    const head = await fetch(url.href, {
      method: "HEAD", redirect: "follow",
      headers: { "User-Agent": "FuturePlatformBookCatalog/1.1" },
      signal: AbortSignal.timeout(9000),
    });
    const finalUrl = new URL(head.url || url.href);
    if (head.ok && allowedOfficialPdf(finalUrl, system) &&
        (head.headers.get("content-type") || "").toLowerCase().includes("application/pdf")) {
      return finalUrl;
    }
  } catch { /* fall through to ranged GET */ }

  try {
    const response = await fetch(url.href, {
      method: "GET", redirect: "follow",
      headers: { "User-Agent": "FuturePlatformBookCatalog/1.1", Range: "bytes=0-7", Accept: "application/pdf,*/*;q=0.8" },
      signal: AbortSignal.timeout(12000),
    });
    const finalUrl = new URL(response.url || url.href);
    const type = (response.headers.get("content-type") || "").toLowerCase();
    const reader = response.body?.getReader();
    const first = reader ? await reader.read() : { value: new Uint8Array(), done: true };
    const bytes = first.value ? first.value.slice(0, 8) : new Uint8Array();
    if (reader) await reader.cancel().catch(() => undefined);
    const isPdf = type.includes("application/pdf") ||
      (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-");
    return response.ok && isPdf && allowedOfficialPdf(finalUrl, system) ? finalUrl : null;
  } catch { return null; }
}

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const system = req.query?.system === "azhar" ? "azhar" : req.query?.system === "general" ? "general" : "";
  const grade = Number(req.query?.grade);
  const schoolYear = typeof req.query?.schoolYear === "string" ? req.query.schoolYear : "2026-2027";
  if (!system || !Number.isInteger(grade) || grade < 1 || grade > 6) {
    return res.status(400).json({ error: "حدد النظام والصف من 1 إلى 6." });
  }
  if (schoolYear !== "2026-2027") {
    return res.status(404).json({ error: "فهرس هذه السنة غير مضاف أو لم يتم التحقق من كتبه بعد." });
  }

  // Misk is queried server-side only as a discovery index. It is never sent as
  // a student-facing destination; only verified PDF URLs on official domains
  // are returned to the in-platform PDF reader.
  const catalogUrl = `https://miskeg.app/books/${system}-primary-${grade}/`;
  try {
    const page = await fetch(catalogUrl, {
      headers: { "User-Agent": "FuturePlatformBookCatalog/1.1", Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    const finalCatalogUrl = new URL(page.url || catalogUrl);
    if (!page.ok || !allowedCatalogPage(finalCatalogUrl)) {
      return res.status(502).json({ error: "تعذّر تحميل فهرس الكتب. لم يتم فتح أي موقع خارجي للطالب." });
    }
    const html = await page.text();
    const anchors = [...html.matchAll(/<a\\b([^>]*)href=["']([^"']+)["']([^>]*)>([\\s\\S]*?)<\\/a>/gi)];
    const books: Array<{ id: string; title: string; url: string }> = [];
    const seen = new Set<string>();

    for (const match of anchors) {
      const rawHref = match[2].replace(/&amp;/g, "&");
      let target: URL;
      try { target = new URL(rawHref, finalCatalogUrl.href); } catch { continue; }
      if (!allowedCatalogPage(target) || seen.has(target.href)) continue;

      const surrounding = html.slice(Math.max(0, (match.index ?? 0) - 1800), match.index ?? 0);
      const headingMatches = [...surrounding.matchAll(/<(?:h[1-6]|strong|b)[^>]*>([\\s\\S]*?)<\\/(?:h[1-6]|strong|b)>/gi)];
      const anchorLabel = cleanText(match[4]);
      const heading = headingMatches.length ? cleanText(headingMatches[headingMatches.length - 1][1]) : "";
      const title = (heading && heading.length < 130 ? heading : anchorLabel) || `كتاب الصف ${grade}`;

      const verifiedUrl = await verifyPdf(target, system);
      if (!verifiedUrl || seen.has(verifiedUrl.href)) continue;
      seen.add(verifiedUrl.href);
      books.push({ id: `${system}-g${grade}-${books.length + 1}`, title, url: verifiedUrl.href });
      if (books.length >= 40) break;
    }

    return res.status(200).json({
      system, grade, schoolYear, checkedAt: new Date().toISOString(), books,
      message: books.length
        ? ""
        : "لم نعثر على ملفات PDF مباشرة قابلة للتحقق من نطاق الجهة الرسمية لهذا الصف. لن نعرض روابط مِسك أو روابط غير مؤكدة.",
    });
  } catch (error) {
    console.error("Book catalog lookup failed:", error);
    return res.status(502).json({ error: "تعذّر تحميل فهرس الكتب الآن. حاول مرة أخرى لاحقًا." });
  }
}
