// Supabase設定
const SUPABASE_CONFIG = {
    // SupabaseプロジェクトのURL（実際の値に置き換えてください）
    url: 'https://ppmbtoptcxelwewwompk.supabase.co',
    
    // Supabaseの匿名キー（実際の値に置き換えてください）
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwbWJ0b3B0Y3hlbHdld3dvbXBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwNjE0NjcsImV4cCI6MjA2OTYzNzQ2N30.Q01_d75sc3j362CMulQwkhtp0SuTzU86X2ElmXPU518'
};

// 
// 1. shiftテーブル（既存）
// CREATE TABLE shift (
//     id SERIAL PRIMARY KEY,
//     name TEXT NOT NULL,
//     date DATE NOT NULL,
//     check_in_time TEXT,
//     check_in_color TEXT,
//     check_out_time TEXT,
//     check_out_color TEXT,
//     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
//     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
// );
//
// 2. scheduleテーブル（新規作成が必要）
// CREATE TABLE schedule (
//     id SERIAL PRIMARY KEY,
//     date DATE NOT NULL,
//     employee_name TEXT NOT NULL,
//     task_name TEXT NOT NULL,
//     start_time TIME,
//     end_time TIME,
//     priority TEXT DEFAULT 'medium',
//     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
//     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
// );
//
// Supabaseダッシュボードで以下のSQLを実行してください:
// 
// -- スケジュールテーブルの作成
// CREATE TABLE public.schedule (
//     id BIGSERIAL PRIMARY KEY,
//     date DATE NOT NULL,
//     employee_name TEXT NOT NULL,
//     task_name TEXT NOT NULL,
//     start_time TIME,
//     end_time TIME,
//     priority TEXT DEFAULT 'medium',
//     created_at TIMESTAMPTZ DEFAULT NOW(),
//     updated_at TIMESTAMPTZ DEFAULT NOW()
// );
//
// -- RLSポリシーの設定（必要に応じて）
// ALTER TABLE public.schedule ENABLE ROW LEVEL SECURITY;
//
// -- 全ユーザーに読み書き権限を付与（開発用）
// CREATE POLICY "Enable all access for all users" ON public.schedule
//     FOR ALL USING (true) WITH CHECK (true);

// グローバルなSupabaseクライアントインスタンス（重複宣言を避ける）
if (typeof supabaseClient === 'undefined') {
    var supabaseClient = null;
}

// Supabaseクライアントの初期化
function createSupabaseClient() {
    // グローバルなクライアントインスタンスが既に存在する場合はそれを返す
    if (window.supabaseClient) {
        console.log('既存のSupabaseクライアントインスタンスを使用します');
        return window.supabaseClient;
    }
    
    // ローカル変数にクライアントが既に作成されている場合はそれを返す
    if (supabaseClient) {
        return supabaseClient;
    }
    
    // Supabaseライブラリが読み込まれているかチェック
    if (typeof window.supabase !== 'undefined') {
        try {
            // 新しいクライアントを作成（重複を避ける）
            if (!supabaseClient && !window.supabaseClient) {
                supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
                window.supabaseClient = supabaseClient; // グローバルに保存
                console.log('Supabaseクライアントが正常に初期化されました');
            } else if (window.supabaseClient) {
                supabaseClient = window.supabaseClient;
            }
            return supabaseClient;
        } catch (error) {
            console.error('Supabaseクライアントの作成に失敗しました:', error);
            return null;
        }
    } else {
        console.error('Supabaseライブラリが読み込まれていません。');
        return null;
    }
}

// グローバル関数としてエクスポート
window.createSupabaseClient = createSupabaseClient;

// 安全にSupabaseクライアントを取得する関数
function getSupabaseClient() {
    if (window.supabaseClient) {
        return window.supabaseClient;
    }
    return createSupabaseClient();
}

// グローバル関数としてエクスポート
window.getSupabaseClient = getSupabaseClient;

// 予算管理システム用のテーブル作成SQL
//
// 以下のSQLをSupabaseダッシュボードのSQLエディタで実行してください:
//
// -- 月次予算テーブル
// CREATE TABLE public.monthly_budgets (
//     id BIGSERIAL PRIMARY KEY,
//     year INTEGER NOT NULL,
//     month INTEGER NOT NULL,
//     revenue_target DECIMAL(12,2) DEFAULT 0,
//     expense_budget DECIMAL(12,2) DEFAULT 0,
//     staff_cost DECIMAL(12,2) DEFAULT 0,
//     utility_cost DECIMAL(12,2) DEFAULT 0,
//     material_cost DECIMAL(12,2) DEFAULT 0,
//     other_cost DECIMAL(12,2) DEFAULT 0,
//     notes TEXT,
//     created_at TIMESTAMPTZ DEFAULT NOW(),
//     updated_at TIMESTAMPTZ DEFAULT NOW(),
//     UNIQUE(year, month)
// );
//
// -- 曜日別予算テーブル
// CREATE TABLE public.weekly_budgets (
//     id BIGSERIAL PRIMARY KEY,
//     year INTEGER NOT NULL,
//     month INTEGER NOT NULL,
//     day_of_week TEXT NOT NULL CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
//     revenue_target DECIMAL(12,2) DEFAULT 0,
//     expense_budget DECIMAL(12,2) DEFAULT 0,
//     created_at TIMESTAMPTZ DEFAULT NOW(),
//     updated_at TIMESTAMPTZ DEFAULT NOW(),
//     UNIQUE(year, month, day_of_week)
// );
//
// -- RLSポリシーの設定（必要に応じて）
// ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;
// ALTER TABLE public.weekly_budgets ENABLE ROW LEVEL SECURITY;
//
// -- 全ユーザーに読み書き権限を付与（開発用）
// CREATE POLICY "Enable all access for monthly_budgets" ON public.monthly_budgets
//     FOR ALL USING (true) WITH CHECK (true);
//
// CREATE POLICY "Enable all access for weekly_budgets" ON public.weekly_budgets
//     FOR ALL USING (true) WITH CHECK (true);
//
// -- インデックスの追加（パフォーマンス向上のため）
// CREATE INDEX idx_monthly_budgets_year_month ON public.monthly_budgets(year, month);
// CREATE INDEX idx_weekly_budgets_year_month ON public.weekly_budgets(year, month);
// CREATE INDEX idx_weekly_budgets_day ON public.weekly_budgets(day_of_week);

// 設定の検証
function validateSupabaseConfig() {
    // 空の値やプレースホルダー値でないかチェック
    if (!SUPABASE_CONFIG.url || 
        !SUPABASE_CONFIG.anonKey || 
        SUPABASE_CONFIG.url === '' || 
        SUPABASE_CONFIG.anonKey === '' ||
        SUPABASE_CONFIG.url.includes('your-project-url') ||
        SUPABASE_CONFIG.anonKey.includes('your-anon-key')) {
        console.warn('Supabase設定が未設定です。supabase-config.jsを編集してください。');
        return false;
    }
    return true;
}
