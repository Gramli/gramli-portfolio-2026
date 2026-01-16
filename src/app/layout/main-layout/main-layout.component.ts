import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { LoaderComponent } from '../../core/components/loader/loader.component';
import { TerminalComponent } from '../../core/components/terminal/terminal.component';
import { PortfolioService } from '../../core/services/portfolio.service';
import { VisitorInfoService, VisitorInfo } from '../../core/services/visitor-info.service';
import { TerminalService } from '../../core/services/terminal.service';
import { Observable } from 'rxjs';
import { Profile } from '../../core/models/portfolio.models';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, LoaderComponent, TerminalComponent],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayoutComponent implements OnInit {
  isMenuOpen = false;
  isLoading = true;
  profile$: Observable<Profile>;
  visitorInfo!: VisitorInfo;

  constructor(
    private portfolioService: PortfolioService,
    private visitorService: VisitorInfoService,
    private terminalService: TerminalService
  ) {
    this.profile$ = this.portfolioService.getProfile();
  }

  async ngOnInit() {
    this.visitorInfo = await this.visitorService.getVisitorInfo();
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu() {
    this.isMenuOpen = false;
  }

  onLoaderComplete() {
    this.isLoading = false;
  }

  openTerminal() {
    this.terminalService.toggle();
  }
}

