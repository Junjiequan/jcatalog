import { beforeEach, describe, expect, it } from "vitest";
import { canCreateDatasets, canManage, isAdmin } from "./permissions";
import { setCurrentUser } from "./session";

const as = (role: "admin" | "user", groups: string[] = []) => setCurrentUser({ name: "T", email: "t@example.org", role, groups });
beforeEach(() => as("user"));

describe("what the screen offers", () => {
  it("an administrator can do anything", () => {
    as("admin");
    expect(isAdmin()).toBe(true);
    expect(canManage("any-group")).toBe(true);
    expect(canCreateDatasets()).toBe(true);
  });
  it("a user manages only the groups they belong to", () => {
    as("user", ["ada-lab"]);
    expect(canManage("ada-lab")).toBe(true);
    expect(canManage("nilsson-mat")).toBe(false);
  });
  it("only an administrator creates datasets", () => {
    as("user", ["ada-lab"]);
    expect(canCreateDatasets()).toBe(false);
  });
  it("nobody signed in manages nothing", () => {
    setCurrentUser(null);
    expect(canManage("ada-lab")).toBe(false);
  });
});
