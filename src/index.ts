#!/usr/bin/env node

import React from "react";
import { render } from "ink";
import { program } from "commander";
import * as dotenv from "dotenv";
import { GigaAgent } from "./agent/giga-agent";
import ChatInterface from "./ui/components/chat-interface";
import { ConfirmationService } from "./utils/confirmation-service";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Load environment variables
dotenv.config();

import { loadApiKeys } from "./utils/api-keys";

// Check if any API keys are available from environment variables, shell files, or settings
function hasAnyApiKey(): boolean {
  const apiKeys = loadApiKeys();
  const availableKeys = Object.values(apiKeys).filter(Boolean);
  return availableKeys.length > 0;
}

program
  .name("giga")
  .description(
    "A conversational AI CLI tool powered by Grok-3 with text editor capabilities"
  )
  .version("1.0.0")
  .option("-p, --prompt <prompt>", "run a single prompt in headless mode")
  .option("-d, --directory <dir>", "set working directory", process.cwd())
  .action(async (options) => {
    if (options.directory) {
      try {
        process.chdir(options.directory);
      } catch (error: any) {
        console.error(
          `❌ Error changing directory to ${options.directory}:`,
          error.message
        );
        process.exit(1);
      }
    }

    // If prompt is provided, run in headless mode
    if (options.prompt) {
      try {
        // Enable headless mode in confirmation service
        const confirmationService = ConfirmationService.getInstance();
        confirmationService.setHeadlessMode(true);

        // Check if any API keys are available
        const hasKeys = hasAnyApiKey();
        
        if (!hasKeys) {
          console.error("❌ Error: API key is required. Set environment variables or configure in settings");
          process.exit(1);
        }

        const agent = new GigaAgent('', '');
        
        console.log(`🤖 Processing prompt: ${options.prompt}`);
        console.log(`📁 Working directory: ${process.cwd()}\n`);

        // Process the prompt and stream results
        for await (const chunk of agent.processUserMessageStream(options.prompt)) {
          if (chunk.type === 'content') {
            process.stdout.write(chunk.content || '');
          } else if (chunk.type === 'tool_calls') {
            console.log(`\n🔧 Using tools: ${chunk.toolCalls?.map(tc => tc.function.name).join(', ')}`);
          } else if (chunk.type === 'tool_result') {
            if (!chunk.toolResult?.success) {
              console.log(`\n❌ Tool error: ${chunk.toolResult?.error}`);
            }
          } else if (chunk.type === 'done') {
            console.log('\n\n✅ Done');
            break;
          }
        }
      } catch (error: any) {
        console.error("❌ Error executing prompt:", error.message);
        process.exit(1);
      }
    } else {
      // Run in interactive mode
      try {
        // Check if any API keys are available
        const hasKeys = hasAnyApiKey();
        const agent = hasKeys ? new GigaAgent('', '') : undefined;

        console.log("🤖 Starting GIGA Conversational Assistant...\n");

        render(React.createElement(ChatInterface, { agent }));
      } catch (error: any) {
        console.error("❌ Error initializing GIGA:", error.message);
        process.exit(1);
      }
    }
  });

program.parse();
