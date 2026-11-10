// Turns what you type ("web design, Shopify developer") into clean keyword lists for a search profile.
// No framework imports on purpose, so it can be tested on its own (tests/keywords.test.mjs).

const MAX_WORDS = 30;
const MAX_LENGTH = 60;

/** Splits on commas and new lines; trims, lower-cases, removes empties and duplicates. */
export function splitWords(text: string): string[] {
  const seen = new Set<string>();
  for (const part of text.split(/[,\n]/)) {
    const word = part.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, MAX_LENGTH);
    if (word) seen.add(word);
    if (seen.size >= MAX_WORDS) break;
  }
  return [...seen];
}

export interface NewProfileInput {
  role: string;
  otherTitles: string;
  skills: string;
  industries: string;
  excludes: string;
  jobTypes: string[];
  alertScore: number;
  saveScore: number;
}

/** Builds the row saved in search_profiles. The role is the name and the first (most important) title keyword. */
export function buildProfile(input: NewProfileInput) {
  const role = input.role.trim().replace(/\s+/g, ' ').slice(0, 80);
  const titles = splitWords([role, input.otherTitles].join(','));
  const skills = splitWords(input.skills);
  return {
    name: role.charAt(0).toUpperCase() + role.slice(1),
    title_keywords: titles,
    // With no skills typed, the role itself is what the description should mention.
    skill_keywords: skills.length ? skills : titles.slice(0, 1),
    industry_keywords: splitWords(input.industries),
    exclude_keywords: splitWords(input.excludes),
    job_types: input.jobTypes,
    alert_score: clamp(input.alertScore),
    save_score: clamp(input.saveScore),
    is_active: true,
  };
}

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(Number.isFinite(n) ? n : 60)));
