import "dotenv/config";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import QRCode from "qrcode";
import { z } from "zod";
import { db } from "../src/server/db/client";
import { gatewayRequest } from "../src/server/providers/whatsapp/gateway";
import {
  WaError,
  gatewaySessionSchema as connectionSchema,
} from "@raunak/wa-contracts";

async function main() {
  const action = z
    .enum(["connect", "disconnect", "pairing", "status"])
    .parse(process.argv[2] || "status");
  const { id } = z
    .object({ id: z.uuid() })
    .parse(await gatewayRequest("/v1/sessions", { orgId: null }));
  const base = `/v1/sessions/${id}`;
  if (action === "status") {
    const { qr: _qr, ...status } = connectionSchema.parse(
      await gatewayRequest(base),
    );
    console.info(JSON.stringify({ ...status, qrAvailable: !!_qr }));
    return;
  }
  if (action === "disconnect") {
    await gatewayRequest(`${base}/disconnect`, { orgId: null });
    console.info("Platform number disconnected.");
    return;
  }
  await gatewayRequest(`${base}/connect`, { orgId: null });
  const directory = await mkdtemp(path.join(tmpdir(), "wa-platform-")),
    file = path.join(directory, "link.png");
  let lastQR = "",
    shown = false;
  try {
    for (const deadline = Date.now() + 60000; Date.now() < deadline;) {
      const status = connectionSchema.parse(await gatewayRequest(base));
      if (status.status === "CONNECTED") {
        console.info(`Connected: ${status.phone || "platform number"}`);
        return;
      }
      if (status.qr && action === "pairing") {
        const phone = z
          .string()
          .regex(/^\+[1-9]\d{7,14}$/)
          .parse(process.argv[3]);
        const { code } = z
          .object({ code: z.string() })
          .parse(
            await gatewayRequest(`${base}/pairing-code`, {
              orgId: null,
              phone,
            }),
          );
        console.info(
          `Enter this private pairing code in WhatsApp Linked devices: ${code}`,
        );
        return;
      }
      if (status.qr && status.qr !== lastQR) {
        lastQR = status.qr;
        await writeFile(
          file,
          await QRCode.toBuffer(lastQR, { width: 360, margin: 4 }),
          { mode: 0o600 },
        );
        if (!shown) {
          console.info(
            `Open this private QR image now: ${file}. It refreshes for one minute; keep this command running.`,
          );
          shown = true;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    console.info("Linking window expired. Run connect again for a fresh QR.");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
main()
  .catch((error) => {
    console.error(
      error instanceof WaError
        ? error.code
        : "Platform linking failed. Check gateway configuration and the supplied phone number.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
