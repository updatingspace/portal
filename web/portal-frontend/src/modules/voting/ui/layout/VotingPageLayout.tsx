import React from 'react';
import { Text } from '@gravity-ui/uikit';

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
      <section className="voting-v2__hero" aria-labelledby="voting-v2-page-title">
        <div className="voting-v2__hero-content">
          <Text variant="header-1" id="voting-v2-page-title" className="voting-v2__title">
            {title}
          </Text>
          {description ? (
            <Text variant="body-2" color="secondary" className="voting-v2__description">
              {description}
            </Text>
          ) : null}
        </div>
        {actions ? <div className="voting-v2__actions">{actions}</div> : null}
      </section>

      <section className="voting-v2__body">{children}</section>
    </div>
  );
};
