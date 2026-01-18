import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoaderComponent } from '../loader/loader.component';
import { interval, map, takeWhile, startWith, finalize, shareReplay } from 'rxjs';

@Component({
  selector: 'app-system-boot-loader',
  standalone: true,
  imports: [CommonModule, LoaderComponent],
  template: `
    @if (state$ | async; as state) {
      <app-loader [progress]="state.progress" [message]="state.message"></app-loader>
    }
  `
})
export class SystemBootLoaderComponent {
  @Output() complete = new EventEmitter<void>();
  
  readonly state$ = interval(20).pipe(
    map(i => i + 1),
    takeWhile(p => p <= 100),
    map(p => ({
      progress: p,
      message: this.getLoadingText(p)
    })),
    startWith({ progress: 0, message: 'INITIALIZING SYSTEM...' }),
    shareReplay(1),
    finalize(() => {
      setTimeout(() => {
          this.complete.emit();
      }, 500);
    })
  );

  private getLoadingText(progress: number): string {
    if (progress < 20) return 'INITIALIZING SYSTEM...';
    if (progress < 45) return 'LOADING CORE MODULES...';
    if (progress < 70) return 'ESTABLISHING SECURE CONNECTION...';
    if (progress < 90) return 'RETRIEVING ARCHIVES...';
    if (progress < 100) return 'DECRYPTING DATA...';
    return 'SYSTEM READY';
  }
}
