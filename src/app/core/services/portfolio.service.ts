import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Profile, Project, SkillCategory } from '../models/portfolio.models';
import { Observable, shareReplay, map } from 'rxjs';

interface PortfolioData {
  profile: Profile;
  projects: Project[];
  skills: SkillCategory[];
}

@Injectable({
  providedIn: 'root'
})
export class PortfolioService {
  private dataUrl = 'data/portfolio-data.json';
  private data$: Observable<PortfolioData>;

  constructor(private http: HttpClient) {
    this.data$ = this.http.get<PortfolioData>(this.dataUrl).pipe(
      shareReplay(1)
    );
  }

  getProfile(): Observable<Profile> {
    return this.data$.pipe(map(data => data.profile));
  }

  getProjects(): Observable<Project[]> {
    return this.data$.pipe(map(data => data.projects));
  }

  getSkills(): Observable<SkillCategory[]> {
    return this.data$.pipe(map(data => data.skills));
  }
}
