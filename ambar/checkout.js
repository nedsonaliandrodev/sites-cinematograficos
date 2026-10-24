/* ═══════════════════════════════════════════════════════════════════════════════════════════
   CHECKOUT — bolsa + pago de tres pasos con tarjeta en 3D (23-sep-2026)

   Alex, 23-sep: "Para el carrito de compra hazlo así", con un reel de referencia:
   https://www.instagram.com/reel/DdbgctKTuoO/ — tarjeta que escribe lo que tecleas, se gira en
   el CVV, vuela al centro con un borde que gira ("processing") y se pone verde al pagar.

   ⛔ ESTA VERSIÓN ES LA DEMO Y NO COBRA. No hay ni un fetch en este fichero: lo que se teclea
   se queda en la pestaña. Por eso la tarjeta puede reflejar los dígitos. En la web de un
   cliente real el pago va por Stripe Elements (iframes de Stripe: nosotros nunca vemos el
   número), y ahí la tarjeta enseña la marca, el nombre y el giro, pero NO los dígitos.

   Uso en cualquier web:
     · cada producto lleva  data-sku data-name data-price data-img [data-note]
     · dentro, un botón  [data-co-add]  (o se pone solo al final de la tarjeta)
     · la barra lleva un hueco  [data-co-bag]  o se usa la primera  .pill
     · window.CHECKOUT_CONFIG = {...} antes de cargar este fichero para cambiar textos
   window.ascentaCheckout.demo() recorre el flujo entero solo (para grabar el anuncio).
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
(function(){
"use strict";

const CFG=Object.assign({
  locale:"en-US", currency:"USD", logo:"logo.png", house:"Ámbar", storeKey:"co-bag:"+location.pathname,
  shipping:[
    {id:"std", label:"Complimentary delivery", note:"3–5 business days · insured", price:0},
    {id:"exp", label:"Express", note:"1–2 business days · signed for", price:30}
  ],
  /* el cliente de ejemplo compra en USD, asi que vive en EE.UU. (23-sep: una direccion de Paris con
     precios en dolares no cuadra, y esta demo sale en el anuncio) */
  sample:{email:"claire@maisonlune.co", name:"Claire Dubois", address:"118 Perry Street", city:"New York",
          zip:"10014", country:"US", card:"4242 4242 4242 4242", exp:"12/29", cvc:"123"}
},window.CHECKOUT_CONFIG||{});

const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const money=n=>new Intl.NumberFormat(CFG.locale,{style:"currency",currency:CFG.currency}).format(n);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const RM=matchMedia("(prefers-reduced-motion:reduce)").matches;

const I={
  bag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  tick:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  card:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18"/></svg>',
  cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>',
  eye:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  mail:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6l8.5 7 8.5-7"/></svg>',
  pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 21s-7-6.3-7-11.5a7 7 0 0 1 14 0C19 14.7 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  flip:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/></svg>',
  shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
  nfc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 7.5a6 6 0 0 1 0 9M11.5 5a10 10 0 0 1 0 14M15 3a14 14 0 0 1 0 18"/></svg>'
};

/* ── catálogo: lo leen de la página, no se escribe dos veces ─────────────────────────────── */
const PRODUCTS={};
$$("[data-sku]").forEach(el=>{
  const p={sku:el.dataset.sku,name:el.dataset.name,price:+el.dataset.price,img:el.dataset.img||"",note:el.dataset.note||""};
  PRODUCTS[p.sku]=p;
  let b=$("[data-co-add]",el);
  if(!b){ b=document.createElement("button"); b.type="button"; b.className="co-add"; b.setAttribute("data-co-add","");
    (el.querySelector(".pinfo")||el).appendChild(b); }
  if(!b.innerHTML.trim()) b.innerHTML=I.bag+"<span>Add to bag</span>";
  b.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();add(p.sku,b);});
});
$$("[data-co-add-sku]").forEach(b=>b.addEventListener("click",e=>{e.preventDefault();add(b.dataset.coAddSku,b);}));

/* ── la bolsa, guardada en la pestaña ────────────────────────────────────────────────────── */
let bag=[];
try{ bag=(JSON.parse(localStorage.getItem(CFG.storeKey))||[]).filter(l=>PRODUCTS[l.sku]); }catch(_){ bag=[]; }
const save=()=>{ try{localStorage.setItem(CFG.storeKey,JSON.stringify(bag));}catch(_){} };
const count=()=>bag.reduce((n,l)=>n+l.qty,0);
const subtotal=()=>bag.reduce((n,l)=>n+l.qty*PRODUCTS[l.sku].price,0);
let shipId=CFG.shipping[0].id;
const shipCost=()=>(CFG.shipping.find(s=>s.id===shipId)||CFG.shipping[0]).price;

/* ── el DOM del módulo ───────────────────────────────────────────────────────────────────── */
const host=$("[data-co-bag]")||$(".pill");
const bagBtn=document.createElement("button");
bagBtn.type="button"; bagBtn.className="co-bagbtn"; bagBtn.setAttribute("aria-label","Open bag");
bagBtn.innerHTML=I.bag+"<b>0</b>";
if(host) host.appendChild(bagBtn);
bagBtn.addEventListener("click",openBag);

const scrim=document.createElement("div"); scrim.className="co-scrim";
const bagEl=document.createElement("aside"); bagEl.className="co-bag"; bagEl.setAttribute("aria-label","Your bag");
bagEl.innerHTML=`<header><h2>Your bag<small class="co-n"></small></h2><button type="button" class="co-x" aria-label="Close bag">${I.x}</button></header>
  <div class="co-lines" data-lenis-prevent></div>
  <footer><div class="co-row"><span>Subtotal</span><strong class="co-sub-t"></strong></div>
    <div class="co-row"><span>Delivery</span><span>Complimentary</span></div>
    <button type="button" class="co-cta co-go">Checkout ${I.arrow}</button></footer>`;
const co=document.createElement("div"); co.className="co"; co.setAttribute("role","dialog"); co.setAttribute("aria-modal","true");
co.setAttribute("aria-label","Checkout");
co.innerHTML=`<div class="co-panel">
  <div class="co-top">
    <div class="co-brand"><img src="${esc(CFG.logo)}" alt="${esc(CFG.house)}"><em>Secure checkout</em></div>
    <div style="display:flex;align-items:center">
      <ol class="co-steps">
        <li data-s="bag" class="done"><i>${I.tick}</i><span>Bag</span></li>
        <li data-s="delivery"><i>2</i><span>Delivery</span></li>
        <li data-s="payment"><i>3</i><span>Payment</span></li>
      </ol>
      <button type="button" class="co-x co-close" aria-label="Close checkout">${I.x}</button>
    </div>
  </div>
  <div class="co-body" data-lenis-prevent>
    <section class="co-view" data-v="delivery" hidden>
      <div>
        <h2 class="co-h">Your order</h2><p class="co-sub">Poured to order and sealed by hand.</p>
        <div class="co-summary"><div class="co-sumlines"></div>
          <div class="co-row"><span>Subtotal</span><strong class="co-sum-sub"></strong></div>
          <div class="co-row"><span>Delivery</span><strong class="co-sum-ship"></strong></div>
          <div class="co-row total"><span>Total</span><strong class="co-sum-tot"></strong></div>
        </div>
      </div>
      <form class="co-form" novalidate data-f="delivery">
        <div class="co-f"><h2 class="co-h">Delivery</h2><p class="co-sub" style="margin-bottom:.2rem">Where should we send it?</p></div>
        <div class="co-f"><label for="co-email">Email</label><div class="co-in">${I.mail}<input id="co-email" type="email" inputmode="email" placeholder="you@example.com" autocomplete="email"></div><span class="co-err"></span></div>
        <div class="co-f"><label for="co-name">Full name</label><div class="co-in">${I.user}<input id="co-name" type="text" placeholder="First and last name" autocomplete="name"></div><span class="co-err"></span></div>
        <div class="co-f"><label for="co-addr">Address</label><div class="co-in">${I.pin}<input id="co-addr" type="text" placeholder="Street and number" autocomplete="street-address"></div><span class="co-err"></span></div>
        <div class="co-f half"><label for="co-city">City</label><div class="co-in"><input id="co-city" type="text" placeholder="City" autocomplete="address-level2"></div><span class="co-err"></span></div>
        <div class="co-f half"><label for="co-zip">Postcode</label><div class="co-in"><input id="co-zip" type="text" placeholder="Postcode" autocomplete="postal-code"></div><span class="co-err"></span></div>
        <div class="co-f"><label for="co-country">Country</label><div class="co-in"><select id="co-country" autocomplete="country">
          <option value="US">United States</option><option value="GB">United Kingdom</option><option value="CA">Canada</option>
          <option value="AU">Australia</option><option value="FR">France</option><option value="DE">Germany</option>
          <option value="ES">Spain</option><option value="IT">Italy</option><option value="AE">United Arab Emirates</option>
          <option value="JP">Japan</option></select></div></div>
        <div class="co-ship">${CFG.shipping.map((s,i)=>`<label class="co-opt"><input type="radio" name="co-ship" value="${s.id}"${i?"":" checked"}>
          <span>${esc(s.label)}<small>${esc(s.note)}</small></span><b>${s.price?money(s.price):"Free"}</b></label>`).join("")}</div>
        <div class="co-actions"><button type="submit" class="co-cta">Continue to payment ${I.arrow}</button>
          <p class="co-demo" style="margin:.9rem auto 0">Demo store: <button type="button" class="co-fill-d">fill in sample details</button></p></div>
      </form>
    </section>
    <section class="co-view" data-v="payment" hidden>
      <div class="co-cardside">
        <div class="co-stage">
          <div class="co-halo"><i></i><s></s></div><div class="co-glow"></div><div class="co-ring"><i></i><s></s></div>
          <div class="co-tilt"><div class="co-card">
            <div class="co-face co-front"><div class="okfill"></div>
              <div class="r1"><span class="co-chip"></span><span class="nfc">${I.nfc}</span><span class="tier">${esc(CFG.house.toUpperCase())}</span></div>
              <div class="co-num" aria-hidden="true"></div>
              <div class="r3"><div><small>Card holder</small><div class="c-name">Your name</div></div>
                <div><small>Expires</small><div class="c-exp">MM/YY</div></div><span class="net"></span></div>
            </div>
            <div class="co-face co-rear"><div class="okfill"></div><div class="stripe"></div>
              <div class="sig"><i></i><b class="c-cvc">•••</b></div>
              <p>This card is used only to demonstrate the checkout. No payment is taken and nothing leaves this page.</p>
            </div>
          </div></div>
        </div>
        <button type="button" class="co-flipbtn">${I.flip}<span>Flip to CVC</span></button>
        <div class="co-safe"><span>${I.shield}256-bit encryption</span><span>${I.lock}PCI DSS compliant processor</span></div>
      </div>
      <form class="co-form" novalidate data-f="payment">
        <div class="co-f"><h2 class="co-h">Payment</h2><p class="co-sub" style="margin-bottom:.2rem">All transactions are secure and encrypted.</p></div>
        <div class="co-f"><label for="co-cname">Name on card</label><div class="co-in">${I.user}<input id="co-cname" type="text" placeholder="As printed on the card" autocomplete="off" spellcheck="false"></div><span class="co-err"></span></div>
        <div class="co-f"><label for="co-cnum">Card number</label><div class="co-in">${I.card}<input id="co-cnum" class="mono" type="text" inputmode="numeric" placeholder="1234 5678 9012 3456" autocomplete="off" maxlength="23"><span class="brandtag"></span></div><span class="co-err"></span></div>
        <div class="co-f half"><label for="co-cexp">Expiry</label><div class="co-in">${I.cal}<input id="co-cexp" class="mono" type="text" inputmode="numeric" placeholder="MM/YY" autocomplete="off" maxlength="5"></div><span class="co-err"></span></div>
        <div class="co-f half"><label for="co-ccvc">CVC</label><div class="co-in">${I.lock}<input id="co-ccvc" class="mono" type="password" inputmode="numeric" placeholder="•••" autocomplete="off" maxlength="4"><button type="button" class="eye" aria-label="Show CVC">${I.eye}</button></div><span class="co-err"></span></div>
        <div class="co-total"><span>Total to pay</span><strong class="co-pay-tot"></strong></div>
        <div class="co-actions"><button type="submit" class="co-cta co-pay"></button>
          <button type="button" class="co-back">${I.back}Back to delivery</button>
          <p class="co-demo" style="margin:1rem auto 0">Demo checkout: no card is charged and nothing is sent.
            <button type="button" class="co-fill-p">Use the test card</button></p></div>
      </form>
    </section>
    <div class="co-finale" hidden><div class="co-slot"></div><div class="msg"></div></div>
  </div>
</div>`;
document.body.append(scrim,bagEl,co);

/* ── abrir y cerrar sin pelear con Lenis ─────────────────────────────────────────────────── */
let openCount=0;
function lock(on){
  openCount=Math.max(0,openCount+(on?1:-1));
  const L=window.lenis;
  if(openCount){ L&&L.stop&&L.stop(); document.documentElement.style.overflow="hidden"; }
  else{ L&&L.start&&L.start(); document.documentElement.style.overflow=""; }
}
let bagOpen=false, coOpen=false, busy=false;
function openBag(){ if(bagOpen)return; bagOpen=true; renderBag(); scrim.classList.add("on"); bagEl.classList.add("on"); lock(true);
  setTimeout(()=>$(".co-x",bagEl).focus({preventScroll:true}),60); }
function closeBag(keepScrim){ if(!bagOpen)return; bagOpen=false; bagEl.classList.remove("on"); if(!keepScrim&&!coOpen)scrim.classList.remove("on"); lock(false); }
scrim.addEventListener("click",()=>{ if(busy)return; if(coOpen)closeCo(); else closeBag(); });
$(".co-x",bagEl).addEventListener("click",()=>closeBag());
$(".co-go",bagEl).addEventListener("click",()=>{ if(!bag.length)return; closeBag(true); openCo(); });
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&!busy){ if(coOpen)closeCo(); else if(bagOpen)closeBag(); }
  if(e.key==="Tab"&&coOpen){ // el foco no se escapa del diálogo
    const f=$$("button,input,select,[href]",co).filter(x=>!x.disabled&&x.offsetParent);
    if(!f.length)return; const a=f[0], z=f[f.length-1];
    if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();}
    else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();}
  }
});

/* ── añadir ──────────────────────────────────────────────────────────────────────────────── */
function add(sku,btn){
  const p=PRODUCTS[sku]; if(!p)return;
  const l=bag.find(x=>x.sku===sku); l?l.qty++:bag.push({sku,qty:1}); save(); badge(true);
  if(btn&&btn.classList.contains("co-add")){ const s=$("span",btn); const t=s?s.textContent:"";
    btn.classList.add("done"); if(s)s.textContent="Added"; setTimeout(()=>{btn.classList.remove("done"); if(s)s.textContent=t;},1500); }
  setTimeout(openBag,RM?0:260);
}
function badge(bump){
  const n=count(); $("b",bagBtn).textContent=n; bagBtn.classList.toggle("has",n>0);
  if(bump){ bagBtn.classList.remove("bump"); void bagBtn.offsetWidth; bagBtn.classList.add("bump"); }
}
function lineHTML(l,editable){
  const p=PRODUCTS[l.sku];
  return `<div class="co-line" data-l="${esc(l.sku)}"><div class="th">${p.img?`<img src="${esc(p.img)}" alt="">`:""}</div>
    <div><h3>${esc(p.name)}</h3>${p.note?`<p>${esc(p.note)}</p>`:""}
    ${editable?`<div class="co-qty"><button type="button" data-q="-1" aria-label="One less">−</button><span>${l.qty}</span><button type="button" data-q="1" aria-label="One more">+</button></div>`:`<p>Qty ${l.qty}</p>`}</div>
    <div class="amt">${money(p.price*l.qty)}${editable?`<button type="button" class="rm">Remove</button>`:""}</div></div>`;
}
function renderBag(){
  const n=count();
  $(".co-n",bagEl).textContent=n?`${n} item${n>1?"s":""}`:"";
  $(".co-lines",bagEl).innerHTML=bag.length?bag.map(l=>lineHTML(l,true)).join(""):`<p class="co-empty">Your bag is empty.</p>`;
  $(".co-sub-t",bagEl).textContent=money(subtotal());
  $(".co-go",bagEl).disabled=!bag.length;
}
$(".co-lines",bagEl).addEventListener("click",e=>{
  const row=e.target.closest(".co-line"); if(!row)return; const l=bag.find(x=>x.sku===row.dataset.l); if(!l)return;
  if(e.target.closest(".rm")) bag=bag.filter(x=>x!==l);
  else{ const q=e.target.closest("[data-q]"); if(!q)return; l.qty+= +q.dataset.q; if(l.qty<1)bag=bag.filter(x=>x!==l); }
  save(); badge(false); renderBag();
});

/* ── el pago: pasos ──────────────────────────────────────────────────────────────────────── */
const body=$(".co-body",co), finale=$(".co-finale",co), msg=$(".msg",finale);
function step(name){
  $$(".co-view",co).forEach(v=>{ const on=v.dataset.v===name; v.hidden=!on; if(on){v.classList.remove("enter"); void v.offsetWidth; v.classList.add("enter");} });
  const order=["bag","delivery","payment"], k=order.indexOf(name);
  $$(".co-steps li",co).forEach((li,i)=>{ li.classList.toggle("done",i<k); li.classList.toggle("now",i===k);
    const ic=$("i",li); ic.innerHTML=i<k?I.tick:String(i+1); });
  body.scrollTop=0;
  const first=$(`.co-view[data-v="${name}"] input`,co); if(first&&!matchMedia("(pointer:coarse)").matches) setTimeout(()=>first.focus({preventScroll:true}),350);
}
function totals(){
  const sub=subtotal(), sh=shipCost();
  $(".co-sumlines",co).innerHTML=bag.map(l=>lineHTML(l,false)).join("");
  $(".co-sum-sub",co).textContent=money(sub);
  $(".co-sum-ship",co).textContent=sh?money(sh):"Free";
  $(".co-sum-tot",co).textContent=money(sub+sh);
  $(".co-pay-tot",co).textContent=money(sub+sh);
  $(".co-pay",co).innerHTML=`Pay ${money(sub+sh)} now ${I.arrow}`;
}
function openCo(){
  if(coOpen)return; coOpen=true; reset(); totals(); step("delivery");
  scrim.classList.add("on"); co.classList.add("on"); lock(true);
}
function closeCo(){
  if(!coOpen||busy)return; coOpen=false; co.classList.remove("on"); scrim.classList.remove("on"); lock(false);
}
$(".co-close",co).addEventListener("click",closeCo);
$$('input[name="co-ship"]',co).forEach(r=>r.addEventListener("change",()=>{shipId=r.value; totals();}));

/* validación: se dice en el campo, no en un alert */
function mark(input,text){ const f=input.closest(".co-f"); const box=input.closest(".co-in"); const er=f&&$(".co-err",f);
  box&&box.classList.toggle("bad",!!text); if(er)er.textContent=text||""; return !text; }
$$(".co-in input",co).forEach(i=>i.addEventListener("input",()=>mark(i,"")));

$('[data-f="delivery"]',co).addEventListener("submit",e=>{
  e.preventDefault();
  const ok=[
    mark($("#co-email",co),/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test($("#co-email",co).value.trim())?"":"Enter a valid email"),
    mark($("#co-name",co),$("#co-name",co).value.trim().length>1?"":"Enter your name"),
    mark($("#co-addr",co),$("#co-addr",co).value.trim().length>3?"":"Enter your address"),
    mark($("#co-city",co),$("#co-city",co).value.trim()?"":"Required"),
    mark($("#co-zip",co),$("#co-zip",co).value.trim()?"":"Required")
  ].every(Boolean);
  if(!ok)return;
  const cn=$("#co-cname",co); if(!cn.value){ cn.value=$("#co-name",co).value.trim(); cn.dispatchEvent(new Event("input")); }
  step("payment");
});
$(".co-back",co).addEventListener("click",()=>step("delivery"));

/* ── la tarjeta ──────────────────────────────────────────────────────────────────────────── */
const stage=$(".co-stage",co), tilt=$(".co-tilt",co), card=$(".co-card",co);
const numEl=$(".co-num",co), netEl=$(".net",co), tagEl=$(".brandtag",co);
const cnum=$("#co-cnum",co), cexp=$("#co-cexp",co), ccvc=$("#co-ccvc",co), cname=$("#co-cname",co);
function brandOf(d){
  if(/^3[47]/.test(d))return"AMEX"; if(/^4/.test(d))return"VISA";
  if(/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(d))return"MASTERCARD"; if(/^(6011|65|64[4-9])/.test(d))return"DISCOVER"; return"";
}
const groupsOf=b=>b==="AMEX"?[4,6,5]:[4,4,4,4];
let shownDigits="";
function paintNumber(d){
  const b=brandOf(d), g=groupsOf(b); let i=0, html=[];
  g.forEach(n=>{ let chunk=""; for(let k=0;k<n;k++,i++){ const ch=d[i];
      const isNew=ch&&shownDigits[i]!==ch;
      chunk+=`<span${isNew&&!RM?' class="pop"':""}>${ch||"•"}</span>`; }
    html.push(chunk); });
  numEl.innerHTML=html.join('<span>&nbsp;</span>');
  shownDigits=d;
  netEl.textContent=b==="MASTERCARD"?"mastercard":b.toLowerCase()==="visa"?"VISA":b; tagEl.textContent=b;
}
cnum.addEventListener("input",()=>{
  const d=cnum.value.replace(/\D/g,"").slice(0,brandOf(cnum.value.replace(/\D/g,""))==="AMEX"?15:16);
  const g=groupsOf(brandOf(d)); let out=[],i=0; g.forEach(n=>{ if(i<d.length)out.push(d.slice(i,i+n)); i+=n; });
  cnum.value=out.join(" "); paintNumber(d);
});
cexp.addEventListener("input",()=>{
  let d=cexp.value.replace(/\D/g,"").slice(0,4); if(d.length===1&&+d>1)d="0"+d;
  cexp.value=d.length>2?d.slice(0,2)+"/"+d.slice(2):d; $(".c-exp",co).textContent=cexp.value||"MM/YY";
});
cname.addEventListener("input",()=>{ $(".c-name",co).textContent=cname.value.trim()||"Your name"; });
ccvc.addEventListener("input",()=>{ ccvc.value=ccvc.value.replace(/\D/g,"").slice(0,4); $(".c-cvc",co).textContent=ccvc.value?"•".repeat(ccvc.value.length):"•••"; });
$(".eye",co).addEventListener("click",()=>{ ccvc.type=ccvc.type==="password"?"text":"password"; });

/* giro: el CVC gira la tarjeta sola; el botón la deja girada hasta que se vuelva a pulsar */
let flipped=false, pinned=false;
function setFlip(v){ flipped=v; card.classList.toggle("flip",v); $(".co-flipbtn span",co).textContent=v?"Show front":"Flip to CVC"; }
ccvc.addEventListener("focus",()=>setFlip(true));
ccvc.addEventListener("blur",()=>{ if(!pinned)setFlip(false); });
$(".co-flipbtn",co).addEventListener("click",()=>{ pinned=!flipped; setFlip(!flipped); });

/* inclinación con el ratón: solo en punteros finos, un transform por frame (Ley 1 y 4) */
if(matchMedia("(hover:hover) and (pointer:fine)").matches&&!RM){
  let raf=0, tx=0, ty=0;
  stage.addEventListener("pointermove",e=>{
    const r=stage.getBoundingClientRect(); tx=((e.clientX-r.left)/r.width-.5)*2; ty=((e.clientY-r.top)/r.height-.5)*2;
    if(!raf)raf=requestAnimationFrame(()=>{ raf=0; tilt.style.transform=`rotateY(${tx*9}deg) rotateX(${-ty*7}deg)`; });
  },{passive:true});
  stage.addEventListener("pointerleave",()=>{ tilt.style.transform=""; });
}

/* ── pagar ───────────────────────────────────────────────────────────────────────────────── */
function luhn(d){ let s=0,alt=false; for(let i=d.length-1;i>=0;i--){ let n=+d[i]; if(alt){n*=2;if(n>9)n-=9;} s+=n; alt=!alt; } return d.length>=13&&s%10===0; }
function validCard(){
  const d=cnum.value.replace(/\D/g,""), b=brandOf(d);
  const [mm,yy]=cexp.value.split("/").map(Number); const now=new Date(), y=now.getFullYear()%100, m=now.getMonth()+1;
  return [
    mark(cname,cname.value.trim().length>1?"":"Enter the name on the card"),
    mark(cnum,luhn(d)?"":"Check the card number"),
    mark(cexp,(mm>=1&&mm<=12&&yy>=0&&(yy>y||(yy===y&&mm>=m)))?"":"Check the expiry"),
    mark(ccvc,ccvc.value.length===(b==="AMEX"?4:3)?"":"Check the CVC")
  ].every(Boolean);
}
$('[data-f="payment"]',co).addEventListener("submit",async e=>{
  e.preventDefault(); if(busy||!validCard())return;
  busy=true; pinned=false; setFlip(false); tilt.style.transform="";
  const total=subtotal()+shipCost(), orderNo="ASC-"+String(Math.floor(1000+Math.random()*9000));
  if(document.activeElement)document.activeElement.blur();
  body.scrollTop=0; body.classList.add("leaving");
  await wait(RM?0:380);
  // FLIP: se mide dónde está, se lleva al centro, y se anima SOLO el transform desde el sitio viejo
  const r0=stage.getBoundingClientRect();
  body.style.minHeight=body.offsetHeight+"px";
  finale.hidden=false; $(".co-slot",finale).appendChild(stage);
  $$(".co-view",co).forEach(v=>v.hidden=true);
  const r1=stage.getBoundingClientRect();
  const sx=r0.width/r1.width, dx=r0.left-r1.left, dy=r0.top-r1.top;
  stage.style.transformOrigin="0 0"; stage.style.willChange="transform";
  stage.style.transform=`translate(${dx}px,${dy}px) scale(${sx})`;
  void stage.offsetWidth;
  stage.style.transition=RM?"none":"transform .95s cubic-bezier(.16,1,.3,1)";
  stage.style.transform="";
  await wait(RM?0:700);
  stage.style.willChange=""; stage.classList.add("busy");
  msg.innerHTML=`<div class="co-spin"></div><h3>Processing secure transaction…</h3><p>Please keep this window open.</p>`;
  msg.classList.add("on");
  await wait(RM?600:2300);
  stage.classList.add("ok");
  $$(".co-steps li",co).forEach(li=>{ li.classList.add("done"); li.classList.remove("now"); $("i",li).innerHTML=I.tick; });
  msg.classList.remove("on"); await wait(RM?0:260);
  msg.innerHTML=`<svg class="co-check" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22"/><path d="M15 24.5l6 6L33 18"/></svg>
    <h3>Payment successful</h3>
    <p>Order <strong>${orderNo}</strong> for <strong>${money(total)}</strong> is confirmed.<br>A receipt is on its way to ${esc($("#co-email",co).value.trim()||"your inbox")}.</p>
    <button type="button" class="co-cta co-done">Continue exploring ${I.arrow}</button>`;
  msg.classList.add("on");
  bag=[]; save(); badge(false);
  $(".co-done",msg).addEventListener("click",()=>{ busy=false; closeCo(); });
  setTimeout(()=>{ const d=$(".co-done",msg); d&&d.focus({preventScroll:true}); },900);
  busy=false; stage.classList.remove("busy");
});

/* vuelve todo a su sitio para el próximo pedido */
function reset(){
  body.classList.remove("leaving"); body.style.minHeight=""; msg.classList.remove("on"); msg.innerHTML=""; finale.hidden=true;
  stage.classList.remove("busy","ok"); stage.style.transform=""; stage.style.transition=""; stage.style.transformOrigin="";
  $(".co-cardside",co).prepend(stage);
  [cnum,cexp,ccvc].forEach(i=>{ i.value=""; mark(i,""); }); ccvc.type="password";
  paintNumber(""); $(".c-exp",co).textContent="MM/YY"; $(".c-cvc",co).textContent="•••"; setFlip(false); pinned=false;
}

/* ── rellenar con datos de ejemplo (tecleado, para que se vea la tarjeta escribirse) ─────── */
async function type(input,text,ms){
  input.focus({preventScroll:true}); input.value="";
  for(const ch of text){ input.value+=ch; input.dispatchEvent(new Event("input")); await wait(RM?0:ms); }
}
async function fillDelivery(fast){
  const S=CFG.sample, t=fast?0:26;
  await type($("#co-email",co),S.email,t); await type($("#co-name",co),S.name,t); await type($("#co-addr",co),S.address,t);
  await type($("#co-city",co),S.city,t); await type($("#co-zip",co),S.zip,t); $("#co-country",co).value=S.country;
}
async function fillPayment(){
  const S=CFG.sample;
  if(!cname.value){ cname.value=$("#co-name",co).value||S.name; cname.dispatchEvent(new Event("input")); }
  await type(cnum,S.card,55); await type(cexp,S.exp,90); await type(ccvc,S.cvc,140);
  await wait(RM?0:500); ccvc.blur();
}
$(".co-fill-d",co).addEventListener("click",()=>fillDelivery(false));
$(".co-fill-p",co).addEventListener("click",fillPayment);

/* ── el recorrido entero solo: para grabar el anuncio sin tocar nada ─────────────────────── */
async function demo(sku){
  sku=sku||Object.keys(PRODUCTS)[0]; if(!sku)return;
  const btn=$(`[data-sku="${sku}"] .co-add`);
  if(btn)btn.scrollIntoView({block:"center"});
  await wait(600); add(sku,btn); await wait(1500);
  closeBag(true); openCo(); await wait(900);
  await fillDelivery(false); await wait(500);
  $('[data-f="delivery"] .co-cta',co).click(); await wait(900);
  await fillPayment(); await wait(700);
  $(".co-pay",co).click();
}
window.ascentaCheckout={add,openBag,openCheckout:()=>{ if(bag.length)openCo(); },demo};

badge(false); paintNumber("");
if(location.hash==="#checkout-demo") window.addEventListener("load",()=>setTimeout(()=>demo(),1800));
})();
