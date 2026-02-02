import React from 'react';
import { Button, Card } from '@gravity-ui/uikit';

import type { LandingHero } from '../model/content';

type HeroSectionProps = {
  hero: LandingHero;
  isAuthenticated: boolean;
  onPrimaryClick: () => void;
  onSecondaryClick: () => void;
};

export const HeroSection: React.FC<HeroSectionProps> = ({
  hero,
  isAuthenticated,
  onPrimaryClick,
  onSecondaryClick,
}) => (
  <section className="landing-hero">
    <div className="container py-5">
      <div className="row align-items-center g-4">
        <div className="col-12 col-lg-7">
          <div className="text-muted small mb-2">UpdSpace · AEF</div>
          <h1 className="display-5 fw-semibold mb-3">{hero.title}</h1>
          <p className="lead text-muted mb-4">{hero.subtitle}</p>
          <div className="d-flex flex-wrap gap-2">
            <Button size="l" view="action" onClick={onPrimaryClick}>
              {isAuthenticated ? 'Open App' : hero.primaryCta.label}
            </Button>
            <Button size="l" view="outlined" onClick={onSecondaryClick}>
              {hero.secondaryCta.label}
            </Button>
          </div>
        </div>
        <div className="col-12 col-lg-5">
          <Card view="filled" className="p-4">
            <div className="fw-semibold mb-2">Preview</div>
            <p className="text-muted mb-0">
              Screenshots/mocks go here. For MVP we keep this as a placeholder block.
            </p>
          </Card>
        </div>
      </div>
    </div>
  </section>
);
