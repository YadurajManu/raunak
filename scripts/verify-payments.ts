import "dotenv/config";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { cashfree } from "../src/server/providers/payments/cashfree";

async function main() {
  const env = process.env;
  assert.equal(env.CASHFREE_ENV, "production");
  assert.ok(env.CASHFREE_APP_ID && env.CASHFREE_SECRET_KEY && env.APP_URL);
  const response = await fetch(`https://api.cashfree.com/pg/orders/raunak_check_${randomUUID()}`, {
    headers: {
      "x-client-id": env.CASHFREE_APP_ID,
      "x-client-secret": env.CASHFREE_SECRET_KEY,
      "x-api-version": env.CASHFREE_API_VERSION || "2026-01-01",
    },
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  assert.equal(response.status, 404, "Cashfree must authenticate the request before reporting the missing order.");
  assert.equal(result.code, "order_not_found");
  const endpoint = `${env.APP_URL}/api/webhooks/cashfree`;
  const reachable = await fetch(endpoint, { signal: AbortSignal.timeout(15000) });
  assert.equal(reachable.status, 200, "The endpoint must answer read-only reachability checks.");
  const raw = JSON.stringify({
    type: "PAYMENT_SUCCESS_WEBHOOK",
    data: {
      order: { order_id: `raunak_check_${randomUUID()}`, order_currency: "INR" },
      payment: { cf_payment_id: randomUUID(), payment_status: "SUCCESS", payment_amount: 1, payment_currency: "INR" },
    },
  });
  const timestamp = String(Date.now());
  const signature = createHmac("sha256", env.CASHFREE_SECRET_KEY).update(timestamp + raw).digest("base64");
  const invalid = await fetch(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: raw,
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(invalid.status, 401, "Unsigned payment notifications must be rejected.");
  const valid = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-webhook-timestamp": timestamp, "x-webhook-signature": signature },
    body: raw,
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(valid.status, 200, "Signed notifications for unrelated orders must be acknowledged without creating tickets.");
  if (process.argv.includes("--create-order")) {
    const check = await cashfree.createOrder({ orderId:randomUUID(), amountPaise:500, customerId:randomUUID(), name:"Integration check", email:"check@example.com", phone:"9876543210", returnUrl:`${env.APP_URL}/discover`, notifyUrl:endpoint, expiresAt:new Date(Date.now()+20*60*1000) });
    assert.ok(check.paymentSessionId);
    console.log("Cashfree created a valid unpaid checkout session with a 20-minute expiry. No payment was attempted.");
  }
  console.log("Live Cashfree checks passed: production credentials accepted; unsigned webhook rejected; signed unrelated notification safely acknowledged. No payment was created or charged.");
}

main().catch(() => {
  console.error("Cashfree live checks failed. Inspect provider configuration and webhook availability.");
  process.exitCode = 1;
});
