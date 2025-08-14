import { spawn, ChildProcess } from 'child_process';
import { AddedMcpServer, getEnabledMcpServers, getNextAvailablePort } from '../utils/added-mcp-servers';
import { HttpMcpClient } from './http-mcp-client';

interface RunningHttpServer {
  server: AddedMcpServer;
  process: ChildProcess;
  client: HttpMcpClient;
  port: number;
  startTime: Date;
  restartCount: number;
}

export class HttpMcpManager {
  private runningServers = new Map<string, RunningHttpServer>();
  private static instance: HttpMcpManager | null = null;

  static getInstance(): HttpMcpManager {
    if (!HttpMcpManager.instance) {
      HttpMcpManager.instance = new HttpMcpManager();
    }
    return HttpMcpManager.instance;
  }

  async startAllHttpServers(): Promise<void> {
    const servers = getEnabledMcpServers().filter(s => s.type === 'http');
    
    if (servers.length === 0) {
      return;
    }
    
    const startPromises = servers.map(server => this.startHttpServer(server));
    const results = await Promise.allSettled(startPromises);
    
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
      }
    });
  }

  async startHttpServer(server: AddedMcpServer): Promise<HttpMcpClient> {
    if (server.type !== 'http') {
      throw new Error(`Server ${server.name} is not an HTTP server`);
    }

    // Check if already running
    const existing = this.runningServers.get(server.name);
    if (existing && existing.client.isConnectedToServer()) {
      return existing.client;
    }

    // Assign port if not already assigned
    if (!server.port) {
      server.port = getNextAvailablePort();
    }

    try {
      // Start the server process
      const process = await this.spawnServerProcess(server);
      
      // Wait for server to be ready
      await this.waitForServerReady(server.port, 10000); // 10 second timeout
      
      // Create client and connect
      const updatedServer: AddedMcpServer = {
        ...server,
        httpUrl: `http://localhost:${server.port}/mcp`,
      };
      
      const client = new HttpMcpClient(updatedServer);
      await client.connect();

      // Store running server info
      const runningServer: RunningHttpServer = {
        server: updatedServer,
        process,
        client,
        port: server.port,
        startTime: new Date(),
        restartCount: existing?.restartCount || 0,
      };

      this.runningServers.set(server.name, runningServer);
      
      return client;
    } catch (error) {
      throw error;
    }
  }

  private async spawnServerProcess(server: AddedMcpServer): Promise<ChildProcess> {
    if (!server.command) {
      throw new Error(`No command specified for server ${server.name}`);
    }

    return new Promise((resolve, reject) => {
      const commandParts = server.command.split(' ');
      const command = commandParts[0];
      const args = [...commandParts.slice(1), ...(server.args || [])];

      // Add port to environment
      const env = {
        ...process.env,
        ...server.env,
        PORT: server.port?.toString(),
        MCP_PORT: server.port?.toString(),
      };

      const childProcess = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
        detached: false,
      });

      childProcess.on('error', (error) => {
        reject(new Error(`Failed to spawn server process: ${error.message}`));
      });

      childProcess.on('exit', (code, signal) => {
        this.runningServers.delete(server.name);
        
        // Auto-restart if enabled and not intentionally stopped
        if (server.enabled && code !== 0 && !signal) {
          this.handleServerRestart(server);
        }
      });

      childProcess.stdout?.on('data', (data) => {
      });

      childProcess.stderr?.on('data', (data) => {
      });

      // Give the process a moment to start
      setTimeout(() => {
        if (childProcess.killed) {
          reject(new Error('Process was killed during startup'));
        } else {
          resolve(childProcess);
        }
      }, 1000);
    });
  }

  private async waitForServerReady(port: number, timeout: number): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(`http://localhost:${port}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'ping',
            params: {},
          }),
        });
        
        if (response.ok) {
          return; // Server is ready
        }
      } catch (error) {
        // Server not ready yet, continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new Error(`Server did not become ready within ${timeout}ms`);
  }

  private async handleServerRestart(server: AddedMcpServer): Promise<void> {
    const existing = this.runningServers.get(server.name);
    if (!existing) return;

    existing.restartCount++;
    
    // Exponential backoff for restarts
    const delay = Math.min(1000 * Math.pow(2, existing.restartCount), 30000);
    
    
    setTimeout(async () => {
      try {
        await this.startHttpServer(server);
      } catch (error) {
      }
    }, delay);
  }

  async stopHttpServer(serverName: string): Promise<void> {
    const running = this.runningServers.get(serverName);
    if (!running) {
      return;
    }

    try {
      await running.client.disconnect();
      running.process.kill('SIGTERM');
      
      // Give it time to shut down gracefully
      setTimeout(() => {
        if (!running.process.killed) {
          running.process.kill('SIGKILL');
        }
      }, 5000);
      
      this.runningServers.delete(serverName);
    } catch (error) {
    }
  }

  async stopAllHttpServers(): Promise<void> {
    const stopPromises = Array.from(this.runningServers.keys()).map(serverName => 
      this.stopHttpServer(serverName)
    );
    await Promise.all(stopPromises);
  }

  getRunningServers(): string[] {
    return Array.from(this.runningServers.keys());
  }

  getHttpClient(serverName: string): HttpMcpClient | null {
    const running = this.runningServers.get(serverName);
    return running?.client || null;
  }

  isServerRunning(serverName: string): boolean {
    const running = this.runningServers.get(serverName);
    return running ? running.client.isConnectedToServer() : false;
  }

  async healthCheck(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    for (const [serverName, running] of this.runningServers) {
      try {
        const isHealthy = await running.client.healthCheck();
        results.set(serverName, isHealthy);
      } catch (error) {
        results.set(serverName, false);
      }
    }
    
    return results;
  }

  getServerStats(serverName: string): any {
    const running = this.runningServers.get(serverName);
    if (!running) return null;

    return {
      name: serverName,
      port: running.port,
      startTime: running.startTime,
      uptime: Date.now() - running.startTime.getTime(),
      restartCount: running.restartCount,
      isConnected: running.client.isConnectedToServer(),
    };
  }
}