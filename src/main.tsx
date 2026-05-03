import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import "./index.css";
import { IndexPage } from "./pages/Index";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <IndexPage />
    <Toaster richColors position="top-right" />
  </React.StrictMode>
);
