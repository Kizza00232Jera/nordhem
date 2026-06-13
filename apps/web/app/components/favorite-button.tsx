"use client";

import { Heart } from "lucide-react";
import { startTransition, useOptimistic, useState } from "react";
import {
  toggleFavoriteAction,
  type ToggleFavoriteResult,
} from "../actions/favorites";

export interface FavoriteButtonProps {
  productId: number;
  initialFavorited: boolean;
  /** Override the server action (tests inject a fake). */
  action?: (productId: number) => Promise<ToggleFavoriteResult>;
  /** Called when the action says login is required (default: go to /login). */
  onAuthRequired?: () => void;
  className?: string;
}

/**
 * The favorite heart. Optimistic: the fill flips the instant you click. The
 * Server Action is the source of truth — when it confirms, we adopt its state;
 * when it reports the user is signed out (ok:false), useOptimistic discards the
 * flip (rollback) and we send them to sign in.
 */
export function FavoriteButton({
  productId,
  initialFavorited,
  action = toggleFavoriteAction,
  onAuthRequired = () => window.location.assign("/login"),
  className = "",
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [optimistic, setOptimistic] = useOptimistic(favorited);

  function onClick() {
    startTransition(async () => {
      setOptimistic(!favorited);
      const result = await action(productId);
      if (!result.ok) {
        onAuthRequired();
        return; // optimistic flip reverts when the transition settles
      }
      setFavorited(result.favorited ?? !favorited);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={optimistic}
      aria-label={optimistic ? "Remove from favorites" : "Add to favorites"}
      className={`inline-flex items-center justify-center transition-colors duration-150 ${
        optimistic ? "text-error" : "text-ink-muted hover:text-ink"
      } ${className}`}
    >
      <Heart
        aria-hidden
        className="size-5"
        strokeWidth={1.75}
        fill={optimistic ? "currentColor" : "none"}
      />
    </button>
  );
}
