import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { loadPrompts, CustomPrompt } from "../../utils/prompts";

interface DeletePromptProps {
  onClose: () => void;
  onDeletePrompt: (name: string) => void;
}

export default function DeletePrompt({ onClose, onDeletePrompt }: DeletePromptProps) {
  const [prompts, setPrompts] = useState<CustomPrompt[]>([]);
  const [filteredPrompts, setFilteredPrompts] = useState<CustomPrompt[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    loadPromptsData();
    
    return () => {
      setIsMounted(false);
    };
  }, []);

  useEffect(() => {
    updateFilteredPrompts();
  }, [searchQuery, prompts]);

  const loadPromptsData = () => {
    const promptsData = loadPrompts();
    if (isMounted) {
      setPrompts(promptsData);
    }
  };

  const updateFilteredPrompts = () => {
    if (!searchQuery.trim()) {
      setFilteredPrompts(prompts);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = prompts.filter(prompt => 
      prompt.name.toLowerCase().includes(query) ||
      prompt.content.toLowerCase().includes(query)
    ).sort((a, b) => a.name.localeCompare(b.name));

    setFilteredPrompts(filtered);
    
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
      setSelectedIndex(prev => prev === 0 ? Math.max(0, filteredPrompts.length - 1) : prev - 1);
      return;
    }

    if (key.downArrow) {
      setSelectedIndex(prev => filteredPrompts.length === 0 ? 0 : (prev + 1) % Math.min(10, filteredPrompts.length));
      return;
    }

    if (key.return) {
      if (filteredPrompts.length > 0 && selectedIndex < filteredPrompts.length) {
        const selectedPrompt = filteredPrompts[selectedIndex];
        onDeletePrompt(selectedPrompt.name);
        
        // Refresh prompts after deletion
        setTimeout(() => {
          if (isMounted) {
            loadPromptsData();
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

  if (prompts.length === 0) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="yellow">🗑️  Delete Custom Prompt</Text>
        <Box marginBottom={1}>
          <Text color="gray">No custom prompts have been added yet.</Text>
        </Box>
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray" dimColor>Use /add-prompt to add prompts first</Text>
          <Text color="gray" dimColor>Press Esc to close</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color="yellow">🗑️  Delete Custom Prompt</Text>
      <Box marginBottom={1}>
        <Text color="gray">Search: </Text>
        <Text>{searchQuery || ""}█</Text>
      </Box>
      
      <Box flexDirection="column" marginBottom={1}>
        {filteredPrompts.length === 0 ? (
          <Box borderStyle="round" borderColor="gray" paddingX={1}>
            <Text color="gray">No prompts found matching "{searchQuery}"</Text>
          </Box>
        ) : (
          filteredPrompts.slice(0, 10).map((prompt, index) => {
            const isSelected = index === selectedIndex;
            const dateAdded = new Date(prompt.dateAdded).toLocaleDateString();
            const preview = prompt.content.length > 60 
              ? prompt.content.substring(0, 60) + "..." 
              : prompt.content;
            
            return (
              <Box 
                key={prompt.name}
                borderStyle="round" 
                borderColor={isSelected ? "red" : "gray"} 
                paddingX={1} 
                marginBottom={1}
              >
                <Box flexDirection="column" width="100%">
                  <Box>
                    <Box width={25}>
                      <Text color={isSelected ? "red" : "white"}>{prompt.name}</Text>
                    </Box>
                    <Box flexGrow={1}>
                      <Text color="gray" dimColor>Added {dateAdded}</Text>
                    </Box>
                  </Box>
                  <Box marginTop={1}>
                    <Text color="gray" dimColor>{preview.replace(/\n/g, ' ')}</Text>
                  </Box>
                </Box>
              </Box>
            );
          })
        )}
        {filteredPrompts.length > 10 && (
          <Box paddingX={1}>
            <Text color="gray" dimColor>... and {filteredPrompts.length - 10} more</Text>
          </Box>
        )}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color="gray" dimColor>• Type to search prompts</Text>
        <Text color="gray" dimColor>• Use ↑/↓ arrows to navigate</Text>
        <Text color="red" dimColor>• Press Enter to DELETE selected prompt</Text>
        <Text color="gray" dimColor>• Press Esc to cancel</Text>
      </Box>
    </Box>
  );
}