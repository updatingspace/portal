import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@gravity-ui/uikit';

import { useAuth } from '../../contexts/AuthContext';
import { landingContent } from './model/content';
import { HeroSection } from './ui/HeroSection';
import { FeaturesSection } from './ui/FeaturesSection';
import { BlocksSection } from './ui/BlocksSection';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const handlePrimary = () => {
    if (user) {
      navigate('/app');
    } else {
      navigate(landingContent.hero.primaryCta.href);
    }
  };

  return (
    <div className="landing-page">
      <HeroSection
        hero={landingContent.hero}
        onPrimaryClick={handlePrimary}
        onSecondaryClick={() => navigate('/invite/demo-token')}
        isAuthenticated={Boolean(user)}
      />
      <FeaturesSection features={landingContent.features} />
      <BlocksSection blocks={landingContent.blocks} />
      <section id="docs" className="landing-section">
        <div className="container py-5">
          <Card view="filled" className="p-4">
            <div className="fw-semibold mb-2">Docs</div>
            <p className="text-muted mb-0">API docs and onboarding guides will live here.</p>
          </Card>
        </div>
      </section>
    </div>
  );
};
