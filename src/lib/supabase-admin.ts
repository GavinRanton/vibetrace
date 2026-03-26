import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getInstance(): any {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _client;
}

// Lazy proxy — defers Supabase initialisation until first use so module
// evaluation at build time does not require env vars to be set.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const adminClient: any = new Proxy(
  {},
  {
    get(_, prop: string) {
      return getInstance()[prop];
    },
  }
);
