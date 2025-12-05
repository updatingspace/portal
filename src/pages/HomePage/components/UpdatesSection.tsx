import React from 'react';
import { Card } from '@gravity-ui/uikit';

type UpdatesSectionProps = {
  items: {
    id: string;
    tone: 'success' | 'warning' | 'info';
    title: string;
    text: string;
    badge: string;
  }[];
};

export const UpdatesSection: React.FC<UpdatesSectionProps> = ({ items }) => (
  <section className="home-updates" aria-label="Изменения и новости">
    <div className="home-section-head">
      <div>
        <div className="home-section-title">Последние новости</div>
      </div>
    </div>
    <div className="home-updates-grid">
      {items.map((note) => (
        <Card key={note.id} className={`update-card update-card-${note.tone}`}>
          <div className="update-card-top">
            <span className={`update-pill update-pill-${note.tone}`}>{note.badge}</span>
            <span className="update-meta">AEF-Vote · портал</span>
          </div>
          <div className="update-title">{note.title}</div>
          <p className="update-text">{note.text}</p>
        </Card>
      ))}
    </div>
  </section>
);
