import React from 'react';
import { Box, Text } from 'ink';

interface TokenProgressBarProps {
  current: number;
  max: number;
  model: string;
}

const TokenProgressBar: React.FC<TokenProgressBarProps> = ({ current, max, model }) => {
  const percentage = max > 0 ? (current / max) * 100 : 0;
  const barWidth = 20;
  const filledWidth = Math.round((percentage / 100) * barWidth);
  const emptyWidth = barWidth - filledWidth;

  const filledStr = '█'.repeat(filledWidth);
  const emptyStr = ' '.repeat(emptyWidth);

  let barColor = 'green';
  if (percentage > 85) {
    barColor = 'red';
  } else if (percentage > 60) {
    barColor = 'yellow';
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>
        <Text bold>Model:</Text> {model}
      </Text>
      <Box>
        <Text>
          <Text bold>Context:</Text> [{`${filledStr}${emptyStr}`}] {Math.round(percentage)}% ({current} / {max})
        </Text>
      </Box>
    </Box>
  );
};

export default TokenProgressBar;