import OpenAI from "openai";
import { z } from "zod";
import {
  addChatMessage,
  getChatMessages,
  getDb,
  getOrCreateDefaultChatSession,
  getRecentAiReports,
} from "@/lib/db";
import {
  buildDeterministicChatResponse,
  selectChatContext,
  type ChatResponsePayload,
} from "@/lib/chat-context";

export const runtime = "nodejs";

const requestSchema = z.object({
  message: z.string().min(1),
  session_id: z.number().int().optional(),
});

const chatResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    relevant_items: {
      type: "array",
      items: { type: "string" },
    },
    recommendation: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 100 },
    risks: {
      type: "array",
      items: { type: "string" },
    },
    missing_data: {
      type: "array",
      items: { type: "string" },
    },
    suggested_next_manual_action: { type: "string" },
  },
  required: [
    "answer",
    "relevant_items",
    "recommendation",
    "confidence",
    "risks",
    "missing_data",
    "suggested_next_manual_action",
  ],
};

let openai: OpenAI | null = null;

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return openai;
}

export async function GET() {
  try {
    const session = getOrCreateDefaultChatSession();
    const messages = getChatMessages(session.id);

    return Response.json({ session, messages });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? `Database query failed: ${error.message}`
            : "Database query failed",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let sessionId: number | null = null;

  try {
    const body = requestSchema.parse(await request.json().catch(() => ({})));
    const session = body.session_id
      ? (getDb()
          .prepare(
            `SELECT id, title, created_at, updated_at
             FROM ai_chat_sessions
             WHERE id = ?`,
          )
          .get(body.session_id) as
          | ReturnType<typeof getOrCreateDefaultChatSession>
          | undefined) ?? getOrCreateDefaultChatSession()
      : getOrCreateDefaultChatSession();
    sessionId = session.id;

    const context = selectChatContext(body.message);
    const aiReports = getRecentAiReports();
    const trimmedContext = {
      mode: context.mode,
      items: context.items.slice(0, 8).map((item) => ({
        watched_item: item.watched_item,
        latest_snapshot: item.latest_snapshot,
        deterministic_analysis: item.analysis,
        price_history: item.price_history.slice(-8),
      })),
      recent_ai_reports: aiReports
        .filter((report) =>
          context.items.some((item) => item.watched_item.item_name === report.item_name),
        )
        .slice(0, 8),
    };

    addChatMessage(session.id, "user", body.message);

    if (!process.env.OPENAI_API_KEY) {
      const fallback = buildDeterministicChatResponse(
        body.message,
        context,
        "OPENAI_API_KEY is missing",
      );
      addChatMessage(session.id, "assistant", JSON.stringify(fallback));

      return Response.json(
        {
          error: "OPENAI_API_KEY is missing",
          session_id: session.id,
          message: fallback,
          fallback: true,
        },
        { status: 200 },
      );
    }

    let completion;
    try {
      completion = await getOpenAI().responses.create(
        {
          model: process.env.OPENAI_MODEL ?? "gpt-5.2",
          input: [
            {
              role: "system",
              content:
                "You are a personal Path of Exile 2 market analyst for a manual analyst tool. You can explain watched item conditions, compare watchlist items, summarize market state, explain flip_score and confidence_score, identify target buy or target sell hits, and warn when data is not enough. You must only use provided local SQLite data. Do not invent prices or market history. Do not claim real-time market access. Do not recommend auto-buy, auto-whisper, browser automation, trade bots, or guaranteed profit. Return structured JSON only.",
            },
            {
              role: "user",
              content: JSON.stringify({
                user_message: body.message,
                context_selection: trimmedContext.mode,
                local_market_context: trimmedContext,
              }),
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "poe2_ai_chat_response",
              schema: chatResponseSchema,
            },
          },
        },
        { timeout: 30000 },
      );
    } catch (error) {
      const isTimeout =
        error instanceof Error &&
        (error.name.toLowerCase().includes("timeout") ||
          error.message.toLowerCase().includes("timeout") ||
          error.message.toLowerCase().includes("timed out"));
      const fallback = buildDeterministicChatResponse(
        body.message,
        context,
        isTimeout ? "AI request timed out" : "OpenAI request failed",
      );
      addChatMessage(session.id, "assistant", JSON.stringify(fallback));

      return Response.json(
        {
          error: isTimeout
            ? "AI request timed out"
            : `OpenAI request failed: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
          session_id: session.id,
          message: fallback,
          fallback: true,
        },
        { status: isTimeout ? 504 : 502 },
      );
    }

    const parsed = JSON.parse(completion.output_text) as ChatResponsePayload;
    addChatMessage(session.id, "assistant", JSON.stringify(parsed));

    return Response.json({
      session_id: session.id,
      message: parsed,
      fallback: false,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? "Invalid chat request"
            : error instanceof Error
              ? `Database query failed: ${error.message}`
              : "Database query failed",
        session_id: sessionId,
      },
      { status: error instanceof z.ZodError ? 400 : 500 },
    );
  }
}
