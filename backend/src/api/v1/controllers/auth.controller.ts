import { Request, Response } from 'express';
import { AuthService } from '../../../services/auth.service';

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ 
        message: error.message || 'Registration failed',
        errors: error.errors 
      });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const result = await authService.login(req.body);
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ 
        message: error.message || 'Login failed' 
      });
    }
  }

  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ 
        message: error.message || 'Token refresh failed' 
      });
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      await authService.logout(refreshToken);
      res.json({ message: 'Logout successful' });
    } catch (error: any) {
      res.status(400).json({ 
        message: error.message || 'Logout failed' 
      });
    }
  }

  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      res.json((req as any).user);
    } catch (error: any) {
      res.status(400).json({ 
        message: error.message || 'Failed to get profile' 
      });
    }
  }
}

export const authController = new AuthController();
