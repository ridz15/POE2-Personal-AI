import Link from "next/link";
import { getChatMessages, getOrCreateDefaultChatSession } from "@/lib/db";
import { ChatClient } from "./chat-client";

export const dynamic = "force-dynamic";

export default function AiChatPage() {
  const session = getOrCreateDefaultChatSession();
  const messages = getChatMessages(session.id);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-5 py-8 sm:px-8">
        <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/" className="text-sm text-accent hover:text-accent-strong">
              Dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-semibold">Personal PoE2 AI Chat</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Tanya kondisi market dari data SQLite lokal: watched items,
              snapshots, deterministic analysis, dan AI reports. Ini alat analis
              manual, bukan bot.
            </p>
          </div>
          <Link
            href="/snapshots"
            className="rounded-md border border-line px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
          >
            Market snapshots
          </Link>
        </header>

        <ChatClient sessionId={session.id} initialMessages={messages} />
      </div>
    </main>
  );
}
