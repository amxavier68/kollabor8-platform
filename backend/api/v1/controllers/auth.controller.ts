import { Request, Response, NextFunction } from 'express';
import { Log } from '@utils/decorators';
import { ApiResponse } from '@types/global';

class AuthController {
  @Log
  async login(
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email, password } = req.body;
      
      // Login logic here
      res.json({
        success: true,
        message: 'Login successful',
        data: {
          token: 'sample-jwt-token'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  @Log
  async register(
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { name, email, password } = req.body;
      
      // Registration logic here
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: { name, email }
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();