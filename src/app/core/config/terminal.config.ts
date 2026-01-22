export enum TerminalCommandId {
  Help = 'HELP',
  Clear = 'CLEAR',
  Exit = 'EXIT',
  Plog = 'PLOG',
  Kill = 'KILL',
  Ai = 'AI',
  Fit = 'FIT',
  Resume = 'RESUME'
}

export type CommandCategory = 'portfolio' | 'system';

export interface CommandDefinition {
  trigger: string;
  description: string;
  category: CommandCategory;
}

export const TERMINAL_CONFIG = {
  system: {
    welcomeMessages: [
      'Initializing System Interface v2.0.26...',
      'Connection established.',
      'Type "{help}" for a list of available commands.'
    ],
    prompt: '>',
    shutdownSequence: []
  },
  commands: {
    [TerminalCommandId.Help]: {
      trigger: 'help',
      description: 'Displays a list of available commands',
      category: 'system'
    },
    [TerminalCommandId.Clear]: {
      trigger: 'cls',
      description: 'Clears terminal output',
      category: 'system'
    },
    [TerminalCommandId.Exit]: {
      trigger: 'exit',
      description: 'Closes the terminal modal',
      category: 'system'
    },
    [TerminalCommandId.Plog]: {
      trigger: 'plog',
      description: 'System log stream. Usage: plog',
      category: 'portfolio'
    },
    [TerminalCommandId.Kill]: {
      trigger: 'kill',
      description: 'Reloads the system interface. Usage: kill or kill --seconds [number]',
      category: 'system'
    },
    [TerminalCommandId.Ai]: {
      trigger: 'ai',
      description: 'Query the AI Assistant. Usage: ai [your question]',
      category: 'portfolio'
    },
    [TerminalCommandId.Fit]: {
      trigger: 'fit-analyze',
      description: 'Job Fit Analyzer. Usage: fit-analyze [job description text]',
      category: 'portfolio'
    },
    [TerminalCommandId.Resume]: {
      trigger: 'resume',
      description: 'Downloads the resume file',
      category: 'portfolio'
    }
  } as Record<TerminalCommandId, CommandDefinition>,
  messages: {
    commandNotFound: 'System failure - command not found',
    usagePrefix: 'Usage: ',
    invalidFormat: 'Invalid format.',
    processing: 'Processing...',
    done: 'Done.',
    failed: 'Failed.'
  }
};
