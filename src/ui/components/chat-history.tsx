import React from "react";
import { Box, Text } from "ink";
import { ChatEntry } from "../../agent/giga-agent";
import { DiffRenderer } from "./diff-renderer";
import { MarkdownRenderer } from "../utils/markdown-renderer";

interface ChatHistoryProps {
  entries: ChatEntry[];
}

export function ChatHistory({ entries }: ChatHistoryProps) {
  const renderDiff = (diffContent: string, filename?: string) => {
    return (
      <DiffRenderer
        diffContent={diffContent}
        filename={filename}
        terminalWidth={80}
      />
    );
  };

  const renderFileContent = (content: string) => {
    const lines = content.split("\n");

    // Calculate minimum indentation like DiffRenderer does
    let baseIndentation = Infinity;
    for (const line of lines) {
      if (line.trim() === "") continue;
      const firstCharIndex = line.search(/\S/);
      const currentIndent = firstCharIndex === -1 ? 0 : firstCharIndex;
      baseIndentation = Math.min(baseIndentation, currentIndent);
    }
    if (!isFinite(baseIndentation)) {
      baseIndentation = 0;
    }

    return lines.map((line, index) => {
      const displayContent = line.substring(baseIndentation);
      return (
        <Text key={index} color="gray">
          {displayContent}
        </Text>
      );
    });
  };

  const renderChatEntry = (entry: ChatEntry, index: number) => {
    switch (entry.type) {
      case "user":
        return (
          <Box key={index} flexDirection="column" marginTop={1}>
            <Box>
              <Text color="gray">
                {">"} {entry.content}
              </Text>
            </Box>
          </Box>
        );

      case "assistant":
        return (
          <Box key={index} flexDirection="column" marginTop={1}>
            <Box flexDirection="row" alignItems="flex-start">
              <Text color="white">⏺ </Text>
              <Box flexDirection="column" flexGrow={1}>
                {entry.toolCalls ? (
                  // If there are tool calls, just show plain text
                  <Text color="white">{entry.content.trim()}</Text>
                ) : (
                  // If no tool calls, render as markdown
                  <MarkdownRenderer content={entry.content.trim()} />
                )}
                {entry.isStreaming && <Text color="cyan">█</Text>}
                {entry.metrics && !entry.isStreaming && (
                  <Box marginTop={1}>
                    <Text color="blue">prefill - {entry.metrics.prefillTimeMs}ms</Text>
                    <Text color="white"> | </Text>
                    <Text color="yellow">decode - {entry.metrics.tokensPerSecond} toks/sec ({entry.metrics.outputTokens} out / {entry.metrics.decodeTimeMs}ms)</Text>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        );

      case "tool_result":
        const getToolActionName = (toolName: string) => {
          switch (toolName) {
            case "view_file":
              return "Read";
            case "str_replace_editor":
              return "Update";
            case "create_file":
              return "Create";
            case "bash":
              return "Bash";
            case "create_todo_list":
              return "Created Todo";
            case "update_todo_list":
              return "Updated Todo";
            case "perplexity_search":
              return "Search";
            default:
              return "Tool";
          }
        };

        const getToolFilePath = (toolCall: any) => {
          if (toolCall?.function?.arguments) {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              // Handle todo tools and search tools specially - they don't have file paths
              if (
                toolCall.function.name === "create_todo_list" ||
                toolCall.function.name === "update_todo_list" ||
                toolCall.function.name === "perplexity_search"
              ) {
                if (toolCall.function.name === "perplexity_search") {
                  return `"${args.query || 'unknown query'}"`;
                }
                return "";
              }
              return args.path || args.file_path || args.command || "unknown";
            } catch {
              return "unknown";
            }
          }
          return "unknown";
        };

        const toolName = entry.toolCall?.function?.name || "unknown";
        const actionName = getToolActionName(toolName);
        const filePath = getToolFilePath(entry.toolCall);


        const shouldShowDiff =
          toolName === "str_replace_editor" || toolName === "create_file";
        const shouldShowFileContent = toolName === "view_file";
        const shouldShowSearchResult = toolName === "perplexity_search";

        return (
          <Box key={index} flexDirection="column" marginTop={1}>
            <Box>
              <Text color="magenta">⏺</Text>
              <Text color="white">
                {" "}
                {filePath ? `${actionName}(${filePath})` : actionName}
              </Text>
            </Box>
            <Box marginLeft={2} flexDirection="column">
              {shouldShowFileContent ? (
                <Box flexDirection="column">
                  <Text color="gray">⎿ File contents:</Text>
                  <Box marginLeft={2} flexDirection="column">
                    {renderFileContent(entry.content)}
                  </Box>
                </Box>
              ) : shouldShowSearchResult ? (
                <Box flexDirection="column">
                  <Text color="gray">⎿ {entry.toolResult?.metadata?.userSummary || 'Search completed'}</Text>
                </Box>
              ) : shouldShowDiff ? (
                // For diff results, show only the summary line, not the raw content
                <Text color="gray">⎿ {entry.content.split('\n')[0]}</Text>
              ) : (
                <Text color="gray">⎿ {entry.content}</Text>
              )}
            </Box>
            {shouldShowDiff && (
              <Box marginLeft={4} flexDirection="column">
                {renderDiff(entry.content, filePath)}
              </Box>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box flexDirection="column">{entries.slice(-20).map(renderChatEntry)}</Box>
  );
}
