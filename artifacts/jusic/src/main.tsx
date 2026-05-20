import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { APP_SHORT_NAME } from "./lib/brand";
import { migrateStorageKeysOnce } from "./lib/storage-keys";

migrateStorageKeysOnce();

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js?v=10`, {
        scope: import.meta.env.BASE_URL,
        updateViaCache: "none",
      })
      .then((registration) => {
        registration.update().catch(() => undefined);
      })
      .catch((error) => {
        console.warn(`${APP_SHORT_NAME} service worker registration failed`, error);
      });
  });
}
