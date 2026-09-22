import { describe, it, expect, vi } from 'vitest';
import fastify from 'fastify';
import { serafortPlugin } from '../src/plugin.js';
import { SerafortClient } from '@serafort/core';

describe('Fastify Plugin', () => {
  const mockClient = {
    b2b: {
      validateToken: vi.fn(),
      hasPermission: vi.fn(),
    },
  } as unknown as SerafortClient;

  it('should register serafort decorators on fastify app', async () => {
    const app = fastify();
    await app.register(serafortPlugin, { client: mockClient });

    expect(app.serafort).toBe(mockClient);
    expect(typeof app.authenticate).toBe('function');
    expect(typeof app.requirePermission).toBe('function');
    expect(typeof app.requireRole).toBe('function');
  });

  it('should reject requests with 401 when Authorization header is absent', async () => {
    const app = fastify();
    await app.register(serafortPlugin, { client: mockClient });

    app.get('/protected', { preHandler: app.authenticate() }, async () => {
      return { ok: true };
    });

    const response = await app.inject({
      method: 'GET',
      url: '/protected',
    });

    expect(response.statusCode).toBe(401);
    const json = response.json();
    expect(json.status).toBe('error');
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  it('should authenticate and populate request.user on valid token', async () => {
    const app = fastify();
    await app.register(serafortPlugin, { client: mockClient });

    const mockUser = {
      userId: 'usr_fastify_123',
      tenantId: 'ten_fastify',
      roles: ['admin'],
      permissions: ['items:read'],
      claims: {},
    };

    vi.mocked(mockClient.b2b.validateToken).mockResolvedValueOnce(mockUser);

    app.get('/me', { preHandler: app.authenticate() }, async (request) => {
      return { user: request.user, auth: request.auth };
    });

    const response = await app.inject({
      method: 'GET',
      url: '/me',
      headers: {
        authorization: 'Bearer valid_fastify_token',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.user.userId).toBe('usr_fastify_123');
    expect(body.auth.tenantId).toBe('ten_fastify');
  });

  it('should enforce requirePermission preHandler hook', async () => {
    const app = fastify();
    await app.register(serafortPlugin, { client: mockClient });

    const mockUser = {
      userId: 'usr_1',
      tenantId: 't1',
      roles: [],
      permissions: ['reports:read'],
      claims: {},
    };

    vi.mocked(mockClient.b2b.validateToken).mockResolvedValue(mockUser);
    vi.mocked(mockClient.b2b.hasPermission).mockImplementation((u, p) => p === 'reports:read');

    app.get(
      '/reports',
      { preHandler: [app.authenticate(), app.requirePermission('reports:read')] },
      async () => ({ data: 'secret reports' })
    );

    app.get(
      '/admin-reports',
      { preHandler: [app.authenticate(), app.requirePermission('reports:delete')] },
      async () => ({ data: 'deleted' })
    );

    // Allowed
    const res1 = await app.inject({
      method: 'GET',
      url: '/reports',
      headers: { authorization: 'Bearer token' },
    });
    expect(res1.statusCode).toBe(200);

    // Forbidden
    const res2 = await app.inject({
      method: 'GET',
      url: '/admin-reports',
      headers: { authorization: 'Bearer token' },
    });
    expect(res2.statusCode).toBe(403);
    expect(res2.json().error.code).toBe('FORBIDDEN');
  });
});
