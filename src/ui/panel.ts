/**
 * The small things every panel does — to the page, and to its own controls.
 *
 * All three panels had written them out: an escape for text on its way into
 * HTML, a lookup by id inside the panel, the toast, and the two ways of
 * shuffling a control. The toast is the clearest case for saying it once —
 * there is only ever one `.toast` element on the page, so a panel that keeps
 * its own timer for it is keeping a timer for something it does not own.
 */

const ENTITIES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

/** Text on its way into an HTML string. */
export function esc(text: string): string {
  return text.replace(/[&<>"']/g, c => ENTITIES[c]!);
}

/**
 * Look an element up by id, inside this panel.
 *
 * Non-null by assertion because a panel writes its own HTML immediately
 * before: an id that is not there is a typo in the same file, not a state the
 * page can reach.
 */
export function byId(container: HTMLElement) {
  return <T extends HTMLElement>(id: string): T => container.querySelector<T>(`#${id}`)!;
}

/** How long a message stays up, unless the caller knows its message is short. */
const TOAST_HOLD_MS = 2600;

let toastTimer: ReturnType<typeof setTimeout> | null = null;

/** A message across the foot of the page, which fades on its own. */
export function showToast(message: string, holdMs: number = TOAST_HOLD_MS): void {
  let toast = document.querySelector<HTMLDivElement>('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast?.classList.remove('show'), holdMs);
}

/** A random index into a list of that many things. */
export function randomIndex(count: number): number {
  return Math.floor(Math.random() * count);
}

/** A value in the slider's own range, so the bounds stay declared in one place. */
export function randomWithinSlider(slider: HTMLInputElement): number {
  const min = Number(slider.min);
  const max = Number(slider.max);
  return min + randomIndex(max - min + 1);
}
