import {act, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {TenantGate} from './TenantGate';

const state = vi.hoisted(() => ({user: {id:'u1', tenant:{id:'a',slug:'alpha'}} as {id:string;tenant:{id:string;slug:string}} | null, refresh:vi.fn(), switch:vi.fn()}));
vi.mock('../../contexts/AuthContext', () => ({useAuth: () => ({user:state.user,refreshProfile:state.refresh})}));
vi.mock('../../contexts/TenantContext', () => ({useTenantContext: () => ({switchTenant:state.switch})}));
function setup(path='/t/alpha/') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/t/:tenantSlug/*" element={<TenantGate />}><Route path="*" element={<div>Private content</div>} /></Route><Route path="/t" element={<TenantGate />} /><Route path="/choose-tenant" element={<div>Choose community</div>} /><Route path="/login" element={<div>Login</div>} /></Routes></MemoryRouter>);
}
beforeEach(() => {vi.clearAllMocks();state.user={id:'u1',tenant:{id:'a',slug:'alpha'}};state.switch.mockResolvedValue({ok:true,tenant:{tenant_id:'a',tenant_slug:'alpha'}});state.refresh.mockResolvedValue(state.user);});
describe('TenantGate verified context', () => {
  it('redirects missing community to the chooser', async () => {setup('/t');expect(await screen.findByText('Choose community')).toBeVisible();expect(state.switch).not.toHaveBeenCalled();});
  it('does not switch before authentication', () => {state.user=null;setup();expect(screen.getByText('Открываем сообщество')).toBeVisible();expect(state.switch).not.toHaveBeenCalled();});
  it('waits for refreshed permissions before showing content', async () => {
    let resolve!: (v:unknown)=>void;state.refresh.mockReturnValue(new Promise(r=>{resolve=r;}));setup();
    await waitFor(()=>expect(state.refresh).toHaveBeenCalled());expect(screen.queryByText('Private content')).not.toBeInTheDocument();
    await act(async()=>resolve(state.user));expect(await screen.findByText('Private content')).toBeVisible();expect(state.switch).toHaveBeenCalledWith('alpha');
  });
  it('verifies an already selected community with the server', async()=>{setup();expect(await screen.findByText('Private content')).toBeVisible();expect(state.switch).toHaveBeenCalledTimes(1);});
  it.each(['forbidden','unavailable','conflict'])('distinguishes %s and never mounts private content',async(reason)=>{
    state.switch.mockResolvedValue({ok:false,reason,message:'Reason from server'});setup();expect(await screen.findByText('Reason from server')).toBeVisible();expect(screen.queryByText('Private content')).not.toBeInTheDocument();expect(state.refresh).not.toHaveBeenCalled();
    if(reason==='forbidden') expect(screen.queryByRole('button',{name:'Повторить'})).not.toBeInTheDocument();
    else expect(screen.getByRole('button',{name:'Повторить'})).toBeVisible();
  });
  it('sends an expired session to login',async()=>{state.switch.mockResolvedValue({ok:false,reason:'unauthenticated'});setup();expect(await screen.findByText('Login')).toBeVisible();});
  it.each([null,{id:'u1',tenant:{id:'b',slug:'beta'}}])('blocks a missing or mismatched refreshed context',async(profile)=>{state.refresh.mockResolvedValue(profile);setup();expect(await screen.findByText('Не удалось открыть сообщество')).toBeVisible();expect(screen.queryByText('Private content')).not.toBeInTheDocument();});
  it('can recover from refresh failure without pretending access was denied',async()=>{state.refresh.mockRejectedValueOnce(new Error('network'));setup();await userEvent.click(await screen.findByRole('button',{name:'Повторить'}));expect(await screen.findByText('Private content')).toBeVisible();});
  it('offers a working way back after access rejection',async()=>{state.switch.mockResolvedValue({ok:false,reason:'forbidden'});setup();await userEvent.click(await screen.findByRole('button',{name:'Мои сообщества'}));expect(await screen.findByText('Choose community')).toBeVisible();});
});
