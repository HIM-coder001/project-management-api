const request = require('supertest');
const app = require('../../server');

// Mock the rate limiter middleware to bypass it during tests
jest.mock('../../src/middleware/rateLimiter', () => ({
    generalLimiter: (req, res, next) => next(),
    authLimiter: (req, res, next) => next()
}));

describe('Auth Routes', () => {
    
    describe('POST /api/v1/auth/register', () => {
        test('should return validation error when body is empty', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        test('should return validation error when organisationName is missing', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    name: 'John Doe',
                    email: 'john@example.com',
                    password: 'password123'
                });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        test('should return validation error when name is missing', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    organisationName: 'Test Org',
                    email: 'john@example.com',
                    password: 'password123'
                });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        test('should return validation error when email is missing', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    organisationName: 'Test Org',
                    name: 'John Doe',
                    password: 'password123'
                });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        test('should return validation error when password is missing', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    organisationName: 'Test Org',
                    name: 'John Doe',
                    email: 'john@example.com'
                });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        test('should return validation error when password is too short', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    organisationName: 'Test Org',
                    name: 'John Doe',
                    email: 'john@example.com',
                    password: 'short'
                });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.message).toContain('at least 6 characters');
        });

        test('should return validation error when email format is invalid', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    organisationName: 'Test Org',
                    name: 'John Doe',
                    email: 'invalid-email',
                    password: 'password123'
                });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.message).toContain('Invalid email');
        });

        test('should return validation error when no request body is sent', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register');

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('POST /api/v1/auth/login', () => {
        test('should return validation error when body is empty', async () => {
            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        test('should return validation error when email is missing', async () => {
            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    password: 'password123'
                });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        test('should return validation error when password is missing', async () => {
            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'john@example.com'
                });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        test('should return validation error when email format is invalid', async () => {
            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'invalid-email',
                    password: 'password123'
                });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.message).toContain('Invalid email');
        });

        test('should return validation error when no request body is sent', async () => {
            const res = await request(app)
                .post('/api/v1/auth/login');

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('POST /api/v1/auth/forgot-password', () => {
        test('should return validation error when body is empty', async () => {
            const res = await request(app)
                .post('/api/v1/auth/forgot-password')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        test('should return validation error when email is missing', async () => {
            const res = await request(app)
                .post('/api/v1/auth/forgot-password')
                .send({
                    extra: 'field'
                });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        test('should return validation error when email format is invalid', async () => {
            const res = await request(app)
                .post('/api/v1/auth/forgot-password')
                .send({
                    email: 'invalid-email'
                });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.message).toContain('Invalid email');
        });

        test('should return validation error when no request body is sent', async () => {
            const res = await request(app)
                .post('/api/v1/auth/forgot-password');

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('POST /api/v1/auth/reset-password', () => {
        test('should return validation error when body is empty', async () => {
            const res = await request(app)
                .post('/api/v1/auth/reset-password')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        test('should return validation error when token is missing', async () => {
            const res = await request(app)
                .post('/api/v1/auth/reset-password')
                .send({
                    password: 'newpassword123'
                });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        test('should return validation error when password is missing', async () => {
            const res = await request(app)
                .post('/api/v1/auth/reset-password')
                .send({
                    token: 'some-token'
                });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        test('should return validation error when password is too short', async () => {
            const res = await request(app)
                .post('/api/v1/auth/reset-password')
                .send({
                    token: 'some-token',
                    password: 'short'
                });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
            expect(res.body.error.message).toContain('at least 6 characters');
        });

        test('should return validation error when no request body is sent', async () => {
            const res = await request(app)
                .post('/api/v1/auth/reset-password');

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });
});

