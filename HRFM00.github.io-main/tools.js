// ツール機能専用JavaScript
// 店舗管理システム - ツールページ

// ツールタブ切り替え関数
function switchToolsTab(tabName) {
    // すべてのタブを非アクティブにする
    const tabs = document.querySelectorAll('.tools-tab');
    tabs.forEach(tab => {
        tab.classList.remove('active');
    });
    
    // すべてのタブコンテンツを非表示にする
    const contents = document.querySelectorAll('.tools-tab-content');
    contents.forEach(content => {
        content.classList.remove('active');
    });
    
    // クリックされたタブをアクティブにする
    const activeTab = document.querySelector(`.tools-tab[onclick*="${tabName}"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    // 対応するコンテンツを表示する
    const targetContent = document.getElementById(tabName + '-tab');
    if (targetContent) {
        targetContent.classList.add('active');
    }
    
    // 締め計算タブが選択された場合、祝日設定を復元
    if (tabName === 'closing') {
        restoreHolidaySetting();
    }

    // 釣り銭計算タブ選択時は初期計算
    if (tabName === 'cashcalc') {
        initializeCashCalculator();
        calculateCashTotals();
    }
}

// =============================================
// 配送料金計算ツール
// =============================================

// 佐川急便の正確な料金表（2024年版）
const sagawaRates = {
    // サイズ区分（3辺合計cm、重量kg）
    sizeCategories: {
        '60': { maxSize: 60, maxWeight: 2 },
        '80': { maxSize: 80, maxWeight: 5 },
        '100': { maxSize: 100, maxWeight: 10 },
        '140': { maxSize: 140, maxWeight: 20 },
        '160': { maxSize: 160, maxWeight: 30 },
        '170': { maxSize: 170, maxWeight: 50 },
        '180': { maxSize: 180, maxWeight: 50 },
        '200': { maxSize: 200, maxWeight: 50 },
        '220': { maxSize: 220, maxWeight: 50 },
        '240': { maxSize: 240, maxWeight: 50 },
        '260': { maxSize: 260, maxWeight: 50 }
    },
    
    // 地域別料金表（関東発の場合）
    regionRates: {
        'hokkaido': { '60': 1440, '80': 1730, '100': 2000, '140': 2710, '160': 2950, '170': 4240, '180': 4780, '200': 5890, '220': 7480, '240': 9360, '260': 11720 },
        'tohoku': { '60': 1040, '80': 1340, '100': 1630, '140': 2310, '160': 2570, '170': 3660, '180': 4010, '200': 4890, '220': 5770, '240': 7600, '260': 9420 },
        'south_tohoku': { '60': 910, '80': 1220, '100': 1520, '140': 2180, '160': 2440, '170': 3420, '180': 3770, '200': 4600, '220': 5420, '240': 7070, '260': 8710 },
        'kanto': { '60': 910, '80': 1220, '100': 1520, '140': 2180, '160': 2440, '170': 2600, '180': 2890, '200': 3480, '220': 4070, '240': 5240, '260': 6420 },
        'shinetsu': { '60': 910, '80': 1220, '100': 1520, '140': 2180, '160': 2440, '170': 3360, '180': 3660, '200': 4480, '220': 5240, '240': 6830, '260': 8420 },
        'tokai': { '60': 910, '80': 1220, '100': 1520, '140': 2180, '160': 2440, '170': 3360, '180': 3660, '200': 4480, '220': 5240, '240': 6830, '260': 8420 },
        'hokuriku': { '60': 910, '80': 1220, '100': 1520, '140': 2180, '160': 2440, '170': 3360, '180': 3660, '200': 4480, '220': 5240, '240': 6830, '260': 8420 },
        'kansai': { '60': 1040, '80': 1340, '100': 1630, '140': 2310, '160': 2570, '170': 3360, '180': 3660, '200': 4480, '220': 5240, '240': 6830, '260': 8420 },
        'chugoku': { '60': 1180, '80': 1470, '100': 1740, '140': 2440, '160': 2700, '170': 3660, '180': 4010, '200': 4890, '220': 5830, '240': 7600, '260': 9420 },
        'shikoku': { '60': 1300, '80': 1590, '100': 1880, '140': 2570, '160': 2830, '170': 3660, '180': 4010, '200': 4890, '220': 5830, '240': 7600, '260': 9420 },
        'kyushu': { '60': 1440, '80': 1730, '100': 2000, '140': 2710, '160': 2950, '170': 3890, '180': 4300, '200': 5360, '220': 6360, '240': 8360, '260': 10360 },
        'south_kyushu': { '60': 1440, '80': 1730, '100': 2000, '140': 2710, '160': 2950, '170': 4240, '180': 4730, '200': 5890, '220': 7010, '240': 9300, '260': 11600 },
        'okinawa': { '60': 1914, '80': 3520, '100': 4686, '140': 7579, '160': 10560, '170': 15400, '180': 17820, '200': 22660, '220': 27500, '240': 37180, '260': 46860 }
    },
    
    // 追加料金
    additionalFees: {
        'express': 300,      // 速達
        'cool': 500,         // クール便
        'timeDesignation': 220,  // 時間指定
        'morning': 220,      // 午前中指定
        'cashOnDelivery': 330,   // 代引き手数料
        'insurance100k': 320,    // 保険料（10万円まで）
        'insurance300k': 630     // 保険料（30万円まで）
    }
};

// 地域マッピング
const prefectureMapping = {
    'hokkaido': 'hokkaido',
    'tohoku': 'tohoku',
    'kanto': 'kanto',
    'chubu': 'tokai',
    'kansai': 'kansai',
    'chugoku': 'chugoku',
    'shikoku': 'shikoku',
    'kyushu': 'kyushu',
    'okinawa': 'okinawa'
};

// 配送料金計算関数
function calculateShipping() {
    const length = parseFloat(document.getElementById('package-length').value) || 0;
    const width = parseFloat(document.getElementById('package-width').value) || 0;
    const height = parseFloat(document.getElementById('package-height').value) || 0;
    const weight = parseFloat(document.getElementById('package-weight').value) || 0;
    const prefecture = document.getElementById('delivery-prefecture').value;
    const deliveryType = document.getElementById('delivery-type').value;

    // バリデーション
    if (length === 0 || width === 0 || height === 0 || weight === 0 || !prefecture) {
        showMessage('すべての必須項目を入力してください。', 'error');
        return;
    }

    try {
        // 3辺合計を計算
        const totalSize = length + width + height;
        
        // サイズ区分を判定
        let sizeCategory = null;
        for (const [size, limits] of Object.entries(sagawaRates.sizeCategories)) {
            if (totalSize <= limits.maxSize && weight <= limits.maxWeight) {
                sizeCategory = size;
                break;
            }
        }

        if (!sizeCategory) {
            showMessage('荷物のサイズまたは重量が規定を超えています。', 'error');
            return;
        }

        // 地域を正規化
        const region = prefectureMapping[prefecture];
        if (!region || !sagawaRates.regionRates[region]) {
            showMessage('選択された地域の料金情報が見つかりません。', 'error');
            return;
        }

        // 基本料金を取得
        let basePrice = sagawaRates.regionRates[region][sizeCategory];
        if (!basePrice) {
            showMessage('選択されたサイズの料金情報が見つかりません。', 'error');
            return;
        }

        // 追加料金を計算
        if (deliveryType === 'express') {
            basePrice += sagawaRates.additionalFees.express;
        } else if (deliveryType === 'cool') {
            basePrice += sagawaRates.additionalFees.cool;
        }

        // 結果を表示
        displayShippingResult(sizeCategory, totalSize, weight, basePrice, deliveryType);

    } catch (error) {
        console.error('配送料金計算エラー:', error);
        showMessage('計算中にエラーが発生しました。', 'error');
    }
}

// 配送料金計算結果表示
function displayShippingResult(sizeCategory, totalSize, weight, price, deliveryType) {
    const sizeInfo = `${sizeCategory}サイズ（${totalSize}cm, ${weight}kg）`;
    let deliveryInfo = '';
    
    if (deliveryType === 'express') {
        deliveryInfo = ' （速達）';
    } else if (deliveryType === 'cool') {
        deliveryInfo = ' （クール便）';
    }

    document.getElementById('calculated-size').textContent = sizeInfo;
    document.getElementById('calculated-price').textContent = '¥' + price.toLocaleString() + deliveryInfo;
    document.getElementById('shipping-result').style.display = 'block';
    
    // スクロールして結果を表示
    document.getElementById('shipping-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// 配送料金フォームクリア
function clearShippingForm() {
    document.getElementById('package-length').value = '';
    document.getElementById('package-width').value = '';
    document.getElementById('package-height').value = '';
    document.getElementById('package-weight').value = '';
    document.getElementById('delivery-prefecture').value = '';
    document.getElementById('delivery-type').value = 'standard';
    document.getElementById('shipping-result').style.display = 'none';
}

// =============================================
// 締め計算ツール
// =============================================

// 店舗設定（レジ数の定義）
const storeConfig = {
    'iruma': { registers: 2, name: '入間店' },
    'tokorozawa': { registers: 1, name: '所沢店' }
};

// 店舗選択時の処理
function updateRegisterFields() {
    const storeSelect = document.getElementById('store-select');
    const register2Section = document.getElementById('register2-section');
    const selectedStore = storeSelect.value;
    
    if (selectedStore && storeConfig[selectedStore]) {
        const config = storeConfig[selectedStore];
        if (config.registers === 2) {
            register2Section.style.display = 'block';
        } else {
            register2Section.style.display = 'none';
            // レジ2の入力値をクリア
            document.getElementById('register2-cash').value = '0';
            document.getElementById('register2-square').value = '0';
            document.getElementById('register2-gift').value = '0';
            const r2Items = document.getElementById('register2-items');
            const r2Customers = document.getElementById('register2-customers');
            if (r2Items) r2Items.value = '0';
            if (r2Customers) r2Customers.value = '0';
        }
    } else {
        register2Section.style.display = 'none';
    }
}

// 今月予算累計を取得する関数（指定した日付の月と同じ月のすべての日の総売り上げを取得し、合計する）
async function getMonthlyTotalToDate(store, targetDate) {
    try {
        if (!window.supabaseClient) {
            console.warn('Supabaseクライアントが利用できません');
            return 0;
        }

        // 指定日付から年月を取得
        const targetDateObj = new Date(targetDate + 'T00:00:00');
        const year = targetDateObj.getFullYear();
        const month = targetDateObj.getMonth() + 1;

        // 指定月の初日と最終日を取得
        const firstDayOfMonth = new Date(year, month - 1, 1);
        const lastDayOfMonth = new Date(year, month, 0);
        
        const startDate = `${firstDayOfMonth.getFullYear()}-${String(firstDayOfMonth.getMonth()+1).padStart(2,'0')}-${String(firstDayOfMonth.getDate()).padStart(2,'0')}`;
        const endDate = `${lastDayOfMonth.getFullYear()}-${String(lastDayOfMonth.getMonth()+1).padStart(2,'0')}-${String(lastDayOfMonth.getDate()).padStart(2,'0')}`;

        // 指定月のすべての締め計算結果を取得
        const { data, error } = await window.supabaseClient
            .from('closing_results')
            .select('grand_total, calculation_date')
            .eq('store', store)
            .gte('calculation_date', startDate)
            .lte('calculation_date', endDate)
            .order('calculation_date', { ascending: true });

        if (error) {
            console.log('月次データ取得エラー:', error.message);
            return 0;
        }

        // データがない場合は0を返す
        if (!data || data.length === 0) {
            console.log('指定月のデータが見つかりません。');
            return 0;
        }

        // 指定日付より前の日の総売り上げを合計
        const targetDateString = targetDate;
        let monthlyTotal = 0;

        data.forEach(item => {
            if (item.calculation_date < targetDateString) {
                monthlyTotal += item.grand_total || 0;
            }
        });

        console.log(`指定月（${year}年${month}月）の累計売上: ¥${monthlyTotal.toLocaleString()}`);
        return monthlyTotal;

    } catch (error) {
        console.error('今月予算累計取得エラー:', error);
        return 0;
    }
}

// 締め計算関数
async function calculateClosing() {
    try {
        // データ取得
        const selectedStore = document.getElementById('store-select')?.value;
        const staffName = document.getElementById('staff-name')?.value?.trim();
        const closingDate = document.getElementById('closing-date')?.value;
        const register1Cash = parseFloat(document.getElementById('register1-cash')?.value) || 0;
        const register1Square = parseFloat(document.getElementById('register1-square')?.value) || 0;
        const register1Gift = parseFloat(document.getElementById('register1-gift')?.value) || 0;
        const register2Cash = parseFloat(document.getElementById('register2-cash')?.value) || 0;
        const register2Square = parseFloat(document.getElementById('register2-square')?.value) || 0;
        const register2Gift = parseFloat(document.getElementById('register2-gift')?.value) || 0;
        // レジ別の販売点数・客数を読み取り、合算
        const register1Items = parseFloat(document.getElementById('register1-items')?.value) || 0;
        const register1Customers = parseFloat(document.getElementById('register1-customers')?.value) || 0;
        const register2Items = parseFloat(document.getElementById('register2-items')?.value) || 0;
        const register2Customers = parseFloat(document.getElementById('register2-customers')?.value) || 0;
        const totalItems = register1Items + register2Items;
        const totalCustomers = register1Customers + register2Customers;
        const isHolidayToday = document.getElementById('is-holiday-today')?.checked || false;

        // 基本バリデーション
        if (!selectedStore) {
            showMessage('店舗を選択してください。', 'error');
            return;
        }

        if (!staffName) {
            showMessage('担当者名を入力してください。', 'error');
            return;
        }

        if (!closingDate) {
            showMessage('計算対象日を選択してください。', 'error');
            return;
        }

        if (register1Cash === 0 && register1Square === 0 && register1Gift === 0 && 
            register2Cash === 0 && register2Square === 0 && register2Gift === 0) {
            showMessage('最低限、いずれかの売上を入力してください。', 'error');
            return;
        }

        // 数値バリデーション
        if (isNaN(register1Cash) || isNaN(register1Square) || isNaN(register1Gift) ||
            isNaN(register2Cash) || isNaN(register2Square) || isNaN(register2Gift) ||
            isNaN(register1Items) || isNaN(register1Customers) || isNaN(register2Items) || isNaN(register2Customers)) {
            showMessage('数値の入力に問題があります。正しい数値を入力してください。', 'error');
            return;
        }

        // 前日のデータ存在チェック（計算前の警告）
        if (window.supabaseClient) {
            try {
                const dateObj = new Date(closingDate + 'T00:00:00');
                const prev = new Date(dateObj);
                prev.setDate(prev.getDate() - 1);
                const y = prev.getFullYear();
                const m = String(prev.getMonth() + 1).padStart(2, '0');
                const d = String(prev.getDate()).padStart(2, '0');
                const prevStr = `${y}-${m}-${d}`;

                const { data: prevData } = await window.supabaseClient
                    .from('closing_results')
                    .select('id')
                    .eq('store', selectedStore)
                    .eq('calculation_date', prevStr)
                    .maybeSingle();

                if (!prevData) {
                    const proceed = await (window.confirmAsync
                        ? window.confirmAsync('前日のデータが見つかりません。続行しますか？')
                        : Promise.resolve(confirm('前日のデータが見つかりません。続行しますか？')));
                    if (!proceed) return; // ユーザーが中止を選択
                    showMessage('前日のデータが存在しません。注意して進めてください。', 'warning');
                }
            } catch (_) {
                // チェックに失敗しても処理は続行
            }
        }

        // 今月予算累計を取得（指定した日付の月と同じ月のすべての日の総売り上げを取得し、合計する）
        const monthlyTotalToDate = await getMonthlyTotalToDate(selectedStore, closingDate);
        
        // 計算実行
        const calculations = performClosingCalculations({
            selectedStore,
            staffName,
            closingDate,
            register1Cash,
            register1Square,
            register1Gift,
            register2Cash,
            register2Square,
            register2Gift,
            totalItems,
            totalCustomers,
            isHolidayToday,
            monthlyTotalToDate
        });

        // 祝日設定を保存（次回の計算時に使用）
        localStorage.setItem('lastHolidaySetting', isHolidayToday);

        // 結果表示
        displayClosingResult(calculations);
        // 詳細レポートを表示（非同期）
        await displayDetailedReport(calculations);
        
        // 締め計算結果をデータベースに保存
        await saveClosingResult(calculations);

    } catch (error) {
        console.error('締め計算エラー:', error);
        showMessage('計算中にエラーが発生しました。', 'error');
    }
}

// 前日累計を取得する関数（現在は使用されていません）
// 新しい計算方法では getMonthlyTotalToDate 関数を使用しています
/*
async function getPreviousDayTotal(store, targetDate) {
    try {
        if (!window.supabaseClient) {
            console.warn('Supabaseクライアントが利用できません');
            return 0;
        }

        // 指定日付の前日の日付を取得
        const targetDateObj = new Date(targetDate);
        const previousDay = new Date(targetDateObj);
        previousDay.setDate(previousDay.getDate() - 1);
        const previousDayString = previousDay.toISOString().split('T')[0];

        // 前日の締め計算結果を取得（maybeSingleを使用してデータがない場合も正常に処理）
        const { data, error } = await window.supabaseClient
            .from('closing_results')
            .select('grand_total')
            .eq('store', store)
            .eq('calculation_date', previousDayString)
            .maybeSingle();

        if (error) {
            console.log('前日のデータ取得エラー:', error.message);
            return 0;
        }

        // データがない場合は0を返す
        if (!data) {
            console.log('前日のデータが見つかりません。月の初めの場合は正常です。');
            return 0;
        }

        return data.grand_total || 0;
    } catch (error) {
        console.error('前日累計取得エラー:', error);
        return 0;
    }
}
*/

// 締め計算の実行
function performClosingCalculations(data) {
    const {
        selectedStore,
        staffName,
        closingDate,
        register1Cash,
        register1Square,
        register1Gift,
        register2Cash,
        register2Square,
        register2Gift,
        totalItems,
        totalCustomers,
        isHolidayToday,
        monthlyTotalToDate
    } = data;

    // レジ1の計算
    const register1Total = register1Cash + register1Square + register1Gift;
    
    // レジ2の計算（店舗設定に応じて）
    const config = storeConfig[selectedStore];
    let register2Total = 0;
    let hasRegister2 = false;
    
    if (config && config.registers === 2) {
        register2Total = register2Cash + register2Square + register2Gift;
        hasRegister2 = true;
    }

    // 総売上計算
    const grandTotal = register1Total + register2Total;

    // 統計計算
    const averagePerCustomer = totalCustomers > 0 ? grandTotal / totalCustomers : 0;
    const averagePerItem = totalItems > 0 ? grandTotal / totalItems : 0;

    // 今月予算累計を計算（指定した日付の月と同じ月のすべての日の総売り上げを取得し、合計した値に本日の総売り上げを足す）
    const monthlyTotal = monthlyTotalToDate + grandTotal;

    return {
        selectedStore,
        staffName,
        closingDate,
        register1Cash,
        register1Square,
        register1Gift,
        register1Total,
        register2Cash,
        register2Square,
        register2Gift,
        register2Total,
        hasRegister2,
        grandTotal,
        totalItems,
        totalCustomers,
        averagePerCustomer,
        averagePerItem,
        isHolidayToday,
        monthlyTotalToDate,
        monthlyTotal
    };
}

// 締め計算結果表示
function displayClosingResult(calculations) {
    const {
        selectedStore,
        closingDate,
        register1Cash,
        register1Square,
        register1Gift,
        register1Total,
        register2Cash,
        register2Square,
        register2Gift,
        register2Total,
        hasRegister2,
        grandTotal,
        totalItems,
        totalCustomers,
        averagePerCustomer,
        averagePerItem,
        isHolidayToday
    } = calculations;

    // 日付を表示形式に変換
    const dateObj = new Date(closingDate);
    const formattedDate = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
    document.getElementById('closing-date-display').textContent = formattedDate;

    // レジ1の結果を表示
    document.getElementById('register1-cash-total').textContent = '¥' + register1Cash.toLocaleString();
    document.getElementById('register1-square-total').textContent = '¥' + register1Square.toLocaleString();
    document.getElementById('register1-gift-total').textContent = '¥' + register1Gift.toLocaleString();
    document.getElementById('register1-total').textContent = '¥' + register1Total.toLocaleString();

    // レジ2の結果を表示（店舗設定に応じて）
    if (hasRegister2) {
        document.getElementById('register2-cash-total').textContent = '¥' + register2Cash.toLocaleString();
        document.getElementById('register2-square-total').textContent = '¥' + register2Square.toLocaleString();
        document.getElementById('register2-gift-total').textContent = '¥' + register2Gift.toLocaleString();
        document.getElementById('register2-total').textContent = '¥' + register2Total.toLocaleString();
        
        // レジ2の結果表示要素を表示
        document.getElementById('register2-cash-result').style.display = 'flex';
        document.getElementById('register2-square-result').style.display = 'flex';
        document.getElementById('register2-gift-result').style.display = 'flex';
        document.getElementById('register2-total-result').style.display = 'flex';
    } else {
        // レジ2の結果表示要素を非表示
        document.getElementById('register2-cash-result').style.display = 'none';
        document.getElementById('register2-square-result').style.display = 'none';
        document.getElementById('register2-gift-result').style.display = 'none';
        document.getElementById('register2-total-result').style.display = 'none';
    }

    // 総売上を表示
    document.getElementById('total-sales').textContent = '¥' + grandTotal.toLocaleString();
    
    // 統計情報を表示
    document.getElementById('total-items-display').textContent = totalItems.toLocaleString() + '点';
    document.getElementById('total-customers-display').textContent = totalCustomers.toLocaleString() + '人';
    document.getElementById('average-per-customer').textContent = '¥' + Math.round(averagePerCustomer).toLocaleString();
    document.getElementById('average-per-item').textContent = '¥' + Math.round(averagePerItem).toLocaleString();
    
    document.getElementById('closing-result').style.display = 'block';
    
    // 詳細レポートを表示
    displayDetailedReport(calculations);
    
    // スクロールして結果を表示
    document.getElementById('closing-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// 詳細レポート表示関数
async function displayDetailedReport(calculations) {
    const {
        selectedStore,
        staffName,
        closingDate,
        register1Cash,
        register1Square,
        register1Gift,
        register2Cash,
        register2Square,
        register2Gift,
        grandTotal,
        totalItems,
        totalCustomers,
        averagePerCustomer,
        isHolidayToday,
        monthlyTotalToDate,
        monthlyTotal
    } = calculations;

    // 指定された日付を使用
    const dateObj = new Date(closingDate + 'T00:00:00');
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    const dateString = `${year}年${month}月${day}日`;

    // 店舗名を取得
    const storeName = storeConfig[selectedStore] ? storeConfig[selectedStore].name : '未選択';

    // データベースから予算データを取得
    let monthlyBudget = 0;
    let dailyBudget = 0;
    let weeklyData = null;

    try {
        // Supabaseクライアントが利用可能かチェック
        if (window.supabaseClient) {
            // monthly_budgetsテーブルから今月の予算を取得
            const { data: monthlyData, error: monthlyError } = await window.supabaseClient
                .from('monthly_budgets')
                .select('*')
                .eq('store', selectedStore)
                .eq('year', year)
                .eq('month', month)
                .maybeSingle();

            if (monthlyError) {
                console.error('月次予算データ取得エラー:', monthlyError);
            } else if (monthlyData) {
                monthlyBudget = monthlyData.revenue_target || 0;
            }

            // weekly_budgetsテーブルから本日の予算を取得
            const dayOfWeek = dateObj.getDay(); // 0=日曜日, 1=月曜日, ... 6=土曜日
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const currentDay = dayNames[dayOfWeek];
            
            // 祝日かどうかを判定
            let isHoliday = isHolidayToday;
            
            // 曜日別予算データを取得
            let weeklyError = null;
            
            if (isHoliday) {
                // 祝日の場合はday_of_weekが'holiday'の予算を取得
                const { data, error } = await window.supabaseClient
                    .from('weekly_budgets')
                    .select('*')
                    .eq('store', selectedStore)
                    .eq('year', year)
                    .eq('month', month)
                    .eq('day_of_week', 'holiday')
                    .maybeSingle();
                weeklyData = data;
                weeklyError = error;
            } else {
                // 通常日の場合は該当曜日の予算を取得
                const { data, error } = await window.supabaseClient
                    .from('weekly_budgets')
                    .select('*')
                    .eq('store', selectedStore)
                    .eq('year', year)
                    .eq('month', month)
                    .eq('day_of_week', currentDay)
                .maybeSingle();
                weeklyData = data;
                weeklyError = error;
            }

            if (weeklyError) {
                console.error('週次予算データ取得エラー:', weeklyError);
            } else if (weeklyData) {
                // 予算データから売上目標を取得
                dailyBudget = weeklyData.revenue_target || 0;
            }
            
            // 祝日情報を保存（レポート表示用）
            if (isHoliday) {
                window.currentHolidayInfo = {
                    isHoliday: true,
                    holidayName: '祝日',
                    holidayBudget: dailyBudget
                };
            } else {
                window.currentHolidayInfo = null;
            }
        } else {
            console.warn('Supabaseクライアントが利用できません。デフォルト値を使用します。');
            // デフォルト値
            monthlyBudget = 1000000;
            // monthlyTotalは計算済みの値を使用
            dailyBudget = 35000;
        }
    } catch (error) {
        console.error('データベース取得エラー:', error);
        // エラーが発生した場合はデフォルト値を使用
        monthlyBudget = 1000000;
        // monthlyTotalは計算済みの値を使用
        dailyBudget = 35000;
    }

    // 計算
    const monthlyAchievement = monthlyBudget > 0 ? (monthlyTotal / monthlyBudget) * 100 : 0;
    const dailyAchievement = dailyBudget > 0 ? (grandTotal / dailyBudget) * 100 : 0;
    const totalCashSales = register1Cash + (register2Cash || 0);
    const totalCashlessSales = register1Square + (register2Square || 0);
    const totalGiftSales = register1Gift + (register2Gift || 0);

    // レポート表示
    document.getElementById('report-date').textContent = dateString;
    document.getElementById('report-staff').textContent = staffName || '未設定';
    document.getElementById('report-store').textContent = `39Outlet ${storeName}`;
    
    // 祝日情報を表示
    if (isHolidayToday) {
        const holidayName = weeklyData?.holiday_name || '祝日';
        document.getElementById('report-store').textContent = `39Outlet ${storeName} (${holidayName})`;
    }
    document.getElementById('report-monthly-budget').textContent = '¥' + monthlyBudget.toLocaleString();
    document.getElementById('report-monthly-total').textContent = '¥' + monthlyTotal.toLocaleString();
    document.getElementById('report-monthly-achievement').textContent = monthlyAchievement.toFixed(1) + '%';
    document.getElementById('report-daily-budget').textContent = '¥' + dailyBudget.toLocaleString();
    document.getElementById('report-daily-sales').textContent = '¥' + grandTotal.toLocaleString();
    document.getElementById('report-daily-achievement').textContent = dailyAchievement.toFixed(1) + '%';
    document.getElementById('report-cash-sales').textContent = '¥' + totalCashSales.toLocaleString();
    document.getElementById('report-cashless-sales').textContent = '¥' + totalCashlessSales.toLocaleString();
    document.getElementById('report-gift-sales').textContent = '¥' + totalGiftSales.toLocaleString();
    document.getElementById('report-items').textContent = totalItems.toLocaleString() + '点';
    document.getElementById('report-customers').textContent = totalCustomers.toLocaleString() + '人';
    document.getElementById('report-customer-average').textContent = '¥' + Math.round(averagePerCustomer).toLocaleString();

    // レポートを表示
    document.getElementById('closing-report').style.display = 'block';
}

// 締め計算結果をデータベースに保存する関数
async function saveClosingResult(calculations) {
    try {
        // Supabaseクライアントが利用可能かチェック
        if (!window.supabaseClient) {
            console.warn('Supabaseクライアントが利用できません。結果を保存できません。');
            return;
        }

        const {
            selectedStore,
            staffName,
            closingDate,
            register1Cash,
            register1Square,
            register1Gift,
            register1Total,
            register2Cash,
            register2Square,
            register2Gift,
            register2Total,
            hasRegister2,
            grandTotal,
            totalItems,
            totalCustomers,
            averagePerCustomer,
            averagePerItem,
            isHolidayToday,
            monthlyTotalToDate,
            monthlyTotal
        } = calculations;

        // 指定された日付を使用
        const targetDate = new Date(closingDate + 'T00:00:00');
        const year = targetDate.getFullYear();
        const month = targetDate.getMonth() + 1;
        const day = targetDate.getDate();
        const dateString = closingDate; // YYYY-MM-DD形式でそのまま使用

        // 予算データを取得（詳細レポートで既に取得済みの場合は再利用）
        let dailyBudget = 0;
        let monthlyBudget = 0;

        try {
            // monthly_budgetsテーブルから今月の予算を取得
            const { data: monthlyData, error: monthlyError } = await window.supabaseClient
                .from('monthly_budgets')
                .select('*')
                .eq('store', selectedStore)
                .eq('year', year)
                .eq('month', month)
                .maybeSingle();

            if (!monthlyError && monthlyData) {
                monthlyBudget = monthlyData.revenue_target || 0;
            }

            // weekly_budgetsテーブルから本日の予算を取得
            const dayOfWeek = targetDate.getDay(); // 0=日曜日, 1=月曜日, ... 6=土曜日
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const currentDay = dayNames[dayOfWeek];
            
            let weeklyData = null;
            let weeklyError = null;
            
            if (isHolidayToday) {
                // 祝日の場合はday_of_weekが'holiday'の予算を取得
                const { data, error } = await window.supabaseClient
                    .from('weekly_budgets')
                    .select('*')
                    .eq('store', selectedStore)
                    .eq('year', year)
                    .eq('month', month)
                    .eq('day_of_week', 'holiday')
                    .maybeSingle();
                weeklyData = data;
                weeklyError = error;
            } else {
                // 通常日の場合は該当曜日の予算を取得
                const { data, error } = await window.supabaseClient
                    .from('weekly_budgets')
                    .select('*')
                    .eq('store', selectedStore)
                    .eq('year', year)
                    .eq('month', month)
                    .eq('day_of_week', currentDay)
                    .maybeSingle();
                weeklyData = data;
                weeklyError = error;
            }

            if (!weeklyError && weeklyData) {
                dailyBudget = weeklyData.revenue_target || 0;
            }
        } catch (error) {
            console.error('予算データ取得エラー:', error);
        }

        // 達成率を計算
        const dailyAchievement = dailyBudget > 0 ? (grandTotal / dailyBudget) * 100 : 0;
        const monthlyAchievement = monthlyBudget > 0 ? (monthlyTotal / monthlyBudget) * 100 : 0;

        // 支払い方法別集計
        const totalCashSales = register1Cash + (register2Cash || 0);
        const totalCashlessSales = register1Square + (register2Square || 0);
        const totalGiftSales = register1Gift + (register2Gift || 0);

        // 保存するデータを構築
        const closingData = {
            store: selectedStore,
            calculation_date: dateString,
            year: year,
            month: month,
            day: day,
            is_holiday: isHolidayToday,
            holiday_name: isHolidayToday ? '祝日' : null,
            
            // 担当者情報
            staff_name: staffName,
            
            // レジ1の売上
            register1_cash: register1Cash,
            register1_square: register1Square,
            register1_gift: register1Gift,
            register1_total: register1Total,
            
            // レジ2の売上
            register2_cash: hasRegister2 ? register2Cash : 0,
            register2_square: hasRegister2 ? register2Square : 0,
            register2_gift: hasRegister2 ? register2Gift : 0,
            register2_total: hasRegister2 ? register2Total : 0,
            
            // 総売上と統計
            grand_total: grandTotal,
            total_items: totalItems,
            total_customers: totalCustomers,
            average_per_customer: averagePerCustomer,
            average_per_item: averagePerItem,
            
            // 予算比較
            daily_budget: dailyBudget,
            daily_achievement_rate: dailyAchievement,
            monthly_budget: monthlyBudget,
            monthly_achievement_rate: monthlyAchievement,
            
            // 支払い方法別集計
            total_cash_sales: totalCashSales,
            total_cashless_sales: totalCashlessSales,
            total_gift_sales: totalGiftSales,
            
            notes: `締め計算実行日時: ${new Date().toLocaleString('ja-JP')}`
        };

        // 既存データの確認（同じ店舗の同じ日付のデータがあるかチェック）
        const { data: existingData, error: checkError } = await window.supabaseClient
            .from('closing_results')
            .select('id')
            .eq('store', selectedStore)
            .eq('calculation_date', dateString)
            .maybeSingle();

        let result;
        if (existingData) {
            // 上書き確認
            const ok = await (window.confirmAsync
                ? window.confirmAsync('この日のデータは既に存在します。上書きしてよろしいですか？')
                : Promise.resolve(confirm('この日のデータは既に存在します。上書きしてよろしいですか？')));
            if (!ok) {
                showMessage('保存をキャンセルしました。', 'warning');
                return;
            }
            // 既存データがある場合は更新
            result = await window.supabaseClient
                .from('closing_results')
                .update(closingData)
                .eq('store', selectedStore)
                .eq('calculation_date', dateString);
        } else {
            // 新規データの場合は挿入
            result = await window.supabaseClient
                .from('closing_results')
                .insert([closingData]);
        }

        if (result.error) {
            throw result.error;
        }

        console.log('締め計算結果が正常に保存されました');
        showMessage('締め計算結果がデータベースに保存されました', 'success');

    } catch (error) {
        console.error('締め計算結果保存エラー:', error);
        showMessage('締め計算結果の保存に失敗しました: ' + error.message, 'error');
    }
}

// 保存された締め計算結果を読み込んで表示する関数（今月分を左右2カラムで表示）
async function loadSavedClosingResults() {
    try {
        if (!window.supabaseClient) {
            console.warn('Supabaseクライアントが利用できません。');
            return;
        }

        // ローカル日付を YYYY-MM-DD で整形するヘルパー
        const formatLocalYmd = (date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        // 今月の範囲を決定
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1; // 1-12
        const firstDay = new Date(year, month - 1, 1);
        const startStr = formatLocalYmd(firstDay);
        const endStr = formatLocalYmd(today);

        // 2店舗分の今月の締め結果を取得
        const stores = ['iruma', 'tokorozawa'];

        const fetchClosingForStore = async (store) => {
            const { data, error } = await window.supabaseClient
                .from('closing_results')
                .select('*')
                .eq('store', store)
                .gte('calculation_date', startStr)
                .lte('calculation_date', endStr)
                .order('calculation_date', { ascending: true });
            if (error) throw error;
            return data || [];
        };

        const fetchWeeklyBudgetForStore = async (store) => {
            const { data, error } = await window.supabaseClient
                .from('weekly_budgets')
                .select('*')
                .eq('store', store)
                .eq('year', year)
                .eq('month', month);
            if (error) throw error;
            // day_of_week -> revenue_target のマップ化
            const map = {};
            (data || []).forEach((row) => {
                map[row.day_of_week] = row.revenue_target || 0;
            });
            return map;
        };

        const fetchMonthlyBudgetForStore = async (store) => {
            const { data, error } = await window.supabaseClient
                .from('monthly_budgets')
                .select('*')
                .eq('store', store)
                .eq('year', year)
                .eq('month', month)
                .maybeSingle();
            if (error && error.code !== 'PGRST116') throw error; // maybeSingle no rows
            return data?.revenue_target || 0;
        };

        // 並行取得
        const [
            irumaResults,
            tokorozawaResults,
            irumaWeekly,
            tokorozawaWeekly,
            irumaMonthlyBudget,
            tokorozawaMonthlyBudget
        ] = await Promise.all([
            fetchClosingForStore('iruma'),
            fetchClosingForStore('tokorozawa'),
            fetchWeeklyBudgetForStore('iruma'),
            fetchWeeklyBudgetForStore('tokorozawa'),
            fetchMonthlyBudgetForStore('iruma'),
            fetchMonthlyBudgetForStore('tokorozawa')
        ]);

        // 日付配列を作成（1日〜今日）
        const days = [];
        for (let d = 1; d <= today.getDate(); d++) {
            const date = new Date(year, month - 1, d);
            const iso = formatLocalYmd(date);
            const dow = date.getDay(); // 0 Sun ... 6 Sat
            const dowName = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][dow];
            days.push({ date, iso, dowName });
        }

        const resultsByDate = (rows) => {
            const map = {};
            rows.forEach(r => { map[r.calculation_date] = r; });
            return map;
        };

        const irumaByDate = resultsByDate(irumaResults);
        const tokorozawaByDate = resultsByDate(tokorozawaResults);

        const buildStoreRows = (weeklyMap, byDateMap) => {
            const rows = [];
            let cumulativeSales = 0;
            let cumulativeBudget = 0; // 便宜上、最終行で月次予算は別途 monthlyBudget を使用
            days.forEach(({ date, iso, dowName }) => {
                const saved = byDateMap[iso];
                const isHoliday = !!saved?.is_holiday;
                const dailyBudget = isHoliday
                    ? (weeklyMap['holiday'] ?? weeklyMap[dowName] ?? 0)
                    : (weeklyMap[dowName] ?? 0);
                const actual = saved?.grand_total || 0;
                const rate = dailyBudget > 0 ? (actual / dailyBudget) * 100 : 0;
                cumulativeSales += actual;
                cumulativeBudget += dailyBudget;
                rows.push({ date, iso, dailyBudget, actual, rate });
            });
            return { rows, cumulativeSales, cumulativeBudget };
        };

        const irumaData = buildStoreRows(irumaWeekly, irumaByDate);
        const tokorozawaData = buildStoreRows(tokorozawaWeekly, tokorozawaByDate);

        const payload = {
            year,
            month,
            days,
            stores: {
                iruma: {
                    name: '入間店',
                    monthlyBudget: irumaMonthlyBudget,
                    ...irumaData
                },
                tokorozawa: {
                    name: '所沢店',
                    monthlyBudget: tokorozawaMonthlyBudget,
                    ...tokorozawaData
                }
            }
        };

        displaySavedClosingResults(payload);
    } catch (error) {
        console.error('保存された締め計算結果読み込みエラー:', error);
        showMessage('保存された結果の読み込みに失敗しました: ' + error.message, 'error');
    }
}

// 保存された締め計算結果を表示する関数（左右2カラム・日別行＋月次合計）
function displaySavedClosingResults(payload) {
    const container = document.getElementById('saved-results-list');
    if (!container) return;

    const { year, month, stores } = payload;

    const formatYen = (n) => '¥' + Math.round(n).toLocaleString();
    const formatPct = (n) => (isFinite(n) ? n.toFixed(1) : '0.0') + '%';

    const buildStoreColumn = (key) => {
        const s = stores[key];
        const header = `<h5 style="margin:0 0 8px 0;">${s.name}</h5>`;
        const rowsHtml = s.rows.map((r) => {
            const m = r.date.getMonth() + 1;
            const d = r.date.getDate();
            const dowJp = ['日','月','火','水','木','金','土'][r.date.getDay()];
            const ach = formatPct(r.rate);
            const achClass = r.rate >= 100 ? 'positive' : 'negative';
            return `
            <div class="monthly-row" style="display:grid;grid-template-columns:64px 1fr 1fr 72px;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid #eee;">
                <div class="cell date" style="opacity:0.8;">${m}/${d}(${dowJp})</div>
                <div class="cell">${formatYen(r.dailyBudget)}</div>
                <div class="cell">${formatYen(r.actual)}</div>
                <div class="cell ${achClass}">${ach}</div>
            </div>`;
        }).join('');

        const monthlyAch = s.monthlyBudget > 0 ? (s.cumulativeSales / s.monthlyBudget) * 100 : 0;
        const totalRow = `
        <div class="monthly-total" style="display:grid;grid-template-columns:64px 1fr 1fr 72px;gap:8px;align-items:center;padding:6px 0;border-top:2px solid #ccc;font-weight:600;">
            <div class="cell" style="opacity:0.9;">今月計</div>
            <div class="cell">${formatYen(s.monthlyBudget)}</div>
            <div class="cell">${formatYen(s.cumulativeSales)}</div>
            <div class="cell ${monthlyAch >= 100 ? 'positive' : 'negative'}">${formatPct(monthlyAch)}</div>
        </div>`;

        // ヘッダー行（予算/売上/達成率）
        const headerRow = `
        <div class="monthly-head" style="display:grid;grid-template-columns:64px 1fr 1fr 72px;gap:8px;padding:6px 0;border-bottom:2px solid #ccc;color:#555;font-weight:600;">
            <div></div>
            <div>予算</div>
            <div>実績</div>
            <div>達成率</div>
        </div>`;

        return `
        <div class="store-column" style="flex:1 1 0;min-width:320px;">
            ${header}
            ${headerRow}
            <div class="monthly-rows">${rowsHtml}</div>
            ${totalRow}
        </div>`;
    };

    const title = `<div style="margin-bottom:8px;color:#666;">${year}年${month}月</div>`;
    const grid = `
    <div class="monthly-grid" style="display:flex;gap:16px;">
        ${buildStoreColumn('iruma')}
        ${buildStoreColumn('tokorozawa')}
    </div>`;

    container.innerHTML = title + grid;
    document.getElementById('saved-closing-results').style.display = 'block';
}

// 保存された締め計算結果を削除する関数
async function deleteSavedClosingResult(calculationDate, store) {
    const ok = await (window.confirmAsync ? window.confirmAsync('この締め計算結果を削除しますか？') : Promise.resolve(confirm('この締め計算結果を削除しますか？')));
    if (!ok) {
        return;
    }

    try {
        if (!window.supabaseClient) {
            throw new Error('データベース接続が利用できません');
        }

        const { error } = await window.supabaseClient
            .from('closing_results')
            .delete()
            .eq('calculation_date', calculationDate)
            .eq('store', store);

        if (error) {
            throw error;
        }

        showMessage('締め計算結果が削除されました', 'success');
        loadSavedClosingResults(); // リストを更新

    } catch (error) {
        console.error('締め計算結果削除エラー:', error);
        showMessage('削除に失敗しました: ' + error.message, 'error');
    }
}

// 締め計算フォームクリア
function clearClosingForm() {
    document.getElementById('store-select').value = '';
    document.getElementById('staff-name').value = '';
    document.getElementById('closing-date').value = '';
    document.getElementById('register1-cash').value = '0';
    document.getElementById('register1-square').value = '0';
    document.getElementById('register1-gift').value = '0';
    document.getElementById('register2-cash').value = '0';
    document.getElementById('register2-square').value = '0';
    document.getElementById('register2-gift').value = '0';
    const r1Items = document.getElementById('register1-items');
    const r1Customers = document.getElementById('register1-customers');
    const r2Items = document.getElementById('register2-items');
    const r2Customers = document.getElementById('register2-customers');
    if (r1Items) r1Items.value = '0';
    if (r1Customers) r1Customers.value = '0';
    if (r2Items) r2Items.value = '0';
    if (r2Customers) r2Customers.value = '0';
    document.getElementById('is-holiday-today').checked = false;
    document.getElementById('register2-section').style.display = 'none';
    document.getElementById('closing-result').style.display = 'none';
    document.getElementById('closing-report').style.display = 'none';
    
    // 保存された祝日設定もクリア
    localStorage.removeItem('lastHolidaySetting');
}

// 祝日設定を復元する関数
function restoreHolidaySetting() {
    const savedHolidaySetting = localStorage.getItem('lastHolidaySetting');
    if (savedHolidaySetting !== null) {
        const isHoliday = savedHolidaySetting === 'true';
        document.getElementById('is-holiday-today').checked = isHoliday;
    }
    
    // 保存された締め計算結果を読み込む
    loadSavedClosingResults();
}

// =============================================
// 共通ユーティリティ関数
// =============================================

// メッセージ表示関数
function showMessage(message, type = 'info') {
    // 既存のメッセージを削除
    const existingMessage = document.querySelector('.tools-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    // 新しいメッセージを作成
    const messageDiv = document.createElement('div');
    messageDiv.className = `tools-message ${type}`;
    messageDiv.innerHTML = `
        <div class="message-content">
            <i class="fas fa-${getMessageIcon(type)}"></i>
            <span>${message}</span>
        </div>
        <button class="message-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    // ツールページの先頭に挿入
    const toolsContainer = document.querySelector('#tools .container');
    if (toolsContainer) {
        toolsContainer.insertBefore(messageDiv, toolsContainer.firstChild);
    }

    // 3秒後に自動削除
    setTimeout(() => {
        if (messageDiv.parentElement) {
            messageDiv.remove();
        }
    }, 3000);
}

// メッセージアイコン取得
function getMessageIcon(type) {
    switch (type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'warning': return 'exclamation-triangle';
        default: return 'info-circle';
    }
}

// 数値フォーマット関数
function formatCurrency(amount) {
    return '¥' + Math.round(amount).toLocaleString();
}

// バリデーション関数
function validatePositiveNumber(value, fieldName) {
    if (isNaN(value) || value < 0) {
        throw new Error(`${fieldName}は0以上の数値を入力してください。`);
    }
    return true;
}

// =============================================
// 初期化処理
// =============================================

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    // ツールページが表示されているかチェック
    const toolsPage = document.getElementById('tools');
    if (toolsPage && !toolsPage.classList.contains('page')) {
        console.log('Tools.js loaded successfully');
    }
    
    // 数値入力フィールドにイベントリスナーを追加
    addNumberInputListeners();
});

// 数値入力フィールドのイベントリスナー追加
function addNumberInputListeners() {
    const numberInputs = document.querySelectorAll('#tools input[type="number"]');
    
    numberInputs.forEach(input => {
        // フォーカス時に全選択
        input.addEventListener('focus', function() {
            this.select();
        });
        
        // 負の値を防ぐ
        input.addEventListener('input', function() {
            if (this.value < 0) {
                this.value = 0;
            }
        });
        
        // エンターキーで計算実行
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                const form = this.closest('.tools-tab-content');
                if (form) {
                    if (form.id === 'shipping-tab') {
                        calculateShipping();
                    } else if (form.id === 'closing-tab') {
                        calculateClosing();
                    } else if (form.id === 'cashcalc-tab') {
                        calculateCashTotals();
                    }
                }
            }
        });
    });
}

// =============================================
// 釣り銭計算ツール
// =============================================

function initializeCashCalculator() {
    // ゼロ初期化（存在する要素のみ）
    const ids = [
        'note_10000_count_input','note_5000_count_input','note_1000_count_input',
        'coin_500_roll','coin_500_loose','coin_100_roll','coin_100_loose',
        'coin_50_roll','coin_50_loose','coin_10_roll','coin_10_loose',
        'coin_5_roll','coin_5_loose','coin_1_roll','coin_1_loose'
    ];
    ids.forEach(id => { const el = document.getElementById(id); if (el && el.value === '') el.value = '0'; });

    // フォーカス時に値が"0"なら空に、ブラー時に空なら0に戻す
    const inputs = document.querySelectorAll('#cashcalc-tab .cashcalc-input');
    inputs.forEach((input) => {
        input.addEventListener('focus', function() {
            if (this.value === '0') {
                this.value = '';
            }
            // クリック一発で入力しやすいように選択
            this.select();
        });
        input.addEventListener('blur', function() {
            if (this.value === '') {
                this.value = '0';
            }
        });
    });
}

function calculateCashTotals() {
    // 入力値取得（存在しない場合は0）
    const getInt = (id) => parseInt(document.getElementById(id)?.value || '0', 10) || 0;

    const note10000Count = getInt('note_10000_count_input');
    const note5000Count  = getInt('note_5000_count_input');
    const note1000Count  = getInt('note_1000_count_input');

    const coin500Count = (getInt('coin_500_roll') * 50) + Math.floor(getInt('coin_500_loose') / 500);
    const coin100Count = (getInt('coin_100_roll') * 50) + Math.floor(getInt('coin_100_loose') / 100);
    const coin50Count  = (getInt('coin_50_roll')  * 50) + Math.floor(getInt('coin_50_loose')  / 50);
    const coin10Count  = (getInt('coin_10_roll')  * 50) + Math.floor(getInt('coin_10_loose')  / 10);
    const coin5Count   = (getInt('coin_5_roll')   * 50) + Math.floor(getInt('coin_5_loose')   / 5);
    const coin1Count   = (getInt('coin_1_roll')   * 50) + Math.floor(getInt('coin_1_loose')   / 1);

    // 表示更新（存在する要素のみ）
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val); };
    setText('note_10000_count', note10000Count);
    setText('note_5000_count',  note5000Count);
    setText('note_1000_count',  note1000Count);
    setText('coin_500_count',   coin500Count);
    setText('coin_100_count',   coin100Count);
    setText('coin_50_count',    coin50Count);
    setText('coin_10_count',    coin10Count);
    setText('coin_5_count',     coin5Count);
    setText('coin_1_count',     coin1Count);

    // 合計金額計算
    const total = (note10000Count * 10000) +
                  (note5000Count  * 5000) +
                  (note1000Count  * 1000) +
                  (coin500Count   * 500)  +
                  (coin100Count   * 100)  +
                  (coin50Count    * 50)   +
                  (coin10Count    * 10)   +
                  (coin5Count     * 5)    +
                  (coin1Count     * 1);

    const totalEl = document.getElementById('cash_total_display');
    if (totalEl) totalEl.textContent = '¥' + total.toLocaleString();
}

function adjustCashCount(id, delta) {
    const el = document.getElementById(id);
    if (!el) return;
    const current = parseInt(el.textContent || '0', 10) || 0;
    const next = Math.max(0, current + delta);
    el.textContent = String(next);
    updateCashTotalFromShownCounts();
}

function updateCashTotalFromShownCounts() {
    const getCount = (id) => parseInt(document.getElementById(id)?.textContent || '0', 10) || 0;
    let currentTotal = 0;
    currentTotal += getCount('note_10000_count') * 10000;
    currentTotal += getCount('note_5000_count')  * 5000;
    currentTotal += getCount('note_1000_count')  * 1000;
    currentTotal += getCount('coin_500_count')   * 500;
    currentTotal += getCount('coin_100_count')   * 100;
    currentTotal += getCount('coin_50_count')    * 50;
    currentTotal += getCount('coin_10_count')    * 10;
    currentTotal += getCount('coin_5_count')     * 5;
    currentTotal += getCount('coin_1_count')     * 1;
    const totalEl = document.getElementById('cash_total_display');
    if (totalEl) totalEl.textContent = '¥' + currentTotal.toLocaleString();
}
