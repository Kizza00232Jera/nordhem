import { expect, test } from "@playwright/test";

// The Step 5 golden flow, end to end through real Elasticsearch + Postgres:
// sign up, search, open a product, add to cart, check out, and find the order
// in history; and separately, a favorite that survives a reload. Each test
// signs up its own user so they share no state.

const PASSWORD = "e2e-password-123";

function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@nordhem.test`;
}

async function signUp(page: import("@playwright/test").Page, email: string) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("E2E Shopper");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((url) => url.pathname === "/");
}

// The cart/favorite controls are client-only (optimistic), so wait for the
// CartProvider to mount before clicking them.
async function waitForHydration(page: import("@playwright/test").Page) {
  await page
    .locator("html[data-hydrated='true']")
    .waitFor({ state: "attached", timeout: 20_000 });
}

async function openFirstSearchResult(page: import("@playwright/test").Page) {
  await page.goto("/search?q=sofa");
  const firstResult = page.locator('main a[href^="/product/"]').first();
  await expect(firstResult).toBeVisible();
  await firstResult.click();
  await page.waitForURL(/\/product\//);
  await waitForHydration(page);
}

test("sign up, search, add to cart, checkout, and see the order in history", async ({
  page,
}) => {
  await signUp(page, uniqueEmail("buy"));

  await openFirstSearchResult(page);

  await page.getByRole("button", { name: "Add to cart" }).click();
  const drawer = page.getByRole("dialog", { name: "Shopping cart" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("link", { name: "Checkout" }).click();
  await page.waitForURL((url) => url.pathname === "/checkout");

  await page.getByLabel("Full name").fill("E2E Shopper");
  await page.getByLabel("Address", { exact: true }).fill("Storgata 1");
  await page.getByLabel("City").fill("Oslo");
  await page.getByLabel("Postal code").fill("0155");
  // Country defaults to NO.
  await page.getByRole("button", { name: "Place order" }).click();

  // Confirmation page with a real order number.
  await page.waitForURL(/\/orders\/NDH-\d{4}-\d{6}/);
  await expect(page.getByText(/your order is confirmed/i)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("NDH-");

  // The order shows up in history.
  await page.goto("/orders");
  await expect(page.getByText(/NDH-\d{4}-\d{6}/).first()).toBeVisible();
});

test("a favorite persists across a reload", async ({ page }) => {
  await signUp(page, uniqueEmail("fav"));
  await openFirstSearchResult(page);

  const favorite = page.getByRole("button", { name: "Add to favorites" }).first();
  await expect(favorite).toBeVisible();
  await favorite.click();

  // Optimistic + persisted: it becomes "Remove from favorites".
  const remove = page.getByRole("button", { name: "Remove from favorites" }).first();
  await expect(remove).toBeVisible();

  await page.reload();
  await waitForHydration(page);
  // After reload the server re-renders it as already favorited.
  await expect(
    page.getByRole("button", { name: "Remove from favorites" }).first(),
  ).toBeVisible();
});
