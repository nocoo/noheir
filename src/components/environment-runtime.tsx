export type EnvironmentMode = "demo" | "e2e" | "prod";
export type LocalEnvironment = {
  id: string;
  mode: EnvironmentMode;
  locked: boolean;
  visible: boolean;
};
const preferenceKey = "noheir:environment-mode";
const instanceKey = "noheir:environment-instance";
let environment: LocalEnvironment | null = null;
let dirty = false;
let selectable = false;
export const canSelectEnvironment = () => selectable;

function read(store: "localStorage" | "sessionStorage", key: string) {
  try {
    return window[store].getItem(key);
  } catch {
    return null;
  }
}
function write(store: "localStorage" | "sessionStorage", key: string, value: string) {
  try {
    window[store].setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
export const currentEnvironment = () => environment;

export async function initializeEnvironment() {
  const response = await fetch("/__local/environment", { cache: "no-store" });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return;
  const config = await response.json();
  if (config.protocol !== "noheir-local-v1") return;
  selectable = config.visible && !config.locked;
  const handoff = new URLSearchParams(window.location.hash.slice(1)).get("noheir-instance");
  const selection = config.locked
    ? {}
    : {
        mode: read("localStorage", preferenceKey),
        instance: handoff ?? read("sessionStorage", instanceKey),
      };
  const started = await fetch("/__local/environment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "start", ...selection }),
  });
  if (!started.ok) throw new Error((await started.json()).error);
  environment = await started.json();
  if (handoff && !config.locked)
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  if (environment && !environment.locked) write("sessionStorage", instanceKey, environment.id);
  document.addEventListener("input", () => {
    dirty = true;
  });
  document.addEventListener("change", (event) => {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLSelectElement ||
      event.target instanceof HTMLTextAreaElement
    )
      dirty = true;
  });
}

export function environmentFetch(input: string, init?: RequestInit) {
  if (!environment) return fetch(input, init);
  const headers = new Headers(init?.headers);
  headers.set("x-noheir-instance", environment.id);
  return fetch(input, { ...init, headers });
}

export async function switchEnvironment(mode: EnvironmentMode) {
  if (!environment || environment.locked || environment.mode === mode) return;
  if (
    (dirty || document.querySelector('[role="dialog"]')) &&
    !window.confirm("丢弃未保存的修改并切换环境？")
  )
    return;
  const response = await fetch("/__local/environment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "switch", mode, instance: environment.id }),
  });
  const next = await response.json();
  if (!response.ok) throw new Error(next.error);
  write("localStorage", preferenceKey, next.mode);
  const saved = write("sessionStorage", instanceKey, next.id);
  if (saved) window.location.assign("/");
  else {
    window.history.replaceState(null, "", `/#noheir-instance=${encodeURIComponent(next.id)}`);
    window.location.reload();
  }
}

export async function selectInitialEnvironment(mode: EnvironmentMode) {
  if (!selectable) return;
  const response = await fetch("/__local/environment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "select", mode }),
  });
  const next = await response.json();
  if (!response.ok) throw new Error(next.error);
  write("localStorage", preferenceKey, next.mode);
  const saved = write("sessionStorage", instanceKey, next.id);
  if (saved) window.location.assign("/");
  else {
    window.history.replaceState(null, "", `/#noheir-instance=${encodeURIComponent(next.id)}`);
    window.location.reload();
  }
}
