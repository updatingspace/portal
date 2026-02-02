import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'UpdSpace Platform',
  tagline: 'AEF.updspace.com — Gaming Intranet & Multi-tenant Platform',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://docs.updspace.com',
  baseUrl: '/',

  organizationName: 'updatingspace',
  projectName: 'aef-vote',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'ru',
    locales: ['ru', 'en'],
  },

  markdown: {
    mermaid: true,
  },

  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/updatingspace/aef-vote/tree/master/documentation/',
          showLastUpdateTime: true,
          showLastUpdateAuthor: true,
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          editUrl: 'https://github.com/updatingspace/aef-vote/tree/master/documentation/',
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
          label: 'Документация',
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
          label: 'Руководства',
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
          title: 'Документация',
          items: [
            {label: 'Введение', to: '/docs/intro'},
            {label: 'Архитектура', to: '/docs/architecture/overview'},
            {label: 'Сервисы', to: '/docs/services/overview'},
          ],
        },
        {
          title: 'Разработка',
          items: [
            {label: 'Quick Start', to: '/docs/guides/quick-start'},
            {label: 'API Reference', to: '/docs/api/overview'},
            {label: 'Contributing', to: '/docs/guides/contributing'},
          ],
        },
        {
          title: 'Ресурсы',
          items: [
            {label: 'Changelog', to: '/blog'},
            {label: 'GitHub', href: 'https://github.com/updatingspace/aef-vote'},
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
