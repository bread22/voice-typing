import {
  IRewriteProvider,
  RewriteInput,
  RewrittenPrompt
} from "../types/contracts";
import { request } from "undici";

interface OllamaRewriteProviderOptions {
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

const REWRITE_SYSTEM_PROMPT =
  "Rewrite voice transcription into a clear prompt for coding assistant use. Preserve intent, remove filler words, and structure output with explicit task/action language.";

export class OllamaRewriteProvider implements IRewriteProvider {
  constructor(private readonly options: OllamaRewriteProviderOptions) {}

  async rewrite(input: RewriteInput): Promise<RewrittenPrompt> {
    const prompt = input.style
      ? `[style=${input.style}] ${input.transcript}`
      : input.transcript;

    const res = await request(`${this.options.baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: this.options.model,
        system: REWRITE_SYSTEM_PROMPT,
        prompt,
        stream: false
      }),
      headersTimeout: this.options.timeoutMs,
      bodyTimeout: this.options.timeoutMs
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`Ollama rewrite failed (${res.statusCode})`);
    }

    const payload = (await res.body.json()) as { response?: string };
    return {
      text: (payload.response ?? "").trim(),
      provider: "ollama"
    };
  }
}

