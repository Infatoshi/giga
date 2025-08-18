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

# ARCHITECTURE
- /web gh/llm.c/kernels/attn.cu for example — not adding because exa search works fine and we can pull this info directly without needing an extra command. User can be creative and get their own workflow going. dont want to rely on a untested tool like this because people simply dont use it.
- RAG pipeline
    - Fixed blocks/ Abstract syntax trees splitting?
    - Local storage (.giga/embeddings..) in project dir
    - Whenever we ask a question, show the files, lines range, and similarity score to 4 decimal places
    - Have a /rag command to toggle the verbose logging ^^^ or to turn off RAG altogther.
- Integrate git arsenal (modal gpu support, and auto setting up repos)
- Context compression (Otsofy)

From claude code video
* Elaborate System Prompts: At its core, Claude Code utilizes a very long and detailed system prompt that dictates its behavior. This prompt covers a wide range of instructions, including tone and style, how to be proactive, task management, tool usage, and code referencing.
* Reiteration and Emphasis: Core instructions and workflows are repeated multiple times throughout the system prompt to ensure the model adheres to them. For instance, the use of the to-do tool is mentioned in several sections to increase its reliability. Keywords like "important," "very important," "never," and "must" are used to emphasize critical instructions.
* Prompt-Defined Workflows: Nearly all of Claude Code's workflows are defined in natural language within the system prompt rather than being hard-coded into the application. This makes the agent's behavior flexible, as changing the prompt is all that is needed to alter its core flow.
* Sub-Agents as Tools: Claude Code can use "sub-agents" to handle specific, complex tasks. These sub-agents are not invoked by a hardcoded mechanism but are defined and described in detail within the tool definitions of the main agent's prompt. The main agent triggers a sub-agent as it would any other tool.
* Stateless Sub-Agents: When a sub-agent is called, it operates in its own isolated memory space. It receives its initial instructions from the main agent but does not have access to the main agent's conversation history. Once the sub-agent completes its task, it returns a final summary to the main agent, and its own intermediate message history is discarded.
* The Importance of Formatting: The system prompt is highly structured and human-readable. Formatting elements like capitalization and bold text are used to add semantic meaning and emphasis, which the model takes into account. The use of XML tags is also a powerful technique to group sections of text and create a clear structure for the model to follow.
* Dynamic Reminders: To combat the issue of agents "forgetting" instructions, Claude Code dynamically re-inserts reminders into the message history. For example, after each task progression, a reminder about the to-do list and the corresponding tool is added to keep it top-of-mind for the model.
* Model-Specific Prompt Tuning: The prompts used by Claude Code are highly tuned for Anthropic's family of models (like Sonnet). The video's creator notes that using these same prompts with models from other providers may not yield the same level of accuracy, highlighting that prompt engineering is specific to the model being used.


for live demo get it to a point where i can take any macbook and have it work first try (api key loaded beforehand of course)

- Do I have to keep certain commands if we can manage context really well with a good system prompt set of instructions and gemini embeddings for indexing (/ls and /drop since it’s all indexing? How much indexing)

Model support:
- Kimi k2
- Qwen 235 (both)
- GLM 4.5
- Xbai o4
- Qwen 3 coder
- Groq code cli
- Cursor CLI

Competitors:
- Claude Code
- Roo
- Cline
- Aider chat
    - /clear            Clear the chat history
    - /drop             Remove files from the chat session to free up context space
    - /ls               List all known files and indicate which are included in the chat session
    - /think-tokens     Set the thinking token budget, eg: 8096, 8k, 10.5k, 0.5M, or 0 to disable.
    - /web              Scrape a webpage, convert to markdown and send in a message
^^^
For ls and drop, simply manage which files are relevant automatically.

- Grok CLI (xAI)
- Qwen Code
- Gemini CLI
- https://x.com/charmcli/status/1950580547560108191?s=46
- https://github.com/musistudio/claude-code-router
- cerebras code

Categories:
- System prompt performance
- Rust/Typescript/Python
- Live model search on all providers
- Openrouter provider routing
- Experts
- Prompts
- MCP servers
- Tools to call
- Verbosity
- UI/UX (theme, colors, textbox, feel)
- Provider support
- Memory
- Continue
- History
- branching
- Parallel chats
- Git workflow
- Auto vs manual vs plan vs explain….
- Sampling params
- Repo map
- Embeddings for indexing
- Web search
- Reasoning effort (thinking tons)
- Image support
- Fuzzy finding
- Ascii art on startup + Custom cartoon character logo rotating when thinking
- High level mobility around undoing, adding files, paste, running, etc
- Sub-agent support


