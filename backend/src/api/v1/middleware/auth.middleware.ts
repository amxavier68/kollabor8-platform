import { Request, Response, NextFunction } from 'express';
import { JWTUtil } from '../../../utils/jwt.util';
import { User } from '../../../models';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const decoded = JWTUtil.verifyAccessToken(token);
      
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user) {
        res.status(401).json({ message: 'User not found' });
        return;
      }

      (req as AuthRequest).user = {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      };

      next();
    } catch (jwtError) {
      res.status(401).json({ message: 'Invalid token' });
      return;
    }
  } catch (error) {
    res.status(500).json({ message: 'Authentication error' });
  }
};
