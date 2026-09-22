import fp from 'fastify-plugin';
import { SerafortClient, AuthenticationError } from '@serafort/core';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { SerafortFastifyOptions } from './types.js';

const serafortPluginAsync: FastifyPluginAsync<SerafortFastifyOptions> = async (fastify, options) => {
  const client =
    options.client ||
    new SerafortClient({
      endpoint: options.endpoint || process.env.SERAFORT_ENDPOINT,
    });

  // Decorate fastify instance with client
  fastify.decorate('serafort', client);

  // Decorate fastify request with user and auth properties
  fastify.decorateRequest('user', undefined);
  fastify.decorateRequest('auth', undefined);

  // preHandler hook factory: authenticate
  fastify.decorate('authenticate', (authOpts?: { optional?: boolean }) => {
    const isOptional = authOpts?.optional ?? options.optional ?? false;

    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        if (isOptional) {
          request.user = undefined;
          request.auth = undefined;
          return;
        }

        return reply.status(401).send({
          status: 'error',
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing or malformed Authorization header. Expected Bearer token.',
            status: 401,
          },
        });
      }

      const token = authHeader.substring(7).trim();

      try {
        const user = await client.b2b.validateToken(token);

        request.user = user;
        request.auth = {
          userId: user.userId,
          tenantId: user.tenantId,
          roles: user.roles,
          permissions: user.permissions,
        };
      } catch (err: unknown) {
        if (isOptional) {
          request.user = undefined;
          request.auth = undefined;
          return;
        }

        const status = err instanceof AuthenticationError ? (err as AuthenticationError).status : 401;
        const message = err instanceof Error ? err.message : 'Invalid authorization token';
        const code = err instanceof AuthenticationError ? (err as AuthenticationError).code : 'INVALID_TOKEN';

        return reply.status(status).send({
          status: 'error',
          error: {
            code,
            message,
            status,
          },
        });
      }
    };
  });

  // preHandler hook factory: requirePermission
  fastify.decorate('requirePermission', (permission: string) => {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      if (!request.user) {
        return reply.status(401).send({
          status: 'error',
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required before permission evaluation.',
            status: 401,
          },
        });
      }

      const hasPerm = client.b2b.hasPermission(request.user, permission);
      if (!hasPerm) {
        return reply.status(403).send({
          status: 'error',
          error: {
            code: 'FORBIDDEN',
            message: `Forbidden: User lacks required permission "${permission}".`,
            status: 403,
          },
        });
      }
    };
  });

  // preHandler hook factory: requireRole
  fastify.decorate('requireRole', (role: string) => {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      if (!request.user) {
        return reply.status(401).send({
          status: 'error',
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required before role evaluation.',
            status: 401,
          },
        });
      }

      if (!request.user.roles.includes(role)) {
        return reply.status(403).send({
          status: 'error',
          error: {
            code: 'FORBIDDEN',
            message: `Forbidden: User lacks required role "${role}".`,
            status: 403,
          },
        });
      }
    };
  });

  // preHandler hook factory: requireTenant
  fastify.decorate('requireTenant', (tenantResolver: string | ((req: FastifyRequest) => string)) => {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      if (!request.user) {
        return reply.status(401).send({
          status: 'error',
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required before tenant evaluation.',
            status: 401,
          },
        });
      }

      const expectedTenant = typeof tenantResolver === 'function' ? tenantResolver(request) : tenantResolver;

      if (request.user.tenantId !== expectedTenant) {
        return reply.status(403).send({
          status: 'error',
          error: {
            code: 'TENANT_MISMATCH',
            message: 'Forbidden: Access restricted to authorized tenant.',
            status: 403,
          },
        });
      }
    };
  });
};

export const serafortPlugin = fp(serafortPluginAsync, {
  fastify: '>=4.0.0',
  name: '@serafort/fastify',
});

export default serafortPlugin;
