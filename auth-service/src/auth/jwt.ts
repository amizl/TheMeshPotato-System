import jwt from "jsonwebtoken";
import { config } from "../config";

export interface JwtPayload {
  sub: string;
  email: string;
}

export const signAccessToken = (payload: JwtPayload): string =>
  jwt.sign(payload, config.jwtAccessSecret, {
    expiresIn: config.jwtAccessExpiresIn
  });

export const signRefreshToken = (payload: JwtPayload): string =>
  jwt.sign(payload, config.jwtRefreshSecret, {
    expiresIn: config.jwtRefreshExpiresIn
  });

export const verifyAccessToken = (token: string): JwtPayload =>
  jwt.verify(token, config.jwtAccessSecret) as JwtPayload;

export const verifyRefreshToken = (token: string): JwtPayload =>
  jwt.verify(token, config.jwtRefreshSecret) as JwtPayload;
