const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const Module = require("node:module");

// Provide a minimal vscode mock so dist modules can be required outside VS Code
const vscodeMock = {
  window: {
    showInputBox: async () => undefined,
    showWarningMessage: async () => undefined,
    showErrorMessage: async () => undefined,
    showInformationMessage: async () => undefined,
    setStatusBarMessage: () => ({ dispose() {} }),
    createStatusBarItem: () => ({
      show() {},
      dispose() {},
      text: "",
      tooltip: "",
      command: "",
      name: "",
      backgroundColor: undefined
    }),
    activeTextEditor: undefined
  },
  workspace: {
    getConfiguration: () => ({
      get: (_key, defaultVal) => defaultVal
    })
  },
  commands: {
    executeCommand: async () => undefined,
    registerCommand: () => ({ dispose() {} })
  },
  env: {
    clipboard: { writeText: async () => undefined }
  },
  StatusBarAlignment: { Right: 2 },
  ThemeColor: class ThemeColor { constructor() {} },
  SecretStorage: class SecretStorage {}
};

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === "vscode") {
    return "vscode";
  }
  return originalResolve.call(this, request, parent, ...rest);
};
require.cache["vscode"] = {
  id: "vscode",
  filename: "vscode",
  loaded: true,
  exports: vscodeMock
};

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    process.stdout.write(`  PASS  ${name}\n`);
  } catch (err) {
    failed++;
    process.stderr.write(`  FAIL  ${name}\n    ${err.message}\n`);
  }
}

function loadPackageJson() {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
  );
}

function loadDistModule(relativePath) {
  return require(path.join(__dirname, "..", "dist", relativePath));
}

function run() {
  process.stdout.write("\n=== Voice Prompt Extension Tests ===\n\n");

  const pkg = loadPackageJson();
  const props = pkg.contributes?.configuration?.properties ?? {};
  const commands = pkg.contributes?.commands ?? [];

  // --- Package.json manifest tests ---

  test("has startRecording command", () => {
    assert.ok(commands.some((c) => c.command === "voicePrompt.startRecording"));
  });

  test("has setCloudApiKey command", () => {
    assert.ok(commands.some((c) => c.command === "voicePrompt.setCloudApiKey"));
  });

  test("has keybinding for startRecording", () => {
    const kb = pkg.contributes?.keybindings ?? [];
    assert.ok(kb.some((k) => k.command === "voicePrompt.startRecording"));
  });

  test("vad.enabled defaults to true", () => {
    assert.equal(props["voicePrompt.vad.enabled"]?.default, true);
  });

  test("vad.silenceMs defaults to 900", () => {
    assert.equal(props["voicePrompt.vad.silenceMs"]?.default, 900);
  });

  test("vad.minSpeechMs defaults to 300", () => {
    assert.equal(props["voicePrompt.vad.minSpeechMs"]?.default, 300);
  });

  test("showStatusBarButton defaults to true", () => {
    assert.equal(props["voicePrompt.showStatusBarButton"]?.default, true);
  });

  test("noRewriteBehavior defaults to stt_passthrough", () => {
    assert.equal(props["voicePrompt.noRewriteBehavior"]?.default, "stt_passthrough");
  });

  test("previewBeforeInsert defaults to false", () => {
    assert.equal(props["voicePrompt.previewBeforeInsert"]?.default, false);
  });

  test("rewrite.provider default is ollama", () => {
    assert.equal(props["voicePrompt.rewrite.provider"]?.default, "ollama");
  });

  test("stt.provider default is local", () => {
    assert.equal(props["voicePrompt.stt.provider"]?.default, "local");
  });

  test("rewrite.style default is engineering", () => {
    assert.equal(props["voicePrompt.rewrite.style"]?.default, "engineering");
  });

  test("autoFallbackToCloud defaults to false", () => {
    assert.equal(props["voicePrompt.autoFallbackToCloud"]?.default, false);
  });

  // --- Source module structure tests ---

  test("dist/extension.js exists and exports activate", () => {
    const ext = loadDistModule("extension");
    assert.equal(typeof ext.activate, "function");
    assert.equal(typeof ext.deactivate, "function");
  });

  test("dist/types/contracts.js exists", () => {
    const contracts = loadDistModule("types/contracts");
    assert.ok(contracts);
  });

  test("dist/config/settings.js exports readSettings", () => {
    const settings = loadDistModule("config/settings");
    assert.equal(typeof settings.readSettings, "function");
  });

  test("dist/config/secrets.js exports SecretsManager", () => {
    const secrets = loadDistModule("config/secrets");
    assert.equal(typeof secrets.SecretsManager, "function");
  });

  test("dist/audio/audioCaptureService.js exports AudioCaptureService", () => {
    const audio = loadDistModule("audio/audioCaptureService");
    assert.equal(typeof audio.AudioCaptureService, "function");
  });

  test("dist/stt/localSttProvider.js exports LocalSttProvider", () => {
    const stt = loadDistModule("stt/localSttProvider");
    assert.equal(typeof stt.LocalSttProvider, "function");
  });

  test("dist/rewrite/ollamaRewriteProvider.js exports OllamaRewriteProvider", () => {
    const rewrite = loadDistModule("rewrite/ollamaRewriteProvider");
    assert.equal(typeof rewrite.OllamaRewriteProvider, "function");
  });

  test("dist/rewrite/cloudRewriteProvider.js exports CloudRewriteProvider", () => {
    const rewrite = loadDistModule("rewrite/cloudRewriteProvider");
    assert.equal(typeof rewrite.CloudRewriteProvider, "function");
  });

  test("dist/inject/cursorInputInjector.js exports CursorInputInjector", () => {
    const inject = loadDistModule("inject/cursorInputInjector");
    assert.equal(typeof inject.CursorInputInjector, "function");
  });

  test("dist/orchestration/voicePromptOrchestrator.js exports VoicePromptOrchestrator", () => {
    const orch = loadDistModule("orchestration/voicePromptOrchestrator");
    assert.equal(typeof orch.VoicePromptOrchestrator, "function");
  });

  // --- Provider contract interface tests ---

  test("LocalSttProvider implements transcribe method", () => {
    const { LocalSttProvider } = loadDistModule("stt/localSttProvider");
    const provider = new LocalSttProvider({
      endpoint: "http://127.0.0.1:0/test",
      model: "test",
      timeoutMs: 1000
    });
    assert.equal(typeof provider.transcribe, "function");
  });

  test("OllamaRewriteProvider implements rewrite method", () => {
    const { OllamaRewriteProvider } = loadDistModule("rewrite/ollamaRewriteProvider");
    const provider = new OllamaRewriteProvider({
      baseUrl: "http://127.0.0.1:0",
      model: "test",
      timeoutMs: 1000
    });
    assert.equal(typeof provider.rewrite, "function");
  });

  test("CloudRewriteProvider implements rewrite method", () => {
    const { CloudRewriteProvider } = loadDistModule("rewrite/cloudRewriteProvider");
    const provider = new CloudRewriteProvider({
      apiUrl: "http://127.0.0.1:0",
      model: "test",
      apiKey: "test-key",
      timeoutMs: 1000
    });
    assert.equal(typeof provider.rewrite, "function");
  });

  // --- STT sidecar file tests ---

  test("stt-server/server.py exists", () => {
    const serverPath = path.join(__dirname, "..", "stt-server", "server.py");
    assert.ok(fs.existsSync(serverPath), "stt-server/server.py is missing");
  });

  test("stt-server/requirements.txt exists", () => {
    const reqPath = path.join(__dirname, "..", "stt-server", "requirements.txt");
    assert.ok(fs.existsSync(reqPath), "stt-server/requirements.txt is missing");
  });

  // --- Summary ---

  process.stdout.write(`\n${passed} passed, ${failed} failed\n\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

run();
