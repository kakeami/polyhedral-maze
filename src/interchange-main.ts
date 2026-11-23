import './style.css';
import { initInterchangeApp } from './ui/interchange-app.ts';

const viewport = document.querySelector<HTMLDivElement>('#viewport')!;
const controls = document.querySelector<HTMLDivElement>('#controls')!;
initInterchangeApp(viewport, controls);
