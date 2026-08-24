/**
 * LLM Client for OmniForge — Anthropic & Custom Endpoint Adapter
 * Configured for Claude / Muse Spark endpoints with tool calling support.
 */

export interface LLMConfig {
  baseUrl: string;
  authToken?: string;
  model: string;
  sonnetModel: string;
  opusModel: string;
  haikuModel: string;
  subagentModel: string;
  enableToolSearch: boolean;
}

export function getLLMConfig(): LLMConfig {
  return {
    baseUrl: process.env.ANTHROPIC_BASE_URL ?? "https://api.meta.ai",
    authToken: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL ?? "muse-spark-1.2-contributor[1m]",
    sonnetModel: process.env.ANTHROPIC_DEFAULT_SONNET_MODEL ?? "muse-spark-1.2-contributor[1m]",
    opusModel: process.env.ANTHROPIC_DEFAULT_OPUS_MODEL ?? "muse-spark-1.2-contributor[1m]",
    haikuModel: process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL ?? "muse-spark-1.2-contributor[1m]",
    subagentModel: process.env.CLAUDE_CODE_SUBAGENT_MODEL ?? "muse-spark-1.2-contributor[1m]",
    enableToolSearch: process.env.ENABLE_TOOL_SEARCH === "true",
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
 * Send request to the configured Anthropic-compatible API endpoint
 */
export async function sendLLMMessage(
  messages: ChatMessage[],
  tools?: ToolDefinition[],
  systemPrompt?: string
): Promise<LLMResponse> {
  const config = getLLMConfig();

  // If no auth token is provided yet, return graceful fallback
  if (!config.authToken) {
    console.warn("⚠️ ANTHROPIC_AUTH_TOKEN not set — using local rule-based response generator.");
    return {
      text: "ANTHROPIC_AUTH_TOKEN not set. Set ANTHROPIC_AUTH_TOKEN in .env to activate live endpoint.",
      modelUsed: `${config.model} (local-fallback)`,
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

    // Support Bearer or x-api-key headers
    if (config.authToken.startsWith("sk-")) {
      headers["x-api-key"] = config.authToken;
    } else {
      headers["Authorization"] = `Bearer ${config.authToken}`;
      headers["x-api-key"] = config.authToken;
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
    console.error("LLM call failed:", error.message);
    throw error;
  }
}
