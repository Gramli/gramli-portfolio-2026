import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PortfolioService } from './portfolio.service';
import { JobDescriptionAnalysis } from '../models/job-fit.models';
import { AppConfig } from '../models/app.models';

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
}

interface AiPayload {
  type: 'job-parse' | 'chat';
  prompt: string;
  contextData?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private appConfig: AppConfig | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly portfolioService: PortfolioService
  ) {}

  async parseJobDescription(jobDescription: string): Promise<JobDescriptionAnalysis> {
    try {
      const payload: AiPayload = {
        type: 'job-parse',
        prompt: jobDescription
      };

      const response = await this.postToProxy(payload);
      const contentText = this.extractResponseText(response);
      
      return this.parseJsonContent(contentText);
    } catch (error) {
      console.error('AI Parsing Error:', error);
      throw new Error('Failed to parse Job Description');
    }
  }

  async processQuery(query: string): Promise<string> {
    try {
      const contextData = await this.buildPortfolioContext();
      
      const payload: AiPayload = {
        type: 'chat',
        prompt: query,
        contextData
      };

      const response = await this.postToProxy(payload);
      return this.extractResponseText(response);
    } catch (error) {
      console.error('AI Error:', error);
      return 'Critical Error: Neural Link disrupted. Unable to process query.';
    }
  }

  private async postToProxy(payload: AiPayload): Promise<GeminiResponse> {
    await this.ensureConfigLoaded();
    return firstValueFrom(
      this.http.post<GeminiResponse>(this.appConfig!.api.proxyEndpoint, payload)
    );
  }

  private async ensureConfigLoaded(): Promise<void> {
    if (!this.appConfig) {
      this.appConfig = await firstValueFrom(this.http.get<AppConfig>('data/app.config.json'));
    }
  }

  private async buildPortfolioContext(): Promise<string> {
    const [profile, projects, skills] = await Promise.all([
      firstValueFrom(this.portfolioService.getProfile()),
      firstValueFrom(this.portfolioService.getProjects()),
      firstValueFrom(this.portfolioService.getSkills())
    ]);

    const minimizedProfile = {
      name: profile.name,
      role: profile.role,
      shortBio: profile.shortBio,
      stats: profile.stats
    };

    const minimizedProjects = projects.map(p => ({
      title: p.title,
      description: p.description,
      technologies: p.technologies,
      role: p.role
    }));

    const minimizedSkills = skills.map(c => ({
      name: c.name,
      skills: c.skills.map(s => s.name)
    }));

    return JSON.stringify({ profile: minimizedProfile, projects: minimizedProjects, skills: minimizedSkills });
  }

  private extractResponseText(response: GeminiResponse): string {
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    
    // Sometimes the model returns an empty text part but includes search/grounding metadata.
    // In this specific mock/proxy setup, if we get empty text but a successful finishReason, 
    // it likely means the model refused to answer or found no info, or the proxy response structure varies.
    // However, looking at the user's log, it seems the model is returning "```\n" which is nearly empty code block.
    // It's safer to return a fallback message if text is too short/empty.
    if (!text || text.trim().length === 0 || text.trim() === '```') {
      // If we have candidates but text is weird, it might be a safety filter or the model returning just formatting.
      // But for this specific error "```\n", it looks like a hallucinated incomplete code block.
       return "I processed your query, but the neural network returned an ambiguous response. Please try rephrasing.";
    }
    
    return text;
  }

  private parseJsonContent(text: string): JobDescriptionAnalysis {
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText) as JobDescriptionAnalysis;
  }
}

