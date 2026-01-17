import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { JobAnalyzerService } from '../../core/services/job-analyzer.service';
import { FitAnalysisResult } from '../../core/models/job-fit.models';

@Component({
  selector: 'app-job-fit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './job-fit.component.html',
  styleUrls: ['./job-fit.component.scss']
})
export class JobFitComponent {
  jobDescription = '';
  isAnalyzing = signal(false);
  result = signal<FitAnalysisResult | null>(null);

  constructor(private analyzer: JobAnalyzerService) {}

  async analyze() {
    if (!this.jobDescription.trim()) return;

    this.isAnalyzing.set(true);
    this.result.set(null);

    try {
      const res = await this.analyzer.analyze(this.jobDescription);
      this.result.set(res);
    } catch (error) {
      console.error(error);
      alert('Analysis failed. Please check console.');
    } finally {
      this.isAnalyzing.set(false);
    }
  }

  download(format: 'txt' | 'md') {
    const res = this.result();
    if (!res) return;
    
    // Quick reusing logic (ideally shared, but simple enough to duplicate for now or I could make a util)
    const date = new Date().toISOString().split('T')[0];
    const filename = `fit_analysis_${date}.${format}`;
    let content = '';

    if (format === 'md') {
        content = `# Job Fit Analysis Report\nDate: ${date}\n\n`;
        content += `## Score: ${res.score}%\n`;
        content += `**Required Skills Coverage**: ${res.requiredSkillsCoverage}%\n`;
        content += `**Nice-to-Have Coverage**: ${res.niceToHaveSkillsCoverage}%\n\n`;
        content += `### Strengths\n${res.strengths.map(s => `- ${s}`).join('\n')}\n\n`;
        content += `### Gaps\n${res.gaps.map(g => `- ${g}`).join('\n')}\n\n`;
        content += `### Conclusion\n${res.conclusion}\n`;
    } else {
        content = `JOB FIT ANALYSIS REPORT\nDate: ${date}\n\n`;
        content += `SCORE: ${res.score}%\n`;
        content += `REQ SKILLS COVERAGE: ${res.requiredSkillsCoverage}%\n`;
        content += `NICE-TO-HAVE COVERAGE: ${res.niceToHaveSkillsCoverage}%\n\n`;
        content += `STRENGTHS:\n${res.strengths.map(s => `- ${s}`).join('\n')}\n\n`;
        content += `GAPS:\n${res.gaps.map(g => `- ${g}`).join('\n')}\n\n`;
        content += `CONCLUSION:\n${res.conclusion}\n`;
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
