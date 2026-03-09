import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import HomepageFeatures from '@site/src/components/HomepageFeatures';

import styles from './index.module.css';

function HomepageHeader() {
  return (
    <header className={clsx(styles.heroBanner)}>
      <div className="container">
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>UpdSpace Platform</div>
            <Heading as="h1" className={styles.heroTitle}>
              Production documentation for the platform as it exists now.
            </Heading>
            <p className={styles.heroSubtitle}>
              Архитектура, сервисные контракты, operational notes, privacy baseline и
              правила сопровождения собраны в одном актуальном наборе документов.
            </p>
            <div className={styles.buttons}>
              <Link className="button button--primary button--lg" to="/docs/intro">
                Open docs
              </Link>
              <Link className="button button--secondary button--lg" to="/docs/services/overview">
                Browse services
              </Link>
            </div>
          </div>
          <div className={styles.heroPanel}>
            <div className={styles.heroPanelHeader}>Runtime baseline</div>
            <ul className={styles.heroList}>
              <li>React portal frontend behind a Django BFF</li>
              <li>Tenant isolation by slug, UUID tenant IDs, and scoped permissions</li>
              <li>Service mesh of Access, Portal, Voting, Events, Gamification, Activity</li>
              <li>Operational and legal docs aligned to the current repository state</li>
            </ul>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="UpdSpace Documentation"
      description="UpdSpace platform documentation: architecture, services, frontend, operations, and legal baseline.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
