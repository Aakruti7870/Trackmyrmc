import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

const JWT_SECRET = process.env.JWT_SECRET || 'trackmyrmc-secret-2024';

export interface AuthPayload {
  id: number;
  email: string;
  role: string;
  name: string;
  linkedClientId?: number | null;
  linkedDriverId?: number | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  let payload: AuthPayload;
  try {
    payload = verifyToken(header.slice(7));
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  const [user] = await db.select({
    id: users.id, email: users.email, role: users.role, name: users.name,
    isActive: users.isActive,
    linkedClientId: users.linkedClientId, linkedDriverId: users.linkedDriverId,
  }).from(users).where(eq(users.id, payload.id));

  if (!user || !user.isActive) {
    res.status(401).json({ error: 'Account deactivated or not found' });
    return;
  }

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    linkedClientId: user.linkedClientId,
    linkedDriverId: user.linkedDriverId,
  };
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}
