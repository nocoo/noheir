import { APP_VERSION, COMPONENT_NAME } from "./version";

declare const __BUILD_SHA__: string | undefined;

export function resolveBuildSha(fallback = ""): string {
  if (typeof __BUILD_SHA__ === "string" && __BUILD_SHA__.length > 0) {
    return __BUILD_SHA__;
  }
  return fallback;
}

export function liveHeaders(): Record<string, string> {
  return { "Cache-Control": "no-store" };
}

export function livePayload(input: {
  connected: boolean;
  version?: string;
  buildSha?: string;
  timestamp?: string;
}): {
  status: "ok" | "error";
  version: string;
  component: string;
  build_sha: string;
  timestamp: string;
  database: { connected: boolean };
} {
  return {
    status: input.connected ? "ok" : "error",
    version: input.version ?? APP_VERSION,
    component: COMPONENT_NAME,
    build_sha: input.buildSha ?? resolveBuildSha(),
    timestamp: input.timestamp ?? new Date().toISOString(),
    database: { connected: input.connected },
  };
}

export function liveStatus(connected: boolean): 200 | 503 {
  return connected ? 200 : 503;
}
