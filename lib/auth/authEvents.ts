/** Fired after access token or stored user outlet info is updated (e.g. silent refresh). */
export const AUTH_CONTEXT_UPDATED_EVENT = "bms-auth-context-updated";

export function notifyAuthContextUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_CONTEXT_UPDATED_EVENT));
}
