import React from "react";
import { Box, Text } from "ink";

interface TemperatureSelectorProps {
  temperature: number;
  isVisible: boolean;
}

export function TemperatureSelector({
  temperature,
  isVisible,
}: TemperatureSelectorProps) {
  if (!isVisible) return null;

  const formatTemperature = (temp: number): string => {
    return temp.toFixed(1);
  };

  const createTemperatureBar = (temp: number): string => {
    const position = Math.round(temp * 10);
    const bar = Array(11).fill('─');
    bar[position] = '●';
    return bar.join('');
  };

  return (
    <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Box justifyContent="center">
        <Text color="cyan" bold>
          🌡️  Temperature Settings
        </Text>
      </Box>
      
      <Box marginTop={1} flexDirection="column">
        <Box justifyContent="center">
          <Text>
            Current: <Text color="yellow" bold>{formatTemperature(temperature)}</Text>
          </Text>
        </Box>
        
        <Box marginTop={1} justifyContent="center">
          <Text color="gray">0.0 </Text>
          <Text color="cyan">{createTemperatureBar(temperature)}</Text>
          <Text color="gray"> 1.0</Text>
        </Box>
        
        <Box marginTop={1} justifyContent="center">
          <Text color="gray">
            {temperature <= 0.3 ? 'Conservative' : temperature <= 0.7 ? 'Balanced' : 'Creative'}
          </Text>
        </Box>
      </Box>
      
      <Box marginTop={1} justifyContent="center">
        <Text color="gray" dimColor>
          ←→ adjust • Enter confirm • Esc cancel
        </Text>
      </Box>
    </Box>
  );
}