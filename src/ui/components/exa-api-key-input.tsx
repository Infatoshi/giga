import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { saveExaApiKey } from '../../utils/api-keys';

interface ExaApiKeyInputProps {
  onClose: () => void;
  onApiKeySet: () => void;
}

export default function ExaApiKeyInput({ onClose, onApiKeySet }: ExaApiKeyInputProps) {
  const [apiKey, setApiKey] = useState('');

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }

    if (key.return) {
      if (apiKey.trim()) {
        saveExaApiKey(apiKey.trim());
        onApiKeySet();
        onClose();
      }
      return;
    }

    if (key.backspace || key.delete) {
      setApiKey(prev => prev.slice(0, -1));
      return;
    }

    if (input) {
      setApiKey(prev => prev + input);
    }
  });

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="yellow">
      <Text bold>Set EXA API Key for Web Search</Text>
      <Text>
        Get your free API key at: <Text color="cyan" underline>https://dashboard.exa.ai/login</Text>
      </Text>
      <Box marginTop={1}>
        <Text>Enter API Key: </Text>
        <Text color="yellow">{apiKey}█</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press Enter to save, Esc to cancel.</Text>
      </Box>
    </Box>
  );
}