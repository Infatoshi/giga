import * as fs from 'fs';
import * as path from 'path';
import { CodeChunk } from '../services/rag-service';

export interface ParsedElement {
  type: 'function' | 'class' | 'import' | 'comment' | 'variable' | 'interface' | 'type';
  name: string;
  content: string;
  startLine: number;
  endLine: number;
  metadata: Record<string, any>;
}

export class CodeParser {
  private static readonly LANGUAGE_PARSERS = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.h': 'c',
    '.go': 'go',
    '.rs': 'rust',
    '.php': 'php',
    '.rb': 'ruby',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.cs': 'csharp',
    '.scala': 'scala',
    '.clj': 'clojure',
    '.sh': 'shell',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.json': 'json',
    '.md': 'markdown'
  };

  static parseFile(filePath: string, content: string): CodeChunk[] {
    const ext = path.extname(filePath).toLowerCase();
    const language = this.LANGUAGE_PARSERS[ext as keyof typeof this.LANGUAGE_PARSERS];
    
    if (!language) {
      // Unknown file type, treat as plain text
      return this.parseAsPlainText(filePath, content);
    }

    const lines = content.split('\n');
    
    switch (language) {
      case 'typescript':
      case 'javascript':
        return this.parseTypeScript(filePath, content, lines);
      case 'python':
        return this.parsePython(filePath, content, lines);
      case 'java':
        return this.parseJava(filePath, content, lines);
      case 'cpp':
      case 'c':
        return this.parseC(filePath, content, lines);
      case 'go':
        return this.parseGo(filePath, content, lines);
      case 'rust':
        return this.parseRust(filePath, content, lines);
      case 'json':
        return this.parseJSON(filePath, content, lines);
      case 'markdown':
        return this.parseMarkdown(filePath, content, lines);
      default:
        return this.parseAsPlainText(filePath, content);
    }
  }

  private static parseTypeScript(filePath: string, content: string, lines: string[]): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    let currentLine = 0;

    // Parse imports at the top
    const imports = this.extractImports(lines, /^import\s+.*?from\s+['"`].*?['"`]|^import\s+['"`].*?['"`]/);
    if (imports.length > 0) {
      chunks.push(this.createChunk(filePath, 'import', imports.join('\n'), 1, imports.length, 'imports'));
      currentLine = imports.length;
    }

    // Parse interfaces and types
    chunks.push(...this.parseTypeScriptInterfaces(filePath, lines));
    chunks.push(...this.parseTypeScriptTypes(filePath, lines));

    // Parse classes
    chunks.push(...this.parseTypeScriptClasses(filePath, lines));

    // Parse functions (including arrow functions)
    chunks.push(...this.parseTypeScriptFunctions(filePath, lines));

    // Parse enums
    chunks.push(...this.parseTypeScriptEnums(filePath, lines));

    // If no logical chunks found, return whole file
    if (chunks.length === 0) {
      chunks.push(this.createChunk(filePath, 'file', content, 1, lines.length, 'complete-file'));
    }

    return chunks;
  }

  private static parseTypeScriptInterfaces(filePath: string, lines: string[]): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const interfaceRegex = /^(export\s+)?interface\s+(\w+)/;
    
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(interfaceRegex);
      if (match) {
        const interfaceName = match[2];
        const { endLine, content } = this.findBlockEnd(lines, i, '{', '}');
        
        chunks.push(this.createChunk(
          filePath,
          'interface',
          content,
          i + 1,
          endLine + 1,
          interfaceName,
          { exported: !!match[1] }
        ));
        
        i = endLine;
      }
    }
    
    return chunks;
  }

  private static parseTypeScriptTypes(filePath: string, lines: string[]): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const typeRegex = /^(export\s+)?type\s+(\w+)\s*=/;
    
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(typeRegex);
      if (match) {
        const typeName = match[2];
        // Type definitions can be single line or multi-line
        let endLine = i;
        let content = lines[i];
        
        // Check if it's a multi-line type definition
        if (lines[i].includes('{') && !lines[i].includes('}')) {
          const result = this.findBlockEnd(lines, i, '{', '}');
          endLine = result.endLine;
          content = result.content;
        }
        
        chunks.push(this.createChunk(
          filePath,
          'type',
          content,
          i + 1,
          endLine + 1,
          typeName,
          { exported: !!match[1] }
        ));
        
        i = endLine;
      }
    }
    
    return chunks;
  }

  private static parseTypeScriptClasses(filePath: string, lines: string[]): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const classRegex = /^(export\s+)?(abstract\s+)?class\s+(\w+)/;
    
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(classRegex);
      if (match) {
        const className = match[3];
        const { endLine, content } = this.findBlockEnd(lines, i, '{', '}');
        
        chunks.push(this.createChunk(
          filePath,
          'class',
          content,
          i + 1,
          endLine + 1,
          className,
          { 
            exported: !!match[1],
            abstract: !!match[2]
          }
        ));
        
        i = endLine;
      }
    }
    
    return chunks;
  }

  private static parseTypeScriptFunctions(filePath: string, lines: string[]): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    
    // Regular function declarations
    const functionRegex = /^(export\s+)?(async\s+)?function\s+(\w+)/;
    
    // Arrow function assignments
    const arrowFunctionRegex = /^(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\([^)]*\)\s*=>/;
    
    // Method definitions in objects
    const methodRegex = /^\s*(\w+)\s*\([^)]*\)\s*{/;
    
    for (let i = 0; i < lines.length; i++) {
      let match = lines[i].match(functionRegex);
      let functionName = '';
      let isExported = false;
      let isAsync = false;
      
      if (match) {
        functionName = match[3];
        isExported = !!match[1];
        isAsync = !!match[2];
      } else {
        match = lines[i].match(arrowFunctionRegex);
        if (match) {
          functionName = match[2];
          isExported = !!match[1];
          isAsync = !!match[3];
        }
      }
      
      if (match) {
        const { endLine, content } = this.findBlockEnd(lines, i, '{', '}');
        
        chunks.push(this.createChunk(
          filePath,
          'function',
          content,
          i + 1,
          endLine + 1,
          functionName,
          { 
            exported: isExported,
            async: isAsync
          }
        ));
        
        i = endLine;
      }
    }
    
    return chunks;
  }

  private static parseTypeScriptEnums(filePath: string, lines: string[]): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const enumRegex = /^(export\s+)?enum\s+(\w+)/;
    
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(enumRegex);
      if (match) {
        const enumName = match[2];
        const { endLine, content } = this.findBlockEnd(lines, i, '{', '}');
        
        chunks.push(this.createChunk(
          filePath,
          'class', // Treat enums as classes for simplicity
          content,
          i + 1,
          endLine + 1,
          enumName,
          { 
            exported: !!match[1],
            type: 'enum'
          }
        ));
        
        i = endLine;
      }
    }
    
    return chunks;
  }

  private static parsePython(filePath: string, content: string, lines: string[]): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    
    // Parse imports
    const imports = this.extractImports(lines, /^(import\s+\w+|from\s+\w+\s+import)/);
    if (imports.length > 0) {
      chunks.push(this.createChunk(filePath, 'import', imports.join('\n'), 1, imports.length, 'imports'));
    }

    // Parse classes
    const classRegex = /^class\s+(\w+)/;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(classRegex);
      if (match) {
        const className = match[1];
        const { endLine, content } = this.findPythonBlockEnd(lines, i);
        
        chunks.push(this.createChunk(
          filePath,
          'class',
          content,
          i + 1,
          endLine + 1,
          className
        ));
        
        i = endLine;
      }
    }

    // Parse functions
    const functionRegex = /^(async\s+)?def\s+(\w+)/;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(functionRegex);
      if (match) {
        const functionName = match[2];
        const { endLine, content } = this.findPythonBlockEnd(lines, i);
        
        chunks.push(this.createChunk(
          filePath,
          'function',
          content,
          i + 1,
          endLine + 1,
          functionName,
          { async: !!match[1] }
        ));
        
        i = endLine;
      }
    }

    if (chunks.length === 0) {
      chunks.push(this.createChunk(filePath, 'file', content, 1, lines.length, 'complete-file'));
    }

    return chunks;
  }

  private static parseJava(filePath: string, content: string, lines: string[]): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    
    // Parse imports
    const imports = this.extractImports(lines, /^import\s+/);
    if (imports.length > 0) {
      chunks.push(this.createChunk(filePath, 'import', imports.join('\n'), 1, imports.length, 'imports'));
    }

    // Parse classes
    const classRegex = /^(public\s+)?(abstract\s+)?class\s+(\w+)/;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(classRegex);
      if (match) {
        const className = match[3];
        const { endLine, content } = this.findBlockEnd(lines, i, '{', '}');
        
        chunks.push(this.createChunk(
          filePath,
          'class',
          content,
          i + 1,
          endLine + 1,
          className,
          { 
            public: !!match[1],
            abstract: !!match[2]
          }
        ));
        
        i = endLine;
      }
    }

    // Parse methods
    const methodRegex = /^\s*(public|private|protected)?\s*(static\s+)?(\w+)\s+(\w+)\s*\(/;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(methodRegex);
      if (match && !lines[i].includes('class')) {
        const methodName = match[4];
        const { endLine, content } = this.findBlockEnd(lines, i, '{', '}');
        
        chunks.push(this.createChunk(
          filePath,
          'function',
          content,
          i + 1,
          endLine + 1,
          methodName,
          { 
            visibility: match[1] || 'package',
            static: !!match[2],
            returnType: match[3]
          }
        ));
        
        i = endLine;
      }
    }

    if (chunks.length === 0) {
      chunks.push(this.createChunk(filePath, 'file', content, 1, lines.length, 'complete-file'));
    }

    return chunks;
  }

  private static parseC(filePath: string, content: string, lines: string[]): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    
    // Parse includes
    const includes = this.extractImports(lines, /^#include/);
    if (includes.length > 0) {
      chunks.push(this.createChunk(filePath, 'import', includes.join('\n'), 1, includes.length, 'includes'));
    }

    // Parse functions
    const functionRegex = /^(\w+\s+)*(\w+)\s*\([^)]*\)\s*{/;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(functionRegex);
      if (match && !lines[i].includes('if') && !lines[i].includes('for') && !lines[i].includes('while')) {
        const functionName = match[2];
        const { endLine, content } = this.findBlockEnd(lines, i, '{', '}');
        
        chunks.push(this.createChunk(
          filePath,
          'function',
          content,
          i + 1,
          endLine + 1,
          functionName
        ));
        
        i = endLine;
      }
    }

    if (chunks.length === 0) {
      chunks.push(this.createChunk(filePath, 'file', content, 1, lines.length, 'complete-file'));
    }

    return chunks;
  }

  private static parseGo(filePath: string, content: string, lines: string[]): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    
    // Parse imports
    const imports = this.extractImports(lines, /^import\s+/);
    if (imports.length > 0) {
      chunks.push(this.createChunk(filePath, 'import', imports.join('\n'), 1, imports.length, 'imports'));
    }

    // Parse functions
    const functionRegex = /^func\s+(\w+)\s*\(/;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(functionRegex);
      if (match) {
        const functionName = match[1];
        const { endLine, content } = this.findBlockEnd(lines, i, '{', '}');
        
        chunks.push(this.createChunk(
          filePath,
          'function',
          content,
          i + 1,
          endLine + 1,
          functionName
        ));
        
        i = endLine;
      }
    }

    // Parse structs
    const structRegex = /^type\s+(\w+)\s+struct/;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(structRegex);
      if (match) {
        const structName = match[1];
        const { endLine, content } = this.findBlockEnd(lines, i, '{', '}');
        
        chunks.push(this.createChunk(
          filePath,
          'class',
          content,
          i + 1,
          endLine + 1,
          structName,
          { type: 'struct' }
        ));
        
        i = endLine;
      }
    }

    if (chunks.length === 0) {
      chunks.push(this.createChunk(filePath, 'file', content, 1, lines.length, 'complete-file'));
    }

    return chunks;
  }

  private static parseRust(filePath: string, content: string, lines: string[]): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    
    // Parse functions
    const functionRegex = /^(pub\s+)?(async\s+)?fn\s+(\w+)/;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(functionRegex);
      if (match) {
        const functionName = match[3];
        const { endLine, content } = this.findBlockEnd(lines, i, '{', '}');
        
        chunks.push(this.createChunk(
          filePath,
          'function',
          content,
          i + 1,
          endLine + 1,
          functionName,
          { 
            public: !!match[1],
            async: !!match[2]
          }
        ));
        
        i = endLine;
      }
    }

    // Parse structs
    const structRegex = /^(pub\s+)?struct\s+(\w+)/;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(structRegex);
      if (match) {
        const structName = match[2];
        const { endLine, content } = this.findBlockEnd(lines, i, '{', '}');
        
        chunks.push(this.createChunk(
          filePath,
          'class',
          content,
          i + 1,
          endLine + 1,
          structName,
          { 
            public: !!match[1],
            type: 'struct'
          }
        ));
        
        i = endLine;
      }
    }

    if (chunks.length === 0) {
      chunks.push(this.createChunk(filePath, 'file', content, 1, lines.length, 'complete-file'));
    }

    return chunks;
  }

  private static parseJSON(filePath: string, content: string, lines: string[]): CodeChunk[] {
    // For JSON files, try to parse top-level objects/arrays as chunks
    try {
      const parsed = JSON.parse(content);
      const chunks: CodeChunk[] = [];
      
      if (typeof parsed === 'object' && parsed !== null) {
        if (Array.isArray(parsed)) {
          chunks.push(this.createChunk(filePath, 'file', content, 1, lines.length, 'json-array'));
        } else {
          // Split object into chunks by top-level keys
          const keys = Object.keys(parsed);
          if (keys.length <= 3) {
            // Small object, keep as one chunk
            chunks.push(this.createChunk(filePath, 'file', content, 1, lines.length, 'json-object'));
          } else {
            // Large object, create chunk for whole file
            chunks.push(this.createChunk(filePath, 'file', content, 1, lines.length, 'json-object'));
          }
        }
      }
      
      return chunks;
    } catch {
      // Invalid JSON, treat as plain text
      return this.parseAsPlainText(filePath, content);
    }
  }

  private static parseMarkdown(filePath: string, content: string, lines: string[]): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    
    // Parse markdown headers as chunks
    let currentChunk = '';
    let currentStart = 1;
    let currentHeader = 'introduction';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('#')) {
        // New header found
        if (currentChunk.trim()) {
          chunks.push(this.createChunk(
            filePath,
            'comment',
            currentChunk.trim(),
            currentStart,
            i,
            currentHeader
          ));
        }
        
        currentHeader = line.replace(/^#+\s*/, '').trim() || `header-${i+1}`;
        currentChunk = line + '\n';
        currentStart = i + 1;
      } else {
        currentChunk += line + '\n';
      }
    }
    
    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push(this.createChunk(
        filePath,
        'comment',
        currentChunk.trim(),
        currentStart,
        lines.length,
        currentHeader
      ));
    }
    
    if (chunks.length === 0) {
      chunks.push(this.createChunk(filePath, 'file', content, 1, lines.length, 'markdown-content'));
    }
    
    return chunks;
  }

  private static parseAsPlainText(filePath: string, content: string): CodeChunk[] {
    const lines = content.split('\n');
    
    // For small files (< 100 lines), keep as single chunk
    if (lines.length < 100) {
      return [this.createChunk(filePath, 'file', content, 1, lines.length, 'text-file')];
    }
    
    // For larger files, split into logical chunks of ~50 lines
    const chunks: CodeChunk[] = [];
    const chunkSize = 50;
    
    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunkLines = lines.slice(i, i + chunkSize);
      const chunkContent = chunkLines.join('\n');
      
      chunks.push(this.createChunk(
        filePath,
        'file',
        chunkContent,
        i + 1,
        Math.min(i + chunkSize, lines.length),
        `chunk-${Math.floor(i / chunkSize) + 1}`
      ));
    }
    
    return chunks;
  }

  private static extractImports(lines: string[], regex: RegExp): string[] {
    const imports: string[] = [];
    for (const line of lines) {
      if (regex.test(line.trim())) {
        imports.push(line);
      } else if (imports.length > 0 && !line.trim().startsWith('//') && line.trim() !== '') {
        // Stop collecting imports when we hit non-import, non-comment code
        break;
      }
    }
    return imports;
  }

  private static findBlockEnd(lines: string[], startLine: number, openChar: string, closeChar: string): { endLine: number; content: string } {
    let depth = 0;
    let endLine = startLine;
    let foundOpen = false;
    
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      
      for (const char of line) {
        if (char === openChar) {
          depth++;
          foundOpen = true;
        } else if (char === closeChar) {
          depth--;
          if (depth === 0 && foundOpen) {
            endLine = i;
            break;
          }
        }
      }
      
      if (depth === 0 && foundOpen) {
        break;
      }
    }
    
    const content = lines.slice(startLine, endLine + 1).join('\n');
    return { endLine, content };
  }

  private static findPythonBlockEnd(lines: string[], startLine: number): { endLine: number; content: string } {
    let endLine = startLine;
    const baseIndent = lines[startLine].match(/^\s*/)?.[0].length || 0;
    
    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i];
      const indent = line.match(/^\s*/)?.[0].length || 0;
      
      // Empty lines or comments are part of the block
      if (line.trim() === '' || line.trim().startsWith('#')) {
        endLine = i;
        continue;
      }
      
      // If indentation is less than or equal to base, we've reached the end
      if (indent <= baseIndent) {
        break;
      }
      
      endLine = i;
    }
    
    const content = lines.slice(startLine, endLine + 1).join('\n');
    return { endLine, content };
  }

  private static createChunk(
    filePath: string,
    type: CodeChunk['type'],
    content: string,
    startLine: number,
    endLine: number,
    name: string,
    metadata: Record<string, any> = {}
  ): CodeChunk {
    const id = `${path.basename(filePath)}_${type}_${name}_${startLine}`;
    
    return {
      id: Buffer.from(id).toString('base64').substring(0, 16),
      content: content.trim(),
      filePath,
      type,
      name,
      startLine,
      endLine,
      metadata: {
        language: this.getLanguageFromPath(filePath),
        size: content.length,
        ...metadata
      }
    };
  }

  private static getLanguageFromPath(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return this.LANGUAGE_PARSERS[ext as keyof typeof this.LANGUAGE_PARSERS] || 'text';
  }
}