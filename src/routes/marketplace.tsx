import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "AI Marketplace · HALISIA AI" },
      {
        name: "description",
        content:
          "Browse land, houses, rentals and commercial property across Kenya. Every listing shows its source and how complete its details are.",
      },
      { property: "og:title", content: "AI Marketplace · HALISIA AI" },
      {
        property: "og:description",
        content:
          "Land, houses, rentals and commercial property across Kenya, with each listing's source and how complete its details are.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Outlet />,
});
