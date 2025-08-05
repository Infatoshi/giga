# GIGA CODE

## Meta-Features
> features beyond the obvious
- **Provider Support**: OpenRouter, xAI, Anthropic, OpenAI, Google Gemini, Groq, Cerebras
- **OpenRouter Router**: Use the `order` feature in OR to specify which compute provider each of your added models use
- **Fuzzy Finding**: Nice kick to `/` commands with fuzzy finding so you can bounce around the CLI fast
- **Custom Prompts** Custom prompts to accelerate your coding workflow
- **All-in-one**: All features and command accessibl$e from inside the CLI, no weird setup terminal commands to bug you with.
- **Auto-fill API Keys**: Search `~/.zshrc` and `~/.bashrc` (or whatever your setup is) for API keys of the different providers listed above (0 friction)
- **Expert Specializing**: Turn on/off the ability to use different models for pure speed, code, thinking, tool calling (across all providers)
- 
## Installation
```bash
npm i -g giga-code
```

## Prerequisites
- Node.js 16+ (tested on node 24)
- Some API keys

## Local Installation
```bash
git clone https://github.com/infatoshi/giga-code
cd giga-code
npm install
npm run build
npm link
```

## Terminal Flickering Fix

### Root Cause
Terminal flickers during long conversations due to competing React renders between streaming content updates and diff rendering components.

### Implementation Plan

**1. Component Lifecycle Fixes (`src/ui/components/chat-interface.tsx`)**
- Add stable `key="chat-main"` prop to main `<Box flexDirection="column">` at line ~463
- Wrap `<ChatHistory entries={chatHistory} />` in `React.memo` to prevent unnecessary re-renders
- Add `key="chat-history-${chatHistory.length}"` to force clean remounting when needed
- Separate confirmation dialog rendering from main chat flow to prevent layout thrashing

**2. State Batching/Debouncing (`src/hooks/use-input-handler.ts`)**
- Replace immediate `setChatHistory` calls (lines 590-600) with batched updates
- Use `React.useCallback` + `requestAnimationFrame` to batch streaming content chunks
- Implement 16ms debounce window to collect multiple content chunks before state update
- Add `streamingBuffer` ref to accumulate content before committing to state

**3. Diff Renderer Optimization (`src/ui/components/diff-renderer.tsx`)**
- Wrap main `DiffRenderer` component in `React.memo` with shallow prop comparison
- Add stable `key={crypto.hash(diffContent)}` for consistent re-rendering
- Use `useMemo` for expensive `parseDiffWithLineNumbers` computation
- Cache rendered output based on content hash to prevent re-computation

### Potential Blockers
- **React Ink limitations**: Ink's rendering pipeline may not respect standard React optimization patterns
- **Streaming interruption**: Batching could delay real-time streaming feel, may need fine-tuning
- **Memory usage**: Caching rendered diffs could increase memory footprint
- **Key collision**: Hash-based keys might cause conflicts with similar content
- **Terminal resize**: Cached renders might break on terminal dimension changes

### Testing Strategy
- Test with very long conversations (100+ messages)
- Verify streaming still feels real-time with batching
- Test rapid command switching during active streaming
- Validate diff rendering performance with large file changes

## Custom Instructions

For `giga`, we use `GIGA.md` (make it yourself)
