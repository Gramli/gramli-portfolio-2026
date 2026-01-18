import { Component, ElementRef, ViewChild, Signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Observable } from 'rxjs';
import { TerminalService } from '../../services/terminal.service';
import { TerminalLog } from '../../models/terminal.models';
import { PortfolioService } from '../../services/portfolio.service';
import { Profile } from '../../models/portfolio.models';

@Component({
  selector: 'app-terminal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.scss']
})
export class TerminalComponent {
  @ViewChild('terminalBody') terminalBody!: ElementRef<HTMLDivElement>;
  @ViewChild('commandInput') commandInput!: ElementRef<HTMLInputElement>;

  private readonly terminalService = inject(TerminalService);
  private readonly portfolioService = inject(PortfolioService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly isOpen: Signal<boolean> = this.terminalService.isOpen;
  readonly logs: Signal<TerminalLog[]> = this.terminalService.logs;
  readonly profile$: Observable<Profile> = this.portfolioService.getProfile();

  currentCommand = '';

  constructor() {
    // Auto-scroll when logs change
    effect(() => {
      this.logs(); 
      setTimeout(() => this.scrollToBottom(), 0);
    });

    // Auto-focus input when terminal opens
    effect(() => {
      if (this.isOpen()) {
        setTimeout(() => this.commandInput?.nativeElement?.focus(), 0);
      }
    });
  }

  close(): void {
    this.terminalService.toggle();
  }

  execute(): void {
    this.terminalService.execute(this.currentCommand);
    this.currentCommand = '';
  }

  navigateHistory(direction: 'up' | 'down', event: Event): void {
    event.preventDefault();
    this.currentCommand = this.terminalService.navigateHistory(direction);
    
    // Move cursor to end
    setTimeout(() => {
      if (this.commandInput) {
        const el = this.commandInput.nativeElement;
        el.selectionStart = el.selectionEnd = el.value.length;
      }
    });
  }

  async onRightClick(event: MouseEvent): Promise<void> {
    // If user has selected text, allow default context menu (copy)
    if (window.getSelection()?.toString()) {
      return;
    }

    event.preventDefault();

    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;

      // Insert at cursor position
      const input = this.commandInput.nativeElement;
      const start = input.selectionStart ?? this.currentCommand.length;
      const end = input.selectionEnd ?? start;

      this.currentCommand = 
        this.currentCommand.substring(0, start) + 
        text + 
        this.currentCommand.substring(end);

      setTimeout(() => {
        input.focus();
        input.selectionStart = input.selectionEnd = start + text.length;
      });
    } catch (err) {
      console.warn('Clipboard access denied', err);
    }
  }

  linkify(text: string): SafeHtml {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const linkedText = text.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank" style="color: #00bcd4; text-decoration: underline;">${url}</a>`;
    });
    return this.sanitizer.bypassSecurityTrustHtml(linkedText);
  }

  private scrollToBottom(): void {
    if (this.terminalBody) {
      this.terminalBody.nativeElement.scrollTop = this.terminalBody.nativeElement.scrollHeight;
    }
  }
}
