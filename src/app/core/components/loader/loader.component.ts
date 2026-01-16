import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { interval, map, takeWhile, startWith, tap } from 'rxjs';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loader.component.html',
  styleUrls: ['./loader.component.scss']
})
export class LoaderComponent {
  @Output() complete = new EventEmitter<void>();

  private getLoadingText(progress: number): string {
    if (progress < 20) return 'INITIALIZING SYSTEM...';
    if (progress < 45) return 'LOADING CORE MODULES...';
    if (progress < 70) return 'ESTABLISHING SECURE CONNECTION...';
    if (progress < 90) return 'RETRIEVING ARCHIVES...';
    if (progress < 100) return 'DECRYPTING DATA...';
    return 'SYSTEM READY';
  }

  loadingState$ = interval(20).pipe(
    map(i => i + 1),
    takeWhile(p => p <= 100),
    map(p => ({
      p: p,
      t: this.getLoadingText(p)
    })),
    startWith({ p: 0, t: 'INITIALIZING SYSTEM' }),
    tap({
      complete: () => {
        // Small delay to let the user see "100%" before hiding
        setTimeout(() => this.complete.emit(), 500);
      }
    })
  );
}
