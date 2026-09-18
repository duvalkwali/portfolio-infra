/*
 * The world behind the page, plus the scroll reveal. The canvas is decorative and aria-hidden:
 * with scripting off or WebGL unavailable, the wash on <body> is the finished background. One
 * triangle, one fragment shader, no geometry, no images, and under 15 KB raw — which is why it
 * carries far fewer comments than the canvas it replaced.
 */
(function () {
  "use strict";

  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ?static draws one frame and never loops: a pane may suspend rAF.
  var STATIC = REDUCED || /[?&]static(=|&|$)/.test(window.location.search);

  function initReveal() {
    var targets = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
    if (!targets.length) return;

    // Under reduced motion, or without IntersectionObserver, simply never add the class
    // that hides them. Nothing to undo, because nothing was hidden.
    if (REDUCED || !("IntersectionObserver" in window)) return;

    /*
     * A viewport with no height is not a viewport this can reason about — a collapsed
     * container, a zero-size frame, a renderer that has not laid out yet. Every
     * "is it on screen" test below would answer no, so the gate would hide the whole
     * page and leave it that way. Don't gate at all.
     */
    if (!window.innerHeight) return;

    document.documentElement.classList.add("reveal-ready");

    var pending = targets.slice();

    function show(el, delay) {
      el.style.transitionDelay = (delay || 0) + "ms";
      el.classList.add("is-revealed");
      if (observer) observer.unobserve(el);
      var i = pending.indexOf(el);
      if (i >= 0) pending.splice(i, 1);
    }

    var observer = new IntersectionObserver(
      function (entries) {
        var staggered = 0;
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          // 60 ms apart, but only among the elements that crossed in this same callback,
          // so a section scrolled past quickly does not inherit a long queued delay.
          show(entry.target, staggered * 60);
          staggered++;
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );

    targets.forEach(function (el) {
      observer.observe(el);
    });

    /*
     * Reveals anything currently on screen, without waiting for the observer.
     *
     * This runs once up front — content already in the viewport cannot be "scrolled into
     * view", so there is nothing to wait for — and again on scroll, which is the part
     * that matters. Testing turned up an environment where the observer never fired at
     * all: the first card was revealed by the initial pass, that was enough to satisfy a
     * "has anything appeared?" failsafe, and every section below it stayed at opacity 0
     * permanently. Driving the same check from scroll removes the dependency on the
     * observer working, and costs a handful of getBoundingClientRect calls per 100ms of
     * scrolling, on a list that only ever shrinks.
     */
    function revealVisible() {
      var h = window.innerHeight || 0;
      if (!h) return;
      var staggered = 0;
      pending.slice().forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < h && r.bottom > 0) {
          show(el, staggered * 60);
          staggered++;
        }
      });
      if (!pending.length) window.removeEventListener("scroll", onScroll);
    }

    var queued = false;
    function onScroll() {
      if (queued) return;
      queued = true;
      setTimeout(function () {
        queued = false;
        revealVisible();
      }, 100);
    }

    revealVisible();
    window.addEventListener("scroll", onScroll, { passive: true });

    /*
     * Backstop, bounded. The observer and the scroll handler both cover this in any real
     * browser, but "the reader is looking at a blank page" is a bad enough failure that
     * it should not rest on an async callback firing at all — and an environment where
     * none of them do turned up during testing.
     *
     * A one-shot "has anything appeared?" check is not enough: the initial pass reveals
     * the first card, which satisfies that test while every section below stays hidden.
     * So this re-runs the real in-viewport check a few times a second for a few seconds,
     * and gives up by removing the gate outright if something the reader can actually see
     * is still hidden at the end of it. Normal browsers empty `pending` and clear the
     * interval long before that.
     */
    var polls = 0;
    var poll = setInterval(function () {
      polls++;
      revealVisible();
      if (!pending.length) {
        clearInterval(poll);
        return;
      }
      if (polls >= 12) {
        clearInterval(poll);
        var stuckInView = pending.some(function (el) {
          var r = el.getBoundingClientRect();
          return r.top < (window.innerHeight || 0) && r.bottom > 0;
        });
        if (stuckInView) document.documentElement.classList.remove("reveal-ready");
      }
    }, 400);
  }

  var VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";

  var FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform vec4 uT;   // x seconds, y dim, zw parallax+drift
uniform vec3 uBg,uDeep,uAcc,uHov;

// Hash without sine: fract(sin(dot(p,k))*43758.5) overflows mediump and turns into a lattice.
float h12(vec2 p){vec3 q=fract(p.xyx*.1031);q+=dot(q,q.yzx+19.19);return fract((q.x+q.y)*q.z);}
float h13(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+19.19);return fract((p.x+p.y)*p.z);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p),e=vec2(0,1);f=f*f*(3.-2.*f);
return mix(mix(h12(i),h12(i+e.yx),f.x),mix(h12(i+e.xy),h12(i+e.yy),f.x),f.y);}
float n3(vec3 p){vec3 i=floor(p),f=fract(p);vec2 e=vec2(0,1);f=f*f*(3.-2.*f);
return mix(mix(mix(h13(i+e.xxx),h13(i+e.yxx),f.x),mix(h13(i+e.xyx),h13(i+e.yyx),f.x),f.y),
mix(mix(h13(i+e.xxy),h13(i+e.yxy),f.x),mix(h13(i+e.xyy),h13(i+e.yyy),f.x),f.y),f.z);}
float fbm2(vec2 p){float s=0.,a=.5;for(int i=0;i<3;i++){s+=a*n2(p);p*=2.07;a*=.5;}return s;}
float fbm3(vec3 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*n3(p);p*=2.03;a*=.5;}return s;}

// Offsets stay single digits so ids floor exactly on mediump.
vec3 star(vec2 q,float k,float thr,float t){
vec2 g=q*k,id=floor(g),f=fract(g);
if(h12(id+11.3)<thr)return vec3(0);
float m=h12(id+3.7);
float d=length(f-(.18+.64*vec2(h12(id+1.3),h12(id+5.7))));
float tw=.74+.26*sin(t*(.6+m*1.7)+m*31.);
vec3 c=mix(vec3(.42,.55,.95),vec3(.9,.94,1),m);
if(m>.9875)c=vec3(1,.82,.62); // one in eighty: the only warm note
return c*(pow(max(0.,1.-d*6.2),9.)*(.12+.43*m*m)*tw+step(.93,m)*pow(max(0.,1.-d*2.3),4.)*.17);}

void main(){
// y runs -0.5 to 0.5 at any aspect ratio, so every constant below is a fraction of height.
vec2 fc=gl_FragCoord.xy,uv=fc/uRes,p=(fc-.5*uRes)/uRes.y,pc=p+uT.zw;
float asp=uRes.x/uRes.y,t=uT.x;
vec3 add=uDeep*(.1+.34*smoothstep(-.45,.55,pc.y));

vec2 nq=mat2(.8525,-.5227,.5227,.8525)*(pc-vec2(.1*asp,.02)); // nebula, rotated -0.55
float nf=fbm2(nq*vec2(1.7,3.1)+vec2(t*.008,0));
float nb=exp(-nq.y*nq.y*7.)*smoothstep(.3,.92,nf);
add+=mix(uDeep,uAcc,nf)*nb*nb*1.15;

add+=star(p+uT.zw,22.,.62,t)+star(p+uT.zw*.62+vec2(2,1),52.,.72,t)+star(p+uT.zw*.32+vec2(4,3),115.,.8,t);

// A point at (x,y,0) projects to (x/D,y/D) here, so the centre is picked in screen units.
// Portrait gets a smaller world, higher: at 375px the desktop framing swallows the headline.
float at=clamp((asp-.55)/1.25,0.,1.),R=mix(1.05,2.3,at),D=4.;
vec3 ctr=vec3(vec2(asp*.42,mix(.46,.32,at))*D,0),ro=vec3(0,0,D),rd=normalize(vec3(pc,-1));
vec3 oc=ro-ctr;
float bb=dot(oc,rd),oo=dot(oc,oc),hh=bb*bb-oo+R*R;
// Clamping the discriminant lands a miss on the tangent point, which the halo below wants.
vec3 nrm=normalize(ro+rd*(-bb-sqrt(max(hh,0.)))-ctr);
float dn=sqrt(max(0.,oo-bb*bb))/R;
float w=max(1e-4,sqrt(oo)/R*1.6/uRes.y); // one pixel in dn units: limb AA
float mask=smoothstep(1.+w,1.-w,dn);

vec3 L=normalize(vec3(.4,.28,.87)),pcol=vec3(0);
float lit=smoothstep(-.3,.5,dot(nrm,L));
if(mask>.002){
float a=t*.09,ca=cos(a),sa=sin(a);
vec3 ax=normalize(vec3(.24,.94,.12));
vec3 q=nrm*ca-cross(ax,nrm)*sa+ax*dot(ax,nrm)*(1.-ca); // Rodrigues, backwards
float f=fbm3(q*2.5);
float s=clamp(f*.62+(.5+.5*sin(dot(q,ax)*8.5+f*3.6))*.28+n3(q*7.5+13.)*.16,0.,1.);
vec3 alb=mix(uDeep*.8,uAcc,smoothstep(.28,.72,s));
alb=mix(alb,uHov,smoothstep(.66,.95,s)*.75);
float fr=pow(1.-max(0.,dot(nrm,-rd)),3.2);
float sp=pow(max(0.,dot(reflect(-L,nrm),-rd)),30.)*.14;
pcol=alb*(.03+1.35*lit)+uHov*fr*(.16+.84*lit)*1.15+vec3(.72,.8,1)*sp*lit-uBg; // -uBg: replaces the sky
}
add=mix(add,pcol,mask);
float o=max(dn-1.,0.);
add+=uHov*(exp(-o*22.)+exp(-o*4.5)*.22)*(1.-mask)*.26*(.18+.82*lit);

// Scrim: attenuates what was added, not the result, so the floor stays exactly --bg-primary.
// A top-right corner mask: horizontal in landscape, vertical in portrait.
float keep=(.06+.94*smoothstep(.33,mix(.62,.88,at),uv.x)*smoothstep(mix(.68,-.2,at),mix(.92,.3,at),uv.y))*(1.-.3*dot(uv-.5,uv-.5));
add*=keep*(1.-uT.y);
gl_FragColor=vec4(clamp(uBg+add+(h12(fc)-.5)*.01,0.,1.),1); // dither: kills banding
}`;

  var FRAME_MS = 1000 / 32; // a background; faster is spent for nothing
  var MAX_PX = 2.6e6;

  var canvas = document.getElementById("space");
  if (!canvas) { initReveal(); return; }

  // From the stylesheet: the scene cannot drift from the tokens.
  function token(name, lit) {
    var h = lit;
    try { h = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); } catch (e) {}
    if (!/^#[0-9a-f]{6}$/i.test(h)) h = lit;
    var v = parseInt(h.slice(1), 16);
    return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
  }

  var OPTS = { alpha: false, antialias: false, depth: false, powerPreference: "low-power" };
  var gl = null;
  try { gl = canvas.getContext("webgl2", OPTS) || canvas.getContext("webgl", OPTS); } catch (e) {}

  // Shipped: preview panes lie about whether a frame happened.
  var diag = (window.__space = { ctx: gl ? (gl.texStorage2D ? 2 : 1) : 0, ok: false, px: null, err: null });

  function bail(why) {
    diag.err = why;
    canvas.style.display = "none"; // the body gradient becomes the background
  }

  if (!gl) { bail("no-context"); initReveal(); return; }

  var prog, uRes, uT, W = 0, H = 0, running = false, rafId = 0, last = 0, acc = 0, t0 = 0;
  // Written by listeners, read only in the frame callback.
  var sy = window.pageYOffset || 0, wantX = 0, wantY = 0, parX = 0, parY = 0, dim = 0, drift = 0;

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);gl.compileShader(s);
    if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) return s;
    console.warn("space.js shader:\n" + gl.getShaderInfoLog(s));
    return null;
  }

  function build() {
    var vs = compile(gl.VERTEX_SHADER, VERT), fs = vs && compile(gl.FRAGMENT_SHADER, FRAG);
    if (!fs) return false;
    prog = gl.createProgram();
    gl.attachShader(prog, vs);gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, "a");gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("space.js link:\n" + gl.getProgramInfoLog(prog));
      return false;
    }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    uRes = gl.getUniformLocation(prog, "uRes");uT = gl.getUniformLocation(prog, "uT");
    var pal = "uBg --bg-primary #05070e uDeep --accent-deep #0e2278 uAcc --accent #1d3fcc uHov --accent-hover #4c74ff".split(" ");
    for (var i = 0; i < 12; i += 3) gl.uniform3fv(gl.getUniformLocation(prog, pal[i]), token(pal[i + 1], pal[i + 2]));
    return true;
  }

  // Capped twice in one min(): by DPR, then by pixel count.
  function layout() {
    W = window.innerWidth || 1;
    H = window.innerHeight || 1;
    var d = Math.min(window.devicePixelRatio || 1, W < 700 ? 1.25 : 1.5, Math.sqrt(MAX_PX / (W * H)));
    canvas.width = Math.max(1, (W * d) | 0);
    canvas.height = Math.max(1, (H * d) | 0);
    canvas.style.width = W + "px";canvas.style.height = H + "px";
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function render(secs) {
    gl.uniform2f(uRes, canvas.width, canvas.height);gl.uniform4f(uT, secs, dim, parX, parY + drift);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function advance() {
    var n = Math.min(1, sy / Math.max(240, H * 0.9));
    dim = n * 0.8;
    drift = -n * 0.11;
    parX += (wantX - parX) * 0.06;parY += (wantY - parY) * 0.06;
  }

  function frame(now) {
    if (!running) return;
    rafId = requestAnimationFrame(frame);
    var dt = now - last;
    last = now;
    if (dt > 250) dt = 250; // a restored tab reports an enormous dt
    acc += dt;
    if (acc < FRAME_MS) return;
    acc = 0;
    advance();
    render((now - t0) / 1000);
  }

  function start() {
    if (running || STATIC) return;
    running = true;
    last = performance.now();
    acc = FRAME_MS;
    rafId = requestAnimationFrame(frame);
  }

  function stop() { running = false; if (rafId) cancelAnimationFrame(rafId); rafId = 0; }

  function on(t, e, fn) { t.addEventListener(e, fn, { passive: true }); }

  function init() {
    if (!build()) { bail("shader"); return false; }
    layout();
    t0 = performance.now();

    // One frame synchronously first: rAF can be deferred; worst case must be a still.
    sy = window.pageYOffset || 0;
    advance();parX = wantX;parY = wantY;
    render(0);

    // Prove it drew: a linked program can show nothing.
    var px = new Uint8Array(4);
    try {
      gl.readPixels((canvas.width * 0.78) | 0, (canvas.height * 0.74) | 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    } catch (e) {}
    diag.px = [px[0], px[1], px[2]];
    if (!(px[0] + px[1] + px[2])) { bail("blank"); return false; }
    diag.ok = true;

    var rt = 0;
    on(window, "resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        layout();
        if (!running) render(STATIC ? 0 : (performance.now() - t0) / 1000);
      }, 150);
    });

    if (STATIC) return true;

    on(window, "scroll", function () { sy = window.pageYOffset || 0; });

    on(window, "pointermove", function (e) {
      wantX = -(e.clientX / W - 0.5) * 0.02;
      wantY = (e.clientY / H - 0.5) * 0.015;
    });
    on(window, "pointerleave", function () { wantX = wantY = 0; });

    on(document, "visibilitychange", function () { if (document.hidden) stop(); else start(); });
    on(canvas, "webglcontextlost", function () { stop(); bail("lost"); });

    start();
    return true;
  }

  try {
    if (!init()) stop();
  } catch (e) {
    stop();
    bail("throw");
  }

  initReveal();
})();
