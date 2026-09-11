import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://try-ballast.netlify.app";
  return ["", "/control-room", "/policy", "/log"].map((p) => ({
    url: base + p,
    lastModified: new Date(),
    changeFrequency: "hourly",
    priority: p === "" ? 1 : 0.7,
  }));
}
