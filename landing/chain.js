/*
 * The ledger chain behind the page, plus the scroll reveal.
 *
 * Both live in one file so the page costs one script request rather than two. Neither is
 * load-bearing: the canvas is decorative and aria-hidden, and the reveal only ever adds
 * its hidden state after this file has confirmed it can run, so with scripting off the
 * page is complete and fully readable.
 *
 * What it draws: a chain of ledger entries down a vertical spine, each carrying six hex
 * characters, joined by link lines. Scrolling verifies them as you pass — the chain is
 * verifying as you read it — and scroll velocity drives the whole thing from a dim
 * --accent-deep at rest up through --accent to --accent-hover under fast movement.
 * Hovering an entry tampers with it, and the break propagates downstream exactly the way
 * a real hash chain fails: every link after the edited one, none before it.
 */
(function () {
  "use strict";

  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------ *
   * Scroll reveal
   * ------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------ *
   * Canvas chain
   * ------------------------------------------------------------------ */

  var NODE_MIN = 18;
  var NODE_MAX = 24;
  var PARALLAX = 0.35; // chain drifts rather than tracks
  var FRAME_MS = 1000 / 30; // this is a background; 30 fps is plenty
  var VERIFY_LINE = 0.55; // fraction of viewport height
  var FLASH_MS = 450; // green confirmation flash
  var TAMPER_MS = 1400; // break, then heal
  var TAMPER_STEP_MS = 60; // per-link propagation delay
  var TOUCH_TAMPER_MS = 9000; // no hover on touch, so self-trigger
  var ENERGY_HALFLIFE = 200; // ~600 ms to visually reach rest
  var HEX = "0123456789abcdef";

  var canvas = document.getElementById("chain");
  if (!canvas) {
    initReveal();
    return;
  }

  var ctx;
  try {
    ctx = canvas.getContext("2d");
  } catch (e) {
    ctx = null;
  }
  if (!ctx) {
    // Leave the body gradient as the finished background.
    canvas.style.display = "none";
    initReveal();
    return;
  }

  var W = 0,
    H = 0,
    dpr = 1;
  var nodes = [];
  var chainLength = 0;
  var maxScroll = 0;

  // Written by listeners, read only inside the frame callback.
  var pendingScrollY = window.pageYOffset || 0;
  var pointerX = -1,
    pointerY = -1;

  var lastScrollY = pendingScrollY;
  var energy = 0;
  var tamperIndex = -1;
  var tamperStart = 0;
  var lastHoverIndex = -1; // which entry the pointer was over on the previous frame
  var running = false;
  var rafId = 0;
  var lastFrame = 0;
  var accumulator = 0;

  function randHex(n) {
    var s = "";
    for (var i = 0; i < n; i++) s += HEX[(Math.random() * 16) | 0];
    return s;
  }

  function readToken(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function hexToRgb(h) {
    h = (h || "").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return [76, 116, 255];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // Palette is read from the stylesheet rather than duplicated here, so the canvas can
  // never drift from the tokens the rest of the page uses.
  var C_DEEP = hexToRgb(readToken("--accent-deep", "#0e2278"));
  var C_ACCENT = hexToRgb(readToken("--accent", "#1d3fcc"));
  var C_HOVER = hexToRgb(readToken("--accent-hover", "#4c74ff"));
  var C_GREEN = hexToRgb(readToken("--green", "#2bd98a"));
  var C_RED = hexToRgb(readToken("--red", "#ff4d5e"));
  var C_MUTED = hexToRgb(readToken("--text-muted", "#78859f"));

  function mix(a, b, t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t
    ];
  }

  function rgba(c, a) {
    return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + a + ")";
  }

  function layout() {
    W = window.innerWidth;
    H = window.innerHeight;
    // Capped at 2: beyond that the extra pixels cost real time on a phone and buy
    // nothing visible on a background of hairline strokes.
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var docHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body ? document.body.scrollHeight : 0
    );
    maxScroll = Math.max(0, docHeight - H);

    // The chain has to cover the viewport at every scroll position. It travels
    // maxScroll * PARALLAX over the whole page, so it must be that much longer than the
    // viewport itself.
    chainLength = H + maxScroll * PARALLAX;

    var count = Math.max(
      NODE_MIN,
      Math.min(NODE_MAX, Math.round(chainLength / 260))
    );

    var spacing = chainLength / Math.max(1, count - 1);
    var spineX = W < 640 ? W * 0.5 : W * 0.5;
    // A wider drift on desktop, where there is room for it beside the 60rem column.
    var amplitude = W < 640 ? W * 0.26 : Math.min(W * 0.3, 320);

    var existing = nodes;
    nodes = [];
    for (var i = 0; i < count; i++) {
      nodes.push({
        baseY: i * spacing,
        x: spineX + Math.sin(i * 0.72) * amplitude,
        // Hashes survive a resize so the chain does not visibly reshuffle its contents.
        hash: existing[i] ? existing[i].hash : randHex(6),
        trueHash: existing[i] ? existing[i].trueHash : null,
        verified: false,
        flashAt: -1
      });
      if (!nodes[i].trueHash) nodes[i].trueHash = nodes[i].hash;
    }
  }

  function screenY(node, scrollY) {
    return node.baseY - scrollY * PARALLAX;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  var NODE_W = 62;
  var NODE_H = 19;

  function draw(now, scrollY) {
    ctx.clearRect(0, 0, W, H);

    var chainColor = energy < 0.5
      ? mix(C_DEEP, C_ACCENT, energy * 2)
      : mix(C_ACCENT, C_HOVER, (energy - 0.5) * 2);

    var tampering = tamperIndex >= 0 && now - tamperStart < TAMPER_MS;
    var tamperAge = tampering ? now - tamperStart : 0;

    // ---- link lines first, so nodes sit on top of them ----
    ctx.lineCap = "round";
    for (var i = 0; i < nodes.length - 1; i++) {
      var ay = screenY(nodes[i], scrollY);
      var by = screenY(nodes[i + 1], scrollY);
      if ((ay < -80 && by < -80) || (ay > H + 80 && by > H + 80)) continue;

      // A tamper invalidates every link after the edited entry and none before it.
      var downstream = tampering && i >= tamperIndex;
      var reached = downstream && tamperAge > (i - tamperIndex) * TAMPER_STEP_MS;

      if (reached) {
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = rgba(C_RED, 0.72);
        ctx.lineWidth = 1.2;
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = rgba(chainColor, 0.2 + energy * 0.3);
        ctx.lineWidth = 1;
      }

      ctx.beginPath();
      ctx.moveTo(nodes[i].x, ay);
      ctx.lineTo(nodes[i + 1].x, by);
      ctx.stroke();

      // The "glow" under fast scroll is a second wider, fainter stroke rather than
      // shadowBlur, which is far too expensive to run per link at 30 fps on a phone.
      if (energy > 0.25 && !reached) {
        ctx.strokeStyle = rgba(chainColor, (energy - 0.25) * 0.22);
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // ---- nodes ----
    ctx.font = '500 9px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (var j = 0; j < nodes.length; j++) {
      var n = nodes[j];
      var y = screenY(n, scrollY);
      if (y < -60 || y > H + 60) continue;

      var isTampered = tampering && j === tamperIndex;
      var strokeColor;
      var alpha;

      if (isTampered) {
        strokeColor = C_RED;
        alpha = 0.85;
      } else if (n.flashAt >= 0 && now - n.flashAt < FLASH_MS) {
        // Confirmation flash, fading from green into the settled colour.
        var t = (now - n.flashAt) / FLASH_MS;
        strokeColor = mix(C_GREEN, C_HOVER, t);
        alpha = 0.85 - t * 0.3;
      } else if (n.verified) {
        strokeColor = C_HOVER;
        alpha = 0.55;
      } else {
        strokeColor = chainColor;
        // Spec range: 30-45% alpha, brightening with movement.
        alpha = 0.3 + energy * 0.15;
      }

      ctx.strokeStyle = rgba(strokeColor, alpha);
      ctx.lineWidth = 1;
      roundRect(n.x - NODE_W / 2, y - NODE_H / 2, NODE_W, NODE_H, 5);
      ctx.stroke();

      // The chain crosses the reading column on narrow viewports — the page is 60rem
      // wide and there is not enough margin to route around it — so the hex is kept
      // faint enough to read as texture behind the prose rather than as competing text.
      // The tampered entry is the exception: it is meant to catch the eye.
      ctx.fillStyle = isTampered ? rgba(C_RED, 0.95) : rgba(C_MUTED, 0.5);
      ctx.fillText(n.hash, n.x, y + 0.5);
    }
  }

  function tamper(index) {
    if (index < 0 || index >= nodes.length) return;
    tamperIndex = index;
    tamperStart = performance.now();
  }

  function hitTest(scrollY) {
    if (pointerX < 0) return -1;
    for (var i = 0; i < nodes.length; i++) {
      var y = screenY(nodes[i], scrollY);
      if (
        pointerX >= nodes[i].x - NODE_W / 2 &&
        pointerX <= nodes[i].x + NODE_W / 2 &&
        pointerY >= y - NODE_H / 2 &&
        pointerY <= y + NODE_H / 2
      ) {
        return i;
      }
    }
    return -1;
  }

  var lastScrambleAt = 0;

  function frame(now) {
    if (!running) return;
    rafId = requestAnimationFrame(frame);

    var dt = now - lastFrame;
    lastFrame = now;
    // A tab restored after being hidden reports an enormous dt; clamping keeps the
    // energy decay and the accumulator sane.
    if (dt > 250) dt = 250;

    accumulator += dt;
    if (accumulator < FRAME_MS) return;
    accumulator = 0;

    var scrollY = pendingScrollY;

    // Velocity: bumped by movement, decaying exponentially back to rest.
    var delta = Math.abs(scrollY - lastScrollY);
    lastScrollY = scrollY;
    energy = energy * Math.pow(0.5, dt / ENERGY_HALFLIFE);
    energy = Math.min(1, energy + delta / 220);

    // Verification. A node is verified once it has passed the line on its way up, and
    // un-verifies if it comes back down — scrolling up genuinely reverses it.
    var line = H * VERIFY_LINE;
    for (var i = 0; i < nodes.length; i++) {
      var wasVerified = nodes[i].verified;
      var isVerified = screenY(nodes[i], scrollY) < line;
      if (isVerified && !wasVerified) nodes[i].flashAt = now;
      if (!isVerified && wasVerified) nodes[i].flashAt = -1;
      nodes[i].verified = isVerified;
    }

    /*
     * Hover tamper. The canvas is pointer-events: none so it can never intercept a
     * click; hit-testing a pointer position tracked on window is how it stays inert.
     *
     * Triggered on *entering* a node, not on being over one. Firing whenever the pointer
     * is inside the box meant that a cursor left parked on an entry healed and instantly
     * re-broke it, forever — a strobing red node the reader cannot dismiss without moving
     * the mouse. Now the pointer has to leave and come back, or move to a different
     * entry, which is what a hover interaction should mean.
     */
    var hit = hitTest(scrollY);
    if (hit !== lastHoverIndex) {
      if (hit >= 0 && tamperIndex < 0) tamper(hit);
      lastHoverIndex = hit;
    }

    if (tamperIndex >= 0) {
      if (now - tamperStart >= TAMPER_MS) {
        // Heal: the entry goes back to the hash it always had.
        nodes[tamperIndex].hash = nodes[tamperIndex].trueHash;
        tamperIndex = -1;
      } else if (now - lastScrambleAt > 70) {
        nodes[tamperIndex].hash = randHex(6);
        lastScrambleAt = now;
      }
    }

    draw(now, scrollY);
  }

  function start() {
    if (running || REDUCED) return;
    running = true;
    lastFrame = performance.now();
    accumulator = FRAME_MS; // draw immediately rather than waiting a frame
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function staticFrame() {
    var scrollY = window.pageYOffset || 0;
    var line = H * VERIFY_LINE;
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].verified = screenY(nodes[i], scrollY) < line;
      nodes[i].flashAt = -1;
    }
    energy = 0;
    draw(performance.now(), scrollY);
  }

  function init() {
    layout();

    /*
     * Paint one frame synchronously before the loop starts. requestAnimationFrame can be
     * throttled or deferred indefinitely — a background tab at load, a hidden container,
     * a browser that suspends it — and without this the chain is simply absent until the
     * first callback happens to arrive. Drawing once up front means the worst case is a
     * static chain rather than no chain.
     */
    staticFrame();

    if (REDUCED) {
      // The frame above is the only one that will ever be drawn: under this preference
      // the loop is never started. Not a slower animation — none.
      window.addEventListener(
        "resize",
        debounce(function () {
          layout();
          staticFrame();
        }, 150),
        { passive: true }
      );
      return;
    }

    // Stores the value and nothing else. Every measurement and every branch that
    // depends on it happens in the frame callback, so scrolling never reads layout.
    window.addEventListener(
      "scroll",
      function () {
        pendingScrollY = window.pageYOffset || 0;
      },
      { passive: true }
    );

    window.addEventListener(
      "pointermove",
      function (e) {
        pointerX = e.clientX;
        pointerY = e.clientY;
      },
      { passive: true }
    );

    window.addEventListener(
      "pointerleave",
      function () {
        pointerX = -1;
        pointerY = -1;
      },
      { passive: true }
    );

    window.addEventListener(
      "resize",
      debounce(function () {
        layout();
        if (!running) staticFrame();
      }, 150),
      { passive: true }
    );

    // A background animation in a tab nobody is looking at is pure battery cost.
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop();
      else start();
    });

    // Touch devices have no hover, so the break-and-heal has to introduce itself.
    var noHover = window.matchMedia && window.matchMedia("(hover: none)").matches;
    if (noHover) {
      setInterval(function () {
        if (!running || tamperIndex >= 0 || !nodes.length) return;
        var scrollY = pendingScrollY;
        var visible = [];
        for (var i = 0; i < nodes.length; i++) {
          var y = screenY(nodes[i], scrollY);
          if (y > 40 && y < H - 40) visible.push(i);
        }
        if (visible.length) tamper(visible[(Math.random() * visible.length) | 0]);
      }, TOUCH_TAMPER_MS);
    }

    start();

    // The hex is drawn in JetBrains Mono, which may not have arrived yet at first paint.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (!running) staticFrame();
      });
    }
  }

  function debounce(fn, ms) {
    var t = 0;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  try {
    init();
  } catch (e) {
    // Anything unexpected and the canvas simply is not there. The body gradient is a
    // finished background on its own, which is the whole reason it exists.
    stop();
    canvas.style.display = "none";
  }

  initReveal();
})();
