import { SearchEventSchema } from "@nordhem/shared";
import { db } from "../../../lib/db";
import { recordEvent } from "../../../lib/events-repo";

/**
 * First-party search telemetry sink (Step 10). The storefront fires search and
 * click events here via `navigator.sendBeacon`. Writes to Postgres (Neon in
 * prod), so analytics keeps recording even in lite mode when the PC search
 * service is down.
 *
 * Telemetry is best-effort: a malformed or failed event must never disturb the
 * shopper, so we validate, record only valid events, swallow errors, and always
 * answer 204. (sendBeacon ignores the response body anyway.)
 */
export async function POST(request: Request) {
  try {
    const parsed = SearchEventSchema.safeParse(await request.json());
    if (parsed.success) {
      await recordEvent(db(), parsed.data);
    }
  } catch {
    // ignore: telemetry must not become a feature that can break.
  }
  return new Response(null, { status: 204 });
}
