(function () {
  const header = document.querySelector('header');
  if (!header) return;
  const onInstashop = location.pathname.endsWith('/instashop.html');
  const nav = document.createElement('nav');
  nav.className = 'demo-screen-nav';
  nav.setAttribute('aria-label', 'Синтетические экраны');
  nav.innerHTML = `<a ${onInstashop ? '' : 'aria-current="page"'} href="./">E-commerce</a><a ${onInstashop ? 'aria-current="page"' : ''} href="./instashop.html">Instashop</a>`;
  header.after(nav);
  const banner = document.createElement('aside');
  banner.className = 'demo-banner';
  banner.innerHTML = '<b>СИНТЕТИЧЕСКИЙ TEST PROJECT</b><span>Ни одной строки HOUSEVIP или другого реального клиента. Данные предназначены только для проверки UI и контрактов.</span>';
  nav.after(banner);
}());
