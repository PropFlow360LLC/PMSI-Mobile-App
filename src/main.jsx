import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerServiceWorker, listenForInstallPrompt } from './registerPwa';

listenForInstallPrompt();
registerServiceWorker();

const splash = document.getElementById('pmsi-splash');
if (splash) splash.classList.add('pmsi-splash--hide');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
