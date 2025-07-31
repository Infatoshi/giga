import { ToolResult } from '../types';
import { loadApiKeys } from '../utils/api-keys';

export class PerplexityTool {
  private openRouterApiKey: string | null;

  constructor() {
    const apiKeys = loadApiKeys();
    this.openRouterApiKey = apiKeys.openRouterApiKey || process.env.OPENROUTER_API_KEY || null;
  }

  async search(query: string, maxResults: number = 10, summarize: boolean = true): Promise<ToolResult> {
    if (!this.openRouterApiKey) {
      return {
        success: false,
        error: 'OpenRouter API key is required for Perplexity search. Please configure it in /providers.'
      };
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://giga-code.dev',
          'X-Title': 'GIGA Code'
        },
        body: JSON.stringify({
          model: 'perplexity/sonar-pro',
          messages: [
            {
              role: 'system',
              content: `You are a helpful research assistant. Provide comprehensive, accurate, and up-to-date information based on web search results. Include relevant links and sources when possible. Structure your response clearly with headings and bullet points where appropriate.`
            },
            {
              role: 'user',
              content: query
            }
          ],
          max_tokens: 2000,
          temperature: 0.1,
          stream: false
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Perplexity search failed: ${response.status} ${response.statusText}\n${errorText}`
        };
      }

      const data = await response.json() as any;
      const searchResult = data.choices?.[0]?.message?.content;

      if (!searchResult) {
        return {
          success: false,
          error: 'No search results returned from Perplexity'
        };
      }

      // Create summary for user display
      let userSummary = '';
      try {
        const summaryResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${loadApiKeys().groqApiKey || process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              {
                role: 'system',
                content: 'Create a single concise sentence (max 100 chars) that captures the key finding from the search results. Be direct and actionable.'
              },
              {
                role: 'user',
                content: `Query: "${query}"\n\nSearch Results:\n${searchResult}\n\nOne-line summary:`
              }
            ],
            max_tokens: 50,
            temperature: 0.1
          })
        });

        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json() as any;
          userSummary = summaryData.choices?.[0]?.message?.content?.trim() || '';
        }
      } catch (error) {
        userSummary = 'Search completed successfully';
      }

      // Return structured result with both summary and full content
      return {
        success: true,
        output: `🔍 **Search Results for: "${query}"**\n\n${searchResult}`, // Full results for model context
        data: {
          userSummary: userSummary || `Found information about: ${query}`,
          query: query
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Perplexity search error: ${error.message}`
      };
    }
  }
}
