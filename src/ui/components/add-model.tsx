import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { loadApiKeys } from "../../utils/api-keys";
import { ProviderName } from "../../utils/provider-models";
import { fetchModelsWithFallback } from "../../utils/dynamic-model-fetcher";
import { fuzzySearch } from "../../utils/fuzzy-search";

interface Provider {
  name: string;
  keyName: string;
  description: string;
}

interface AddModelProps {
  providers: Provider[];
  onClose: () => void;
  onAddModel: (providerName: string, modelName: string) => void;
}

export default function AddModel({ 
  providers, 
  onClose,
  onAddModel 
}: AddModelProps) {
  const [availableProviders, setAvailableProviders] = useState<Provider[]>([]);
  const [stage, setStage] = useState<'provider' | 'model'>('provider');
  const [selectedProviderIndex, setSelectedProviderIndex] = useState(0);
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [currentSearchQuery, setCurrentSearchQuery] = useState("");
  const [filteredModels, setFilteredModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [allModels, setAllModels] = useState<string[]>([]);

  useEffect(() => {
    initializeProviders();
  }, []);

  useEffect(() => {
    if (stage === 'model' && availableProviders[selectedProviderIndex] && !isLoadingModels) {
      updateFilteredModels();
    }
  }, [stage, selectedProviderIndex, currentSearchQuery, availableProviders, allModels]);

  const initializeProviders = () => {
    const apiKeys = loadApiKeys();
    const providersWithKeys: Provider[] = [];
    
    for (const provider of providers) {
      const keyValue = (apiKeys as any)[provider.keyName];
      // Ollama always has a base URL (defaults to localhost), so it's always available
      if (keyValue || provider.keyName === 'ollamaBaseUrl') {
        providersWithKeys.push(provider);
      }
    }
    
    setAvailableProviders(providersWithKeys);
  };

  const loadModelsForProvider = async (provider: Provider) => {
    setIsLoadingModels(true);
    setAllModels([]);
    
    const apiKeys = loadApiKeys();
    const apiKey = (apiKeys as any)[provider.keyName];
    const providerName = provider.name.toLowerCase() as ProviderName;
    
    try {
      const { models } = await fetchModelsWithFallback(providerName, apiKey);
      setAllModels(models);
    } catch (error) {
      console.error(`Failed to load models for ${provider.name}:`, error);
      setAllModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const updateFilteredModels = () => {
    if (!currentSearchQuery.trim()) {
      setFilteredModels(allModels);
      return;
    }
    
    const filtered = fuzzySearch(
      currentSearchQuery,
      allModels,
      (model) => model,
      50 // Show up to 50 results
    );
    
    setFilteredModels(filtered);
  };

  useInput((inputChar, key) => {
    if (key.ctrl && inputChar === "c") {
      onClose();
      return;
    }

    if (key.escape) {
      if (stage === 'model') {
        // Go back to provider selection
        setStage('provider');
        setCurrentSearchQuery("");
        setSelectedModelIndex(0);
      } else {
        onClose();
      }
      return;
    }

    if (stage === 'provider') {
      if (key.upArrow) {
        setSelectedProviderIndex(prev => prev === 0 ? availableProviders.length - 1 : prev - 1);
        return;
      }
      if (key.downArrow) {
        setSelectedProviderIndex(prev => (prev + 1) % availableProviders.length);
        return;
      }
      if (key.return) {
        if (availableProviders.length > 0) {
          const selectedProvider = availableProviders[selectedProviderIndex];
          // Move to model selection stage and load models
          setStage('model');
          setCurrentSearchQuery("");
          setSelectedModelIndex(0);
          loadModelsForProvider(selectedProvider);
        }
        return;
      }
    } else if (stage === 'model') {
      if (key.upArrow) {
        setSelectedModelIndex(prev => prev === 0 ? Math.max(0, filteredModels.length - 1) : prev - 1);
        return;
      }
      if (key.downArrow) {
        setSelectedModelIndex(prev => filteredModels.length === 0 ? 0 : (prev + 1) % Math.min(10, filteredModels.length));
        return;
      }
      if (key.return) {
        if (filteredModels.length > 0 && selectedModelIndex < filteredModels.length) {
          const selectedModel = filteredModels[selectedModelIndex];
          const selectedProvider = availableProviders[selectedProviderIndex];
          onAddModel(selectedProvider.name, selectedModel);
        }
        return;
      }
      if (key.backspace || key.delete) {
        setCurrentSearchQuery(prev => prev.slice(0, -1));
        setSelectedModelIndex(0);
        return;
      }
      if (inputChar && !key.ctrl && !key.meta) {
        setCurrentSearchQuery(prev => prev + inputChar);
        setSelectedModelIndex(0);
        return;
      }
    }
  });

  if (availableProviders.length === 0) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="red">❌ No API keys found</Text>
        <Text color="gray">Configure API keys in /providers first</Text>
        <Box marginTop={1}>
          <Text color="gray" dimColor>Press Esc to close</Text>
        </Box>
      </Box>
    );
  }

  if (stage === 'provider') {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="yellow">🔍 Select Provider</Text>
        <Box marginBottom={1}>
          <Text color="gray">Choose a provider to browse models from:</Text>
        </Box>
        
        <Box flexDirection="column" marginBottom={1}>
          {availableProviders.map((provider, index) => {
            const isSelected = index === selectedProviderIndex;
            
            return (
              <Box 
                key={provider.keyName}
                borderStyle="round" 
                borderColor={isSelected ? "blue" : "gray"} 
                paddingX={1} 
                marginBottom={1}
              >
                <Box width={12}>
                  <Text color={isSelected ? "blue" : "white"}>{provider.name}</Text>
                </Box>
                <Box flexGrow={1}>
                  <Text color="green">✓ API key configured</Text>
                </Box>
                <Box width={25}>
                  <Text color="gray" dimColor>{provider.description}</Text>
                </Box>
              </Box>
            );
          })}
        </Box>

        <Box flexDirection="column" marginTop={1}>
          <Text color="gray" dimColor>• Use ↑/↓ arrows to navigate</Text>
          <Text color="gray" dimColor>• Press Enter to select provider</Text>
          <Text color="gray" dimColor>• Press Esc to cancel</Text>
        </Box>
      </Box>
    );
  }

  // Model selection stage
  const selectedProvider = availableProviders[selectedProviderIndex];
  
  if (isLoadingModels) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="yellow">🔍 Add Model from {selectedProvider.name}</Text>
        <Box marginTop={2}>
          <Text color="blue">🔄 Loading models from {selectedProvider.name}...</Text>
        </Box>
        <Box marginTop={1}>
          <Text color="gray" dimColor>Press Esc to go back</Text>
        </Box>
      </Box>
    );
  }
  
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color="yellow">🔍 Add Model from {selectedProvider.name}</Text>
      <Box marginBottom={1}>
        <Text color="gray">Search: </Text>
        <Text>{currentSearchQuery || ""}█</Text>
      </Box>
      
      <Box flexDirection="column" marginBottom={1}>
        {filteredModels.length === 0 ? (
          <Box borderStyle="round" borderColor="gray" paddingX={1}>
            <Text color="gray">
              {allModels.length === 0 
                ? "No models available" 
                : `No models found matching "${currentSearchQuery}"`
              }
            </Text>
          </Box>
        ) : (
          filteredModels.slice(0, 10).map((model, index) => {
            const isSelected = index === selectedModelIndex;
            
            return (
              <Box 
                key={model}
                borderStyle="round" 
                borderColor={isSelected ? "blue" : "gray"} 
                paddingX={1} 
                marginBottom={1}
              >
                <Text color={isSelected ? "blue" : "white"}>{model}</Text>
              </Box>
            );
          })
        )}
        {filteredModels.length > 10 && (
          <Box paddingX={1}>
            <Text color="gray" dimColor>... and {filteredModels.length - 10} more</Text>
          </Box>
        )}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color="gray" dimColor>• Type to search models ({allModels.length} total)</Text>
        <Text color="gray" dimColor>• Use ↑/↓ arrows to navigate</Text>
        <Text color="gray" dimColor>• Press Enter to add selected model</Text>
        <Text color="gray" dimColor>• Press Esc to go back</Text>
      </Box>
    </Box>
  );
}