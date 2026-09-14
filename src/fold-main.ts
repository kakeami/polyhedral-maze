import './style.css';
import { initFoldApp } from './ui/fold-app.ts';

const viewport = document.querySelector<HTMLDivElement>('#viewport')!;
const controls = document.querySelector<HTMLDivElement>('#controls')!;
initFoldApp(viewport, controls);
