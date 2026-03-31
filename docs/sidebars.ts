import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: '🏗️ Архитектура',
      collapsed: false,
      items: [
        'architecture/overview',
        'architecture/principles',
        'architecture/multi-tenancy',
        'architecture/security',
        'architecture/flows',
      ],
    },
    {
      type: 'category',
      label: '⚙️ Сервисы',
      collapsed: false,
      link: {type: 'doc', id: 'services/overview'},
      items: [
        {
          type: 'category',
          label: 'UpdSpaceID (Identity)',
          items: [
            'services/id/overview',
            'services/id/models',
            'services/id/api',
            'services/id/oauth-providers',
          ],
        },
        {
          type: 'category',
          label: 'BFF Gateway',
          items: [
            'services/bff/overview',
            'services/bff/routing',
            'services/bff/session',
          ],
        },
        {
          type: 'category',
          label: 'Access Control',
          items: [
            'services/access/overview',
            'services/access/rbac',
            'services/access/permissions',
          ],
        },
        {
          type: 'category',
          label: 'Portal Core',
          items: [
            'services/portal/overview',
            'services/portal/models',
            'services/portal/tenant-admin',
            'services/portal/guilds',
          ],
        },
        {
          type: 'category',
          label: 'Voting',
          items: [
            'services/voting/overview',
            'services/voting/models',
          ],
        },
        {
          type: 'category',
          label: 'Events',
          items: ['services/events/overview'],
        },
        {
          type: 'category',
          label: 'Activity',
          items: [
            'services/activity/overview',
            'services/activity/connectors',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: '🖥️ Frontend',
      items: [
        'frontend/overview',
        'frontend/portal',
        'frontend/id',
      ],
    },
    {
      type: 'category',
      label: '⚖️ Legal & Privacy',
      items: [
        'legal/overview',
        'legal/privacy-notice',
        'legal/policy-152fz',
        'legal/cookie-notice',
        'legal/consents',
        'legal/retention-schedule',
        'legal/dsar-procedure',
        'legal/incident-response',
        'legal/records-of-processing',
        'legal/processors-register',
        'legal/cross-border-transfers',
      ],
    },
    {
      type: 'category',
      label: '📊 Статус & Roadmap',
      items: [
        'status/current',
        'status/roadmap',
      ],
    },
  ],

  apiSidebar: [
    'api/overview',
  ],

  guidesSidebar: [
    'guides/quick-start',
    'guides/local-dev',
    'guides/docker-setup',
    'guides/data-lifecycle',
    'guides/testing',
    'guides/contributing',
  ],
};

export default sidebars;
