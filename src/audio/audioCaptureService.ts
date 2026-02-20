import * as vscode from "vscode";
import { spawn, ChildProcess } from "node:child_process";
import { AudioChunk } from "../types/contracts";

interface CaptureOptions {
  vadEnabled: boolean;
  vadSilenceMs: number;
  vadMinSpeechMs: number;
}

export class AudioCaptureService {
  private recording = false;
  private statusBarItem?: vscode.StatusBarItem;

  constructor(private readonly options: CaptureOptions) {}

  setStatusBarItem(item: vscode.StatusBarItem): void {
    this.statusBarItem = item;
  }

  async captureOnce(): Promise<AudioChunk> {
    if (this.recording) {
      throw new Error("Already recording.");
    }

    this.recording = true;
    this.setRecordingIndicator(true);

    try {
      const pcm16 = await this.recordFromMic();
      return {
        pcm16,
        sampleRateHz: 16000,
        channels: 1,
        startedAtIso: new Date().toISOString()
      };
    } finally {
      this.recording = false;
      this.setRecordingIndicator(false);
    }
  }

  private setRecordingIndicator(active: boolean): void {
    if (!this.statusBarItem) {
      return;
    }
    if (active) {
      this.statusBarItem.text = "$(debug-stop) Recording...";
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground"
      );
    } else {
      this.statusBarItem.text = "$(mic) Voice Prompt";
      this.statusBarItem.backgroundColor = undefined;
    }
  }

  private recordFromMic(): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let proc: ChildProcess;

      try {
        proc = spawn("sox", [
          "-d",           // default audio device input
          "-t", "raw",    // output raw PCM
          "-r", "16000",  // 16 kHz sample rate
          "-c", "1",      // mono
          "-b", "16",     // 16-bit
          "-e", "signed-integer",
          "-"             // write to stdout
        ], { stdio: ["ignore", "pipe", "pipe"] });
      } catch {
        reject(new Error(
          "Failed to start audio recording. Make sure SoX is installed (brew install sox)."
        ));
        return;
      }

      proc.on("error", () => {
        reject(new Error(
          "Audio recording process failed. Make sure SoX is installed (brew install sox)."
        ));
      });

      proc.stdout?.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      let stderrData = "";
      proc.stderr?.on("data", (chunk: Buffer) => {
        stderrData += chunk.toString();
      });

      proc.on("close", (code) => {
        const pcm = Buffer.concat(chunks);
        if (pcm.length === 0 && code !== 0) {
          reject(new Error(
            `Recording failed (exit ${code}): ${stderrData.slice(0, 200)}`
          ));
          return;
        }
        resolve(pcm);
      });

      if (this.options.vadEnabled) {
        this.runVadAutoStop(proc, chunks);
      } else {
        this.runTimedStop(proc, 30_000);
      }
    });
  }

  private runVadAutoStop(proc: ChildProcess, chunks: Buffer[]): void {
    const { vadSilenceMs, vadMinSpeechMs } = this.options;
    const SAMPLE_RATE = 16000;
    const BYTES_PER_SAMPLE = 2;
    const CHECK_INTERVAL_MS = 100;
    const SILENCE_THRESHOLD = 500;

    const minSpeechBytes = (minSpeechMs: number) =>
      Math.floor((minSpeechMs / 1000) * SAMPLE_RATE * BYTES_PER_SAMPLE);

    const silenceWindowBytes = Math.floor(
      (vadSilenceMs / 1000) * SAMPLE_RATE * BYTES_PER_SAMPLE
    );

    let speechDetected = false;

    const timer = setInterval(() => {
      if (proc.killed) {
        clearInterval(timer);
        return;
      }

      const totalBytes = chunks.reduce((s, c) => s + c.length, 0);

      if (!speechDetected) {
        if (totalBytes >= minSpeechBytes(vadMinSpeechMs)) {
          const recent = this.getRecentSamples(chunks, minSpeechBytes(vadMinSpeechMs));
          if (this.rmsAmplitude(recent) > SILENCE_THRESHOLD) {
            speechDetected = true;
          }
        }
        if (totalBytes > minSpeechBytes(10000)) {
          proc.kill("SIGTERM");
          clearInterval(timer);
        }
        return;
      }

      if (totalBytes < silenceWindowBytes) {
        return;
      }

      const tail = this.getRecentSamples(chunks, silenceWindowBytes);
      const rms = this.rmsAmplitude(tail);

      if (rms < SILENCE_THRESHOLD) {
        proc.kill("SIGTERM");
        clearInterval(timer);
      }
    }, CHECK_INTERVAL_MS);

    setTimeout(() => {
      clearInterval(timer);
      if (!proc.killed) {
        proc.kill("SIGTERM");
      }
    }, 60_000);
  }

  private runTimedStop(proc: ChildProcess, durationMs: number): void {
    setTimeout(() => {
      if (!proc.killed) {
        proc.kill("SIGTERM");
      }
    }, durationMs);
  }

  private getRecentSamples(chunks: Buffer[], byteCount: number): Buffer {
    const all = Buffer.concat(chunks);
    if (all.length <= byteCount) {
      return all;
    }
    return all.subarray(all.length - byteCount);
  }

  private rmsAmplitude(pcm16: Buffer): number {
    const sampleCount = Math.floor(pcm16.length / 2);
    if (sampleCount === 0) {
      return 0;
    }
    let sumSquares = 0;
    for (let i = 0; i < sampleCount; i++) {
      const sample = pcm16.readInt16LE(i * 2);
      sumSquares += sample * sample;
    }
    return Math.sqrt(sumSquares / sampleCount);
  }
}
