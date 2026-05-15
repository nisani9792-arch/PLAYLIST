const STORAGE_KEY = 'buildplay_operator_name';

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

export function operatorHeaders(): HeadersInit {
  return {};
}

export type AccessStatus =
  | { state: 'loading' }
  | { state: 'locked'; operatorName: null }
  | { state: 'register'; operatorName: null }
  | { state: 'ready'; operatorName: string }
  | { state: 'offline'; operatorName: string | null };

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
