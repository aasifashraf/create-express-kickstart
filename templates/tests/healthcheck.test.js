import request from 'supertest';
import { app } from '../src/app.js';

describe('Healthcheck API', () => {
  it('should return 200 OK', async () => {
    const response = await request(app).get('/api/v1/healthcheck');
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Api is runing properly');
  });
});