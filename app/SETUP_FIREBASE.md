# Setting up server-backed sharing (optional)

By default this app runs **local-only**: every student's attempts, bookmarks
and settings live only in their own browser (`localStorage`). That already
works for one person on one device, and nothing in this guide is required
for that.

This guide is for the case where you want to **share the app with multiple
students**, each automatically keeping their own data, synced to a small free
cloud database, so they can also pick their history up again if they switch
devices or clear their browser.

You do **not** need to know how to code to follow this. It takes about
15–20 minutes, once.

## How it works (in plain terms)

- Each student gets a random, unique **access code** (like `KASR-7F3K-9QXZ`)
  the first time they open the app — no name, email, or password.
- Their code is what keeps their data theirs. They should treat it like a
  password: save it (there's a "My Code" button to see it again), and if
  they switch devices, they type it in to pick up their history there.
- All the question content, scoring, and UI stay exactly the same as the
  local-only version — this only adds a backup/sync layer.
- Hosting and the database are both on Firebase's free tier ("Spark
  plan"), which comfortably covers a class-sized group of students doing
  practice exams. You will need a Google account to create the Firebase
  project, but students need nothing of the sort.

## Step 1 — Create a Firebase project

1. Go to <https://console.firebase.google.com/> and sign in with any Google
   account.
2. Click **Add project**. Give it any name (e.g. "module101-exams"). You can
   disable Google Analytics when asked — it isn't needed here.
3. Wait for the project to finish creating, then open it.

## Step 2 — Create the database (Firestore)

1. In the left sidebar, click **Build → Firestore Database**.
2. Click **Create database**.
3. Choose any nearby region (this cannot be changed later, but it doesn't
   matter much for this use case).
4. Start in **production mode** (the app ships its own security rules — see
   `firestore.rules` — so you don't need to use the "test mode" option).

## Step 3 — Register a "web app" and copy its config

1. In the project overview page (click the gear icon → **Project settings**
   if you navigated away), scroll to **Your apps**.
2. Click the **</>  (web)** icon to add a web app.
3. Give it any nickname (e.g. "module101-web"). You do **not** need Firebase
   Hosting checked at this step — we'll set that up separately below.
4. Firebase will show you a code snippet containing a `firebaseConfig`
   object that looks like this:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "module101-exams.firebaseapp.com",
     projectId: "module101-exams",
     storageBucket: "module101-exams.appspot.com",
     messagingSenderId: "...",
     appId: "...",
   };
   ```

5. Open this app's `js/firebaseConfig.js` file in any text editor and
   replace the empty placeholder values with the ones Firebase just gave
   you, keeping the same structure:

   ```js
   export const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "module101-exams.firebaseapp.com",
     projectId: "module101-exams",
     storageBucket: "module101-exams.appspot.com",
     messagingSenderId: "...",
     appId: "...",
   };
   ```

6. Save the file. That's the only code change needed — the app detects a
   filled-in `apiKey` and automatically switches itself from local-only mode
   into server-synced mode.

## Step 4 — Apply the security rules

The app comes with `firestore.rules` already written (it limits each
student's data to only being reachable by someone who has that exact
access code, and blocks anyone from browsing/listing all codes). Apply it:

1. In the Firebase console, go to **Firestore Database → Rules** tab.
2. Open this app's `firestore.rules` file, copy its entire contents, and
   paste them into the console's rules editor, replacing what's there.
3. Click **Publish**.

## Step 5 — Deploy the app files (Hosting)

This step puts the app's files on a public `https://your-project.web.app`
URL that students can open from any browser, phone included.

You'll need [Node.js](https://nodejs.org) installed on your own computer for
this one-time deploy step (students never need it).

1. Open a terminal in this app's folder (the one containing `index.html`,
   `firebase.json`, etc.).
2. Install the Firebase command-line tool (one-time, on your machine only):

   ```sh
   npm install -g firebase-tools
   ```

3. Log in:

   ```sh
   firebase login
   ```

4. Open `.firebaserc` in a text editor and replace `YOUR-FIREBASE-PROJECT-ID`
   with your actual Firebase project ID (visible in **Project settings** in
   the console — it's the lowercase-with-dashes id, e.g. `module101-exams`).
5. Deploy:

   ```sh
   firebase deploy --only hosting,firestore:rules
   ```

6. Firebase will print a **Hosting URL** such as
   `https://module101-exams.web.app` — that's the link to share with
   students.

## Updating the app later

Whenever you want to push a change (new questions, a fix, etc.), just run
`firebase deploy --only hosting` again from this folder.

## Cost

Firebase's free "Spark" plan includes:
- Hosting: 10 GB storage / 360 MB per day transferred — far more than a
  text-and-JSON practice app needs.
- Firestore: 1 GiB storage and 50,000 reads / 20,000 writes per day — a
  class of a few hundred students doing a few exams a day stays well inside
  this.

No credit card or paid plan is required for this setup. If you ever outgrow
the free tier, Firebase will prompt you to upgrade rather than silently
charging you.

## If you skip this guide entirely

Nothing breaks. `js/firebaseConfig.js` ships with empty values, so
`FIREBASE_ENABLED` is `false` and the app runs exactly as it did before this
feature existed — fully local-only, one student per device, no access-code
UI shown at all.

## A note on security

The access-code system is intentionally simple: whoever has the code can
read and write that code's data. There is no password, no login, no email
verification. This is a reasonable trade-off for **low-stakes practice exam
data** where the goal is "my history follows me across devices" rather than
"this is a protected academic record." It is not suitable for anything that
needs to be tamper-proof or tied to a verified real identity (e.g. official
grades). If that's ever needed, the right next step is swapping in Firebase
Authentication (real accounts with a password or magic link) — a larger
change than this guide covers, but the Firestore data model here would not
need to change, only how a code is issued.

## Future: handwritten written-exam grading (not built yet)

You mentioned wanting students to eventually handwrite answers for written
exams, with automatic OCR handwriting recognition and some form of
auto-grading. That is a substantial separate feature (handwriting OCR is a
much harder problem than the printed-text OCR used to import some of the
historical MCQ papers here, and grading free-text answers needs either
exact-match keying for short answers or a rubric-based approach for longer
ones). It has **not** been designed or built in this phase — this guide and
the current app only cover MCQ practice with server-synced sync. When you're
ready to scope that out, it's worth a dedicated planning pass of its own
rather than bolting it onto this data model after the fact.
