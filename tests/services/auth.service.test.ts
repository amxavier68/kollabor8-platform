// tests/services/auth.service.test.ts
describe('AuthService', () => {
  describe('register', () => {
    it('should create user with hashed password', async () => {
      const input = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User'
      };
      
      const user = await authService.register(input);
      
      expect(user.email).toBe(input.email);
      expect(user.passwordHash).not.toBe(input.password);
      expect(await bcrypt.compare(input.password, user.passwordHash)).toBe(true);
    });
    
    it('should reject duplicate email', async () => {
      await authService.register(existingUser);
      
      await expect(
        authService.register(existingUser)
      ).rejects.toThrow('Email already exists');
    });
  });
});