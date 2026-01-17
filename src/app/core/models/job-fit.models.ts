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
  score: number; // 0-100
  requiredSkillsCoverage: number; // percentage
  niceToHaveSkillsCoverage: number; // percentage
  requiredMatches: SkillMatch[];
  niceToHaveMatches: SkillMatch[];
  experienceMatch: {
    required: number;
    actual: number; // This needs to be calculated/estimated from portfolio data
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
