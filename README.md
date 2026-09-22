# @serafort/fastify

Fastify plugin for Serafort B2B authentication, multi-tenant resolution, and local RBAC permission guards.

## Installation

```bash
npm install @serafort/fastify @serafort/core fastify-plugin
```

## Usage

```typescript
import Fastify from 'fastify';
import { serafortPlugin } from '@serafort/fastify';

const fastify = Fastify({ logger: true });

await fastify.register(serafortPlugin, {
  endpoint: 'https://auth.acme.com',
});

// Protected route
fastify.get('/api/me', { preHandler: fastify.authenticate() }, async (request) => {
  return {
    userId: request.user?.userId,
    tenantId: request.user?.tenantId,
    roles: request.user?.roles,
  };
});

// Protected with RBAC permission check
fastify.post(
  '/api/invoices',
  { preHandler: [fastify.authenticate(), fastify.requirePermission('billing:write')] },
  async (request) => {
    return { status: 'created' };
  }
);

await fastify.listen({ port: 3000 });
```
