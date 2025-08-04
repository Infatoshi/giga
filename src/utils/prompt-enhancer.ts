import * as path from 'path';

export interface EnhancedPrompt {
  originalPrompt: string;
  enhancedPrompt: string;
  extractedFiles: string[];
  extractedKeywords: string[];
  detectedIntent: PromptIntent;
  suggestedSearchQueries: string[];
  confidence: number;
}

export enum PromptIntent {
  SEARCH = 'search',
  FILE_OPERATION = 'file_operation',
  CODE_ANALYSIS = 'code_analysis',
  ERROR_FIXING = 'error_fixing',
  FEATURE_REQUEST = 'feature_request',
  DOCUMENTATION = 'documentation',
  REFACTORING = 'refactoring',
  TESTING = 'testing',
  DEBUGGING = 'debugging',
  GENERAL = 'general'
}

export class PromptEnhancer {
  private static readonly FILE_PATTERNS = [
    // Explicit file mentions
    /(?:^|\s)([a-zA-Z0-9_\-\.\/\\]+\.[a-zA-Z0-9]+)(?:\s|$)/g,
    // File paths with directories
    /(?:^|\s)([a-zA-Z0-9_\-]+\/[a-zA-Z0-9_\-\.\/]+)(?:\s|$)/g,
    // Relative paths
    /(?:^|\s)(\.[\.\/][a-zA-Z0-9_\-\.\/\\]+)(?:\s|$)/g
  ];

  private static readonly ERROR_PATTERNS = [
    /error:?\s*(.+)/i,
    /exception:?\s*(.+)/i,
    /failed:?\s*(.+)/i,
    /issue:?\s*(.+)/i,
    /problem:?\s*(.+)/i,
    /bug:?\s*(.+)/i,
    /broken:?\s*(.+)/i,
    /not working:?\s*(.+)/i,
    /doesn't work:?\s*(.+)/i,
    /can't:?\s*(.+)/i,
    /unable to:?\s*(.+)/i
  ];

  private static readonly INTENT_KEYWORDS = {
    [PromptIntent.SEARCH]: [
      'find', 'search', 'look for', 'where is', 'locate', 'show me', 'get', 'fetch'
    ],
    [PromptIntent.FILE_OPERATION]: [
      'create', 'delete', 'move', 'rename', 'copy', 'file', 'folder', 'directory'
    ],
    [PromptIntent.CODE_ANALYSIS]: [
      'analyze', 'review', 'examine', 'understand', 'explain', 'show me', 'what does', 'how does'
    ],
    [PromptIntent.ERROR_FIXING]: [
      'fix', 'error', 'bug', 'issue', 'problem', 'broken', 'not working', 'exception', 'failed'
    ],
    [PromptIntent.FEATURE_REQUEST]: [
      'add', 'implement', 'create', 'build', 'make', 'feature', 'functionality', 'new'
    ],
    [PromptIntent.DOCUMENTATION]: [
      'document', 'docs', 'readme', 'comment', 'explain', 'describe', 'write docs'
    ],
    [PromptIntent.REFACTORING]: [
      'refactor', 'cleanup', 'improve', 'optimize', 'restructure', 'reorganize', 'simplify'
    ],
    [PromptIntent.TESTING]: [
      'test', 'testing', 'spec', 'unit test', 'integration test', 'jest', 'mocha', 'cypress'
    ],
    [PromptIntent.DEBUGGING]: [
      'debug', 'trace', 'log', 'console', 'breakpoint', 'inspect', 'investigate'
    ]
  };

  private static readonly TECH_KEYWORDS = [
    // Languages
    'typescript', 'javascript', 'python', 'java', 'cpp', 'c++', 'go', 'rust', 'php', 'ruby',
    // Frameworks
    'react', 'vue', 'angular', 'node', 'express', 'next', 'nuxt', 'svelte',
    // Libraries
    'lodash', 'axios', 'jest', 'mocha', 'webpack', 'babel', 'eslint', 'prettier',
    // Concepts
    'function', 'class', 'interface', 'type', 'component', 'service', 'util', 'helper',
    'api', 'endpoint', 'route', 'middleware', 'database', 'query', 'model', 'schema',
    'async', 'await', 'promise', 'callback', 'event', 'listener', 'handler',
    'import', 'export', 'module', 'package', 'dependency', 'config', 'env'
  ];

  static enhancePrompt(prompt: string, recentBashOutput?: string): EnhancedPrompt {
    const extractedFiles = this.extractFileReferences(prompt);
    const extractedKeywords = this.extractTechnicalKeywords(prompt);
    const detectedIntent = this.detectIntent(prompt);
    const errorContext = this.extractErrorContext(prompt, recentBashOutput);
    
    let enhancedPrompt = prompt;
    const suggestedSearchQueries: string[] = [];
    let confidence = 0.5;

    // Enhance based on detected intent
    switch (detectedIntent) {
      case PromptIntent.ERROR_FIXING:
        enhancedPrompt = this.enhanceErrorFixingPrompt(prompt, extractedFiles, errorContext);
        suggestedSearchQueries.push(...this.generateErrorSearchQueries(prompt, extractedFiles, errorContext));
        confidence = 0.8;
        break;
        
      case PromptIntent.CODE_ANALYSIS:
        enhancedPrompt = this.enhanceCodeAnalysisPrompt(prompt, extractedFiles, extractedKeywords);
        suggestedSearchQueries.push(...this.generateAnalysisSearchQueries(extractedFiles, extractedKeywords));
        confidence = 0.7;
        break;
        
      case PromptIntent.FEATURE_REQUEST:
        enhancedPrompt = this.enhanceFeatureRequestPrompt(prompt, extractedFiles, extractedKeywords);
        suggestedSearchQueries.push(...this.generateFeatureSearchQueries(extractedFiles, extractedKeywords));
        confidence = 0.6;
        break;
        
      case PromptIntent.FILE_OPERATION:
        enhancedPrompt = this.enhanceFileOperationPrompt(prompt, extractedFiles);
        suggestedSearchQueries.push(...this.generateFileSearchQueries(extractedFiles));
        confidence = 0.9;
        break;
        
      default:
        enhancedPrompt = this.enhanceGeneralPrompt(prompt, extractedFiles, extractedKeywords);
        suggestedSearchQueries.push(...this.generateGeneralSearchQueries(extractedFiles, extractedKeywords));
        confidence = 0.4;
    }

    return {
      originalPrompt: prompt,
      enhancedPrompt,
      extractedFiles,
      extractedKeywords,
      detectedIntent,
      suggestedSearchQueries,
      confidence
    };
  }

  private static extractFileReferences(prompt: string): string[] {
    const files: string[] = [];
    
    for (const pattern of this.FILE_PATTERNS) {
      let match;
      while ((match = pattern.exec(prompt)) !== null) {
        const file = match[1].trim();
        if (file && !files.includes(file)) {
          files.push(file);
        }
      }
    }
    
    return files;
  }

  private static extractTechnicalKeywords(prompt: string): string[] {
    const keywords: string[] = [];
    const lowerPrompt = prompt.toLowerCase();
    
    for (const keyword of this.TECH_KEYWORDS) {
      if (lowerPrompt.includes(keyword) && !keywords.includes(keyword)) {
        keywords.push(keyword);
      }
    }
    
    return keywords;
  }

  private static detectIntent(prompt: string): PromptIntent {
    const lowerPrompt = prompt.toLowerCase();
    const scores: Record<PromptIntent, number> = {
      [PromptIntent.SEARCH]: 0,
      [PromptIntent.FILE_OPERATION]: 0,
      [PromptIntent.CODE_ANALYSIS]: 0,
      [PromptIntent.ERROR_FIXING]: 0,
      [PromptIntent.FEATURE_REQUEST]: 0,
      [PromptIntent.DOCUMENTATION]: 0,
      [PromptIntent.REFACTORING]: 0,
      [PromptIntent.TESTING]: 0,
      [PromptIntent.DEBUGGING]: 0,
      [PromptIntent.GENERAL]: 0
    };

    // Score based on keyword matches
    for (const [intent, keywords] of Object.entries(this.INTENT_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerPrompt.includes(keyword)) {
          scores[intent as PromptIntent] += 1;
        }
      }
    }

    // Additional scoring based on patterns
    if (this.ERROR_PATTERNS.some(pattern => pattern.test(prompt))) {
      scores[PromptIntent.ERROR_FIXING] += 3;
    }

    // Search patterns - high priority for search intent
    if (/^(find|search|locate|get|fetch|look for|where is)\s+/i.test(prompt)) {
      scores[PromptIntent.SEARCH] += 5; // High score for search commands at start
    }
    
    if (/\b(find|search|locate)\s+\w+/i.test(prompt)) {
      scores[PromptIntent.SEARCH] += 3; // Search with target word
    }

    if (lowerPrompt.includes('?') && (lowerPrompt.includes('how') || lowerPrompt.includes('what'))) {
      scores[PromptIntent.CODE_ANALYSIS] += 2;
    }

    if (lowerPrompt.includes('pls') || lowerPrompt.includes('please')) {
      scores[PromptIntent.FEATURE_REQUEST] += 1;
    }

    // Find the intent with the highest score
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) {
      return PromptIntent.GENERAL;
    }

    const detectedIntent = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0];
    return (detectedIntent as PromptIntent) || PromptIntent.GENERAL;
  }

  private static extractErrorContext(prompt: string, bashOutput?: string): string[] {
    const errorContext: string[] = [];
    
    // Extract error information from prompt
    for (const pattern of this.ERROR_PATTERNS) {
      const match = pattern.exec(prompt);
      if (match && match[1]) {
        errorContext.push(match[1].trim());
      }
    }
    
    // Extract error information from recent bash output
    if (bashOutput) {
      const lines = bashOutput.split('\n');
      for (const line of lines) {
        if (line.includes('error:') || line.includes('Error:') || 
            line.includes('exception:') || line.includes('Exception:') ||
            line.includes('failed:') || line.includes('Failed:')) {
          errorContext.push(line.trim());
        }
      }
    }
    
    return errorContext;
  }

  private static enhanceErrorFixingPrompt(prompt: string, files: string[], errorContext: string[]): string {
    let enhanced = prompt;
    
    if (files.length > 0) {
      enhanced += `\n\nFiles to examine: ${files.join(', ')}`;
    }
    
    if (errorContext.length > 0) {
      enhanced += `\n\nError context: ${errorContext.join('; ')}`;
    }
    
    enhanced += '\n\nPlease analyze the error, identify the root cause, and provide a specific fix with code examples.';
    
    return enhanced;
  }

  private static enhanceCodeAnalysisPrompt(prompt: string, files: string[], keywords: string[]): string {
    let enhanced = prompt;
    
    if (files.length > 0) {
      enhanced += `\n\nFiles to analyze: ${files.join(', ')}`;
    }
    
    if (keywords.length > 0) {
      enhanced += `\n\nTechnical context: ${keywords.join(', ')}`;
    }
    
    enhanced += '\n\nPlease provide a detailed analysis with code examples and explanations.';
    
    return enhanced;
  }

  private static enhanceFeatureRequestPrompt(prompt: string, files: string[], keywords: string[]): string {
    let enhanced = prompt;
    
    if (files.length > 0) {
      enhanced += `\n\nRelated files: ${files.join(', ')}`;
    }
    
    if (keywords.length > 0) {
      enhanced += `\n\nTechnologies involved: ${keywords.join(', ')}`;
    }
    
    enhanced += '\n\nPlease implement this feature with proper code structure, error handling, and following best practices.';
    
    return enhanced;
  }

  private static enhanceFileOperationPrompt(prompt: string, files: string[]): string {
    let enhanced = prompt;
    
    if (files.length > 0) {
      enhanced += `\n\nTarget files: ${files.join(', ')}`;
    }
    
    enhanced += '\n\nPlease perform the requested file operations carefully and confirm the changes.';
    
    return enhanced;
  }

  private static enhanceGeneralPrompt(prompt: string, files: string[], keywords: string[]): string {
    let enhanced = prompt;
    
    if (files.length > 0 || keywords.length > 0) {
      enhanced += '\n\nContext:';
      if (files.length > 0) {
        enhanced += `\n- Files: ${files.join(', ')}`;
      }
      if (keywords.length > 0) {
        enhanced += `\n- Keywords: ${keywords.join(', ')}`;
      }
    }
    
    return enhanced;
  }

  private static generateErrorSearchQueries(prompt: string, files: string[], errorContext: string[]): string[] {
    const queries: string[] = [];
    
    // Search for error-related code
    if (errorContext.length > 0) {
      queries.push(`error ${errorContext[0]}`);
    }
    
    // Search in specific files
    for (const file of files.slice(0, 2)) { // Limit to first 2 files
      queries.push(`error fix ${path.basename(file)}`);
      queries.push(`exception handling ${path.basename(file)}`);
    }
    
    // General error patterns
    queries.push('error handling');
    queries.push('exception handling');
    queries.push('try catch');
    
    return queries;
  }

  private static generateAnalysisSearchQueries(files: string[], keywords: string[]): string[] {
    const queries: string[] = [];
    
    // Search for specific files
    for (const file of files.slice(0, 3)) { // Limit to first 3 files
      queries.push(path.basename(file, path.extname(file)));
      queries.push(`${path.basename(file)} implementation`);
    }
    
    // Search for technical concepts
    for (const keyword of keywords.slice(0, 3)) { // Limit to first 3 keywords
      queries.push(keyword);
      queries.push(`${keyword} usage`);
    }
    
    return queries;
  }

  private static generateFeatureSearchQueries(files: string[], keywords: string[]): string[] {
    const queries: string[] = [];
    
    // Search for related implementations
    for (const keyword of keywords.slice(0, 2)) {
      queries.push(`${keyword} implementation`);
      queries.push(`${keyword} example`);
    }
    
    // Search for similar features
    for (const file of files.slice(0, 2)) {
      const baseName = path.basename(file, path.extname(file));
      queries.push(`${baseName} feature`);
      queries.push(`similar to ${baseName}`);
    }
    
    return queries;
  }

  private static generateFileSearchQueries(files: string[]): string[] {
    const queries: string[] = [];
    
    for (const file of files) {
      queries.push(path.basename(file));
      queries.push(path.basename(file, path.extname(file)));
      
      // Search for related files
      const dir = path.dirname(file);
      if (dir !== '.' && dir !== '/') {
        queries.push(path.basename(dir));
      }
    }
    
    return queries;
  }

  private static generateGeneralSearchQueries(files: string[], keywords: string[]): string[] {
    const queries: string[] = [];
    
    // Combine files and keywords for context
    for (const file of files.slice(0, 2)) {
      queries.push(path.basename(file, path.extname(file)));
    }
    
    for (const keyword of keywords.slice(0, 2)) {
      queries.push(keyword);
    }
    
    return queries;
  }

  static isPromptEnhanceable(prompt: string): boolean {
    const lowerPrompt = prompt.toLowerCase();
    
    // Check if prompt is very short and vague
    if (prompt.trim().split(' ').length <= 3) {
      return true;
    }
    
    // Check if prompt contains file references
    if (this.extractFileReferences(prompt).length > 0) {
      return true;
    }
    
    // Check if prompt indicates an error or problem
    if (this.ERROR_PATTERNS.some(pattern => pattern.test(prompt))) {
      return true;
    }
    
    // Check if prompt is asking a question without context
    if (lowerPrompt.includes('?') && prompt.trim().split(' ').length <= 10) {
      return true;
    }
    
    return false;
  }

  static extractMainTopic(prompt: string): string {
    const enhanced = this.enhancePrompt(prompt);
    
    // Return the most relevant file or keyword
    if (enhanced.extractedFiles.length > 0) {
      return path.basename(enhanced.extractedFiles[0]);
    }
    
    if (enhanced.extractedKeywords.length > 0) {
      return enhanced.extractedKeywords[0];
    }
    
    // Extract first meaningful word (not common words)
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'can', 'could', 'should', 'would', 'will', 'make', 'do', 'get', 'go', 'come', 'have', 'be', 'is', 'are', 'was', 'were', 'please', 'pls'];
    const words = prompt.toLowerCase().split(/\s+/);
    
    for (const word of words) {
      if (word.length > 3 && !commonWords.includes(word)) {
        return word;
      }
    }
    
    return 'general';
  }
}