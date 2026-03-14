(function () {
  'use strict';

  // Защита от двойного запуска
  if (document.getElementById('su-host')) return;

  // Ждём document.body если вдруг не готов
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', init);
    return;
  }
  init();

  function init() {
    if (document.getElementById('su-host')) return;

    // ─── Shadow DOM — полная изоляция от стилей сайта ──────────────────────────
    const host = document.createElement('div');
    host.id = 'su-host';
    host.style.cssText = [
      'position:fixed',
      'bottom:24px',
      'right:24px',
      'z-index:2147483647',
      'width:0',
      'height:0',
      'overflow:visible',
      'pointer-events:none',
      'all:initial',
    ].join(';');
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    // ─── Стили внутри Shadow DOM (сайт не может их сломать) ────────────────────
    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; }

      :host-context(body) {}

      #wrap {
        position: fixed;
        bottom: 24px;
        right: 24px;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 10px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        font-size: 13px;
        z-index: 2147483647;
      }

      /* ── FAB ── */
      #fab {
        pointer-events: all;
        width: 52px;
        height: 52px;
        background: rgba(14, 14, 18, 0.84);
        backdrop-filter: blur(16px) saturate(160%);
        -webkit-backdrop-filter: blur(16px) saturate(160%);
        border: 1.5px solid rgba(255,255,255,0.14);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #fff;
        box-shadow: 0 4px 22px rgba(0,0,0,0.5);
        transition: transform .18s, background .18s, box-shadow .18s;
        user-select: none;
      }
      #fab:hover { background: rgba(36,36,44,0.94); transform: scale(1.1); box-shadow: 0 6px 30px rgba(0,0,0,0.6); }
      #fab.active { background: rgba(60,100,230,0.88); transform: scale(1.06); }
      #fab svg { width: 23px; height: 23px; display: block; }

      /* ── Панель ── */
      #panel {
        pointer-events: all;
        width: 330px;
        background: rgba(14, 14, 18, 0.92);
        backdrop-filter: blur(22px) saturate(180%);
        -webkit-backdrop-filter: blur(22px) saturate(180%);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 18px;
        box-shadow: 0 14px 44px rgba(0,0,0,0.6);
        color: #fff;
        overflow: hidden;
        animation: slidein .17s ease;
      }
      #panel.hidden { display: none; }

      @keyframes slidein {
        from { opacity:0; transform: translateY(10px) scale(.97); }
        to   { opacity:1; transform: translateY(0) scale(1); }
      }

      /* ── Шапка ── */
      #hdr {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      #hdr span { font-weight:600; font-size:13px; color:rgba(255,255,255,.92); }
      #close-btn {
        background: none;
        border: none;
        color: rgba(255,255,255,.4);
        cursor: pointer;
        font-size: 14px;
        padding: 3px 7px;
        border-radius: 6px;
        transition: color .15s, background .15s;
        line-height: 1;
      }
      #close-btn:hover { color:#fff; background:rgba(255,255,255,.1); }

      /* ── Подсказка ── */
      #tip {
        padding: 7px 16px;
        font-size: 11px;
        color: rgba(160,185,255,.75);
        background: rgba(80,110,230,.07);
        border-bottom: 1px solid rgba(255,255,255,.06);
      }

      /* ── Список ── */
      #lst {
        max-height: 290px;
        overflow-y: auto;
        padding: 6px 8px;
      }
      #lst::-webkit-scrollbar { width:4px; }
      #lst::-webkit-scrollbar-track { background:transparent; }
      #lst::-webkit-scrollbar-thumb { background:rgba(255,255,255,.18); border-radius:2px; }

      .empty { text-align:center; color:rgba(255,255,255,.3); padding:24px; font-size:12px; }
      .err   { color:rgba(255,100,100,.7); }

      /* ── Элемент истории ── */
      .item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 10px;
        border-radius: 10px;
        margin: 2px 0;
        cursor: pointer;
        transition: background .12s;
        user-select: none;
      }
      .item:hover { background: rgba(255,255,255,.06); }
      .item.sel   { background: rgba(80,125,255,.18); }

      .item input[type=checkbox] {
        width:15px; height:15px;
        cursor:pointer;
        accent-color:#5b8aff;
        flex-shrink:0;
      }
      .ico { font-size:14px; flex-shrink:0; width:18px; text-align:center; }
      .info { display:flex; flex-direction:column; flex:1; min-width:0; }
      .lbl { font-size:12px; color:rgba(255,255,255,.85); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .tm  { font-size:10px; color:rgba(255,255,255,.32); margin-top:1px; }

      /* ── Подвал ── */
      #ftr {
        display:flex; gap:8px;
        padding:12px 14px;
        border-top:1px solid rgba(255,255,255,.07);
      }
      #undo-btn {
        flex:1; padding:9px 12px;
        background:rgba(80,130,255,.75);
        color:#fff; border:none; border-radius:10px;
        cursor:pointer; font-size:12px; font-weight:600;
        transition: background .15s, opacity .15s;
      }
      #undo-btn:hover:not(:disabled) { background:rgba(80,130,255,.95); }
      #undo-btn:disabled { background:rgba(80,130,255,.2); color:rgba(255,255,255,.3); cursor:not-allowed; }

      #clr-btn {
        padding:9px 12px;
        background:rgba(255,255,255,.07);
        color:rgba(255,255,255,.5); border:none; border-radius:10px;
        cursor:pointer; font-size:12px;
        transition: background .15s, color .15s;
      }
      #clr-btn:hover { background:rgba(255,255,255,.14); color:#fff; }
    `;

    // ─── HTML разметка ──────────────────────────────────────────────────────────
    const wrap = document.createElement('div');
    wrap.id = 'wrap';
    wrap.innerHTML = `
      <div id="fab" title="Selective Undo — выборочная отмена">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62
                   c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5
                   l2.37-.78C21.08 11.03 17.15 8 12.5 8z" fill="currentColor"/>
        </svg>
      </div>
      <div id="panel" class="hidden">
        <div id="hdr">
          <span>История действий</span>
          <button id="close-btn">✕</button>
        </div>
        <div id="tip">Отмечай ненужные действия и нажимай «Откатить»</div>
        <div id="lst"></div>
        <div id="ftr">
          <button id="undo-btn" disabled>↩ Откатить выбранные</button>
          <button id="clr-btn">Очистить</button>
        </div>
      </div>
    `;

    shadow.appendChild(style);
    shadow.appendChild(wrap);

    // ─── Ссылки на элементы ─────────────────────────────────────────────────────
    const fab      = shadow.getElementById('fab');
    const panel    = shadow.getElementById('panel');
    const closeBtn = shadow.getElementById('close-btn');
    const lst      = shadow.getElementById('lst');
    const undoBtn  = shadow.getElementById('undo-btn');
    const clrBtn   = shadow.getElementById('clr-btn');

    let open = false;
    let selected = new Set();

    // ─── Открыть / закрыть ─────────────────────────────────────────────────────
    function openPanel() {
      open = true;
      panel.classList.remove('hidden');
      fab.classList.add('active');
      loadHistory();
    }
    function closePanel() {
      open = false;
      panel.classList.add('hidden');
      fab.classList.remove('active');
    }

    fab.addEventListener('click', (e) => { e.stopPropagation(); open ? closePanel() : openPanel(); });
    closeBtn.addEventListener('click', closePanel);

    document.addEventListener('click', (e) => {
      if (open && !host.contains(e.target)) closePanel();
    }, true);

    // ─── Загрузка истории ───────────────────────────────────────────────────────
    function loadHistory() {
      lst.innerHTML = '<div class="empty">Загрузка…</div>';
      try {
        chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, (resp) => {
          if (chrome.runtime.lastError) {
            lst.innerHTML = '<div class="empty err">⚠ Ошибка — перезагрузи страницу (F5)</div>';
            return;
          }
          renderList((resp && resp.history) || []);
        });
      } catch (e) {
        lst.innerHTML = '<div class="empty err">⚠ Расширение не отвечает</div>';
      }
    }

    // ─── Отрисовка ─────────────────────────────────────────────────────────────
    function renderList(history) {
      selected.clear();
      undoBtn.disabled = true;

      if (!history.length) {
        lst.innerHTML = '<div class="empty">История пуста — попереключайся между вкладками</div>';
        return;
      }

      lst.innerHTML = history.map((a) => {
        const ico   = a.type === 'tab_closed' ? '🗕' : '↗';
        const label = esc(a.label || a.type);
        const time  = fmt(a.timestamp);
        return `<div class="item" data-id="${a.id}">
          <input type="checkbox" />
          <span class="ico">${ico}</span>
          <span class="info">
            <span class="lbl">${label}</span>
            <span class="tm">${time}</span>
          </span>
        </div>`;
      }).join('');

      lst.querySelectorAll('.item').forEach((el) => {
        el.addEventListener('click', () => {
          const cb = el.querySelector('input');
          cb.checked = !cb.checked;
          const id = el.dataset.id;
          cb.checked ? (selected.add(id), el.classList.add('sel'))
                     : (selected.delete(id), el.classList.remove('sel'));
          undoBtn.disabled = selected.size === 0;
        });
      });
    }

    // ─── Откат ─────────────────────────────────────────────────────────────────
    undoBtn.addEventListener('click', () => {
      if (!selected.size) return;
      undoBtn.disabled = true;
      undoBtn.textContent = '…';
      try {
        chrome.runtime.sendMessage(
          { type: 'UNDO_ACTIONS', actionIds: Array.from(selected) },
          () => {
            undoBtn.textContent = '↩ Откатить выбранные';
            selected.clear();
            loadHistory();
          }
        );
      } catch { undoBtn.textContent = '↩ Откатить выбранные'; }
    });

    // ─── Очистка ───────────────────────────────────────────────────────────────
    clrBtn.addEventListener('click', () => {
      try {
        chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' }, () => {
          selected.clear();
          renderList([]);
        });
      } catch {}
    });

    // ─── Утилиты ───────────────────────────────────────────────────────────────
    function fmt(ts) {
      return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    function esc(s) {
      const d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }
  }
})();
