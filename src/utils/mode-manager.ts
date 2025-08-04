import { AgentMode, ModeConfig } from '../types';

export class ModeManager {
  private static instance: ModeManager;
  private currentMode: AgentMode = AgentMode.CHILL;
  private modeConfigs: Record<AgentMode, ModeConfig> = {
    [AgentMode.PLAN]: {
      mode: AgentMode.PLAN,
      allowExpertModels: false,
      requireConfirmation: false,
      displayName: '📋 PLAN MODE',
      description: 'Planning and thinking only - no expert models'
    },
    [AgentMode.CHILL]: {
      mode: AgentMode.CHILL,
      allowExpertModels: true,
      requireConfirmation: true,
      displayName: '😌 CHILL MODE',
      description: 'All models available - asks permission for tool calls'
    },
    [AgentMode.GIGA]: {
      mode: AgentMode.GIGA,
      allowExpertModels: true,
      requireConfirmation: false,
      displayName: '⚡ GIGA MODE',
      description: 'Full power - no permission requests'
    }
  };

  private constructor() {}

  static getInstance(): ModeManager {
    if (!ModeManager.instance) {
      ModeManager.instance = new ModeManager();
    }
    return ModeManager.instance;
  }

  getCurrentMode(): AgentMode {
    return this.currentMode;
  }

  getCurrentModeConfig(): ModeConfig {
    return this.modeConfigs[this.currentMode];
  }

  getAllModes(): AgentMode[] {
    return [AgentMode.PLAN, AgentMode.CHILL, AgentMode.GIGA];
  }

  cycleMode(): AgentMode {
    const modes = this.getAllModes();
    const currentIndex = modes.indexOf(this.currentMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    this.currentMode = modes[nextIndex];
    return this.currentMode;
  }

  setMode(mode: AgentMode): void {
    this.currentMode = mode;
  }

  shouldAllowExpertModels(): boolean {
    return this.modeConfigs[this.currentMode].allowExpertModels;
  }

  shouldRequireConfirmation(): boolean {
    return this.modeConfigs[this.currentMode].requireConfirmation;
  }

  getModeDisplayName(): string {
    return this.modeConfigs[this.currentMode].displayName;
  }

  getModeDescription(): string {
    return this.modeConfigs[this.currentMode].description;
  }
}

export const modeManager = ModeManager.getInstance();