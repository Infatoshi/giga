import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { loadPrompts, CustomPrompt } from "../../utils/prompts";

interface PromptsListProps {
  onClose: () => void;
  onSelectPrompt?: (promptName: string | null) => void;
  selectedPrompt?: string | null;
}

export default function PromptsList({ onClose, onSelectPrompt, selectedPrompt }: PromptsListProps) {
  const [prompts, setPrompts] = useState<CustomPrompt[]>([]);
  const [allOptions, setAllOptions] = useState<(CustomPrompt | { name: string; content: string; dateAdded: string; isNone: boolean })[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [justSelected, setJustSelected] = useState<string | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  useEffect(() => {
    const promptsData = loadPrompts();
    setPrompts(promptsData);
    
    // Create options list with "None" option first, then all prompts
    const noneOption = {
      name: "GIGA (Default)",
      content: "Use default GIGA assistant prompt with file editing and coding tools",
      dateAdded: new Date().toISOString(),
      isNone: true
    };
    
    const options = [noneOption, ...promptsData];
    setAllOptions(options);
    
    // Set initial selected index based on current selected prompt
    if (selectedPrompt) {
      const promptIndex = promptsData.findIndex(p => p.name === selectedPrompt);
      if (promptIndex !== -1) {
        setSelectedIndex(promptIndex + 1); // +1 because None is first
      }
    } else {
      setSelectedIndex(0); // None is selected
    }
  }, [selectedPrompt]);

  useInput((inputChar, key) => {
    if (key.ctrl && inputChar === "c") {
      onClose();
      return;
    }

    if (key.escape) {
      if (showContent) {
        setShowContent(false);
      } else {
        onClose();
      }
      return;
    }

    if (!showContent) {
      if (key.upArrow) {
        setSelectedIndex(prev => prev === 0 ? Math.max(0, allOptions.length - 1) : prev - 1);
        return;
      }

      if (key.downArrow) {
        setSelectedIndex(prev => allOptions.length === 0 ? 0 : (prev + 1) % allOptions.length);
        return;
      }

      if (key.return) {
        if (allOptions.length > 0 && selectedIndex < allOptions.length) {
          // Select this prompt
          const selected = allOptions[selectedIndex];
          const promptName = 'isNone' in selected && selected.isNone ? null : selected.name;
          
          setJustSelected(promptName);
          setShowSuccessMessage(true);
          
          if (onSelectPrompt) {
            onSelectPrompt(promptName);
          }
          
          // Show success message briefly then close
          setTimeout(() => {
            onClose();
          }, 1000);
        }
        return;
      }

      if (inputChar === ' ') {
        // Space to select
        if (allOptions.length > 0 && selectedIndex < allOptions.length) {
          const selected = allOptions[selectedIndex];
          const promptName = 'isNone' in selected && selected.isNone ? null : selected.name;
          
          setJustSelected(promptName);
          setShowSuccessMessage(true);
          
          if (onSelectPrompt) {
            onSelectPrompt(promptName);
          }
          
          // Show success message briefly then close
          setTimeout(() => {
            onClose();
          }, 1000);
        }
        return;
      }

      if (inputChar === 'v' || inputChar === 'V') {
        // 'v' to view content
        if (allOptions.length > 0 && selectedIndex < allOptions.length) {
          setShowContent(true);
        }
        return;
      }
    }
  });

  if (showSuccessMessage) {
    const selectedName = justSelected || "GIGA (Default)";
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="green">✅ System Prompt Changed!</Text>
        <Box marginBottom={1} borderStyle="round" borderColor="green" paddingX={1}>
          <Text color="green">Now using: {selectedName}</Text>
        </Box>
        <Box marginTop={1}>
          <Text color="gray" dimColor>Closing...</Text>
        </Box>
      </Box>
    );
  }

  if (allOptions.length <= 1) { // Only "GIGA" option exists
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="yellow">🎯 Select System Prompt</Text>
        <Box marginBottom={1}>
          <Text color="gray">No custom prompts added. Using default GIGA assistant.</Text>
        </Box>
        <Box flexDirection="column" marginBottom={1}>
          <Box borderStyle="round" borderColor="green" paddingX={1}>
            <Text color="green">● GIGA (Default)</Text>
          </Box>
        </Box>
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray" dimColor>• Press Space or Enter to confirm</Text>
          <Text color="gray" dimColor>• Use /add-prompt to add custom system prompts</Text>
          <Text color="gray" dimColor>• Custom prompts completely replace GIGA</Text>
          <Text color="gray" dimColor>• Press Esc to close</Text>
        </Box>
      </Box>
    );
  }

  if (showContent) {
    const selectedOption = allOptions[selectedIndex];
    const contentLines = selectedOption.content.split('\n');
    
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="yellow">📝 Prompt: {selectedOption.name}</Text>
        <Box marginBottom={1}>
          <Text color="gray">
            {'isNone' in selectedOption && selectedOption.isNone 
              ? "Default system prompt" 
              : `Added: ${new Date(selectedOption.dateAdded).toLocaleDateString()}`
            }
          </Text>
        </Box>
        
        <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1} marginBottom={1} minHeight={15}>
          {contentLines.map((line, index) => (
            <Text key={index}>{line}</Text>
          ))}
        </Box>

        <Box flexDirection="column" marginTop={1}>
          <Text color="gray" dimColor>• Press Space or Enter to select this prompt</Text>
          <Text color="gray" dimColor>• Press Esc to go back to prompt list</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color="yellow">🎯 Select System Prompt</Text>
      <Box marginBottom={1}>
        <Text color="gray">
          Current: {selectedPrompt || "GIGA (Default)"}
        </Text>
      </Box>
      
      <Box flexDirection="column" marginBottom={1}>
        {allOptions.map((option, index) => {
          const isSelected = index === selectedIndex;
          const isCurrentlyActive = selectedPrompt === option.name || (!selectedPrompt && 'isNone' in option && option.isNone);
          const dateAdded = 'isNone' in option && option.isNone 
            ? "Default" 
            : new Date(option.dateAdded).toLocaleDateString();
          const preview = option.content.length > 80 
            ? option.content.substring(0, 80) + "..." 
            : option.content;
          
          // Color coding: green for currently active, blue for selected, gray for others
          let borderColor = "gray";
          let textColor = "white";
          
          if (isCurrentlyActive) {
            borderColor = "green";
            textColor = "green";
          } else if (isSelected) {
            borderColor = "blue"; 
            textColor = "blue";
          }
          
          return (
            <Box 
              key={option.name}
              borderStyle="round" 
              borderColor={borderColor}
              paddingX={1} 
              marginBottom={1}
            >
              <Box flexDirection="column" width="100%">
                <Box>
                  <Box width={25}>
                    <Text color={textColor}>
                      {isCurrentlyActive ? "● " : isSelected ? "▶ " : "○ "}{option.name}
                    </Text>
                  </Box>
                  <Box flexGrow={1}>
                    <Text color="gray" dimColor>{dateAdded}</Text>
                  </Box>
                </Box>
                <Box marginTop={1}>
                  <Text color="gray" dimColor>{preview.replace(/\n/g, ' ')}</Text>
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color="gray" dimColor>• Use ↑/↓ arrows to navigate</Text>
        <Text color="gray" dimColor>• Press Space or Enter to select prompt</Text>
        <Text color="gray" dimColor>• Press V to view full content</Text>
        <Text color="gray" dimColor>• Custom prompts completely replace GIGA</Text>
        <Text color="green" dimColor>• Green = Currently active prompt</Text>
        <Text color="blue" dimColor>• Blue = Currently selected option</Text>
        <Text color="gray" dimColor>• Press Esc to close</Text>
      </Box>
    </Box>
  );
}