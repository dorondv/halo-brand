import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/libs/DB';
import { marketingEvents } from '@/models/Schema';
import { extractIPAddress, getCountryFromIP } from '@/utils/geoDetection';

/**
 * POST /api/marketing/events
 * Track marketing events (public endpoint, no auth required).
 *
 * Security: This endpoint only INSERTS into the marketing_events table.
 * It does NOT write to the users table — that must be done via authenticated
 * endpoints to prevent arbitrary user record modifications.
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

    // Create marketing event (insert only — no user record modifications)
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
