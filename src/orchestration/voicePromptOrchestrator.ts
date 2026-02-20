import * as vscode from "vscode";
import { VoicePromptSettings } from "../config/settings";
import {
  AudioChunk,
  IInputInjector,
  IRewriteProvider,
  ISttProvider,
  RewriteInput
} from "../types/contracts";
import { AudioCaptureService } from "../audio/audioCaptureService";

interface Dependencies {
  settings: VoicePromptSettings;
  audioCapture: AudioCaptureService;
  sttProvider: ISttProvider;
  rewriteProvider: IRewriteProvider | undefined;
  cloudRewriteProvider?: IRewriteProvider;
  inputInjector: IInputInjector;
}

export class VoicePromptOrchestrator {
  private warnedNoBackend = false;
  private lastCapturedAudio?: AudioChunk;

  constructor(private readonly deps: Dependencies) {}

  setRewriteProviders(
    rewriteProvider: IRewriteProvider | undefined,
    cloudRewriteProvider: IRewriteProvider | undefined
  ): void {
    this.deps.rewriteProvider = rewriteProvider;
    this.deps.cloudRewriteProvider = cloudRewriteProvider;
  }

  async runOnce(): Promise<void> {
    const audio = await this.deps.audioCapture.captureOnce();
    this.lastCapturedAudio = audio;

    const raw = await this.transcribeWithRetry(audio);
    const sourceText = raw.text.trim();

    if (!sourceText) {
      void vscode.window.showWarningMessage(
        "No speech detected. Try speaking more clearly."
      );
      return;
    }

    const finalText = await this.resolveFinalText(sourceText);
    if (!finalText) {
      return;
    }

    const maybeEdited = await this.previewIfEnabled(finalText);
    if (maybeEdited === undefined) {
      return;
    }

    try {
      await this.deps.inputInjector.insert(maybeEdited);
      void vscode.window.setStatusBarMessage("Voice Prompt inserted", 1500);
    } catch {
      await vscode.env.clipboard.writeText(maybeEdited);
      void vscode.window.showErrorMessage(
        "Insertion failed. Copied rewritten prompt to clipboard."
      );
    }
  }

  private async resolveFinalText(sourceText: string): Promise<string | undefined> {
    const { noRewriteBehavior } = this.deps.settings;

    if (!this.deps.rewriteProvider || this.deps.settings.rewriteProvider === "none") {
      if (!this.warnedNoBackend) {
        this.warnedNoBackend = true;
        void vscode.window.showWarningMessage(
          "No rewrite backend is configured. Configure Ollama or cloud rewrite in settings."
        );
      }

      if (noRewriteBehavior === "disable_plugin") {
        void vscode.window.showWarningMessage(
          "Rewrite backend unavailable. Voice Prompt is disabled by policy."
        );
        return undefined;
      }
      return sourceText;
    }

    const rewriteInput: RewriteInput = {
      transcript: sourceText,
      style: this.deps.settings.rewriteStyle
    };

    try {
      const rewritten = await this.deps.rewriteProvider.rewrite(rewriteInput);
      return rewritten.text.trim() || sourceText;
    } catch {
      if (this.deps.settings.autoFallbackToCloud && this.deps.cloudRewriteProvider) {
        try {
          const cloudRewritten = await this.deps.cloudRewriteProvider.rewrite(
            rewriteInput
          );
          return cloudRewritten.text.trim() || sourceText;
        } catch {
          // Fall through to policy.
        }
      }

      if (noRewriteBehavior === "disable_plugin") {
        void vscode.window.showErrorMessage(
          "Rewrite failed and plugin is configured to disable when rewrite is unavailable."
        );
        return undefined;
      }
      return sourceText;
    }
  }

  private async previewIfEnabled(text: string): Promise<string | undefined> {
    if (!this.deps.settings.previewBeforeInsert) {
      return text;
    }

    return vscode.window.showInputBox({
      title: "Voice Prompt Preview",
      value: text,
      ignoreFocusOut: true,
      prompt: "Edit before insert. Press Enter to confirm."
    });
  }

  private async transcribeWithRetry(audio: AudioChunk) {
    try {
      return await this.deps.sttProvider.transcribe(audio);
    } catch {
      const retrySelection = await vscode.window.showErrorMessage(
        "Transcription failed.",
        "Retry"
      );
      if (retrySelection === "Retry" && this.lastCapturedAudio) {
        return this.deps.sttProvider.transcribe(this.lastCapturedAudio);
      }
      throw new Error("Transcription failed.");
    }
  }
}

