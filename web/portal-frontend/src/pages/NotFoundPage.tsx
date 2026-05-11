import React from 'react';
import { Button } from '@gravity-ui/uikit';
import { Link, useLocation } from 'react-router-dom';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

export const NotFoundPage: React.FC = () => {
  const location = useLocation();
  useDocumentTitle('Страница не найдена');

  return (
    <div className="page-section">
      <div className="container">
        <div className="status-block status-block-danger not-found-block">
          <div className="status-title">Страница не найдена</div>
          <p className="text-muted mb-3">
            Мы не нашли страницу <code>{location.pathname}</code>. Проверьте ссылку или вернитесь на главную.
          </p>
          <div className="d-flex align-items-center gap-2">
            <Button view="outlined" size="m" component={Link} to="/">
              На главную
            </Button>
            <Link to="/profile" className="text-decoration-none">
              Перейти в профиль →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
