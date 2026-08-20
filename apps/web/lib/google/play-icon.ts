export interface PlayStoreInfo {
  icon: string | null;
  rating: number | null;
  downloads: number | null;
  /** false quando a página do app não existe mais na Play (404 = removido/suspenso) */
  found: boolean;
}

function parseDownloads(text: string): number | null {
  const clean = text.replace(/[+\s]/g, "").toLowerCase();

  // Portuguese: "100 mil", "1 mi"
  if (clean.includes("mi") && !clean.includes("mil")) {
    const num = parseFloat(clean.replace(/mi.*/, ""));
    return isNaN(num) ? null : num * 1_000_000;
  }
  if (clean.includes("mil")) {
    const num = parseFloat(clean.replace(/mil.*/, ""));
    return isNaN(num) ? null : num * 1_000;
  }

  // English: "10K", "1M", "1B"
  if (clean.endsWith("b")) return parseFloat(clean) * 1_000_000_000 || null;
  if (clean.endsWith("m")) return parseFloat(clean) * 1_000_000 || null;
  if (clean.endsWith("k")) return parseFloat(clean) * 1_000 || null;

  const num = parseInt(clean.replace(/[.,]/g, ""), 10);
  return isNaN(num) ? null : num;
}

export async function fetchPlayStoreInfo(
  packageName: string
): Promise<PlayStoreInfo> {
  const result: PlayStoreInfo = { icon: null, rating: null, downloads: null, found: true };

  try {
    const res = await fetch(
      `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageName)}&hl=pt-BR`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      }
    );

    if (res.status === 404) {
      result.found = false;
      return result;
    }
    if (!res.ok) return result;

    const html = await res.text();

    // Icon: og:image
    const iconMatch = html.match(
      /<meta\s+property="og:image"\s+content="([^"]+)"/
    );
    if (iconMatch?.[1]) result.icon = iconMatch[1];

    // Rating: itemprop starRating
    const ratingMatch = html.match(
      /itemprop="starRating"[\s\S]*?itemprop="ratingValue"[^>]*content="([^"]+)"/
    );
    if (ratingMatch?.[1]) {
      const r = parseFloat(ratingMatch[1]);
      if (!isNaN(r) && r > 0 && r <= 5) result.rating = Math.round(r * 10) / 10;
    }

    // Fallback rating: aria-label
    if (!result.rating) {
      const ariaRating = html.match(
        /aria-label="[^"]*?(\d[.,]\d)\s*(?:estrelas|stars|out of)/i
      );
      if (ariaRating?.[1]) {
        const r = parseFloat(ariaRating[1].replace(",", "."));
        if (!isNaN(r) && r > 0 && r <= 5) result.rating = Math.round(r * 10) / 10;
      }
    }

    // Fallback rating: JSON-LD / script data
    if (!result.rating) {
      const jsonRating = html.match(/"ratingValue"\s*:\s*"?([\d.]+)"?/);
      if (jsonRating?.[1]) {
        const r = parseFloat(jsonRating[1]);
        if (!isNaN(r) && r > 0 && r <= 5) result.rating = Math.round(r * 10) / 10;
      }
    }

    // Downloads: "numDownloads" in page data (most reliable)
    const numDl = html.match(/"numDownloads"\s*:\s*"([^"]+)"/);
    if (numDl?.[1]) {
      result.downloads = parseDownloads(numDl[1]);
    }

    // Fallback downloads: text near "downloads"/"instalações"
    if (!result.downloads) {
      const dlText = html.match(
        />([\d.,]+[+\s]*(?:mil|mi|[KMBkmb])?[+]?)\s*<\/div>[\s\S]{0,300}?(?:downloads?|instalações)/i
      );
      if (dlText?.[1]) {
        result.downloads = parseDownloads(dlText[1]);
      }
    }

    return result;
  } catch {
    return result;
  }
}

/** @deprecated Use fetchPlayStoreInfo instead */
export async function fetchPlayStoreIcon(
  packageName: string
): Promise<string | null> {
  const info = await fetchPlayStoreInfo(packageName);
  return info.icon;
}
