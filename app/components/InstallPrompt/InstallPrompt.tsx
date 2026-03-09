import { createElement } from "react";

export default function InstallPrompt() {
  return createElement("pwa-install", {
    id: "pwa-install",
    "manual-apple": "",
    "manual-chrome": "",
    "manifest-url": "/manifest.webmanifest",
    "install-description": "Install BMS on your device for quick access.",
  });
}
