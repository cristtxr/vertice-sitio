(function(){
'use strict';

var clamp = function(v, lo, hi){ return Math.min(hi, Math.max(lo, v)); };
var smoothstep = function(p, e0, e1){ var t = clamp((p - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

/* generador pseudoaleatorio sembrado: los saltos son idénticos en cada carga */
function rng(seed){ var s = seed >>> 0; return function(){ s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

var hero   = document.querySelector('.hero');
var stage  = document.getElementById('stage');
var heroImage = document.getElementById('heroImage');
var heroCue = document.getElementById('heroCue');
var bandsEl = document.getElementById('bands');
var bandEls = [].slice.call(document.querySelectorAll('.band'));

/* ---------------------------------------------------------------
   1 · partir los titulares en palabras y caracteres
   --------------------------------------------------------------- */
function split(el, modo, spread){
  var texto = el.textContent;
  var rand = rng(20260915);
  var lector = document.createElement('span');
  lector.className = 'vh';
  lector.textContent = texto;

  var visual = document.createElement('span');
  visual.setAttribute('aria-hidden', 'true');

  var palabras = texto.split(' ');
  var totalChars = texto.replace(/ /g, '').length;
  var ci = 0;

  palabras.forEach(function(pal, wi){
    var w = document.createElement('span');
    w.className = 'w';
    if (modo === 'word'){
      w.style.setProperty('--th', (wi / Math.max(1, palabras.length) * 0.5).toFixed(3));
      w.textContent = pal;
    } else {
      for (var i = 0; i < pal.length; i++){
        var c = document.createElement('span');
        c.className = 'c';
        c.textContent = pal[i];
        var base = spread ? (ci / Math.max(1, totalChars)) * spread : 0;
        c.style.setProperty('--th', (base + rand() * 0.16).toFixed(3));
        c.style.setProperty('--jx', ((rand() - 0.5) * 90).toFixed(1) + 'px');
        c.style.setProperty('--jy', ((rand() - 0.5) * 70).toFixed(1) + 'px');
        c.style.setProperty('--jr', ((rand() - 0.5) * 28).toFixed(1) + 'deg');
        w.appendChild(c);
        ci++;
      }
    }
    visual.appendChild(w);
    if (wi < palabras.length - 1) visual.appendChild(document.createTextNode(' '));
  });

  el.textContent = '';
  el.appendChild(lector);
  el.appendChild(visual);
}
document.querySelectorAll('[data-split]').forEach(function(el){
  var banda = el.closest('.band');
  var spread = banda && banda.dataset.spread ? parseFloat(banda.dataset.spread) : 0;
  split(el, el.dataset.split, spread);
});

/* ---------------------------------------------------------------
   2 · las bandas, leídas del marcado
   --------------------------------------------------------------- */
var bands = bandEls.map(function(el){
  var a = parseFloat(el.dataset.a), b = parseFloat(el.dataset.b);
  return {
    el: el, a: a, b: b,
    ramp: el.dataset.ramp ? parseFloat(el.dataset.ramp) : Math.min(0.025, (b - a) * 0.35),
    primera: a === 0, ultima: b === 1,
    op: -1, k: -1
  };
});

var loadK = 1;
function updateCaptions(p){
  for (var i = 0; i < bands.length; i++){
    var B = bands[i];
    var f = Math.min(0.085, (B.b - B.a) * .28);
    var entra = B.primera ? 1 : smoothstep(p, B.a, B.a + f);
    var sale  = B.ultima  ? 0 : smoothstep(p, B.b - f, B.b);
    var op = entra * (1 - sale);
    var k = clamp((p - B.a) / B.ramp, 0, 1);
    if (B.primera) k = Math.max(k, loadK);

    if (Math.abs(op - B.op) > 0.004){ B.el.style.opacity = op.toFixed(3); B.op = op; }
    if (Math.abs(k - B.k) > 0.008){ B.el.style.setProperty('--k', k.toFixed(3)); B.k = k; }
  }
}

/* ---------------------------------------------------------------
   3 · progreso, compuerta de seeks y bucle que descansa
   --------------------------------------------------------------- */
function heroProgress(){
  if (!hero) return 0;
  var range = hero.offsetHeight - window.innerHeight;
  if (range <= 0) return 0;
  return clamp(-hero.getBoundingClientRect().top / range, 0, 1);
}
/* una vez el pin se suelta al final del hero, el texto ya debe haberse
   apagado: si no, se ve cortado por el borde de la ventana al deslizar */
function heroReleaseFrac(){
  if (!hero) return 0;
  var range = hero.offsetHeight - window.innerHeight;
  if (range <= 0) return 0;
  var raw = -hero.getBoundingClientRect().top;
  return clamp((raw - range) / window.innerHeight, 0, 1);
}

function paintHeroImage(p){
  if (heroCue) heroCue.style.opacity = clamp(1 - smoothstep(p,0,1) * 7,0,1).toFixed(3);
}

var target = 0, shown = 0, rafId = null, heroOnScreen = true;
function tick(){
  shown = target;
  rafId = null;
  paintHeroImage(shown);
  updateCaptions(shown);
  if (bandsEl){
    var relOp = (1 - heroReleaseFrac()).toFixed(3);
    if (bandsEl.style.opacity !== relOp) bandsEl.style.opacity = relOp;
  }
}
function onScroll(){
  target = heroProgress();
  if (rafId === null && heroOnScreen) rafId = requestAnimationFrame(tick);
}
if (hero && 'IntersectionObserver' in window){
  new IntersectionObserver(function(es){
    heroOnScreen = es[0].isIntersecting;
    if (heroOnScreen && rafId === null && scrubOn) rafId = requestAnimationFrame(tick);
  }, { rootMargin: '12% 0px' }).observe(hero);
}

/* ---------------------------------------------------------------
   4 · preparar la fotografía estática del hero
   --------------------------------------------------------------- */
var heroInit = false;
function initHeroOnce(){
  if (heroInit || !stage) return;
  heroInit = true;
  stage.classList.add('lit');
  function ready(){
    paintHeroImage(heroProgress());
    stage.classList.add('image-ready');
  }
  if (heroImage){
    if (heroImage.complete) ready();
    else heroImage.addEventListener('load',ready,{ once:true });
  }
  updateCaptions(heroProgress());
}

/* ---------------------------------------------------------------
   5 · compuertas del hero estático
   --------------------------------------------------------------- */
var GATES = [
  '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
  '(prefers-reduced-motion: reduce)'
];
var scrubOn = false;
function enableScrub(){
  if (scrubOn || !hero) return;
  scrubOn = true;
  initHeroOnce();
  bands.forEach(function(b){ b.op = -1; b.k = -1; });
  unpinFinalStates();
  updateCaptions(heroProgress());
  onScroll();
}
function disableScrub(){
  if (!scrubOn) return;
  scrubOn = false;
  if (rafId !== null){ cancelAnimationFrame(rafId); rafId = null; }
}
var MQLS = GATES.map(function(q){ return matchMedia(q); });
function applyHeroMode(){
  /* Reutiliza las MediaQueryList ya creadas en lugar de instanciarlas. */
  if (MQLS.some(function(m){ return m.matches; })) { disableScrub(); pintarEstatico(); }
  else enableScrub();
}
MQLS.forEach(function(m){ m.addEventListener('change', applyHeroMode); });

/* el hero estático usa la misma fotografía, sin movimiento */
function pintarEstatico(){
  var sh = document.getElementById('statichero');
  if (sh && getComputedStyle(sh).display !== 'none' && !sh.style.backgroundImage){
    sh.style.backgroundImage = matchMedia('(max-width:700px)').matches ? "url('assets/hero-torre-mobile.webp')" : "url('assets/hero-torre-1672.webp')";
    sh.style.backgroundPosition = '50% 50%';
  }
}

/* ---------------------------------------------------------------
   6 · la nav cambia de piel sobre el hero oscuro
   --------------------------------------------------------------- */
var nav = document.getElementById('nav');
var oscuros = [].slice.call(document.querySelectorAll('.hero, .static-hero, .holder, .equipo, .conversacion'));
function pintarNav(){
  if (!nav) return;
  var y = nav.getBoundingClientRect().bottom - 6;
  var sobreOscuro = oscuros.some(function(s){
    var r = s.getBoundingClientRect();
    /* display:none mide 0x0, asi que el rect ya responde lo mismo que
       getComputedStyle sin forzar un recalculo de estilo por frame. */
    return (r.width > 0 || r.height > 0) && r.top <= y && r.bottom >= y;
  });
  nav.classList.toggle('on-dark', sobreOscuro);
}

/* ---------------------------------------------------------------
   7 · entradas de sección
   --------------------------------------------------------------- */
if ('IntersectionObserver' in window){
  var io = new IntersectionObserver(function(es){
    es.forEach(function(e){
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      setTimeout(function(){ e.target.classList.add('settled'); }, 1400);
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.06 });
  document.querySelectorAll('.reveal').forEach(function(s){ io.observe(s); });

}

/* La presentación de Vértice se vuelve a escribir al regresar a la sección. */
var sobreStory = document.getElementById('sobre');
document.body.classList.add('motion-ready');

/* Los párrafos se ordenan palabra por palabra al entrar, sin ocultar la lectura. */
/* Los párrafos se ordenan palabra por palabra al entrar, sin ocultar la lectura. */
var REDUCE_MQL = matchMedia('(prefers-reduced-motion: reduce)');
var paragraphObserver = null;
if ('IntersectionObserver' in window && !REDUCE_MQL.matches){
  paragraphObserver = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if (!entry.isIntersecting) return;
      var p = entry.target;
      p.classList.add('scatterIn');
      paragraphObserver.unobserve(p);
      /* Al terminar la entrada se sueltan las capas de compositor: el texto
         queda quieto y el GPU deja de reservar memoria por cada palabra. */
      setTimeout(function(){ p.classList.remove('scatterArm'); }, 1400);
    });
  }, { rootMargin:'0px 0px -8% 0px', threshold:.12 });
}

/* Parte un párrafo en palabras. Idéntico al original: mismas posiciones,
   mismos retardos, mismo pseudoaleatorio derivado del índice. */
function splitScatterParagraph(p, paragraphIndex){
  var copy = p.textContent.trim();
  p.classList.add('scatterCopy','scatterArm');
  p.setAttribute('aria-label',copy);
  p.textContent = '';
  var frag = document.createDocumentFragment();
  copy.split(/(\s+)/).forEach(function(token, i){
    if (/^\s+$/.test(token)){ frag.appendChild(document.createTextNode(token)); return; }
    var word = document.createElement('span');
    var x = ((i * 19 + paragraphIndex * 7) % 17) - 8;
    var y = ((i * 13 + paragraphIndex * 5) % 15) - 5;
    var rot = (((i * 11 + paragraphIndex * 3) % 9) - 4) * .32;
    word.className = 'scatterWord';
    word.setAttribute('aria-hidden','true');
    word.style.setProperty('--scatter-x',x + 'px');
    word.style.setProperty('--scatter-y',y + 'px');
    word.style.setProperty('--scatter-r',rot.toFixed(2) + 'deg');
    word.style.setProperty('--scatter-delay',Math.min(i * 12,180) + 'ms');
    word.textContent = token;
    frag.appendChild(word);
  });
  /* Un solo appendChild: el navegador hace un layout, no uno por palabra. */
  p.appendChild(frag);
  if (paragraphObserver) paragraphObserver.observe(p);
  else p.classList.add('scatterIn');
}

/* Observador de preparación: parte el párrafo con margen de sobra antes de
   que asome, para que el trabajo nunca coincida con el scroll visible. */
var scatterPrepObserver = null;
if ('IntersectionObserver' in window && !REDUCE_MQL.matches){
  scatterPrepObserver = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if (!entry.isIntersecting) return;
      var p = entry.target;
      scatterPrepObserver.unobserve(p);
      splitScatterParagraph(p, parseInt(p.dataset.scatterIndex,10) || 0);
    });
  }, { rootMargin:'800px 0px 800px 0px' });
}

function prepareScatterCopy(root, immediate){
  [].slice.call(root.querySelectorAll('p')).forEach(function(p, paragraphIndex){
    if (p.classList.contains('scatterCopy') || p.closest('.hero,.static-hero') || p.children.length) return;
    var copy = p.textContent.trim();
    if (!copy || copy.length < 18) return;
    if (!immediate && scatterPrepObserver){
      p.dataset.scatterIndex = paragraphIndex;
      scatterPrepObserver.observe(p);
    } else {
      splitScatterParagraph(p, paragraphIndex);
    }
  });
}
prepareScatterCopy(document, false);

function sobreTick(){
  if (!sobreStory) return;
  /* La consulta de medios se reutiliza: antes se creaba un objeto nuevo en
     cada frame de scroll solo para leer el mismo booleano. */
  if (REDUCE_MQL.matches){ sobreStory.classList.add('story-on'); return; }
  var r = sobreStory.getBoundingClientRect();
  var active = r.top < innerHeight * .82 && r.bottom > innerHeight * .14;
  sobreStory.classList.toggle('story-on', active);
}
sobreTick();

/* ---------------------------------------------------------------
   8 · la luz entra por scroll, y con ella los datos
   --------------------------------------------------------------- */
var holder = document.getElementById('holder');
var revelaPin = document.getElementById('revelaPin');
var dfs = [].slice.call(document.querySelectorAll('.df'));
var horaVideo = document.getElementById('horaVideo');
var horaPendingTime = null;
var holdDone = false;

/* El video conserva exactamente el recorrido, pero no compite con el hero por
   ancho de banda ni por decodificación hasta que el lector se acerca a él. */
function cargarVideoHora(){
  if (!horaVideo || horaVideo.dataset.loaded === 'true') return;
  horaVideo.dataset.loaded = 'true';
  [].slice.call(horaVideo.querySelectorAll('source[data-src]')).forEach(function(source){
    source.src = source.dataset.src;
  });
  horaVideo.poster = horaVideo.dataset.poster;
  horaVideo.preload = 'metadata';
  horaVideo.load();
}
if ('IntersectionObserver' in window && revelaPin){
  new IntersectionObserver(function(entries, observer){
    if (!entries.some(function(entry){ return entry.isIntersecting; })) return;
    cargarVideoHora();
    observer.disconnect();
  }, { rootMargin:'140% 0px' }).observe(revelaPin);
} else {
  cargarVideoHora();
}

function requestHoraFrame(frac){
  if (!horaVideo || !horaVideo.duration || !isFinite(horaVideo.duration)) return;
  var t = clamp(frac,0,1) * Math.max(0,horaVideo.duration - .04);
  if (Math.abs(horaVideo.currentTime - t) < .035) return;
  if (horaVideo.seeking){ horaPendingTime = t; return; }
  try { horaVideo.currentTime = t; } catch(e) {}
}
if (horaVideo){
  horaVideo.addEventListener('loadedmetadata',function(){ revelaTick(); });
  horaVideo.addEventListener('seeked',function(){
    if (horaPendingTime === null) return;
    var t = horaPendingTime;
    horaPendingTime = null;
    try { horaVideo.currentTime = t; } catch(e) {}
  });
}

function revelaTick(){
  if (!revelaPin || !holder) return;
  var r = revelaPin.getBoundingClientRect();
  var total = r.height - innerHeight;
  var prog = total > 0 ? clamp(-r.top / total, 0, 1) : 0;
  holder.style.setProperty('--h', prog.toFixed(3));
  requestHoraFrame(prog);
  holder.classList.toggle('lit-on', prog >= 0.98);
  holdDone = prog >= 0.98;
  /* cada dato entra atado al scroll, no con una transición que dispara una
     sola vez: al subir vuelve a salir, y a media entrada se ve a medio camino */
  dfs.forEach(function(el){
    var at = parseFloat(el.dataset.at) || 0;
    var t = clamp((prog - at) / 0.1, 0, 1);
    el.style.opacity = t.toFixed(3);
    el.style.transform = 'translateX(' + ((1 - t) * -34).toFixed(1) + 'px)';
  });
}
revelaTick();

/* ---------------------------------------------------------------
   8b · por qué vértice · galería horizontal atada al scroll vertical
   --------------------------------------------------------------- */
var porquePin = document.getElementById('porquePin');
var pista = document.getElementById('pista');
var porqueCards = pista ? [].slice.call(pista.querySelectorAll('.razon')) : [];
function porqueTick(){
  if (!porquePin || !pista) return;
  var r = porquePin.getBoundingClientRect();
  /* Las anotaciones respiran dentro de la fotografía, sin abandonar
     su sitio ni competir con la lectura. */
  var center = innerHeight * .5;
  var progress = clamp((center - (r.top + r.height * .5)) / Math.max(r.height,.01), -.7, .7);
  porqueCards.forEach(function(card){
    var depth = parseFloat(card.dataset.depth) || 0;
    var v = (progress * depth * 72).toFixed(1) + 'px';
    /* Reescribir el mismo valor invalida igual el elemento, y estas tarjetas
       llevan backdrop-filter: obligaria a recalcular el desenfoque cada frame
       para dejarlo identico. Solo se escribe cuando cambia. */
    if (card.__floatY === v) return;
    card.__floatY = v;
    card.style.setProperty('--float-y', v);
  });
}
porqueTick();

/* ---------------------------------------------------------------
   8c · atlas orbital · el scroll conecta imagen, texto y evidencia
   --------------------------------------------------------------- */
var procesoPin = document.getElementById('procesoPin');
var pasoEls = [].slice.call(document.querySelectorAll('#pasosList .paso'));
var ringFill = document.getElementById('ringFill');
var orbitShots = [].slice.call(document.querySelectorAll('.orbitShot'));
var orbitNodes = [].slice.call(document.querySelectorAll('.orbitNode'));
var orbitIndex = document.getElementById('orbitIndex');
var procesoCounter = document.getElementById('procesoCounter');
var procesoActive = -1;
function setProcesoStep(idx){
  if (idx === procesoActive) return;
  procesoActive = idx;
  pasoEls.forEach(function(el,i){ el.classList.toggle('on',i === idx); el.setAttribute('aria-hidden',i === idx ? 'false' : 'true'); });
  orbitShots.forEach(function(el,i){ el.classList.toggle('on',i === idx); el.setAttribute('aria-hidden',i === idx ? 'false' : 'true'); });
  orbitNodes.forEach(function(el,i){ el.classList.toggle('on',i === idx); el.setAttribute('aria-current',i === idx ? 'step' : 'false'); });
  var label = '0' + (idx + 1);
  if (orbitIndex) orbitIndex.textContent = label;
  if (procesoCounter) procesoCounter.textContent = label + ' / 04';
}
function procesoTick(){
  if (!procesoPin || !pasoEls.length) return;
  var r = procesoPin.getBoundingClientRect();
  var total = r.height - innerHeight;
  var prog = total > 0 ? clamp(-r.top / total,0,1) : 0;
  var idx = Math.min(pasoEls.length - 1,Math.floor(prog * pasoEls.length));
  setProcesoStep(idx);
  if (ringFill){
    var off = (.75 - prog * .75).toFixed(3);
    if (ringFill.__off !== off){ ringFill.__off = off; ringFill.style.strokeDashoffset = off; }
  }
}
orbitNodes.forEach(function(node,i){
  node.addEventListener('click',function(){
    if (!procesoPin) return;
    var top = procesoPin.getBoundingClientRect().top + scrollY;
    var total = Math.max(0,procesoPin.offsetHeight - innerHeight);
    var target = top + total * ((i + .5) / pasoEls.length);
    scrollTo({ top:target,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
});
procesoTick();

/* ---------------------------------------------------------------
   8d · parallax suave · cifras, testimonios y garantías se mueven al scroll
   --------------------------------------------------------------- */
var REDUCE_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;
var paraEls = [].slice.call(document.querySelectorAll('[data-para]'));
function parallaxTick(){
  if (REDUCE_MOTION || !paraEls.length) return;
  var vc = innerHeight / 2;
  paraEls.forEach(function(el){
    var r = el.getBoundingClientRect();
    if (r.bottom < -200 || r.top > innerHeight + 200) return;
    var ec = r.top + r.height / 2;
    var speed = parseFloat(el.dataset.para) || 0;
    var t = 'translateY(' + ((vc - ec) * speed).toFixed(1) + 'px)';
    if (el.__t === t) return;
    el.__t = t;
    el.style.transform = t;
  });
}
parallaxTick();

/* Un único frame por desplazamiento. Antes había seis listeners que medían y
   escribían estilos por separado; ahora el navegador agrupa ese trabajo. */
var pageFrame = null;
var activeScrollAreas = new Map();
var scrollAreas = [
  [sobreStory, sobreTick],
  [revelaPin, revelaTick],
  [porquePin, porqueTick],
  [procesoPin, procesoTick]
].filter(function(item){ return !!item[0]; });
scrollAreas.forEach(function(item){ activeScrollAreas.set(item[0], true); });

if ('IntersectionObserver' in window){
  var scrollAreaObserver = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){ activeScrollAreas.set(entry.target, entry.isIntersecting); });
    schedulePageFrame();
  }, { rootMargin:'320px 0px' });
  scrollAreas.forEach(function(item){ scrollAreaObserver.observe(item[0]); });
}

function paintPageFrame(){
  pageFrame = null;
  if (scrubOn && heroOnScreen){
    target = heroProgress();
    if (rafId !== null){ cancelAnimationFrame(rafId); rafId = null; }
    tick();
  }
  pintarNav();
  scrollAreas.forEach(function(item){ if (activeScrollAreas.get(item[0])) item[1](); });
  parallaxTick();
}
function schedulePageFrame(){
  if (pageFrame !== null) return;
  pageFrame = requestAnimationFrame(paintPageFrame);
}
addEventListener('scroll', schedulePageFrame, { passive:true });
addEventListener('resize', schedulePageFrame, { passive:true });

/* ---------------------------------------------------------------
   8f · quienes ya viven ahí · las fotos de las casas van rotando solas
   --------------------------------------------------------------- */
(function pruebaCiclo(){
  var fotos = [].slice.call(document.querySelectorAll('.pf'));
  var label = document.getElementById('pfLabel');
  var panel = document.getElementById('pruebaFoto');
  if (!fotos.length || !panel || REDUCE_MOTION) return;
  var nombres = ['casa palmar','casa mirador','casa corte'];
  var i = 0, timer = null;
  function siguiente(){
    fotos[i].classList.remove('on');
    i = (i + 1) % fotos.length;
    fotos[i].classList.add('on');
    if (label) label.textContent = nombres[i];
  }
  function empezar(){ if (!timer) timer = setInterval(siguiente, 3200); }
  function parar(){ if (timer){ clearInterval(timer); timer = null; } }
  if ('IntersectionObserver' in window){
    new IntersectionObserver(function(es){
      es[0].isIntersecting ? empezar() : parar();
    }, { threshold: 0.2 }).observe(panel);
  } else { empezar(); }
  document.addEventListener('visibilitychange', function(){
    document.hidden ? parar() : empezar();
  });
})();

/* polvo en suspensión, solo sobre la sección con imagen */
(function buildDust(){
  var box = document.getElementById('dust');
  if (!box) return;
  var r = rng(20260915), n = 24, frag = document.createDocumentFragment();
  for (var i = 0; i < n; i++){
    var m = document.createElement('span');
    m.className = 'mote';
    m.style.left = (r() * 100).toFixed(2) + '%';
    m.style.top = (r() * 100).toFixed(2) + '%';
    m.style.opacity = (0.18 + r() * 0.42).toFixed(2);
    m.style.animationDuration = (16 + r() * 22).toFixed(1) + 's';
    m.style.animationDelay = '-' + (r() * 20).toFixed(1) + 's';
    frag.appendChild(m);
  }
  box.appendChild(frag);
})();

/* ---------------------------------------------------------------
   9 · el formulario, honesto: el éxito vive solo en JavaScript
   --------------------------------------------------------------- */
var form = document.getElementById('form');
if (form){
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var nombre = document.getElementById('nombre');
    var contacto = document.getElementById('contacto');
    if (!nombre.value.trim() || !contacto.value.trim()){
      (!nombre.value.trim() ? nombre : contacto).focus();
      return;
    }
    form.classList.add('sent');
    var ok = document.getElementById('exito');
    ok.classList.add('on');
    if (ok.focus) ok.focus();
  });
}

/* ---------------------------------------------------------------
   10 · movimiento reducido, en ambas direcciones
   --------------------------------------------------------------- */
function pinToFinalStates(){
  document.querySelectorAll('.reveal').forEach(function(el){ el.classList.add('in','settled'); });
  pasoEls.forEach(function(el){ el.classList.add('on'); el.setAttribute('aria-hidden','false'); });
  orbitShots.forEach(function(el,i){ el.classList.toggle('on',i === 0); el.setAttribute('aria-hidden',i === 0 ? 'false' : 'true'); });
  orbitNodes.forEach(function(el,i){ el.classList.toggle('on',i === 0); el.setAttribute('aria-current',i === 0 ? 'step' : 'false'); });
  if (ringFill) ringFill.style.strokeDashoffset = '0';
  if (holder){
    holdDone = true;
    holder.style.setProperty('--h','1');
    holder.classList.add('lit-on');
    dfs.forEach(function(el){ el.style.opacity = '1'; el.style.transform = 'none'; });
  }
}
function unpinFinalStates(){
  if (holder && !holdDone){
    holder.style.setProperty('--h','0');
    holder.classList.remove('lit-on');
  }
}
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', function(e){
  if (e.matches) pinToFinalStates();
  else applyHeroMode();
});

/* pausar todo lo que se mueve cuando la pestaña se esconde */
document.addEventListener('visibilitychange', function(){
  document.body.classList.toggle('paused', document.hidden);
});

/* ---------------------------------------------------------------
   11 · entrar en la casa · ficha a pantalla completa
   --------------------------------------------------------------- */

/* pasos de una escalera, dibujados */
function escalones(x, y, w, n, alto){
  var s = '', paso = alto / n;
  for (var i = 1; i < n; i++){
    var yy = (y + paso * i).toFixed(1);
    s += '<line class="muro" x1="' + x + '" y1="' + yy + '" x2="' + (x + w) + '" y2="' + yy + '"/>';
  }
  return s;
}

var VILLAS = {
  palmar: {
    nombre: 'casa palmar', lugar: 'Riviera Nayarit, Nayarit', num: 'N°034 · 2026',
    precio: 'USD 1,680,000', m2: '520 m²', rec: '4 recámaras', estado: 'Disponible', libre: true,
    foto: 'assets/casa-palmar-exterior',
    planoImagen: 'assets/plano-palmar',
    planoAlt: 'Vista axonométrica de la distribución de Casa Palmar.',
    detalle: 'Una residencia abierta al jardín, con dos niveles conectados por luz natural y una secuencia continua entre sala, terraza y paisaje.',
    relato: 'La casa no termina en el vidrio. La cubierta, la terraza y el jardín forman una sola estancia para vivir adentro y afuera con la misma comodidad.',
    luces: [[31,31,15,18],[51,33,13,19],[75,34,24,28],[39,59,13,17],[61,58,17,18],[81,59,22,18]],
    interiores: [
      { src:'assets/casa-palmar-sala', pie:'Sala de doble altura abierta al jardín' },
      { src:'assets/casa-palmar-terraza', pie:'Terraza cubierta y comedor exterior' },
      { src:'assets/casa-palmar-piscina', pie:'Estancia exterior frente a la piscina' }
    ],
    plano:
      '<rect class="relleno" x="38" y="54" width="324" height="174" rx="3"/>' +
      '<rect class="muro" x="38" y="54" width="324" height="174" rx="3"/>' +
      '<line class="muro" x1="186" y1="54" x2="186" y2="228"/>' +
      '<line class="muro" x1="186" y1="142" x2="362" y2="142"/>' +
      '<line class="vidrio" x1="50" y1="228" x2="350" y2="228"/>',
    puntos: [
      { x:110, y:140, t:'Estancia de doble altura', n:'La sala ocupa el corazón de la casa y recibe luz por dos orientaciones.' },
      { x:272, y:96, t:'Suite principal', n:'Terraza privada, baño con patio y vista completa al jardín.' },
      { x:272, y:184, t:'Cocina y comedor', n:'Una isla de piedra articula la cocina con el comedor interior y la terraza.' },
      { x:196, y:228, t:'Terraza continua', n:'El cerramiento desaparece para unir sala, comedor exterior y piscina.' }
    ]
  },
  mirador: {
    nombre: 'casa mirador', lugar: 'Tapalpa, Jalisco', num: 'N°041 · 2026',
    precio: 'USD 2,240,000', m2: '610 m²', rec: '5 recámaras', estado: 'Disponible', libre: true,
    foto: 'assets/casa-mirador-exterior',
    planoImagen: 'assets/plano-mirador-corte',
    planoAlt: 'Vista axonométrica de la distribución de Casa Mirador.',
    detalle: 'Una residencia de montaña organizada alrededor de la vista. Cada nivel se abre al valle y conserva privacidad entre las áreas sociales y las suites.',
    relato: 'El paisaje funciona como fachada principal. La alberca, la sala y el pabellón exterior comparten un mismo horizonte sin bloquearse entre sí.',
    luces: [[39,26,14,14],[55,26,12,14],[72,43,16,16],[49,44,14,14]],
    interiores: [
      { src:'assets/casa-mirador-sala', pie:'Sala principal frente al valle' },
      { src:'assets/casa-mirador-cocina', pie:'Cocina de madera, piedra y luz indirecta' },
      { src:'assets/casa-mirador-terraza', pie:'Terraza y alberca abiertas a la montaña' }
    ],
    plano:
      '<path class="relleno" d="M34 62 H248 V98 H364 V222 H162 V246 H34 Z"/>' +
      '<path class="muro" d="M34 62 H248 V98 H364 V222 H162 V246 H34 Z"/>' +
      '<line class="muro" x1="162" y1="62" x2="162" y2="246"/>' +
      '<line class="muro" x1="162" y1="154" x2="364" y2="154"/>' +
      '<rect class="vidrio" x="178" y="222" width="162" height="10" rx="3"/>',
    puntos: [
      { x:92, y:146, t:'Núcleo privado', n:'Tres suites se agrupan en el ala más silenciosa de la casa.' },
      { x:210, y:112, t:'Sala y comedor', n:'La planta social enmarca el valle sin columnas frente al ventanal.' },
      { x:282, y:188, t:'Pabellón exterior', n:'Cocina, comedor y estancia protegidos por una cubierta ligera.' },
      { x:248, y:226, t:'Alberca infinita', n:'El borde de agua coincide con la línea más baja del horizonte.' }
    ]
  },
  ladera: {
    nombre: 'casa ladera', lugar: 'Valle de Bravo, Estado de México', num: 'N°014 · 2024',
    precio: 'USD 1,850,000', m2: '420 m²', rec: '4 recámaras', estado: 'Disponible', libre: true,
    foto: 'assets/obra-ladera',
    /* [centro x, centro y, ancho, alto] en % de la imagen */
    luces: [[63,29,15,13],[58,49,17,19],[52,73,24,26]],
    interiores: [
      { src:'assets/hero-ending', pie:'La escalera a las 19:40' },
      { src:'assets/int-muro',    pie:'El muro poniente de concreto cimbrado' },
      { src:'assets/la-hora',     pie:'La estancia antes de que entre el sol' }
    ],
    plano:
      '<rect class="relleno" x="46" y="30" width="150" height="96" transform="rotate(-4 121 78)"/>' +
      '<rect class="muro" x="46" y="30" width="150" height="96" transform="rotate(-4 121 78)"/>' +
      '<rect class="relleno" x="112" y="92" width="166" height="104"/>' +
      '<rect class="muro" x="112" y="92" width="166" height="104"/>' +
      '<rect class="relleno" x="196" y="158" width="150" height="94" transform="rotate(4 271 205)"/>' +
      '<rect class="muro" x="196" y="158" width="150" height="94" transform="rotate(4 271 205)"/>' +
      '<line class="vidrio" x1="112" y1="94" x2="112" y2="194"/>',
    puntos: [
      { x:118, y:76,  t:'Terraza poniente', n:'El primer volumen, girado 4 grados respecto al siguiente para capturar su propia franja del valle.' },
      { x:112, y:144, t:'Muro de cristal, 14 metros', n:'A las 19:40 de junio la luz cruza la casa completa y aterriza en la escalera de concreto pulido.' },
      { x:195, y:144, t:'Sala de doble altura', n:'El volumen central organiza la circulación entre los tres niveles escalonados.' },
      { x:270, y:205, t:'Recámara principal', n:'El tercer volumen, el más bajo y el más privado, con vista directa al valle.' }
    ]
  },
  niebla: {
    nombre: 'casa niebla', lugar: 'Sierra Norte, Puebla', num: 'N°021 · 2025',
    precio: 'USD 1,250,000', m2: '310 m²', rec: '3 recámaras', estado: 'Disponible', libre: true,
    foto: 'assets/obra-niebla',
    luces: [[52,55,22,20],[52,73,17,11]],
    interiores: [],
    plano:
      '<rect class="relleno" x="30" y="95" width="340" height="96"/>' +
      '<rect class="muro" x="30" y="95" width="340" height="96"/>' +
      '<rect class="muro" x="70" y="118" width="48" height="50"/>' +
      '<rect class="muro" x="146" y="118" width="48" height="50"/>' +
      '<rect class="muro" x="222" y="118" width="48" height="50"/>' +
      '<rect class="muro" x="298" y="118" width="48" height="50"/>' +
      '<line class="vidrio" x1="30" y1="191" x2="370" y2="191"/>',
    puntos: [
      { x:94,  y:143, t:'Patio de luz', n:'Cuatro patios internos operan como pulmones. Ninguna habitación depende de una sola orientación.' },
      { x:170, y:143, t:'Estancia', n:'La casa se levanta 1.2 metros del suelo para no interrumpir el escurrimiento natural del bosque.' },
      { x:246, y:143, t:'Recámaras', n:'Madera termotratada en negro mate sobre estructura de acero.' },
      { x:322, y:143, t:'Patio de niebla', n:'La niebla entra aquí 40 días al año. Es el único ornamento del proyecto.' }
    ]
  },
  corte: {
    nombre: 'casa corte', lugar: 'Costa Careyes, Jalisco', num: 'N°008 · 2023',
    precio: 'USD 980,000', m2: '265 m²', rec: '3 recámaras', estado: 'Reservado', libre: false,
    foto: 'assets/obra-corte',
    planoImagen: 'assets/plano-mirador-corte',
    planoAlt: 'Vista axonométrica de la distribución de Casa Corte.',
    luces: [[78,44,22,30],[66,50,12,18]],
    detalle: 'Concreto aparente, madera y bosque. Casa Corte trabaja con vacíos precisos para que la luz revele la estructura a lo largo del día.',
    relato: 'La escalera, la cocina y la recámara nacen de una misma lógica material. Pocas piezas, bien resueltas, dejan que el bosque sea el acabado principal.',
    interiores: [
      { src:'assets/casa-corte-interior', pie:'Escalera de concreto y estancia frente al bosque', compact:true },
      { src:'assets/casa-corte-cocina', pie:'Cocina integrada bajo la escalera', compact:true },
      { src:'assets/casa-corte-recamara', pie:'Recámara abierta a la vegetación', compact:true }
    ],
    plano:
      '<rect class="relleno" x="40" y="66" width="180" height="140"/>' +
      '<rect class="muro" x="40" y="66" width="180" height="140"/>' +
      '<path class="muro" d="M220 92 h132 v88 h-132"/>' +
      '<rect class="relleno" x="220" y="92" width="132" height="88"/>' +
      '<rect class="vidrio" x="46" y="214" width="180" height="14" rx="3"/>',
    puntos: [
      { x:286, y:136, t:'Voladizo de 9 metros', n:'Sostenido por dos muros de carga postensados. El cálculo estructural precedió al dibujo.' },
      { x:136, y:221, t:'Alberca', n:'El agua termina exactamente al nivel de la línea del horizonte visto desde el comedor.' },
      { x:100, y:110, t:'Comedor', n:'Orientado al poniente, con el horizonte del Pacífico como único fondo.' },
      { x:170, y:170, t:'Recámaras', n:'La sal obliga: todo el acero es inoxidable 316 y el concreto lleva aditivo impermeabilizante integral.' }
    ]
  },
  patio: {
    nombre: 'casa patio', lugar: 'San Miguel de Allende, Guanajuato', num: 'N°031 · 2025',
    precio: 'USD 620,000', m2: '180 m²', rec: '2 recámaras', estado: 'Disponible', libre: true,
    foto: 'assets/obra-patio',
    luces: [[16,56,10,34],[29,56,9,30],[71,55,10,32],[86,54,11,36]],
    interiores: [
      { src:'assets/patio-estancia', pie:'La estancia, abierta al patio' },
      { src:'assets/patio-recamara', pie:'Recámara, con el vano de 45 centímetros' },
      { src:'assets/patio-cocina',   pie:'La cocina, en encino macizo' },
      { src:'assets/obra-patio',     pie:'El patio y la jacaranda en marzo' }
    ],
    plano:
      '<rect class="relleno" x="90" y="30" width="220" height="220"/>' +
      '<rect class="muro" x="90" y="30" width="220" height="220"/>' +
      '<rect class="muro" x="163" y="103" width="74" height="74"/>' +
      '<circle class="vidrio" cx="200" cy="140" r="17"/>',
    puntos: [
      { x:200, y:140, t:'El patio y la jacaranda', n:'Un patio de 6 por 6 al centro organiza la totalidad de la circulación. Florece la segunda semana de marzo.' },
      { x:126, y:66,  t:'Recámara 1', n:'Muros de adobe estabilizado de 45 centímetros de espesor.' },
      { x:274, y:66,  t:'Recámara 2', n:'La casa se mantiene a 21 grados sin climatización mecánica.' },
      { x:200, y:216, t:'Cocina y estancia', n:'Planta cuadrada de 18 por 18 metros. Nada más.' }
    ]
  },
  piedra: {
    nombre: 'casa piedra', lugar: 'Tepoztlán, Morelos', num: 'N°019 · 2024',
    precio: 'USD 1,490,000', m2: '350 m²', rec: '4 recámaras', estado: 'Vendido', libre: false,
    foto: 'assets/obra-piedra',
    luces: [[43,69,11,18],[70,68,8,13],[23,63,7,10]],
    interiores: [],
    plano:
      '<rect class="relleno" x="50" y="74" width="300" height="140"/>' +
      '<rect class="muro" x="50" y="74" width="300" height="140"/>' +
      '<rect class="muro" x="68" y="92" width="264" height="104"/>' +
      '<line class="vidrio" x1="50" y1="62" x2="350" y2="46"/>',
    puntos: [
      { x:110, y:144, t:'Estancia', n:'La piedra volcánica se extrajo de una cantera a 900 metros del terreno.' },
      { x:200, y:144, t:'Cocina', n:'Once meses de obra. Cuatro maestros canteros.' },
      { x:290, y:144, t:'Recámaras', n:'Muros de gran espesor que estabilizan la temperatura sin equipo mecánico.' },
      { x:200, y:54,  t:'Losa de recolección', n:'Inclinada al 2 por ciento. Recoge 180,000 litros por temporada de lluvias.' }
    ]
  },
  umbral: {
    nombre: 'casa umbral', lugar: 'Sierra Norte, Puebla', num: 'N°026 · 2025',
    precio: 'USD 480,000', m2: '145 m²', rec: '2 recámaras', estado: 'Disponible', libre: true,
    foto: 'assets/obra-umbral',
    luces: [[43,17,22,22],[38,85,24,16]],
    interiores: [],
    plano:
      '<rect class="relleno" x="110" y="42" width="180" height="196"/>' +
      '<rect class="muro" x="110" y="42" width="180" height="196"/>' +
      '<rect class="muro" x="168" y="80" width="64" height="120"/>' +
      escalones(168, 80, 64, 14, 120),
    puntos: [
      { x:200, y:140, t:'Catorce escalones', n:'Concreto pulido en una sola colada de nueve horas. Sin juntas visibles.' },
      { x:139, y:70,  t:'Recámara', n:'La escalera es el único elemento estructural interior: todos los muros son ligeros y desmontables.' },
      { x:261, y:70,  t:'Recámara', n:'Superficie mínima, altura máxima.' },
      { x:200, y:220, t:'Doble altura', n:'Cuatro metros sesenta libres en el volumen principal.' }
    ]
  }
};

/* pintar el resplandor de las ventanas y el aviso de entrar en cada tarjeta.
   Las coordenadas van en porcentaje de la FOTO, no de la tarjeta, así que la capa
   se coloca sobre el rectángulo real que ocupa la imagen tras el recorte de cover. */
function encajarLuz(card){
  var img = card.querySelector('img');
  var luz = card.querySelector('.luz');
  if (!img || !luz || !img.naturalWidth) return;
  var cr = card.getBoundingClientRect();
  var ir = img.getBoundingClientRect();
  luz.style.width = ir.width + 'px';
  luz.style.height = ir.height + 'px';
  luz.style.left = (ir.left - cr.left) + 'px';
  luz.style.top = (ir.top - cr.top) + 'px';
  var entrar = card.querySelector('.entrar');
  if (entrar){
    entrar.style.left = (ir.left - cr.left + ir.width / 2) + 'px';
    entrar.style.top = (ir.top - cr.top + ir.height / 2) + 'px';
  }
}

var tarjetasLuz = [].slice.call(document.querySelectorAll('.obra[data-villa]'));
tarjetasLuz.forEach(function(card){
  var v = VILLAS[card.dataset.villa];
  if (!v) return;
  var luz = document.createElement('div');
  luz.className = 'luz';
  luz.setAttribute('aria-hidden','true');
  luz.innerHTML = v.luces.map(function(L){
    return '<i style="left:' + (L[0] - L[2]/2) + '%;top:' + (L[1] - L[3]/2) +
           '%;width:' + L[2] + '%;height:' + L[3] + '%"></i>';
  }).join('');
  card.appendChild(luz);

  var ent = document.createElement('div');
  ent.className = 'entrar';
  ent.setAttribute('aria-hidden','true');
  ent.innerHTML = 'entrar';
  card.appendChild(ent);

  var img = card.querySelector('img');
  if (img.complete) encajarLuz(card);
  else img.addEventListener('load', function(){ encajarLuz(card); }, { once: true });
});
addEventListener('resize', function(){ tarjetasLuz.forEach(encajarLuz); });

/* --- abrir y cerrar --- */
var fullficha = document.getElementById('fullficha');
var panelficha = document.getElementById('panelficha');
var velo = document.getElementById('velo');
var ultimaTarjeta = null;
var reducido = function(){ return matchMedia('(prefers-reduced-motion: reduce)').matches; };

function svgPlano(v){
  var pts = v.puntos.map(function(p, i){
    return '<g class="pt" data-i="' + i + '" tabindex="0" role="button" aria-label="' + p.t + '">' +
           '<circle cx="' + p.x + '" cy="' + p.y + '" r="11"/>' +
           '<text x="' + p.x + '" y="' + p.y + '">' + (i + 1) + '</text></g>';
  }).join('');
  return '<svg class="plano" viewBox="0 0 400 280" role="img" aria-label="Plano de ' + v.nombre + '">' +
         v.plano + pts + '</svg>';
}

function planoFicha(v){
  if (!v.planoImagen) return svgPlano(v);
  return '<picture class="planoMedia">' +
    '<source srcset="' + v.planoImagen + '-512.webp 512w, ' + v.planoImagen + '-1024.webp 1024w" sizes="(max-width:700px) calc(100vw - 92px), 700px">' +
    '<img class="planoImagen" src="' + v.planoImagen + '-512.webp" alt="' + v.planoAlt + '" width="1024" height="576" decoding="async">' +
  '</picture>';
}

function construirFicha(v){
  var imgs = v.interiores.length ? v.interiores : [{ src: v.foto, pie: 'Vista exterior' }];
  var visor = imgs.map(function(im, i){
    var srcset = im.src + '-400.webp 400w, ' + im.src + '-900.webp 900w' + (im.compact ? '' : ', ' + im.src + '-1600.webp 1600w');
    var source = i === 0
      ? 'src="' + im.src + '-900.webp" srcset="' + srcset + '" sizes="(max-width: 700px) 92vw, 960px"'
      : 'data-src="' + im.src + '-900.webp" data-srcset="' + srcset + '" data-sizes="(max-width: 700px) 92vw, 960px"';
    return '<img ' + source +
           ' alt="' + im.pie + '" class="' + (i === 0 ? 'viva' : '') + '" data-i="' + i + '"' +
           ' decoding="async">';
  }).join('');

  return '' +
  '<div class="fichaWrap">' +
    '<button class="cerrar" id="cerrarFicha" type="button" aria-label="Cerrar">' +
      '<svg viewBox="0 0 16 16"><path d="M2 2 L14 14 M14 2 L2 14"/></svg></button>' +
    '<section class="fichaHero">' +
      '<img src="' + v.foto + '-1600.webp" srcset="' + v.foto + '-900.webp 900w, ' + v.foto + '-1600.webp 1600w" sizes="100vw" alt="Vista exterior de ' + v.nombre + '" decoding="async">' +
      '<div class="fichaHeroCopy"><div><span class="glass">' + v.num + '</span><h2 id="fichaNombre">' + v.nombre + '</h2></div><p>' + v.lugar + '<br>' + v.estado + '</p></div>' +
    '</section>' +
    '<div class="fichaBody">' +
      '<section class="fichaInfo">' +
        '<div class="fichaInfoLead"><span>la residencia</span><h3>Todo lo esencial, antes de decidir.</h3><p>' + (v.detalle || 'Arquitectura, materialidad y paisaje se organizan para crear una casa clara, habitable y duradera.') + '</p></div>' +
        '<dl class="fichaSpecs">' +
          '<div><dt>Precio</dt><dd>' + v.precio + '</dd></div>' +
          '<div><dt>Superficie</dt><dd>' + v.m2 + '</dd></div>' +
          '<div><dt>Programa</dt><dd>' + v.rec + '</dd></div>' +
          '<div><dt>Estado</dt><dd>' + v.estado + '</dd></div>' +
        '</dl>' +
      '</section>' +
      '<section class="fichaGallery" aria-label="Galería de ' + v.nombre + '">' +
        '<div class="fichaSectionHead"><div><span>recorrido interior</span><h3>la galería</h3></div><b class="galleryCounter" id="galleryCounter">01 / ' + String(imgs.length).padStart(2,'0') + '</b></div>' +
        '<div class="visor" id="visor">' + visor +
          '<button class="galleryNav galleryPrev" type="button" aria-label="Imagen anterior"><span>→</span></button>' +
          '<button class="galleryNav galleryNext" type="button" aria-label="Imagen siguiente"><span>→</span></button>' +
        '</div>' +
        '<span class="pie" id="pieVisor">' + imgs[0].pie + '</span>' +
      '</section>' +
      '<section class="fichaRelato"><span>idea de proyecto</span><blockquote>' + (v.relato || v.detalle) + '</blockquote></section>' +
      '<section class="fichaPlanoWrap">' +
        '<div class="fichaSectionHead"><div><span>distribución</span><h3>plano arquitectónico</h3></div></div>' +
        '<div class="fichaPlanoGrid"><div class="planoCaja' + (v.planoImagen ? ' planoImagenCaja' : '') + '">' + planoFicha(v) +
          '<p class="notaPunto" id="notaPunto"><b>' + (v.planoImagen ? 'Vista de distribución.' : v.puntos[0].t) + '</b>' + (v.planoImagen ? 'Una lectura espacial de la casa, sus niveles y su relación con el terreno.' : v.puntos[0].n) + '</p>' +
        '</div><aside class="fichaPlanoAside"><h4>' + (v.planoImagen ? 'La casa, vista por dentro.' : 'Explora los puntos de interés.') + '</h4><p>' + (v.planoImagen ? 'Esta vista axonométrica permite entender la distribución, la altura de los espacios y cómo se conectan las áreas de la residencia.' : 'Selecciona cada número para entender la distribución, la orientación y las decisiones que definen esta casa.') + '</p></aside></div>' +
      '</section>' +
      '<section class="fichaAgenda"><div><span>siguiente paso</span><h3>Conoce la casa en persona.</h3></div><button id="fichaAgendar" type="button">Agendar visita <b aria-hidden="true">↗</b></button></section>' +
    '</div>' +
  '</div>';
}

function cablearFicha(v){
  var visor = document.getElementById('visor');
  var pie = document.getElementById('pieVisor');
  var imgs = [].slice.call(visor.querySelectorAll('img'));
  var lista = v.interiores.length ? v.interiores : [{ src: v.foto, pie: 'Vista exterior' }];

  var counter = document.getElementById('galleryCounter');
  var activeImage = 0;
  var pendingImage = null;
  function cargarImagen(im){
    if (!im || !im.dataset.src) return;
    im.src = im.dataset.src;
    im.srcset = im.dataset.srcset;
    im.sizes = im.dataset.sizes;
    delete im.dataset.src;
    delete im.dataset.srcset;
    delete im.dataset.sizes;
  }
  function precargarSiguiente(i){
    var next = imgs[(i + imgs.length) % imgs.length];
    var idle = window.requestIdleCallback
      ? function(fn){ window.requestIdleCallback(fn, { timeout:900 }); }
      : function(fn){ setTimeout(fn, 180); };
    idle(function(){ cargarImagen(next); });
  }
  function mostrarImagen(i){
    var siguiente = (i + imgs.length) % imgs.length;
    var imagen = imgs[siguiente];
    if (siguiente === activeImage || pendingImage === imagen) return;
    pendingImage = imagen;
    cargarImagen(imagen);
    function revelar(){
      if (pendingImage !== imagen) return;
      pendingImage = null;
      activeImage = siguiente;
      imgs.forEach(function(im){ im.classList.toggle('viva', +im.dataset.i === activeImage); });
      pie.textContent = lista[activeImage].pie;
      counter.textContent = String(activeImage + 1).padStart(2,'0') + ' / ' + String(imgs.length).padStart(2,'0');
      precargarSiguiente(activeImage + 1);
    }
    if (imagen.complete && imagen.naturalWidth) revelar();
    else imagen.addEventListener('load', revelar, { once:true });
  }
  panelficha.querySelector('.galleryPrev').addEventListener('click',function(){ mostrarImagen(activeImage - 1); });
  panelficha.querySelector('.galleryNext').addEventListener('click',function(){ mostrarImagen(activeImage + 1); });
  precargarSiguiente(activeImage + 1);

  var nota = document.getElementById('notaPunto');
  var grupos = [].slice.call(panelficha.querySelectorAll('.pt'));
  if (!nota || !grupos.length) {
    document.getElementById('fichaAgendar').addEventListener('click',function(){
      cerrarFicha();
      setTimeout(function(){
        var destino = document.getElementById('agendar');
        if (destino) destino.scrollIntoView({ behavior: reducido() ? 'auto' : 'smooth', block:'start' });
      },560);
    });
    document.getElementById('cerrarFicha').addEventListener('click', cerrarFicha);
    return;
  }
  function activar(i){
    grupos.forEach(function(g){ g.classList.toggle('activa', +g.dataset.i === i); });
    nota.innerHTML = '<b>' + v.puntos[i].t + '</b>' + v.puntos[i].n;
  }
  grupos.forEach(function(g){
    var i = +g.dataset.i;
    g.addEventListener('mouseenter', function(){ activar(i); });
    g.addEventListener('focus', function(){ activar(i); });
    g.addEventListener('click', function(){ activar(i); });
    g.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); activar(i); } });
  });
  activar(0);

  document.getElementById('fichaAgendar').addEventListener('click',function(){
    cerrarFicha();
    setTimeout(function(){
      var destino = document.getElementById('agendar');
      if (destino) destino.scrollIntoView({ behavior: reducido() ? 'auto' : 'smooth', block:'start' });
    },560);
  });

  document.getElementById('cerrarFicha').addEventListener('click', cerrarFicha);
}

/* el plano se ciñe a lo que realmente dibuja, así no deja aire muerto en su caja */
function ajustarPlano(){
  var svg = panelficha.querySelector('svg.plano');
  if (!svg || !svg.getBBox) return;
  try {
    var bb = svg.getBBox();
    if (!bb.width || !bb.height) return;
    var pad = Math.max(bb.width, bb.height) * 0.06;
    svg.setAttribute('viewBox',
      (bb.x - pad).toFixed(1) + ' ' + (bb.y - pad).toFixed(1) + ' ' +
      (bb.width + pad * 2).toFixed(1) + ' ' + (bb.height + pad * 2).toFixed(1));
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  } catch (e) {}
}

function abrirFicha(card){
  var v = VILLAS[card.dataset.villa];
  if (!v) return;
  ultimaTarjeta = card;

  panelficha.innerHTML = construirFicha(v);
  prepareScatterCopy(panelficha, true);
  cablearFicha(v);
  fullficha.classList.add('on');
  document.body.classList.add('bloqueado');
  ajustarPlano();

  if (reducido()){
    fullficha.classList.add('abierta');
    panelficha.focus();
    return;
  }

  /* el empuje de cámara: la tarjeta crece hasta llenar la pantalla */
  var r = card.getBoundingClientRect();
  var vol = document.createElement('div');
  vol.className = 'volador';
  vol.style.cssText = 'top:' + r.top + 'px;left:' + r.left + 'px;width:' + r.width + 'px;height:' + r.height +
                      'px;background-image:url(' + v.foto + '-900.webp)';
  document.body.appendChild(vol);

  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      vol.classList.add('va');
      vol.style.top = '12px'; vol.style.left = '12px';
      vol.style.width = 'calc(100vw - 24px)'; vol.style.height = 'calc(100vh - 24px)';
      vol.style.borderRadius = '30px';
      vol.style.opacity = '0';
      fullficha.classList.add('abierta');
    });
  });
  setTimeout(function(){ if (vol.parentNode) vol.parentNode.removeChild(vol); panelficha.focus(); }, 950);
}

function cerrarFicha(){
  fullficha.classList.remove('abierta');
  document.body.classList.remove('bloqueado');
  setTimeout(function(){
    fullficha.classList.remove('on');
    panelficha.innerHTML = '';
    if (ultimaTarjeta) ultimaTarjeta.focus();
  }, 520);
}

document.querySelectorAll('.obra[data-villa]').forEach(function(card){
  card.addEventListener('click', function(){ abrirFicha(card); });
  card.addEventListener('keydown', function(e){
    if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); abrirFicha(card); }
  });
});
velo.addEventListener('click', cerrarFicha);
document.addEventListener('keydown', function(e){
  if (e.key === 'Escape' && fullficha.classList.contains('on')) cerrarFicha();
});

/* ---------------------------------------------------------------
   arranque
   --------------------------------------------------------------- */
applyHeroMode();
pintarNav();
if (matchMedia('(prefers-reduced-motion: reduce)').matches) pinToFinalStates();

})();
