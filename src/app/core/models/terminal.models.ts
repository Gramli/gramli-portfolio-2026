export interface TerminalCommand {
  command: string;
  description: string;
  category: 'portfolio' | 'system';
  action: (args: string[]) => void | Promise<void>;
}

export interface TerminalLog {
  type: 'input' | 'output' | 'system' | 'error' | 'ai';
  content: string;
  timestamp: Date;
}
