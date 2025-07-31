import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { fuzzySearch } from '../../utils/fuzzy-search';
import { expertModelsManager } from '../../utils/expert-models-manager';
import { getInstanceAvailableModels } from '../../utils/instance-models';

interface Model {
  name: string;
  provider: string;
}

import { ExpertModelsConfig } from '../../utils/expert-models-manager';

interface ExpertModelsProps {
  onExit: () => void;
}

export const ExpertModels: React.FC<ExpertModelsProps> = ({ onExit }) => {
  const { exit } = useApp();
  const [config, setConfig] = useState<ExpertModelsConfig>({
    enabled: false,
    fastModel: null,
    codeModel: null,
    reasoningModel: null,
    toolsModel: null,
  });
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [currentField, setCurrentField] = useState<'enabled' | 'fast' | 'code' | 'reasoning' | 'tools'>('enabled');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredModels, setFilteredModels] = useState<Model[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showModelPicker, setShowModelPicker] = useState(false);

  useEffect(() => {
    // Load current expert models configuration
    const expertConfig = expertModelsManager.getExpertModelsConfig();
    setConfig(expertConfig);
    
    // Load available models
    const instanceModels = getInstanceAvailableModels();
    const models: Model[] = instanceModels.map(m => ({
      name: m.model,
      provider: m.description.split('(')[1]?.split(')')[0] || 'Unknown'
    }));
    setAvailableModels(models);
    setFilteredModels(models);
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = fuzzySearch(searchQuery, availableModels, (model) => model.name);
      setFilteredModels(filtered);
    } else {
      setFilteredModels(availableModels);
    }
    setSelectedIndex(0);
  }, [searchQuery, availableModels]);

  useInput((input, key) => {
    if (key.escape) {
      if (showModelPicker) {
        setShowModelPicker(false);
        setSearchQuery('');
      } else {
        onExit();
      }
      return;
    }

    if (showModelPicker) {
      if (key.upArrow) {
        setSelectedIndex(Math.max(0, selectedIndex - 1));
      } else if (key.downArrow) {
        setSelectedIndex(Math.min(filteredModels.length - 1, selectedIndex + 1));
      } else if (key.return) {
        const selectedModel = filteredModels[selectedIndex];
        if (selectedModel) {
          const newConfig = { ...config };
          switch (currentField) {
            case 'fast':
              newConfig.fastModel = selectedModel.name;
              break;
            case 'code':
              newConfig.codeModel = selectedModel.name;
              break;
            case 'reasoning':
              newConfig.reasoningModel = selectedModel.name;
              break;
            case 'tools':
              newConfig.toolsModel = selectedModel.name;
              break;
          }
          setConfig(newConfig);
          expertModelsManager.setExpertModelsConfig(newConfig);
        }
        setShowModelPicker(false);
        setSearchQuery('');
      } else if (key.backspace || key.delete) {
        setSearchQuery(searchQuery.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta) {
        setSearchQuery(searchQuery + input);
      }
    } else {
      if (key.upArrow) {
        const fields: Array<typeof currentField> = ['enabled', 'fast', 'code', 'reasoning', 'tools'];
        const currentIndex = fields.indexOf(currentField);
        setCurrentField(fields[Math.max(0, currentIndex - 1)]);
      } else if (key.downArrow) {
        const fields: Array<typeof currentField> = ['enabled', 'fast', 'code', 'reasoning', 'tools'];
        const currentIndex = fields.indexOf(currentField);
        setCurrentField(fields[Math.min(fields.length - 1, currentIndex + 1)]);
      } else if (key.return) {
        if (currentField === 'enabled') {
          const newConfig = { ...config, enabled: !config.enabled };
          setConfig(newConfig);
          expertModelsManager.setExpertModelsConfig(newConfig);
        } else {
          setShowModelPicker(true);
        }
      } else if (key.backspace || key.delete) {
        if (currentField !== 'enabled') {
          const newConfig = { ...config };
          switch (currentField) {
            case 'fast':
              newConfig.fastModel = null;
              break;
            case 'code':
              newConfig.codeModel = null;
              break;
            case 'reasoning':
              newConfig.reasoningModel = null;
              break;
            case 'tools':
              newConfig.toolsModel = null;
              break;
          }
          setConfig(newConfig);
          expertModelsManager.setExpertModelsConfig(newConfig);
        }
      }
    }
  });

  if (showModelPicker) {
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">Select Model for {currentField === 'fast' ? 'Fast Operations' : 
          currentField === 'code' ? 'Code Tasks' : 
          currentField === 'reasoning' ? 'Complex Reasoning' : 'Tool Operations'}</Text>
        <Text dimColor>Type to search, ↑↓ to navigate, Enter to select, Esc to cancel</Text>
        
        <Box marginTop={1}>
          <Text>Search: {searchQuery}</Text>
        </Box>

        <Box flexDirection="column" marginTop={1}>
          {filteredModels.slice(0, 10).map((model, index) => (
            <Box key={model.name}>
              <Text color={index === selectedIndex ? 'cyan' : 'white'}>
                {index === selectedIndex ? '► ' : '  '}
                {model.name} <Text dimColor>({model.provider})</Text>
              </Text>
            </Box>
          ))}
          {filteredModels.length > 10 && (
            <Text dimColor>... and {filteredModels.length - 10} more</Text>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">Expert Models Configuration</Text>
      <Text dimColor>Use different models for different types of tasks</Text>
      <Text dimColor>↑↓ to navigate, Enter to toggle/select, Backspace to clear, Esc to exit</Text>

      <Box flexDirection="column" marginTop={2}>
        <Box>
          <Text color={currentField === 'enabled' ? 'cyan' : 'white'}>
            {currentField === 'enabled' ? '► ' : '  '}
            Expert Mode: {config.enabled ? 
              <Text color="green">Enabled</Text> : 
              <Text color="red">Disabled</Text>
            }
          </Text>
        </Box>

        <Box marginTop={1}>
          <Text color={currentField === 'fast' ? 'cyan' : config.enabled ? 'white' : 'gray'}>
            {currentField === 'fast' ? '► ' : '  '}
            Fast Operations: {config.fastModel ? 
              <Text color="green">{config.fastModel}</Text> : 
              <Text dimColor>Not set</Text>
            }
          </Text>
        </Box>

        <Box>
          <Text color={currentField === 'code' ? 'cyan' : config.enabled ? 'white' : 'gray'}>
            {currentField === 'code' ? '► ' : '  '}
            Code Tasks: {config.codeModel ? 
              <Text color="green">{config.codeModel}</Text> : 
              <Text dimColor>Not set</Text>
            }
          </Text>
        </Box>

        <Box>
          <Text color={currentField === 'reasoning' ? 'cyan' : config.enabled ? 'white' : 'gray'}>
            {currentField === 'reasoning' ? '► ' : '  '}
            Complex Reasoning: {config.reasoningModel ? 
              <Text color="green">{config.reasoningModel}</Text> : 
              <Text dimColor>Not set</Text>
            }
          </Text>
        </Box>

        <Box>
          <Text color={currentField === 'tools' ? 'cyan' : config.enabled ? 'white' : 'gray'}>
            {currentField === 'tools' ? '► ' : '  '}
            Tool Operations: {config.toolsModel ? 
              <Text color="green">{config.toolsModel}</Text> : 
              <Text dimColor>Not set</Text>
            }
          </Text>
        </Box>
      </Box>

      <Box marginTop={2}>
        <Text dimColor>
          • Fast: File navigation, simple commands{'\n'}
          • Code: Code editing, refactoring, syntax fixes{'\n'}
          • Reasoning: Complex problem solving, architecture decisions{'\n'}
          • Tools: Multi-tool workflows, complex orchestration
        </Text>
      </Box>
    </Box>
  );
};