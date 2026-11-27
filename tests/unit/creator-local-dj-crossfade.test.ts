import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalCrossfadeSession } from '../../apps/web/src/modules/creator/music/LocalDJMixPage';

class StubAudio {
  static created: StubAudio[] = [];
  preload = '';
  volume = 1;
  ended = false;
  duration = 60;
  currentTime = 0;
  readonly pause = vi.fn();
  constructor(readonly src: string) {
    StubAudio.created.push(this);
  }
  play(): Promise<void> { return Promise.resolve(); }
}

const tracks = ['one', 'two'].map(id => ({
  id,
  title: id,
  file: {} as File,
  url: `blob:atlas-${id}`,
  bpm: null,
  camelot: null,
  audioDNA: null
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  StubAudio.created = [];
});

describe('ATLAS Local DJ crossfade playback lifecycle', () => {
  it('starts an already-ended successor at full volume without silent fade-in', async () => {
    vi.stubGlobal('Audio', StubAudio);
    const report = vi.fn();
    const session = new LocalCrossfadeSession(tracks, 6, report);
    try {
      await session.start();
      expect(StubAudio.created).toHaveLength(1);
      StubAudio.created[0].ended = true;
      await session.next();
      expect(StubAudio.created).toHaveLength(2);
      expect(StubAudio.created[1].volume).toBe(1);
      expect(report).toHaveBeenLastCalledWith(1, 'playing', expect.stringContaining('immediately'));
    } finally {
      session.stop();
    }
  });

  it('prepares a zero-volume incoming track when the old track is still playing', async () => {
    vi.stubGlobal('Audio', StubAudio);
    const session = new LocalCrossfadeSession(tracks, 6, vi.fn());
    try {
      await session.start();
      await session.next();
      expect(StubAudio.created[1].volume).toBe(0);
    } finally {
      session.stop();
    }
  });

  it('does not report a playback failure if Stop rejects the pending browser play promise', async () => {
    vi.stubGlobal('Audio', StubAudio);
    let rejectPlayback: (reason?: unknown) => void = () => {};
    vi.spyOn(StubAudio.prototype, 'play').mockImplementation(
      () => new Promise<void>((_resolve, reject) => { rejectPlayback = reject; })
    );
    const report = vi.fn();
    const session = new LocalCrossfadeSession(tracks, 6, report);
    const pending = session.start();
    session.stop();
    rejectPlayback(new Error('The play() request was interrupted'));
    await pending;
    expect(report).not.toHaveBeenCalled();
  });
});

describe('ATLAS playback generation isolation', () => {
  it('pauses a pending successor immediately on stop and ignores its stale completion', async () => {
    vi.stubGlobal('Audio', StubAudio);
    const report = vi.fn();
    const session = new LocalCrossfadeSession(tracks, 6, report);
    let resolveNext: () => void = () => {};
    try {
      await session.start();
      vi.spyOn(StubAudio.prototype, 'play').mockImplementationOnce(
        () => new Promise<void>(resolve => { resolveNext = resolve; })
      );
      const pending = session.next();
      const successor = StubAudio.created[1];
      session.stop();
      expect(successor.pause).toHaveBeenCalled();
      report.mockClear();
      await session.start();
      resolveNext();
      await pending;
      expect(report).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenLastCalledWith(0, 'playing', expect.any(String));
      expect(StubAudio.created[2].pause).not.toHaveBeenCalled();
    } finally {
      session.stop();
    }
  });

  it('ignores an older initial play rejection after a new start', async () => {
    vi.stubGlobal('Audio', StubAudio);
    const report = vi.fn();
    const session = new LocalCrossfadeSession(tracks, 6, report);
    let rejectOld: (reason?: unknown) => void = () => {};
    vi.spyOn(StubAudio.prototype, 'play').mockImplementationOnce(
      () => new Promise<void>((_resolve, reject) => { rejectOld = reject; })
    );
    try {
      const old = session.start();
      await session.start();
      rejectOld(new Error('interrupted'));
      await old;
      expect(report).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenLastCalledWith(0, 'playing', expect.any(String));
      expect(StubAudio.created[1].pause).not.toHaveBeenCalled();
    } finally {
      session.stop();
    }
  });
});
