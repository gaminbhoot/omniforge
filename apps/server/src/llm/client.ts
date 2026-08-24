/**
 * Clean LLM Client Adapter for OmniForge
 * Supports Anthropic, OpenAI, or custom API endpoints with tool calling.
 */

export interface LLMConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
}

export function getLLMConfig(): LLMConfig {
  return {
    baseUrl: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com",
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.OPENAI_API_KEY,
    model: process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-20241022",
  };
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolCallResponse {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface LLMResponse {
  text: string;
  toolCalls?: ToolCallResponse[];
  modelUsed: string;
  raw?: unknown;
}

/**
 * Send request to the configured LLM API endpoint
 */
export async function sendLLMMessage(
  messages: ChatMessage[],
  tools?: ToolDefinition[],
  systemPrompt?: string
): Promise<LLMResponse> {
  const config = getLLMConfig();

  if (!config.apiKey) {
    return {
      text: "ANTHROPIC_API_KEY not set in .env. Running in local simulation mode.",
      modelUsed: `${config.model} (local-mock)`,
    };
  }

  const endpoint = config.baseUrl.endsWith("/v1/messages")
    ? config.baseUrl
    : `${config.baseUrl.replace(/\/$/, "")}/v1/messages`;

  const payload: Record<string, unknown> = {
    model: config.model,
    max_tokens: 4096,
    messages: messages.filter((m) => m.role !== "system"),
  };

  if (systemPrompt) {
    payload.system = systemPrompt;
  }

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    };

    if (config.apiKey.startsWith("sk-")) {
      headers["x-api-key"] = config.apiKey;
    } else {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
      headers["x-api-key"] = config.apiKey;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LLM API responded with ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as any;
    let text = "";
    const toolCalls: ToolCallResponse[] = [];

    if (Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block.type === "text") {
          text += block.text;
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            name: block.name,
            input: block.input,
          });
        }
      }
    }

    return {
      text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      modelUsed: data.model ?? config.model,
      raw: data,
    };
  } catch (error: any) {
    console.error("LLM call error:", error.message);
    throw error;
  }
}
