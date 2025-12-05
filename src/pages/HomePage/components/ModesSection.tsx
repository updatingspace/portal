import React from 'react';
import { Card } from '@gravity-ui/uikit';

type ModesSectionProps = {
  hints: {
    id: string;
    title: string;
    text: string;
  }[];
};

export const ModesSection: React.FC<ModesSectionProps> = ({ hints }) => (
  <section className="home-section" aria-label="Режимы и правила">
    <div className="home-section-head">
      <div>
        <div className="home-section-title">Режимы голосований и правила</div>
        <div className="home-section-subtitle">
          Внимательно читайте описание подрежима: где-то можно выбрать несколько вариантов сразу
        </div>
      </div>
    </div>

    <div className="mode-grid">
      {hints.map((hint) => (
        <Card key={hint.id} className="mode-card">
          <div className="mode-card-title">{hint.title}</div>
          <p className="mode-card-text">{hint.text}</p>
        </Card>
      ))}
    </div>
  </section>
);
