export function shouldRefreshServerSession(input: {
  event: string;
  hasSession: boolean;
  serverHasSession: boolean;
}): boolean {
  if (input.event === "SIGNED_OUT") return true;
  if (input.serverHasSession || !input.hasSession) return false;
  return (
    input.event === "INITIAL_SESSION" ||
    input.event === "SIGNED_IN" ||
    input.event === "TOKEN_REFRESHED"
  );
}
