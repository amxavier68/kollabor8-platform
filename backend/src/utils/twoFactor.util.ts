import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';

export class TwoFactorUtil {
  private static readonly APP_NAME = 'Kollabor8 Platform';

  static generateSecret(): string {
    return authenticator.generateSecret();
  }

  static async generateQRCode(email: string, secret: string): Promise<string> {
    const otpauth = authenticator.keyuri(email, this.APP_NAME, secret);
    return await QRCode.toDataURL(otpauth);
  }

  static verifyToken(token: string, secret: string): boolean {
    try {
      return authenticator.verify({ token, secret });
    } catch (error) {
      return false;
    }
  }

  static generateBackupCodes(count: number = 8): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  static hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  static verifyBackupCode(code: string, hashedCodes: string[]): boolean {
    const hashedInput = this.hashBackupCode(code);
    return hashedCodes.includes(hashedInput);
  }
}
