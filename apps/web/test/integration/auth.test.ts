import { account as accountTable, createDb, ensureSchema, eq, user as userTable, type Db } from "@nordhem/db";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildAuth } from "../../lib/auth";

// Auth persistence against a real Postgres: the whole point of "the retailer
// owns its customer data" is that a sign-up writes OUR tables. We drive the
// real Better Auth config (buildAuth) — the same one the app mounts — so the
// adapter mapping, password hashing, and session issuance are all exercised.
// Google is deliberately NOT tested here: it is a third-party redirect flow.
let container: StartedPostgreSqlContainer;
let db: Db;
let close: () => Promise<void>;
let auth: ReturnType<typeof buildAuth>;

const EMAIL = "tester@nordhem.test";
const PASSWORD = "correct-horse-battery";
const NAME = "Test Shopper";

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:17").start();
  ({ db, close } = createDb(container.getConnectionUri()));
  await ensureSchema(db);
  auth = buildAuth(db);
}, 240_000);

afterAll(async () => {
  await close?.();
  await container?.stop();
});

/** A Set-Cookie header reduced to the `name=value` a Cookie header carries. */
function cookieHeader(setCookie: string | null): string {
  if (!setCookie) throw new Error("expected a Set-Cookie on the auth response");
  return setCookie.split(";")[0];
}

describe("email + password auth over Postgres", () => {
  let sessionCookie: string;

  it("signing up writes the user, a hashed-password account, and a session", async () => {
    const res = await auth.api.signUpEmail({
      body: { email: EMAIL, password: PASSWORD, name: NAME },
      asResponse: true,
    });
    expect(res.status).toBe(200);
    sessionCookie = cookieHeader(res.headers.get("set-cookie"));

    const users = await db.select().from(userTable).where(eq(userTable.email, EMAIL));
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe(NAME);

    const accounts = await db
      .select()
      .from(accountTable)
      .where(eq(accountTable.userId, users[0].id));
    expect(accounts).toHaveLength(1);
    // The password is stored on `account`, hashed — never the plaintext.
    expect(accounts[0].password).toBeTruthy();
    expect(accounts[0].password).not.toBe(PASSWORD);
  });

  it("getSession returns the signed-up user for that session cookie", async () => {
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: sessionCookie }),
    });
    expect(session?.user.email).toBe(EMAIL);
  });

  it("signing in with the right password succeeds", async () => {
    const res = await auth.api.signInEmail({
      body: { email: EMAIL, password: PASSWORD },
      asResponse: true,
    });
    expect(res.status).toBe(200);
  });

  it("signing in with the wrong password is rejected", async () => {
    await expect(
      auth.api.signInEmail({
        body: { email: EMAIL, password: "wrong-password" },
      }),
    ).rejects.toThrow();
  });
});
