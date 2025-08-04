import React from "react";
import { Box, Text } from "ink";

interface FileFinderProps {
  files: string[];
  selectedIndex: number;
  query: string;
  isVisible: boolean;
  maxItems?: number;
}

export function FileFinder({ 
  files, 
  selectedIndex, 
  query, 
  isVisible, 
  maxItems = 8 
}: FileFinderProps) {
  if (!isVisible || files.length === 0) {
    return null;
  }

  const displayFiles = files.slice(0, maxItems);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Box flexDirection="column">
          <Text color="cyan" bold>
            {query.endsWith('/') ? '📁 Directories matching' : '📄 Files matching'} "@{query}"
          </Text>
          {displayFiles.map((file, index) => {
            const isDirectory = file.endsWith('/');
            const icon = isDirectory ? '📁' : '📄';
            
            return (
              <Box key={index} paddingLeft={1}>
                <Text
                  color={index === selectedIndex ? "black" : "white"}
                  backgroundColor={index === selectedIndex ? "cyan" : undefined}
                >
                  {index === selectedIndex ? "▶ " : "  "}
                  {icon} {file}
                </Text>
              </Box>
            );
          })}
          <Box marginTop={1} paddingX={1}>
            <Text color="gray" dimColor>
              ↑↓ navigate • Enter select • Esc cancel
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}