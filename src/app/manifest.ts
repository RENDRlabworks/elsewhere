import type { MetadataRoute } from "next";

/**
 * Installable on a phone's home screen. Once installed, Elsewhere appears in the
 * share sheet: photos, links and text shared to it land in the ideas inbox.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Elsewhere",
    short_name: "Elsewhere",
    description: "Familiar things. Impossible worlds.",
    start_url: "/studio",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#060607",
    theme_color: "#060607",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Capture an idea", url: "/inbox?capture=1" },
      { name: "Review new images", url: "/archive/review" },
    ],
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [{ name: "photos", accept: ["image/*"] }],
      },
    },
  };
}
