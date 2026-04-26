import { setRequestLocale } from 'next-intl/server';
import { LegalLinksFooter } from '@/components/legal/LegalLinksFooter';

export default async function Layout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1">{props.children}</div>
      <LegalLinksFooter />
    </div>
  );
}
