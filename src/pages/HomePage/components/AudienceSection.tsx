import React from 'react';

type AudienceSectionProps = {
  items: {
    id: string;
    title: string;
    description: string;
    points: string[];
  }[];
};

export const AudienceSection: React.FC<AudienceSectionProps> = ({ items }) => (
  <section className="home-section home-section-muted" aria-label="Кому полезен сервис">
    <div className="home-section-head">
      <div>
        <div className="home-section-title">Под разные сценарии</div>
        <div className="home-section-subtitle">
          Кому помогает AEF-Vote и как использовать голосования в работе и сообществе
        </div>
      </div>
    </div>
    <div className="audience-grid">
      {items.map((need) => (
        <div key={need.id} className="audience-card">
          <div className="audience-card-title">{need.title}</div>
          <p className="audience-card-text">{need.description}</p>
          <ul className="audience-card-list">
            {need.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  </section>
);
