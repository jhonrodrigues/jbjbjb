import { describe, expect, it } from "vitest";
import { formCheckbox, formOptional, formString } from "@/lib/forms";

describe("form helpers", () => {
  it("reads trimmed strings", () => {
    const data = new FormData();
    data.set("name", "  Teste  ");
    expect(formString(data, "name")).toBe("Teste");
    expect(formString(data, "missing")).toBe("");
  });

  it("reads checkbox values", () => {
    const data = new FormData();
    data.set("enabled", "on");
    expect(formCheckbox(data, "enabled")).toBe(true);
    expect(formCheckbox(data, "disabled")).toBe(false);
  });

  it("returns null for empty optional fields", () => {
    const data = new FormData();
    expect(formOptional(data, "notes")).toBeNull();
    data.set("notes", " conteúdo ");
    expect(formOptional(data, "notes")).toBe("conteúdo");
  });
});
