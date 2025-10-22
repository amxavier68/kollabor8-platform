// tests/integration/auth.test.ts
describe('Auth Flow Integration', () => {
  it('should complete full registration and login flow', async () => {
    // Register
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'newuser@test.com',
        password: 'SecurePass123!',
        firstName: 'New',
        lastName: 'User'
      });
    
    expect(registerRes.status).toBe(201);
    
    // Login
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'newuser@test.com',
        password: 'SecurePass123!'
      });
    
    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('accessToken');
    expect(loginRes.body).toHaveProperty('refreshToken');
    
    // Access protected route
    const profileRes = await request(app)
      .get('/api/v1/user/profile')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`);
    
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.email).toBe('newuser@test.com');
  });
});