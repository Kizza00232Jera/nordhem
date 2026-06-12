const eur = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
});

export function formatPrice(cents: number): string {
  return eur.format(cents / 100);
}
