# AI Triage Study

Standalone validation app for SARA patient profile generation accuracy.

## Flow

1. Sign in with a MasTER account.
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
export USERS_TABLE=users
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

## Deploy

```bash
cd aws
sam build
sam deploy --resolve-image-repos
```

Set `GROQ_API_KEY` and `API_GATEWAY_KEY` on the **`ai-triage-study`** Lambda (not `ambient-agent`).

## Database tables

- `ai-triage-study-conversations`
- `ai-triage-study-turns`
