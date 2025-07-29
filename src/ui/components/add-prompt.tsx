import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

interface AddPromptProps {
  onClose: () => void;
  onAddPrompt: (name: string, content: string) => void;
}

export default function AddPrompt({ onClose, onAddPrompt }: AddPromptProps) {
  const [stage, setStage] = useState<'name' | 'content'>('name');
  const [promptName, setPromptName] = useState("");
  const [promptContent, setPromptContent] = useState("");
  const [currentLine, setCurrentLine] = useState("");

  useInput((inputChar, key) => {
    if (key.ctrl && inputChar === "c") {
      onClose();
      return;
    }

    if (key.escape) {
      if (stage === 'content') {
        setStage('name');
        setPromptContent("");
        setCurrentLine("");
      } else {
        onClose();
      }
      return;
    }

    if (stage === 'name') {
      if (key.return) {
        if (promptName.trim()) {
          setStage('content');
        }
        return;
      }
      
      if (key.backspace || key.delete) {
        setPromptName(prev => prev.slice(0, -1));
        return;
      }
      
      if (inputChar && !key.ctrl && !key.meta) {
        setPromptName(prev => prev + inputChar);
        return;
      }
    } else if (stage === 'content') {
      if (key.ctrl && inputChar === "s") {
        // Save the prompt
        if (promptName.trim() && (promptContent.trim() || currentLine.trim())) {
          const finalContent = promptContent + (currentLine ? (promptContent ? '\n' : '') + currentLine : '');
          onAddPrompt(promptName.trim(), finalContent.trim());
        }
        return;
      }

      if (key.return) {
        setPromptContent(prev => prev + (prev ? '\n' : '') + currentLine);
        setCurrentLine("");
        return;
      }
      
      if (key.backspace || key.delete) {
        if (currentLine) {
          setCurrentLine(prev => prev.slice(0, -1));
        } else if (promptContent) {
          const lines = promptContent.split('\n');
          const lastLine = lines.pop() || '';
          setPromptContent(lines.join('\n'));
          setCurrentLine(lastLine);
        }
        return;
      }
      
      if (inputChar && !key.ctrl && !key.meta) {
        setCurrentLine(prev => prev + inputChar);
        return;
      }
    }
  });

  if (stage === 'name') {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="yellow">➕ Add Custom Prompt</Text>
        <Box marginBottom={1}>
          <Text color="gray">Enter prompt name:</Text>
        </Box>
        
        <Box borderStyle="round" borderColor="blue" paddingX={1} marginBottom={1}>
          <Text>{promptName}█</Text>
        </Box>

        <Box flexDirection="column" marginTop={1}>
          <Text color="gray" dimColor>• Type the name for your custom prompt</Text>
          <Text color="gray" dimColor>• Press Enter to continue to content</Text>
          <Text color="gray" dimColor>• Press Esc to cancel</Text>
        </Box>
      </Box>
    );
  }

  // Content stage
  const displayContent = promptContent + (promptContent && currentLine ? '\n' : '') + currentLine;
  const lines = displayContent.split('\n');
  const displayLines = lines.slice(-8); // Show last 8 lines
  const hasMoreLines = lines.length > 8;

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color="yellow">➕ Add Custom Prompt: {promptName}</Text>
      <Box marginBottom={1}>
        <Text color="gray">Enter prompt content (markdown supported):</Text>
      </Box>
      
      <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1} marginBottom={1} minHeight={10}>
        {hasMoreLines && (
          <Text color="gray" dimColor>... ({lines.length - 8} more lines above)</Text>
        )}
        {displayLines.map((line, index) => (
          <Text key={index}>{line}{index === displayLines.length - 1 ? '█' : ''}</Text>
        ))}
        {displayLines.length === 0 && <Text>█</Text>}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color="gray" dimColor>• Type your prompt content (multi-line supported)</Text>
        <Text color="gray" dimColor>• Press Enter for new line</Text>
        <Text color="green" dimColor>• Press Ctrl+S to save prompt</Text>
        <Text color="gray" dimColor>• Press Esc to go back</Text>
      </Box>
    </Box>
  );
}