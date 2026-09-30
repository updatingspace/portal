import type {ReactNode} from 'react';
// Real dialog focus is covered by Playwright; jsdom rejects Gravity's generated selector.
vi.mock('../../shared/ui/portal/ContentDialog',()=>({ContentDialog:({children,title}:{children:ReactNode;title:string})=><section role="dialog" aria-label={title}>{children}</section>}));
import {ThemeProvider} from '@gravity-ui/uikit';
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {FeatureFlagsPage} from './FeatureFlagsPage';

const patch=vi.fn();
const create=vi.fn();
const reload=vi.fn();
let error: Error|null=null;
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({user:{isSuperuser:true}})}));
vi.mock('../../modules/featureFlags/hooks',()=>({useFeatureFlags:()=>({flags:[{key:'alpha',description:'Первая функция',enabled:false},{key:'beta',description:'Вторая функция',enabled:true}],loading:false,error,reload,patch,create})}));
beforeEach(()=>{vi.clearAllMocks();error=null;});
it('keeps errors distinct from an empty list and retries',()=>{error=new Error('Offline');render(<FeatureFlagsPage/>);fireEvent.click(screen.getByRole('button',{name:'Повторить'}));expect(reload).toHaveBeenCalled();expect(screen.queryByText('Флаги еще не созданы.')).toBeNull();});
it('filters by description without modifying flags',()=>{render(<FeatureFlagsPage/>);fireEvent.change(screen.getByLabelText('Поиск функций'),{target:{value:'Вторая'}});expect(screen.queryByText('Первая функция')).toBeNull();expect(screen.getByText('Вторая функция')).toBeVisible();expect(patch).not.toHaveBeenCalled();});
it('keeps each independent toggle pending until its own request finishes',async()=>{
 let finish!:()=>void;patch.mockImplementation((key:string)=>key==='alpha'?new Promise<void>(resolve=>{finish=resolve;}):Promise.reject(new Error('Denied')));
 render(<FeatureFlagsPage/>);
 fireEvent.click(screen.getByRole('switch',{name:/Первая функция/}));
 fireEvent.click(screen.getByRole('switch',{name:/Вторая функция/}));
 await waitFor(()=>expect(screen.getByText(/Изменение не сохранено/)).toBeVisible());
 expect(screen.getByRole('switch',{name:/Первая функция/})).toBeDisabled();
 expect(screen.getByRole('switch',{name:/Вторая функция/})).toBeChecked();
 await act(async()=>finish());
 expect(screen.getByRole('switch',{name:/Первая функция/})).not.toBeDisabled();
});

it('opens creation explicitly and preserves a failed draft', async()=>{create.mockRejectedValueOnce(new Error('duplicate'));render(<ThemeProvider theme="dark"><FeatureFlagsPage/></ThemeProvider>);expect(screen.queryByLabelText('Ключ')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Новая функция'}));fireEvent.change(screen.getByLabelText('Ключ'),{target:{value:'calendar'}});fireEvent.change(screen.getByLabelText('Описание'),{target:{value:'Календарь'}});fireEvent.click(screen.getByRole('button',{name:'Создать',exact:true}));await screen.findByRole('alert');expect(screen.getByLabelText('Ключ')).toHaveValue('calendar');expect(screen.getByLabelText('Описание')).toHaveValue('Календарь');});
