document.addEventListener('DOMContentLoaded', () => {
    const openAppButton = document.getElementById('open-app-button');
    const closeAppButton = document.getElementById('close-app-button');
    const appContainer = document.getElementById('app-container');
    const mainPage = document.getElementById('main-page');
    const homeScreen = document.querySelector('.home-screen');
    const appGrid = document.querySelector('.app-grid');
    const dock = document.querySelector('.dock');
    const statusTime = document.getElementById('status-time');
    const statusDate = document.getElementById('status-date');
    const appTitleEl = document.querySelector('.app-header .app-title');
    const iframeEl = document.getElementById('embedded-site');
    // 壁紙ピッカーは削除（固定背景）

    function openAppFromIcon(icon) {
        const label = icon.querySelector('span');
        if (appTitleEl && label) appTitleEl.textContent = label.textContent || '';
        const url = (icon.getAttribute('data-url') || '').trim();
        if (url) {
            const isAbsoluteHttp = /^(https?:)?\/\//i.test(url) || /^[a-z][a-z0-9+.-]*:/i.test(url);
            if (isAbsoluteHttp) {
                window.open(url, '_blank');
                return;
            } else if (iframeEl) {
                iframeEl.src = url;
            }
        }
        mainPage.style.opacity = '0';
        mainPage.style.pointerEvents = 'none';
        appContainer.classList.add('active');
    }

    // 既存の先頭アプリボタン
    if (openAppButton) {
        openAppButton.addEventListener('click', () => {
            openAppFromIcon(openAppButton);
        });
    }

    // 閉じるボタンがクリックされたときの処理
    closeAppButton.addEventListener('click', () => {
        // アプリ画面を非表示にする
        appContainer.classList.remove('active');

        // メインページを再表示する
        mainPage.style.opacity = '1';
        mainPage.style.pointerEvents = 'auto'; // クリックできるようにする
    });

    // ====== ステータスバー：現在時刻と日付 ======
    function formatTime(date) {
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    }

    function formatDateJa(date) {
        const y = date.getFullYear();
        const m = date.getMonth() + 1;
        const d = date.getDate();
        const w = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
        return `${y}/${m}/${d} (${w})`;
    }

    function formatDateJaNoYear(date) {
        const m = date.getMonth() + 1;
        const d = date.getDate();
        const w = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
        return `${m}/${d} (${w})`;
    }

    function updateClock() {
        const now = new Date();
        if (statusTime) statusTime.textContent = formatTime(now);
        if (statusDate) statusDate.textContent = formatDateJa(now);
    }

    updateClock();
    // 次の分の頭に合わせ、その後は1分ごと更新
    const now = new Date();
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    setTimeout(() => {
        updateClock();
        setInterval(updateClock, 60 * 1000);
    }, Math.max(0, msToNextMinute));

    // 壁紙固定のため処理なし

    // ====== iPhone風 長押し→ドラッグで並べ替え ======
    let longPressTimer = null;
    let isEditMode = false;
    let isDragging = false;
    let dragTarget = null; // 元の要素
    let placeholder = null; // 差し込み位置用
    let ghost = null; // 追従用ゴースト
    let dragStartX = 0;
    let dragStartY = 0;
    let suppressClick = false;

    const DRAG_LONG_PRESS_MS = 300;

    function createGhost(fromEl) {
        const g = fromEl.cloneNode(true);
        g.classList.add('drag-ghost');
        document.body.appendChild(g);
        return g;
    }

    function createPlaceholder(fromEl) {
        const ph = fromEl.cloneNode(true);
        ph.classList.add('placeholder');
        return ph;
    }

    function getContainers() {
        return [appGrid, dock].filter(Boolean);
    }

    function getAllIcons() {
        // ウィジェットはドラッグ不可（アプリとドック内アイコンのみ）
        return Array.from(document.querySelectorAll('.app-grid .app-icon, .dock .app-icon'));
    }

    function pointerToElementCenter(el) {
        const rect = el.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    function findInsertIndex(container, pointX, pointY) {
        const items = Array.from(container.querySelectorAll('.app-icon:not(.placeholder), .widget:not(.placeholder)'));
        if (items.length === 0) return 0;
        let bestIndex = items.length;
        let minDist = Infinity;
        items.forEach((item, idx) => {
            const c = pointerToElementCenter(item);
            const dx = c.x - pointX;
            const dy = c.y - pointY;
            const d2 = dx * dx + dy * dy;
            if (d2 < minDist) {
                minDist = d2;
                bestIndex = pointX < c.x ? idx : idx + 1;
            }
        });
        return Math.max(0, Math.min(bestIndex, items.length));
    }

    function onPointerMove(e) {
        if (!isDragging || !ghost || !placeholder) return;
        const x = e.clientX;
        const y = e.clientY;
        ghost.style.left = x + 'px';
        ghost.style.top = y + 'px';

        // どのコンテナ上かを判定
        const container = getContainers().find(c => {
            const r = c.getBoundingClientRect();
            return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        }) || appGrid;

        // 差し込み位置を計算して移動
        const idx = findInsertIndex(container, x, y);
        const children = Array.from(container.querySelectorAll('.app-icon, .widget'));
        if (idx >= children.length) {
            container.appendChild(placeholder);
        } else {
            container.insertBefore(placeholder, children[idx]);
        }
    }

    function endDrag() {
        if (!isDragging) return;
        isDragging = false;
        suppressClick = true;
        window.setTimeout(() => suppressClick = false, 200);
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', endDrag);

        if (ghost) {
            ghost.remove();
            ghost = null;
        }
        if (placeholder && dragTarget) {
            placeholder.replaceWith(dragTarget);
            dragTarget.classList.remove('dragging');
        }
        placeholder = null;
        dragTarget = null;
        // 編集モードは維持（iPhone風）。外したい場合は以下を有効化
        homeScreen.classList.remove('edit-mode'); isEditMode = false;
    }

    function startDrag(target, startEvent) {
        isDragging = true;
        dragTarget = target;
        dragTarget.classList.add('dragging');
        placeholder = createPlaceholder(target);
        target.parentElement.replaceChild(placeholder, target);
        ghost = createGhost(target);
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', endDrag);
        onPointerMove(startEvent);
    }

    function attachDraggable(icon) {
        let pressed = false;
        let moved = false;

        icon.addEventListener('click', (e) => {
            if (suppressClick || isDragging) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);

        icon.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return; // 右クリック等は無視
            pressed = true;
            moved = false;
            dragStartX = e.clientX;
            dragStartY = e.clientY;

            longPressTimer = window.setTimeout(() => {
                if (!pressed) return;
                isEditMode = true;
                homeScreen.classList.add('edit-mode');
                startDrag(icon, e);
            }, DRAG_LONG_PRESS_MS);

            icon.setPointerCapture(e.pointerId);
        });

        icon.addEventListener('pointermove', (e) => {
            if (!pressed || isDragging) return;
            const dx = Math.abs(e.clientX - dragStartX);
            const dy = Math.abs(e.clientY - dragStartY);
            if (dx > 6 || dy > 6) {
                moved = true;
            }
        });

        function clearPress() {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            pressed = false;
            if (!isDragging && !moved) {
                // 通常クリック扱い
            }
        }

        icon.addEventListener('pointerup', clearPress);
        icon.addEventListener('pointercancel', clearPress);
        icon.addEventListener('lostpointercapture', clearPress);
    }

    // 既存アイコンにドラッグ可能を付与 + クリックで起動
    getAllIcons().forEach(icon => {
        attachDraggable(icon);
        icon.addEventListener('click', () => openAppFromIcon(icon));
    });

    // ドックやグリッドに新規追加された場合も対応したい場合はMutationObserverなどを使用
});