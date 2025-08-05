import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

interface LoadingSpinnerProps {
  isActive: boolean;
  processingTime: number;
  tokenCount: number;
  statusMessage: string | null;
}

const loadingTexts = [
  "Thinking...",
  "Computing...",
  "Analyzing...",
  "Processing...",
  "Calculating...",
  "Interfacing...",
  "Optimizing...",
  "Synthesizing...",
  "Decrypting...",
  "Calibrating...",
  "Bootstrapping...",
  "Synchronizing...",
  "Compiling...",
  "Downloading...",
];

export const LoadingSpinner = React.memo(function LoadingSpinner({ isActive, processingTime, tokenCount, statusMessage }: LoadingSpinnerProps) {
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);

  useEffect(() => {
    if (!isActive) return;

    const spinnerFrames = ["/", "-", "\\", "|"];
    const interval = setInterval(() => {
      setSpinnerFrame((prev) => (prev + 1) % spinnerFrames.length);
    }, 250);

    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    setLoadingTextIndex(Math.floor(Math.random() * loadingTexts.length));

    const interval = setInterval(() => {
      setLoadingTextIndex(Math.floor(Math.random() * loadingTexts.length));
    }, 2000);

    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  const spinnerFrames = ["/", "-", "\\", "|"];

  return (
    <Box marginTop={1}>
      <Text color="cyan">
        {spinnerFrames[spinnerFrame]} {statusMessage || loadingTexts[loadingTextIndex]}{" "}
      </Text>
      <Text color="gray">
        ({processingTime}s · ↑ {tokenCount} tokens · esc to interrupt)
      </Text>
    </Box>
  );
});