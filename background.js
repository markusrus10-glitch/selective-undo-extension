// ─── Хранилище истории действий ───────────────────────────────────────────────
const MAX_ACTIONS = 80;
let actionHistory = [];
let actionIdCounter = 0;

// Кэш вкладок: tabId → { url, title, index, windowId }
const tabCache = new Map();

// Буфер навигации: tabId → { prevUrl, prevTitle }
// нужен чтобы поймать URL до и после перехода
const navBuffer = new Map();

// ─── Инициализация ─────────────────────────────────────────────────────────────
// Восстанавливаем историю из storage (сохраняется между перезапусками SW)
chrome.storage.local.get('actionHistory', (data) => {
  actionHistory = data.actionHistory || [];
  actionIdCounter = actionHistory.length;
});

// Заполняем кэш текущими вкладками
chrome.tabs.query({}, (tabs) => {
  tabs.forEach((tab) => {
    tabCache.set(tab.id, {
      url: tab.url || '',
      title: tab.title || tab.url || 'Без названия',
      index: tab.index,
      windowId: tab.windowId,
    });
  });
});

// ─── Вспомогательные функции ──────────────────────────────────────────────────
function makeId() {
  return `a_${Date.now()}_${++actionIdCounter}`;
}

function shortenUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname !== '/' ? u.pathname.slice(0, 24) : '';
    return u.hostname + path;
  } catch {
    return url.slice(0, 40);
  }
}

function isSystemUrl(url) {
  return (
    !url ||
    url.startsWith('about:') ||
    url.startsWith('chrome:') ||
    url.startsWith('chrome-extension:') ||
    url.startsWith('browser:') ||
    url.startsWith('yandexbrowser:')
  );
}

function addAction(action) {
  action.id = makeId();
  action.timestamp = Date.now();
  action.undone = false;
  actionHistory.unshift(action);
  if (actionHistory.length > MAX_ACTIONS) {
    actionHistory = actionHistory.slice(0, MAX_ACTIONS);
  }
  chrome.storage.local.set({ actionHistory });
}

// ─── Слушатели вкладок ────────────────────────────────────────────────────────

// Вкладка создана
chrome.tabs.onCreated.addListener((tab) => {
  tabCache.set(tab.id, {
    url: tab.url || '',
    title: tab.title || 'Новая вкладка',
    index: tab.index,
    windowId: tab.windowId,
  });
});

// Вкладка обновлена (навигация)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // При смене URL — сохраняем предыдущий адрес в буфер
  if (changeInfo.url) {
    const prev = tabCache.get(tabId);
    if (prev && prev.url && prev.url !== changeInfo.url && !isSystemUrl(prev.url) && !isSystemUrl(changeInfo.url)) {
      navBuffer.set(tabId, { prevUrl: prev.url, prevTitle: prev.title || shortenUrl(prev.url) });
    }
    // Обновляем кэш
    const cached = tabCache.get(tabId) || {};
    tabCache.set(tabId, { ...cached, url: changeInfo.url });
  }

  // Когда страница загрузилась — фиксируем навигацию
  if (changeInfo.status === 'complete') {
    const nav = navBuffer.get(tabId);
    if (nav) {
      navBuffer.delete(tabId);
      const newTitle = tab.title || shortenUrl(tab.url || '');
      addAction({
        type: 'navigation',
        tabId,
        prevUrl: nav.prevUrl,
        prevTitle: nav.prevTitle,
        newUrl: tab.url || '',
        newTitle,
        label: `Переход: ${nav.prevTitle} → ${newTitle}`,
      });
    }
    // Обновляем заголовок в кэше
    const cached = tabCache.get(tabId) || {};
    tabCache.set(tabId, { ...cached, title: tab.title || cached.title });
  }
});

// Вкладка закрыта
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  const info = tabCache.get(tabId);
  if (info && info.url && !isSystemUrl(info.url)) {
    addAction({
      type: 'tab_closed',
      url: info.url,
      title: info.title || shortenUrl(info.url),
      index: info.index,
      windowId: info.windowId,
      label: `Закрыта вкладка: ${info.title || shortenUrl(info.url)}`,
    });
  }
  tabCache.delete(tabId);
  navBuffer.delete(tabId);
});

// Вкладка перемещена
chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
  const cached = tabCache.get(tabId);
  if (cached) tabCache.set(tabId, { ...cached, index: moveInfo.toIndex });
});

// ─── Обработка сообщений от content script ─────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_HISTORY') {
    sendResponse({ history: actionHistory.filter((a) => !a.undone).slice(0, 40) });
    return true;
  }

  if (message.type === 'UNDO_ACTIONS') {
    undoActions(message.actionIds).then((result) => sendResponse(result));
    return true;
  }

  if (message.type === 'CLEAR_HISTORY') {
    actionHistory = [];
    chrome.storage.local.set({ actionHistory });
    sendResponse({ success: true });
    return true;
  }
});

// ─── Выборочная отмена ────────────────────────────────────────────────────────
async function undoActions(actionIds) {
  const toUndo = actionHistory.filter((a) => actionIds.includes(a.id));
  const results = [];

  for (const action of toUndo) {
    try {
      if (action.type === 'tab_closed') {
        // Восстанавливаем закрытую вкладку
        await chrome.tabs.create({ url: action.url });
        action.undone = true;
        results.push({ id: action.id, success: true });

      } else if (action.type === 'navigation') {
        // Навигация назад к предыдущему URL
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find((t) => t.id === action.tabId);
        if (tab) {
          await chrome.tabs.update(action.tabId, { url: action.prevUrl });
        } else {
          // Вкладки уже нет — открываем предыдущий URL в новой
          await chrome.tabs.create({ url: action.prevUrl });
        }
        action.undone = true;
        results.push({ id: action.id, success: true });
      }
    } catch (e) {
      results.push({ id: action.id, success: false, error: e.message });
    }
  }

  chrome.storage.local.set({ actionHistory });
  return { results };
}
