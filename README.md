# AI Triage Study

Standalone validation app for SARA patient profile generation accuracy.

## Flow

1. Open the app — no login required.
2. Start a new test conversation and enter your **Test ID** (letters, digits, `-`, `_` only).
3. Describe a patient via **voice** (hold spacebar) or **text** input.
4. Backend runs production `get_ai_patient_profile` directly (no agent loop).
5. Response is **patient profile JSON**.
6. Export the conversation as JSON, CSV, or plain text.

## Architecture

| Component | Path |
|-----------|------|
| Frontend | `ai-triage-study/` (Next.js) |
| Backend Lambda | `aws` → function `ai-triage-study` |
| API routes | `/ai-triage-study/*` |
| Profile generation | Reuses `ambient_agent` `get_ai_patient_profile` unchanged |

The production `ambient-agent` Lambda is **not** modified for this study.

## Local development

**Backend** (requires AWS creds, Groq key, deployed DynamoDB tables):

```bash
cd aws/src/ai_triage_study
export GROQ_API_KEY=gsk_...
export AWS_REGION=ca-central-1
export AI_TRIAGE_STUDY_CONVERSATIONS_TABLE=ai-triage-study-conversations
export AI_TRIAGE_STUDY_TURNS_TABLE=ai-triage-study-turns
pip install -r requirements.txt
# From aws/ directory:
PYTHONPATH=src/ambient_agent:src/ai_triage_study:layers/agent_actions/python \
  uvicorn study.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend**:

```bash
cd ai-triage-study
pnpm install
cp .env.example .env   # edit NEXT_PUBLIC_API_ORIGIN and NEXT_PUBLIC_API_KEY
pnpm dev
```

## Deploy backend

```bash
cd aws
sam build
sam deploy --resolve-image-repos
```

Set `GROQ_API_KEY` on the **`ai-triage-study`** Lambda (same key as `ambient-agent`). Voice STT uses shared `app.stt.client.transcribe` (Groq Whisper):

```bash
aws lambda update-function-configuration --function-name ai-triage-study --region ca-central-1 \
  --environment "Variables={CORS_ALLOW_ORIGIN=*,AI_TRIAGE_STUDY_CONVERSATIONS_TABLE=ai-triage-study-conversations,AI_TRIAGE_STUDY_TURNS_TABLE=ai-triage-study-turns,GROQ_API_KEY=<your-groq-key>,GROQ_MODEL=qwen/qwen3.6-27b,GROQ_WHISPER_MODEL=whisper-large-v3-turbo}"
```

Without this key, `POST .../utterances` fails because both Whisper STT and profile generation call Groq.

## Deploy frontend with AWS Amplify Hosting

This repository includes `amplify.yml` for a Next.js SSR deployment. The app uses
Next.js 15 because that is the latest major version supported by Amplify Hosting
Compute.

1. In **AWS Amplify → Create new app → GitHub**, connect this repository and the
   production branch.
2. Keep the detected framework as **Next.js - SSR**. Amplify reads the build
   commands and `.next` artifact directory from `amplify.yml`.
3. Add these variables under **Hosting → Environment variables**:

   | Variable | Required | Description |
   |----------|----------|-------------|
   | `NEXT_PUBLIC_API_ORIGIN` | Yes | API Gateway origin, including its stage |
   | `NEXT_PUBLIC_API_KEY` | If required | API Gateway key sent by the browser |
   | `AI_TRIAGE_STUDY_AWS_REGION` | Yes | Region containing the DynamoDB table, for example `ca-central-1` |
   | `AI_TRIAGE_STUDY_CONVERSATIONS_TABLE` | Yes | Conversations table name |

4. Create a branch-level **SSR Compute role** for the Amplify branch. Grant only
   `dynamodb:Scan` on the conversations table, then attach the role in the
   branch's IAM role settings. Do not configure `AWS_ACCESS_KEY_ID` or
   `AWS_SECRET_ACCESS_KEY`.
5. Deploy the branch. Optionally add the production domain under **Custom
   domains** after the first successful deployment.

`amplify.yml` copies only the listed variables into `.env.production`, which is
required for the Next.js server runtime. Values prefixed with `NEXT_PUBLIC_` are
included in browser assets and must not contain private credentials.

## Database tables

- `ai-triage-study-conversations`
- `ai-triage-study-turns`
