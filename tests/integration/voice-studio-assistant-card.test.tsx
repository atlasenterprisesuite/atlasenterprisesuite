import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { VoiceStudioPage } from '../../apps/web/src/modules/voice/VoiceStudioPage';

describe('ATLAS Voice Studio assistant identity', () => {
  it('shows the canonical assistant identity without weakening capability warnings', () => {
    render(<MemoryRouter><VoiceStudioPage /></MemoryRouter>);
    expect(screen.getByText('ATLAS Assistant')).toBeInTheDocument();
    expect(screen.getByText(/same authenticated assistant identity/i)).toBeInTheDocument();
    expect(screen.getByText(/does not claim access to Apple-native Personal Voice APIs/i)).toBeInTheDocument();
    expect(screen.getByText(/not represented as connected until a real provider/i)).toBeInTheDocument();
  });
});
