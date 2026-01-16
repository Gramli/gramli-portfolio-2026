import { Component, ElementRef, ViewChild, AfterViewChecked, HostListener, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TerminalService } from '../../services/terminal.service';
import { TerminalLog } from '../../models/terminal.models';
import { PortfolioService } from '../../services/portfolio.service';
import { Observable } from 'rxjs';
import { Profile } from '../../models/portfolio.models';

@Component({
  selector: 'app-terminal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.scss']
})
export class TerminalComponent implements AfterViewChecked {
  @ViewChild('terminalBody') terminalBody!: ElementRef;
  @ViewChild('commandInput') commandInput!: ElementRef;

  isOpen: Signal<boolean>;
  logs: Signal<TerminalLog[]>;
  currentCommand = '';
  profile$: Observable<Profile>;

  constructor(
    private terminalService: TerminalService,
    private portfolioService: PortfolioService
  ) {
    this.isOpen = this.terminalService.isOpen;
    this.logs = this.terminalService.logs;
    this.profile$ = this.portfolioService.getProfile();
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
    if (this.isOpen() && this.commandInput) {
      this.commandInput.nativeElement.focus();
    }
  }

  close() {
    this.terminalService.toggle();
  }

  execute() {
    this.terminalService.executeCommand(this.currentCommand);
    this.currentCommand = '';
  }

  navigateHistory(direction: 'up' | 'down', event: Event) {
    event.preventDefault();
    const cmd = this.terminalService.getCommandHistory(direction);
    // Only update if we get a result (empty string is valid for "new line")
    // but the service logic returns current line if index moves back to end.
    // Let's rely on the service to return logic string.
    this.currentCommand = cmd;
    
    // Move cursor to end
    setTimeout(() => {
        if (this.commandInput) {
            const el = this.commandInput.nativeElement;
            el.selectionStart = el.selectionEnd = el.value.length;
        }
    });
  }

  private scrollToBottom() {
    if (this.terminalBody) {
      this.terminalBody.nativeElement.scrollTop = this.terminalBody.nativeElement.scrollHeight;
    }
  }

  // Basic linkifier for output
  linkify(text: string): string {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank" style="color: #00bcd4; text-decoration: underline;">${url}</a>`;
    });
  }
}
