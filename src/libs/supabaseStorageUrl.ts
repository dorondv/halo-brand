/**
 * Validates that persisted media URLs belong to this project's Supabase Storage.
 * Client uploads should use public URLs from getPublicUrl(); optional signed URLs are accepted.
 */

function supabaseProjectOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (!raw) {
    return null;
  }
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export function isSupabaseStorageBucketUrl(url: string, bucket: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  const origin = supabaseProjectOrigin();
  if (!origin) {
    return false;
  }
  try {
    const u = new URL(url);
    if (u.origin !== origin) {
      return false;
    }
    const p = u.pathname;
    const publicSeg = `/storage/v1/object/public/${bucket}/`;
    const signSeg = `/storage/v1/object/sign/${bucket}/`;
    return p.includes(publicSeg) || p.includes(signSeg);
  } catch {
    return false;
  }
}

export function isAllowedOptionalPostMediaUrl(url: string | null | undefined): boolean {
  if (url == null || url === '') {
    return true;
  }
  return isSupabaseStorageBucketUrl(url, 'post-media');
}

export function isAllowedOptionalBrandLogoUrl(url: string | null | undefined): boolean {
  if (url == null || url === '') {
    return true;
  }
  return isSupabaseStorageBucketUrl(url, 'post-media');
}

/** Collect every media URL sent when creating a post (shared + per-platform). */
export function collectPostPayloadMediaUrls(payload: {
  image_url?: string | null;
  metadata?: unknown;
  platforms?: Array<{ config?: { mediaItems?: Array<{ url?: string }> } }>;
}): string[] {
  const urls: string[] = [];
  if (payload.image_url) {
    urls.push(payload.image_url);
  }
  const meta = payload.metadata;
  if (meta && typeof meta === 'object') {
    const m = meta as Record<string, unknown>;
    if (Array.isArray(m.media_urls)) {
      for (const u of m.media_urls) {
        if (typeof u === 'string' && u) {
          urls.push(u);
        }
      }
    }
    if (m.platform_content && typeof m.platform_content === 'object') {
      for (const pc of Object.values(m.platform_content as Record<string, unknown>)) {
        if (pc && typeof pc === 'object') {
          const mediaUrls = (pc as { mediaUrls?: unknown }).mediaUrls;
          if (Array.isArray(mediaUrls)) {
            for (const u of mediaUrls) {
              if (typeof u === 'string' && u) {
                urls.push(u);
              }
            }
          }
        }
      }
    }
  }
  for (const p of payload.platforms || []) {
    const items = p.config?.mediaItems;
    if (Array.isArray(items)) {
      for (const it of items) {
        if (it && typeof it === 'object' && typeof (it as { url?: string }).url === 'string' && (it as { url: string }).url) {
          urls.push((it as { url: string }).url);
        }
      }
    }
  }
  return urls;
}
