import { describe, it, expect } from "vitest";
import { parametersRenderer } from "../src/server/section-renderers/parameters.js";
import {
  functionDecl,
  functionWithParamsDecl,
} from "./fixtures/type-fixtures.js";

describe("parametersRenderer", () => {
  it("has the correct key and heading", () => {
    expect(parametersRenderer.key).toBe("parameters");
    expect(parametersRenderer.heading).toBe("Parameters");
  });

  it("returns empty string when function has no parameters", async () => {
    const result = await parametersRenderer.render(functionDecl, {});
    expect(result).toBe("");
  });

  it("renders function parameters", async () => {
    const result = await parametersRenderer.render(functionWithParamsDecl, {});
    expect(result).toContain("## Parameters");
    expect(result).toContain(
      "`showToast` accepts the following parameters:",
    );
    expect(result).toContain("### config");
    expect(result).toContain("### duration");
  });

  it("shows parameter description", async () => {
    const result = await parametersRenderer.render(functionWithParamsDecl, {});
    expect(result).toContain("Configuration object for the toast.");
  });

  it("shows type info for parameters with both description and type", async () => {
    const result = await parametersRenderer.render(functionWithParamsDecl, {});
    expect(result).toContain(
      "`config` has a type of `ToastConfig`.",
    );
  });

  it("marks optional parameters", async () => {
    const result = await parametersRenderer.render(functionWithParamsDecl, {});
    expect(result).toContain("This parameter is **optional**.");
  });

  it("shows default value", async () => {
    const result = await parametersRenderer.render(functionWithParamsDecl, {});
    expect(result).toContain("Default value: `3000`.");
  });

  it("returns empty string when parameters is undefined", async () => {
    const noParams = {
      kind: "function",
      name: "noOp",
      description: "Does nothing.",
    };
    const result = await parametersRenderer.render(noParams, {});
    expect(result).toBe("");
  });
});
