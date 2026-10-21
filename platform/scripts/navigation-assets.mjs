// Preserve native browser navigation for the dashboard's section menu.
export function sectionNavigation(source,path){
 if(path.endsWith('.css'))return source.replaceAll('.ux-nav button','.ux-nav :is(button,a)')+'\n.ux-nav a{text-decoration:none}.ux-nav a:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}\n';
 source=source.replace(/<button([^>]*data-ux-view="([^"]+)"[^>]*)>([\s\S]*?)<\/button>/g,(_,attrs,view,body)=>`<a href="#${view}"${attrs.replace('type="button"','')}>${body}</a>`);
 source=source.replaceAll("nav.querySelectorAll('button')","nav.querySelectorAll('[data-ux-view]')");
 // Keep ordinary clicks in the current dashboard; modified clicks belong to
 // the browser and must not change the current tab or start loading a report.
 source=source.replace("const button=event.target.closest('[data-ux-view]');", "const button=event.target.closest('[data-ux-view]');if(!button||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();");
 if(path==='core/ux-v2.js')source=source.replace("else showAnalytics('overview');", "else if(route==='project')showProject();else showAnalytics('overview');");
 return source;
}
