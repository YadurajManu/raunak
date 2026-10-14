import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import QRCode from "qrcode";
import {sendEmail} from "../src/server/providers/email/provider";
import {emailMarkup} from "../src/server/notifications/email-markup";
async function main() {
  assert.equal(process.env.EMAIL_PROVIDER,"resend");
  const input={to:"delivered+raunak@resend.dev",subject:"Raunak email integration check",text:"Integration check only. This QR does not admit entry.",html:emailMarkup("Integration check only. This QR does not admit entry.",{event_title:"Raunak integration check",event_date:"Test only",event_time:"",venue:"",city:"",quantity:"1",amount_paid:"₹0.00",order_id:"Test",ticket_url:`${process.env.APP_URL}/discover`,support_contact:"tickets@yaduraj.me"},true),attachments:[{filename:"test-qr.png",content:await QRCode.toBuffer("RAUNAK-EMAIL-TEST-NOT-A-TICKET"),contentId:"ticket-qr"}],idempotencyKey:randomUUID()};
  await sendEmail(input);
  await sendEmail(input);
  console.log("Resend accepted the branded email and inline QR at its test address; identical idempotency key reused successfully. No customer was emailed.");
}
main().catch(()=>{console.error("Resend verification failed. Check credentials and sender verification.");process.exitCode=1;});
