import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import { AccessibilityBootstrap } from '@/components/accessibility/AccessibilityBootstrap';
import { ConsentAndAnalyticsNoscript, ConsentAndAnalyticsScripts } from '@/components/analytics/ConsentAndAnalyticsScripts';
import { PostHogProvider } from '@/components/analytics/PostHogProvider';
import { ChatwootWidget } from '@/components/chatwoot/ChatwootWidget';
import { CookieConsentBanner } from '@/components/legal/CookieConsentBanner';
import { ThemeInitScript } from '@/components/theme/ThemeInitScript';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { CookieConsentProvider } from '@/contexts/CookieConsentContext';
import { routing } from '@/libs/I18nRouting';
import '@/styles/global.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'Branda',
    template: '%s | Branda',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }));
}

export default async function RootLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const dir = locale === 'he' ? 'rtl' : 'ltr';

  // Website token is public (embedded in client); server-only env is preferred for Vercel.
  const chatwootToken
    = process.env.CHATWOOT_WEBSITE_TOKEN?.trim()
      || process.env.NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN?.trim();
  const chatwootBaseUrl = process.env.CHATWOOT_BASE_URL?.trim() || 'https://app.chatwoot.com';

  return (
    <html lang={locale} dir={dir} className={inter.variable} suppressHydrationWarning>
      <body className="bg-white font-sans text-gray-900 antialiased dark:bg-gray-900 dark:text-gray-100">
        <ConsentAndAnalyticsScripts />
        <ConsentAndAnalyticsNoscript />
        <ThemeInitScript />
        <ThemeProvider>
          <AccessibilityBootstrap />
          <NextIntlClientProvider>
            <CookieConsentProvider>
              <PostHogProvider>
                {props.children}
              </PostHogProvider>
              <ChatwootWidget agentName="branda" baseUrl={chatwootBaseUrl} websiteToken={chatwootToken} />
              <CookieConsentBanner />
            </CookieConsentProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
