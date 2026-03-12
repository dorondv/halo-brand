'use client';

import { useEffect } from 'react';

/**
 * Google Analytics and Google Tag Manager Integration Component
 * Only loads if environment variables are configured
 */
export function GoogleAnalytics() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    const gtmContainerId = process.env.NEXT_PUBLIC_GTM_CONTAINER_ID;

    // Load Google Analytics 4 (GA4)
    if (gaMeasurementId) {
      // Load gtag.js script
      const script1 = document.createElement('script');
      script1.async = true;
      script1.src = `https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`;
      document.head.appendChild(script1);

      // Initialize gtag
      (window as any).dataLayer = (window as any).dataLayer || [];
      function gtag(...args: any[]) {
        (window as any).dataLayer.push(args);
      }
      gtag('js', new Date());
      gtag('config', gaMeasurementId, {
        page_path: window.location.pathname,
      });

      // Make gtag available globally
      (window as any).gtag = gtag;
    }

    // Load Google Tag Manager (GTM)
    if (gtmContainerId) {
      // GTM script
      const script2 = document.createElement('script');
      script2.innerHTML = `
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${gtmContainerId}');
      `;
      document.head.appendChild(script2);

      // GTM noscript iframe
      const noscript = document.createElement('noscript');
      noscript.innerHTML = `
        <iframe src="https://www.googletagmanager.com/ns.html?id=${gtmContainerId}"
        height="0" width="0" style="display:none;visibility:hidden"></iframe>
      `;
      document.body.appendChild(noscript);
    }
  }, []);

  return null;
}
