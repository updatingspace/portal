import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Architecture',
      collapsed: false,
      items: [
        'architecture/overview',
        'architecture/service-mesh',
        'architecture/principles',
        'architecture/security',
        'architecture/multi-tenancy',
        'architecture/flows',
      ],
    },
    {
      type: 'category',
      label: 'Services',
      collapsed: false,
      link: {type: 'doc', id: 'services/overview'},
      items: [
        {
          type: 'category',
          label: 'UpdSpaceID',
          items: [
            'services/id/overview',
          ],
        },
        {
          type: 'category',
          label: 'BFF',
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
          label: 'Portal',
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
          items: [
            'services/events/overview',
            'services/events/feat-research',
            'services/events/roadmap',
          ],
        },
        {
          type: 'category',
          label: 'Activity',
          items: [
            'services/activity/overview',
            'services/activity/api-reference',
            'services/activity/connectors',
            'services/activity/roadmap',
          ],
        },
        {
          type: 'category',
          label: 'Gamification',
          items: [
            'services/gamification/overview',
            'services/gamification/models',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Frontend',
      items: [
        'frontend/overview',
        'frontend/portal',
        'frontend/activity',
        'frontend/id',
      ],
    },
    {
      type: 'category',
      label: 'Legal & Privacy',
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
  ],

  apiSidebar: [
    'api/overview',
  ],

  guidesSidebar: [
    'guides/quick-start',
    'guides/local-dev',
    'guides/docker-setup',
    'guides/testing',
    'guides/documentation-playbook',
    'guides/yandex-cloud-deploy',
    'guides/contributing',
  ],
};

export default sidebars;
