import type { Request, Response, NextFunction } from 'express';
import { verifyMetaSignature } from './meta';

export function verifyProviderSignature(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  switch (req.params.provider) {
    case 'meta':
      return verifyMetaSignature(req, res, next);
    // Evolution e Z-API usam token simples em header (documentado no README);
    // hook pronto para plugar quando necessário.
    default:
      return next();
  }
}
