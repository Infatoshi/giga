import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { ChatEntry } from '../agent/giga-agent';
import { loadApiKeys } from './api-keys';

export interface SavedConversation {
  id: string;
  title: string;
  messages: ChatEntry[];
  createdAt: Date;
  updatedAt: Date;
  model: string;
  messageCount: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  model: string;
  messageCount: number;
  preview: string; // First user message preview
}

export class ConversationManager {
  private static instance: ConversationManager;
  private conversationsDir: string;

  private constructor() {
    this.conversationsDir = path.join(os.homedir(), '.giga', 'conversations');
  }

  static getInstance(): ConversationManager {
    if (!ConversationManager.instance) {
      ConversationManager.instance = new ConversationManager();
    }
    return ConversationManager.instance;
  }

  private async ensureConversationsDir(): Promise<void> {
    try {
      await fs.mkdir(this.conversationsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create conversations directory:', error);
    }
  }

  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getConversationPath(id: string): string {
    return path.join(this.conversationsDir, `${id}.json`);
  }

  async generateTitle(messages: ChatEntry[]): Promise<string> {
    const apiKeys = loadApiKeys();
    const groqApiKey = apiKeys.groqApiKey || process.env.GROQ_API_KEY;

    if (!groqApiKey) {
      // Fallback to first user message if no API key
      const firstUserMessage = messages.find(m => m.type === 'user');
      return firstUserMessage?.content.slice(0, 50) + '...' || 'Untitled Conversation';
    }

    try {
      // Get first few meaningful messages for context
      const contextMessages = messages
        .filter(m => m.type === 'user' || m.type === 'assistant')
        .slice(0, 6)
        .map(m => `${m.type}: ${m.content}`)
        .join('\n');

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'Generate a concise 3-6 word title for this coding conversation. Focus on the main task/topic. Examples: "React Component Bug Fix", "Database Schema Design", "API Integration Setup".'
            },
            {
              role: 'user',
              content: `Conversation:\n${contextMessages}\n\nTitle:`
            }
          ],
          max_tokens: 20,
          temperature: 0.1
        })
      });

      if (response.ok) {
        const data = await response.json() as any;
        const title = data.choices?.[0]?.message?.content?.trim();
        if (title && title.length > 0) {
          return title.replace(/['"]/g, ''); // Remove quotes if any
        }
      }
    } catch (error) {
      console.error('Failed to generate title:', error);
    }

    // Fallback to first user message
    const firstUserMessage = messages.find(m => m.type === 'user');
    return firstUserMessage?.content.slice(0, 50) + '...' || 'Untitled Conversation';
  }

  async saveConversation(messages: ChatEntry[], model: string, existingId?: string): Promise<string> {
    await this.ensureConversationsDir();

    const id = existingId || this.generateConversationId();
    const now = new Date();
    
    // Generate title if this is a new conversation or if it doesn't have many messages yet
    let title = 'New Conversation';
    if (messages.length >= 2) {
      title = await this.generateTitle(messages);
    }

    const conversation: SavedConversation = {
      id,
      title,
      messages,
      createdAt: existingId ? (await this.loadConversation(id))?.createdAt || now : now,
      updatedAt: now,
      model,
      messageCount: messages.filter(m => m.type === 'user' || m.type === 'assistant').length
    };

    const filePath = this.getConversationPath(id);
    await fs.writeFile(filePath, JSON.stringify(conversation, null, 2));
    return id;
  }

  async loadConversation(id: string): Promise<SavedConversation | null> {
    try {
      const filePath = this.getConversationPath(id);
      const data = await fs.readFile(filePath, 'utf-8');
      const conversation = JSON.parse(data);
      
      // Convert date strings back to Date objects
      conversation.createdAt = new Date(conversation.createdAt);
      conversation.updatedAt = new Date(conversation.updatedAt);
      conversation.messages = conversation.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));

      return conversation;
    } catch (error) {
      console.error(`Failed to load conversation ${id}:`, error);
      return null;
    }
  }

  async listConversations(): Promise<ConversationSummary[]> {
    await this.ensureConversationsDir();

    try {
      const files = await fs.readdir(this.conversationsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      const summaries: ConversationSummary[] = [];

      for (const file of jsonFiles) {
        try {
          const id = file.replace('.json', '');
          const conversation = await this.loadConversation(id);
          
          if (conversation) {
            const firstUserMessage = conversation.messages.find(m => m.type === 'user');
            const preview = firstUserMessage?.content.slice(0, 100) + '...' || 'No messages';

            summaries.push({
              id: conversation.id,
              title: conversation.title,
              createdAt: conversation.createdAt,
              updatedAt: conversation.updatedAt,
              model: conversation.model,
              messageCount: conversation.messageCount,
              preview
            });
          }
        } catch (error) {
          console.error(`Failed to process conversation file ${file}:`, error);
        }
      }

      // Sort by most recently updated first
      return summaries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch (error) {
      console.error('Failed to list conversations:', error);
      return [];
    }
  }

  async deleteConversation(id: string): Promise<boolean> {
    try {
      const filePath = this.getConversationPath(id);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error(`Failed to delete conversation ${id}:`, error);
      return false;
    }
  }

  async searchConversations(query: string): Promise<ConversationSummary[]> {
    const allConversations = await this.listConversations();
    
    if (!query.trim()) {
      return allConversations;
    }

    const lowerQuery = query.toLowerCase();
    
    return allConversations.filter(conv => 
      conv.title.toLowerCase().includes(lowerQuery) ||
      conv.preview.toLowerCase().includes(lowerQuery)
    );
  }
}