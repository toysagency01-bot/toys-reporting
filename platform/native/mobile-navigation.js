import {mountBackTrail} from './mobile-back.js';
// Shared by standalone master pages and the client shell (including shadow CRM).
let keyboardMounted = false;
export function mountMobileKeyboard() {
  if (keyboardMounted || !window.visualViewport) return;
  keyboardMounted = true;
  const viewport = window.visualViewport;
  const mobile = matchMedia('(max-width:760px)');
  let baseline = innerHeight, width = innerWidth, frame;
  function update() {
    frame = null;
    if (width !== innerWidth) { width = innerWidth; baseline = innerHeight; }
    let focused = document.activeElement;
    while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
    const editing = focused?.matches('textarea,input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit])') || focused?.isContentEditable;
    baseline = Math.max(baseline, innerHeight, viewport.height);
    const keyboard = mobile.matches && editing && viewport.scale < 1.1 && baseline - viewport.height > 150;
    document.documentElement.toggleAttribute('data-mobile-keyboard', Boolean(keyboard));
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  viewport.addEventListener('resize', schedule);
  window.addEventListener('resize', schedule);
  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', schedule);
  mobile.addEventListener('change', schedule);
  update();
}

export function mountMasterMobileControls(root) {
  const header = root.querySelector('.master-main > header');
  const controls = [root.getElementById('masterAccount'), root.getElementById('theme')]
    .map(element => ({element, desktop:element.parentElement}));
  const actions = document.createElement('div');
  actions.className = 'mobile-header-actions';
  header.append(actions);
  if(root===document){
    const nav=root.querySelector('.master-sidebar nav'),project=root.getElementById('projectSelect');
    mountBackTrail({root,header,id:'masterMobileBack',observe:[nav],fallback:{view:'home',project:''},identify:state=>state.view,
      read:()=>({view:nav?.querySelector('[data-view].active')?.dataset.view||'home',project:project?.value||''}),
      navigate:target=>{nav?.querySelector(`[data-view="${CSS.escape(target.view)}"]`)?.click();if(nav?.querySelector('[data-view].active')?.dataset.view!==target.view)return;if(project&&project.value!==target.project&&[...project.options].some(o=>o.value===target.project)){project.value=target.project;project.dispatchEvent(new Event('change',{bubbles:true}));}}
    });
  }
  const mobile = matchMedia('(max-width:760px)');
  const place = () => { for (const {element,desktop} of controls) (mobile.matches ? actions : desktop).append(element); };
  mobile.addEventListener('change', place);
  place();
  const nav = root.querySelector('.master-sidebar nav');
  if (nav) {
    // Keep secondary destinations readable on phones and preserve desktop order.
    const more = document.createElement('details');
    more.className = 'master-more-nav';
    more.innerHTML = '<summary aria-label="Ещё разделы"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>Ещё</span></summary><div class="master-more-panel" aria-label="Другие разделы"></div>';
    const panel = more.querySelector('.master-more-panel');
    const secondary = [...nav.querySelectorAll('[data-view=reviews],[data-view=access],[data-view=audit]')].map(button => {
      const marker = document.createComment('desktop navigation position');
      button.before(marker);
      return {button,marker};
    });
    nav.append(more);
    const syncMenu = () => {
      for (const {button,marker} of secondary) {
        if (mobile.matches) { if (button.parentElement !== panel) panel.append(button); }
        else if (button.previousSibling !== marker) marker.after(button);
      }
      more.hidden = !mobile.matches || !secondary.some(({button}) => !button.hidden);
      more.open = false;
    };
    const close = () => { if (mobile.matches) more.open = false; };
    root.addEventListener('click', event => {
      if (!more.contains(event.target) || event.target.closest('[data-view]')) close();
    });
    root.addEventListener('keydown', event => { if (event.key === 'Escape' && more.open && mobile.matches) { close();more.querySelector('summary').focus(); } });
    window.addEventListener('hashchange', close);
    mobile.addEventListener('change', syncMenu);
    const observer = new MutationObserver(syncMenu);
    for (const {button} of secondary) observer.observe(button, {attributes:true,attributeFilter:['hidden']});
    syncMenu();
  }
  mountMobileKeyboard();
}
