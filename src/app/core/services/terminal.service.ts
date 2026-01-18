import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PortfolioService } from './portfolio.service';
import { AiService } from './ai.service';
import { JobAnalyzerService } from './job-analyzer.service';
import { TerminalCommand, TerminalLog } from '../models/terminal.models';
import { TERMINAL_CONFIG, TerminalCommandId, CommandCategory, CommandDefinition } from '../config/terminal.config';

@Injectable({
  providedIn: 'root'
})
export class TerminalService {
  public readonly isOpen = signal<boolean>(false);
  public readonly logs = signal<TerminalLog[]>([]);
  public readonly historyIndex = signal<number>(-1);

  private readonly commandHistory: string[] = [];
  private readonly commands = new Map<string, TerminalCommand>();
  private readonly infoHandlers = new Map<string, () => Promise<string>>();
  
  private activeInputCallback: ((input: string) => void) | null = null;

  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly aiService: AiService,
    private readonly jobAnalyzer: JobAnalyzerService
  ) {
    this.initialize();
  }

  public toggle(): void {
    this.isOpen.update(v => !v);
  }

  public log(type: TerminalLog['type'], content: string): void {
    this.logs.update(current => [
      ...current, { type, content, timestamp: new Date() }
    ]);
  }

  public updateLastLog(content: string): void {
    this.logs.update(current => {
      if (current.length === 0) return current;
      const last = current[current.length - 1];
      return [...current.slice(0, -1), { ...last, content }];
    });
  }

  public async execute(input: string): Promise<void> {
    const rawInput = input.trim();
    if (!rawInput) return;

    this.log('input', rawInput);

    if (this.activeInputCallback) {
      this.activeInputCallback(input);
      this.activeInputCallback = null;
      return;
    }

    this.recordHistory(rawInput);
    
    const [commandTrigger, ...args] = rawInput.split(' ');
    await this.dispatchCommand(commandTrigger.toLowerCase(), args);
  }

  public navigateHistory(direction: 'up' | 'down'): string {
    const historyLen = this.commandHistory.length;
    if (historyLen === 0) return '';

    const currentIdx = this.historyIndex();
    const newIdx = direction === 'up' 
      ? Math.max(0, currentIdx - 1)
      : Math.min(historyLen, currentIdx + 1);

    this.historyIndex.set(newIdx);

    if (newIdx === historyLen) return '';
    return this.commandHistory[newIdx] || '';
  }

  private initialize(): void {
    this.registerInfoModules();
    this.registerCommands();
    this.displayWelcomeMessage();
  }

  private displayWelcomeMessage(): void {
    const helpTrigger = TERMINAL_CONFIG.commands[TerminalCommandId.Help].trigger;
    TERMINAL_CONFIG.system.welcomeMessages.forEach(msg => {
      this.log('system', msg.replace('{help}', helpTrigger));
    });
  }

  private recordHistory(input: string): void {
    this.commandHistory.push(input);
    this.historyIndex.set(this.commandHistory.length);
  }

  private registerCommands(): void {
    const config = TERMINAL_CONFIG.commands;

    this.register(config[TerminalCommandId.Help], () => this.handleHelp());
    this.register(config[TerminalCommandId.Clear], () => this.logs.set([]));
    this.register(config[TerminalCommandId.Exit], () => this.isOpen.set(false));
    this.register(config[TerminalCommandId.Kill], (args) => this.handleKill(args));

    this.register(config[TerminalCommandId.Info], (args) => this.handleInfo(args));
    this.register(config[TerminalCommandId.Ai], (args) => this.handleAi(args));
    this.register(config[TerminalCommandId.Fit], (args) => this.handleFit(args));
    this.register(config[TerminalCommandId.Resume], () => this.handleResume());
  }

  private register(def: CommandDefinition, action: (args: string[]) => void | Promise<void>): void {
    this.commands.set(def.trigger.toLowerCase(), {
      command: def.trigger,
      description: def.description,
      category: def.category,
      action
    });
  }

  private async dispatchCommand(trigger: string, args: string[]): Promise<void> {
    const cmd = this.commands.get(trigger);
    
    if (!cmd) {
      this.log('error', TERMINAL_CONFIG.messages.commandNotFound);
      return;
    }

    try {
      await cmd.action(args);
    } catch (error) {
      this.log('error', `Execution failed: ${error}`);
    }
  }

  private async promptToUser(message: string): Promise<string> {
    this.log('system', message);
    return new Promise<string>(resolve => {
      this.activeInputCallback = resolve;
    });
  }

  private handleHelp(): void {
    const all = Array.from(this.commands.values());
    const group = (category: CommandCategory) => all.filter(c => c.category === category);
    
    const format = (list: TerminalCommand[]) => 
      list.map(c => `  ${c.command.padEnd(10)} - ${c.description}`).join('\n');

    const output = [
      'Available Commands:\n',
      'PORTFOLIO COMMANDS:',
      format(group('portfolio')),
      '\nSYSTEM COMMANDS:',
      format(group('system'))
    ].join('\n');

    this.log('output', output);
  }

  private async handleKill(args: string[]): Promise<void> {
    const secondsArg = args[0] === '--seconds' && args[1] ? parseInt(args[1], 10) : 3;
    let seconds = secondsArg || 3;

    this.log('system', 'System shutdown initiated...');
    
    while (seconds > 0) {
      this.log('system', `Reboot in ${seconds}...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      seconds--;
    }
    
    window.location.reload();
  }

  private async handleInfo(args: string[]): Promise<void> {
    const moduleName = args[0]?.toLowerCase().replace(/^--/, '');
    
    if (moduleName && this.infoHandlers.has(moduleName)) {
      const handler = this.infoHandlers.get(moduleName)!;
      const data = await handler();
      this.log('output', data);
    } else {
      const list = Array.from(this.infoHandlers.keys()).map(k => `--${k}`).join(', ');
      this.log('error', `${TERMINAL_CONFIG.messages.usagePrefix}info --<module>\nAvailable: ${list}`);
    }
  }

  private async handleAi(args: string[]): Promise<void> {
    if (args.length === 0) {
      this.log('error', `${TERMINAL_CONFIG.messages.usagePrefix}ai <question>`);
      return;
    }

    if (args[0] === '--info') {
      this.log('system', 'AI Assistant v2.0 powered by Gemini Pro (Mock).');
      return;
    }

    const query = args.join(' ');
    this.log('system', 'Processing query<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span>');
    
    try {
      const response = await this.aiService.processQuery(query);
      this.updateLastLog('Processing query... ' + TERMINAL_CONFIG.messages.done);
      this.log('ai', response);
    } catch (err: any) {
      this.updateLastLog('Processing query... ' + TERMINAL_CONFIG.messages.failed);
      this.log('error', `AI Error: ${err.message || err}`);
    }
  }

  private async handleFit(args: string[]): Promise<void> {
    if (args.length === 0) {
      this.log('error', `${TERMINAL_CONFIG.messages.usagePrefix}fit-analyze <job description text>`);
      return;
    }

    const jdText = args.join(' ');

    this.log('system', 'Analyzing data<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span>');
    try {
      const result = await this.jobAnalyzer.analyze(jdText);
      this.updateLastLog('Analyzing data... ' + TERMINAL_CONFIG.messages.done);
      
      const report = [
        '\n>> FIT ANALYSIS REPORT <<',
        `MATCH SCORE: ${result.score}%`,
        `REQ SKILLS COVERAGE: ${result.requiredSkillsCoverage}%`,
        `CONCLUSION:\n${result.conclusion}`
      ].join('\n');
      
      this.log('ai', report);
      
      const exportAnswer = await this.promptToUser('Do you want to export the result? (y/n)');
      if (exportAnswer.toLowerCase().startsWith('y')) {
        this.downloadFile(`fit_analysis_${new Date().toISOString().split('T')[0]}.txt`, JSON.stringify(result, null, 2));
        this.log('system', 'Report downloaded.');
      }
    } catch (e) {
      this.log('error', 'Analysis Error: ' + e);
    }
  }

  private handleResume(): void {
    this.log('system', 'Initiating resume download sequence...');
    
    try {
      const link = document.createElement('a');
      link.href = 'data/resume.pdf';
      link.download = 'candidate_resume.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      this.log('system', 'Download started successfully.');
    } catch (e) {
      this.log('error', 'Download failed: ' + e);
    }
  }

  private registerInfoModules(): void {
    this.registerInfoHandler('about', async () => {
      const p = await firstValueFrom(this.portfolioService.getProfile());
      return `IDENTITY: ${p.name}\nROLE: ${p.role}\nBIO: ${p.shortBio}`;
    });

    this.registerInfoHandler('projects', async () => {
      const list = await firstValueFrom(this.portfolioService.getProjects());
      return 'PROJECT_ARCHIVES:\n' + list.map((p, i) => `[${i + 1}] ${p.title}`).join('\n');
    });

    this.registerInfoHandler('skills', async () => {
      const valid = await firstValueFrom(this.portfolioService.getSkills());
      return 'SKILL_MATRIX:\n' + valid.map(c => `${c.name}: ${c.skills.join(', ')}`).join('\n');
    });

    this.registerInfoHandler('contact', async () => {
      const p = await firstValueFrom(this.portfolioService.getProfile());
      return `EMAIL: ${p.email}\nLINKEDIN: ${p.linkedin}\nGITHUB: ${p.github}`;
    });
  }

  private registerInfoHandler(key: string, handler: () => Promise<string>): void {
    this.infoHandlers.set(key, handler);
  }

  private downloadFile(filename: string, content: string): void {
    try {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed', e);
      this.log('error', 'Download not supported in this environment.');
    }
  }
}
