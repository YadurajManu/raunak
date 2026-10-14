import { expect, it } from "vitest";
import { boundedFormData } from "@/server/http/form-data";
it("enforces upload limits even without a Content-Length header", async () => {
  const body = new FormData();
  body.set("file", new File(["more than ten bytes"], "test.txt"));
  await expect(
    boundedFormData(
      new Request("http://localhost/upload", { method: "POST", body }),
      10,
    ),
  ).rejects.toThrow("too large");
  const data = await boundedFormData(
    new Request("http://localhost/upload", { method: "POST", body }),
    1024,
  );
  expect((data.get("file") as File).name).toBe("test.txt");
});
