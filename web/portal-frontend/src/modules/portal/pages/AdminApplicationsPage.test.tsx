import type {ReactNode} from 'react';
import {ThemeProvider} from '@gravity-ui/uikit';
import {fireEvent,render,screen,within} from '@testing-library/react';
import {I18nProvider} from '../../../app/providers/I18nProvider';
import {AdminApplicationsPage} from './AdminApplicationsPage';
import {requestResult} from '../../../api/client';
// Mutation behavior is tested here; real dialog focus/dismissal is covered by Playwright.
vi.mock('@gravity-ui/uikit', async importOriginal => {
 const actual = await importOriginal<typeof import('@gravity-ui/uikit')>();
 const Dialog = Object.assign(({open, children, 'aria-label': label}: {open: boolean; children: ReactNode; 'aria-label'?: string}) => open ? <div role="dialog" aria-label={label}>{children}</div> : null, {
   Header: ({caption}: {caption: string}) => <h2>{caption}</h2>,
   Body: ({children}: {children: ReactNode}) => <div>{children}</div>,
   Footer: ({children}: {children: ReactNode}) => <div>{children}</div>,
 });
 return {...actual, Dialog};
});
vi.mock('../../../api/client',()=>({requestResult:vi.fn()}));
const item={id:1,tenant_slug:'alpha',payload_json:{display_name:'Мария',email:'maria@example.test',message:'Хочу присоединиться',activation_token:'do-not-render'},status:'pending',created_at:'2026-09-30T12:00:00Z'};
beforeEach(()=>{localStorage.setItem('portal_locale_v1','ru');vi.mocked(requestResult).mockReset();vi.mocked(requestResult).mockResolvedValue({ok:true,status:200,data:{items:[item]}});});
it('shows structured fields and requires a concrete decision before approving',async()=>{
 render(<ThemeProvider theme="light"><I18nProvider><AdminApplicationsPage/></I18nProvider></ThemeProvider>);
 expect(await screen.findByRole('heading',{name:'Мария'})).toBeVisible();
 expect(screen.getByText('maria@example.test')).toBeVisible();
 expect(screen.queryByText(/do-not-render/)).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Одобрить'}));
 const dialog=await screen.findByRole('dialog');
 expect(requestResult).toHaveBeenCalledTimes(1);
 vi.mocked(requestResult).mockResolvedValueOnce({ok:true,status:200,data:{activation_token:'another-secret'}});
 fireEvent.click(within(dialog).getByRole('button',{name:'Одобрить'}));
 expect(await screen.findByText('Одобрена')).toBeVisible();
 expect(screen.queryByText(/another-secret/)).toBeNull();
});
it('retains the application after a conflict instead of showing success',async()=>{
 render(<ThemeProvider theme="light"><I18nProvider><AdminApplicationsPage/></I18nProvider></ThemeProvider>);
 fireEvent.click(await screen.findByRole('button',{name:'Отклонить'}));
 vi.mocked(requestResult).mockResolvedValueOnce({ok:false,status:409,error:{code:'CONFLICT',message:'conflict'}});
 fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button',{name:'Отклонить'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('другим администратором');
 expect(screen.getByText('На рассмотрении')).toBeVisible();
 expect(screen.getByRole('heading',{name:'Мария'})).toBeVisible();
});
