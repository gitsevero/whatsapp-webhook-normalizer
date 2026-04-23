export type NormalizedMessage = {
  providerId: string;
  externalMessageId: string;
  from: { phone: string; name?: string };
  to?: { phone: string };
  text: string;
  timestamp: Date;
  raw: unknown;
};

export interface ProviderAdapter {
  readonly id: string;
  normalize(payload: unknown): NormalizedMessage;
}
