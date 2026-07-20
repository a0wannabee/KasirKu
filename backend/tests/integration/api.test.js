const request = require('supertest');
const app = require('../../src/app');

describe('API Security & Health Check Integration Tests', () => {
  test('GET /api/health returns status ok without requiring authentication', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('time');
  });

  test('GET /api/products without authorization header returns 401 Unauthorized', async () => {
    const res = await request(app).get('/api/products');
    expect(res.statusCode).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('POST /api/auth/login with missing or invalid credentials returns 401 or validation error', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nonexistent_user_test', password: 'WrongPassword123!' });
    
    expect([400, 401]).toContain(res.statusCode);
  });
});
