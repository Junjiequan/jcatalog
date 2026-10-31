import { afterEach, describe, expect, it } from "vitest";
import { currentUser } from "@/lib/session";
import { useAuth } from "./auth";
import { useSelection } from "./selection";

afterEach(async () => {
  await useAuth.getState().signOut();
  localStorage.clear();
});

describe("signing in", () => {
  it("a demo account signs in and becomes the current user", async () => {
    const r = await useAuth.getState().signInDemo("admin@example.org");
    expect(r.ok).toBe(true);
    expect(useAuth.getState().session).toMatchObject({ email: "admin@example.org", role: "admin" });
    expect(currentUser().role).toBe("admin");
  });

  it("the password has to match, and the message does not say which part was wrong", async () => {
    const wrongPassword = await useAuth.getState().signIn("admin@example.org", "nope");
    const unknownEmail = await useAuth.getState().signIn("nobody@example.org", "nope");
    expect(wrongPassword).toEqual(unknownEmail);
    expect(wrongPassword.ok).toBe(false);
    expect(useAuth.getState().session).toBeNull();
  });

  it("emails are matched without regard to case or surrounding spaces", async () => {
    const r = await useAuth.getState().signInDemo("  Admin@Example.ORG ");
    expect(r.ok).toBe(true);
  });

  it("signing out empties the session and what the last person selected", async () => {
    await useAuth.getState().signInDemo("ada.okafor@example.org");
    useSelection.getState().toggleItem({ kind: "proposal", id: "X", name: "x", link: "/proposals/X" });
    await useAuth.getState().signOut();
    expect(useAuth.getState().session).toBeNull();
    expect(useSelection.getState().items).toEqual({});
    expect(currentUser().email).toBe("");
  });
});

describe("test sign-up", () => {
  const input = { name: "Jane Doe", email: "jane@example.org", password: "longenough1", role: "user" as const, withDemoData: false };

  it("creates an account that is signed in straight away and can sign in again", async () => {
    expect((await useAuth.getState().signUp(input)).ok).toBe(true);
    expect(useAuth.getState().session?.email).toBe("jane@example.org");
    await useAuth.getState().signOut();
    expect((await useAuth.getState().signIn("jane@example.org", "longenough1")).ok).toBe(true);
  });

  it.each([
    [{ name: "J" }, /name/i],
    [{ email: "not-an-email" }, /valid email/i],
    [{ password: "short" }, /8 characters/i],
    [{ email: "admin@example.org" }, /already an account/i],
  ])("refuses %j", async (bad, message) => {
    const r = await useAuth.getState().signUp({ ...input, ...bad });
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.error).toMatch(message);
  });

  it("a new account with sample data joins the sample groups; without, only its own", async () => {
    await useAuth.getState().signUp({ ...input, email: "with@example.org", withDemoData: true });
    expect(useAuth.getState().session?.groups).toEqual(["bio-sax", "ada-lab"]);
    await useAuth.getState().signOut();
    await useAuth.getState().signUp({ ...input, email: "without@example.org" });
    expect(useAuth.getState().session?.groups).toEqual(["jane-doe-lab"]);
  });
});
