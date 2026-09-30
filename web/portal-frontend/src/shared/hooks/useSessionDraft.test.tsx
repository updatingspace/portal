import {act,renderHook} from '@testing-library/react';
import {beforeEach,expect,it} from 'vitest';
import {useSessionDraft} from './useSessionDraft';
beforeEach(()=>sessionStorage.clear());
it('restores a draft only for its account and community',()=>{
 const first=renderHook(()=>useSessionDraft('u1:a:post',''));act(()=>first.result.current.setValue('My text'));first.unmount();
 const again=renderHook(()=>useSessionDraft('u1:a:post',''));expect(again.result.current.value).toBe('My text');
 const otherTenant=renderHook(()=>useSessionDraft('u1:b:post',''));expect(otherTenant.result.current.value).toBe('');
 const otherUser=renderHook(()=>useSessionDraft('u2:a:post',''));expect(otherUser.result.current.value).toBe('');
});
it('removes a confirmed draft and warns before leaving an unconfirmed one',()=>{
 const hook=renderHook(()=>useSessionDraft('u:a:event',{title:''}));act(()=>hook.result.current.setValue({title:'Meeting'}));
 const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);expect(event.defaultPrevented).toBe(true);
 act(()=>hook.result.current.clear());expect(sessionStorage.getItem('portal-draft:u:a:event')).toBeNull();
 const cleanEvent=new Event('beforeunload',{cancelable:true});window.dispatchEvent(cleanEvent);expect(cleanEvent.defaultPrevented).toBe(false);
});
