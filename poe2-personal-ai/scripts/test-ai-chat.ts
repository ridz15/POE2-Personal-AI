import {
  addChatMessage,
  getOrCreateDefaultChatSession,
  getRecentAiReports,
} from "../src/lib/db";
import {
  buildDeterministicChatResponse,
  selectChatContext,
} from "../src/lib/chat-context";

const message = process.argv.slice(2).join(" ") || "Summarize market watchlist";
const session = getOrCreateDefaultChatSession();
const context = selectChatContext(message);
const aiReports = getRecentAiReports();
const response = buildDeterministicChatResponse(
  message,
  context,
  process.env.OPENAI_API_KEY ? "local test mode" : "OPENAI_API_KEY is missing",
);

addChatMessage(session.id, "user", message);
addChatMessage(session.id, "assistant", JSON.stringify(response));

console.log(
  JSON.stringify(
    {
      session_id: session.id,
      context_mode: context.mode,
      relevant_ai_reports: aiReports.length,
      message: response,
    },
    null,
    2,
  ),
);
