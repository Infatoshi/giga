import React from "react";
import { Box, Text } from "ink";
import { AddedMcpServer } from "../../utils/added-mcp-servers";

interface McpServerSelectionProps {
  servers: AddedMcpServer[];
  selectedIndex: number;
  isVisible: boolean;
}

export function McpServerSelection({ 
  servers, 
  selectedIndex, 
  isVisible 
}: McpServerSelectionProps) {
  if (!isVisible || servers.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color="yellow">🔗 MCP Servers</Text>
      <Box marginBottom={1}>
        <Text color="gray">Available MCP servers:</Text>
      </Box>
      
      <Box flexDirection="column" marginBottom={1}>
        {servers.slice(0, 10).map((server, index) => {
          const isSelected = index === selectedIndex;
          const dateAdded = new Date(server.dateAdded).toLocaleDateString();
          
          return (
            <Box 
              key={server.name}
              borderStyle="round" 
              borderColor={isSelected ? "blue" : "gray"} 
              paddingX={1} 
              marginBottom={1}
            >
              <Box flexDirection="column">
                <Box>
                  <Box width={20}>
                    <Text color={isSelected ? "blue" : "white"}>{server.name}</Text>
                  </Box>
                  <Box width={40}>
                    <Text color="cyan">{server.command}</Text>
                  </Box>
                  <Box flexGrow={1}>
                    <Text color="gray" dimColor>Added {dateAdded}</Text>
                  </Box>
                </Box>
                {server.description && (
                  <Box paddingLeft={2}>
                    <Text color="gray" dimColor>{server.description}</Text>
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
        {servers.length > 10 && (
          <Box paddingX={1}>
            <Text color="gray" dimColor>... and {servers.length - 10} more</Text>
          </Box>
        )}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color="gray" dimColor>• Use ↑/↓ arrows to navigate</Text>
        <Text color="gray" dimColor>• Press Enter to view server details</Text>
        <Text color="gray" dimColor>• Press Esc to close</Text>
      </Box>
    </Box>
  );
}