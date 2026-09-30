import '../../styles/voting-v2.css';
import React from 'react';

interface VotingPageLayoutProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const VotingPageLayout: React.FC<VotingPageLayoutProps> = ({
  title,
  description,
  actions,
  children,
  className,
}) => {
  const layoutClassName = ['voting-v2', className].filter(Boolean).join(' ');

  return (
    <div className={layoutClassName}>
      <header className="portal-page__heading" aria-labelledby="voting-v2-page-title">
        <div className="voting-v2__hero-content">
          <h1 id="voting-v2-page-title" className="voting-v2__title">
            {title}
          </h1>
          {description ? (
            <p className="voting-v2__description">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="voting-v2__actions">{actions}</div> : null}
      </header>

      <section className="voting-v2__body">{children}</section>
    </div>
  );
};
