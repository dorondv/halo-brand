/**
 * Unified inbox (Zernio + Meta) — which view modes are supported per platform.
 * Keep aligned with /api/inbox/conversations behavior and Zernio API errors.
 */

export function platformSupportsInboxChat(platform: string): boolean {
  const p = platform.toLowerCase();
  // Zernio: "Platform 'linkedin' does not support direct messages"
  if (p === 'linkedin') {
    return false;
  }
  return true;
}

export function platformSupportsInboxComments(platform: string): boolean {
  const _p = platform.toLowerCase();
  void _p;
  return true;
}
