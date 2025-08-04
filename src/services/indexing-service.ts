import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { RAGContextService } from './rag-context-service';
import { RAGConfigManager } from '../utils/rag-config';

interface IndexingJob {
  id: string;
  type: 'full' | 'incremental' | 'file';
  filePaths?: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  error?: string;
  stats?: {
    filesProcessed: number;
    chunksCreated: number;
    duration: number;
  };
}

export class IndexingService extends EventEmitter {
  private ragService: RAGContextService;
  private projectPath: string;
  private fileWatcher: fs.FSWatcher | null = null;
  private isWatching: boolean = false;
  private jobQueue: IndexingJob[] = [];
  private currentJob: IndexingJob | null = null;
  private jobIdCounter: number = 1;
  private lastFullIndexTime: Date | null = null;

  // Debounce file changes to avoid excessive indexing
  private pendingChanges = new Set<string>();
  private changeDebounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_DELAY = 2000; // 2 seconds

  constructor(projectPath: string = process.cwd()) {
    super();
    this.projectPath = projectPath;
    this.ragService = new RAGContextService(projectPath);
  }

  async initialize(): Promise<void> {
    try {
      await this.ragService.initialize();
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async startWatching(): Promise<void> {
    if (this.isWatching) {
      return;
    }

    const config = RAGConfigManager.loadConfig(this.projectPath);
    if (!config.enabled) {
      console.log('📴 RAG is disabled - file watching not started');
      return;
    }

    try {
      await this.initialize();
      
      // Watch for file changes
      this.fileWatcher = fs.watch(this.projectPath, { recursive: true }, (eventType, filename) => {
        if (filename && this.shouldWatchFile(filename)) {
          this.handleFileChange(eventType, filename);
        }
      });

      this.isWatching = true;
      console.log('👀 Started watching files for changes');
      this.emit('watching-started');

      // Check if we need to do an initial full index
      const indexInfo = await this.ragService.getIndexInfo();
      if (indexInfo.count === 0) {
        console.log('💡 No existing index found - scheduling initial indexing');
        this.scheduleFullIndex();
      }

    } catch (error: any) {
      console.error('Failed to start file watching:', error);
      this.emit('error', error);
      throw error;
    }
  }

  async stopWatching(): Promise<void> {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }

    if (this.changeDebounceTimer) {
      clearTimeout(this.changeDebounceTimer);
      this.changeDebounceTimer = null;
    }

    this.isWatching = false;
    console.log('⏹️  Stopped watching files');
    this.emit('watching-stopped');
  }

  private shouldWatchFile(filename: string): boolean {
    const config = RAGConfigManager.loadConfig(this.projectPath);
    const fullPath = path.join(this.projectPath, filename);
    
    // Skip directories
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        return false;
      }
    } catch {
      return false; // File doesn't exist or can't be accessed
    }

    // Check include patterns
    const includeMatch = config.includePatterns.some(pattern => {
      const regex = this.globToRegex(pattern);
      return regex.test(filename) || regex.test(fullPath);
    });

    if (!includeMatch) {
      return false;
    }

    // Check exclude patterns
    const excludeMatch = config.excludePatterns.some(pattern => {
      const regex = this.globToRegex(pattern);
      return regex.test(filename) || regex.test(fullPath);
    });

    return !excludeMatch;
  }

  private globToRegex(pattern: string): RegExp {
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');
    
    return new RegExp(`^${regexPattern}$`);
  }

  private handleFileChange(eventType: string, filename: string): void {
    const fullPath = path.join(this.projectPath, filename);
    
    // Skip if file doesn't exist (was deleted)
    if (!fs.existsSync(fullPath)) {
      return;
    }

    this.pendingChanges.add(fullPath);
    
    // Reset debounce timer
    if (this.changeDebounceTimer) {
      clearTimeout(this.changeDebounceTimer);
    }

    this.changeDebounceTimer = setTimeout(() => {
      this.processFileChanges();
    }, this.DEBOUNCE_DELAY);
  }

  private async processFileChanges(): Promise<void> {
    if (this.pendingChanges.size === 0) {
      return;
    }

    const changedFiles = Array.from(this.pendingChanges);
    this.pendingChanges.clear();

    console.log(`📝 Processing ${changedFiles.length} changed files`);
    this.scheduleIncrementalIndex(changedFiles);
  }

  scheduleFullIndex(): string {
    const jobId = `full-${this.jobIdCounter++}`;
    
    const job: IndexingJob = {
      id: jobId,
      type: 'full',
      status: 'pending'
    };

    this.jobQueue.push(job);
    this.processJobQueue();
    
    return jobId;
  }

  scheduleIncrementalIndex(filePaths: string[]): string {
    const jobId = `incremental-${this.jobIdCounter++}`;
    
    const job: IndexingJob = {
      id: jobId,
      type: 'incremental',
      filePaths,
      status: 'pending'
    };

    this.jobQueue.push(job);
    this.processJobQueue();
    
    return jobId;
  }

  scheduleFileIndex(filePath: string): string {
    const jobId = `file-${this.jobIdCounter++}`;
    
    const job: IndexingJob = {
      id: jobId,
      type: 'file',
      filePaths: [filePath],
      status: 'pending'
    };

    this.jobQueue.push(job);
    this.processJobQueue();
    
    return jobId;
  }

  private async processJobQueue(): Promise<void> {
    if (this.currentJob || this.jobQueue.length === 0) {
      return;
    }

    const job = this.jobQueue.shift()!;
    this.currentJob = job;
    
    job.status = 'running';
    job.startTime = new Date();
    
    this.emit('job-started', job);
    console.log(`🔄 Starting indexing job: ${job.id} (${job.type})`);

    try {
      await this.executeJob(job);
      
      job.status = 'completed';
      job.endTime = new Date();
      
      console.log(`✅ Completed indexing job: ${job.id}`);
      this.emit('job-completed', job);
      
      if (job.type === 'full') {
        this.lastFullIndexTime = job.endTime;
      }
      
    } catch (error: any) {
      job.status = 'failed';
      job.endTime = new Date();
      job.error = error.message;
      
      console.error(`❌ Failed indexing job: ${job.id}`, error);
      this.emit('job-failed', job);
    } finally {
      this.currentJob = null;
      
      // Process next job in queue
      if (this.jobQueue.length > 0) {
        setImmediate(() => this.processJobQueue());
      }
    }
  }

  private async executeJob(job: IndexingJob): Promise<void> {
    const startTime = Date.now();
    
    switch (job.type) {
      case 'full':
        await this.ragService.indexProject();
        break;
        
      case 'incremental':
      case 'file':
        if (job.filePaths && job.filePaths.length > 0) {
          // For now, we'll do a simple re-index of changed files
          // In the future, we could implement more sophisticated incremental updates
          await this.ragService.indexProject();
        }
        break;
    }

    const endTime = Date.now();
    const indexInfo = await this.ragService.getIndexInfo();
    
    job.stats = {
      filesProcessed: job.filePaths?.length || 0,
      chunksCreated: indexInfo.count,
      duration: endTime - startTime
    };
  }

  getCurrentJob(): IndexingJob | null {
    return this.currentJob;
  }

  getJobQueue(): IndexingJob[] {
    return [...this.jobQueue];
  }

  getJobHistory(): IndexingJob[] {
    // In a real implementation, you might want to persist this
    return [];
  }

  async getIndexingStatus(): Promise<{
    isWatching: boolean;
    currentJob: IndexingJob | null;
    queueLength: number;
    lastFullIndex: Date | null;
    indexInfo: { count: number; enabled: boolean };
  }> {
    const indexInfo = await this.ragService.getIndexInfo();
    
    return {
      isWatching: this.isWatching,
      currentJob: this.currentJob,
      queueLength: this.jobQueue.length,
      lastFullIndex: this.lastFullIndexTime,
      indexInfo
    };
  }

  async clearIndex(): Promise<void> {
    // Stop current job if running
    if (this.currentJob) {
      console.log('⏹️  Stopping current indexing job');
    }
    
    // Clear job queue
    this.jobQueue = [];
    this.currentJob = null;
    
    // Clear the actual index
    await this.ragService.clearIndex();
    
    this.lastFullIndexTime = null;
    console.log('🗑️  Index cleared');
    this.emit('index-cleared');
  }

  // Static method to create and start a background indexing service
  static async createAndStart(projectPath: string = process.cwd()): Promise<IndexingService> {
    const service = new IndexingService(projectPath);
    
    try {
      await service.startWatching();
      return service;
    } catch (error) {
      console.warn('Failed to start background indexing service:', error);
      return service;
    }
  }
}