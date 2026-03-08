import { createElement } from "react";

export default function InstallPrompt() {
  return createElement("pwa-install", {
    "use-local-storage": "",
    "manifest-url": "/manifest.webmanifest",
    "install-description": "Install BMS on your device for quick access.",
  });
}
