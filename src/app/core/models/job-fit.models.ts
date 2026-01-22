export interface JobDescriptionAnalysis {
  requiredSkills: string[];
  niceToHaveSkills: string[];
  yearsExperience: number;
  keyResponsibilities: string[];
  domains: string[];
}

export interface SkillMatch {
  skill: string;
  found: boolean;
  source: 'profile' | 'projects' | 'missing';
  reason?: string;
  weight: number;
}

export interface FitAnalysisResult {
  score: number;
  requiredSkillsCoverage: number; 
  niceToHaveSkillsCoverage: number;
  requiredMatches: SkillMatch[];
  niceToHaveMatches: SkillMatch[];
  experienceMatch: {
    required: number;
    actual: number;
    score: number;
  };
  projectRelevance: {
    projectName: string;
    relevanceScore: number;
    reason: string;
  }[];
  strengths: string[];
  gaps: string[];
  conclusion: string;
}

export interface SkillScoringRule {
  /** Points awarded if a match is found in the profile. */
  matchBase: number;
  /** Points deducted if the skill is strictly required but missing. */
  missingPenalty: number;
  /** The specific value added to the denominator (Total Possible Score). */
  maxPoints: number;
  /** Extra points if the skill is actively used in a project. */
  inProjectsBonus?: number;
  /** Extra points if the skill appears across multiple projects. */
  expertBonus?: number;
}

export interface ScoringConfig {
  similarityThresholds?: {
    strong: number;
    moderate: number;
  };
  skills: {
    required: SkillScoringRule;
    niceToHave: SkillScoringRule;
    /** Number of projects a skill must appear in to qualify for Expert Bonus. */
    expertProjectThreshold: number;
  };
  experience: {
    maxScore: number;
    pointPerYear: number;
    penaltyPerMissingYear: number;
  };
  responsibilities: {
    /** Bonus points for every key responsibility keyword matched in project descriptions. */
    keywordMatchScore: number;
  };
  conclusions: {
    overrides: {
      metric: 'reqCoverage' | 'score';
      threshold: number;
      message: string;
    }[];
    tiers: {
      threshold: number;
      message: string;
    }[];
    defaultMessage: string;
  };
}


