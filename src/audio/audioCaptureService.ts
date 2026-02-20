import { AudioChunk } from "../types/contracts";
import * as vscode from "vscode";

export class AudioCaptureService {
  async captureOnce(): Promise<AudioChunk> {
    // Temporary fallback path while microphone capture implementation is pending.
    const spokenText = await vscode.window.showInputBox({
      title: "Voice Prompt Input (MVP fallback)",
      prompt: "Enter spoken text until microphone capture is wired",
      ignoreFocusOut: true
    });

    if (!spokenText) {
      return {
        pcm16: Buffer.alloc(0),
        sampleRateHz: 16000,
        channels: 1,
        startedAtIso: new Date().toISOString()
      };
    }

    return {
      pcm16: Buffer.alloc(0),
      sampleRateHz: 16000,
      channels: 1,
      startedAtIso: new Date().toISOString(),
      debugTranscript: spokenText
    };
  }
}

