# Job Match Scoring Configuration Guide

This guide explains how to adjust the **Job Match Algorithm** used in the portfolio application. These settings allow you to control how strict or lenient the system is when comparing a candidate's profile to a job description.

The configuration file is located at: `public/data/job-scoring.config.json`.

---

## 1. Matching Logic & Thresholds (`similarityThresholds`)

This section controls the "Fuzzy Matching" algorithm (Jaro-Winkler) used to determine if a skill in the Job Description matches a skill in the Portfolio (e.g., matching "ReactJS" to "React").

*   **Strong Match (`strong`)**:
    *   Scores above this value are considered definite matches (100% credit).
    *   *Default:* `0.85`.
*   **Moderate Match (`moderate`)**:
    *   Scores above this value are considered partial matches (70% credit).
    *   *Default:* `0.70`.

**Automatic Strictness for Short Words:**
The system automatically enforces stricter rules for short keywords (≤ 4 chars) like "Java", "SQL", or "AWS" to prevent false positives.
*   *Short Word Strong Threshold:* 0.95 (Requires near-perfect match).
*   *Short Word Moderate Threshold:* 0.90.
*   *Why?* To prevent "Java" (4 chars) from matching "Naval" or "Data" by accident.

---

## 2. Skill Scoring Rules (`skills`)

This section controls how the system evaluates technical skills found in the job description. There are two categories: **Required** (Must-haves) and **Nice-to-Have** (Bonus skills).

### Key Terms

*   **Match Base (`matchBase`)**:
    *   *What it is:* The points awarded just for having the skill listed in the profile.
    *   *Business Impact:* Increase this to reward breadth of knowledge (knowing many things).
    *   *Example:* If set to `10`, knowing "Angular" gives 10 points immediately.

*   **Missing Penalty (`missingPenalty`)**:
    *   *What it is:* Points **deducted** from the final score if a required skill is completely missing.
    *   *Business Impact:* Increase this to strictly punish gaps. Set high (e.g., `25`) if you want the score to tank significantly when a key skill is missing.
    *   *Note:* Usually set to `0` for "Nice-to-Have" skills.

*   **Project Bonus (`inProjectsBonus`)**:
    *   *What it is:* Extra points awarded if the skill is used in at least one specific project in the portfolio.
    *   *Business Impact:* Rewards **practical experience** over just listing keywords.

*   **Expert Bonus (`expertBonus`)**:
    *   *What it is:* Additional bonus points if the skill appears in many projects (defined by `expertProjectThreshold`).
    *   *Business Impact:* Rewards **deep expertise** and specialization.

*   **Max Points (`maxPoints`)**:
    *   *What it is:* The "weight" of this skill in the total calculation.
    *   *Business Impact:* Think of this as the slice of the pie. If you want skills to matter more than experience, strictly manage this number relative to experience points.
    *   *Strategy:* If `matchBase` + `bonuses` is higher than `maxPoints`, a candidate can score "over 100%" on a skill. This allows a superstar technical fit to compensate for missing years of experience.

---

## 3. Experience Rules (`experience`)

This section controls how the system evaluates "Years of Experience".

*   **Max Score (`maxScore`)**:
    *   The maximum number of points experience can contribute to the final score.
    *   *Example:* Set to `15` to ensure experience is important but doesn't overshadow technical skills.

*   **Points Per Year (`pointPerYear`)**:
    *   How many points are awarded for every valid year of experience.

*   **Penalty Per Missing Year (`penaltyPerMissingYear`)**:
    *   How strictly to punish a candidate for being junior.
    *   *Example:* If a job needs 5 years and the candidate has 3:
        *   Difference = 2 years.
        *   If penalty is `5`, they lose 10 points total.

---

## 4. Conclusions & Feedback (`conclusions`)

This section controls the automated text feedback given at the bottom of the report.

### Overrides (`overrides`)
These are special rules that skip the math and look at specific data points.
*   **Example Rule:** "If `reqCoverage` (Required Skill Coverage) is over 85%, ignore the low experience score and call it a 'High Potential Match'."
*   Use this to catch "False Negatives" (good candidates who score low due to bad math).

### Tiers (`tiers`)
If no overrides apply, the system checks the final percentage score against these levels.
*   **Threshold:** The minimum score needed to see this message.
*   **Message:** The text displayed to the user.
*   *Order:* The system checks from top (Highest score) to bottom.

---

## Example Configuration Scenario

**Scenario:** *We want to hire a Senior Developer. We care deeply about 3 specific skills, and we don't care if they have 100 other small skills.*

**Recommended Settings:**
1.  **Required Skills**:
    *   Increase `missingPenalty` to `15` (Huge penalty for missing a core skill).
    *   Increase `expertBonus` to `10` (Big reward for deep usage).
2.  **Nice-to-Have Skills**:
    *   Decrease `matchBase` to `2` (Optional skills matter very little).
3.  **Experience**:
    *   Increase `penaltyPerMissingYear` to `10` (Strictly filter out juniors).
