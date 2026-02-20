import * as vscode from "vscode";
import { VoicePromptSettings } from "../config/settings";
import {
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
  inputInjector: IInputInjector;
}

export class VoicePromptOrchestrator {
  constructor(private readonly deps: Dependencies) {}

  async runOnce(): Promise<void> {
    const audio = await this.deps.audioCapture.captureOnce();
    const raw = await this.deps.sttProvider.transcribe(audio);
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

    await this.deps.inputInjector.insert(maybeEdited);
    void vscode.window.setStatusBarMessage("Voice Prompt inserted", 1500);
  }

  private async resolveFinalText(sourceText: string): Promise<string | undefined> {
    const { noRewriteBehavior } = this.deps.settings;

    if (!this.deps.rewriteProvider || this.deps.settings.rewriteProvider === "none") {
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
}

