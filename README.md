# React + TypeScript + Vite

## IELTS, SAT, and NUET practice

The student dashboard has a **Practice** tab for IELTS Reading, Listening, Writing, and SAT skill practice. Teachers can classify questions in the assessment editor with passage/section, IELTS question format, SAT domain/skill, difficulty, accepted answers, points, and explanations. Existing assessments continue to use their legacy passage and audio fields.

### Enable the secure IELTS Writing coach

The writing coach runs as a Firebase callable Cloud Function. Its OpenAI key is stored as a Firebase Secret and is never included in browser code. Until it is configured and deployed, the writing workspace remains usable with its local phrase suggestions and shows an unavailable message for AI requests.

1. Install the Firebase CLI if it is not installed, then run `firebase login`.
2. From this repository folder, run `npm install` inside `functions/`.
3. In the repository folder, run `firebase functions:secrets:set OPENAI_API_KEY --project exam-portal-71a9b` and enter your OpenAI API key in the Firebase CLI prompt. Do not paste the key into a source file, `.env` file, or Vite variable.
4. Deploy with `firebase deploy --project exam-portal-71a9b --only functions`.

The function requires an active Firebase project with Cloud Functions/Secret Manager enabled and an OpenAI API account with API billing configured. Requests require sign-in, are limited to 8 per user per day and one every 15 seconds, and send only the requested task prompt and draft. Draft text is not written to Firestore by the function. Provider responses are treated as formative practice feedback, not official IELTS scores.

The function uses Node.js 22 and Firebase Functions v2. The Firebase project may prompt to enable Google Cloud APIs or billing during first deployment.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
