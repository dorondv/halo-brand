import { ToastProvider } from '@/components/ui/toast';
import { BrandProvider } from '@/contexts/BrandContext';

export default async function AuthLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  await props.params;

  return (
    <ToastProvider>
      <BrandProvider>
        <div>{props.children}</div>
      </BrandProvider>
    </ToastProvider>
  );
}
