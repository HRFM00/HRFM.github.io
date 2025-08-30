// 在庫管理システム
class InventoryManager {
    constructor() {
        this.products = [];
        this.currentTab = 'list';
        this.selectedInOutProduct = null;
        
        // Supabaseクライアントの初期化
        this.supabaseClient = this.initializeSupabase();
        
        this.init();
    }

    // Supabaseクライアントの初期化
    initializeSupabase() {
        // supabase-config.jsからSupabaseクライアントを取得
        try {
            // getSupabaseClient関数が利用可能かチェック
            if (typeof getSupabaseClient === 'undefined') {
                console.error('getSupabaseClient関数が見つかりません。supabase-config.jsが正しく読み込まれているか確認してください。');
                return null;
            }
            
            const client = getSupabaseClient();
            if (!client) {
                console.error('Supabaseクライアントの初期化に失敗しました');
                return null;
            }
            return client;
        } catch (error) {
            console.error('Supabaseクライアントの初期化エラー:', error);
            return null;
        }
    }

    init() {
        // すべてのローディング要素を非表示にする
        this.hideAllLoadingElements();
        
        this.setupEventListeners();
        this.loadInventoryData();
    }

    setupEventListeners() {
        // 商品登録フォームのイベントリスナー
        const productForm = document.getElementById('product-register-form');
        if (productForm) {
            productForm.addEventListener('submit', (e) => this.handleProductRegistration(e));
        }

        // ファイルアップロードのイベントリスナー
        const inventoryFileInput = document.getElementById('inventoryFileInput');
        if (inventoryFileInput) {
            inventoryFileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }

        // ドラッグ&ドロップのイベントリスナー
        this.setupDragAndDrop();

        // 入出庫管理イベント
        const inoutSearchBtn = document.getElementById('inout-search-btn');
        if (inoutSearchBtn) {
            inoutSearchBtn.addEventListener('click', () => this.handleInOutSearch());
        }
        const inoutInBtn = document.getElementById('inout-in-btn');
        if (inoutInBtn) {
            inoutInBtn.addEventListener('click', () => this.handleStockAdjust('in'));
        }
        const inoutOutBtn = document.getElementById('inout-out-btn');
        if (inoutOutBtn) {
            inoutOutBtn.addEventListener('click', () => this.handleStockAdjust('out'));
        }
        const inoutCode = document.getElementById('inout-code');
        const enterHandler = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleInOutSearch();
            }
        };
        if (inoutCode) inoutCode.addEventListener('keydown', enterHandler);

        // 入力リアルタイム検索（デバウンス）
        if (inoutCode) {
            if (this.inoutSearchTimer) clearTimeout(this.inoutSearchTimer);
            inoutCode.addEventListener('input', () => {
                if (this.inoutSearchTimer) clearTimeout(this.inoutSearchTimer);
                this.inoutSearchTimer = setTimeout(() => this.handleInOutSearch(true), 250);
            });
        }
    }

    setupDragAndDrop() {
        const dropZone = document.getElementById('inventoryDropZone');
        if (!dropZone) return;

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileUpload({ target: { files } });
            }
        });
    }

    // タブ切り替え
    switchInventoryTab(tabName) {
        // 権限制御: スタッフは登録・一括タブを開けない
        try {
            const role = (window.currentUser && window.currentUser.role) || 'staff';
            const isStaff = role === 'staff';
            const forbiddenTabs = ['register', 'bulk'];
            if (isStaff && forbiddenTabs.includes(tabName)) {
                this.showMessage('このタブへのアクセス権限がありません', 'error');
                // 一覧タブへフォールバック
                this.switchToInventoryListTab();
                return;
            }
        } catch (_) {}

        this.currentTab = tabName;
        
        // タブボタンのアクティブ状態を更新
        const tabs = document.querySelectorAll('.inventory-tab');
        tabs.forEach(tab => tab.classList.remove('active'));
        // クリックイベントがない呼び出しにも対応
        const clickedTab = document.querySelector(`.inventory-tab[onclick*="${tabName}"]`);
        if (clickedTab) clickedTab.classList.add('active');

        // コンテンツの表示/非表示を切り替え
        const contents = document.querySelectorAll('.inventory-content');
        contents.forEach(content => content.classList.remove('active'));
        document.getElementById(`inventory-${tabName}`).classList.add('active');

        // タブに応じた初期化
        if (tabName === 'list') {
            this.loadInventoryData();
        } else if (tabName === 'register') {
            // 編集モードでない場合のみフォームをクリア
            if (!this.currentEditId) {
                this.clearProductForm();
            }
        } else if (tabName === 'bulk') {
            this.resetBulkUpload();
        } else if (tabName === 'inout') {
            this.clearInOutForm();
        }
    }

    // 入出庫: 検索実行
    async handleInOutSearch(silent = false) {
        const codeInput = document.getElementById('inout-code');
        const code = codeInput ? codeInput.value.trim() : '';

        if (!code) {
            // リアルタイム時は黙ってクリア
            this.selectedInOutProduct = null;
            this.updateInOutInfo(null);
            if (!silent) {
                this.showMessage('ASINまたはJANコードを入力してください', 'warning');
            }
            return;
        }

        try {
            const product = await this.findProductByCode(code);
            if (!product) {
                this.selectedInOutProduct = null;
                this.updateInOutInfo(null);
                if (!silent) {
                    this.showMessage('該当する商品が見つかりませんでした', 'error');
                }
                return;
            }
            this.selectedInOutProduct = product;
            this.updateInOutInfo(product);
            if (!silent) this.showMessage('商品を読み込みました', 'success');
        } catch (error) {
            console.error('入出庫検索エラー:', error);
            this.showMessage('検索中にエラーが発生しました', 'error');
        }
    }

    // 入出庫: 在庫調整
    async handleStockAdjust(type) {
        const quantityInput = document.getElementById('inout-quantity');
        const quantity = quantityInput ? parseInt(quantityInput.value, 10) : NaN;
        if (!quantity || quantity <= 0) {
            this.showMessage('操作する個数を正しく入力してください', 'warning');
            return;
        }

        // 商品が未選択の場合は検索を試みる
        if (!this.selectedInOutProduct) {
            await this.handleInOutSearch();
            if (!this.selectedInOutProduct) return;
        }

        const current = this.selectedInOutProduct.stock_quantity || 0;
        const delta = type === 'in' ? quantity : -quantity;
        const next = current + delta;
        if (next < 0) {
            this.showMessage('在庫数がマイナスになります。出庫数を見直してください', 'error');
            return;
        }

        if (!this.supabaseClient) {
            this.showMessage('データベース接続エラー', 'error');
            return;
        }

        try {
            const { data, error } = await this.supabaseClient
                .from('products')
                .update({ stock_quantity: next })
                .eq('id', this.selectedInOutProduct.id)
                .select('id, asin, jan_code, product_name, price, stock_quantity, shelf_location')
                .single();

            if (error) throw error;

            // ローカル状態更新
            this.updateLocalProductStock(this.selectedInOutProduct.id, next);
            this.selectedInOutProduct = data || { ...this.selectedInOutProduct, stock_quantity: next };
            this.updateInOutInfo(this.selectedInOutProduct);
            this.updateInventoryTable();
            this.updateInventoryStats();

            const qtyText = String(quantity);
            this.showMessage(type === 'in' ? `${qtyText}個入庫しました` : `${qtyText}個出庫しました`, 'success');
        } catch (error) {
            console.error('在庫更新エラー:', error);
            this.showMessage('在庫更新に失敗しました', 'error');
        }
    }

    // 入出庫: コード正規化
    normalizeDigits(value) {
        if (value === null || value === undefined) return '';
        return String(value).replace(/\D/g, '').trim();
    }

    normalizeAsin(value) {
        if (value === null || value === undefined) return '';
        return String(value).replace(/[^0-9a-zA-Z]/g, '').toUpperCase().trim();
    }

    // 入出庫: 商品検索（ASIN/JAN）
    async findProductByCode(code) {
        // まずローカルキャッシュから検索（ASIN/JANを正規化して比較）
        const asinNorm = this.normalizeAsin(code);
        const janNorm = this.normalizeDigits(code);
        let found = this.products.find(p =>
            this.normalizeAsin(p.asin) === asinNorm || this.normalizeDigits(p.jan_code) === janNorm
        );
        if (found) return found;

        // DBから検索（ASIN候補→JAN候補 の順で）
        if (!this.supabaseClient) return null;
        try {
            const asinCandidates = Array.from(new Set([code, asinNorm].filter(Boolean)));
            for (const c of asinCandidates) {
                const { data, error } = await this.supabaseClient
                    .from('products')
                    .select('id, asin, jan_code, product_name, price, stock_quantity, shelf_location')
                    .eq('asin', c)
                    .limit(1);
                if (error) throw error;
                if (data && data.length > 0) return data[0];
            }

            const janCandidates = Array.from(new Set([code, janNorm].filter(Boolean)));
            for (const c of janCandidates) {
                const { data, error } = await this.supabaseClient
                    .from('products')
                    .select('id, asin, jan_code, product_name, price, stock_quantity, shelf_location')
                    .eq('jan_code', c)
                    .limit(1);
                if (error) throw error;
                if (data && data.length > 0) return data[0];
            }

            return null;
        } catch (e) {
            console.error('findProductByCode error:', e);
            return null;
        }
    }

    // 入出庫: UI更新
    updateInOutInfo(product) {
        const container = document.getElementById('inout-product-info');
        const asinEl = document.getElementById('inout-details-asin');
        const janEl = document.getElementById('inout-details-jan');
        const nameEl = document.getElementById('inout-details-name');
        const stockEl = document.getElementById('inout-details-stock');
        if (!container || !asinEl || !janEl || !nameEl || !stockEl) return;

        if (!product) {
            container.style.display = 'none';
            asinEl.textContent = '-';
            janEl.textContent = '-';
            nameEl.textContent = '-';
            stockEl.textContent = '-';
            return;
        }

        asinEl.textContent = product.asin || '-';
        janEl.textContent = product.jan_code || '-';
        nameEl.textContent = product.product_name || '-';
        stockEl.textContent = typeof product.stock_quantity === 'number' ? String(product.stock_quantity) : '-';
        container.style.display = 'block';
    }

    // 入出庫: 入力リセット
    clearInOutForm() {
        const codeInput = document.getElementById('inout-code');
        const qtyInput = document.getElementById('inout-quantity');
        if (codeInput) codeInput.value = '';
        if (qtyInput) qtyInput.value = '1';
        this.selectedInOutProduct = null;
        this.updateInOutInfo(null);
    }

    // ローカルの在庫数を更新
    updateLocalProductStock(productId, newStock) {
        const target = this.products.find(p => p.id === productId);
        if (target) {
            target.stock_quantity = newStock;
        }
    }

    // 商品データの読み込み
    async loadInventoryData() {
        try {
            // Supabaseクライアントが利用可能かチェック
            if (!this.supabaseClient) {
                console.error('Supabaseクライアントが利用できません');
                this.showMessage('データベース接続エラー', 'error');
                return;
            }
            
            // ローディング状態を表示（loadingOverlayは使用しない）
            // this.showLoadingState();
            
            console.log('Supabaseからデータを取得中...');
            
            const { data, error } = await this.supabaseClient
                .from('products')
                .select('id, asin, jan_code, product_name, price, stock_quantity, shelf_location')
                .order('id', { ascending: false });

            if (error) {
                console.error('Supabaseエラー:', error);
                throw error;
            }

            console.log('取得したデータ:', data);
            this.products = data || [];
            
            // データが取得できた場合のメッセージ（削除）
            // if (this.products.length > 0) {
            //     this.showMessage(`${this.products.length}件の商品データを取得しました`, 'success');
            // } else {
            //     this.showMessage('商品データが見つかりませんでした', 'info');
            // }

            this.updateInventoryTable();
            this.updateInventoryStats();
            // this.hideLoadingState();
            
        } catch (error) {
            console.error('商品データの読み込みに失敗しました:', error);
            this.showMessage('商品データの読み込みに失敗しました: ' + error.message, 'error');
            // this.hideLoadingState();
            this.products = [];
            this.updateInventoryTable();
            this.updateInventoryStats();
        }
    }

    // 商品一覧テーブルの更新
    updateInventoryTable() {
        const tbody = document.getElementById('inventory-tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (this.products.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `
                <td colspan="7" class="empty-state">
                    <div class="empty-message">
                        <i class="fas fa-box-open"></i>
                        <p>商品データがありません</p>
                        <small>商品を登録するか、一括登録でデータを追加してください</small>
                    </div>
                </td>
            `;
            tbody.appendChild(emptyRow);
            return;
        }

        this.products.forEach(product => {
            const row = document.createElement('tr');
            
            // 在庫数に応じてクラスを追加（黄色表示を無効化）
            const stockClass = product.stock_quantity === 0 ? 'out-of-stock' : '';
            
            row.className = stockClass;
            
            row.innerHTML = `
                <td>
                    <div class="product-asin">
                        <span class="asin-code">${product.asin}</span>
                    </div>
                </td>
                <td>
                    <span class="jan-code">${product.jan_code}</span>
                </td>
                <td>
                    <div class="product-name">
                        <strong>${product.product_name}</strong>
                    </div>
                </td>
                <td>
                    <span class="price">¥${product.price.toLocaleString()}</span>
                </td>
                <td>
                    <span class="stock-quantity ${stockClass}">${product.stock_quantity}</span>
                </td>
                <td>
                    <span class="shelf-location">${product.shelf_location || '-'}</span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" onclick="inventoryManager.editProduct(${product.id})" title="編集">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="inventoryManager.deleteProduct(${product.id})" title="削除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // 統計情報の更新
    updateInventoryStats() {
        const totalProducts = this.products.length;
        const outOfStockCount = this.products.filter(p => p.stock_quantity === 0).length;
        const totalValue = this.products.reduce((sum, p) => sum + (p.price * p.stock_quantity), 0);

        const totalProductsElement = document.getElementById('total-products');
        const lowStockCountElement = document.getElementById('low-stock-count');
        const totalValueElement = document.getElementById('total-value');

        if (totalProductsElement) {
            totalProductsElement.textContent = totalProducts;
        }
        if (lowStockCountElement) {
            lowStockCountElement.textContent = outOfStockCount;
        }
        if (totalValueElement) {
            totalValueElement.textContent = `¥${totalValue.toLocaleString()}`;
        }
    }

    // 商品登録処理
    async handleProductRegistration(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const productData = {
            asin: formData.get('asin'),
            jan_code: formData.get('jan_code'),
            product_name: formData.get('product_name'),
            price: parseInt(formData.get('price')),
            stock_quantity: parseInt(formData.get('stock_quantity')),
            shelf_location: formData.get('shelf_location')
        };

        try {
            // バリデーション
            if (!this.validateProductData(productData)) {
                return;
            }

            // 編集モードかどうかをチェック
            if (this.currentEditId) {
                            // 編集モード：既存データを更新
            await this.updateProduct(this.currentEditId, productData);
            this.showMessage('商品が正常に更新されました', 'success');
        } else {
            // 新規登録モード
            // Supabaseクライアントが利用可能かチェック
            if (!this.supabaseClient) {
                console.error('Supabaseクライアントが利用できません');
                this.showMessage('データベース接続エラー', 'error');
                return;
            }
            
            // 必要なフィールドのみを送信
            const insertData = {
                asin: productData.asin,
                jan_code: productData.jan_code,
                product_name: productData.product_name,
                price: productData.price,
                stock_quantity: productData.stock_quantity,
                shelf_location: productData.shelf_location
            };
            
            const { data, error } = await this.supabaseClient
                .from('products')
                .insert([insertData])
                .select('id, asin, jan_code, product_name, price, stock_quantity, shelf_location');

            if (error) {
                throw error;
            }
            this.showMessage('商品が正常に登録されました', 'success');
        }

            this.clearProductForm();
            this.loadInventoryData();
            
            // 商品一覧タブに自動で戻る
            this.switchToInventoryListTab();
        } catch (error) {
            console.error('商品登録に失敗しました:', error);
            this.showMessage('商品登録に失敗しました', 'error');
        }
    }

    // 商品データのバリデーション
    validateProductData(data) {
        if (!data.asin || data.asin.trim() === '') {
            this.showMessage('ASINを入力してください', 'error');
            return false;
        }
        if (!data.jan_code || data.jan_code.trim() === '') {
            this.showMessage('JANコードを入力してください', 'error');
            return false;
        }
        if (!data.product_name || data.product_name.trim() === '') {
            this.showMessage('商品名を入力してください', 'error');
            return false;
        }
        if (!data.price || data.price <= 0) {
            this.showMessage('価格を正しく入力してください', 'error');
            return false;
        }
        if (data.stock_quantity < 0) {
            this.showMessage('在庫数は0以上で入力してください', 'error');
            return false;
        }
        return true;
    }

    // 商品フォームのクリア
    clearProductForm() {
        const form = document.getElementById('product-register-form');
        if (form) {
            form.reset();
        }

        // 編集モードをリセット
        this.currentEditId = null;

        // フォームの送信ボタンを元に戻す
        const submitButton = document.querySelector('#product-register-form button[type="submit"]');
        if (submitButton) {
            submitButton.innerHTML = '<i class="fas fa-plus"></i> 登録';
            submitButton.classList.remove('btn-success');
            submitButton.classList.add('btn-primary');
        }

        // フォームタイトルを元に戻す
        const formTitle = document.querySelector('#product-register-form h3');
        if (formTitle) {
            formTitle.innerHTML = '<i class="fas fa-plus"></i> 商品登録';
        }
    }

    // 商品編集
    editProduct(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        // 編集モードを有効化
        this.currentEditId = productId;
        
        // フォームに値を設定
        document.getElementById('asin').value = product.asin;
        document.getElementById('jan_code').value = product.jan_code;
        document.getElementById('product_name').value = product.product_name;
        document.getElementById('price').value = product.price;
        document.getElementById('stock_quantity').value = product.stock_quantity;
        document.getElementById('shelf_location').value = product.shelf_location || '';

        // フォームの送信ボタンを更新
        const submitButton = document.querySelector('#product-register-form button[type="submit"]');
        if (submitButton) {
            submitButton.innerHTML = '<i class="fas fa-save"></i> 更新';
            submitButton.classList.remove('btn-primary');
            submitButton.classList.add('btn-success');
        }

        // フォームタイトルを更新
        const formTitle = document.querySelector('#product-register-form h3');
        if (formTitle) {
            formTitle.innerHTML = '<i class="fas fa-edit"></i> 商品編集';
        }

        // 登録タブに切り替え
        this.switchInventoryTab('register');
    }

    // 商品更新
    async updateProduct(productId, productData) {
        try {
            // Supabaseクライアントが利用可能かチェック
            if (!this.supabaseClient) {
                console.error('Supabaseクライアントが利用できません');
                throw new Error('データベース接続エラー');
            }
            
            // 必要なフィールドのみを送信
            const updateData = {
                asin: productData.asin,
                jan_code: productData.jan_code,
                product_name: productData.product_name,
                price: productData.price,
                stock_quantity: productData.stock_quantity,
                shelf_location: productData.shelf_location
            };
            
            const { data, error } = await this.supabaseClient
                .from('products')
                .update(updateData)
                .eq('id', productId)
                .select('id, asin, jan_code, product_name, price, stock_quantity, shelf_location');

            if (error) {
                throw error;
            }
        } catch (error) {
            console.error('商品更新に失敗しました:', error);
            throw error;
        }
    }

    // 商品削除
    async deleteProduct(productId) {
        const ok = await (window.confirmAsync ? window.confirmAsync('この商品を削除しますか？') : Promise.resolve(confirm('この商品を削除しますか？')));
        if (!ok) {
            return;
        }

        try {
            // Supabaseクライアントが利用可能かチェック
            if (!this.supabaseClient) {
                console.error('Supabaseクライアントが利用できません');
                this.showMessage('データベース接続エラー', 'error');
                return;
            }
            
            const { error } = await this.supabaseClient
                .from('products')
                .delete()
                .eq('id', productId);

            if (error) {
                throw error;
            }

            this.showMessage('商品が削除されました', 'success');
            this.loadInventoryData();
        } catch (error) {
            console.error('商品削除に失敗しました:', error);
            this.showMessage('商品削除に失敗しました', 'error');
        }
    }

    // 商品一覧タブに切り替え
    switchToInventoryListTab() {
        // 現在のタブを商品一覧に変更
        this.currentTab = 'list';
        
        // タブボタンのアクティブ状態を更新
        const tabs = document.querySelectorAll('.inventory-tab');
        tabs.forEach(tab => tab.classList.remove('active'));
        
        // 商品一覧タブをアクティブにする
        const listTab = document.querySelector('.inventory-tab[onclick*="list"]');
        if (listTab) {
            listTab.classList.add('active');
        }

        // コンテンツの表示/非表示を切り替え
        const contents = document.querySelectorAll('.inventory-content');
        contents.forEach(content => content.classList.remove('active'));
        
        const listContent = document.getElementById('inventory-list');
        if (listContent) {
            listContent.classList.add('active');
        }

        // 商品データを再読み込み
        this.loadInventoryData();
    }

    // ファイルアップロード処理
    handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!this.isValidExcelFile(file)) {
            this.showMessage('有効なExcelファイルを選択してください', 'error');
            return;
        }

        this.readExcelFile(file);
    }

    // Excelファイルの検証
    isValidExcelFile(file) {
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];
        return validTypes.includes(file.type) || 
               file.name.endsWith('.xlsx') || 
               file.name.endsWith('.xls');
    }

    // Excelファイルの読み込み
    readExcelFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                // 数式を値に変換するオプションを追加
                const workbook = XLSX.read(data, { 
                    type: 'array', 
                    cellStyles: true,
                    cellFormula: false,  // 数式を無効化
                    cellNF: false,       // 数値フォーマットを無効化
                    cellHTML: false      // HTMLを無効化
                });
                this.processExcelWorkbook(workbook);
            } catch (error) {
                console.error('Excelファイルの読み込みに失敗しました:', error);
                this.showMessage('Excelファイルの読み込みに失敗しました', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // Excelワークブックの処理
    processExcelWorkbook(workbook) {
        // ワークブックオブジェクトを保持
        this.currentWorkbook = workbook;
        
        const sheetNames = workbook.SheetNames;
        const sheetSelect = document.getElementById('inventorySheetSelect');
        const preview = document.getElementById('inventoryExcelPreview');

        // シート選択ドロップダウンを更新
        sheetSelect.innerHTML = '<option value="">シートを選択してください</option>';
        sheetNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            sheetSelect.appendChild(option);
        });

        // プレビューを表示
        preview.style.display = 'block';
        
        // 最初のシートを表示
        if (sheetNames.length > 0) {
            this.displaySheetPreview(workbook.Sheets[sheetNames[0]], sheetNames[0]);
        }
    }

    // シートプレビューの表示
    displaySheetPreview(sheet, sheetName) {
        // 数式を値に変換するオプションを追加
        const jsonData = XLSX.utils.sheet_to_json(sheet, { 
            header: 1,
            defval: '',  // 空のセルのデフォルト値
            raw: false   // 生の値ではなく処理された値を使用
        });
        const container = document.getElementById('inventoryTableContainer');
        
        if (jsonData.length === 0) {
            container.innerHTML = '<p>データが見つかりません</p>';
            return;
        }

        // 自動マッピング設定を取得
        const autoMapping = {
            asin: { label: 'ASIN', column: 'C', default: 'NONE' },
            jan_code: { label: 'JANコード', column: 'Q', default: 'NONE' },
            product_name: { label: '商品名', column: 'E', default: 'NONE' },
            price: { label: '価格', column: 'N', default: 'NONE', process: 'removeYen' },
            stock_quantity: { label: '在庫数', column: null, default: 0 },
            shelf_location: { label: '棚位置', column: null, default: 'NONE' }
        };

        // マッピング設定を保存
        this.autoMappingConfig = autoMapping;

        // マッピングに基づいてデータを処理
        const processedData = this.processExcelData(jsonData, this.getAutoMapping());

        // マッピング済みデータのプレビューテーブルを作成
        let tableHTML = '<table class="excel-preview-table">';
        
        // ヘッダー行（マッピングされた項目名）
        tableHTML += '<thead><tr>';
        tableHTML += '<th>ASIN</th>';
        tableHTML += '<th>JANコード</th>';
        tableHTML += '<th>商品名</th>';
        tableHTML += '<th>価格</th>';
        tableHTML += '<th>在庫数</th>';
        tableHTML += '<th>棚位置</th>';
        tableHTML += '</tr></thead>';

        // データ行（最初の10行まで）
        tableHTML += '<tbody>';
        processedData.slice(0, 10).forEach(item => {
            tableHTML += '<tr>';
            tableHTML += `<td>${item.asin}</td>`;
            tableHTML += `<td>${item.jan_code}</td>`;
            tableHTML += `<td>${item.product_name}</td>`;
            tableHTML += `<td>¥${item.price.toLocaleString()}</td>`;
            tableHTML += `<td>${item.stock_quantity}</td>`;
            tableHTML += `<td>${item.shelf_location}</td>`;
            tableHTML += '</tr>';
        });
        tableHTML += '</tbody></table>';

        container.innerHTML = tableHTML;

        // 列マッピングを表示
        this.showColumnMapping(jsonData[0]);
    }

    // 列マッピングの表示（非表示化）
    showColumnMapping(headers) {
        // マッピング画面を非表示にして、直接データベースに保存
        this.saveInventoryToDatabase();
    }

    // 列名をインデックスに変換（A=0, B=1, C=2, ...）
    getColumnIndex(columnName) {
        console.log('getColumnIndex called with columnName:', columnName);
        let index = 0;
        for (let i = 0; i < columnName.length; i++) {
            index = index * 26 + (columnName.charCodeAt(i) - 64);
        }
        const result = index - 1; // 0ベースのインデックスに変換
        console.log(`Column ${columnName} -> index ${result}`);
        return result;
    }

    // 手動マッピング表示（非表示化）
    showManualMapping() {
        // 手動マッピングも非表示にして、直接データベースに保存
        this.saveInventoryToDatabase();
    }

    // 現在のシートのヘッダーを取得
    getCurrentSheetHeaders() {
        const sheetSelect = document.getElementById('inventorySheetSelect');
        const selectedSheet = sheetSelect.value;
        
        if (!selectedSheet || !this.currentWorkbook) return [];
        
        const sheetData = this.currentWorkbook.Sheets[selectedSheet];
        const jsonData = XLSX.utils.sheet_to_json(sheetData, { 
            header: 1,
            defval: '',
            raw: false
        });
        
        return jsonData.length > 0 ? jsonData[0] : [];
    }

    // シート変更時の処理
    changeInventorySheet() {
        const sheetSelect = document.getElementById('inventorySheetSelect');
        const selectedSheet = sheetSelect.value;
        
        if (!selectedSheet || !this.currentWorkbook) return;

        // ワークブックから選択されたシートを取得して表示
        const selectedSheetData = this.currentWorkbook.Sheets[selectedSheet];
        this.displaySheetPreview(selectedSheetData, selectedSheet);
        this.showMessage('シートが変更されました', 'info');
    }

    // データベースへの保存
    async saveInventoryToDatabase() {
        // Supabaseクライアントが利用可能かチェック
        if (!this.supabaseClient) {
            console.error('Supabaseクライアントが利用できません');
            this.showMessage('データベース接続エラー', 'error');
            return;
        }
        
        const mapping = this.getColumnMapping();
        if (!this.validateColumnMapping(mapping)) {
            this.showMessage('必須項目のマッピングを完了してください', 'error');
            return;
        }

        if (!this.currentWorkbook) {
            this.showMessage('Excelデータが見つかりません', 'error');
            return;
        }

        try {
            // 現在選択されているシートを取得
            const sheetSelect = document.getElementById('inventorySheetSelect');
            const selectedSheet = sheetSelect.value;
            
            if (!selectedSheet) {
                this.showMessage('シートを選択してください', 'error');
                return;
            }

            const sheetData = this.currentWorkbook.Sheets[selectedSheet];
            const jsonData = XLSX.utils.sheet_to_json(sheetData, { 
                header: 1,
                defval: '',
                raw: false
            });
            
            // マッピングに基づいてデータを変換
            const processedData = this.processExcelData(jsonData, mapping);
            
            // 解析結果を表示
            this.showAnalysisResults(processedData, jsonData);
            
            // プログレスバーを表示
            this.showProgressBar(processedData.length);
            
            let successCount = 0;
            let skipCount = 0;
            const skippedItems = [];
            
            for (let i = 0; i < processedData.length; i++) {
                const item = processedData[i];
                
                try {
                    // 必要なフィールドのみを送信
                    const insertData = {
                        asin: item.asin,
                        jan_code: item.jan_code,
                        product_name: item.product_name,
                        price: item.price,
                        stock_quantity: item.stock_quantity,
                        shelf_location: item.shelf_location
                    };
                    
                    const { data, error } = await this.supabaseClient
                        .from('products')
                        .insert([insertData])
                        .select('id, asin, jan_code, product_name, price, stock_quantity, shelf_location');

                    if (error) {
                        throw error;
                    }

                    successCount++;
                    console.log(`データ保存成功:`, item);
                    
                } catch (error) {
                    console.warn(`データ書き込みエラー（スキップ）:`, item, error.message);
                    skipCount++;
                    skippedItems.push({
                        item: item,
                        error: error.message,
                        row: i + 1
                    });
                }
                
                // プログレスバーを更新
                this.updateProgressBar(i + 1, processedData.length);
                
                // 処理の遅延を追加
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            // プログレスバーを完了状態にする
            this.completeProgressBar();
            
            // 結果メッセージを表示
            let resultMessage = `${successCount}件の商品データが正常に保存されました`;
            if (skipCount > 0) {
                resultMessage += `（${skipCount}件スキップ）`;
            }
            this.showMessage(resultMessage, 'success');
            
            // スキップされたデータの詳細を表示
            if (skipCount > 0) {
                this.showSkippedItemsDetails(skippedItems);
            }
            
            this.resetBulkUpload();
            this.loadInventoryData();
            
            // 商品一覧タブに自動で戻る
            this.switchToInventoryListTab();
            
            // 保存されたデータを確認
            console.log('保存完了後の商品一覧:', this.products);
        } catch (error) {
            console.error('データベースへの保存に失敗しました:', error);
            this.showMessage('データベースへの保存に失敗しました', 'error');
            this.hideProgressBar();
        }
    }

    // 解析結果を表示
    showAnalysisResults(processedData, originalData) {
        const analysisContainer = document.getElementById('inventoryAnalysisResults');
        if (!analysisContainer) {
            // 解析結果表示用のコンテナを作成
            const columnMapping = document.getElementById('inventoryColumnMapping');
            const analysisDiv = document.createElement('div');
            analysisDiv.id = 'inventoryAnalysisResults';
            analysisDiv.className = 'analysis-results';
            columnMapping.appendChild(analysisDiv);
        }

        const totalRows = originalData.length - 1; // ヘッダー行を除く
        const validRows = processedData.length;
        const invalidRows = totalRows - validRows;
        
        // 重複削除の統計を計算
        const seenAsins = new Set();
        const duplicates = [];
        let duplicateCount = 0;
        
        // 元データから重複をチェック
        for (let i = 1; i < originalData.length; i++) {
            const row = originalData[i];
            if (row && row.length > 0) {
                const asinIndex = 2; // C列（ASIN）
                const asin = row[asinIndex];
                if (asin && asin !== 'NONE' && asin !== '') {
                    if (seenAsins.has(asin)) {
                        duplicateCount++;
                        duplicates.push({ row: i, asin: asin });
                    } else {
                        seenAsins.add(asin);
                    }
                }
            }
        }

        let analysisHTML = `
            <div class="analysis-summary">
                <h4><i class="fas fa-chart-bar"></i> 解析結果</h4>
                <div class="analysis-stats">
                    <div class="stat-item">
                        <span class="stat-label">総行数:</span>
                        <span class="stat-value">${totalRows}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">有効データ:</span>
                        <span class="stat-value success">${validRows}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">無効データ:</span>
                        <span class="stat-value error">${invalidRows}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">重複削除:</span>
                        <span class="stat-value warning">${duplicateCount}</span>
                    </div>
                </div>
            </div>
        `;

        if (processedData.length > 0) {
            analysisHTML += `
                <div class="processed-data-preview">
                    <h5>処理済みデータ（最初の5件）</h5>
                    <table class="preview-table">
                        <thead>
                            <tr>
                                <th>ASIN</th>
                                <th>JANコード</th>
                                <th>商品名</th>
                                <th>価格</th>
                                <th>在庫数</th>
                                <th>棚位置</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            processedData.slice(0, 5).forEach(item => {
                analysisHTML += `
                    <tr>
                        <td>${item.asin}</td>
                        <td>${item.jan_code}</td>
                        <td>${item.product_name}</td>
                        <td>¥${item.price.toLocaleString()}</td>
                        <td>${item.stock_quantity}</td>
                        <td>${item.shelf_location || '-'}</td>
                    </tr>
                `;
            });

            analysisHTML += `
                        </tbody>
                    </table>
                </div>
            `;
        }

        if (invalidRows > 0) {
            analysisHTML += `
                <div class="invalid-data-info">
                    <h5><i class="fas fa-exclamation-triangle"></i> 無効データについて</h5>
                    <p>以下の理由で${invalidRows}件のデータが除外されました：</p>
                    <ul>
                        <li>必須項目（ASIN、JANコード、商品名）が空または「NONE」</li>
                        <li>データ形式が不正</li>
                    </ul>
                </div>
            `;
        }
        
        if (duplicateCount > 0) {
            analysisHTML += `
                <div class="duplicate-data-info">
                    <h5><i class="fas fa-exclamation-circle"></i> 重複データについて</h5>
                    <p>以下の理由で${duplicateCount}件のデータが除外されました：</p>
                    <ul>
                        <li>ASINが重複している行（最初に出現した行を保持）</li>
                    </ul>
                    ${duplicates.length > 0 ? `
                        <details>
                            <summary>重複したASINの詳細（最初の10件）</summary>
                            <ul>
                                ${duplicates.slice(0, 10).map(dup => 
                                    `<li>行${dup.row}: ASIN "${dup.asin}"</li>`
                                ).join('')}
                                ${duplicates.length > 10 ? `<li>... 他${duplicates.length - 10}件</li>` : ''}
                            </ul>
                        </details>
                    ` : ''}
                </div>
            `;
        }

        document.getElementById('inventoryAnalysisResults').innerHTML = analysisHTML;
    }

    // 列マッピングの取得（自動マッピング対応）
    getColumnMapping() {
        // 自動マッピング設定が存在する場合は自動マッピングを使用
        if (this.autoMappingConfig) {
            return this.getAutoMapping();
        }
        
        // 手動マッピングの場合
        const mapping = {};
        const fields = ['asin', 'jan_code', 'product_name', 'price', 'stock_quantity', 'shelf_location'];
        
        fields.forEach(field => {
            const select = document.getElementById(`mapping-${field}`);
            if (select) {
                mapping[field] = select.value;
            }
        });

        return mapping;
    }

    // 自動マッピングの取得
    getAutoMapping() {
        console.log('getAutoMapping called, autoMappingConfig:', this.autoMappingConfig);
        const mapping = {};
        Object.keys(this.autoMappingConfig).forEach(field => {
            const config = this.autoMappingConfig[field];
            if (config.column) {
                const columnIndex = this.getColumnIndex(config.column);
                mapping[field] = columnIndex;
                console.log(`Field ${field}: column ${config.column} -> index ${columnIndex}`);
            } else {
                mapping[field] = -1; // デフォルト値を使用
                console.log(`Field ${field}: using default value (index -1)`);
            }
        });
        console.log('Final mapping:', mapping);
        return mapping;
    }

    // 列マッピングの検証
    validateColumnMapping(mapping) {
        // 自動マッピングの場合は常に有効
        if (this.autoMappingConfig) {
            return true;
        }
        
        // 手動マッピングの場合
        const requiredFields = ['asin', 'jan_code', 'product_name', 'price', 'stock_quantity'];
        return requiredFields.every(field => mapping[field] !== '');
    }

    // Excelデータを処理する関数（自動マッピング対応）
    processExcelData(jsonData, mapping) {
        console.log('processExcelData called with jsonData length:', jsonData.length, 'mapping:', mapping);
        const processedData = [];
        const seenAsins = new Set(); // 重複チェック用のSet
        let duplicateCount = 0; // 重複行のカウント
        
        // ヘッダー行をスキップしてデータ行を処理
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            console.log(`Processing row ${i}:`, row);
            
            // 空の行をスキップ
            if (!row || row.length === 0) {
                console.log(`Row ${i} is empty, skipping`);
                continue;
            }
            
            // すべてのセルが空の行をスキップ
            const isEmptyRow = row.every(cell => cell === null || cell === undefined || cell === '');
            if (isEmptyRow) {
                console.log(`Row ${i} is empty (all cells are empty), skipping`);
                continue;
            }
            
            const productData = this.processRowData(row, mapping);
            if (productData) {
                // ASINの重複チェック
                if (seenAsins.has(productData.asin)) {
                    console.log(`Row ${i} has duplicate ASIN: ${productData.asin}, skipping`);
                    duplicateCount++;
                    continue;
                }
                
                // 初回出現のASINを記録
                seenAsins.add(productData.asin);
                console.log(`Row ${i} processed successfully:`, productData);
                processedData.push(productData);
            } else {
                console.log(`Row ${i} was invalid and skipped`);
            }
        }
        
        console.log('Total processed data:', processedData.length);
        console.log('Duplicate ASINs removed:', duplicateCount);
        return processedData;
    }

    // 行データを処理
    processRowData(row, mapping) {
        console.log('processRowData called with row:', row, 'mapping:', mapping);
        
        // 行が空の場合はnullを返す
        if (!row || row.length === 0) {
            console.log('Row is empty, returning null');
            return null;
        }
        
        const productData = {};
        
        Object.keys(mapping).forEach(field => {
            const colIndex = mapping[field];
            const config = this.autoMappingConfig ? this.autoMappingConfig[field] : null;
            
            console.log(`Processing field: ${field}, colIndex: ${colIndex}, config:`, config);
            
            if (colIndex >= 0 && colIndex < row.length) {
                let value = row[colIndex];
                console.log(`Raw value for ${field}:`, value, 'type:', typeof value);
                
                // データ処理
                if (config && config.process === 'removeYen') {
                    console.log(`Processing ${field} with removeYen`);
                    value = this.removeYenSymbol(value);
                    console.log(`After removeYen for ${field}:`, value);
                }
                
                productData[field] = value || config?.default || '';
                console.log(`Final value for ${field}:`, productData[field]);
            } else {
                // デフォルト値を使用
                productData[field] = config?.default || '';
                console.log(`Using default for ${field}:`, productData[field]);
            }
        });
        
        console.log('Product data before type conversion:', productData);
        
        // データ型の変換
        productData.price = this.parsePrice(productData.price);
        productData.stock_quantity = parseInt(productData.stock_quantity) || 0;
        
        console.log('Product data after type conversion:', productData);
        
        // 必須項目のチェック
        const requiredFields = ['asin', 'jan_code', 'product_name'];
        const hasRequiredData = requiredFields.every(field => 
            productData[field] && productData[field] !== 'NONE' && productData[field] !== ''
        );
        
        console.log('Has required data:', hasRequiredData);
        
        return hasRequiredData ? productData : null;
    }

    // 円マークを削除
    removeYenSymbol(value) {
        console.log('removeYenSymbol called with value:', value, 'type:', typeof value);
        
        if (typeof value === 'string') {
            // バックスラッシュも削除（\\525のような形式に対応）
            console.log('Original string:', value);
            const result = value.replace(/[¥,\\]/g, '').trim();
            console.log('After regex replacement:', result);
            console.log('Final result:', result);
            return result;
        }
        
        console.log('removeYenSymbol returning original value:', value);
        return value;
    }

    // 価格を解析して整数に変換
    parsePrice(value) {
        console.log('parsePrice called with value:', value, 'type:', typeof value);
        
        if (value === null || value === undefined || value === '') {
            console.log('Value is null/undefined/empty, returning 0');
            return 0;
        }
        
        // 数値の場合はそのまま使用
        if (typeof value === 'number') {
            console.log('Value is number, using Math.floor:', Math.floor(value));
            return Math.floor(value);
        }
        
        // 文字列の場合は円マークとカンマを削除してから数値に変換
        if (typeof value === 'string') {
            console.log('Value is string, cleaning...');
            // バックスラッシュも削除（\\525のような形式に対応）
            const cleanedValue = value.replace(/[¥,\\]/g, '').trim();
            console.log('Cleaned value:', cleanedValue);
            const numValue = parseFloat(cleanedValue);
            console.log('Parsed number:', numValue, 'isNaN:', isNaN(numValue));
            return isNaN(numValue) ? 0 : Math.floor(numValue);
        }
        
        console.log('Unknown type, returning 0');
        return 0;
    }

    // 一括アップロードのリセット
    resetBulkUpload() {
        const fileInput = document.getElementById('inventoryFileInput');
        const preview = document.getElementById('inventoryExcelPreview');
        const columnMapping = document.getElementById('inventoryColumnMapping');
        const successMessage = document.getElementById('inventorySuccessMessage');
        const errorMessage = document.getElementById('inventoryErrorMessage');

        if (fileInput) fileInput.value = '';
        if (preview) preview.style.display = 'none';
        if (columnMapping) columnMapping.style.display = 'none';
        if (successMessage) successMessage.style.display = 'none';
        if (errorMessage) errorMessage.style.display = 'none';
    }

    // 在庫データのエクスポート
    exportInventoryData() {
        const csvContent = this.convertToCSV(this.products);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `inventory_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }

    // CSV変換
    convertToCSV(data) {
        const headers = ['ASIN', 'JANコード', '商品名', '価格', '在庫数', '棚位置'];
        const csvRows = [headers.join(',')];
        
        data.forEach(item => {
            const row = [
                item.asin,
                item.jan_code,
                `"${item.product_name}"`,
                item.price,
                item.stock_quantity,
                item.shelf_location || ''
            ];
            csvRows.push(row.join(','));
        });
        
        return csvRows.join('\n');
    }

    // 在庫データの更新
    refreshInventoryData() {
        this.loadInventoryData();
        this.showMessage('データを更新しました', 'success');
    }

    // テーブルの検索フィルター
    filterInventoryTable() {
        const searchTerm = document.getElementById('inventory-search').value.toLowerCase();
        const rows = document.querySelectorAll('#inventory-tbody tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }

    // テーブルのソート
    sortInventoryTable() {
        const sortBy = document.getElementById('inventory-sort').value;
        
        this.products.sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return a.product_name.localeCompare(b.product_name);
                case 'asin':
                    return a.asin.localeCompare(b.asin);
                case 'stock':
                    return b.stock_quantity - a.stock_quantity;
                case 'price':
                    return b.price - a.price;
                default:
                    return 0;
            }
        });
        
        this.updateInventoryTable();
    }

    // メッセージ表示
    showMessage(message, type = 'info') {
        // 既存の通知を削除
        const existingNotification = document.querySelector('.inventory-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // 通知要素を作成
        const notification = document.createElement('div');
        notification.className = `inventory-notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
                <button class="notification-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // スタイルを追加（横から飛び出すタイプ）
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: -420px;
            background: ${this.getNotificationColor(type)};
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            z-index: 1001;
            max-width: 400px;
            transform: translateX(0);
            transition: transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            will-change: transform;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        `;
        
        // 通知を表示
        document.body.appendChild(notification);
        
        // アニメーション開始（少し遅延を入れてスムーズに表示）
        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(-440px)';
        });
        
        // 閉じるボタンのイベント
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.style.transform = 'translateX(0)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 500);
        });
        
        // 自動で閉じる
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.transform = 'translateX(0)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 500);
            }
        }, 5000);
    }

    // 通知アイコンの取得
    getNotificationIcon(type) {
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
    getNotificationColor(type) {
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

    // プログレスバーの表示
    showProgressBar(totalItems) {
        const container = document.getElementById('inventoryTableContainer');
        const progressHTML = `
            <div id="inventoryProgressBar" class="progress-container">
                <div class="progress-header">
                    <h4><i class="fas fa-database"></i> データベースに書き込み中...</h4>
                    <div class="progress-info">
                        <span id="progressText">0 / ${totalItems} 件処理中</span>
                        <span id="progressPercentage">0%</span>
                    </div>
                </div>
                <div class="progress-bar">
                    <div id="progressFill" class="progress-fill"></div>
                </div>
                <div class="progress-status">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span id="progressStatus">データを処理中...</span>
                </div>
            </div>
        `;
        
        // 既存のコンテンツを非表示にしてプログレスバーを表示
        const existingContent = container.querySelector('.excel-preview-table, .analysis-results');
        if (existingContent) {
            existingContent.style.display = 'none';
        }
        
        container.innerHTML = progressHTML;
    }

    // プログレスバーの更新
    updateProgressBar(current, total) {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const progressPercentage = document.getElementById('progressPercentage');
        const progressStatus = document.getElementById('progressStatus');
        
        if (progressFill && progressText && progressPercentage && progressStatus) {
            const percentage = Math.round((current / total) * 100);
            
            progressFill.style.width = `${percentage}%`;
            progressText.textContent = `${current} / ${total} 件処理中`;
            progressPercentage.textContent = `${percentage}%`;
            
            if (percentage < 50) {
                progressStatus.textContent = 'データを検証中...';
            } else if (percentage < 80) {
                progressStatus.textContent = 'データベースに書き込み中...';
            } else {
                progressStatus.textContent = '完了処理中...';
            }
        }
    }

    // プログレスバーの完了
    completeProgressBar() {
        const progressFill = document.getElementById('progressFill');
        const progressStatus = document.getElementById('progressStatus');
        const progressIcon = document.querySelector('#inventoryProgressBar .progress-status i');
        
        if (progressFill && progressStatus && progressIcon) {
            progressFill.style.width = '100%';
            progressFill.classList.add('completed');
            progressStatus.textContent = '完了しました！';
            progressIcon.className = 'fas fa-check';
            progressIcon.style.color = '#28a745';
        }
    }

    // プログレスバーの非表示
    hideProgressBar() {
        const progressBar = document.getElementById('inventoryProgressBar');
        if (progressBar) {
            progressBar.remove();
        }
    }

    // スキップされたデータの詳細を表示
    showSkippedItemsDetails(skippedItems) {
        const container = document.getElementById('inventoryTableContainer');
        const skippedDetailsHTML = `
            <div class="skipped-items-details">
                <h4><i class="fas fa-exclamation-triangle"></i> スキップされたデータ</h4>
                <p>以下の${skippedItems.length}件のデータは書き込みエラーのためスキップされました：</p>
                <div class="skipped-items-list">
                    ${skippedItems.slice(0, 10).map(skipped => `
                        <div class="skipped-item">
                            <div class="skipped-item-header">
                                <span class="skipped-row">行${skipped.row}</span>
                                <span class="skipped-error">${skipped.error}</span>
                            </div>
                            <div class="skipped-item-data">
                                <strong>ASIN:</strong> ${skipped.item.asin} | 
                                <strong>商品名:</strong> ${skipped.item.product_name} | 
                                <strong>価格:</strong> ¥${skipped.item.price.toLocaleString()}
                            </div>
                        </div>
                    `).join('')}
                    ${skippedItems.length > 10 ? `<div class="skipped-more">... 他${skippedItems.length - 10}件</div>` : ''}
                </div>
                <div class="skipped-actions">
                    <button class="btn btn-secondary btn-sm" onclick="inventoryManager.retrySkippedItems()">
                        <i class="fas fa-redo"></i> スキップされたデータを再試行
                    </button>
                </div>
            </div>
        `;
        
        // 既存のコンテンツの後に追加
        container.insertAdjacentHTML('beforeend', skippedDetailsHTML);
    }

    // スキップされたデータの再試行
    async retrySkippedItems() {
        // この機能は実際の実装で追加
        this.showMessage('再試行機能は実装予定です', 'info');
    }

    // すべてのローディング要素を非表示にする関数
    hideAllLoadingElements() {
        // 静的ローディング要素
        const loadingElements = [
            'shift-loading',
            'view-loading', 
            'inventoryLoading',
            'submit-loading',
            'loadingOverlay'
        ];
        
        loadingElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = 'none';
            }
        });
        
        // 動的に作成されたローディング要素を削除
        const dynamicLoadings = document.querySelectorAll('.loading');
        dynamicLoadings.forEach(loading => {
            if (loading.id === 'submit-loading' || loading.classList.contains('loading')) {
                loading.style.display = 'none';
            }
        });
        
        // プログレスバーも非表示
        const progressBar = document.getElementById('inventoryProgressBar');
        if (progressBar) {
            progressBar.remove();
        }
    }

    // ローディング状態を表示
    showLoadingState() {
        // すべてのローディング要素を非表示にする
        this.hideAllLoadingElements();
    }

    // ローディング状態を非表示
    hideLoadingState() {
        // すべてのローディング要素を非表示にする
        this.hideAllLoadingElements();
    }
}

// グローバル関数（HTMLから呼び出し用）
let inventoryManager;

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
    // Supabaseライブラリが読み込まれるまで少し待つ
    setTimeout(() => {
        try {
            inventoryManager = new InventoryManager();
        } catch (error) {
            console.error('InventoryManagerの初期化に失敗しました:', error);
        }
    }, 100);
});

// グローバル関数の定義
function switchInventoryTab(tabName) {
    if (inventoryManager) {
        inventoryManager.switchInventoryTab(tabName);
    }
}

function clearProductForm() {
    if (inventoryManager) {
        inventoryManager.clearProductForm();
    }
}

function changeInventorySheet() {
    if (inventoryManager) {
        inventoryManager.changeInventorySheet();
    }
}

function saveInventoryToDatabase() {
    if (inventoryManager) {
        inventoryManager.saveInventoryToDatabase();
    }
}

function exportInventoryData() {
    if (inventoryManager) {
        inventoryManager.exportInventoryData();
    }
}

function refreshInventoryData() {
    if (inventoryManager) {
        inventoryManager.refreshInventoryData();
    }
}

function filterInventoryTable() {
    if (inventoryManager) {
        inventoryManager.filterInventoryTable();
    }
}

function sortInventoryTable() {
    if (inventoryManager) {
        inventoryManager.sortInventoryTable();
    }
}

function showManualMapping() {
    if (inventoryManager) {
        inventoryManager.showManualMapping();
    }
}

// 通知用のCSSスタイルを動的に追加
const inventoryNotificationStyle = document.createElement('style');
inventoryNotificationStyle.textContent = `
    .inventory-notification {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .inventory-notification .notification-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .inventory-notification .notification-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        margin-left: auto;
        padding: 0;
        font-size: 1rem;
        opacity: 0.8;
        transition: opacity 0.2s ease;
    }
    
    .inventory-notification .notification-close:hover {
        opacity: 1;
    }
    
    /* 通知のホバー効果 */
    .inventory-notification:hover {
        transform: translateX(-440px) scale(1.02);
        transition: transform 0.3s ease;
    }
    
    /* 通知のレスポンシブ対応 */
    @media (max-width: 768px) {
        .inventory-notification {
            max-width: calc(100vw - 40px) !important;
            right: -100vw !important;
        }
        
        .inventory-notification:hover {
            transform: translateX(-100vw) scale(1.02);
        }
    }
`;
document.head.appendChild(inventoryNotificationStyle);
