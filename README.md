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

## Contributing

Before committing, changes are checked with `pnpm run type-check`.
This is wired up two ways — pick whichever fits your setup:

- **Husky (npm-idiomatic, default for contributors who run `pnpm install`)**:
  the `prepare` script installs a Husky hook automatically, so once you've run
  `pnpm install` in a git checkout, `git commit` runs the check for you.
- **`.githooks/` (portable, no Husky/Node required to install)**: run
  `git config core.hooksPath .githooks` once to point git directly at the
  checked-in `.githooks/pre-commit` script, which runs the same check.

Both hooks run the same command, so pick one — you don't need both active
at once.

## CI

GitHub Actions runs `pnpm run type-check`, `pnpm run test`, and `pnpm run build`
on every push to `main` and on every pull request. See
[`.github/workflows/ci.yml`](.github/workflows/ci.yml).
