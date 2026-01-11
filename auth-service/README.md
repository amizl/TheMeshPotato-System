# Auth Service

## Purpose
This service provides authentication and identity for TheMeshPotato System. It is a standalone module responsible only for user registration, login, JWT session handling, and identity verification for other services.

## What this service does NOT do
- No profile data
- No assessments
- No scoring
- No roles or teams
- No cross-service logic

## Endpoints
- `POST /auth/register` — register a new user with email and password.
- `POST /auth/login` — login with email and password to obtain tokens.
- `POST /auth/refresh` — exchange a refresh token for new tokens.
- `GET /auth/me` — retrieve the authenticated user identity.

## How other services authenticate
Other services validate JWTs issued by this service using the shared access token secret (`JWT_ACCESS_SECRET`) or by verifying tokens directly with the same secret. This module does not call other services at runtime.

## Configuration
Environment variables:
- `DATABASE_URL` — PostgreSQL connection string.
- `JWT_ACCESS_SECRET` — secret for access token signing.
- `JWT_REFRESH_SECRET` — secret for refresh token signing.
- `JWT_ACCESS_EXPIRES_IN` — access token TTL (default `15m`).
- `JWT_REFRESH_EXPIRES_IN` — refresh token TTL (default `7d`).
- `PORT` — HTTP port (default `3000`).

## Database schema
See `src/db/migrations/001_create_users.sql` for the users-only schema.
