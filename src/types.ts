import { UserContext, SerafortClient } from '@serafort/core';
import type { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: {
      userId: string;
      tenantId: string;
      roles: string[];
      permissions: string[];
    };
    user?: UserContext;
  }

  interface FastifyInstance {
    serafort: SerafortClient;
    authenticate: (options?: { optional?: boolean }) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePermission: (permission: string) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (role: string) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireTenant: (tenantId: string | ((request: FastifyRequest) => string)) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export interface SerafortFastifyOptions {
  /** Existing SerafortClient instance or config */
  client?: SerafortClient;
  /** Base URL for Serafort IAM backend */
  endpoint?: string;
  /** Global optional auth flag */
  optional?: boolean;
}
