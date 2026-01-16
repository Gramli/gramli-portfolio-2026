import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PortfolioService } from '../../core/services/portfolio.service';
import { Observable, firstValueFrom } from 'rxjs';
import { Profile } from '../../core/models/portfolio.models';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss']
})
export class ContactComponent {
  profile$: Observable<Profile>;
  
  formData = {
    name: '',
    email: '',
    message: ''
  };

  constructor(private portfolioService: PortfolioService) {
    this.profile$ = this.portfolioService.getProfile();
  }

  async onSubmit() {
    const profile = await firstValueFrom(this.profile$);
    
    const subject = `Transmission from ${this.formData.name || 'Anonymous'}`;
    const content = [
      `Sender ID: ${this.formData.name}`,
      `Reply Vector: ${this.formData.email}`,
      '',
      'Payload:',
      this.formData.message
    ].join('\n');
    
    const mailtoLink = `mailto:${profile.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(content)}`;
    window.location.href = mailtoLink;
  }
}
