import { describe, expect, it } from "vitest";
import type { ChatClient, ChatCompletion, ChatMessage } from "../lib/chat/agent";
import { runChatTurn } from "../lib/chat/agent";
import type { SearchToolArgs } from "../lib/chat/tools";

// Step 11c orchestration. The model decides to call search_products; we run the
// search, feed the results back, and let it answer. The LLM is the only external
// thing, so it is faked here while the loop (tool dispatch, feeding results back,
// the step cap) is exercised for real.
describe("runChatTurn", () => {
  it("runs the search tool, feeds results back, and returns the model's answer", async () => {
    const searchArgs: SearchToolArgs[] = [];
    const runSearch = async (args: SearchToolArgs) => {
      searchArgs.push(args);
      return [{ name: "Pine Bookshelf", priceCents: 12999, category: "storage", slug: "pine-bookshelf-1" }];
    };

    const responses: ChatCompletion[] = [
      { content: "", toolCalls: [{ id: "call_1", name: "search_products", arguments: '{"query":"bookshelf"}' }] },
      { content: "We have the Pine Bookshelf for €129.99.", toolCalls: [] },
    ];
    const seen: ChatMessage[][] = [];
    let idx = 0;
    const client: ChatClient = {
      async complete(messages) {
        seen.push(messages);
        return responses[idx++]!;
      },
    };

    const result = await runChatTurn({
      client,
      runSearch,
      messages: [{ role: "user", content: "do you have bookshelves?" }],
    });

    expect(result.reply).toContain("Pine Bookshelf");
    expect(result.toolRuns).toBe(1);
    expect(searchArgs).toEqual([{ query: "bookshelf" }]);
    // The second model call must have seen the tool result fed back in.
    expect(seen[1]!.some((m) => m.role === "tool" && m.content.includes("Pine Bookshelf"))).toBe(true);
  });

  it("stops after maxSteps and forces a final tool-free answer", async () => {
    let toolFreeCalls = 0;
    const client: ChatClient = {
      async complete(_messages, tools) {
        if (tools.length === 0) {
          toolFreeCalls += 1;
          return { content: "Here is my best answer.", toolCalls: [] };
        }
        return { content: "", toolCalls: [{ id: "c", name: "search_products", arguments: '{"query":"x"}' }] };
      },
    };
    const result = await runChatTurn({
      client,
      runSearch: async () => [],
      messages: [{ role: "user", content: "hi" }],
      maxSteps: 2,
    });

    expect(result.toolRuns).toBe(2);
    expect(result.reply).toBe("Here is my best answer.");
    expect(toolFreeCalls).toBe(1);
  });
});
