"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Step 11c: the shopping assistant widget. It self-hides unless the assistant is
 * available (configured + full mode), checked once on mount via GET /api/chat,
 * so it never appears in lite mode or when no provider key is set. Each turn
 * posts the conversation to /api/chat, which runs the tool-use loop server-side.
 */
interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function ChatWidget() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d) => setAvailable(Boolean(d?.enabled)))
      .catch(() => setAvailable(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  if (!available) return null;

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      const reply = res.ok ? data.reply : data.error ?? "Something went wrong.";
      setMessages((m) => [...m, { role: "assistant", content: String(reply) }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "The assistant is unreachable right now." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {open && (
        <section className="mb-3 flex h-[28rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-md border border-line bg-paper shadow-float">
          <header className="flex items-center justify-between border-b border-line bg-ink px-4 py-3 text-paper">
            <span className="font-display text-[15px]">Shop assistant</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-paper/70 hover:text-paper">
              ×
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-[13px] text-ink-muted">
                Ask me to find something — e.g. &ldquo;a green velvet sofa under €600&rdquo; or
                &ldquo;something for a small bedroom&rdquo;. I search the real catalog.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                <span
                  className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-md px-3 py-2 text-[13.5px] ${
                    m.role === "user" ? "bg-pine text-white" : "bg-card text-ink"
                  }`}
                >
                  {m.content}
                </span>
              </div>
            ))}
            {loading && <p className="text-[13px] text-ink-muted">Looking through the catalog…</p>}
          </div>

          <div className="flex gap-2 border-t border-line p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="What are you looking for?"
              className="h-9 flex-1 rounded-xs border border-line bg-card px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-pine"
            />
            <button
              type="button"
              onClick={send}
              disabled={loading}
              className="h-9 rounded-xs bg-pine px-4 text-[14px] font-semibold text-white hover:bg-pine-deep disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-full bg-pine px-5 py-3 text-[14px] font-semibold text-white shadow-float hover:bg-pine-deep"
      >
        {open ? "Close" : "Ask the shop assistant"}
      </button>
    </div>
  );
}
