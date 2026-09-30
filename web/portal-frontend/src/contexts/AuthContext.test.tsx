import {act,renderHook,waitFor} from '@testing-library/react';
import type {ReactNode} from 'react';
import {expect,it,vi} from 'vitest';
import {AuthProvider,useAuth} from './AuthContext';
import {fetchSessionMe,type SessionMe} from '../modules/portal/api';
vi.mock('../modules/portal/api',()=>({fetchSessionMe:vi.fn()}));
it('ignores a session response that arrives after sign-out',async()=>{
 let resolve!:(value:SessionMe)=>void;
 vi.mocked(fetchSessionMe).mockReturnValue(new Promise(r=>{resolve=r;}));
 const {result}=renderHook(()=>useAuth(),{wrapper:({children}:{children:ReactNode})=><AuthProvider>{children}</AuthProvider>});
 await waitFor(()=>expect(fetchSessionMe).toHaveBeenCalled());
 act(()=>result.current.setUser(null));
 await act(async()=>resolve({user:{id:'old-user'},tenant:{id:'old-community',slug:'alpha'}}));
 expect(result.current.user).toBeNull();expect(result.current.isLoading).toBe(false);
});
