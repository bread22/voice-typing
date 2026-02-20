# Voice Prompt (Cursor Extension)

Voice Prompt captures voice input, transcribes it, rewrites it into a clean coding prompt, and inserts it into the active input/editor target.

## Current MVP behavior

- Command: `Voice Prompt: Start Recording`
- Keybinding: `cmd+shift+v` (macOS)
- Status bar button: `$(mic) Voice Prompt`
- Rewrite backends:
  - Local Ollama (default)
  - Cloud OpenAI-compatible endpoint (optional fallback)
- API keys are stored in VS Code/Cursor `SecretStorage`

Note: microphone capture is currently implemented with a temporary input-box fallback while local audio/VAD capture is being finalized.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Build:

```bash
npm run build
```

3. Run tests:

```bash
npm test
```

## Key settings

- `voicePrompt.stt.provider`
- `voicePrompt.stt.model`
- `voicePrompt.stt.localEndpoint`
- `voicePrompt.stt.timeoutMs`
- `voicePrompt.rewrite.provider`
- `voicePrompt.rewrite.model`
- `voicePrompt.rewrite.ollamaBaseUrl`
- `voicePrompt.rewrite.cloudBaseUrl`
- `voicePrompt.rewrite.timeoutMs`
- `voicePrompt.rewrite.style`
- `voicePrompt.previewBeforeInsert`
- `voicePrompt.autoFallbackToCloud`
- `voicePrompt.noRewriteBehavior`
- `voicePrompt.showStatusBarButton`
- `voicePrompt.vad.enabled`
- `voicePrompt.vad.silenceMs`
- `voicePrompt.vad.minSpeechMs`

## Cloud key command

Run `Voice Prompt: Set Cloud API Key` to save the cloud API key in secure storage.

