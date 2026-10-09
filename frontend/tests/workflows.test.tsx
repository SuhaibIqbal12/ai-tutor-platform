import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "../src/app/login/page";
import OnboardingPage from "../src/app/onboarding/page";
import DashboardLayout from "../src/app/(dashboard)/layout";
import DashboardPage from "../src/app/(dashboard)/dashboard/page";
import Sidebar from "../src/components/Sidebar";
import NoticeProvider, { useNotice } from "../src/components/NoticeProvider";
const router = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  prefetch: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/sources",
}));
vi.mock("@/lib/supabase", () => ({ supabase: null }));
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});
const response = (data: unknown, ok = true) =>
  new Response(JSON.stringify(data), {
    status: ok ? 200 : 401,
    headers: { "Content-Type": "application/json" },
  });
function enterCredentials() {
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "student@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "S3cure!$pass" },
  });
}
describe("student workflows", () => {
  it("keeps a failed sign-in visible without storing credentials or navigating", async () => {
    vi.mocked(fetch).mockResolvedValue(
      response({ message: "Invalid email or password." }, false) as Response,
    );
    render(<LoginPage />);
    enterCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Invalid email or password",
    );
    expect(localStorage.getItem("token")).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
    expect(vi.mocked(fetch).mock.calls[0][1]?.body).toBe(
      JSON.stringify({
        email: "student@example.test",
        password: "S3cure!$pass",
      }),
    );
  });
  it("creates an account and sends a new student to onboarding", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        response({
          data: {
            token: "test-session",
            user: { email: "student@example.test" },
          },
        }) as Response,
      )
      .mockResolvedValueOnce(
        response({ status: "success", data: { profile: null } }) as Response,
      );
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    enterCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/onboarding"),
    );
    expect(localStorage.getItem("token")).toBe("test-session");
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/auth/register");
  });
  it("preserves a zero CGPA and only saves after the final onboarding step", async () => {
    localStorage.setItem("token", "test-session");
    vi.mocked(fetch).mockResolvedValue(
      response({
        status: "success",
        data: {
          profile: { cgpa: 0, strongSubjects: "[]", weakSubjects: "[]" },
        },
      }) as Response,
    );
    render(
      <NoticeProvider>
        <OnboardingPage />
      </NoticeProvider>,
    );
    fireEvent.change(screen.getByLabelText("CGPA (out of 10)"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Subjects you’d like help with"), {
      target: { value: "DSA, SQL" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Open workspace" }));
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/dashboard"),
    );
    const sent = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(sent.cgpa).toBe(0);
    expect(sent.weakSubjects).toEqual(["DSA", "SQL"]);
  });
  it("shows an actionable dashboard error without fabricating activity", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Connection unavailable"));
    render(<DashboardPage />);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Connection unavailable",
    );
    expect(screen.getAllByText("—")).toHaveLength(4);
    expect(
      screen
        .getByRole("link", { name: /Open your tutor/ })
        .getAttribute("href"),
    ).toBe("/tutor");
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });
  it("keeps the session when the backend is unavailable and offers a retry", async () => {
    localStorage.setItem("token", "test-session");
    vi.mocked(fetch).mockRejectedValue(new Error("Backend unavailable"));
    render(
      <DashboardLayout>
        <p>Protected student view</p>
      </DashboardLayout>,
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Backend unavailable",
    );
    expect(localStorage.getItem("token")).toBe("test-session");
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.queryByText("Protected student view")).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
  it("marks the current library route and closes mobile navigation on Escape", () => {
    const close = vi.fn();
    render(<Sidebar isOpen onClose={close} />);
    expect(
      screen
        .getByRole("link", { name: "Your library" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(screen.queryByText(/Engine Synchronized/)).toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(close).toHaveBeenCalled();
  });
  it("announces a notification and allows it to be dismissed", () => {
    function Trigger() {
      const notify = useNotice();
      return (
        <button onClick={() => notify("Please retry your upload.")}>
          Notify
        </button>
      );
    }
    render(
      <NoticeProvider>
        <Trigger />
      </NoticeProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Notify" }));
    expect(screen.getByRole("alert").textContent).toContain(
      "Please retry your upload.",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss notification" }),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
