"use client";

import { useState } from "react";

type AiReport = {
  item_name: string;
  summary: string;
  current_price: number | null;
  trend: string;
  flip_score: number;
  recommendation: string;
  reasoning: string;
  risk: string;
  missing_data: string[];
};

export function AiExplanationButton({ itemName }: { itemName: string }) {
  const [report, setReport] = useState<AiReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function runAnalysis() {
    setIsLoading(true);
    setError(null);

    const response = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_name: itemName }),
    });

    const payload = (await response.json()) as {
      reports?: AiReport[];
      error?: string;
    };

    if (!response.ok || !payload.reports?.[0]) {
      setError(payload.error ?? "AI explanation failed.");
      setReport(null);
      setIsLoading(false);
      return;
    }

    setReport(payload.reports[0]);
    setIsLoading(false);
  }

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={runAnalysis}
        disabled={isLoading}
        className="rounded-md border border-accent px-3 py-2 text-xs font-semibold text-accent transition hover:bg-accent hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "Running AI..." : "AI explanation"}
      </button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {report ? (
        <div className="rounded-md border border-line bg-background p-3 text-xs leading-5 text-muted">
          <p className="font-semibold text-foreground">{report.summary}</p>
          <p className="mt-2">{report.reasoning}</p>
          <p className="mt-2">
            Risk: {report.risk} | Missing:{" "}
            {report.missing_data.length ? report.missing_data.join(", ") : "-"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
