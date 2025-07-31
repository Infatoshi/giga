export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  data?: any;
  metadata?: {
    userSummary?: string;
    query?: string;
    [key: string]: any;
  };
}

export interface Tool {
  name: string;
  description: string;
  execute: (...args: any[]) => Promise<ToolResult>;
}

export interface EditorCommand {
  command: 'view' | 'str_replace' | 'create' | 'insert' | 'undo_edit';
  path?: string;
  old_str?: string;
  new_str?: string;
  content?: string;
  insert_line?: number;
  view_range?: [number, number];
}

export interface AgentState {
  currentDirectory: string;
  editHistory: EditorCommand[];
  tools: Tool[];
}

export interface ConfirmationState {
  skipThisSession: boolean;
  pendingOperation: boolean;
}

export enum AgentMode {
  PLAN = 'plan',
  CHILL = 'chill', 
  GIGA = 'giga'
}

export interface ModeConfig {
  mode: AgentMode;
  allowExpertModels: boolean;
  requireConfirmation: boolean;
  displayName: string;
  description: string;
}