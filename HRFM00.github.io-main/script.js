// 月表示（縦=名前、横=日付(曜日)）
function displayMonthlyMatrixShiftData() {
    const shiftData = document.getElementById('shiftData');
    const pagination = document.getElementById('pagination');
    const today = new Date();
    const monthStart = window.currentMonthStart || new Date(today.getFullYear(), today.getMonth(), 1);
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const monthEnd = new Date(year, month + 1, 0);
    const numDays = monthEnd.getDate();

    const jpDow = ['日','月','火','水','木','金','土'];
    const days = Array.from({ length: numDays }, (_, i) => new Date(year, month, i + 1));

    // 名前一覧（社員→バイト、五十音ソート）
    const allNames = [...new Set(filteredData.map(x => x.name))];
    const employeeNames = allNames.filter(n => EMPLOYEE_NAMES.includes(n)).sort((a,b)=>String(a).localeCompare(String(b),'ja'));
    const partTimerNames = allNames.filter(n => !EMPLOYEE_NAMES.includes(n)).sort((a,b)=>String(a).localeCompare(String(b),'ja'));

    const title = `${year}年${month + 1}月`;
    let html = `<div class="weekly-header"><h3><i class=\"fas fa-calendar\"></i> ${title}</h3></div>`;

    const buildMatrix = (sectionTitle, names) => {
        if (names.length === 0) return '';
        let matrix = `<div class=\"weekly-matrix\"><h4 style=\"margin:8px 0;\">${sectionTitle}</h4><div class=\"shift-table-wrapper\"><table class=\"shift-table\"><thead><tr>`;
        matrix += `<th style=\"min-width:120px;\">名前</th>`;
        days.forEach(d => { matrix += `<th style=\"min-width:110px;\">${d.getMonth()+1}/${d.getDate()}(${jpDow[d.getDay()]})</th>`; });
        matrix += `</tr></thead><tbody>`;
        names.forEach(n => {
            matrix += `<tr>`;
            matrix += `<td>${n}</td>`;
            days.forEach(d => {
                const ymd = dateToYYYYMMDD(d);
                const rec = filteredData.find(x => x.name === n && x.date === ymd);
                if (!rec) {
                    matrix += `<td>-</td>`;
                } else {
                    const storeIn = getStoreNameFromColor(rec.check_in_color || '#FFFFFF');
                    const storeOut = getStoreNameFromColor(rec.check_out_color || '#FFFFFF');
                    const isRest = (storeIn === '休み' || storeIn === '欠勤' || storeOut === '休み' || storeOut === '欠勤');
                    const isTokorozawa = (storeIn === '所沢店' || storeOut === '所沢店' || rec.check_in_color === '#FADADE' || rec.check_out_color === '#FADADE');
                    const tdStyle = isTokorozawa ? ' style="background-color:#FFB6C1;"' : '';
                    if (isRest) {
                        matrix += `<td>休み</td>`;
                    } else {
                        const cell = `${rec.check_in_time || ''}${rec.check_in_time ? ' - ' : ''}${rec.check_out_time || ''}`;
                        matrix += `<td${tdStyle}>${cell || '-'}</td>`;
                    }
                }
            });
            matrix += `</tr>`;
        });
        matrix += `</tbody></table></div></div>`;
        return matrix;
    };

    html += buildMatrix('社員', employeeNames);
    html += buildMatrix('バイト', partTimerNames);

    shiftData.innerHTML = html;
    if (pagination) pagination.style.display = 'none';
}
// Supabaseクライアントの取得（supabase-config.jsから）
let supabase = null;

// Supabaseクライアントの初期化
function initializeSupabaseClient() {
    if (typeof getSupabaseClient === 'function') {
        supabase = getSupabaseClient();
        if (supabase) {
            console.log('Supabaseクライアントが正常に初期化されました');
        } else {
            console.error('Supabaseクライアントの初期化に失敗しました');
        }
    } else {
        console.error('getSupabaseClient関数が見つかりません。supabase-config.jsが正しく読み込まれているか確認してください。');
    }
}

// DOM要素の取得（重複宣言を避ける）
let pages = null;

// pages変数を初期化する関数
function initializePages() {
    pages = document.querySelectorAll('.page');
    console.log('pages変数を初期化しました:', pages.length, '個のページ');
}

// シフト管理関連の変数
let selectedFiles = [];
let uploadedFiles = [];
// 社員名リスト（社員を最初に表示するために使用。必要に応じて編集してください）
const EMPLOYEE_NAMES = ['タンタン','チョウ ショウ', 'チョウ　チオ', 'テイ シンセイ', '石井　彩子'];
let excelData = null;
let exceljsWorkbook = null; // ExcelJSでのワークブック保持（色取得用）
let exceljsLoadPromise = null; // ExcelJS読込の完了待ち
let currentSheet = null;
let currentData = null;
let processedShiftData = null;
let allShiftData = [];
let filteredData = [];
let currentPage = 1;
const itemsPerPage = 20;

// 色から店舗/状態へのマッピング（仕様に合わせて更新）
const COLOR_TO_STORE = {
    '#FADADE': '所沢店',
    '#E0EBF6': '入間店',
    '#D9E1F4': '入間店',
    '#DEEBF7': '入間店',
    '#DAE3F3': '入間店',
    '#FDFF9E': '入間店(出張)',
    '#E5EEDB': '入間店(締め作業)',
    '#E2F0D9': '入間店(締め作業)',
    '#404040': '休み',
    '#FF0000': '欠勤',
    '#FFFFFF': '入間店'
};

// 除外する項目のリスト
const EXCLUDED_ITEMS = [
    '曜日',
    '入間店日割り予算',
    '所沢店日割り予算',
    '日程',
    '所沢出勤人数',
    '入間出勤人数',
    '出勤日数'
];

// ログイン状態管理
let isLoggedIn = false;
let currentUser = null;
// 他モジュール互換用にグローバルへも同期
window.currentUser = null;

// ドロップダウン制御
function toggleNotificationDropdown() {
    const dropdown = document.getElementById('notification-dropdown');
    const accountDropdown = document.getElementById('account-dropdown');
    const navMenuDropdown = document.getElementById('nav-menu-dropdown');
    
    // 他のドロップダウンを閉じる
    if (accountDropdown) {
        accountDropdown.classList.remove('active');
    }
    if (navMenuDropdown) {
        navMenuDropdown.classList.remove('active');
    }
    
    // 通知ドロップダウンの切り替え
    if (dropdown) {
        const isActive = dropdown.classList.contains('active');
        
        // すべてのドロップダウンを一旦閉じる
        closeAllDropdowns();
        
        // アクティブでない場合のみ開く
        if (!isActive) {
            dropdown.classList.add('active');
            
            // モバイル対応：オーバーレイの追加
            if (window.innerWidth <= 768) {
                addMobileOverlay();
            }
        }
    }
}

function toggleAccountDropdown() {
    const dropdown = document.getElementById('account-dropdown');
    const notificationDropdown = document.getElementById('notification-dropdown');
    const navMenuDropdown = document.getElementById('nav-menu-dropdown');
    
    // 他のドロップダウンを閉じる
    if (notificationDropdown) {
        notificationDropdown.classList.remove('active');
    }
    if (navMenuDropdown) {
        navMenuDropdown.classList.remove('active');
    }
    
    // アカウントドロップダウンの切り替え
    if (dropdown) {
        const isActive = dropdown.classList.contains('active');
        
        // すべてのドロップダウンを一旦閉じる
        closeAllDropdowns();
        
        // アクティブでない場合のみ開く
        if (!isActive) {
            dropdown.classList.add('active');
            
            // モバイル対応：オーバーレイの追加
            if (window.innerWidth <= 768) {
                addMobileOverlay();
            }
        }
    }
}

// ナビゲーションメニューの切り替え
function toggleNavMenu() {
    const dropdown = document.getElementById('nav-menu-dropdown');
    const notificationDropdown = document.getElementById('notification-dropdown');
    const accountDropdown = document.getElementById('account-dropdown');
    
    // 他のドロップダウンを閉じる
    if (notificationDropdown) {
        notificationDropdown.classList.remove('active');
    }
    if (accountDropdown) {
        accountDropdown.classList.remove('active');
    }
    
    // ナビゲーションメニューの切り替え
    if (dropdown) {
        const isActive = dropdown.classList.contains('active');
        
        // すべてのドロップダウンを一旦閉じる
        closeAllDropdowns();
        
        // アクティブでない場合のみ開く
        if (!isActive) {
            dropdown.classList.add('active');
            
            // モバイル対応：オーバーレイの追加
            if (window.innerWidth <= 768) {
                addMobileOverlay();
            }
        }
    }
}

// モバイルオーバーレイを追加
function addMobileOverlay() {
    // オーバーレイを無効化する場合は早期リターン
    if (window.disableMobileOverlay) {
        return;
    }
    
    let overlay = document.querySelector('.mobile-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'mobile-overlay';
        document.body.appendChild(overlay);
        
        // オーバーレイクリック時の処理を追加
        overlay.addEventListener('click', function() {
            closeAllDropdowns();
            removeMobileOverlay();
        });
        
        // タッチイベントの処理を改良
        overlay.addEventListener('touchstart', function(e) {
            e.preventDefault();
            closeAllDropdowns();
            removeMobileOverlay();
        }, { passive: false });
        
        // スクロール防止
        overlay.addEventListener('touchmove', function(e) {
            e.preventDefault();
        }, { passive: false });
    }
    
    overlay.classList.add('active');
    
    // body のスクロールを一時的に無効化
    document.body.style.overflow = 'hidden';
}

// モバイルオーバーレイを削除
function removeMobileOverlay() {
    const overlay = document.querySelector('.mobile-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
    
    // body のスクロールを復元
    document.body.style.overflow = '';
}

// すべてのドロップダウンを閉じる
function closeAllDropdowns() {
    const notificationDropdown = document.getElementById('notification-dropdown');
    const accountDropdown = document.getElementById('account-dropdown');
    const navMenuDropdown = document.getElementById('nav-menu-dropdown');
    
    if (notificationDropdown) {
        notificationDropdown.classList.remove('active');
    }
    if (accountDropdown) {
        accountDropdown.classList.remove('active');
    }
    if (navMenuDropdown) {
        navMenuDropdown.classList.remove('active');
    }
    
    removeMobileOverlay();
}

// オーバーレイを完全に無効化する関数
function disableMobileOverlay() {
    window.disableMobileOverlay = true;
    removeMobileOverlay();
    console.log('モバイルオーバーレイを無効化しました');
}

// オーバーレイを有効化する関数
function enableMobileOverlay() {
    window.disableMobileOverlay = false;
    console.log('モバイルオーバーレイを有効化しました');
}

// オーバーレイ設定を切り替える関数
function toggleOverlaySettings() {
    if (window.disableMobileOverlay) {
        enableMobileOverlay();
        showNotification('オーバーレイを有効化しました', 'info');
    } else {
        disableMobileOverlay();
        showNotification('オーバーレイを無効化しました', 'info');
    }
}

// ドロップダウン外クリックで閉じる
document.addEventListener('click', function(event) {
    const notificationWrapper = document.querySelector('.notification-icon-wrapper');
    const accountWrapper = document.querySelector('.account-icon-wrapper');
    const navMenuWrapper = document.querySelector('.nav-menu-wrapper');
    
    if (notificationWrapper && !notificationWrapper.contains(event.target)) {
        const dropdown = document.getElementById('notification-dropdown');
        if (dropdown) {
            dropdown.classList.remove('active');
        }
    }
    
    if (accountWrapper && !accountWrapper.contains(event.target)) {
        const dropdown = document.getElementById('account-dropdown');
        if (dropdown) {
            dropdown.classList.remove('active');
        }
    }
    
    if (navMenuWrapper && !navMenuWrapper.contains(event.target)) {
        const dropdown = document.getElementById('nav-menu-dropdown');
        if (dropdown) {
            dropdown.classList.remove('active');
        }
    }
    
    // モバイルオーバーレイが表示されている場合は削除
    if (document.querySelector('.mobile-overlay.active')) {
        removeMobileOverlay();
    }
});

// タッチイベントでもドロップダウンを閉じる
document.addEventListener('touchstart', function(event) {
    const notificationWrapper = document.querySelector('.notification-icon-wrapper');
    const accountWrapper = document.querySelector('.account-icon-wrapper');
    const navMenuWrapper = document.querySelector('.nav-menu-wrapper');
    
    // ドロップダウン外をタッチした場合はメニューを閉じる
    if (notificationWrapper && !notificationWrapper.contains(event.target) &&
        accountWrapper && !accountWrapper.contains(event.target) &&
        navMenuWrapper && !navMenuWrapper.contains(event.target)) {
        
        const hasActiveDropdown = document.querySelector('.notification-dropdown.active') ||
                                document.querySelector('.account-dropdown.active') ||
                                document.querySelector('.nav-menu-dropdown.active');
        
        if (hasActiveDropdown) {
            closeAllDropdowns();
            removeMobileOverlay();
        }
    }
}, { passive: true });

// ログイン状態をチェックする関数
function checkLoginStatus() {
    console.log('checkLoginStatus: ログイン状態を確認中');
    
    // userAuthUtilsのgetSessionメソッドを使用
    if (window.userAuthUtils) {
        const user = window.userAuthUtils.getSession();
        if (user) {
            currentUser = user;
            window.currentUser = currentUser;
            isLoggedIn = true;
            console.log('ログイン済みユーザー:', currentUser);
            showMainContent();
        } else {
            console.log('ログインしていません - ログインフォームを表示');
            showLoginForm();
        }
    } else {
        // userAuthUtilsが利用できない場合は従来の方法を使用
        const savedUser = localStorage.getItem('currentUser');
        console.log('保存されたユーザー情報:', savedUser);
        
        if (savedUser) {
            try {
                const user = JSON.parse(savedUser);
                
                // UUID形式のIDが含まれている場合はセッションをクリア
                if (user && user.id && typeof user.id === 'string' && user.id.includes('-')) {
                    console.warn('UUID形式のIDが検出されました。セッションをクリアします。');
                    localStorage.removeItem('currentUser');
                    localStorage.removeItem('loginTime');
                    showLoginForm();
                    return;
                }
                
                currentUser = user;
                window.currentUser = currentUser;
                isLoggedIn = true;
                console.log('ログイン済みユーザー:', currentUser);
                showMainContent();
            } catch (error) {
                console.error('ユーザー情報の解析に失敗:', error);
                localStorage.removeItem('currentUser');
                showLoginForm();
            }
        } else {
            console.log('ログインしていません - ログインフォームを表示');
            showLoginForm();
        }
    }
}

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded: 初期化開始');
    
    // モバイルオーバーレイの設定（必要に応じて変更）
    window.disableMobileOverlay = false; // trueにするとオーバーレイを無効化
    
    // pages変数の初期化
    initializePages();
    
    // Supabaseクライアントの初期化
    initializeSupabaseClient();
    
    // ログイン状態の確認
    checkLoginStatus();
    
    // ログインフォームのイベントリスナー
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        console.log('ログインフォームが見つかりました');
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            login();
        });
    } else {
        console.error('ログインフォームが見つかりません');
    }
    
    // デバッグ用：現在の表示状態を確認
    setTimeout(() => {
        const authContainer = document.getElementById('auth-container');
        const navbar = document.getElementById('navbar');
        const mainContent = document.getElementById('main-content');
        
        console.log('表示状態確認:');
        console.log('auth-container:', authContainer ? authContainer.style.display : '要素が見つかりません');
        console.log('navbar:', navbar ? navbar.style.display : '要素が見つかりません');
        console.log('main-content:', mainContent ? mainContent.style.display : '要素が見つかりません');
        
        // ページの表示状態も確認
        const homePage = document.getElementById('home');
        const allPages = document.querySelectorAll('.page');
        console.log('ページの表示状態:');
        console.log('homeページ:', homePage ? homePage.classList.contains('active') : '要素が見つかりません');
        console.log('全ページ数:', allPages.length);
        allPages.forEach((page, index) => {
            console.log(`ページ${index + 1}:`, page.id, 'active:', page.classList.contains('active'));
        });
    }, 1000);
});

// メッセージ表示
function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `message ${type}`;
        element.style.display = 'block';
        
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }
}

// ログインアラート表示
function showLoginAlert(message, type = 'error') {
    // 既存のアラートを削除
    const existingAlert = document.querySelector('.login-alert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    // アラート要素を作成
    const alert = document.createElement('div');
    alert.className = `login-alert ${type}`;
    
    const icon = type === 'error' ? 'fas fa-exclamation-triangle' : 
                 type === 'success' ? 'fas fa-check-circle' : 
                 'fas fa-info-circle';
    
    alert.innerHTML = `
        <div class="login-alert-header">
            <div class="login-alert-title">
                <i class="${icon}"></i>
                ${type === 'error' ? 'ログインエラー' : 
                  type === 'success' ? 'ログイン成功' : 'お知らせ'}
            </div>
            <button class="login-alert-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="login-alert-message">
            ${message}
        </div>
    `;
    
    // ページに追加
    document.body.appendChild(alert);
    
    // 5秒後に自動で削除
    setTimeout(() => {
        if (alert.parentElement) {
            alert.style.animation = 'slideOutUp 0.3s ease-out';
            setTimeout(() => {
                if (alert.parentElement) {
                    alert.remove();
                }
            }, 300);
        }
    }, 5000);
}

// ログイン処理
async function login() {
    console.log('ログイン処理開始');
    
    const usernameElement = document.getElementById('login-username');
    const passwordElement = document.getElementById('login-password');
    
    console.log('フォーム要素の確認:', {
        usernameElement: !!usernameElement,
        passwordElement: !!passwordElement
    });
    
    if (!usernameElement || !passwordElement) {
        console.error('ログインフォーム要素が見つかりません');
        showLoginAlert('ログインエラー: ログインフォームが正しく読み込まれていません。ページを再読み込みしてください。', 'error');
        return;
    }
    
    const username = usernameElement.value;
    const password = passwordElement.value;
    
    console.log('入力値の確認:', {
        username: username,
        password: password ? '***' : '空'
    });

    if (!username || !password) {
        let errorMessage = '';
        if (!username && !password) {
            errorMessage = 'ユーザー名とパスワードを入力してください';
        } else if (!username) {
            errorMessage = 'ユーザー名を入力してください';
        } else {
            errorMessage = 'パスワードを入力してください';
        }
        console.log('入力値エラー:', errorMessage);
        showMessage('login-message', errorMessage, 'error');
        showLoginAlert(`ログインエラー: ${errorMessage}`, 'error');
        return;
    }

    // userAuthUtilsの確認
    console.log('userAuthUtilsの確認:', !!window.userAuthUtils);
    if (!window.userAuthUtils) {
        const errorMessage = '認証システムが初期化されていません。ページを再読み込みしてください。';
        console.error('userAuthUtilsが見つかりません');
        showMessage('login-message', errorMessage, 'error');
        showLoginAlert(`ログインエラー: ${errorMessage}`, 'error');
        return;
    }

    try {
        console.log('userAuthUtils.login開始:', username);
        
        // userAuthUtilsのloginメソッドを使用
        const result = await window.userAuthUtils.login(username, password);
        
        console.log('ログイン結果:', result);

        if (result.success) {
            console.log('ログイン成功:', result.user);
            await handleSuccessfulLogin(result.user);
        } else {
            console.log('ログイン失敗:', result.error);
            showMessage('login-message', result.error, 'error');
            showLoginAlert(`ログインエラー: ${result.error}`, 'error');
        }

    } catch (error) {
        console.error('ログインエラー:', error);
        const errorMessage = 'ログイン処理中にエラーが発生しました。しばらく時間をおいてから再度お試しください。';
        showMessage('login-message', errorMessage, 'error');
        showLoginAlert(`ログインエラー: ${errorMessage}`, 'error');
    }
}

// テストログイン
function testLogin() {
    document.getElementById('login-username').value = 'hirofumi@developer';
    document.getElementById('login-password').value = 'hrfm20031103';
    login();
}

// 通知システムの初期化
function initializeNotificationSystem() {
    console.log('通知システムを初期化中...');
    
    // 通知ボタンのイベントリスナーを追加
    const notificationBtn = document.getElementById('notification-btn');
    if (notificationBtn) {
        notificationBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleNotificationDropdown();
        });
        console.log('通知ボタンのイベントリスナーを追加しました');
    } else {
        console.error('通知ボタンが見つかりません');
    }
    
    // 通知の削除ボタンのイベントリスナーを追加
    const clearAllBtn = document.getElementById('clear-all-notifications');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            clearAllNotifications();
        });
        console.log('通知削除ボタンのイベントリスナーを追加しました');
    }
    
    // サンプル通知を追加（テスト用）
    addSampleNotifications();
}

// サンプル通知を追加
function addSampleNotifications() {
    const notificationList = document.getElementById('notification-list');
    if (notificationList) {
        // 既存の「通知はありません」メッセージを削除
        const noNotifications = notificationList.querySelector('.no-notifications');
        if (noNotifications) {
            noNotifications.remove();
        }
        
        // サンプル通知を追加
        const sampleNotifications = [
            {
                title: '新しいクレームが投稿されました',
                message: 'お客様からのクレームが投稿されました。確認してください。',
                time: '2分前',
                type: 'complaint'
            },
            {
                title: 'シフト提出期限が近づいています',
                message: '今月のシフト提出期限まであと3日です。',
                time: '1時間前',
                type: 'system'
            },
            {
                title: '在庫不足の商品があります',
                message: '商品Aの在庫が少なくなっています。発注を検討してください。',
                time: '3時間前',
                type: 'inventory'
            }
        ];
        
        sampleNotifications.forEach(notification => {
            const notificationItem = createNotificationItem(notification);
            notificationList.appendChild(notificationItem);
        });
        
        // 通知バッジを更新
        updateNotificationBadge(sampleNotifications.length);
    }
}

// 通知アイテムを作成
function createNotificationItem(notification) {
    const item = document.createElement('div');
    item.className = 'notification-item';
    item.innerHTML = `
        <div class="notification-item-header">
            <div class="notification-item-title">${notification.title}</div>
            <div class="notification-item-time">${notification.time}</div>
        </div>
        <div class="notification-item-message">${notification.message}</div>
        <div class="notification-item-actions">
            <button class="notification-item-btn" onclick="markAsRead(this)">
                <i class="fas fa-check"></i> 既読
            </button>
            <button class="notification-item-btn" onclick="removeNotification(this)">
                <i class="fas fa-trash"></i> 削除
            </button>
        </div>
    `;
    return item;
}

// 通知バッジを更新
function updateNotificationBadge(count) {
    const badge = document.getElementById('notification-badge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

// 既読にする
function markAsRead(button) {
    const notificationItem = button.closest('.notification-item');
    if (notificationItem) {
        notificationItem.classList.add('read');
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-check"></i> 既読済み';
    }
}

// 通知を削除
function removeNotification(button) {
    const notificationItem = button.closest('.notification-item');
    if (notificationItem) {
        notificationItem.remove();
        updateNotificationCount();
    }
}

// すべての通知を削除
function clearAllNotifications() {
    const notificationList = document.getElementById('notification-list');
    if (notificationList) {
        notificationList.innerHTML = `
            <div class="no-notifications">
                <i class="fas fa-bell-slash"></i>
                <p>通知はありません</p>
            </div>
        `;
        updateNotificationBadge(0);
    }
}

// 通知数を更新
function updateNotificationCount() {
    const notificationItems = document.querySelectorAll('.notification-item');
    const unreadCount = notificationItems.length;
    updateNotificationBadge(unreadCount);
}

// 成功時のログイン処理
async function handleSuccessfulLogin(userData) {
    console.log('handleSuccessfulLogin: ログイン成功処理開始', userData);
    
    try {
        // userAuthUtilsを使用してセッションを保存
        let sessionSaved = false;
        if (window.userAuthUtils) {
            sessionSaved = window.userAuthUtils.saveSession(userData);
        } else {
            // userAuthUtilsが利用できない場合は従来の方法を使用
            localStorage.setItem('currentUser', JSON.stringify(userData));
            localStorage.setItem('loginTime', new Date().toISOString());
            sessionSaved = true;
        }

        if (!sessionSaved) {
            console.error('セッションの保存に失敗しました。');
            showMessage('login-message', 'セッションの保存に失敗しました。', 'error');
            showLoginAlert('セッションの保存に失敗しました。', 'error');
            return;
        }

        // 最終ログイン時刻を更新
        if (window.userAuthUtils) {
            await window.userAuthUtils.updateLastLogin(userData.id);
        } else {
            // userAuthUtilsが利用できない場合は直接更新
            let updateQuery = window.supabaseClient
                .from('users')
                .update({ last_login: new Date().toISOString() });
            
            // UUID形式のIDの場合はauth_idで更新、そうでなければidで更新
            if (typeof userData.id === 'string' && userData.id.includes('-')) {
                updateQuery = updateQuery.eq('auth_id', userData.id);
            } else {
                updateQuery = updateQuery.eq('id', userData.id);
            }
            
            await updateQuery;
        }

        currentUser = userData;
        window.currentUser = currentUser;
        isLoggedIn = true;
        
        console.log('ユーザー情報を保存しました:', currentUser);
        
        showMessage('login-message', 'ログインに成功しました', 'success');
        showLoginAlert('ログインに成功しました', 'success');
        
        console.log('showMainContentを呼び出します');
        // 権限に応じたUI適用を先にロード
        try {
            await applyUiPermissions(userData);
        } catch (e) {
            console.warn('UI権限適用時の警告:', e);
        }

        showMainContent();
        
    } catch (error) {
        console.error('ログイン処理エラー:', error);
        showMessage('login-message', 'ログイン処理中にエラーが発生しました', 'error');
        showLoginAlert('ログイン処理中にエラーが発生しました', 'error');
    }
}

// メインコンテンツを表示する関数
function showMainContent() {
    console.log('showMainContent: メインコンテンツを表示開始');
    console.log('現在のログイン状態:', isLoggedIn);
    console.log('現在のユーザー:', currentUser);
    
    const authContainer = document.getElementById('auth-container');
    const navbar = document.getElementById('navbar');
    const mainContent = document.getElementById('main-content');
    
    console.log('要素の存在確認:', {
        authContainer: !!authContainer,
        navbar: !!navbar,
        mainContent: !!mainContent
    });
    
    console.log('要素の現在の表示状態:');
    console.log('auth-container display:', authContainer ? authContainer.style.display : '要素が見つかりません');
    console.log('navbar display:', navbar ? navbar.style.display : '要素が見つかりません');
    console.log('main-content display:', mainContent ? mainContent.style.display : '要素が見つかりません');
    
    if (authContainer) {
        authContainer.style.display = 'none';
        console.log('auth-containerを非表示にしました');
    } else {
        console.error('auth-containerが見つかりません');
    }
    if (navbar) {
        navbar.style.display = 'block';
        console.log('navbarを表示しました');
        console.log('navbarの現在のdisplay:', navbar.style.display);
    } else {
        console.error('navbarが見つかりません');
    }
    if (mainContent) {
        mainContent.style.display = 'block';
        console.log('main-contentを表示しました');
    }
    
    // ユーザー情報を表示
    const userName = document.getElementById('user-name');
    if (userName && currentUser) {
        userName.textContent = currentUser.full_name || currentUser.username;
        console.log('ユーザー名を更新しました:', userName.textContent);
    }
    
    // ホームページを確実に表示
    console.log('ホームページを表示します');
    
    // すべてのページを非表示
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => {
        page.classList.remove('active');
    });
    
    // すべてのナビリンクからactiveクラスを削除
    const allNavLinks = document.querySelectorAll('.nav-link');
    allNavLinks.forEach(link => {
        link.classList.remove('active');
    });
    
    // ホームページを表示
    const homePage = document.getElementById('home');
    if (homePage) {
        homePage.classList.add('active');
        console.log('ホームページをアクティブにしました');
    } else {
        console.error('ホームページが見つかりません');
    }
    
    // ホームのナビリンクをアクティブにする
    const homeLink = document.querySelector('[href="#home"]');
    if (homeLink) {
        homeLink.classList.add('active');
        console.log('ホームのナビリンクをアクティブにしました');
    }
    
    // ナビゲーションのアクティブ状態を更新
    updateNavigationActiveState('home');
    
    // ナビゲーションが確実に表示されるように強制的に表示
    setTimeout(() => {
        const navbar = document.getElementById('navbar');
        if (navbar) {
            navbar.style.display = 'block';
            console.log('ナビゲーションを強制的に表示しました');
        }
        
        // 権限によるUI制御を再適用（動的に生成される要素対策）
        if (currentUser) {
            applyUiPermissions(currentUser).catch(() => {});
        }

        // 通知システムを初期化
        initializeNotificationSystem();
    }, 100);
}

// =========================
// UI 権限制御（JSON駆動）
// =========================
async function loadUiPermissionsConfig() {
    const cacheBuster = Date.now();
    try {
        // file プロトコルでは fetch が CORS でブロックされるため、フォールバックを静かに返す
        if (location.protocol === 'file:') {
            return (window && window.UI_PERMISSIONS_FALLBACK) ? window.UI_PERMISSIONS_FALLBACK : { rules: [] };
        }

        const response = await fetch(`ui-permissions.json?cb=${cacheBuster}`, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('ui-permissions.json の読み込みに失敗しました');
        }
        return await response.json();
    } catch (err) {
        // HTTP/HTTPS での失敗時のみ警告（file:// は上で処理済み）
        if (!window._uiPermissionsWarnedOnce) {
            console.warn('UI権限設定の読み込みに失敗。フォールバックを使用します:', err);
            window._uiPermissionsWarnedOnce = true;
        } else {
            console.debug('UI権限設定フォールバックを使用中');
        }
        // フォールバック: グローバルに用意されていればそれを使用、なければ空ルール
        if (window && window.UI_PERMISSIONS_FALLBACK) {
            return window.UI_PERMISSIONS_FALLBACK;
        }
        return { rules: [] };
    }
}

function evaluateVisibility(role, visibleFor) {
    if (!visibleFor || visibleFor.length === 0) return true;
    return visibleFor.includes(role);
}

function evaluateEnabled(role, enabledFor) {
    if (!enabledFor || enabledFor.length === 0) return true;
    return enabledFor.includes(role);
}

function applyRuleToElements(rule, role) {
    const nodeList = document.querySelectorAll(rule.selector);
    if (!nodeList || nodeList.length === 0) return;

    nodeList.forEach((el) => {
        // まず既存の制御クラスをリセット
        el.classList.remove('hidden-by-permission');
        el.classList.remove('disabled-by-permission');
        // 可視性
        if (Object.prototype.hasOwnProperty.call(rule, 'visibleFor')) {
            const shouldBeVisible = evaluateVisibility(role, rule.visibleFor);
            if (shouldBeVisible) {
                el.classList.remove('hidden-by-permission');
            } else {
                el.classList.add('hidden-by-permission');
            }
        }
        // 有効/無効
        if (Object.prototype.hasOwnProperty.call(rule, 'enabledFor')) {
            const shouldBeEnabled = evaluateEnabled(role, rule.enabledFor);
            if (shouldBeEnabled) {
                el.classList.remove('disabled-by-permission');
                if ('disabled' in el) {
                    try { el.disabled = false; } catch (_) {}
                }
                el.setAttribute('aria-disabled', 'false');
            } else {
                el.classList.add('disabled-by-permission');
                if ('disabled' in el) {
                    try { el.disabled = true; } catch (_) {}
                }
                el.setAttribute('aria-disabled', 'true');
            }
        }
    });
}

// 追加: シフト管理タブの権限を強制する
function enforceShiftTabPermissions(role) {
    const isStaff = (role === 'staff');
    const hideSelectorsForStaff = [
        "button.shift-tab[onclick=\"switchShiftTab('register')\"]",
        "#shift-register",
        "button.shift-tab[onclick=\"switchShiftTab('schedule')\"]",
        "#shift-schedule",
        "button.shift-tab[onclick=\"switchShiftTab('submitted')\"]",
        "#shift-submitted"
    ];
    hideSelectorsForStaff.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
            if (isStaff) {
                el.classList.add('hidden-by-permission');
                // コンテンツ領域の場合は念のため display:none をセット
                if (el.classList.contains('shift-content')) {
                    el.style.display = 'none';
                }
            } else {
                el.classList.remove('hidden-by-permission');
            }
        });
    });

    // 一時的に募集タブの制御を解除（常に表示）
    const recruitTab = document.querySelector("button.shift-tab[onclick=\"switchShiftTab('recruit')\"]");
    const recruitContent = document.getElementById('shift-recruit');
    if (recruitTab) recruitTab.classList.remove('hidden-by-permission');
    if (recruitContent) recruitContent.classList.remove('hidden-by-permission');
}

// 追加: 在庫と予算のタブ/ナビを物理的に削除（スタッフのみ）
function enforceInventoryAndBudgetRemovals(role) {
    const isStaff = (role === 'staff');
    if (!isStaff) return;

    // 予算ナビリンクを削除
    document.querySelectorAll("a.nav-link[href='#budget']").forEach((el) => {
        if (el && el.parentElement) el.remove();
    });
    // 予算ページの直接リンク（他所にあれば）も不可視化
    document.querySelectorAll("[href='#budget']").forEach((el) => {
        if (el && el.parentElement) el.remove();
    });

    // 在庫: 登録/一括タブのボタンを削除
    document.querySelectorAll(
        "button.inventory-tab[onclick=\"switchInventoryTab('register')\"], " +
        "button.inventory-tab[onclick=\"switchInventoryTab('bulk')\"]"
    ).forEach((el) => {
        if (el) el.remove();
    });

    // 在庫: 登録/一括 のコンテンツも削除
    ['inventory-register', 'inventory-bulk'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
}

async function applyUiPermissions(user) {
    try {
        const config = await loadUiPermissionsConfig();
        const role = (user && user.role) || 'staff';

        if (!config || !Array.isArray(config.rules)) return;

        // まず全体を一旦可視・有効に戻す（前回状態の残留を避ける）
        document.querySelectorAll('.hidden-by-permission').forEach((el) => {
            el.classList.remove('hidden-by-permission')
        });
        document.querySelectorAll('.disabled-by-permission').forEach((el) => {
            el.classList.remove('disabled-by-permission');
            if ('disabled' in el) {
                try { el.disabled = false; } catch (_) {}
            }
            el.setAttribute('aria-disabled', 'false');
        });

        // 各ルール適用
        config.rules.forEach((rule) => applyRuleToElements(rule, role));

        // 明示的な禁止を追加（防御的）: developer/administrator 以外は掲示板の削除ボタンを不可視に
        if (!(role === 'developer' || role === 'administrator')) {
            document.querySelectorAll('.bulletin-status .delete-btn').forEach((el) => {
                el.classList.add('hidden-by-permission');
            });
        }

        // シフトタブの権限を強制
        enforceShiftTabPermissions(role);

        // 在庫と予算の不可視化（物理削除）
        enforceInventoryAndBudgetRemovals(role);
    } catch (error) {
        console.warn('UI権限設定の適用に失敗:', error);
        throw error;
    }
}

// ログインフォームを表示する関数
function showLoginForm() {
    console.log('showLoginForm: ログインフォームを表示');
    const authContainer = document.getElementById('auth-container');
    const navbar = document.getElementById('navbar');
    const mainContent = document.getElementById('main-content');
    
    console.log('要素の存在確認:', {
        authContainer: !!authContainer,
        navbar: !!navbar,
        mainContent: !!mainContent
    });
    
    if (authContainer) {
        authContainer.style.display = 'flex';
        console.log('auth-containerを表示しました');
    }
    if (navbar) {
        navbar.style.display = 'none';
        console.log('navbarを非表示にしました');
    }
    if (mainContent) {
        mainContent.style.display = 'none';
        console.log('main-contentを非表示にしました');
    }
    
    // すべてのページを非アクティブにする
    const allPages = document.querySelectorAll('.page');
    allPages.forEach(page => {
        page.classList.remove('active');
    });
}

// 新規登録フォームを表示する関数（無効化）
function showRegisterForm() {
    // 新規登録機能は無効化されています
    showNotification('新規登録機能は無効化されています。管理者にお問い合わせください。', 'info');
}

// ログアウト機能（確認ダイアログ付き）
async function logout(event) {
    if (event) {
        event.preventDefault();
        if (typeof event.stopImmediatePropagation === 'function') {
            event.stopImmediatePropagation();
        }
    }

    const ok = await (window.confirmAsync
        ? window.confirmAsync('ログアウトしますか？')
        : Promise.resolve(confirm('ログアウトしますか？')));
    if (!ok) return;

    // userAuthUtilsを使用してセッションをクリア
    if (window.userAuthUtils) {
        window.userAuthUtils.clearSession();
    } else {
        // userAuthUtilsが利用できない場合は従来の方法を使用
        localStorage.removeItem('currentUser');
        localStorage.removeItem('loginTime');
    }

    isLoggedIn = false;
    currentUser = null;
    window.currentUser = null;

    // 画面遷移を明示
    window.location.href = 'index.html';
}

// ホーム画面からの画面遷移機能
function navigateToShiftManagement() {
    showPage('#shift-management');
    // ナビゲーションリンクのアクティブ状態を更新
    updateNavigationActiveState('shift-management');
}

function navigateToInventory() {
    const role = (currentUser && currentUser.role) || 'staff';
    if (role === 'staff') {
        showPage('#inventory');
        try { if (window.inventoryManager) inventoryManager.switchToInventoryListTab(); } catch (_) {}
        return;
    }
    showPage('#inventory');
    // ナビゲーションリンクのアクティブ状態を更新
    updateNavigationActiveState('inventory');
}

function navigateToBudget() {
    const role = (currentUser && currentUser.role) || 'staff';
    if (role === 'staff') {
        showNotification('予算管理画面へのアクセス権限がありません', 'error');
        return;
    }
    showPage('#budget');
    // ナビゲーションリンクのアクティブ状態を更新
    updateNavigationActiveState('budget');
}

function navigateToTools() {
    // ツールページを表示
    showPage('#tools');
    updateNavigationActiveState('tools');
}

function navigateToMypage() {
    // ドロップダウンを閉じてから遷移
    if (typeof closeAllDropdowns === 'function') {
        closeAllDropdowns();
    } else {
        const accountDropdown = document.getElementById('account-dropdown');
        if (accountDropdown) accountDropdown.classList.remove('active');
    }

    // マイページを明示的に表示
    showPage('#mypage');
    updateNavigationActiveState('mypage');
    loadUserProfile();
}

// ツール機能は tools.js に移動しました

// ナビゲーションリンクのアクティブ状態を更新する関数
function updateNavigationActiveState(pageId) {
    // すべてのナビゲーションリンクからアクティブクラスを削除
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
    });
    
    // 対応するページのナビゲーションリンクにアクティブクラスを追加
    let targetLink = document.querySelector(`[href="#${pageId}"]`);
    if (!targetLink) {
        // pageIdに#が含まれていない場合は#を追加して検索
        targetLink = document.querySelector(`[href="#${pageId}"]`);
    }
    if (!targetLink) {
        // pageIdに#が含まれている場合は#を除去して検索
        targetLink = document.querySelector(`[href="#${pageId.replace('#', '')}"]`);
    }
    
    if (targetLink) {
        targetLink.classList.add('active');
        console.log('ナビゲーション状態を更新しました:', pageId);
    } else {
        console.warn('対応するナビリンクが見つかりません:', pageId);
    }
}

// ページナビゲーション機能
function showPage(pageId) {
    console.log('showPage: ページを表示', pageId);
    // 権限制御（ページレベル）
    try {
        const role = (typeof currentUser !== 'undefined' && currentUser && currentUser.role) ? currentUser.role : 'staff';
        const isStaff = role === 'staff';
        const normalized = (pageId || '').toString();
        if (isStaff) {
            if (normalized === '#budget' || normalized === 'budget') {
                showNotification('予算管理画面へのアクセス権限がありません', 'error');
                return;
            }
        }
    } catch (_) {}
    
    // pageIdが無効な場合は処理を中断
    if (!pageId || pageId === '#' || pageId === '') {
        console.warn('無効なページIDが指定されました:', pageId);
        return;
    }
    
    // すべてのページを非表示
    if (pages) {
        pages.forEach(page => {
            page.classList.remove('active');
        });
    } else {
        // pagesが初期化されていない場合は直接取得
        const allPages = document.querySelectorAll('.page');
        allPages.forEach(page => {
            page.classList.remove('active');
        });
    }
    
    // すべてのナビリンクからactiveクラスを削除
    const allNavLinks = document.querySelectorAll('.nav-link');
    allNavLinks.forEach(link => {
        link.classList.remove('active');
    });
    
    // 指定されたページを表示
    const targetPage = document.getElementById(pageId.replace('#', ''));
    if (targetPage) {
        targetPage.classList.add('active');
        console.log('ページをアクティブにしました:', pageId);
    } else {
        console.error('ページが見つかりません:', pageId);
    }

    // インベントリページの追加ガード（スタッフは一覧タブに固定）
    try {
        const role = (typeof currentUser !== 'undefined' && currentUser && currentUser.role) ? currentUser.role : 'staff';
        if (role === 'staff' && (pageId === '#inventory' || pageId === 'inventory')) {
            if (window.inventoryManager && typeof inventoryManager.switchToInventoryListTab === 'function') {
                inventoryManager.switchToInventoryListTab();
            }
        }
    } catch (_) {}
    
    // 対応するナビリンクにactiveクラスを追加
    let activeLink = document.querySelector(`[href="${pageId}"]`);
    if (!activeLink) {
        // pageIdに#が含まれていない場合は#を追加して検索
        activeLink = document.querySelector(`[href="#${pageId}"]`);
    }
    if (!activeLink) {
        // pageIdに#が含まれている場合は#を除去して検索
        activeLink = document.querySelector(`[href="${pageId.replace('#', '')}"]`);
    }
    
    if (activeLink) {
        activeLink.classList.add('active');
        console.log('ナビリンクをアクティブにしました:', pageId);
    } else {
        console.warn('対応するナビリンクが見つかりません:', pageId);
    }

    // ページ切り替え時もUI権限を再適用（動的生成要素対策）
    if (typeof applyUiPermissions === 'function' && currentUser) {
        applyUiPermissions(currentUser).catch(() => {});
    }

    // 翻訳ウィジェットの表示制御は元に戻す（常時表示）
}

// ナビリンクのクリックイベント（新しいナビゲーション構造用）
document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.nav-menu-dropdown .nav-link');
    
    if (navLinks.length > 0) {
        console.log('ナビリンクが見つかりました:', navLinks.length, '個');
        
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href');
                
                // 無効なhrefの場合は処理を中断
                if (!targetId || targetId === '#' || targetId === '') {
                    console.warn('無効なhrefが設定されています:', targetId);
                    return;
                }
                
                showPage(targetId);
                
                // ドロップダウンを閉じる
                const notificationDropdown = document.getElementById('notification-dropdown');
                const accountDropdown = document.getElementById('account-dropdown');
                const navMenuDropdown = document.getElementById('nav-menu-dropdown');
                if (notificationDropdown) notificationDropdown.classList.remove('active');
                if (accountDropdown) accountDropdown.classList.remove('active');
                if (navMenuDropdown) navMenuDropdown.classList.remove('active');
            });
        });
    } else {
        console.warn('ナビリンクが見つかりません');
    }
});

// シフト管理タブ切り替え機能
function switchShiftTab(tabName) {
    console.log('[switchShiftTab] requested:', tabName);
    // すべてのタブを非アクティブにする
    document.querySelectorAll('.shift-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // すべてのコンテンツを非表示にする
    document.querySelectorAll('.shift-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });
    
    // 選択されたタブをアクティブにする
    const selectedTab = document.querySelector(`[onclick="switchShiftTab('${tabName}')"]`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    } else {
        console.warn('[switchShiftTab] selectedTab not found for', tabName);
    }
    
    // 対応するコンテンツを表示する
    const selectedContent = document.getElementById(`shift-${tabName}`);
    if (selectedContent) {
        selectedContent.classList.add('active');
        selectedContent.style.display = 'block';
        console.log('[switchShiftTab] show content #shift-' + tabName);
        
        // シフト提出機能と提出シフト確認機能の場合、コンテンツ内の要素も確実に表示
        if (tabName === 'submit' || tabName === 'submitted') {
            const container = selectedContent.querySelector('.submit-container, .submitted-container');
            if (container) {
                container.style.display = 'block';
            }
        }

        // シフト募集タブのとき、内側コンテナも明示的に表示
        if (tabName === 'recruit') {
            const recruitContainer = selectedContent.querySelector('.recruit2-container') || selectedContent.querySelector('.recruit-container');
            if (recruitContainer) {
                recruitContainer.style.display = 'block';
                recruitContainer.classList.add('active');
                console.log('[switchShiftTab] recruit container shown');
            } else {
                // コンテナが無い場合でも内部リストを表示に
                const listEl = selectedContent.querySelector('#recruit2-list');
                if (listEl) listEl.style.display = 'block';
                console.warn('[switchShiftTab] recruit container not found');
            }
        }
    }
    
    // シフト確認タブが選択された場合、データを読み込む
    if (tabName === 'view') {
        loadShiftData();
        // フィルター条件をリセット
        resetFilters();
    }
    
    // シフト提出タブが選択された場合、初期化する
    if (tabName === 'submit') {
        if (typeof initializeShiftSubmitTab === 'function') {
            initializeShiftSubmitTab();
        }
    }
    
    // 提出シフト確認タブが選択された場合、初期化する
    if (tabName === 'submitted') {
        if (typeof initializeSubmittedShiftTab === 'function') {
            initializeSubmittedShiftTab();
        }
    }
    
    // タイムスケジュールタブが選択された場合、初期化する
    if (tabName === 'schedule') {
        initializeScheduleTab();
    }

    // タブ切り替え時もUI権限を再適用（動的生成要素対策）
    if (typeof applyUiPermissions === 'function' && currentUser) {
        applyUiPermissions(currentUser).then(() => {
            // スタッフが禁止タブをクリックした場合、許可タブへ戻す
            const role = (currentUser && currentUser.role) || 'staff';
            const isStaff = role === 'staff';
            const forbiddenTabs = ['register','schedule','submitted'];
            if (isStaff && forbiddenTabs.includes(tabName)) {
                const fallbackTab = 'view';
                const fallbackBtn = document.querySelector(`[onclick="switchShiftTab('${fallbackTab}')"]`);
                const fallbackContent = document.getElementById(`shift-${fallbackTab}`);
                document.querySelectorAll('.shift-tab').forEach(t=>t.classList.remove('active'));
                document.querySelectorAll('.shift-content').forEach(c=>{c.classList.remove('active'); c.style.display='none';});
                if (fallbackBtn) fallbackBtn.classList.add('active');
                if (fallbackContent) { fallbackContent.classList.add('active'); fallbackContent.style.display='block'; }
                return;
            }
        }).catch(() => {});
    }
}

// 通知機能
function showNotification(message, type = 'info') {
    // 既存の通知を削除
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // 通知要素を作成
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    // スタイルを追加
    notification.style.cssText = `
        position: fixed;
        top: 90px;
        right: 20px;
        background: ${getNotificationColor(type)};
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        z-index: 1001;
        max-width: 400px;
        animation: slideInRight 0.3s ease;
    `;
    
    // 通知を表示
    document.body.appendChild(notification);
    
    // 閉じるボタンのイベント
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.remove();
    });
    
    // 自動で閉じる
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, 5000);
}

// カスタムモーダル（Alert/Confirm）
function createModal({ title = '', message = '', okText = 'OK', cancelText = null }) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close" aria-label="Close">&times;</span>
            ${title ? `<h2>${title}</h2>` : ''}
            <div class="modal-message" style="margin: 10px 0 20px; color:#333; white-space:pre-wrap;">${message}</div>
            <div class="modal-actions" style="display:flex; gap:10px; justify-content:flex-end;">
                ${cancelText ? `<button class="btn btn-secondary modal-cancel" type="button">${cancelText}</button>` : ''}
                <button class="btn btn-primary modal-ok" type="button">${okText}</button>
            </div>
        </div>
    `;

    const content = modal.querySelector('.modal-content');
    const closeBtn = modal.querySelector('.close');
    const okBtn = modal.querySelector('.modal-ok');
    const cancelBtn = modal.querySelector('.modal-cancel');

    function show() {
        document.body.appendChild(modal);
        modal.style.display = 'block';
        // 初期フォーカス
        (cancelBtn || okBtn).focus();
    }

    function hide() {
        modal.style.display = 'none';
        if (modal.parentNode) modal.parentNode.removeChild(modal);
    }

    return { modal, content, closeBtn, okBtn, cancelBtn, show, hide };
}

// Alert(OKのみ)
window.alertAsync = function alertAsync(message, { title = 'お知らせ', okText = 'OK' } = {}) {
    return new Promise(resolve => {
        const { modal, closeBtn, okBtn, show, hide } = createModal({ title, message, okText });

        function onResolve() {
            cleanup();
            resolve();
        }

        function cleanup() {
            document.removeEventListener('keydown', onKeyDown);
            hide();
        }

        function onKeyDown(e) {
            if (e.key === 'Escape' || e.key === 'Enter') {
                onResolve();
            }
        }

        if (closeBtn) closeBtn.addEventListener('click', onResolve);
        if (okBtn) okBtn.addEventListener('click', onResolve);
        document.addEventListener('keydown', onKeyDown);

        show();
    });
};

// Confirm(OK/Cancel)
window.confirmAsync = function confirmAsync(message, { title = '確認', okText = 'OK', cancelText = 'キャンセル' } = {}) {
    return new Promise(resolve => {
        const { closeBtn, okBtn, cancelBtn, show, hide } = createModal({ title, message, okText, cancelText });

        function onOk() {
            cleanup();
            resolve(true);
        }

        function onCancel() {
            cleanup();
            resolve(false);
        }

        function cleanup() {
            document.removeEventListener('keydown', onKeyDown);
            hide();
        }

        function onKeyDown(e) {
            if (e.key === 'Escape') onCancel();
            if (e.key === 'Enter') onOk();
        }

        if (closeBtn) closeBtn.addEventListener('click', onCancel);
        if (cancelBtn) cancelBtn.addEventListener('click', onCancel);
        if (okBtn) okBtn.addEventListener('click', onOk);
        document.addEventListener('keydown', onKeyDown);

        show();
    });
};

// 通知アイコンの取得
function getNotificationIcon(type) {
    switch (type) {
        case 'success':
            return 'fa-check-circle';
        case 'error':
            return 'fa-exclamation-circle';
        case 'warning':
            return 'fa-exclamation-triangle';
        default:
            return 'fa-info-circle';
    }
}

// 通知色の取得
function getNotificationColor(type) {
    switch (type) {
        case 'success':
            return '#28a745';
        case 'error':
            return '#dc3545';
        case 'warning':
            return '#ffc107';
        default:
            return '#667eea';
    }
}

// アニメーション用のCSSを動的に追加
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        margin-left: auto;
        padding: 0;
        font-size: 1rem;
    }
    
    .notification-close:hover {
        opacity: 0.8;
    }
`;
document.head.appendChild(style);

// フォーム送信の処理
document.addEventListener('DOMContentLoaded', () => {
    // ログイン状態をチェック
    checkLoginStatus();
    
    // ログインフォーム（既存のlogin()関数を使用するため、この部分は削除）
    // ログインフォームのイベントリスナーは既にHTMLで設定済み
    
    // 新規登録フォーム（現在は使用していないため、この部分は削除）
    // 登録機能は別途実装予定
    
    // 商品管理のボタン
    const addProductBtn = document.querySelector('#inventory .btn-secondary');
    if (addProductBtn) {
        addProductBtn.addEventListener('click', () => {
            showNotification('商品追加機能は開発中です。', 'info');
        });
    }
    
    const exportBtn = document.querySelector('#inventory .btn-secondary:last-child');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            showNotification('在庫レポートを出力しました。', 'success');
        });
    }
    
    // シフト管理の初期化
    initializeShiftManagement();
    
    // フィルターの変更イベントを追加（リアルタイム反映）
    const nameFilter = document.getElementById('nameFilter');
    const dateFilter = document.getElementById('dateFilter');
    const colorFilter = document.getElementById('colorFilter');
    const viewMode = document.getElementById('viewMode');
    
    if (nameFilter) {
        nameFilter.addEventListener('change', applyFilters);
    }
    if (dateFilter) {
        dateFilter.addEventListener('change', applyFilters);
        dateFilter.addEventListener('input', applyFilters);
    }
    if (colorFilter) {
        colorFilter.addEventListener('change', applyFilters);
    }
    if (viewMode) {
        viewMode.addEventListener('change', applyFilters);
    }
});

// シフト管理の初期化
function initializeShiftManagement() {
    // ドラッグ&ドロップイベントの設定
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files || []);
            console.log('[drop] files:', files.map(f => f.name));
            addFiles(files);
        });
    }

    if (fileInput) {
        // 二重起動防止のため、既存ハンドラを一旦クローンで置換
        const fileInputClone = fileInput.cloneNode(true);
        fileInput.parentNode.replaceChild(fileInputClone, fileInput);
        const inputEl = document.getElementById('fileInput');
        inputEl.addEventListener('change', (e) => {
            const files = Array.from((e.target && e.target.files) ? e.target.files : []);
            console.log('[fileInput change] files:', files.map(f => f.name));
            addFiles(files);
        });
        // ボタン側のクリック
        const fileSelectBtn = document.getElementById('fileSelectBtn');
        if (fileSelectBtn) {
            fileSelectBtn.addEventListener('click', () => {
                console.log('[fileSelectBtn] clicked');
                inputEl.click();
            });
        }
    } else {
        console.warn('fileInput要素が見つかりませんでした');
    }
}

// ファイルを追加する関数
function addFiles(files) {
    files.forEach(file => {
        // エクセルファイルかチェック
        const isExcel = file.name.match(/\.(xlsx|xls)$/i);
        if (!isExcel) {
            showNotification(`${file.name}はエクセルファイルではありません。`, 'error');
            return;
        }

        // 重複チェック
        const isDuplicate = selectedFiles.some(f => f.name === file.name && f.size === file.size);
        if (!isDuplicate) {
            selectedFiles.push(file);
        }
    });
    updateFileList();
    showSelectedFiles();
}

// ファイルリストを更新する関数
function updateFileList() {
    const fileList = document.getElementById('fileList');
    if (!fileList) return;
    
    fileList.innerHTML = '';
    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <div class="file-info">
                <div class="file-icon">📊</div>
                <div class="file-details">
                    <h4>${file.name}</h4>
                    <p>${formatFileSize(file.size)}</p>
                </div>
            </div>
            <button class="remove-btn" onclick="removeFile(${index})">削除</button>
        `;
        fileList.appendChild(fileItem);
    });
}

// ファイルを削除する関数
function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFileList();
    if (selectedFiles.length === 0) {
        hideSelectedFiles();
        hideExcelPreview();
    }
}

// 選択されたファイルエリアを表示する関数
function showSelectedFiles() {
    const selectedFilesDiv = document.getElementById('selectedFiles');
    if (selectedFilesDiv) {
        selectedFilesDiv.style.display = 'block';
    }
}

// 選択されたファイルエリアを非表示にする関数
function hideSelectedFiles() {
    const selectedFilesDiv = document.getElementById('selectedFiles');
    if (selectedFilesDiv) {
        selectedFilesDiv.style.display = 'none';
    }
}

// エクセルプレビューを非表示にする関数
function hideExcelPreview() {
    const excelPreview = document.getElementById('excelPreview');
    const columnMapping = document.getElementById('columnMapping');
    if (excelPreview) {
        excelPreview.style.display = 'none';
    }
    if (columnMapping) {
        columnMapping.style.display = 'none';
    }
}

// ファイルサイズをフォーマットする関数
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// エクセルの日付シリアル値をDate型に変換する関数
function excelDateToJSDate(serial) {
    if (!serial && serial !== 0) return null;
    // 既にDateの場合はそのまま返す
    if (serial instanceof Date) {
        return isNaN(serial.getTime()) ? null : serial;
    }
    if (typeof serial === 'string') {
        // 文字列の場合は、日付として有効かチェック（ロケール依存の簡易パース）
        const date = new Date(serial);
        return !isNaN(date.getTime()) ? date : null;
    }
    if (typeof serial === 'number') {
        // Excelの日付シリアル値（1900日付系）をJavaScriptのDateに変換
        // NOTE: うるう年バグは無視して一般的なケースに対応
        const utcDays = Math.floor(serial - 25569);
        const utcValue = utcDays * 86400;
        const date = new Date(utcValue * 1000);
        return !isNaN(date.getTime()) ? date : null;
    }
    return null;
}

// Excelの時刻セルを時間数(number, 単位: 時)に変換する
function parseExcelTimeToHour(value) {
    if (value == null) return NaN;
    // Dateのときは時と分から時間数を算出
    if (value instanceof Date) {
        const hours = value.getHours();
        const minutes = value.getMinutes();
        return hours + minutes / 60;
    }
    if (typeof value === 'number') {
        // 1未満なら日付の小数(=24時間を1とする)とみなして時間に変換
        // 1以上なら既に時とみなす
        return value <= 1 ? value * 24 : value;
    }
    if (typeof value === 'string') {
        const s = value.trim();
        if (!s) return NaN;
        // 例: 10:30 / 9:00
        const mColon = s.match(/^(\d{1,2}):(\d{2})/);
        if (mColon) {
            const h = parseInt(mColon[1], 10);
            const m = parseInt(mColon[2], 10);
            if (!isNaN(h) && !isNaN(m)) return h + m / 60;
        }
        // 例: 10時30分 / 10時
        const mJa = s.match(/(\d{1,2})\s*時(?:\s*(\d{1,2})\s*分)?/);
        if (mJa) {
            const h = parseInt(mJa[1], 10);
            const m = mJa[2] ? parseInt(mJa[2], 10) : 0;
            if (!isNaN(h) && !isNaN(m)) return h + m / 60;
        }
        // 先頭の数値（小数点含む）だけを抽出 例: "10.5", "10 ～ 18"
        const mNum = s.match(/\d+(?:\.\d+)?/);
        if (mNum) {
            const num = parseFloat(mNum[0]);
            if (!isNaN(num)) return num;
        }
        return NaN;
    }
    return NaN;
}

// Date型をYYYY-MM-DD形式の文字列に変換する関数
function dateToYYYYMMDD(date) {
    if (!date || !(date instanceof Date)) return null;
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

// 除外項目かどうかをチェックする関数
function isExcludedItem(name) {
    if (!name || typeof name !== 'string') return false;
    
    return EXCLUDED_ITEMS.some(excludedItem => 
        name.includes(excludedItem) || excludedItem.includes(name)
    );
}

// カラーコードを7文字以内に制限する関数
function truncateColorCode(colorCode) {
    if (!colorCode || typeof colorCode !== 'string') return null;
    
    // カラーコードが7文字を超える場合は切り詰める
    if (colorCode.length > 7) {
        return colorCode.substring(0, 7);
    }
    
    return colorCode;
}

// エクセルファイルを処理する関数
async function processExcelFiles() {
    if (selectedFiles.length === 0) {
        showNotification('処理するエクセルファイルがありません。', 'error');
        return;
    }

    showLoading();
    hideMessages();

    try {
        // 最初のファイルを処理
        const file = selectedFiles[0];
        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                        // SheetJSを使用してワークブックを読み込み（データ抽出）
        const workbook = XLSX.read(data, { 
            type: 'array', 
            cellStyles: true,
            cellFormula: false,
            cellHTML: false,
            cellNF: false,
            cellText: false,
            cellDates: true
        });
                
                excelData = workbook;
                // ExcelJSでも同じデータを読み込んで色取得用に保持
                exceljsLoadPromise = (async () => {
                    try {
                        const wb = new ExcelJS.Workbook();
                        await wb.xlsx.load(e.target.result);
                        exceljsWorkbook = wb;
                        console.log('ExcelJS workbook loaded');
                    } catch (ex) {
                        console.warn('ExcelJS load failed:', ex);
                    }
                })();
                
                // シート選択画面を表示
                showSheetSelection(workbook);
                
            } catch (error) {
                console.error('Excel parsing error:', error);
                showNotification('エクセルファイルの解析中にエラーが発生しました。', 'error');
            } finally {
                hideLoading();
            }
        };

        reader.readAsArrayBuffer(file);
        
    } catch (error) {
        console.error('File processing error:', error);
        showNotification('ファイル処理中にエラーが発生しました。', 'error');
        hideLoading();
    }
}

// シート選択画面を表示する関数
function showSheetSelection(workbook) {
    const sheetNames = workbook.SheetNames;
    
    if (sheetNames.length === 0) {
        showNotification('シートが見つかりません。', 'error');
        return;
    }

    // シート選択UIを作成
    let sheetSelectionHTML = `
        <div class="sheet-selection" style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 10px;">
            <h3 style="margin-bottom: 20px; color: #333;">📋 シートを選択してください</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">
    `;

    sheetNames.forEach((sheetName, index) => {
        sheetSelectionHTML += `
            <button class="sheet-btn" onclick="selectSheet('${sheetName}')" 
                    style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                           color: white; border: none; padding: 12px 20px; 
                           border-radius: 8px; cursor: pointer; font-size: 14px; 
                           transition: all 0.3s ease; min-width: 120px;">
                📄 ${sheetName}
            </button>
        `;
    });

    sheetSelectionHTML += `
            </div>
            <p style="color: #666; font-size: 0.9rem;">
                ※ シフトデータが含まれているシートを選択してください
            </p>
        </div>
    `;

    // 既存のプレビューをクリアしてシート選択を表示
    const excelPreview = document.getElementById('excelPreview');
    const tableContainer = document.getElementById('tableContainer');
    const columnMapping = document.getElementById('columnMapping');
    
    if (excelPreview && tableContainer) {
        excelPreview.style.display = 'block';
        tableContainer.innerHTML = sheetSelectionHTML;
        if (columnMapping) {
            columnMapping.style.display = 'none';
        }
    }
}

// シートを選択する関数
function selectSheet(sheetName) {
    currentSheet = sheetName;
    
    // シート選択UIを削除
    const tableContainer = document.getElementById('tableContainer');
    if (tableContainer) {
        tableContainer.innerHTML = '';
    }
    
    // ExcelJSの読込が完了していれば待ってから解析
    const startAnalyze = () => analyzeShiftData(excelData, sheetName);
    if (exceljsLoadPromise && typeof exceljsLoadPromise.then === 'function') {
        exceljsLoadPromise.finally(startAnalyze);
    } else {
        startAnalyze();
    }
    
    showNotification(`シート「${sheetName}」の解析が完了しました。`, 'success');
}

// シフトデータを解析する関数
function analyzeShiftData(workbook, sheetName) {
    console.log('=== シフトデータ解析開始 ===');
    
    const worksheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    console.log('シート範囲:', range);
    
    // 全データを取得
    const allData = [];
    for (let row = range.s.r; row <= range.e.r; row++) {
        const rowData = [];
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = worksheet[cellAddress];
            rowData.push(cell ? cell.v : '');
        }
        allData.push(rowData);
    }
    
    console.log('全データ:', allData);
    
    // 3行目を確認（日付行）
    if (allData.length >= 3) {
        console.log('3行目:', allData[2]);
        console.log('3行目A列:', allData[2][0]);
    }
    
    // 名前の列（A列）を確認（除外項目を除く）
    const nameColumn = allData.map(row => row[0])
        .filter(name => name !== '' && !isExcludedItem(name));
    console.log('名前の列（除外項目除く）:', nameColumn);
    
    // ヘルパー: 値がExcel日付として解釈できるか
    function isExcelDateLike(value) {
        const d = excelDateToJSDate(value);
        return !!(d && !isNaN(d.getTime()));
    }

    // 日付行を探す（複数の戦略でフォールバック）
    let dateRowIndex = -1;
    // 1) A列に『日付』を含む行
    for (let i = 0; i < allData.length; i++) {
        if (allData[i][0] && allData[i][0].toString().includes('日付')) {
            dateRowIndex = i;
            break;
        }
    }

    // 2) 見つからない場合は、先頭〜10行で『列1以降に日付セルが3つ以上ある行』を候補に
    if (dateRowIndex === -1) {
        let bestRow = -1;
        let bestCount = 0;
        const scanRows = Math.min(allData.length, 10);
        for (let i = 0; i < scanRows; i++) {
            let count = 0;
            for (let c = 1; c < (allData[i] ? allData[i].length : 0); c++) {
                if (isExcelDateLike(allData[i][c])) count++;
            }
            if (count > bestCount && count >= 3) { // 日付らしき値が複数ある行を優先
                bestCount = count;
                bestRow = i;
            }
        }
        dateRowIndex = bestRow;
    }

    // 3) それでも見つからない場合は、3行目（index 2）をフォールバック
    if (dateRowIndex === -1 && allData.length >= 3) {
        dateRowIndex = 2;
    }

    console.log('日付行のインデックス(確定):', dateRowIndex);
    if (dateRowIndex !== -1) {
        console.log('日付行のデータ:', allData[dateRowIndex]);
    }

    // 日付列を特定（ペア列前提だが、ペア不在でも単列で登録可能にする）
    const dateColumns = [];
    if (dateRowIndex !== -1) {
        const row = allData[dateRowIndex] || [];
        for (let col = 1; col < row.length; col++) {
            const dateValue = row[col];
            if (!dateValue || dateValue === '') continue;
            // 末尾に出てくる「入間店 月予算」などは除外
            const str = String(dateValue);
            if (str.includes('月予算') || str.includes('日割') || str.includes('予算')) {
                console.log('非日付の末尾情報をスキップ:', str);
                continue;
            }
            const convertedDate = excelDateToJSDate(dateValue);
            const label = (convertedDate && !isNaN(convertedDate.getTime())) ? convertedDate : String(dateValue);
            const nextCol = col + 1 < row.length ? col + 1 : null;
            dateColumns.push({
                colIndex: col,
                date: label,
                nextColIndex: nextCol
            });
            // 2列1日の想定が強い場合は次の列をスキップ
            if (nextCol !== null) col++; // 次のループで+1されるので実質+2
        }
    }

    console.log('日付列(確定):', dateColumns);
    
    // 各名前についてシフトデータを抽出（除外項目を除く）
    const shiftData = [];
    
    for (let rowIndex = dateRowIndex + 1; rowIndex < allData.length; rowIndex++) {
        const name = allData[rowIndex][0];
        if (!name || name === '' || isExcludedItem(name)) {
            console.log(`除外項目または空の行をスキップ: ${name}`);
            continue;
        }
        
        console.log(`\n=== ${name}のシフトデータ ===`);
        
        const personShiftData = {
            name: name,
            shifts: []
        };
        
        dateColumns.forEach(dateCol => {
            const timeCell1 = allData[rowIndex][dateCol.colIndex];
            const timeCell2 = (dateCol.nextColIndex != null) ? allData[rowIndex][dateCol.nextColIndex] : undefined;
            
            console.log(`日付: ${dateCol.date}`);
            console.log(`時間1: ${timeCell1}`);
            console.log(`時間2: ${timeCell2}`);
            
            // セルの色情報を取得（ガード付き）
            const cellAddress1 = XLSX.utils.encode_cell({ r: rowIndex, c: dateCol.colIndex });
            const cell1 = worksheet[cellAddress1];
            let cell2;
            if (dateCol.nextColIndex != null) {
                const cellAddress2 = XLSX.utils.encode_cell({ r: rowIndex, c: dateCol.nextColIndex });
                cell2 = worksheet[cellAddress2];
            }
            
            console.log(`セル1の詳細:`, cell1);
            console.log(`セル2の詳細:`, cell2);
            
            // 色情報の詳細デバッグ
            if (cell1 && cell1.s) {
                console.log(`セル1のスタイル詳細:`, JSON.stringify(cell1.s, null, 2));
            }
            if (cell2 && cell2.s) {
                console.log(`セル2のスタイル詳細:`, JSON.stringify(cell2.s, null, 2));
            }
            
            // 時間を数値（時）として比較
            const time1 = parseExcelTimeToHour(timeCell1);
            const time2 = parseExcelTimeToHour(timeCell2);
            
            let checkInTime, checkOutTime, checkInColor, checkOutColor;
            
            // まず二列パターン
            if (!isNaN(time1) && time1 > 0 && !isNaN(time2) && time2 > 0) {
                if (time1 < time2) {
                    checkInTime = timeCell1;
                    checkOutTime = timeCell2;
                    checkInColor = truncateColorCode(getCellColor(cell1, rowIndex, dateCol.colIndex, sheetName));
                    checkOutColor = truncateColorCode(getCellColor(cell2, rowIndex, dateCol.nextColIndex, sheetName));
                } else {
                    checkInTime = timeCell2;
                    checkOutTime = timeCell1;
                    checkInColor = truncateColorCode(getCellColor(cell2, rowIndex, dateCol.nextColIndex, sheetName));
                    checkOutColor = truncateColorCode(getCellColor(cell1, rowIndex, dateCol.colIndex, sheetName));
                }
            } else if (!isNaN(time1) && time1 > 0) {
                checkInTime = timeCell1;
                checkInColor = truncateColorCode(getCellColor(cell1, rowIndex, dateCol.colIndex, sheetName));
            } else if (!isNaN(time2) && time2 > 0) {
                checkInTime = timeCell2;
                checkInColor = truncateColorCode(getCellColor(cell2, rowIndex, dateCol.nextColIndex, sheetName));
            } else {
                // フォールバック: 1セルに「10:00-19:00」「10:00～19:00」などの範囲表記
                const s = (timeCell1 != null) ? String(timeCell1) : '';
                const m = s.match(/(\d{1,2}:\d{2})\s*[-〜～]\s*(\d{1,2}:\d{2})/);
                if (m) {
                    checkInTime = m[1];
                    checkOutTime = m[2];
                    checkInColor = truncateColorCode(getCellColor(cell1, rowIndex, dateCol.colIndex, sheetName));
                    checkOutColor = truncateColorCode(getCellColor(cell1, rowIndex, dateCol.colIndex, sheetName));
                }
            }
            
            if (checkInTime || checkOutTime) {
                personShiftData.shifts.push({
                    date: dateCol.date,
                    checkInTime: checkInTime,
                    checkInColor: checkInColor,
                    checkOutTime: checkOutTime,
                    checkOutColor: checkOutColor
                });
            }
        });
        
        shiftData.push(personShiftData);
    }
    
    console.log('\n=== 最終結果 ===');
    console.log(JSON.stringify(shiftData, null, 2));
    
    // 結果を保存
        // 休み・欠勤のレコードは保持はするが表示・保存時に除外。ここではそのまま格納。
        processedShiftData = shiftData;
    
    // 結果を表示
    displayShiftResults(shiftData);
    
    // データベース保存ボタンを表示
    showDatabaseSaveButton();
}

    // セルの色を取得する関数（ExcelJS優先, フォールバックにSheetJSのsを参照）
    function getCellColor(cell, rowIndex, colIndex, sheetName) {
        // ExcelJSが使える場合はExcelJSから色を取得
        try {
            if (exceljsWorkbook && sheetName) {
                const ws = exceljsWorkbook.getWorksheet(sheetName);
                if (ws) {
                    // Excelは1始まりなので+1
                    const r = rowIndex + 1;
                    const c = colIndex + 1;
                    const exCell = ws.getRow(r).getCell(c);
                    const fill = exCell && exCell.fill;
                    // fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }
                    if (fill && fill.fgColor && fill.fgColor.argb) {
                        const argb = fill.fgColor.argb; // AARRGGBB
                        if (typeof argb === 'string' && argb.length === 8) {
                            const rgb = '#' + argb.slice(2).toUpperCase();
                            return rgb;
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('ExcelJS color read failed:', e);
        }

        // フォールバック: SheetJSのcell.sから推定
        if (!cell) return '#FFFFFF';
        if (cell.s) {
            const style = cell.s;
            if (style.fill && style.fill.fgColor && style.fill.fgColor.rgb) {
                return '#' + style.fill.fgColor.rgb;
            }
            if (style.fill && style.fill.bgColor && style.fill.bgColor.rgb) {
                return '#' + style.fill.bgColor.rgb;
            }
        }
        return '#FFFFFF';
    }

// テーマカラーをRGBに変換する関数
function getThemeColor(theme, tint) {
    // 基本的なテーマカラーの定義
    const themeColors = {
        0: '#FFFFFF', // 白
        1: '#000000', // 黒
        2: '#E7E6E6', // グレー
        3: '#44546A', // 濃いグレー
        4: '#5B9BD5', // 青
        5: '#ED7D31', // オレンジ
        6: '#A5A5A5', // グレー
        7: '#FFC000', // 黄色
        8: '#4472C4', // 青
        9: '#70AD47', // 緑
        10: '#255E91', // 濃い青
        11: '#9E480E', // 濃いオレンジ
        12: '#997300', // 濃い黄色
        13: '#43682B', // 濃い緑
        14: '#255E91', // 濃い青
        15: '#C65911'  // 濃いオレンジ
    };
    
    let color = themeColors[theme] || '#FFFFFF';
    
    // ティントを適用
    if (tint !== undefined && tint !== 0) {
        color = applyTint(color, tint);
    }
    
    return color;
}

// ティントを適用する関数
function applyTint(color, tint) {
    // 簡単なティント処理（実際の実装ではより複雑）
    if (tint > 0) {
        // 明るくする
        return lightenColor(color, Math.abs(tint));
    } else {
        // 暗くする
        return darkenColor(color, Math.abs(tint));
    }
}

// 色を明るくする関数
function lightenColor(color, amount) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * amount);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

// 色を暗くする関数
function darkenColor(color, amount) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * amount);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return "#" + (0x1000000 + (R > 255 ? 255 : R < 0 ? 0 : R) * 0x10000 +
        (G > 255 ? 255 : G < 0 ? 0 : G) * 0x100 +
        (B > 255 ? 255 : B < 0 ? 0 : B)).toString(16).slice(1);
}

// シフト結果を表示する関数
function displayShiftResults(shiftData) {
    const excelPreview = document.getElementById('excelPreview');
    const tableContainer = document.getElementById('tableContainer');
    
    if (!excelPreview || !tableContainer) return;
    
    excelPreview.style.display = 'block';
    
    let html = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">';
    html += '<h3>シフトデータ解析結果</h3>';
    html += `<button onclick="showSheetSelection(excelData)" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-size: 12px;">📋 シート変更</button>`;
    html += '</div>';
    html += '<div style="max-height: 400px; overflow-y: auto;">';
    
    if (shiftData.length === 0) {
        html += '<p style="color: #666; text-align: center; padding: 20px;">処理対象のデータが見つかりませんでした。</p>';
    } else {
        shiftData.forEach(person => {
            html += `<div style="margin-bottom: 20px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">`;
            html += `<h4 style="color: #333; margin-bottom: 10px;">${person.name}</h4>`;
            
            // 休み・欠勤を除外してから表示
            const visibleShifts = person.shifts.filter(s => {
                const inName = getStoreNameFromColor(truncateColorCode(s.checkInColor));
                const outName = getStoreNameFromColor(truncateColorCode(s.checkOutColor));
                return inName !== '休み' && inName !== '欠勤' && outName !== '休み' && outName !== '欠勤';
            });

            if (visibleShifts.length === 0) {
                html += '<p style="color: #666;">シフトデータなし</p>';
            } else {
                html += '<div class="shift-table-wrapper">';
                html += '<table style="width: 100%; border-collapse: collapse;">';
                html += '<thead><tr>';
                html += '<th style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">日付</th>';
                html += '<th style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">出勤時間</th>';
                html += '<th style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">出勤色</th>';
                html += '<th style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">退勤時間</th>';
                html += '<th style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">退勤色</th>';
                html += '</tr></thead><tbody>';
                
                visibleShifts.forEach(shift => {
                    const displayDate = dateToYYYYMMDD(shift.date) || shift.date;
                    const inColor = truncateColorCode(shift.checkInColor) || '#FFFFFF';
                    const outColor = truncateColorCode(shift.checkOutColor) || '#FFFFFF';
                    const inStore = getStoreNameFromColor(inColor);
                    const outStore = getStoreNameFromColor(outColor);
                    html += '<tr>';
                    html += `<td style="padding: 8px; border: 1px solid #ddd;">${displayDate}</td>`;
                    html += `<td style="padding: 8px; border: 1px solid #ddd;">${shift.checkInTime || '-'}</td>`;
                    html += `<td style="padding: 8px; border: 1px solid #ddd; background-color: ${inColor};">${inStore || '-'}</td>`;
                    html += `<td style="padding: 8px; border: 1px solid #ddd;">${shift.checkOutTime || '-'}</td>`;
                    html += `<td style="padding: 8px; border: 1px solid #ddd; background-color: ${outColor};">${outStore || '-'}</td>`;
                    html += '</tr>';
                });
                
                html += '</tbody></table>';
                html += '</div>';
            }
            
            html += '</div>';
        });
    }
    
    html += '</div>';
    tableContainer.innerHTML = html;
}

// データベース保存ボタンを表示する関数
function showDatabaseSaveButton() {
    const tableContainer = document.getElementById('tableContainer');
    if (!tableContainer) return;
    
    const saveButton = document.createElement('button');
    saveButton.className = 'process-btn';
    saveButton.style.marginTop = '20px';
    saveButton.textContent = 'データベースに保存';
    saveButton.onclick = saveToDatabase;
    
    // 既存のボタンがあれば削除
    const existingButton = tableContainer.querySelector('.process-btn[onclick="saveToDatabase"]');
    if (existingButton) {
        existingButton.remove();
    }
    
    tableContainer.appendChild(saveButton);
}

// データベースに保存する関数
async function saveToDatabase() {
    if (!processedShiftData) {
        showNotification('保存するデータがありません。', 'error');
        return;
    }

    showLoading();
    hideMessages();

    try {
        const databaseData = [];
        
        processedShiftData.forEach(person => {
            person.shifts.forEach(shift => {
                if (!(shift.checkInTime || shift.checkOutTime)) return;
                const inColor = truncateColorCode(shift.checkInColor);
                const outColor = truncateColorCode(shift.checkOutColor);
                const inStore = getStoreNameFromColor(inColor);
                const outStore = getStoreNameFromColor(outColor);
                // 休み・欠勤は保存しない
                if (inStore === '休み' || inStore === '欠勤' || outStore === '休み' || outStore === '欠勤') return;
                databaseData.push({
                    name: person.name,
                    date: dateToYYYYMMDD(shift.date),
                    check_in_time: shift.checkInTime || null,
                    check_in_color: inColor || null,
                    check_out_time: shift.checkOutTime || null,
                    check_out_color: outColor || null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
            });
        });

        if (databaseData.length === 0) {
            showNotification('保存するデータがありません。', 'error');
            hideLoading();
            return;
        }

        console.log('データベースに保存するデータ:', databaseData);

        // Supabaseにデータを挿入
        const { data, error } = await supabase
            .from('shift')
            .insert(databaseData);

        if (error) {
            console.error('Database error:', error);
            showNotification('データベースへの保存中にエラーが発生しました。', 'error');
        } else {
            showNotification(`${databaseData.length}件のデータが正常にデータベースに保存されました！`, 'success');
            
            // ファイルをアップロード済みリストに追加
            const uploadedFile = {
                id: Math.random().toString(36).substr(2, 9),
                name: selectedFiles[0].name,
                size: selectedFiles[0].size,
                url: '#',
                created_at: new Date().toISOString(),
                processed_records: databaseData.length
            };
            
            uploadedFiles = [uploadedFile, ...uploadedFiles];
            updateUploadedFileList();
            
            // 選択されたファイルをクリア
            selectedFiles = [];
            updateFileList();
            hideSelectedFiles();
            hideExcelPreview();
        }
        
    } catch (error) {
        console.error('Save to database error:', error);
        showNotification('データベースへの保存中にエラーが発生しました。', 'error');
    } finally {
        hideLoading();
    }
}

// アップロード済みファイルリストを更新する関数
function updateUploadedFileList() {
    const uploadedFilesDiv = document.getElementById('uploadedFiles');
    const uploadedFileList = document.getElementById('uploadedFileList');
    
    if (!uploadedFilesDiv || !uploadedFileList) return;
    
    if (uploadedFiles.length === 0) {
        uploadedFilesDiv.style.display = 'none';
        return;
    }

    uploadedFilesDiv.style.display = 'block';
    uploadedFileList.innerHTML = '';

    uploadedFiles.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'uploaded-file';
        fileItem.innerHTML = `
            <div class="file-info">
                <div class="file-icon">✅</div>
                <div class="file-details">
                    <h4>${file.name}</h4>
                    <p>${formatFileSize(file.size)}</p>
                    ${file.processed_records ? `<p>処理済みレコード: ${file.processed_records}件</p>` : ''}
                </div>
            </div>
            <span class="download-btn">処理完了</span>
        `;
        uploadedFileList.appendChild(fileItem);
    });
}

// ローディングを表示する関数
function showLoading() {
    const loading = document.getElementById('loading');
    const uploadAllBtn = document.getElementById('uploadAllBtn');
    
    if (loading) {
        loading.style.display = 'block';
    }
    if (uploadAllBtn) {
        uploadAllBtn.disabled = true;
    }
}

// ローディングを非表示にする関数
function hideLoading() {
    const loading = document.getElementById('loading');
    const uploadAllBtn = document.getElementById('uploadAllBtn');
    
    if (loading) {
        loading.style.display = 'none';
    }
    if (uploadAllBtn) {
        uploadAllBtn.disabled = false;
    }
}

// 成功メッセージを表示する関数
function showSuccess(message) {
    showNotification(message, 'success');
}

// エラーメッセージを表示する関数
function showError(message) {
    showNotification(message, 'error');
}

// メッセージを非表示にする関数
function hideMessages() {
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');
    
    if (successMessage) {
        successMessage.style.display = 'none';
    }
    if (errorMessage) {
        errorMessage.style.display = 'none';
    }
}

// シフトデータを読み込む関数
async function loadShiftData() {
    showLoading();
    hideMessages();

    try {
        // Supabaseからデータを取得
        const { data, error } = await supabase
            .from('shift')
            .select('*')
            .order('date', { ascending: false });

        if (error) {
            console.error('Database error:', error);
            showError('データの読み込み中にエラーが発生しました。');
            return;
        }

        allShiftData = data || [];
        console.log('取得したデータ:', allShiftData);

        // フィルターオプションを更新
        updateFilterOptions();

        // フィルタリングと表示
        applyFilters();

    } catch (error) {
        console.error('Load data error:', error);
        showError('データの読み込み中にエラーが発生しました。');
    } finally {
        hideLoading();
    }
}

// 色から店舗名を取得する関数
function getStoreNameFromColor(colorCode) {
    if (!colorCode) return '-';
    return COLOR_TO_STORE[colorCode] || colorCode;
}

// フィルターオプションを更新する関数
function updateFilterOptions() {
    // 名前フィルターの更新
    const names = [...new Set(allShiftData.map(item => item.name))].sort((a, b) => String(a).localeCompare(String(b), 'ja'));
    const nameFilter = document.getElementById('nameFilter');
    if (nameFilter) {
        nameFilter.innerHTML = '<option value="">すべて</option>';
        names.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            nameFilter.appendChild(option);
        });
    }

    // 日付フィルターの更新
    const dates = [...new Set(allShiftData.map(item => item.date))].sort();
    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter) {
        dateFilter.innerHTML = '<option value="">すべて</option>';
        dates.forEach(date => {
            const option = document.createElement('option');
            option.value = date;
            option.textContent = formatDate(date);
            dateFilter.appendChild(option);
        });
    }

    // 店舗フィルターの更新
    const storeNames = [...new Set(allShiftData.map(item => getStoreNameFromColor(item.check_in_color)))].sort();
    const colorFilter = document.getElementById('colorFilter');
    if (colorFilter) {
        colorFilter.innerHTML = '<option value="">すべて</option>';
        storeNames.forEach(storeName => {
            // 欠勤と休みを除外
            if (storeName !== '欠勤' && storeName !== '休み') {
                const option = document.createElement('option');
                option.value = storeName;
                option.textContent = storeName;
                colorFilter.appendChild(option);
            }
        });
    }
}

// フィルターを適用する関数
function applyFilters() {
    const nameFilter = document.getElementById('nameFilter');
    const dateFilter = document.getElementById('dateFilter');
    const colorFilter = document.getElementById('colorFilter');
    
    if (!nameFilter || !dateFilter || !colorFilter) return;
    
    const selectedName = nameFilter.value;
    const selectedDate = dateFilter.value;
    const selectedColor = colorFilter.value;

    filteredData = allShiftData.filter(item => {
        // 名前フィルター
        if (selectedName && item.name !== selectedName) {
            return false;
        }

        // 日付フィルター
        if (selectedDate && item.date !== selectedDate) {
            return false;
        }

        // 店舗フィルター
        if (selectedColor) {
            const storeName = getStoreNameFromColor(item.check_in_color);
            if (storeName !== selectedColor) {
                return false;
            }
        }

        return true;
    });

    // 統計情報を更新
    updateStats();

    // データを表示
    displayShiftData();
    
    // フィルターが適用されたことを通知（初回読み込み時は除く）
    if (allShiftData.length > 0) {
        const filterCount = [selectedName, selectedDate, selectedColor].filter(Boolean).length;
        if (filterCount > 0) {
            showNotification(`${filteredData.length}件のデータが表示されています`, 'info');
        }
    }
}

// 統計情報を更新する関数
function updateStats() {
    // 休みまたは欠勤のレコードを除外
    const activeRecords = filteredData.filter(item => {
        const checkInStoreName = getStoreNameFromColor(item.check_in_color);
        const checkOutStoreName = getStoreNameFromColor(item.check_out_color);
        return !(checkInStoreName === '休み' || checkInStoreName === '欠勤' || 
                checkOutStoreName === '休み' || checkOutStoreName === '欠勤');
    });
    
    const totalRecords = activeRecords.length;
    const uniqueNames = [...new Set(activeRecords.map(item => item.name))].length;
    const uniqueDates = [...new Set(activeRecords.map(item => item.date))].length;
    const totalWorkDays = activeRecords.filter(item => 
        item.check_in_time || item.check_out_time
    ).length;

    const stats = document.getElementById('stats');
    if (stats) {
        stats.innerHTML = `
            <div class="stat-card">
                <h3>総レコード数</h3>
                <p>${totalRecords}</p>
            </div>
            <div class="stat-card">
                <h3>従業員数</h3>
                <p>${uniqueNames}</p>
            </div>
            <div class="stat-card">
                <h3>対象日数</h3>
                <p>${uniqueDates}</p>
            </div>
            <div class="stat-card">
                <h3>出勤日数</h3>
                <p>${totalWorkDays}</p>
            </div>
        `;
    }
}

// シフトデータを表示する関数
function displayShiftData() {
    const shiftData = document.getElementById('shiftData');
    const pagination = document.getElementById('pagination');
    const viewMode = document.getElementById('viewMode');
    
    if (!shiftData) return;
    
    if (filteredData.length === 0) {
        shiftData.innerHTML = `
            <div class="no-data">
                <h3>データが見つかりません</h3>
                <p>フィルター条件を変更して再度検索してください。</p>
            </div>
        `;
        if (pagination) {
            pagination.style.display = 'none';
        }
        return;
    }

    // 表示モードに応じてデータを表示
    if (viewMode && viewMode.value === 'monthly') {
        displayMonthlyMatrixShiftData();
    } else {
        displayDailyShiftData();
    }
}

// 日別表示の関数
function displayDailyShiftData() {
    const shiftData = document.getElementById('shiftData');
    const pagination = document.getElementById('pagination');
    
    // ページネーション計算
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    // テーブル作成（横スクロール対応ラッパーで囲む）
    let tableHTML = `
        <div class="shift-table-wrapper">
            <table class="shift-table">
                <thead>
                    <tr>
                        <th>名前</th>
                        <th>日付</th>
                        <th>出勤時間</th>
                        <th>店舗</th>
                        <th>退勤時間</th>
                        <th>店舗</th>
                    </tr>
                </thead>
                <tbody>
    `;

    pageData.forEach(item => {
        const checkInColor = item.check_in_color || '#FFFFFF';
        const checkOutColor = item.check_out_color || '#FFFFFF';
        const createdDate = formatDateTime(item.created_at);
        const checkInStoreName = getStoreNameFromColor(checkInColor);
        const checkOutStoreName = getStoreNameFromColor(checkOutColor);

        // 休みまたは欠勤の場合は表示しない
        if (checkInStoreName === '休み' || checkInStoreName === '欠勤' || 
            checkOutStoreName === '休み' || checkOutStoreName === '欠勤') {
            return;
        }

        tableHTML += `
                <tr>
                    <td>${item.name}</td>
                    <td>${formatDate(item.date)}</td>
                    <td>${item.check_in_time || '-'}</td>
                    <td>
                        <span class="color-indicator" style="background-color: ${checkInColor};"></span>
                        ${checkInStoreName}
                    </td>
                    <td>${item.check_out_time || '-'}</td>
                    <td>
                        <span class="color-indicator" style="background-color: ${checkOutColor};"></span>
                        ${checkOutStoreName}
                    </td>
                </tr>
        `;
    });

    tableHTML += '</tbody></table></div>';
    shiftData.innerHTML = tableHTML;

    // ページネーション表示
    displayPagination(totalPages);
}

// 週別表示の関数
// 週別の行列表形式表示（縦=日付(曜日)、横=名前）。社員→バイトの順に表示
function displayWeeklyMatrixShiftData() {
    const shiftData = document.getElementById('shiftData');
    const pagination = document.getElementById('pagination');
    
    // 週ヘッダー
    const weekRange = formatWeekRange(window.currentWeekStart || new Date());
    let html = `<div class="weekly-header"><h3><i class="fas fa-calendar-week"></i> ${weekRange}</h3></div>`;

    // 対象週の日付配列を作成（Mon-Sun）
    let startOfWeek;
    if (window.currentWeekStart) {
        startOfWeek = new Date(window.currentWeekStart);
    } else {
        const today = new Date();
        startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay() + 1);
        window.currentWeekStart = startOfWeek;
    }
    const days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        days.push(d);
    }
    const jpDow = ['日','月','火','水','木','金','土'];

    // 名前一覧（社員→バイト）
    const allNames = [...new Set(filteredData.map(x => x.name))];
    const employeeNames = allNames.filter(n => EMPLOYEE_NAMES.includes(n)).sort((a,b)=>String(a).localeCompare(String(b),'ja'));
    const partTimerNames = allNames.filter(n => !EMPLOYEE_NAMES.includes(n)).sort((a,b)=>String(a).localeCompare(String(b),'ja'));

    const buildMatrix = (title, names) => {
        if (names.length === 0) return '';
        let matrix = `<div class="weekly-matrix"><h4 style="margin:8px 0;">${title}</h4><div class="shift-table-wrapper"><table class="shift-table"><thead><tr>`;
        matrix += `<th style="min-width:120px;">名前</th>`;
        days.forEach(d => { matrix += `<th style="min-width:110px;">${d.getMonth()+1}/${d.getDate()}(${jpDow[d.getDay()]})</th>`; });
        matrix += `</tr></thead><tbody>`;
        names.forEach(n => {
            matrix += `<tr>`;
            matrix += `<td>${n}</td>`;
            days.forEach(d => {
                const ymd = dateToYYYYMMDD(d);
                const rec = filteredData.find(x => x.name === n && x.date === ymd);
                if (!rec) {
                    matrix += `<td>-</td>`;
                } else {
                    const store = getStoreNameFromColor(rec.check_in_color || '#FFFFFF');
                    if (store === '休み' || store === '欠勤') {
                        matrix += `<td>休み</td>`;
                    } else {
                        const cell = `${rec.check_in_time || ''}${rec.check_in_time ? ' - ' : ''}${rec.check_out_time || ''}`;
                        matrix += `<td>${cell || '-'}</td>`;
                    }
                }
            });
            matrix += `</tr>`;
        });
        matrix += `</tbody></table></div></div>`;
        return matrix;
    };

    html += buildMatrix('社員', employeeNames);
    html += buildMatrix('バイト', partTimerNames);

    shiftData.innerHTML = html;
    if (pagination) pagination.style.display = 'none';
}

// 表示モードを変更する関数
function changeViewMode() {
    const viewMode = document.getElementById('viewMode');
    const weekNavigation = document.getElementById('weekNavigation');
    
    if (viewMode) {
        currentPage = 1; // ページをリセット
        
        if (viewMode.value === 'monthly') {
            if (weekNavigation) {
                weekNavigation.style.display = 'none';
            }
            // 現在の月に設定
            const today = new Date();
            window.currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        } else {
            if (weekNavigation) {
                weekNavigation.style.display = 'none';
            }
        }
        
        displayShiftData();
    }
}

// 週の切り替え関数
function changeWeek(weekOffset) {
    // 週別表示は現在無効
}

// 現在の週にリセットする関数
function resetToCurrentWeek() {
    // 週別表示は現在無効
}

// 週の範囲をフォーマットする関数
function formatWeekRange(weekStart) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const startDate = formatDate(dateToYYYYMMDD(weekStart));
    const endDate = formatDate(dateToYYYYMMDD(weekEnd));
    
    return `${startDate} - ${endDate}`;
}

// フィルター条件をリセットする関数
function resetFilters() {
    const nameFilter = document.getElementById('nameFilter');
    const dateFilter = document.getElementById('dateFilter');
    const colorFilter = document.getElementById('colorFilter');
    const viewMode = document.getElementById('viewMode');
    
    if (nameFilter) nameFilter.value = '';
    if (dateFilter) dateFilter.value = '';
    if (colorFilter) colorFilter.value = '';
    if (viewMode) viewMode.value = 'daily';
    
    // フィルターを適用してデータを更新
    applyFilters();
}

// ページネーションを表示する関数
function displayPagination(totalPages) {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;
    
    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }

    let paginationHTML = '';

    // 前のページボタン
    paginationHTML += `
        <button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            前へ
        </button>
    `;

    // ページ番号ボタン
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button onclick="changePage(${i})" class="${i === currentPage ? 'active' : ''}">
                ${i}
            </button>
        `;
    }

    // 次のページボタン
    paginationHTML += `
        <button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            次へ
        </button>
    `;

    pagination.innerHTML = paginationHTML;
    pagination.style.display = 'flex';
}

// ページを変更する関数
function changePage(page) {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        displayShiftData();
    }
}

// 日付をフォーマットする関数
function formatDate(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}/${month}/${day}`;
}

// 日時をフォーマットする関数
function formatDateTime(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}/${month}/${day} ${hours}:${minutes}`;
}

// データをエクスポートする関数
function exportData() {
    if (filteredData.length === 0) {
        showNotification('エクスポートするデータがありません。', 'error');
        return;
    }

    // CSVデータを作成
    const headers = ['名前', '日付', '出勤時間', '店舗', '退勤時間', '店舗'];
    
    // 休みまたは欠勤のレコードを除外
    const exportData = filteredData.filter(item => {
        const checkInStoreName = getStoreNameFromColor(item.check_in_color);
        const checkOutStoreName = getStoreNameFromColor(item.check_out_color);
        return !(checkInStoreName === '休み' || checkInStoreName === '欠勤' || 
                checkOutStoreName === '休み' || checkOutStoreName === '欠勤');
    });
    
    const csvData = [
        headers.join(','),
        ...exportData.map(item => [
            item.name,
            formatDate(item.date),
            item.check_in_time || '',
            getStoreNameFromColor(item.check_in_color) || '',
            item.check_out_time || '',
            getStoreNameFromColor(item.check_out_color) || ''
        ].join(','))
    ].join('\n');

    // ファイルダウンロード
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `shift_data_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('データが正常にエクスポートされました。', 'success');
}

// データを削除する関数
async function deleteData() {
    const confirmed = await (window.confirmAsync ? window.confirmAsync('すべてのデータを削除しますか？この操作は元に戻せません。') : Promise.resolve(confirm('すべてのデータを削除しますか？この操作は元に戻せません。')));
    if (!confirmed) {
        return;
    }

    showLoading();
    hideMessages();

    try {
        const { error } = await supabase
            .from('shift')
            .delete()
            .neq('id', 0); // すべてのデータを削除

        if (error) {
            console.error('Delete error:', error);
            showNotification('データの削除中にエラーが発生しました。', 'error');
        } else {
            showNotification('すべてのデータが正常に削除されました。', 'success');
            loadShiftData(); // データを再読み込み
        }
    } catch (error) {
        console.error('Delete data error:', error);
        showNotification('データの削除中にエラーが発生しました。', 'error');
    } finally {
        hideLoading();
    }
}

// ホバーエフェクトの強化
document.addEventListener('DOMContentLoaded', () => {
    // カード要素にホバーエフェクトを追加
    const cards = document.querySelectorAll('.feature-card, .stat-card, .budget-card');
    cards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-10px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // ボタンにホバーエフェクトを追加
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'translateY(-2px)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translateY(0)';
        });
    });
});

// レスポンシブ対応
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        const dropdownContent = document.getElementById('notification-dropdown');
        if (dropdownContent) {
            dropdownContent.style.display = 'none';
        }
    }
});

// 初期ページの設定
document.addEventListener('DOMContentLoaded', () => {
    // Supabaseクライアントを初期化
    initializeSupabaseClient();
    
    // ログイン状態をチェック
    checkLoginStatus();
    
    // ログイン済みの場合のみページナビゲーションを設定
    if (isLoggedIn) {
        // 初期URLの #mypage を除去（不要なフラグメントを表示しない）
        if (window.location.hash === '#mypage') {
            try {
                history.replaceState(null, '', window.location.pathname + window.location.search);
            } catch (e) {
                // 代替手段（万一replaceStateが使えない環境向け）
                window.location.hash = '';
            }
        }

        // URLのハッシュを確認して適切なページを表示
        const hash = window.location.hash;
        if (hash && document.querySelector(hash)) {
            showPage(hash);
        } else {
            showPage('#home');
        }
    }
});

// ブラウザの戻る/進むボタンに対応
window.addEventListener('popstate', () => {
    const hash = window.location.hash;
    if (hash && document.querySelector(hash)) {
        showPage(hash);
    }
});

// ==================== タイムスケジュール機能 ====================

// タイムスケジュールタブの初期化
function initializeScheduleTab() {
    // 現在の日付を取得
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // getMonth()は0ベースなので+1
    const currentDay = today.getDate();
    
    // 年の選択肢を設定（現在年から前後2年）
    const yearSelect = document.getElementById('schedule-year');
    if (yearSelect) {
        yearSelect.innerHTML = '<option value="">年を選択</option>';
        for (let year = currentYear - 2; year <= currentYear + 2; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year + '年';
            if (year === currentYear) {
                option.selected = true;
            }
            yearSelect.appendChild(option);
        }
    }
    
    // 月の選択肢を設定し、現在の月を選択
    const monthSelect = document.getElementById('schedule-month');
    if (monthSelect) {
        // 既存のオプションを保持しつつ、現在の月を選択
        const monthOptions = monthSelect.querySelectorAll('option');
        monthOptions.forEach((option, index) => {
            if (parseInt(option.value) === currentMonth) {
                option.selected = true;
            }
        });
        
        // 月の変更時に日の選択肢を更新
        monthSelect.addEventListener('change', updateDayOptions);
    }
    
    // 年の変更時にも日の選択肢を更新
    if (yearSelect) {
        yearSelect.addEventListener('change', updateDayOptions);
    }
    
    // 日の選択肢を更新（現在の日付を選択）
    updateDayOptions();
    
    // 現在の日を選択
    const daySelect = document.getElementById('schedule-day');
    if (daySelect) {
        setTimeout(() => {
            const dayOptions = daySelect.querySelectorAll('option');
            dayOptions.forEach((option, index) => {
                if (parseInt(option.value) === currentDay) {
                    option.selected = true;
                }
            });
            
            // 日付が自動選択されたことをユーザーに通知（削除）
            // showNotification('今日の日付が自動選択されました。スケジュール作成ボタンをクリックしてください。', 'info');
        }, 100); // 少し遅延を入れて確実に選択肢が更新された後に選択
    }
}

// 日の選択肢を更新
function updateDayOptions() {
    const yearSelect = document.getElementById('schedule-year');
    const monthSelect = document.getElementById('schedule-month');
    const daySelect = document.getElementById('schedule-day');
    
    if (!yearSelect || !monthSelect || !daySelect) return;
    
    const year = parseInt(yearSelect.value);
    const month = parseInt(monthSelect.value);
    
    if (!year || !month) {
        daySelect.innerHTML = '<option value="">日を選択</option>';
        return;
    }
    
    // 選択された年月の日数を計算
    const daysInMonth = new Date(year, month, 0).getDate();
    
    daySelect.innerHTML = '<option value="">日を選択</option>';
    for (let day = 1; day <= daysInMonth; day++) {
        const option = document.createElement('option');
        option.value = day;
        option.textContent = day + '日';
        daySelect.appendChild(option);
    }
}

// スケジュール作成
async function generateSchedule() {
    const year = document.getElementById('schedule-year').value;
    const month = document.getElementById('schedule-month').value;
    const day = document.getElementById('schedule-day').value;
    
    if (!year || !month || !day) {
        showNotification('年、月、日をすべて選択してください。', 'error');
        return;
    }
    
    const selectedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    showScheduleLoading();
    
    try {
        // 選択された日付に出勤している人を取得（入間店のみ）
        const { data: attendanceData, error: attendanceError } = await supabase
            .from('shift')
            .select('name, check_in_time, check_out_time, check_in_color')
            .eq('date', selectedDate)
            .not('check_in_color', 'eq', '#FF4040') // 休みを除外
            .not('check_in_color', 'eq', '#FFFF00') // 欠勤を除外
            .or('check_in_color.eq.#FFFFFF,check_in_color.eq.#FFE0EB,check_in_color.eq.#FFD9E1,check_in_color.eq.#FFDEEB,check_in_color.eq.#FFE5EE') // 入間店のみ
            .order('name');
        
        if (attendanceError) {
            console.error('Attendance data error:', attendanceError);
            showNotification('出勤データの取得に失敗しました。', 'error');
            return;
        }
        
        // 既存のスケジュールを確認
        const { data: existingSchedule, error: scheduleError } = await supabase
            .from('schedule')
            .select('*')
            .eq('date', selectedDate);
        
        if (scheduleError) {
            console.error('Schedule data error:', scheduleError);
            showNotification('スケジュールデータの取得に失敗しました。', 'error');
            return;
        }
        
        displayScheduleResult(attendanceData, existingSchedule, selectedDate);
        
    } catch (error) {
        console.error('Generate schedule error:', error);
        showNotification('スケジュール作成中にエラーが発生しました。', 'error');
    } finally {
        hideScheduleLoading();
    }
}

// スケジュール結果を表示
function displayScheduleResult(attendanceData, existingSchedule, selectedDate) {
    const resultDiv = document.getElementById('schedule-result');
    const attendanceList = document.getElementById('attendance-list');
    const taskAssignment = document.getElementById('task-assignment');
    
    if (!resultDiv || !attendanceList || !taskAssignment) return;
    
    resultDiv.style.display = 'block';
    
    // 出勤者リストを表示
    if (attendanceData.length === 0) {
        attendanceList.innerHTML = '<p class="no-data">この日は入間店の出勤者がいません。</p>';
        taskAssignment.innerHTML = '';
        return;
    }
    
    let attendanceHTML = '<div class="attendance-grid">';
    attendanceData.forEach((person, index) => {
        const storeName = getStoreNameFromColor(person.check_in_color);
        attendanceHTML += `
            <div class="attendance-card">
                <div class="attendance-info">
                    <h5>${person.name}</h5>
                    <p>出勤時間: ${person.check_in_time || '-'}</p>
                    <p>退勤時間: ${person.check_out_time || '-'}</p>
                    <p>店舗: 入間店</p>
                </div>
            </div>
        `;
    });
    attendanceHTML += '</div>';
    attendanceList.innerHTML = attendanceHTML;
    
    // タスク割り当てフォームを表示
    let taskHTML = '<div class="task-form">';
    taskHTML += '<div class="task-templates">';
    taskHTML += '<h5>タスクテンプレート</h5>';
    taskHTML += '<div class="template-buttons">';
    taskHTML += '<button type="button" class="btn btn-sm btn-outline" onclick="addTaskTemplate(\'開店準備\')">開店準備</button>';
    taskHTML += '<button type="button" class="btn btn-sm btn-outline" onclick="addTaskTemplate(\'商品陳列\')">商品陳列</button>';
    taskHTML += '<button type="button" class="btn btn-sm btn-outline" onclick="addTaskTemplate(\'清掃作業\')">清掃作業</button>';
    taskHTML += '<button type="button" class="btn btn-sm btn-outline" onclick="addTaskTemplate(\'接客対応\')">接客対応</button>';
    taskHTML += '<button type="button" class="btn btn-sm btn-outline" onclick="addTaskTemplate(\'在庫確認\')">在庫確認</button>';
    taskHTML += '<button type="button" class="btn btn-sm btn-outline" onclick="addTaskTemplate(\'閉店作業\')">閉店作業</button>';
    taskHTML += '</div>';
    taskHTML += '</div>';
    
    taskHTML += '<div class="task-assignments">';
    attendanceData.forEach((person, index) => {
        const existingTasks = existingSchedule.filter(s => s.employee_name === person.name);
        taskHTML += `
            <div class="task-assignment-card">
                <h6>${person.name}</h6>
                <div class="task-list" id="tasks-${index}">
        `;
        
        if (existingTasks.length > 0) {
            existingTasks.forEach(task => {
                taskHTML += `
                    <div class="task-item">
                        <input type="text" value="${task.task_name}" class="task-input" placeholder="タスク名">
                        <input type="time" value="${task.start_time || ''}" class="time-input" placeholder="開始時間">
                        <input type="time" value="${task.end_time || ''}" class="time-input" placeholder="終了時間">
                        <button type="button" class="btn btn-sm btn-danger" onclick="removeTask(this)">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
            });
        } else {
            taskHTML += `
                <div class="task-item">
                    <input type="text" class="task-input" placeholder="タスク名">
                    <input type="time" class="time-input" placeholder="開始時間">
                    <input type="time" class="time-input" placeholder="終了時間">
                    <button type="button" class="btn btn-sm btn-danger" onclick="removeTask(this)">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }
        
        taskHTML += `
                    <button type="button" class="btn btn-sm btn-outline" onclick="addTask(${index})">
                        <i class="fas fa-plus"></i> タスク追加
                    </button>
                </div>
            </div>
        `;
    });
    taskHTML += '</div></div>';
    
    taskAssignment.innerHTML = taskHTML;
    
    // 選択された日付を保存
    window.selectedScheduleDate = selectedDate;
    window.attendanceData = attendanceData;
}

// タスクテンプレートを追加
function addTaskTemplate(templateName) {
    const taskAssignments = document.querySelectorAll('.task-list');
    if (taskAssignments.length === 0) return;
    
    // 最初の担当者のタスクリストに追加
    const firstTaskList = taskAssignments[0];
    const taskItem = createTaskItem(templateName);
    firstTaskList.insertBefore(taskItem, firstTaskList.lastElementChild);
}

// タスクアイテムを作成
function createTaskItem(taskName = '') {
    const taskItem = document.createElement('div');
    taskItem.className = 'task-item';
    taskItem.innerHTML = `
        <input type="text" value="${taskName}" class="task-input" placeholder="タスク名">
        <input type="time" class="time-input" placeholder="開始時間">
        <input type="time" class="time-input" placeholder="終了時間">
        <button type="button" class="btn btn-sm btn-danger" onclick="removeTask(this)">
            <i class="fas fa-trash"></i>
        </button>
    `;
    return taskItem;
}

// タスクを追加
function addTask(employeeIndex) {
    const taskList = document.getElementById(`tasks-${employeeIndex}`);
    if (!taskList) return;
    
    const taskItem = createTaskItem();
    taskList.insertBefore(taskItem, taskList.lastElementChild);
}

// タスクを削除
function removeTask(button) {
    const taskItem = button.closest('.task-item');
    if (taskItem) {
        taskItem.remove();
    }
}

// スケジュールを保存
async function saveSchedule() {
    if (!window.selectedScheduleDate || !window.attendanceData) {
        showNotification('スケジュールデータがありません。', 'error');
        return;
    }
    
    showScheduleLoading();
    
    try {
        const tasks = [];
        const taskAssignments = document.querySelectorAll('.task-assignment-card');
        
        taskAssignments.forEach((assignment, employeeIndex) => {
            const employeeName = assignment.querySelector('h6').textContent;
            const taskItems = assignment.querySelectorAll('.task-item');
            
            taskItems.forEach(taskItem => {
                const nameInput = taskItem.querySelector('.task-input');
                const timeInputs = taskItem.querySelectorAll('.time-input');
                const taskName = nameInput ? nameInput.value : '';
                const startTime = timeInputs[0] ? timeInputs[0].value : '';
                const endTime = timeInputs[1] ? timeInputs[1].value : '';

                if (taskName.trim()) {
                    tasks.push({
                        date: window.selectedScheduleDate,
                        employee_name: employeeName,
                        task_name: taskName,
                        start_time: startTime || null,
                        end_time: endTime || null,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });
                }
            });
        });
        
        if (tasks.length === 0) {
            showNotification('保存するタスクがありません。', 'error');
            return;
        }
        
        // 既存のスケジュールを削除
        const { error: deleteError } = await supabase
            .from('schedule')
            .delete()
            .eq('date', window.selectedScheduleDate);
        
        if (deleteError) {
            console.error('Delete schedule error:', deleteError);
            showNotification('既存スケジュールの削除に失敗しました。', 'error');
            return;
        }
        
        // 新しいスケジュールを保存
        const { data, error } = await supabase
            .from('schedule')
            .insert(tasks);
        
        if (error) {
            console.error('Save schedule error:', error);
            showNotification('スケジュールの保存に失敗しました。', 'error');
        } else {
            showNotification(`${tasks.length}件のタスクが正常に保存されました。`, 'success');
        }
        
    } catch (error) {
        console.error('Save schedule error:', error);
        showNotification('スケジュールの保存中にエラーが発生しました。', 'error');
    } finally {
        hideScheduleLoading();
    }
}

// 既存スケジュールを読み込み
async function loadSchedule() {
    const year = document.getElementById('schedule-year').value;
    const month = document.getElementById('schedule-month').value;
    const day = document.getElementById('schedule-day').value;
    
    if (!year || !month || !day) {
        showNotification('年、月、日をすべて選択してください。', 'error');
        return;
    }
    
    const selectedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    showScheduleLoading();
    
    try {
        const { data: scheduleData, error } = await supabase
            .from('schedule')
            .select('*')
            .eq('date', selectedDate)
            .order('employee_name, start_time');
        
        if (error) {
            console.error('Load schedule error:', error);
            showNotification('スケジュールの読み込みに失敗しました。', 'error');
            return;
        }
        
        if (scheduleData.length === 0) {
            showNotification('この日のスケジュールはありません。', 'info');
            return;
        }
        
        displayExistingSchedule(scheduleData, selectedDate);
        
    } catch (error) {
        console.error('Load schedule error:', error);
        showNotification('スケジュールの読み込み中にエラーが発生しました。', 'error');
    } finally {
        hideScheduleLoading();
    }
}

// 既存スケジュールを表示
function displayExistingSchedule(scheduleData, selectedDate) {
    const resultDiv = document.getElementById('schedule-result');
    const attendanceList = document.getElementById('attendance-list');
    const taskAssignment = document.getElementById('task-assignment');
    
    if (!resultDiv || !attendanceList || !taskAssignment) return;
    
    resultDiv.style.display = 'block';
    
    // 従業員ごとにグループ化
    const employeeGroups = {};
    scheduleData.forEach(task => {
        if (!employeeGroups[task.employee_name]) {
            employeeGroups[task.employee_name] = [];
        }
        employeeGroups[task.employee_name].push(task);
    });
    
    // 出勤者リストを表示
    let attendanceHTML = '<div class="attendance-grid">';
    Object.keys(employeeGroups).forEach(employeeName => {
        attendanceHTML += `
            <div class="attendance-card">
                <div class="attendance-info">
                    <h5>${employeeName}</h5>
                    <p>タスク数: ${employeeGroups[employeeName].length}件</p>
                </div>
            </div>
        `;
    });
    attendanceHTML += '</div>';
    attendanceList.innerHTML = attendanceHTML;
    
    // タスク割り当てを表示
    let taskHTML = '<div class="task-form">';
    taskHTML += '<div class="task-templates">';
    taskHTML += '<h5>タスクテンプレート</h5>';
    taskHTML += '<div class="template-buttons">';
    taskHTML += '<button type="button" class="btn btn-sm btn-outline" onclick="addTaskTemplate(\'開店準備\')">開店準備</button>';
    taskHTML += '<button type="button" class="btn btn-sm btn-outline" onclick="addTaskTemplate(\'商品陳列\')">商品陳列</button>';
    taskHTML += '<button type="button" class="btn btn-sm btn-outline" onclick="addTaskTemplate(\'清掃作業\')">清掃作業</button>';
    taskHTML += '<button type="button" class="btn btn-sm btn-outline" onclick="addTaskTemplate(\'接客対応\')">接客対応</button>';
    taskHTML += '<button type="button" class="btn btn-sm btn-outline" onclick="addTaskTemplate(\'在庫確認\')">在庫確認</button>';
    taskHTML += '<button type="button" class="btn btn-sm btn-outline" onclick="addTaskTemplate(\'閉店作業\')">閉店作業</button>';
    taskHTML += '</div>';
    taskHTML += '</div>';
    
    taskHTML += '<div class="task-assignments">';
    Object.keys(employeeGroups).forEach((employeeName, index) => {
        const tasks = employeeGroups[employeeName];
        taskHTML += `
            <div class="task-assignment-card">
                <h6>${employeeName}</h6>
                <div class="task-list" id="tasks-${index}">
        `;
        
        tasks.forEach(task => {
            taskHTML += `
                <div class="task-item">
                    <input type="text" value="${task.task_name}" class="task-input" placeholder="タスク名">
                    <input type="time" value="${task.start_time || ''}" class="time-input" placeholder="開始時間">
                    <input type="time" value="${task.end_time || ''}" class="time-input" placeholder="終了時間">
                    <button type="button" class="btn btn-sm btn-danger" onclick="removeTask(this)">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        });
        
        taskHTML += `
                    <button type="button" class="btn btn-sm btn-outline" onclick="addTask(${index})">
                        <i class="fas fa-plus"></i> タスク追加
                    </button>
                </div>
            </div>
        `;
    });
    taskHTML += '</div></div>';
    
    taskAssignment.innerHTML = taskHTML;
    
    // 選択された日付を保存
    window.selectedScheduleDate = selectedDate;
    window.attendanceData = Object.keys(employeeGroups).map(name => ({ name }));
}

// スケジュールをエクスポート
function exportSchedule() {
    if (!window.selectedScheduleDate) {
        showNotification('エクスポートするスケジュールがありません。', 'error');
        return;
    }
    
    // CSVデータを作成
    const taskAssignments = document.querySelectorAll('.task-assignment-card');
    const exportData = [];
    
    taskAssignments.forEach(assignment => {
        const employeeName = assignment.querySelector('h6').textContent;
        const taskItems = assignment.querySelectorAll('.task-item');
        
        taskItems.forEach(taskItem => {
            const nameInput = taskItem.querySelector('.task-input');
            const timeInputs = taskItem.querySelectorAll('.time-input');
            const taskName = nameInput ? nameInput.value : '';
            const startTime = timeInputs[0] ? timeInputs[0].value : '';
            const endTime = timeInputs[1] ? timeInputs[1].value : '';

            if (taskName.trim()) {
                exportData.push({
                    date: window.selectedScheduleDate,
                    employee: employeeName,
                    task: taskName,
                    startTime: startTime || '',
                    endTime: endTime || ''
                });
            }
        });
    });
    
    if (exportData.length === 0) {
        showNotification('エクスポートするデータがありません。', 'error');
        return;
    }
    
    // CSVヘッダー
    const headers = ['日付', '従業員名', 'タスク名', '開始時間', '終了時間'];
    const csvData = [
        headers.join(','),
        ...exportData.map(item => [
            item.date,
            item.employee,
            item.task,
            item.startTime,
            item.endTime
        ].join(','))
    ].join('\n');
    
    // ファイルダウンロード
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `schedule_${window.selectedScheduleDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('スケジュールが正常にエクスポートされました。', 'success');
}

// スケジュールローディングを表示
function showScheduleLoading() {
    const loading = document.getElementById('schedule-loading');
    if (loading) {
        loading.style.display = 'block';
    }
}

// スケジュールローディングを非表示
function hideScheduleLoading() {
    const loading = document.getElementById('schedule-loading');
    if (loading) {
        loading.style.display = 'none';
    }
}

// ==================== タイムスケジュール確認機能 ====================

// ローディング表示（確認）
function showScheduleCheckLoading() {
    const loading = document.getElementById('schedule-check-loading');
    if (loading) loading.style.display = 'block';
}

// ローディング非表示（確認）
function hideScheduleCheckLoading() {
    const loading = document.getElementById('schedule-check-loading');
    if (loading) loading.style.display = 'none';
}

// 指定日付のスケジュールを読み込み
async function loadScheduleForDate() {
    const dateInput = document.getElementById('schedule-check-date');
    const resultSection = document.getElementById('schedule-check-result');
    const listContainer = document.getElementById('schedule-check-list');

    if (!dateInput || !dateInput.value) {
        showNotification('確認日付を選択してください。', 'error');
        return;
    }

    // 初期化
    if (resultSection) resultSection.style.display = 'none';
    if (listContainer) listContainer.innerHTML = '';
    showScheduleCheckLoading();

    try {
        const selectedDate = dateInput.value;
        const { data: scheduleData, error } = await supabase
            .from('schedule')
            .select('*')
            .eq('date', selectedDate)
            .order('employee_name, start_time');

        if (error) {
            console.error('Load schedule (check) error:', error);
            showNotification('スケジュールの読み込みに失敗しました。', 'error');
            return;
        }

        displayScheduleCheckResult(scheduleData || [], selectedDate);
    } catch (err) {
        console.error('loadScheduleForDate error:', err);
        showNotification('スケジュール確認中にエラーが発生しました。', 'error');
    } finally {
        hideScheduleCheckLoading();
    }
}

// 確認結果の表示
function displayScheduleCheckResult(scheduleData, selectedDate) {
    const resultSection = document.getElementById('schedule-check-result');
    const listContainer = document.getElementById('schedule-check-list');
    if (!resultSection || !listContainer) return;

    if (!scheduleData || scheduleData.length === 0) {
        listContainer.innerHTML = '<p class="no-data">この日のスケジュールはありません。</p>';
        resultSection.style.display = 'block';
        return;
    }

    // 従業員ごとにグループ化
    const groups = {};
    scheduleData.forEach(item => {
        const name = item.employee_name || '（未設定）';
        if (!groups[name]) groups[name] = [];
        groups[name].push(item);
    });

    // 表示HTML作成
    let html = '<div class="attendance-grid">';
    Object.keys(groups).forEach(name => {
        const tasks = groups[name];
        html += `
            <div class="attendance-card">
                <div class="attendance-info">
                    <h5>${name}</h5>
                    <p>タスク数: ${tasks.length}件</p>
                </div>
                <div class="task-list">
        `;
        tasks.forEach(task => {
            const st = task.start_time ? `${task.start_time}` : '-';
            const et = task.end_time ? `${task.end_time}` : '-';
            html += `
                <div class="task-display">
                    <span class="task-name">${task.task_name || ''}</span>
                    <span class="task-time" style="color:#666; margin-left:8px;">(${st} - ${et})</span>
                </div>
            `;
        });
        html += `
                </div>
            </div>
        `;
    });
    html += '</div>';

    listContainer.innerHTML = html;
    resultSection.style.display = 'block';
}

// マイページ関連の関数

// マイページタブ切り替え
function switchMypageTab(tabName) {
    // すべてのタブを非アクティブにする
    const tabs = document.querySelectorAll('.mypage-tab');
    const contents = document.querySelectorAll('.mypage-content');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));
    
    // 選択されたタブをアクティブにする
    const selectedTab = document.querySelector(`[onclick="switchMypageTab('${tabName}')"]`);
    const selectedContent = document.getElementById(`mypage-${tabName}`);
    
    if (selectedTab) selectedTab.classList.add('active');
    if (selectedContent) selectedContent.classList.add('active');
}

// ユーザープロフィール読み込み
async function loadUserProfile() {
    if (!currentUser) {
        console.error('ユーザー情報がありません');
        return;
    }
    
    try {
        // プロフィール情報を表示
        document.getElementById('profile-username').textContent = currentUser.username || '-';
        document.getElementById('profile-fullname').textContent = currentUser.full_name || '-';
        document.getElementById('profile-role').textContent = userAuthUtils.getRoleDisplayName(currentUser.role) || '-';
        
        // 最終ログイン時刻をフォーマット
        const lastLogin = currentUser.last_login ? new Date(currentUser.last_login) : null;
        document.getElementById('profile-lastlogin').textContent = lastLogin ? 
            lastLogin.toLocaleString('ja-JP') : '-';
        
        // アカウント作成日をフォーマット
        const created = currentUser.created_at ? new Date(currentUser.created_at) : null;
        document.getElementById('profile-created').textContent = created ? 
            created.toLocaleDateString('ja-JP') : '-';
        
        // マイページの言語設定UIは初期追加状態へ戻したため、ここでは何もしない
            
    } catch (error) {
        console.error('プロフィール読み込みエラー:', error);
        showNotification('プロフィール情報の読み込みに失敗しました', 'error');
    }
}

// 言語設定の保存・適用ロジックは初期追加状態では未実装

// パスワード変更フォームクリア
function clearPasswordForm() {
    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
}

// パスワード変更処理
async function changePassword(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // バリデーション
    if (!currentPassword || !newPassword || !confirmPassword) {
        showNotification('すべての項目を入力してください', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification('新しいパスワードが一致しません', 'error');
        return;
    }
    
    if (newPassword.length < 8) {
        showNotification('パスワードは8文字以上で入力してください', 'error');
        return;
    }
    
    // 英数字チェック
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
        showNotification('パスワードは英数字を含む8文字以上で入力してください', 'error');
        return;
    }
    
    try {
        // 現在のユーザー情報を取得
        let query = window.supabaseClient.from('users').select('*');
        
        // UUID形式のIDの場合はauth_idで検索、そうでなければidで検索
        if (typeof currentUser.id === 'string' && currentUser.id.includes('-')) {
            query = query.eq('auth_id', currentUser.id);
        } else {
            query = query.eq('id', currentUser.id);
        }
        
        const { data: userData, error: userError } = await query.single();

        if (userError || !userData) {
            showNotification('ユーザー情報の取得に失敗しました', 'error');
            return;
        }

        // 現在のパスワードを検証（ログイン処理と同じ方式）
        let isValidCurrentPassword = false;
        
        if (userData.password_hash === '$2b$10$dummy.hash.for.now') {
            // ダミーハッシュの場合
            isValidCurrentPassword = (currentPassword === 'hrfm20031103');
        } else {
            // SHA-256ハッシュの場合
            const expectedHash = CryptoJS.SHA256(currentPassword + 'salt').toString();
            isValidCurrentPassword = (userData.password_hash === expectedHash);
        }

        if (!isValidCurrentPassword) {
            showNotification('現在のパスワードが正しくありません', 'error');
            return;
        }

        // 新しいパスワードハッシュを生成
        const newPasswordHash = CryptoJS.SHA256(newPassword + 'salt').toString();

        // パスワードを更新
        let updateQuery = window.supabaseClient.from('users').update({ password_hash: newPasswordHash });
        
        // UUID形式のIDの場合はauth_idで更新、そうでなければidで更新
        if (typeof currentUser.id === 'string' && currentUser.id.includes('-')) {
            updateQuery = updateQuery.eq('auth_id', currentUser.id);
        } else {
            updateQuery = updateQuery.eq('id', currentUser.id);
        }
        
        const { error: updateError } = await updateQuery;

        if (updateError) {
            showNotification('パスワードの更新に失敗しました', 'error');
            return;
        }

        showNotification('パスワードが正常に変更されました', 'success');
        clearPasswordForm();
        
    } catch (error) {
        console.error('パスワード変更エラー:', error);
        showNotification('パスワード変更中にエラーが発生しました', 'error');
    }
}

// ページ読み込み時の初期化処理にマイページ関連を追加
document.addEventListener('DOMContentLoaded', function() {
    // 既存の初期化処理...
    
    // パスワード変更フォームのイベントリスナーを追加
    const passwordForm = document.getElementById('password-change-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', changePassword);
    }
});



