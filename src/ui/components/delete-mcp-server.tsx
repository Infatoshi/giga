import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { loadAddedMcpServers, AddedMcpServer } from "../../utils/added-mcp-servers";

interface DeleteMcpServerProps {
  onClose: () => void;
  onDeleteServer: (name: string) => void;
}

export default function DeleteMcpServer({ onClose, onDeleteServer }: DeleteMcpServerProps) {
  const [servers, setServers] = useState<AddedMcpServer[]>([]);
  const [filteredServers, setFilteredServers] = useState<AddedMcpServer[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    loadServers();
    
    return () => {
      setIsMounted(false);
    };
  }, []);

  useEffect(() => {
    updateFilteredServers();
  }, [searchQuery, servers]);

  const loadServers = () => {
    const loadedServers = loadAddedMcpServers();
    if (isMounted) {
      setServers(loadedServers);
    }
  };

  const updateFilteredServers = () => {
    if (!searchQuery.trim()) {
      setFilteredServers(servers);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = servers.filter(server => 
      server.name.toLowerCase().includes(query) ||
      server.command.toLowerCase().includes(query) ||
      (server.description && server.description.toLowerCase().includes(query))
    ).sort((a, b) => a.name.localeCompare(b.name));

    setFilteredServers(filtered);
    
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
      setSelectedIndex(prev => prev === 0 ? Math.max(0, filteredServers.length - 1) : prev - 1);
      return;
    }

    if (key.downArrow) {
      setSelectedIndex(prev => filteredServers.length === 0 ? 0 : (prev + 1) % Math.min(10, filteredServers.length));
      return;
    }

    if (key.return) {
      if (filteredServers.length > 0 && selectedIndex < filteredServers.length) {
        const selectedServer = filteredServers[selectedIndex];
        onDeleteServer(selectedServer.name);
        
        // Refresh servers after deletion
        setTimeout(() => {
          if (isMounted) {
            loadServers();
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

  if (servers.length === 0) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="yellow">🗑️  Delete MCP Server</Text>
        <Box marginBottom={1}>
          <Text color="gray">No MCP servers have been added yet.</Text>
        </Box>
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray" dimColor>Use /add-mcp to add servers first</Text>
          <Text color="gray" dimColor>Press Esc to close</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color="yellow">🗑️  Delete MCP Server</Text>
      <Box marginBottom={1}>
        <Text color="gray">Search: </Text>
        <Text>{searchQuery || ""}█</Text>
      </Box>
      
      <Box flexDirection="column" marginBottom={1}>
        {filteredServers.length === 0 ? (
          <Box borderStyle="round" borderColor="gray" paddingX={1}>
            <Text color="gray">No servers found matching "{searchQuery}"</Text>
          </Box>
        ) : (
          filteredServers.slice(0, 10).map((server, index) => {
            const isSelected = index === selectedIndex;
            const dateAdded = new Date(server.dateAdded).toLocaleDateString();
            
            return (
              <Box 
                key={server.name}
                borderStyle="round" 
                borderColor={isSelected ? "red" : "gray"} 
                paddingX={1} 
                marginBottom={1}
              >
                <Box flexDirection="column">
                  <Box>
                    <Box width={20}>
                      <Text color={isSelected ? "red" : "white"}>{server.name}</Text>
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
          })
        )}
        {filteredServers.length > 10 && (
          <Box paddingX={1}>
            <Text color="gray" dimColor>... and {filteredServers.length - 10} more</Text>
          </Box>
        )}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color="gray" dimColor>• Type to search servers</Text>
        <Text color="gray" dimColor>• Use ↑/↓ arrows to navigate</Text>
        <Text color="red" dimColor>• Press Enter to DELETE selected server</Text>
        <Text color="gray" dimColor>• Press Esc to cancel</Text>
      </Box>
    </Box>
  );
}