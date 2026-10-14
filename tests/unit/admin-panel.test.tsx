import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, it, expect, vi } from "vitest";
import { Route } from "@/routes/admin";
const state = vi.hoisted(() => ({
  user: { id: "admin", email: "admin@example.com" } as {
    id: string;
    email: string;
  } | null,
  ready: false,
  rpc: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: state.user, loading: false }),
}));
vi.mock("@/components/halisia/admin-security", () => ({
  AdminSecurity: () => <div>Security setup</div>,
}));
vi.mock("@/components/halisia/scout-hub", () => ({
  ScoutHub: () => <div>Scout controls</div>,
}));
vi.mock("@/lib/admin", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/admin")>();
  return {
    ...original,
    adminRpc: (name: string, args: unknown) => {
      state.rpc(name, args);
      if (name === "halisia_admin_status")
        return Promise.resolve({ eligible: true, ready: state.ready });
      if (name === "halisia_admin_overview")
        return Promise.resolve({ accounts: 1, payments_enabled: false });
      return Promise.resolve({
        rows: [{ id: "client", email: "client@example.com", roles: ["explorer"] }],
        total: 1,
        offset: 0,
      });
    },
  };
});
const Page = Route.options.component!;
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    <QueryClientProvider client={client}>
      <Page />
    </QueryClientProvider>,
  );
}
afterEach(() => {
  cleanup();
  state.user = { id: "admin", email: "admin@example.com" };
  state.ready = false;
  vi.clearAllMocks();
});
describe("Master administrator access", () => {
  it("offers account sign-in without querying privileged records", () => {
    state.user = null;
    mount();
    expect(screen.getByRole("link", { name: "Sign in / register" })).toBeInTheDocument();
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("keeps account records and mutation controls hidden until MFA", async () => {
    mount();
    await screen.findByText("Security setup");
    expect(screen.queryByLabelText("Resource")).not.toBeInTheDocument();
    expect(state.rpc.mock.calls.every(([name]) => name === "halisia_admin_status")).toBe(true);
  });
  it("loads real record workspaces only after verified access", async () => {
    state.ready = true;
    mount();
    await screen.findByRole("heading", { name: "client@example.com" });
    expect(screen.getByRole("button", { name: "Suspend app access" })).toBeInTheDocument();
    await waitFor(() =>
      expect(state.rpc).toHaveBeenCalledWith("halisia_admin_read", {
        p_table: "accounts",
        p_offset: 0,
        p_user: null,
      }),
    );
  });
});
