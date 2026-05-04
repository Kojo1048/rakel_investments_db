export const TIMEOUT_MINUTES_KEY = 'rakel_session_timeout_minutes';
export const TIMEOUT_ENABLED_KEY = 'rakel_session_timeout_enabled';
export const DEFAULT_TIMEOUT_MINUTES = 30;
// Warning appears this many seconds before the session expires
export const WARNING_SECONDS = 120;

export interface TimeoutConfig {
  enabled: boolean;
  minutes: number;
}

export function getTimeoutConfig(): TimeoutConfig {
  try {
    const enabled = localStorage.getItem(TIMEOUT_ENABLED_KEY) !== 'false'; // default: true
    const raw = localStorage.getItem(TIMEOUT_MINUTES_KEY);
    const minutes = raw
      ? Math.max(1, parseInt(raw, 10) || DEFAULT_TIMEOUT_MINUTES)
      : DEFAULT_TIMEOUT_MINUTES;
    return { enabled, minutes };
  } catch {
    return { enabled: true, minutes: DEFAULT_TIMEOUT_MINUTES };
  }
}

export function saveTimeoutConfig(enabled: boolean, minutes: number): void {
  try {
    localStorage.setItem(TIMEOUT_ENABLED_KEY, String(enabled));
    localStorage.setItem(TIMEOUT_MINUTES_KEY, String(Math.max(1, minutes)));
    // Signal same-tab listeners that config changed
    window.dispatchEvent(new CustomEvent('rakel:timeout-config-changed'));
  } catch {}
}
