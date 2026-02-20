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

const SYSTEM_MSG = `You are a transcription cleanup tool. The user gives you raw voice-to-text output. You fix grammar, remove filler words (um, uh, like, you know), and return ONLY the cleaned sentence. Rules:
- Output ONLY the cleaned text, nothing else
- Do NOT answer questions — just clean them up
- Do NOT add explanations, commentary, or opinions
- Do NOT change the meaning or intent
- Keep it roughly the same length as the input
- If the input is already clean, return it as-is
- PRESERVE the original language — if input is Chinese, output Chinese; if English, output English; if mixed, keep it mixed`;

const FEW_SHOT: Array<{ role: string; content: string }> = [
  { role: "user", content: "um so like I want to uh refactor the the database layer" },
  { role: "assistant", content: "I want to refactor the database layer." },
  { role: "user", content: "hey can you uh help me fix this this bug in the in the login page" },
  { role: "assistant", content: "Can you help me fix this bug in the login page?" },
  { role: "user", content: "how can I make it support multiple languages at least Chinese and English" },
  { role: "assistant", content: "How can I make it support multiple languages, at least Chinese and English?" },
  { role: "user", content: "this time seems working" },
  { role: "assistant", content: "This time seems to be working." },
  { role: "user", content: "我想给这个函数加一个那个缓存的功能" },
  { role: "assistant", content: "我想给这个函数加一个缓存功能。" },
  { role: "user", content: "帮我看一下这个这个bug是怎么回事" },
  { role: "assistant", content: "帮我看一下这个bug是怎么回事。" },
  { role: "user", content: "把这个component重构一下然后加上error handling" },
  { role: "assistant", content: "把这个component重构一下，然后加上error handling。" },
];

export class OllamaRewriteProvider implements IRewriteProvider {
  constructor(private readonly options: OllamaRewriteProviderOptions) {}

  async rewrite(input: RewriteInput): Promise<RewrittenPrompt> {
    const inputWordCount = input.transcript.split(/\s+/).length;
    const maxTokens = Math.max(inputWordCount * 3, 50);

    const messages = [
      { role: "system", content: SYSTEM_MSG },
      ...FEW_SHOT,
      { role: "user", content: input.transcript }
    ];

    const res = await request(`${this.options.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: this.options.model,
        messages,
        stream: false,
        options: {
          num_predict: maxTokens,
          temperature: 0.1,
          stop: ["\n\n"]
        }
      }),
      headersTimeout: this.options.timeoutMs,
      bodyTimeout: this.options.timeoutMs
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`Ollama rewrite failed (${res.statusCode})`);
    }

    const payload = (await res.body.json()) as {
      message?: { content?: string };
    };
    const raw = (payload.message?.content ?? "").trim();
    const cleaned = extractFirstLine(raw);

    if (cleaned.length > input.transcript.length * 2) {
      return { text: input.transcript, provider: "ollama" };
    }

    return {
      text: cleaned || input.transcript,
      provider: "ollama"
    };
  }
}

function extractFirstLine(text: string): string {
  let cleaned = text.split("\n")[0].trim();
  cleaned = cleaned.replace(/^["'\u201C\u201D]+|["'\u201C\u201D]+$/g, "");
  return cleaned.trim();
}
