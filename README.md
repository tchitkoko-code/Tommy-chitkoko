<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/147nRMNc2Q6g9I5IU1XwE_y3NbWxbcBgD

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy to Vercel (recommended)

This project is ready to deploy to Vercel. The app includes a serverless API route at `/api/generate` so your Gemini API key stays secret.

1. Connect this repository to Vercel: https://vercel.com/new
2. In the Vercel project settings, add an Environment Variable:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** _your Gemini API key_
3. Vercel will use the `build` script (`npm run build`) and deploy the `dist` folder.

Notes:
- Client-side code calls `/api/generate` — do not expose your API key in the browser.
- If you prefer the Vercel CLI, you can run:

```bash
npm run build
vercel --prod
```

If you want, I can also create a GitHub Actions workflow to build and automatically deploy, or adjust the API to perform additional validation. Which would you like next?
