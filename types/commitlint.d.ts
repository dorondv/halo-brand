declare module '@commitlint/types' {
  export type UserConfig = {
    extends?: string[];
    formatter?: string;
    ignores?: Array<(message: string) => boolean>;
    parserPreset?: unknown;
    plugins?: unknown[];
    rules?: Record<string, unknown>;
  };
}
