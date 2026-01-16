import { Injectable } from '@angular/core';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { firstValueFrom } from 'rxjs';
import { PortfolioService } from './portfolio.service';

@Injectable({
  providedIn: 'root'
})
export class AiService {
  // Ideally this comes from environment variables or a secure backend proxy
  private readonly API_KEY = ''; 
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor(private portfolioService: PortfolioService) {
    if (this.API_KEY) {
      this.genAI = new GoogleGenerativeAI(this.API_KEY);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
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
