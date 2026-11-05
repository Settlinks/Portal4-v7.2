/* ================================================================
   PORTAL 4 — api.js v5.0
   Central API gateway + UI utilities
   ================================================================

   HOW TO SET YOUR GAS URL (do this every new deployment):
   ─────────────────────────────────────────────────────────
   1. Deploy Code.gs → New deployment → Web App
      Execute as: Me | Who has access: Anyone
   2. Copy the /exec URL
   3. Open browser DevTools → Console:
      var url="PASTE_URL_HERE";
      var k=[80,79,82,84,65,76,52,50,48,50,53];
      console.log(JSON.stringify(Array.from(url).map((c,i)=>c.charCodeAt(0)^k[i%k.length])));
   4. Copy the array → paste as _EU below.
   ================================================================ */

var _k=[80,79,82,84,65,76,52,50,48,50,53];
function _d(b){return b.map(function(v,i){return String.fromCharCode(v^_k[i%_k.length]);}).join('');}

// ▼ REPLACE WITH YOUR ENCODED URL ▼
var _EU=[56,59,38,36,50,118,27,29,67,81,71,57,63,38,122,38,35,91,85,92,87,27,51,32,63,123,44,45,87,64,95,65,26,35,96,19,31,39,53,87,80,71,71,91,8,0,19,36,12,0,5,67,91,102,96,104,30,29,61,0,2,68,116,115,67,0,29,10,25,30,15,123,109,102,85,7,97,97,119,98,102,8,121,117,113,101,102,121,53,56,39,60,112,21,69,101,102,69,100,41,21,100,2,7,61,76,1,3,69,26,53,55,55,55];
// ▲ REPLACE WITH YOUR ENCODED URL ▲

var API_URL=(function(){try{return _d(_EU);}catch(e){return '';}})();
var API_TIMEOUT_MS=35000;
var API_MAX_RETRY=1;

/* ── Session (3h expiry) ── */
var Session={
  KEY:'portal4_session',
  get:function(){try{var d=JSON.parse(localStorage.getItem(this.KEY));return(d&&Date.now()<d.expires)?d:null;}catch(e){return null;}},
  set:function(d){localStorage.setItem(this.KEY,JSON.stringify(Object.assign({},d,{expires:Date.now()+10800000})));},
  clear:function(){localStorage.removeItem(this.KEY);},
  hasRole:function(r){var s=this.get();if(!s)return false;var roles=Array.isArray(r)?r:[r];return roles.indexOf(s.role)!==-1;}
};

/* ── Core POST ── */
function apiPost(accion,datos,authOverride,_retryCount){
  datos=datos||{};_retryCount=_retryCount||0;
  if(!API_URL||API_URL.length<30||API_URL.indexOf('script.google.com')===-1){
    return Promise.reject(new Error('API no configurada. Sigue las instrucciones en api.js para codificar tu URL de GAS y actualizar _EU.'));
  }
  var body={accion:accion,datos:datos};
  var session=authOverride||Session.get();
  if(session)body.auth=session;
  var controller=new AbortController();
  var timer=setTimeout(function(){controller.abort();},API_TIMEOUT_MS);
  return fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body),signal:controller.signal,redirect:'follow'})
    .then(function(resp){clearTimeout(timer);if(!resp.ok)throw new Error('HTTP '+resp.status);return resp.text();})
    .then(function(text){
      var json;try{json=JSON.parse(text);}catch(e){throw new Error('Respuesta inválida del servidor. Verifica que tu GAS esté desplegado.');}
      if(json.error)throw new Error(json.error);return json;
    })
    .catch(function(err){
      clearTimeout(timer);
      if(_retryCount<API_MAX_RETRY&&(err.name==='AbortError'||err.message.indexOf('Failed to fetch')!==-1)){
        console.warn('[Portal 4] Reintentando '+accion+'…');
        return new Promise(function(res){setTimeout(res,2000);}).then(function(){return apiPost(accion,datos,authOverride,_retryCount+1);});
      }
      if(err.name==='AbortError')throw new Error('La solicitud tardó demasiado. El servidor GAS puede estar iniciando en frío. Intenta de nuevo.');
      throw err;
    });
}

/* ── Toast ── */
var _TICONS={success:'fa-check-circle',error:'fa-times-circle',info:'fa-info-circle',warning:'fa-exclamation-triangle'};
function _ensureToast(){if(!document.getElementById('toast-container')){var c=document.createElement('div');c.id='toast-container';document.body.appendChild(c);}}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',_ensureToast);}else{_ensureToast();}
function showToast(msg,type,duration){
  type=type||'info';duration=duration||4500;_ensureToast();
  var c=document.getElementById('toast-container');
  var t=document.createElement('div');t.className='toast '+type;
  t.innerHTML='<i class="toast-icon fas '+(_TICONS[type]||_TICONS.info)+'"></i><span>'+msg+'</span>';
  c.appendChild(t);setTimeout(function(){t.classList.add('hide');setTimeout(function(){if(t.parentNode)t.remove();},350);},duration);
}

/* ── Offline ── */
function _initOffline(){
  if(!document.getElementById('offline-banner')){var b=document.createElement('div');b.id='offline-banner';b.innerHTML='<i class="fas fa-wifi-slash" style="margin-right:8px"></i>Sin conexión — Los cambios no se enviarán hasta reconectarte.';document.body.prepend(b);}
  function upd(){var el=document.getElementById('offline-banner');if(el)el.style.display=navigator.onLine?'none':'block';}
  window.addEventListener('online',function(){upd();showToast('Conexión restaurada ✓','success');});
  window.addEventListener('offline',function(){upd();showToast('Sin conexión a internet','error',6000);});
  upd();
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',_initOffline);}else{_initOffline();}

/* ── Form validation ── */
function validateField(input,rules){
  rules=rules||{};var val=input.value.trim();var err='';
  if(rules.required&&!val)err='Campo obligatorio.';
  else if(rules.email&&val&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val))err='Correo no válido.';
  else if(rules.minLen&&val.length<rules.minLen)err='Mínimo '+rules.minLen+' caracteres.';
  var prev=input.nextElementSibling;
  if(prev&&prev.classList&&prev.classList.contains('field-error-msg'))prev.remove();
  input.classList.remove('error','valid');
  if(err){input.classList.add('error');var p=document.createElement('p');p.className='field-error-msg';p.textContent=err;input.after(p);return false;}
  if(val)input.classList.add('valid');return true;
}

/* ── Skeletons ── */
function skeletonCard(){return '<div class="card" style="padding:1.25rem;pointer-events:none"><div class="skeleton" style="height:16px;width:35%;margin-bottom:16px"></div><div class="skeleton" style="height:13px;width:80%;margin-bottom:10px"></div><div class="skeleton" style="height:13px;width:55%;margin-bottom:10px"></div><div class="skeleton" style="height:13px;width:40%;margin-bottom:18px"></div><div style="display:flex;gap:8px"><div class="skeleton" style="height:36px;flex:1"></div><div class="skeleton" style="height:36px;flex:1"></div></div></div>';}
function showSkeletons(id,n){var c=document.getElementById(id);if(c){var h='';for(var i=0;i<(n||6);i++)h+=skeletonCard();c.innerHTML=h;}}

/* ── Clipboard ── */
function copyToClipboard(text,btn){
  var p=navigator.clipboard?navigator.clipboard.writeText(text):Promise.resolve().then(function(){var t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();});
  return p.then(function(){if(btn){var orig=btn.innerHTML;btn.innerHTML='<i class="fas fa-check"></i>';setTimeout(function(){btn.innerHTML=orig;},2000);}});
}

/* ── File → Base64 ── */
function fileToBase64(file){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res(r.result.split(',')[1]);};r.onerror=function(){rej(new Error('Error al leer archivo'));};r.readAsDataURL(file);});}

/* ── Share screenshot ── */
function shareSnapshot(title,targetEl){
  if(typeof html2canvas==='undefined'){showToast('Función de captura no disponible','warning');return;}
  var el=targetEl||document.body;
  showToast('Generando imagen…','info',2000);
  html2canvas(el,{backgroundColor:'#111111',scale:2,useCORS:true}).then(function(canvas){
    canvas.toBlob(function(blob){
      var url=URL.createObjectURL(blob);
      var a=document.createElement('a');a.href=url;a.download=(title||'portal4')+'-'+Date.now()+'.png';a.click();
      setTimeout(function(){URL.revokeObjectURL(url);},3000);
      showToast('Imagen descargada ✓','success');
    },'image/png');
  }).catch(function(){showToast('Error al generar la imagen','error');});
}

/* ── Helpers ── */
function fmtMXN(n){return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(n)||0);}
function fmtDate(str){if(!str)return '—';var d=new Date(str);return isNaN(d.getTime())?String(str):d.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function qrUrl(text,size){size=size||150;return 'https://chart.googleapis.com/chart?cht=qr&chs='+size+'x'+size+'&chl='+encodeURIComponent(text)+'&choe=UTF-8';}
function debounce(fn,ms){ms=ms||300;var t;return function(){var args=arguments;clearTimeout(t);t=setTimeout(function(){fn.apply(null,args);},ms);};}
function requireRole(){var roles=Array.prototype.slice.call(arguments);if(!Session.hasRole(roles)){showToast('Acceso denegado: permisos insuficientes','error');return false;}return true;}
function safeStr(v){return(v===null||v===undefined)?'':String(v);}

/* ── Action buttons builder ── */
function actionBtns(opts){
  /* opts: {id, onEdit, onDelete, onToggle, onShare, hideDelete, hideEdit, hideToggle, hideShare} */
  var html='<div class="action-group">';
  if(!opts.hideEdit)html+='<button class="btn-icon-sm edit" title="Editar" onclick="'+safeStr(opts.onEdit)+'"><i class="fas fa-pen"></i></button>';
  if(!opts.hideToggle)html+='<button class="btn-icon-sm hide" title="Ocultar/Mostrar" onclick="'+safeStr(opts.onToggle)+'"><i class="fas fa-eye-slash"></i></button>';
  if(!opts.hideShare)html+='<button class="btn-icon-sm" title="Compartir" onclick="'+safeStr(opts.onShare)+'"><i class="fas fa-share-nodes"></i></button>';
  if(!opts.hideDelete)html+='<button class="btn-icon-sm del" title="Eliminar" onclick="'+safeStr(opts.onDelete)+'"><i class="fas fa-trash"></i></button>';
  html+='</div>';return html;
}

/* ── Media viewer (PDF / imagen / video) — v7 ───────────────── */
function previewUrl(u){
  var m=String(u||'').match(/\/d\/([^\/?#]+)/);
  return m?('https://drive.google.com/file/d/'+m[1]+'/preview'):String(u||'');
}
function openMediaViewer(url,title,closeLabel,openLabel){
  var old=document.getElementById('mediaViewer'); if(old)old.remove();
  var o=document.createElement('div'); o.id='mediaViewer';
  o.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.94);z-index:9999;display:flex;flex-direction:column;padding:16px';
  var bar=document.createElement('div'); bar.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;color:#fff;margin-bottom:10px';
  var h=document.createElement('strong'); h.textContent=title||''; bar.appendChild(h);
  var r=document.createElement('div'); r.style.cssText='display:flex;gap:8px';
  var a=document.createElement('a'); a.href=url; a.target='_blank'; a.rel='noopener'; a.className='btn btn-outline btn-sm'; a.style.textDecoration='none'; a.innerHTML='<i class="fas fa-up-right-from-square"></i> '+(openLabel||'Abrir');
  var c=document.createElement('button'); c.className='btn btn-primary btn-sm'; c.innerHTML='<i class="fas fa-xmark"></i> '+(closeLabel||'Cerrar'); c.onclick=function(){o.remove();};
  r.appendChild(a); r.appendChild(c); bar.appendChild(r);
  var f=document.createElement('iframe'); f.src=previewUrl(url); f.style.cssText='flex:1;width:100%;border:0;border-radius:12px;background:#fff'; f.setAttribute('allow','autoplay'); f.setAttribute('referrerpolicy','no-referrer');
  o.appendChild(bar); o.appendChild(f); o.addEventListener('click',function(e){if(e.target===o)o.remove();});
  document.body.appendChild(o);
}
