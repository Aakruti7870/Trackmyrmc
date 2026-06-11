import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
const JWT_SECRET = process.env.JWT_SECRET ?? (() => {
    throw new Error('JWT_SECRET environment variable is required. Set it to a long random string before starting the server.');
})();
export function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
export function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}
export async function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    let payload;
    try {
        payload = verifyToken(header.slice(7));
    }
    catch {
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
export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        next();
    };
}
