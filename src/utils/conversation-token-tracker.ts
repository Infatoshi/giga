import { TokenCounter, createTokenCounter } from './token-counter';

interface ConversationTokenTrackerOptions {
  model: string;
  maxTokens: number;
}

export class ConversationTokenTracker {
  private readonly model: string;
  private readonly maxTokens: number;
  private currentTokens: number = 0;
  private tokenCounter: TokenCounter;
  private conversationId: string | null = null;

  constructor(options: ConversationTokenTrackerOptions) {
    this.model = options.model;
    this.maxTokens = options.maxTokens;
    this.tokenCounter = createTokenCounter(this.model);
  }

  public startNewConversation(conversationId: string) {
    this.conversationId = conversationId;
    this.reset();
  }

  public addTokens(text: string): number {
    const tokenCount = this.tokenCounter.countTokens(text);
    this.currentTokens += tokenCount;
    return tokenCount;
  }

  public reset() {
    this.currentTokens = 0;
  }

  public get a() {
    return {
      current: this.currentTokens,
      max: this.maxTokens,
      percentage: (this.currentTokens / this.maxTokens) * 100,
      model: this.model,
      conversationId: this.conversationId,
    };
  }

  public dispose() {
    this.tokenCounter.dispose();
  }
}