import React from 'react';

type HomeHeroProps = {
  activeCount: number;
  archivedCount: number;
  nextDeadlineLabel: string;
};

export const HomeHero: React.FC<HomeHeroProps> = ({
  activeCount,
  archivedCount,
  nextDeadlineLabel,
}) => (
  <section className="home-hero">
    <div className="home-hero-grid">
      <div className="home-hero-main">
        <div className="home-hero-kicker">AEF-Vote</div>
        <h1 className="home-hero-title">Сервис честных голосований</h1>
        <p className="home-hero-text">
          Запускаем и ведем кампании голосования: от анонса номинаций и настроек режимов до публикации
          обезличенных итогов. Понятные дедлайны, прозрачные правила, готовые сценарии для сообществ и команд.
        </p>
        <div className="home-hero-badges">
          <span className="home-hero-badge">Прозрачные правила</span>
          <span className="home-hero-badge">Анонимные бюллетени</span>
          <span className="home-hero-badge">Можно менять голос до дедлайна</span>
        </div>
        <div className="home-hero-stats">
          <div className="hero-stat">
            <div className="hero-stat-label">Активные кампании</div>
            <div className="hero-stat-value">{activeCount}</div>
            <div className="hero-stat-hint">Витрина обновляется по мере запуска кампаний</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-label">Кампании в архиве</div>
            <div className="hero-stat-value">{archivedCount}</div>
            <div className="hero-stat-hint">Можно вернуться и пересмотреть итоговые решения</div>
          </div>
          <div className="hero-stat hero-stat-wide">
            <div className="hero-stat-label">Ближайший дедлайн</div>
            <div className="hero-stat-value">{nextDeadlineLabel}</div>
            <div className="hero-stat-hint">
              Если важно успеть сейчас — переходите к карточкам актуальных голосований ниже
            </div>
          </div>
        </div>
      </div>

      <div className="home-hero-aside">
        <div className="hero-aside-card">
          <div className="hero-aside-title">Что такое AEF-Vote</div>
          <p className="hero-aside-text">
            Платформа для бизнесовых и коммьюнити-голосований: фиксируем правила, режимы выбора и сроки,
            чтобы принять решение по понятному процессу.
          </p>
          <ul className="hero-aside-list">
            <li>Одна кампания — несколько номинаций: у каждой свой режим и описание.</li>
            <li>До дедлайна можно обновлять голос; таймеры подскажут, сколько осталось.</li>
            <li>Итоги публикуем в архиве и храним обезличенные бюллетени для прозрачности.</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
);
