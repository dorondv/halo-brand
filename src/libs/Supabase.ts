import { createBrowserClient, createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';



export function createSupabaseBrowserClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
}

export async function createSupabaseServerClient() {
    const store = await cookies();
    // Clean up legacy auth-helper cookies (base64-encoded) to avoid JSON parse errors
    try {
        const all = store.getAll();
        all.forEach(c => {
            if (c.name.startsWith('sb-') && c.value?.startsWith('base64-')) {
                // @ts-expect-error runtime accepts object form
                store.set({ name: c.name, value: '', path: '/' });
            }
        });
    } catch { }
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return store.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    try {
                        // @ts-expect-error runtime types may vary
                        store.set({ name, value, ...options });
                    } catch { }
                },
                remove(name: string, options: CookieOptions) {
                    try {
                        // @ts-expect-error runtime types may vary
                        store.set({ name, value: '', ...options });
                    } catch { }
                },
            },
        },
    );
}
