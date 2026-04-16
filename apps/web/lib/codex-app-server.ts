import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";
import {
  codexOutputJsonSchema,
  type AdaptiveGenerationContext,
  type GenerateGameRequest
} from "@kids-play/shared";
import { GameGenerationError } from "./errors";
import type { GameGenerationClient } from "./generation";

type JsonObject = Record<string, unknown>;

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

type TurnWaiter = {
  resolve: (message: string) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

type CodexClientOptions = {
  cwd: string;
  model: string;
  templateCatalog: unknown;
};

const DEFAULT_TIMEOUT_MS = 45_000;

let singleton: CodexAppServerClient | null = null;

export function getCodexAppServerClient(
  options: CodexClientOptions
): GameGenerationClient {
  singleton ??= new CodexAppServerClient(options);
  return singleton;
}

class CodexAppServerClient implements GameGenerationClient {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<number, PendingRequest>();
  private turnWaiters = new Map<string, TurnWaiter>();
  private agentMessages = new Map<string, string[]>();
  private nextId = 1;
  private initPromise: Promise<void> | null = null;

  constructor(private readonly options: CodexClientOptions) {}

  async generateGameConfig(
    input: GenerateGameRequest,
    context: AdaptiveGenerationContext
  ): Promise<unknown> {
    await this.ensureInitialized();

    const thread = await this.request<{ thread: { id: string } }>(
      "thread/start",
      {
        model: this.options.model,
        cwd: this.options.cwd,
        approvalPolicy: "never",
        sandbox: "read-only",
        serviceName: "kids_play_phase_1",
        ephemeral: true,
        experimentalRawEvents: false,
        persistExtendedHistory: false,
        developerInstructions:
          "You generate schema-valid child-safe game configs only. Do not run tools or edit files."
      },
      15_000
    );

    const turn = await this.request<{ turn: { id: string } }>(
      "turn/start",
      {
        threadId: thread.thread.id,
        input: [
          {
            type: "text",
            text: buildPrompt(input, context, this.options.templateCatalog),
            text_elements: []
          }
        ],
        effort: "low",
        approvalPolicy: "never",
        outputSchema: codexOutputJsonSchema
      },
      15_000
    );

    const finalMessage = await this.waitForTurn(
      thread.thread.id,
      turn.turn.id,
      DEFAULT_TIMEOUT_MS
    );

    return parseFinalJson(finalMessage);
  }

  private async ensureInitialized() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.startAndInitialize();
    return this.initPromise;
  }

  private async startAndInitialize() {
    const proc = spawn(process.env.CODEX_BIN ?? "codex", ["app-server"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        DISABLE_AUTO_UPDATE: "true"
      }
    }) as ChildProcessWithoutNullStreams;
    this.proc = proc;

    const lines = readline.createInterface({ input: proc.stdout });
    lines.on("line", (line) => this.handleLine(line));

    proc.stderr.on("data", (chunk) => {
      const text = String(chunk).trim();
      if (text) {
        console.warn("[codex app-server]", text);
      }
    });

    proc.on("exit", () => {
      const error = new GameGenerationError("Codex app-server stopped.");
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(error);
      }
      for (const waiter of this.turnWaiters.values()) {
        clearTimeout(waiter.timer);
        waiter.reject(error);
      }
      this.pending.clear();
      this.turnWaiters.clear();
      this.agentMessages.clear();
      this.proc = null;
      this.initPromise = null;
    });

    await this.request(
      "initialize",
      {
        clientInfo: {
          name: "kids_play_phase_1",
          title: "Kids Play Phase 1",
          version: "0.1.0"
        },
        capabilities: {
          experimentalApi: true,
          optOutNotificationMethods: [
            "item/reasoning/summaryTextDelta",
            "item/reasoning/textDelta",
            "thread/tokenUsage/updated"
          ]
        }
      },
      10_000
    );

    this.notify("initialized", {});

    const account = await this.request<{
      account: unknown | null;
      requiresOpenaiAuth: boolean;
    }>("account/read", { refreshToken: false }, 10_000);

    if (!account.account) {
      throw new GameGenerationError("Codex auth is not available.");
    }
  }

  private request<T>(method: string, params: unknown, timeoutMs: number) {
    const proc = this.proc;
    if (!proc?.stdin.writable) {
      return Promise.reject(new GameGenerationError("Codex app-server is not running."));
    }

    const id = this.nextId++;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new GameGenerationError(`Codex request timed out: ${method}`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timer
      });

      proc.stdin.write(`${JSON.stringify({ method, id, params })}\n`);
    });
  }

  private notify(method: string, params: unknown) {
    const proc = this.proc;
    if (!proc?.stdin.writable) {
      throw new GameGenerationError("Codex app-server is not running.");
    }

    proc.stdin.write(`${JSON.stringify({ method, params })}\n`);
  }

  private waitForTurn(threadId: string, turnId: string, timeoutMs: number) {
    const key = turnKey(threadId, turnId);

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.turnWaiters.delete(key);
        reject(new GameGenerationError("Codex generation timed out."));
      }, timeoutMs);

      this.turnWaiters.set(key, { resolve, reject, timer });
    });
  }

  private handleLine(line: string) {
    let message: JsonObject;
    try {
      message = JSON.parse(line) as JsonObject;
    } catch {
      console.warn("[codex app-server] non-json stdout:", line);
      return;
    }

    if (typeof message.id === "number") {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      clearTimeout(pending.timer);

      if (message.error) {
        const error = message.error as { message?: string };
        pending.reject(new GameGenerationError(error.message ?? "Codex request failed."));
        return;
      }

      pending.resolve(message.result);
      return;
    }

    const method = message.method;
    const params = message.params as JsonObject | undefined;

    if (method === "item/completed" && params) {
      const item = params.item as JsonObject | undefined;
      if (item?.type === "agentMessage") {
        const key = turnKey(String(params.threadId), String(params.turnId));
        const messages = this.agentMessages.get(key) ?? [];
        messages.push(String(item.text ?? ""));
        this.agentMessages.set(key, messages);
      }
    }

    if (method === "turn/completed" && params) {
      const turn = params.turn as JsonObject | undefined;
      const key = turnKey(String(params.threadId), String(turn?.id));
      const waiter = this.turnWaiters.get(key);
      if (!waiter) {
        return;
      }

      this.turnWaiters.delete(key);
      clearTimeout(waiter.timer);

      if (turn?.status === "failed") {
        waiter.reject(new GameGenerationError("Codex turn failed."));
        return;
      }

      const finalMessage = (this.agentMessages.get(key) ?? []).join("\n").trim();
      this.agentMessages.delete(key);
      waiter.resolve(finalMessage);
    }

    if (method === "error" && params) {
      console.warn("[codex app-server] error", params.error ?? params);
    }
  }
}

function turnKey(threadId: string, turnId: string) {
  return `${threadId}:${turnId}`;
}

function buildPrompt(
  input: GenerateGameRequest,
  context: AdaptiveGenerationContext,
  templateCatalog: unknown
) {
  return [
    "Generate one short child-safe adaptive game config for this request.",
    "",
    `Request: ${JSON.stringify(input)}`,
    `Adaptive context: ${JSON.stringify(context)}`,
    `Template catalog: ${JSON.stringify(templateCatalog)}`,
    "",
    "Rules:",
    "- Return JSON only, with no markdown.",
    "- Choose one template whose skill matches the selected skill.",
    "- Use only item ids and image keys from the matching template.",
    "- Keep the session to 3 short rounds.",
    "- Keep each round small: use no more than 3 choices for reading or attention and no more than 4 choices for memory.",
    "- Use the adaptive context to repeat weak items, reduce distractors, or gently raise difficulty.",
    "- Keep changes small and encouraging. Do not make the child feel punished.",
    "- Feedback must be short, affirmative, and non-punitive.",
    "- Include every schema field. Use an empty string for item.value or round.correctChoice when it does not apply.",
    "- Use an empty array for round.sequence and round.correctSequence when they do not apply.",
    "- Do not include gameId, runtimeUrl, launchMode, ports, localhost links, or technical details."
  ].join("\n");
}

function parseFinalJson(text: string) {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!withoutFence) {
    throw new GameGenerationError("Codex returned an empty response.");
  }

  try {
    return JSON.parse(withoutFence);
  } catch {
    throw new GameGenerationError("Codex returned invalid JSON.");
  }
}
