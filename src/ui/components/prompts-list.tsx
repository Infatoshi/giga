import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { loadPrompts, CustomPrompt } from "../../utils/prompts";

interface PromptsListProps {
  onClose: () => void;
}

export default function PromptsList({ onClose }: PromptsListProps) {
  const [prompts, setPrompts] = useState<CustomPrompt[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const promptsData = loadPrompts();
    setPrompts(promptsData);
  }, []);

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
        setSelectedIndex(prev => prev === 0 ? Math.max(0, prompts.length - 1) : prev - 1);
        return;
      }

      if (key.downArrow) {
        setSelectedIndex(prev => prompts.length === 0 ? 0 : (prev + 1) % prompts.length);
        return;
      }

      if (key.return) {
        if (prompts.length > 0 && selectedIndex < prompts.length) {
          setShowContent(true);
        }
        return;
      }
    }
  });

  if (prompts.length === 0) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="yellow">📝 Custom Prompts</Text>
        <Box marginBottom={1}>
          <Text color="gray">No custom prompts have been added yet.</Text>
        </Box>
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray" dimColor>Use /add-prompt to add prompts</Text>
          <Text color="gray" dimColor>Press Esc to close</Text>
        </Box>
      </Box>
    );
  }

  if (showContent) {
    const selectedPrompt = prompts[selectedIndex];
    const contentLines = selectedPrompt.content.split('\n');
    
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="yellow">📝 Prompt: {selectedPrompt.name}</Text>
        <Box marginBottom={1}>
          <Text color="gray">Added: {new Date(selectedPrompt.dateAdded).toLocaleDateString()}</Text>
        </Box>
        
        <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1} marginBottom={1} minHeight={15}>
          {contentLines.map((line, index) => (
            <Text key={index}>{line}</Text>
          ))}
        </Box>

        <Box flexDirection="column" marginTop={1}>
          <Text color="gray" dimColor>• Press Esc to go back to prompt list</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color="yellow">📝 Custom Prompts ({prompts.length})</Text>
      <Box marginBottom={1}>
        <Text color="gray">Select a prompt to view its content:</Text>
      </Box>
      
      <Box flexDirection="column" marginBottom={1}>
        {prompts.map((prompt, index) => {
          const isSelected = index === selectedIndex;
          const dateAdded = new Date(prompt.dateAdded).toLocaleDateString();
          const preview = prompt.content.length > 80 
            ? prompt.content.substring(0, 80) + "..." 
            : prompt.content;
          
          return (
            <Box 
              key={prompt.name}
              borderStyle="round" 
              borderColor={isSelected ? "blue" : "gray"} 
              paddingX={1} 
              marginBottom={1}
            >
              <Box flexDirection="column" width="100%">
                <Box>
                  <Box width={25}>
                    <Text color={isSelected ? "blue" : "white"}>{prompt.name}</Text>
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
        })}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color="gray" dimColor>• Use ↑/↓ arrows to navigate</Text>
        <Text color="gray" dimColor>• Press Enter to view selected prompt</Text>
        <Text color="gray" dimColor>• Press Esc to close</Text>
      </Box>
    </Box>
  );
}