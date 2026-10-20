import { AccentProvider } from "@nocoo/basalt/providers/accent";
import { LinkProvider } from "@nocoo/basalt/providers/link";
import { ThemeProvider } from "@nocoo/basalt/providers/theme";
import type { ComponentProps, ReactNode } from "react";
import { Link } from "react-router";
import { AuthProvider } from "@/lib/auth-context";

function RouterLinkAdapter({ href, ...props }: ComponentProps<"a"> & { href: string }) {
  return <Link to={href} {...props} />;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AccentProvider accent="primary" persist={false}>
          <LinkProvider render={RouterLinkAdapter}>{children}</LinkProvider>
        </AccentProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
