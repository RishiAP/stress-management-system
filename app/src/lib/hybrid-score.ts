/**
 * Hybrid Stress Scoring
 *
 * Combines:
 *   1. physiologicalScore  — ML model output (0.0–1.0)
 *   2. dassModifier        — DASS-21 stress nudge (0.0–0.20)
 *
 * Formula from requirements.md Section 13:
 *   hybrid_score_normalized = clamp(physiological + dass_modifier, 0, 1)
 *   hybrid_score = hybrid_score_normalized * 100  → range 0–100
 */

export interface HybridResult {
  hybridScore: number; // 0–100
  category: "Low Stress" | "Moderate Stress" | "High Stress";
}

/**
 * Compute the hybrid stress score and category label.
 *
 * @param physiologicalScore - ML model stress probability (0.0–1.0)
 * @param dassModifier - DASS-21 modifier (0.0–0.20, defaults to 0 if no assessment)
 */
export function computeHybridScore(
  physiologicalScore: number,
  dassModifier: number = 0
): HybridResult {
  const normalized = Math.min(
    Math.max(physiologicalScore + dassModifier, 0),
    1
  );
  const hybridScore = Math.round(normalized * 1000) / 10; // 1 decimal place

  let category: HybridResult["category"];
  if (hybridScore < 40) {
    category = "Low Stress";
  } else if (hybridScore < 65) {
    category = "Moderate Stress";
  } else {
    category = "High Stress";
  }

  return { hybridScore, category };
}
