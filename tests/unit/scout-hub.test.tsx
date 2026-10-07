import {
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScoutHub } from "@/components/halisia/scout-hub";

const mock = vi.hoisted(() => ({
  buyer: "buyer",
  scout: "scout",
  failing: false,
  assigned: false,
  insert: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const req = {
        id: "job-1",
        title_reference: "LR TEST",
        county: "Kajiado",
        status: mock.assigned ? "in_progress" : "quoted",
        buyer_id: "buyer",
        scout_id: mock.assigned ? "scout" : null,
        quote: {
          total_kes: 1150,
          scout_work_kes: 1000,
          platform_fee_kes: 150,
          tasks: [],
        },
        task_results: {},
        scout_summary: null,
        payout_status: "none",
        paid_amount_kes: 0,
      };
      const data =
        table === "scout_requests"
          ? [req]
          : table === "scout_profiles"
            ? [
                {
                  user_id: "scout",
                  display_name: "Test Scout",
                  status: "approved",
                  service_counties: ["Kajiado"],
                },
              ]
            : table === "scout_service_settings"
              ? { id: true, payments_enabled: false, payment_instructions: "" }
              : [];
      const result = {
        data,
        error: mock.failing ? { message: "Connection unavailable" } : null,
      };
      const chain: Record<string, unknown> = {
        then: (resolve: (v: unknown) => void) =>
          Promise.resolve(result).then(resolve),
      };
      for (const key of ["select", "order", "eq", "single", "update", "delete"])
        chain[key] = () => chain;
      chain.insert = mock.insert;
      return chain;
    },
    storage: { from: () => ({ upload: mock.upload }) },
    rpc: vi.fn(),
  },
}));

function mount(uid = "buyer") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    <QueryClientProvider client={client}>
      <ScoutHub uid={uid} isAdmin={false} />
    </QueryClientProvider>,
  );
  return client;
}
beforeEach(() => {
  mock.failing = false;
  mock.assigned = false;
  mock.insert.mockReset();
  mock.upload.mockReset();
  localStorage.clear();
});
afterEach(() => cleanup());

describe("scout service screens", () => {
  it("keeps payment acceptance disabled until genuine payment instructions are configured", async () => {
    mount();
    await screen.findByText(/Quote-only mode/);
    fireEvent.click(screen.getByRole("button", { name: /LR TEST/ }));
    expect(
      await screen.findByRole("button", { name: "Accept quote" }),
    ).toBeDisabled();
    expect(screen.queryByText(/Administration:/)).not.toBeInTheDocument();
  });
  it("shows a recoverable connection error instead of an empty workspace", async () => {
    mock.failing = true;
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Connection unavailable",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  });
  it("blocks testimony without consent before uploading or saving anything", async () => {
    mock.assigned = true;
    mount("scout");
    fireEvent.click(await screen.findByRole("button", { name: /LR TEST/ }));
    fireEvent.change(await screen.findByLabelText("Source type"), {
      target: { value: "testimony" },
    });
    fireEvent.change(screen.getByLabelText("Description and source"), {
      target: { value: "Interview with local resident" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Save evidence / retry pending files",
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Confirm informed interview consent",
      ),
    );
    expect(mock.upload).not.toHaveBeenCalled();
    expect(mock.insert).not.toHaveBeenCalled();
  });
});
