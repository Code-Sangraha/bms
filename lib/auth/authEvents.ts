/** Fired after access token or stored user outlet info is updated (e.g. silent refresh). */
export const AUTH_CONTEXT_UPDATED_EVENT = "bms-auth-context-updated";
export const AUTH_SESSION_EXPIRED_EVENT = "bms-auth-session-expired";

export const AUTH_SESSION_CHANGED_MESSAGE =
  "Your access or account has changed. Sign in again.";

export function notifyAuthContextUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_CONTEXT_UPDATED_EVENT));
}

export function notifyAuthSessionExpired(
  message = AUTH_SESSION_CHANGED_MESSAGE
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<string>(AUTH_SESSION_EXPIRED_EVENT, { detail: message })
  );
}
