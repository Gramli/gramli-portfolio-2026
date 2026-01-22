import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PortfolioService } from './portfolio.service';
import { AiService } from './ai.service';
import { JobAnalyzerService } from './job-analyzer.service';
import { TerminalCommand, TerminalLog } from '../models/terminal.models';
import {
  TERMINAL_CONFIG,
  TerminalCommandId,
  CommandCategory,
  CommandDefinition,
} from '../config/terminal.config';

@Injectable({
  providedIn: 'root',
})
export class TerminalService {
  public readonly isOpen = signal<boolean>(false);
  public readonly logs = signal<TerminalLog[]>([]);
  public readonly historyIndex = signal<number>(-1);

  // Constants to avoid magic numbers
  private readonly DELAY_BOOT = 500;
  private readonly DELAY_LOG_ENTRY = 1000;
  private readonly RESUME_FILE_PATH = 'data/resume.pdf';

  private readonly commandHistory: string[] = [];
  private readonly commands = new Map<string, TerminalCommand>();

  private activeInputCallback: ((input: string) => void) | null = null;

  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly aiService: AiService,
    private readonly jobAnalyzer: JobAnalyzerService
  ) {
    this.initialize();
  }

  public toggle(): void {
    this.isOpen.update((v) => !v);
  }

  public log(type: TerminalLog['type'], content: string): void {
    this.logs.update((current) => [...current, { type, content, timestamp: new Date() }]);
  }

  public updateLastLog(content: string): void {
    this.logs.update((current) => {
      if (current.length === 0) return current;
      const last = current[current.length - 1];
      return [...current.slice(0, -1), { ...last, content }];
    });
  }

  public async execute(input: string): Promise<void> {
    const rawInput = input.trim();
    if (!rawInput) return;

    this.log('input', rawInput);

    // If waiting for user input, resolve the callback with valid input
    if (this.activeInputCallback) {
      const callback = this.activeInputCallback;
      this.activeInputCallback = null;
      callback(input);
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
    const newIdx =
      direction === 'up' ? Math.max(0, currentIdx - 1) : Math.min(historyLen, currentIdx + 1);

    this.historyIndex.set(newIdx);

    if (newIdx === historyLen) return '';
    return this.commandHistory[newIdx] || '';
  }

  // --- Initialization ---

  private initialize(): void {
    this.registerCommands();
    this.displayWelcomeMessage();
  }

  private displayWelcomeMessage(): void {
    const helpTrigger = TERMINAL_CONFIG.commands[TerminalCommandId.Help].trigger;
    TERMINAL_CONFIG.system.welcomeMessages.forEach((msg) => {
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

    this.register(config[TerminalCommandId.Plog], () => this.handlePlog());
    this.register(config[TerminalCommandId.Ai], (args) => this.handleAi(args));
    this.register(config[TerminalCommandId.Fit], (args) => this.handleFit(args));
    this.register(config[TerminalCommandId.Resume], () => this.handleResume());
  }

  private register(def: CommandDefinition, action: (args: string[]) => void | Promise<void>): void {
    this.commands.set(def.trigger.toLowerCase(), {
      command: def.trigger,
      description: def.description,
      category: def.category,
      action,
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

  // --- Command Handlers ---

  private handleHelp(): void {
    const allCommands = Array.from(this.commands.values());
    const portfolioCommands = allCommands.filter((c) => c.category === 'portfolio');
    const systemCommands = allCommands.filter((c) => c.category === 'system');

    const generateTable = (commands: TerminalCommand[]): string =>
      `<table style="width: 100%; border-collapse: collapse;">
        ${commands.map(this.formatHelpRow).join('')}
      </table>`;

    const output = [
      '<div>Available Commands:</div>',
      '<div style="color: var(--color-text-muted); font-weight: bold; margin: 10px 0 5px 0;">PORTFOLIO COMMANDS:</div>',
      generateTable(portfolioCommands),
      '<div style="color: var(--color-text-muted); font-weight: bold; margin: 15px 0 5px 0;">SYSTEM COMMANDS:</div>',
      generateTable(systemCommands),
    ].join('');

    this.log('output', output);
  }

  private formatHelpRow(cmd: TerminalCommand): string {
    return `
      <tr>
        <td style="white-space: nowrap; width: 140px; vertical-align: top; color: var(--color-cyan-bright); padding-bottom: 4px;">${cmd.command}</td>
        <td style="vertical-align: top; padding-bottom: 4px; color: var(--color-text-main);">${cmd.description}</td>
      </tr>`;
  }

  private async handleKill(args: string[]): Promise<void> {
    const defaultSeconds = 3;
    const secondsArg = args[0] === '--seconds' && args[1] ? parseInt(args[1], 10) : defaultSeconds;
    let seconds = isNaN(secondsArg) ? defaultSeconds : secondsArg;

    this.log('system', 'System shutdown initiated...');

    while (seconds > 0) {
      this.log('system', `Reboot in ${seconds}...`);
      await this.delay(1000); // 1 second countdown
      seconds--;
    }

    window.location.reload();
  }

  private async handlePlog(): Promise<void> {
    // 1. Data Fetching Phase (Parallel)
    const [projects, skills, profile] = await Promise.all([
      firstValueFrom(this.portfolioService.getProjects()),
      firstValueFrom(this.portfolioService.getSkills()),
      firstValueFrom(this.portfolioService.getProfile()),
    ]);

    // 2. Calculation Phase
    const projectCount = projects.length;
    const skillCount = skills.reduce((acc, curr) => acc + curr.skills.length, 0);
    const activeStackCount = new Set(projects.flatMap((p) => p.technologies)).size;

    // 3. Boot Sequence Phase
    await this.runBootSequence([
      this.stylize('[INFO] Boot sequence initialized'),
      this.stylize('[INFO] Connecting to station logging server...'),
      this.stylize('[OK] Connection established'),
    ]);

    // 4. Counts Display Phase
    await this.logWithDelay(this.stylize(`[INFO] Projects logs loaded: ${projectCount}`), this.DELAY_BOOT);
    await this.logWithDelay(this.stylize(`[INFO] Skills logs loaded: ${skillCount}`), this.DELAY_BOOT);
    await this.logWithDelay(this.stylize(`[INFO] Active stack logs loaded: ${activeStackCount}`), this.DELAY_BOOT);
    await this.logWithDelay(this.stylize('[OK] System Log operational'), this.DELAY_BOOT);

    // 5. Stream Portfolio Data Phase
    await this.delay(this.DELAY_BOOT); // Initial pause before streaming

    const entries = [
      this.stylize(`[LOCATION] ${profile.location}`),
      this.stylize(`[PROFILE] ${profile.name} - ${profile.role}`),
      this.stylize(`[BIO] ${profile.longBio}`),
      ...projects.map(
        (p) => this.stylize(`[PROJECT] ${p.title} - ${p.description} (Tech Stack: ${p.technologies.join(', ')})`)
      ),
      ...skills.map((s) => this.stylize(`[SKILL] ${s.name} - ${s.skills.join(', ')}`)),
    ];

    for (const entry of entries) {
      await this.delay(this.DELAY_LOG_ENTRY);
      this.log('system', entry);
    }

    // 6. Shutdown/End Sequence Phase
    const closingMessages = [
      { msg: '[OK] Portfolio data fully loaded.', type: 'system' as const },
      { msg: '[WARN] Telemetry spike detected', type: 'system' as const },
      { msg: '[WARN] Unusual activity in terminal subsystem', type: 'system' as const },
      { msg: '[ERROR] System disrupted', type: 'error' as const },
      { msg: '[CRITICAL] Terminal disconnected from logging server', type: 'error' as const },
    ];

    for (const item of closingMessages) {
      await this.delay(this.DELAY_BOOT);
      this.log(item.type, this.stylize(item.msg));
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
    this.log(
      'system',
      'Processing query<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span>'
    );

    try {
      const response = await this.aiService.processQuery(query);
      this.updateLastLog('Processing query... ' + TERMINAL_CONFIG.messages.done);
      this.log('ai', response);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.updateLastLog('Processing query... ' + TERMINAL_CONFIG.messages.failed);
      this.log('error', `AI Error: ${errorMessage}`);
    }
  }

  private async handleFit(args: string[]): Promise<void> {
    if (args.length === 0) {
      this.log(
        'error',
        `${TERMINAL_CONFIG.messages.usagePrefix}fit-analyze <job description text>`
      );
      return;
    }

    const jdText = args.join(' ');

    this.log(
      'system',
      'Analyzing data<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span>'
    );
    try {
      const result = await this.jobAnalyzer.analyze(jdText);
      this.updateLastLog('Analyzing data... ' + TERMINAL_CONFIG.messages.done);

      const report = [
        '\n>> FIT ANALYSIS REPORT <<',
        `MATCH SCORE: ${result.score}%`,
        `REQ SKILLS COVERAGE: ${result.requiredSkillsCoverage}%`,
        `CONCLUSION:\n${result.conclusion}`,
      ].join('\n');

      this.log('ai', report);

      const exportAnswer = await this.promptToUser('Do you want to export the result? (y/n)');
      if (exportAnswer.toLowerCase().startsWith('y')) {
        this.downloadTextFile(
          `fit_analysis_${new Date().toISOString().split('T')[0]}.txt`,
          JSON.stringify(result, null, 2)
        );
        this.log('system', 'Report downloaded.');
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      this.log('error', 'Analysis Error: ' + errorMessage);
    }
  }

  private handleResume(): void {
    this.log('system', 'Initiating resume download sequence...');

    try {
      this.triggerFileDownload(this.RESUME_FILE_PATH, 'candidate_resume.pdf');
      this.log('system', 'Download started successfully.');
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      this.log('error', 'Download failed: ' + errorMessage);
    }
  }

  // --- Helper Methods ---

  private stylize(text: string): string {
    const styles: Record<string, string> = {
      '[INFO]': 'color: var(--color-cyan)',
      '[OK]': 'color: var(--color-green)',
      '[WARN]': 'color: var(--color-alert)',
      '[ERROR]': 'color: #ef5350',
      '[CRITICAL]': 'color: #ff0000; font-weight: bold',
      '[LOCATION]': 'color: #ce93d8',
      '[PROFILE]': 'color: var(--color-cyan-bright); font-weight: bold',
      '[BIO]': 'color: #90caf9',
      '[PROJECT]': 'color: #ffcc80',
      '[SKILL]': 'color: #a5d6a7',
    };

    let styledText = text;
    // Iterate manually to ensure specific prefixes are matched
    for (const key in styles) {
      if (styledText.includes(key)) {
        styledText = styledText.replace(key, `<span style="${styles[key]}">${key}</span>`);
        // We assume only one prefix type per message for efficiency
        break;
      }
    }
    return styledText;
  }

  private async promptToUser(message: string): Promise<string> {
    this.log('system', message);
    return new Promise<string>((resolve) => {
      this.activeInputCallback = resolve;
    });
  }

  private async runBootSequence(messages: string[]): Promise<void> {
    for (const msg of messages) {
      await this.delay(this.DELAY_BOOT);
      this.log('system', msg);
    }
  }

  private async logWithDelay(message: string, delayMs: number): Promise<void> {
    await this.delay(delayMs);
    this.log('system', message);
  }

  /**
   * Triggers a browser download for a specific existing file (e.g. PDF).
   */
  private triggerFileDownload(url: string, filename: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Generates a blob and triggers download for generated text content.
   */
  private downloadTextFile(filename: string, content: string): void {
    try {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      this.triggerFileDownload(url, filename);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed', e);
      this.log('error', 'Download not supported in this environment.');
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
