declare module 'vite' {
  export type Plugin = unknown;
  export type PluginOption = Plugin | Plugin[] | false | null | undefined;

  export type UserConfig = {
    plugins?: PluginOption;
    [key: string]: unknown;
  };

  export type UserConfigExport = UserConfig | Promise<UserConfig> | (() => UserConfig | Promise<UserConfig>);

  export function loadEnv(
    mode: string,
    envDir: string,
    prefixes?: string | string[],
  ): Record<string, string>;
}
