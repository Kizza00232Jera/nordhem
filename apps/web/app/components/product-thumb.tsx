import Image from "next/image";

/**
 * A small square product thumbnail for studio lists (curations, learning loop,
 * etc.). Falls back to a quiet linen placeholder when a product has no image,
 * so rows stay aligned. Sized via a Tailwind size-* class (default 40px).
 */
export function ProductThumb({
  src,
  sizeClass = "size-10",
  px = 40,
}: {
  src?: string | null;
  sizeClass?: string;
  px?: number;
}) {
  return (
    <span className={`relative ${sizeClass} shrink-0 overflow-hidden rounded-xs bg-linen`}>
      {src && <Image src={src} alt="" fill sizes={`${px}px`} className="object-cover" />}
    </span>
  );
}
