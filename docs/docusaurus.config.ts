import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'UpdSpace Documentation',
  tagline: 'Current architecture, service contracts, operations, and compliance notes',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://docs.updspace.com',
  baseUrl: '/',

  organizationName: 'updatingspace',
  projectName: 'updspace-portal',

  onBrokenLinks: 'throw',
  i18n: {
    defaultLocale: 'ru',
    locales: ['ru', 'en'],
  },

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/updatingspace/aef-vote/tree/master/docs/',
          showLastUpdateTime: true,
          showLastUpdateAuthor: true,
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          editUrl: 'https://github.com/updatingspace/aef-vote/tree/master/docs/',
          blogTitle: 'Changelog & Updates',
          blogDescription: 'Обновления платформы UpdSpace',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/updspace-social-card.jpg',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    docs: {
      sidebar: {
        hideable: true,
        autoCollapseCategories: true,
      },
    },
    navbar: {
      title: 'UpdSpace Docs',
      logo: {
        alt: 'UpdSpace Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          type: 'docSidebar',
          sidebarId: 'apiSidebar',
          position: 'left',
          label: 'API',
        },
        {
          type: 'docSidebar',
          sidebarId: 'guidesSidebar',
          position: 'left',
          label: 'Guides',
        },
        {to: '/blog', label: 'Changelog', position: 'left'},
        {
          type: 'localeDropdown',
          position: 'right',
        },
        {
          href: 'https://github.com/updatingspace/aef-vote',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Overview', to: '/docs/intro'},
            {label: 'Architecture', to: '/docs/architecture/overview'},
            {label: 'Services', to: '/docs/services/overview'},
          ],
        },
        {
          title: 'Operations',
          items: [
            {label: 'Quick Start', to: '/docs/guides/quick-start'},
            {label: 'Testing', to: '/docs/guides/testing'},
            {label: 'Documentation Playbook', to: '/docs/guides/documentation-playbook'},
          ],
        },
        {
          title: 'Legal',
          items: [
            {label: 'Privacy Overview', to: '/docs/legal/overview'},
            {label: 'Cookie Notice', to: '/docs/legal/cookie-notice'},
            {label: 'DSAR Procedure', to: '/docs/legal/dsar-procedure'},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} UpdSpace. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'python', 'json', 'yaml', 'typescript', 'http'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
