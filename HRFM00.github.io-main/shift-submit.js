// シフト提出機能のJavaScriptファイル

// supabase-config.jsからSupabaseクライアントを取得
let shiftSubmitSupabase = null;

// Supabaseクライアントの確認関数
function checkSupabaseClient() {
    if (typeof getSupabaseClient === 'function') {
        shiftSubmitSupabase = getSupabaseClient();
        if (shiftSubmitSupabase) {
            console.log('Supabaseクライアントが利用可能です');
            return true;
        } else {
            console.error('Supabaseクライアントが利用できません');
            return false;
        }
    } else {
        console.error('getSupabaseClient関数が見つかりません。supabase-config.jsが正しく読み込まれているか確認してください。');
        return false;
    }
}

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('シフト提出機能初期化開始');
    
    // Supabaseクライアントの確認
    if (!checkSupabaseClient()) {
        console.error('Supabaseクライアントが利用できません');
        showNotification('データベース接続が確立されていません。', 'error');
        return;
    }
    
    // すべてのローディング要素を非表示にする
    hideAllLoadingElements();
    initializeShiftSubmit();
    console.log('シフト提出機能初期化完了');
});

// シフト提出機能の初期化
function initializeShiftSubmit() {
    // script.jsで既にcurrentUserが設定されているため、ここでは何もしない
    console.log('シフト提出機能の初期化完了');
}

    // シフト提出タブが表示された時の初期化
    function initializeShiftSubmitTab() {
        console.log('[DEBUG] initializeShiftSubmitTab() called');
        
        // すべてのローディング要素を非表示にする
        hideAllLoadingElements();
        
        // 名前フィールドに自動入力（ログインユーザー情報から）
        const nameInput = document.getElementById('submit-name');
        if (nameInput) {
            // 読み取り専用を強制
            nameInput.readOnly = true;
            nameInput.setAttribute('aria-readonly', 'true');
            // 候補: script.js 等で設定される window.currentUser
            const user = (typeof window !== 'undefined' && window.currentUser) ? window.currentUser : null;
            const displayName = user?.full_name || user?.username || user?.name || '';
            if (displayName) {
                nameInput.value = displayName;
                console.log('名前フィールド設定:', displayName);
            } else {
                console.log('ログインユーザー名が取得できませんでした');
            }
        }

        // 年の選択肢を設定（現在の年から前後2年）
        setupYearOptions();
        
        // 月選択時のイベントリスナーを追加
        setupMonthChangeListener();
        
        // 自分のシフト詳細セクションの初期化
        setupMyShiftDetails();
        
        // 提出状況を確認
        checkSubmitStatus();
        
        console.log('シフト提出タブ初期化完了');
    }

// 提出シフト確認タブが表示された時の初期化
function initializeSubmittedShiftTab() {
    console.log('[DEBUG] initializeSubmittedShiftTab() called');
    
    // Supabaseクライアントの確認
    if (!checkSupabaseClient()) {
        console.error('Supabaseクライアントが利用できません');
        showNotification('データベース接続が確立されていません。', 'error');
        return;
    }
    
    // XLSXライブラリの確認
    if (typeof XLSX === 'undefined') {
        console.warn('XLSXライブラリが読み込まれていません。エクスポート機能が利用できません。');
    } else {
        console.log('XLSXライブラリが利用可能です');
    }
    
    // すべてのローディング要素を非表示にする
    hideAllLoadingElements();
    
    // DOM要素が確実に存在するまで待機
    const checkElements = () => {
        const nameSelect = document.getElementById('submitted-name');
        const yearSelect = document.getElementById('submitted-year');
        const monthSelect = document.getElementById('submitted-month');
        
        if (nameSelect && yearSelect && monthSelect) {
            console.log('[DEBUG] All elements found, initializing...');
            
            // 名前選択肢を設定
            setupSubmittedNameOptions();
            
            // 年の選択肢を設定
            setupSubmittedYearOptions();
            
            // 月の選択肢を設定
            setupSubmittedMonthOptions();
            
            // フィルター変更時のイベントリスナーを追加
            setupFilterEventListeners();
            
            // 初期データを読み込み
            loadSubmittedShiftData();
            
            console.log('提出シフト確認タブ初期化完了');
        } else {
            console.log('[DEBUG] Elements not found, retrying...');
            setTimeout(checkElements, 100);
        }
    };
    
    // 要素の存在確認を開始
    checkElements();
}

// 月選択時のイベントリスナーを設定する関数
function setupMonthChangeListener() {
    const monthSelect = document.getElementById('submit-month');
    if (monthSelect) {
        monthSelect.addEventListener('change', function() {
            const month = this.value;
            const year = document.getElementById('submit-year').value;
            
            if (month && year) {
                showTimeInputForm(year, month);
            } else {
                hideTimeInputForm();
            }
        });
    }
}

// 時間入力フォームを表示する関数
function showTimeInputForm(year, month) {
    const timeInputSection = document.getElementById('time-input-section');
    if (timeInputSection) {
        timeInputSection.style.display = 'block';
        
        // 選択された年月の日数を取得
        const daysInMonth = new Date(year, month, 0).getDate();
        
        // 一括入力フォームを追加
        addBulkInputForm();
        
        // 時間入力行を生成
        generateTimeInputRows(year, month, daysInMonth);
    }
}

// 一括入力フォームを追加する関数
function addBulkInputForm() {
    const timeInputSection = document.getElementById('time-input-section');
    if (!timeInputSection) return;
    
    // 既存の一括入力フォームを削除
    const existingBulkForm = document.getElementById('bulk-input-form');
    if (existingBulkForm) {
        existingBulkForm.remove();
    }
    
    // 一括入力フォームを作成
    const bulkForm = document.createElement('div');
    bulkForm.id = 'bulk-input-form';
    bulkForm.className = 'bulk-input-form';
    bulkForm.innerHTML = `
        <div class="bulk-input-header">
            <h3><i class="fas fa-clock"></i> 一括時間入力</h3>
            <p>すべての日付に同じ時間を設定します</p>
        </div>
        <div class="bulk-input-content">
            <div class="bulk-input-row">
                <label>出勤時間:</label>
                <input type="time" id="bulk-check-in" placeholder="出勤時間">
            </div>
            <div class="bulk-input-row">
                <label>退勤時間:</label>
                <input type="time" id="bulk-check-out" placeholder="退勤時間">
            </div>
            <div class="bulk-input-row">
                <label>店舗:</label>
                <select id="bulk-store">
                    <option value="指定なし">指定なし</option>
                    <option value="所沢店">所沢店</option>
                    <option value="入間店">入間店</option>
                    <option value="休み">休み</option>
                    <option value="欠勤">欠勤</option>
                </select>
            </div>
            <div class="bulk-input-actions">
                <button type="button" class="btn btn-primary" onclick="applyBulkInput()">
                    <i class="fas fa-check"></i> 一括適用
                </button>
                <button type="button" class="btn btn-secondary" onclick="clearBulkInput()">
                    <i class="fas fa-times"></i> クリア
                </button>
            </div>
        </div>
    `;
    
    // 一括入力フォームを時間入力セクションの最初に挿入
    timeInputSection.insertBefore(bulkForm, timeInputSection.firstChild);
}

// 時間入力フォームを非表示にする関数
function hideTimeInputForm() {
    const timeInputSection = document.getElementById('time-input-section');
    if (timeInputSection) {
        timeInputSection.style.display = 'none';
    }
}

// 時間入力行を生成する関数
function generateTimeInputRows(year, month, daysInMonth) {
    const timeInputRows = document.getElementById('time-input-rows');
    if (!timeInputRows) return;
    
    timeInputRows.innerHTML = '';
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
        const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        const row = createTimeInputRow(dateString, day, dayOfWeek);
        timeInputRows.appendChild(row);
    }
    
    // 時間入力のイベントリスナーを追加
    addTimeInputEventListeners();
}

// 時間入力行を作成する関数
function createTimeInputRow(dateString, day, dayOfWeek) {
    const row = document.createElement('div');
    row.className = 'time-input-row';
    row.setAttribute('data-label', `${day}日(${dayOfWeek})`);
    
    row.innerHTML = `
        <input type="date" class="date-input" value="${dateString}" readonly>
        <input type="time" class="time-input check-in-time" placeholder="出勤時間">
        <input type="time" class="time-input check-out-time" placeholder="退勤時間">
        <select class="store-select">
            <option value="指定なし">指定なし</option>
            <option value="所沢店">所沢店</option>
            <option value="入間店">入間店</option>
            <option value="休み">休み</option>
            <option value="欠勤">欠勤</option>
        </select>
    `;
    
    return row;
}

// 時間入力のイベントリスナーを追加する関数
function addTimeInputEventListeners() {
    const timeInputRows = document.querySelectorAll('.time-input-row');
    
    timeInputRows.forEach(row => {
        const checkInInput = row.querySelector('.check-in-time');
        const checkOutInput = row.querySelector('.check-out-time');
        const storeSelect = row.querySelector('.store-select');
        
        // 出勤時間の変更イベント
        if (checkInInput) {
            checkInInput.addEventListener('change', function() {
                updateStoreBasedOnTime(row);
            });
        }
        
        // 退勤時間の変更イベント
        if (checkOutInput) {
            checkOutInput.addEventListener('change', function() {
                updateStoreBasedOnTime(row);
            });
        }
        
        // 店舗選択の変更イベント
        if (storeSelect) {
            storeSelect.addEventListener('change', function() {
                // 店舗が「休み」または「欠勤」に設定された場合、時間をクリア
                if (this.value === '休み' || this.value === '欠勤') {
                    const checkIn = row.querySelector('.check-in-time');
                    const checkOut = row.querySelector('.check-out-time');
                    if (checkIn) checkIn.value = '';
                    if (checkOut) checkOut.value = '';
                }
            });
        }
    });
}

// 時間に基づいて店舗を更新する関数
function updateStoreBasedOnTime(row) {
    const checkInInput = row.querySelector('.check-in-time');
    const checkOutInput = row.querySelector('.check-out-time');
    const storeSelect = row.querySelector('.store-select');
    
    if (!checkInInput || !checkOutInput || !storeSelect) return;
    
    const checkIn = checkInInput.value;
    const checkOut = checkOutInput.value;
    
    // 時間が入力されていない場合は店舗を「休み」に設定
    if (!checkIn && !checkOut) {
        storeSelect.value = '休み';
    }
    // 時間が入力されている場合は「指定なし」に設定（ユーザーが手動で店舗を選択できるように）
    else if (checkIn || checkOut) {
        if (storeSelect.value === '休み' || storeSelect.value === '欠勤') {
            storeSelect.value = '指定なし';
        }
    }
}

// 一括入力を適用する関数
function applyBulkInput() {
    const bulkCheckIn = document.getElementById('bulk-check-in');
    const bulkCheckOut = document.getElementById('bulk-check-out');
    const bulkStore = document.getElementById('bulk-store');
    
    if (!bulkCheckIn || !bulkCheckOut || !bulkStore) {
        showNotification('一括入力フォームが見つかりません。', 'error');
        return;
    }
    
    const checkInTime = bulkCheckIn.value;
    const checkOutTime = bulkCheckOut.value;
    let store = bulkStore.value;
    
    // 時間が入力されていない場合は店舗を「休み」に設定
    if (!checkInTime && !checkOutTime) {
        store = '休み';
    }
    
    // すべての時間入力行に適用
    const timeInputRows = document.querySelectorAll('.time-input-row');
    timeInputRows.forEach(row => {
        const checkInInput = row.querySelector('.check-in-time');
        const checkOutInput = row.querySelector('.check-out-time');
        const storeSelect = row.querySelector('.store-select');
        
        if (checkInInput) checkInInput.value = checkInTime;
        if (checkOutInput) checkOutInput.value = checkOutTime;
        if (storeSelect) storeSelect.value = store;
    });
    
    showNotification('一括入力が適用されました。', 'success');
}

// 一括入力をクリアする関数
function clearBulkInput() {
    const bulkCheckIn = document.getElementById('bulk-check-in');
    const bulkCheckOut = document.getElementById('bulk-check-out');
    const bulkStore = document.getElementById('bulk-store');
    
    if (bulkCheckIn) bulkCheckIn.value = '';
    if (bulkCheckOut) bulkCheckOut.value = '';
    if (bulkStore) bulkStore.value = '指定なし';
    
    showNotification('一括入力がクリアされました。', 'info');
}

// 時間入力行を追加する関数
function addTimeInputRow() {
    const timeInputRows = document.getElementById('time-input-rows');
    if (!timeInputRows) return;
    
    const year = document.getElementById('submit-year').value;
    const month = document.getElementById('submit-month').value;
    
    if (!year || !month) {
        showNotification('年月を選択してから行を追加してください。', 'error');
        return;
    }
    
    // 現在の日付を取得
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    const day = today.getDate();
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][today.getDay()];
    
    const row = createTimeInputRow(dateString, day, dayOfWeek);
    timeInputRows.appendChild(row);
}

// 時間データを収集する関数
function collectTimeData() {
    const timeInputRows = document.querySelectorAll('.time-input-row');
    const timeData = [];
    
    timeInputRows.forEach(row => {
        const dateInput = row.querySelector('.date-input');
        const checkInTime = row.querySelector('.check-in-time');
        const checkOutTime = row.querySelector('.check-out-time');
        const storeSelect = row.querySelector('.store-select');
        
        const date = dateInput ? dateInput.value : '';
        const checkIn = checkInTime ? checkInTime.value : '';
        const checkOut = checkOutTime ? checkOutTime.value : '';
        let store = storeSelect ? storeSelect.value : '';
        
        // 時間が入力されていない場合は店舗を「休み」に設定
        if (!checkIn && !checkOut) {
            store = '休み';
        }
        
        // データを追加（空文字も含める）
        timeData.push({
            date: date,
            check_in_time: checkIn,
            check_out_time: checkOut,
            store: store
        });
    });
    
    return timeData;
}

// 年の選択肢を設定する関数
function setupYearOptions() {
    const yearSelect = document.getElementById('submit-year');
    if (!yearSelect) {
        console.log('年選択要素が見つかりません');
        return;
    }

    const currentYear = new Date().getFullYear();
    console.log('現在の年:', currentYear);
    
    // 既存のオプションをクリア
    yearSelect.innerHTML = '<option value="">年を選択</option>';

    // 現在の年から前後2年を追加
    for (let year = currentYear - 2; year <= currentYear + 2; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = `${year}年`;
        yearSelect.appendChild(option);
        console.log(`年オプション追加: ${year}年`);
    }

    // 現在の年をデフォルト選択
    yearSelect.value = currentYear;
    console.log('年選択初期化完了');
}

// 提出シフト確認タブの名前選択肢を設定する関数
function setupSubmittedNameOptions() {
    const nameSelect = document.getElementById('submitted-name');
    if (!nameSelect) {
        console.log('名前選択要素が見つかりません');
        return;
    }

    // 既存のオプションをクリア
    nameSelect.innerHTML = '<option value="">すべて</option>';

    // Supabaseクライアントの確認
    if (!checkSupabaseClient()) {
        console.error('Supabaseクライアントが利用できません');
        return;
    }

    // Supabaseから既存の提出者名を取得してオプションに追加
    shiftSubmitSupabase.from('shift_submit').select('name').then(result => {
        if (result.error) {
            console.error('Error fetching submitted shift names:', result.error);
            showNotification(`名前データの取得エラー: ${result.error.message}`, 'error');
        } else if (result.data) {
            // 重複を除去してユニークな名前のリストを作成
            const uniqueNames = [...new Set(result.data.map(item => item.name))];
            
            // 名前を正規化してグループ化
            const normalizedGroups = {};
            uniqueNames.forEach(name => {
                const normalizedName = name.replace(/\s+/g, '');
                if (!normalizedGroups[normalizedName]) {
                    normalizedGroups[normalizedName] = [];
                }
                normalizedGroups[normalizedName].push(name);
            });
            
            // 正規化された名前でオプションを作成
            Object.entries(normalizedGroups).forEach(([normalizedName, originalNames]) => {
                const option = document.createElement('option');
                option.value = normalizedName;
                
                // 複数の元の名前がある場合は最初のものを表示名として使用
                const displayName = originalNames[0];
                option.textContent = displayName;
                
                // データ属性に元の名前を保存（デバッグ用）
                option.setAttribute('data-original-names', originalNames.join(', '));
                
                nameSelect.appendChild(option);
            });
            
            console.log(`[DEBUG] Loaded ${Object.keys(normalizedGroups).length} unique normalized names`);
        } else {
            console.log('[DEBUG] No name data found');
        }
    }).catch(error => {
        console.error('Error fetching submitted shift names:', error);
        showNotification(`名前データの取得エラー: ${error.message}`, 'error');
    });
}

// 提出シフト確認タブの年選択肢を設定する関数
function setupSubmittedYearOptions() {
    const yearSelect = document.getElementById('submitted-year');
    if (!yearSelect) {
        console.log('年選択要素が見つかりません');
        return;
    }

    const currentYear = new Date().getFullYear();
    console.log('現在の年:', currentYear);
    
    // 既存のオプションをクリア
    yearSelect.innerHTML = '<option value="">年を選択</option>';

    // 現在の年から前後2年を追加
    for (let year = currentYear - 2; year <= currentYear + 2; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = `${year}年`;
        yearSelect.appendChild(option);
        console.log(`年オプション追加: ${year}年`);
    }

    // 現在の年をデフォルト選択
    yearSelect.value = currentYear;
    console.log('年選択初期化完了');
}

// 提出シフト確認タブの月選択肢を設定する関数
function setupSubmittedMonthOptions() {
    const monthSelect = document.getElementById('submitted-month');
    if (!monthSelect) {
        console.log('月選択要素が見つかりません');
        return;
    }

    // 既存のオプションをクリア
    monthSelect.innerHTML = '<option value="">月を選択</option>';

    // 1から12までの月を追加
    for (let month = 1; month <= 12; month++) {
        const option = document.createElement('option');
        option.value = month;
        option.textContent = `${month}月`;
        monthSelect.appendChild(option);
    }

    // 現在の月をデフォルト選択
    monthSelect.value = new Date().getMonth() + 1; // 0-indexed
    console.log('月選択初期化完了');
}

// フィルター変更時のイベントリスナーを設定する関数
function setupFilterEventListeners() {
    const nameSelect = document.getElementById('submitted-name');
    const yearSelect = document.getElementById('submitted-year');
    const monthSelect = document.getElementById('submitted-month');
    
    if (nameSelect) {
        nameSelect.addEventListener('change', () => {
            console.log('[DEBUG] Name filter changed');
            loadSubmittedShiftData();
        });
    }
    
    if (yearSelect) {
        yearSelect.addEventListener('change', () => {
            console.log('[DEBUG] Year filter changed');
            loadSubmittedShiftData();
        });
    }
    
    if (monthSelect) {
        monthSelect.addEventListener('change', () => {
            console.log('[DEBUG] Month filter changed');
            loadSubmittedShiftData();
        });
    }
}

// 提出シフトデータを読み込む関数
async function loadSubmittedShiftData() {
    console.log('[DEBUG] loadSubmittedShiftData() called');
    
    // Supabaseクライアントの確認
    if (!checkSupabaseClient()) {
        console.error('Supabaseクライアントが利用できません');
        showNotification('データベース接続が確立されていません。', 'error');
        return;
    }
    
    const nameSelect = document.getElementById('submitted-name');
    const yearSelect = document.getElementById('submitted-year');
    const monthSelect = document.getElementById('submitted-month');

    if (!nameSelect || !yearSelect || !monthSelect) {
        console.log('提出シフト確認タブの要素が見つかりません');
        console.log('nameSelect:', nameSelect);
        console.log('yearSelect:', yearSelect);
        console.log('monthSelect:', monthSelect);
        return;
    }

    const name = nameSelect.value;
    const year = yearSelect.value;
    const month = monthSelect.value;
    
    console.log('[DEBUG] Filter values - name:', name, 'year:', year, 'month:', month);

    try {
        // ローディング表示
        showLoading();

        // まず、テーブルの存在を確認
        console.log('[DEBUG] Checking if shift_submit table exists...');
        
        let query = shiftSubmitSupabase.from('shift_submit').select('*').limit(1);
        const { data: testData, error: testError } = await query;
        
        if (testError) {
            console.error('Database connection test failed:', testError);
            showNotification(`データベース接続エラー: ${testError.message}`, 'error');
            
            // テーブルが存在しない場合の詳細情報を表示
            if (testError.code === '42P01') {
                showNotification('shift_submitテーブルが存在しません。データベースにテーブルを作成してください。', 'error');
            } else if (testError.code === '42501') {
                showNotification('データベースへのアクセス権限がありません。', 'error');
            }
            return;
        }
        
        console.log('[DEBUG] Database connection successful, test data:', testData);
        console.log('[DEBUG] Proceeding with data fetch...');
        
        // 実際のデータを取得
        query = shiftSubmitSupabase.from('shift_submit').select('*');
        
        // フィルター条件を適用
        if (name && name !== '') {
            // 正規化済み名前で完全一致検索
            const normalizedName = normalizeName(name);
            console.log('[DEBUG] Searching for normalized name:', normalizedName);
            query = query.eq('normalized_name', normalizedName);
        }
        if (year && year !== '') {
            query = query.eq('year', parseInt(year));
        }
        if (month && month !== '') {
            query = query.eq('month', parseInt(month));
        }

        // ソートを適用（年降順、月降順、名前昇順）
        query = query.order('year', { ascending: false })
                    .order('month', { ascending: false })
                    .order('name', { ascending: true });

        const { data, error } = await query;

        console.log('[DEBUG] Supabase response - data:', data, 'error:', error);

        if (error) {
            console.error('Load submitted shift data error:', error);
            showNotification(`データの読み込みエラー: ${error.message}`, 'error');
        } else {
            console.log('[DEBUG] Displaying submitted shift data, count:', data ? data.length : 0);
            displaySubmittedShiftData(data || []);
            updateSubmittedStats(data || []);
        }

    } catch (error) {
        console.error('Load submitted shift data error:', error);
        showNotification(`予期しないエラーが発生しました: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// シフト提出機能
async function submitShift() {
    const nameInput = document.getElementById('submit-name');
    const yearSelect = document.getElementById('submit-year');
    const monthSelect = document.getElementById('submit-month');

    // 入力値の取得
    const name = nameInput ? nameInput.value.trim() : '';
    const year = yearSelect ? yearSelect.value : '';
    const month = monthSelect ? monthSelect.value : '';

    // バリデーション
    if (!name) {
        showNotification('名前を入力してください。', 'error');
        return;
    }

    if (!year) {
        showNotification('年を選択してください。', 'error');
        return;
    }

    if (!month) {
        showNotification('月を選択してください。', 'error');
        return;
    }

    // 時間データを収集
    const timeData = collectTimeData();
    
    // 時間データのバリデーション
    if (timeData.length === 0) {
        showNotification('少なくとも1日分のシフトデータを入力してください。', 'error');
        return;
    }
    
    // 時間データの詳細バリデーション
    const validationResult = validateTimeData(timeData);
    if (!validationResult.isValid) {
        showNotification(validationResult.message, 'error');
        return;
    }

    // 既に提出済みかチェック
    const isAlreadySubmitted = await checkAlreadySubmitted(name, year, month);
    if (isAlreadySubmitted) {
        if (window.alertAsync) {
            await alertAsync(`${year}年${month}月のシフトは既に提出済みです。`, { title: '提出済み' });
        } else {
            alert(`${year}年${month}月のシフトは既に提出済みです。`);
        }
        return;
    }

    // 確認ダイアログ
    const shiftSummary = generateShiftSummary(timeData);
    const ok = await (window.confirmAsync ? window.confirmAsync(`${year}年${month}月のシフトを提出しますか？\n\n名前: ${name}\n年月: ${year}年${month}月\n\n${shiftSummary}`) : Promise.resolve(confirm(`${year}年${month}月のシフトを提出しますか？\n\n名前: ${name}\n年月: ${year}年${month}月\n\n${shiftSummary}`)));
    if (!ok) {
        return;
    }

    try {
        // ローディング表示
        showLoading();

        // シフト提出データを作成
        const submitData = {
            name: name,
            normalized_name: normalizeName(name),
            year: parseInt(year),
            month: parseInt(month),
            status: 'submitted',
            shift_data: timeData
        };

        // Supabaseにデータを挿入
        if (typeof shiftSubmitSupabase === 'undefined' || !shiftSubmitSupabase) {
            console.error('Supabaseクライアントが利用できません');
            showNotification('シフト提出中にエラーが発生しました。', 'error');
            return;
        }
        
        const { data, error } = await shiftSubmitSupabase
            .from('shift_submit')
            .insert([submitData]);

        if (error) {
            console.error('Submit error:', error);
            showNotification('シフト提出中にエラーが発生しました。', 'error');
        } else {
            showNotification(`${year}年${month}月のシフトが正常に提出されました！`, 'success');
            
            // フォームをリセット
            resetSubmitForm();
            
            // 提出状況を更新
            checkSubmitStatus();
        }

    } catch (error) {
        console.error('Submit shift error:', error);
        showNotification('シフト提出中にエラーが発生しました。', 'error');
    } finally {
        hideLoading();
    }
}

// 既に提出済みかチェックする関数
async function checkAlreadySubmitted(name, year, month) {
    try {
        if (typeof shiftSubmitSupabase === 'undefined' || !shiftSubmitSupabase) {
            console.error('Supabaseクライアントが利用できません');
            return false;
        }
        
        const { data, error } = await shiftSubmitSupabase
            .from('shift_submit')
            .select('*')
            .eq('normalized_name', normalizeName(name))
            .eq('year', parseInt(year))
            .eq('month', parseInt(month));

        if (error) {
            console.error('Check already submitted error:', error);
            return false;
        }

        return data && data.length > 0;
    } catch (error) {
        console.error('Check already submitted error:', error);
        return false;
    }
}

// 提出状況確認機能
async function checkSubmitStatus() {
    console.log('[DEBUG] checkSubmitStatus() called');
    
    const nameInput = document.getElementById('submit-name');
    let name = nameInput ? nameInput.value.trim() : '';

    // 名前が入力されていない場合、currentUserから取得を試行
    if (!name && typeof currentUser !== 'undefined' && currentUser && currentUser.name) {
        name = currentUser.name;
        if (nameInput) {
            nameInput.value = name;
        }
    }

    if (!name) {
        console.log('[DEBUG] No name provided, showing notification');
        showNotification('名前を入力してから提出状況を確認してください。', 'error');
        return;
    }

    try {
        // ローディング表示
        console.log('[DEBUG] Calling showLoading() from checkSubmitStatus');
        showLoading();

        // Supabaseから提出データを取得（正規化名で検索）
        if (typeof shiftSubmitSupabase === 'undefined' || !shiftSubmitSupabase) {
            console.error('Supabaseクライアントが利用できません');
            showNotification('提出状況の確認中にエラーが発生しました。', 'error');
            return;
        }
        
        // 名前の正規化（スペースを除去して検索）
        const normalizedName = normalizeName(name);
        console.log('[DEBUG] Searching for normalized name:', normalizedName);
        
        const { data, error } = await shiftSubmitSupabase
            .from('shift_submit')
            .select('*')
            .eq('normalized_name', normalizedName)
            .order('year', { ascending: false })
            .order('month', { ascending: false });

        if (error) {
            console.error('Check submit status error:', error);
            showNotification('提出状況の確認中にエラーが発生しました。', 'error');
        } else {
            displaySubmitStatus(data || []);
        }

    } catch (error) {
        console.error('Check submit status error:', error);
        showNotification('提出状況の確認中にエラーが発生しました。', 'error');
    } finally {
        hideLoading();
    }
}

// 提出状況を表示する関数
function displaySubmitStatus(submitData) {
    const submitStatus = document.getElementById('submit-status');
    const submitStatusContent = document.getElementById('submit-status-content');

    if (!submitStatus || !submitStatusContent) return;

    if (submitData.length === 0) {
        submitStatus.style.display = 'block';
        submitStatusContent.innerHTML = `
            <div class="no-data">
                <p>提出履歴がありません。</p>
            </div>
        `;
        return;
    }

    // 最新の提出状況を表示
    const latestSubmit = submitData[0];

    submitStatus.style.display = 'block';
    submitStatusContent.innerHTML = `
        <div class="status-card">
            <div class="status-header">
                <i class="fas fa-check-circle"></i>
                <span>提出状況</span>
            </div>
            <div class="status-details">
                <p><strong>提出年月:</strong> ${latestSubmit.year}年${latestSubmit.month}月</p>
                <p><strong>ステータス:</strong> <span class="status-submitted">提出済み</span></p>
            </div>
        </div>
    `;
}



// フォームをリセットする関数
function resetSubmitForm() {
    const yearSelect = document.getElementById('submit-year');
    const monthSelect = document.getElementById('submit-month');

    if (yearSelect) {
        yearSelect.value = new Date().getFullYear();
    }
    if (monthSelect) {
        monthSelect.value = '';
    }
}

// 自分のシフト詳細セクションの初期化
function setupMyShiftDetails() {
    const myShiftDetails = document.getElementById('my-shift-details');
    if (!myShiftDetails) return;

    // 自分のシフト詳細セクションを表示
    myShiftDetails.style.display = 'block';

    // 年の選択肢を設定
    setupMyShiftYearOptions();
    
    // 月の選択肢を設定
    setupMyShiftMonthOptions();
    
    // リアルタイム反映のイベントリスナーを追加
    setupMyShiftRealTimeListeners();
}

// 自分のシフト詳細用の年選択肢を設定
function setupMyShiftYearOptions() {
    const yearSelect = document.getElementById('my-shift-year');
    if (!yearSelect) return;

    const currentYear = new Date().getFullYear();
    
    // 既存のオプションをクリア
    yearSelect.innerHTML = '<option value="">年を選択</option>';

    // 現在の年から前後2年を追加
    for (let year = currentYear - 2; year <= currentYear + 2; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = `${year}年`;
        yearSelect.appendChild(option);
    }

    // 現在の年をデフォルト選択
    yearSelect.value = currentYear;
}

// 自分のシフト詳細用の月選択肢を設定
function setupMyShiftMonthOptions() {
    const monthSelect = document.getElementById('my-shift-month');
    if (!monthSelect) return;

    // 既存のオプションをクリア
    monthSelect.innerHTML = '<option value="">月を選択</option>';

    // 1から12までの月を追加
    for (let month = 1; month <= 12; month++) {
        const option = document.createElement('option');
        option.value = month;
        option.textContent = `${month}月`;
        monthSelect.appendChild(option);
    }

    // 現在の月をデフォルト選択
    monthSelect.value = new Date().getMonth() + 1;
}

// 自分のシフト詳細のリアルタイム反映イベントリスナーを設定
function setupMyShiftRealTimeListeners() {
    const yearSelect = document.getElementById('my-shift-year');
    const monthSelect = document.getElementById('my-shift-month');
    
    if (yearSelect) {
        yearSelect.addEventListener('change', () => {
            console.log('[DEBUG] My shift year changed');
            loadMyShiftDetails();
        });
    }
    
    if (monthSelect) {
        monthSelect.addEventListener('change', () => {
            console.log('[DEBUG] My shift month changed');
            loadMyShiftDetails();
        });
    }
}

// 自分のシフト詳細を読み込む関数
async function loadMyShiftDetails() {
    const yearSelect = document.getElementById('my-shift-year');
    const monthSelect = document.getElementById('my-shift-month');
    const nameInput = document.getElementById('submit-name');

    if (!yearSelect || !monthSelect || !nameInput) {
        return;
    }

    const year = yearSelect.value;
    const month = monthSelect.value;
    const name = nameInput.value.trim();

    if (!year || !month || !name) {
        clearMyShiftDetails();
        return;
    }

    try {
        // Supabaseから自分のシフトデータを取得（LIKE検索を使用）
        if (!checkSupabaseClient()) {
            return;
        }

        // 名前の正規化（スペースを除去して検索）
        const normalizedName = name.replace(/\s+/g, '');
        console.log('[DEBUG] Searching for my shift details with normalized name:', normalizedName);

        const { data, error } = await shiftSubmitSupabase
            .from('shift_submit')
            .select('*')
            .eq('normalized_name', normalizedName)
            .eq('year', parseInt(year))
            .eq('month', parseInt(month))
            .maybeSingle();

        if (error) {
            console.error('Load my shift details error:', error);
            clearMyShiftDetails();
        } else if (data) {
            displayMyShiftDetails(data);
        } else {
            clearMyShiftDetails();
        }

    } catch (error) {
        console.error('Load my shift details error:', error);
        clearMyShiftDetails();
    }
}

// 自分のシフト詳細を表示する関数
function displayMyShiftDetails(shiftData) {
    const detailsContent = document.getElementById('my-shift-details-content');
    if (!detailsContent) return;

    // 統計情報を計算
    const workDays = shiftData.shift_data ? shiftData.shift_data.filter(data => 
        data.store && data.store !== '休み' && data.store !== '欠勤'
    ).length : 0;
    
    const restDays = shiftData.shift_data ? shiftData.shift_data.filter(data => 
        data.store === '休み'
    ).length : 0;
    
    const absentDays = shiftData.shift_data ? shiftData.shift_data.filter(data => 
        data.store === '欠勤'
    ).length : 0;

    let detailsHTML = `
        <div class="my-shift-summary">
            <div class="summary-grid">
                <div class="summary-item">
                    <span class="summary-label">出勤日数</span>
                    <span class="summary-value">${workDays}日</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">休み</span>
                    <span class="summary-value">${restDays}日</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">欠勤</span>
                    <span class="summary-value">${absentDays}日</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">総日数</span>
                    <span class="summary-value">${shiftData.shift_data ? shiftData.shift_data.length : 0}日</span>
                </div>
            </div>
        </div>
    `;

    // 詳細テーブルを追加
    if (shiftData.shift_data && shiftData.shift_data.length > 0) {
        detailsHTML += `
            <div class="my-shift-table">
                <table>
                    <thead>
                        <tr>
                            <th>日付</th>
                            <th>出勤時間</th>
                            <th>退勤時間</th>
                            <th>店舗</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        shiftData.shift_data.forEach(shift => {
            const date = new Date(shift.date);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()}(${['日', '月', '火', '水', '木', '金', '土'][date.getDay()]})`;
            
            detailsHTML += `
                <tr>
                    <td>${dateStr}</td>
                    <td>${shift.check_in_time || '-'}</td>
                    <td>${shift.check_out_time || '-'}</td>
                    <td>
                        <span class="store-badge store-${getStoreClass(shift.store)}">
                            ${shift.store || '指定なし'}
                        </span>
                    </td>
                </tr>
            `;
        });

        detailsHTML += `
                    </tbody>
                </table>
            </div>
        `;
    }

    detailsContent.innerHTML = detailsHTML;
}

// 自分のシフト詳細をクリアする関数
function clearMyShiftDetails() {
    const detailsContent = document.getElementById('my-shift-details-content');
    if (detailsContent) {
        detailsContent.innerHTML = '<p>シフトデータがありません。</p>';
    }
}





// ローディングを表示する関数
function showLoading() {
    const submitContainer = document.querySelector('.submit-container');
    if (submitContainer) {
        const loading = document.createElement('div');
        loading.id = 'submit-loading';
        loading.className = 'loading';
        loading.innerHTML = `
            <div class="spinner"></div>
            <p>処理中...</p>
        `;
        loading.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.9);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;
        submitContainer.style.position = 'relative';
        submitContainer.appendChild(loading);
    }
}

// すべてのローディング要素を非表示にする関数
function hideAllLoadingElements() {
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

// ローディングを非表示にする関数
function hideLoading() {
    // すべてのローディング要素を非表示にする
    hideAllLoadingElements();
}

// 通知を表示する関数（script.jsの関数を再利用）
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
    
    // スタイルを追加（サイトの上下移動を防ぐため、transformを使用）
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: -420px;
        background: ${getNotificationColor(type)};
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
const shiftSubmitStyle = document.createElement('style');
shiftSubmitStyle.textContent = `
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
    
    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
    
    @keyframes fadeOut {
        from {
            opacity: 1;
        }
        to {
            opacity: 0;
        }
    }
    
    @keyframes slideIn {
        from {
            transform: translateY(-50px);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
    
    /* 通知のホバー効果 */
    .notification:hover {
        transform: translateX(-440px) scale(1.02);
        transition: transform 0.3s ease;
    }
    
    /* 通知のレスポンシブ対応 */
    @media (max-width: 768px) {
        .notification {
            max-width: calc(100vw - 40px) !important;
            right: -100vw !important;
        }
        
        .notification:hover {
            transform: translateX(-100vw) scale(1.02);
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
    
    .submit-container {
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
    }
    
    .submit-form {
        background: #f8f9fa;
        padding: 20px;
        border-radius: 10px;
        margin-bottom: 20px;
    }
    
    .form-group {
        margin-bottom: 15px;
    }
    
    .form-row {
        display: flex;
        gap: 15px;
    }
    
    .form-row .form-group {
        flex: 1;
    }
    
    .form-group label {
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
        color: #333;
    }
    
    .form-group input,
    .form-group select {
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 5px;
        font-size: 14px;
    }
    
    .required {
        color: #dc3545;
    }
    
    .form-actions {
        display: flex;
        gap: 10px;
        margin-top: 20px;
    }
    
    .btn {
        padding: 10px 20px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 5px;
    }
    
    .btn-primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
    }
    
    .btn-secondary {
        background: #6c757d;
        color: white;
    }
    
    .btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }
    
    .submit-status,
    .submit-history {
        background: #f8f9fa;
        padding: 20px;
        border-radius: 10px;
        margin-top: 20px;
    }
    
    .status-card {
        background: white;
        padding: 15px;
        border-radius: 8px;
        border-left: 4px solid #28a745;
    }
    
    .status-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
        color: #28a745;
        font-weight: 500;
    }
    
    .status-details p {
        margin: 5px 0;
        color: #666;
    }
    
    .status-submitted {
        background: #28a745;
        color: white;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 12px;
    }
    
    .history-table {
        overflow-x: auto;
    }
    
    .history-table table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
    }
    
    .history-table th,
    .history-table td {
        padding: 10px;
        text-align: left;
        border-bottom: 1px solid #ddd;
    }
    
    .history-table th {
        background: #f5f5f5;
        font-weight: 500;
    }
    
    .no-data {
        text-align: center;
        color: #666;
        padding: 20px;
    }
    
    .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
    }
    
    .spinner {
        width: 30px;
        height: 30px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #667eea;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    /* 一括入力フォームのスタイル */
    .bulk-input-form {
        background: #e3f2fd;
        padding: 20px;
        border-radius: 10px;
        margin-bottom: 20px;
        border: 2px solid #2196f3;
    }
    
    .bulk-input-header {
        margin-bottom: 15px;
    }
    
    .bulk-input-header h3 {
        margin: 0 0 5px 0;
        color: #1976d2;
        font-size: 18px;
    }
    
    .bulk-input-header p {
        margin: 0;
        color: #666;
        font-size: 14px;
    }
    
    .bulk-input-content {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        align-items: end;
    }
    
    .bulk-input-row {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }
    
    .bulk-input-row label {
        font-weight: 500;
        color: #333;
        font-size: 14px;
    }
    
    .bulk-input-row input,
    .bulk-input-row select {
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 5px;
        font-size: 14px;
    }
    
    .bulk-input-actions {
        display: flex;
        gap: 10px;
        align-items: end;
    }
    
    .bulk-input-actions .btn {
        padding: 8px 16px;
        font-size: 13px;
    }
    
    /* 時間入力行のスタイル調整 */
    .time-input-row {
        display: grid;
        grid-template-columns: 120px 150px 150px 120px;
        gap: 10px;
        align-items: center;
        padding: 10px;
        border-bottom: 1px solid #eee;
    }
    
    .time-input-row .date-input {
        font-size: 12px;
        padding: 8px;
    }
    
    .time-input-row .time-input {
        padding: 8px;
        font-size: 14px;
        min-width: 140px;
    }
    
    .time-input-row .store-select {
        padding: 8px;
        font-size: 14px;
    }
    
    /* モーダル関連のスタイル */
    .shift-details-table {
        margin-top: 20px;
        overflow-x: auto;
    }
    
    .shift-details-table table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
    }
    
    .shift-details-table th,
    .shift-details-table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #ddd;
    }
    
    .shift-details-table th {
        background: #f5f5f5;
        font-weight: 500;
        color: #333;
    }
    
    .store-badge {
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
    }
    
    .store-badge.store-tokorozawa {
        background: #FFB6C1;
        color: #333;
    }
    
    .store-badge.store-iruma {
        background: #FFFFFF;
        color: #333;
        border: 1px solid #ddd;
    }
    
    .store-badge.store-rest {
        background: #F0F0F0;
        color: #666;
    }
    
    .store-badge.store-absent {
        background: #FFCCCC;
        color: #333;
    }
    
    .store-badge.store-default {
        background: #FFFFFF;
        color: #333;
        border: 1px solid #ddd;
    }
    
    /* 統計情報の横配置スタイル */
    .stats-horizontal {
        display: flex;
        gap: 20px;
        margin: 20px 0;
    }
    
    .stats-horizontal .stat-card {
        flex: 1;
        background: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        text-align: center;
        transition: transform 0.3s ease;
    }
    
    .stats-horizontal .stat-card:hover {
        transform: translateY(-2px);
    }
    
    .stats-horizontal .stat-card i {
        font-size: 2rem;
        color: #667eea;
        margin-bottom: 10px;
    }
    
    .stats-horizontal .stat-card h3 {
        margin: 10px 0 5px 0;
        color: #333;
        font-size: 14px;
        font-weight: 500;
    }
    
    .stats-horizontal .stat-card p {
        margin: 0;
        font-size: 24px;
        font-weight: 600;
        color: #667eea;
    }
    
    /* 自分のシフト詳細セクションのスタイル */
    .my-shift-details {
        background: #f8f9fa;
        padding: 20px;
        border-radius: 10px;
        margin-top: 20px;
    }
    
    .my-shift-controls {
        margin-bottom: 20px;
    }
    
    .my-shift-summary {
        background: white;
        padding: 20px;
        border-radius: 8px;
        margin-bottom: 20px;
    }
    
    .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 15px;
    }
    
    .summary-item {
        text-align: center;
        padding: 15px;
        border-radius: 8px;
        background: #f8f9fa;
    }
    
    .summary-label {
        display: block;
        font-size: 14px;
        color: #666;
        margin-bottom: 5px;
    }
    
    .summary-value {
        display: block;
        font-size: 24px;
        font-weight: 600;
        color: #667eea;
    }
    
    .my-shift-table {
        background: white;
        border-radius: 8px;
        overflow: hidden;
    }
    
    .my-shift-table table {
        width: 100%;
        border-collapse: collapse;
    }
    
    .my-shift-table th,
    .my-shift-table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #eee;
    }
    
    .my-shift-table th {
        background: #f5f5f5;
        font-weight: 500;
        color: #333;
    }
    
    .my-shift-table tr:hover {
        background: #f8f9fa;
    }
    
    /* レスポンシブ対応 */
    @media (max-width: 768px) {
        .time-input-row {
            grid-template-columns: 1fr;
            gap: 8px;
        }
        
        .bulk-input-content {
            grid-template-columns: 1fr;
        }
        
        .bulk-input-actions {
            flex-direction: column;
        }
        
        .shift-details-table {
            font-size: 14px;
        }
        
        .shift-details-table th,
        .shift-details-table td {
            padding: 8px;
        }
        
        .stats-horizontal {
            flex-direction: column;
            gap: 15px;
        }
        
        .stats-horizontal .stat-card {
            padding: 15px;
        }
        
        .stats-horizontal .stat-card p {
            font-size: 20px;
        }
        
        .summary-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        }
        
        .summary-value {
            font-size: 20px;
        }
        
        .my-shift-table {
            font-size: 14px;
        }
        
        .my-shift-table th,
        .my-shift-table td {
            padding: 8px;
        }
    }
`;
document.head.appendChild(shiftSubmitStyle);

// 時間データのバリデーション
function validateTimeData(timeData) {
    for (let i = 0; i < timeData.length; i++) {
        const data = timeData[i];
        
        // 日付の確認
        if (!data.date) {
            return { isValid: false, message: '日付が正しく設定されていません。' };
        }
        
        // 出勤時間と退勤時間の整合性チェック
        if (data.check_in_time && data.check_out_time) {
            const checkIn = new Date(`2000-01-01T${data.check_in_time}`);
            const checkOut = new Date(`2000-01-01T${data.check_out_time}`);
            
            if (checkIn >= checkOut) {
                return { isValid: false, message: `${data.date}の出勤時間が退勤時間より後になっています。` };
            }
        }
        
        // 店舗が選択されている場合の時間入力チェック（休み・欠勤以外の場合のみ）
        if (data.store && data.store !== '休み' && data.store !== '欠勤' && data.store !== '指定なし') {
            if (!data.check_in_time && !data.check_out_time) {
                return { isValid: false, message: `${data.date}の店舗が選択されていますが、時間が入力されていません。` };
            }
        }
    }
    
    return { isValid: true, message: '' };
}

// シフトサマリーを生成する関数
function generateShiftSummary(timeData) {
    const workDays = timeData.filter(data => 
        data.store && data.store !== '休み' && data.store !== '欠勤'
    ).length;
    
    const restDays = timeData.filter(data => 
        data.store === '休み'
    ).length;
    
    const absentDays = timeData.filter(data => 
        data.store === '欠勤'
    ).length;
    
    let summary = `出勤日数: ${workDays}日\n`;
    summary += `休み: ${restDays}日\n`;
    summary += `欠勤: ${absentDays}日\n`;
    summary += `総日数: ${timeData.length}日`;
    
    return summary;
}

// 提出シフトデータを表示する関数
function displaySubmittedShiftData(submitData) {
    console.log('[DEBUG] displaySubmittedShiftData() called with data:', submitData);
    
    const submittedShiftData = document.getElementById('submittedShiftData');
    if (!submittedShiftData) {
        console.log('[DEBUG] submittedShiftData element not found');
        return;
    }
    
    console.log('[DEBUG] submittedShiftData element found:', submittedShiftData);

    if (submitData.length === 0) {
        console.log('[DEBUG] No submitted shift data found');
        submittedShiftData.innerHTML = `
            <div class="no-data">
                <p>提出されたシフトデータがありません。</p>
                <p>シフト提出機能からデータを提出してください。</p>
            </div>
        `;
        return;
    }
    
    console.log('[DEBUG] Processing', submitData.length, 'submitted shift records');

    let html = `
        <div class="submitted-shift-table">
            <table>
                <thead>
                    <tr>
                        <th>名前</th>
                        <th>年月</th>
                        <th>ステータス</th>
                        <th>シフト詳細</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
    `;

    submitData.forEach(submit => {
        // シフトデータのサマリーを生成
        let shiftSummary = '-';
        if (submit.shift_data && submit.shift_data.length > 0) {
            const workDays = submit.shift_data.filter(data => 
                data.store && data.store !== '休み' && data.store !== '欠勤'
            ).length;
            const restDays = submit.shift_data.filter(data => 
                data.store === '休み'
            ).length;
            const absentDays = submit.shift_data.filter(data => 
                data.store === '欠勤'
            ).length;
            shiftSummary = `出勤${workDays}日、休み${restDays}日、欠勤${absentDays}日`;
        }
        
        html += `
            <tr>
                <td>${submit.name}</td>
                <td>${submit.year}年${submit.month}月</td>
                <td><span class="status-submitted">提出済み</span></td>
                <td>${shiftSummary}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="viewSubmittedShiftDetail('${submit.id}')">
                        <i class="fas fa-eye"></i> 詳細
                    </button>
                    <button class="btn btn-sm btn-secondary" style="background:#dc3545" onclick="deleteSubmittedShift('${submit.id}', '${submit.name}', ${submit.year}, ${submit.month})">
                        <i class="fas fa-trash"></i> 削除
                    </button>
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    submittedShiftData.innerHTML = html;
}

// 単一の提出シフトを削除する関数
async function deleteSubmittedShift(id, name, year, month) {
    try {
        const message = `${year}年${month}月の「${name}」の提出データを削除しますか？\n\nこの操作は取り消せません。`;
        const ok = await (window.confirmAsync ? window.confirmAsync(message, { title: '提出データの削除' }) : Promise.resolve(confirm(message)));
        if (!ok) return;

        if (typeof shiftSubmitSupabase === 'undefined' || !shiftSubmitSupabase) {
            console.error('Supabaseクライアントが利用できません');
            showNotification('データの削除中にエラーが発生しました。', 'error');
            return;
        }

        showLoading();

        const { error } = await shiftSubmitSupabase
            .from('shift_submit')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Delete single submitted shift error:', error);
            showNotification('データの削除中にエラーが発生しました。', 'error');
            return;
        }

        showNotification('提出データを削除しました。', 'success');

        // モーダルが開いていれば閉じる
        closeShiftDetailModal();
        // 一覧を更新
        loadSubmittedShiftData();
        // 自分の提出状況も更新
        checkSubmitStatus();
    } catch (err) {
        console.error('Unexpected error in deleteSubmittedShift:', err);
        showNotification('削除処理中に予期せぬエラーが発生しました。', 'error');
    } finally {
        hideLoading();
    }
}

// 提出シフトの統計情報を更新する関数
function updateSubmittedStats(submitData) {
    console.log('[DEBUG] updateSubmittedStats() called with data:', submitData);
    
    const submittedStats = document.getElementById('submitted-stats');
    if (!submittedStats) {
        console.log('[DEBUG] submitted-stats element not found');
        return;
    }
    
    console.log('[DEBUG] submitted-stats element found:', submittedStats);

    const totalSubmissions = submitData.length;
    const totalWorkDays = submitData.reduce((total, submit) => {
        if (submit.shift_data && submit.shift_data.length > 0) {
            return total + submit.shift_data.filter(data => 
                data.store && data.store !== '休み' && data.store !== '欠勤'
            ).length;
        }
        return total;
    }, 0);

    submittedStats.innerHTML = `
        <div class="stats-horizontal">
            <div class="stat-card">
                <i class="fas fa-clipboard-check"></i>
                <h3>提出件数</h3>
                <p>${totalSubmissions}件</p>
            </div>
            <div class="stat-card">
                <i class="fas fa-calendar-day"></i>
                <h3>総出勤日数</h3>
                <p>${totalWorkDays}日</p>
            </div>
        </div>
    `;
}

// 提出シフトの詳細を表示する関数
async function viewSubmittedShiftDetail(submitId) {
    console.log('Viewing submitted shift detail for ID:', submitId);
    
    try {
        showLoading();
        
        // Supabaseから詳細データを取得
        if (typeof supabase === 'undefined' || !supabase) {
            console.error('Supabaseクライアントが利用できません');
            showNotification('詳細データの読み込み中にエラーが発生しました。', 'error');
            return;
        }
        
        const { data, error } = await shiftSubmitSupabase
            .from('shift_submit')
            .select('*')
            .eq('id', submitId)
            .single();

        if (error) {
            console.error('Load shift detail error:', error);
            showNotification('詳細データの読み込み中にエラーが発生しました。', 'error');
            return;
        }

        if (!data) {
            showNotification('指定されたシフトデータが見つかりません。', 'error');
            return;
        }

        // モーダルで詳細を表示
        showShiftDetailModal(data);

    } catch (error) {
        console.error('Load shift detail error:', error);
        showNotification('詳細データの読み込み中にエラーが発生しました。', 'error');
    } finally {
        hideLoading();
    }
}

// シフト詳細モーダルを表示する関数
function showShiftDetailModal(shiftData) {
    // 既存のモーダルを削除
    const existingModal = document.getElementById('shift-detail-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // モーダルを作成
    const modal = document.createElement('div');
    modal.id = 'shift-detail-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        animation: fadeIn 0.3s ease;
    `;

    // シフトデータの詳細を生成
    let shiftDetailsHTML = '';
    if (shiftData.shift_data && shiftData.shift_data.length > 0) {
        shiftDetailsHTML = `
            <div class="shift-details-table">
                <table>
                    <thead>
                        <tr>
                            <th>日付</th>
                            <th>出勤時間</th>
                            <th>退勤時間</th>
                            <th>店舗</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        shiftData.shift_data.forEach(shift => {
            const date = new Date(shift.date);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()}(${['日', '月', '火', '水', '木', '金', '土'][date.getDay()]})`;
            
            shiftDetailsHTML += `
                <tr>
                    <td>${dateStr}</td>
                    <td>${shift.check_in_time || '-'}</td>
                    <td>${shift.check_out_time || '-'}</td>
                    <td>
                        <span class="store-badge store-${getStoreClass(shift.store)}">
                            ${shift.store || '指定なし'}
                        </span>
                    </td>
                </tr>
            `;
        });

        shiftDetailsHTML += `
                    </tbody>
                </table>
            </div>
        `;
    }

    // 統計情報を計算
    const workDays = shiftData.shift_data ? shiftData.shift_data.filter(data => 
        data.store && data.store !== '休み' && data.store !== '欠勤'
    ).length : 0;
    
    const restDays = shiftData.shift_data ? shiftData.shift_data.filter(data => 
        data.store === '休み'
    ).length : 0;
    
    const absentDays = shiftData.shift_data ? shiftData.shift_data.filter(data => 
        data.store === '欠勤'
    ).length : 0;

    modal.innerHTML = `
        <div class="modal-content" style="
            background: white;
            border-radius: 10px;
            padding: 30px;
            max-width: 800px;
            max-height: 80vh;
            overflow-y: auto;
            position: relative;
            animation: slideIn 0.3s ease;
        ">
            <button class="modal-close" onclick="closeShiftDetailModal()" style="
                position: absolute;
                top: 15px;
                right: 20px;
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
            ">&times;</button>
            
            <h2 style="margin-bottom: 20px; color: #333;">
                <i class="fas fa-calendar-alt"></i>
                シフト詳細
            </h2>
            
            <div class="shift-info" style="margin-bottom: 30px;">
                <div class="info-grid" style="
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-bottom: 20px;
                ">
                    <div class="info-item">
                        <label style="font-weight: 500; color: #666;">名前</label>
                        <p style="margin: 5px 0; font-size: 16px;">${shiftData.name}</p>
                    </div>
                    <div class="info-item">
                        <label style="font-weight: 500; color: #666;">年月</label>
                        <p style="margin: 5px 0; font-size: 16px;">${shiftData.year}年${shiftData.month}月</p>
                    </div>
                    <div class="info-item">
                        <label style="font-weight: 500; color: #666;">ステータス</label>
                        <p style="margin: 5px 0; font-size: 16px;">
                            <span class="status-submitted">提出済み</span>
                        </p>
                    </div>
                </div>
                
                <div class="shift-summary" style="
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    margin-top: 20px;
                ">
                    <h3 style="margin-bottom: 15px; color: #333;">シフト概要</h3>
                    <div class="summary-grid" style="
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                        gap: 15px;
                    ">
                        <div class="summary-item">
                            <span style="font-weight: 500; color: #28a745;">出勤日数</span>
                            <p style="margin: 5px 0; font-size: 18px; font-weight: 600;">${workDays}日</p>
                        </div>
                        <div class="summary-item">
                            <span style="font-weight: 500; color: #ffc107;">休み</span>
                            <p style="margin: 5px 0; font-size: 18px; font-weight: 600;">${restDays}日</p>
                        </div>
                        <div class="summary-item">
                            <span style="font-weight: 500; color: #dc3545;">欠勤</span>
                            <p style="margin: 5px 0; font-size: 18px; font-weight: 600;">${absentDays}日</p>
                        </div>
                        <div class="summary-item">
                            <span style="font-weight: 500; color: #6c757d;">総日数</span>
                            <p style="margin: 5px 0; font-size: 18px; font-weight: 600;">${shiftData.shift_data ? shiftData.shift_data.length : 0}日</p>
                        </div>
                    </div>
                </div>
            </div>
            
            ${shiftDetailsHTML}

            <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:20px;">
                <button class="btn btn-secondary" onclick="deleteSubmittedShift('${shiftData.id}', '${shiftData.name}', ${shiftData.year}, ${shiftData.month})">
                    <i class="fas fa-trash"></i> この提出を削除
                </button>
            </div>
        </div>
    `;

    // モーダルを表示
    document.body.appendChild(modal);

    // モーダル外クリックで閉じる
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeShiftDetailModal();
        }
    });
}

// モーダルを閉じる関数
function closeShiftDetailModal() {
    const modal = document.getElementById('shift-detail-modal');
    if (modal) {
        modal.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

// 店舗クラスを取得する関数
function getStoreClass(store) {
    if (store === '所沢店') return 'tokorozawa';
    if (store === '入間店') return 'iruma';
    if (store === '休み') return 'rest';
    if (store === '欠勤') return 'absent';
    return 'default';
}

// 提出シフトのフィルターを適用する関数（リアルタイム反映のため削除）
// function applySubmittedFilters() {
//     loadSubmittedShiftData();
// }

// 提出シフトデータをエクスポートする関数
async function exportSubmittedData() {
    const nameSelect = document.getElementById('submitted-name');
    const yearSelect = document.getElementById('submitted-year');
    const monthSelect = document.getElementById('submitted-month');

    const name = nameSelect ? nameSelect.value : '';
    const year = yearSelect ? yearSelect.value : '';
    const month = monthSelect ? monthSelect.value : '';

    try {
        showLoading();

        // フィルター条件に基づいてデータを取得
        if (!checkSupabaseClient()) {
            console.error('Supabaseクライアントが利用できません');
            showNotification('データのエクスポート中にエラーが発生しました。', 'error');
            return;
        }
        
        let query = shiftSubmitSupabase.from('shift_submit').select('*');
        
        if (name && name !== '') {
            // 正規化済み名前で検索
            const normalizedName = normalizeName(name);
            console.log('[DEBUG] Export filtering by normalized name:', normalizedName);
            query = query.eq('normalized_name', normalizedName);
        }
        if (year && year !== '') {
            query = query.eq('year', parseInt(year));
        }
        if (month && month !== '') {
            query = query.eq('month', parseInt(month));
        }

        // ソートを適用（年降順、月降順、名前昇順）
        query = query.order('year', { ascending: false })
                    .order('month', { ascending: false })
                    .order('name', { ascending: true });

        const { data, error } = await query;

        if (error) {
            console.error('Export submitted data error:', error);
            showNotification('データのエクスポート中にエラーが発生しました。', 'error');
        } else {
            // エクセルエクスポートを試行
            try {
                exportToExcel(data, 'submitted_shifts');
                showNotification('エクセルファイルが正常にエクスポートされました。', 'success');
            } catch (excelError) {
                console.error('Excel export error:', excelError);
                // エクセルエクスポートに失敗した場合はCSVを試行
                try {
                    exportToCSV(data, 'submitted_shifts');
                    showNotification('CSVファイルが正常にエクスポートされました。', 'success');
                } catch (csvError) {
                    console.error('CSV export error:', csvError);
                    showNotification('エクスポートに失敗しました。', 'error');
                }
            }
        }

    } catch (error) {
        console.error('Export submitted data error:', error);
        showNotification('データのエクスポート中にエラーが発生しました。', 'error');
    } finally {
        hideLoading();
    }
}

// エクセルエクスポート機能（元のフォーマット保持）
function exportToExcel(data, filename) {
    if (!data || data.length === 0) {
        showNotification('エクスポートするデータがありません。', 'error');
        return;
    }

    try {
        // XLSXライブラリの確認
        if (typeof XLSX === 'undefined') {
            throw new Error('XLSXライブラリが読み込まれていません。');
        }

        // book_new関数の確認
        if (typeof XLSX.utils.book_new !== 'function') {
            throw new Error('XLSXライブラリのbook_new関数が利用できません。');
        }

        // ワークブックを作成
        const wb = XLSX.utils.book_new();
        
        // データを整理してシート用のデータを作成（元のフォーマット）
        const sheetData = createShiftSheetData(data);
        
        // ワークシートを作成
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        
        // セルのスタイルを適用
        applyShiftSheetStyles(ws, sheetData);
        
        // 列幅を設定
        ws['!cols'] = [
            { width: 15 }, // 名前列
            ...Array(sheetData[0].length - 1).fill({ width: 10 }) // すべての時間列（出勤時間と退勤時間用）
        ];
        
        // ワークブックにシートを追加
        XLSX.utils.book_append_sheet(wb, ws, 'シフトデータ');
        
        // ファイルをダウンロード
        const fileName = `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        console.log('Excel file exported successfully');
        
    } catch (error) {
        console.error('Excel export error:', error);
        throw error; // エラーを再スローして上位で処理
    }
}

// シフトシートデータを作成する関数
// フォーマット仕様：
// - 時間データがある場合: 出勤時間と退勤時間を2つの別々のセルに表示
// - 時間データがない場合（休み、欠勤など）: 1列目に店舗名/ステータス、2列目は空だが同じスタイル
// - データがない場合（時間入力なし）: 両列とも灰色（CCCCCC）で空
function createShiftSheetData(data) {
    // すべての日付を収集
    const allDates = new Set();
    const nameDataMap = new Map();
    
    // データを処理して日付と名前を収集
    data.forEach(submit => {
        if (submit.shift_data && submit.shift_data.length > 0) {
            submit.shift_data.forEach(shift => {
                if (shift.date) {
                    allDates.add(shift.date);
                }
            });
            
            // 名前ごとのデータを整理
            if (!nameDataMap.has(submit.name)) {
                nameDataMap.set(submit.name, new Map());
            }
            
            submit.shift_data.forEach(shift => {
                if (shift.date) {
                    nameDataMap.get(submit.name).set(shift.date, shift);
                }
            });
        }
    });
    
    // 日付をソート
    const sortedDates = Array.from(allDates).sort();
    
    // ヘッダー行を作成（名前 + 日付）
    const header = ['名前'];
    sortedDates.forEach((date, index) => {
        const d = new Date(date);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
        // すべての日付で2列分のスペースを確保（出勤時間と退勤時間用）
        header.push(dateStr, ''); // 2列分
    });
    
    // データ行を作成
    const rows = [header];
    
    // 名前をソート
    const sortedNames = Array.from(nameDataMap.keys()).sort();
    
    sortedNames.forEach(name => {
        const row = [name];
        const nameData = nameDataMap.get(name);
        
        sortedDates.forEach((date, index) => {
            const shift = nameData.get(date);
            if (shift) {
                // 時間データがある場合（出勤時間と退勤時間が両方入力されている）
                if (shift.check_in_time && shift.check_out_time) {
                    // 出勤時間と退勤時間を2つの別々のセルに表示
                    row.push({
                        v: shift.check_in_time,
                        t: 's',
                        s: getCellStyle(shift.store)
                    });
                    row.push({
                        v: shift.check_out_time,
                        t: 's',
                        s: getCellStyle(shift.store)
                    });
                } else {
                    // 時間データがない場合（休み、欠勤、時間入力なしなど）
                    // 時間がない場合は空セルにする（指定なしなども表示しない）
                    row.push({
                        v: '',
                        t: 's',
                        s: getCellStyle(shift.store)
                    });
                    row.push({
                        v: '',
                        t: 's',
                        s: getCellStyle(shift.store)
                    }); // 2列目も同じスタイルを適用
                }
            } else {
                // データがない場合（時間が入力されていない日）
                const grayStyle = {
                    alignment: {
                        horizontal: 'center',
                        vertical: 'center'
                    },
                    border: {
                        top: { style: 'thin' },
                        bottom: { style: 'thin' },
                        left: { style: 'thin' },
                        right: { style: 'thin' }
                    },
                    fill: { fgColor: { rgb: 'CCCCCC' } } // 灰色（CCCCCC）
                };
                row.push({
                    v: '',
                    t: 's',
                    s: grayStyle
                });
                row.push({
                    v: '',
                    t: 's',
                    s: grayStyle
                }); // 2列目も同じ灰色スタイル
            }
        });
        
        rows.push(row);
    });
    
    return rows;
}

// セルのスタイルを取得する関数
// 色分け仕様：
// - 所沢店: ピンク色（FFB6C1）
// - 入間店: 白色（FFFFFF）
// - 休み: 薄いグレー（F0F0F0）
// - 欠勤: 赤色（FFCCCC）
// - その他（指定なしなど）: 白色（FFFFFF）
function getCellStyle(store) {
    const baseStyle = {
        alignment: {
            horizontal: 'center',
            vertical: 'center'
        },
        border: {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
        }
    };
    
    // 所沢店の場合はピンク色（FFB6C1）
    if (store === '所沢店') {
        return {
            ...baseStyle,
            fill: {
                fgColor: { rgb: 'FFB6C1' } // ピンク色（FFB6C1）
            }
        };
    }
    
    // 入間店の場合は白色
    if (store === '入間店') {
        return {
            ...baseStyle,
            fill: {
                fgColor: { rgb: 'FFFFFF' } // 白色
            }
        };
    }
    
    // 休みの場合は薄いグレー
    if (store === '休み') {
        return {
            ...baseStyle,
            fill: {
                fgColor: { rgb: 'F0F0F0' } // 薄いグレー
            }
        };
    }
    
    // 欠勤の場合は赤色
    if (store === '欠勤') {
        return {
            ...baseStyle,
            fill: {
                fgColor: { rgb: 'FFCCCC' } // 赤色
            }
        };
    }
    
    // その他の場合（指定なしなど）は白色
    return {
        ...baseStyle,
        fill: {
            fgColor: { rgb: 'FFFFFF' } // 白色
        }
    };
}

// シートのスタイルを適用する関数
function applyShiftSheetStyles(ws, sheetData) {
    // ヘッダー行のスタイル
    const headerStyle = {
        font: {
            bold: true,
            color: { rgb: 'FFFFFF' }
        },
        fill: {
            fgColor: { rgb: '4A90E2' }
        },
        alignment: {
            horizontal: 'center',
            vertical: 'center'
        },
        border: {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
        }
    };
    
    // ヘッダー行にスタイルを適用
    for (let col = 0; col < sheetData[0].length; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!ws[cellRef]) {
            ws[cellRef] = { v: '', t: 's' };
        }
        ws[cellRef].s = headerStyle;
    }
    
    // セルの結合を設定
    if (!ws['!merges']) {
        ws['!merges'] = [];
    }
    
    // 各日付のヘッダーを2列結合（出勤時間と退勤時間用）
    const dateCount = (sheetData[0].length - 1) / 2; // 名前列を除いた列数を2で割る
    for (let i = 0; i < dateCount; i++) {
        const startCol = 1 + (i * 2); // 名前列の次から2列ずつ
        ws['!merges'].push({
            s: { r: 0, c: startCol },
            e: { r: 0, c: startCol + 1 }
        });
    }
    
    // データ行のスタイルを適用
    for (let row = 1; row < sheetData.length; row++) {
        for (let col = 0; col < sheetData[row].length; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
            if (ws[cellRef] && ws[cellRef].s) {
                // 既にスタイルが設定されている場合はそのまま
                continue;
            }
            
            // 名前列のスタイル
            if (col === 0) {
                if (!ws[cellRef]) {
                    ws[cellRef] = { v: '', t: 's' };
                }
                ws[cellRef].s = {
                    font: { bold: true },
                    alignment: {
                        horizontal: 'left',
                        vertical: 'center'
                    },
                    border: {
                        top: { style: 'thin' },
                        bottom: { style: 'thin' },
                        left: { style: 'thin' },
                        right: { style: 'thin' }
                    },
                    fill: {
                        fgColor: { rgb: 'F8F9FA' }
                    }
                };
            }
        }
    }
}

// 提出シフトデータを削除する関数
async function deleteSubmittedData() {
    const ok2 = await (window.confirmAsync ? window.confirmAsync('提出されたシフトデータをすべて削除しますか？この操作は取り消せません。') : Promise.resolve(confirm('提出されたシフトデータをすべて削除しますか？この操作は取り消せません。')));
    if (!ok2) {
        return;
    }

    try {
        showLoading();

        if (typeof shiftSubmitSupabase === 'undefined' || !shiftSubmitSupabase) {
            console.error('Supabaseクライアントが利用できません');
            showNotification('データの削除中にエラーが発生しました。', 'error');
            return;
        }
        
        const { error } = await shiftSubmitSupabase
            .from('shift_submit')
            .delete()
            .neq('id', 0); // すべてのデータを削除

        if (error) {
            console.error('Delete submitted data error:', error);
            showNotification('データの削除中にエラーが発生しました。', 'error');
        } else {
            showNotification('データが正常に削除されました。', 'success');
            loadSubmittedShiftData(); // データを再読み込み
        }

    } catch (error) {
        console.error('Delete submitted data error:', error);
        showNotification('データの削除中にエラーが発生しました。', 'error');
    } finally {
        hideLoading();
    }
}

// CSVエクスポート機能
function exportToCSV(data, filename) {
    if (!data || data.length === 0) {
        showNotification('エクスポートするデータがありません。', 'error');
        return;
    }

    // CSVヘッダー
    let csv = '名前,年,月,ステータス,シフトデータ\n';

    // データ行を追加
    data.forEach(item => {
        const shiftData = item.shift_data ? JSON.stringify(item.shift_data) : '';
        csv += `${item.name},${item.year},${item.month},${item.status},"${shiftData}"\n`;
    });

    // CSVファイルをダウンロード
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 名前正規化のユーティリティ関数
function normalizeName(name) {
    if (!name) return '';
    // スペースを除去して小文字に変換
    return name.replace(/\s+/g, '').toLowerCase();
}

// 名前検索のユーティリティ関数
function searchByName(query, name) {
    const normalizedQuery = normalizeName(query);
    const normalizedName = normalizeName(name);
    return normalizedName.includes(normalizedQuery);
}
