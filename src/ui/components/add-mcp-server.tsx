import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { loadApiKeys } from "../../utils/api-keys";

interface AddMcpServerProps {
  onClose: () => void;
  onAddServer: (name: string, command: string, args?: string[], env?: Record<string, string>, description?: string) => void;
}

type FormField = 'name' | 'command' | 'args' | 'env' | 'description';

export default function AddMcpServer({ onClose, onAddServer }: AddMcpServerProps) {
  const [currentField, setCurrentField] = useState<FormField>('name');
  const [formData, setFormData] = useState({
    name: '',
    command: '',
    args: '',
    env: '',
    description: ''
  });

  useEffect(() => {
    const keys = loadApiKeys();
    if (keys.exaApiKey) {
      setFormData(prev => ({
        ...prev,
        env: `EXA_API_KEY=${keys.exaApiKey}`
      }));
    }
  }, []);

  const fields: { key: FormField; label: string; placeholder: string; required: boolean }[] = [
    { key: 'name', label: 'Server Name', placeholder: 'my-server', required: true },
    { key: 'command', label: 'Command', placeholder: 'npx @modelcontextprotocol/server-filesystem', required: true },
    { key: 'args', label: 'Arguments', placeholder: '/path/to/directory (space-separated)', required: false },
    { key: 'env', label: 'Environment', placeholder: 'KEY1=value1 KEY2=value2', required: false },
    { key: 'description', label: 'Description', placeholder: 'Optional description', required: false }
  ];

  const currentFieldIndex = fields.findIndex(f => f.key === currentField);

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
      const newIndex = currentFieldIndex === 0 ? fields.length - 1 : currentFieldIndex - 1;
      setCurrentField(fields[newIndex].key);
      return;
    }

    if (key.downArrow) {
      const newIndex = (currentFieldIndex + 1) % fields.length;
      setCurrentField(fields[newIndex].key);
      return;
    }

    if (key.tab) {
      const newIndex = (currentFieldIndex + 1) % fields.length;
      setCurrentField(fields[newIndex].key);
      return;
    }

    if (key.return) {
      // If we're on the last field or have required fields filled, submit
      if (currentFieldIndex === fields.length - 1 || 
          (formData.name.trim() && formData.command.trim())) {
        handleSubmit();
      } else {
        // Move to next field
        const newIndex = (currentFieldIndex + 1) % fields.length;
        setCurrentField(fields[newIndex].key);
      }
      return;
    }

    if (key.backspace || key.delete) {
      setFormData(prev => ({
        ...prev,
        [currentField]: prev[currentField].slice(0, -1)
      }));
      return;
    }

    if (inputChar && !key.ctrl && !key.meta) {
      setFormData(prev => ({
        ...prev,
        [currentField]: prev[currentField] + inputChar
      }));
      return;
    }
  });

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.command.trim()) {
      return; // Don't submit if required fields are empty
    }

    const args = formData.args.trim() ? formData.args.trim().split(' ') : undefined;
    const env = formData.env.trim() ? parseEnvString(formData.env.trim()) : undefined;
    const description = formData.description.trim() || undefined;

    onAddServer(formData.name.trim(), formData.command.trim(), args, env, description);
  };

  const parseEnvString = (envStr: string): Record<string, string> => {
    const env: Record<string, string> = {};
    const pairs = envStr.split(' ');
    
    for (const pair of pairs) {
      const [key, ...valueParts] = pair.split('=');
      if (key && valueParts.length > 0) {
        env[key] = valueParts.join('=');
      }
    }
    
    return env;
  };

  const canSubmit = formData.name.trim() && formData.command.trim();

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color="yellow">➕ Add MCP Server</Text>
      <Box marginBottom={1}>
        <Text color="gray">Fill in the server configuration:</Text>
      </Box>
      
      <Box flexDirection="column" marginBottom={1}>
        {fields.map((field) => {
          const isSelected = field.key === currentField;
          const value = formData[field.key];
          
          return (
            <Box 
              key={field.key}
              borderStyle="round" 
              borderColor={isSelected ? "blue" : "gray"} 
              paddingX={1} 
              marginBottom={1}
            >
              <Box width={15}>
                <Text color={isSelected ? "blue" : "white"}>
                  {field.label}{field.required ? "*" : ""}:
                </Text>
              </Box>
              <Box flexGrow={1}>
                <Text color={value ? "white" : "gray"}>
                  {value || field.placeholder}
                  {isSelected ? "█" : ""}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box marginBottom={1}>
        <Text color={canSubmit ? "green" : "red"}>
          {canSubmit ? "✓ Ready to add server" : "❌ Name and command are required"}
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color="gray" dimColor>• Use ↑/↓ arrows or Tab to navigate fields</Text>
        <Text color="gray" dimColor>• Type to edit current field</Text>
        <Text color="gray" dimColor>• Press Enter to {canSubmit ? "add server" : "go to next field"}</Text>
        <Text color="gray" dimColor>• Press Esc to cancel</Text>
      </Box>
    </Box>
  );
}