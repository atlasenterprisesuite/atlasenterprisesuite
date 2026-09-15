import { beforeEach, describe, expect, it } from 'vitest';
import {
  markGreetingSeen,
  readGreetingSeen,
  readSpeechPreference,
  writeSpeechPreference
} from '../../apps/web/src/assistant/storage';

describe('assistant storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('defaults speech output to disabled', () => {
    expect(readSpeechPreference()).toBe(false);
  });

  it('persists explicit speech preference', () => {
    writeSpeechPreference(true);
    expect(readSpeechPreference()).toBe(true);
    writeSpeechPreference(false);
    expect(readSpeechPreference()).toBe(false);
  });

  it('marks the greeting only for the current browser session', () => {
    expect(readGreetingSeen()).toBe(false);
    markGreetingSeen();
    expect(readGreetingSeen()).toBe(true);
    expect(window.localStorage.getItem('atlas_assistant_greeted')).toBeNull();
  });
});
