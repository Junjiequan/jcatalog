import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderApp, resetApp } from "@/test/app";
import { useAuth } from "@/store/auth";

afterEach(resetApp);

describe("signing in", () => {
  it("sends a visitor who is not signed in to the login page, and back afterwards", async () => {
    const { user } = await renderApp("/proposals", { as: null });
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/login");
    await user.type(screen.getByLabelText("Email"), "admin@example.org");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/don't match an account/i);
    expect(useAuth.getState().session).toBeNull();
  });

  it("offers the demo accounts and signs in with one click", async () => {
    const { user } = await renderApp("/login", { as: null });
    const demo = await screen.findByRole("button", { name: /Facility Administrator/ });
    expect(within(demo).getByText("Administrator")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dr\. Ada Okafor/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dr\. Henrik Nilsson/ })).toBeInTheDocument();
    await user.click(demo);
    await waitFor(() => expect(useAuth.getState().session?.role).toBe("admin"));
    expect(await screen.findByRole("heading", { name: "Datasets" })).toBeInTheDocument();
  });

  it("goes back to the page that asked for the login", async () => {
    const { user } = await renderApp("/samples", { as: null });
    await user.click(await screen.findByRole("button", { name: /Dr\. Ada Okafor/ }));
    expect(await screen.findByRole("heading", { name: "Samples" })).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/samples");
  });

  it("creates a test account and signs it in", async () => {
    const { user } = await renderApp("/login", { as: null });
    await user.click(await screen.findByRole("tab", { name: "Create test account" }));
    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email"), "jane.page@example.org");
    await user.type(screen.getByLabelText("Password"), "longenough1");
    await user.click(screen.getByRole("button", { name: /Create account and sign in/ }));
    await waitFor(() => expect(useAuth.getState().session?.name).toBe("Jane Doe"));
  });

  it("says what is wrong with a test account", async () => {
    const { user } = await renderApp("/login", { as: null });
    await user.click(await screen.findByRole("tab", { name: "Create test account" }));
    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email"), "jane@example.org");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: /Create account and sign in/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/8 characters/);
  });

  it("shows or hides the password", async () => {
    const { user } = await renderApp("/login", { as: null });
    const field = await screen.findByLabelText("Password");
    expect(field).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(field).toHaveAttribute("type", "text");
  });
});
