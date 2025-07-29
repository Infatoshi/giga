import React from "react";
import { Text } from "ink";

interface NeonTextProps {
  text: string;
}

export function NeonText({ text }: NeonTextProps) {
  const rainbowColors = ['red', 'magenta', 'yellow', 'green', 'cyan', 'blue'];
  
  return (
    <>
      {text.split('').map((char, index) => (
        <Text key={index} color={rainbowColors[index % rainbowColors.length]} bold>
          {char}
        </Text>
      ))}
    </>
  );
}