// ホーム画面用のJavaScript

// DOM要素の取得（重複を避けるため条件付きで宣言）
if (typeof dropdownBtn === 'undefined') {
    var dropdownBtn, dropdownContent;
}

document.addEventListener('DOMContentLoaded', function() {
    // 既に宣言されている場合は再宣言しない
    if (!dropdownBtn) {
        dropdownBtn = document.querySelector('.dropdown-btn');
    }
    if (!dropdownContent) {
        dropdownContent = document.querySelector('.dropdown-content');
    }

    // ドロップダウンメニューの制御
    if (dropdownBtn && dropdownContent) {
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = dropdownContent.style.display === 'block';
            dropdownContent.style.display = isVisible ? 'none' : 'block';
        });

        // ドロップダウン外をクリックした時に閉じる
        document.addEventListener('click', (e) => {
            if (!dropdownBtn.contains(e.target) && !dropdownContent.contains(e.target)) {
                dropdownContent.style.display = 'none';
            }
        });
    }
});

// 機能カードのクリックイベント
document.addEventListener('DOMContentLoaded', function() {
    const featureCards = document.querySelectorAll('.feature-card');
    
    featureCards.forEach(card => {
        card.addEventListener('click', function() {
            const cardTitle = this.querySelector('h3').textContent;
            
            // 各機能への遷移（実際の実装では適切なURLにリダイレクト）
            switch(cardTitle) {
                case 'シフト管理':
                    if (typeof notificationSystem !== 'undefined') {
                        notificationSystem.show('info', '機能', 'シフト管理機能に移動します');
                    } else {
                        alertAsync('シフト管理機能に移動します');
                    }
                    break;
                case '商品管理':
                    if (typeof notificationSystem !== 'undefined') {
                        notificationSystem.show('info', '機能', '商品管理機能に移動します');
                    } else {
                        alertAsync('商品管理機能に移動します');
                    }
                    break;
                case '予算管理':
                    if (typeof notificationSystem !== 'undefined') {
                        notificationSystem.show('info', '機能', '予算管理機能に移動します');
                    } else {
                        alertAsync('予算管理機能に移動します');
                    }
                    break;
                case 'ツール':
                    if (typeof notificationSystem !== 'undefined') {
                        notificationSystem.show('info', '機能', 'ツール機能に移動します');
                    } else {
                        alertAsync('ツール機能に移動します');
                    }
                    break;
                default:
                    console.log('機能カードがクリックされました:', cardTitle);
            }
        });
    });
});

// ナビゲーションリンクのアクティブ状態管理
document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // アクティブクラスを削除
            navLinks.forEach(l => l.classList.remove('active'));
            // クリックされたリンクにアクティブクラスを追加
            this.classList.add('active');
        });
    });
});

// ログアウト機能は`index.html`の`onclick="logout()"`と`script.js`の`logout`関数で処理します

// ユーザー情報の表示
document.addEventListener('DOMContentLoaded', function() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const userInfoElement = document.getElementById('user-info');
    const userNameElement = document.getElementById('user-name');
    
    if (currentUser && userInfoElement && userNameElement) {
        userInfoElement.textContent = currentUser.username || 'ユーザー';
        userNameElement.textContent = currentUser.full_name || currentUser.username || 'ユーザー名';
    }
});

// 一般的なタブ切り替え機能（掲示板以外のタブ用）
document.addEventListener('DOMContentLoaded', function() {
    // 掲示板以外のタブボタンのみを対象にする
    const tabButtons = document.querySelectorAll('.tab-btn:not(.bulletin-tabs .tab-btn)');
    const tabContents = document.querySelectorAll('.tab-content:not(.bulletin-content .tab-content)');
    
    console.log('一般タブ初期化:', tabButtons.length, 'ボタン,', tabContents.length, 'コンテンツ');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // すべてのタブボタンからアクティブクラスを削除
            tabButtons.forEach(btn => btn.classList.remove('active'));
            // すべてのタブコンテンツからアクティブクラスを削除
            tabContents.forEach(content => content.classList.remove('active'));
            
            // クリックされたタブボタンにアクティブクラスを追加
            this.classList.add('active');
            // 対応するタブコンテンツにアクティブクラスを追加
            const targetContent = document.getElementById(targetTab);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
});

// 投稿フォームの表示/非表示切り替え
document.addEventListener('DOMContentLoaded', function() {
    const formToggles = document.querySelectorAll('.post-form-toggle');
    
    formToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            const formId = this.getAttribute('data-form') + '-form';
            const form = document.getElementById(formId);
            
            if (form) {
                const isVisible = form.classList.contains('active');
                
                // すべてのフォームを非表示にする
                document.querySelectorAll('.post-form').forEach(f => {
                    f.classList.remove('active');
                });
                
                // すべてのトグルボタンのテキストをリセット
                document.querySelectorAll('.post-form-toggle').forEach(t => {
                    t.innerHTML = '<i class="fas fa-plus"></i> 新規投稿';
                });
                
                if (!isVisible) {
                    form.classList.add('active');
                    this.innerHTML = '<i class="fas fa-minus"></i> フォームを閉じる';
                }
            }
        });
    });
});

// フォームのキャンセルボタン機能
document.addEventListener('DOMContentLoaded', function() {
    const cancelButtons = document.querySelectorAll('.cancel-btn');
    
    cancelButtons.forEach(button => {
        button.addEventListener('click', function() {
            const form = this.closest('.post-form');
            const toggle = document.querySelector(`[data-form="${form.id.replace('-form', '')}"]`);
            
            if (form && toggle) {
                form.classList.remove('active');
                toggle.innerHTML = '<i class="fas fa-plus"></i> 新規投稿';
                
                // フォームの内容をリセット
                const inputs = form.querySelectorAll('input, textarea');
                inputs.forEach(input => {
                    if (input.type === 'file') {
                        input.value = '';
                    } else {
                        input.value = '';
                    }
                });
            }
        });
    });
});

// カスタムモーダル機能
class CustomModal {
    constructor() {
        this.modal = document.getElementById('custom-modal');
        this.overlay = this.modal.querySelector('.modal-overlay');
        this.closeBtn = document.getElementById('modal-close');
        this.cancelBtn = document.getElementById('modal-cancel');
        this.confirmBtn = document.getElementById('modal-confirm');
        this.messageEl = document.getElementById('modal-message');
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // モーダルを閉じるイベント
        this.closeBtn.addEventListener('click', () => this.hide());
        this.cancelBtn.addEventListener('click', () => this.hide());
        this.overlay.addEventListener('click', () => this.hide());
        
        // ESCキーでモーダルを閉じる
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('active')) {
                this.hide();
            }
        });
    }
    
    show(message, onConfirm) {
        this.messageEl.textContent = message;
        this.modal.classList.add('active');
        
        // 確認ボタンのイベントを設定
        this.confirmBtn.onclick = () => {
            this.hide();
            if (onConfirm) onConfirm();
        };
        
        // フォーカスを確認ボタンに設定
        setTimeout(() => {
            this.confirmBtn.focus();
        }, 100);
    }
    
    hide() {
        this.modal.classList.remove('active');
        this.confirmBtn.onclick = null;
    }
}

// グローバルモーダルインスタンス
if (typeof customModal === 'undefined') {
    var customModal;
}

// カスタム通知システム
class NotificationSystem {
    constructor() {
        this.container = document.getElementById('notification-container');
        this.notifications = [];
    }
    
    show(type, title, message, duration = 5000) {
        const notification = this.createNotification(type, title, message);
        this.container.appendChild(notification);
        this.notifications.push(notification);
        
        // 自動で閉じる
        if (duration > 0) {
            setTimeout(() => {
                this.hide(notification);
            }, duration);
        }
        
        return notification;
    }
    
    createNotification(type, title, message) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const iconMap = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            info: 'fas fa-info-circle',
            registration: 'fas fa-user-plus'
        };
        
        notification.innerHTML = `
            <i class="notification-icon ${iconMap[type] || iconMap.info}"></i>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close" onclick="notificationSystem.hide(this.parentElement)">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        return notification;
    }
    
    hide(notification) {
        if (!notification) return;
        
        notification.classList.add('hiding');
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.parentElement.removeChild(notification);
            }
            this.notifications = this.notifications.filter(n => n !== notification);
        }, 300);
    }
    
    hideAll() {
        this.notifications.forEach(notification => {
            this.hide(notification);
        });
    }
}

// グローバル通知システムインスタンス（重複宣言を避ける）
if (typeof notificationSystem === 'undefined') {
    var notificationSystem;
}
if (typeof notificationManager === 'undefined') {
    var notificationManager;
}

// グローバル変数が既に存在する場合は上書きしない
if (typeof window.notificationManager === 'undefined') {
    window.notificationManager = null;
}

// 通知管理クラス
class NotificationManager {
    constructor() {
        this.notifications = [];
        this.isDropdownVisible = false;
        this.notificationSound = null;
        this.init();
    }

    init() {
        console.log('NotificationManagerの初期化を開始...');
        
        try {
            this.loadNotifications();
            console.log('通知の読み込み完了');
            
            this.setupEventListeners();
            console.log('イベントリスナーの設定完了');
            
            this.updateBadge();
            console.log('バッジの更新完了');
            
            this.renderNotifications();
            console.log('通知の表示完了');
            
            console.log('NotificationManagerの初期化が完了しました');
        } catch (error) {
            console.error('NotificationManagerの初期化中にエラーが発生しました:', error);
        }
    }

    setupEventListeners() {
        const notificationBtn = document.getElementById('notification-btn');
        const notificationDropdown = document.getElementById('notification-dropdown');
        const clearAllBtn = document.getElementById('clear-all-notifications');

        if (notificationBtn) {
            notificationBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            });
        }

        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.clearAllNotifications();
            });
        }

        // ドロップダウン外をクリックした時に閉じる
        document.addEventListener('click', (e) => {
            if (!notificationBtn?.contains(e.target) && !notificationDropdown?.contains(e.target)) {
                this.hideDropdown();
            }
        });

        // 通知音の設定
        this.setupNotificationSound();
    }

    setupNotificationSound() {
        // 通知音を無効化
        this.notificationSound = null;
        console.log('通知音を無効化しました');
    }

    toggleDropdown() {
        if (this.isDropdownVisible) {
            this.hideDropdown();
        } else {
            this.showDropdown();
        }
    }

    showDropdown() {
        const dropdown = document.getElementById('notification-dropdown');
        if (dropdown) {
            dropdown.style.display = 'block';
            this.isDropdownVisible = true;
        }
    }

    hideDropdown() {
        const dropdown = document.getElementById('notification-dropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
            this.isDropdownVisible = false;
        }
    }

    // システム通知を追加（開発者用）
    addSystemNotification(title, message, priority = 'normal', isUnread = true) {
        const notification = {
            id: Date.now() + Math.random(),
            title: title,
            message: message,
            type: 'system',
            priority: priority, // 'low', 'normal', 'high', 'urgent'
            timestamp: new Date(),
            isUnread: isUnread,
            createdBy: 'system' // システム通知であることを示す
        };

        this.notifications.unshift(notification);
        this.updateBadge();
        this.renderNotifications();
        this.saveNotifications();
        this.playNotificationSound();
        
        console.log('システム通知が追加されました:', notification);
        return notification.id;
    }

    // 掲示板通知を追加（ユーザー投稿用）
    addBulletinNotification(title, message, category = 'general', isUnread = true) {
        const notification = {
            id: Date.now() + Math.random(),
            title: title,
            message: message,
            type: 'bulletin',
            category: category, // 'complaint', 'refund', 'hold', 'delivery', 'registration', 'other'
            timestamp: new Date(),
            isUnread: isUnread,
            createdBy: 'user' // ユーザー投稿であることを示す
        };

        this.notifications.unshift(notification);
        this.updateBadge();
        this.renderNotifications();
        this.saveNotifications();
        this.playNotificationSound();
        
        console.log('掲示板通知が追加されました:', notification);
        return notification.id;
    }

    // 従来の通知メソッド（後方互換性のため）
    addNotification(title, message, type = 'info', isUnread = true) {
        if (type === 'system' || type === 'bulletin') {
            // 新しい通知タイプの場合は適切なメソッドを使用
            if (type === 'system') {
                return this.addSystemNotification(title, message, 'normal', isUnread);
            } else {
                return this.addBulletinNotification(title, message, 'general', isUnread);
            }
        } else {
            // 従来の通知タイプ
            const notification = {
                id: Date.now() + Math.random(),
                title: title,
                message: message,
                type: type,
                timestamp: new Date(),
                isUnread: isUnread,
                createdBy: 'legacy'
            };

            this.notifications.unshift(notification);
            this.updateBadge();
            this.renderNotifications();
            this.saveNotifications();
            this.playNotificationSound();
            
            return notification.id;
        }
    }

    markAsRead(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification) {
            notification.isUnread = false;
            this.updateBadge();
            this.renderNotifications();
            this.saveNotifications();
            
            console.log(`通知ID ${notificationId} を既読にしました:`, notification.title);
        } else {
            console.warn(`通知ID ${notificationId} が見つかりません`);
        }
    }

    removeNotification(notificationId) {
        this.notifications = this.notifications.filter(n => n.id !== notificationId);
        this.updateBadge();
        this.renderNotifications();
        this.saveNotifications();
    }

    clearAllNotifications() {
        this.notifications = [];
        this.updateBadge();
        this.renderNotifications();
        this.saveNotifications();
    }

    updateBadge() {
        const badge = document.getElementById('notification-badge');
        const unreadCount = this.notifications.filter(n => n.isUnread).length;
        
        if (badge) {
            badge.textContent = unreadCount;
            if (unreadCount > 0) {
                badge.style.display = 'flex';
                badge.classList.remove('hidden');
            } else {
                badge.style.display = 'none';
                badge.classList.add('hidden');
            }
        }
    }

    renderNotifications() {
        console.log('renderNotificationsが呼び出されました');
        console.log('通知数:', this.notifications.length);
        console.log('通知データ:', this.notifications);
        
        const notificationList = document.getElementById('notification-list');
        if (!notificationList) {
            console.error('notification-list要素が見つかりません');
            return;
        }
        
        console.log('notification-list要素が見つかりました');

        if (this.notifications.length === 0) {
            console.log('通知がないため、空のメッセージを表示します');
            notificationList.innerHTML = `
                <div class="no-notifications">
                    <i class="fas fa-bell-slash"></i>
                    <p>通知はありません</p>
                </div>
            `;
            return;
        }

        // 通知をタイプ別にグループ化
        const systemNotifications = this.notifications.filter(n => n.type === 'system');
        const bulletinNotifications = this.notifications.filter(n => n.type === 'bulletin');
        const otherNotifications = this.notifications.filter(n => n.type !== 'system' && n.type !== 'bulletin');

        let html = '';

        // システム通知セクション
        if (systemNotifications.length > 0) {
            html += `
                <div class="notification-section">
                    <div class="notification-section-header">
                        <i class="fas fa-cog"></i>
                        <span>システム通知</span>
                        <span class="notification-count">${systemNotifications.length}</span>
                    </div>
                    ${systemNotifications.map(notification => this.createNotificationHTML(notification)).join('')}
                </div>
            `;
        }

        // 掲示板通知セクション
        if (bulletinNotifications.length > 0) {
            html += `
                <div class="notification-section">
                    <div class="notification-section-header">
                        <i class="fas fa-bullhorn"></i>
                        <span>掲示板通知</span>
                        <span class="notification-count">${bulletinNotifications.length}</span>
                    </div>
                    ${bulletinNotifications.map(notification => this.createNotificationHTML(notification)).join('')}
                </div>
            `;
        }

        // その他の通知セクション
        if (otherNotifications.length > 0) {
            html += `
                <div class="notification-section">
                    <div class="notification-section-header">
                        <i class="fas fa-info-circle"></i>
                        <span>その他の通知</span>
                        <span class="notification-count">${otherNotifications.length}</span>
                    </div>
                    ${otherNotifications.map(notification => this.createNotificationHTML(notification)).join('')}
                </div>
            `;
        }

        notificationList.innerHTML = html;
    }

    createNotificationHTML(notification) {
        const priorityClass = notification.priority ? `priority-${notification.priority}` : '';
        const categoryClass = notification.category ? `category-${notification.category}` : '';
        const unreadClass = notification.isUnread ? 'unread' : 'read';
        const typeIcon = this.getTypeIcon(notification.type);
        const priorityIcon = this.getPriorityIcon(notification.priority);
        
        return `
            <div class="notification-item ${unreadClass} ${priorityClass} ${categoryClass}" data-id="${notification.id}">
                <div class="notification-header">
                    <div class="notification-type">
                        ${typeIcon}
                        ${priorityIcon}
                        ${!notification.isUnread ? '<i class="fas fa-check-circle read-indicator" title="既読"></i>' : ''}
                    </div>
                    <div class="notification-actions">
                        ${notification.isUnread ? 
                            `<button class="mark-read-btn" onclick="notificationManager.markAsRead(${notification.id})" title="既読にする">
                                <i class="fas fa-check"></i>
                            </button>` : ''
                        }
                        <button class="remove-notification-btn" onclick="notificationManager.removeNotification(${notification.id})" title="削除">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="notification-content" onclick="notificationManager.markAsRead(${notification.id})">
                    <h4 class="notification-title">${notification.title}</h4>
                    <p class="notification-message">${notification.message}</p>
                    <div class="notification-meta">
                        <span class="notification-time">${this.getTimeAgo(notification.timestamp)}</span>
                        ${notification.category ? `<span class="notification-category">${this.getCategoryDisplayName(notification.category)}</span>` : ''}
                        ${notification.priority ? `<span class="notification-priority">${this.getPriorityDisplayName(notification.priority)}</span>` : ''}
                        ${!notification.isUnread ? '<span class="read-status">既読</span>' : ''}
                    </div>
                </div>
            </div>
        `;
    }

    getTypeIcon(type) {
        const iconMap = {
            'system': '<i class="fas fa-cog" title="システム通知"></i>',
            'bulletin': '<i class="fas fa-bullhorn" title="掲示板通知"></i>',
            'info': '<i class="fas fa-info-circle" title="情報"></i>',
            'success': '<i class="fas fa-check-circle" title="成功"></i>',
            'warning': '<i class="fas fa-exclamation-triangle" title="警告"></i>',
            'error': '<i class="fas fa-times-circle" title="エラー"></i>'
        };
        return iconMap[type] || iconMap['info'];
    }

    getPriorityIcon(priority) {
        if (!priority) return '';
        
        const iconMap = {
            'low': '<i class="fas fa-arrow-down" title="低優先度"></i>',
            'normal': '',
            'high': '<i class="fas fa-arrow-up" title="高優先度"></i>',
            'urgent': '<i class="fas fa-exclamation" title="緊急"></i>'
        };
        return iconMap[priority] || '';
    }

    getCategoryDisplayName(category) {
        const categoryMap = {
            'complaint': 'クレーム',
            'refund': '返品返金',
            'hold': '取り置き',
            'delivery': '納品',
            'registration': '登録依頼',
            'other': 'その他連絡',
            'manual': 'マニュアル',
            'general': '一般'
        };
        return categoryMap[category] || category;
    }

    getPriorityDisplayName(priority) {
        const priorityMap = {
            'low': '低',
            'normal': '通常',
            'high': '高',
            'urgent': '緊急'
        };
        return priorityMap[priority] || priority;
    }

    getTimeAgo(date) {
        const now = new Date();
        const diff = now - new Date(date);
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '今';
        if (minutes < 60) return `${minutes}分前`;
        if (hours < 24) return `${hours}時間前`;
        if (days < 7) return `${days}日前`;
        
        return new Date(date).toLocaleDateString('ja-JP');
    }

    saveNotifications() {
        try {
            const notificationsToSave = this.notifications.map(n => ({
                ...n,
                timestamp: n.timestamp instanceof Date ? n.timestamp.toISOString() : n.timestamp
            }));
            localStorage.setItem('notifications', JSON.stringify(notificationsToSave));
            console.log('通知が保存されました:', this.notifications.length, '件');
        } catch (error) {
            console.error('通知の保存に失敗しました:', error);
        }
    }

    loadNotifications() {
        try {
            const saved = localStorage.getItem('notifications');
            if (saved) {
                this.notifications = JSON.parse(saved).map(n => ({
                    ...n,
                    timestamp: new Date(n.timestamp)
                }));
                console.log('通知を読み込みました:', this.notifications.length, '件');
                console.log('既読状態:', this.notifications.filter(n => !n.isUnread).length, '件');
            } else {
                console.log('保存された通知がありません');
                this.notifications = [];
            }
        } catch (error) {
            console.error('通知の読み込みに失敗しました:', error);
            this.notifications = [];
        }
    }

    playNotificationSound() {
        // 通知音の再生を無効化
        console.log('通知音の再生をスキップしました');
    }

    // 開発者用のシステム通知作成メソッド
    createSystemNotification(title, message, priority = 'normal') {
        return this.addSystemNotification(title, message, priority, true);
    }

    // 掲示板通知作成メソッド
    createBulletinNotification(title, message, category = 'general') {
        return this.addBulletinNotification(title, message, category, true);
    }

    // 通知統計の取得
    getNotificationStats() {
        const stats = {
            total: this.notifications.length,
            unread: this.notifications.filter(n => n.isUnread).length,
            system: this.notifications.filter(n => n.type === 'system').length,
            bulletin: this.notifications.filter(n => n.type === 'bulletin').length,
            other: this.notifications.filter(n => n.type !== 'system' && n.type !== 'bulletin').length
        };
        return stats;
    }
}

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('ホーム画面が読み込まれました');
    
    // カスタムモーダルを初期化
    try {
        customModal = new CustomModal();
        console.log('カスタムモーダルが初期化されました');
    } catch (error) {
        console.error('カスタムモーダルの初期化に失敗しました:', error);
    }
    
    // 通知システムを初期化
    try {
        notificationSystem = new NotificationSystem();
        console.log('通知システムが初期化されました');
    } catch (error) {
        console.error('通知システムの初期化に失敗しました:', error);
    }
    
    // 通知マネージャーを初期化（重複を避ける）
    try {
        if (!window.notificationManager && !notificationManager) {
            notificationManager = new NotificationManager();
            window.notificationManager = notificationManager;
            console.log('通知マネージャーが初期化されました');
        } else {
            notificationManager = window.notificationManager || notificationManager;
            console.log('既存の通知マネージャーを使用します');
        }
    } catch (error) {
        console.error('通知マネージャーの初期化に失敗しました:', error);
    }
    
    // ナビゲーションバーを表示
    const navbar = document.getElementById('navbar');
    if (navbar) {
        navbar.style.display = 'block';
    }
    
    // メインコンテンツを表示
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.style.display = 'block';
    }
    
    // 通知要素の存在確認
    setTimeout(() => {
        const notificationBtn = document.getElementById('notification-btn');
        const notificationDropdown = document.getElementById('notification-dropdown');
        const notificationList = document.getElementById('notification-list');
        const notificationBadge = document.getElementById('notification-badge');
        
        console.log('通知要素の確認:', {
            notificationBtn: !!notificationBtn,
            notificationDropdown: !!notificationDropdown,
            notificationList: !!notificationList,
            notificationBadge: !!notificationBadge
        });
        
        if (!notificationBtn) {
            console.error('通知ボタンが見つかりません');
        }
        if (!notificationDropdown) {
            console.error('通知ドロップダウンが見つかりません');
        }
        if (!notificationList) {
            console.error('通知リストが見つかりません');
        }
        if (!notificationBadge) {
            console.error('通知バッジが見つかりません');
        }
    }, 500);
});

// 開発者用のシステム通知作成関数（コンソールからアクセス可能）
window.createSystemNotification = function(title, message, priority = 'normal') {
    if (typeof notificationManager !== 'undefined') {
        return notificationManager.createSystemNotification(title, message, priority);
    } else {
        console.error('通知マネージャーが初期化されていません');
        return null;
    }
};

// システム通知の例
window.createSystemNotificationExample = function() {
    // 通常のシステム通知
    createSystemNotification('システムメンテナンス', 'システムメンテナンスを開始します。', 'normal');
    
    // 高優先度のシステム通知
    setTimeout(() => {
        createSystemNotification('緊急メンテナンス', '緊急メンテナンスが必要です。', 'urgent');
    }, 2000);
    
    // 低優先度のシステム通知
    setTimeout(() => {
        createSystemNotification('機能更新', '新しい機能が追加されました。', 'low');
    }, 4000);
};

// 通知統計の取得
window.getNotificationStats = function() {
    if (typeof notificationManager !== 'undefined') {
        const stats = notificationManager.getNotificationStats();
        console.log('通知統計:', stats);
        return stats;
    } else {
        console.error('通知マネージャーが初期化されていません');
        return null;
    }
};

// すべての通知をクリア
window.clearAllNotifications = function() {
    if (typeof notificationManager !== 'undefined') {
        notificationManager.clearAllNotifications();
        console.log('すべての通知がクリアされました');
    } else {
        console.error('通知マネージャーが初期化されていません');
    }
};

// テスト通知を削除
window.removeTestNotifications = function() {
    if (typeof notificationManager !== 'undefined') {
        const notifications = notificationManager.notifications;
        const testNotifications = notifications.filter(n => 
            n.title === 'システム初期化' || 
            n.title === '掲示板通知テスト' ||
            n.title.includes('テスト')
        );
        
        testNotifications.forEach(notification => {
            notificationManager.removeNotification(notification.id);
            console.log(`テスト通知を削除しました: ${notification.title}`);
        });
        
        console.log(`${testNotifications.length}件のテスト通知を削除しました`);
    } else {
        console.error('通知マネージャーが初期化されていません');
    }
};

// ローカルストレージをクリア
window.clearNotificationStorage = function() {
    try {
        localStorage.removeItem('notifications');
        console.log('通知のローカルストレージをクリアしました');
        
        // ページを再読み込み
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    } catch (error) {
        console.error('ローカルストレージのクリアに失敗しました:', error);
    }
};

// 開発者向けのヘルプ
console.log(`
=== 通知システム開発者向けコマンド ===

1. システム通知を作成:
   createSystemNotification('タイトル', 'メッセージ', '優先度')
   優先度: 'low', 'normal', 'high', 'urgent'

2. システム通知の例を実行:
   createSystemNotificationExample()

3. 通知統計を取得:
   getNotificationStats()

4. すべての通知をクリア:
   clearAllNotifications()

5. テスト通知を削除:
   removeTestNotifications()

6. ローカルストレージをクリア:
   clearNotificationStorage()

7. データベース機能（bulletinUI.db経由）:
   - bulletinUI.db.saveSystemNotificationToDatabase('タイトル', 'メッセージ', '優先度')
   - bulletinUI.db.getSystemNotificationsFromDatabase()
   - bulletinUI.db.getBulletinNotificationsFromDatabase()
   - bulletinUI.db.createSystemNotificationFromTemplate('テンプレート名', {変数})

8. テンプレート機能:
   - bulletinUI.db.getNotificationTemplatesFromDatabase('system')
   - bulletinUI.db.createSystemNotificationFromTemplate('system_maintenance', {duration: '2時間'})

例:
   createSystemNotification('メンテナンス', 'システムメンテナンスを開始します', 'normal')
   createSystemNotification('緊急', '緊急事態が発生しました', 'urgent')
   
   テンプレート使用例:
   bulletinUI.db.createSystemNotificationFromTemplate('system_maintenance', {duration: '3時間'})
   bulletinUI.db.createSystemNotificationFromTemplate('system_emergency', {impact: '全機能停止'})
`);
