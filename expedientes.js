/**
 * expedientes.js — Módulo de ingreso y gestión de expedientes
 */

const ExpedientesModule = (() => {

  // ── Estado ────────────────────────────────────────────────────
  let records    = [];
  let filtered   = [];
  let page       = 1;
  let perPage    = 15;
  let sortCol    = 'id';
  let sortDir    = 1;
  let editingId  = null;
  let tVal       = null;
  let activeView = 'grid'; // 'grid' | 'form'
  let loading    = false;

  const ESPECIES = ['Agropiro','Alfalfa','Algodón','Arroz','Arveja','Avena','Cebada','Colza','Girasol','Lino','Maíz Híbrido','Papa','Poroto','Soja','Sorgo Granífero','Trigo Pan','Trigo Triticale','Vid','Zapallo','Tomate','Pimiento','Lechuga','Zanahoria','Cebolla','Ajo','Remolacha','Frambuesa','Arándano','Manzano','Peral','Durazno','Almendro','Banana','Avellano','Tabaco','Cártamo','Remolacha azucarera','Trébol','Festuca','Ryegrass'];
  const ORIGENES = ['Argentina','Francia','Alemania','Estados Unidos','Canadá','Chile','Brasil','Australia','España','Italia','Holanda','Bélgica','Bolivia','Uruguay','Paraguay','China','Corea del Sur','Japón','Israel','Sudáfrica'];
  const RESPS    = ['AAS','AB','ADP','AHB','AI / LL','AJB','ALE','FD','FM','LL','MA','RR'];

  // ── Render del HTML del módulo ────────────────────────────────
  function render() {
    const container = document.getElementById('page-expedientes');
    container.innerHTML = `
      <!-- PAGE HEADER -->
      <div class="page-header">
        <div class="page-header-left">
          <h1 id="view-title">Expedientes</h1>
          <p id="view-subtitle">Registro de ingreso EXP INGRES</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <div id="edit-bar" class="edit-bar">
            <span class="edit-dot"></span>
            Editando ID <strong id="edit-id-lbl"></strong>
          </div>
          <button class="btn" id="btn-back" style="display:none" onclick="ExpedientesModule.showGrid()">← Volver</button>
          <button class="btn primary" id="btn-nuevo" onclick="ExpedientesModule.showForm()">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Nuevo expediente
          </button>
        </div>
      </div>

      <!-- GRID VIEW -->
      <div id="view-grid">
        <div class="stats-row">
          <div class="stat-card"><div class="stat-num" id="st-total">—</div><div class="stat-lbl">Total</div></div>
          <div class="stat-card blue"><div class="stat-num" id="st-rnc">—</div><div class="stat-lbl">RNC (T=1)</div></div>
          <div class="stat-card green"><div class="stat-num" id="st-rnpc">—</div><div class="stat-lbl">RNPC (T=2)</div></div>
          <div class="stat-card amber"><div class="stat-num" id="st-ambos">—</div><div class="stat-lbl">Ambos (T=3)</div></div>
        </div>

        <div class="toolbar">
          <div class="toolbar-search">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--c-text-3)"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M9.5 9.5L12 12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            <input type="text" id="search" placeholder="Buscar NRNC, denominación, especie..." oninput="ExpedientesModule.applyFilters()" style="padding-left:32px" />
          </div>
          <select class="filter-select" id="f-t" onchange="ExpedientesModule.applyFilters()">
            <option value="">Todos los trámites</option>
            <option value="1">T=1 · RNC</option>
            <option value="2">T=2 · RNPC</option>
            <option value="3">T=3 · Ambos</option>
          </select>
          <select class="filter-select" id="f-prop" onchange="ExpedientesModule.applyFilters()">
            <option value="">Propiedad</option>
            <option value="SI">Sí</option>
            <option value="NO">No</option>
          </select>
          <button class="btn ghost" onclick="ExpedientesModule.clearFilters()">Limpiar</button>
          <span class="btn-label" id="count-lbl"></span>
          <button class="btn" onclick="ExpedientesModule.loadData()" title="Recargar desde Sheets">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 7A5 5 0 1 1 7 2M7 2l2-2M7 2L5 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>

        <div class="table-wrap">
          <table id="exp-table">
            <thead>
              <tr>
                <th onclick="ExpedientesModule.sortBy('id')"   id="th-id">ID</th>
                <th onclick="ExpedientesModule.sortBy('nrnc')" id="th-nrnc">NRNC</th>
                <th onclick="ExpedientesModule.sortBy('den')"  id="th-den">Denominación</th>
                <th onclick="ExpedientesModule.sortBy('esp')"  id="th-esp">Especie</th>
                <th>T</th>
                <th onclick="ExpedientesModule.sortBy('fin')"  id="th-fin">F. Ing. RNC</th>
                <th>Origen</th>
                <th>Obtentor</th>
                <th>Representante</th>
                <th>Prop.</th>
                <th>Cargado por</th>
                <th style="text-align:center">Acciones</th>
              </tr>
            </thead>
            <tbody id="tbody"></tbody>
          </table>
        </div>

        <div class="pagination">
          <button class="btn sm" onclick="ExpedientesModule.prevPage()">‹ Anterior</button>
          <span id="page-info" style="flex:1;text-align:center"></span>
          <button class="btn sm" onclick="ExpedientesModule.nextPage()">Siguiente ›</button>
          <select style="width:110px" id="per-page" onchange="ExpedientesModule.changePerPage()">
            <option value="15">15 / página</option>
            <option value="30">30 / página</option>
            <option value="50">50 / página</option>
          </select>
        </div>
      </div>

      <!-- FORM VIEW -->
      <div id="view-form" style="display:none">
        <div class="form-container">
          <form id="exp-form" onsubmit="ExpedientesModule.saveRecord(event)">

            <div class="form-section">
              <div class="section-label">Identificación del trámite</div>
              <div class="field-grid cols3">
                <div class="field">
                  <label>ID interno</label>
                  <input type="text" id="f-id" readonly placeholder="Asignado al guardar" />
                </div>
                <div class="field">
                  <label>NRNC <span class="req">*</span></label>
                  <input type="number" id="f-nrnc" placeholder="Ej: 19622" required oninput="ExpedientesModule.updatePpase()" />
                </div>
                <div class="field">
                  <label>P/Pase</label>
                  <input type="text" id="f-ppase" readonly placeholder="Calculado automáticamente" />
                </div>
              </div>
              <div style="margin-top:12px">
                <label style="font-size:12px;color:var(--c-text-2);font-weight:500;display:block;margin-bottom:8px">
                  Tipo de trámite (T) <span class="req">*</span>
                </label>
                <div class="t-picker">
                  <button type="button" class="t-opt" id="topt-1" onclick="ExpedientesModule.setT(1)">1 — RNC</button>
                  <button type="button" class="t-opt" id="topt-2" onclick="ExpedientesModule.setT(2)">2 — RNPC</button>
                  <button type="button" class="t-opt" id="topt-3" onclick="ExpedientesModule.setT(3)">3 — Ambos</button>
                </div>
                <div class="field-err" id="err-t"></div>
              </div>
            </div>

            <div class="form-section">
              <div class="section-label">Datos del cultivar</div>
              <div class="field-grid cols2">
                <div class="field">
                  <label>Denominación <span class="req">*</span></label>
                  <input type="text" id="f-den" placeholder="Nombre del cultivar" required oninput="ExpedientesModule.updatePpase()" />
                </div>
                <div class="field">
                  <label>Especie <span class="req">*</span></label>
                  <input type="text" id="f-esp" list="esp-dl" placeholder="Ej: Trigo Pan, Soja..." required oninput="ExpedientesModule.updatePpase()" />
                  <datalist id="esp-dl"></datalist>
                </div>
                <div class="field">
                  <label>Botánico</label>
                  <input type="text" id="f-bot" placeholder="Nombre botánico" />
                </div>
                <div class="field">
                  <label>Origen <span class="req">*</span></label>
                  <input type="text" id="f-origen" list="orig-dl" placeholder="País de origen" required />
                  <datalist id="orig-dl"></datalist>
                </div>
                <div class="field">
                  <label>Grupo</label>
                  <input type="text" id="f-grupo" placeholder="Ej: TR-III, HS, H" />
                </div>
                <div class="field">
                  <label>Evento transgénico</label>
                  <input type="text" id="f-evento" placeholder="Ej: BT11, MON-810..." />
                </div>
              </div>
            </div>

            <div class="form-section">
              <div class="section-label">Fechas de ingreso</div>
              <div class="field-grid cols2">
                <div class="field" id="wrap-fin-rnc">
                  <label>Fecha ingreso RNC <span class="req">*</span></label>
                  <input type="date" id="f-fin-rnc" />
                  <div class="field-err" id="err-fin-rnc"></div>
                </div>
                <div class="field" id="wrap-fin-rnpc">
                  <label>Fecha ingreso RNPC <span class="req">*</span></label>
                  <input type="date" id="f-fin-rnpc" />
                  <div class="field-err" id="err-fin-rnpc"></div>
                </div>
              </div>
            </div>

            <div class="form-section">
              <div class="section-label">Obtentor y representante</div>
              <div class="field-grid cols2">
                <div class="field">
                  <label>Obtentor <span class="req">*</span></label>
                  <input type="text" id="f-obt" placeholder="Razón social del obtentor" required />
                </div>
                <div class="field">
                  <label>Representante <span class="req">*</span></label>
                  <input type="text" id="f-repres" placeholder="Nombre del representante" required />
                </div>
                <div class="field">
                  <label>Propiedad <span class="req">*</span></label>
                  <select id="f-propiedad" required>
                    <option value="">— Seleccionar —</option>
                    <option value="SI">Sí</option>
                    <option value="NO">No</option>
                    <option value="PT">PT</option>
                  </select>
                </div>
                <div class="field">
                  <label>Lugar / Entidad <span class="req">*</span></label>
                  <input type="text" id="f-lugar" placeholder="Institución o lugar" required />
                </div>
              </div>
            </div>

            <div class="form-section">
              <div class="section-label">Estabilidad y comercialización</div>
              <div class="field-grid cols3">
                <div class="field">
                  <label>Estabilidad (ESTAB.) <span class="req">*</span></label>
                  <input type="text" id="f-estab" placeholder="Ej: 20/11/16 o N/A" required />
                </div>
                <div class="field">
                  <label>Comercialización (COMER) <span class="req">*</span></label>
                  <input type="text" id="f-comer" placeholder="Ej: 01/05/2018 o N/A" required />
                </div>
                <div class="field">
                  <label>Responsable <span class="req">*</span></label>
                  <select id="f-resp" required>
                    <option value="">— Seleccionar —</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="form-section">
              <div class="section-label">Seguimiento inicial</div>
              <div class="field-grid cols2">
                <div class="field" id="wrap-nota-rnc">
                  <label>NOTA RNC</label>
                  <input type="text" id="f-nota-rnc" placeholder="NO-2020-XXXXX-APN-DRV#INASE" />
                </div>
                <div class="field" id="wrap-recibo-rnc">
                  <label>Recibo RNC</label>
                  <input type="text" id="f-recibo-rnc" placeholder="Número de recibo" />
                </div>
                <div class="field" id="wrap-nota-rnpc">
                  <label>NOTA RNPC</label>
                  <input type="text" id="f-nota-rnpc" placeholder="NO-2020-XXXXX-APN-DRV#INASE" />
                </div>
                <div class="field" id="wrap-recibo-rnpc">
                  <label>Recibo RNPC</label>
                  <input type="text" id="f-recibo-rnpc" placeholder="Número de recibo" />
                </div>
                <div class="field" style="grid-column:1/-1">
                  <label>Observaciones</label>
                  <textarea id="f-obs" placeholder="Observaciones adicionales..."></textarea>
                </div>
              </div>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn primary" id="btn-save">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Guardar expediente
              </button>
              <button type="button" class="btn" onclick="ExpedientesModule.resetForm()">Limpiar</button>
              <button type="button" class="btn" onclick="ExpedientesModule.showGrid()">Cancelar</button>
              <span id="save-loading" style="font-size:12px;color:var(--c-text-3);display:none;align-items:center;gap:6px">
                Guardando...
              </span>
            </div>

          </form>
        </div>
      </div>
    `;

    _populateDataLists();
    _init();
  }

  function _populateDataLists() {
    const espDl  = document.getElementById('esp-dl');
    const origDl = document.getElementById('orig-dl');
    const respSel = document.getElementById('f-resp');

    ESPECIES.sort().forEach(e => {
      const o = document.createElement('option'); o.value = e; espDl.appendChild(o);
    });
    ORIGENES.sort().forEach(e => {
      const o = document.createElement('option'); o.value = e; origDl.appendChild(o);
    });
    RESPS.forEach(r => {
      const o = document.createElement('option'); o.value = r; o.textContent = r; respSel.appendChild(o);
    });
  }

  function _init() { loadData(); }

  // ── Cargar datos desde Sheets ─────────────────────────────────
  async function loadData() {
    const tbody = document.getElementById('tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:20px;color:var(--c-text-3)">Cargando...</td></tr>';
    try {
      records = await API.getExpedientes();
      applyFilters();
      renderStats();
    } catch(e) {
      console.error(e);
      App.toast('Error al cargar datos: ' + e.message, 'error');
      if (tbody) tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:20px;color:var(--c-text-danger)">Error al cargar. Verificar conexión.</td></tr>';
    }
  }

  // ── Vistas ────────────────────────────────────────────────────
  function showGrid() {
    document.getElementById('view-grid').style.display = '';
    document.getElementById('view-form').style.display = 'none';
    document.getElementById('btn-back').style.display  = 'none';
    document.getElementById('btn-nuevo').style.display = '';
    document.getElementById('view-title').textContent = 'Expedientes';
    document.getElementById('view-subtitle').textContent = 'Registro de ingreso EXP INGRES';
    resetForm();
    renderTable();
  }

  function showForm(rec) {
    document.getElementById('view-grid').style.display = 'none';
    document.getElementById('view-form').style.display = '';
    document.getElementById('btn-back').style.display  = '';
    document.getElementById('btn-nuevo').style.display = 'none';
    document.getElementById('view-title').textContent = rec ? 'Editar expediente' : 'Nuevo expediente';
    document.getElementById('view-subtitle').textContent = rec ? `ID ${rec.id} · ${rec.den}` : 'Completar todos los campos';
    if (rec) _fillForm(rec);
  }

  // ── Stats ─────────────────────────────────────────────────────
  function renderStats() {
    document.getElementById('st-total').textContent = records.length;
    document.getElementById('st-rnc').textContent   = records.filter(r => Number(r.t)===1).length;
    document.getElementById('st-rnpc').textContent  = records.filter(r => Number(r.t)===2).length;
    document.getElementById('st-ambos').textContent = records.filter(r => Number(r.t)===3).length;
  }

  // ── Filtros ───────────────────────────────────────────────────
  function applyFilters() {
    const q  = (document.getElementById('search')?.value  || '').toLowerCase();
    const ft = document.getElementById('f-t')?.value    || '';
    const fp = document.getElementById('f-prop')?.value || '';

    filtered = records.filter(r => {
      if (q && !`${r.id} ${r.nrnc} ${r.den} ${r.esp} ${r.obtentor} ${r.repres}`.toLowerCase().includes(q)) return false;
      if (ft && String(r.t) !== ft) return false;
      if (fp) {
        const pn = (r.propiedad || '').toUpperCase();
        if (fp==='SI' && !['SI','SÍ','S'].includes(pn)) return false;
        if (fp==='NO' && !['NO','N'].includes(pn)) return false;
      }
      return true;
    });

    _sortFiltered();
    page = 1;
    renderTable();
    const lbl = document.getElementById('count-lbl');
    if (lbl) lbl.textContent = filtered.length + ' resultado(s)';
  }

  function clearFilters() {
    ['search','f-t','f-prop'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
    applyFilters();
  }

  // ── Ordenamiento ──────────────────────────────────────────────
  function sortBy(col) {
    if (sortCol===col) sortDir*=-1; else { sortCol=col; sortDir=1; }
    document.querySelectorAll('#exp-table th').forEach(th => th.classList.remove('sort-asc','sort-desc'));
    const th = document.getElementById('th-'+col);
    if (th) th.classList.add(sortDir===1 ? 'sort-asc' : 'sort-desc');
    _sortFiltered();
    renderTable();
  }

  function _sortFiltered() {
    const map = { id:'id', nrnc:'nrnc', den:'den', esp:'esp', fin:'finRnc' };
    const k   = map[sortCol] || 'id';
    filtered.sort((a,b) => {
      const av = a[k]||'', bv = b[k]||'';
      if (!isNaN(av) && !isNaN(bv)) return sortDir * (Number(av) - Number(bv));
      return sortDir * String(av).localeCompare(String(bv), 'es');
    });
  }

  // ── Render tabla ──────────────────────────────────────────────
  function renderTable() {
    const tbody = document.getElementById('tbody');
    if (!tbody) return;
    const start = (page-1) * perPage;
    const slice = filtered.slice(start, start+perPage);
    const tLbl  = {1:'RNC',2:'RNPC',3:'Ambos'};
    const tCls  = {1:'badge-1',2:'badge-2',3:'badge-3'};

    tbody.innerHTML = slice.map(r => `
      <tr>
        <td><span style="font-family:var(--font-mono);font-size:12px">${r.id}</span></td>
        <td><strong style="font-family:var(--font-mono)">${r.nrnc}</strong></td>
        <td class="td-clip">${r.den}</td>
        <td>${r.esp}</td>
        <td><span class="badge ${tCls[r.t]||''}">${tLbl[r.t]||r.t||'—'}</span></td>
        <td>${r.finRnc||'—'}</td>
        <td>${r.origen||'—'}</td>
        <td class="td-clip">${r.obtentor||'—'}</td>
        <td class="td-clip">${r.repres||'—'}</td>
        <td>${r.propiedad||'—'}</td>
        <td style="font-size:11px;color:var(--c-text-3)">${r.cargadoPor||'—'}</td>
        <td style="text-align:center;white-space:nowrap">
          <button class="btn sm" onclick="ExpedientesModule.editRecord('${r.id}')">Editar</button>
          <button class="btn sm danger" onclick="ExpedientesModule.deleteRecord('${r.id}')" style="margin-left:4px">Eliminar</button>
        </td>
      </tr>
    `).join('');

    if (!slice.length) {
      tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:32px;color:var(--c-text-3)">No hay expedientes para mostrar</td></tr>';
    }

    const total = Math.ceil(filtered.length/perPage)||1;
    document.getElementById('page-info').textContent = `Página ${page} de ${total} · ${filtered.length} registros`;
  }

  // ── Paginación ────────────────────────────────────────────────
  function prevPage()      { if(page>1){ page--; renderTable(); } }
  function nextPage()      { const t=Math.ceil(filtered.length/perPage)||1; if(page<t){ page++; renderTable(); } }
  function changePerPage() { perPage=parseInt(document.getElementById('per-page').value); page=1; renderTable(); }

  // ── CRUD ──────────────────────────────────────────────────────
  function editRecord(id) {
    const rec = records.find(r => String(r.id)===String(id));
    if (rec) { editingId = id; showForm(rec); }
  }

  async function deleteRecord(id) {
    if (!confirm(`¿Eliminar el expediente ID ${id}? Esta acción no se puede deshacer.`)) return;
    try {
      await API.eliminarExpediente(id);
      records = records.filter(r => String(r.id)!==String(id));
      applyFilters(); renderStats();
      App.toast('Expediente eliminado');
    } catch(e) {
      App.toast('Error al eliminar: ' + e.message, 'error');
    }
  }

  async function saveRecord(e) {
    e.preventDefault();
    if (!tVal) { document.getElementById('err-t').textContent = 'Seleccioná el tipo de trámite'; return; }

    document.getElementById('save-loading').style.display = 'flex';
    document.getElementById('btn-save').disabled = true;

    try {
      let id = editingId;
      if (!id) id = await API.getNextId();

      const rec = _collectForm(id);

      if (editingId) {
        await API.actualizarExpediente(rec);
        const idx = records.findIndex(r => String(r.id)===String(editingId));
        if (idx>=0) records[idx] = rec;
        App.toast('Expediente actualizado correctamente');
      } else {
        await API.crearExpediente(rec);
        records.push(rec);
        App.toast('Expediente guardado correctamente');
      }

      applyFilters(); renderStats();
      showGrid();
    } catch(e) {
      App.toast('Error al guardar: ' + e.message, 'error');
    } finally {
      document.getElementById('save-loading').style.display = 'none';
      document.getElementById('btn-save').disabled = false;
    }
  }

  // ── Formulario ────────────────────────────────────────────────
  function setT(v) {
    tVal = v;
    [1,2,3].forEach(n => {
      const b = document.getElementById('topt-'+n);
      if (b) b.className = 't-opt' + (n===v ? ' sel-'+n : '');
    });
    document.getElementById('err-t').textContent = '';
    _updateFormByT();
  }

  function _updateFormByT() {
    const wRnc  = document.getElementById('wrap-fin-rnc');
    const wRnpc = document.getElementById('wrap-fin-rnpc');
    const wNR   = document.getElementById('wrap-nota-rnc');
    const wRR   = document.getElementById('wrap-recibo-rnc');
    const wNP   = document.getElementById('wrap-nota-rnpc');
    const wRP   = document.getElementById('wrap-recibo-rnpc');
    if (!wRnc) return;
    wRnc.style.opacity  = tVal===2 ? '0.4' : '1';
    wRnpc.style.opacity = tVal===1 ? '0.4' : '1';
    document.getElementById('f-fin-rnc').required  = tVal!==2;
    document.getElementById('f-fin-rnpc').required = tVal!==1;
    const showRnc  = !tVal || tVal===1 || tVal===3;
    const showRnpc = !tVal || tVal===2 || tVal===3;
    [wNR,wRR].forEach(w => { if(w) w.style.display = showRnc  ? '' : 'none'; });
    [wNP,wRP].forEach(w => { if(w) w.style.display = showRnpc ? '' : 'none'; });
  }

  function updatePpase() {
    const n = document.getElementById('f-nrnc')?.value   || '';
    const d = document.getElementById('f-den')?.value    || '';
    const s = document.getElementById('f-esp')?.value    || '';
    const p = document.getElementById('f-ppase');
    if (p) p.value = [n,d,s].filter(Boolean).join('   ');
  }

  function resetForm() {
    editingId = null; tVal = null;
    document.getElementById('exp-form')?.reset();
    document.getElementById('f-id').value    = '';
    document.getElementById('f-ppase').value = '';
    [1,2,3].forEach(n => { const b=document.getElementById('topt-'+n); if(b) b.className='t-opt'; });
    document.getElementById('err-t').textContent = '';
    document.getElementById('btn-save').textContent = 'Guardar expediente';
    document.getElementById('edit-bar').classList.remove('show');
    _updateFormByT();
  }

  function _fillForm(rec) {
    const set = (id, val) => { const el=document.getElementById(id); if(el) el.value=val||''; };
    set('f-id',       rec.id);
    set('f-nrnc',     rec.nrnc);
    set('f-den',      rec.den);
    set('f-esp',      rec.esp);
    set('f-bot',      rec.bot);
    set('f-ppase',    rec.ppase);
    set('f-fin-rnc',  rec.finRnc);
    set('f-fin-rnpc', rec.finRnpc);
    set('f-origen',   rec.origen);
    set('f-propiedad',rec.propiedad);
    set('f-obt',      rec.obtentor);
    set('f-repres',   rec.repres);
    set('f-lugar',    rec.lugar);
    set('f-estab',    rec.estab);
    set('f-comer',    rec.comer);
    set('f-grupo',    rec.grupo);
    set('f-evento',   rec.evento);
    set('f-resp',     rec.resp);
    set('f-nota-rnc', rec.notaRnc);
    set('f-recibo-rnc',rec.reciboRnc);
    set('f-nota-rnpc',rec.notaRnpc);
    set('f-recibo-rnpc',rec.reciboRnpc);
    set('f-obs',      rec.obs);
    setT(Number(rec.t) || rec.t);
    document.getElementById('btn-save').textContent = 'Actualizar expediente';
    document.getElementById('edit-id-lbl').textContent = rec.id;
    document.getElementById('edit-bar').classList.add('show');
  }

  function _collectForm(id) {
    const g = (fid) => document.getElementById(fid)?.value || '';
    return {
      id, nrnc: g('f-nrnc'), den: g('f-den'), esp: g('f-esp'),
      bot: g('f-bot'), ppase: g('f-ppase'), t: tVal,
      finRnc: g('f-fin-rnc'), finRnpc: g('f-fin-rnpc'),
      origen: g('f-origen'), propiedad: g('f-propiedad'),
      obtentor: g('f-obt'), repres: g('f-repres'), lugar: g('f-lugar'),
      estab: g('f-estab'), comer: g('f-comer'), grupo: g('f-grupo'),
      evento: g('f-evento'), resp: g('f-resp'),
      notaRnc: g('f-nota-rnc'), reciboRnc: g('f-recibo-rnc'),
      notaRnpc: g('f-nota-rnpc'), reciboRnpc: g('f-recibo-rnpc'),
      obs: g('f-obs'),
      cargadoPor: Auth.getUser()?.email || '',
    };
  }

  return {
    render, loadData, applyFilters, clearFilters, sortBy,
    prevPage, nextPage, changePerPage,
    editRecord, deleteRecord, saveRecord,
    setT, updatePpase, resetForm, showGrid, showForm,
  };

})();
