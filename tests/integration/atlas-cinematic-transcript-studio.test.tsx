import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../apps/web/src/lib/creatorApi';
import { CreatorWorkspace } from '../../apps/web/src/modules/creator/CreatorStudioPage';
import { CinematicTranscriptStudio } from '../../apps/web/src/modules/creator/director/CinematicTranscriptStudio';

const captions = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nStay until sunrise.\n\n00:00:04.000 --> 00:00:06.000\nTomorrow will be different.';

describe('ATLAS Cinematic Transcript UI integration', () => {
  beforeEach(() => {
    vi.spyOn(api, 'getCreatorReadiness').mockImplementation(() => new Promise(() => {}));
    vi.spyOn(api, 'getNativeCreatorReadiness').mockImplementation(() => new Promise(() => {}));
    vi.spyOn(api, 'listCreatorProviders').mockImplementation(() => new Promise(() => {}));
    vi.spyOn(api, 'listCreativeEngines').mockImplementation(() => new Promise(() => {}));
  });
  afterEach(() => vi.restoreAllMocks());

  it('reuses the existing Creator video route and preserves ATLAS Director', () => {
    render(<MemoryRouter initialEntries={['/studio/create?type=video']}><CreatorWorkspace /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'ATLAS Director' })).toBeInTheDocument();
    const details = screen.getByText(/Open Cinematic Captions & Interactive Transcript/);
    expect(details.closest('details')).toBeInTheDocument();
    fireEvent.click(details);
    expect(screen.getByRole('region', { name: 'Cinematic Transcript Studio' })).toBeInTheDocument();
    expect(screen.getByLabelText('Local video')).toBeInTheDocument();
    expect(screen.getByLabelText('Search transcript')).toBeInTheDocument();
  });

  it('imports text only when it has real timing, makes transcript searchable, and blocks video render without media and permission', () => {
    render(<CinematicTranscriptStudio />);
    fireEvent.change(screen.getByLabelText('Paste timestamped subtitles'), { target: { value: captions } });
    fireEvent.click(screen.getByRole('button', { name: 'Import pasted timings' }));
    expect(screen.getByText(/Imported 2 timed subtitle segments locally/)).toBeInTheDocument();
    expect(screen.getByText('2 of 2 cues')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export SRT' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Render captioned video locally' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Search transcript'), { target: { value: 'sunrise' } });
    expect(screen.getByText('1 of 2 cues')).toBeInTheDocument();
    expect(screen.getByLabelText('Subtitle cue 1')).toHaveValue('Stay until sunrise.');
    expect(screen.getByRole('button', { name: /Seek to/ })).toBeDisabled();
  });

  it('fails closed on overlapping edits and untrusted markup remains literal text', () => {
    render(<CinematicTranscriptStudio />);
    fireEvent.change(screen.getByLabelText('Paste timestamped subtitles'), { target: { value: captions } });
    fireEvent.click(screen.getByRole('button', { name: 'Import pasted timings' }));
    fireEvent.change(screen.getByLabelText('End cue 1'), { target: { value: '5' } });
    expect(screen.getByRole('alert')).toHaveTextContent('caption_overlapping_or_unsorted');
    expect(screen.getByRole('button', { name: 'Export WebVTT' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Render captioned video locally' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('End cue 1'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Subtitle cue 1'), { target: { value: '<img src=x onerror=alert(1)>' } });
    expect(screen.getByLabelText('Subtitle cue 1')).toHaveValue('<img src=x onerror=alert(1)>');
    expect(document.querySelector('.cinema-studio img')).toBeNull();
  });

  it('keeps the last valid cues on a malformed import and exposes capability limits', () => {
    render(<CinematicTranscriptStudio />);
    fireEvent.change(screen.getByLabelText('Paste timestamped subtitles'), { target: { value: captions } });
    fireEvent.click(screen.getByRole('button', { name: 'Import pasted timings' }));
    fireEvent.change(screen.getByLabelText('Paste timestamped subtitles'), { target: { value: 'Untimed text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import pasted timings' }));
    expect(screen.getByText(/Import rejected/)).toBeInTheDocument();
    expect(screen.getByText('2 of 2 cues')).toBeInTheDocument();
    expect(screen.getByText(/Automatic speech-to-text is not connected/)).toBeInTheDocument();
  });
});
