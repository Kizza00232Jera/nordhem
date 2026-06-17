import type { Metadata } from "next";
import { Fraunces, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import { getActiveCartId } from "../lib/cart-session";
import { getCartView } from "../lib/cart-view";
import { db } from "../lib/db";
import { CartDrawer } from "./components/cart-drawer";
import { CartProvider } from "./components/cart-provider";
import { ChatLauncher } from "./components/chat-launcher";
import { SiteFooter } from "./components/site-footer";
import { SiteHeader } from "./components/site-header";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "NORDHEM — sleep, live, store",
    template: "%s · NORDHEM",
  },
  description:
    "Nordic home goods with a search-engineering brain. Beds, sofas, lighting and more.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Seed the cart provider from the server so the badge and drawer are correct
  // on first paint (no empty-cart flash), then the client takes over.
  const initialCart = await getCartView(db(), await getActiveCartId());

  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${schibsted.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <CartProvider initialCart={initialCart}>
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
          <CartDrawer />
          <ChatLauncher />
        </CartProvider>
      </body>
    </html>
  );
}
