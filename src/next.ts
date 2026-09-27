import type { NextConfig } from "next";

const CLIENT_MODULE = "next-element-timing/client";

/**
 * Loads the element-timing client instrumentation before React hydrates, alongside any
 * other injected modules and the project's own instrumentation-client file. Requires Next.js 16.3+.
 *
 *   export default withElementTiming(nextConfig)
 */
export function withElementTiming(nextConfig: NextConfig = {}): NextConfig {
  const inject = nextConfig.instrumentationClientInject ?? [];
  return {
    ...nextConfig,
    instrumentationClientInject: inject.includes(CLIENT_MODULE) ? inject : [...inject, CLIENT_MODULE],
  };
}
