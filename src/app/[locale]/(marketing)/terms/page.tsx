import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/ui/Logo';
import { Link } from '@/libs/I18nNavigation';

const SECTION_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('LegalTerms');
  return {
    title: t('meta_title'),
    description: t('t1_p').slice(0, 160),
  };
}

export default async function TermsOfUsePage() {
  const t = await getTranslations('LegalTerms');

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <header className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-pink-600 hover:text-pink-700 dark:text-pink-400">
            ←
            {' '}
            Branda
          </Link>
          <Logo width={100} height={28} />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mb-10 text-sm text-gray-500 dark:text-gray-400">{t('updated')}</p>
        <div className="space-y-10">
          {SECTION_KEYS.map((n) => {
            const hKey = `t${n}_h` as const;
            const pKey = `t${n}_p` as const;
            return (
              <section key={n}>
                <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">{t(hKey)}</h2>
                <p className="text-base leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                  {t(pKey)}
                </p>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
