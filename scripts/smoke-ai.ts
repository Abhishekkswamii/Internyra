/**
 * Opt-in AI provider smoke test. Makes ONE tiny request per configured provider and reports whether the
 * configured model ID answered. Nothing is printed except PASS/FAIL, the model ID and the HTTP status class.
 * Use only NEWLY ROTATED keys. Gemini is reported as "not configured" unless GEMINI_API_KEY is set.
 *   node --env-file=.env.local node_modules/.bin/tsx scripts/smoke-ai.ts
 */
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

const real = (v?: string) => Boolean(v && v.trim() && !/^(your_|<)/i.test(v));

async function openai() {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-6-luna";
  if (!real(key)) return console.log(`OpenAI: NOT CONFIGURED (no key). Model ${model} not tested.`);
  const c = new OpenAI({ apiKey: key, timeout: 30_000, maxRetries: 0 });
  try {
    await c.models.retrieve(model);
    console.log(`OpenAI: model ${model} is listed for this account.`);
  } catch (e) {
    return console.log(`OpenAI: FAIL listing model ${model} (HTTP ${(e as { status?: number }).status ?? "n/a"}).`);
  }
  try {
    const res = (await c.responses.create({ model, input: "Reply with the single word READY.", max_output_tokens: 16 } as never)) as unknown as { output_text?: string };
    console.log(`OpenAI: ${/ready/i.test(res.output_text ?? "") ? "PASS" : "FAIL (unexpected reply)"} Responses API with ${model}.`);
  } catch (e) {
    console.log(`OpenAI: FAIL Responses call with ${model} (HTTP ${(e as { status?: number }).status ?? "n/a"}).`);
  }
  try {
    await c.responses.create({ model, input: "Say READY.", max_output_tokens: 16, tools: [{ type: "web_search" }] } as never);
    console.log(`OpenAI: web_search tool accepted for ${model}. Set AI_WEB_SEARCH_ENABLED=true to use it.`);
  } catch (e) {
    console.log(`OpenAI: web_search tool NOT available for ${model} (HTTP ${(e as { status?: number }).status ?? "n/a"}). Leave AI_WEB_SEARCH_ENABLED=false.`);
  }
}

async function gemini() {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  if (!real(key)) return console.log(`Gemini: NOT CONFIGURED (no key). Model ${model} not tested; OpenAI would be the temporary provider.`);
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const res = await ai.models.generateContent({ model, contents: "Reply with the single word READY." });
    console.log(`Gemini: ${/ready/i.test(res.text ?? "") ? "PASS" : "FAIL (unexpected reply)"} generateContent with ${model}.`);
  } catch (e) {
    console.log(`Gemini: FAIL with ${model} (${(e as { status?: number }).status ?? "error"}).`);
  }
}

void (async () => {
  await openai();
  await gemini();
})();
