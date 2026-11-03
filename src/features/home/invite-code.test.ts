import { describe, expect, it } from "vitest";
import { inviteCode } from "./invite-code";

describe("inviteCode", () => {
  it("accepte un lien complet ou un code seul", () => {
    expect(inviteCode("https://discord.gg/hTKzmak")).toBe("hTKzmak");
    expect(inviteCode("discord.gg/hTKzmak")).toBe("hTKzmak");
    expect(inviteCode("https://discord.com/invite/hTKzmak/")).toBe("hTKzmak");
    expect(inviteCode("  hTKzmak  ")).toBe("hTKzmak");
  });

  it("refuse le vide, les caractères étrangers et les autres domaines", () => {
    expect(inviteCode("")).toBeNull();
    expect(inviteCode("h")).toBeNull();
    expect(inviteCode("https://example.com/hTKzmak")).toBeNull();
    expect(inviteCode("https://discord.gg/abc?x=1")).toBeNull();
  });
});
