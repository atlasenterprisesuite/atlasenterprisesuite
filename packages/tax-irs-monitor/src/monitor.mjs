import { createHash } from "node:crypto";

export const MATERIAL_TERMS = [
  "effective date", "tax year", "filing season", "deadline", "due date",
  "form ", "schedule ", "instructions", "e-file", "electronic filing",
  "credit", "deduction", "tax rate", "threshold", "revenue procedure",
  "revenue ruling", "notice ", "final regulations", "penalty relief",
  "disaster relief", "business rules", "schema"
];

const WORKFLOW_RULES = [
  [/form|schedule|instructions|publication/i, "forms-and-instructions"],
  [/deadline|due date|extension|disaster relief/i, "filing-and-payment-deadlines"],
  [/e-file|electronic filing|schema|business rules|IRIS|FIRE/i, "e-file"],
  [/credit|deduction|phaseout|eligib/i, "credits-and-deductions"],
  [/rate|bracket|threshold|inflation/i, "rates-and-thresholds"],
  [/refund|payment|direct deposit/i, "payments-and-refunds"],
  [/retirement|401\(k\)|IRA|RMD/i, "retirement"],
  [/guidance|revenue procedure|revenue ruling|notice|regulation/i, "guidance"]
];

export function normalizeOfficialUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !/(^|\.)irs\.gov$/i.test(url.hostname)) {
    throw new Error(`Non-official IRS source rejected: ${value}`);
  }
  url.hash = "";
  return url.toString();
}

export function normalizeContent(content) {
  return content
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function fingerprint(content) {
  return createHash("sha256").update(normalizeContent(content)).digest("hex");
}

export function extractAddedText(previousText = "", currentText = "") {
  const prior = new Set(previousText.split(/(?<=[.!?])\s+|\n+/).map((part) => part.trim()).filter(Boolean));
  return currentText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 8 && !prior.has(part))
    .join(" ")
    .slice(0, 8000);
}

function inferEffectiveDate(text) {
  const patterns = [
    /effective (?:for|on|beginning|after)?\s*([^.;]{4,80})/i,
    /(?:tax years?|calendar years?)\s+((?:20)\d{2}(?:\s*(?:through|to|-)\s*(?:20)\d{2})?)/i,
    /(?:deadline|due date)\s+(?:is|of|on)?\s*([A-Z][a-z]+\s+\d{1,2},\s+20\d{2})/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return "requires-human-review";
}

export function classifyMaterialChange(previous, current) {
  if (!previous) return { material: false, reason: "baseline-created", workflows: [] };
  if (previous.digest === current.digest) return { material: false, reason: "unchanged", workflows: [] };

  const addedText = extractAddedText(previous.text, current.text);
  if (!addedText) return { material: false, reason: "non-semantic-change", workflows: [] };
  const haystack = `${current.title || ""} ${addedText}`;
  const terms = MATERIAL_TERMS.filter((term) => haystack.toLowerCase().includes(term.toLowerCase()));
  const workflows = [...new Set(WORKFLOW_RULES.filter(([pattern]) => pattern.test(haystack)).map(([, name]) => name))];
  return {
    material: terms.length > 0,
    reason: terms.length > 0 ? "material-terms-detected" : "content-changed-without-material-signal",
    workflows,
    matchedTerms: terms,
    addedText
  };
}

export async function inspectSources({ sources, previousState = {}, fetchImpl = fetch, now = new Date() }) {
  const checkedAt = now.toISOString();
  const nextState = { version: 1, checkedAt, sources: {} };
  const changes = [];

  for (const source of sources) {
    const url = normalizeOfficialUrl(source.url);
    const response = await fetchImpl(url, {
      headers: { "user-agent": "ATLAS-Tax-IRS-Monitor/1.0 (+https://atlasenterprisesuite.com)" }
    });
    if (!response.ok) throw new Error(`${source.id}: IRS returned HTTP ${response.status}`);

    const raw = await response.text();
    const text = normalizeContent(raw);
    const current = {
      id: source.id,
      title: source.title,
      url,
      category: source.category,
      digest: fingerprint(raw),
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      checkedAt,
      text: text.slice(0, 12000)
    };
    const prior = previousState.sources?.[source.id];
    const classification = classifyMaterialChange(prior, current);
    nextState.sources[source.id] = current;

    if (classification.material) {
      changes.push({
        sourceId: source.id,
        title: source.title,
        url,
        category: source.category,
        detectedAt: checkedAt,
        sourceStatus: source.status || "final-or-operational",
        effectiveDate: inferEffectiveDate(classification.addedText),
        whatChanged: classification.addedText.slice(0, 1200),
        workflows: classification.workflows,
        matchedTerms: classification.matchedTerms,
        action: "Review the official IRS revision, determine its effective tax year and affected form revision, then approve versioned ATLAS Tax rule changes and regression tests."
      });
    }
  }

  return { nextState, changes };
}

export function renderAlert(changes) {
  if (!changes.length) return "No new material IRS changes detected.";
  const lines = ["# ATLAS Tax — material IRS changes", ""];
  for (const change of changes) {
    lines.push(`## ${change.title}`);
    lines.push(`- Official source: ${change.url}`);
    lines.push(`- Detected: ${change.detectedAt}`);
    lines.push(`- Source status: ${change.sourceStatus}`);
    lines.push(`- Effective date: ${change.effectiveDate}`);
    lines.push(`- What changed: ${change.whatChanged}`);
    lines.push(`- Workflows: ${change.workflows.join(", ") || "human classification required"}`);
    lines.push(`- Review action: ${change.action}`, "");
  }
  return lines.join("\n");
}
