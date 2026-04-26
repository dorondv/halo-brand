/* eslint-disable next/no-before-interactive-script-outside-document -- consent default must run before other tags; supported in App Router root layout */
/* eslint-disable react-dom/no-dangerously-set-innerhtml -- inline gtag/GTM/Meta bootstrap only */
import Script from 'next/script';

const DEFAULT_GTM_CONTAINER_ID = 'GTM-TS3SV3CC';

function consentDefaultInline(): string {
  return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});try{var c=localStorage.getItem('branda_consent');if(c){var p=JSON.parse(c);if(p.v===1)gtag('consent','update',{ad_storage:p.ad_storage,ad_user_data:p.ad_user_data,ad_personalization:p.ad_personalization,analytics_storage:p.analytics_storage});}}catch(e){}}`;
}

/**
 * Google Consent Mode v2 defaults + Tag Manager / optional GA4, Google Ads, Meta Pixel.
 * Must run before interactive tracking; keep in sync with `src/libs/consent.ts` storage key and version.
 */
export function ConsentAndAnalyticsScripts() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_CONTAINER_ID?.trim() || DEFAULT_GTM_CONTAINER_ID;
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  const gadsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim();
  const metaId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();

  const gtagLoaderId = gaId || gadsId;
  const gtagConfigLines = [`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());`];
  if (gaId) {
    gtagConfigLines.push(`gtag('config','${gaId}');`);
  }
  if (gadsId) {
    gtagConfigLines.push(`gtag('config','${gadsId}');`);
  }

  return (
    <>
      <Script
        id="consent-default"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: consentDefaultInline() }}
      />
      {gtagLoaderId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gtagLoaderId}`}
            strategy="afterInteractive"
          />
          <Script
            id="gtag-config"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{ __html: gtagConfigLines.join('') }}
          />
        </>
      )}
      {gtmId && (
        <Script
          id="gtm-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`,
          }}
        />
      )}
      {metaId && (
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('consent','revoke');fbq('init','${metaId}');fbq('track','PageView');`,
          }}
        />
      )}
    </>
  );
}

export function ConsentAndAnalyticsNoscript() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_CONTAINER_ID?.trim() || DEFAULT_GTM_CONTAINER_ID;
  const metaId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();

  return (
    <>
      {gtmId && (
        <noscript>
          <iframe
            title="Google Tag Manager"
            src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
      )}
      {metaId && (
        <noscript>
          {/* eslint-disable-next-line next/no-img-element -- Meta Pixel noscript fallback */}
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src={`https://www.facebook.com/tr?id=${metaId}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
      )}
    </>
  );
}
