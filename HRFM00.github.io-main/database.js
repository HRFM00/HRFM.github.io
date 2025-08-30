// Supabaseクライアントの設定
// 
// Supabase設定値の取得方法:
// 1. Supabaseダッシュボードにログイン
// 2. プロジェクトを選択
// 3. Settings > API に移動
// 4. Project URL と anon public key をコピー
// 5. 下記の定数に設定値を入力してください
//
const SUPABASE_URL = 'https://ppmbtoptcxelwewwompk.supabase.co'; // 実際のSupabase URLに変更してください
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwbWJ0b3B0Y3hlbHdld3dvbXBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwNjE0NjcsImV4cCI6MjA2OTYzNzQ2N30.Q01_d75sc3j362CMulQwkhtp0SuTzU86X2ElmXPU518'; // 実際のSupabase ANON KEYに変更してください

// 写真アップロード機能の設定
const ENABLE_PHOTO_UPLOAD = true; // 写真アップロード機能を有効化

// Supabaseクライアントを安全に初期化（重複宣言を避ける）
if (typeof supabaseClient === 'undefined') {
    var supabaseClient;
}

function initializeSupabase() {
    try {
        // 既存のクライアントがある場合は再利用
        if (window.supabaseClient) {
            supabaseClient = window.supabaseClient;
            console.log('既存のSupabaseクライアントを使用します');
            return true;
        }
        
        if (typeof window.supabase !== 'undefined') {
            // URLとANON_KEYの妥当性をチェック
            if (!SUPABASE_URL || SUPABASE_URL === 'https://your-project.supabase.co') {
                console.error('Supabase URLが設定されていません。database.jsファイルでSUPABASE_URLを設定してください。');
                return false;
            }
            
            if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'your-anon-key') {
                console.error('Supabase ANON KEYが設定されていません。database.jsファイルでSUPABASE_ANON_KEYを設定してください。');
                return false;
            }
            
            // 新しいクライアントを作成
            if (!supabaseClient) {
                supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                window.supabaseClient = supabaseClient; // グローバルに保存
                console.log('Supabaseクライアントが正常に初期化されました');
            }
            
            // ストレージバケットの確認
            checkStorageBucket();
            
            return true;
        } else {
            console.error('Supabaseライブラリが読み込まれていません');
            return false;
        }
    } catch (error) {
        console.error('Supabaseクライアントの初期化に失敗しました:', error);
        return false;
    }
}

// ストレージバケットの確認
async function checkStorageBucket() {
    try {
        if (!supabaseClient) {
            console.error('Supabaseクライアントが初期化されていません');
            return false;
        }
        
        console.log('ストレージバケットの確認中...');
        
        // より詳細な診断情報を追加
        console.log('Supabaseクライアント設定:', {
            url: SUPABASE_URL,
            hasAnonKey: !!SUPABASE_ANON_KEY,
            keyLength: SUPABASE_ANON_KEY?.length
        });
        
        // まず、直接photosバケットにアクセスを試行
        console.log('photosバケットへの直接アクセスをテスト...');
        try {
            const { data: files, error: filesError } = await supabaseClient.storage
                .from('photos')
                .list('', { limit: 1 });
            
            if (filesError) {
                console.error('photosバケットへのアクセスに失敗:', filesError);
            } else {
                console.log('photosバケットへのアクセス成功:', files);
                console.log('photosバケットが利用可能です');
                return true;
            }
        } catch (directAccessError) {
            console.error('photosバケットへの直接アクセス中にエラー:', directAccessError);
        }
        
        // バケットリストを取得して確認（フォールバック）
        console.log('バケットリストの取得を試行...');
        const { data: buckets, error } = await supabaseClient.storage.listBuckets();
        
        if (error) {
            console.error('ストレージバケットの確認に失敗しました:', error);
            console.error('エラー詳細:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            return false;
        }
        
        console.log('取得したバケット情報:', buckets);
        
        const photosBucket = buckets.find(bucket => bucket.name === 'photos');
        
        if (photosBucket) {
            console.log('photosバケットが見つかりました:', photosBucket);
            return true;
        } else {
            console.warn('photosバケットが見つかりません。写真アップロード機能が利用できません。');
            console.log('利用可能なバケット:', buckets.map(b => b.name));
            return false;
        }
    } catch (error) {
        console.error('ストレージバケットの確認中にエラーが発生しました:', error);
        return false;
    }
}

// データベース操作クラス
class BulletinBoardDB {
    constructor() {
        this.currentUser = null;
        if (!supabaseClient) {
            console.warn('Supabaseクライアントが初期化されていません。ローカルモードで動作します。');
            this.supabaseAvailable = false;
        } else {
            this.supabaseAvailable = true;
        }
        this.init();
    }

    // 初期化
    async init() {
        if (!this.supabaseAvailable) {
            console.log('Supabaseが利用できないため、ローカルモードで動作します');
            return;
        }

        try {
            // アプリのグローバルユーザーが存在する場合はそれを使用
            if (window.currentUser) {
                this.currentUser = {
                    id: window.currentUser.id,
                    display_name: window.currentUser.full_name || window.currentUser.username || 'ユーザー'
                };
                console.log('掲示板用ユーザーを同期しました:', this.currentUser);
            } else {
                // フォールバック: ローカルストレージから取得し、なければテストユーザー
                const saved = localStorage.getItem('currentUser');
                const parsed = saved ? JSON.parse(saved) : null;
                this.currentUser = {
                    id: parsed?.id || 1,
                    display_name: parsed?.full_name || parsed?.username || 'テストユーザー'
                };
                console.log('フォールバックユーザーを使用:', this.currentUser);
            }
        } catch (error) {
            console.error('初期化エラー:', error);
        }
    }

    // 投稿を取得
    async getPosts(category = null) {
        try {
            console.log('投稿を取得中... カテゴリ:', category);
            
            let query = supabaseClient
                .from('posts')
                .select(`
                    *,
                    users!posts_created_by_fkey (
                        full_name,
                        username
                    )
                `)
                .order('created_at', { ascending: false });

            if (category) {
                query = query.eq('category', category);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Supabaseエラー詳細:', error);
                throw new Error(`投稿の取得に失敗しました: ${error.message || error.details || '不明なエラー'}`);
            }

            console.log('取得した投稿:', data);
            return data || [];
        } catch (error) {
            console.error('投稿の取得に失敗しました:', error);
            throw error;
        }
    }

    // 投稿を作成
    async createPost(postData) {
        try {
            console.log('投稿データ:', postData);
            
            // 投稿者氏名を取得（window.currentUser優先）
            const posterName = (window.currentUser && (window.currentUser.full_name || window.currentUser.username))
                || this.currentUser?.display_name
                || null;

            // まず、created_by_name を含めて挿入を試行
            let { data, error } = await supabaseClient
                .from('posts')
                .insert([{
                    title: postData.title,
                    content: postData.content,
                    category: postData.category,
                    staff_name: postData.staff_name,
                    customer_name: postData.customer_name,
                    visit_date: postData.visit_date,
                    photo_url: postData.photo_url,
                    status: '未解決',
                    created_by: this.currentUser?.id || 1,
                    created_by_name: posterName
                }])
                .select();

            // カラムが存在しない場合は、created_by_name を除いて再試行
            if (error && (error.code === '42703' || /column .*created_by_name.* does not exist/i.test(error.message || ''))) {
                console.warn('created_by_name カラムが見つからないため、作成者名なしで再試行します');
                ({ data, error } = await supabaseClient
                    .from('posts')
                    .insert([{
                        title: postData.title,
                        content: postData.content,
                        category: postData.category,
                        staff_name: postData.staff_name,
                        customer_name: postData.customer_name,
                        visit_date: postData.visit_date,
                        photo_url: postData.photo_url,
                        status: '未解決',
                        created_by: this.currentUser?.id || 1
                    }])
                    .select());
            }

            if (error) {
                console.error('Supabaseエラー詳細:', error);
                throw new Error(`投稿の作成に失敗しました: ${error.message || error.details || '不明なエラー'}`);
            }

            console.log('投稿が正常に作成されました:', data);
            return data[0];
        } catch (error) {
            console.error('投稿の作成に失敗しました:', error);
            throw error;
        }
    }

    // 投稿の状態を更新
    async updatePostStatus(postId, status, resolver = null) {
        try {
            // 更新ペイロードを構築
            const payload = { status };
            if (status === '解決済み') {
                const globalUser = (typeof window !== 'undefined' && window.currentUser) ? window.currentUser : null;
                const userId = resolver?.id || globalUser?.id || this.currentUser?.id || null;
                const userName = resolver?.name || globalUser?.full_name || globalUser?.username || this.currentUser?.display_name || null;
                payload.resolved_by = userId;
                payload.resolved_by_name = userName;
                payload.resolved_at = new Date().toISOString();
            } else {
                payload.resolved_by = null;
                payload.resolved_by_name = null;
                payload.resolved_at = null;
            }

            let { data, error } = await supabaseClient
                .from('posts')
                .update(payload)
                .eq('id', postId)
                .select();

            // カラムが存在しない場合は、status のみ更新にフォールバック
            if (error && (error.code === '42703' || /column .* does not exist/i.test(error.message || ''))) {
                console.warn('resolved_* カラムが見つからないため、status のみ更新します');
                ({ data, error } = await supabaseClient
                    .from('posts')
                    .update({ status })
                    .eq('id', postId)
                    .select());
            }

            if (error) throw error;
            return data && data[0];
        } catch (error) {
            console.error('投稿の更新に失敗しました:', error);
            throw error;
        }
    }

    // 投稿を更新（タイトル・内容 ほか拡張可能）
    async updatePost(postId, updateFields) {
        try {
            const payload = {};
            if (Object.prototype.hasOwnProperty.call(updateFields, 'title')) {
                payload.title = updateFields.title;
            }
            if (Object.prototype.hasOwnProperty.call(updateFields, 'content')) {
                payload.content = updateFields.content;
            }
            if (Object.keys(payload).length === 0) return null;

            const { data, error } = await supabaseClient
                .from('posts')
                .update(payload)
                .eq('id', postId)
                .select();

            if (error) throw error;
            return data && data[0];
        } catch (error) {
            console.error('投稿の更新に失敗しました:', error);
            throw error;
        }
    }

    // 投稿を削除
    async deletePost(postId) {
        try {
            const { error } = await supabaseClient
                .from('posts')
                .delete()
                .eq('id', postId);

            if (error) {
                console.error('投稿の削除エラー:', error);
                throw new Error(`投稿の削除に失敗しました: ${error.message || error.details || '不明なエラー'}`);
            }
            console.log(`投稿ID ${postId} が削除されました`);
            return true;
        } catch (error) {
            console.error('投稿の削除に失敗しました:', error);
            throw error;
        }
    }

    // 複数写真をアップロード
    async uploadPhotos(files) {
        try {
            console.log('写真アップロード開始:', files.length, 'ファイル');
            
            if (!ENABLE_PHOTO_UPLOAD) {
                console.warn('写真アップロード機能が無効化されています');
                return [];
            }
            
            if (!supabaseClient) {
                console.error('Supabaseクライアントが初期化されていません');
                throw new Error('Supabaseクライアントが初期化されていません');
            }
            
            const uploadPromises = Array.from(files).map(async (file, index) => {
                try {
                    // ファイル名を安全な形式に変更
                    const timestamp = Date.now() + index; // インデックスを追加して一意性を確保
                    const originalName = file.name || 'image';
                    const fileExtension = originalName.split('.').pop()?.toLowerCase() || 'jpg';
                    
                    // 許可された拡張子のみ使用
                    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif'];
                    const safeExtension = allowedExtensions.includes(fileExtension) ? fileExtension : 'jpg';
                    const safeFileName = `${timestamp}.${safeExtension}`;
                    
                    console.log('アップロードするファイル名:', safeFileName, 'サイズ:', file.size);
                    
                    // ファイルの検証
                    this.validateFile(file);
                    
                    const { data, error } = await supabaseClient.storage
                        .from('photos')
                        .upload(safeFileName, file);

                    if (error) {
                        console.error('Storageアップロードエラー:', error);
                        throw new Error(`写真のアップロードに失敗しました: ${error.message}`);
                    }

                    console.log('Storageアップロード成功:', data);

                    // 公開URLを取得
                    const { data: { publicUrl } } = supabaseClient.storage
                        .from('photos')
                        .getPublicUrl(safeFileName);

                    console.log('公開URL取得成功:', publicUrl);
                    return publicUrl;
                } catch (fileError) {
                    console.error(`ファイル ${index + 1} のアップロードに失敗:`, fileError);
                    throw fileError;
                }
            });

            const urls = await Promise.all(uploadPromises);
            console.log('すべての写真のアップロードが完了しました:', urls);
            return urls;
        } catch (error) {
            console.error('写真のアップロードに失敗しました:', error);
            throw error;
        }
    }

    // 単一写真をアップロード（後方互換性のため）
    async uploadPhoto(file) {
        const urls = await this.uploadPhotos([file]);
        return urls[0];
    }

    // 写真アップロード機能のテスト
    async testPhotoUpload() {
        try {
            console.log('写真アップロード機能のテストを開始...');
            
            if (!ENABLE_PHOTO_UPLOAD) {
                console.warn('写真アップロード機能が無効化されています');
                return { success: false, message: '写真アップロード機能が無効化されています' };
            }
            
            if (!supabaseClient) {
                console.error('Supabaseクライアントが初期化されていません');
                return { success: false, message: 'Supabaseクライアントが初期化されていません' };
            }
            
            console.log('Supabaseクライアント設定確認:', {
                url: SUPABASE_URL,
                hasAnonKey: !!SUPABASE_ANON_KEY,
                keyLength: SUPABASE_ANON_KEY?.length
            });
            
            // まず、直接photosバケットにアクセスを試行
            console.log('photosバケットへの直接アクセスをテスト...');
            try {
                const { data: files, error: filesError } = await supabaseClient.storage
                    .from('photos')
                    .list('', { limit: 1 });
                
                if (filesError) {
                    console.error('photosバケットへのアクセスに失敗:', filesError);
                } else {
                    console.log('photosバケットへのアクセス成功:', files);
                    console.log('photosバケットが利用可能です');
                    return { success: true, message: '写真アップロード機能が正常に動作しています' };
                }
            } catch (directAccessError) {
                console.error('photosバケットへの直接アクセス中にエラー:', directAccessError);
            }
            
            // バケットリストを取得して確認（フォールバック）
            console.log('バケットリストの取得を試行...');
            const { data: buckets, error: bucketError } = await supabaseClient.storage.listBuckets();
            
            if (bucketError) {
                console.error('バケットリストの取得に失敗:', bucketError);
                console.error('バケットエラー詳細:', {
                    message: bucketError.message,
                    details: bucketError.details,
                    hint: bucketError.hint,
                    code: bucketError.code
                });
                return { success: false, message: `バケットリストの取得に失敗: ${bucketError.message}` };
            }
            
            console.log('取得したバケット情報:', buckets);
            console.log('バケット数:', buckets?.length || 0);
            
            const photosBucket = buckets.find(bucket => bucket.name === 'photos');
            
            if (!photosBucket) {
                console.error('photosバケットが見つかりません');
                console.log('利用可能なバケット名:', buckets.map(b => b.name));
                return { success: false, message: 'photosバケットが見つかりません。Supabaseダッシュボードでphotosバケットを作成してください。' };
            }
            
            console.log('photosバケットが見つかりました:', photosBucket);
            
            console.log('写真アップロード機能のテストが成功しました');
            return { success: true, message: '写真アップロード機能が正常に動作しています' };
            
        } catch (error) {
            console.error('写真アップロード機能のテストに失敗:', error);
            return { success: false, message: `テストに失敗: ${error.message}` };
        }
    }

    // ファイルの検証
    validateFile(file) {
        const maxSize = 50 * 1024 * 1024; // 50MB
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];

        if (!file) {
            throw new Error('ファイルが選択されていません');
        }

        if (file.size > maxSize) {
            const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
            const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
            throw new Error(`ファイルサイズは${maxSizeMB}MB以下にしてください（現在: ${fileSizeMB}MB）`);
        }

        if (!allowedTypes.includes(file.type)) {
            throw new Error('JPEG、PNG、GIF形式のみ対応しています');
        }

        return true;
    }
}

// 掲示板UI管理クラス
class BulletinBoardUI {
    constructor() {
        // 重複初期化を防ぐ
        if (window.bulletinUI) {
            console.log('BulletinBoardUIは既に初期化されています');
            return window.bulletinUI;
        }
        
        this.db = new BulletinBoardDB();
        this.currentCategory = 'manual';
        this.supabaseAvailable = !!supabaseClient;
        this.isSubmitting = false; // 重複送信防止フラグ
        this.latestPosts = []; // 直近に読み込んだ投稿一覧（編集権限等の参照用）
        this.init();
        
        // グローバルに保存
        window.bulletinUI = this;
    }

    // 初期化
    async init() {
        if (this.supabaseAvailable) {
            await this.loadPosts();
            
            // 写真機能の診断を実行
            setTimeout(async () => {
                await this.diagnosePhotoIssues();
            }, 2000); // 2秒後に診断を実行
        } else {
            console.log('Supabaseが設定されていないため、ローカルモードで動作します');
            this.showLocalModeMessage();
        }
        this.setupEventListeners();
    }

    // 投稿を読み込み
    async loadPosts(category = null) {
        try {
            const posts = await this.db.getPosts(category || this.currentCategory);
            this.latestPosts = Array.isArray(posts) ? posts : [];
            this.renderPosts(posts);
            // 動的生成要素に対してもUI権限を再適用
            if (typeof applyUiPermissions === 'function' && window.currentUser) {
                try { await applyUiPermissions(window.currentUser); } catch (_) {}
            }
        } catch (error) {
            console.error('投稿の読み込みに失敗しました:', error);
            this.showError('投稿の読み込みに失敗しました');
        }
    }

    // 投稿を表示
    renderPosts(posts) {
        const container = document.querySelector(`#${this.currentCategory} .bulletin-items`);
        if (!container) return;

        container.innerHTML = '';

        if (posts.length === 0) {
            container.innerHTML = `
                <div class="bulletin-item" style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 20px; color: #ddd;"></i>
                    <h4>投稿がありません</h4>
                    <p>このカテゴリにはまだ投稿がありません。<br>「新規投稿」ボタンから最初の投稿を作成してください。</p>
                </div>
            `;
            return;
        }

        posts.forEach(post => {
            const postElement = this.createPostElement(post);
            container.appendChild(postElement);
        });
    }

    // 投稿要素を作成
    createPostElement(post) {
        const div = document.createElement('div');
        div.className = 'bulletin-item';
        const authorName = post.created_by_name || post.users?.full_name || post.staff_name || '';
        const visitInfo = (post && (post.category === 'refund' || post.category === 'hold') && post.visit_date)
            ? `<div class="visit-info" style="margin-top:8px; color:#555;"><i class="fas fa-clock"></i> 来店日時: ${this.formatDateTime(post.visit_date)}</div>`
            : '';
        const canEdit = this.canEditPost(post);
        const editBtnHtml = canEdit ? `
                <button class="edit-btn" onclick="bulletinUI.openEditForm(${post.id}, this)">
                    <i class="fas fa-edit"></i> 編集
                </button>` : '';

        const statusBlock = (post.category === 'manual' || post.category === 'delivery')
            ? `
            <div class="bulletin-status" data-category="${post.category}">
                ${editBtnHtml}
                <button class="delete-btn" onclick="bulletinUI.deletePost(${post.id}, this)">
                    <i class="fas fa-trash"></i> 削除
                </button>
            </div>
            `
            : `
            <div class="bulletin-status" data-category="${post.category}">
                <span class="status-label">状態:</span>
                <span class="status-text ${post.status === '解決済み' ? 'resolved' : ''}">${post.status}</span>
                <span class="resolved-by" style="${post.status === '解決済み' && (post.resolved_by_name || post.resolved_by) ? '' : 'display:none;'}">${post.status === '解決済み' ? (post.resolved_by_name ? `解決者: ${post.resolved_by_name}` : (post.users?.full_name ? `解決者: ${post.users.full_name}` : '')) : ''}</span>
                <button class="resolve-btn ${post.status === '解決済み' ? 'unsolved' : ''}" onclick="bulletinUI.togglePostStatus(${post.id}, this)">
                    <i class="fas fa-${post.status === '解決済み' ? 'times' : 'check'}"></i> 
                    ${post.category === 'registration' ? (post.status === '解決済み' ? '未解決' : '登録済み') : (post.status === '解決済み' ? '未解決' : '解決済み')}
                </button>
                ${editBtnHtml}
                <button class="delete-btn" onclick="bulletinUI.deletePost(${post.id}, this)">
                    <i class="fas fa-trash"></i> 削除
                </button>
            </div>
            `;
        div.innerHTML = `
            <div class="bulletin-header">
                <span class="bulletin-date">${this.formatDate(post.created_at)}</span>
                <span class="bulletin-author">${authorName}</span>
                <span class="bulletin-category ${post.category}">${this.getCategoryDisplayName(post.category)}</span>
            </div>
            <h4 class="bulletin-title" data-content="${post.content || ''}">${post.title}</h4>
            ${statusBlock}
            <div class="bulletin-detail" style="display: none;">
                <p>${post.content || ''}</p>
                ${visitInfo}
                ${post.photo_url ? this.renderMultiplePhotos(post.photo_url) : ''}
            </div>
        `;

        // タイトルクリックイベントを追加
        const title = div.querySelector('.bulletin-title');
        title.addEventListener('click', function() {
            const detail = this.nextElementSibling.nextElementSibling;
            const isVisible = detail.style.display === 'block';
            
            // すべての詳細を非表示にする
            document.querySelectorAll('.bulletin-detail').forEach(d => {
                d.style.display = 'none';
            });
            
            // すべてのタイトルからアクティブクラスを削除
            document.querySelectorAll('.bulletin-title').forEach(t => {
                t.classList.remove('active');
            });
            
            if (!isVisible) {
                detail.style.display = 'block';
                this.classList.add('active');
            }
        });

        // manual / delivery は状態項目を描画しない（上の statusBlock で対応）

        return div;
    }

    // 自分の投稿、または管理者/開発者なら編集可能
    canEditPost(post) {
        try {
            const role = (window.currentUser && window.currentUser.role) || 'staff';
            if (role === 'administrator' || role === 'developer') return true;
            const currentUserId = (window.currentUser && window.currentUser.id) || null;
            const createdBy = post && (post.created_by ?? post.users?.id);
            if (currentUserId && createdBy && Number(currentUserId) === Number(createdBy)) return true;
            return false;
        } catch (_) {
            return false;
        }
    }

    // 編集フォームを開く（インライン）
    openEditForm(postId, button) {
        try {
            const item = button.closest('.bulletin-item');
            if (!item) return;

            // 既にフォームがあれば再生成を避ける
            if (item.querySelector('.bulletin-edit-form')) {
                const form = item.querySelector('.bulletin-edit-form');
                form.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }

            const titleEl = item.querySelector('.bulletin-title');
            const detailP = item.querySelector('.bulletin-detail p');
            const currentTitle = (titleEl && titleEl.textContent) ? titleEl.textContent.trim() : '';
            const currentContent = (detailP && detailP.textContent) ? detailP.textContent.trim() : '';

            const form = document.createElement('div');
            form.className = 'bulletin-edit-form';
            form.style.marginTop = '12px';
            form.style.padding = '12px';
            form.style.background = '#f8f9fa';
            form.style.borderRadius = '8px';
            form.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <label style="font-weight:600;">タイトル</label>
                    <input type="text" class="edit-title" value="${this.escapeForAttribute(currentTitle)}" style="padding:8px; border:1px solid #ddd; border-radius:6px;" />
                    <label style="font-weight:600;">内容</label>
                    <textarea class="edit-content" rows="4" style="padding:8px; border:1px solid #ddd; border-radius:6px;">${this.escapeForText(currentContent)}</textarea>
                    <div style="display:flex; gap:8px; margin-top:4px;">
                        <button class="btn-save" style="background:#2e86de; color:#fff; padding:6px 12px; border-radius:6px;" onclick="bulletinUI.saveEditPost(${postId}, this)"><i class=\"fas fa-save\"></i> 保存</button>
                        <button class="btn-cancel" style="background:#aaa; color:#fff; padding:6px 12px; border-radius:6px;" onclick="bulletinUI.cancelEdit(this)"><i class=\"fas fa-times\"></i> キャンセル</button>
                    </div>
                </div>
            `;

            // 詳細の直後に挿入
            const detail = item.querySelector('.bulletin-detail');
            if (detail && detail.parentNode) {
                detail.parentNode.insertBefore(form, detail.nextSibling);
                // 編集時は詳細を開く
                detail.style.display = 'block';
                titleEl && titleEl.classList.add('active');
            } else {
                item.appendChild(form);
            }

            form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (e) {
            console.error('編集フォームの表示に失敗しました:', e);
            this.showError('編集フォームの表示に失敗しました');
        }
    }

    escapeForAttribute(value) {
        return (value || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    escapeForText(value) {
        return (value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    async saveEditPost(postId, buttonEl) {
        try {
            const form = buttonEl.closest('.bulletin-edit-form');
            if (!form) return;
            const item = buttonEl.closest('.bulletin-item');
            const titleInput = form.querySelector('.edit-title');
            const contentArea = form.querySelector('.edit-content');
            const newTitle = (titleInput && titleInput.value || '').trim();
            const newContent = (contentArea && contentArea.value || '').trim();

            if (!newTitle) {
                this.showError('タイトルは必須です');
                return;
            }

            // 権限チェック（フロント防御）
            const post = this.latestPosts.find(p => Number(p.id) === Number(postId));
            if (post && !this.canEditPost(post)) {
                this.showError('編集権限がありません');
                return;
            }

            await this.db.updatePost(postId, { title: newTitle, content: newContent });

            // フォームを閉じて再読み込み
            form.remove();
            await this.loadPosts(this.currentCategory);
            this.showSuccess('投稿を更新しました');
        } catch (e) {
            console.error('投稿の更新に失敗しました:', e);
            this.showError('投稿の更新に失敗しました');
        }
    }

    cancelEdit(buttonEl) {
        const form = buttonEl.closest('.bulletin-edit-form');
        if (form) form.remove();
    }

    // 投稿の状態を切り替え
    async togglePostStatus(postId, button) {
        try {
            const statusContainer = button.parentElement;
            const category = statusContainer?.dataset?.category;
            const statusText = statusContainer.querySelector('.status-text');
            const isResolved = statusText.textContent === '解決済み';
            const newStatus = isResolved ? '未解決' : '解決済み';

            // データベースを更新（解決者情報も渡す）
            await this.db.updatePostStatus(postId, newStatus, {
                id: (window.currentUser && window.currentUser.id) || null,
                name: (window.currentUser && (window.currentUser.full_name || window.currentUser.username)) || null
            });

            // UIを更新
            statusText.textContent = newStatus;
            if (newStatus === '解決済み') {
                statusText.classList.add('resolved');
                button.classList.add('unsolved');
                button.innerHTML = '<i class="fas fa-times"></i> 未解決';
                button.style.background = '#ff4757';
                // 解決者名を表示
                const displayName = (window.currentUser?.full_name || window.currentUser?.username || '').trim();
                let resolvedBy = statusContainer.querySelector('.resolved-by');
                if (!resolvedBy) {
                    resolvedBy = document.createElement('span');
                    resolvedBy.className = 'resolved-by';
                    statusText.insertAdjacentElement('afterend', resolvedBy);
                }
                if (displayName) {
                    resolvedBy.textContent = `解決者: ${displayName}`;
                    resolvedBy.style.display = '';
                }
            } else {
                statusText.classList.remove('resolved');
                button.classList.remove('unsolved');
                const nextLabel = category === 'registration' ? '登録済み' : '解決済み';
                button.innerHTML = `<i class=\"fas fa-check\"></i> ${nextLabel}`;
                button.style.background = '#2ed573';
                // 解決者名を非表示
                const resolvedBy = statusContainer.querySelector('.resolved-by');
                if (resolvedBy) {
                    resolvedBy.style.display = 'none';
                }
            }

            console.log(`投稿の状態が${newStatus}に更新されました`);
        } catch (error) {
            console.error('状態の更新に失敗しました:', error);
            this.showError('状態の更新に失敗しました');
        }
    }

    // 投稿を削除
    async deletePost(postId, button) {
        // 権限チェック（防御的）: 削除は管理者と開発者に許可
        const userRole = (window.currentUser && window.currentUser.role) || 'staff';
        if (userRole !== 'developer' && userRole !== 'administrator') {
            this.showError('削除権限がありません');
            return;
        }

        // カスタムモーダルを使用
        if (typeof customModal !== 'undefined') {
            customModal.show('この投稿を削除しますか？', async () => {
                try {
                    await this.db.deletePost(postId);
                    await this.loadPosts(this.currentCategory); // 投稿を再読み込み
                    this.showSuccess('投稿が削除されました！');
                } catch (error) {
                    console.error('投稿の削除に失敗しました:', error);
                    this.showError(error.message || '投稿の削除に失敗しました');
                }
            });
        } else {
            // フォールバック: カスタムConfirmがあれば使用
            const ok = await (window.confirmAsync ? window.confirmAsync('この投稿を削除しますか？') : Promise.resolve(confirm('この投稿を削除しますか？')));
            if (ok) {
                try {
                    await this.db.deletePost(postId);
                    await this.loadPosts(this.currentCategory); // 投稿を再読み込み
                    this.showSuccess('投稿が削除されました！');
                } catch (error) {
                    console.error('投稿の削除に失敗しました:', error);
                    this.showError(error.message || '投稿の削除に失敗しました');
                }
            }
        }
    }

    // 投稿フォームの送信
    async submitPost(formData, category) {
        // 重複送信を防ぐためのフラグ
        if (this.isSubmitting) {
            console.log('投稿処理中です。重複送信をスキップします。');
            return;
        }
        
        this.isSubmitting = true;
        
        try {
            console.log('フォームデータ:', formData);
            
            // カテゴリ別のデータ取得ロジック
            let title, content, staff_name, customer_name, visit_date;
            
            if (category === 'delivery') {
                // 納品フォームの場合
                const equipment = formData.get('delivery-equipment') || 'NONE';
                const products = formData.get('delivery-products') || 'NONE';
                
                title = '納品依頼';
                content = `欲しい備品: ${equipment}\n欲しい商品: ${products}`;
                staff_name = formData.get('delivery-staff') || 'NONE';
                customer_name = 'NONE';
                visit_date = null;
            } else if (category === 'registration') {
                // 登録依頼フォームの場合
                title = '登録依頼';
                content = 'NONE';
                staff_name = 'NONE';
                customer_name = 'NONE';
                visit_date = null;
            } else if (category === 'other') {
                // その他連絡等フォームの場合
                title = formData.get('other-title') || 'NONE';
                content = formData.get('other-content') || 'NONE';
                staff_name = formData.get('other-author') || 'NONE';
                customer_name = 'NONE';
                visit_date = null;
            } else if (category === 'manual') {
                // マニュアルフォームの場合
                title = formData.get('manual-title') || 'NONE';
                content = formData.get('manual-content') || 'NONE';
                staff_name = 'NONE';
                customer_name = 'NONE';
                visit_date = null;
            } else {
                // その他のカテゴリの場合（complaint, refund, hold）
                title = formData.get(`${category}-title`) || 'NONE';
                content = formData.get(`${category}-content`) || 'NONE';
                staff_name = formData.get(`${category}-staff`) || 'NONE';
                customer_name = formData.get(`${category}-customer`) || 'NONE';
                visit_date = formData.get(`${category}-visit-date`) || null;
            }
            
            // 空文字列や空白のみの場合はNONEに設定
            if (staff_name && staff_name.trim() === '') {
                staff_name = 'NONE';
                console.log('担当者名が空白のため、NONEに設定しました');
            }
            
            // 担当者名が空の場合はNONEに設定
            if (!staff_name || staff_name.trim() === '') {
                staff_name = 'NONE';
                console.log('担当者名が空のため、NONEに設定しました');
            }
            
            // 最終的な担当者名の確認
            console.log('最終的な担当者名:', staff_name);
            
            const postData = {
                title: title,
                content: content,
                category: category,
                staff_name: staff_name,
                customer_name: customer_name,
                visit_date: visit_date
            };
            
            console.log('カテゴリ別データ処理結果:', {
                category: category,
                title: title,
                content: content,
                staff_name: staff_name,
                customer_name: customer_name,
                visit_date: visit_date
            });

            // 必須フィールドの検証
            if (!postData.title || postData.title === 'NONE') {
                throw new Error('タイトルは必須です');
            }
            // 担当者は必須ではないため、NONEでも投稿可能
            if (!postData.staff_name) {
                postData.staff_name = 'NONE';
                console.log('担当者名が空のため、NONEに設定しました');
            }

            console.log('処理する投稿データ:', postData);

            // 複数写真のアップロード（オプション）
            // フォームデータから写真フィールドを動的に検索
            let photoFiles = [];
            console.log('フォームデータの全フィールド:');
            for (let [key, value] of formData.entries()) {
                console.log(`フィールド: ${key}, 値:`, value);
                if (key.includes('photo') && value instanceof File && value.size > 0) {
                    photoFiles.push(value);
                    console.log(`写真ファイル検出: ${key} = ${value.name} (${value.size} bytes)`);
                }
            }
            const validPhotoFiles = photoFiles.filter(file => file && file.size > 0);
            
            console.log('写真ファイル検出:', validPhotoFiles.length, 'ファイル');
            console.log('検出された写真ファイル:', validPhotoFiles.map(f => f.name));
            
            if (validPhotoFiles.length > 0 && ENABLE_PHOTO_UPLOAD) {
                try {
                    console.log('写真アップロードを開始します...');
                    
                    // 各ファイルを検証
                    validPhotoFiles.forEach((file, index) => {
                        console.log(`ファイル ${index + 1} を検証中:`, file.name, file.size, file.type);
                        this.db.validateFile(file);
                    });
                    
                    // 複数写真をアップロード
                    const photoUrls = await this.db.uploadPhotos(validPhotoFiles);
                    postData.photo_url = photoUrls.join(','); // カンマ区切りで保存
                    console.log('写真のアップロードが完了しました:', postData.photo_url);
                } catch (photoError) {
                    console.error('写真のアップロードに失敗しました:', photoError);
                    this.showError(`写真のアップロードに失敗しました: ${photoError.message}`);
                    // 写真なしで投稿を続行
                    postData.photo_url = null;
                }
            } else if (validPhotoFiles.length > 0 && !ENABLE_PHOTO_UPLOAD) {
                console.log('写真アップロード機能が無効化されているため、写真なしで投稿します');
                postData.photo_url = null;
            } else {
                console.log('写真ファイルが選択されていないか、空のファイルです');
                postData.photo_url = null;
            }

            // 投稿を作成
            await this.db.createPost(postData);

            // 掲示板通知を作成（マニュアル以外）
            if (category !== 'manual') {
                this.createBulletinNotification(postData);
            }

            // フォームをリセット
            this.resetForm(category);

            // フォームを閉じる（確実に実行）
            this.closeForm(category);
            
            // フォームの表示状態を強制的に非表示にする
            const form = document.querySelector(`#${category}-form`);
            if (form) {
                form.style.display = 'none';
                form.classList.remove('active');
            }

            // 投稿を再読み込み
            await this.loadPosts(category);

            // 成功メッセージを表示
            this.showSuccess('投稿が完了しました！');
        } catch (error) {
            console.error('投稿の送信に失敗しました:', error);
            this.showError(error.message || '投稿の送信に失敗しました');
        } finally {
            // 送信フラグをリセット
            this.isSubmitting = false;
        }
    }

    // フォームをリセット
    resetForm(category) {
        const form = document.querySelector(`#${category}-form form`);
        if (form) {
            // フォームをリセット
            form.reset();
            
            // 写真プレビューをクリア
            const previewContainer = document.querySelector(`#${category}-form .photo-preview`);
            if (previewContainer) {
                previewContainer.innerHTML = '';
            }
            
            // ファイル入力フィールドをクリア
            const fileInputs = form.querySelectorAll('input[type="file"]');
            fileInputs.forEach(input => {
                input.value = '';
            });
            
            console.log(`${category}フォームをリセットしました`);
        } else {
            console.warn(`${category}フォームが見つかりません`);
        }
    }

    // フォームを閉じる
    closeForm(category) {
        const form = document.querySelector(`#${category}-form`);
        const toggle = document.querySelector(`[data-form="${category}"]`);
        
        if (form && toggle) {
            // フォームを非表示にする
            form.classList.remove('active');
            form.style.display = 'none';
            
            // トグルボタンのテキストをリセット
            toggle.innerHTML = '<i class="fas fa-plus"></i> 新規投稿';
            
            // フォーム内の入力フィールドをクリア
            const inputs = form.querySelectorAll('input, textarea, select');
            inputs.forEach(input => {
                if (input.type === 'file') {
                    input.value = '';
                } else {
                    input.value = '';
                }
            });
            
            console.log(`${category}フォームを閉じました`);
        } else {
            console.warn(`${category}フォームまたはトグルボタンが見つかりません`);
        }
    }

    // フォームを開く
    openForm(category) {
        const form = document.querySelector(`#${category}-form`);
        const toggle = document.querySelector(`[data-form="${category}"]`);
        
        if (form && toggle) {
            form.classList.add('active');
            toggle.innerHTML = '<i class="fas fa-minus"></i> フォームを閉じる';
            
            // 担当者フィールドに自動入力
            this.autoFillStaffName(category);
        }
    }

    // 担当者名を自動入力
    autoFillStaffName(category) {
        const globalUser = window.currentUser;
        const displayName = (globalUser?.full_name || globalUser?.username) || this.db?.currentUser?.display_name;
        console.log('担当者名自動入力開始:', category, 'ユーザー:', displayName);
        
        let staffInput = null;
        
        // カテゴリ別に担当者フィールドを検索
        if (category === 'delivery') {
            staffInput = document.querySelector('#delivery-staff');
        } else if (category === 'registration') {
            // 登録依頼フォームには担当者フィールドがないため、スキップ
            console.log('登録依頼フォームには担当者フィールドがありません');
            return;
        } else if (category === 'other') {
            // その他連絡等フォームは作成者フィールドを使用
            staffInput = document.querySelector('#other-author');
        } else {
            // その他のカテゴリ（complaint, refund, hold）
            staffInput = document.querySelector(`#${category}-staff`);
        }
        
        if (staffInput && displayName) {
            // フィールドが空の場合のみ自動入力
            if (!staffInput.value || staffInput.value.trim() === '') {
                staffInput.value = displayName;
                console.log('担当者名を自動入力しました:', displayName);
            } else {
                console.log('担当者フィールドに既に値が入力されているため、自動入力しません');
            }
        } else if (!staffInput) {
            console.log('担当者フィールドが見つかりません:', category);
        } else if (!displayName) {
            console.log('ユーザー情報が取得できません');
        }
    }

    // フォーム送信ハンドラ（イベントリスナーから呼び出し）
    async handleFormSubmit(formElement) {
        try {
            // カテゴリをフォームの親要素IDから推測（例: complaint-form → complaint）
            let category = this.currentCategory;
            const container = formElement.closest('.post-form');
            if (container && container.id && container.id.endsWith('-form')) {
                category = container.id.replace('-form', '');
            }

            const formData = new FormData(formElement);
            await this.submitPost(formData, category);
        } catch (error) {
            console.error('フォーム送信処理中にエラー:', error);
            this.showError(error.message || '投稿の送信に失敗しました');
        }
    }

    // イベントリスナーの設定
    setupEventListeners() {
        // 掲示板タブ切り替え（重複登録を防ぐ）
        document.querySelectorAll('.bulletin-tabs .tab-btn').forEach(button => {
            if (button.dataset.bulletinDbInitialized === 'true') return;

            button.addEventListener('click', async (e) => {
                const category = (e.currentTarget || button).getAttribute('data-tab');
                if (!category) return;
                this.currentCategory = category;
                await this.loadPosts(category);
            });

            button.dataset.bulletinDbInitialized = 'true';
        });

        // フォーム送信（重複送信防止）
        document.querySelectorAll('.post-form form').forEach(form => {
            // 既存のイベントリスナーを削除（重複を防ぐ）
            const newForm = form.cloneNode(true);
            form.parentNode.replaceChild(newForm, form);
            
            newForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleFormSubmit(newForm);
            });
        });

        // 写真プレビュー機能
        this.setupPhotoPreview();

        // フォームが開かれたときに担当者名を自動入力するイベントリスナー
        document.addEventListener('click', (e) => {
            if (e.target.closest('.post-form-toggle')) {
                const toggle = e.target.closest('.post-form-toggle');
                const category = toggle.getAttribute('data-form');
                const form = document.getElementById(`${category}-form`);
                
                if (form && form.classList.contains('active')) {
                    // フォームが開かれた直後に担当者名を自動入力
                    setTimeout(() => {
                        this.autoFillStaffName(category);
                    }, 100);
                }
            }
        });
        
        // フォームが表示されたときにも自動入力（フォールバック）
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const form = mutation.target;
                    if (form.classList.contains('active') && form.id && form.id.endsWith('-form')) {
                        const category = form.id.replace('-form', '');
                        setTimeout(() => {
                            this.autoFillStaffName(category);
                        }, 50);
                    }
                }
            });
        });
        
        // すべてのフォームを監視
        document.querySelectorAll('.post-form').forEach(form => {
            observer.observe(form, { attributes: true });
        });
    }

    // 写真プレビュー機能の設定
    setupPhotoPreview() {
        document.querySelectorAll('input[type="file"][multiple]').forEach(input => {
            // 既存のイベントリスナーを削除（重複を防ぐ）
            const newInput = input.cloneNode(true);
            input.parentNode.replaceChild(newInput, input);
            
            newInput.addEventListener('change', (e) => {
                this.handlePhotoSelection(e.target);
            });
        });
    }

    // 写真選択時の処理
    handlePhotoSelection(input) {
        const files = input.files;
        const previewContainer = document.getElementById(`${input.id}-preview`);
        
        if (!previewContainer) return;

        // プレビューをクリア
        previewContainer.innerHTML = '';

        if (files.length > 0) {
            Array.from(files).forEach((file, index) => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const previewItem = document.createElement('div');
                        previewItem.className = 'photo-preview-item';
                        previewItem.innerHTML = `
                            <img src="${e.target.result}" alt="プレビュー">
                            <button type="button" class="remove-photo" data-index="${index}">
                                <i class="fas fa-times"></i>
                            </button>
                            <div class="file-name">${file.name}</div>
                        `;

                        // 削除ボタンのイベントリスナー
                        const removeBtn = previewItem.querySelector('.remove-photo');
                        removeBtn.addEventListener('click', () => {
                            this.removePhotoFromSelection(input, index);
                            previewItem.remove();
                        });

                        previewContainer.appendChild(previewItem);
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    }

    // 写真選択から削除
    removePhotoFromSelection(input, index) {
        const files = Array.from(input.files);
        files.splice(index, 1);
        
        // FileListを再構築
        const dt = new DataTransfer();
        files.forEach(file => dt.items.add(file));
        input.files = dt.files;
    }

    // 複数写真を表示
    renderMultiplePhotos(photoUrls) {
        console.log('写真表示開始 - photoUrls:', photoUrls);
        
        if (!photoUrls || photoUrls === 'null' || photoUrls === 'undefined') {
            console.log('写真URLが空または無効です');
            return '';
        }
        
        // カンマ区切りのURLを配列に変換
        const urls = photoUrls.split(',').filter(url => url.trim() && url.trim() !== 'null' && url.trim() !== 'undefined');
        
        console.log('処理されたURL配列:', urls);
        
        if (urls.length === 0) {
            console.log('有効な写真URLが見つかりませんでした');
            return '';
        }
        
        if (urls.length === 1) {
            // 単一写真の場合
            console.log('単一写真を表示:', urls[0]);
            return `<img src="${urls[0]}" alt="投稿画像" style="max-width: 100%; margin-top: 10px; border-radius: 8px;" onerror="console.error('画像の読み込みに失敗:', this.src); this.style.display='none';">
                <div style="margin-top: 5px; font-size: 12px; color: #666;">写真が表示されない場合は、ブラウザの設定を確認してください</div>`;
        } else {
            // 複数写真の場合
            console.log('複数写真を表示:', urls.length, '枚');
            const photosHtml = urls.map((url, index) => `
                <div style="margin: 5px; display: inline-block;">
                    <img src="${url}" alt="投稿画像 ${index + 1}" style="max-width: 200px; max-height: 200px; border-radius: 8px; cursor: pointer;" 
                         onclick="this.style.maxWidth='100%'; this.style.maxHeight='none';" 
                         onerror="console.error('画像の読み込みに失敗:', this.src); this.style.display='none';">
                    <div style="font-size: 10px; color: #666; text-align: center;">写真 ${index + 1}</div>
                </div>
            `).join('');
            
            return `
                <div style="margin-top: 10px;">
                    <h5>写真 (${urls.length}枚):</h5>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                        ${photosHtml}
                    </div>
                    <div style="margin-top: 5px; font-size: 12px; color: #666;">
                        写真が表示されない場合は、ブラウザの設定を確認してください
                    </div>
                </div>
            `;
        }
    }

    // 日付のフォーマット
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // 日付+時刻のフォーマット
    formatDateTime(dateString) {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString || '';
        return date.toLocaleString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // カテゴリの表示名を取得
    getCategoryDisplayName(category) {
        const categoryMap = {
            'complaint': 'クレーム',
            'refund': '返品返金',
            'hold': '取り置き',
            'delivery': '納品',
            'registration': '登録依頼',
            'other': 'その他連絡',
            'manual': 'マニュアル'
        };
        return categoryMap[category] || category;
    }

    // 成功メッセージを表示
    showSuccess(message) {
        if (typeof notificationSystem !== 'undefined') {
            notificationSystem.show('success', '成功', message);
        } else {
            alertAsync(message);
        }
    }

    // エラーメッセージを表示
    showError(message) {
        if (typeof notificationSystem !== 'undefined') {
            notificationSystem.show('error', 'エラー', message);
        } else {
            alertAsync('エラー: ' + message);
        }
    }

    // 登録依頼専用の通知を表示
    showRegistrationNotification() {
        // 新しい通知マネージャーに掲示板通知を追加
        if (typeof notificationManager !== 'undefined') {
            notificationManager.addBulletinNotification('登録依頼', '新しい登録依頼が投稿されました！管理者が確認後、対応いたします。', 'registration');
        }
        
        // 従来の通知システムも併用
        if (typeof notificationSystem !== 'undefined') {
            notificationSystem.show('registration', '登録依頼', '新しい登録依頼が投稿されました！管理者が確認後、対応いたします。', 8000);
        } else {
            alertAsync('新しい登録依頼が投稿されました！管理者が確認後、対応いたします。');
        }
    }

    // 掲示板投稿時の通知を作成
    createBulletinNotification(postData) {
        const category = postData.category;
        const title = postData.title;
        const staffName = postData.staff_name || 'NONE';
        
        let message = '';
        let notificationCategory = 'general';
        
        switch (category) {
            case 'complaint':
                message = `新しいクレームが投稿されました。担当者: ${staffName}`;
                notificationCategory = 'complaint';
                break;
            case 'refund':
                message = `新しい返品返金の投稿がありました。担当者: ${staffName}`;
                notificationCategory = 'refund';
                break;
            case 'hold':
                message = `新しい取り置きの投稿がありました。担当者: ${staffName}`;
                notificationCategory = 'hold';
                break;
            case 'delivery':
                message = `新しい納品依頼が投稿されました。担当者: ${staffName}`;
                notificationCategory = 'delivery';
                break;
            case 'registration':
                message = '新しい登録依頼が投稿されました！管理者が確認後、対応いたします。';
                notificationCategory = 'registration';
                break;
            case 'other':
                message = `新しいその他連絡等の投稿がありました。担当者: ${staffName}`;
                notificationCategory = 'other';
                break;

            default:
                message = `新しい投稿がありました。担当者: ${staffName}`;
                notificationCategory = 'general';
        }
        
        // 新しい通知マネージャーに掲示板通知を追加
        if (typeof notificationManager !== 'undefined') {
            notificationManager.addBulletinNotification(title, message, notificationCategory);
        }
        
        console.log('掲示板通知が作成されました:', {
            title: title,
            message: message,
            category: notificationCategory
        });
    }

    // ローカルモードメッセージを表示
    showLocalModeMessage() {
        const containers = document.querySelectorAll('.bulletin-items');
        containers.forEach(container => {
            container.innerHTML = `
                <div class="bulletin-item" style="text-align: center; padding: 40px;">
                    <h4>Supabase設定が必要です</h4>
                    <p>掲示板機能を使用するには、database.jsファイルでSupabaseの設定を行ってください。</p>
                    <p>設定方法:</p>
                    <ol style="text-align: left; max-width: 400px; margin: 0 auto;">
                        <li>Supabaseダッシュボードにログイン</li>
                        <li>プロジェクトを選択</li>
                        <li>Settings > API に移動</li>
                        <li>Project URL と anon public key をコピー</li>
                        <li>database.jsファイルのSUPABASE_URLとSUPABASE_ANON_KEYを更新</li>
                    </ol>
                </div>
            `;
        });
    }

    // 写真機能のテストと診断
    async testPhotoFunctionality() {
        try {
            console.log('写真機能の診断を開始...');
            
            if (!this.supabaseAvailable) {
                return { success: false, message: 'Supabaseが利用できません' };
            }
            
            const testResult = await this.db.testPhotoUpload();
            
            if (testResult.success) {
                console.log('写真機能の診断が成功しました');
                return testResult;
            } else {
                console.error('写真機能の診断に失敗:', testResult.message);
                return testResult;
            }
        } catch (error) {
            console.error('写真機能の診断中にエラーが発生:', error);
            return { success: false, message: `診断エラー: ${error.message}` };
        }
    }

    // 写真問題の診断と解決策の提案
    async diagnosePhotoIssues() {
        const diagnosis = await this.testPhotoFunctionality();
        
        if (!diagnosis.success) {
            console.warn('写真機能に問題があります:', diagnosis.message);
            
            // ユーザーに問題を通知
            this.showError(`写真機能に問題があります: ${diagnosis.message}`);
            
            // 解決策を提案
            if (diagnosis.message.includes('photosバケットが見つかりません')) {
                this.showError(`
                    写真アップロード機能を有効にするには:
                    1. Supabaseダッシュボードにログイン
                    2. Storage > Buckets に移動
                    3. "photos" という名前のバケットを作成
                    4. バケットの設定で "Public" に設定
                `);
            }
        }
        
        return diagnosis;
    }
}

// グローバルインスタンス（重複宣言を避ける）
if (typeof bulletinUI === 'undefined') {
    var bulletinUI;
}

// DOM読み込み完了後に初期化
document.addEventListener('DOMContentLoaded', function() {
    // 既に初期化されている場合はスキップ
    if (window.bulletinUI || bulletinUI) {
        console.log('掲示板UIは既に初期化されています');
        return;
    }
    
    // Supabaseライブラリの読み込みを少し待つ
    setTimeout(() => {
        if (initializeSupabase()) {
            try {
                bulletinUI = new BulletinBoardUI();
                window.bulletinUI = bulletinUI; // グローバルに保存
                console.log('掲示板UIが正常に初期化されました');
            } catch (error) {
                console.error('掲示板UIの初期化に失敗しました:', error);
            }
        } else {
            console.error('Supabaseライブラリが読み込まれていないため、掲示板機能は利用できません。');
        }
    }, 100);
});
