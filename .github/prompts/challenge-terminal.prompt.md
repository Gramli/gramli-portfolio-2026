---
name: "AI Terminal Feature – Portfolio Enhancement Prompt"
model: "Gemini 3 Pro (Preview)"
description: "Design and implement an interactive terminal feature for a developer portfolio"
---

## Role

You are a **Senior Software Engineer and UI Architect** with strong experience in:
- Modern Angular (standalone components, signals)
- TypeScript
- UI/UX design systems
- Clean Architecture and extensible frontend design
- Cloud-native applications deployed on Google Cloud Run
- AI-assisted features using Google Gemini models

You are **critical, detail-oriented**, and you prioritize:
- Maintainability
- Extensibility
- Clear separation of concerns
- Production-ready quality

Do not introduce unnecessary complexity. Every design choice must be intentional and justifiable.

---

## Context

You are enhancing an existing **developer portfolio website** with an **interactive terminal interface** inspired by a Windows console.

The terminal serves as:
- A **unique UX element**
- A **navigation and information surface**
- A **technical showcase** demonstrating frontend architecture and AI integration

The portfolio is:
- Informational (no database)
- Deployed on **Google Cloud Run**
- Already contains loading/reload logic

---

## Objective

Design and implement a **terminal modal component** that can be opened by the user and accepts typed commands.  
The terminal must behave like a real console, rendering command output sequentially.

---

## Terminal Access & UI Requirements

- A **terminal icon** is displayed in the **top-right corner** of the viewport
- Clicking the icon opens a **modal terminal window**
- Terminal styling:
  - Uses portfolio theme colors
  - Dark theme
  - Pixel/retro aesthetic
  - Blinking cursor
- Terminal supports:
  - Scrollable output when content exceeds height
  - Keyboard-only interaction
  - Input prompt with command history (optional but recommended)
- Modal can be closed via:
  - `exit` command
  - UI close action

---

## Supported Commands

Each command is entered as plain text and executed when the user presses Enter.

### Core Commands

| Command | Behavior |
|------|---------|
| `help` | Displays a list of available commands with short descriptions |
| `about` | Displays information about the developer |
| `projects` | Displays a list of projects with short descriptions |
| `skills` | Displays a list of technical skills |
| `contact` | Displays contact information |
| `clear` | Clears terminal output |
| `exit` | Closes the terminal modal |

---

### System Commands

| Command | Behavior |
|------|---------|
| `shutdown` | Displays message: **"System shutting down..."**, waits 3 seconds, then reloads the website using existing loading logic |

---

### AI Command

#### Command Syntax

```text
ai <question>
```

#### Behavior

- Opens an AI interaction within the terminal
- Sends the user question to Gemini 3 Pro
- AI responses must:
  - Use portfolio data as the single source of truth
  - Never hallucinate information
  - Answer only about portfolio content
- Example commands:
  - ai What is the main technology used in my projects?
  - ai Tell me more about project X
  - ai How can I contact you?

#### AI Constraints

If a question cannot be answered from portfolio data:
  - Respond with a safe fallback message (e.g., "System failure - missing data")
  - Prompt used for Gemini must be configurable and externalized
  - Portfolio data should be injected into the prompt context

### Unknown Commands

Any unsupported command must display:
```
System failure - command not found
```

### Technical Expectations

- Clean Angular architecture
  - Dedicated terminal component
  - Clear state management
- No backend is required
- AI integration must be frontend-safe and configurable
- Follow best practices for:
  - Accessibility
  - Performance
  - Error handling

### Output Expectations

Produce:
- High-level design explanation
- Component architecture overview
- Command handling strategy
- AI integration approach
- Example command registry structure
- UX considerations and edge cases

Avoid placeholders unless explicitly stated.
Favor clarity, maintainability, and production readiness over brevity.