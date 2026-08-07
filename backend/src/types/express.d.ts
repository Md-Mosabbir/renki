import type { AuthUser } from '../services/auth.service.js';

/**
 * Type-only. Emits no JavaScript.
 *
 * `req.user` already works at runtime — `req` is a plain object. This file
 * exists solely so the compiler agrees, by merging one property into Express's
 * `Request` interface without touching node_modules.
 *
 * `declare global` is required, not decorative: the `import` above makes this
 * file a module, and an `interface Request` declared in module scope would be a
 * new local type that merges with nothing.
 *
 * Optional on purpose. Unauthenticated requests genuinely have no user, and
 * declaring it required would let `req.user.email` typecheck on a public route
 * and crash there instead.
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
