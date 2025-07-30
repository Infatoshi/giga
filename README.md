# GIGA CODE

## Meta-Features
> features beyond the obvious
- **Provider Support**: OpenRouter, xAI, Anthropic, OpenAI, Google Gemini, Groq, Cerebras
- **OpenRouter Router**: Use the `order` feature in OR to specify which compute provider each of your added models use
- **Fuzzy Finding**: Nice kick to `/` commands with fuzzy finding so you can bounce around the CLI fast
- **Custom Prompts** Custom prompts to accelerate your coding workflow
- **All-in-one**: All features and command accessibl$$e from inside the CLI, no weird setup terminal commands to bug you with.
- **Auto-fill API Keys**: Search `~/.zshrc` and `~/.bashrc` (or whatever your setup is) for API keys of the different providers listed above (0 friction)
- **Perplexity Search**: Automatically use structured input/output prompting with perplexity to get the most accurate information.

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

## Custom Instructions

For `giga`, we use `GIGA.md` (make it yourself)
