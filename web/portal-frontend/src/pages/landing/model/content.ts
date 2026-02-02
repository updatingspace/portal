export const landingContent = {
  hero: {
    title: 'AEF Portal',
    subtitle:
      'A multi-tenant portal for gaming communities: activity feed, events calendar, voting campaigns, integrations, and fine-grained access control.',
    primaryCta: { label: 'Login', href: '/login' },
    secondaryCta: { label: 'Activate invite', href: '/invite/demo-token' },
  },
  features: [
    {
      title: 'Tenants / White‑label',
      description: 'Host-based tenancy with branding and isolated visibility rules.',
    },
    {
      title: 'Privacy & RBAC',
      description: 'Visibility and permissions driven by master-rules and service roles.',
    },
    {
      title: 'Activity Feed',
      description: 'Aggregated activity from services and integrations.',
    },
    {
      title: 'Events Calendar',
      description: 'Upcoming events, schedules, reminders, and calendar views.',
    },
    {
      title: 'Voting',
      description: 'Campaigns, nominations, polls, and voting analytics.',
    },
    {
      title: 'Integrations',
      description: 'Steam, Discord, GitHub, game servers — extendable connectors.',
    },
  ],
  blocks: [
    {
      title: 'Built for serious communities',
      description:
        'Looks like an intranet, feels like a modern community hub. Everything is permission-aware and tenant-scoped.',
    },
    {
      title: 'Support-friendly errors',
      description:
        'Every API error surfaces a request_id so support can locate the exact trace quickly.',
    },
  ],
} as const;

export type LandingContent = typeof landingContent;
export type LandingHero = LandingContent['hero'];
export type LandingFeature = LandingContent['features'][number];
export type LandingBlock = LandingContent['blocks'][number];
