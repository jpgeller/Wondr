// The only file that calls a model. Switch providers with LLM_PROVIDER, no other code changes.
//
//   omnara     OpenAI-style chat completions at OMNARA_BASE_URL (hackathon credits)
//   anthropic  Claude through the official SDK (fallback)
//
// Every call returns JSON validated against a zod schema. A reply that does not parse
// gets one retry with the validation error attached, then throws.

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

type JsonCall<T> = {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  name?: string; // label for logs
  maxTokens?: number;
};

const CALL_TIMEOUT_MS = 90_000; // one hung call must not eat the whole 300 s run

const provider = () => (process.env.LLM_PROVIDER || 'omnara').toLowerCase();

export async function generateJSON<T>(call: JsonCall<T>): Promise<T> {
  const started = Date.now();
  try {
    return provider() === 'anthropic' ? await viaAnthropic(call) : await viaOmnara(call);
  } finally {
    console.log(`[llm] ${call.name ?? 'call'} via ${provider()} in ${Date.now() - started} ms`);
  }
}

// --------------------------------------------------------------- anthropic

let anthropic: Anthropic | null = null;

async function viaAnthropic<T>(call: JsonCall<T>): Promise<T> {
  anthropic ??= new Anthropic({ timeout: CALL_TIMEOUT_MS, maxRetries: 1 });
  const response = await anthropic.beta.messages.parse({
    model: process.env.LLM_MODEL || 'claude-opus-5-5',
    // If a safety classifier declines, the API retries on a fallback model in the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    max_tokens: call.maxTokens ?? 16000,
    system: call.system,
    messages: [{ role: 'user', content: call.prompt }],
    output_config: { effort: 'low', format: zodOutputFormat(call.schema) },
  });
  if (response.stop_reason === 'refusal') throw new Error('Model refused the request');
  if (!response.parsed_output) throw new Error('Model reply did not match the schema');
  return response.parsed_output as T;
}

// ------------------------------------------------------------------ omnara

async function viaOmnara<T>(call: JsonCall<T>): Promise<T> {
  const base = process.env.OMNARA_BASE_URL;
  const key = process.env.OMNARA_API_KEY;
  if (!base || !key) throw new Error('OMNARA_BASE_URL and OMNARA_API_KEY must be set (or LLM_PROVIDER=anthropic)');

  const schemaText = JSON.stringify(z.toJSONSchema(call.schema));
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    {
      role: 'system',
      content: `${call.system}\n\nReply with a single JSON object and nothing else. It must match this JSON Schema:\n${schemaText}`,
    },
    { role: 'user', content: call.prompt },
  ];

  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.LLM_MODEL,
        messages,
        max_tokens: call.maxTokens ?? 8000,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Omnara ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? '';

    const parsed = call.schema.safeParse(extractJson(text));
    if (parsed.success) return parsed.data;
    if (attempt === 2) throw new Error(`Model reply did not match the schema: ${parsed.error.message.slice(0, 300)}`);
    messages.push(
      { role: 'assistant', content: text },
      { role: 'user', content: `That JSON did not validate:\n${parsed.error.message}\nReply again with corrected JSON only.` },
    );
  }
  throw new Error('unreachable');
}

/** Pulls the first JSON object out of a reply, tolerating code fences or stray prose. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}
