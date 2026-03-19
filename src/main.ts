import './style.css';
import { initApp } from './ui/app.ts';

const viewport = document.querySelector<HTMLDivElement>('#viewport')!;
const controls = document.querySelector<HTMLDivElement>('#controls')!;
initApp(viewport, controls);
