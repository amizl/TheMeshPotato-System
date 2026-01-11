# Assessment Service (Module 2)

## Purpose
The Assessment Service is the **data capture engine** for TheMeshPotato System. It serves assessment definitions, opens assessment sessions, records raw answers, and marks completion. **It does not score, interpret, or rank anything.**

## Data Captured
- Assessment definitions (JSON-driven)
- Session start and completion timestamps
- Raw answers exactly as submitted
- Answer order and metadata

## Data NOT Produced
- No scoring or trait calculation
- No matching or ranking
- No profile aggregation
- No team, role, or skill logic

## Why Scoring Is Explicitly Excluded
This module is designed to be **simple and replaceable**. It captures raw responses only, leaving all interpretation to downstream services.

## API
All endpoints require a valid JWT from the Auth service. The service treats identity as **opaque** and only reads `user_id` (or `sub`) from the token.

- `GET /assessments/active`
- `POST /assessments/start`
- `POST /assessments/answer`
- `POST /assessments/complete`

## Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `AUTH_JWT_PUBLIC_KEY`: Public key for RS256 verification (preferred)
- `AUTH_JWT_SECRET`: Shared secret for HS256 verification
- `PORT`: Server port (default `3002`)

## Schema
Run the SQL in `schema.sql` to create the required tables:
- `assessments`
- `questions`
- `options`
- `assessment_sessions`
- `assessment_answers`

## Assessment Definitions (JSON-Driven)
Assessment definitions are stored in the `assessments.definition` JSONB column. This supports versioning and delivery without code changes. Example structure:

```json
{
  "title": "Psychological Safety Basics",
  "version": 1,
  "questions": [
    {
      "id": "q1",
      "prompt": "I feel safe to speak up.",
      "type": "likert",
      "options": [
        { "label": "Strongly Disagree", "value": "1" },
        { "label": "Strongly Agree", "value": "5" }
      ]
    }
  ]
}
```

## Isolation Rules
- No runtime dependency on other modules
- No shared utilities
- No auth logic beyond validating JWT and extracting `user_id`
