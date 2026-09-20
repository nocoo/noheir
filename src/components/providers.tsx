import { AccentProvider } from "@nocoo/basalt/providers/accent";
import { LinkProvider } from "@nocoo/basalt/providers/link";
import { ThemeProvider } from "@nocoo/basalt/providers/theme";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { AuthProvider } from "@/lib/auth-context";

function RouterLinkAdapter({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AccentProvider>
          <LinkProvider render={RouterLinkAdapter}>{children}</LinkProvider>
        </AccentProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
