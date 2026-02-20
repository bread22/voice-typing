import * as vscode from "vscode";
import { AudioCaptureService } from "./audio/audioCaptureService";
import { SecretsManager } from "./config/secrets";
import { readSettings } from "./config/settings";
import { CursorInputInjector } from "./inject/cursorInputInjector";
import { VoicePromptOrchestrator } from "./orchestration/voicePromptOrchestrator";
import { CloudRewriteProvider } from "./rewrite/cloudRewriteProvider";
import { OllamaRewriteProvider } from "./rewrite/ollamaRewriteProvider";
import { LocalSttProvider } from "./stt/localSttProvider";

const START_RECORDING_COMMAND = "voicePrompt.startRecording";

export function activate(context: vscode.ExtensionContext): void {
  const settings = readSettings();
  const secrets = new SecretsManager(context.secrets);

  const audioCapture = new AudioCaptureService({
    vadEnabled: settings.vadEnabled,
    vadSilenceMs: settings.vadSilenceMs,
    vadMinSpeechMs: settings.vadMinSpeechMs
  });

  const baseOllamaProvider =
    settings.rewriteProvider === "none"
      ? undefined
      : new OllamaRewriteProvider({
          baseUrl: settings.rewriteOllamaBaseUrl,
          model: settings.rewriteModel,
          timeoutMs: settings.rewriteTimeoutMs
        });

  const cloudRewriteProviderFactory = async (): Promise<
    CloudRewriteProvider | undefined
  > => {
    const key = await secrets.getCloudApiKey();
    if (!key) {
      return undefined;
    }
    return new CloudRewriteProvider({
      apiUrl: settings.rewriteCloudBaseUrl,
      model: settings.rewriteModel,
      apiKey: key,
      timeoutMs: settings.rewriteTimeoutMs
    });
  };

  const orchestrator = new VoicePromptOrchestrator({
    settings,
    audioCapture,
    sttProvider: new LocalSttProvider({
      endpoint: settings.sttLocalEndpoint,
      model: settings.sttModel,
      timeoutMs: settings.sttTimeoutMs
    }),
    rewriteProvider:
      settings.rewriteProvider === "cloud" ? undefined : baseOllamaProvider,
    cloudRewriteProvider: undefined,
    inputInjector: new CursorInputInjector()
  });

  const startRecordingDisposable = vscode.commands.registerCommand(
    START_RECORDING_COMMAND,
    async () => {
      try {
        const cloudProvider = await cloudRewriteProviderFactory();
        const primaryRewriteProvider =
          settings.rewriteProvider === "cloud" ? cloudProvider : baseOllamaProvider;
        const fallbackCloudProvider =
          settings.rewriteProvider === "cloud" ? undefined : cloudProvider;

        if (settings.rewriteProvider === "cloud" && !cloudProvider) {
          void vscode.window.showWarningMessage(
            "Cloud API key missing. Run 'Voice Prompt: Set Cloud API Key'."
          );
        }
        orchestrator.setRewriteProviders(
          primaryRewriteProvider,
          fallbackCloudProvider
        );

        await orchestrator.runOnce();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`Voice Prompt failed: ${message}`);
      }
    }
  );
  context.subscriptions.push(startRecordingDisposable);

  const setCloudApiKeyDisposable = vscode.commands.registerCommand(
    "voicePrompt.setCloudApiKey",
    async () => {
      const apiKey = await vscode.window.showInputBox({
        title: "Voice Prompt Cloud API Key",
        prompt: "Paste API key for cloud rewrite provider",
        password: true,
        ignoreFocusOut: true
      });
      if (!apiKey) {
        return;
      }
      await secrets.setCloudApiKey(apiKey);
      void vscode.window.showInformationMessage("Cloud API key saved securely.");
    }
  );
  context.subscriptions.push(setCloudApiKeyDisposable);

  if (settings.showStatusBarButton) {
    const item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    item.name = "Voice Prompt";
    item.text = "$(mic) Voice Prompt";
    item.tooltip = "Start voice prompt recording (Cmd+Shift+V)";
    item.command = START_RECORDING_COMMAND;
    item.show();
    context.subscriptions.push(item);

    audioCapture.setStatusBarItem(item);
  }
}

export function deactivate(): void {
  // No-op.
}
