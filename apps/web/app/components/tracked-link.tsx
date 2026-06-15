"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { track } from "../../lib/track";

/**
 * A product link on the results grid that records a result_clicked event
 * (query, product, 1-based position) before letting navigation proceed (Step
 * 10). It does not preventDefault, so the click still routes to the PDP; the
 * beacon outlives the navigation.
 */
export function TrackedLink({
  href,
  query,
  productId,
  position,
  className,
  children,
}: {
  href: string;
  query: string;
  productId: number;
  position: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => track({ type: "click", query, productId, position })}
    >
      {children}
    </Link>
  );
}
