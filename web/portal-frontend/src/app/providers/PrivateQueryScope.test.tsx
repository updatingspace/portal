import {act,render,screen} from '@testing-library/react';
import {useQuery} from '@tanstack/react-query';
import {expect,it,vi} from 'vitest';
import {PrivateQueryScope} from './PrivateQueryScope';
const auth=vi.hoisted(()=>({user:{id:'first',tenant:{id:'alpha'}}}));
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>auth}));
it('rejects late data from a previous tenant and never transfers a previous user cache',async()=>{
 let resolveOld!:(data:string)=>void;
 const fetcher=vi.fn<()=>Promise<string>>().mockImplementationOnce(()=>new Promise(r=>{resolveOld=r;})).mockResolvedValueOnce('Beta content').mockResolvedValueOnce('Other account');
 function View(){const q=useQuery({queryKey:['feed'],queryFn:fetcher});return <div>{q.data??'Loading'}</div>;}
 const view=render(<PrivateQueryScope><View/></PrivateQueryScope>);
 auth.user={id:'first',tenant:{id:'beta'}};view.rerender(<PrivateQueryScope><View/></PrivateQueryScope>);
 expect(await screen.findByText('Beta content')).toBeVisible();
 await act(async()=>resolveOld('Private alpha content'));expect(screen.queryByText('Private alpha content')).not.toBeInTheDocument();
 auth.user={id:'second',tenant:{id:'beta'}};view.rerender(<PrivateQueryScope><View/></PrivateQueryScope>);
 expect(screen.queryByText('Beta content')).not.toBeInTheDocument();expect(await screen.findByText('Other account')).toBeVisible();
});
