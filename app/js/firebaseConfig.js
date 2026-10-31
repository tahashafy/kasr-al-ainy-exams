// Fill this in from: Firebase Console → Project settings → Your apps → Web
// app → SDK setup and configuration → "Config". See SETUP_FIREBASE.md for
// the full click-by-click walkthrough.
//
// Until apiKey is filled in, the app automatically runs in LOCAL-ONLY mode:
// everything still works, but each student's data stays in that one browser
// (the original behavior) instead of syncing to the cloud by access code.
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

export const FIREBASE_ENABLED = !!firebaseConfig.apiKey;
