import "./index.css";

import { createRoot } from "react-dom/client";

import App from "./App";

// MSW completely disabled - using real server API
async function enableMocking() {
  // MSW disabled - using real server API
  return
}

enableMocking().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
