/**
 * api.js — Conector frontend ↔ Google Apps Script
 *
 * Reemplaza completamente a sheets.js.
 * Todas las operaciones van a la URL del Apps Script via fetch().
 *
 * SETUP:
 *   1. En config.js, reemplazar SHEETS_API_KEY y SHEET_ID por:
 *      APPS_SCRIPT_URL: 'https://script.google.com/macros/s/XXXX/exec'
 *   2. Eliminar el import de sheets.js en index.html
 *   3. Agregar este archivo: <script src="js/api.js"></script>
 */

const API = (() => {

  // ── URL base del Apps Script ──────────────────────────────────
  function _url() {
    return CONFIG.APPS_SCRIPT_URL;
  }

  // ── GET helper ────────────────────────────────────────────────
  async function _get(path, params = {}) {
    const url = new URL(_url());
    url.searchParams.set('path', path);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, v);
      }
    });

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  // ── POST helper ───────────────────────────────────────────────
  async function _post(path, body = {}) {
    const url = new URL(_url());
    url.searchParams.set('path', path);

    // Apps Script requiere application/x-www-form-urlencoded o
    // text/plain para doPost — enviamos JSON como text/plain
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  // ══════════════════════════════════════════════════════════════
  //  EXPEDIENTES
  // ══════════════════════════════════════════════════════════════

  /**
   * Obtener todos los expedientes con filtros opcionales.
   * @param {object} filtros - { q, responsable, tipo, alerta }
   */
  async function getExpedientes(filtros = {}) {
    return _get('expedientes', filtros);
  }

  /**
   * Obtener un expediente por ID (incluye historial de estados).
   * @param {string|number} id
   */
  async function getExpediente(id) {
    return _get('expediente', { id });
  }

  /**
   * Obtener stats globales (totales, alertas).
   */
  async function getStats() {
    return _get('stats');
  }

  /**
   * Crear un nuevo expediente.
   * Agrega automáticamente: id (server-side), created_at, updated_at, origen_carga="manual"
   * @param {object} datos - campos del expediente
   */
  async function crearExpediente(datos) {
    // Agregar email del usuario logueado
    const user = Auth.getUser();
    return _post('expedientes', {
      ...datos,
      usuario: user ? user.email : '',
    });
  }

  /**
   * Actualizar un expediente existente (merge con datos actuales).
   * Registra cambio de estado en historial si cambia estado_rnc o estado_rnpc.
   * @param {object} datos - debe incluir { id }
   */
  async function actualizarExpediente(datos) {
    const user = Auth.getUser();
    return _post('expediente/update', {
      ...datos,
      usuario: user ? user.email : '',
    });
  }

  /**
   * Eliminar un expediente por ID.
   * @param {string|number} id
   */
  async function eliminarExpediente(id) {
    return _post('expediente/delete', { id });
  }

  /**
   * Obtener próximo ID disponible (para mostrar en formulario antes de guardar).
   * Nota: el ID real lo asigna el servidor — este es solo orientativo.
   */
  async function getNextId() {
    const rows = await getExpedientes();
    if (!rows.length) return 1;
    return Math.max(...rows.map(r => Number(r.id) || 0)) + 1;
  }

  // ══════════════════════════════════════════════════════════════
  //  PAGOS
  // ══════════════════════════════════════════════════════════════

  /**
   * Obtener pagos con filtros opcionales.
   * @param {object} filtros - { q, arancel }
   */
  async function getPagos(filtros = {}) {
    return _get('pagos', filtros);
  }

  /**
   * Registrar un pago.
   * @param {object} datos
   */
  async function crearPago(datos) {
    return _post('pagos', datos);
  }

  // ══════════════════════════════════════════════════════════════
  //  CATÁLOGOS
  // ══════════════════════════════════════════════════════════════

  /**
   * Buscar especies (autocomplete).
   * @param {string} q - texto de búsqueda
   */
  async function getEspecies(q = '') {
    return _get('especies', { q });
  }

  /**
   * Buscar actores/obtentores (autocomplete).
   * @param {string} q
   */
  async function getActores(q = '') {
    return _get('actores', { q });
  }

  /**
   * Obtener historial de cambios de un expediente.
   * @param {string|number} id
   */
  async function getHistorial(id) {
    return _get('historial', { id });
  }

  // ══════════════════════════════════════════════════════════════
  //  ZIP / GEMINI
  // ══════════════════════════════════════════════════════════════

  /**
   * Enviar un archivo ZIP al Apps Script para extracción con Gemini.
   * El ZIP se convierte a base64 antes de enviarlo.
   *
   * @param {File} file - objeto File del input o drag&drop
   * @param {function} onProgress - callback(mensaje) para mostrar progreso
   * @returns {object} datos extraídos { denominacion, especie, obtentor, ... }
   */
  async function extraerZip(file, onProgress) {
    if (onProgress) onProgress('Preparando archivo...');

    // Convertir File a base64
    const base64 = await _fileToBase64(file);

    if (onProgress) onProgress('Enviando al servidor...');

    const result = await _post('extraer-zip', {
      zip_b64: base64,
      filename: file.name,
    });

    if (onProgress) onProgress('Procesando con Gemini...');

    return result.datos || {};
  }

  /**
   * Sincronizar con el CSV de gestión oficial.
   * Actualiza campos oficiales (estados, resoluciones, etc.) sin tocar los datos de trabajo.
   *
   * @param {File} csvFile - archivo CSV exportado del sistema de gestión
   * @param {function} onProgress - callback(mensaje)
   */
  async function syncCSV(csvFile, onProgress) {
    if (onProgress) onProgress('Leyendo CSV...');

    const base64 = await _fileToBase64(csvFile);

    if (onProgress) onProgress('Sincronizando con Sheets...');

    const result = await _post('sync-csv', {
      csv_b64: base64,
      filename: csvFile.name,
    });

    return result;
  }

  // ══════════════════════════════════════════════════════════════
  //  HELPERS PRIVADOS
  // ══════════════════════════════════════════════════════════════

  function _fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsDataURL(file);
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  CACHE SIMPLE (reduce llamadas repetidas a Sheets)
  // ══════════════════════════════════════════════════════════════

  const _cache = {};
  const CACHE_TTL = 30000; // 30 segundos

  async function _cachedGet(key, path, params) {
    const now = Date.now();
    if (_cache[key] && (now - _cache[key].ts) < CACHE_TTL) {
      return _cache[key].data;
    }
    const data = await _get(path, params);
    _cache[key] = { data, ts: now };
    return data;
  }

  function invalidateCache(key) {
    if (key) delete _cache[key];
    else Object.keys(_cache).forEach(k => delete _cache[k]);
  }

  // Versiones con cache para catálogos que cambian poco
  async function getEspeciesCached(q = '') {
    if (q) return getEspecies(q); // búsquedas no se cachean
    return _cachedGet('especies', 'especies', {});
  }

  async function getActoresCached(q = '') {
    if (q) return getActores(q);
    return _cachedGet('actores', 'actores', {});
  }

  // API pública
  return {
    // Expedientes
    getExpedientes,
    getExpediente,
    getStats,
    crearExpediente,
    actualizarExpediente,
    eliminarExpediente,
    getNextId,
    // Pagos
    getPagos,
    crearPago,
    // Catálogos
    getEspecies,
    getEspeciesCached,
    getActores,
    getActoresCached,
    getHistorial,
    // ZIP / Gemini
    extraerZip,
    syncCSV,
    // Cache
    invalidateCache,
  };

})();
