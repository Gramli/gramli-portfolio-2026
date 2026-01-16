import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { LoaderComponent } from '../../core/components/loader/loader.component';
import { PortfolioService } from '../../core/services/portfolio.service';
import { Observable } from 'rxjs';
import { Profile } from '../../core/models/portfolio.models';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, LoaderComponent],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayoutComponent {
  isMenuOpen = false;
  isLoading = true;
  profile$: Observable<Profile>;

  constructor(private portfolioService: PortfolioService) {
    this.profile$ = this.portfolioService.getProfile();
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
}

