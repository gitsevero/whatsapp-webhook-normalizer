import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { verifyMetaSignature } from './meta';
import { SignatureVerificationError } from '../core/errors';

const SECRET = 'test_hmac_secret';
const BODY = Buffer.from(
  JSON.stringify({ entry: [{ changes: [{ value: {} }] }] }),
);

function signatureFor(body: Buffer, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

function mockReq(overrides: Partial<Request> = {}): Request {
  const headers: Record<string, string> = {};
  return {
    header: (name: string) => headers[name.toLowerCase()],
    rawBody: BODY,
    ...overrides,
    header: overrides.header ?? ((name: string) => headers[name.toLowerCase()]),
  } as unknown as Request;
}

function reqWithSignature(sig: string): Request {
  return {
    header: (name: string) =>
      name.toLowerCase() === 'x-hub-signature-256' ? sig : undefined,
    rawBody: BODY,
  } as unknown as Request;
}

describe('verifyMetaSignature', () => {
  beforeEach(() => {
    process.env.META_APP_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.META_APP_SECRET;
  });

  it('passa (next sem erro) quando a assinatura confere', () => {
    const req = reqWithSignature(signatureFor(BODY, SECRET));
    const next = vi.fn();

    verifyMetaSignature(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // sem argumento = sem erro
  });

  it('chama next com SignatureVerificationError quando assinatura está errada', () => {
    const req = reqWithSignature(
      'sha256=deadbeef0000000000000000000000000000000000000000000000000000dead',
    );
    const next = vi.fn();

    verifyMetaSignature(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(SignatureVerificationError);
  });

  it('rejeita quando header ausente', () => {
    const req = mockReq();
    const next = vi.fn();

    verifyMetaSignature(req, {} as Response, next as NextFunction);

    expect(next.mock.calls[0][0]).toBeInstanceOf(SignatureVerificationError);
  });

  it('rejeita quando rawBody ausente', () => {
    const req = {
      header: () => signatureFor(BODY, SECRET),
      rawBody: undefined,
    } as unknown as Request;
    const next = vi.fn();

    verifyMetaSignature(req, {} as Response, next as NextFunction);

    expect(next.mock.calls[0][0]).toBeInstanceOf(SignatureVerificationError);
  });

  it('modo dev — skip silencioso quando META_APP_SECRET está vazio', () => {
    delete process.env.META_APP_SECRET;
    const req = mockReq();
    const next = vi.fn();

    verifyMetaSignature(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejeita quando header tem formato errado (sem prefixo sha256=)', () => {
    const req = reqWithSignature('abc123');
    const next = vi.fn();

    verifyMetaSignature(req, {} as Response, next as NextFunction);

    expect(next.mock.calls[0][0]).toBeInstanceOf(SignatureVerificationError);
  });
});
