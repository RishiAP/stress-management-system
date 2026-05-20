/**
 * DASS-21 Scoring Logic
 *
 * The DASS-21 is a 21-item questionnaire measuring Depression, Anxiety, and Stress.
 * Each answer is an integer 0–3 (Never → Almost Always).
 *
 * Only the STRESS subscale (7 items) is used for hybrid scoring.
 * Stress subscale items (zero-indexed): 0, 5, 7, 10, 11, 13, 17
 *
 * Reference: Lovibond & Lovibond (1995)
 */

export interface DassResult {
  stressRaw: number; // 0–42
  dassModifier: number; // 0.0–0.20 — applied to hybrid score
}

// The 21 DASS-21 question texts (zero-indexed, used for rendering the form)
export const DASS21_QUESTIONS = [
  "I found it hard to wind down", // 0  — STRESS
  "I was aware of dryness of my mouth", // 1  — anxiety
  "I couldn't seem to experience any positive feeling at all", // 2  — depression
  "I experienced breathing difficulty", // 3  — anxiety
  "I found it difficult to work up the initiative to do things", // 4  — depression
  "I tended to over-react to situations", // 5  — STRESS
  "I experienced trembling (e.g. in the hands)", // 6  — anxiety
  "I felt that I was using a lot of nervous energy", // 7  — STRESS
  "I was worried about situations in which I might panic and make a fool of myself", // 8  — anxiety
  "I felt that I had nothing to look forward to", // 9  — depression
  "I found myself getting agitated", // 10 — STRESS
  "I found it difficult to relax", // 11 — STRESS
  "I felt down-hearted and blue", // 12 — depression
  "I was intolerant of anything that kept me from getting on with what I was doing", // 13 — STRESS
  "I felt I was close to panic", // 14 — anxiety
  "I was unable to become enthusiastic about anything", // 15 — depression
  "I felt I wasn't worth much as a person", // 16 — depression
  "I felt that I was rather touchy", // 17 — STRESS
  "I was aware of the action of my heart in the absence of physical exertion", // 18 — anxiety
  "I felt scared without any good reason", // 19 — anxiety
  "I felt that life was meaningless", // 20 — depression
] as const;

// Zero-indexed positions of the 7 stress subscale items
export const STRESS_ITEMS = [0, 5, 7, 10, 11, 13, 17] as const;

// Answer labels for the 4-point Likert scale
export const DASS21_ANSWER_LABELS = [
  { value: 0, label: "Never" },
  { value: 1, label: "Sometimes" },
  { value: 2, label: "Often" },
  { value: 3, label: "Almost Always" },
] as const;

/**
 * Compute DASS-21 stress subscale score and the resulting hybrid score modifier.
 *
 * @param answers - Array of 21 integers, each 0–3
 * @returns stressRaw (0–42) and dassModifier (0.0–0.20)
 */
export function computeDassModifier(answers: number[]): DassResult {
  if (answers.length !== 21) {
    throw new Error(`Expected 21 answers, got ${answers.length}`);
  }

  for (const [idx, val] of answers.entries()) {
    if (!Number.isInteger(val) || val < 0 || val > 3) {
      throw new Error(`Answer at index ${idx} must be 0–3, got ${val}`);
    }
  }

  // Sum only the 7 stress subscale items
  const stressRaw = STRESS_ITEMS.reduce<number>((sum, idx) => sum + answers[idx], 0);

  // Normalize to 0.0–0.20 modifier range (max 20% influence on hybrid score)
  const dassModifier = (stressRaw / 42) * 0.2;

  return { stressRaw, dassModifier };
}
