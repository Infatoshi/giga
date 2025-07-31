import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { ConversationManager, ConversationSummary } from '../../utils/conversation-manager';
import { fuzzySearch } from '../../utils/fuzzy-search';

interface ConversationHistoryProps {
  isVisible: boolean;
  onClose: () => void;
  onSelectConversation: (conversationId: string) => void;
}

export function ConversationHistory({ 
  isVisible, 
  onClose, 
  onSelectConversation 
}: ConversationHistoryProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<ConversationSummary[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const conversationManager = ConversationManager.getInstance();

  // Load conversations on mount
  useEffect(() => {
    if (isVisible) {
      loadConversations();
    }
  }, [isVisible]);

  // Filter conversations when search query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredConversations(conversations);
    } else {
      const filtered = fuzzySearch(
        searchQuery,
        conversations,
        (conv) => `${conv.title} ${conv.preview}`,
        10
      );
      setFilteredConversations(filtered);
    }
    setSelectedIndex(0);
  }, [conversations, searchQuery]);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const convList = await conversationManager.listConversations();
      setConversations(convList);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else if (diffDays < 30) {
      return `${Math.floor(diffDays / 7)}w ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await conversationManager.deleteConversation(conversationId);
      await loadConversations();
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  useInput((input, key) => {
    if (!isVisible) return;

    if (key.escape) {
      onClose();
      return;
    }

    if (key.return) {
      if (filteredConversations.length > 0 && selectedIndex < filteredConversations.length) {
        onSelectConversation(filteredConversations[selectedIndex].id);
        onClose();
      }
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(prev => 
        prev > 0 ? prev - 1 : Math.max(0, filteredConversations.length - 1)
      );
      return;
    }

    if (key.downArrow) {
      setSelectedIndex(prev => 
        prev < filteredConversations.length - 1 ? prev + 1 : 0
      );
      return;
    }

    if (key.delete || key.backspace) {
      if (searchQuery.length > 0) {
        setSearchQuery(prev => prev.slice(0, -1));
      }
      return;
    }

    // Handle delete key (d) to delete conversation
    if (input === 'd' && filteredConversations.length > 0) {
      const conversation = filteredConversations[selectedIndex];
      if (conversation) {
        handleDeleteConversation(conversation.id);
      }
      return;
    }

    // Handle regular character input for search
    if (input && input.length === 1 && !key.ctrl && !key.meta) {
      setSearchQuery(prev => prev + input);
    }
  });

  if (!isVisible) {
    return null;
  }

  return (
    <Box 
      flexDirection="column" 
      width="100%" 
      height={20}
      borderStyle="round" 
      borderColor="cyan"
      padding={1}
    >
      <Box marginBottom={1}>
        <Text bold color="cyan">📚 Conversation History</Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="gray">
          Search: {searchQuery}
          {searchQuery && <Text color="cyan">█</Text>}
        </Text>
      </Box>

      {isLoading ? (
        <Box justifyContent="center" alignItems="center" height={10}>
          <Text color="cyan">Loading conversations...</Text>
        </Box>
      ) : filteredConversations.length === 0 ? (
        <Box justifyContent="center" alignItems="center" height={10}>
          <Text color="gray">
            {searchQuery ? 'No matching conversations found' : 'No conversations yet'}
          </Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {filteredConversations.slice(0, 12).map((conversation, index) => {
            const isSelected = index === selectedIndex;
            
            return (
              <Box key={conversation.id} flexDirection="column" width="100%">
                <Box flexDirection="row" justifyContent="space-between">
                  <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                    {isSelected ? '> ' : '  '}{conversation.title}
                  </Text>
                  <Text color={isSelected ? 'cyan' : 'gray'} dimColor={!isSelected}>
                    {formatDate(conversation.updatedAt)}
                  </Text>
                </Box>
                
                <Box flexDirection="row" justifyContent="space-between">
                  <Text color={isSelected ? 'cyan' : 'gray'} dimColor={!isSelected}>
                    {isSelected ? '  ' : '  '}{conversation.preview.slice(0, 50)}...
                  </Text>
                  <Text color={isSelected ? 'cyan' : 'gray'} dimColor={!isSelected}>
                    {conversation.messageCount} msgs | {conversation.model}
                  </Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ↑↓ Navigate • Enter Select • d Delete • Esc Close • Type to search
        </Text>
      </Box>
    </Box>
  );
}