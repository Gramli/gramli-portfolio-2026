import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { interval, map, take, startWith, tap } from 'rxjs';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loader.component.html',
  styleUrls: ['./loader.component.scss']
})
export class LoaderComponent {
  @Output() complete = new EventEmitter<void>();

  private steps = [
    { p: 20, t: 'LOADING CORE MODULES...' },
    { p: 45, t: 'ESTABLISHING SECURE CONNECTION...' },
    { p: 70, t: 'RETRIEVING ARCHIVES...' },
    { p: 90, t: 'DECRYPTING DATA...' },
    { p: 100, t: 'SYSTEM READY' }
  ];

  loadingState$ = interval(600).pipe(
    take(this.steps.length),
    map(index => this.steps[index]),
    startWith({ p: 0, t: 'INITIALIZING SYSTEM' }),
    tap({
      complete: () => {
        // Small delay to let the user see "100%" before hiding
        setTimeout(() => this.complete.emit(), 500);
      }
    })
  );
}
