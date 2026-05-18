export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });

        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        resolve(registration);
      } catch (err) {
        console.warn('Service worker registration failed:', err);
        resolve(null);
      }
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }
  });
}

export function listenForInstallPrompt() {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    window.deferredPwaInstallPrompt = event;
  });
}

export function getPwaInstallabilitySnapshot() {
  const manifestOk = !!document.querySelector('link[rel="manifest"]');
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  return {
    manifestLinked: manifestOk,
    serviceWorkerSupported: 'serviceWorker' in navigator,
    serviceWorkerControlled: !!navigator.serviceWorker?.controller,
    displayMode: standalone ? 'standalone' : 'browser',
    canInstallAndroid: !!window.deferredPwaInstallPrompt,
    isIOS:
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  };
}
