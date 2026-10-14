import { expect, it } from "vitest";
import { renderTemplate, escapeHtml } from "@/server/notifications/templates";
it("renders only approved variables and escapes email HTML", () => {
  expect(
    renderTemplate("Hi {{ attendee_name }}", { attendee_name: "Riya" }),
  ).toBe("Hi Riya");
  expect(() => renderTemplate("{{process.env}}", {})).toThrow(
    "Unsupported variable",
  );
  expect(escapeHtml('<img src=x onerror="x">')).toBe(
    "&lt;img src=x onerror=&quot;x&quot;&gt;",
  );
});
