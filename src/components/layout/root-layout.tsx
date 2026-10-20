import { Toaster } from "@nocoo/basalt/components/toast";
import { Outlet } from "react-router";
import { CommandPalette } from "@/components/command-palette";

/**
 * RootLayout renders inside RouterProvider so that components
 * relying on React Router navigation hooks (like CommandPalette)
 * have full access to RouterContext.
 */
export function RootLayout() {
  return (
    <>
      <Outlet />
      <CommandPalette />
      <Toaster />
    </>
  );
}
