import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  href: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Architecture as a system map',
    href: '/docs/architecture/overview',
    description: (
      <>
        Service boundaries, trust zones, tenant model, request flows, and
        integration contracts are documented from the current codebase.
      </>
    ),
  },
  {
    title: 'Service docs by module',
    href: '/docs/services/overview',
    description: (
      <>
        Each backend service and the portal frontend have dedicated pages for
        data model, exposed APIs, dependencies, and operational concerns.
      </>
    ),
  },
  {
    title: 'Operational and legal baseline',
    href: '/docs/legal/overview',
    description: (
      <>
        Runbooks, testing guidance, privacy notices, retention schedule, and
        DSAR procedure are versioned together with the platform.
      </>
    ),
  },
];

function Feature({title, href, description}: FeatureItem) {
  return (
    <Link className={styles.featureCard} to={href}>
      <div className={styles.featureAccent} />
      <div className={styles.featureBody}>
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </Link>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className={styles.grid}>
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
