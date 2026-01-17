import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PortfolioService } from './portfolio.service';
import { AiService } from './ai.service';
import { JobAnalyzerService } from './job-analyzer.service';
import { TerminalCommand, TerminalLog } from '../models/terminal.models';

@Injectable({
  providedIn: 'root'
})
export class TerminalService {
  // State Signals
  isOpen = signal<boolean>(false);
  logs = signal<TerminalLog[]>([]);
  historyIndex = signal<number>(-1);
  
  // Internal State
  private commandHistory: string[] = [];
  private commands = new Map<string, TerminalCommand>();
  private infoHandlers = new Map<string, () => Promise<string>>();
  private inputCallback: ((input: string) => void) | null = null;

  constructor(
    private portfolioService: PortfolioService,
    private aiService: AiService,
    private jobAnalyzer: JobAnalyzerService,
    private router: Router
  ) {
    this.initializeInfoHandlers();
    this.registerCoreCommands();
    this.welcomeMessage();
  }

  toggle() {
    this.isOpen.update(v => !v);
  }

  private welcomeMessage() {
    this.addLog('system', 'Initializing System Interface v2.0.26...');
    this.addLog('system', 'Connection established.');
    this.addLog('system', 'Type "help" for a list of available commands.');
  }

  addLog(type: TerminalLog['type'], content: string) {
    this.logs.update(logs => [...logs, {
      type,
      content,
      timestamp: new Date()
    }]);
  }

  // Updates the content of the most recent log entry
  // Useful for updating status messages (e.g. stopping animations)
  replaceLastLog(content: string) {
    this.logs.update(logs => {
      if (logs.length === 0) return logs;
      const newLogs = [...logs];
      const last = newLogs[newLogs.length - 1];
      newLogs[newLogs.length - 1] = { ...last, content };
      return newLogs;
    });
  }

  async executeCommand(input: string) {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    // Log the user input
    this.addLog('input', trimmedInput);
    
    // Add valid command to history (unless it's during input flow?)
    // If inputCallback is active, maybe don't add to history? 
    // Usually sensitive data like JDs shouldn't be in history.
    if (this.inputCallback) {
      this.inputCallback(input); // Pass raw input to preserve format if needed
      this.inputCallback = null;
      return;
    }

    // Add to history
    this.commandHistory.push(trimmedInput);
    this.historyIndex.set(this.commandHistory.length);

    // Parse command
    const parts = trimmedInput.split(' ');
    const cmdName = parts[0].toLowerCase();
    const args = parts.slice(1);

    const command = this.commands.get(cmdName);

    if (command) {
      try {
        await command.action(args);
      } catch (error) {
        this.addLog('error', `Execution failed: ${error}`);
      }
    } else {
      this.addLog('error', 'System failure - command not found');
    }
  }

  getCommandHistory(direction: 'up' | 'down'): string {
    const currentIdx = this.historyIndex();
    const max = this.commandHistory.length;
    let newIdx = currentIdx;

    if (direction === 'up') {
      newIdx = Math.max(0, currentIdx - 1);
    } else {
      newIdx = Math.min(max, currentIdx + 1);
    }

    this.historyIndex.set(newIdx);
    
    if (newIdx === max) return '';
    return this.commandHistory[newIdx] || '';
  }

  private initializeInfoHandlers() {
    this.infoHandlers.set('about', async () => {
      const profile = await firstValueFrom(this.portfolioService.getProfile());
      return [
        `IDENTITY: ${profile.name}`,
        `ROLE: ${profile.role}`,
        `LOC: ${profile.location}`,
        `BIO: ${profile.shortBio}`
      ].join('\n');
    });

    this.infoHandlers.set('projects', async () => {
      const projects = await firstValueFrom(this.portfolioService.getProjects());
      const list = projects.map((p, i) => `[${i + 1}] ${p.title}: ${p.description}`).join('\n');
      return `PROJECT_ARCHIVES:\n${list}`;
    });

    this.infoHandlers.set('skills', async () => {
      const skills = await firstValueFrom(this.portfolioService.getSkills());
      const output = skills.map(cat => `\n${cat.name.toUpperCase()}:\n  ${cat.skills.join(', ')}`).join('');
      return `SKILL_MATRIX:${output}`;
    });

    this.infoHandlers.set('contact', async () => {
      const profile = await firstValueFrom(this.portfolioService.getProfile());
      const output = [
        `EMAIL: ${profile.email}`,
        `LINKEDIN: ${profile.linkedin}`,
        `GITHUB: ${profile.github}`,
        profile.devto ? `DEV.TO: ${profile.devto}` : '',
        profile.blog ? `BLOG: ${profile.blog}` : ''
      ].filter(Boolean).join('\n');
      return `COMM_CHANNELS:\n${output}`;
    });
  }

  private registerCoreCommands() {
    // HELP
    this.register('help', 'Displays a list of available commands', 'system', () => {
      const commands = Array.from(this.commands.values());
      const portfolioCmds = commands.filter(c => c.category === 'portfolio');
      const systemCmds = commands.filter(c => c.category === 'system');

      let output = 'Available Commands:\n\n';

      output += 'PORTFOLIO COMMANDS:\n';
      output += portfolioCmds.map(c => `  ${c.command.padEnd(10)} - ${c.description}`).join('\n');
      
      output += '\n\nSYSTEM COMMANDS:\n';
      output += systemCmds.map(c => `  ${c.command.padEnd(10)} - ${c.description}`).join('\n');

      this.addLog('output', output);
    });

    // CLEAR
    this.register('clear', 'Clears terminal output', 'system', () => {
      this.logs.set([]);
    });

    // EXIT
    this.register('exit', 'Closes the terminal modal', 'system', () => {
      this.isOpen.set(false);
    });

    // INFO
    this.register('info', 'Access portfolio data modules. Usage: info --<module>\n             Ex: "info --projects" or "info --contact"\n             Modules: ' + Array.from(this.infoHandlers.keys()).map(k => '--' + k).join(', '), 'portfolio', async (args) => {
      const rawArg = args[0]?.toLowerCase();
      
      if (!rawArg) {
         const available = Array.from(this.infoHandlers.keys()).map(k => '--' + k).join(', ');
         this.addLog('error', `Usage: info --<module>\nAvailable modules: ${available}`);
         return;
      }

      if (!rawArg.startsWith('--')) {
         this.addLog('error', 'Syntax Error: Arguments must be prefixed with "--".\nExample: info --' + rawArg);
         return;
      }

      const subCommand = rawArg.substring(2);
      
      if (this.infoHandlers.has(subCommand)) {
        const handler = this.infoHandlers.get(subCommand)!;
        const output = await handler();
        this.addLog('output', output);
      } else {
        const available = Array.from(this.infoHandlers.keys()).map(k => '--' + k).join(', ');
        this.addLog('error', `Unknown module: ${subCommand}\nAvailable modules: ${available}`);
      }
    });

    // KILL
    this.register('kill', 'Reloads the system. Usage: kill --seconds 3', 'system', async (args) => {
      let seconds = 3; // Default

      if (args.length > 0) {
        if (args[0] === '--seconds' && args[1]) {
           const parsed = parseInt(args[1], 10);
           if (!isNaN(parsed) && parsed > 0) {
             seconds = parsed;
           } else {
             this.addLog('error', 'Invalid time argument. Using default 3 seconds.');
           }
        } else {
           this.addLog('error', 'Usage: kill --seconds <number>');
           return;
        }
      }

      this.addLog('system', 'System shutdown initiated...');
      
      for (let i = seconds; i > 0; i--) {
        this.addLog('system', `Reboot in ${i}...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      window.location.reload();
    });

    // AI
    this.register('ai', 'Query the AI Assistant.\n             Ex: "ai What is the tech stack in your projects?"', 'portfolio', async (args) => {
      if (args.length === 0) {
        this.addLog('error', 'Usage: ai <question>');
        return;
      }
      this.addLog('system', 'Processing query<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span>');
      try {
        const response = await this.aiService.processQuery(args.join(' '));
        this.replaceLastLog('Processing query... Done.');
        this.addLog('ai', response);
      } catch (err: any) {
        this.replaceLastLog('Processing query... Failed.');
        this.addLog('error', `AI Access Failed: ${err.message || err}`);
      }
    });

    // FIT ANALYZER
    this.register('fit', 'Job Fit Analyzer. Usage: fit analyze', 'portfolio', async (args) => {
      if (!args[0] || args[0] !== 'analyze') {
        this.addLog('error', 'Usage: fit analyze');
        return;
      }
      
      const jd = await this.promptInput('Paste Job Description below (single line or block):');
      if (!jd) {
          this.addLog('system', 'Analysis cancelled (empty input).');
          return;
      }

      this.addLog('system', 'Analyzing data<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span>');
      
      try {
        const result = await this.jobAnalyzer.analyze(jd);
        this.replaceLastLog('Analyzing data... Done.');
        
        let report = `\n>> FIT ANALYSIS REPORT <<\n`;
        report += `MATCH SCORE: ${result.score}%\n`;
        report += `REQ SKILLS COVERAGE: ${result.requiredSkillsCoverage}%\n`;
        report += `NICE-TO-HAVE COVERAGE: ${result.niceToHaveSkillsCoverage}%\n\n`;
        
        report += `STRENGTHS:\n${result.strengths.map(s => `+ ${s}`).join('\n')}\n\n`;
        report += `GAPS:\n${result.gaps.map(g => `- ${g}`).join('\n')}\n\n`;
        report += `CONCLUSION:\n${result.conclusion}`;
        
        this.addLog('ai', report);
        
        const doExport = await this.promptInput('Do you want to export the result? (y/n)');
        if (doExport.toLowerCase().startsWith('y')) {
             const format = await this.promptInput('Format (txt/md)?');
             if (format === 'txt' || format === 'md') {
                this.downloadReport(result, format);
                this.addLog('system', 'Report downloaded.');
             } else {
                this.addLog('error', 'Invalid format. Export cancelled.');
             }
        }
      } catch (e) {
         this.addLog('error', 'Analysis Error: ' + e);
      }
    });
  }

  private register(command: string, description: string, category: 'portfolio' | 'system', action: (args: string[]) => void | Promise<void>) {
    this.commands.set(command, { command, description, category, action });
  }

  private promptInput(prompt: string): Promise<string> {
    this.addLog('system', prompt);
    return new Promise(resolve => {
        this.inputCallback = resolve;
    });
  }

  private downloadReport(result: any, format: 'txt' | 'md') {
      const date = new Date().toISOString().split('T')[0];
      const filename = `fit_analysis_${date}.${format}`;
      let content = '';

      if (format === 'md') {
          content = `# Job Fit Analysis Report\nDate: ${date}\n\n`;
          content += `## Score: ${result.score}%\n`;
          content += `**Required Skills Coverage**: ${result.requiredSkillsCoverage}%\n`;
          content += `**Nice-to-Have Coverage**: ${result.niceToHaveSkillsCoverage}%\n\n`;
          content += `### Strengths\n${result.strengths.map((s: string) => `- ${s}`).join('\n')}\n\n`;
          content += `### Gaps\n${result.gaps.map((g: string) => `- ${g}`).join('\n')}\n\n`;
          content += `### Conclusion\n${result.conclusion}\n`;
      } else {
          content = `JOB FIT ANALYSIS REPORT\nDate: ${date}\n\n`;
          content += `SCORE: ${result.score}%\n`;
          content += `REQ SKILLS: ${result.requiredSkillsCoverage}%\n`;
          content += `STRENGTHS:\n${result.strengths.map((s: string) => `- ${s}`).join('\n')}\n\n`;
          content += `GAPS:\n${result.gaps.map((g: string) => `- ${g}`).join('\n')}\n\n`;
          content += `CONCLUSION:\n${result.conclusion}\n`;
      }

      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
  }
}
