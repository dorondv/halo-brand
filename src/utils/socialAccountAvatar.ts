/**
 * Avatar / profile image URLs from Zernio (GET /v1/accounts) vary by platform:
 * top-level `profilePicture`, nested `metadata.profileData`, Facebook `availablePages[].picture`, etc.
 * @see https://zernio.com/openapi.yaml
 */

function pickString(...values: unknown[]): string | undefined {
  for (const v of values) {
    if (typeof v === 'string') {
      const t = v.trim();
      if (t.length > 0) {
        return t;
      }
    }
  }
  return undefined;
}

function facebookGraphPictureUrl(picture: unknown): string | undefined {
  if (typeof picture === 'string') {
    return pickString(picture);
  }
  if (picture && typeof picture === 'object') {
    const data = (picture as { data?: unknown }).data;
    if (data && typeof data === 'object') {
      return pickString((data as { url?: unknown }).url);
    }
  }
  return undefined;
}

function pagePictureFromFacebookPageObject(page: Record<string, unknown> | undefined): string | undefined {
  if (!page) {
    return undefined;
  }
  return pickString(
    page.pictureUrl,
    page.profile_picture_url,
    page.profilePicture,
    facebookGraphPictureUrl(page.picture),
    page.logoUrl,
  );
}

/**
 * Extract avatar URL from a single account object as returned by Zernio list-accounts.
 */
export function extractAvatarFromZernioAccountPayload(account: Record<string, unknown> | null | undefined): string | undefined {
  if (!account) {
    return undefined;
  }

  const meta = account.metadata && typeof account.metadata === 'object'
    ? account.metadata as Record<string, unknown>
    : undefined;
  const profileData = account.profileData && typeof account.profileData === 'object'
    ? account.profileData as Record<string, unknown>
    : undefined;
  const metaProfileData = meta?.profileData && typeof meta.profileData === 'object'
    ? meta.profileData as Record<string, unknown>
    : undefined;

  if (account.platform === 'facebook' && meta) {
    const selectedPageId = meta.selectedPageId ?? meta.selected_page_id;
    const availablePages = meta.availablePages ?? meta.available_pages;
    if (selectedPageId && Array.isArray(availablePages)) {
      const selectedPage = availablePages.find((p: unknown) => {
        if (!p || typeof p !== 'object') {
          return false;
        }
        const page = p as Record<string, unknown>;
        const id = page.id ?? page.pageId ?? page.facebookPageId ?? page._id;
        return String(id) === String(selectedPageId);
      }) as Record<string, unknown> | undefined;

      const fromPage = pagePictureFromFacebookPageObject(selectedPage);
      if (fromPage) {
        return fromPage;
      }
    }
    const topPages = account.availablePages ?? account.available_pages;
    if (meta.selectedPageId && Array.isArray(topPages)) {
      const selectedPage = topPages.find((p: unknown) => {
        if (!p || typeof p !== 'object') {
          return false;
        }
        const page = p as Record<string, unknown>;
        const id = page.id ?? page.pageId ?? page.facebookPageId ?? page._id;
        return String(id) === String(meta.selectedPageId);
      }) as Record<string, unknown> | undefined;
      const fromPage = pagePictureFromFacebookPageObject(selectedPage);
      if (fromPage) {
        return fromPage;
      }
    }
  }

  if (account.platform === 'linkedin' && meta) {
    const org = (typeof meta.selectedOrganization === 'object' && meta.selectedOrganization
      ? meta.selectedOrganization
      : typeof meta.linkedinOrganization === 'object' && meta.linkedinOrganization
        ? meta.linkedinOrganization
        : undefined) as Record<string, unknown> | undefined;
    const orgLogo = pickString(org?.logoUrl, org?.pictureUrl, org?.profilePicture);
    if (orgLogo) {
      return orgLogo;
    }
  }

  return pickString(
    account.profilePicture,
    account.avatarUrl,
    account.picture,
    account.profile_picture_url,
    account.profile_image_url,
    profileData?.profilePicture,
    profileData?.avatarUrl,
    profileData?.picture,
    meta?.profilePicture,
    meta?.avatarUrl,
    meta?.picture,
    metaProfileData?.profilePicture,
    metaProfileData?.avatarUrl,
    metaProfileData?.picture,
  );
}

/**
 * Resolve avatar from `social_accounts.platform_specific_data` (after sync or legacy rows).
 */
export function resolveAvatarUrlFromStoredPlatformData(
  data: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!data) {
    return undefined;
  }

  const facebookPage = data.facebookPage && typeof data.facebookPage === 'object'
    ? data.facebookPage as Record<string, unknown>
    : undefined;
  const linkedinOrg = data.linkedinOrganization && typeof data.linkedinOrganization === 'object'
    ? data.linkedinOrganization as Record<string, unknown>
    : undefined;
  const profileData = data.profileData && typeof data.profileData === 'object'
    ? data.profileData as Record<string, unknown>
    : undefined;

  return pickString(
    data.avatar_url,
    data.avatarUrl,
    data.profilePicture,
    data.profile_picture,
    data.profile_picture_url,
    data.picture,
    profileData?.profilePicture,
    profileData?.avatarUrl,
    profileData?.picture,
    facebookPage?.pictureUrl,
    pagePictureFromFacebookPageObject(facebookPage),
    linkedinOrg?.logoUrl,
    linkedinOrg?.pictureUrl,
    linkedinOrg?.profilePicture,
  );
}
