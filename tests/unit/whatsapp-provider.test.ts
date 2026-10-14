import { afterEach, expect, it, vi } from "vitest";
import { whatsapp } from "@/server/providers/whatsapp/provider";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("uploads private ticket bytes and sends their media ID in the approved template header", async () => {
  vi.stubEnv("WHATSAPP_CLOUD_TOKEN", "test-token");
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123456");
  vi.stubEnv("WHATSAPP_API_VERSION", "v25.0");
  const request = vi.fn()
    .mockResolvedValueOnce(Response.json({ id: "private-media-id" }))
    .mockResolvedValueOnce(Response.json({ messages: [{ id: "wamid.test" }] }));
  vi.stubGlobal("fetch", request);
  const sent = await whatsapp.sendTemplate({
    to: "+919876543210",
    templateName: "raunak_ticket_v1",
    language: "en_US",
    params: ["Riya", "Music evening"],
    notificationId: "notification-id",
    document: { filename: "ticket.pdf", content: Buffer.from("%PDF-1.7\nticket") },
  });
  expect(sent.providerMessageId).toBe("wamid.test");
  expect(request.mock.calls[0][0]).toContain("/123456/media");
  const file = request.mock.calls[0][1].body.get("file") as File;
  expect(await file.text()).toContain("%PDF-");
  const payload = JSON.parse(request.mock.calls[1][1].body);
  expect(payload.template.components[0]).toEqual({
    type: "header",
    parameters: [{ type: "document", document: { id: "private-media-id", filename: "ticket.pdf" } }],
  });
  expect(payload.to).toBe("919876543210");
  expect(JSON.stringify(payload)).not.toContain("s3");
});
