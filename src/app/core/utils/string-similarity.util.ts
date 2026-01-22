/**
 * Utility for calculating string similarities.
 * Implements Jaro-Winkler distance algorithm suited for short text/token matching.
 */
export class StringSimilarity {
  
  /**
   * Calculates the Jaro-Winkler distance between two strings.
   * @param s1 First string
   * @param s2 Second string
   * @returns Score between 0 (no match) and 1 (perfect match)
   */
  static jaroWinkler(s1: string, s2: string): number {
    let m = 0;

    if (s1.length === 0 || s2.length === 0) return 0;
    if (s1 === s2) return 1;

    const range = (Math.floor(Math.max(s1.length, s2.length) / 2)) - 1;
    const s1Matches = new Array(s1.length).fill(false);
    const s2Matches = new Array(s2.length).fill(false);

    for (let i = 0; i < s1.length; i++) {
      const low = (i >= range) ? i - range : 0;
      const high = (i + range <= s2.length - 1) ? i + range : s2.length - 1;

      for (let j = low; j <= high; j++) {
        if (s2Matches[j] !== true && s2[j] === s1[i]) {
          m++;
          s1Matches[i] = true;
          s2Matches[j] = true;
          break;
        }
      }
    }

    if (m === 0) return 0;

    let k = 0;
    let numTrans = 0;
    for (let i = 0; i < s1.length; i++) {
      if (s1Matches[i] === true) {
        let j = k;
        while (j < s2.length) {
          if (s2Matches[j] === true) {
            k = j + 1;
            break;
          }
          j++;
        }
        if (s1[i] !== s2[j]) numTrans++;
      }
    }

    let weight = (m / s1.length + m / s2.length + (m - (numTrans / 2)) / m) / 3;

    // Winkler modification: boost scores for strings that match at the beginning
    // Standard prefix scale is 0.1
    let l = 0;
    const p = 0.1;
    if (weight > 0.7) {
      while (s1[l] === s2[l] && l < 4) l++;
      weight = weight + l * p * (1 - weight);
    }

    return weight;
  }

  /**
   * Finds the best match for a target string within a set of available strings.
   * @param target The string to search for
   * @param available The set of available strings
   * @param thresholds Configuration for match quality (strong/moderate)
   */
  static findBestMatch(
    target: string, 
    available: Set<string>, 
    thresholds: { strong: number; moderate: number } = { strong: 0.8, moderate: 0.6 }
  ): { found: boolean; matchedTerm?: string; matchQuality?: 'strong' | 'moderate' | 'weak' } {
    const normalizedTarget = target.toLowerCase().trim();

    // 1. Direct Exact Match (O(1))
    if (available.has(normalizedTarget)) {
      return { found: true, matchedTerm: normalizedTarget, matchQuality: 'strong' };
    }

    // 1.5 Word Boundary Inclusion
    // Handles specific cases like "C#" inside ".NET/C#" or "AWS" inside "AWS Lambda"
    for (const skill of available) {
      // Check if skill contains the target (e.g. Target: "C#", Skill: ".NET / C#")
      if (this.containsWord(skill, normalizedTarget)) {
        return { found: true, matchedTerm: skill, matchQuality: 'strong' };
      }
      // Check if target contains the skill (e.g. Target: "AWS Lambda", Skill: "AWS")
      // We consider this a 'moderate' match as it's a partial fulfillment
      if (this.containsWord(normalizedTarget, skill)) {
        return { found: true, matchedTerm: skill, matchQuality: 'moderate' };
      }
    }

    // 2. Fuzzy Match (O(N))
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const skill of available) {
      const score = this.jaroWinkler(normalizedTarget, skill);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = skill;
      }
    }

    // Dynamic Threshold Adjustment for Short Strings
    // Short terms (e.g. "Java", "SQL", "AWS") are prone to false positives with Jaro-Winkler.
    // We increase strictness for them.
    let strongThresh = thresholds.strong;
    let moderateThresh = thresholds.moderate;

    if (normalizedTarget.length <= 4) {
      strongThresh = 0.95;
      moderateThresh = 0.9;
    }

    if (bestScore > strongThresh) {
      return { found: true, matchedTerm: bestMatch!, matchQuality: 'strong' };
    }

    if (bestScore >= moderateThresh) {
      return { found: true, matchedTerm: bestMatch!, matchQuality: 'moderate' };
    }

    return { found: false, matchQuality: 'weak' };
  }

  private static containsWord(text: string, word: string): boolean {
    // Escape special regex characters
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match word boundary: start/end of string OR non-alphanumeric character
    const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
    return regex.test(text);
  }
}
