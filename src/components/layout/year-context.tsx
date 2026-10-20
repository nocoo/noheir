import { createContext, type ReactNode, useCallback, useContext, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

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

export function YearProvider({ children, years }: { children: ReactNode; years: number[] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const [searchParams] = useSearchParams();

  const availableYears = useMemo(() => (years.length > 0 ? years : [CURRENT_YEAR]), [years]);

  // Derive year from URL param or use first available year
  const urlYear = searchParams.get("year");
  const year = useMemo(() => {
    if (urlYear && availableYears.includes(Number(urlYear))) {
      return Number(urlYear);
    }
    return availableYears[0] ?? CURRENT_YEAR;
  }, [urlYear, availableYears]);

  const isYearEnabled = YEAR_ENABLED_PATHS.has(pathname);

  const setYear = useCallback(
    (newYear: number) => {
      // Update URL if on a year-enabled page
      if (YEAR_ENABLED_PATHS.has(pathname)) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("year", newYear.toString());
        navigate(`${pathname}?${params.toString()}`);
      }
    },
    [pathname, searchParams, navigate],
  );

  return (
    <YearContext.Provider value={{ year, years: availableYears, setYear, isYearEnabled }}>
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
