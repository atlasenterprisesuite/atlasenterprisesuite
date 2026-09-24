import { socialPlatforms, type PlatformId } from './platforms';

export type SocialPostMetric = {
  id: string;
  platform: PlatformId;
  publishedAt: string;
  format: string;
  hook: string;
  reach: number;
  engagements: number;
  comments: number;
  shares: number;
};

export type WeeklySocialAnalysis = {
  postCount: number;
  bestFormat: string;
  worstFormat: string;
  bestHook: string;
  bestPostingWindow: string;
  highestPotentialChange: string;
  experiments: string[];
};

export type MetricParseResult =
  | { ok: true; posts: SocialPostMetric[] }
  | { ok: false; errors: string[] };

const platformIds = new Set<string>(socialPlatforms.map((platform) => platform.id));

function engagementRate(post: SocialPostMetric): number {
  return post.reach > 0 ? post.engagements / post.reach : 0;
}

function postingWindow(iso: string): string {
  const hour = new Date(iso).getUTCHours();
  if (hour < 6) return '00:00–05:59 UTC';
  if (hour < 12) return '06:00–11:59 UTC';
  if (hour < 18) return '12:00–17:59 UTC';
  return '18:00–23:59 UTC';
}

function mean(values: readonly number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function groupedMean(posts: readonly SocialPostMetric[], key: (post: SocialPostMetric) => string): Array<[string, number]> {
  const groups = new Map<string, number[]>();
  for (const post of posts) {
    const groupKey = key(post);
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), engagementRate(post)]);
  }
  return [...groups.entries()].map(([groupKey, rates]) => [groupKey, mean(rates)]);
}

export function parseSocialMetrics(input: string): MetricParseResult {
  const rows = input.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
  if (rows.length === 0) return { ok: true, posts: [] };

  const posts: SocialPostMetric[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const columns = row.split(',').map((value) => value.trim());
    const rowNumber = index + 1;
    if (columns.length !== 8) {
      errors.push(`Row ${rowNumber}: expected 8 comma-separated values.`);
      return;
    }

    const [platformRaw, publishedAt, format, hook, reachRaw, engagementsRaw, commentsRaw, sharesRaw] = columns;
    if (!platformIds.has(platformRaw)) errors.push(`Row ${rowNumber}: unsupported platform "${platformRaw}".`);
    if (!Number.isFinite(Date.parse(publishedAt))) errors.push(`Row ${rowNumber}: publishedAt must be a valid date.`);
    if (!format) errors.push(`Row ${rowNumber}: format is required.`);
    if (!hook) errors.push(`Row ${rowNumber}: hook is required.`);

    const numericRawValues = [reachRaw, engagementsRaw, commentsRaw, sharesRaw];
    const numericValues = numericRawValues.map(Number);
    const numericLabels = ['reach', 'engagements', 'comments', 'shares'];
    numericValues.forEach((value, numericIndex) => {
      if (numericRawValues[numericIndex] === '' || !Number.isFinite(value) || value < 0) {
        errors.push(`Row ${rowNumber}: ${numericLabels[numericIndex]} must be a finite non-negative number.`);
      }
    });

    if (errors.some((error) => error.startsWith(`Row ${rowNumber}:`))) return;

    posts.push({
      id: `import-${rowNumber}`,
      platform: platformRaw as PlatformId,
      publishedAt,
      format,
      hook,
      reach: numericValues[0],
      engagements: numericValues[1],
      comments: numericValues[2],
      shares: numericValues[3]
    });
  });

  return errors.length ? { ok: false, errors } : { ok: true, posts };
}

export function analyzeWeeklySocialMetrics(posts: readonly SocialPostMetric[]): WeeklySocialAnalysis | null {
  if (posts.length === 0) return null;

  const formatScores = groupedMean(posts, (post) => post.format)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const windowScores = groupedMean(posts, (post) => postingWindow(post.publishedAt))
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const rankedPosts = [...posts].sort((left, right) =>
    engagementRate(right) - engagementRate(left) || right.reach - left.reach || left.id.localeCompare(right.id)
  );

  const bestFormat = formatScores[0][0];
  const worstFormat = formatScores[formatScores.length - 1][0];
  const bestHook = rankedPosts[0].hook;
  const bestPostingWindow = windowScores[0][0];

  return {
    postCount: posts.length,
    bestFormat,
    worstFormat,
    bestHook,
    bestPostingWindow,
    highestPotentialChange: `Prioritize ${bestFormat} posts in ${bestPostingWindow} and test hooks modeled on "${bestHook}".`,
    experiments: [
      `Publish one additional ${bestFormat} post during ${bestPostingWindow}.`,
      `Test a new opening modeled on "${bestHook}" while keeping the format constant.`,
      `Retest ${worstFormat} with the strongest hook and posting window before reducing its use.`
    ]
  };
}
