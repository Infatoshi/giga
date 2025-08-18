import { ChatEntry } from "../agent/giga-agent";
import { expertModelsManager } from "./expert-models-manager";
import { GigaClient } from "../giga/client";
import { getAllTools } from "../giga/tools";

export type ExpertType = 'fast' | 'code' | 'reasoning' | 'tools';

export interface RoutingDecision {
  expertType: ExpertType;
  confidence: number;
  reasoning?: string;
}

export interface ExpertRouterStats {
  totalRequests: number;
  routingCounts: Record<ExpertType, number>;
  averageConfidence: number;
  lastDecisions: Array<{
    input: string;
    decision: ExpertType;
    confidence: number;
    timestamp: Date;
  }>;
}

export class ExpertRouter {
  private static instance: ExpertRouter;
  private gigaClient: GigaClient | null = null;
  private stats: ExpertRouterStats = {
    totalRequests: 0,
    routingCounts: { fast: 0, code: 0, reasoning: 0, tools: 0 },
    averageConfidence: 0,
    lastDecisions: []
  };
  private debugMode = false;

  private constructor() {}

  static getInstance(): ExpertRouter {
    if (!ExpertRouter.instance) {
      ExpertRouter.instance = new ExpertRouter();
    }
    return ExpertRouter.instance;
  }

  setGigaClient(client: GigaClient): void {
    this.gigaClient = client;
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  getStats(): ExpertRouterStats {
    return { ...this.stats };
  }

  private getRoutingSystemPrompt(): string {
    return `You are an expert request router. Your job is to categorize user requests into ONE of these categories:

FAST: Simple information requests, quick answers, file viewing, basic commands
- Examples: "what is X?", "show me package.json", "list files", "explain this briefly"
- Characteristics: Direct questions, simple explanations, file operations, basic summaries

CODE: Software development tasks - writing, editing, debugging, refactoring code
- Examples: "fix this bug", "create a React component", "add error handling", "refactor function"  
- Characteristics: Programming tasks, code modifications, technical implementations

REASONING: Complex analysis, planning, architecture design, problem-solving
- Examples: "design a system for X", "plan the implementation", "analyze this approach", "break down this task"
- Characteristics: Multi-step thinking, strategic planning, architectural decisions, complex analysis

TOOLS: Multi-tool workflows, external integrations, complex orchestration
- Examples: "search docs and implement", "fetch data and process it", "use multiple APIs", "complex workflows"
- Characteristics: Requires multiple tools, external data, complex pipelines, orchestration

Respond with ONLY this JSON format:
{
  "expertType": "fast|code|reasoning|tools",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;
  }

  async routeRequest(userInput: string, context: ChatEntry[] = []): Promise<RoutingDecision> {
    const expertConfig = expertModelsManager.getExpertModelsConfig();
    
    // If experts not enabled, use fallback heuristics instead of defaulting to fast
    if (!expertConfig.enabled || !this.gigaClient) {
      const fallbackDecision = this.fallbackRouting(userInput);
      fallbackDecision.reasoning = `Expert routing disabled - ${fallbackDecision.reasoning}`;
      return fallbackDecision;
    }

    try {
      // Use the current model to make routing decision (should be fast model ideally)
      const routingMessages = [
        { role: 'system', content: this.getRoutingSystemPrompt() },
        { role: 'user', content: `Categorize this request: "${userInput}"` }
      ];

      const response = await this.gigaClient.chat(routingMessages as any, []);
      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No response from routing model');
      }

      // Parse JSON response
      const decision: RoutingDecision = JSON.parse(content.trim());
      
      // Validate response
      if (!['fast', 'code', 'reasoning', 'tools'].includes(decision.expertType)) {
        throw new Error(`Invalid expert type: ${decision.expertType}`);
      }

      // Update stats
      this.updateStats(userInput, decision);

      if (this.debugMode) {
        console.log(`[EXPERT ROUTER] "${userInput}" → ${decision.expertType.toUpperCase()} (confidence: ${decision.confidence.toFixed(2)}) - ${decision.reasoning}`);
      }

      return decision;

    } catch (error) {
      console.warn('Expert routing failed, falling back to reasoning:', error);
      
      // Fallback to simple heuristics
      const fallbackDecision = this.fallbackRouting(userInput);
      this.updateStats(userInput, fallbackDecision);
      
      return fallbackDecision;
    }
  }

  private fallbackRouting(userInput: string): RoutingDecision {
    const input = userInput.toLowerCase();
    
    // Simple information requests (prioritize these first)
    if (/\b(what\s+is|what\s+are|explain|show\s+me|tell\s+me\s+about|describe)\b/.test(input)) {
      return { expertType: 'fast', confidence: 0.8, reasoning: 'Fallback: informational query detected' };
    }
    
    // Code implementation keywords
    if (/\b(create|implement|build|write|add|fix|refactor|debug)\s+.*(function|class|component|code|bug|error)\b/.test(input)) {
      return { expertType: 'code', confidence: 0.8, reasoning: 'Fallback: code implementation detected' };
    }
    
    // Reasoning keywords  
    if (/\b(plan|design|architecture|analyze|strategy|approach|think|consider|decide|complex|system)\b/.test(input)) {
      return { expertType: 'reasoning', confidence: 0.8, reasoning: 'Fallback: reasoning keywords detected' };
    }
    
    // Tools keywords
    if (/\b(search|fetch|api|integrate|workflow|multiple|external|process|pipeline)\b/.test(input)) {
      return { expertType: 'tools', confidence: 0.8, reasoning: 'Fallback: tools keywords detected' };
    }
    
    // Default to fast for simple requests
    return { expertType: 'fast', confidence: 0.7, reasoning: 'Fallback: default to fast' };
  }

  private updateStats(input: string, decision: RoutingDecision): void {
    this.stats.totalRequests++;
    this.stats.routingCounts[decision.expertType]++;
    
    // Update average confidence
    this.stats.averageConfidence = (this.stats.averageConfidence * (this.stats.totalRequests - 1) + decision.confidence) / this.stats.totalRequests;
    
    // Add to recent decisions (keep last 20)
    this.stats.lastDecisions.unshift({
      input: input.substring(0, 100), // Truncate long inputs
      decision: decision.expertType,
      confidence: decision.confidence,
      timestamp: new Date()
    });
    
    if (this.stats.lastDecisions.length > 20) {
      this.stats.lastDecisions.pop();
    }
  }

  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      routingCounts: { fast: 0, code: 0, reasoning: 0, tools: 0 },
      averageConfidence: 0,
      lastDecisions: []
    };
  }
}

// Export singleton instance
export const expertRouter = ExpertRouter.getInstance();