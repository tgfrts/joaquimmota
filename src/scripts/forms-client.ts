type FormPayload = { formType: string; route: string; fields: Record<string, unknown> };
const attempts = new WeakMap<HTMLFormElement, { payload: string; key: string; pending: boolean }>();

/** Keep the same provider idempotency key when a visitor retries an unchanged submission. */
export async function submitFormAccepted(form: HTMLFormElement, payload: FormPayload) {
  const requiredConsent = payload.formType === 'newsletter'
    ? undefined
    : form.querySelector<HTMLInputElement>('input[type="checkbox"][required]')?.checked === true;
  const identityFields: Record<string, string> = {};
  if (payload.formType !== 'newsletter') {
    for (const key of ['firstName', 'lastName', 'contactSubject']) {
      const field = form.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${key}"]`);
      if (typeof field?.value === 'string') identityFields[key] = field.value.trim();
    }
  }
  const requestPayload = payload.formType === 'newsletter'
    ? payload
    : { ...payload, fields: { ...payload.fields, ...identityFields, consent: requiredConsent } };
  const serialized = JSON.stringify(requestPayload);
  const previous = attempts.get(form);
  if (previous?.pending) throw new Error('Submission already pending.');
  const attempt = previous?.payload === serialized
    ? previous
    : { payload: serialized, key: crypto.randomUUID(), pending: false };
  attempts.set(form, attempt);
  attempt.pending = true;
  try {
    const response = await fetch('/api/forms', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': attempt.key },
      body: serialized,
    });
    if (response.status !== 202) throw new Error('Submission was not accepted.');
  } finally {
    attempt.pending = false;
  }
}
