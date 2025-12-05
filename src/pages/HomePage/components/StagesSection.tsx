import React from 'react';

type StagesSectionProps = {
  stages: {
    id: string;
    title: string;
    text: string;
  }[];
};

export const StagesSection: React.FC<StagesSectionProps> = ({ stages }) => (
  <section className="home-section home-section-contrast" aria-label="Как проходит голосование">
    <div className="home-section-head">
      <div>
        <div className="home-section-title">Как проходит типовое голосование</div>
        <div className="home-section-subtitle">
          Мини-стейджи: что происходит от старта до публикации обезличенных итогов
        </div>
      </div>
    </div>

    <div className="home-stepper" aria-hidden="true">
      {stages.map((stage, index) => (
        <React.Fragment key={stage.id}>
          <div className="home-stepper-dot">{index + 1}</div>
          {index < stages.length - 1 ? <div className="home-stepper-line" /> : null}
        </React.Fragment>
      ))}
    </div>

    <div className="home-steps">
      {stages.map((stage, index) => (
        <div key={stage.id} className="home-step">
          <div className="home-step-badge">Шаг {index + 1}</div>
          <div className="home-step-title">{stage.title}</div>
          <p className="home-step-text">{stage.text}</p>
        </div>
      ))}
    </div>
  </section>
);
