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
  const mobile = matchMedia('(max-width:760px)');
  const place = () => { for (const {element,desktop} of controls) (mobile.matches ? actions : desktop).append(element); };
  mobile.addEventListener('change', place);
  place();
  mountMobileKeyboard();
}
