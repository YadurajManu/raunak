"use client";
import { useEffect, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cities } from "@/config/cities";
export function AccountCity({ initial }: { initial: string }) {
  const router = useRouter(),
    pathname = usePathname(),
    params = useSearchParams();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (params.has("city")) return;
    try {
      const remembered = localStorage.getItem("raunak-plans-city");
      if (
        remembered &&
        (remembered === "all" ||
          cities.some((city) => city.city === remembered)) &&
        remembered !== initial
      ) {
        const next = new URLSearchParams(params);
        next.set("city", remembered);
        router.replace(`${pathname}?${next}`, { scroll: false });
      }
    } catch {
      /* Browser storage is optional. */
    }
  }, [initial, params, pathname, router]);
  return (
    <label className="plans-city">
      Discover near
      <select
        value={initial}
        disabled={pending}
        onChange={(event) => {
          const city = event.target.value;
          try {
            localStorage.setItem("raunak-plans-city", city);
          } catch {
            /* Browser storage is optional. */
          }
          const next = new URLSearchParams(params);
          next.set("city", city);
          startTransition(() =>
            router.replace(`${pathname}?${next}`, { scroll: false }),
          );
        }}
      >
        <option value="all">All cities</option>
        {cities.map((city) => (
          <option key={city.city} value={city.city}>
            {city.city} · 50 km
          </option>
        ))}
      </select>
    </label>
  );
}
