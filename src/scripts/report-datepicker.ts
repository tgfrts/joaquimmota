const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const weekdayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export function formatReportDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}-${date.getFullYear()}`;
}

export function parseReportDate(value: string): Date | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, monthText, dayText, yearText] = match;
  const month = Number(monthText) - 1;
  const day = Number(dayText);
  const year = Number(yearText);
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
}

export function buildReportCalendarDays(year: number, month: number): Date[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const firstVisibleDay = new Date(year, month, 1 - firstWeekday);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstVisibleDay);
    date.setDate(firstVisibleDay.getDate() + index);
    return date;
  });
}

type PickerOptions = {
  window?: Window;
  now?: () => Date;
};

function createButton(document: Document, label: string, action: string, className = ''): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.action = action;
  button.textContent = label;
  button.className = className;
  return button;
}

function sameDay(left: Date | null, right: Date): boolean {
  return left !== null && left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

export function initReportDatePicker(root: HTMLElement, options: PickerOptions = {}): void {
  const input = root.querySelector<HTMLInputElement>('[data-datepicker-input]');
  const popup = root.querySelector<HTMLElement>('[data-datepicker-popup]');
  const win = options.window ?? window;
  if (!input || !popup) return;

  let viewDate = parseReportDate(input.value) ?? (options.now?.() ?? new Date());
  let selectedDate = new Date(viewDate);
  let view: 'days' | 'months' | 'years' = 'days';
  let decadeStart = viewDate.getFullYear() - 5;
  let isOpen = false;
  let suppressFocusOpen = false;

  const setReadonlyByViewport = () => {
    input.readOnly = win.innerWidth < 768;
  };

  const placePopup = () => {
    const rect = root.getBoundingClientRect();
    const height = view === 'days' ? 251 : 191.5;
    const fitsBelow = rect.bottom + height <= win.innerHeight - 8;
    popup.dataset.placement = !fitsBelow && rect.top >= height + 8 ? 'above' : 'below';
    popup.dataset.align = rect.left + 210 > win.innerWidth - 8 ? 'right' : 'left';
  };

  const render = () => {
    const document = root.ownerDocument;
    popup.replaceChildren();
    popup.dataset.view = view;
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-label', 'Choose a date');

    const panel = document.createElement('div');
    panel.className = 'report-datepicker__panel';

    const header = document.createElement('div');
    header.className = 'report-datepicker__header';
    const currentMonth = viewDate.getMonth();
    const currentYear = viewDate.getFullYear();

    if (view === 'days') {
      header.append(createButton(document, '‹', 'previous', 'report-datepicker__arrow'));
      header.append(
        createButton(document, `${monthNames[currentMonth]} ${currentYear}`, 'show-months', 'report-datepicker__heading-button'),
        createButton(document, '›', 'next', 'report-datepicker__arrow'),
      );
    } else if (view === 'months') {
      header.append(createButton(document, '‹', 'previous', 'report-datepicker__arrow'));
      header.append(createButton(document, String(currentYear), 'show-years', 'report-datepicker__heading-button'));
      header.append(createButton(document, '›', 'next', 'report-datepicker__arrow'));
    } else {
      header.append(createButton(document, '‹', 'previous', 'report-datepicker__arrow'));
      const firstYear = decadeStart;
      const lastYear = decadeStart + 11;
      const range = document.createElement('button');
      range.type = 'button';
      range.disabled = true;
      range.className = 'report-datepicker__year-range';
      range.textContent = `${firstYear} - ${lastYear}`;
      header.append(range, createButton(document, '›', 'next', 'report-datepicker__arrow'));
    }
    panel.append(header);

    if (view === 'days') {
      const weekdays = document.createElement('div');
      weekdays.className = 'report-datepicker__weekdays';
      weekdays.setAttribute('role', 'row');
      for (const name of weekdayNames) {
        const day = document.createElement('span');
        day.setAttribute('role', 'columnheader');
        day.textContent = name;
        weekdays.append(day);
      }
      panel.append(weekdays);

      const grid = document.createElement('div');
      grid.className = 'report-datepicker__days';
      grid.setAttribute('role', 'grid');
      grid.setAttribute('aria-label', `${monthNames[currentMonth]} ${currentYear}`);
      const selected = selectedDate;
      for (const date of buildReportCalendarDays(currentYear, currentMonth)) {
        const day = createButton(document, String(date.getDate()), 'pick-day', 'report-datepicker__day');
        day.dataset.date = formatReportDate(date);
        day.setAttribute('role', 'gridcell');
        day.setAttribute('aria-label', date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
        if (date.getMonth() !== currentMonth) day.classList.add('is-adjacent');
        if (sameDay(selected, date)) day.setAttribute('aria-selected', 'true');
        if (sameDay(options.now?.() ?? new Date(), date)) day.setAttribute('aria-current', 'date');
        grid.append(day);
      }
      panel.append(grid);
    } else if (view === 'months') {
      const grid = document.createElement('div');
      grid.className = 'report-datepicker__choices report-datepicker__months';
      grid.setAttribute('role', 'grid');
      for (const [month, name] of monthNames.entries()) {
        const button = createButton(document, name.slice(0, 3), 'pick-month', 'report-datepicker__choice');
        button.dataset.month = String(month);
        button.setAttribute('role', 'gridcell');
        if (month === selectedDate.getMonth()) button.setAttribute('aria-selected', 'true');
        grid.append(button);
      }
      panel.append(grid);
    } else {
      const grid = document.createElement('div');
      grid.className = 'report-datepicker__choices report-datepicker__years';
      grid.setAttribute('role', 'grid');
      for (let year = decadeStart; year < decadeStart + 12; year += 1) {
        const button = createButton(document, String(year), 'pick-year', 'report-datepicker__choice');
        button.dataset.year = String(year);
        button.setAttribute('role', 'gridcell');
        if (year === selectedDate.getFullYear()) button.setAttribute('aria-selected', 'true');
        grid.append(button);
      }
      panel.append(grid);
    }
    popup.append(panel);
  };

  const open = () => {
    if (isOpen) return;
    isOpen = true;
    viewDate = parseReportDate(input.value) ?? (options.now?.() ?? new Date());
    selectedDate = new Date(viewDate);
    decadeStart = viewDate.getFullYear() - 5;
    view = 'days';
    render();
    placePopup();
    popup.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  const close = (returnFocus = false) => {
    if (!isOpen) return;
    isOpen = false;
    popup.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    if (returnFocus && root.ownerDocument.activeElement !== input) {
      suppressFocusOpen = true;
      input.focus();
      suppressFocusOpen = false;
    }
  };

  const changeMonth = (amount: number) => {
    viewDate = clampedDate(viewDate.getFullYear(), viewDate.getMonth() + amount, viewDate.getDate());
    render();
  };

  const clampedDate = (year: number, month: number, day: number) => new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()));
  const pick = (date: Date) => {
    selectedDate = new Date(date);
    input.value = formatReportDate(date);
    const EventConstructor = root.ownerDocument.defaultView?.Event;
    for (const type of ['input', 'change']) {
      if (EventConstructor) input.dispatchEvent(new EventConstructor(type, { bubbles: true }));
    }
  };

  const onPopupClick = (event: Event) => {
    const target = event.target;
    if (!target || !('closest' in target)) return;
    const element = target as Element;
    const button = element.closest<HTMLButtonElement>('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    if (action === 'previous' || action === 'next') {
      const amount = action === 'previous' ? -1 : 1;
      if (view === 'days') changeMonth(amount);
      else if (view === 'months') viewDate = clampedDate(viewDate.getFullYear() + amount, viewDate.getMonth(), viewDate.getDate());
      else {
        decadeStart += amount * 10;
        viewDate = clampedDate(viewDate.getFullYear() + amount * 10, viewDate.getMonth(), viewDate.getDate());
      }
      render();
    } else if (action === 'show-months') {
      view = 'months'; render();
    } else if (action === 'show-years') {
      decadeStart = viewDate.getFullYear() - 5;
      view = 'years'; render();
    } else if (action === 'pick-year') {
      const year = Number(button.dataset.year);
      viewDate = clampedDate(year, viewDate.getMonth(), viewDate.getDate());
      pick(viewDate);
      view = 'months'; render();
    } else if (action === 'pick-month') {
      viewDate = clampedDate(viewDate.getFullYear(), Number(button.dataset.month), viewDate.getDate());
      pick(viewDate);
      view = 'days'; render();
    } else if (action === 'pick-day' && button.dataset.date) {
      const date = parseReportDate(button.dataset.date);
      if (!date) return;
      const adjacent = button.classList.contains('is-adjacent');
      viewDate = new Date(date);
      pick(date);
      if (adjacent) render();
      else close(true);
    }
  };

  input.setAttribute('aria-haspopup', 'dialog');
  input.setAttribute('aria-controls', popup.id);
  input.setAttribute('aria-expanded', 'false');
  setReadonlyByViewport();
  input.addEventListener('focus', () => { if (!suppressFocusOpen) open(); });
  input.addEventListener('click', open);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' && !isOpen) { event.preventDefault(); open(); }
  });
  popup.addEventListener('click', onPopupClick);
  root.ownerDocument.addEventListener('pointerdown', (event) => {
    if (isOpen && event.target && 'nodeType' in event.target && !root.contains(event.target as Node)) close();
  });
  root.ownerDocument.addEventListener('keydown', (event) => {
    if (isOpen && event.key === 'Escape') { event.preventDefault(); close(true); }
  });
  win.addEventListener('resize', () => {
    setReadonlyByViewport();
    if (isOpen) placePopup();
  });
}

export function initReportDatePickers(document: Document = window.document): void {
  for (const root of document.querySelectorAll<HTMLElement>('[data-report-date-picker]')) {
    initReportDatePicker(root, { window: document.defaultView ?? undefined });
  }
}
