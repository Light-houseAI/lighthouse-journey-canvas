import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./utils/test-helpers"; // Import test helpers to make them globally available

createRoot(document.getElementById("root")!).render(<App />);
