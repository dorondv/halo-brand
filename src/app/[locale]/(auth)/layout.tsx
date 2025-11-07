import { ToastProvider } from '@/components/ui/toast';

export default async function AuthLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  await props.params;

  return (
    <ToastProvider>
      <div>{props.children}</div>
    </ToastProvider>
  );
}
