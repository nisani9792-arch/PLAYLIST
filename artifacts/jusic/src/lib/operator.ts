const STORAGE_KEY = 'buildplay_operator_name';
const TRUSTED_DEVICE_KEY = 'buildplay_trusted_device';

let activeOperator: string | null =
  typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;

export function getOperatorName(): string | null {
  return activeOperator;
}

export function setOperatorName(name: string): void {
  activeOperator = name.trim().slice(0, 80) || null;
  if (typeof localStorage !== 'undefined' && activeOperator) {
    localStorage.setItem(STORAGE_KEY, activeOperator);
  }
}

/** Device completed unlock + registration at least once on this browser. */
export function isDeviceTrusted(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(TRUSTED_DEVICE_KEY) === '1';
}

export function markDeviceTrusted(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(TRUSTED_DEVICE_KEY, '1');
  }
}

export function operatorHeaders(): HeadersInit {
  return {};
}

export type AccessStatus =
  | { state: 'loading' }
  | { state: 'locked'; operatorName: string | null }
  | { state: 'register'; operatorName: null }
  | { state: 'ready'; operatorName: string }
  | { state: 'offline'; operatorName: string | null };

/** Sync saved name with server for this IP; fall back to offline workspace. */
export async function enterWithSavedOperator(cachedName: string): Promise<AccessStatus> {
  try {
    const name = await registerOperatorOnServer(cachedName);
    markDeviceTrusted();
    return { state: 'ready', operatorName: name };
  } catch {
    markDeviceTrusted();
    return { state: 'offline', operatorName: cachedName };
  }
}

export async function fetchAccessStatus(): Promise<AccessStatus> {
  const res = await fetch('/api/access/status', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('access status failed');
  const data = (await res.json()) as {
    state: string;
    operatorName: string | null;
  };
  if (data.state === 'ready' && data.operatorName) {
    setOperatorName(data.operatorName);
    return { state: 'ready', operatorName: data.operatorName };
  }
  return { state: 'locked', operatorName: null };
}

export async function registerOperatorOnServer(operatorName: string): Promise<string> {
  const res = await fetch('/api/access/register', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operatorName }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? 'registration failed');
  }
  const data = (await res.json()) as { operatorName: string };
  setOperatorName(data.operatorName);
  return data.operatorName;
}
