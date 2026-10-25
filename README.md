# EduPortal

EduPortal is a React, TypeScript, Vite, Firebase Authentication, and Firestore app for IELTS, SAT, and NUET practice. Students can practice IELTS Reading, Listening, and Writing, or choose SAT questions by domain and skill. Teachers can author, duplicate, preview, and validate reusable question banks.

## IELTS Writing AI coach (Gemini Developer API free tier)

The default coach uses Firebase AI Logic from the browser with the Gemini Developer API (`gemini-3.8-flash`). It does not use Cloud Functions, an OpenAI key, a Gemini key in frontend code, or an automatic paid fallback. The Firebase AI Logic SDK itself is free; the Gemini Developer API free tier has limited, changeable quotas. It does not require linking a Cloud Billing account, but requests stop when a free quota is exhausted. Google may use free-tier requests to improve its products, so the app asks students to consent before their first AI request. The prompt and draft are only sent after they click a coaching button.

### One-time Firebase Console setup

1. Open the Firebase project `exam-portal-71a9b` in [Firebase Console](https://console.firebase.google.com/).
2. Open **AI Services → AI Logic → Get started**. Choose **Gemini Developer API**. Do not choose the Agent Platform / Vertex AI provider; that is the billing-based option.
3. Open **App Check** and register the web app with **reCAPTCHA Enterprise**. Add the production domain and `localhost` to the reCAPTCHA key's allowed domains. Copy the reCAPTCHA **site key** (it is a public web key, not a secret).
4. In App Check, set up and enforce App Check for **Firebase AI Logic**. The app initializes App Check using the site key before Firebase Auth/Firestore. Firebase began enforcing App Check in the AI Logic setup workflow in July 2026 and will require enforcement from November 2, 2026.

### Run locally

In the repository root, create a text file named `.env.local` (next to `package.json`) and paste these two lines, replacing the placeholder with your site key:

```dotenv
VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=PASTE_YOUR_RECAPTCHA_SITE_KEY_HERE
VITE_FIREBASE_APPCHECK_DEBUG_TOKEN=true
```

Then run:

```sh
npm install
npm run dev
```

On the first AI request, the browser console prints a Firebase App Check debug token. In Firebase Console, open **App Check → Apps → this web app → Manage debug tokens**, add that token, then retry the request. Never publish a debug token or set `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` on the production deployment. Without a site key, AI coaching reports a setup message; local phrase suggestions and saved drafts continue to work.

### Deploy the frontend

For Vercel, add `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` under the project's **Settings → Environment Variables** for Production (and Preview if needed), then redeploy the frontend. Do not set the debug-token variable in Vercel. The Firebase AI Logic SDK sends only the chosen Task 1/Task 2 prompt and the current draft when the student asks for a hint or feedback. Requests are limited to 5,000 draft characters, 15 seconds apart, and 8 per user/browser per day; Firebase App Check and Gemini service quotas also apply. These browser limits are convenience safeguards, not a server-enforced quota. AI output is formative feedback and never an official IELTS band score or an automatic rewrite.

## Firestore rules and student groups

The app expects `firestore.rules` to protect teacher actions, group-assigned exams, profiles, and individual results. The rule file authorizes the four approved, verified Google teacher accounts and restricts student test queries to their saved group code plus tests assigned to `all`. Review the approved addresses in `firestore.rules` before publishing if the teacher allowlist changes.

After reviewing the rules, deploy only Firestore rules from the repository root when needed:

```sh
firebase login
firebase deploy --project exam-portal-71a9b --only firestore:rules
```

The app frontend is deployed on Vercel; do not run a bare `firebase deploy` for the frontend. The legacy `functions/` folder contains an optional callable writing coach that uses an OpenAI secret and may require paid Cloud Functions infrastructure. It is not used by the app and is not part of the default free-tier setup. Avoid deploying it unless you deliberately choose that separate paid setup.

## Question authoring and grading

The editor separates the exam-specific `questionType` tag from the student's `responseType`. Supported response types are single choice, multiple select, short text, multiple blanks, numeric/tolerance, matching, ordering, and long written responses. Multiple blanks and matching use individually keyed answer slots; written responses are never auto-graded as exact text. Existing `mcq`, `select`, `text`, and `number` records are normalized at read time, without a destructive migration.

**Answer-key security limitation:** the current app auto-grades in the browser, and student-readable assessment documents include answer keys. The interface does not display keys before submission, but a technically capable student can inspect the downloaded Firestore data. Firestore rules cannot hide selected fields within a document. True key confidentiality requires moving keys to a teacher-only store and grading submissions through a trusted server endpoint; this is not part of the browser-only free AI integration and has not been deployed.

Question engine checks:

```sh
npm run test:question-engine
npm run build
npm run lint
npm --prefix functions run lint
```

## SAT taxonomy

SAT domain and skill names follow the [College Board Digital SAT content domains](https://satsuite.collegeboard.org/practice/content-domains). Existing skill labels remain available so old question banks continue to match; current official skill labels have been added where needed.
