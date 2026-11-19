# Resume Insight

A full-stack resume review tool inspired by the feature set of the public AI Resume Analyzer project. This is an independent implementation; it does not include that project's source code or assets.

## What it does

- Accepts resume text or PDF uploads and an optional job description.
- Produces an ATS-style score, section checks, matched and missing keywords, and actionable suggestions.
- Uses OpenAI when configured; otherwise uses a transparent local scoring engine.
- Includes demo mode, browser-local analysis history, and optional JWT accounts with MongoDB-backed history.
- Supports exporting an analysis as a printable PDF from the browser.

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- MongoDB and an OpenAI API key are optional. Without them, the API still runs in demo mode with local scoring. Authentication and server-side history require MongoDB.

## Run locally

```powershell
npm install
npm install --prefix server
npm install --prefix client
Copy-Item server\.env.example server\.env
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). You can analyze a resume immediately without creating an account.

## Deploy a live demo

The repository includes a Render Blueprint at `render.yaml` for the API. The frontend can be deployed separately to Vercel.

1. Create a **private** GitHub repository, then push this project from its folder:

   ```powershell
   git init
   git add .
   git commit -m "Initial Resume Insight project"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-private-repo>.git
   git push -u origin main
   ```

   `.env` files are ignored by Git. Never force-add them.
2. In Render, create a **Blueprint** from that repository and select `render.yaml`. Set `MONGODB_URI` to your Atlas connection string if you want account registration and saved history. Render generates `JWT_SECRET` automatically. Set the initial `CLIENT_URL` to `http://localhost:5173` and deploy the API.
3. In Vercel, import the same repository and set the project **Root Directory** to `client`. Add `VITE_API_BASE_URL` using the Render API URL (for example, `https://resume-insight-api.onrender.com`) and deploy.
4. Copy the Vercel production URL into Render's `CLIENT_URL` environment variable, then redeploy the API. The API health check is available at `<Render API URL>/api/health`.
5. The Vercel deployment URL is the live demo link. Render's free service may take a little time to wake up after inactivity.

Never put MongoDB credentials, JWT secrets or OpenAI keys in frontend variables or source control. OpenAI is optional; the live demo uses local scoring if no API key is configured.

## Publish a demo video

Record a short walkthrough of the deployed app: open the analyzer, enter sample (non-personal) resume text and a job description, run the review, then show the score, keywords and suggestions. Upload the recording to YouTube and choose **Unlisted** or **Public**. The share URL YouTube provides is the demo video link; it cannot be created until the recording is uploaded.

## Configuration

Edit `server/.env`:

```env
PORT=5000
CLIENT_URL=http://localhost:5173
MONGODB_URI=
JWT_SECRET=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

Set `MONGODB_URI` to enable registration, login and cross-device saved history. Generate a unique `JWT_SECRET` with at least 32 random characters before enabling accounts. In PowerShell, generate one with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy the output into `server/.env`. The server refuses to start with a missing or known example JWT secret when MongoDB is enabled. Set `OPENAI_API_KEY` to enable AI-generated analysis. Keep secrets in the server environment; never put them in the frontend. The analysis API allows 10 requests per 15 minutes per IP when OpenAI is configured, or 30 when using local scoring.

## Project layout

```text
client/                 React + Vite application
  src/
    components/         Shared app interface
    lib/                API client and local demo analyzer
    App.jsx              Main analysis, history and account flows
    styles.css           Responsive visual system
server/
  src/
    config/              Optional MongoDB connection
    middleware/          Authentication and request validation
    models/              User and analysis schemas
    routes/              Auth and analysis API endpoints
    services/            PDF extraction and resume scoring
```

## API

- `GET /api/health`
- `POST /api/analyze` (JSON `{ resumeText, jobDescription }` or multipart `resume` and `jobDescription`)
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/analyses` (Bearer token)
- `DELETE /api/analyses/:id` (Bearer token)

PDFs are parsed in memory, size-limited, and are not stored. Demo analyses stay in the browser. Account history is stored only when MongoDB is configured and the user is signed in.
