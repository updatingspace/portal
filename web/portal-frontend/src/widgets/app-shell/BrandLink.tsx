import { Link } from 'react-router-dom';
import { useRouteBase } from '../../shared/hooks/useRouteBase';

export function BrandLink() {
  const base = useRouteBase();
  return (
    <Link className="app-shell__brand" to={base}>
      UpdSpace
      <span className="app-shell__brand-dot" aria-hidden="true">
        .
      </span>
    </Link>
  );
}
