import { ClerkLocalizations } from '@/utils/AppConfig';

export default async function AuthLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;

  return (
    <div className="flex min-h-screen items-center justify-center">
      {props.children}
    </div>
  );
}
