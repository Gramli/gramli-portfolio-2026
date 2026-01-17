import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PortfolioService } from './portfolio.service';
import { JobDescriptionAnalysis } from '../models/job-fit.models';

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private readonly PROXY_ENDPOINT = 'https://portfolio-proxy-768859394911.europe-west1.run.app/';

  constructor(
    private http: HttpClient,
    private portfolioService: PortfolioService
  ) {}

  async parseJobDescription(jobDescription: string): Promise<JobDescriptionAnalysis> {
    try {
      const payload = {
        type: 'job-parse',
        prompt: jobDescription
      };

      // Expecting a standard Gemini response structure proxied from backend
      const response = await firstValueFrom(
        this.http.post<any>(this.PROXY_ENDPOINT, payload)
      );

      let text = this.extractResponseText(response);
      
      // Clean potential markdown just in case (e.g. ```json ... ```)
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      return JSON.parse(text) as JobDescriptionAnalysis;
    } catch (error) {
      console.error('AI Parsing Error:', error);
      throw new Error('Failed to parse Job Description');
    }
  }

  async processQuery(query: string): Promise<string> {
    try {
      // Gather context
      const profile = await firstValueFrom(this.portfolioService.getProfile());
      const projects = await firstValueFrom(this.portfolioService.getProjects());
      const skills = await firstValueFrom(this.portfolioService.getSkills());

      const contextData = JSON.stringify({
        profile,
        projects,
        skills
      });

      const payload = {
        type: 'chat',
        prompt: query,
        contextData: contextData
      };

      const response = await firstValueFrom(
        this.http.post<any>(this.PROXY_ENDPOINT, payload)
      );

      return this.extractResponseText(response);
      
    } catch (error) {
      console.error('AI Error:', error);
      return 'Critical Error: Neural Link disrupted. Unable to process query.';
    }
  }

  private extractResponseText(response: any): string {
    // Traverse the Gemini response structure: candidates[0].content.parts[0].text
    if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return response.candidates[0].content.parts[0].text;
    }
    throw new Error('Invalid AI Response Structure');
  }
}
