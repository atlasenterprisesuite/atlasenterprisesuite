import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const agents = [
  "atlas-implementer",
  "atlas-reviewer",
  "atlas-qa",
  "atlas-security",
  "atlas-deployment",
];

const skills = [
  "atlas-master-command",
  "atlas-architecture",
  "atlas-testing",
  "atlas-manager",
  "atlas-production-truth",
];

describe("ATLAS GitHub Copilot repository configuration", () => {
  it("defines repository-wide ATLAS governance instructions", () => {
    const path = ".github/copilot-instructions.md";
    expect(existsSync(join(root, path))).toBe(true);
    const content = read(path);
    expect(content).toContain("atlasenterprisesuite/atlasenterprisesuite");
    expect(content).toContain("ATLAS_MANAGER_SPEC.md");
    expect(content).toContain("ATLAS_CANONICAL_REPOSITORY.md");
    expect(content).toContain("Never fabricate");
    expect(content).toContain("Never expose or commit credentials");
  });

  it.each(agents)("defines valid %s agent profile", (agent) => {
    const path = `.github/agents/${agent}.agent.md`;
    expect(existsSync(join(root, path))).toBe(true);
    const content = read(path);
    expect(content.startsWith("---\n")).toBe(true);
    expect(content).toMatch(/\ndescription:\s*.+/);
    expect(content).toContain("ATLAS");
    expect(content).toContain("production");
  });

  it.each(skills)("defines valid %s skill", (skill) => {
    const path = `.github/skills/${skill}/SKILL.md`;
    expect(existsSync(join(root, path))).toBe(true);
    const content = read(path);
    expect(content.startsWith("---\n")).toBe(true);
    expect(content).toContain(`name: ${skill}`);
    expect(content).toMatch(/\ndescription:\s*.+/);
  });

  it("does not introduce repository-stored provider secrets", () => {
    const files = [
      ".github/copilot-instructions.md",
      ...agents.map((agent) => `.github/agents/${agent}.agent.md`),
      ...skills.map((skill) => `.github/skills/${skill}/SKILL.md`),
    ];
    const forbidden = [
      /BEGIN (RSA|OPENSSH|EC) PRIVATE KEY/,
      /gh[pousr]_[A-Za-z0-9_]{20,}/,
      /sk-[A-Za-z0-9_-]{20,}/,
    ];
    for (const file of files) {
      const content = read(file);
      for (const pattern of forbidden) expect(content).not.toMatch(pattern);
    }
  });
});
