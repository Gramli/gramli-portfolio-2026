import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { AiService } from './ai.service';
import { PortfolioService } from './portfolio.service';
import { StringSimilarity } from '../utils/string-similarity.util';
import { FitAnalysisResult, ScoringConfig, SkillMatch, SkillScoringRule } from '../models/job-fit.models';

interface PortfolioContext {
  allSkills: Set<string>;
  projects: SearchableProject[];
  userYears: number;
}

interface SearchableProject {
  title: string;
  description: string;
  tech: string[];
}

interface EvaluationResult {
  totalScore: number;
  maxPossible: number;
  matches: SkillMatch[];
}

@Injectable({ providedIn: 'root' })
export class JobAnalyzerService {
  private rules!: ScoringConfig;

  constructor(
    private http: HttpClient,
    private aiService: AiService,
    private portfolioService: PortfolioService
  ) {}

  /**
   * Main entry point for analyzing a job description against the user's portfolio.
   * @param jobDescription Raw text of the JD
   */
  async analyze(jobDescription: string): Promise<FitAnalysisResult> {
    await this.ensureConfigLoaded();

    // 1. Parallel Data Fetching
    const [jdData, context] = await Promise.all([
      this.aiService.parseJobDescription(jobDescription),
      this.buildPortfolioContext()
    ]);

    // 2. Skill Evaluation
    const requiredEval = this.evaluateSkills(
      jdData.requiredSkills || [],
      context,
      this.rules.skills.required,
      true // Enable deep project analysis for required skills
    );

    const niceToHaveEval = this.evaluateSkills(
      jdData.niceToHaveSkills || [],
      context,
      this.rules.skills.niceToHave,
      false
    );

    // 3. Experience & Responsibility Evaluation
    const experienceEval = this.evaluateExperience(
      jdData.yearsExperience || 0,
      context.userYears
    );

    const projectEval = this.evaluateProjectRelevance(
      jdData.keyResponsibilities || [],
      context.projects
    );

    // 4. Final Score Calculation
    const { finalPercent, reqCoverage, niceCoverage } = this.calculateAggregateScores(
      requiredEval,
      niceToHaveEval,
      experienceEval,
      projectEval
    );

    // 5. Construct Final Report
    return {
      score: finalPercent,
      requiredSkillsCoverage: reqCoverage,
      niceToHaveSkillsCoverage: niceCoverage,
      
      requiredMatches: requiredEval.matches,
      niceToHaveMatches: niceToHaveEval.matches,
      
      experienceMatch: {
        required: jdData.yearsExperience || 0,
        actual: context.userYears,
        score: experienceEval.totalScore
      },
      
      projectRelevance: projectEval.matches,
      
      strengths: this.extractStrengths(requiredEval.matches),
      gaps: requiredEval.matches.filter(m => !m.found).map(m => m.skill),
      conclusion: this.generateConclusion(finalPercent, reqCoverage)
    };
  }

  private async ensureConfigLoaded() {
    if (!this.rules) {
      this.rules = await firstValueFrom(this.http.get<ScoringConfig>('data/job-scoring.config.json'));
    }
  }

  // --- 1. Data Context Builder ---

  private async buildPortfolioContext(): Promise<PortfolioContext> {
    const profile = await firstValueFrom(this.portfolioService.getProfile());
    const projects = await firstValueFrom(this.portfolioService.getProjects());
    const skillCategories = await firstValueFrom(this.portfolioService.getSkills());

    // Flatten skills for O(1) lookups
    const allSkills = new Set<string>();
    skillCategories.forEach(cat => 
      cat.skills.forEach(skill => allSkills.add(skill.name.toLowerCase()))
    );

    // Pre-process projects for text search
    const searchableProjects: SearchableProject[] = projects.map(p => ({
      title: p.title,
      description: p.description.toLowerCase(),
      tech: p.technologies.map(t => t.toLowerCase())
    }));

    // Ensure all project technologies are also considered "known skills"
    searchableProjects.forEach(p => p.tech.forEach(t => allSkills.add(t)));

    // Parse Experience Years safely
    let userYears = 0;
    const expStat = profile.stats?.find(s => 
      /experience|years/i.test(s.label)
    );

    if (expStat && /\d+/.test(expStat.value)) {
      userYears = parseInt(expStat.value.match(/\d+/)![0], 10);
    } else {
      // Fallback to bio scraping or default
      const bioMatch = profile.shortBio.match(/(\d+)\+?\s*years/i);
      userYears = bioMatch ? parseInt(bioMatch[1], 10) : 5;
    }

    return { allSkills, projects: searchableProjects, userYears };
  }

  // --- 2. Core Evaluators ---

  private evaluateSkills(
    targetSkills: string[],
    context: PortfolioContext,
    rule: SkillScoringRule,
    checkProjectUsage: boolean
  ): EvaluationResult {
    let totalScore = 0;
    let maxPossible = 0;
    const matches: SkillMatch[] = [];

    for (const skill of targetSkills) {
      const matchResult = StringSimilarity.findBestMatch(
        skill, 
        context.allSkills,
        this.rules.similarityThresholds
      );
      let skillScore = 0;
      let source: SkillMatch['source'] = 'missing';

      // Base Score Logic
      if (matchResult.found) {
        // Apply multiplier (1.0 for Strong, 0.7 for Moderate)
        const qualityMultiplier = matchResult.matchQuality === 'strong' ? 1.0 : 0.7;
        skillScore += (rule.matchBase * qualityMultiplier);
        source = 'profile';
      } else {
        skillScore -= rule.missingPenalty;
      }

      // Advanced Project Analysis (for Required Skills)
      if (checkProjectUsage && rule.inProjectsBonus !== undefined) {
        // Check if skill appears in specific projects
        const projectsWithSkill = context.projects.filter(p => 
          StringSimilarity.findBestMatch(
            skill, 
            new Set(p.tech),
            this.rules.similarityThresholds
          ).found
        ).length;

        if (projectsWithSkill > 0) {
          skillScore += rule.inProjectsBonus;
          source = 'projects';
        }

        if (rule.expertBonus && projectsWithSkill >= this.rules.skills.expertProjectThreshold) {
          skillScore += rule.expertBonus;
        }
      }

      totalScore += skillScore;
      maxPossible += rule.maxPoints;

      matches.push({
        skill,
        found: matchResult.found,
        source: matchResult.found ? source : 'missing',
        weight: skillScore
      });
    }

    return { totalScore, maxPossible, matches };
  }

  private evaluateExperience(required: number, actual: number): { totalScore: number; maxScore: number } {
    const rules = this.rules.experience;
    const diff = actual - required;

    // Linear points up to cap
    let score = Math.min(actual * rules.pointPerYear, rules.maxScore);

    // Apply strict penalty for experience gap
    if (diff < 0) {
      score -= Math.abs(diff) * rules.penaltyPerMissingYear;
    }

    return { totalScore: score, maxScore: rules.maxScore };
  }

  private evaluateProjectRelevance(
    responsibilities: string[],
    projects: SearchableProject[]
  ) {
    let totalScore = 0;
    // Note regarding Max Score: Responsibilities are treated as pure bonuses.
    // They add to the Numerator but do not increase the Denominator (Max Possible),
    // effectively allowing them to offset penalties from missing skills.
    const maxPossible = 0; 
    
    const matches: { projectName: string; relevanceScore: number; reason: string }[] = [];
    
    // Stop words to ignore during keyword extraction
    const STOP_WORDS = new Set([
      'manage', 'develop', 'create', 'ensure', 'system', 'software', 
      'working', 'using', 'application', 'provide', 'with', 'the', 
      'and', 'for', 'experience', 'knowledge', 'team', 'support'
    ]);

    for (const resp of responsibilities) {
      // Extract significant keywords (> 3 chars, not stop words)
      const keywords = resp.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3 && !STOP_WORDS.has(w));

      if (keywords.length === 0) continue;

      // Find first project that matches any valuable keyword
      for (const proj of projects) {
        const matchedKeywords = keywords.filter(k => 
          proj.description.includes(k) || proj.title.toLowerCase().includes(k)
        );

        if (matchedKeywords.length > 0) {
          const score = this.rules.responsibilities.keywordMatchScore;
          totalScore += score;
          
          matches.push({
            projectName: proj.title,
            relevanceScore: score,
            reason: `Matches keywords: ${matchedKeywords.slice(0, 3).join(', ')}`
          });
          
          // Only count one project match per responsibility line to avoid double dipping
          break; 
        }
      }
    }

    return { totalScore, maxPossible, matches };
  }

  // --- 3. Utilities & Aggregation ---

  private calculateAggregateScores(
    req: EvaluationResult,
    nice: EvaluationResult,
    exp: { totalScore: number; maxScore: number },
    proj: { totalScore: number; maxPossible: number }
  ) {
    const totalCurrentScore = req.totalScore + nice.totalScore + exp.totalScore + proj.totalScore;
    const totalMaxScore = req.maxPossible + nice.maxPossible + exp.maxScore + proj.maxPossible;

    // Prevent division by zero
    const finalMax = Math.max(totalMaxScore, 1);
    
    // Calculate and Clamp (0-100)
    const rawPercent = (totalCurrentScore / finalMax) * 100;
    const finalPercent = Math.max(0, Math.min(100, Math.round(rawPercent)));

    return {
      finalPercent,
      reqCoverage: this.calculateCoveragePercentage(req.matches),
      niceCoverage: this.calculateCoveragePercentage(nice.matches)
    };
  }

  private calculateCoveragePercentage(matches: SkillMatch[]): number {
    if (!matches.length) return 0;
    const foundCount = matches.filter(m => m.found).length;
    return Math.round((foundCount / matches.length) * 100);
  }

  private extractStrengths(matches: SkillMatch[]): string[] {
    return matches
      .filter(m => m.found)
      .map(m => {
        // 15 is the threshold for a "perfect" match (Base 10 + Bonus 5)
        const isExpert = m.weight >= 15; 
        return `${m.skill} ${isExpert ? '(Expert)' : ''}`;
      });
  }

  private generateConclusion(score: number, reqCoverage: number): string {
    const config = this.rules.conclusions;

    // 1. Check Priority Overrides (e.g., High Coverage)
    for (const rule of config.overrides) {
      if (rule.metric === 'reqCoverage' && reqCoverage >= rule.threshold) {
        return rule.message;
      }
    }

    // 2. Check Score Tiers
    for (const tier of config.tiers) {
      if (score >= tier.threshold) {
        return tier.message;
      }
    }

    // 3. Fallback
    return config.defaultMessage;
  }
}
