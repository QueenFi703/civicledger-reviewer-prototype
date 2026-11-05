import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Workspace from './workspace';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('The public demo root is missing.');
createRoot(root).render(<StrictMode><Workspace /></StrictMode>);
