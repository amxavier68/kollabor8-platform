import { User, RefreshToken } from '../models';
import { JWTUtil } from '../utils/jwt.util';
import { TwoFactorUtil } from '../utils/twoFactor.util';
import {
  LoginRequest,
  RegisterRequest,
  AuthTokens,
  TokenPayload,
  TwoFactorSetupResponse,
} from '../types/auth';
import { IUser } from '../types/models';

export class AuthService {
  async register(data: RegisterRequest): Promise<{ user: IUser; tokens: AuthTokens }> {
    // Check if passwords match
    if (data.password !== data.confirmPassword) {
      throw new Error('Passwords do not match');
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Create user
    const user = await User.create({
      name: data.name,
      email: data.email,
      password: data.password,
    });

    // Generate email verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    // TODO: Send verification email
    console.log('Verification token:', verificationToken);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return { user, tokens };
  }

  async login(data: LoginRequest): Promise<{ user: IUser; tokens: AuthTokens; requires2FA?: boolean }> {
    // Find user with password field
    const user = await User.findOne({ email: data.email }).select('+password +twoFactorSecret');
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check if account is locked
    if (user.isLocked()) {
      throw new Error('Account is locked due to too many failed login attempts. Please try again later.');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(data.password);
    if (!isPasswordValid) {
      await user.incrementLoginAttempts();
      throw new Error('Invalid email or password');
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      if (!data.twoFactorCode) {
        return {
          user,
          tokens: { accessToken: '', refreshToken: '' },
          requires2FA: true,
        };
      }

      // Verify 2FA code
      const is2FAValid = TwoFactorUtil.verifyToken(data.twoFactorCode, user.twoFactorSecret!);
      if (!is2FAValid) {
        // Check backup codes
        const backupCodes = user.twoFactorBackupCodes || [];
        const isBackupCodeValid = TwoFactorUtil.verifyBackupCode(data.twoFactorCode, backupCodes);
        
        if (!isBackupCodeValid) {
          throw new Error('Invalid 2FA code');
        }

        // Remove used backup code
        const hashedCode = TwoFactorUtil.hashBackupCode(data.twoFactorCode);
        user.twoFactorBackupCodes = backupCodes.filter(code => code !== hashedCode);
        await user.save();
      }
    }

    // Reset login attempts
    await user.resetLoginAttempts();

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Remove sensitive fields
    user.password = undefined as any;
    user.twoFactorSecret = undefined as any;

    return { user, tokens };
  }

  async logout(refreshToken: string): Promise<void> {
    await RefreshToken.updateOne(
      { token: refreshToken },
      { isRevoked: true, revokedAt: new Date() }
    );
  }

  async refreshTokens(oldRefreshToken: string): Promise<AuthTokens> {
    // Verify refresh token
    const payload = JWTUtil.verifyRefreshToken(oldRefreshToken);

    // Find refresh token in database
    const tokenDoc = await RefreshToken.findOne({ token: oldRefreshToken });
    if (!tokenDoc || !tokenDoc.isValid()) {
      throw new Error('Invalid refresh token');
    }

    // Find user
    const user = await User.findById(payload.id);
    if (!user) {
      throw new Error('User not found');
    }

    // Revoke old token
    tokenDoc.isRevoked = true;
    tokenDoc.revokedAt = new Date();

    // Generate new tokens
    const tokens = await this.generateTokens(user);

    // Update old token with replacement
    tokenDoc.replacedByToken = tokens.refreshToken;
    await tokenDoc.save();

    return tokens;
  }

  async setup2FA(userId: string): Promise<TwoFactorSetupResponse> {
// Find user
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate secret
    const secret = TwoFactorUtil.generateSecret();

    // Generate QR code
    const qrCode = await TwoFactorUtil.generateQRCode(user.email, secret);

    // Generate backup codes
    const backupCodes = TwoFactorUtil.generateBackupCodes();
    const hashedBackupCodes = backupCodes.map(code => TwoFactorUtil.hashBackupCode(code));

    // Save to user (but don't enable yet)
    user.twoFactorSecret = secret;
    user.twoFactorBackupCodes = hashedBackupCodes;
    await user.save();

    return {
      secret,
      qrCode,
      backupCodes,
    };
  }

  async verify2FA(userId: string, code: string): Promise<void> {
    const user = await User.findById(userId).select('+twoFactorSecret');
    if (!user || !user.twoFactorSecret) {
      throw new Error('2FA not set up for this user');
    }

    // Verify the code
    const isValid = TwoFactorUtil.verifyToken(code, user.twoFactorSecret);
    if (!isValid) {
      throw new Error('Invalid 2FA code');
    }

    // Enable 2FA
    user.twoFactorEnabled = true;
    await user.save();
  }

  async disable2FA(userId: string, code: string): Promise<void> {
    const user = await User.findById(userId).select('+twoFactorSecret +twoFactorBackupCodes');
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.twoFactorEnabled) {
      throw new Error('2FA is not enabled');
    }

    // Verify the code
    const isValid = TwoFactorUtil.verifyToken(code, user.twoFactorSecret!);
    if (!isValid) {
      throw new Error('Invalid 2FA code');
    }

    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorBackupCodes = undefined;
    await user.save();
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists
      return;
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // TODO: Send password reset email
    console.log('Password reset token:', resetToken);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const crypto = require('crypto');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      throw new Error('Invalid or expired password reset token');
    }

    // Update password
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
  }

  asyn
cat > src/api/v1/middleware/auth.middleware.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import { JWTUtil } from '../../../utils/jwt.util';
import { User } from '../../../models';

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No token provided',
      });
      return;
    }

    const token = authHeader.substring(7);

    // Verify token
    const payload = JWTUtil.verifyAccessToken(token);

    // Get user from database
    const user = await User.findById(payload.id);
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Check if user is deleted
    if (user.isDeleted) {
      res.status(401).json({
        success: false,
        error: 'User account has been deactivated',
      });
      return;
    }

    // Attach user to request
    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        success: false,
        error: 'Invalid token',
      });
    } else if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        error: 'Token expired',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Authentication failed',
      });
    }
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Not authorized to access this resource',
      });
      return;
    }

    next();
  };
};
