import bcrypt from 'bcryptjs';

// Bcrypt cost factor. Production uses 10 for strong hashing. Under NODE_ENV=test
// we drop to 4 (bcrypt's minimum) so the suite's hundreds of user-creation calls
// don't dominate the run time. The cost factor is embedded in each hash, so
// bcrypt.compare verifies a low-cost test hash just as well as a production one.
export const BCRYPT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}
