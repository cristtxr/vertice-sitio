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
    /* al reaparecer, el objetivo puede venir de antes de salir de pantalla:
       se recalcula para no pintar el hero con un progreso obsoleto */
    if (heroOnScreen && rafId === null && scrubOn){ target = heroProgress(); rafId = requestAnimationFrame(tick); }
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
var ahorrarDatosHora = !!(navigator.connection && navigator.connection.saveData);

function posterHora(){
  if (!horaVideo) return '';
  return matchMedia('(max-width:900px)').matches
    ? (horaVideo.dataset.posterMobile || horaVideo.dataset.poster)
    : horaVideo.dataset.poster;
}
if (horaVideo) horaVideo.poster = posterHora();

/* El video conserva exactamente el recorrido, pero no compite con el hero por
   ancho de banda ni por decodificación hasta que el lector se acerca a él. */
function cargarVideoHora(){
  if (!horaVideo || horaVideo.dataset.loaded) return;
  horaVideo.poster = posterHora();
  if (ahorrarDatosHora || matchMedia('(prefers-reduced-motion: reduce)').matches){
    horaVideo.dataset.loaded = 'poster';
    return;
  }
  horaVideo.dataset.loaded = 'true';
  [].slice.call(horaVideo.querySelectorAll('source[data-src]')).forEach(function(source){
    source.src = source.dataset.src;
  });
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
    nombre: 'casa palmar', lugar: 'Cartagena, Bolívar', num: 'N°034 · 2026',
    precio: '$6.700.000.000 COP', m2: '520 m²', rec: '4 recámaras', estado: 'Disponible', libre: true,
    foto: 'assets/casa-palmar-exterior',
    planoImagen: 'assets/plano-palmar',
    planoAlt: 'Vista axonométrica de la distribución de Casa Palmar.',
    detalle: 'Una residencia abierta al jardín, con dos niveles conectados por luz natural y una secuencia continua entre sala, terraza y paisaje.',
    relato: 'La casa no termina en el vidrio. La cubierta, la terraza y el jardín forman una sola estancia para vivir adentro y afuera con la misma comodidad.',
    luces: [[31,31,15,18],[51,33,13,19],[75,34,24,28],[39,59,13,17],[61,58,17,18],[81,59,22,18]],
    interiores: [
      { src:'assets/casa-palmar-sala', tipo:'interior · área social', titulo:'sala de doble altura', pie:'Sala de doble altura abierta al jardín', descripcion:'La doble altura concentra la luz y abre la estancia principal al jardín. El vidrio desaparece visualmente para que interior y paisaje se lean como un solo espacio.' },
      { src:'assets/casa-palmar-terraza', tipo:'exterior · terraza', titulo:'comedor al aire libre', pie:'Terraza cubierta y comedor exterior', descripcion:'La cubierta prolonga la casa hacia el jardín y protege el comedor exterior. Es el punto de encuentro entre la cocina, la sala y la vegetación.' },
      { src:'assets/casa-palmar-piscina', tipo:'exterior · agua', titulo:'estancia frente al agua', pie:'Estancia exterior frente a la piscina', descripcion:'La piscina cierra la secuencia social de la casa. Su borde acompaña la terraza y mantiene el jardín como fondo permanente.' }
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
    nombre: 'casa mirador', lugar: 'Guatapé, Antioquia', num: 'N°041 · 2026',
    precio: '$8.900.000.000 COP', m2: '610 m²', rec: '5 recámaras', estado: 'Disponible', libre: true,
    foto: 'assets/casa-mirador-exterior',
    planoImagen: 'assets/plano-mirador-corte',
    planoAlt: 'Vista axonométrica de la distribución de Casa Mirador.',
    detalle: 'Una residencia de montaña organizada alrededor de la vista. Cada nivel se abre al valle y conserva privacidad entre las áreas sociales y las suites.',
    relato: 'El paisaje funciona como fachada principal. La alberca, la sala y el pabellón exterior comparten un mismo horizonte sin bloquearse entre sí.',
    luces: [[39,26,14,14],[55,26,12,14],[72,43,16,16],[49,44,14,14]],
    interiores: [
      { src:'assets/casa-mirador-sala', tipo:'interior · estancia', titulo:'sala frente al valle', pie:'Sala principal frente al valle', descripcion:'El ventanal mantiene el horizonte completo dentro de la estancia. La distribución deja libre la visual y separa con claridad las circulaciones privadas.' },
      { src:'assets/casa-mirador-cocina', tipo:'interior · cocina', titulo:'madera, piedra y luz', pie:'Cocina de madera, piedra y luz indirecta', descripcion:'La cocina combina superficies minerales y carpintería cálida. La iluminación indirecta acompaña el trabajo sin competir con la vista exterior.' },
      { src:'assets/casa-mirador-terraza', tipo:'exterior · terraza', titulo:'un borde sobre la montaña', pie:'Terraza y alberca abiertas a la montaña', descripcion:'La alberca prolonga la línea del valle y conecta la terraza con el pabellón exterior. Aquí la casa se abre por completo al paisaje.' }
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
    nombre: 'casa corte', lugar: 'Santa Marta, Magdalena', num: 'N°008 · 2023',
    precio: '$3.900.000.000 COP', m2: '265 m²', rec: '3 recámaras', estado: 'Reservado', libre: false,
    foto: 'assets/obra-corte',
    planoImagen: '',
    planoAlt: 'Vista axonométrica de la distribución de Casa Corte.',
    luces: [[78,44,22,30],[66,50,12,18]],
    detalle: 'Concreto aparente, madera y bosque. Casa Corte trabaja con vacíos precisos para que la luz revele la estructura a lo largo del día.',
    relato: 'La escalera, la cocina y la recámara nacen de una misma lógica material. Pocas piezas, bien resueltas, dejan que el bosque sea el acabado principal.',
    interiores: [
      { src:'assets/casa-corte-interior', tipo:'interior · circulación', titulo:'la escalera como estructura', pie:'Escalera de concreto y estancia frente al bosque', descripcion:'La escalera de concreto organiza la casa y enmarca la estancia. Su peso contrasta con la apertura total hacia el bosque.', compact:true },
      { src:'assets/casa-corte-cocina', tipo:'interior · cocina', titulo:'todo bajo una pieza', pie:'Cocina integrada bajo la escalera', descripcion:'La cocina aprovecha el vacío bajo la escalera para reunir almacenamiento, preparación y circulación en un gesto continuo.', compact:true },
      { src:'assets/casa-corte-recamara', tipo:'interior · descanso', titulo:'dormir entre vegetación', pie:'Recámara abierta a la vegetación', descripcion:'La recámara se abre al verde y conserva una materialidad silenciosa. El paisaje aporta profundidad sin perder resguardo.', compact:true }
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
      { x:100, y:110, t:'Comedor', n:'Orientado al poniente, con el horizonte del Caribe como único fondo.' },
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
var limpiarFichaActual = null;
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


function crearEscenas(v){
  var escenas = [{
    tipo: 'exterior · ' + v.estado.toLowerCase(),
    titulo: v.nombre,
    descripcion: v.detalle,
    pie: v.lugar,
    src: v.foto,
    alt: 'Vista exterior de ' + v.nombre,
    clase: 'is-exterior'
  }];
  v.interiores.forEach(function(im){
    escenas.push({
      tipo: im.tipo || 'recorrido interior',
      titulo: im.titulo || im.pie,
      descripcion: im.descripcion || im.pie,
      pie: im.pie,
      src: im.src,
      alt: im.pie + ' en ' + v.nombre,
      compact: !!im.compact,
      clase: 'is-photo'
    });
  });
  escenas.push({
    tipo: 'distribución · plano',
    titulo: 'la casa por dentro',
    descripcion: v.planoImagen
      ? 'La vista axonométrica reúne niveles, circulaciones y relaciones entre los espacios para que puedas evaluar la casa antes de visitarla.'
      : 'El plano reúne orientación, circulaciones y puntos clave para entender cómo se habita la casa.',
    pie: 'Plano arquitectónico de ' + v.nombre,
    src: v.planoImagen || '',
    alt: v.planoAlt || 'Plano arquitectónico de ' + v.nombre,
    clase: 'is-plan',
    plano: true
  });
  return escenas;
}

function imagenEscena(escena, i, v){
  if (escena.plano && !escena.src){
    return '<figure class="showroomFrame is-plan' + (i === 0 ? ' active' : '') + '" data-scene="' + i + '" aria-hidden="' + (i === 0 ? 'false' : 'true') + '"><div class="showroomSvgPlan">' + svgPlano(v) + '</div></figure>';
  }
  if (escena.plano){
    return '<figure class="showroomFrame is-plan" data-scene="' + i + '" aria-hidden="true">' +
      '<img data-src="' + escena.src + '-1024.webp" data-srcset="' + escena.src + '-512.webp 512w, ' + escena.src + '-1024.webp 1024w" data-sizes="(max-width:700px) calc(100vw - 48px), 980px" alt="' + escena.alt + '" width="1024" height="576" decoding="async">' +
    '</figure>';
  }
  var srcset = escena.src + '-400.webp 400w, ' + escena.src + '-900.webp 900w' + (escena.compact ? '' : ', ' + escena.src + '-1600.webp 1600w');
  var sizes = '(max-width:700px) calc(100vw - 16px), (max-width:1200px) calc(100vw - 48px), 1500px';
  var fuente = i === 0
    ? 'src="' + escena.src + '-900.webp" srcset="' + srcset + '" sizes="' + sizes + '"'
    : 'data-src="' + escena.src + '-900.webp" data-srcset="' + srcset + '" data-sizes="' + sizes + '"';
  return '<figure class="showroomFrame ' + escena.clase + (i === 0 ? ' active' : '') + '" data-scene="' + i + '" aria-hidden="' + (i === 0 ? 'false' : 'true') + '">' +
    '<img ' + fuente + ' alt="' + escena.alt + '" width="1600" height="900" decoding="async">' +
  '</figure>';
}

function copyEscena(escena, i, v, total){
  var extra = '';
  if (i === 0){
    extra = '<dl class="showroomSpecs">' +
      '<div><dt>Precio</dt><dd>' + v.precio + '</dd></div>' +
      '<div><dt>Superficie</dt><dd>' + v.m2 + '</dd></div>' +
      '<div><dt>Programa</dt><dd>' + v.rec + '</dd></div>' +
      '<div><dt>Estado</dt><dd>' + v.estado + '</dd></div>' +
    '</dl>';
  } else if (escena.plano){
    var notaPlano = !v.planoImagen && v.puntos && v.puntos.length
      ? '<p class="showroomPlanNote" id="showroomPlanNote"><b>' + v.puntos[0].t + '</b><span>' + v.puntos[0].n + '</span></p>'
      : '';
    extra = notaPlano + '<div class="showroomFinal">' +
      '<span>Visita privada · 60 min</span>' +
      '<button id="fichaAgendar" type="button">Conócela en persona <b aria-hidden="true">↗</b></button>' +
    '</div>';
  } else {
    extra = '<p class="showroomCaption">' + escena.pie + '</p>';
  }
  return '<article class="showroomSceneCopy' + (i === 0 ? ' active' : '') + '" data-scene="' + i + '" aria-hidden="' + (i === 0 ? 'false' : 'true') + '">' +
    '<span class="showroomKicker">' + escena.tipo + '</span>' +
    '<h3>' + escena.titulo + '</h3>' +
    '<p>' + escena.descripcion + '</p>' + extra +
  '</article>';
}

function construirFicha(v){
  var escenas = crearEscenas(v);
  var total = escenas.length;
  var medios = escenas.map(function(escena, i){ return imagenEscena(escena, i, v); }).join('');
  var titulos = escenas.map(function(escena, i){
    return '<p class="showroomTitle' + (i === 0 ? ' active' : '') + '" data-scene="' + i + '"><span>' + escena.tipo + '</span><strong' + (i === 0 ? ' id="fichaNombre"' : '') + '>' + escena.titulo + '</strong></p>';
  }).join('');
  var copys = escenas.map(function(escena, i){ return copyEscena(escena, i, v, total); }).join('');
  var puntos = escenas.map(function(_, i){ return '<i class="' + (i === 0 ? 'active' : '') + '" data-scene="' + i + '"></i>'; }).join('');

  return '<div class="fichaWrap showroomWrap">' +
    '<button class="cerrar showroomClose" id="cerrarFicha" type="button" aria-label="Cerrar recorrido de ' + v.nombre + '">' +
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2 L14 14 M14 2 L2 14"/></svg>' +
    '</button>' +
    '<div class="showroomJourney" id="showroomJourney" style="height:' + (total * 92) + 'vh">' +
      '<section class="showroomStage" id="showroomStage" aria-label="Recorrido por ' + v.nombre + '">' +
        '<div class="showroomMedia">' + medios + '<div class="showroomShade" aria-hidden="true"></div><div class="showroomTitleDeck" aria-hidden="true">' + titulos + '</div></div>' +
          '<aside class="showroomCopy" id="showroomCopy">' +
          '<div class="showroomStatus"><span>' + v.num + '</span><div class="showroomStatusSide"><b><i id="showroomCurrent">01</i><em>/</em>' + String(total).padStart(2,'0') + '</b><button class="showroomInfoToggle" id="showroomInfoToggle" type="button" aria-expanded="true" aria-controls="showroomCopy" aria-label="Ocultar la información para ver la foto completa"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3 L10.5 8 L5.5 13"/></svg></button></div></div>' +
          '<div class="showroomCopyDeck">' + copys + '</div>' +
          '<div class="showroomTimeline" aria-hidden="true"><span><i id="showroomProgress"></i></span><div>' + puntos + '</div></div>' +
          '</aside>' +
          '<button class="showroomInfoOpen" id="showroomInfoOpen" type="button" aria-label="Mostrar la información de este espacio">info <b aria-hidden="true">i</b></button>' +
      '</section>' +
    '</div>' +
  '</div>';
}

function cablearFicha(v){
  var escenas = crearEscenas(v);
  var journey = document.getElementById('showroomJourney');
  var stage = document.getElementById('showroomStage');
  var frames = [].slice.call(panelficha.querySelectorAll('.showroomFrame'));
  var copies = [].slice.call(panelficha.querySelectorAll('.showroomSceneCopy'));
  var titles = [].slice.call(panelficha.querySelectorAll('.showroomTitle'));
  var dots = [].slice.call(panelficha.querySelectorAll('.showroomTimeline i[data-scene]'));
  var current = document.getElementById('showroomCurrent');
  var progressLine = document.getElementById('showroomProgress');
  var activeIndex = 0;
  var scrollFrame = null;
  var idleId = null;

  function cargarEscena(i, callback){
    var frame = frames[i];
    if (!frame){ if (callback) callback(); return; }
    var img = frame.querySelector('img');
    if (!img){ if (callback) callback(); return; }
    if (img.dataset.src){
      img.src = img.dataset.src;
      if (img.dataset.srcset) img.srcset = img.dataset.srcset;
      if (img.dataset.sizes) img.sizes = img.dataset.sizes;
      delete img.dataset.src;
      delete img.dataset.srcset;
      delete img.dataset.sizes;
    }
    if (!callback) return;
    if (img.complete && img.naturalWidth) callback();
    else img.addEventListener('load', callback, { once:true });
  }

  function precargar(i){
    if (i < 0 || i >= frames.length) return;
    if (window.requestIdleCallback){
      idleId = window.requestIdleCallback(function(){ cargarEscena(i); }, { timeout:700 });
    } else {
      idleId = setTimeout(function(){ cargarEscena(i); }, 120);
    }
  }

  /* El texto y los indicadores cambian al instante; la fotografía entra en
     cuanto termina de cargar, o tras una espera breve si la red se tarda,
     para que el recorrido nunca se quede una escena atrás. */
  function activarEscena(i){
    i = Math.max(0, Math.min(escenas.length - 1, i));
    if (i === activeIndex) return;
    activeIndex = i;
    copies.forEach(function(el, n){ el.classList.toggle('active', n === i); el.setAttribute('aria-hidden', n === i ? 'false' : 'true'); });
    titles.forEach(function(el, n){ el.classList.toggle('active', n === i); });
    dots.forEach(function(el, n){ el.classList.toggle('active', n <= i); });
    current.textContent = String(i + 1).padStart(2,'0');
    stage.classList.toggle('is-plan', !!escenas[i].plano);
    var pintar = function(){
      if (i !== activeIndex) return;
      frames.forEach(function(el, n){ el.classList.toggle('active', n === i); el.setAttribute('aria-hidden', n === i ? 'false' : 'true'); });
    };
    cargarEscena(i, pintar);
    setTimeout(pintar, 480);
    precargar(i + 1);
  }

  function actualizarRecorrido(){
    scrollFrame = null;
    var max = Math.max(1, journey.offsetHeight - panelficha.clientHeight);
    var local = Math.max(0, Math.min(max, panelficha.scrollTop - journey.offsetTop));
    var progreso = local / max;
    stage.style.setProperty('--journey', progreso.toFixed(4));
    progressLine.style.transform = 'scaleX(' + progreso.toFixed(4) + ')';
    activarEscena(Math.round(progreso * (escenas.length - 1)));
  }

  function pedirActualizacion(){
    if (scrollFrame !== null) return;
    scrollFrame = requestAnimationFrame(actualizarRecorrido);
  }

  function irAVisita(){
    var interes = document.getElementById('interes');
    if (interes){
      var nombre = v.nombre.toLowerCase();
      [].slice.call(interes.options).some(function(opcion, i){
        if (opcion.text.toLowerCase().indexOf(nombre) === -1) return false;
        interes.selectedIndex = i;
        return true;
      });
    }
    cerrarFicha();
    setTimeout(function(){
      var destino = document.getElementById('agendar');
      if (destino) destino.scrollIntoView({ behavior: reducido() ? 'auto' : 'smooth', block:'start' });
    },560);
  }

  panelficha.addEventListener('scroll', pedirActualizacion, { passive:true });
  window.addEventListener('resize', pedirActualizacion, { passive:true });
  var notaPlano = document.getElementById('showroomPlanNote');
  var puntosPlano = [].slice.call(panelficha.querySelectorAll('.showroomSvgPlan .pt'));
  function activarPunto(i){
    if (!notaPlano || !v.puntos[i]) return;
    puntosPlano.forEach(function(punto, n){ punto.classList.toggle('activa', n === i); });
    notaPlano.innerHTML = '<b>' + v.puntos[i].t + '</b><span>' + v.puntos[i].n + '</span>';
  }
  puntosPlano.forEach(function(punto, i){
    punto.addEventListener('mouseenter', function(){ activarPunto(i); });
    punto.addEventListener('focus', function(){ activarPunto(i); });
    punto.addEventListener('click', function(){ activarPunto(i); });
    punto.addEventListener('keydown', function(e){
      if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); activarPunto(i); }
    });
  });
  if (puntosPlano.length) activarPunto(0);
  document.getElementById('fichaAgendar').addEventListener('click', irAVisita);
  document.getElementById('cerrarFicha').addEventListener('click', cerrarFicha);
  /* la ficha se pliega para contemplar la fotografía a cuadro completo */
  var infoToggle = document.getElementById('showroomInfoToggle');
  var infoOpen = document.getElementById('showroomInfoOpen');
  function mostrarInfo(visible){
    stage.classList.toggle('info-off', !visible);
    infoToggle.setAttribute('aria-expanded', visible ? 'true' : 'false');
    (visible ? infoToggle : infoOpen).focus({ preventScroll:true });
  }
  infoToggle.addEventListener('click', function(){ mostrarInfo(false); });
  infoOpen.addEventListener('click', function(){ mostrarInfo(true); });
  precargar(1);
  /* Con la ficha abierta, el resto del recorrido baja en segundo plano, una
     escena a la vez: ningún giro rápido del scroll vuelve a esperar la red. */
  if (!(navigator.connection && navigator.connection.saveData)){
    var colaEscenas = [];
    for (var k = 2; k < frames.length; k++) colaEscenas.push(k);
    (function bombear(){
      if (!colaEscenas.length) return;
      cargarEscena(colaEscenas.shift(), function(){
        if (window.requestIdleCallback) idleId = requestIdleCallback(bombear, { timeout:900 });
        else idleId = setTimeout(bombear, 180);
      });
    })();
  }
  actualizarRecorrido();

  return function(){
    panelficha.removeEventListener('scroll', pedirActualizacion);
    window.removeEventListener('resize', pedirActualizacion);
    if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
    if (idleId !== null){
      if (window.cancelIdleCallback) window.cancelIdleCallback(idleId);
      else clearTimeout(idleId);
    }
  };
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

  if (limpiarFichaActual) limpiarFichaActual();
  panelficha.innerHTML = construirFicha(v);
  prepareScatterCopy(panelficha, true);
  fullficha.classList.add('on');
  document.body.classList.add('bloqueado');
  panelficha.scrollTop = 0;
  limpiarFichaActual = cablearFicha(v);
  ajustarPlano();

  if (reducido()){
    fullficha.classList.add('abierta');
    panelficha.focus();
    return;
  }

  /* La fotografía viaja desde la tarjeta hasta el escenario del recorrido. */
  var r = card.getBoundingClientRect();
  var escenario = panelficha.querySelector('.showroomMedia');
  var destino = escenario ? escenario.getBoundingClientRect() : panelficha.getBoundingClientRect();
  var vol = document.createElement('div');
  vol.className = 'volador';
  vol.style.cssText = 'top:' + r.top + 'px;left:' + r.left + 'px;width:' + r.width + 'px;height:' + r.height +
                      'px;background-image:url(' + v.foto + '-900.webp)';
  document.body.appendChild(vol);

  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      vol.classList.add('va');
      vol.style.top = destino.top + 'px'; vol.style.left = destino.left + 'px';
      vol.style.width = destino.width + 'px'; vol.style.height = destino.height + 'px';
      vol.style.borderRadius = '24px';
      vol.style.opacity = '0';
      fullficha.classList.add('abierta');
    });
  });
  setTimeout(function(){ if (vol.parentNode) vol.parentNode.removeChild(vol); panelficha.focus(); }, 950);
}

function cerrarFicha(){
  fullficha.classList.remove('abierta');
  document.body.classList.remove('bloqueado');
  if (limpiarFichaActual){ limpiarFichaActual(); limpiarFichaActual = null; }
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
  if (!fullficha.classList.contains('on')) return;
  if (e.key === 'Escape'){ cerrarFicha(); return; }
  if (e.key !== 'Tab') return;
  var focos = [].slice.call(panelficha.querySelectorAll('button,[href],[tabindex]:not([tabindex="-1"])')).filter(function(el){
    var infoPlegada = !!panelficha.querySelector('.showroomStage.info-off');
    return !el.disabled && el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null && !(infoPlegada && el.closest('.showroomCopy'));
  });
  if (!focos.length){ e.preventDefault(); panelficha.focus(); return; }
  var primero = focos[0];
  var ultimo = focos[focos.length - 1];
  if (e.shiftKey && document.activeElement === primero){ e.preventDefault(); ultimo.focus(); }
  else if (!e.shiftKey && document.activeElement === ultimo){ e.preventDefault(); primero.focus(); }
});

/* ---------------------------------------------------------------
   arranque
   --------------------------------------------------------------- */
applyHeroMode();
pintarNav();
if (matchMedia('(prefers-reduced-motion: reduce)').matches) pinToFinalStates();

})();
