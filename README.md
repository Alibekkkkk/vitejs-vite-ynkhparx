# EduPortal

EduPortal is a React, TypeScript, Vite, Firebase Authentication, and Firestore app for IELTS, SAT, and NUET learning. It includes student groups, a teacher assessment builder, question-type practice, writing workspaces, sample-bank import, and teacher submissions/review.

## Free deployment and secure grading

This repository does not require Firebase Cloud Functions, a Firebase Blaze plan, a Vercel API, a service-account key, or a paid AI fallback. `firebase.json` deploys only Firestore rules and indexes. Do not put service-account credentials or API secrets in Git.

The no-billing version deliberately does not save scores calculated in a student's browser: browser code and answer data can be edited. Answers are submitted privately with **Pending teacher review**. In **Results & submissions**, the teacher can save objective grading from the protected assessment key; essays and other subjective responses remain pending until the teacher assigns points and feedback. The app then updates the student's private result. Student submissions cannot set scores, percentages, answer keys, or correct-response counts in Firestore rules.

To make the app functional after a fresh Firebase setup:

1. In Firebase Console, open **Firestore Database → Rules**, paste the contents of [`firestore.rules`](firestore.rules), and publish. Or from the repository root run `firebase login` and `firebase deploy --project exam-portal-71a9b --only firestore:rules,firestore:indexes`. The student test query uses a composite index included in [`firestore.indexes.json`](firestore.indexes.json).
2. Deploy the Vite app to your existing static host and keep its existing Firebase web config. No server environment variables are required for submissions or grading.
3. Sign in with one of the four approved Google teacher accounts shown in `firestore.rules`. The frontend has the same public email allowlist by default; `VITE_TEACHER_EMAILS` can override it, but Firestore rules remain the authority. In **Results & submissions**, run **Secure existing assessment keys** once. Old assessments remain unavailable to students until the answer keys are moved to the teacher-only collection.
4. Use **Import legacy results** if you need to copy older student result records into the teacher results list. Legacy scores are imported as historical data, not recalculated or verified.

Vercel's free Hobby plan currently permits only personal, non-commercial use. A portal used by students can fall outside that scope, so this project does not add Vercel Functions as a supposedly free server backend. Ask Vercel whether your exact educational use qualifies before relying on Hobby for a student-facing service. A trusted automatic grader would need a server provider whose terms fit your use; without one, teacher review is the safe option.

## IELTS Writing Coach (optional)

The optional coach uses Firebase AI Logic with the Gemini Developer API provider. During Task 1 or Task 2 practice, including an IELTS writing assessment, task-specific phrase suggestions update locally as the draft's structure changes; students can also explicitly request contextual AI phrase options to insert at the cursor. AI is not called on every keystroke. The separate writing-practice workspace also offers focused hints and formative feedback. Drafts are saved locally, and local suggestions remain available if AI is unavailable or quota-limited. It does not use Cloud Functions, OpenAI, or an automatic paid fallback. The Gemini Developer API free tier has changeable limits. AI feedback is formative, not an official IELTS score, and never replaces a student's writing automatically.

For the coach, enable **AI Logic → Gemini Developer API** in Firebase Console and register a reCAPTCHA v3 site and secret under **App Check**. Put the public site key in `VITE_RECAPTCHA_V3_SITE_KEY`; enter the secret only in Firebase Console, never in Git or the frontend. After checking App Check metrics, enable enforcement for Firebase AI Logic. For local development, create `.env.local` beside `package.json` with:

```dotenv
VITE_RECAPTCHA_V3_SITE_KEY=PASTE_YOUR_RECAPTCHA_V3_SITE_KEY
VITE_FIREBASE_APPCHECK_DEBUG_TOKEN=true
```

Register the local debug token in Firebase App Check. Never set the debug-token variable in the production environment. AI requests are user-triggered, limited to 5,000 draft characters, 15 seconds apart, and 8 per browser/user per day; these client-side limits are not a server-enforced quota. Gemini Developer API and App Check usage have provider quotas; stop or retry later if the free-tier quota is exhausted. No paid fallback is enabled.

## Student groups and answer-key privacy

The Firestore rules authorize the four verified Google teacher accounts listed in `firestore.rules`. Students can read only published tests assigned to their saved group or `all`; approved teachers may also submit their own practice attempts for published, secured assessments. Students cannot read teacher-only answer-key documents. Exam attempts are saved to the account's private result path and to the teacher's submissions collection; the rules reject client-provided score summaries. After changing Firestore rules, publish them with `firebase deploy --project exam-portal-71a9b --only firestore:rules`.

Teacher answer keys and explanations are stored under `artifacts/{appId}/teacher/data/answerKeys/{assessmentId}`. Student-readable assessment documents omit keys and explanations. The migration button copies old keys to the protected collection and removes them from the public assessment document without deleting the assessment.

## Question engine and practice

The shared engine supports single choice, multiple select, short text, multiple blanks, numeric tolerance, matching, ordering, and long written responses. Writing and other subjective work is not treated as objectively incorrect. Existing NUET question records are normalized at read time without a destructive migration.

Question-bank JSON uses `schemaVersion: 1`, assessment metadata, optional `sections`, and validated `questions`. To import one: open **Teacher Portal → Sample Banks → Choose JSON and preview**, select the matching file inside your local `sample-data` folder, inspect the rendered questions, then choose **Import as draft**. In the assessment editor, review it, assign the intended group, and save only when ready to publish. Imports get fresh assessment/question/slot IDs and never publish automatically. Existing imported copies are shown; a deliberate duplicate gets new IDs. Unpublishing removes student visibility but preserves result history.

The local original banks include Academic and General Training Reading (40 questions, three passages, 60 minutes each), Academic and General Writing (two complete manually reviewed tasks each), Speaking Parts 1–3, SAT Reading and Writing (54 questions, 27 per locked 32-minute module), SAT Math (44 questions, 22 per locked 35-minute module), and an IELTS Listening script bank with 40 questions across four sections. The optional combined SAT practice joins the two published sections into 98 questions and 134 testing minutes, with four locked modules and an optional 10-minute break after Reading and Writing. It is fixed-sequence practice and does not implement adaptive routing or an official SAT scaled score.

IELTS Listening has 40 original questions across four sections, plus teacher recording scripts and recording instructions. **It is not ready for student use without actual audio.** In the assessment editor, select each section, add a direct browser-playable recording URL, play the recording through, and tick **I played this recording through and verified it matches this section**. Save as a draft while any section lacks verified audio; the app blocks publication and student launch until all four recordings are present and verified. Recordings are not bundled with the JSON bank.

The `sample-data/` folder and local bank-generation scripts are deliberately ignored by Git because the banks contain answer keys and teacher recording scripts. Keep these files on the teacher's computer and choose them through the Sample Banks file picker. Do not force-add them to a public GitHub repository or put them in the public app bundle; doing so would expose their keys. Published assessments are copied into Firestore with keys in the teacher-only collection. On a different teacher's computer, transfer these bank files through a private channel or create local copies; they are intentionally not downloadable from the public app. The `validate:banks` check validates these local files when present and reports a skip on a fresh clone without private banks. `test:question-engine` includes static Firestore-policy checks, but the Firestore emulator was not run.

Run the bank-content validator locally with `npm run validate:banks` before importing the files.

## Checks

```sh
npm run test:question-engine
npm run build
npm run lint
npm run validate:banks
```
