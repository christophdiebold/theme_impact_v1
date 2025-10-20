(function(){
  // ---------- STATE ----------
  var STATE = {
    collectedPrompt: "",
    generating: false,
    baseImage: null,   // { id, url, seed }
    lastPreview: null, // { id, url, seed, aspect, variant }
    variant: null
  };

  // AbortController für laufende Generierung (zum harten Abbrechen bei Neustart)
  var CURRENT_GEN_ABORT = null;


  // Deine öffentliche Worker-URL als Fallback (anpassbar)
  var WA_DEFAULT_WORKER = "";

var WA_FIXED = (window.WA_FIXED || { generateURL: null }); window.WA_FIXED = WA_FIXED;

  
var WORKER_BASE = ((window.WALLART_WORKER_ORIGIN || WA_DEFAULT_WORKER || '') + '').replace(/\/+$/,'');
// ---------- CSS ----------
  function injectCSS(){
    if (document.getElementById('wallart-css')) return;
    var css = [
      '.wallart-overlay{position:fixed;inset:0;background:rgba(0,0,0,.42);display:none;z-index:9999}',
      '.wallart-overlay.is-open{display:block}',

      '.wallart-drawer{position:absolute;right:0;top:0;height:100%;width:min(520px,34vw);max-width:100%;background:#fff;display:flex;flex-direction:column;box-shadow:-2px 0 20px rgba(0,0,0,.2)}',
      '@media (max-width: 990px){.wallart-drawer{width:100%}}',

      '.wallart-header{display:flex;align-items:center;gap:8px;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(0,0,0,.08);font-weight:600}',
      '.wallart-header .spacer{flex:1}',
      '.wallart-reset{background:#fff;border:1px solid rgba(0,0,0,.15);border-radius:999px;padding:6px 10px;cursor:pointer;font-size:13px}',
      '.wallart-close{background:transparent;border:0;cursor:pointer;font-size:14px}',

      '.wallart-body{flex:1;min-height:0;display:flex;flex-direction:column;gap:12px;overflow:hidden;padding:12px}',

      /* PREVIEW-PANE: fixe Höhe (Referenz Querformat), plus Loader-Overlay */
      '.wallart-previews{position:relative;height:var(--wa-preview-h, 300px);overflow:hidden;border:1px solid rgba(0,0,0,.08);border-radius:12px;background:#fafafa}',

      /* Card füllt die Pane, mit sichtbaren Actions (Grid: 1fr auto) */
      '.wallart-card{display:grid;grid-template-rows:minmax(0,1fr) auto;height:100%}',
      '.wallart-card img{width:100%;height:100%;object-fit:contain;object-position:center center;display:block;border:0;border-bottom:1px solid rgba(0,0,0,.06);cursor:zoom-in}',
      '.wallart-card__actions{display:flex;gap:8px;justify-content:flex-end;padding:10px;background:#fff;position:relative;z-index:1}',

      /* Preview-Loader */
      '.wa-pv-loader{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(255,255,255,.65);backdrop-filter:saturate(120%) blur(1px);z-index:2}',
      '.wa-pv-loader .wallart-spin{width:24px;height:24px;border-width:3px}',
      '.wa-pv-empty{position:relative;display:flex;align-items:center;justify-content:center;min-height:220px;border-radius:12px;background:linear-gradient(180deg,rgba(232, 255, 169, 0.03),rgba(0,0,0,.01));color:rgba(0,0,0,.55)}',
      '.wa-pv-empty svg{width:28px;height:28px;opacity:.55}',
      '.wa-pv-empty img{max-width:56%;height:auto;opacity:.8;filter:grayscale(100%) contrast(1.06)}',

      '.wa-progress{width:min(420px,76%);margin-top:12px}',
      '.wa-progress__track{height:6px;background:rgba(0,0,0,.12);border-radius:999px;overflow:hidden}',
      '.wa-progress__bar{height:100%;width:0%;background:#111;transition:width .3s ease}',
      '.wa-progress__label{margin-top:6px;font-size:12px;opacity:.8;text-align:center}',
      '.wa-pv-loader{flex-direction:column}',

      '.wallart-btn{border:1px solid rgba(0,0,0,.15);background:#fff;border-radius:999px;padding:8px 14px;cursor:pointer}',
      '.wallart-btn.primary{background:#111;color:#fff;border-color:#111}',

      '.wallart-messages{flex:1;overflow:auto;display:flex;flex-direction:column;gap:8px;font-size:14px;line-height:1.45}',
      '.wallart-msg{max-width:90%;padding:8px 10px;border-radius:10px;background:#f4f4f5}',
      '.wallart-msg.user{align-self:flex-end;color:#fff;background:#27695e}',

      '.wallart-composer{display:flex;gap:8px;padding:10px 12px;border-top:1px solid rgba(0,0,0,.08)}',
      '.wallart-composer input[type="text"]{flex:1;border:1px solid rgba(0,0,0,.16);border-radius:999px;padding:10px 14px;outline:none;min-width:0}',
      '.wallart-composer button{border:0;border-radius:999px;padding:10px 14px;cursor:pointer;background:#111;color:#fff}',

      '.wa-quota{margin:-6px 12px 0 12px;font-size:12px;opacity:.7;text-align:right}',

      '.wallart-suggestions{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}',
      '.wallart-suggestion{display:inline-block;border:1px solid rgba(0,0,0,.15);padding:7px 11px;border-radius:999px;color:#fff;background:rgba(0,0,0,1);cursor:pointer;font-size:13px}',

      /* Loader (Chat) */
      '.wallart-loader{display:flex;align-items:center;gap:8px;opacity:.85}',
      '.wallart-spin{width:16px;height:16px;border:2px solid rgba(0,0,0,.2);border-top-color:#111;border-radius:50%;animation:wallart-spin 1s linear infinite}',
      '@keyframes wallart-spin{to{transform:rotate(360deg)}}',

      /* Confirm Modal */
      '.wallart-confirm{position:fixed;inset:0;background:rgba(0,0,0,.35);display:none;align-items:center;justify-content:center;z-index:10000}',
      '.wallart-confirm.is-open{display:flex}',
      '.wallart-confirm__box{background:#fff;width:calc(100% - 32px);max-width:420px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);padding:16px}',
      '.wallart-confirm__title{font-weight:600;margin-bottom:6px}',
      '.wallart-confirm__text{opacity:.8;font-size:14px}',
      '.wallart-confirm__actions{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}',

      /* Image Modal (Zoom) */
      '.wallart-imgmodal{position:fixed;inset:0;background:rgba(0,0,0,.65);display:none;align-items:center;justify-content:center;z-index:10001}',
      '.wallart-imgmodal.is-open{display:flex}',
      '.wallart-imgmodal img{max-width:92vw;max-height:92vh;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.5)}',
      '.wallart-imgmodal .close{position:absolute;top:12px;right:12px;background:#fff;border:0;border-radius:999px;padding:8px 10px;cursor:pointer}',

      'html.wallart-no-scroll,body.wallart-no-scroll{overflow:hidden !important}'
    ].join('');
    var s = document.createElement('style');
    s.id = 'wallart-css';
    s.appendChild(document.createTextNode(css));
    document.head.appendChild(s);
  }

  // ---------- UI ----------
  var overlay, drawer, closeBtn, resetBtn, bodyEl, previewsEl, messagesEl, composerEl, inputEl, quotaEl, sendBtn, activeBeforeOpen;
  var confirmEl, confirmCancelBtn, confirmDoBtn;
  var imgModalEl, imgModalImg, imgModalClose;

  function ensurePreviewPlaceholder(){
      if (!previewsEl) return null;
      var ph = previewsEl.querySelector('.wa-pv-empty');
      if (!ph){
        ph = document.createElement('div');
        ph.className = 'wa-pv-empty';
        ph.innerHTML =
        '<img src="https://cdn.shopify.com/s/files/1/0933/8342/6423/files/danilidou.png?v=1754924704" ' +
        'alt="Danilidou" loading="lazy" decoding="async">';
        previewsEl.appendChild(ph);
      }
      return ph;
  }

  function buildUI(){
    if (overlay) return;
    injectCSS();

    // Overlay + Drawer
    overlay = document.createElement('div');
    overlay.className = 'wallart-overlay';
    overlay.innerHTML = [
      '<div class="wallart-drawer" role="dialog" aria-modal="true" aria-label="Wandbild-Designer">',
        '<div class="wallart-header">',
          '<div>Wandbild-Designer</div>',
          '<div class="spacer"></div>',
          '<button class="wallart-reset" type="button" aria-label="Chat zurücksetzen">Reset</button>',
          '<button class="wallart-close" aria-label="schließen">Schließen</button>',
        '</div>',
        '<div class="wallart-body">',
          '<div class="wallart-previews" id="wallart-previews"></div>',
          '<div class="wallart-messages" id="wallart-messages"></div>',
        '</div>',
        '<div class="wallart-composer">',
          '<input id="wallart-input" type="text" placeholder="Beschreibe dein Motiv …" autocomplete="off" />',
          '<button id="wallart-send" type="button">Senden</button>',
        '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(overlay);

    // Confirm Modal
    confirmEl = document.createElement('div');
    confirmEl.className = 'wallart-confirm';
    confirmEl.setAttribute('role','dialog');
    confirmEl.setAttribute('aria-modal','true');
    confirmEl.innerHTML = [
      '<div class="wallart-confirm__box" role="document">',
        '<div class="wallart-confirm__title">Chat wirklich zurücksetzen?</div>',
        '<div class="wallart-confirm__text">Deine bisherige Beschreibung geht verloren. Dies kann nicht rückgängig gemacht werden.</div>',
        '<div class="wallart-confirm__actions">',
          '<button type="button" class="wallart-btn wallart-cancel">Abbrechen</button>',
          '<button type="button" class="wallart-btn primary wallart-do">Zurücksetzen</button>',
        '</div>',
      '</div>'
    ].join('');
    overlay.appendChild(confirmEl);

    // Image Modal (Zoom)
    imgModalEl = document.createElement('div');
    imgModalEl.className = 'wallart-imgmodal';
    imgModalEl.innerHTML = '<button class="close" aria-label="schließen">×</button><img alt="Vorschau groß" />';
    document.body.appendChild(imgModalEl);
    imgModalImg = imgModalEl.querySelector('img');
    imgModalClose = imgModalEl.querySelector('.close');

    // Refs
    drawer     = overlay.firstElementChild;
    closeBtn   = overlay.querySelector('.wallart-close');
    resetBtn   = overlay.querySelector('.wallart-reset');
    bodyEl     = overlay.querySelector('.wallart-body');
    previewsEl = overlay.querySelector('#wallart-previews');
    messagesEl = overlay.querySelector('#wallart-messages');
    composerEl = overlay.querySelector('.wallart-composer');
    inputEl    = overlay.querySelector('#wallart-input');
    sendBtn    = overlay.querySelector('#wallart-send');
    updateQuotaUI(true); // Anzeige + ggf. Sperre direkt setzen

    confirmCancelBtn = confirmEl.querySelector('.wallart-cancel');
    confirmDoBtn     = confirmEl.querySelector('.wallart-do');

    // Loader-Element in der Preview-Pane
    ensurePreviewLoader();

    // Loader-Element in der Preview-Pane
    ensurePreviewLoader();
    // Placeholder sicherstellen
    ensurePreviewPlaceholder();


    // Events — Drawer/Confirm
    overlay.addEventListener('click', function(e){ if (e.target === overlay) close(); });
    closeBtn.addEventListener('click', close);

    resetBtn.addEventListener('click', openConfirmReset);
    confirmCancelBtn.addEventListener('click', closeConfirmReset);
    confirmDoBtn.addEventListener('click', function(){ closeConfirmReset(); resetChat(); });
    confirmEl.addEventListener('click', function(e){ if (e.target === confirmEl) closeConfirmReset(); });

    // Image Modal Events
    imgModalClose.addEventListener('click', closeImgModal);
    imgModalEl.addEventListener('click', function(e){ if (e.target === imgModalEl) closeImgModal(); });

    document.addEventListener('keydown', function(e){
      if (!overlay.classList.contains('is-open')) return;
      // ESC für Modals
      if (e.key === 'Escape'){
        if (isConfirmOpen()){ e.preventDefault(); closeConfirmReset(); return; }
        if (isImgModalOpen()){ e.preventDefault(); closeImgModal(); return; }
        close();
      }
    });

    // Composer
    sendBtn.addEventListener('click', function(){ handleSendText(inputEl.value); });
    inputEl.addEventListener('keydown', function(e){
      if (e.key === 'Enter' && !e.shiftKey){
        e.preventDefault();
        handleSendText(inputEl.value);
      }
    });

    // Live-Update bei Variantenwechsel
    window.addEventListener('wallart:variant-change', function(){
      renderGreeting();
      updatePreviewHeight(); // Höhe nach Variantenänderung neu berechnen
    });

    // Quick-Reply Delegation (Chip: "Generiere das Bild")
    messagesEl.addEventListener('click', function (e) {
      var chip = e.target && e.target.closest && e.target.closest('.wallart-suggestion');
      if (!chip) return;

      var intent = chip.getAttribute('data-intent');
      var val = chip.getAttribute('data-value') || chip.textContent || '';
      if (getRemaining() <= 0){ enforceQuota(); return; }
      if (intent === 'generate' || isGenerateIntent(val)) {
        e.preventDefault && e.preventDefault();
        onGenerateIntent();
      } else {
        handleSendText(val);
      }
    });
  }

  // ---------- Confirm Modal helpers ----------
  function isConfirmOpen(){ return confirmEl && confirmEl.classList.contains('is-open'); }
  function openConfirmReset(){ if (confirmEl){ confirmEl.classList.add('is-open'); try{ confirmDoBtn && confirmDoBtn.focus({preventScroll:true}); }catch(_){}} }
  function closeConfirmReset(){ if (confirmEl){ confirmEl.classList.remove('is-open'); try{ resetBtn && resetBtn.focus({preventScroll:true}); }catch(_){}} }

  // ---------- Image Modal helpers ----------

  function safeImgURL(value) {
    if (!value || typeof value !== 'string') return null;
    var v = ('' + value).trim();
    // Bereits absolut oder data:
    if (/^https?:\/\//i.test(v) || /^data:image\//i.test(v)) return v;
    // Relativ vom Worker (z. B. "/api/file/previews%2F...")
    if (v[0] === '/') return waWorker(v);
    // Fallback: gegen Worker-Origin auflösen
    try { return new URL(v, waWorker('/')).href; } catch { return null; }
  }


  function isImgModalOpen(){ return imgModalEl && imgModalEl.classList.contains('is-open'); }
  function openImgModal(src){
    if (!imgModalEl || !src) return;
    // revoke old object URL if any
    if (imgModalImg?.dataset?.objectUrl) {
      try { URL.revokeObjectURL(imgModalImg.dataset.objectUrl); } catch(e){}
      delete imgModalImg.dataset.objectUrl;
    }
    // try normal load first; if it fails, try blob fallback to dodge CORS/CDN referrer issues
    imgModalImg.onerror = async (ev) => {
      try {
        console.warn('[wallart] Preview image failed to load, trying blob fallback', { src });
        const resp = await fetch(src, { mode: 'cors' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const objUrl = URL.createObjectURL(blob);
        imgModalImg.dataset.objectUrl = objUrl;
        imgModalImg.onerror = null;
        imgModalImg.src = objUrl;
      } catch (err) {
        console.error('[wallart] Fallback load failed', err);
        try { window.__wallart && window.__wallart.pushMsg('Bild-Vorschau konnte nicht geladen werden. Öffne das Bild in neuem Tab…'); } catch(e){}
        try { window.open(src, '_blank', 'noopener'); } catch(e){}
      }
    };
    imgModalImg.src = src;
    imgModalEl.classList.add('is-open');
  }
  function closeImgModal() {
    if (!imgModalEl) return;
    if (imgModalImg?.dataset?.objectUrl) {
      try { URL.revokeObjectURL(imgModalImg.dataset.objectUrl); } catch(e){}
      delete imgModalImg.dataset.objectUrl;
    }
    imgModalEl.classList.remove('is-open');
    imgModalImg.src = '';
  }

  function open(){
    buildUI();
    activeBeforeOpen = document.activeElement;
    document.documentElement.classList.add('wallart-no-scroll');
    document.body.classList.add('wallart-no-scroll');
    overlay.classList.add('is-open');
    try { (closeBtn || drawer).focus({preventScroll:true}); } catch(_){}
    renderGreeting();
    updatePreviewHeight(); // beim Öffnen festlegen
  }
  function close(){
    if (!overlay) return;
    overlay.classList.remove('is-open');
    document.documentElement.classList.remove('wallart-no-scroll');
    document.body.classList.remove('wallart-no-scroll');
    try{ activeBeforeOpen && activeBeforeOpen.focus({preventScroll:true}); }catch(_){}
  }

  // ---------- PREVIEW-HÖHE festlegen (Querformat als Referenz: 3:2) ----------
  function updatePreviewHeight(){
    if (!previewsEl) return;
    var w = previewsEl.clientWidth || 0;
    var h = Math.round(w * (2/3)); // Querformat-Höhe
    document.documentElement.style.setProperty('--wa-preview-h', h + 'px');
  }
  // Resize (debounced)
  var _rszTO=null;
  window.addEventListener('resize', function(){
    clearTimeout(_rszTO);
    _rszTO = setTimeout(updatePreviewHeight, 100);
  });

  // ---------- Reset ----------
  function resetChat(){
    STATE.collectedPrompt = "";
    STATE.generating = false;
    STATE.baseImage = null;
    STATE.lastPreview = null;
    if (previewsEl) { previewsEl.innerHTML = ''; ensurePreviewLoader(); }
    ensurePreviewPlaceholder();
    if (messagesEl) messagesEl.innerHTML = '';
    if (inputEl) inputEl.value = '';
    renderGreeting();
    updatePreviewHeight();
    updateQuotaUI(true); // Anzeige aktualisieren + Sperre beibehalten
  }

  // ---------- Mini-Chat ----------

  // ---------- Daily Quota (15 pro Tag, Reset um Mitternacht) ----------
  var WA_DAILY_LIMIT = 15;
  function _todayKey(){
    // YYYY-MM-DD im lokalen TZ (Shop-Kunden-TZ)
    var d = new Date();
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth()+1).padStart(2,'0');
    var dd = String(d.getDate()).padStart(2,'0');
    return yyyy + '-' + mm + '-' + dd;
  }
  function _readQuota(){
    try{
      var raw = localStorage.getItem('wa_daily_quota');
      var obj = raw ? JSON.parse(raw) : null;
      var today = _todayKey();
      if (!obj || obj.date !== today){ return { date: today, count: 0 }; }
      return obj;
    }catch(_){ return { date:_todayKey(), count:0 }; }
  }
  function _writeQuota(q){
    try{ localStorage.setItem('wa_daily_quota', JSON.stringify(q)); }catch(_){}
  }
  function getRemaining(){
    var q = _readQuota();
    var left = Math.max(0, WA_DAILY_LIMIT - (q.count||0));
    return left;
  }
  function incQuota(){
    var q = _readQuota();
    q.count = (q.count||0) + 1;
    _writeQuota(q);
    updateQuotaUI(true);
  }
  function updateQuotaUI(enforce){
    var left = getRemaining();
    if (!quotaEl){
      quotaEl = document.createElement('div');
      quotaEl.className = 'wa-quota';
      // vor die Composer-Leiste setzen
      if (composerEl && composerEl.parentNode){
        composerEl.parentNode.insertBefore(quotaEl, composerEl);
      }
    }
    quotaEl.textContent = 'Heute verbleibend: ' + left + ' / ' + WA_DAILY_LIMIT;
    if (enforce) enforceQuota();
  }
  function enforceQuota(){
    var left = getRemaining();
    var block = (left <= 0);
    // Eingabe komplett sperren
    if (inputEl) { inputEl.disabled = block; inputEl.placeholder = block ? 'Tageslimit erreicht – Morgen kannst du wieder Bilder erstellen.' : 'Beschreibe dein Motiv …'; }
    if (sendBtn) { sendBtn.disabled = block; }
    // Optional: Hinweis im Chat (nur einmalig bei Sperre)
    if (block) {
      try {
        var lastFlag = sessionStorage.getItem('wa_limit_notice');
        if (!lastFlag){
          pushMsg('ai', 'Du hast dein Tageslimit (15 Bilder) erreicht. Morgen füllt sich dein Tageslimit automatisch wieder auf.');
          sessionStorage.setItem('wa_limit_notice', '1');
        }
      } catch(_){}
    }
  }

  function pushMsg(role, text){
    if (!messagesEl || !text) return;
    var div = document.createElement('div');
    div.className = 'wallart-msg ' + (role === 'user' ? 'user' : 'ai');
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  function pushMsgHTML(role, html){
    if (!messagesEl || !html) return;
    var div = document.createElement('div');
    div.className = 'wallart-msg ' + (role === 'user' ? 'user' : 'ai');
    div.innerHTML = html; // nur für statische Inhalte verwenden
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  function pushSuggestions(values){
    if (!messagesEl || !values || !values.length) return;
    var wrap = document.createElement('div');
    wrap.className = 'wallart-suggestions';
    values.forEach(function(v){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'wallart-suggestion';
      b.setAttribute('data-value', v);
      if (/\bgenerier|\bgeneriere|\bgenerate\b/i.test(String(v))) {
        b.setAttribute('data-intent', 'generate');
      }
      b.textContent = v;
      wrap.appendChild(b);
    });
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ---------- Produkt/Variante robust ----------
  function _readJSON(el){ if (!el) return null; try { return JSON.parse(el.textContent||'{}'); } catch(_){ return null; } }
  function getProductData(){
    var p = _readJSON(document.getElementById('wallart-product'));
    if (p && Array.isArray(p.variants)) return p;
    var themeJson = document.querySelector('script[id^="ProductJson-"][type="application/json"]');
    var pj = _readJSON(themeJson);
    if (pj && Array.isArray(pj.variants)) return pj;
    var dataJson = document.querySelector('script[type="application/json"][data-product-json]');
    var dj = _readJSON(dataJson);
    if (dj && Array.isArray(dj.variants)) return dj;
    var any = Array.from(document.querySelectorAll('script[type="application/json"]'))
      .map(_readJSON).find(function(x){ return x && Array.isArray(x.variants); });
    return any || null;
  }
  function getCurrentVariantId(){
    var form = document.querySelector('form[action="/cart/add"]') || document.querySelector('product-form form');
    if (form) {
      var sel = form.querySelector('select[name="id"]');
      if (sel && sel.value) return Number(sel.value);
      var inp = form.querySelector('input[name="id"]');
      if (inp && inp.value) return Number(inp.value);
    }
    try {
      var vid = window.ShopifyAnalytics && ShopifyAnalytics.meta && ShopifyAnalytics.meta.selectedVariantId;
      if (vid) return Number(vid);
    } catch(_){}
    return null;
  }
  function classifyOptions(values, names){
    var size='', orientation='', material='';
    values.forEach(function(val){
      if (!val) return;
      if (!orientation && /hoch|portrait|quer|landscape/i.test(val)) orientation = val;
      else if (!size && /(A0|A1|A2|A3|A4|\d+\s*[xX]\s*\d+\s*(?:cm|mm)?)/i.test(val)) size = val;
      else if (!material && /(Acryl|Plexi|Forex|Hartschaum|Dibond|Alu|Aluminiumverbund|Canvas|Leinwand|Poster|Papier)/i.test(val)) material = val;
    });
    if (names && names.length){
      names = names.map(function(n){ return (n||'').toLowerCase(); });
      values.forEach(function(val, i){
        var n = names[i] || '';
        if (!val) return;
        if (!size && /größe|size|format/.test(n)) size = val;
        if (!orientation && /ausrichtung|orientation/.test(n)) orientation = val;
        if (!material && /material|oberfläche/.test(n)) material = val;
      });
    }
    return { size:size, orientation:orientation, material:material };
  }
  function getAspect(o){
    var size = (o.size || '').trim();
    var orientation = (o.orientation || '').trim();

    // DIN A? -> √2-Verhältnis
    var din = size.toUpperCase().match(/A([0-6])/);
    if (din) {
      var r = Math.SQRT2;
      var portrait = /hoch|portrait/i.test(orientation);
      return portrait ? { w: 1, h: r } : { w: r, h: 1 };
    }

    // Maße wie "60 x 40", "120x80", optional cm/mm
    var mm = size.match(/(\d+(?:[\.,]\d+)?)\s*[xX]\s*(\d+(?:[\.,]\d+)?)/);
    if (mm) {
      var w = parseFloat(mm[1].replace(',','.'));
      var h = parseFloat(mm[2].replace(',','.'));

      var isPortrait  = /hoch|portrait/i.test(orientation);
      var isLandscape = /quer|landscape/i.test(orientation);

      if (isPortrait && w > h) { var t = w; w = h; h = t; }
      if (isLandscape && h > w) { var t2 = h; h = w; w = t2; }

      return { w: w, h: h };
    }

    // Fallback: 3:2 (passt zu L/XL/XXL Landscape)
    return { w: 3, h: 2 };
  }
  function getVariantState(){
    var PRODUCT = getProductData();
    var vid = getCurrentVariantId();
    var size='', orientation='', material='';
    if (PRODUCT && vid){
      var v = (PRODUCT.variants || []).find(function(x){ return Number(x.id) === Number(vid); });
      if (v) {
        var vals = [v.option1, v.option2, v.option3].filter(Boolean);
        var cls = classifyOptions(vals, PRODUCT.options || []);
        size = cls.size; orientation = cls.orientation; material = cls.material;
        if ((!size || !orientation || !material) && v.title){
          var t = v.title;
          if (!size){
            var m = t.match(/(A0|A1|A2|A3|A4|\d+\s*[xX]\s*\d+\s*(?:cm|mm)?)/i);
            if (m) size = m[1];
          }
          if (!orientation){
            orientation = /hoch|portrait/i.test(t) ? 'Hochformat' :
                          /quer|landscape/i.test(t) ? 'Querformat' : '';
          }
          if (!material){
            var mat = t.match(/(Acryl|Plexi|Forex|Hartschaum|Dibond|Alu|Aluminiumverbund|Canvas|Leinwand|Poster|Papier)/i);
            if (mat) material = mat[1];
          }
        }
      }
    }
    // letzter Fallback: DOM
    if (!size && !orientation && !material){
      var groups = document.querySelectorAll('.product-form__input, fieldset.js-product-form__input, .product-form__controls-group');
      groups.forEach(function(group){
        var label = (group.querySelector('legend,label') && group.querySelector('legend,label').textContent || '').toLowerCase();
        var val = '';
        var sel = group.querySelector('select');
        if (sel) {
          var opt = sel.options[sel.selectedIndex];
          val = (opt && opt.text) || '';
        } else {
          var checked = group.querySelector('input[type="radio"]:checked + label, input[type="radio"][checked] + label');
          if (checked) val = checked.textContent || '';
        }
        val = (val || '').trim();
        if (!val) return;
        if (!size && (/größe|size|format/.test(label) || /(A0|A1|A2|A3|A4|\d+\s*[xX]\s*\d+)/i.test(val)) ) size = val;
        if (!orientation && (/ausrichtung|orientation/.test(label) || /hoch|quer|portrait|landscape/i.test(val)) ) orientation = val;
        if (!material && (/material|oberfläche/.test(label) || /(Acryl|Plexi|Forex|Hartschaum|Dibond|Alu|Aluminiumverbund|Canvas|Leinwand|Poster|Papier)/i.test(val)) ) material = val;
      });
    }
    var aspect = getAspect({ size:size, orientation:orientation });
    STATE.variant = { size:size, orientation:orientation, material:material, aspect:aspect };
    return STATE.variant;
  }

  // ---------- Begrüßung ----------
  function renderGreeting(){
    if (!messagesEl) return;
    messagesEl.innerHTML = '';
    var v = getVariantState();
    var oriText = /hoch|portrait/i.test(v.orientation) ? 'Hochformat' : (/quer|landscape/i.test(v.orientation) ? 'Querformat' : (v.orientation || 'passenden Format'));
    var sizeText = v.size || 'dein Wandbild';
    var matText  = v.material ? (' auf ' + v.material) : '';
    pushMsg('ai', 'Hi 👋, ich sehe du möchtest ein ' + sizeText + ' Wandbild im ' + oriText + matText + ' erstellen. Wie soll dein Motiv aussehen?');
    pushMsgHTML('ai', 'Durch die Nutzung des Wandbild Designers erklärst du dich mit den <a href="https://danilidou.com/pages/nutzungsvereinbarung-ki-designer" target="_blank" rel="noopener noreferrer">Nutzungsbedingungen</a> einverstanden.');
  }

  // ---------- Intent & Composer ----------

  function cleanPrompt(s){
    s = String(s || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
    if (s.length > 500) s = s.slice(0,500) + '…';
    return s;
  }

  function makeSubjectFromPrompt(s){
    s = cleanPrompt(s || '');
    if (!s) return 'Individuelles Wandbild';
    try {
      // Style-/Filterwörter raus, kurz halten
      s = s.replace(/\b(ruhig|lebendig|traumhaft|dramatisch|frisch|warm|kühl|kalt|monochrom|pastell|kräftig|abstrakt|aquarell|ölfarben|öl|fotorealistisch|realistisch|generativ|cinematisch|cyberpunk|surreal|vintage|retro|minimalistisch|hochformat|querformat|panorama|3:2|2:3|ohne\s+text|ohne\s+schrift|textlos|im\s+stil|in\s+style|stil)\b/gi, '');
      s = s.replace(/\s+/g,' ').trim().replace(/^(ein|eine|einen|das|der|die)\s+/i, '');
      var words = s.split(' ');
      if (words.length > 8) s = words.slice(0,8).join(' ');
      if (s.length > 64) s = s.slice(0,64).trim();
      return s || 'Individuelles Wandbild';
    } catch(_){
      return 'Individuelles Wandbild';
  }
} 




  // ---------- Prompt-Korrektur (minimal-invasiv) ----------
  // Entfernt widersprüchliche frühere Hintergrund-Anweisungen und respektiert die letzte.
  // Außerdem wird bei Formulierungen wie "nur ein Hund" leichtes Negativ-Prompting ergänzt
  // ("keine Duplikate / Mehrfach-Subjekte"), um Doppelungen zu vermeiden.
  function transformPrompt(p){
    if (!p) return p;
    try {
      var lines = String(p).split(/\n+/);
      var lastBgIdx = -1;
      for (var i = lines.length - 1; i >= 0; i--) {
        if (/\b(hintergrund|background|bg)\b/i.test(lines[i])) { lastBgIdx = i; break; }
      }
      if (lastBgIdx >= 0) {
        var kept = [];
        for (var j = 0; j < lines.length; j++) {
          if (j === lastBgIdx || !/\b(hintergrund|background|bg)\b/i.test(lines[j])) {
            kept.push(lines[j]);
          }
        }
        p = kept.join('\n');
      }

      // Wenn der*die Nutzer*in "nur ein ..." schreibt, dezent Mehrfachmotive ausschließen
      if (/\bnur\s+ein(?:e|en)?\b/i.test(p) && !/keine\s+duplikate|kein[e]?\s+mehrfach/i.test(p)) {
        p += '\nBitte genau ein Motiv, keine Duplikate oder Mehrfach-Subjekte.';
      }
    } catch(_) {}
    return p;
  }

  function isGenerateIntent(s){
    if (!s) return false;
    s = s.toLowerCase();
    return (
      /generier|generiere|generieren/.test(s) ||
      (/erzeug|erstelle|erstellen|mach/.test(s) && /bild|motiv/.test(s)) ||
      /\bgo\b|\blos\b|\bstart\b|\bstarten\b/.test(s) ||
      /generate|create/.test(s)
    );
  }

  function handleSendText(text){
    text = (text || '').trim();
    if (!text) return;
    if (getRemaining() <= 0){
      // nichts mehr zulassen
      enforceQuota();
      return;
    }
    pushMsg('user', text);
    if (inputEl) inputEl.value = '';
    STATE.collectedPrompt += (STATE.collectedPrompt ? '\n' : '') + text;

    if (isGenerateIntent(text)){
      onGenerateIntent();
      return;
    }
    pushMsg('ai', 'Alles klar. Soll ich das Bild generieren oder willst du noch etwas ergänzen?');
    pushSuggestions(['✨ Bild generieren']);
  }

  // ---------- Loader & Wake-Lock ----------

  // ---------- Preview Loader (with Progress) ----------
  var _waProg = { timer: 0, val: 0, mode: 'idle' };

  function ensurePreviewLoader(){
    if (!previewsEl) return null;
    var l = previewsEl.querySelector('.wa-pv-loader');
    if (!l){
      l = document.createElement('div');
      l.className = 'wa-pv-loader';
      l.style.display = 'none';
      l.innerHTML = [
        '<div class="wallart-spin" aria-hidden="true"></div>',
        '<div class="wa-progress">',
          '<div class="wa-progress__track"><div class="wa-progress__bar"></div></div>',
          '<div class="wa-progress__label">Wird vorbereitet…</div>',
        '</div>'
      ].join('');
      previewsEl.appendChild(l);
    } else if (!l.querySelector('.wa-progress')){
      l.innerHTML = [
        '<div class="wallart-spin" aria-hidden="true"></div>',
        '<div class="wa-progress">',
          '<div class="wa-progress__track"><div class="wa-progress__bar"></div></div>',
          '<div class="wa-progress__label">Wird vorbereitet…</div>',
        '</div>'
      ].join('');
    }
    return l;
  }
  function _waSetProgress(pct, label){
    try{
      pct = Math.max(0, Math.min(100, Number(pct)||0));
      var l = ensurePreviewLoader();
      var bar = l && l.querySelector('.wa-progress__bar');
      var txt = l && l.querySelector('.wa-progress__label');
      if (bar) bar.style.width = pct + '%';
      if (txt && label) txt.textContent = label;
      _waProg.val = pct;
    }catch(_){}
  }
  function _waStartFakeProgress(){
    _waStopProgress();
    _waProg.mode = 'fake';
    _waProg.val = 3;
    _waSetProgress(_waProg.val, 'Bildgenerierung gestartet …');
    _waProg.timer = setInterval(function(){
      if (_waProg.mode !== 'fake') return;
      var target = 99;
      if (_waProg.val < target){
        var step = Math.max(0.2, (target - _waProg.val) / 110);
        _waSetProgress(_waProg.val + step, '');
      }
    }, 300);
  }
  function _waStopProgress(){
    if (_waProg.timer){ clearInterval(_waProg.timer); _waProg.timer = 0; }
    _waProg.mode = 'idle';
  }
  function _waStatusToPct(st){
    if (!st) return null;
    try{
      if (typeof st.progress === 'number') return Math.max(0, Math.min(100, st.progress));
      var s = String(st.status||'').toLowerCase();
      if (s === 'queued') return 8;
      if (s === 'processing') return 35;
      if (s === 'diffusion' || s === 'generate') return 55;
      if (s === 'upscaling' || s === 'post' || s === 'postprocess') return 82;
      if (s === 'ready' || s === 'failed') return 100;
    }catch(_){}
    return null;
  }
  function _waStatusLabel(st){
    if (!st) return '';
    var s = String(st.status||'').toLowerCase();
    if (typeof st.progress === 'number') {
      if (s === 'ready') return 'Fertig';
      if (s === 'failed') return 'Fehlgeschlagen';
    }
    if (s === 'queued') return 'In Warteschlange …';
    if (s === 'processing') return 'Verarbeite …';
    if (s === 'diffusion' || s === 'generate') return 'Generiere …';
    if (s === 'upscaling' || s === 'post' || s === 'postprocess') return 'Verfeinere …';
    if (s === 'ready') return 'Fertig';
    if (s === 'failed') return 'Fehlgeschlagen';
    return 'Arbeite …';
  }

  function enableInputBlockers(){
    window.addEventListener('beforeunload', preventNav, {capture:true});
    window.addEventListener('pointerdown', swallow, {capture:true, passive:true});
    window.addEventListener('click', swallow, {capture:true});
    if (overlay) overlay.setAttribute('aria-busy', 'true');
  }
  function disableInputBlockers(){
    window.removeEventListener('beforeunload', preventNav, {capture:true});
    window.removeEventListener('pointerdown', swallow, {capture:true});
    window.removeEventListener('click', swallow, {capture:true});
    if (overlay) overlay.removeAttribute('aria-busy');
  }
  function preventNav(e){ e.preventDefault(); e.returnValue=''; }
  function swallow(e){ e.stopPropagation(); }


  var _wake = { lock: null, audio: null, video: null, anim: 0, ping: 0, usingAudio: false, usingVideo: false };
  function _isGenerating(){ try { return (window.__wallart && window.__wallart._state && window.__wallart._state.generating) || false; } catch(_) { return false; } }
  function _ensurePing(){
    if (_wake.ping) return;
    _wake.ping = setInterval(function(){
      if (!_isGenerating()) return;
      if (_wake.lock && _wake.lock.released && navigator.wakeLock){
        navigator.wakeLock.request('screen').then(function(s){ _wake.lock = s; }).catch(function(){});
      }
      if (_wake.usingVideo && _wake.video && _wake.video.paused){
        _wake.video.play().catch(function(){});
      }
      if (_wake.usingAudio && _wake.audio && _wake.audio.ctx && _wake.audio.ctx.state === 'suspended'){
        _wake.audio.ctx.resume().catch(function(){});
      }
    }, 15000);
  }
  function _startAudioFallback(){
    if (_wake.audio) {
      if (_wake.audio.ctx && _wake.audio.ctx.state === 'suspended'){
        _wake.audio.ctx.resume().catch(function(){});
      }
      _wake.usingAudio = true;
      return;
    }
    try{
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      gain.gain.value = 0.001;
      osc.frequency.value = 20;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start();
      _wake.audio = { ctx: ctx, osc: osc, gain: gain };
      _wake.usingAudio = true;
    }catch(_){}
  }
  function _startVideoFallback(){
    if (_wake.video && !_wake.video.paused) return;
    try{
      var c = document.createElement('canvas'); c.width = 64; c.height = 36;
      var ctx = c.getContext('2d');
      var t = 0;
      function tick(){
        t++;
        ctx.fillStyle = (t % 2 ? '#0a0a0a' : '#0b0b0b');
        ctx.fillRect(0,0,c.width,c.height);
        ctx.fillStyle = '#111'; ctx.fillRect((t%64), 0, 2, c.height);
        _wake.anim = requestAnimationFrame(tick);
      }
      tick();
      var stream = c.captureStream(30);
      var v = _wake.video || document.createElement('video');
      v.muted = true; v.setAttribute('muted',''); v.setAttribute('playsinline',''); v.loop = true;
      v.disablePictureInPicture = true;
      v.srcObject = stream;
      v.style.cssText = 'position:fixed;opacity:0.01;width:2px;height:2px;bottom:0;left:0;pointer-events:none;z-index:2147483647;';
      if (!v.parentNode) document.body.appendChild(v);
      var p = v.play();
      if (p && p.catch) p.catch(function(){});
      _wake.video = v; _wake.usingVideo = true;
    }catch(_){}
  }
  async function lockScreen(){
    try{
      if ('wakeLock' in navigator) {
        _wake.lock = await navigator.wakeLock.request('screen');
        _wake.usingAudio = false; _wake.usingVideo = false;
        _wake.lock.addEventListener && _wake.lock.addEventListener('release', function(){
          if (_isGenerating()) { lockScreen().catch(function(){}); }
        });
        _ensurePing();
        return;
      }
    }catch(_){}
    _startVideoFallback();
    _startAudioFallback();
    _ensurePing();
  }
  function releaseScreen(){
    if (_wake.lock){ try{ _wake.lock.release(); }catch(_){} }
    _wake.lock = null;
    if (_wake.video){
      try{ _wake.video.pause(); }catch(_){}
      try{ _wake.video.srcObject && _wake.video.srcObject.getTracks().forEach(function(t){ t.stop(); }); }catch(_){}
      if (_wake.video.parentNode) _wake.video.parentNode.removeChild(_wake.video);
    }
    _wake.video = null; _wake.usingVideo = false;
    if (_wake.anim){ try{ cancelAnimationFrame(_wake.anim); }catch(_){ } _wake.anim = 0; }
    if (_wake.audio){
      try{ _wake.audio.osc && _wake.audio.osc.stop(); }catch(_){}
      try{ _wake.audio.ctx && _wake.audio.ctx.close(); }catch(_){}
    }
    _wake.audio = null; _wake.usingAudio = false;
    if (_wake.ping){ clearInterval(_wake.ping); _wake.ping = 0; }
  }
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'visible' && _isGenerating()){
      lockScreen().catch(function(){});
      if (_wake.video && _wake.video.paused){ _wake.video.play().catch(function(){}); }
      if (_wake.audio && _wake.audio.ctx && _wake.audio.ctx.state === 'suspended'){ _wake.audio.ctx.resume().catch(function(){}); }
    }
  });
  window.addEventListener('focus', function(){
    if (_isGenerating()){ lockScreen().catch(function(){}); }
  });
  if (screen && screen.orientation && screen.orientation.addEventListener){
    screen.orientation.addEventListener('change', function(){
      if (_isGenerating()) { lockScreen().catch(function(){}); }
    });
  }
  function _resumeMediaIfNeeded(){
    if (_wake.video && _wake.video.paused){ _wake.video.play().catch(function(){}); }
    if (_wake.audio && _wake.audio.ctx && _wake.audio.ctx.state === 'suspended'){ _wake.audio.ctx.resume().catch(function(){}); }
  }
  document.addEventListener('pointerdown', _resumeMediaIfNeeded, { passive:true, capture:true });
  document.addEventListener('pointermove', _resumeMediaIfNeeded, { passive:true, capture:true });
  document.addEventListener('click', _resumeMediaIfNeeded, true);
  document.addEventListener('keydown', _resumeMediaIfNeeded, true);
  document.addEventListener('touchstart', _resumeMediaIfNeeded, { passive:true, capture:true });
  document.addEventListener('touchend', _resumeMediaIfNeeded, { passive:true, capture:true });

  var loaderEl;
  function showLoader(){
    if (!messagesEl) return;
    loaderEl = document.createElement('div');
    loaderEl.className = 'wallart-loader';
    loaderEl.innerHTML = '<div class="wallart-spin" aria-hidden="true"></div><div>Bild wird generiert … Der kreative Prozess ist in vollem Gange.</div>';
    messagesEl.appendChild(loaderEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    if (inputEl) inputEl.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
  }
  function hideLoader(){
    if (loaderEl && loaderEl.parentNode) loaderEl.parentNode.removeChild(loaderEl);
    loaderEl = null;
    if (inputEl) inputEl.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
  }
  function showPreviewLoader(){
    if (!previewsEl) return;
    var l = ensurePreviewLoader();
    if (l) {
      l.style.display = 'flex';
      _waStartFakeProgress(); // echter Fortschritt überschreibt später
    }
  }
  function hidePreviewLoader(){
    if (!previewsEl) return;
    var l = ensurePreviewLoader();
    if (l) {
      _waSetProgress(100, 'Fertig');
      setTimeout(function(){
        _waStopProgress();
        l.style.display = 'none';
        _waSetProgress(0, '');
      }, 250);
    }
  }

  // ---------- ENDPOINT-FINDUNG (minimale Änderung) ----------
  function resolveGenerateEndpoints(){
  // Wenn bereits ein erfolgreicher Endpunkt gelockt wurde: nur diesen verwenden
  if (typeof WA_FIXED !== 'undefined' && WA_FIXED && WA_FIXED.generateURL) {
    return [WA_FIXED.generateURL];
  }
  var root    = document.getElementById('wallart-root');
  var explicit= (root && root.dataset && root.dataset.generate) || '';
  var worker  = (root && root.dataset && root.dataset.worker) || (window.WALLART_WORKER_URL || '');
  var allowLocal = !!(root && root.dataset && root.dataset.localRoute === '1');

  var list = [];
  function toAbsolute(u){
    try { return new URL(u, window.location.origin).toString(); } catch(_){ return u; }
  }

  // 1) data-worker (kann Origin ODER schon /api/generate sein)
  if (worker) {
    var w = String(worker).replace(/\/+$/,'');
    if (/\/api\/generate$/i.test(w)) list.push(w);
    else list.push(w + '/api/generate');
  }
  // 2) data-generate (vollständiger Endpoint)
  if (explicit) list.push(String(explicit).replace(/\/+$/,''));
  // 3) Fallbacks
  try { list.push(waWorker('/api/generate')); } catch(e) {}
  if (WA_DEFAULT_WORKER) list.push(WA_DEFAULT_WORKER.replace(/\/+$/,'') + '/api/generate');

  if (allowLocal) list.push('/api/generate');

  var seen = {};
  list = list.map(toAbsolute);
  return list.filter(function(u){ if(!u) return false; if (seen[u]) return false; seen[u]=1; return true; });
}

  function postJSONWithTimeout(url, body, ms, externalSignal){
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var signal = ctrl ? ctrl.signal : undefined;
    if (externalSignal) {
      try { signal = (AbortSignal.any ? AbortSignal.any([signal, externalSignal]) : signal); } catch(_) {}
    }
    var t = null;
    if (ctrl) t = setTimeout(function(){ try{ ctrl.abort(); }catch(_){ } }, ms || 60000);
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept':'application/json' },
      body: JSON.stringify(body),
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'strict-origin-when-cross-origin',
      signal: signal,
      cache: 'no-store'
    }).finally(function(){ if (t) clearTimeout(t); });
  }

  

  function backoff(attempt){
    var base = Math.min(1000 * Math.pow(2, attempt), 8000);
    var jitter = Math.floor(Math.random() * 400);
    return base + jitter;
  }



// --- Async Job API (Durable Object) ---
async function startRenderJob(payload, onProgress){
  try {
    if (!WORKER_BASE || !/^https?:\/\//.test(WORKER_BASE)) throw new Error('no_worker_base');
    const create = await fetch(WORKER_BASE + '/api/jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept': 'application/json' },
      body: JSON.stringify(payload || {}),
      keepalive: true
    });
    if (!create.ok) throw new Error('job_create_failed');
    const data = await create.json();
    const job_id = data && data.job_id;
    if (!job_id) throw new Error('no_job_id');

    let tries = 0;
    while (true){
      const res = await fetch(WORKER_BASE + '/api/jobs/' + job_id, { headers: { 'accept': 'application/json' }, cache: 'no-store' });
      if (!res.ok) throw new Error('job_status_failed');
      const st = await res.json();
      if (onProgress) { try { onProgress(st); } catch(_){} }
      if (st && st.status === 'ready' && Array.isArray(st.previews) && st.previews.length){
        return { previews: st.previews };
      }
      if (st && st.status === 'failed'){
        throw new Error('job_failed');
      }
      tries++;
      const wait = Math.min(800 + Math.pow(2, tries) * 200, 2500);
      await new Promise(r => setTimeout(r, wait));
    }
  } catch(err){
    // Fallback: nutze alten Pfad, wenn kein WORKER_BASE
    if (String(err && err.message).includes('no_worker_base')){
      return generateViaFallbacks(payload);
    }
    throw err;
  }
}



function generateViaFallbacks(payload){
    var endpoints = resolveGenerateEndpoints();
    var idx = 0;
    return new Promise(function(resolve, reject){
      function tryEndpoint(url, attempt){
        // max 3 Versuche pro Endpoint bei 429/5xx
        postJSONWithTimeout(url, payload, 90000, (CURRENT_GEN_ABORT && CURRENT_GEN_ABORT.signal))
          .then(function(res){
            if (!res.ok){
              return res.text().then(function(t){
                var err = new Error('HTTP ' + res.status + ' @ ' + url + (t ? (' — ' + t) : ''));
                err.status = res.status;
                throw err;
              });
            }
            return res.json();
          })
          .then(function(data){
            if (typeof WA_FIXED !== 'undefined' && WA_FIXED && !WA_FIXED.generateURL) {
              WA_FIXED.generateURL = url; // erfolgreichen Endpoint merken
            }
            resolve(data);
          })
          .catch(function(err){
            var status = err && err.status;
            var retriable = status === 429 || status === 503 || status === 504;
            if (retriable && attempt < 2){
              setTimeout(function(){ tryEndpoint(url, attempt+1); }, backoff(attempt));
              return;
            }
            // Falls der gelockte Endpoint scheitert, Lock freigeben
            try { if (typeof WA_FIXED!=='undefined' && WA_FIXED && WA_FIXED.generateURL === url) { WA_FIXED.generateURL = null; } } catch(_){}
            next(err);
          });
      }
      function next(lastErr){
        if (idx >= endpoints.length){
          return reject(lastErr || new Error('Alle Endpunkte fehlgeschlagen'));
        }
        var url = endpoints[idx++];
        if (!url || !/^https?:\/\//.test(url)) { return next(new Error('Ungültiger Endpoint: ' + String(url))); }
        tryEndpoint(url, 0);
      }
      next();
    });
  }
function renderPreview(preview){
    STATE.lastPreview = preview;
    if (!previewsEl) return;
    previewsEl.innerHTML = '';
    var ph = previewsEl.querySelector('.wa-pv-empty');
    if (ph) ph.style.display = 'none';

    ensurePreviewLoader();

    var card = document.createElement('div');
    card.className = 'wallart-card';
    card.innerHTML = [
      '<img src="'+(safeImgURL(preview.url) || '')+'" alt="KI-Preview" loading="lazy" />',
      '<div class="wallart-card__actions">',
        '<button type="button" class="wallart-btn" data-action="reset">Chat zurücksetzen</button>',
        '<button type="button" class="wallart-btn primary" data-action="cart">In den Warenkorb</button>',
      '</div>'
    ].join('');
    previewsEl.appendChild(card);

    var img = card.querySelector('img');
    img && img.addEventListener('click', function(){ var u = safeImgURL(preview.url); if(u) openImgModal(u); });

    card.addEventListener('click', function(e){
      var btn = e.target && e.target.closest && e.target.closest('button[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      if (action === 'reset') {
      openConfirmReset(); // nutzt eure bestehende Reset-Funktion
      return;
    } else if (action === 'cart') {
      addToCart(preview);
    }

    });
  }

    // ---------- Generate Intent ----------
  function onGenerateIntent(){
    // Chat öffnen (falls noch nicht offen)
    buildUI();
    if (!overlay || !overlay.classList.contains('is-open')) {
      open();
    }
    if (STATE.generating) return;
    if (getRemaining() <= 0){
      enforceQuota();
      return;
    }


    var prompt = transformPrompt((STATE.collectedPrompt || (inputEl && inputEl.value) || '').trim());
    if (!prompt){
      pushMsg('ai', 'Bitte beschreibe kurz dein Motiv oder nutze die Vorschläge.');
      pushSuggestions(['✨ Bild generieren']);
      return;
    }

    // Wenn ein Basisbild genutzt wird, verstärke die Anweisung, das Motiv beizubehalten
    if (STATE.baseImage && (STATE.baseImage.id || STATE.baseImage.url)) {
      var keepNote = 'WICHTIG: Behalte das Motiv aus dem Basisbild exakt bei (Rasse/Art, Pose/Haltung, Proportionen, Gesichts-/Fellmerkmale, Kleidung/Accessoires). ';
      var changeOnly = 'ÄNDERE NUR: ' + prompt + '. ';
      var noChange = 'Keine Änderungen am Motiv, keine neue Rasse/Art.';
      prompt = (keepNote + changeOnly + noChange).trim();
    }

    var variant = getVariantState() || {};
    var a = (variant && variant.aspect) || { w:3, h:2 };
    var r = (a && a.w && a.h) ? (a.w/a.h) : (3/2);
    var aspectStr = (Math.abs(r - 3/2) < 0.02) ? "3:2" : (Math.abs(r - 2/3) < 0.02 ? "2:3" : (r > 1 ? "3:2" : "2:3"));
    var isVar = !!(STATE.baseImage && STATE.baseImage.url);

    var payload = { 
      prompt: prompt,
      aspect: aspectStr,
      mode: isVar ? "variation" : "fresh"
    };
    if (isVar) { payload.image_url = STATE.baseImage.url; }

    STATE.generating = true;
    
    try { document.dispatchEvent(new CustomEvent('wa:gen:start')); } catch(_) {}
    if (window.__waPreGenCheck) { try { window.__waPreGenCheck(); } catch(_) {} }
showLoader();
    // Schutz: Keine Anfrage starten, wenn der Browser offline ist
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
  // ⚠️ navigator reports offline, but continue anyway and let the health checks decide.
  try { console.warn('[WallArt] navigator.onLine=false; attempting network anyway'); } catch(_) {}
  // NOTE: We do NOT early return here anymore.
}


    showPreviewLoader();
    try { lockScreen(); } catch(_){}

    try{ if (CURRENT_GEN_ABORT) { CURRENT_GEN_ABORT.abort(); } }catch(_){}
    CURRENT_GEN_ABORT = new AbortController();
    enableInputBlockers();
    generateViaFallbacks(payload)
      .then(function(res){
        var v = getVariantState() || variant;
        // Unterstütze sowohl {id,url,...} als auch {previews:[...]}
        var item = null;
        if (res && Array.isArray(res.previews) && res.previews.length){
          item = res.previews[0];
        } else if (res && res.id && res.url) {
          item = res;
        }
        else if (res && res.url) {
          item = { url: res.url };
        }
        if (item && item.url){
          renderPreview({
            id: item.id || '',
            url: item.url,
            seed: item.seed || null,
            aspect: item.aspect || (v && v.aspect) || { w:3, h:2 },
            variant: v
          });
          incQuota();           // 1 Bild verbraucht
          enforceQuota();       // ggf. sofort sperren
          // pushSuggestions(['Nochmal generieren']);
        } else {
          pushMsg('ai', 'Unerwartete Antwort vom Generator.');
        }
      })
      .catch(function(err){
        var msg = String((err && err.message) || '');
        var name = String(err && (err.name || (err.cause && err.cause.name) || ''));

        // besser: auch nach Name/Cause prüfen (nicht nur message-Text)
        var isAbort = /AbortError/i.test(name) || /AbortError/i.test(msg);
        var isTimeout = /timeout/i.test(msg) || /timeout/i.test(String(err && (err.cause && err.cause.message || err.reason || '')));

        if (isAbort || isTimeout) {
          pushMsg('ai', 'Der Bild-Generator hat zu lange gebraucht (Timeout/Abbruch). Bitte erneut versuchen.');
        } else if (/network|fetch|cors|failed/i.test(msg)) {
          pushMsg('ai', 'Verbindung zum Bild-Generator konnte nicht aufgebaut werden (CORS/Netzwerk). Bitte Seite kurz neu laden oder später erneut versuchen.');
        } else {
          pushMsg('ai', 'Die Generierung ist fehlgeschlagen. Bitte versuche es erneut.');
          try { console.error('[wallart] generate error', err); } catch(_) {}
        }
      })
      .finally(function(){
        hideLoader();
        hidePreviewLoader();
        releaseScreen();
        disableInputBlockers();
        try{ CURRENT_GEN_ABORT = null; }catch(_){}
        STATE.generating = false;
        try { document.dispatchEvent(new CustomEvent('wa:gen:end')); } catch(_) {}
      });
  }

  // ---------- Add to Cart ----------
  function addToCart(preview){
    var vid = getCurrentVariantId();
    if (!vid){
      pushMsg('ai', 'Konnte die Produkt-Variante nicht ermitteln. Bitte wähle eine Variante.');
      return;
    }

    var form = new FormData();
    form.append('id', String(vid));
    form.append('quantity', '1');

    // Sichtbar für den Kunden
    var subject = makeSubjectFromPrompt(STATE.collectedPrompt || '');
    form.append('properties[Motiv]', subject);

    // Versteckte Technik-Felder (werden im Checkout nicht angezeigt)
    form.append('properties[_ai_prompt]', cleanPrompt(STATE.collectedPrompt || ''));
    form.append('properties[_ai_aspect]', (preview && preview.aspect) ? (preview.aspect.w + ':' + preview.aspect.h) : '');
    try { form.append('properties[_ai_variant]', JSON.stringify(STATE.variant || {})); } catch(_) {}
    form.append('properties[_ai_preview_url]', (preview && preview.url) ? preview.url : '');
    form.append('properties[_ai_image_id]', (preview && preview.id) ? preview.id : '');
    if (preview && preview.seed != null) form.append('properties[_ai_seed]', String(preview.seed));

    fetch('/cart/add.js', {
      method: 'POST',
      body: form,
      headers: { 'Accept':'application/json' },
      credentials: 'same-origin'
    })
    .then(async function(){
      await refreshCartUI(); // ← sofort Drawer/Cart aktualisieren
      pushMsg('ai', '✅ Ich habe dir dein Bild in den Warenkorb gelegt! Du kannst den Chat jetzt schließen oder weitere Bilder generieren.');
    })



    .catch(function(){
      pushMsg('ai', '❌ Konnte nicht in den Warenkorb legen. Bitte versuche es erneut.');
    });
  }

  async function refreshCartUI() {
    try {
      // 1) Cart-Drawer HTML frisch laden (Impact / Standard Drawer Section)
      const drawerRes = await fetch('/cart?section_id=cart-drawer', { credentials: 'same-origin' });
      if (drawerRes.ok) {
        const html = await drawerRes.text();
        const tmp = document.createElement('div');
        tmp.innerHTML = html;

        // a) Webcomponent <cart-drawer> (neuere Themes)
        const newDrawer = tmp.querySelector('cart-drawer');
        const curDrawer = document.querySelector('cart-drawer');
        if (newDrawer && curDrawer) {
          curDrawer.innerHTML = newDrawer.innerHTML;
          // optional öffnen/zeigen:
          curDrawer.open?.();
        } else {
          // b) Fallback: Container mit ID/Attr
          const newContainer = tmp.querySelector('#CartDrawer') || tmp.querySelector('[data-cart-drawer]');
          const curContainer = document.querySelector('#CartDrawer') || document.querySelector('[data-cart-drawer]');
          if (newContainer && curContainer) {
            curContainer.innerHTML = newContainer.innerHTML;
            curContainer.classList.add('is-open');
          }
        }
      }

      // 2) Cart-Zähler/Bubble aktualisieren (Header + Drawer + Fallbacks)
      const cartJson = await fetch('/cart.js', { credentials: 'same-origin' }).then(r => r.json());
      const count = Number(cartJson.item_count || 0);

      // mehrere mögliche Selektoren bedienen
      const selectors = [
        '[data-cart-count]',          // generisch
        'cart-count',                 // Webcomponent <cart-count>
        '.header__cart .count-bubble',
        '.header__icons .count-bubble',
        '.count-bubble',              // fallback
        '#cart-count'                 // fallback ID
      ];

      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          // Zahl setzen
          el.textContent = String(count);

          // Sichtbarkeit toggeln (verschiedene Theme-Varianten)
          if (count > 0) {
            el.classList.remove('hidden');
            el.classList.add('is-visible', 'count-bubble--show');
            el.style.display = '';      // sichtbar
            // manche <cart-count>-Implementierungen nutzen auch ein Attribut
            try { el.setAttribute && el.setAttribute('aria-hidden', 'false'); } catch(_){}
          } else {
            el.classList.add('hidden');
            el.classList.remove('is-visible', 'count-bubble--show');
            el.style.display = 'none';  // ausblenden
            try { el.setAttribute && el.setAttribute('aria-hidden', 'true'); } catch(_){}
          }
        });
      });

      // zusätzliches Event für evtl. Custom Listener
      document.documentElement.dispatchEvent(new CustomEvent('cart:count', { detail: { count } }));
      
      // (OPTIONAL) Header-Section neu ziehen, falls Zähler nur serverseitig gerendert wird
      try {
        const header = document.querySelector('#shopify-section-header');
        if (header) {
          const res = await fetch('/?section_id=header', { credentials: 'same-origin' });
          if (res.ok) {
            const html = await res.text();
            const tmp = document.createElement('div');
            tmp.innerHTML = html;
            const newHeader = tmp.querySelector('#shopify-section-header');
            if (newHeader) header.innerHTML = newHeader.innerHTML;
          }
        }
      } catch (_) {}


      // 3) Events feuern (falls Theme darauf hört)
      document.documentElement.dispatchEvent(new CustomEvent('cart:refresh', { detail: cartJson }));
      document.documentElement.dispatchEvent(new CustomEvent('product:added', { detail: cartJson }));
    } catch (_) {
      // still: keine harten Fehler werfen
    }
  }


  // ---------- Exporte & Delegation ----------
  function openHandler(e){
    var btn = e.target && (e.target.id === 'wallart-open' ? e.target : (e.target.closest && e.target.closest('#wallart-open')));
    if (!btn) return;
    e.preventDefault();
    document.documentElement.classList.add('wallart--template');
    open();
  }

  window.__wallart = {
    pushMsg: pushMsg,
    pushMsgHTML: pushMsgHTML,
    open: open,
    close: close,
    reset: resetChat,
    _getVariantState: getVariantState,
    _state: STATE,
    _generate: onGenerateIntent,
    generate: onGenerateIntent
  };

  function waWorker(path){
    // 1) Bereits absolute URL? → so lassen
    if (typeof path === 'string' && /^https?:\/\//i.test(path)) return path;
    // 2) Basis: Theme-Setting oder globale Default-Konstante
    var base = (window.WALLART_WORKER_ORIGIN || (typeof WA_DEFAULT_WORKER !== 'undefined' ? WA_DEFAULT_WORKER : ''));
    base = String(base || '').replace(/\/+$/,'');
    path = String(path || '').replace(/^\/+/, '');
    return base ? (base + (path ? '/' + path : '')) : '';
  }


  document.addEventListener('click', openHandler, false);

  // Globaler Trigger (Chips/Buttons/Links) mit data-wa-generate
  document.addEventListener('click', function(ev){
    var el = ev.target && ev.target.closest && ev.target.closest('[data-wa-generate]');
    if (!el) return;
    ev.preventDefault();
    onGenerateIntent();
  }, false);

  // ---------- Bootstrap ----------
  injectCSS();
})();

// === Stability Hardening Block (v1) ===
(function(){
  if (typeof window.waWorker !== 'function') {
    window.waWorker = function(path){
      try { return new URL(path, window.location.origin).toString(); } catch(_) { return path; }
    };
  }
  function waFixFileURL(u){
    try {
      if (!u || typeof u !== 'string') return u;
      var m = u.match(/\/api\/file\/(.+)/);
      if (!m) return u;
      if (/%2F/i.test(m[1])) return u.replace(/%2F/gi, '/');
      return u;
    } catch(_) { return u; }
  }
  try {
    var previewRoot = document.querySelector('[data-wa-preview-root], .wa-preview, #wa-preview, [data-wallart-preview]') || document.body;
    var mo = new MutationObserver(function(muts){
      muts.forEach(function(m){
        m.addedNodes && Array.prototype.forEach.call(m.addedNodes, function(n){
          try {
            if (n && n.nodeType === 1) {
              if (n.tagName === 'IMG') {
                if (/%2F/.test(n.src)) n.src = waFixFileURL(n.src);
              } else {
                var imgs = n.querySelectorAll && n.querySelectorAll('img');
                imgs && imgs.forEach(function(img){
                  if (/%2F/.test(img.src)) img.src = waFixFileURL(img.src);
                });
              }
            }
          } catch(_){}
        });
      });
    });
    mo.observe(previewRoot, { childList: true, subtree: true });
  } catch(_){}
  (function setupLongWaitHints(){
    var busy=false, t1=null, t2=null;
    function onStart(){
      if (busy) return;
      busy = true;
      t1 = setTimeout(function(){
        try { window.__wallart && window.__wallart.pushMsg && window.__wallart.pushMsg('ai', 'Ich bin noch dran – das kann bei hoher Last ein wenig länger dauern…'); } catch(_){}
      }, 150000);
      t2 = setTimeout(function(){
        try { window.__wallart && window.__wallart.pushMsg && window.__wallart.pushMsg('ai', 'Noch etwas Geduld – ich versuche es weiter. Wenn es gleich nicht klappt, probiere ich es automatisch erneut.'); } catch(_){}
      }, 250000);
    }
    function onEnd(){
      if (!busy) return;
      busy = false;
      if (t1){ clearTimeout(t1); t1=null; }
      if (t2){ clearTimeout(t2); t2=null; }
    }
    document.addEventListener('wa:gen:start', onStart, {passive:true});
    document.addEventListener('wa:gen:end', onEnd, {passive:true});
    window.__waLongWait = { onStart:onStart, onEnd:onEnd };
  })();
  window.__waPreGenCheck = async function(){
  try {
    var base = (typeof WORKER_BASE!=='undefined' && WORKER_BASE) || (window.WALLART_WORKER_ORIGIN || (typeof WA_DEFAULT_WORKER!=='undefined' ? WA_DEFAULT_WORKER : ''));
    if (!base) return true; // niemals blockieren
    var ctrl = new AbortController();
    var to = setTimeout(function(){ try{ctrl.abort();}catch(_){}} , 1500);
    try { await fetch(String(base).replace(/\/$/, '') + '/api/health', { signal: ctrl.signal, cache: 'no-store', mode: 'cors' }); } catch(_){ /* nie blockieren */ }
    clearTimeout(to);
    return true;
  } catch(_){ return true; }
};
})();

