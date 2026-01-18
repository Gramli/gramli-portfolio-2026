import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PortfolioService } from '../../core/services/portfolio.service';
import { Observable, firstValueFrom } from 'rxjs';
import { Profile } from '../../core/models/portfolio.models';
import { StationComponent } from '../../core/components/station/station.component';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule, StationComponent],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss']
})
export class ContactComponent {
  profile$: Observable<Profile>;

  constructor(private portfolioService: PortfolioService) {
    this.profile$ = this.portfolioService.getProfile();
  }
}
