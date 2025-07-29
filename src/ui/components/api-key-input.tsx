import React, { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { GigaAgent } from "../../agent/giga-agent";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface ApiKeyInputProps {
  onApiKeySet: (agent: GigaAgent) => void;
}

interface UserSettings {
  apiKey?: string;
  groqApiKey?: string;
  anthropicApiKey?: string;
  openRouterApiKey?: string;
}

export default function ApiKeyInput({ onApiKeySet }: ApiKeyInputProps) {
  const [input, setInput] = useState("");
  const [groqInput, setGroqInput] = useState("");
  const [anthropicInput, setAnthropicInput] = useState("");
  const [openRouterInput, setOpenRouterInput] = useState("");
  const [currentField, setCurrentField] = useState("grok");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { exit } = useApp();

  useInput((inputChar, key) => {
    if (isSubmitting) return;

    if (key.ctrl && inputChar === "c") {
      exit();
      return;
    }

    if (key.return) {
      if (currentField === "grok") {
        setCurrentField("groq");
      } else if (currentField === "groq") {
        setCurrentField("anthropic");
      } else if (currentField === "anthropic") {
        setCurrentField("openrouter");
      } else {
        handleSubmit();
      }
      return;
    }

    if (key.backspace || key.delete) {
      if (currentField === "grok") {
        setInput((prev) => prev.slice(0, -1));
      } else if (currentField === "groq") {
        setGroqInput((prev) => prev.slice(0, -1));
      } else if (currentField === "anthropic") {
        setAnthropicInput((prev) => prev.slice(0, -1));
      } else if (currentField === "openrouter") {
        setOpenRouterInput((prev) => prev.slice(0, -1));
      }
      setError("");
      return;
    }

    if (inputChar && !key.ctrl && !key.meta) {
      if (currentField === "grok") {
        setInput((prev) => prev + inputChar);
      } else if (currentField === "groq") {
        setGroqInput((prev) => prev + inputChar);
      } else if (currentField === "anthropic") {
        setAnthropicInput((prev) => prev + inputChar);
      } else if (currentField === "openrouter") {
        setOpenRouterInput((prev) => prev + inputChar);
      }
      setError("");
    }
  });


  const handleSubmit = async () => {
    // Check for API keys in input fields or environment variables
    const xaiKey = input.trim() || process.env.XAI_API_KEY;
    const groqKey = groqInput.trim() || process.env.GROQ_API_KEY;
    const anthropicKey = anthropicInput.trim() || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    const openRouterKey = openRouterInput.trim() || process.env.OPENROUTER_API_KEY;
    
    if (!xaiKey && !groqKey && !anthropicKey && !openRouterKey) {
      setError("At least one API key is required (via input or environment variable)");
      return;
    }

    setIsSubmitting(true);
    try {
      const apiKey = xaiKey;
      const groqApiKey = groqKey;
      const agent = new GigaAgent(apiKey, groqApiKey);
      
      // Set environment variable for current process
      process.env.XAI_API_KEY = apiKey;
      
      // Save to .grok/user-settings.json
      try {
        const homeDir = os.homedir();
        const gigaDir = path.join(homeDir, '.giga');
        const settingsFile = path.join(gigaDir, 'user-settings.json');
        
        // Create .giga directory if it doesn't exist
        if (!fs.existsSync(gigaDir)) {
          fs.mkdirSync(gigaDir, { mode: 0o700 });
        }
        
        // Load existing settings or create new
        let settings: UserSettings = {};
        if (fs.existsSync(settingsFile)) {
          try {
            settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
          } catch {
            settings = {};
          }
        }
        
        // Update API key
        settings.apiKey = apiKey;
        
        // Save settings
        fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), { mode: 0o600 });
        
        console.log(`\n✅ API key saved to ~/.giga/user-settings.json`);
      } catch (error) {
        console.log('\n⚠️ Could not save API key to settings file');
        console.log('API key set for current session only');
      }
      
      onApiKeySet(agent);
    } catch (error: any) {
      setError("Invalid API key format");
      setIsSubmitting(false);
    }
  };

  const displayText = input.length > 0 ? 
    (isSubmitting ? "*".repeat(input.length) : "*".repeat(input.length) + "█") : 
    (isSubmitting ? " " : "█");

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color="yellow">🔑 API Keys Required</Text>
      <Box marginBottom={1}>
        <Text color="gray">Please enter your API keys to continue:</Text>
      </Box>
      
      <Box flexDirection="column" marginBottom={1}>
        <Box borderStyle="round" borderColor={currentField === "grok" ? "blue" : "gray"} paddingX={1} marginBottom={1}>
          <Text color="gray">xAI API Key ❯ </Text>
          <Text>{input.length > 0 ? (isSubmitting ? "*".repeat(input.length) : "*".repeat(input.length) + "█") : (isSubmitting ? " " : "█")}</Text>
        </Box>
        <Box borderStyle="round" borderColor={currentField === "groq" ? "blue" : "gray"} paddingX={1} marginBottom={1}>
          <Text color="gray">Groq API Key ❯ </Text>
          <Text>{groqInput.length > 0 ? (isSubmitting ? "*".repeat(groqInput.length) : "*".repeat(groqInput.length) + "█") : (isSubmitting ? " " : "█")}</Text>
        </Box>
        <Box borderStyle="round" borderColor={currentField === "anthropic" ? "blue" : "gray"} paddingX={1} marginBottom={1}>
          <Text color="gray">Anthropic API Key ❯ </Text>
          <Text>{anthropicInput.length > 0 ? (isSubmitting ? "*".repeat(anthropicInput.length) : "*".repeat(anthropicInput.length) + "█") : (isSubmitting ? " " : "█")}</Text>
        </Box>
        <Box borderStyle="round" borderColor={currentField === "openrouter" ? "blue" : "gray"} paddingX={1} marginBottom={1}>
          <Text color="gray">OpenRouter API Key ❯ </Text>
          <Text>{openRouterInput.length > 0 ? (isSubmitting ? "*".repeat(openRouterInput.length) : "*".repeat(openRouterInput.length) + "█") : (isSubmitting ? " " : "█")}</Text>
        </Box>
      </Box>

      {error ? (
        <Box marginBottom={1}>
          <Text color="red">❌ {error}</Text>
        </Box>
      ) : null}

      <Box flexDirection="column" marginTop={1}>
        <Text color="gray" dimColor>• Press Enter to move to next field or submit</Text>
        <Text color="gray" dimColor>• Press Ctrl+C to exit</Text>
        <Text color="gray" dimColor>Note: API keys will be saved to ~/.giga/user-settings.json</Text>
      </Box>

      {isSubmitting ? (
        <Box marginTop={1}>
          <Text color="yellow">🔄 Validating API keys...</Text>
        </Box>
      ) : null}
    </Box>
  );
}