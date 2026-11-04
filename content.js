(() => {
  if (window.__shapeoverLoaded) return;
  window.__shapeoverLoaded = true;

  const storeKey = `shapeover:${location.origin}`;
  const host = document.createElement('div');
  host.id = 'shapeover-extension-root';
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
  (document.documentElement || document.body).append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host{all:initial;font-family:Inter,"Segoe UI",Arial,sans-serif;color:#202721}*{box-sizing:border-box}
      #paint{position:fixed;inset:0;width:100%;height:100%;pointer-events:none}
      #capture{position:fixed;inset:0;pointer-events:none;touch-action:none;cursor:crosshair}
      #capture.active{pointer-events:auto}
      #bar{position:fixed;top:16px;left:50%;transform:translateX(-50%);display:none;align-items:center;gap:8px;padding:9px 11px;background:#fff;border:1px solid #e2e8df;border-radius:16px;box-shadow:0 12px 40px #15251d30;pointer-events:auto;white-space:nowrap;font:12px Inter,"Segoe UI",Arial,sans-serif;z-index:3}
      #bar.open{display:flex}button,select,label{font:600 12px Inter,"Segoe UI",Arial,sans-serif}button{height:34px;border:1px solid #e5e9e2;border-radius:10px;background:#fff;color:#303832;padding:0 11px;cursor:pointer}button:hover{background:#f3f6ef}button:focus-visible,select:focus-visible,label:focus-visible,input:focus-visible{outline:3px solid #b8d568;outline-offset:2px}
      button.tool{width:36px;padding:0;font-size:15px}button.tool.selected{background:#eaf1df;border-color:#9db779;color:#285b42}.placement{height:30px;padding:0 8px;font-size:10px}.placement.selected{background:#eaf1df;border-color:#9db779;color:#285b42}button.done{background:#235b46;border-color:#235b46;color:white;padding:0 15px}button.done:hover{background:#194733}button.remove{color:#956253}
      .divider{height:25px;width:1px;background:#e7ebe4;margin:0 1px}.group{display:flex;align-items:center;gap:5px}.label{font-size:10px;color:#758076;font-weight:700;letter-spacing:.45px}.color{width:31px;height:31px;border:0;padding:2px;background:transparent;border-radius:8px}.range{width:66px;accent-color:#477b50}.upload{display:flex;align-items:center;justify-content:center;height:34px;border:1px solid #e5e9e2;border-radius:10px;padding:0 10px;cursor:pointer;color:#364239}.upload:hover{background:#f3f6ef}.upload input{display:none}.thumb{width:20px;height:20px;object-fit:cover;border-radius:5px;margin-right:6px}.help{position:fixed;top:67px;left:50%;transform:translateX(-50%);padding:7px 11px;border-radius:9px;background:#17251e;color:white;font:11px Inter,"Segoe UI",Arial,sans-serif;box-shadow:0 4px 16px #17251e30;display:none;pointer-events:none}.help.show{display:block}.toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:#17251e;color:white;border-radius:10px;padding:9px 14px;font:12px Inter,"Segoe UI",Arial,sans-serif;display:none;pointer-events:none}.toast.show{display:block}
      @media(max-width:740px){#bar{top:8px;max-width:calc(100vw - 12px);gap:5px;padding:7px;overflow-x:auto}button{padding:0 8px}.label{display:none}.range{width:45px}}
    </style>
    <canvas id="paint"></canvas><div id="capture" aria-label="Draw a cover over page content"></div>
    <div id="bar" role="toolbar" aria-label="Shapeover drawing tools">
      <span class="group" aria-label="Shape tools">
        <button class="tool selected" data-kind="freehand" title="Freehand draw" aria-label="Freehand draw">〰</button>
        <button class="tool" data-kind="rectangle" title="Rectangle" aria-label="Rectangle">▭</button>
        <button class="tool" data-kind="ellipse" title="Oval" aria-label="Oval">◯</button>
        <button class="tool" data-kind="polygon" title="Polygon: click points, press Enter to finish" aria-label="Polygon">⬡</button>
      </span>
      <span class="divider"></span>
      <span class="group" aria-label="Cover placement"><button class="placement selected" data-stick="false" aria-pressed="true" title="Moves with page content while scrolling">On page</button><button class="placement" data-stick="true" aria-pressed="false" title="Stays fixed while scrolling and keeps its distance from the right edge">Stick</button></span>
      <span class="divider"></span>
      <span class="group"><span class="label">COLOR</span><input class="color" id="color" type="color" value="#b8d85b" aria-label="Cover color"></span>
      <span class="group"><span class="label">FADE</span><input class="range" id="opacity" type="range" min="20" max="100" value="100" aria-label="Cover opacity"></span>
      <label class="upload" title="Choose an image to use as a fill">▧<span id="image-label">&nbsp;Image</span><input id="image" type="file" accept="image/*"></label>
      <span class="divider"></span>
      <button id="undo" title="Remove the last cover">Undo</button><button id="clear" class="remove" title="Remove all covers on this site">Clear</button>
      <button id="done" class="done">Done</button>
    </div>
    <div id="help" class="help">Drag to draw · click points, then Enter, for a polygon · Esc to finish</div>
    <div id="toast" class="toast" role="status"></div>`;

  const canvas = shadow.querySelector('#paint');
  const ctx = canvas.getContext('2d');
  const capture = shadow.querySelector('#capture');
  const bar = shadow.querySelector('#bar');
  const help = shadow.querySelector('#help');
  const toast = shadow.querySelector('#toast');
  const tools = [...shadow.querySelectorAll('[data-kind]')];
  const colorInput = shadow.querySelector('#color');
  const opacityInput = shadow.querySelector('#opacity');
  let data = { shapes: [], assets: {} };
  let mode = 'freehand';
  let newStick = false;
  let current = null;
  let editing = false;
  let dpr = 1;
  const imageCache = new Map();

  function getScroll() { return { x: window.scrollX || document.documentElement.scrollLeft, y: window.scrollY || document.documentElement.scrollTop }; }
  function resizeCanvas() {
    dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    redraw();
  }
  function viewportPoints(points, sticky, rightOffset, scroll) {
    if (sticky) return points.map(p => ({ x: innerWidth - rightOffset + p.x, y: p.y }));
    return points.map(p => ({ x: p.x - scroll.x, y: p.y - scroll.y }));
  }
  function pointsPath(points) {
    const path = new Path2D();
    if (!points.length) return path;
    path.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) path.lineTo(points[i].x, points[i].y);
    path.closePath();
    return path;
  }
  function shapePath(shape, scroll) {
    return pointsPath(viewportPoints(shape.points, !!shape.stick, shape.rightOffset || 0, scroll));
  }
  function bounds(points) {
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(1, Math.max(...xs) - Math.min(...xs)), h: Math.max(1, Math.max(...ys) - Math.min(...ys)) };
  }
  function coverPoints(start, end, kind) {
    if (kind === 'rectangle') return [start, { x: end.x, y: start.y }, end, { x: start.x, y: end.y }];
    if (kind === 'ellipse') {
      const cx = (start.x + end.x) / 2, cy = (start.y + end.y) / 2;
      const rx = Math.max(1, Math.abs(end.x - start.x) / 2), ry = Math.max(1, Math.abs(end.y - start.y) / 2);
      return Array.from({ length: 48 }, (_, i) => ({ x: cx + rx * Math.cos(i * Math.PI * 2 / 48), y: cy + ry * Math.sin(i * Math.PI * 2 / 48) }));
    }
    return [];
  }
  function drawShape(shape, scroll) {
    if (!shape.points?.length || shape.points.length < 2) return;
    const visiblePoints = viewportPoints(shape.points, !!shape.stick, shape.rightOffset || 0, scroll);
    const path = pointsPath(visiblePoints);
    ctx.save();
    ctx.globalAlpha = (shape.opacity ?? 100) / 100;
    const asset = shape.assetId && data.assets[shape.assetId];
    if (asset) {
      let img = imageCache.get(shape.assetId);
      if (!img) {
        img = new Image();
        img.onload = redraw;
        img.src = asset;
        imageCache.set(shape.assetId, img);
      }
      ctx.clip(path);
      if (img.complete && img.naturalWidth) {
        const b = bounds(visiblePoints);
        const x = b.x, y = b.y;
        const scale = Math.max(b.w / img.naturalWidth, b.h / img.naturalHeight);
        const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
        ctx.drawImage(img, x + (b.w - w) / 2, y + (b.h - h) / 2, w, h);
      } else {
        ctx.fillStyle = shape.color;
        ctx.fillRect(0, 0, innerWidth, innerHeight);
      }
    } else {
      ctx.fillStyle = shape.color || '#b8d85b';
      ctx.fill(path);
    }
    ctx.restore();
  }
  function redraw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const scroll = getScroll();
    for (const shape of data.shapes) drawShape(shape, scroll);
    if (current?.points?.length > 1) {
      ctx.save(); ctx.globalAlpha = .72; ctx.fillStyle = colorInput.value;
      const previewPoints = current.stick ? current.points : viewportPoints(current.points, false, 0, scroll);
      ctx.fill(pointsPath(previewPoints)); ctx.restore();
    }
  }
  function save() { return chrome.storage.local.set({ [storeKey]: data }); }
  function showToast(text) {
    toast.textContent = text; toast.classList.add('show');
    clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 1800);
  }
  function setMode(next) {
    mode = next;
    tools.forEach(tool => tool.classList.toggle('selected', tool.dataset.kind === mode));
    help.textContent = mode === 'polygon' ? 'Click to add points · Enter or double click to finish · Esc to cancel' : (newStick ? 'Drag to draw · This cover stays on screen while scrolling' : 'Drag to draw · This cover follows the page while scrolling');
    if (mode !== 'polygon') current = null;
    redraw();
  }
  function openEditor() {
    editing = true; bar.classList.add('open'); capture.classList.add('active'); help.classList.add('show');
    setMode(mode); window.addEventListener('keydown', onKey, true); redraw();
  }
  function closeEditor() {
    editing = false; bar.classList.remove('open'); capture.classList.remove('active'); help.classList.remove('show'); current = null;
    window.removeEventListener('keydown', onKey, true); redraw();
  }
  async function finishShape(points) {
    const sticky = current?.stick ?? newStick;
    if (!points || points.length < 3) { current = null; redraw(); return; }
    let storedPoints = points;
    let rightOffset = 0;
    if (sticky) {
      const right = Math.max(...points.map(p => p.x));
      rightOffset = Math.max(0, innerWidth - right);
      storedPoints = points.map(p => ({ x: p.x - right, y: p.y }));
    }
    const shape = { id: crypto.randomUUID(), kind: mode, points: storedPoints, color: colorInput.value, opacity: Number(opacityInput.value), stick: sticky, rightOffset };
    if (data.selectedAsset && data.assets[data.selectedAsset]) shape.assetId = data.selectedAsset;
    data.shapes.push(shape); current = null; redraw(); await save();
    showToast('Cover saved for this website');
  }
  function clientPoint(event) { const s = getScroll(); return newStick ? { x: event.clientX, y: event.clientY } : { x: event.clientX + s.x, y: event.clientY + s.y }; }
  function onPointerDown(event) {
    if (!editing || event.button !== 0 || event.target !== capture) return;
    event.preventDefault();
    if (mode === 'polygon') {
      const point = clientPoint(event);
      if (current) current.points.push(point); else current = { kind: mode, points: [point], stick: newStick };
      redraw();
      if (event.detail > 1) finishPolygon();
      return;
    }
    current = { kind: mode, points: [clientPoint(event)], stick: newStick };
    capture.setPointerCapture(event.pointerId); redraw();
  }
  function onPointerMove(event) {
    if (!current || mode === 'polygon') return;
    const point = clientPoint(event);
    if (mode === 'freehand') current.points.push(point);
    else current.points = coverPoints(current.points[0], point, mode);
    redraw();
  }
  async function onPointerUp() {
    if (!current || mode === 'polygon') return;
    const points = current.points;
    await finishShape(points);
  }
  async function finishPolygon() {
    if (!current || current.points.length < 3) { current = null; redraw(); return; }
    const points = current.points; await finishShape(points);
  }
  function onKey(event) {
    if (!editing) return;
    if (event.key === 'Escape') {
      if (mode === 'polygon' && current) { current = null; redraw(); }
      else closeEditor();
      event.stopPropagation(); event.preventDefault();
    }
    if (event.key === 'Enter' && mode === 'polygon') { finishPolygon(); event.stopPropagation(); event.preventDefault(); }
  }

  tools.forEach(tool => tool.addEventListener('click', () => setMode(tool.dataset.kind)));

  shadow.querySelectorAll('[data-stick]').forEach(button => button.addEventListener('click', () => {
    newStick = button.dataset.stick === 'true';
    current = null;
    shadow.querySelectorAll('[data-stick]').forEach(option => {
      const selected = option === button;
      option.classList.toggle('selected', selected);
      option.setAttribute('aria-pressed', String(selected));
    });
    setMode(mode);
  }));

  capture.addEventListener('pointerdown', onPointerDown);
  capture.addEventListener('pointermove', onPointerMove);
  capture.addEventListener('pointerup', onPointerUp);
  capture.addEventListener('pointercancel', onPointerUp);
  shadow.querySelector('#done').addEventListener('click', closeEditor);
  shadow.querySelector('#undo').addEventListener('click', async () => { data.shapes.pop(); await save(); redraw(); showToast('Last cover removed'); });
  shadow.querySelector('#clear').addEventListener('click', async () => {
    if (!data.shapes.length) return showToast('No covers to clear');
    if (!window.confirm('Remove every Shapeover cover from this website?')) return;
    data.shapes = []; data.assets = {}; data.selectedAsset = null; await save(); redraw(); showToast('This website is clear');
    shadow.querySelector('#image-label').textContent = '\u00a0Image';
  });
  colorInput.addEventListener('input', redraw);
  opacityInput.addEventListener('input', redraw);
  shadow.querySelector('#image').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith('image/')) return showToast('Choose an image file');
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const output = document.createElement('canvas'); output.width = Math.round(bitmap.width * scale); output.height = Math.round(bitmap.height * scale);
      output.getContext('2d').drawImage(bitmap, 0, 0, output.width, output.height); bitmap.close();
      const dataUrl = output.toDataURL('image/jpeg', .86);
      const id = crypto.randomUUID(); data.assets[id] = dataUrl; data.selectedAsset = id; await save();
      shadow.querySelector('#image-label').textContent = '\u00a0Image ready'; showToast('Image fill ready for your next shape');
    } catch { showToast('That image could not be loaded'); }
    event.target.value = '';
  });

  chrome.runtime.onMessage.addListener(message => { if (message?.type === 'SHAPEOVER_OPEN') openEditor(); });
  window.addEventListener('scroll', redraw, { passive: true });
  window.addEventListener('resize', resizeCanvas, { passive: true });
  chrome.storage.local.get(storeKey).then(result => {
    data = result[storeKey] || { shapes: [], assets: {} };
    if (!data.assets) data.assets = {};
    resizeCanvas();
  });
})();
