/**
 * TypeScript declarations for react-native-config environment variables.
 * These are loaded from .env file at build time.
 */

declare module 'react-native-config' {
  export interface NativeConfig {
    /**
     * Supabase project URL.
     * - Local dev (iOS Simulator): http://localhost:54321
     * - Local dev (Physical device): http://<Mac-LAN-IP>:54321
     * - Production: https://<project-ref>.supabase.co
     */
    SUPABASE_URL?: string;

    /**
     * Supabase anonymous (public) key.
     * Safe for client-side use - only provides access to public data.
     */
    SUPABASE_ANON_KEY?: string;
  }

  const Config: NativeConfig;
  export default Config;
}
