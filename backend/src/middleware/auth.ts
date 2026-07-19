import type { Request, Response, NextFunction } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";

export interface AuthUser {
  id: string;
  username: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const JWT_SECRET = () => process.env.JWT_SECRET || "dev-secret-change-me";

export function signToken(user: AuthUser): string {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"],
  };
  return jwt.sign(user, JWT_SECRET(), options);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, JWT_SECRET()) as AuthUser;
    next();
  } catch {
    return res.status(401).json({ success: false, error: "Invalid token" });
  }
}
