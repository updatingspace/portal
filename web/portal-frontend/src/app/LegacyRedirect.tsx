import { generatePath, Navigate, useLocation, useParams } from 'react-router-dom';
export function LegacyRedirect({to}: {to: string}) {
  const params = useParams();
  const {search, hash} = useLocation();
  return <Navigate replace to={`${generatePath(to, params)}${search}${hash}`} />;
}
