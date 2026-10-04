import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { buildReportCalendarDays, formatReportDate, initReportDatePicker, parseReportDate } from '../../src/scripts/report-datepicker.ts';

test('MM-DD-YYYY formatting and parsing reject invalid calendar dates', () => {
  assert.equal(formatReportDate(new Date(2026, 9, 3)), '10-03-2026');
  assert.equal(formatReportDate(new Date(2024, 1, 29)), '02-29-2024');
  assert.deepEqual(parseReportDate('02-29-2024'), new Date(2024, 1, 29));
  assert.equal(parseReportDate('02-29-2025'), null);
  assert.equal(parseReportDate('2-09-2026'), null);
});

test('calendar renders Sunday-first 42 day cells with adjacent-month dates', () => {
  const days = buildReportCalendarDays(2026, 9);
  assert.equal(days.length, 42);
  assert.deepEqual(days[0], new Date(2026, 8, 27));
  assert.deepEqual(days[4], new Date(2026, 9, 1));
  assert.deepEqual(days[34], new Date(2026, 9, 31));
  assert.deepEqual(days[41], new Date(2026, 10, 7));
});

function makePicker(t, width = 1024) {
  const dom = new JSDOM('<form><div data-report-date-picker><input data-datepicker-input name="Data"><div id="date-calendar" data-datepicker-popup hidden></div></div><button type="submit">Submit</button></form>', {
    pretendToBeVisual: true,
    url: 'https://joaquimmota.pt/doop/relatorios-de-visita',
  });
  t.after(() => dom.window.close());
  Object.defineProperty(dom.window, 'innerWidth', { configurable: true, value: width, writable: true });
  Object.defineProperty(dom.window, 'innerHeight', { configurable: true, value: 900, writable: true });
  const root = dom.window.document.querySelector('[data-report-date-picker]');
  const input = root.querySelector('input');
  const popup = root.querySelector('[data-datepicker-popup]');
  const requests = [];
  dom.window.fetch = (...args) => { requests.push(args); throw new Error('Date picker must not send requests.'); };
  initReportDatePicker(root, { window: dom.window, now: () => new Date(2026, 9, 3) });
  return { dom, root, input, popup, requests };
}

test('desktop picker starts on current month, changes year/month views and selects a formatted date', (t) => {
  const { dom, input, popup, requests } = makePicker(t);
  assert.equal(input.readOnly, false);
  input.focus();
  assert.equal(popup.hidden, false);
  assert.equal(popup.querySelector('[data-action="show-months"]')?.textContent, 'October 2026');
  assert.equal(popup.querySelector('[aria-label="October 2026"]')?.children.length, 42);
  assert.equal(popup.querySelectorAll('.report-datepicker__weekdays [role="columnheader"]')[0].textContent, 'SU');
  assert.equal(popup.querySelector('[data-date="10-03-2026"]').getAttribute('aria-selected'), 'true');
  assert.equal(input.value, '');

  popup.querySelector('[data-action="show-months"]').click();
  assert.equal(popup.querySelectorAll('[data-action="pick-month"]').length, 12);
  popup.querySelector('[data-action="show-years"]').click();
  assert.equal(popup.dataset.view, 'years');
  assert.equal(popup.querySelectorAll('[data-action="pick-year"]').length, 12);
  assert.equal(popup.querySelector('[data-action="previous"] + .report-datepicker__year-range')?.textContent, '2021 - 2032');
  popup.querySelector('[data-action="pick-year"][data-year="2026"]').click();
  assert.equal(input.value, '10-03-2026');
  assert.equal(popup.hidden, false);
  popup.querySelector('[data-action="pick-month"][data-month="9"]').click();
  popup.querySelector('[data-action="pick-day"][data-date="10-09-2026"]').click();

  assert.equal(input.value, '10-09-2026');
  assert.equal(popup.hidden, true);
  assert.equal(dom.window.document.activeElement, input);
  assert.equal(requests.length, 0);
});

test('month and year picks update the input immediately, clamp leap days, and adjacent days keep the picker open', (t) => {
  const { input, popup, requests } = makePicker(t);
  input.value = '02-29-2024';
  input.focus();
  popup.querySelector('[data-action="show-months"]').click();
  popup.querySelector('[data-action="show-years"]').click();
  popup.querySelector('[data-year="2025"]').click();
  assert.equal(input.value, '02-28-2025');
  assert.equal(popup.hidden, false);
  popup.querySelector('[data-month="2"]').click();
  assert.equal(input.value, '03-28-2025');
  popup.querySelector('.is-adjacent').click();
  assert.equal(popup.hidden, false);
  assert.equal(requests.length, 0);
});

test('year ranges stay relative to the viewed year and navigation advances ten years', (t) => {
  const { input, popup } = makePicker(t);
  input.value = '03-08-2027';
  input.focus();
  popup.querySelector('[data-action="show-months"]').click();
  popup.querySelector('[data-action="show-years"]').click();
  assert.equal(popup.querySelector('.report-datepicker__year-range').textContent, '2022 - 2033');
  popup.querySelector('[data-action="next"]').click();
  assert.equal(popup.querySelector('.report-datepicker__year-range').textContent, '2032 - 2043');
  popup.querySelector('[data-action="previous"]').click();
  assert.equal(popup.querySelector('.report-datepicker__year-range').textContent, '2022 - 2033');
  assert.equal(input.value, '03-08-2027');
});

test('month navigation preserves and clamps the viewed day before a month selection', (t) => {
  const { input, popup } = makePicker(t);
  input.value = '03-31-2027';
  input.focus();
  popup.querySelector('[data-action="next"]').click();
  assert.equal(input.value, '03-31-2027');
  popup.querySelector('[data-action="show-months"]').click();
  popup.querySelector('[data-month="3"]').click();
  assert.equal(input.value, '04-30-2027');
});

test('mobile viewport makes the text field readonly but still opens the picker; Escape closes and restores focus', (t) => {
  const { dom, input, popup, requests } = makePicker(t, 390);
  assert.equal(input.readOnly, true);
  input.click();
  assert.equal(popup.hidden, false);
  popup.querySelector('[data-action="next"]').click();
  assert.equal(popup.querySelector('[aria-label="November 2026"]')?.children.length, 42);

  const escape = new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  dom.window.document.dispatchEvent(escape);
  assert.equal(escape.defaultPrevented, true);
  assert.equal(popup.hidden, true);
  assert.equal(dom.window.document.activeElement, input);
  assert.equal(requests.length, 0);
});

test('outside click closes without changing date or sending data', (t) => {
  const { dom, input, popup, requests } = makePicker(t);
  input.focus();
  const outside = dom.window.document.createElement('button');
  dom.window.document.body.append(outside);
  outside.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true }));
  assert.equal(popup.hidden, true);
  assert.equal(input.value, '');
  assert.equal(requests.length, 0);
});
