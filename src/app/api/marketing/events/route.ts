import type { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/libs/DB';
import { marketingEvents, users } from '@/models/Schema';
import { extractIPAddress, getCountryFromIP } from '@/utils/geoDetection';

/**
 * POST /api/marketing/events
 * Track marketing events (public endpoint, no auth required)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      eventType,
      userId,
      url,
      referrer,
      utm,
      geo,
      business,
    } = body;

    // Validate event type
    const validEventTypes = ['pageview', 'signup_start', 'signup_complete', 'lead_submit', 'purchase_complete'];
    if (!eventType || !validEventTypes.includes(eventType)) {
      return NextResponse.json(
        { error: 'Invalid event type' },
        { status: 400 },
      );
    }

    // Extract IP address from request
    const ipAddress = extractIPAddress(request.headers);

    // Get country from IP (primary method)
    let country = geo?.country;
    if (ipAddress) {
      const ipCountry = await getCountryFromIP(ipAddress);
      if (ipCountry) {
        country = ipCountry; // IP-based detection takes priority
      }
    }

    // If user is signing up, update user record with UTM/geo data
    if (eventType === 'signup_complete' && userId) {
      try {
        const firstTouch = utm || geo
          ? {
              utmSource: utm?.utm_source,
              utmMedium: utm?.utm_medium,
              utmCampaign: utm?.utm_campaign,
              utmTerm: utm?.utm_term,
              utmContent: utm?.utm_content,
              firstReferrer: referrer,
              firstLandingUrl: url,
              geoCountry: country,
              geoTz: geo?.timezone,
              geoLang: geo?.language,
            }
          : {};

        // Only update fields that are not null/undefined
        const updateFields: Record<string, string> = {};
        Object.entries(firstTouch).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            updateFields[key] = value;
          }
        });

        if (Object.keys(updateFields).length > 0) {
          await db
            .update(users)
            .set(updateFields)
            .where(eq(users.id, userId));
        }
      } catch (error) {
        // Don't fail the event tracking if user update fails
        console.error('Failed to update user with marketing data:', error);
      }
    }

    // Create marketing event
    const event = await db
      .insert(marketingEvents)
      .values({
        eventType,
        userId: userId || null,
        url: url || null,
        referrer: referrer || null,
        userAgent: request.headers.get('user-agent') || null,
        ipAddress: ipAddress || null,
        utmSource: utm?.utm_source || null,
        utmMedium: utm?.utm_medium || null,
        utmCampaign: utm?.utm_campaign || null,
        utmTerm: utm?.utm_term || null,
        utmContent: utm?.utm_content || null,
        gclid: utm?.gclid || null,
        fbclid: utm?.fbclid || null,
        msclkid: utm?.msclkid || null,
        ttclid: utm?.ttclid || null,
        timezone: geo?.timezone || null,
        language: geo?.language || null,
        country: country || null,
        purchaseAmount: business?.purchaseAmount || null,
        currency: business?.currency || null,
        revenueTotal: business?.revenueTotal || null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      eventId: event[0]?.id,
    });
  } catch (error) {
    console.error('Failed to track marketing event:', error);
    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 },
    );
  }
}
