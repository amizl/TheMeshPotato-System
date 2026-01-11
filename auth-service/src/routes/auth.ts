import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../db/pool";
import { comparePassword, hashPassword } from "../auth/password";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
} from "../auth/jwt";

const router = Router();

type AuthenticatedRequest = Request & { user?: { id: string; email: string } };

const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const header = req.header("authorization");
  if (!header) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Invalid Authorization header" });
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

router.post("/register", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [normalizedEmail]
  );
  if (existing.rowCount && existing.rowCount > 0) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const passwordHash = await hashPassword(password);

  const result = await pool.query(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING id, email, created_at`,
    [normalizedEmail, passwordHash]
  );

  const user = result.rows[0] as { id: string; email: string };

  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  const refreshToken = signRefreshToken({ sub: user.id, email: user.email });

  return res.status(201).json({
    user,
    accessToken,
    refreshToken
  });
});

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const result = await pool.query(
    "SELECT id, email, password_hash FROM users WHERE email = $1",
    [normalizedEmail]
  );

  const user = result.rows[0] as {
    id: string;
    email: string;
    password_hash: string;
  } | undefined;

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const matches = await comparePassword(password, user.password_hash);
  if (!matches) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  const refreshToken = signRefreshToken({ sub: user.id, email: user.email });

  return res.json({
    user: { id: user.id, email: user.email },
    accessToken,
    refreshToken
  });
});

router.post("/refresh", async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    return res.status(400).json({ error: "Refresh token is required" });
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const accessToken = signAccessToken({
      sub: payload.sub,
      email: payload.email
    });
    const nextRefreshToken = signRefreshToken({
      sub: payload.sub,
      email: payload.email
    });

    return res.json({ accessToken, refreshToken: nextRefreshToken });
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

router.get("/me", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const result = await pool.query(
    "SELECT id, email, created_at FROM users WHERE id = $1",
    [req.user.id]
  );

  const user = result.rows[0];
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({ user });
});

export default router;
