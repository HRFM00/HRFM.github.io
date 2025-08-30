// ==================== シフト募集（新実装・最小版） ====================
(function(){
  let recruitUser = null;
  function getSBClient(){
    try {
      return (window.supabaseClient) || (typeof getSupabaseClient === 'function' ? getSupabaseClient() : null);
    } catch (_) { return window.supabaseClient || null; }
  }

  window.debugRecruitRole = () => logCurrentRecruitRole('manual');

  function logCurrentRecruitRole(context = '') {
    const cu = window.currentUser || null;
    const role = (cu && cu.role) || (recruitUser && recruitUser.role) || 'staff';
    console.log(`[recruit] role log${context ? ' - ' + context : ''}:`, {
      role,
      currentUser: cu,
      recruitUser
    });
  }

  // ロールのデバッグ出力
function logCurrentRecruitRole(context = '') {
  const cu = window.currentUser || null;
  const role = (cu && cu.role) || (recruitUser && recruitUser.role) || 'staff';
  console.log(`[recruit] role log${context ? ' - ' + context : ''}:`, { role, currentUser: cu, recruitUser });
}

// ログイン完了を待つウォッチャ（最大15秒）
let recruitRoleWatcher = null;
function startRecruitRoleWatcher() {
  if (recruitRoleWatcher) return;
  recruitRoleWatcher = setInterval(() => {
    if (window.currentUser && window.currentUser.role) {
      recruitUser = window.currentUser;
      logCurrentRecruitRole('roleWatcher→caught');
      applyRoleUI();
      loadList();
      clearInterval(recruitRoleWatcher);
      recruitRoleWatcher = null;
    }
  }, 500);
  setTimeout(() => {
    if (recruitRoleWatcher) {
      clearInterval(recruitRoleWatcher);
      recruitRoleWatcher = null;
      logCurrentRecruitRole('roleWatcher timeout');
    }
  }, 15000);
}

// Supabaseの認証状態監視（あれば利用）
(function bindAuthChange() {
  try {
    const client = (window.supabaseClient || (window.supabase && window.supabase)); // どちらでも
    if (client && client.auth && typeof client.auth.onAuthStateChange === 'function') {
      client.auth.onAuthStateChange((_evt, _session) => {
        recruitUser = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || 'null');
        logCurrentRecruitRole('authStateChange');
        applyRoleUI();
        loadList();
      });
    }
  } catch (e) {
    console.warn('[recruit] bindAuthChange failed', e);
  }
})();

async function initRecruit() {
  recruitUser = (window.currentUser) || JSON.parse(localStorage.getItem('currentUser')||'null');
  logCurrentRecruitRole('initRecruit');
  startRecruitRoleWatcher(); // ← これを追加
  setupEvents();
  await loadList();
  applyRoleUI();
}

  function setupEvents() {
    const form = document.getElementById('recruit2-form');
    if (form) {
      form.addEventListener('submit', onCreate);
    }
  }

  function applyRoleUI() {
    // 最新のログイン情報を優先
    recruitUser = window.currentUser || recruitUser || JSON.parse(localStorage.getItem('currentUser') || 'null');
    const role = (window.currentUser && window.currentUser.role) || 'staff';
    logCurrentRecruitRole('applyRoleUI');
  
    const create = document.getElementById('recruit2-create');
    if (create) create.style.display = (role === 'administrator' || role === 'developer') ? 'block' : 'none';
  }

  async function onCreate(e) {
    e.preventDefault();
    const role = (recruitUser && recruitUser.role) || 'staff';
    if (!(role === 'administrator' || role === 'developer')) return;

    const client = getSBClient();
    if (!client) { console.error('[recruit] Supabase client not initialized'); if (window.showNotification) showNotification('データベース接続が未初期化です', 'error'); return; }

    const payload = {
      shift_date: document.getElementById('recruit2-date')?.value,
      shift_time_start: document.getElementById('recruit2-start')?.value,
      shift_time_end: document.getElementById('recruit2-end')?.value,
      quota: parseInt(document.getElementById('recruit2-quota')?.value||'1',10),
      note: document.getElementById('recruit2-note')?.value || null,
      status: 'open',
      created_by_id: recruitUser?.id,
      created_by_name: (recruitUser?.full_name || recruitUser?.username)
    };
    if (!payload.shift_date || !payload.shift_time_start || !payload.shift_time_end || !payload.quota) return;

    const { error } = await client.from('shift_recruitments').insert([payload]);
    if (!error) {
      e.target.reset();
      await loadList();
      if (window.showNotification) showNotification('募集を作成しました', 'success');
    } else {
      console.error('recruit create error', error);
      if (window.showNotification) showNotification('募集の作成に失敗しました', 'error');
    }
  }

  async function loadList() {
    const listEl = document.getElementById('recruit2-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loading">読み込み中...</div>';
    const client = getSBClient();
    if (!client) { console.error('[recruit] Supabase client not initialized'); listEl.innerHTML = '<div class="no-data">読み込みに失敗しました</div>'; return; }
    const { data, error } = await client
      .from('shift_recruitments')
      .select(`
        *,
        shift_recruitment_applications (
          id,
          applicant_id,
          applicant_name,
          status,
          created_at
        )
      `)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('recruit load error', error);
      listEl.innerHTML = '<div class="no-data">読み込みに失敗しました</div>';
      return;
    }
    renderList(listEl, data || []);
  }

  function renderList(container, items) {
    if (items.length === 0) {
      container.innerHTML = '<div class="no-data">現在、募集中のシフトはありません</div>';
      return;
    }
    logCurrentRecruitRole('renderList');
    const role =
      (window.currentUser && window.currentUser.role) ||
      (recruitUser && recruitUser.role) ||
      'staff';
    const manager = role === 'administrator' || role === 'developer';
    const currentUserId = (window.currentUser && window.currentUser.id) || null;

    const html = items.map(rec => {
      const recId = rec.id;
      const quota = rec.quota || 0;
      const status = rec.status || 'open';
      const note = rec.note ? String(rec.note) : '';
      const dateStr = formatDate(rec.shift_date);
      const timeStr = [rec.shift_time_start, rec.shift_time_end].filter(Boolean).join(' - ');

      const apps = Array.isArray(rec.shift_recruitment_applications) ? rec.shift_recruitment_applications : [];
      const alreadyApplied = !!currentUserId && apps.some(a => String(a.applicant_id) === String(currentUserId));
      const appsHtml = apps.map(app => {
        const st = app.status || 'pending';
        const stClass = st;
        const actions = manager ? buildActionsHTML(st, app.id, recId, manager) : '';
        const created = formatDateTime(app.created_at);
        const name = app.applicant_name || '匿名';
        return `
          <div class="application-item ${stClass}" data-app-id="${app.id}" data-rec-id="${recId}">
            <div class="application-main">
              <span class="application-name">${name}</span>
              <span class="application-status ${stClass}">${statusText(st)}</span>
              <span class="application-created">${created}</span>
            </div>
            <div class="application-actions">${actions}</div>
          </div>
        `;
      }).join('');
      let actionsHTML = '';
      if (manager) {
        actionsHTML = `<button type="button" class="btn btn-sm btn-danger" onclick="window.deleteRecruitment2(${recId})"><i class="fas fa-trash"></i> 削除</button>`;
      } else if (status === 'open') {
        if (alreadyApplied) {
          actionsHTML = `<button type="button" class="btn btn-sm btn-secondary" disabled><i class="fas fa-check"></i> 立候補済み</button>`;
        } else {
          actionsHTML = `<button type="button" class="btn btn-sm btn-primary" onclick="window.applyForRecruit2(${recId})"><i class="fas fa-hand-paper"></i> 立候補</button>`;
        }
      }

      return `
        <div class="recruit2-item" data-rec-id="${recId}">
          <div class="recruit2-row">
            <div class="recruit2-time">${dateStr} ${timeStr}</div>
            <div class="recruit2-badge">定員: ${quota}</div>
            ${note ? `<div class="recruit2-note">${note}</div>` : ''}
            <div class="recruit2-actions">${actionsHTML}</div>
          </div>
          <div class="recruit2-applications">
            ${appsHtml || '<div class="no-apps">まだ立候補はありません</div>'}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }

  function formatDate(dateStr){
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ja-JP');
  }

  function formatDateTime(dt){
    if (!dt) return '';
    const d = new Date(dt);
    return d.toLocaleString('ja-JP');
  }

  function statusText(s){
    const map = { pending: '承認待ち', approved: '承認', rejected: '却下' };
    return map[s] || s;
  }

  // 募集削除（管理者・開発者のみ）
  window.deleteRecruitment2 = async function(recId) {
    try {
      if (!isManager()) { if (window.showNotification) showNotification('削除権限がありません', 'error'); return; }
      if (!recId) return;
      const ok = await (window.confirmAsync ? window.confirmAsync('この募集を削除しますか？関連する立候補も削除されます。') : Promise.resolve(confirm('この募集を削除しますか？関連する立候補も削除されます。')));
      if (!ok) return;

      const client = getSBClient();
      if (!client) { if (window.showNotification) showNotification('データベース接続が未初期化です', 'error'); return; }

      // 先に関連応募を削除
      const delApps = await client
        .from('shift_recruitment_applications')
        .delete()
        .eq('recruitment_id', recId);
      if (delApps.error) {
        console.warn('applications delete error', delApps.error);
      }

      // 募集本体を削除
      const delRec = await client
        .from('shift_recruitments')
        .delete()
        .eq('id', recId);
      if (delRec.error) {
        console.error('recruitment delete error', delRec.error);
        if (window.showNotification) showNotification('募集の削除に失敗しました', 'error');
        return;
      }

      // DOMから即時削除
      const node = document.querySelector(`.recruit2-item[data-rec-id="${recId}"]`);
      if (node && node.parentElement) {
        node.parentElement.removeChild(node);
      }
      if (window.showNotification) showNotification('募集を削除しました', 'success');
    } catch (err) {
      console.error('delete recruitment exception', err);
      if (window.showNotification) showNotification('募集の削除に失敗しました', 'error');
    }
  }

  // タブ切替時の再初期化（保険）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRecruit);
  } else {
    initRecruit();
  }

  function buildActionsHTML(status, appId, recId, isManager) {
    if (!isManager) return '';
    if (status === 'pending') {
      return `
        <button class="btn btn-sm btn-success" onclick="window.approveRecruitApp2(${appId}, ${recId})"><i class="fas fa-check"></i> 承認</button>
        <button class="btn btn-sm btn-danger" onclick="window.rejectRecruitApp2(${appId}, ${recId})"><i class="fas fa-times"></i> 却下</button>
      `;
    }
    if (status === 'approved') {
      return `<button class="btn btn-sm btn-warning" onclick="window.unapproveRecruitApp2(${appId})"><i class="fas fa-undo"></i> 承認解除</button>`;
    }
    if (status === 'rejected') {
      return `<button class="btn btn-sm btn-warning" onclick="window.unrejectRecruitApp2(${appId})"><i class="fas fa-undo"></i> 却下解除</button>`;
    }
    return '';
  }
  
  function updateRowStatus(appId, newStatus, recId = null, afterApproveCheckQuota = false) {
    const row = document.querySelector(`.application-item[data-app-id="${appId}"]`);
    if (!row) return;
    row.classList.remove('pending','approved','rejected');
    row.classList.add(newStatus);
    const statusSpan = row.querySelector('.application-status');
    if (statusSpan) {
      statusSpan.classList.remove('pending','approved','rejected');
      statusSpan.classList.add(newStatus);
      statusSpan.textContent = statusText(newStatus);
    }
    const actions = row.querySelector('.application-actions');
    const effectiveRecId = recId || row.getAttribute('data-rec-id');
    if (actions) actions.innerHTML = buildActionsHTML(newStatus, appId, effectiveRecId, isManager());
  
    if (afterApproveCheckQuota && effectiveRecId) {
      autoRejectPendingInDOMIfQuotaReached(effectiveRecId);
    }
  }
  
  async function autoRejectPendingInDOMIfQuotaReached(recId) {
    try {
      const client = getSBClient();
      if (!client) return;
      const { data: rec } = await client
        .from('shift_recruitments')
        .select('id, quota')
        .eq('id', recId)
        .maybeSingle();
      if (!rec || !rec.quota) return;
      
      const { data: approvedApps } = await client
        .from('shift_recruitment_applications')
        .select('id')
        .eq('recruitment_id', recId)
        .eq('status', 'approved');
      const approvedCount = (approvedApps || []).length;
      if (approvedCount >= rec.quota) {
        document
          .querySelectorAll(`.recruit2-item[data-rec-id="${recId}"] .application-item.pending`)
          .forEach(row => {
            row.classList.remove('pending');
            row.classList.add('rejected');
            const s = row.querySelector('.application-status');
            if (s) { s.classList.remove('pending'); s.classList.add('rejected'); s.textContent = statusText('rejected'); }
            const appId = row.getAttribute('data-app-id');
            const actions = row.querySelector('.application-actions');
            if (actions) actions.innerHTML = buildActionsHTML('rejected', appId, recId, isManager());
          });
      }
    } catch (_) {}
  }

  // 立候補処理（全ロール可／重複不可）
  window.applyForRecruit2 = async function(recruitmentId) {
    try {
      const user = recruitUser || (window.currentUser) || JSON.parse(localStorage.getItem('currentUser')||'null');
      if (!user) { if (window.showNotification) showNotification('ログインが必要です', 'error'); return; }
      const client = getSBClient();
      if (!client) { console.error('[recruit] Supabase client not initialized'); if (window.showNotification) showNotification('データベース接続が未初期化です', 'error'); return; }
      
      // 重複応募チェック
      const { data: existing } = await client
        .from('shift_recruitment_applications')
        .select('id, status')
        .eq('recruitment_id', recruitmentId)
        .eq('applicant_id', user.id)
        .maybeSingle();
      if (existing) {
        if (window.showNotification) showNotification('この募集には既に立候補済みです', 'warning');
        const btn = document.querySelector(`.recruit2-item[data-rec-id="${recruitmentId}"] .recruit2-actions button`);
        if (btn) { btn.disabled = true; btn.classList.remove('btn-primary'); btn.classList.add('btn-secondary'); btn.innerHTML = '<i class="fas fa-check"></i> 立候補済み'; }
        return;
      }
      // 募集の定員確認
      const { data: rec } = await client
        .from('shift_recruitments')
        .select('id, quota, status')
        .eq('id', recruitmentId)
        .maybeSingle();
      let desiredStatus = 'pending';
      if (rec) {
        const { data: approvedApps } = await client
          .from('shift_recruitment_applications')
          .select('id')
          .eq('recruitment_id', recruitmentId)
          .eq('status', 'approved');
        const approvedCount = (approvedApps || []).length;
        if (rec.status === 'closed' || (rec.quota && approvedCount >= rec.quota)) {
          desiredStatus = 'rejected';
        }
      }

      const payload = {
        recruitment_id: recruitmentId,
        applicant_id: user.id,
        applicant_name: (user.full_name || user.username || 'ユーザー'),
        status: desiredStatus
      };
      const { error } = await client.from('shift_recruitment_applications').insert([payload]);
      if (error) { console.error('apply error', error); if (window.showNotification) showNotification('立候補に失敗しました', 'error'); return; }
      if (window.showNotification) {
        if (desiredStatus === 'pending') showNotification('立候補しました（承認待ち）', 'success');
        else showNotification('募集は定員に達しているため、立候補は自動で却下されました', 'warning');
      }
      // 再ロードせずにDOMを即時更新
      const parent = document.querySelector(`.recruit2-item[data-rec-id="${recruitmentId}"]`);
      if (parent) {
        // ボタン更新
        const btn = parent.querySelector('.recruit2-actions button');
        if (btn) { btn.disabled = true; btn.classList.remove('btn-primary'); btn.classList.add('btn-secondary'); btn.innerHTML = '<i class="fas fa-check"></i> 立候補済み'; }
        // 申請行を先頭に追加
        const appsEl = parent.querySelector('.recruit2-applications');
        if (appsEl) {
          const empty = appsEl.querySelector('.no-apps');
          if (empty) empty.remove();
          const createdNow = formatDateTime(new Date());
          const newItem = document.createElement('div');
          newItem.className = `application-item ${desiredStatus}`;
          newItem.setAttribute('data-app-id', 'temp');
          newItem.setAttribute('data-rec-id', String(recruitmentId));
          newItem.innerHTML = `
            <div class="application-main">
              <span class="application-name">${payload.applicant_name}</span>
              <span class="application-status ${desiredStatus}">${statusText(desiredStatus)}</span>
              <span class="application-created">${createdNow}</span>
            </div>
            <div class="application-actions"></div>
          `;
          appsEl.prepend(newItem);
        }
      }
    } catch (e) {
      console.error('apply exception', e);
      if (window.showNotification) showNotification('立候補に失敗しました', 'error');
    }
  }

  // 承認/却下（管理者・開発者のみ）
  function isManager() {
    logCurrentRecruitRole('isManager'); // ← これを追加（任意）
    const role = (window.currentUser && window.currentUser.role) || (recruitUser && recruitUser.role) || 'staff';
    return role === 'administrator' || role === 'developer';
  }

  async function safeUpdateApplication(values, id) {
    // 付加カラムが無い場合に備えてフォールバック
    const client = getSBClient();
    if (!client) return { error: new Error('Supabase client not initialized') };
    let { error } = await client.from('shift_recruitment_applications').update(values).eq('id', id);
    if (error) {
      // 余分なカラムで失敗しそうな場合は status のみ
      if (values.status) {
        const res = await client.from('shift_recruitment_applications').update({ status: values.status }).eq('id', id);
        error = res.error;
      }
    }
    return { error };
  }

  window.approveRecruitApp2 = async function(appId, recId) {
    if (!isManager()) { if (window.showNotification) showNotification('承認権限がありません', 'error'); return; }
    const client = getSBClient();
    if (!client) { if (window.showNotification) showNotification('データベース接続が未初期化です', 'error'); return; }
    const values = {
      status: 'approved',
      approved_by_id: recruitUser?.id,
      approved_by_name: (recruitUser?.full_name || recruitUser?.username)
    };
    const { error } = await safeUpdateApplication(values, appId);
    if (error) { console.error('approve error', error); if (window.showNotification) showNotification('承認に失敗しました', 'error'); return; }
    if (window.showNotification) showNotification('承認しました', 'success');
  
    // DOM即時反映 + 定員到達チェック→残りpendingをDOM上でreject
    updateRowStatus(appId, 'approved', recId, true);
  
    // サーバ側も自動却下&クローズ（既存のロジックはそのまま）
    try {
      const { data: rec } = await client
        .from('shift_recruitments')
        .select('id, quota')
        .eq('id', recId)
        .maybeSingle();
      if (rec && rec.quota) {
        const { data: approvedApps } = await client
          .from('shift_recruitment_applications')
          .select('id')
          .eq('recruitment_id', recId)
          .eq('status', 'approved');
        const approvedCount = (approvedApps || []).length;
        if (approvedCount >= rec.quota) {
          await client
            .from('shift_recruitment_applications')
            .update({ status: 'rejected' })
            .eq('recruitment_id', recId)
            .eq('status', 'pending');
          await client
            .from('shift_recruitments')
            .update({ status: 'closed' })
            .eq('id', recId);
          if (window.showNotification) showNotification('定員に達したため残りの立候補は自動で却下されました', 'info');
        }
      }
    } catch (err) {
      console.warn('auto reject on quota failed', err);
    }
  };

  window.rejectRecruitApp2 = async function(appId, recId) {
    if (!isManager()) { if (window.showNotification) showNotification('却下権限がありません', 'error'); return; }
    const client = getSBClient();
    if (!client) { if (window.showNotification) showNotification('データベース接続が未初期化です', 'error'); return; }
    const values = {
      status: 'rejected',
      rejected_by_id: recruitUser?.id,
      rejected_by_name: (recruitUser?.full_name || recruitUser?.username)
    };
    const { error } = await safeUpdateApplication(values, appId);
    if (error) { console.error('reject error', error); if (window.showNotification) showNotification('却下に失敗しました', 'error'); return; }
    if (window.showNotification) showNotification('却下しました', 'success');
    updateRowStatus(appId, 'rejected', recId, false);
  };

  window.unapproveRecruitApp2 = async function(appId) {
    if (!isManager()) { if (window.showNotification) showNotification('承認解除権限がありません', 'error'); return; }
    const client = getSBClient();
    if (!client) { if (window.showNotification) showNotification('データベース接続が未初期化です', 'error'); return; }
    const { error } = await safeUpdateApplication({ status: 'pending' }, appId);
    if (error) { console.error('unapprove error', error); if (window.showNotification) showNotification('承認解除に失敗しました', 'error'); return; }
    if (window.showNotification) showNotification('承認を解除しました', 'success');
    updateRowStatus(appId, 'pending');
  };

  window.unrejectRecruitApp2 = async function(appId) {
    if (!isManager()) { if (window.showNotification) showNotification('却下解除権限がありません', 'error'); return; }
    const client = getSBClient();
    if (!client) { if (window.showNotification) showNotification('データベース接続が未初期化です', 'error'); return; }
    const { error } = await safeUpdateApplication({ status: 'pending' }, appId);
    if (error) { console.error('unreject error', error); if (window.showNotification) showNotification('却下解除に失敗しました', 'error'); return; }
    if (window.showNotification) showNotification('却下を解除しました', 'success');
    updateRowStatus(appId, 'pending');
  };
})();
