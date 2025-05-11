const functions = require("firebase-functions");
const admin = require("firebase-admin");
const twilio = require("twilio");

admin.initializeApp();

const client = twilio(
  "TACb13005110eaf346d809e40aa745cf66c",
  "2fe41e434b5c85fe876b6fbea9c09245"
);
const twilioPhone = "+18155590365"; // e.g., '+1415xxxxxxx'

exports.checkInactivityAndNotify = functions.pubsub
  .schedule("every 60 minutes")
  .onRun(async (context) => {
    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 1 * 60 * 1000); // 1 min for testing

    const snapshot = await admin.firestore().collection("user_activity").get();

    snapshot.forEach(async (doc) => {
      const data = doc.data();
      const lastActive = data.last_active ? data.last_active.toDate() : null;
      const emergencyContact = data.emergency_contact;
      const lastAlert = data.lastAlertSent ? data.lastAlertSent.toDate() : null;

      if (!lastActive || !emergencyContact) return;

      const phone = emergencyContact.startsWith("+")
        ? emergencyContact
        : `+94${emergencyContact.slice(1)}`;

      if (lastActive < twelveHoursAgo && (!lastAlert || lastAlert < twelveHoursAgo)) {
        try {
          await client.messages.create({
            body: `⚠️ User ${doc.id} has not used the app in over 12 hours. ` +
                  `Please check on them.`,
            from: twilioPhone,
            to: phone,
          });

          await doc.ref.update({
            lastAlertSent: admin.firestore.Timestamp.now(),
          });

          console.log(`Alert sent to ${phone}`);
        } catch (err) {
          console.error("Twilio SMS Error:", err);
        }
      }
    });

    return null;
  });