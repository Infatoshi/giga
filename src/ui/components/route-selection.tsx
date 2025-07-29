import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { OpenRouterProvider, getModelProvidersWithFallback, isOpenRouterModel } from "../../utils/openrouter-providers";
import { getOpenRouterProvider } from "../../utils/added-models";
import { loadApiKeys } from "../../utils/api-keys";

interface ModelOption {
  model: string;
  description: string;
}

interface RouteSelectionProps {
  models: ModelOption[];
  selectedModelIndex: number;
  selectedProviderIndex: number;
  isVisible: boolean;
  currentModel: string;
  viewMode: 'models' | 'providers';
  currentSelectedModel?: string;
  providers: OpenRouterProvider[];
  isLoadingProviders: boolean;
  onModelSelect: (model: string) => void;
  onProviderSelect: (model: string, provider: OpenRouterProvider) => void;
  onBack: () => void;
}

export function RouteSelection({
  models,
  selectedModelIndex,
  selectedProviderIndex,
  isVisible,
  currentModel,
  viewMode,
  currentSelectedModel,
  providers,
  isLoadingProviders,
  onModelSelect,
  onProviderSelect,
  onBack,
}: RouteSelectionProps) {
  if (!isVisible) return null;

  if (viewMode === 'models') {
    return (
      <Box marginTop={1} flexDirection="column">
        <Box marginBottom={1}>
          <Text color="cyan">Select Model to Configure Provider (current: {currentModel}):</Text>
        </Box>
        {models.length === 0 ? (
          <Box paddingLeft={1}>
            <Text color="yellow">No OpenRouter models found. Add models with format "author/model" using /add-model.</Text>
          </Box>
        ) : (
          models.map((modelOption, index) => {
          const openRouterProvider = getOpenRouterProvider(modelOption.model);
          const hasProviderSet = openRouterProvider !== null;
          
          return (
            <Box key={index} paddingLeft={1}>
              <Text
                color={index === selectedModelIndex ? "black" : "white"}
                backgroundColor={index === selectedModelIndex ? "cyan" : undefined}
              >
                {modelOption.model}
                {hasProviderSet && (
                  <Text color={index === selectedModelIndex ? "black" : "green"}>
                    {" "}→ {openRouterProvider}
                  </Text>
                )}
              </Text>
              <Box marginLeft={1}>
                <Text color="gray">{modelOption.description}</Text>
              </Box>
            </Box>
          );
        })
        )}
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            ↑↓ navigate • Enter configure provider • Esc cancel
          </Text>
        </Box>
      </Box>
    );
  }

  // Provider selection view
  return (
    <Box marginTop={1} flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan">
          Select Provider for {currentSelectedModel}:
        </Text>
      </Box>
      
      {isLoadingProviders ? (
        <Box paddingLeft={1}>
          <Text color="yellow">Loading available providers...</Text>
        </Box>
      ) : providers.length === 0 ? (
        <Box paddingLeft={1}>
          <Text color="red">No providers available for this model</Text>
        </Box>
      ) : (
        providers.map((provider, index) => {
          const currentProvider = getOpenRouterProvider(currentSelectedModel || '');
          const isCurrentlySelected = currentProvider === provider.id;
          
          return (
            <Box key={index} paddingLeft={1}>
              <Text
                color={index === selectedProviderIndex ? "black" : "white"}
                backgroundColor={index === selectedProviderIndex ? "cyan" : undefined}
              >
                {provider.name}
                {isCurrentlySelected && (
                  <Text color={index === selectedProviderIndex ? "black" : "green"}>
                    {" "}(current)
                  </Text>
                )}
              </Text>
              <Box marginLeft={1} flexDirection="column">
                {provider.pricing && (
                  <Text color="gray" dimColor>
                    ${provider.pricing.prompt}/1k prompt • ${provider.pricing.completion}/1k completion
                  </Text>
                )}
                {(provider.quantization || provider.uptime || provider.context_length) && (
                  <Text color="gray" dimColor>
                    {provider.quantization ? `${provider.quantization}` : ''}
                    {provider.quantization && provider.uptime ? ' • ' : ''}
                    {provider.uptime ? `${provider.uptime}% uptime` : ''}
                    {(provider.quantization || provider.uptime) && provider.context_length ? ' • ' : ''}
                    {provider.context_length ? `${provider.context_length.toLocaleString()} context` : ''}
                  </Text>
                )}
              </Box>
            </Box>
          );
        })
      )}
      
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ↑↓ navigate • Enter select provider • Esc back to models
        </Text>
      </Box>
    </Box>
  );
}

// Hook for managing route selection state
export function useRouteSelection() {
  const [viewMode, setViewMode] = useState<'models' | 'providers'>('models');
  const [currentSelectedModel, setCurrentSelectedModel] = useState<string>('');
  const [providers, setProviders] = useState<OpenRouterProvider[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);

  const handleModelSelect = async (model: string) => {
    setCurrentSelectedModel(model);
    setViewMode('providers');
    setIsLoadingProviders(true);
    setProviders([]);

    try {
      const apiKeys = loadApiKeys();
      const openRouterKey = apiKeys.openRouterApiKey;
      
      if (openRouterKey) {
        const modelProviders = await getModelProvidersWithFallback(model, openRouterKey);
        setProviders(modelProviders);
      } else {
        // If no OpenRouter key, show message
        setProviders([]);
      }
    } catch (error) {
      console.error('Error fetching providers:', error);
      setProviders([]);
    } finally {
      setIsLoadingProviders(false);
    }
  };

  const handleBack = () => {
    setViewMode('models');
    setCurrentSelectedModel('');
    setProviders([]);
    setIsLoadingProviders(false);
  };

  const reset = () => {
    setViewMode('models');
    setCurrentSelectedModel('');
    setProviders([]);
    setIsLoadingProviders(false);
  };

  return {
    viewMode,
    currentSelectedModel,
    providers,
    isLoadingProviders,
    handleModelSelect,
    handleBack,
    reset,
  };
}