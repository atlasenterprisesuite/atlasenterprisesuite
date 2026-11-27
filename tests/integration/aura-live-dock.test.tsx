import {render,screen,fireEvent,waitFor,act,cleanup} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
import {AuraLiveDock} from '../../apps/web/src/work/AuraLiveDock';
const mocks=vi.hoisted(()=>({token:vi.fn(),org:vi.fn(),list:vi.fn()}));
vi.mock('../../apps/web/src/lib/atlasSession',()=>({ATLAS_SESSION_EVENT:'atlas-session-changed',getAtlasAccessToken:mocks.token,getActiveAtlasOrganization:mocks.org}));
vi.mock('../../apps/web/src/work/api',()=>({listWorkflows:mocks.list}));
beforeEach(()=>{vi.resetAllMocks();mocks.token.mockReturnValue('synthetic');mocks.org.mockResolvedValue({id:'a'});mocks.list.mockResolvedValue([{organizationId:'a',status:'running'},{organizationId:'b',status:'running'}]);});
describe('AURA dock',()=>{
 it('does not expose controls without a session',()=>{mocks.token.mockReturnValue('');render(<MemoryRouter><AuraLiveDock/></MemoryRouter>);expect(screen.queryByRole('complementary')).toBeNull();});
 it('counts scoped workflows and clears on logout',async()=>{render(<MemoryRouter><AuraLiveDock/></MemoryRouter>);fireEvent.click(screen.getByRole('button',{name:/AURA LIVE/}));fireEvent.click(screen.getByRole('button',{name:'Synchronize workflows'}));await screen.findByText('Visible workflows: 1');mocks.token.mockReturnValue('');act(()=>window.dispatchEvent(new Event('atlas-session-changed')));expect(screen.queryByText('Visible workflows: 1')).toBeNull();});
 it('rejects late responses after session invalidation',async()=>{let resolve!: (v:unknown)=>void;mocks.list.mockReturnValue(new Promise(r=>{resolve=r;}));render(<MemoryRouter><AuraLiveDock/></MemoryRouter>);fireEvent.click(screen.getByRole('button',{name:/AURA LIVE/}));fireEvent.click(screen.getByRole('button',{name:'Synchronize workflows'}));await waitFor(()=>expect(mocks.list).toHaveBeenCalled());act(()=>window.dispatchEvent(new Event('atlas-session-changed')));await act(async()=>resolve([{organizationId:'a',status:'running'}]));expect(screen.queryByText('Visible workflows: 1')).toBeNull();});
});

afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();});
it('polls every 30 seconds only while visible and open',async()=>{
 vi.useFakeTimers();
 const visibility=vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
 render(<MemoryRouter><AuraLiveDock/></MemoryRouter>);
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:/AURA LIVE/}));});
 expect(mocks.list).toHaveBeenCalledTimes(1);
 await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});
 expect(mocks.list).toHaveBeenCalledTimes(2);
 visibility.mockReturnValue('hidden');
 await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});
 expect(mocks.list).toHaveBeenCalledTimes(2);
 fireEvent.click(screen.getByRole('button',{name:/AURA LIVE/}));
 await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});
 expect(mocks.list).toHaveBeenCalledTimes(2);
});
it('does not overlap a pending poll',async()=>{
 vi.useFakeTimers();vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
 let resolve!: (v:unknown)=>void;
 mocks.list.mockReturnValue(new Promise(r=>{resolve=r;}));
 render(<MemoryRouter><AuraLiveDock/></MemoryRouter>);
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:/AURA LIVE/}));});
 await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});
 expect(mocks.list).toHaveBeenCalledTimes(1);
 await act(async()=>resolve([]));
});
