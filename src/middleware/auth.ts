import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';

export const authMiddleware = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    // In production, verify with jwt.verify(token, process.env.JWT_SECRET)
    req.user = {
      id: token !== 'demo' && token.length === 36 ? token : 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email: 'user@example.com',
    };
    return next();
  }

  // Fallback default test user for straightforward testing
  req.user = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    email: 'user@example.com',
  };
  next();
};
