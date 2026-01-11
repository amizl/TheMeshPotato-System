import express from "express";
import authRouter from "./routes/auth";
import { config } from "./config";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: "Internal server error" });
});

app.listen(config.port, () => {
  console.log(`Auth service listening on port ${config.port}`);
});
