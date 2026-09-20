import "@fontsource-variable/inter/index.css";
import "@fontsource-variable/dm-sans/index.css";
import "@/app/globals.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { Providers } from "@/components/providers";
import { routes } from "./routes";

const router = createBrowserRouter(routes);

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element #root not found");
}

createRoot(container).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
