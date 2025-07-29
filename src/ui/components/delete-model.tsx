import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { loadAddedModels, deleteModel, AddedModel } from "../../utils/added-models";

interface DeleteModelProps {
  onClose: () => void;
  onDeleteModel: (modelName: string, providerName: string) => void;
}

export default function DeleteModel({ onClose, onDeleteModel }: DeleteModelProps) {
  const [addedModels, setAddedModels] = useState<AddedModel[]>([]);
  const [filteredModels, setFilteredModels] = useState<AddedModel[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    loadModels();
    
    return () => {
      setIsMounted(false);
    };
  }, []);

  useEffect(() => {
    updateFilteredModels();
  }, [searchQuery, addedModels]);

  const loadModels = () => {
    const models = loadAddedModels();
    if (isMounted) {
      setAddedModels(models);
    }
  };

  const updateFilteredModels = () => {
    if (!searchQuery.trim()) {
      setFilteredModels(addedModels);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = addedModels.filter(model => 
      model.modelName.toLowerCase().includes(query) ||
      model.providerName.toLowerCase().includes(query)
    ).sort((a, b) => a.modelName.localeCompare(b.modelName));

    setFilteredModels(filtered);
    
    // Reset selection if current index is out of bounds
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(0);
    }
  };

  useInput((inputChar, key) => {
    if (key.ctrl && inputChar === "c") {
      onClose();
      return;
    }

    if (key.escape) {
      onClose();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(prev => prev === 0 ? Math.max(0, filteredModels.length - 1) : prev - 1);
      return;
    }

    if (key.downArrow) {
      setSelectedIndex(prev => filteredModels.length === 0 ? 0 : (prev + 1) % Math.min(10, filteredModels.length));
      return;
    }

    if (key.return) {
      if (filteredModels.length > 0 && selectedIndex < filteredModels.length) {
        const selectedModel = filteredModels[selectedIndex];
        onDeleteModel(selectedModel.modelName, selectedModel.providerName);
        
        // Refresh models after deletion
        setTimeout(() => {
          if (isMounted) {
            loadModels();
          }
        }, 100);
      }
      return;
    }

    if (key.backspace || key.delete) {
      setSearchQuery(prev => prev.slice(0, -1));
      setSelectedIndex(0);
      return;
    }

    if (inputChar && !key.ctrl && !key.meta) {
      setSearchQuery(prev => prev + inputChar);
      setSelectedIndex(0);
      return;
    }
  });

  if (addedModels.length === 0) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="yellow">🗑️  Delete Model</Text>
        <Box marginBottom={1}>
          <Text color="gray">No models have been added yet.</Text>
        </Box>
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray" dimColor>Use /add-model to add models first</Text>
          <Text color="gray" dimColor>Press Esc to close</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color="yellow">🗑️  Delete Model</Text>
      <Box marginBottom={1}>
        <Text color="gray">Search: </Text>
        <Text>{searchQuery || ""}█</Text>
      </Box>
      
      <Box flexDirection="column" marginBottom={1}>
        {filteredModels.length === 0 ? (
          <Box borderStyle="round" borderColor="gray" paddingX={1}>
            <Text color="gray">No models found matching "{searchQuery}"</Text>
          </Box>
        ) : (
          filteredModels.slice(0, 10).map((model, index) => {
            const isSelected = index === selectedIndex;
            const dateAdded = new Date(model.dateAdded).toLocaleDateString();
            
            return (
              <Box 
                key={`${model.modelName}-${model.providerName}`}
                borderStyle="round" 
                borderColor={isSelected ? "red" : "gray"} 
                paddingX={1} 
                marginBottom={1}
              >
                <Box width={30}>
                  <Text color={isSelected ? "red" : "white"}>{model.modelName}</Text>
                </Box>
                <Box width={15}>
                  <Text color="cyan">({model.providerName})</Text>
                </Box>
                <Box flexGrow={1}>
                  <Text color="gray" dimColor>Added {dateAdded}</Text>
                </Box>
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
        <Text color="gray" dimColor>• Type to search models</Text>
        <Text color="gray" dimColor>• Use ↑/↓ arrows to navigate</Text>
        <Text color="red" dimColor>• Press Enter to DELETE selected model</Text>
        <Text color="gray" dimColor>• Press Esc to cancel</Text>
      </Box>
    </Box>
  );
}