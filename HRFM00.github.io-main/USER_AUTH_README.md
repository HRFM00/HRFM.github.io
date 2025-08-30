# ユーザー認証システム

このシステムは、Supabaseを使用したユーザー認証機能を提供します。

## セットアップ手順

### 1. Supabaseテーブルの作成

`create_users_table.sql` ファイルの内容をSupabaseのSQLエディタで実行してください。

```sql
-- ユーザーテーブルの作成
CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'staff' CHECK (role IN ('staff', 'administrator', 'developer')),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. サンプルページの使用

`login-test.html` をブラウザで開いて、ログイン処理の実験を行えます。

## 機能一覧

### ログインページ (`login-test.html`)

#### ログインタブ
- ユーザー名とパスワードでログイン
- テストログインボタン（admin/password123）
- ログイン情報の表示
- ログアウト機能

#### ユーザー登録タブ
- 新規ユーザーの登録
- 権限の選択（user/manager/admin）
- バリデーション機能

#### ハッシュ生成タブ
- パスワードハッシュの生成
- 他のサイトで生成したハッシュ値のテスト

## ユーティリティクラス (`user-auth-utils.js`)

### 主要メソッド

#### 認証関連
```javascript
// ログイン
const result = await userAuthUtils.login(username, password);

// ユーザー登録
const result = await userAuthUtils.registerUser({
    username: 'testuser',
    password: 'password123',
    full_name: 'テストユーザー',
    role: 'staff'
});

// パスワード変更
const result = await userAuthUtils.changePassword(userId, currentPassword, newPassword);
```

#### セッション管理
```javascript
// セッション保存
userAuthUtils.saveSession(userData);

// セッション取得
const user = userAuthUtils.getSession();

// セッションクリア
userAuthUtils.clearSession();
```

#### 権限管理
```javascript
// 権限チェック
const hasPermission = userAuthUtils.hasPermission(user, 'admin');

// 権限表示名取得
const roleName = userAuthUtils.getRoleDisplayName('admin'); // "管理者"
```

## パスワードハッシュについて

### 現在の実装
- 簡易版：CryptoJS.SHA256を使用
- 本格版：bcryptライブラリを使用（推奨）

### 他のサイトで生成したハッシュ値の使用

1. **bcryptハッシュ**の場合：
   ```javascript
   // 例：$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi
   // パスワード: "password123"
   ```

2. **SHA-256ハッシュ**の場合：
   ```javascript
   // 例：5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8
   // パスワード: "password"
   ```

### ハッシュ値の検証方法

1. `login-test.html` の「ハッシュ生成」タブを使用
2. パスワードを入力してハッシュ値を生成
3. 生成されたハッシュ値をデータベースに保存
4. ログイン時にハッシュ値を検証

## セキュリティ考慮事項

### 推奨事項
1. **bcrypt**を使用したパスワードハッシュ
2. HTTPS通信の使用
3. セッションタイムアウトの設定
4. 入力値のバリデーション
5. SQLインジェクション対策（Supabaseが自動対応）

### 実装例
```javascript
// bcryptライブラリの読み込み
<script src="https://cdnjs.cloudflare.com/ajax/libs/bcryptjs/2.4.3/bcrypt.min.js"></script>

// ハッシュ生成
const hash = await bcrypt.hash(password, 10);

// ハッシュ検証
const isValid = await bcrypt.compare(password, hash);
```

## テスト用データ

### サンプルユーザー
- **hirofumi@developer** / hrfm20031103 (開発者)

### テスト手順
1. `create_users_table.sql` を実行
2. `generate_hash.html` を開いてハッシュ値を生成
3. 生成されたハッシュ値でデータベースを更新
4. `login-test.html` を開く
5. ユーザー名: `hirofumi@developer`、パスワード: `hrfm20031103` でログイン
6. ログイン情報を確認

## トラブルシューティング

### よくある問題

1. **Supabase接続エラー**
   - `supabase-config.js` の設定を確認
   - URLとAPIキーが正しいか確認

2. **テーブルが見つからない**
   - `create_users_table.sql` が実行されているか確認
   - Supabaseダッシュボードでテーブルが存在するか確認

3. **ログインできない**
   - パスワードハッシュが正しく保存されているか確認
   - ユーザーが有効（is_active = true）か確認

### デバッグ方法

```javascript
// ブラウザのコンソールで確認
console.log('Supabase Client:', userAuthUtils.supabaseClient);

// セッション確認
console.log('Current Session:', userAuthUtils.getSession());

// ユーザー一覧取得
const result = await userAuthUtils.getAllUsers();
console.log('All Users:', result);
```

## 拡張機能

### 追加可能な機能
1. メール認証
2. パスワードリセット
3. 2段階認証
4. ログイン履歴
5. アカウントロック機能

### 実装例
```javascript
// メール認証
async function sendVerificationEmail(email) {
    // メール送信処理
}

// パスワードリセット
async function resetPassword(email) {
    // リセットトークン生成とメール送信
}
```

## ライセンス

このシステムはMITライセンスの下で提供されています。
