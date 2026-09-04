import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../apps/web/src/App';

const modules: [string, string][] = [
  ['enterprise-os', 'Enterprise OS'], ['health-intelligence', 'Health Intelligence'], ['patient-experience', 'Patient Experience'],
  ['clinical-operations', 'Clinical Operations'], ['finance-revenue', 'Finance & Revenue'], ['hr-workforce', 'HR & Workforce'],
  ['smart-care', 'Smart Care'], ['pharmacy-4', 'Pharmacy 4.0'], ['supply-chain', 'Supply Chain'], ['ai-analytics', 'AI & Analytics'],
  ['community-impact', 'Community Impact'], ['voice-assistant', 'Voice & Virtual Assistant'], ['cleanscan-3d', 'CleanScan 3D'],
  ['smart-facilities', 'Smart Facilities'], ['energy-sustainability', 'Energy & Sustainability'], ['safety-security', 'Safety & Security'],
  ['public-health-watch', 'Public Health Watch']
];

for (const [id, heading] of modules) {
  test(`renders ${heading}`, async () => {
    render(<MemoryRouter initialEntries={[`/health/operations/modules/${id}`]}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });
}

test('search filters smart facilities records and tabs switch', async () => {
  render(<MemoryRouter initialEntries={['/health/operations/modules/smart-facilities']}><App /></MemoryRouter>);
  const search = await screen.findByRole('searchbox', { name: 'Search records' });
  fireEvent.change(search, { target: { value: 'MRI' } });
  fireEvent.click(screen.getByRole('tab', { name: 'Data' }));
  expect(screen.getByText('MRI cooling inspection')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Permissions' }));
  expect(screen.getByText('health.facilities.read')).toBeInTheDocument();
});

test('operator demo mutation creates success feedback and audit event', async () => {
  render(<MemoryRouter initialEntries={['/health/operations/modules/smart-facilities']}><App /></MemoryRouter>);
  fireEvent.change(await screen.findByDisplayValue('Viewer'), { target: { value: 'operator' } });
  fireEvent.click(screen.getByRole('tab', { name: 'Workflows' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close first open demo record' }));
  expect(screen.getByText('Status updated in demo adapter.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Audit' }));
  expect(screen.getByText('health.record.status.update')).toBeInTheDocument();
});
