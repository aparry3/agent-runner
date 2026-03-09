# Agent Editor

The Agent Editor lets you create and modify agent definitions visually.

## Features

- **System Prompt Editor** — Syntax-highlighted text area for the agent's instructions
- **Model Configuration** — Select provider, model, temperature, and max tokens
- **Tool Assignment** — Drag tools from the catalog onto the agent
- **Examples** — Add few-shot input/output pairs
- **Output Schema** — Define structured output constraints
- **Context Write** — Toggle automatic context writing

## Creating an Agent

1. Click **"New Agent"** from the agents list
2. Fill in the ID, name, and system prompt
3. Select a model provider and model name
4. (Optional) Assign tools from the catalog
5. Click **Save**

The agent is immediately available to `runner.invoke()` in your code.

## Editing

Changes save to the same store your code uses. No deployment or restart needed during development.
