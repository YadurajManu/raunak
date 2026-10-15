import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export function authorize(supplied: string | undefined, expected: string) {
  if (expected.length < 32 || !supplied?.startsWith("Bearer ")) return false;
  const actual = createHash("sha256").update(supplied.slice(7)).digest();
  return timingSafeEqual(
    actual,
    createHash("sha256").update(expected).digest(),
  );
}
function key(secret: string) {
  if (/^[0-9a-f]{64}$/i.test(secret)) return Buffer.from(secret, "hex");
  const decoded = Buffer.from(secret, "base64");
  if (decoded.length !== 32)
    throw new Error("ENCRYPTION_KEY must encode 32 bytes as hex or base64.");
  return decoded;
}
export function encryptState(value: string, secret: string, sessionId: string) {
  const nonce = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(secret), nonce);
  cipher.setAAD(Buffer.from(sessionId));
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from([1]), nonce, cipher.getAuthTag(), data]);
}
export function decryptState(
  value: Uint8Array,
  secret: string,
  sessionId: string,
) {
  const blob = Buffer.from(value);
  if (blob.length < 30 || blob[0] !== 1)
    throw new Error("Invalid encrypted session format.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(secret),
    blob.subarray(1, 13),
  );
  decipher.setAAD(Buffer.from(sessionId));
  decipher.setAuthTag(blob.subarray(13, 29));
  return Buffer.concat([
    decipher.update(blob.subarray(29)),
    decipher.final(),
  ]).toString("utf8");
}
