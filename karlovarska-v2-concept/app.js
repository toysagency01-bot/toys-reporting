(function(){
  const root = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  const navButtons = [...document.querySelectorAll('[data-view]')];
  const views = [...document.querySelectorAll('[data-view-panel]')];

  function setView(name){
    navButtons.forEach(button => button.classList.toggle('active', button.dataset.view === name));
    views.forEach(view => view.classList.toggle('active', view.dataset.viewPanel === name));
    window.scrollTo({top:0, behavior:'smooth'});
  }

  navButtons.forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  document.querySelectorAll('[data-open-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.openView)));

  document.querySelectorAll('.filter-group,.period-presets').forEach(group => {
    group.addEventListener('click', event => {
      const button = event.target.closest('button');
      if(!button) return;
      group.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
    });
  });

  function setTheme(theme){
    root.dataset.theme = theme;
    try { localStorage.setItem('toys-prototype-theme', theme); } catch (_) {}
  }

  try { setTheme(localStorage.getItem('toys-prototype-theme') || 'light'); } catch (_) { setTheme('light'); }
  themeToggle.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));
})();
