"use client";

import { AccentProvider } from "@nocoo/basalt/providers/accent";
import { LinkProvider } from "@nocoo/basalt/providers/link";
import { ThemeProvider } from "@nocoo/basalt/providers/theme";
import Link from "next/link";
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

function NextLinkAdapter({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <AccentProvider>
          <LinkProvider render={NextLinkAdapter}>{children}</LinkProvider>
        </AccentProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
