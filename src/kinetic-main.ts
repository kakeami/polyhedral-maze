import './style.css';
import { initKineticApp } from './ui/kinetic-app.ts';

const viewport = document.querySelector<HTMLDivElement>('#viewport')!;
const controls = document.querySelector<HTMLDivElement>('#controls')!;
initKineticApp(viewport, controls);
