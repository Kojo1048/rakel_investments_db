export const TIMEOUT_MINUTES_KEY = 'rakel_session_timeout_minutes';
export const TIMEOUT_ENABLED_KEY = 'rakel_session_timeout_enabled';
export const DEFAULT_TIMEOUT_MINUTES = 30;
// Minimum allowed idle timeout — prevents accidental sub-minute test values
export const MINIMUM_TIMEOUT_MINUTES = 5;
// Warning dialog appears this many seconds before the session expires
export const WARNING_SECONDS = 120;

export interface TimeoutConfig {
  enabled: boolean;
  minutes: number;
}

export function getTimeoutConfig(): TimeoutConfig {
  try {
    const enabled = localStorage.getItem(TIMEOUT_ENABLED_KEY) !== 'false'; // default: true
    const raw     = localStorage.getItem(TIMEOUT_MINUTES_KEY);
    const parsed  = raw ? parseInt(raw, 10) : NaN;

    // Reject stored values below the minimum floor (e.g. leftover "2" from testing).
    // Clamp to [MINIMUM_TIMEOUT_MINUTES, 480] and fall back to default if invalid.
    const minutes =
      !isNaN(parsed) && parsed >= MINIMUM_TIMEOUT_MINUTES
        ? Math.min(parsed, 480)
        : DEFAULT_TIMEOUT_MINUTES;

    return { enabled, minutes };
  } catch {
    return { enabled: true, minutes: DEFAULT_TIMEOUT_MINUTES };
  }
}

export function saveTimeoutConfig(enabled: boolean, minutes: number): void {
  try {
    const clamped = Math.min(480, Math.max(MINIMUM_TIMEOUT_MINUTES, minutes));
    localStorage.setItem(TIMEOUT_ENABLED_KEY, String(enabled));
    localStorage.setItem(TIMEOUT_MINUTES_KEY, String(clamped));
    // Signal same-tab listeners that config changed
    window.dispatchEvent(new CustomEvent('rakel:timeout-config-changed'));
  } catch {}
}

/** Wipes stored overrides so the next read returns the system default (30 min). */
export function clearTimeoutConfig(): void {
  try {
    localStorage.removeItem(TIMEOUT_MINUTES_KEY);
    localStorage.removeItem(TIMEOUT_ENABLED_KEY);
    window.dispatchEvent(new CustomEvent('rakel:timeout-config-changed'));
  } catch {}
}
