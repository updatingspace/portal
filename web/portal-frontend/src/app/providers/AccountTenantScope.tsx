import {useEffect,type ReactNode} from 'react';
import {useAuth} from '../../contexts/AuthContext';
import {TenantProvider,useTenantContext} from '../../contexts/TenantContext';
function MembershipLoader(){
  const {user}=useAuth();
  const {refreshTenants}=useTenantContext();
  useEffect(()=>{if(user?.id) void refreshTenants().catch(()=>undefined);},[user?.id,refreshTenants]);
  return null;
}
/** Membership names and tenant state must never survive a change of account. */
export function AccountTenantScope({children}:{children:ReactNode}){
  const {user}=useAuth();
  return <TenantProvider key={user?.id ?? 'guest'}><MembershipLoader/>{children}</TenantProvider>;
}
