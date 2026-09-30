import type {ComponentProps} from 'react';
import {ThemeProvider} from '@gravity-ui/uikit';
import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter,useLocation} from 'react-router-dom';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {TenantSwitcher} from './TenantSwitcher';
import type {TenantSummary} from '../api/tenant';
const tenants:TenantSummary[]=[{tenant_id:'a',tenant_slug:'alpha',display_name:'Альфа',status:'active',base_role:'member'},{tenant_id:'b',tenant_slug:'beta',display_name:'Бета',status:'active',base_role:'member'}];
const state=vi.hoisted(()=>({tenants:[] as TenantSummary[]}));
vi.mock('../contexts/TenantContext',()=>({useTenantContext:()=>({activeTenant:state.tenants[0]??null,availableTenants:state.tenants})}));
function Location(){return <output>{useLocation().pathname}</output>;}
function setup(){render(<MemoryRouter initialEntries={['/t/alpha/']}><ThemeProvider theme="light"><TenantSwitcher/></ThemeProvider><Location/></MemoryRouter>);}
beforeEach(()=>{state.tenants=[...tenants];});
describe('TenantSwitcher',()=>{
 it.each([0,1,2])('offers all communities with %i memberships',async(n)=>{state.tenants=tenants.slice(0,n);setup();await userEvent.click(screen.getByRole('button',{name:'Все сообщества'}));expect(screen.getByText('/choose-tenant')).toBeVisible();});
 it('navigates to the new overview, letting the gate verify access',async()=>{setup();await userEvent.click(screen.getByRole('combobox'));await userEvent.click(await screen.findByRole('option',{name:'Бета'}));expect(screen.getByText('/t/beta/')).toBeVisible();});
 it('does not carry an old object id into another community',async()=>{render(<MemoryRouter initialEntries={['/t/alpha/events/old-object']}><ThemeProvider theme="light"><TenantSwitcher/></ThemeProvider><Location/></MemoryRouter>);await userEvent.click(screen.getByRole('combobox'));await userEvent.click(await screen.findByRole('option',{name:'Бета'}));expect(screen.getByText('/t/beta/')).toBeVisible();});
 it('supports keyboard selection and closing',async()=>{setup();screen.getByRole('combobox').focus();await userEvent.keyboard('{Enter}{ArrowDown}{Enter}');await waitFor(()=>expect(screen.getByText('/t/beta/')).toBeVisible());});
 it('disables inactive membership',async()=>{state.tenants=[tenants[0],{...tenants[1],status:'invited'}];setup();await userEvent.click(screen.getByRole('combobox'));expect(await screen.findByRole('option',{name:'Бета'})).toHaveAttribute('aria-disabled','true');});
});

// jsdom cannot evaluate Gravity's portal CSS selectors containing React useId.
// Keep the real Select and keyboard logic; only render its popup inline here.
vi.mock('@gravity-ui/uikit', async (importOriginal) => {
 const actual=await importOriginal<typeof import('@gravity-ui/uikit')>();
 return {...actual,Select:(props:ComponentProps<typeof actual.Select>)=><actual.Select {...props} disablePortal />};
});
