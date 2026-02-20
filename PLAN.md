# Voice Prompt Plugin Implementation Plan

This plan is derived from `CLAUDE.md` and is organized into commit-sized milestones.

## Milestone 1 - Project bootstrap and extension skeleton

- [x] Create TypeScript VS Code/Cursor extension scaffold
- [x] Add required folder layout:
  - `src/extension.ts`
  - `src/audio/`
  - `src/stt/`
  - `src/rewrite/`
  - `src/inject/`
  - `src/config/`
  - `src/types/`
  - `test/`
- [x] Register command `Voice Prompt: Start Recording`
- [x] Add keybinding and status bar entry point

## Milestone 2 - Core contracts, config, and orchestration path

- [x] Define provider contracts:
  - `ISttProvider.transcribe(audio)`
  - `IRewriteProvider.rewrite(input)`
  - `IInputInjector.insert(text)`
- [x] Implement config defaults from requirements:
  - `voicePrompt.vad.enabled=true`
  - `voicePrompt.vad.silenceMs=900`
  - `voicePrompt.vad.minSpeechMs=300`
  - `voicePrompt.showStatusBarButton=true`
  - `voicePrompt.noRewriteBehavior=stt_passthrough`
  - `voicePrompt.previewBeforeInsert=false`
- [x] Wire command flow:
  - capture -> STT -> rewrite -> optional preview -> inject

## Milestone 3 - Local providers (MVP path)

- [~] Implement `AudioCaptureService` with press-to-start flow (input fallback currently)
- [x] Implement local STT adapter interface with pluggable backend hook
- [x] Implement `OllamaRewriteProvider` using required rewrite instruction
- [x] Implement `CursorInputInjector` with extension command based insert
- [x] Ensure fallback behavior to STT passthrough when rewrite fails

## Milestone 4 - Reliability, cloud fallback, and UX rules

- [x] Add cloud rewrite adapter and secret-backed API key retrieval
- [x] Add timeout handling for STT/rewrite
- [x] Add no-backend handling and one-time warning behavior
- [x] Add injection-failure fallback (clipboard + notification)
- [x] Keep logging minimal and avoid transcript/audio persistence by default

## Milestone 5 - Tests and docs

- [~] Add unit tests for orchestration and fallback policies (baseline config/command tests added)
- [ ] Add provider tests (local/cloud rewrite routing)
- [x] Add README usage and setup notes
- [ ] Validate against MVP acceptance criteria checklist

## Commit strategy

1. `docs: add implementation plan from requirements`
2. `feat: scaffold cursor voice prompt extension`
3. `feat: add core contracts config and orchestrator`
4. `feat: implement local stt rewrite and injection pipeline`
5. `feat: add cloud fallback timeout and reliability handling`
6. `test: add orchestration and provider tests`

