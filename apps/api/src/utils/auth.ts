import { SessionRepository } from "@repo/infrastructure";

export interface SessionContext {
  sessionId: string;
  userId: string;
  address: string;
}

/**
 * Shared session lookup utility. Reads `x-session-id` from header, query, or
 * body, validates it against the SessionRepository, and returns the context.
 *
 * All route files should use this instead of duplicating the lookup logic.
 */
export async function getSessionContext(
  req: any,
  sessionRepo?: SessionRepository,
): Promise<SessionContext | null> {
  const sessionId =
    req.headers?.["x-session-id"] ||
    req.query?.sessionId ||
    req.body?.sessionId;
  if (!sessionId) return null;
  const repo = sessionRepo || new SessionRepository();
  const session = await repo.getSessionById(String(sessionId));
  if (!session || session.status !== "authorized") return null;
  if (!session.userId || !session.address) return null;
  return {
    sessionId: String(sessionId),
    userId: String(session.userId),
    address: String(session.address).toLowerCase(),
  };
}
