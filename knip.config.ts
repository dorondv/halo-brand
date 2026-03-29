import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  ignore: [
    'checkly.config.ts',
    'src/libs/I18n.ts',
    'src/types/I18n.ts',
    'src/utils/Helpers.ts',
    'tests/**/*.ts',
    '.storybook/**',
    'src/libs/Arcjet.ts',
    'src/libs/MetaInbox.ts',
  ],
  ignoreDependencies: [
    '@commitlint/types',
    '@commitlint/cli', // used via lefthook / npx commitlint, not a static import
    'checkly', // CLI + checkly.config.ts (config file ignored)
    'semantic-release', // CI / npx semantic-release
    'conventional-changelog-conventionalcommits',
    'vite',
    '@radix-ui/react-avatar',
    'xlsx',
  ],
  ignoreBinaries: [],
  ignoreIssues: {
    'src/components/ui/badge.tsx': ['exports', 'types'],
    'src/libs/dashboard-cache.ts': ['exports'], // getDemographics reserved for API wiring
    'src/libs/Getlate.ts': ['exports', 'types'], // GetlateClient constructed via factory only
    'src/libs/meta-inbox.ts': ['exports', 'types'], // MetaInboxClient via createMetaInboxClient
    'src/libs/post-score-calculator.ts': ['exports', 'types'],
    'src/libs/socialvault.ts': ['exports', 'types'],
    'src/libs/subscriptionService.ts': ['exports', 'types'],
    'src/libs/timezone.ts': ['exports'],
    'src/utils/geoDetection.ts': ['exports'],
    'src/utils/tracking.ts': ['exports', 'types'],
  },
  compilers: {
    css: (text: string) => [...text.matchAll(/(?<=@)import[^;]+/g)].join('\n'),
  },
};

export default config;
