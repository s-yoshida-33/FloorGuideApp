// src/api/bridgeState.ts
// Shared mutable state for the Bridge-Ground connection.
// Used by useBridgeRegistration (writer) and logging (reader) to avoid
// circular imports between those two modules.

export const bridgeState = {
  baseUrl: '',
  appId: null as string | null,
};
