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
firebase deploy --project exam-portal-71a9b --only firestore:rules,firestore:indexes
```

The frontend is deployed on Vercel; Firebase deploys do not publish the Vercel website. Exam submissions now use authenticated Cloud Functions: `submitExamAttempt` checks the student's group, grades against the teacher-only answer key, and writes both the central teacher record and the student's existing history; `reviewSubmission` saves teacher feedback to both views; `backfillLegacySubmissions` copies older history into the teacher list without deleting it; `secureExistingAnswerKeys` moves existing assessment keys to teacher-only documents. The legacy `writingCoach` function remains optional and uses an OpenAI secret; the app's default writing coach still uses Firebase AI Logic.

Deploying Cloud Functions requires the Firebase project to use the **Blaze** plan. This change does not alter the project's billing plan and no function has been deployed from this task. To deploy rules, indexes, and only the required submission functions, use the repository root:

```sh
cd functions
npm install
cd ..
firebase deploy --project exam-portal-71a9b --only firestore:rules,firestore:indexes,functions:submitExamAttempt,functions:backfillLegacySubmissions,functions:reviewSubmission,functions:secureExistingAnswerKeys
```

If you do not want to enable Blaze, do not publish this frontend version: the current rules deliberately deny browser-side result writes so students cannot forge scores. Cloud Functions usage is not the free browser AI coach; review Firebase's [Cloud Functions setup and pricing requirements](https://firebase.google.com/docs/functions/get-started) before deploying.

After deploying Firebase, redeploy the frontend on Vercel. From **Teacher Portal → Results & submissions**, select **Secure existing assessment keys** once. Until this completes, older assessments remain hidden from students; their question content and keys are retained in Firestore, with keys moved to the teacher-only collection. Then use **Import legacy results** repeatedly until migration reaches the end. This reads result records in batches of 200, preserves original student history, and creates central records the teacher can filter and export. New submissions appear automatically. The teacher results subscription is limited to the newest 500 attempts.

## Question authoring and grading

The editor separates the exam-specific `questionType` tag from the student's `responseType`. Supported response types are single choice, multiple select, short text, multiple blanks, numeric/tolerance, matching, ordering, and long written responses. Multiple blanks and matching use individually keyed answer slots; written responses are never auto-graded as exact text. Existing `mcq`, `select`, `text`, and `number` records are normalized at read time, without a destructive migration.

Answer keys are stored separately under `artifacts/{appId}/teacher/data/answerKeys/{assessmentId}`. Student-readable assessment documents omit answer keys, and student queries require `answerKeysSecured == true`. The migration button moves existing keys to the restricted collection without deleting assessments; existing exams stay hidden until migrated. Server-side grading rejects un-migrated exams.

## Question bank JSON and sample banks

Version 1 files use `schemaVersion`, assessment metadata (`title`, `type`, `durationSeconds`, optional `settings` and `sections`), and `questions` in the same shape used by the editor and grading engine. Questions must have unique IDs and supported response types; IELTS passage numbers must be 1–3 and Listening section numbers 1–4. File imports are validated, assigned fresh question/slot IDs, and opened as a new hidden draft. They never overwrite a saved test or publish automatically. Export a selected bank from the assessment editor with **Export question bank**.

The teacher's **Sample banks** panel previews and imports the six original, unofficial pilots in [`sample-data/`](sample-data/). Listening has intentionally blank audio references and cannot be published until actual audio is added for every section containing questions. Original illustrative recording scripts are in [`sample-data/ielts-listening-transcripts.md`](sample-data/ielts-listening-transcripts.md). Assign a student group only after reviewing the imported draft and adding its needed audio/media.

Question engine checks:

```sh
npm run test:question-engine
npm run build
npm run lint
npm --prefix functions run lint
```

## SAT taxonomy

SAT domain and skill names follow the [College Board Digital SAT content domains](https://satsuite.collegeboard.org/practice/content-domains). Existing skill labels remain available so old question banks continue to match; current official skill labels have been added where needed.
