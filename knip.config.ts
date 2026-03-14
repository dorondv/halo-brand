import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  // Files to exclude from Knip analysis
  ignore: [
    'checkly.config.ts',
    'src/libs/I18n.ts',
    'src/types/I18n.ts',
    'src/utils/Helpers.ts',
    'tests/**/*.ts',
    'project-management-tool/**',
    '.storybook/**',
    'src/components/create/MediaUpload.tsx',
    'src/components/create/PlatformSelector.tsx',
    'src/components/create/ScheduleSelector.tsx',
    'src/components/ui/checkbox.tsx',
    'src/components/ui/progress.tsx',
    'src/libs/Arcjet.ts',
    'src/libs/MetaInbox.ts',
  ],
  // Dependencies to ignore during analysis
  ignoreDependencies: [
    '@commitlint/types',
    'conventional-changelog-conventionalcommits',
    'vite',
    '@radix-ui/react-avatar',
    '@radix-ui/react-checkbox',
    'xlsx',
  ],
  // Binaries to ignore during analysis
  ignoreBinaries: [
    'production', // False positive raised with dotenv-cli
  ],
  // Ignore unused exports in lib/utility files (reserved for future use)
  ignoreIssues: {
    'src/components/ui/badge.tsx': ['exports', 'types'],
    'src/libs/post-score-calculator.ts': ['exports'],
    'src/libs/socialvault.ts': ['exports'],
    'src/libs/subscriptionService.ts': ['exports'],
    'src/libs/timezone.ts': ['exports'],
    'src/utils/geoDetection.ts': ['exports'],
    'src/utils/tracking.ts': ['exports'],
    'src/libs/Getlate.ts': ['types'],
  },
  compilers: {
    css: (text: string) => [...text.matchAll(/(?<=@)import[^;]+/g)].join('\n'),
  },
};

export default config;
