import { formatHitsForModel, searchProductsTool, type SearchToolArgs, type ToolHit } from "./tools";

/**
 * Step 11c tool-use loop. The model is given one tool (search over our catalog);
 * when it asks to use it we run the search, feed the results back, and let it
 * answer. The LLM stays out of ranking and out of the hot path: it only calls
 * search and summarises. A step cap stops runaway tool loops, after which we
 * force one tool-free completion so the user always gets a reply.
 */

export interface ToolCall {
  id: string;
  name: string;
  /** JSON string of the tool arguments, as the model emits it. */
  arguments: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ChatCompletion {
  content: string;
  toolCalls: ToolCall[];
}

/** The provider-agnostic seam: anything that can complete a chat with tools. */
export interface ChatClient {
  complete(messages: ChatMessage[], tools: unknown[]): Promise<ChatCompletion>;
}

export interface RunChatTurnArgs {
  client: ChatClient;
  runSearch: (args: SearchToolArgs) => Promise<ToolHit[]>;
  /** The conversation so far (user/assistant turns); the system prompt is added. */
  messages: ChatMessage[];
  maxSteps?: number;
}

export interface ChatTurnResult {
  reply: string;
  toolRuns: number;
}

const SYSTEM_PROMPT = [
  "You are the NORDHEM shopping assistant for a Nordic home-goods store.",
  "Answer ONLY from the search_products tool — never invent products, prices, or stock.",
  "Call search_products to find items, then recommend a few in a warm, concise way.",
  "If nothing fits, say so honestly and suggest a different search.",
  "Prices are in euros. Link products with their /product/<slug> path when helpful.",
].join(" ");

export async function runChatTurn({
  client,
  runSearch,
  messages,
  maxSteps = 3,
}: RunChatTurnArgs): Promise<ChatTurnResult> {
  const convo: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];
  let toolRuns = 0;

  for (let step = 0; step < maxSteps; step++) {
    const res = await client.complete(convo, [searchProductsTool]);
    if (res.toolCalls.length === 0) return { reply: res.content, toolRuns };

    convo.push({ role: "assistant", content: res.content, toolCalls: res.toolCalls });
    for (const call of res.toolCalls) {
      let hits: ToolHit[] = [];
      try {
        hits = await runSearch(JSON.parse(call.arguments) as SearchToolArgs);
      } catch {
        hits = [];
      }
      toolRuns += 1;
      convo.push({ role: "tool", toolCallId: call.id, content: formatHitsForModel(hits) });
    }
  }

  // Step budget spent: force one tool-free answer so the user always gets a reply.
  const final = await client.complete(convo, []);
  return { reply: final.content, toolRuns };
}
