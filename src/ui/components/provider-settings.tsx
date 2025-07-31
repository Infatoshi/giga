import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { validateApiKey } from "../../utils/api-key-validator";
import { refreshGlobalSharedInfo } from "../../utils/api-keys";

interface Provider {
  name: string;
  keyName: string;
  description: string;
}

interface ProviderSettingsProps {
  providers: Provider[];
  selectedIndex: number;
  onClose: () => void;
}

interface UserSettings {
  apiKey?: string;
  groqApiKey?: string;
  anthropicApiKey?: string;
  openRouterApiKey?: string;
  googleApiKey?: string;
  xaiApiKey?: string;
  cerebrasApiKey?: string;
  perplexityApiKey?: string;
  openaiApiKey?: string;
  ollamaBaseUrl?: string;
}

export default function ProviderSettings({ providers, selectedIndex: initialSelectedIndex, onClose }: ProviderSettingsProps) {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [currentInput, setCurrentInput] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [validationStatus, setValidationStatus] = useState<Record<string, boolean>>({});
  const [isValidating, setIsValidating] = useState(false);
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    loadExistingKeys();
    
    return () => {
      setIsMounted(false);
    };
  }, []);

  const loadExistingKeys = () => {
    try {
      const homeDir = os.homedir();
      const settingsFile = path.join(homeDir, '.giga', 'user-settings.json');
      
      if (fs.existsSync(settingsFile)) {
        const settings: UserSettings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
        const keys: Record<string, string> = {};
        
        providers.forEach(provider => {
          const key = settings[provider.keyName as keyof UserSettings];
          if (key) {
            keys[provider.keyName] = key;
          }
        });
        
        setApiKeys(keys);
      }
    } catch (error) {
      setError("Could not load existing API keys");
    }
  };

  const validateCurrentKey = async (providerName: string, key: string) => {
    if (!key.trim()) {
      if (isMounted) {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[providerName]; // Remove error instead of setting empty string
          return newErrors;
        });
        setValidationStatus(prev => ({ ...prev, [providerName]: false }));
      }
      return;
    }

    if (isMounted) {
      setIsValidating(true);
    }
    
    try {
      const result = await validateApiKey(providerName.toLowerCase(), key);
      
      if (!isMounted) return; // Component unmounted, don't update state
      
      if (result.isValid) {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[providerName]; // Remove error instead of setting empty string
          return newErrors;
        });
        setValidationStatus(prev => ({ ...prev, [providerName]: true }));
      } else {
        const errorMessage = result.error?.trim() || "Invalid API key";
        // Never set empty string as error message
        if (errorMessage) {
          setValidationErrors(prev => ({ ...prev, [providerName]: errorMessage }));
        }
        setValidationStatus(prev => ({ ...prev, [providerName]: false }));
      }
    } catch (error) {
      if (!isMounted) return; // Component unmounted, don't update state
      
      setValidationErrors(prev => ({ ...prev, [providerName]: "Validation failed" }));
      setValidationStatus(prev => ({ ...prev, [providerName]: false }));
    }
    
    if (isMounted) {
      setIsValidating(false);
    }
  };

  const saveApiKeys = async () => {
    try {
      const homeDir = os.homedir();
      const gigaDir = path.join(homeDir, '.giga');
      const settingsFile = path.join(gigaDir, 'user-settings.json');
      
      if (!fs.existsSync(gigaDir)) {
        fs.mkdirSync(gigaDir, { mode: 0o700 });
      }
      
      let settings: UserSettings = {};
      if (fs.existsSync(settingsFile)) {
        try {
          settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
        } catch {
          settings = {};
        }
      }
      
      Object.entries(apiKeys).forEach(([keyName, value]) => {
        if (value.trim()) {
          (settings as any)[keyName] = value.trim();
        }
      });
      
      fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), { mode: 0o600 });
      
      // Refresh global shared info after API key changes
      refreshGlobalSharedInfo();
      
      onClose();
    } catch (error) {
      setError("Could not save API keys");
    }
  };

  useInput((inputChar, key) => {
    if (key.ctrl && inputChar === "c") {
      onClose();
      return;
    }

    if (key.escape) {
      if (editingIndex !== null) {
        setEditingIndex(null);
        setCurrentInput("");
      } else {
        // Validate all keys before saving
        const validationPromises = providers.map(async (provider) => {
          const key = apiKeys[provider.keyName];
          if (key) {
            await validateCurrentKey(provider.name, key);
          }
        });
        
        Promise.all(validationPromises).then(() => {
          saveApiKeys();
        });
      }
      return;
    }

    if (editingIndex !== null) {
      if (key.return) {
        const provider = providers[editingIndex];
        setApiKeys(prev => ({
          ...prev,
          [provider.keyName]: currentInput
        }));
        setCurrentInput("");
        setEditingIndex(null);
        setError("");
        return;
      }

      if (key.backspace || key.delete) {
        setCurrentInput(prev => prev.slice(0, -1));
        return;
      }

      if (inputChar && !key.ctrl && !key.meta) {
        setCurrentInput(prev => prev + inputChar);
        setError("");
      }
    } else {
      if (key.upArrow) {
        // Validate current provider's key before moving
        const currentProvider = providers[selectedIndex];
        const currentKey = apiKeys[currentProvider.keyName];
        if (currentKey && currentKey.trim()) {
          validateCurrentKey(currentProvider.name, currentKey);
        }
        
        const newIndex = selectedIndex === 0 ? providers.length - 1 : selectedIndex - 1;
        setSelectedIndex(newIndex);
        return;
      }

      if (key.downArrow) {
        // Validate current provider's key before moving
        const currentProvider = providers[selectedIndex];
        const currentKey = apiKeys[currentProvider.keyName];
        if (currentKey && currentKey.trim()) {
          validateCurrentKey(currentProvider.name, currentKey);
        }
        
        const newIndex = (selectedIndex + 1) % providers.length;
        setSelectedIndex(newIndex);
        return;
      }

      if (key.return) {
        setEditingIndex(selectedIndex);
        const provider = providers[selectedIndex];
        setCurrentInput(apiKeys[provider.keyName] || "");
        return;
      }
    }
  });

  const maskApiKey = (key: string) => {
    if (!key) return "";
    if (key.length <= 8) return "*".repeat(key.length);
    return key.substring(0, 4) + "*".repeat(key.length - 8) + key.substring(key.length - 4);
  };

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color="yellow">🔑 Provider API Keys Configuration</Text>
      <Box marginBottom={1}>
        <Text color="gray">Configure API keys for different AI providers:</Text>
      </Box>
      
      <Box flexDirection="column" marginBottom={1}>
        {providers.map((provider, index) => {
          const isSelected = index === selectedIndex && editingIndex === null;
          const isEditing = index === editingIndex;
          const currentKey = apiKeys[provider.keyName] || "";
          const hasValidationError = validationErrors[provider.name];
          const isValid = validationStatus[provider.name];
          
          let borderColor = "gray";
          if (isSelected) borderColor = "blue";
          else if (isEditing) borderColor = "green";
          else if (hasValidationError) borderColor = "red";
          else if (isValid) borderColor = "green";
          
          return (
            <Box key={provider.keyName} flexDirection="column" marginBottom={1}>
              <Box 
                borderStyle="round" 
                borderColor={borderColor} 
                paddingX={1}
              >
                <Box width={12}>
                  <Text color={isSelected ? "blue" : "white"}>{provider.name}:</Text>
                </Box>
                <Box flexGrow={1}>
                  {isEditing ? (
                    <Text>{(currentInput || "") + "█"}</Text>
                  ) : (
                    <Box>
                      <Text color="gray">
                        {currentKey ? (provider.keyName === 'ollamaBaseUrl' ? currentKey : maskApiKey(currentKey)) : "Not configured"}
                      </Text>
                      {isValid && !hasValidationError && (
                        <Text color="green"> ✓</Text>
                      )}
                    </Box>
                  )}
                </Box>
                <Box width={25}>
                  <Text color="gray" dimColor>{provider.description}</Text>
                </Box>
              </Box>
              {hasValidationError && String(hasValidationError).trim() && (
                <Box paddingLeft={2}>
                  <Text color="red">❌ {String(hasValidationError).trim()}</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {error && error.trim() ? (
        <Box marginBottom={1}>
          <Text color="red">❌ {error}</Text>
        </Box>
      ) : null}

      <Box flexDirection="column" marginTop={1}>
        {editingIndex !== null ? (
          <>
            <Text color="yellow">Editing {providers[editingIndex].name} {providers[editingIndex].keyName === 'ollamaBaseUrl' ? 'Base URL' : 'API Key'}:</Text>
            <Text color="gray" dimColor>• Type your {providers[editingIndex].keyName === 'ollamaBaseUrl' ? 'Ollama base URL (e.g., http://localhost:11434)' : 'API key'}</Text>
            <Text color="gray" dimColor>• Press Enter to save</Text>
            <Text color="gray" dimColor>• Press Esc to cancel</Text>
          </>
        ) : (
          <>
            <Text color="gray" dimColor>• Use ↑/↓ arrows to navigate</Text>
            <Text color="gray" dimColor>• Press Enter to edit selected provider</Text>
            <Text color="gray" dimColor>• Press Esc to save and exit</Text>
            <Text color="gray" dimColor>• Press Ctrl+C to exit without saving</Text>
          </>
        )}
        <Text color="gray" dimColor>Keys saved to ~/.giga/user-settings.json</Text>
        {isValidating && (
          <Text color="yellow">🔄 Validating API keys...</Text>
        )}
      </Box>
    </Box>
  );
}