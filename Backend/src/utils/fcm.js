import admin from "firebase-admin";

// initialize once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // private key needs proper newline handling
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

export async function sendFCMPush(token, { title, body, data = {} }) {
  try {
    const message = {
      token,
      notification: { title, body },
      data: Object.keys(data).reduce(
        (acc, k) => ({ ...acc, [k]: String(data[k]) }),
        {}
      ),
    };
    const r = await admin.messaging().send(message);
    return { success: true, response: r };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
