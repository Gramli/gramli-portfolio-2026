# Job Fit Analyzer — AI-Assisted Technical Matching Feature

## Purpose
Implement a “Job Fit Analyzer” feature that allows recruiters to paste a job description and receive a **transparent, data-driven fit analysis** based exclusively on the portfolio’s structured data (skills, projects, experience).

This feature must feel analytical, honest, and explainable — not promotional.

The Job Fit Analyzer is accessible from:
- Main navigation menu (before Contacts)
- Terminal command: `fit analyze`

---

## Core Principles
- Portfolio data is the **single source of truth**
- AI assists with **parsing and normalization only**
- Final scoring is **rule-based, weighted, and explainable**
- Gaps and weaknesses must be explicitly reported
- Output must be deterministic and reproducible

---

## User Interfaces

### 1. UI (Form-Based)
- Layout and styling must match the existing Contact form
- Fields:
  - Textarea: “Job Description”
  - Submit button
- On submit:
  - Open modal window
  - Show loader with message: “Analyzing data…”
- After analysis:
  - Display structured results
  - Allow export to file:
    - TXT
    - Markdown (MD)

---

### 2. Terminal Interface
Command:
`fit analyze`

Flow:
1. Prompt user to paste job description
2. Display analysis progress in terminal output
3. Print results directly in terminal
4. After completion:
   - Ask: “Do you want to export the result? (y/n)”
   - If yes, ask for format: txt or md
   - Generate and download file

---

## AI Usage and Responsibilities

### AI Model
- Gemini Pro
- Communication handled via existing `ai.service.ts`

### AI Responsibilities
Gemini is used strictly for:
- Parsing job description text
- Extracting:
  - Required skills
  - Nice-to-have skills
  - Years of experience expectations
  - Key responsibilities and domains
- Normalizing terminology:
  - Synonyms
  - Skill aliases
  - Technology naming variations

Gemini MUST NOT:
- Invent skills or experience
- Assign final scores
- Inflate results
- Make hiring claims

---

## Matching & Scoring Logic (Mandatory Transparency)

Scoring is deterministic and calculated by the application logic, not the AI.

### Weights

**Required skills**
- Present → +10
- Expert-level → +15
- Used in at least one project → +5
- Missing → -10

**Nice-to-have skills**
- Present → +5
- Missing → -2

**Experience**
- +1 point per year of experience (max 10)
- Missing experience → -2 per missing year (max -10)

**Project relevance**
- +10 if a project clearly matches key job responsibilities

Final score must be normalized to a 0–100% range.

---

## Output Structure (Strict)

### Example Output

Match score: 82%

Required skills coverage: 90%  
Nice-to-have skills coverage: 40%

**Strengths**
- .NET (11 years, multiple production systems)
- REST APIs (AuthApi, FileApi)
- Cloud deployment and CI/CD experience

**Gaps**
- Kubernetes (limited hands-on exposure)
- GraphQL (no production usage)

**Conclusion**
Strong technical fit with identifiable and learnable gaps.

---

## Output Requirements
- Tone must be neutral, analytical, and professional
- No marketing language
- No exaggerated claims
- No guarantees of suitability
- Include a brief disclaimer that analysis is indicative only

---

## Extensibility Requirements
- Adding new scoring rules must not require AI changes
- Portfolio data structure must remain reusable
- Future enhancements (e.g. role comparison, multiple JDs) should be possible without redesign

---

## Quality Bar
This feature should feel like:
- A lightweight technical assessment tool
- A conversation starter for interviews
- A demonstration of structured thinking, not self-promotion
