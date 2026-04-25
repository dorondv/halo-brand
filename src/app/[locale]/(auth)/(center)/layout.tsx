import { setRequestLocale } from 'next-intl/server';
import { LegalLinksFooter } from '@/components/legal/LegalLinksFooter';

export default async function CenteredLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-white dark:bg-gray-900">
      <div className="flex flex-1 items-center justify-center">
        {props.children}
      </div>
      <LegalLinksFooter />
    </div>
  );
}
