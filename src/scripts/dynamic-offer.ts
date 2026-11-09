import { submitFormAccepted } from './forms-client';
import { offerHeading, offerWindowState } from '../lib/offers.mjs';

document.querySelectorAll<HTMLElement>('[data-dynamic-offer]').forEach((page) => {
  const form = page.querySelector<HTMLFormElement>('[data-offer-form]');
  const heading = page.querySelector<HTMLElement>('[data-offer-heading]');
  const thanks = page.querySelector<HTMLElement>('[data-offer-thanks]');
  const status = page.querySelector<HTMLElement>('[data-campaign-status]');
  if (!form || !heading || !thanks || !status) return;
  const offer = { heading: page.dataset.heading ?? '', startDate: page.dataset.startDate, endDate: page.dataset.endDate };
  let accepted = false;
  const updateWindow = () => {
    const state = offerWindowState(offer);
    heading.textContent = offerHeading(offer, state);
    form.hidden = accepted || state !== 'active';
    thanks.hidden = state !== 'ended';
    return state;
  };
  updateWindow();
  // Browser suspends this timer in bfcache and resumes it with the page.
  window.setInterval(updateWindow, 30_000);
  document.addEventListener('visibilitychange', updateWindow);
  window.addEventListener('focus', updateWindow);
  window.addEventListener('pageshow', updateWindow);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    // Recheck at submission even if the visitor kept this page open overnight.
    if (updateWindow() !== 'active' || accepted) return;
    const button = form.querySelector<HTMLButtonElement>('button');
    if (!button || button.disabled || !form.reportValidity()) return;
    button.disabled = true; status.hidden = false; status.textContent = '';
    const data = new FormData(form);
    const message = [`Conhece alguém que esteja a vender ou a comprar casa?: ${data.get('referral')}`, `Está a pensar vender ou a comprar casa?: ${data.get('intent')}`, `Morada: ${data.get('street')}`, `Código Postal: ${data.get('postalCode')}`, `Concelho: ${data.get('county')}`].join('\n');
    try {
      await submitFormAccepted(form, { formType: 'leadMagnet', route: form.dataset.route ?? '', fields: { name: `${data.get('firstName')} ${data.get('lastName')}`.trim(), email: data.get('email'), phone: data.get('phone'), message } });
      accepted = true;
      updateWindow();
      const name = String(data.get('firstName') ?? '').trim();
      status.textContent = `Obrigado${name ? `, ${name}` : ''}! A sua participação na campanha ${page.dataset.title ?? ''} foi registada com sucesso.`;
    } catch {
      updateWindow();
      status.textContent = 'Oops! Aconteceu algo de errado enquanto submetia o seu formulário.';
      button.disabled = false;
    }
  });
});
