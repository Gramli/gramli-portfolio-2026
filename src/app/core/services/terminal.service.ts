import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PortfolioService } from './portfolio.service';
import { AiService } from './ai.service';
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

  constructor(
    private portfolioService: PortfolioService,
    private aiService: AiService,
    private router: Router
  ) {
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

  async executeCommand(input: string) {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    // Add valid command to history
    this.commandHistory.push(trimmedInput);
    this.historyIndex.set(this.commandHistory.length);
    
    // Log the user input
    this.addLog('input', trimmedInput);

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

  private registerCoreCommands() {
    // HELP
    this.register('help', 'Displays a list of available commands', () => {
      const coreCmds = Array.from(this.commands.values())
        .map(c => `  ${c.command.padEnd(10)} - ${c.description}`)
        .join('\n');
      this.addLog('output', `Available Commands:\n${coreCmds}`);
    });

    // CLEAR
    this.register('clear', 'Clears terminal output', () => {
      this.logs.set([]);
    });

    // EXIT
    this.register('exit', 'Closes the terminal modal', () => {
      this.isOpen.set(false);
    });

    // ABOUT
    this.register('about', 'Displays information about the developer', async () => {
      const profile = await firstValueFrom(this.portfolioService.getProfile());
      const output = [
        `IDENTITY: ${profile.name}`,
        `ROLE: ${profile.role}`,
        `LOC: ${profile.location}`,
        `BIO: ${profile.shortBio}`
      ].join('\n');
      this.addLog('output', output);
    });

    // PROJECTS
    this.register('projects', 'Displays a list of projects', async () => {
      const projects = await firstValueFrom(this.portfolioService.getProjects());
      const output = projects.map((p, i) => `[${i + 1}] ${p.title}: ${p.description}`).join('\n');
      this.addLog('output', `PROJECT_ARCHIVES:\n${output}`);
    });

    // SKILLS
    this.register('skills', 'Displays a list of technical skills', async () => {
      const skills = await firstValueFrom(this.portfolioService.getSkills());
      const output = skills.map(cat => `\n${cat.name.toUpperCase()}:\n  ${cat.skills.join(', ')}`).join('');
      this.addLog('output', `SKILL_MATRIX:${output}`);
    });

    // CONTACT
    this.register('contact', 'Displays contact information', async () => {
      const profile = await firstValueFrom(this.portfolioService.getProfile());
      const output = [
        `EMAIL: ${profile.email}`,
        `LINKEDIN: ${profile.linkedin}`,
        `GITHUB: ${profile.github}`,
        profile.devto ? `DEV.TO: ${profile.devto}` : '',
        profile.blog ? `BLOG: ${profile.blog}` : ''
      ].filter(Boolean).join('\n');
      this.addLog('output', `COMM_CHANNELS:\n${output}`);
    });

    // SHUTDOWN
    this.register('shutdown', 'Reloads the system', async () => {
      this.addLog('system', 'System shutting down...');
      
      for (let i = 3; i > 0; i--) {
        this.addLog('system', `Reboot in ${i}...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      window.location.reload();
    });

    // AI
    this.register('ai', 'Query the AI Assistant (Usage: ai <question>)', async (args) => {
      if (args.length === 0) {
        this.addLog('error', 'Usage: ai <question>');
        return;
      }
      this.addLog('system', 'Processing query...');
      const response = await this.aiService.processQuery(args.join(' '));
      this.addLog('output', `AI_RESPONSE: ${response}`);
    });
  }

  private register(command: string, description: string, action: (args: string[]) => void | Promise<void>) {
    this.commands.set(command, { command, description, action });
  }
}
