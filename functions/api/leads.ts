export type PersistedFormType = 'newsletter' | 'contact' | 'valuation' | 'mortgage' | 'partnership' | 'leadMagnet';

export type ValidatedLead = {
  formType: PersistedFormType;
  route: string;
  fields: Record<string, unknown>;
  idempotencyKey: string;
};

type D1RunResult = { meta?: { changes?: number } };
type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<D1RunResult>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
};

export type LeadsDatabase = { prepare(query: string): D1Statement };

type LeadRow = {
  payload_hash: string;
  delivery_status: 'pending' | 'sending' | 'accepted' | 'failed';
};

export type LeadReservation =
  | { kind: 'accepted' }
  | { kind: 'sending' }
  | { kind: 'manual' }
  | { kind: 'claimed'; claimToken: string };

function canonicalPayload(submission: ValidatedLead) {
  return JSON.stringify({ formType: submission.formType, route: submission.route, fields: submission.fields });
}

async function payloadHash(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function propertyReference(route: string) {
  return route.startsWith('/imoveis/') ? route.slice('/imoveis/'.length) : null;
}

function stringField(fields: Record<string, unknown>, name: string) {
  const value = fields[name];
  return typeof value === 'string' ? value : null;
}

export class LeadStore {
  private readonly db: LeadsDatabase;

  constructor(db: LeadsDatabase) {
    this.db = db;
  }

  async reserveAndClaim(submission: ValidatedLead): Promise<LeadReservation> {
    const fieldsJson = canonicalPayload(submission);
    const hash = await payloadHash(fieldsJson);
    const fields = submission.fields;
    await this.db.prepare(`INSERT INTO leads (
      idempotency_key, payload_hash, form_type, route, property_reference, first_name, last_name, name, email, phone,
      message, property_type, bedrooms, location, client_type, consent, fields_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(idempotency_key) DO NOTHING`).bind(
      submission.idempotencyKey, hash, submission.formType, submission.route, propertyReference(submission.route),
      stringField(fields, 'firstName'), stringField(fields, 'lastName'), stringField(fields, 'name'),
      stringField(fields, 'email'), stringField(fields, 'phone'), stringField(fields, 'message'),
      stringField(fields, 'propertyType'), stringField(fields, 'bedrooms'), stringField(fields, 'location'),
      stringField(fields, 'clientType'), fields.consent === true ? 1 : 0, fieldsJson,
    ).run();

    const existing = await this.db.prepare(
      'SELECT payload_hash, delivery_status FROM leads WHERE idempotency_key = ?',
    ).bind(submission.idempotencyKey).first<LeadRow>();
    if (!existing) throw new Error('Lead reservation was not persisted.');
    if (existing.payload_hash !== hash) throw new LeadIdempotencyConflict();
    if (existing.delivery_status === 'accepted') return { kind: 'accepted' };

    const claimToken = crypto.randomUUID();
    const claimable = existing.delivery_status === 'pending'
      ? `delivery_status = 'pending' AND created_at >= datetime('now', '-23 hours')`
      : `delivery_status IN ('sending', 'failed')
        AND created_at >= datetime('now', '-23 hours')
        AND updated_at <= datetime('now', '-60 seconds')`;
    const claim = await this.db.prepare(`UPDATE leads
      SET delivery_status = 'sending', claim_token = ?, safe_error = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE idempotency_key = ? AND ${claimable}`).bind(claimToken, submission.idempotencyKey).run();
    if ((claim.meta?.changes ?? 0) === 1) return { kind: 'claimed', claimToken };
    return existing.delivery_status === 'sending' || existing.delivery_status === 'failed'
      ? { kind: 'sending' }
      : { kind: 'manual' };
  }

  async markAccepted(idempotencyKey: string, claimToken: string, providerId: string) {
    const result = await this.db.prepare(`UPDATE leads
      SET delivery_status = 'accepted', provider_id = ?, safe_error = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE idempotency_key = ? AND delivery_status = 'sending' AND claim_token = ?`).bind(providerId, idempotencyKey, claimToken).run();
    if ((result.meta?.changes ?? 0) !== 1) throw new Error('Lead acceptance was not persisted.');
  }

  async markFailed(idempotencyKey: string, claimToken: string) {
    await this.db.prepare(`UPDATE leads
      SET delivery_status = 'failed', safe_error = 'delivery_failed', updated_at = CURRENT_TIMESTAMP
      WHERE idempotency_key = ? AND delivery_status = 'sending' AND claim_token = ?`).bind(idempotencyKey, claimToken).run();
  }
}

export class LeadIdempotencyConflict extends Error {}
