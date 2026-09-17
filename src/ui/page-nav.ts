/**
 * The switch between the three mazes, and the link to the source.
 *
 * One control rather than a row of arrows. The arrows were a menu that made
 * you read it: "Kinetic maze →" says where you would go but not where you are,
 * and with three pages there is always one you cannot see from where you are
 * standing. A segmented control says both at once — all three, with the
 * current one lit — and it is the same control on every page, in the same
 * place, so it stops being navigation and becomes part of the furniture.
 *
 * It sits at the top of the panel, above the title, because it is the widest
 * thing the panel decides: which object you are looking at. Everything below
 * it is a setting of that object, and a switch you only meet after scrolling
 * past all of them reads as an afterthought.
 *
 * The three are siblings rather than a trunk and two branches, which is what
 * the arrows implied by pointing away from the polyhedral page. They are three
 * objects that happen to share a maze layer.
 *
 * The source link does not go with them: it leaves the site altogether, so it
 * stays at the foot of the panel where a footer belongs.
 *
 * Links are relative because the site is served from a subdirectory
 * (`base: '/polyhedral-maze/'`) and there is no router: a page knows where it
 * is by which id it asks for.
 */

import { esc } from './panel.ts';

export type PageId = 'polyhedral' | 'turning' | 'folding';

interface Page {
  readonly id: PageId;
  readonly label: string;
  /** Directory it lives in, under the site root. */
  readonly path: string;
  readonly title: string;
}

const PAGES: readonly Page[] = [
  {
    id: 'polyhedral',
    label: 'Polyhedral',
    path: '',
    title: 'A maze on the surface of any of 144 solids',
  },
  {
    id: 'turning',
    label: 'Turning',
    path: 'turning/',
    title: 'A maze on an object that turns — every way of turning it is a '
      + 'different maze, and every one is solvable',
  },
  {
    id: 'folding',
    label: 'Folding',
    path: 'fold/',
    title: 'A maze on eight cubes taped into a ring — fold it and half the maze '
      + 'goes inside, and what is left is still a perfect maze',
  },
];

const GITHUB = 'https://github.com/kakeami/polyhedral-maze';

const MARK = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">'
  + '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/>'
  + '</svg>';

/** How to get from the page you are on to the page you want. */
function href(from: PageId, to: Page): string {
  const up = from === 'polyhedral' ? './' : '../';
  return up + to.path;
}

/**
 * The switch, for the top of a panel.
 *
 * The current page is a link to itself rather than a dead span so that the row
 * keeps its shape and a keyboard can still land on it; `aria-current` is what
 * says which one it is, to a screen reader and to the stylesheet alike.
 */
export function pageSwitchHTML(current: PageId): string {
  const tabs = PAGES.map(page => {
    const here = page.id === current;
    return `<a class="page-switch-tab" href="${href(current, page)}"`
      + `${here ? ' aria-current="page"' : ''} title="${esc(page.title)}">${esc(page.label)}</a>`;
  }).join('');
  return `<nav class="page-switch" aria-label="Which maze">${tabs}</nav>`;
}

/** The way out of the site, for the foot of a panel. */
export function sourceLinkHTML(): string {
  return `
    <a class="source-link" href="${GITHUB}" target="_blank" rel="noopener noreferrer">
      ${MARK}<span>Source on GitHub</span>
    </a>
  `;
}

