"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function NavigationLink({
  href,
  active,
  exact = false,
  className = "",
  children,
}: {
  href: string;
  active?: boolean;
  exact?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const route = href.startsWith("/") ? href.split(/[?#]/, 1)[0] || "/" : href;
  const selected = pathname
    ? pathname === route || (!exact && pathname.startsWith(`${route}/`))
    : active;
  return (
    <Link
      href={href}
      className={`${className}${selected ? " is-active" : ""}`.trim()}
      aria-current={selected ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
