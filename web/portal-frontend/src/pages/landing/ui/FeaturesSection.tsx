import React from 'react';
import { Card } from '@gravity-ui/uikit';

import type { LandingFeature } from '../model/content';

type FeaturesSectionProps = {
  features: LandingFeature[];
};

export const FeaturesSection: React.FC<FeaturesSectionProps> = ({ features }) => (
  <section id="features" className="landing-section">
    <div className="container py-5">
      <div className="d-flex align-items-end justify-content-between flex-wrap gap-2 mb-4">
        <div>
          <div className="text-muted small">Why it’s great</div>
          <h2 className="h3 fw-semibold mb-0">Everything your tenant needs</h2>
        </div>
      </div>
      <div className="row g-3">
        {features.map((feature) => (
          <div key={feature.title} className="col-12 col-md-6 col-lg-4">
            <Card view="filled" className="p-4 h-100">
              <div className="fw-semibold mb-2">{feature.title}</div>
              <p className="text-muted mb-0">{feature.description}</p>
            </Card>
          </div>
        ))}
      </div>
    </div>
  </section>
);
