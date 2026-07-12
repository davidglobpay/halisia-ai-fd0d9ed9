import { useEffect, useRef, useState } from "react";
import { X, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

export function AIOrb({ context }: { context?: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi, I'm the HALISIA intelligence assistant. Ask me about any location in Kenya — flood risk, road access, schools, security, or investment signals. I'll always share my confidence.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, context }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply ?? "I couldn't reach my brain — try again." }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Network hiccup. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open HALISIA AI assistant"
          className="fixed bottom-6 right-6 z-40 h-16 w-16 rounded-full animate-pulse-glow"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, oklch(0.87 0.14 208), oklch(0.68 0.19 249) 55%, oklch(0.28 0.12 275))",
          }}
        >
          <span className="absolute inset-2 rounded-full border border-white/30" />
          <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-white drop-shadow" />
        </button>
      )}
      {open && (
        <div className="fixed bottom-6 right-6 z-40 w-[min(400px,calc(100vw-2rem))] h-[min(600px,calc(100vh-3rem))] glass-strong rounded-3xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full animate-pulse-glow"
                style={{ background: "radial-gradient(circle at 30% 30%, oklch(0.87 0.14 208), oklch(0.68 0.19 249))" }} />
              <div>
                <div className="text-sm font-semibold">HALISIA Assistant</div>
                <div className="text-[11px] text-muted-foreground">Explains reasoning · shares confidence</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-br from-primary to-accent text-primary-foreground text-sm px-3.5 py-2"
                      : "max-w-[92%] text-sm text-foreground/90 leading-relaxed"
                  }
                >
                  {m.role === "assistant" ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                Analyzing signals…
              </div>
            )}
          </div>
          <div className="p-3 border-t border-white/10">
            <div className="flex items-end gap-2 rounded-2xl bg-white/5 border border-white/10 px-3 py-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Ask about a place, plot, or postcode…"
                className="flex-1 bg-transparent resize-none outline-none text-sm placeholder:text-muted-foreground max-h-32"
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground disabled:opacity-40 flex items-center justify-center"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
