import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";

function config() {
  return z.object({
    S3_ENDPOINT: z.url(), S3_REGION: z.string().min(1), S3_BUCKET: z.string().min(1),
    S3_ACCESS_KEY_ID: z.string().min(1), S3_SECRET_ACCESS_KEY: z.string().min(1),
    S3_PUBLIC_BASE_URL: z.url(),
  }).parse(process.env);
}

function client() {
  const env = config();
  return new S3Client({ endpoint: env.S3_ENDPOINT, region: env.S3_REGION, forcePathStyle: true,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });
}

export interface StorageProvider {
  presignPut(key: string, mime: string): Promise<string>;
  head(key: string): Promise<{ size: number; mime?: string }>;
  read(key: string, maxBytes: number): Promise<Buffer>;
  write(key: string, body: Buffer, mime: string): Promise<void>;
  copy(source: string, destination: string): Promise<void>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

export const storage: StorageProvider = {
  async presignPut(key, mime) {
    const env = config();
    return getSignedUrl(client(), new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ContentType: mime }), { expiresIn: 300 });
  },
  async head(key) {
    const env = config();
    const result = await client().send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    return { size: result.ContentLength ?? 0, mime: result.ContentType };
  },
  async read(key, maxBytes) {
    const env = config();
    const result = await client().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    if (!result.Body) throw new Error("Uploaded file is empty.");
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
      total += chunk.byteLength;
      if (total > maxBytes) throw new Error("Uploaded image is too large.");
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  },
  async write(key, body, mime) {
    const env = config();
    await client().send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: mime, CacheControl: "public, max-age=31536000, immutable" }));
  },
  async copy(source, destination) {
    const env = config();
    await client().send(new CopyObjectCommand({ Bucket: env.S3_BUCKET, Key: destination, CopySource: `${env.S3_BUCKET}/${source.split("/").map(encodeURIComponent).join("/")}` }));
  },
  async delete(key) {
    const env = config();
    await client().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  },
  publicUrl(key) { return `${config().S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`; },
};
