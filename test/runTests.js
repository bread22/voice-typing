const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

function loadPackageJson() {
  const packageJsonPath = path.join(__dirname, "..", "package.json");
  return JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
}

function testRequiredCommand(pkg) {
  const commands = pkg.contributes?.commands ?? [];
  const hasStartCommand = commands.some(
    (c) => c.command === "voicePrompt.startRecording"
  );
  assert.equal(hasStartCommand, true, "start recording command must exist");
}

function testDefaultSettings(pkg) {
  const p = pkg.contributes?.configuration?.properties ?? {};

  assert.equal(p["voicePrompt.vad.enabled"]?.default, true);
  assert.equal(p["voicePrompt.vad.silenceMs"]?.default, 900);
  assert.equal(p["voicePrompt.vad.minSpeechMs"]?.default, 300);
  assert.equal(p["voicePrompt.showStatusBarButton"]?.default, true);
  assert.equal(p["voicePrompt.noRewriteBehavior"]?.default, "stt_passthrough");
  assert.equal(p["voicePrompt.previewBeforeInsert"]?.default, false);
}

function run() {
  const pkg = loadPackageJson();
  testRequiredCommand(pkg);
  testDefaultSettings(pkg);
  process.stdout.write("All tests passed.\n");
}

run();

