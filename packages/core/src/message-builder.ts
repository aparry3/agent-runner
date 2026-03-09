import type { AgentDefinition, Message, ContextEntry } from "./types.js";

/**
 * Build the message array for a model call.
 * Order: system prompt (with context) → session history → user input
 */
export function buildMessages(options: {
  agent: AgentDefinition;
  input: string;
  sessionHistory?: Message[];
  contextEntries?: Map<string, ContextEntry[]>;
  extraContext?: string;
}): Array<{ role: string; content: string }> {
  const { agent, input, sessionHistory, contextEntries, extraContext } = options;
  const messages: Array<{ role: string; content: string }> = [];

  // 1. System prompt (with context injected)
  let systemContent = agent.systemPrompt;

  // Inject few-shot examples
  if (agent.examples?.length) {
    systemContent += "\n\n## Examples\n";
    for (const ex of agent.examples) {
      systemContent += `\nUser: ${ex.input}\nAssistant: ${ex.output}\n`;
    }
  }

  // Inject context entries
  if (contextEntries && contextEntries.size > 0) {
    systemContent += "\n\n";
    for (const [contextId, entries] of contextEntries) {
      if (entries.length === 0) continue;
      systemContent += `<context id="${contextId}">\n`;
      for (const entry of entries) {
        systemContent += `  <entry agent="${entry.agentId}" time="${entry.createdAt}">\n`;
        systemContent += `    ${entry.content}\n`;
        systemContent += `  </entry>\n`;
      }
      systemContent += `</context>\n`;
    }
  }

  // Inject extra context
  if (extraContext) {
    systemContent += `\n\n<extra-context>\n${extraContext}\n</extra-context>`;
  }

  messages.push({ role: "system", content: systemContent });

  // 2. Session history
  if (sessionHistory?.length) {
    for (const msg of sessionHistory) {
      // Skip system messages from history, except conversation summaries
      if (msg.role === "system" && !msg.content.startsWith("[Conversation Summary]")) continue;
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // 3. User input (apply template if defined)
  let userContent = input;
  if (agent.userPromptTemplate) {
    userContent = agent.userPromptTemplate.replace("{{input}}", input);
  }

  messages.push({ role: "user", content: userContent });

  return messages;
}

/**
 * Trim session history using sliding window strategy.
 */
export function trimHistory(
  messages: Message[],
  maxMessages: number
): Message[] {
  if (messages.length <= maxMessages) return messages;

  // Keep the most recent messages
  return messages.slice(-maxMessages);
}
