// 予算管理システム
class BudgetManager {
    constructor() {
        this.budgets = [];
        this.currentTab = 'monthly';
        
        // Supabaseクライアントの初期化
        this.supabaseClient = this.initializeSupabase();
        
        this.init();
    }

    // Supabaseクライアントの初期化
    initializeSupabase() {
        try {
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
        this.setupEventListeners();
        this.setupDateSelectors();
        this.loadBudgetData();
    }

    setupEventListeners() {
        // 月次予算フォームのイベントリスナー
        const monthlyBudgetForm = document.getElementById('monthly-budget-form');
        if (monthlyBudgetForm) {
            monthlyBudgetForm.addEventListener('submit', (e) => this.handleMonthlyBudgetSubmit(e));
        }

        // 曜日別予算フォームのイベントリスナー
        const weeklyBudgetForm = document.getElementById('weekly-budget-form');
        if (weeklyBudgetForm) {
            weeklyBudgetForm.addEventListener('submit', (e) => this.handleWeeklyBudgetSubmit(e));
        }

        // 予算タブ切り替え
        const budgetTabs = document.querySelectorAll('.budget-tab');
        budgetTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.getAttribute('data-tab') || e.target.closest('[data-tab]').getAttribute('data-tab');
                this.switchBudgetTab(tabName);
            });
        });
    }

    setupDateSelectors() {
        // 年のオプションを設定
        const currentYear = new Date().getFullYear();
        const yearSelects = document.querySelectorAll('.year-select');
        
        yearSelects.forEach(select => {
            // 過去5年から未来2年までの範囲
            for (let year = currentYear - 5; year <= currentYear + 2; year++) {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = `${year}年`;
                if (year === currentYear) {
                    option.selected = true;
                }
                select.appendChild(option);
            }
        });

        // 現在の月を選択
        const currentMonth = new Date().getMonth() + 1;
        const monthSelects = document.querySelectorAll('.month-select');
        monthSelects.forEach(select => {
            select.value = currentMonth;
        });
    }

    // タブ切り替え機能
    switchBudgetTab(tabName) {
        this.currentTab = tabName;
        
        // タブボタンのアクティブ状態を更新
        const tabs = document.querySelectorAll('.budget-tab');
        tabs.forEach(tab => tab.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // コンテンツの表示/非表示を切り替え
        const contents = document.querySelectorAll('.budget-content');
        contents.forEach(content => content.classList.remove('active'));
        document.getElementById(`budget-${tabName}`).classList.add('active');

        // タブに応じたデータ読み込み
        if (tabName === 'monthly') {
            this.loadMonthlyBudgets();
        } else if (tabName === 'weekly') {
            this.loadWeeklyBudgets();
        } else if (tabName === 'analysis') {
            this.loadBudgetAnalysis();
        }
    }

    // 月次予算の提出処理
    async handleMonthlyBudgetSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const budgetData = {
            store: formData.get('store'),
            year: parseInt(formData.get('year')),
            month: parseInt(formData.get('month')),
            revenue_target: parseFloat(formData.get('revenue_target')) || 0,
            expense_budget: parseFloat(formData.get('expense_budget')) || 0,
            staff_cost: parseFloat(formData.get('staff_cost')) || 0,
            utility_cost: parseFloat(formData.get('utility_cost')) || 0,
            material_cost: parseFloat(formData.get('material_cost')) || 0,
            other_cost: parseFloat(formData.get('other_cost')) || 0,
            notes: formData.get('notes') || ''
        };

        try {
            this.showMessage('月次予算を保存中...', 'info');
            
            if (!this.supabaseClient) {
                throw new Error('データベース接続が利用できません');
            }

            // 既存データの確認
            const { data: existingData } = await this.supabaseClient
                .from('monthly_budgets')
                .select('*')
                .eq('store', budgetData.store)
                .eq('year', budgetData.year)
                .eq('month', budgetData.month)
                .single();

            let result;
            if (existingData) {
                // 更新
                result = await this.supabaseClient
                    .from('monthly_budgets')
                    .update({
                        ...budgetData,
                        updated_at: new Date().toISOString()
                    })
                    .eq('store', budgetData.store)
                    .eq('year', budgetData.year)
                    .eq('month', budgetData.month);
            } else {
                // 新規作成
                result = await this.supabaseClient
                    .from('monthly_budgets')
                    .insert([budgetData]);
            }

            if (result.error) {
                throw result.error;
            }

            this.showMessage('月次予算が正常に保存されました', 'success');
            this.loadMonthlyBudgets();
            e.target.reset();
            this.setupDateSelectors(); // 日付セレクターを再設定

        } catch (error) {
            console.error('月次予算保存エラー:', error);
            this.showMessage(`保存に失敗しました: ${error.message}`, 'error');
        }
    }

    // 曜日別予算の提出処理
    async handleWeeklyBudgetSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const year = parseInt(formData.get('year'));
        const month = parseInt(formData.get('month'));
        
        const store = formData.get('store');
        const weeklyBudgets = [];
        const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'holiday'];
        
        daysOfWeek.forEach(day => {
            const revenue = parseFloat(formData.get(`${day}_revenue`)) || 0;
            const expense = parseFloat(formData.get(`${day}_expense`)) || 0;
            
            if (revenue > 0 || expense > 0) {
                weeklyBudgets.push({
                    store: store,
                    year: year,
                    month: month,
                    day_of_week: day,
                    revenue_target: revenue,
                    expense_budget: expense,
                    is_holiday: day === 'holiday',
                    holiday_name: day === 'holiday' ? '祝日' : '',
                    holiday_revenue: day === 'holiday' ? revenue : 0
                });
            }
        });

        try {
            this.showMessage('曜日別予算を保存中...', 'info');
            
            if (!this.supabaseClient) {
                throw new Error('データベース接続が利用できません');
            }

            // 既存の曜日別予算を削除
            await this.supabaseClient
                .from('weekly_budgets')
                .delete()
                .eq('store', store)
                .eq('year', year)
                .eq('month', month);

            // 新しい曜日別予算を挿入
            if (weeklyBudgets.length > 0) {
                const { error } = await this.supabaseClient
                    .from('weekly_budgets')
                    .insert(weeklyBudgets);

                if (error) {
                    throw error;
                }
            }

            this.showMessage('曜日別予算が正常に保存されました', 'success');
            this.loadWeeklyBudgets();
            e.target.reset();
            this.setupDateSelectors(); // 日付セレクターを再設定

        } catch (error) {
            console.error('曜日別予算保存エラー:', error);
            this.showMessage(`保存に失敗しました: ${error.message}`, 'error');
        }
    }

    // 予算データの読み込み
    async loadBudgetData() {
        await Promise.all([
            this.loadMonthlyBudgets(),
            this.loadWeeklyBudgets(),
            this.updateBudgetOverview()
        ]);
    }

    // 月次予算データの読み込み
    async loadMonthlyBudgets() {
        try {
            if (!this.supabaseClient) {
                console.error('Supabaseクライアントが初期化されていません');
                return;
            }

            const { data, error } = await this.supabaseClient
                .from('monthly_budgets')
                .select('*')
                .order('year', { ascending: false })
                .order('month', { ascending: false });

            if (error) {
                throw error;
            }

            this.displayMonthlyBudgets(data || []);

        } catch (error) {
            console.error('月次予算読み込みエラー:', error);
            this.showMessage('月次予算の読み込みに失敗しました', 'error');
        }
    }

    // 曜日別予算データの読み込み
    async loadWeeklyBudgets() {
        try {
            if (!this.supabaseClient) {
                console.error('Supabaseクライアントが初期化されていません');
                return;
            }

            const { data, error } = await this.supabaseClient
                .from('weekly_budgets')
                .select('*')
                .order('year', { ascending: false })
                .order('month', { ascending: false });

            if (error) {
                throw error;
            }

            this.displayWeeklyBudgets(data || []);

        } catch (error) {
            console.error('曜日別予算読み込みエラー:', error);
            this.showMessage('曜日別予算の読み込みに失敗しました', 'error');
        }
    }

    // 月次予算の表示
    displayMonthlyBudgets(budgets) {
        const container = document.getElementById('monthly-budgets-list');
        if (!container) return;

        if (budgets.length === 0) {
            container.innerHTML = '<p class="no-data">登録された月次予算がありません</p>';
            return;
        }

        const html = budgets.map(budget => {
            const totalExpense = (budget.staff_cost || 0) + (budget.utility_cost || 0) + 
                               (budget.material_cost || 0) + (budget.other_cost || 0);
            const profitTarget = (budget.revenue_target || 0) - totalExpense;
            const storeName = this.getStoreDisplayName(budget.store);
            
            return `
                <div class="budget-item">
                    <div class="budget-header">
                        <h3>${storeName} - ${budget.year}年 ${budget.month}月の予算</h3>
                        <div class="budget-actions">
                            <button class="btn btn-sm btn-secondary" onclick="budgetManager.editMonthlyBudget('${budget.store}', ${budget.year}, ${budget.month})">
                                <i class="fas fa-edit"></i> 編集
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="budgetManager.deleteMonthlyBudget('${budget.store}', ${budget.year}, ${budget.month})">
                                <i class="fas fa-trash"></i> 削除
                            </button>
                        </div>
                    </div>
                    <div class="budget-details">
                        <div class="budget-summary">
                            <div class="summary-item revenue">
                                <span class="label">売上目標</span>
                                <span class="value">¥${(budget.revenue_target || 0).toLocaleString()}</span>
                            </div>
                            <div class="summary-item expense">
                                <span class="label">支出予算</span>
                                <span class="value">¥${totalExpense.toLocaleString()}</span>
                            </div>
                            <div class="summary-item profit ${profitTarget >= 0 ? 'positive' : 'negative'}">
                                <span class="label">利益目標</span>
                                <span class="value">¥${profitTarget.toLocaleString()}</span>
                            </div>
                        </div>
                        <div class="expense-breakdown">
                            <h4>支出内訳</h4>
                            <div class="breakdown-grid">
                                <div class="breakdown-item">
                                    <span class="label">人件費</span>
                                    <span class="value">¥${(budget.staff_cost || 0).toLocaleString()}</span>
                                </div>
                                <div class="breakdown-item">
                                    <span class="label">光熱費</span>
                                    <span class="value">¥${(budget.utility_cost || 0).toLocaleString()}</span>
                                </div>
                                <div class="breakdown-item">
                                    <span class="label">材料費</span>
                                    <span class="value">¥${(budget.material_cost || 0).toLocaleString()}</span>
                                </div>
                                <div class="breakdown-item">
                                    <span class="label">その他</span>
                                    <span class="value">¥${(budget.other_cost || 0).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                        ${budget.notes ? `<div class="budget-notes"><h4>備考</h4><p>${budget.notes}</p></div>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    // 曜日別予算の表示
    displayWeeklyBudgets(budgets) {
        const container = document.getElementById('weekly-budgets-list');
        if (!container) return;

        if (budgets.length === 0) {
            container.innerHTML = '<p class="no-data">登録された曜日別予算がありません</p>';
            return;
        }

        // 店舗・年月でグループ化
        const groupedBudgets = {};
        budgets.forEach(budget => {
            const key = `${budget.store}-${budget.year}-${budget.month}`;
            if (!groupedBudgets[key]) {
                groupedBudgets[key] = {
                    store: budget.store,
                    year: budget.year,
                    month: budget.month,
                    days: {}
                };
            }
            groupedBudgets[key].days[budget.day_of_week] = budget;
        });

        const dayNames = {
            monday: '月曜日',
            tuesday: '火曜日',
            wednesday: '水曜日',
            thursday: '木曜日',
            friday: '金曜日',
            saturday: '土曜日',
            sunday: '日曜日',
            holiday: '祝日'
        };

        const html = Object.values(groupedBudgets).map(group => {
            const storeName = this.getStoreDisplayName(group.store);
            const daysHtml = Object.entries(dayNames).map(([day, dayName]) => {
                const dayBudget = group.days[day];
                if (!dayBudget) return '';
                
                const holidayClass = dayBudget.is_holiday ? 'holiday' : '';
                const holidayBadge = dayBudget.is_holiday ? `<span class="holiday-badge">${dayBudget.holiday_name || '祝日'}</span>` : '';
                const holidayRevenueInfo = dayBudget.holiday_revenue > 0 ? `<span class="holiday-revenue">祝日売上: ¥${dayBudget.holiday_revenue.toLocaleString()}</span>` : '';
                
                return `
                    <div class="day-budget ${holidayClass}">
                        <div class="day-header">
                            <span class="day-name">${dayName}</span>
                            ${holidayBadge}
                        </div>
                        <span class="revenue">売上: ¥${(dayBudget.revenue_target || 0).toLocaleString()}</span>
                        <span class="expense">支出: ¥${(dayBudget.expense_budget || 0).toLocaleString()}</span>
                        <span class="profit ${(dayBudget.revenue_target - dayBudget.expense_budget) >= 0 ? 'positive' : 'negative'}">
                            利益: ¥${((dayBudget.revenue_target || 0) - (dayBudget.expense_budget || 0)).toLocaleString()}
                        </span>
                        ${holidayRevenueInfo}
                    </div>
                `;
            }).join('');

            return `
                <div class="weekly-budget-item">
                    <div class="weekly-budget-header">
                        <h3>${storeName} - ${group.year}年 ${group.month}月の曜日別予算</h3>
                        <div class="budget-actions">
                            <button class="btn btn-sm btn-secondary" onclick="budgetManager.editWeeklyBudget('${group.store}', ${group.year}, ${group.month})">
                                <i class="fas fa-edit"></i> 編集
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="budgetManager.deleteWeeklyBudget('${group.store}', ${group.year}, ${group.month})">
                                <i class="fas fa-trash"></i> 削除
                            </button>
                        </div>
                    </div>
                    <div class="weekly-budget-details">
                        ${daysHtml}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    // 予算概要の更新
    async updateBudgetOverview() {
        try {
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear();
            const currentMonth = currentDate.getMonth() + 1;

            // 今月の全店舗分の予算を取得し合算
            const { data, error } = await this.supabaseClient
                .from('monthly_budgets')
                .select('*')
                .eq('year', currentYear)
                .eq('month', currentMonth);
            if (error) throw error;

            const rows = Array.isArray(data) ? data : (data ? [data] : []);
            let sumRevenue = 0;
            let sumExpense = 0;
            rows.forEach(row => {
                sumRevenue += row.revenue_target || 0;
                sumExpense += (row.staff_cost || 0) + (row.utility_cost || 0) + (row.material_cost || 0) + (row.other_cost || 0);
            });
            const sumProfit = sumRevenue - sumExpense;

            this.updateOverviewCard('current-revenue-target', sumRevenue);
            this.updateOverviewCard('current-expense-budget', sumExpense);
            this.updateOverviewCard('current-profit-target', sumProfit);

        } catch (error) {
            console.error('予算概要更新エラー:', error);
        }
    }

    updateOverviewCard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = `¥${value.toLocaleString()}`;
            
            // 利益の場合は色を変更
            if (elementId === 'current-profit-target') {
                element.className = value >= 0 ? 'budget-amount positive' : 'budget-amount negative';
            }
        }
    }

    // 月次予算の編集
    async editMonthlyBudget(store, year, month) {
        try {
            const { data, error } = await this.supabaseClient
                .from('monthly_budgets')
                .select('*')
                .eq('store', store)
                .eq('year', year)
                .eq('month', month)
                .limit(1);

            if (error) throw error;

            // フォームに値を設定
            const form = document.getElementById('monthly-budget-form');
            const row = Array.isArray(data) ? data[0] : data;
            if (form && row) {
                if (form.store) form.store.value = row.store;
                form.year.value = row.year;
                form.month.value = row.month;
                form.revenue_target.value = row.revenue_target || '';
                form.expense_budget.value = row.expense_budget || '';
                form.staff_cost.value = row.staff_cost || '';
                form.utility_cost.value = row.utility_cost || '';
                form.material_cost.value = row.material_cost || '';
                form.other_cost.value = row.other_cost || '';
                form.notes.value = row.notes || '';

                // 月次予算タブに切り替え
                this.switchBudgetTab('monthly');
                
                // フォームまでスクロール
                form.scrollIntoView({ behavior: 'smooth' });
            }

        } catch (error) {
            console.error('月次予算編集エラー:', error);
            this.showMessage('データの取得に失敗しました', 'error');
        }
    }

    // 曜日別予算の編集
    async editWeeklyBudget(store, year, month) {
        try {
            const { data, error } = await this.supabaseClient
                .from('weekly_budgets')
                .select('*')
                .eq('store', store)
                .eq('year', year)
                .eq('month', month);

            if (error) throw error;

            // フォームに値を設定
            const form = document.getElementById('weekly-budget-form');
            if (form) {
                if (form.store) form.store.value = store;
                form.year.value = year;
                form.month.value = month;

                // 各曜日のデータをクリア
                const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'holiday'];
                daysOfWeek.forEach(day => {
                    const revenueInput = form[`${day}_revenue`];
                    const expenseInput = form[`${day}_expense`];
                    if (revenueInput) revenueInput.value = '';
                    if (expenseInput) expenseInput.value = '';
                });

                // データがある場合は設定
                if (data) {
                    data.forEach(dayBudget => {
                        const revenueInput = form[`${dayBudget.day_of_week}_revenue`];
                        const expenseInput = form[`${dayBudget.day_of_week}_expense`];
                        if (revenueInput) revenueInput.value = dayBudget.revenue_target || '';
                        if (expenseInput) expenseInput.value = dayBudget.expense_budget || '';
                    });
                }

                // 曜日別予算タブに切り替え
                this.switchBudgetTab('weekly');
                
                // フォームまでスクロール
                form.scrollIntoView({ behavior: 'smooth' });
            }

        } catch (error) {
            console.error('曜日別予算編集エラー:', error);
            this.showMessage('データの取得に失敗しました', 'error');
        }
    }

    // 月次予算の削除
    async deleteMonthlyBudget(store, year, month) {
        const ok = await (window.confirmAsync ? window.confirmAsync(`${year}年${month}月の月次予算を削除しますか？`) : Promise.resolve(confirm(`${year}年${month}月の月次予算を削除しますか？`)));
        if (!ok) {
            return;
        }

        try {
            const { error } = await this.supabaseClient
                .from('monthly_budgets')
                .delete()
                .eq('store', store)
                .eq('year', year)
                .eq('month', month);

            if (error) throw error;

            this.showMessage('月次予算が削除されました', 'success');
            this.loadMonthlyBudgets();
            this.updateBudgetOverview();

        } catch (error) {
            console.error('月次予算削除エラー:', error);
            this.showMessage('削除に失敗しました', 'error');
        }
    }

    // 曜日別予算の削除
    async deleteWeeklyBudget(store, year, month) {
        const ok2 = await (window.confirmAsync ? window.confirmAsync(`${year}年${month}月の曜日別予算を削除しますか？`) : Promise.resolve(confirm(`${year}年${month}月の曜日別予算を削除しますか？`)));
        if (!ok2) {
            return;
        }

        try {
            const { error } = await this.supabaseClient
                .from('weekly_budgets')
                .delete()
                .eq('store', store)
                .eq('year', year)
                .eq('month', month);

            if (error) throw error;

            this.showMessage('曜日別予算が削除されました', 'success');
            this.loadWeeklyBudgets();

        } catch (error) {
            console.error('曜日別予算削除エラー:', error);
            this.showMessage('削除に失敗しました', 'error');
        }
    }

    // 店舗IDから表示名を取得
    getStoreDisplayName(storeId) {
        const mapping = {
            iruma: '入間店',
            tokorozawa: '所沢店'
        };
        return mapping[storeId] || storeId || '店舗未設定';
    }

    // 予算分析の読み込み
    async loadBudgetAnalysis() {
        try {
            // 過去12ヶ月のデータを取得
            const endDate = new Date();
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 11);

            const { data: monthlyData, error } = await this.supabaseClient
                .from('monthly_budgets')
                .select('*')
                .gte('year', startDate.getFullYear())
                .order('year', { ascending: true })
                .order('month', { ascending: true });

            if (error) throw error;

            this.displayBudgetAnalysis(monthlyData || []);

        } catch (error) {
            console.error('予算分析読み込みエラー:', error);
            this.showMessage('予算分析の読み込みに失敗しました', 'error');
        }
    }

    // 予算分析の表示
    displayBudgetAnalysis(data) {
        const container = document.getElementById('budget-analysis-content');
        if (!container) return;

        if (data.length === 0) {
            container.innerHTML = '<p class="no-data">分析するデータがありません</p>';
            return;
        }

        // 統計情報の計算
        let totalRevenue = 0;
        let totalExpense = 0;
        let monthCount = data.length;

        data.forEach(item => {
            totalRevenue += item.revenue_target || 0;
            const expense = (item.staff_cost || 0) + (item.utility_cost || 0) + 
                           (item.material_cost || 0) + (item.other_cost || 0);
            totalExpense += expense;
        });

        const avgRevenue = totalRevenue / monthCount;
        const avgExpense = totalExpense / monthCount;
        const avgProfit = avgRevenue - avgExpense;

        const html = `
            <div class="analysis-summary">
                <h3>予算分析サマリー</h3>
                <div class="summary-grid">
                    <div class="summary-card">
                        <h4>平均売上目標</h4>
                        <p class="summary-value">¥${Math.round(avgRevenue).toLocaleString()}</p>
                    </div>
                    <div class="summary-card">
                        <h4>平均支出予算</h4>
                        <p class="summary-value">¥${Math.round(avgExpense).toLocaleString()}</p>
                    </div>
                    <div class="summary-card">
                        <h4>平均利益目標</h4>
                        <p class="summary-value ${avgProfit >= 0 ? 'positive' : 'negative'}">¥${Math.round(avgProfit).toLocaleString()}</p>
                    </div>
                    <div class="summary-card">
                        <h4>分析期間</h4>
                        <p class="summary-value">${monthCount}ヶ月</p>
                    </div>
                </div>
            </div>
            <div class="analysis-chart">
                <h3>月別予算推移</h3>
                <div class="chart-container">
                    ${this.createBudgetChart(data)}
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    // 簡単な予算チャートの作成
    createBudgetChart(data) {
        if (data.length === 0) return '<p>データがありません</p>';

        const maxValue = Math.max(...data.map(item => {
            const expense = (item.staff_cost || 0) + (item.utility_cost || 0) + 
                           (item.material_cost || 0) + (item.other_cost || 0);
            return Math.max(item.revenue_target || 0, expense);
        }));

        const chartItems = data.map(item => {
            const expense = (item.staff_cost || 0) + (item.utility_cost || 0) + 
                           (item.material_cost || 0) + (item.other_cost || 0);
            const revenue = item.revenue_target || 0;
            const profit = revenue - expense;

            const revenueHeight = (revenue / maxValue) * 100;
            const expenseHeight = (expense / maxValue) * 100;

            return `
                <div class="chart-item">
                    <div class="chart-bars">
                        <div class="chart-bar revenue" style="height: ${revenueHeight}%" title="売上目標: ¥${revenue.toLocaleString()}"></div>
                        <div class="chart-bar expense" style="height: ${expenseHeight}%" title="支出予算: ¥${expense.toLocaleString()}"></div>
                    </div>
                    <div class="chart-label">${item.year}年${item.month}月</div>
                    <div class="chart-profit ${profit >= 0 ? 'positive' : 'negative'}">¥${profit.toLocaleString()}</div>
                </div>
            `;
        }).join('');

        return `
            <div class="simple-chart">
                <div class="chart-legend">
                    <div class="legend-item">
                        <span class="legend-color revenue"></span>
                        <span>売上目標</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color expense"></span>
                        <span>支出予算</span>
                    </div>
                </div>
                <div class="chart-grid">
                    ${chartItems}
                </div>
            </div>
        `;
    }

    // メッセージ表示
    showMessage(message, type = 'info') {
        // 既存のメッセージ要素をクリア
        const existingMessages = document.querySelectorAll('.budget-message');
        existingMessages.forEach(msg => msg.remove());

        // 新しいメッセージ要素を作成
        const messageDiv = document.createElement('div');
        messageDiv.className = `budget-message ${type}`;
        messageDiv.textContent = message;

        // 予算管理コンテナの最上部に挿入
        const budgetContainer = document.querySelector('#budget .container');
        if (budgetContainer) {
            budgetContainer.insertBefore(messageDiv, budgetContainer.firstChild);
        }

        // 3秒後に自動削除
        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }

    // データエクスポート機能
    async exportBudgetData() {
        try {
            const [monthlyData, weeklyData] = await Promise.all([
                this.supabaseClient.from('monthly_budgets').select('*').order('year').order('month'),
                this.supabaseClient.from('weekly_budgets').select('*').order('year').order('month')
            ]);

            const exportData = {
                monthly_budgets: monthlyData.data || [],
                weekly_budgets: weeklyData.data || [],
                exported_at: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `budget_data_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showMessage('予算データをエクスポートしました', 'success');

        } catch (error) {
            console.error('エクスポートエラー:', error);
            this.showMessage('エクスポートに失敗しました', 'error');
        }
    }
}

// グローバル変数としてBudgetManagerインスタンスを作成
let budgetManager;

// DOMが読み込まれた後にBudgetManagerを初期化
document.addEventListener('DOMContentLoaded', () => {
    // 予算管理画面が存在する場合のみ初期化
    if (document.getElementById('budget')) {
        budgetManager = new BudgetManager();
    }
});

// グローバル関数として予算タブ切り替え関数をエクスポート
window.switchBudgetTab = function(tabName) {
    if (budgetManager) {
        budgetManager.switchBudgetTab(tabName);
    }
};

// グローバル関数として予算データエクスポート関数をエクスポート
window.exportBudgetData = function() {
    if (budgetManager) {
        budgetManager.exportBudgetData();
    }
};
