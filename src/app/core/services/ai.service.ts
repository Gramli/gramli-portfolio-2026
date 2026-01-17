import { Injectable } from '@angular/core';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { firstValueFrom } from 'rxjs';
import { PortfolioService } from './portfolio.service';

import { JobDescriptionAnalysis } from '../models/job-fit.models';

@Injectable({
  providedIn: 'root'
})
export class AiService {
  // Ideally this comes from environment variables or a secure backend proxy
  private readonly API_KEY = 'AIzaSyCfLu0jh1dRDsJrTEQds5ftJFR4DlEYaLs'; 
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor(private portfolioService: PortfolioService) {
    if (this.API_KEY) {
      this.genAI = new GoogleGenerativeAI(this.API_KEY);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
    }
  }

  async parseJobDescription(jobDescription: string): Promise<JobDescriptionAnalysis> {
    if (!this.API_KEY || !this.model) {
      throw new Error('AI System Offline: Missing API Key');
    }

    const prompt = `
      You are a specialized data extractor. 
      Analyze the following Job Description and extract structured data.
      Context: The candidate is a Software Engineer.
      
      JOB DESCRIPTION:
      ${jobDescription}

      INSTRUCTIONS:
      1. Extract 'requiredSkills' (List of mandatory technical skills).
      2. Extract 'niceToHaveSkills' (List of preferred/bonus skills).
      3. Extract 'yearsExperience' (Minimum years of experience required, as a number. If not specified, default to 0).
      4. Extract 'keyResponsibilities' (List of main duties).
      5. Extract 'domains' (Business or technical domains involved, e.g., "FinTech", "Cloud", "UI/UX").
      6. Normalize all skill names to standard industry terms (e.g., "React.js" -> "React", "AWS Services" -> "AWS").
      
      OUTPUT FORMAT:
      Return strictly a JSON object matching this interface:
      {
        "requiredSkills": string[],
        "niceToHaveSkills": string[],
        "yearsExperience": number,
        "keyResponsibilities": string[],
        "domains": string[]
      }
      Do not include markdown formatting like \`\`\`json. Just the raw JSON string.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();
      // clean potential markdown
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      return JSON.parse(text) as JobDescriptionAnalysis;
    } catch (error) {
           console.error('AI Parsing Error:', error);
      // Fallback or rethrow
      throw new Error('Failed to parse Job Description');
    }
  }

  async processQuery(query: string): Promise<string> {
    if (!this.API_KEY || !this.model) {
      return 'AI System Offline: Missing API Configuration. Please configure the Neural Link (API_KEY).';
    }

    try {
      // Fetch current portfolio data to use as context
      const profile = await firstValueFrom(this.portfolioService.getProfile());
      const projects = await firstValueFrom(this.portfolioService.getProjects());
      const skills = await firstValueFrom(this.portfolioService.getSkills());

      const context = `
        You are the AI Assistant for ${profile.name}'s portfolio terminal.
        
        DATA CONTEXT:
        Profile: ${JSON.stringify(profile)}
        Projects: ${JSON.stringify(projects)}
        Skills: ${JSON.stringify(skills)}
        
        INSTRUCTIONS:
        1. Answer based ONLY on the data above.
        2. Keep answers concise and technical (terminal style).
        3. If the answer is not in the data, say "Data segment not found in archives."
        4. Be polite but robotic/professional.
      `;

      const prompt = `${context}\n\nUser Query: ${query}`;
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
      
    } catch (error) {
      console.error('AI Error:', error);
      return 'Critical Error: Neural Link disrupted. Unable to process query.';
    }
  }
}
