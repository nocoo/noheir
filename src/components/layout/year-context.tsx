"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { getAvailableYears } from "@/app/actions/get-available-years";

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Paths where the global year selector should be visible and year param applies.
 */
export const YEAR_ENABLED_PATHS = new Set([
  "/",
  "/savings",
  "/freedom",
  "/income",
  "/expense",
  "/flow",
  "/financial-health",
  "/ai-insight",
  "/account",
  "/account-detail",
]);

interface YearContextValue {
  year: number;
  years: number[];
  setYear: (year: number) => void;
  isYearEnabled: boolean;
}

const YearContext = createContext<YearContextValue | null>(null);

export function YearProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [years, setYears] = useState<number[]>([CURRENT_YEAR]);

  // Derive year from URL param or use first available year
  const urlYear = searchParams.get("year");
  const year = useMemo(() => {
    if (urlYear && years.includes(Number(urlYear))) {
      return Number(urlYear);
    }
    return years[0] ?? CURRENT_YEAR;
  }, [urlYear, years]);

  const isYearEnabled = YEAR_ENABLED_PATHS.has(pathname);

  // Fetch available years on mount
  useEffect(() => {
    getAvailableYears()
      .then((fetched) => {
        const sorted = fetched.length > 0 ? fetched : [CURRENT_YEAR];
        setYears(sorted);
      })
      .catch(() => setYears([CURRENT_YEAR]));
  }, []);

  const setYear = useCallback(
    (newYear: number) => {
      // Update URL if on a year-enabled page
      if (YEAR_ENABLED_PATHS.has(pathname)) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("year", newYear.toString());
        router.push(`${pathname}?${params.toString()}`);
      }
    },
    [pathname, searchParams, router],
  );

  return (
    <YearContext.Provider value={{ year, years, setYear, isYearEnabled }}>
      {children}
    </YearContext.Provider>
  );
}

export function useYear() {
  const context = useContext(YearContext);
  if (!context) {
    throw new Error("useYear must be used within a YearProvider");
  }
  return context;
}
