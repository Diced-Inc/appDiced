import { google } from "googleapis";

function createAuthClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !key) {
    throw new Error("Missing Google service account credentials");
  }

  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
}

export function getAndroidPublisher() {
  const auth = createAuthClient();
  return google.androidpublisher({ version: "v3", auth });
}
