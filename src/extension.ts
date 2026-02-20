import * as vscode from "vscode";
import { AudioCaptureService } from "./audio/audioCaptureService";
import { readSettings } from "./config/settings";
import { CursorInputInjector } from "./inject/cursorInputInjector";
import { VoicePromptOrchestrator } from "./orchestration/voicePromptOrchestrator";
import { OllamaRewriteProvider } from "./rewrite/ollamaRewriteProvider";
import { LocalSttProvider } from "./stt/localSttProvider";

const START_RECORDING_COMMAND = "voicePrompt.startRecording";

export function activate(context: vscode.ExtensionContext): void {
  const settings = readSettings();
  const orchestrator = new VoicePromptOrchestrator({
    settings,
    audioCapture: new AudioCaptureService(),
    sttProvider: new LocalSttProvider({
      endpoint: settings.sttLocalEndpoint,
      model: settings.sttModel,
      timeoutMs: settings.sttTimeoutMs
    }),
    rewriteProvider:
      settings.rewriteProvider === "none"
        ? undefined
        : new OllamaRewriteProvider({
            baseUrl: settings.rewriteOllamaBaseUrl,
            model: settings.rewriteModel,
            timeoutMs: settings.rewriteTimeoutMs
          }),
    inputInjector: new CursorInputInjector()
  });

  const startRecordingDisposable = vscode.commands.registerCommand(
    START_RECORDING_COMMAND,
    async () => {
      try {
        await orchestrator.runOnce();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`Voice Prompt failed: ${message}`);
      }
    }
  );
  context.subscriptions.push(startRecordingDisposable);

  if (settings.showStatusBarButton) {
    const item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    item.name = "Voice Prompt";
    item.text = "$(mic) Voice Prompt";
    item.tooltip = "Start voice prompt recording";
    item.command = START_RECORDING_COMMAND;
    item.show();
    context.subscriptions.push(item);
  }
}

export function deactivate(): void {
  // No-op.
}

