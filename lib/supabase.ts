import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// Singleton browser client — reused across the entire app lifetime
let _browserClient: ReturnType<typeof createSupabaseBrowserClient> | null = null;

// Browser client — uses @supabase/ssr so session cookies sync with Next.js middleware
export function createBrowserClient() {
  if (_browserClient) return _browserClient;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  _browserClient = createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey);
  return _browserClient;
}

// Server client — uses service role key, bypasses RLS
// Only use in API routes and server actions
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceRoleKey);
}
