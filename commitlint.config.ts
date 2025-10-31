import type { UserConfig } from '@commitlint/types';

const Configuration: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  ignores: [message => message.startsWith('chore: bump')], // Ignore dependabot commits
  rules: {
    'body-max-line-length': [2, 'always', 200], // Allow up to 200 characters per line in body
  },
};

export default Configuration;
