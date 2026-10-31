// Fill this in from: Firebase Console → Project settings → Your apps → Web
// app → SDK setup and configuration → "Config". See SETUP_FIREBASE.md for
// the full click-by-click walkthrough.
//
// Until apiKey is filled in, the app automatically runs in LOCAL-ONLY mode:
// everything still works, but each student's data stays in that one browser
// (the original behavior) instead of syncing to the cloud by access code.
export const firebaseConfig = {
  apiKey: "AIzaSyCkCloL_3nJ93OubclqnpizQ1nN-2JA0tU",
  authDomain: "kasr-aliny-exams.firebaseapp.com",
  projectId: "kasr-aliny-exams",
  storageBucket: "kasr-aliny-exams.firebasestorage.app",
  messagingSenderId: "745714716530",
  appId: "1:745714716530:web:4cf28516d4511138d2d7eb",
};

export const FIREBASE_ENABLED = !!firebaseConfig.apiKey;
