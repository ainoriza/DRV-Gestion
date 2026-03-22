/**
 * zip.js — Módulo de ingreso por ZIP con Gemini
 *
 * Flujo:
 * 1. Usuario arrastra o selecciona un ZIP de GDE
 * 2. Se envía al Apps Script vía API.extraerZip()
 * 3. Apps Script: descomprime → OCR Drive → Gemini → devuelve campos
 * 4. Se muestran los campos extraídos con opción de usar en formulario
 */

const ZipModule = (() => {

  let _historial = [
    { archivo: 'EXP-19631-RA518-Arroz.zip',       usuario: 'rramirez@inase.gob.ar', hace: 'hace 2 horas',  pdfs: 4 },
    { archivo: 'EXP-19630-Puntal-TrigoP.zip',      usuario: 'jlopez@inase.gob.ar',   hace: 'hace 5 horas',  pdfs: 3 },
    { archivo: 'EXP-19628-DK7210-Maiz.zip',        usuario: 'mperez@inase.gob.ar',   hace: 'ayer',          pdfs: 5 },
  ];

  let _lastExtracted = null;

  // ── Render ──────────────────────────────────────────────────
  function render() {
    const container = document.getElementById('page-zip');
    container.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Ingresar ZIP de expediente</h1>
          <p>Gemini extrae los datos automáticamente · Apps Script + Drive OCR</p>
        </div>
      </div>

      <div style="padding:16px 24px 32px;max-width:860px">

        <!-- DROP ZONE -->
        <div id="drop-zone" class="drop-zone" onclick="document.getElementById('zip-input').click()"
          ondragover="ZipModule.onDragOver(event)" ondragleave="ZipModule.onDragLeave(event)"
          ondrop="ZipModule.onDrop(event)">
          <input type="file" id="zip-input" accept=".zip" style="display:none" onchange="ZipModule.onFileSelect(event)" />
          <div class="drop-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M4 6h10l4 4v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.3"/><path d="M14 6v4h4M12 12v7M9 16l3 3 3-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div id="drop-title" class="drop-title">Arrastrá el ZIP o hacé clic para seleccionar</div>
          <div class="drop-sub">Formato: .zip con PDFs de GDE · Gemini procesará cada documento automáticamente</div>
          <div id="drop-progress" class="drop-progress" style="display:none">
            <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
            <span id="progress-msg" class="progress-msg">Preparando...</span>
          </div>
        </div>

        <!-- RESULT PANEL -->
        <div id="result-panel" class="result-panel" style="display:none">
          <div class="result-header">
            <div class="result-header-left">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3 3.5L12 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Datos extraídos por Gemini
              <span id="result-pdfs" class="result-pdfs-badge"></span>
            </div>
            <button class="btn primary" onclick="ZipModule.usarDatos()">
              Usar para nuevo expediente →
            </button>
          </div>

          <div class="result-fields" id="result-fields"></div>

          <div class="result-footer">
            <span id="result-filename" style="font-size:11px;color:var(--c-text-3)"></span>
            <button class="btn" onclick="ZipModule.resetZone()" style="font-size:12px;padding:4px 10px">
              Procesar otro ZIP
            </button>
          </div>
        </div>

        <!-- HISTORIAL -->
        <div style="margin-top:24px">
          <div style="font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-2);margin-bottom:12px">Extracciones recientes</div>
          <div id="historial-list"></div>
        </div>

      </div>
    `;

    _renderHistorial();
    _injectStyles();
  }

  function _injectStyles() {
    if (document.getElementById('zip-styles')) return;
    const s = document.createElement('style');
    s.id = 'zip-styles';
    s.textContent = `
      .drop-zone {
        border: 1.5px dashed var(--c-border-md);
        border-radius: var(--radius-lg);
        padding: 40px 24px;
        text-align: center;
        cursor: pointer;
        transition: all .15s;
        background: var(--c-surface);
        margin-bottom: 14px;
      }
      .drop-zone:hover, .drop-zone.drag-over {
        border-color: var(--c-accent);
        background: var(--c-accent-bg);
      }
      .drop-icon {
        width: 48px; height: 48px;
        background: var(--c-bg);
        border-radius: var(--radius);
        display: flex; align-items: center; justify-content: center;
        margin: 0 auto 12px;
        color: var(--c-text-2);
      }
      .drop-title {
        font-size: 14px; font-weight: 500;
        color: var(--c-text);
        margin-bottom: 6px;
      }
      .drop-sub { font-size: 12px; color: var(--c-text-2); }
      .drop-progress { margin-top: 20px; }
      .progress-bar {
        height: 3px; background: var(--c-bg);
        border-radius: 2px; overflow: hidden;
        margin-bottom: 8px;
      }
      .progress-fill {
        height: 100%; background: var(--c-accent);
        border-radius: 2px;
        animation: progress-anim 1.8s ease-in-out infinite;
        width: 40%;
      }
      @keyframes progress-anim {
        0%   { transform: translateX(-100%); }
        100% { transform: translateX(350%); }
      }
      .progress-msg { font-size: 12px; color: var(--c-text-2); }

      .result-panel {
        background: var(--c-surface);
        border: 0.5px solid var(--c-border-md);
        border-radius: var(--radius-lg);
        overflow: hidden;
        margin-bottom: 14px;
      }
      .result-header {
        padding: 12px 16px;
        border-bottom: 0.5px solid var(--c-border);
        display: flex; align-items: center;
        justify-content: space-between;
        font-size: 13px; font-weight: 500;
        color: var(--c-success);
        background: var(--c-success-bg, #E8F5EE);
      }
      .result-header-left { display: flex; align-items: center; gap: 6px; }
      .result-pdfs-badge {
        font-size: 11px; padding: 2px 8px;
        border-radius: 3px;
        background: rgba(255,255,255,0.5);
        color: var(--c-success);
        font-weight: 400;
      }
      .result-fields {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 0;
      }
      .rf {
        padding: 12px 16px;
        border-bottom: 0.5px solid var(--c-border);
        border-right: 0.5px solid var(--c-border);
      }
      .rf:nth-child(even) { border-right: none; }
      .rf-label {
        font-size: 10px; font-weight: 500;
        text-transform: uppercase; letter-spacing: .05em;
        color: var(--c-text-2); margin-bottom: 3px;
      }
      .rf-value { font-size: 13px; font-weight: 500; color: var(--c-text); }
      .rf-empty { font-size: 12px; color: var(--c-text-3); font-style: italic; }
      .result-footer {
        padding: 10px 16px;
        display: flex; align-items: center;
        justify-content: space-between;
        border-top: 0.5px solid var(--c-border);
        background: var(--c-bg);
      }
      .hist-row {
        display: flex; gap: 10px;
        padding: 10px 0;
        border-bottom: 0.5px solid var(--c-border);
        align-items: flex-start;
      }
      .hist-row:last-child { border-bottom: none; }
      .hist-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: var(--c-accent); flex-shrink: 0; margin-top: 4px;
      }
      .hist-name { font-size: 13px; font-weight: 500; color: var(--c-text); }
      .hist-meta { font-size: 11px; color: var(--c-text-3); margin-top: 2px; }
    `;
    document.head.appendChild(s);
  }

  // ── Drag & Drop ──────────────────────────────────────────────
  function onDragOver(e) {
    e.preventDefault();
    document.getElementById('drop-zone').classList.add('drag-over');
  }

  function onDragLeave() {
    document.getElementById('drop-zone').classList.remove('drag-over');
  }

  function onDrop(e) {
    e.preventDefault();
    onDragLeave();
    const file = e.dataTransfer.files[0];
    if (file) _processFile(file);
  }

  function onFileSelect(e) {
    const file = e.target.files[0];
    if (file) _processFile(file);
  }

  // ── Procesamiento del ZIP ────────────────────────────────────
  async function _processFile(file) {
    if (!file.name.endsWith('.zip')) {
      App.toast('El archivo debe ser un .zip', 'error');
      return;
    }

    // Mostrar progreso
    document.getElementById('drop-title').textContent = file.name;
    document.getElementById('drop-progress').style.display = '';
    document.getElementById('result-panel').style.display = 'none';

    const msgs = [
      'Leyendo archivo ZIP...',
      'Enviando al servidor...',
      'Drive OCR procesando PDFs...',
      'Gemini extrayendo datos...',
      'Estructurando campos...',
    ];
    let msgIdx = 0;
    const msgTimer = setInterval(() => {
      if (msgIdx < msgs.length) {
        document.getElementById('progress-msg').textContent = msgs[msgIdx++];
      }
    }, 1200);

    try {
      const datos = await API.extraerZip(file, (msg) => {
        document.getElementById('progress-msg').textContent = msg;
      });

      clearInterval(msgTimer);
      _lastExtracted = { datos, filename: file.name };
      _showResult(datos, file.name);

      // Agregar al historial local
      const user = Auth.getUser();
      _historial.unshift({
        archivo: file.name,
        usuario: user ? user.email : 'usuario',
        hace: 'hace un momento',
        pdfs: Object.keys(datos).length > 0 ? '?' : 0,
      });
      _renderHistorial();

    } catch (err) {
      clearInterval(msgTimer);
      App.toast('Error al procesar el ZIP: ' + err.message, 'error');
      resetZone();
    }
  }

  function _showResult(datos, filename) {
    document.getElementById('drop-progress').style.display = 'none';

    const CAMPOS = [
      { key: 'denominacion',      label: 'Denominación' },
      { key: 'especie',           label: 'Especie' },
      { key: 'tipo_tramite',      label: 'Tipo de trámite' },
      { key: 'obtentor',          label: 'Obtentor' },
      { key: 'representante',     label: 'Representante' },
      { key: 'nota',              label: 'Nota GDE' },
      { key: 'procedencia',       label: 'Procedencia' },
      { key: 'fecha_estabilidad', label: 'Fecha estabilidad' },
      { key: 'expediente',        label: 'Nro. expediente' },
      { key: 'fecha_caratulacion',label: 'Fecha caratulación' },
      { key: 'cuit',              label: 'CUIT' },
      { key: 'razon_social',      label: 'Razón social' },
    ];

    const camposConDatos = CAMPOS.filter(c => datos[c.key]);
    const pdfCount = camposConDatos.length > 0 ? 'datos extraídos' : 'sin datos';

    document.getElementById('result-pdfs').textContent = pdfCount;
    document.getElementById('result-filename').textContent = filename;

    const fieldsEl = document.getElementById('result-fields');
    fieldsEl.innerHTML = CAMPOS.map((c, i) => `
      <div class="rf">
        <div class="rf-label">${c.label}</div>
        ${datos[c.key]
          ? `<div class="rf-value">${datos[c.key]}</div>`
          : `<div class="rf-empty">No detectado</div>`}
      </div>
    `).join('');

    document.getElementById('result-panel').style.display = '';
  }

  // ── Usar datos en formulario ──────────────────────────────────
  function usarDatos() {
    if (!_lastExtracted) return;
    const d = _lastExtracted.datos;

    // Mapeo de campos Gemini → campos del formulario de expedientes
    const MAP = {
      denominacion:      'f-den',
      especie:           'f-esp',
      nombre_botanico:   'f-bot',
      obtentor:          'f-obt',
      representante:     'f-repres',
      procedencia:       'f-origen',
      fecha_estabilidad: 'f-estab',
      nota:              'f-nota-rnc',
      razon_social:      'f-obt',   // fallback obtentor
    };

    // Navegar al módulo de expedientes y abrir formulario nuevo
    navigate('expedientes');
    ExpedientesModule.showForm();

    // Precarga con pequeño delay para que el DOM esté listo
    setTimeout(() => {
      Object.entries(MAP).forEach(([src, destId]) => {
        if (d[src]) {
          const el = document.getElementById(destId);
          if (el && !el.value) el.value = d[src];
        }
      });

      // Tipo de trámite
      if (d.tipo_tramite) {
        const tMap = { 'RNC': 1, 'RNPC': 2, 'RNC+RNPC': 3 };
        const t = tMap[d.tipo_tramite];
        if (t) ExpedientesModule.setT(t);
      }

      // Recalcular P/Pase
      ExpedientesModule.updatePpase();

      App.toast('Datos precargados desde ZIP · completá los campos faltantes');
    }, 150);
  }

  function resetZone() {
    _lastExtracted = null;
    document.getElementById('result-panel').style.display = 'none';
    document.getElementById('drop-title').textContent = 'Arrastrá el ZIP o hacé clic para seleccionar';
    document.getElementById('drop-progress').style.display = 'none';
    const input = document.getElementById('zip-input');
    if (input) input.value = '';
  }

  function _renderHistorial() {
    const el = document.getElementById('historial-list');
    if (!el) return;
    el.innerHTML = _historial.slice(0, 5).map(h => `
      <div class="hist-row">
        <span class="hist-dot"></span>
        <div>
          <div class="hist-name">${h.archivo}</div>
          <div class="hist-meta">${h.usuario} · ${h.hace} · ${h.pdfs} PDFs procesados</div>
        </div>
      </div>
    `).join('');
  }

  return { render, onDragOver, onDragLeave, onDrop, onFileSelect, usarDatos, resetZone };

})();
