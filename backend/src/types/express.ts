import "express";

/**
 * Express request augmentation for the authenticated user.
 *
 * This lives in a `.ts` module (not a `.d.ts`) and is imported by `app.ts`, so
 * both `tsc` and `ts-node` (npm run dev) see the same types.
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        role?: string;
        name?: string | null;
      };
    }
  }
}

export {};
