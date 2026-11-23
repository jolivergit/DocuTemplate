import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeProjectHistoryTracking } from "./lib/project-history";
import { Router as LocationRouter } from "wouter";
import { useProjectBrowserLocation } from "./hooks/use-project-browser-location";

initializeProjectHistoryTracking();
createRoot(document.getElementById("root")!).render(<LocationRouter hook={useProjectBrowserLocation}><App /></LocationRouter>);
