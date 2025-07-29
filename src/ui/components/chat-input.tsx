import React from "react";
import { Box, Text } from "ink";
import { NeonText } from "./neon-text";

interface ChatInputProps {
  input: string;
  isProcessing: boolean;
  isStreaming: boolean;
  currentModel?: string;
}

export function ChatInput({ input, isProcessing, isStreaming, currentModel }: ChatInputProps) {
  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor="gray" paddingX={1} marginTop={1}>
        <Text color="gray">❯ </Text>
        <Text>
          {input}
          {!isProcessing && !isStreaming && <Text color="white">█</Text>}
        </Text>
      </Box>
      {currentModel && (
        <Box justifyContent="flex-end" marginTop={1}>
          <NeonText text={currentModel} />
        </Box>
      )}
    </Box>
  );
}