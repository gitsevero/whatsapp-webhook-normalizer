export class MalformedWebhookError extends Error {
  readonly providerId: string;

  constructor(providerId: string, cause?: unknown) {
    super(`Malformed webhook payload for provider "${providerId}"`, { cause });
    this.name = 'MalformedWebhookError';
    this.providerId = providerId;
  }
}

export class UnknownProviderError extends Error {
  readonly providerId: string;

  constructor(providerId: string) {
    super(`Unknown provider: "${providerId}"`);
    this.name = 'UnknownProviderError';
    this.providerId = providerId;
  }
}

export class ProcessingError extends Error {
  readonly providerId: string;

  constructor(providerId: string, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'ProcessingError';
    this.providerId = providerId;
  }
}

export class SignatureVerificationError extends Error {
  readonly providerId: string;

  constructor(providerId: string) {
    super(`Signature verification failed for provider "${providerId}"`);
    this.name = 'SignatureVerificationError';
    this.providerId = providerId;
  }
}
