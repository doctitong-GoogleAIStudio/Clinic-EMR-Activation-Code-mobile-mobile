import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import { isNative, installNativeBridges } from './native';

installNativeBridges();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register service worker for PWA functionality (not inside the Android or
// Windows desktop app, where the bundled assets are already local)
const isDesktop = /Electron/i.test(navigator.userAgent);
if (!isNative && !isDesktop) serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    // New version available - could show a toast notification here
    console.log('New version available! Refresh to update.');
  },
  onSuccess: (registration) => {
    console.log('App ready for offline use!');
  }
});
