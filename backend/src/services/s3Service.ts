import { S3Client, PutObjectCommand, GetObjectCommand, S3ClientConfig } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import { v4 as uuid } from "uuid";

const clientConfig: S3ClientConfig = {
  region: process.env.AWS_REGION || "ap-south-1",
};

// On EC2, omit keys and let the AWS SDK use the attached instance IAM role.
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  clientConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}

const s3Client = new S3Client(clientConfig);
const BUCKET = process.env.S3_BUCKET_NAME || "";

function requireS3Configuration() {
  if (!BUCKET) throw new Error("S3 storage is not configured");
}

function safeFilename(filename: string): string {
  const base = path.basename(filename).replace(/[^a-zA-Z0-9._-]+/g, "-");
  return base.slice(-120) || "evidence";
}

export async function generatePresignedUploadUrl(filename: string, contentType: string) {
  requireS3Configuration();
  const key = `uploads/${uuid()}-${safeFilename(filename)}`;
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
  return { uploadUrl, key };
}

export async function generatePresignedDownloadUrl(key: string) {
  requireS3Configuration();
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key.replace(/^\/+/, ""),
  });

  return getSignedUrl(s3Client, command, { expiresIn: 900 });
}
