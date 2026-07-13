import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import "./styles.css";
import { getRouter } from "./router";

const router = getRouter();

// Gives the router's own types (useNavigate, <Link to>, etc.) knowledge of
// this app's concrete route tree — the same augmentation Start's generated
// client entry used to provide.
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element (#root) not found in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
