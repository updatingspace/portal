import React from 'react';
import { Card } from '@gravity-ui/uikit';

import type { LandingBlock } from '../model/content';

type BlocksSectionProps = {
  blocks: LandingBlock[];
};

export const BlocksSection: React.FC<BlocksSectionProps> = ({ blocks }) => (
  <section id="communities" className="landing-section">
    <div className="container py-5">
      <div className="row g-4">
        {blocks.map((block) => (
          <div key={block.title} className="col-12 col-lg-6">
            <Card view="filled" className="p-4 h-100">
              <div className="fw-semibold mb-2">{block.title}</div>
              <p className="text-muted mb-0">{block.description}</p>
            </Card>
          </div>
        ))}
      </div>
    </div>
  </section>
);
