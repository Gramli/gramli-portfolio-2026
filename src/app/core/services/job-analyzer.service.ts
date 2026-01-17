import { Injectable } from '@angular/core';
import { AiService } from './ai.service';
import { PortfolioService } from './portfolio.service';
import { FitAnalysisResult, SkillMatch } from '../models/job-fit.models';
import { firstValueFrom } from 'rxjs';

// --- Configuration ---
// Easily extendable weights and heuristics
export const SCORING_RULES = {
  skills: {
    required: {
      matchBase: 10,
      inProjectsBonus: 5,
      expertBonus: 5,    // Bonus for appearing in >= expertProjectThreshold
      missingPenalty: 5, // Reduced penalty slightly
      maxPoints: 10      // Set to equal matchBase. Bonuses allow score > 100% to offset gaps.
    },
    niceToHave: {
      matchBase: 5,
      missingPenalty: 0, 
      maxPoints: 5
    },
    expertProjectThreshold: 3
  },
  experience: {
    maxScore: 15,
    pointPerYear: 1,
    penaltyPerMissingYear: 2
  },
  responsibilities: {
    keywordMatchScore: 5 // Pure bonus points (does not contribute to max score denominator)
  },
  thresholds: {
    exceptional: 95, 
    strong: 85,
    moderate: 65,
    partial: 40
  }
};

@Injectable({ providedIn: 'root' })
export class JobAnalyzerService {
  private readonly rules = SCORING_RULES;

  constructor(
    private aiService: AiService,
    private portfolioService: PortfolioService
  ) {}

  async analyze(jobDescription: string): Promise<FitAnalysisResult> {
    // 1. Data Gathering
    // Parallel fetch for parsing and Portfolio data
    const [jdData, context] = await Promise.all([
      this.aiService.parseJobDescription(jobDescription),
      this.buildPortfolioContext()
    ]);

    // 2. Evaluation
    const requiredEval = this.evaluateSkills(
      jdData.requiredSkills || [], 
      context.allSkills, 
      context.projects, 
      'required'
    );

    const niceToHaveEval = this.evaluateSkills(
      jdData.niceToHaveSkills || [], 
      context.allSkills, 
      context.projects, 
      'nice'
    );

    const experienceEval = this.evaluateExperience(
      jdData.yearsExperience || 0, 
      context.userYears
    );

    const projectEval = this.evaluateProjectRelevance(
      jdData.keyResponsibilities || [], 
      context.projects
    );

    // 3. Score Aggregation
    const totalCurrentScore = 
      requiredEval.totalScore + 
      niceToHaveEval.totalScore + 
      experienceEval.score + 
      projectEval.totalScore;

    const totalMaxScore = 
      requiredEval.maxPossible + 
      niceToHaveEval.maxPossible + 
      experienceEval.maxScore + 
      projectEval.maxPossible;
      
    // Prevent division by zero and calculate percentage
    const finalMax = Math.max(totalMaxScore, 1);
    let finalPercent = Math.round((totalCurrentScore / finalMax) * 100);
    
    // Clamp 0-100
    finalPercent = Math.max(0, Math.min(100, finalPercent));

    // Pre-calculate coverage for logic usage
    const reqCoverage = this.calculateCoverage(requiredEval.matches);
    const niceCoverage = this.calculateCoverage(niceToHaveEval.matches);

    // 4. Result Construction
    return {
      score: finalPercent,
      requiredSkillsCoverage: reqCoverage,
      niceToHaveSkillsCoverage: niceCoverage,
      
      requiredMatches: requiredEval.matches,
      niceToHaveMatches: niceToHaveEval.matches,
      
      experienceMatch: { 
        required: jdData.yearsExperience || 0, 
        actual: context.userYears, 
        score: experienceEval.score 
      },
      
      projectRelevance: projectEval.matches,
      
      strengths: this.extractStrengths(requiredEval.matches),
      gaps: requiredEval.matches.filter(m => !m.found).map(m => m.skill),
      conclusion: this.generateConclusion(finalPercent, reqCoverage)
    };
  }

  // --- Core Evaluation Logic ---

  private async buildPortfolioContext() {
    const profile = await firstValueFrom(this.portfolioService.getProfile());
    const projects = await firstValueFrom(this.portfolioService.getProjects());
    const skillsCats = await firstValueFrom(this.portfolioService.getSkills());

    // Flatten all skills for quick lookup
    const allSkills = new Set<string>();
    skillsCats.forEach(c => c.skills.forEach(s => allSkills.add(s.toLowerCase())));
    
    // Project Searchability
    const searchReadyProjects = projects.map(p => ({
      title: p.title,
      description: p.description.toLowerCase(),
      tech: p.technologies.map(t => t.toLowerCase())
    }));

    // Add project techs to main skills set
    searchReadyProjects.forEach(p => p.tech.forEach(t => allSkills.add(t)));

    // Extract Years of Experience
    let userYears = 0;
    const yearStat = profile.stats?.find(s => 
      s.label.toLowerCase().includes('experience') || s.label.toLowerCase().includes('years')
    );
    
    if (yearStat) {
       const match = yearStat.value.match(/\d+/);
       userYears = match ? parseInt(match[0], 10) : 0;
    } else {
       const bioMatch = profile.shortBio.match(/(\d+)\+?\s*years/i);
       userYears = bioMatch ? parseInt(bioMatch[1], 10) : 5; 
    }

    return { allSkills, projects: searchReadyProjects, userYears };
  }

  private evaluateSkills(
    jdSkills: string[], 
    portfolioSkills: Set<string>, 
    projects: { tech: string[] }[], 
    type: 'required' | 'nice'
  ) {
    let totalScore = 0;
    let maxPossible = 0;
    const matches: SkillMatch[] = [];
    
    const isRequired = type === 'required';
    const rules = isRequired ? this.rules.skills.required : this.rules.skills.niceToHave;
    const reqRules = this.rules.skills.required; 
    
    for (const skill of jdSkills) {
      const { found, matchQuality } = this.findSkillMatch(skill, portfolioSkills);
      let skillScore = 0;
      let source: 'profile' | 'projects' | 'missing' = 'missing';

      if (found) {
        // Adjust score based on match quality
        const qualityMultiplier = matchQuality === 'strong' ? 1.0 : 0.7; // Moderate = 70% points
        skillScore += (rules.matchBase * qualityMultiplier);
        source = 'profile';
      } else {
        skillScore -= rules.missingPenalty;
      }

      if (isRequired) {
         const projectCount = projects.filter(p => this.findSkillMatch(skill, new Set(p.tech)).found).length;
         
         if (projectCount > 0) {
             skillScore += reqRules.inProjectsBonus;
             source = 'projects';
         }
         
         if (projectCount >= this.rules.skills.expertProjectThreshold) {
             skillScore += reqRules.expertBonus;
         }
      }

      totalScore += skillScore;
      maxPossible += rules.maxPoints;

      matches.push({
        skill,
        found,
        source: found ? source : 'missing',
        weight: skillScore
      });
    }

    return { totalScore, maxPossible, matches };
  }

  private evaluateExperience(required: number, actual: number) {
    const r = this.rules.experience;
    const diff = actual - required;
    
    // Start with points per year up to max
    let score = Math.min(actual * r.pointPerYear, r.maxScore);

    // Apply penalty if under-qualified
    if (diff < 0) {
      score -= Math.abs(diff) * r.penaltyPerMissingYear;
    }

    return { score, maxScore: r.maxScore };
  }

  private evaluateProjectRelevance(responsibilities: string[], projects: { title: string, description: string }[]) {
     let totalScore = 0;
     let maxPossible = 0;
     const matches: { projectName: string; relevanceScore: number; reason: string; }[] = [];

     const stopWords = new Set(['manage', 'develop', 'create', 'ensure', 'system', 'software', 'working', 'using', 'application', 'provide', 'with', 'the', 'and', 'for', 'experience', 'knowledge']);

     for (const resp of responsibilities) {
        // maxPossible += this.rules.responsibilities.keywordMatchScore; // Disabled: Responsibilities are now pure bonus

        const keywords = resp.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 3 && !stopWords.has(w));

        if (keywords.length === 0) continue;

        for (const proj of projects) {
            const matchCount = keywords.filter(k => 
                proj.description.includes(k) || proj.title.toLowerCase().includes(k)
            ).length;

            if (matchCount > 0) {
                const score = this.rules.responsibilities.keywordMatchScore;
                totalScore += score;
                matches.push({
                    projectName: proj.title,
                    relevanceScore: score,
                    reason: `Matches keywords: ${keywords.slice(0, 3).join(', ')}`
                });
                break;
            }
        }
     }

     return { totalScore, maxPossible, matches };
  }

  // --- Utilities ---

  private findSkillMatch(target: string, available: Set<string>): { found: boolean; matchedTerm?: string; matchQuality?: 'strong' | 'moderate' | 'weak' } {
    const normalizedTarget = target.toLowerCase().trim();
    
    // 1. Direct Match (Strong)
    if (available.has(normalizedTarget)) {
      return { found: true, matchedTerm: normalizedTarget, matchQuality: 'strong' };
    }

    // 2. Levenshtein / Similarity Check
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const skill of available) {
        const score = this.calculateSimilarity(normalizedTarget, skill);
        if (score > bestScore) {
            bestScore = score;
            bestMatch = skill;
        }
    }

    if (bestScore > 0.8) {
        return { found: true, matchedTerm: bestMatch!, matchQuality: 'strong' };
    } 
    
    if (bestScore >= 0.6) {
        // Moderate match (e.g., .NET vs .NET Core)
        return { found: true, matchedTerm: bestMatch!, matchQuality: 'moderate' };
    }

    return { found: false, matchQuality: 'weak' };
  }

  // Jaro-Winkler distance for short text similarity (better for skill names than simple Levenshtein)
  private calculateSimilarity(s1: string, s2: string): number {
    let m = 0;
    
    // Exit early if no match possible
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

    // If no matches, return 0
    if (m === 0) return 0;

    // Count transpositions
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
    let l = 0;
    const p = 0.1;
    if (weight > 0.7) {
        while (s1[l] === s2[l] && l < 4) l++;
        weight = weight + l * p * (1 - weight);
    }
    
    return weight;
  }

  private calculateCoverage(matches: SkillMatch[]): number {
    if (!matches.length) return 0;
    const found = matches.filter(m => m.found).length;
    return Math.round((found / matches.length) * 100);
  }

  private extractStrengths(matches: SkillMatch[]): string[] {
    return matches
        .filter(m => m.found)
        .map(m => {
            const isExpert = m.weight >= 15;
            return `${m.skill} ${isExpert ? '(Expert)' : ''}`;
        });
  }

  private generateConclusion(score: number, reqCoverage: number): string {
    const t = this.rules.thresholds;
    
    // Priority 1: Exceptional overall score
    if (score >= t.exceptional) 
      return "Exceptional fit. The candidate's profile strongly aligns with the core requirements.";

    // Priority 2: High Required Skills Coverage (Overrides moderate overall score)
    if (reqCoverage >= 85)
      return "High Potential Match. Candidate possesses the majority of required technical skills, significantly offsetting other gaps.";

    // Priority 3: Strong overall score
    if (score >= t.strong) 
      return "Strong technical fit with identifiable and learnable gaps.";
      
    // Priority 4: Decent Required Skills Coverage
    if (reqCoverage >= 70)
        return "Qualified Match. Good alignment with core technical stack. Gaps may be seniority-related or domain-specific.";

    // Priority 5: Moderate overall score
    if (score >= t.moderate) 
      return "Moderate fit. Some foundational skills are present, but specific gaps exist.";
      
    // Priority 6: Partial Match
    if (score >= t.partial)
        return "Partial Match. Candidate shares significant stack overlap but may require upskilling in key areas.";

    return "Low match probability based on current portfolio data.";
  }
}
