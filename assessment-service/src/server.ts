import express, { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { Pool } from "pg";

const app = express();
app.use(express.json({ limit: "1mb" }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

type AuthenticatedRequest = Request & { userId?: string };

const getJwtVerificationKey = (): string => {
  const publicKey = process.env.AUTH_JWT_PUBLIC_KEY;
  const secret = process.env.AUTH_JWT_SECRET;

  if (publicKey) {
    return publicKey;
  }
  if (secret) {
    return secret;
  }
  throw new Error("Missing AUTH_JWT_PUBLIC_KEY or AUTH_JWT_SECRET");
};

const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const key = getJwtVerificationKey();
    const payload = jwt.verify(token, key, {
      algorithms: ["RS256", "HS256"],
    }) as JwtPayload;

    const userId = typeof payload.user_id === "string" ? payload.user_id : payload.sub;
    if (!userId) {
      return res.status(401).json({ error: "Token missing user identity" });
    }

    req.userId = userId;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

app.get("/assessments/active", authMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT id, name, version, definition FROM assessments WHERE is_active = true ORDER BY name, version DESC"
    );

    return res.json({ assessments: result.rows });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load assessments" });
  }
});

app.post("/assessments/start", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { assessment_id, metadata } = req.body as {
    assessment_id?: string;
    metadata?: Record<string, unknown>;
  };

  if (!assessment_id) {
    return res.status(400).json({ error: "assessment_id is required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO assessment_sessions (assessment_id, user_id, metadata)
       VALUES ($1, $2, $3)
       RETURNING id, assessment_id, user_id, status, started_at, completed_at, metadata`,
      [assessment_id, req.userId, metadata ?? {}]
    );

    return res.status(201).json({ session: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ error: "Failed to start assessment session" });
  }
});

app.post("/assessments/answer", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { session_id, question_id, answer, answer_order, metadata } = req.body as {
    session_id?: string;
    question_id?: string;
    answer?: unknown;
    answer_order?: number;
    metadata?: Record<string, unknown>;
  };

  if (!session_id || answer_order === undefined || answer === undefined) {
    return res.status(400).json({ error: "session_id, answer_order, and answer are required" });
  }

  try {
    const sessionResult = await pool.query(
      "SELECT id, user_id, status FROM assessment_sessions WHERE id = $1",
      [session_id]
    );

    const session = sessionResult.rows[0];
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (session.user_id !== req.userId) {
      return res.status(403).json({ error: "Session does not belong to user" });
    }

    if (session.status === "completed") {
      return res.status(409).json({ error: "Session already completed" });
    }

    const result = await pool.query(
      `INSERT INTO assessment_answers (session_id, question_id, answer_order, answer_payload, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, session_id, question_id, answer_order, answer_payload, answered_at, metadata`,
      [session_id, question_id ?? null, answer_order, answer, metadata ?? {}]
    );

    return res.status(201).json({ answer: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ error: "Failed to record answer" });
  }
});

app.post("/assessments/complete", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { session_id } = req.body as { session_id?: string };

  if (!session_id) {
    return res.status(400).json({ error: "session_id is required" });
  }

  try {
    const result = await pool.query(
      `UPDATE assessment_sessions
       SET status = 'completed', completed_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, assessment_id, user_id, status, started_at, completed_at, metadata`,
      [session_id, req.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    return res.json({ session: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ error: "Failed to complete assessment session" });
  }
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

const port = Number(process.env.PORT ?? 3002);
app.listen(port, () => {
  console.log(`Assessment service listening on port ${port}`);
});
