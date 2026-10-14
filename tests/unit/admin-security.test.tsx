import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { AdminSecurity } from "@/components/halisia/admin-security";
const mock = vi.hoisted(() => ({
  update: vi.fn(),
  verify: vi.fn(),
  level: "aal2",
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: { email: "admin@example.com" } } }),
      updateUser: mock.update,
      mfa: {
        listFactors: async () => ({
          data: { totp: [{ id: "factor" }] },
          error: null,
        }),
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: mock.level },
          error: null,
        }),
        challengeAndVerify: mock.verify,
      },
    },
  },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mock.level = "aal2";
});
describe("Administrator credential controls", () => {
  it("does not enable password changes before MFA", () => {
    render(<AdminSecurity ready={false} onVerified={() => {}} />);
    expect(screen.getByRole("button", { name: "Save my password" })).toBeDisabled();
  });
  it("checks current assurance again before sending a password", async () => {
    mock.level = "aal1";
    render(<AdminSecurity ready onVerified={() => {}} />);
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "testing-strong-secret" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "testing-strong-secret" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save my password" }).closest("form")!);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save my password" })).not.toBeDisabled(),
    );
    expect(mock.update).not.toHaveBeenCalled();
  });
  it("rejects mismatched passwords before any credential update", async () => {
    render(<AdminSecurity ready onVerified={() => {}} />);
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "testing-strong-secret" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "different-strong-secret" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save my password" }).closest("form")!);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save my password" })).not.toBeDisabled(),
    );
    expect(mock.update).not.toHaveBeenCalled();
  });
});
