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
  const selected = pathname
    ? pathname === href ||
      (!exact && href !== "/account" && pathname.startsWith(`${href}/`))
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
