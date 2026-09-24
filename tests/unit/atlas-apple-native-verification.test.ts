import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const types = () => readFileSync('native/apple-personal-voice-bridge/Sources/AtlasAppleVoiceBridge/AppleVoiceTypes.swift', 'utf8');
const system = () => readFileSync('native/apple-personal-voice-bridge/Sources/AtlasAppleVoiceBridge/SystemAppleSpeechSystem.swift', 'utf8');
const verifier = () => readFileSync('native/apple-personal-voice-bridge/Sources/AtlasAppleVoiceBridge/ApplePersonalVoiceVerification.swift', 'utf8');
const workflow = () => readFileSync('.github/workflows/apple-personal-voice-bridge-ci.yml', 'utf8');

describe('ATLAS Apple Personal Voice native verification contract', () => {
  it('declares local playback only and keeps export/server/telephony disabled', () => {
    const text = types();
    expect(text).toContain('localPlayback: true');
    expect(text).toContain('audioExport: false');
    expect(text).toContain('realtimeStream: false');
    expect(text).toContain('telephony: false');
    expect(text).toContain('serverSynthesis: false');
  });

  it('uses Apple Personal Voice APIs without audio export callbacks', () => {
    const text = system();
    expect(text).toContain('AVSpeechSynthesizer.personalVoiceAuthorizationStatus');
    expect(text).toContain('AVSpeechSynthesizer.requestPersonalVoiceAuthorization');
    expect(text).toContain('.isPersonalVoice');
    expect(text).toContain('synthesizer.speak');
    expect(text).not.toContain('write(');
    expect(text).not.toContain('toBufferCallback');
  });

  it('creates metadata-only native verification evidence', () => {
    const text = verifier();
    expect(text).toContain('ApplePersonalVoiceVerificationReport');
    expect(text).toContain('authorization');
    expect(text).toContain('personalVoiceCount');
    expect(text).toContain('localPlaybackVerified');
    expect(text).not.toContain('audioData');
    expect(text).not.toContain('audioBytes');
  });

  it('runs macOS tests/build and compiles against the iOS SDK', () => {
    const text = workflow();
    expect(text).toContain('runs-on: macos-latest');
    expect(text).toContain('swift test');
    expect(text).toContain('swift build');
    expect(text).toContain('generic/platform=iOS Simulator');
    expect(text).toContain('CODE_SIGNING_ALLOWED=NO');
  });
});
