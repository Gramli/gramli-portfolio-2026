export interface TerminalCommand {
  command: string;
  description: string;
  action: (args: string[]) => void | Promise<void>;
}

export interface TerminalLog {
  type: 'input' | 'output' | 'system' | 'error';
  content: string;
  timestamp: Date;
}
