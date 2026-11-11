import "server-only";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { getServerConfig } from "@/lib/config/env";
import { classifyHttpStatus, ProviderError, type Citation, type GenerateRequest, type GenerateResult, type ProviderClient } from "./types";

function statusOf(err: unknown): number | undefined {
  const e = err as { status?: number; code?: number | string; response?: { status?: number } };
  if (typeof e?.status === "number") return e.status;
  if (typeof e?.response?.status === "number") return e.response.status;
  if (typeof e?.code === "number") return e.code;
  return undefined;
}

function dedupe(c: Citation[]): Citation[] {
  const seen = new Set<string>();
  return c.filter((x) => (seen.has(x.url) ? false : (seen.add(x.url), true)));
}

export class OpenAIProvider implements ProviderClient {
  readonly id = "openai" as const;
  constructor(private readonly apiKey: string, readonly model: string) {}

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const client = new OpenAI({ apiKey: this.apiKey, timeout: req.timeoutMs, maxRetries: 0 });
    try {
      const response = await client.responses.create({
        model: this.model,
        instructions: req.system,
        input: req.user,
        max_output_tokens: req.maxOutputTokens,
        ...(req.webSearch ? { tools: [{ type: "web_search" as const }] } : {}),
      } as never);
      const r = response as unknown as {
        output_text?: string;
        output?: { type: string; content?: { type: string; annotations?: { type: string; url?: string; title?: string }[] }[] }[];
      };
      const citations: Citation[] = [];
      let searched = false;
      for (const item of r.output ?? []) {
        if (item.type === "web_search_call") searched = true;
        for (const c of item.content ?? []) {
          for (const a of c.annotations ?? []) if (a.type === "url_citation" && a.url) citations.push({ url: a.url, title: a.title });
        }
      }
      return { text: r.output_text ?? "", model: this.model, webSearchUsed: req.webSearch && (searched || citations.length > 0), citations: dedupe(citations) };
    } catch (err) {
      throw classifyHttpStatus(statusOf(err), "openai", (err as { name?: string })?.name);
    }
  }
}

export class GeminiProvider implements ProviderClient {
  readonly id = "gemini" as const;
  constructor(private readonly apiKey: string, readonly model: string) {}

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    try {
      const res = await ai.models.generateContent({
        model: this.model,
        contents: req.user,
        config: {
          systemInstruction: req.system,
          temperature: 0.2,
          maxOutputTokens: req.maxOutputTokens,
          httpOptions: { timeout: req.timeoutMs },
          // Search grounding cannot be combined with a forced JSON mime type; the JSON is validated either way.
          ...(req.webSearch ? { tools: [{ googleSearch: {} }] } : { responseMimeType: "application/json" }),
        },
      } as never);
      const gm = (res as unknown as { candidates?: { groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[]; webSearchQueries?: string[] } }[] }).candidates?.[0]?.groundingMetadata;
      const citations: Citation[] = [];
      for (const ch of gm?.groundingChunks ?? []) if (ch.web?.uri) citations.push({ url: ch.web.uri, title: ch.web.title });
      return { text: res.text ?? "", model: this.model, webSearchUsed: req.webSearch && ((gm?.webSearchQueries?.length ?? 0) > 0 || citations.length > 0), citations: dedupe(citations) };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw classifyHttpStatus(statusOf(err), "gemini", (err as { name?: string })?.name);
    }
  }
}

/** Providers in the configured order that actually have credentials. Gemini-first by default. */
export function configuredProviders(): { providers: ProviderClient[]; geminiConfigured: boolean; openaiConfigured: boolean; webSearch: boolean; timeoutMs: number } {
  const c = getServerConfig();
  const available: Record<string, ProviderClient | null> = {
    gemini: c.GEMINI_API_KEY ? new GeminiProvider(c.GEMINI_API_KEY, c.GEMINI_MODEL) : null,
    openai: c.OPENAI_API_KEY ? new OpenAIProvider(c.OPENAI_API_KEY, c.OPENAI_MODEL) : null,
  };
  const order = c.AI_PROVIDER_ORDER.split(",").map((s) => s.trim().toLowerCase()).filter((s) => s in available);
  const providers = [...new Set(order)].map((id) => available[id]).filter((p): p is ProviderClient => p !== null);
  return { providers, geminiConfigured: Boolean(available.gemini), openaiConfigured: Boolean(available.openai), webSearch: c.AI_WEB_SEARCH_ENABLED, timeoutMs: c.AI_TIMEOUT_MS };
}
