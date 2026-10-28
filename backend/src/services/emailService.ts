import { SESClient, SendEmailCommand, SESClientConfig } from "@aws-sdk/client-ses";
import logger from "../config/logger";

const sesConfig: SESClientConfig = {
  region: process.env.AWS_REGION || "us-east-1",
};
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  sesConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}
const sesClient = new SESClient(sesConfig);
const FROM_EMAIL = process.env.SES_FROM_EMAIL || "";

export async function sendPasswordResetEmail(recipient: string, resetLink: string): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    logger.info({ recipient }, "Password reset email skipped in non-production");
    return;
  }
  if (!FROM_EMAIL) {
    logger.warn("SES_FROM_EMAIL not configured. Password reset email not sent.");
    return;
  }

  try {
    await sesClient.send(new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [recipient] },
      Message: {
        Subject: { Data: "Reset your Pothole Reporter password" },
        Body: {
          Text: {
            Data: `You requested a password reset.\n\nClick this link to reset your password:\n${resetLink}\n\nThis link expires in 15 minutes.\n\nIf you didn't request this, you can safely ignore this email.`,
          },
        },
      },
    }));
    logger.info({ recipient }, "Password reset email sent via SES");
  } catch (err) {
    logger.error({ err, recipient }, "Failed to send password reset email via SES");
  }
}
