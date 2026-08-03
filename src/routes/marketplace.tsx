import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "AI Marketplace · HALISIA AI" },
      {
        name: "description",
        content:
          "Browse verified land, houses, rentals and commercial property across Kenya — every listing carries a Land Intelligence Score.",
      },
      { property: "og:title", content: "AI Marketplace · HALISIA AI" },
      {
        property: "og:description",
        content: "Kenya's AI-scored real estate marketplace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Outlet />,
});
