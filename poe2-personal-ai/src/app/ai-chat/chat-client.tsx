"use client";

import { useState } from "react";
import type { ChatMessage } from "@/lib/db";

type AiChatResponse = {
  answer: string;
  relevant_items: string[];
  recommendation: string;
  confidence: number;
  risks: string[];
  missing_data: string[];
  suggested_next_manual_action: string;
};

type DisplayMessage = {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
};

function parseAssistantMessage(content: string) {
  try {
    return JSON.parse(content) as AiChatResponse;
  } catch {
    return null;
  }
}

export function ChatClient({
  sessionId,
  initialMessages,
}: {
  sessionId: number;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<DisplayMessage[]>(
    initialMessages.map((message) => ({
      id: String(message.id),
      role: message.role,
      content: message.content,
    })),
  );
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMessage(message: string) {
    const trimmed = message.trim();
    if (!trimmed || isSending) {
      return;
    }

    setError(null);
    setIsSending(true);
    setInput("");

    setMessages((current) => [
      ...current,
      {
        id: `user-${current.length + 1}`,
        role: "user",
        content: trimmed,
      },
    ]);

    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: trimmed }),
      });

      const payload = (await response.json().catch(() => null)) as {
        message?: AiChatResponse;
        error?: string;
        fallback?: boolean;
      } | null;

      if (!payload) {
        throw new Error("API returned an invalid JSON response.");
      }

      if (payload.message) {
        setMessages((current) => [
          ...current,
          {
            id: `assistant-${current.length + 1}`,
            role: "assistant",
            content: JSON.stringify(payload.message),
          },
        ]);
      }

      if (!response.ok || payload.error) {
        const errorMessage = payload.error ?? "AI chat failed.";
        setError(errorMessage);
        setMessages((current) => [
          ...current,
          {
            id: `error-${current.length + 1}`,
            role: "error",
            content: payload.message
              ? `${errorMessage}. Showing deterministic fallback answer above.`
              : errorMessage,
          },
        ]);
      }
    } catch (caughtError) {
      const errorMessage =
        caughtError instanceof Error
          ? caughtError.message
          : "AI chat request failed.";
      setError(errorMessage);
      setMessages((current) => [
        ...current,
        {
          id: `error-${current.length + 1}`,
          role: "error",
          content: errorMessage,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  const quickActions = [
    "Summarize market watchlist",
    "Find best flip opportunity",
    "Show items hitting target buy",
    "Show high risk items",
  ];

  return (
    <div className="grid min-h-[680px] gap-5 lg:grid-cols-[260px_1fr]">
      <aside className="rounded-lg border border-line bg-panel p-4">
        <h2 className="text-sm font-semibold uppercase text-muted">Quick actions</h2>
        <div className="mt-4 grid gap-2">
          {quickActions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => sendMessage(action)}
              disabled={isSending}
              className="rounded-md border border-line px-3 py-2 text-left text-sm text-foreground transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {action}
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-h-[680px] flex-col overflow-hidden rounded-lg border border-line bg-panel">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}
          {messages.length === 0 ? (
            <div className="rounded-md border border-dashed border-line p-5 text-sm text-muted">
              Mulai dengan pertanyaan manual market analysis. AI hanya melihat
              data lokal yang sudah kamu import.
            </div>
          ) : null}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage(input);
          }}
          className="border-t border-line p-4"
        >
          {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
          <div className="flex gap-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Tanya market watchlist lokal kamu..."
              className="min-w-0 flex-1 rounded-md border border-line bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
            <button
              disabled={isSending}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-black hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSending ? "Sending" : "Send"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ChatBubble({ message }: { message: DisplayMessage }) {
  const parsed = message.role === "assistant" ? parseAssistantMessage(message.content) : null;

  return (
    <div
      className={`rounded-lg border p-4 ${
        message.role === "error"
          ? "mr-auto max-w-3xl border-danger bg-background text-danger"
          : message.role === "user"
          ? "ml-auto max-w-2xl border-accent bg-panel-soft"
          : "mr-auto max-w-3xl border-line bg-background"
      }`}
    >
      <p className="text-xs uppercase text-muted">
        {message.role === "user"
          ? "You"
          : message.role === "error"
            ? "Error"
            : "PoE2 AI Analyst"}
      </p>
      {parsed ? (
        <div className="mt-3 space-y-3 text-sm leading-6">
          <p>{parsed.answer}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Info label="Recommendation" value={parsed.recommendation} />
            <Info label="Confidence" value={`${parsed.confidence}/100`} />
          </div>
          <ChipList label="Relevant items" values={parsed.relevant_items} />
          <ChipList label="Risks" values={parsed.risks} />
          <ChipList label="Missing data" values={parsed.missing_data} />
          <p className="rounded-md border border-line bg-panel p-3 text-muted">
            {parsed.suggested_next_manual_action}
          </p>
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{message.content}</p>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-panel p-3">
      <p className="text-xs uppercase text-muted">{label}</p>
      <p className="mt-1 font-mono text-sm">{value}</p>
    </div>
  );
}

function ChipList({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.length ? (
          values.map((value) => (
            <span
              key={value}
              className="rounded-md border border-line px-2 py-1 text-xs text-muted"
            >
              {value}
            </span>
          ))
        ) : (
          <span className="text-sm text-muted">-</span>
        )}
      </div>
    </div>
  );
}
