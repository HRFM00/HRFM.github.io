// 代打依頼システムとタイムスケジュール確認機能

// グローバル変数
let substitutionCurrentUser = null;
let substitutionRequests = [];
// 同一依頼の連打・二重送信防止ロック
const substitutionApplyLocks = new Set();

// 初期化
function _initSubsAndRecruit() {
    try { initializeSubstitutionSystem(); } catch (e) { console.error(e); }
    // 新実装は shift-recruit.js 側でDOMContentLoaded時に初期化されます
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initSubsAndRecruit);
} else {
    _initSubsAndRecruit();
}

// 代打依頼システムの初期化
async function initializeSubstitutionSystem() {
    try {
        // 現在のユーザー情報を取得
        substitutionCurrentUser = await getCurrentUser();
        console.log('substitutionCurrentUser:', substitutionCurrentUser);
        
        // フォームのイベントリスナーを設定
        setupSubstitutionEventListeners();
        
        // 代打依頼一覧を読み込み
        await loadSubstitutionRequests();
        
        console.log('代打依頼システムが初期化されました');
    } catch (error) {
        console.error('代打依頼システムの初期化に失敗しました:', error);
    }
}

// イベントリスナーの設定
async function setupSubstitutionEventListeners() {
    // 代打依頼フォーム
    const substitutionForm = document.getElementById('substitution-request-form');
    if (substitutionForm) {
        substitutionForm.addEventListener('submit', handleSubstitutionRequest);
    }
    
    // スケジュール確認日付フィールドに今日の日付を設定
    const scheduleCheckDate = document.getElementById('schedule-check-date');
    
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayString = `${year}-${month}-${day}`;
    
    if (scheduleCheckDate) {
        scheduleCheckDate.value = todayString;
    }
    
    // ログインユーザーのシフトを自動ロード
    await loadCurrentUserSchedules();
}

// 現在ユーザーのシフトを読み込む
async function loadCurrentUserSchedules() {
    try {
        const resultContainer = document.getElementById('substitution-search-result');
        const loadingContainer = document.getElementById('substitution-search-loading');
        if (!substitutionCurrentUser) return;

        loadingContainer.style.display = 'block';
        resultContainer.style.display = 'none';

        const searchName = (substitutionCurrentUser.full_name || substitutionCurrentUser.username || '').trim();
        // 半角/全角スペースを正規化してトークン化（姓・名）
        const normalized = searchName.replace(/[\s\u3000]+/g, ' ').trim();
        const parts = normalized.split(' ').filter(Boolean);

        let query = supabase
            .from('shift')
            .select('*');

        // 姓名の両方を含むレコードにマッチ（AND 条件）
        if (parts.length >= 2) {
            query = query
                .ilike('name', `%${parts[0]}%`)
                .ilike('name', `%${parts[1]}%`);
        } else {
            // 片方しかない場合はそのまま部分一致
            query = query.ilike('name', `%${parts[0]}%`);
        }

        const { data: schedules, error } = await query
            .order('date', { ascending: true })
            .order('check_in_time', { ascending: true });

        if (error) {
            console.error('シフトの読み込みに失敗しました:', error);
            showNotification('シフトの読み込みに失敗しました', 'error');
            return;
        }

        displaySearchResults(schedules || [], null, searchName);

        loadingContainer.style.display = 'none';
        resultContainer.style.display = 'block';
    } catch (error) {
        console.error('現在ユーザーのシフト読み込みに失敗:', error);
        showNotification('シフトの読み込みに失敗しました', 'error');
    }
}

// 代打依頼の処理
async function handleSubstitutionRequest(event) {
    event.preventDefault();
    
    try {
        const formData = new FormData(event.target);
        const requestData = {
            requester_id: substitutionCurrentUser.id,
            requester_name: substitutionCurrentUser.full_name || substitutionCurrentUser.username,
            shift_time_start: formData.get('substitution-time-start') || document.getElementById('substitution-time-start').value,
            shift_time_end: formData.get('substitution-time-end') || document.getElementById('substitution-time-end').value,
            shift_date: document.getElementById('substitution-shift-date')?.value || null,
            reason: formData.get('substitution-reason') || document.getElementById('substitution-reason').value || null,
            status: 'waiting'
        };
        
        // バリデーション
        if (!requestData.shift_time_start || !requestData.shift_time_end) {
            showNotification('開始時間と終了時間を入力してください', 'error');
            return;
        }
        
        // 依頼理由は任意に変更
        
        // データベースに保存
        const { data, error } = await supabase
            .from('shift_substitution_requests')
            .insert([requestData])
            .select();
        
        if (error) {
            console.error('代打依頼の保存に失敗しました:', error);
            showNotification('代打依頼の投稿に失敗しました', 'error');
            return;
        }
        
        showNotification('代打依頼を投稿しました', 'success');
        
        // フォームをリセット
        event.target.reset();
        
        // 代打依頼一覧を更新
        await loadSubstitutionRequests();
        
    } catch (error) {
        console.error('代打依頼の処理に失敗しました:', error);
        showNotification('代打依頼の投稿に失敗しました', 'error');
    }
}

// 代打依頼一覧の読み込み
async function loadSubstitutionRequests() {
    try {
        const { data, error } = await supabase
            .from('shift_substitution_requests')
            .select(`
                *,
                shift_substitution_applications (
                    id,
                    applicant_id,
                    applicant_name,
                    status,
                    created_at
                )
            `)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('代打依頼の読み込みに失敗しました:', error);
            return;
        }
        
        substitutionRequests = data || [];
        displaySubstitutionRequests(substitutionRequests);
        
    } catch (error) {
        console.error('代打依頼の読み込みに失敗しました:', error);
    }
}

// 代打依頼一覧の表示
function displaySubstitutionRequests(requests) {
    const container = document.getElementById('substitution-requests-list');
    if (!container) return;
    
    if (requests.length === 0) {
        container.innerHTML = '<div class="no-data">代打依頼はありません</div>';
        return;
    }
    
    const requestsHtml = requests.map(request => {
        const applications = request.shift_substitution_applications || [];
        const hasApplications = applications.length > 0;
        const statusText = hasApplications ? '承認待ち' : '立候補待ち';
        const statusClass = hasApplications ? 'pending' : 'waiting';
        
        // 承認済みの申請があるかチェック
        const approvedApplication = applications.find(app => app.status === 'approved');
        const isApproved = !!approvedApplication;
        
        const applicationsHtml = applications.map(app => {
            const role = (substitutionCurrentUser && substitutionCurrentUser.role) || 'staff';
            const isManager = role === 'administrator' || role === 'developer';
            
            const canApprove = isManager && app.status === 'pending';
            const canReject = isManager && app.status === 'pending';
            const canUnapprove = isManager && app.status === 'approved';
            const canUnreject = isManager && app.status === 'rejected';
            
            return `
                <div class="application-item ${app.status}">
                    <div class="application-info">
                        <span class="applicant-name">${app.applicant_name}</span>
                        <span class="application-status ${app.status}">${getStatusText(app.status)}</span>
                        <span class="application-date">${formatDate(app.created_at)}</span>
                        ${app.approved_by_name ? `<span class=\"approver-name\">承認者: ${app.approved_by_name}</span>` : ''}
                        ${app.rejected_by_name ? `<span class=\"approver-name\">却下者: ${app.rejected_by_name}</span>` : ''}
                    </div>
                    ${canApprove || canReject || canUnapprove || canUnreject ? `
                        <div class="application-actions">
                            ${canApprove ? `
                                <button class="btn btn-sm btn-success" onclick="approveApplication(${app.id}, ${request.id})">
                                    <i class="fas fa-check"></i> 承認
                                </button>
                            ` : ''}
                            ${canReject ? `
                                <button class="btn btn-sm btn-danger" onclick="rejectApplication(${app.id}, ${request.id})">
                                    <i class="fas fa-times"></i> 却下
                                </button>
                            ` : ''}
                            ${canUnapprove ? `
                                <button class="btn btn-sm btn-warning" onclick="unapproveApplication(${app.id})">
                                    <i class="fas fa-undo"></i> 承認解除
                                </button>
                            ` : ''}
                            ${canUnreject ? `
                                <button class="btn btn-sm btn-warning" onclick="unrejectApplication(${app.id})">
                                    <i class="fas fa-undo"></i> 却下解除
                                </button>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
        
        const alreadyAppliedByMe = !!(substitutionCurrentUser && applications.some(app => String(app.applicant_id) === String(substitutionCurrentUser.id)));

        let actionsHtml = '';
        if (!isApproved) {
            if (alreadyAppliedByMe) {
                actionsHtml = `
                    <button class="btn btn-sm btn-secondary" data-action="apply" disabled>
                        <i class="fas fa-check"></i> 立候補済み
                    </button>`;
            } else {
                actionsHtml = `
                    <button class="btn btn-sm btn-primary" data-action="apply" onclick="applyForSubstitution(${request.id})">
                        <i class="fas fa-hand-paper"></i> 立候補する
                    </button>`;
            }
        }

        return `
            <div class="substitution-request-item ${isApproved ? 'approved' : ''}" data-request-id="${request.id}">
                <div class="request-header">
                    <div class="request-info">
                        <h5>${request.requester_name} の代打依頼</h5>
                        <span class="request-date">${formatDate(request.shift_date)}</span>
                        ${request.shift_time_start && request.shift_time_end ? 
                            `<span class="request-time">${request.shift_time_start} - ${request.shift_time_end}</span>` : ''}
                    </div>
                    <div class="request-status ${statusClass}">
                        ${isApproved ? '承認済み' : statusText}
                    </div>
                </div>
                ${request.reason ? `<div class="request-reason">${request.reason}</div>` : ''}
                <div class="applications-section">
                    <h6>立候補者</h6>
                    ${applicationsHtml || '<div class="no-applications">立候補者はいません</div>'}
                </div>
                ${!isApproved ? `<div class="request-actions">${actionsHtml}</div>` : ''}
            </div>
        `;
    }).join('');
    
    container.innerHTML = requestsHtml;
    // 動的挿入後に権限制御を再適用
    if (typeof applyUiPermissions === 'function' && window.currentUser) {
        try { applyUiPermissions(window.currentUser); } catch (_) {}
    }
}

    // 代打依頼への立候補（重複不可）
    async function applyForSubstitution(requestId) {
    try {
        // 連打防止: 即時ロック＆ボタンを一時的に無効化
        if (substitutionApplyLocks.has(requestId)) return;
        substitutionApplyLocks.add(requestId);
        try {
            document.querySelectorAll(`.substitution-request-item[data-request-id="${requestId}"] .request-actions [data-action="apply"]`).forEach(btn => {
                btn.disabled = true;
            });
            // 後方互換: onclick 属性で特定されるボタンも合わせて無効化
            document.querySelectorAll(`.substitution-request-item[data-request-id="${requestId}"] .request-actions button[onclick="applyForSubstitution(${requestId})"]`).forEach(btn => {
                btn.disabled = true;
            });
        } catch (_) {}
        if (!substitutionCurrentUser) {
            showNotification('ログインが必要です', 'error');
            substitutionApplyLocks.delete(requestId);
            return;
        }
        
            // 重複立候補の防止
            const { data: existing } = await supabase
                .from('shift_substitution_applications')
                .select('id')
                .eq('request_id', requestId)
                .eq('applicant_id', substitutionCurrentUser.id)
                .maybeSingle();
            if (existing) {
                showNotification('この依頼には既に立候補済みです', 'warning');
                // ボタン無効化（保険）
                const container = document.querySelector(`.substitution-request-item[data-request-id="${requestId}"]`);
                const btns = container ? container.querySelectorAll('.request-actions [data-action="apply"], .request-actions button[onclick]') : [];
                btns.forEach(btn => { btn.disabled = true; btn.classList.remove('btn-primary'); btn.classList.add('btn-secondary'); btn.innerHTML = '<i class="fas fa-check"></i> 立候補済み'; });
                substitutionApplyLocks.delete(requestId);
                return;
            }

        const applicationData = {
            request_id: requestId,
            applicant_id: substitutionCurrentUser.id,
            applicant_name: substitutionCurrentUser.full_name || substitutionCurrentUser.username,
            status: 'pending'
        };
        
        const { data, error } = await supabase
            .from('shift_substitution_applications')
            .upsert([applicationData], { onConflict: 'request_id,applicant_id', ignoreDuplicates: true })
            .select();
        
        if (error) {
            console.error('立候補の保存に失敗しました:', error);
            showNotification('立候補に失敗しました', 'error');
            substitutionApplyLocks.delete(requestId);
            return;
        }
        
        showNotification('立候補しました', 'success');
        
            // 再ロードせずにDOMを即時更新
            const container = document.querySelector(`.substitution-request-item[data-request-id="${requestId}"]`);
            const item = container && container.querySelector('.request-actions [data-action="apply"], .request-actions button[onclick]');
            if (item) {
                // ボタン表示更新
                item.disabled = true; item.classList.remove('btn-primary'); item.classList.add('btn-secondary'); item.innerHTML = '<i class="fas fa-check"></i> 立候補済み';
                const appsSection = container && container.querySelector('.applications-section');
                if (appsSection) {
                    const noApps = appsSection.querySelector('.no-applications');
                    if (noApps) noApps.remove();
                    const created = new Date().toISOString();
                    const block = document.createElement('div');
                    block.className = 'application-item pending';
                    block.innerHTML = `
                        <div class="application-info">
                            <span class="applicant-name">${applicationData.applicant_name}</span>
                            <span class="application-status pending">${getStatusText('pending')}</span>
                            <span class="application-date">${formatDate(created)}</span>
                        </div>
                    `;
                    appsSection.appendChild(block);
                }
            }
            substitutionApplyLocks.delete(requestId);
        
    } catch (error) {
        console.error('立候補の処理に失敗しました:', error);
        showNotification('立候補に失敗しました', 'error');
        substitutionApplyLocks.delete(requestId);
    }
}

// 代打申請の承認
async function approveApplication(applicationId, requestId) {
    try {
        if (!substitutionCurrentUser) {
            showNotification('ログインが必要です', 'error');
            return;
        }
        
        // 承認処理（approved_atカラムが存在しない場合の対応）
        let updateData = { 
            status: 'approved'
        };
        
        // カラムが存在する場合のみ追加
        try {
            updateData.approved_at = new Date().toISOString();
            updateData.approved_by = substitutionCurrentUser.id;
        } catch (error) {
            console.warn('approved_atカラムが存在しません。基本的な承認処理のみ実行します。');
        }
        
        const { data, error } = await supabase
            .from('shift_substitution_applications')
            .update({ ...updateData, approved_by_id: substitutionCurrentUser.id, approved_by_name: substitutionCurrentUser.full_name || substitutionCurrentUser.username })
            .eq('id', applicationId)
            .select();
        
        if (error) {
            console.error('承認処理に失敗しました:', error);
            
            // カラムが存在しない場合の対応
            if (error.message.includes('approved_at') || error.message.includes('approved_by')) {
                console.warn('承認関連のカラムが存在しません。基本的な承認処理を実行します。');
                
                const { data: basicData, error: basicError } = await supabase
                    .from('shift_substitution_applications')
                    .update({ status: 'approved' })
                    .eq('id', applicationId)
                    .select();
                
                if (basicError) {
                    showNotification('承認に失敗しました', 'error');
                    return;
                }
            } else {
                showNotification('承認に失敗しました', 'error');
                return;
            }
        }
        
        // 他の申請を却下に変更
        try {
            let rejectData = { 
                status: 'rejected'
            };
            
            // カラムが存在する場合のみ追加
            try {
                rejectData.rejected_at = new Date().toISOString();
                rejectData.rejected_by = substitutionCurrentUser.id;
                rejectData.rejected_by_name = substitutionCurrentUser.full_name || substitutionCurrentUser.username;
            } catch (error) {
                console.warn('rejected_atカラムが存在しません。基本的な却下処理のみ実行します。');
            }
            
            await supabase
                .from('shift_substitution_applications')
                .update(rejectData)
                .eq('request_id', requestId)
                .neq('id', applicationId);
        } catch (rejectError) {
            console.warn('他の申請の却下処理に失敗しました:', rejectError);
            
            // 基本的な却下処理を試行
            try {
                await supabase
                    .from('shift_substitution_applications')
                    .update({ status: 'rejected' })
                    .eq('request_id', requestId)
                    .neq('id', applicationId);
            } catch (basicRejectError) {
                console.error('基本的な却下処理にも失敗しました:', basicRejectError);
            }
        }
        
        showNotification('代打申請を承認しました', 'success');
        
        // 代打依頼一覧を更新
        await loadSubstitutionRequests();
        
    } catch (error) {
        console.error('承認処理に失敗しました:', error);
        showNotification('承認に失敗しました', 'error');
    }
}

// 代打申請の却下
async function rejectApplication(applicationId, requestId) {
    try {
        if (!substitutionCurrentUser) {
            showNotification('ログインが必要です', 'error');
            return;
        }
        
        // 却下処理（rejected_atカラムが存在しない場合の対応）
        let updateData = { 
            status: 'rejected'
        };
        
        // カラムが存在する場合のみ追加
        try {
            updateData.rejected_at = new Date().toISOString();
            updateData.rejected_by = substitutionCurrentUser.id;
        } catch (error) {
            console.warn('rejected_atカラムが存在しません。基本的な却下処理のみ実行します。');
        }
        
        const { data, error } = await supabase
            .from('shift_substitution_applications')
            .update(updateData)
            .eq('id', applicationId)
            .select();
        
        if (error) {
            console.error('却下処理に失敗しました:', error);
            
            // カラムが存在しない場合の対応
            if (error.message.includes('rejected_at') || error.message.includes('rejected_by')) {
                console.warn('却下関連のカラムが存在しません。基本的な却下処理を実行します。');
                
                const { data: basicData, error: basicError } = await supabase
                    .from('shift_substitution_applications')
                    .update({ status: 'rejected' })
                    .eq('id', applicationId)
                    .select();
                
                if (basicError) {
                    showNotification('却下に失敗しました', 'error');
                    return;
                }
            } else {
                showNotification('却下に失敗しました', 'error');
                return;
            }
        }
        
        showNotification('代打申請を却下しました', 'success');
        
        // 代打依頼一覧を更新
        await loadSubstitutionRequests();
        
    } catch (error) {
        console.error('却下処理に失敗しました:', error);
        showNotification('却下に失敗しました', 'error');
    }
}

// 代打依頼のフィルタリング
function filterSubstitutionRequests() {
    const statusFilter = document.getElementById('substitution-status-filter').value;
    const dateFilter = document.getElementById('substitution-date-filter').value;
    
    let filteredRequests = substitutionRequests;
    
    if (statusFilter) {
        filteredRequests = filteredRequests.filter(request => {
            const applications = request.shift_substitution_applications || [];
            const hasApplications = applications.length > 0;
            
            if (statusFilter === 'waiting') return !hasApplications;
            if (statusFilter === 'pending') return hasApplications;
            return request.status === statusFilter;
        });
    }
    
    if (dateFilter) {
        filteredRequests = filteredRequests.filter(request => 
            request.shift_date === dateFilter
        );
    }
    
    displaySubstitutionRequests(filteredRequests);
}

// 従業員選択UIは廃止。onEmployeeSelectは不要になりました。

// 検索結果の表示
function displaySearchResults(schedules, date, searchName) {
    const container = document.getElementById('substitution-search-list');
    if (!container) return;
    
    if (schedules.length === 0) {
        container.innerHTML = `
            <div class="no-schedule">
                <i class="fas fa-calendar-times"></i>
                <p>「${searchName}」のシフトは見つかりませんでした</p>
            </div>
        `;
        return;
    }
    
    // 日付別にシフトをグループ化
    const schedulesByDate = {};
    schedules.forEach(schedule => {
        const dateKey = schedule.date;
        if (!schedulesByDate[dateKey]) {
            schedulesByDate[dateKey] = [];
        }
        schedulesByDate[dateKey].push(schedule);
    });
    
    // 日付別にシフトボタンを生成
    const dateSections = Object.keys(schedulesByDate).sort().map(dateKey => {
        const dateSchedules = schedulesByDate[dateKey];
        const scheduleButtons = dateSchedules.map(schedule => {
            console.log('シフトデータ処理:', {
                name: schedule.name,
                check_in_time: schedule.check_in_time,
                check_out_time: schedule.check_out_time,
                date: schedule.date
            });
            
            // 時間の形式を確認して正しく設定（9.25や20.5 → HH:mm へ正規化）
            const normalizeDotTime = (value) => {
                if (value == null) return '';
                let str = String(value).trim();
                if (/^\d{1,2}\.\d{1,2}$/.test(str)) {
                    const [h, mPart] = str.split('.');
                    const minutes = Math.round(parseFloat('0.' + mPart) * 60);
                    return `${String(parseInt(h, 10)).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                }
                if (/^\d{1,2}$/.test(str)) {
                    return `${String(parseInt(str, 10)).padStart(2, '0')}:00`;
                }
                return str;
            };

            let startTime = validateAndFormatTime(normalizeDotTime(schedule.check_in_time));
            let endTime = validateAndFormatTime(normalizeDotTime(schedule.check_out_time));
            
            const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : '';
            
            console.log('シフトボタン生成:', {
                name: schedule.name,
                startTime,
                endTime,
                date: schedule.date
            });
            
            return `
                <div class="schedule-button-item">
                    <button type="button" class="btn btn-outline-primary schedule-select-btn" 
                            onclick="selectScheduleForSubstitution('${schedule.name}', 'シフト勤務', '${startTime}', '${endTime}', '${schedule.date}')">
                        <div class="schedule-button-content">
                            <div class="employee-name">${schedule.name}</div>
                            <div class="task-name">シフト勤務</div>
                            ${timeRange ? `<div class="time-range">${timeRange}</div>` : ''}
                        </div>
                    </button>
                </div>
            `;
        }).join('');
        
        return `
            <div class="date-section">
                <h5>${formatDate(dateKey)}</h5>
                <div class="schedule-buttons-container">
                    ${scheduleButtons}
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = `
        <div class="search-results-header">
            <h4>「${searchName}」のシフト一覧</h4>
            <p>以下のシフトから選択して、代打依頼フォームに自動入力できます</p>
        </div>
        <div class="date-sections-container">
            ${dateSections}
        </div>
    `;
}

// シフト選択時の自動入力機能
function selectScheduleForSubstitution(employeeName, taskName, startTime, endTime, shiftDate) {
    // 代打依頼フォームの要素を取得
    const substitutionTimeStart = document.getElementById('substitution-time-start');
    const substitutionTimeEnd = document.getElementById('substitution-time-end');
    const substitutionShiftDate = document.getElementById('substitution-shift-date');
    
    console.log('シフト選択時の自動入力:', {
        employeeName,
        taskName,
        startTime,
        endTime,
        shiftDate,
        substitutionTimeStart: substitutionTimeStart?.id,
        substitutionTimeEnd: substitutionTimeEnd?.id
    });
    
    // 時間を設定（有効性チェック付き）
    if (substitutionTimeStart && startTime && startTime !== 'Inval' && startTime !== 'Invalid') {
        // HH:mm形式の正規表現で検証
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (timeRegex.test(startTime)) {
            substitutionTimeStart.value = startTime;
            console.log('開始時間を設定:', startTime, '要素:', substitutionTimeStart);
        } else {
            console.warn('無効な開始時間形式:', startTime);
        }
    } else {
        console.warn('開始時間の設定に失敗:', { startTime, element: substitutionTimeStart });
    }
    
    if (substitutionTimeEnd && endTime && endTime !== 'Inval' && endTime !== 'Invalid') {
        // HH:mm形式の正規表現で検証
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (timeRegex.test(endTime)) {
            substitutionTimeEnd.value = endTime;
            console.log('終了時間を設定:', endTime, '要素:', substitutionTimeEnd);
        } else {
            console.warn('無効な終了時間形式:', endTime);
        }
    } else {
        console.warn('終了時間の設定に失敗:', { endTime, element: substitutionTimeEnd });
    }

    // 日付を隠しフィールドに設定
    if (substitutionShiftDate && shiftDate) {
        substitutionShiftDate.value = shiftDate;
    }
    
    // 成功通知
    showNotification(`${employeeName}の${formatDate(shiftDate)}のシフトをフォームに設定しました`, 'success');
    
    // フォームまでスクロール
    const formSection = document.querySelector('.substitution-form-section');
    if (formSection) {
        formSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// ユーティリティ関数
function getStatusText(status) {
    const statusMap = {
        'pending': '承認待ち',
        'approved': '承認済み',
        'rejected': '却下',
        'waiting': '立候補待ち',
        'cancelled': 'キャンセル'
    };
    return statusMap[status] || status;
}
// 承認解除（approved -> pending）
async function unapproveApplication(applicationId) {
    try {
        if (!substitutionCurrentUser) {
            showNotification('ログインが必要です', 'error');
            return;
        }

        const { error } = await supabase
            .from('shift_substitution_applications')
            .update({ status: 'pending' })
            .eq('id', applicationId);

        if (error) {
            console.error('承認解除に失敗しました:', error);
            showNotification('承認解除に失敗しました', 'error');
            return;
        }

        showNotification('承認を解除しました', 'success');
        await loadSubstitutionRequests();
    } catch (error) {
        console.error('承認解除処理に失敗しました:', error);
        showNotification('承認解除に失敗しました', 'error');
    }
}

// 却下解除（rejected -> pending）
async function unrejectApplication(applicationId) {
    try {
        if (!substitutionCurrentUser) {
            showNotification('ログインが必要です', 'error');
            return;
        }

        const { error } = await supabase
            .from('shift_substitution_applications')
            .update({ status: 'pending' })
            .eq('id', applicationId);

        if (error) {
            console.error('却下解除に失敗しました:', error);
            showNotification('却下解除に失敗しました', 'error');
            return;
        }

        showNotification('却下を解除しました', 'success');
        await loadSubstitutionRequests();
    } catch (error) {
        console.error('却下解除処理に失敗しました:', error);
        showNotification('却下解除に失敗しました', 'error');
    }
}

// 時間形式の検証と変換
function validateAndFormatTime(timeValue) {
    console.log('validateAndFormatTime 入力値:', timeValue, '型:', typeof timeValue);
    
    if (!timeValue || timeValue === null || timeValue === undefined) {
        console.log('時間値が空です');
        return '';
    }
    
    // 文字列でない場合は文字列に変換
    if (typeof timeValue !== 'string') {
        timeValue = String(timeValue);
        console.log('文字列に変換:', timeValue);
    }
    
    // 既にHH:mm形式の場合
    if (timeValue.includes(':')) {
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (timeRegex.test(timeValue)) {
            console.log('有効なHH:mm形式:', timeValue);
            return timeValue;
        } else {
            console.warn('無効なHH:mm形式:', timeValue);
        }
    }
    
    // 数値形式の場合の処理（例: 20 → 20:00）
    if (/^\d+$/.test(timeValue)) {
        const numValue = parseInt(timeValue);
        if (numValue >= 0 && numValue <= 23) {
            // 時間として解釈（例: 20 → 20:00）
            const formattedTime = `${String(numValue).padStart(2, '0')}:00`;
            console.log('数値時間として変換:', timeValue, '→', formattedTime);
            return formattedTime;
        } else if (numValue >= 0 && numValue <= 2359) {
            // HHMM形式として解釈（例: 1430 → 14:30）
            const hours = Math.floor(numValue / 100);
            const minutes = numValue % 100;
            if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                console.log('HHMM形式として変換:', timeValue, '→', formattedTime);
                return formattedTime;
            }
        }
    }
    
    // 秒数形式の場合の変換
    try {
        console.log('秒数形式として変換を試行:', timeValue);
        const time = new Date(`1970-01-01T${timeValue}`);
        if (!isNaN(time.getTime())) {
            const formattedTime = time.toTimeString().substring(0, 5);
            console.log('変換成功:', timeValue, '→', formattedTime);
            return formattedTime;
        } else {
            console.warn('無効な日付オブジェクト:', timeValue);
        }
    } catch (error) {
        console.warn('時間変換エラー:', error, timeValue);
    }
    
    console.log('時間変換失敗、空文字列を返します');
    return '';
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function showNotification(message, type = 'info') {
    // 既存の通知システムを使用
    if (typeof showNotificationMessage === 'function') {
        showNotificationMessage(message, type);
    } else {
        console.log(`${type.toUpperCase()}: ${message}`);
    }
}

// シフト募集（旧実装）は削除しました。新実装は別ファイルで提供します。

// 現在のユーザーを取得
async function getCurrentUser() {
    try {
        // 1) アプリの現在ユーザーがあれば最優先
        if (window.currentUser && window.currentUser.id) {
            return window.currentUser;
        }

        // 2) ローカルストレージに保存されているユーザー
        const saved = localStorage.getItem('currentUser');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed && parsed.id) {
                    return parsed;
                }
            } catch (_) {}
        }

        // 3) Supabaseのセッションから取得
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: userData } = await supabase
                .from('users')
                .select('*')
                .eq('auth_id', user.id)
                .single();
            return userData || user;
        }
        return null;
    } catch (error) {
        console.error('ユーザー情報の取得に失敗しました:', error);
        return null;
    }
}
