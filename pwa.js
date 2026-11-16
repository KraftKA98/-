(() => {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register('./sw.js').catch(error => console.warn('PWA: регистрация недоступна', error));
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) return;
  const style = document.createElement('style');
  style.textContent = '.pwa-install{position:fixed;z-index:18;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom));width:min(92vw,480px);box-sizing:border-box;background:#34473d;color:#fff;padding:16px;border-radius:18px;box-shadow:0 8px 35px #0003;font:14px system-ui}.pwa-install p{margin:8px 0 12px;line-height:1.5}.pwa-install button{background:#f4f3ed;color:#26352f;padding:11px 15px;border:0;border-radius:10px;font:inherit;cursor:pointer}.pwa-install .pwa-close{float:right;background:transparent;color:white;font-size:22px;padding:0 3px}';
  document.head.append(style);
  let promptEvent;
  let panel;
  const dismissed = () => {try {return sessionStorage.getItem('hochu-pwa-dismissed') === '1';} catch {return false;}};
  function show(ios) {
    if (panel || dismissed()) return;
    panel = document.createElement('aside');
    panel.className = 'pwa-install';
    panel.setAttribute('aria-label', 'Установка приложения');
    panel.innerHTML = '<button class="pwa-close" aria-label="Закрыть">×</button><strong>ХОЧУ. — всегда под рукой</strong>' + (ios ? '<p>В Safari нажмите «Поделиться», затем «На экран Домой», чтобы установить приложение.</p>' : '<p>Добавьте приложение на главный экран телефона.</p><button class="pwa-accept">Установить</button>');
    panel.querySelector('.pwa-close').onclick = () => {panel.remove();panel = null;try {sessionStorage.setItem('hochu-pwa-dismissed','1');} catch {}};
    const accept = panel.querySelector('.pwa-accept');
    if (accept) accept.onclick = async () => {
      if (!promptEvent) return;
      accept.disabled = true;
      try {await promptEvent.prompt();await promptEvent.userChoice;} catch (error) {console.warn('PWA: установка отменена',error);} finally {promptEvent = null;panel?.remove();panel = null;}
    };
    document.body.append(panel);
  }
  addEventListener('beforeinstallprompt', event => {event.preventDefault();promptEvent = event;show(false);});
  addEventListener('appinstalled', () => {panel?.remove();panel = null;promptEvent = null;});
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) show(true);
})();
