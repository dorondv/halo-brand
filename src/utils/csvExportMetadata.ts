import { AppConfig } from '@/utils/AppConfig';

/** Opening lines for downloadable CSV exports (identity + export timestamp). */
export function getCsvExportMetadataLines(): string[] {
  return [AppConfig.name, `Generated: ${new Date().toLocaleDateString()}`];
}
