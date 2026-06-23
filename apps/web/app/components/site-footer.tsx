import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-ink text-paper">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="text-lg font-bold tracking-[0.18em]">NORDHEM</p>
          <p className="mt-2 font-display text-[15px] italic text-paper/70">
            sleep, live, store
          </p>
        </div>
        <div className="text-[14px] leading-7 text-paper/70">
          <p>
            A portfolio storefront with a search-engineering brain. Catalog from
            the open WANDS research dataset; prices are simulated; photos are
            Unsplash interiors representing each product type, credited on every
            product page.
          </p>
        </div>
        <div className="text-[14px] leading-7">
          <p className="font-semibold text-paper">Behind the scenes</p>
          <ul className="mt-2 text-paper/70">
            <li>
              <Link href="https://github.com/Kizza00232Jera/nordhem" className="hover:text-paper">
                Source on GitHub
              </Link>
            </li>
            <li>
              <Link href="/search?q=hygge" className="hover:text-paper">
                Try the search
              </Link>
            </li>
            <li>
              <Link href="/status" className="hover:text-paper">
                Service status
              </Link>
            </li>
            <li>
              <Link href="/studio" className="hover:text-paper">
                Search Studio
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
