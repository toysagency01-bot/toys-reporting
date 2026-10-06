(function(){
  const STYLE_ID='toys-nav-scroll-style';
  const NAV_SELECTOR='.ux-nav';

  if(!document.getElementById(STYLE_ID)){
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
.ux-nav-shell{position:relative;width:max-content;max-width:100%;margin-bottom:16px;padding-bottom:6px}
.ux-nav-shell>.ux-nav{max-width:100%;margin-bottom:0;scroll-behavior:smooth;scroll-padding-inline:44px}
.ux-nav-scroll{position:absolute;top:5px;bottom:11px;z-index:5;display:none;width:38px;border:0;color:var(--text);font:800 24px/1 system-ui;cursor:pointer;align-items:center;justify-content:center;transition:opacity .16s ease}
.ux-nav-shell.has-overflow .ux-nav-scroll{display:flex}
.ux-nav-scroll.prev{left:4px;border-radius:10px 0 0 10px;background:linear-gradient(90deg,var(--panel) 62%,transparent)}
.ux-nav-scroll.next{right:4px;border-radius:0 10px 10px 0;background:linear-gradient(270deg,var(--panel) 62%,transparent)}
.ux-nav-shell.at-start .ux-nav-scroll.prev,.ux-nav-shell.at-end .ux-nav-scroll.next{display:none}
.ux-nav-progress{position:absolute;left:10px;right:10px;bottom:0;display:none;height:3px;border-radius:999px;background:var(--line);background:color-mix(in srgb,var(--line) 74%,transparent);overflow:hidden}
.ux-nav-shell.has-overflow .ux-nav-progress{display:block}
.ux-nav-progress>i{display:block;height:100%;border-radius:inherit;background:var(--accent);transform-origin:left center;transition:transform .08s linear,width .12s ease}
@media(max-width:760px){.ux-nav-shell{width:100%}.ux-nav-scroll{width:34px}}
`;
    document.head.appendChild(style);
  }

  function enhance(nav){
    if(!nav || nav.dataset.scrollNavReady==='1') return;
    nav.dataset.scrollNavReady='1';

    const shell=document.createElement('div');
    shell.className='ux-nav-shell at-start at-end';
    nav.parentNode.insertBefore(shell,nav);
    shell.appendChild(nav);

    const prev=document.createElement('button');
    prev.type='button'; prev.className='ux-nav-scroll prev'; prev.setAttribute('aria-label','Прокрутить меню влево'); prev.textContent='‹';
    const next=document.createElement('button');
    next.type='button'; next.className='ux-nav-scroll next'; next.setAttribute('aria-label','Прокрутить меню вправо'); next.textContent='›';
    const progress=document.createElement('div');
    progress.className='ux-nav-progress'; progress.setAttribute('aria-hidden','true'); progress.innerHTML='<i></i>';
    shell.append(prev,next,progress);

    let frame=0;
    function update(){
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        const max=Math.max(0,nav.scrollWidth-nav.clientWidth);
        const overflow=max>3;
        const position=Math.min(max,Math.max(0,nav.scrollLeft));
        shell.classList.toggle('has-overflow',overflow);
        shell.classList.toggle('at-start',!overflow||position<=3);
        shell.classList.toggle('at-end',!overflow||position>=max-3);
        const thumb=progress.firstElementChild;
        const ratio=overflow?Math.max(.14,nav.clientWidth/nav.scrollWidth):1;
        thumb.style.width=`${ratio*100}%`;
        thumb.style.transform=`translateX(${overflow&&max?position/max*(100/ratio-100):0}%)`;
      });
    }
    function step(direction){ nav.scrollBy({left:direction*Math.max(180,nav.clientWidth*.68),behavior:'smooth'}); }
    function revealActive(behavior){
      const active=nav.querySelector('button.active');
      if(!active) return;
      const left=active.offsetLeft, right=left+active.offsetWidth;
      const safeLeft=nav.scrollLeft+42, safeRight=nav.scrollLeft+nav.clientWidth-42;
      if(left<safeLeft) nav.scrollTo({left:Math.max(0,left-48),behavior:behavior||'smooth'});
      else if(right>safeRight) nav.scrollTo({left:right-nav.clientWidth+48,behavior:behavior||'smooth'});
    }

    prev.addEventListener('click',()=>step(-1));
    next.addEventListener('click',()=>step(1));
    nav.addEventListener('scroll',update,{passive:true});
    nav.addEventListener('wheel',event=>{
      const max=nav.scrollWidth-nav.clientWidth;
      if(max<=3) return;
      const delta=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
      const canMove=delta>0?nav.scrollLeft<max-3:nav.scrollLeft>3;
      if(!canMove) return;
      event.preventDefault();
      nav.scrollBy({left:delta,behavior:'auto'});
    },{passive:false});
    nav.addEventListener('click',()=>requestAnimationFrame(()=>revealActive('smooth')));

    new MutationObserver(()=>{ update(); revealActive('smooth'); }).observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    if(window.ResizeObserver) new ResizeObserver(update).observe(nav);
    else window.addEventListener('resize',update,{passive:true});
    update();
    requestAnimationFrame(()=>revealActive('auto'));
  }

  function init(){ document.querySelectorAll(NAV_SELECTOR).forEach(enhance); }
  init();
  new MutationObserver(init).observe(document.documentElement,{childList:true,subtree:true});
})();
