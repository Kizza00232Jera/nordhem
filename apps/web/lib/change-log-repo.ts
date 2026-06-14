import { changeLog, desc } from "@nordhem/db";
import { db } from "./db";

export interface ChangeRow {
  id: number;
  entity: string;
  action: string;
  summary: string;
  detail: unknown;
  actor: string;
  createdAt: Date;
}

/** Append one entry to the audit trail. Never throws into the caller's flow. */
export async function logChange(
  entity: string,
  action: string,
  summary: string,
  detail?: unknown,
): Promise<void> {
  try {
    await db()
      .insert(changeLog)
      .values({ entity, action, summary, ...(detail !== undefined && { detail }) });
  } catch {
    // Auditing must never break the edit it is recording.
  }
}

export async function listChanges(limit = 100): Promise<ChangeRow[]> {
  return db()
    .select()
    .from(changeLog)
    .orderBy(desc(changeLog.createdAt), desc(changeLog.id))
    .limit(limit);
}
