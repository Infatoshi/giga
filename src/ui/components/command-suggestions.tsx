import React from "react";
import { Box, Text } from "ink";
import { fuzzySearch } from "../../utils/fuzzy-search";

interface CommandSuggestion {
  command: string;
  description: string;
}

interface CommandSuggestionsProps {
  suggestions: CommandSuggestion[];
  input: string;
  selectedIndex: number;
  isVisible: boolean;
}

export function CommandSuggestions({
  suggestions,
  input,
  selectedIndex,
  isVisible,
}: CommandSuggestionsProps) {
  if (!isVisible) return null;

  const filteredSuggestions = input.startsWith("/")
    ? fuzzySearch(
        input.substring(1), // Remove the "/" for fuzzy matching
        suggestions.filter(s => s.command.startsWith("/")),
        (suggestion) => suggestion.command.substring(1), // Remove "/" for matching
        8
      )
    : fuzzySearch(
        input,
        suggestions,
        (suggestion) => suggestion.command,
        8
      );

  return (
    <Box marginTop={1} flexDirection="column">
      {filteredSuggestions.map((suggestion, index) => (
        <Box key={index} paddingLeft={1}>
          <Text
            color={index === selectedIndex ? "black" : "white"}
            backgroundColor={index === selectedIndex ? "cyan" : undefined}
          >
            {suggestion.command}
          </Text>
          <Box marginLeft={1}>
            <Text color="gray">{suggestion.description}</Text>
          </Box>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ↑↓ navigate • Enter/Tab select • Esc cancel
        </Text>
      </Box>
    </Box>
  );
}