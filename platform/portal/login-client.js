export const loginClient=`
const form=document.getElementById('loginForm'),status=document.getElementById('loginStatus');
async function clearDashboardCache(){try{for(const key of Object.keys(sessionStorage))if(key.startsWith('toys-dashboard-cache:'))sessionStorage.removeItem(key);}catch{}try{for(const name of await caches.keys())if(name.startsWith('toys-dashboard-cache:responses:'))await caches.delete(name);}catch{}}
const activation=new URLSearchParams(location.hash.slice(1)).get('token');
if(activation)history.replaceState(null,'',location.pathname);
const errors={invalid_credentials:'Неверный email или пароль.',password_too_short:'Пароль должен содержать не менее 12 символов.',invitation_expired:'Ссылка недействительна или уже использована. Попросите менеджера TOYS выдать новую.',too_many_attempts:'Слишком много попыток. Попробуйте через 15 минут.',origin_forbidden:'Обновите страницу и попробуйте ещё раз.'};
if(form){
 document.getElementById('showPassword').onclick=()=>{const p=form.elements.password,b=document.getElementById('showPassword');p.type=p.type==='password'?'text':'password';b.textContent=p.type==='password'?'Показать':'Скрыть';};
 form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('[type=submit]');if(b.disabled)return;const password=form.elements.password.value;
 if(form.dataset.activate&&password!==form.elements.confirm.value){status.textContent='Пароли не совпадают.';return;}
 b.disabled=true;status.textContent='';
 try{const response=await fetch('/api/v2/portal/'+(form.dataset.activate?'set-password':'sign-in'),{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(form.dataset.activate?{token:activation,password}:{email:form.elements.email.value,password})});const data=await response.json();if(!response.ok||!data.ok)throw new Error(errors[data.error]||'Не удалось войти. Попробуйте ещё раз.');await clearDashboardCache();location.assign(data.redirect);}catch(e){status.textContent=e.message;}finally{b.disabled=false;}
 };
}
document.getElementById('logout')?.addEventListener('click',async e=>{e.preventDefault();const r=await fetch('/api/v2/portal/sign-out',{method:'POST',credentials:'same-origin'});if(r.ok){await clearDashboardCache();location.assign('/login');}});
`;
