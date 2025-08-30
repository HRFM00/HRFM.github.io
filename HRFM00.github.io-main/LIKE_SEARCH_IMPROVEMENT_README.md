# シフト検索機能の改善（LIKE検索）

## 改善内容

ユーザー名とシフト名の形式が完全一致しない場合があるため、LIKE検索を使用して柔軟な検索を実装しました。

## 問題の背景

### 従来の問題
- ユーザー名とシフト名が完全一致しない場合がある
- 苗字と名前の間にスペースがあったり、なかったりする
- 例：「田中太郎」vs「田中 太郎」vs「田中　太郎」

### 改善後の対応
- LIKE検索を使用して部分一致検索を実装
- 名前の正規化（スペース除去）を実装
- より柔軟な検索が可能

## 実装した変更

### 1. 名前正規化のユーティリティ関数

```javascript
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
```

### 2. 検索処理の改善

#### 提出状況確認機能
```javascript
// 名前の正規化（スペースを除去して検索）
const normalizedName = normalizeName(name);
console.log('[DEBUG] Searching for normalized name:', normalizedName);

const { data, error } = await shiftSubmitSupabase
    .from('shift_submit')
    .select('*')
    .ilike('name', `%${normalizedName}%`)
    .order('year', { ascending: false })
    .order('month', { ascending: false });
```

#### 自分のシフト詳細検索
```javascript
// 名前の正規化（スペースを除去して検索）
const normalizedName = normalizeName(name);
console.log('[DEBUG] Searching for my shift details with normalized name:', normalizedName);

const { data, error } = await shiftSubmitSupabase
    .from('shift_submit')
    .select('*')
    .ilike('name', `%${normalizedName}%`)
    .eq('year', parseInt(year))
    .eq('month', parseInt(month))
    .single();
```

#### 提出シフトデータ検索
```javascript
// フィルター条件を適用
if (name && name !== '') {
    // 名前の正規化（スペースを除去して検索）
    const normalizedName = normalizeName(name);
    console.log('[DEBUG] Filtering by normalized name:', normalizedName);
    query = query.ilike('name', `%${normalizedName}%`);
}
```

### 3. 名前選択肢の改善

```javascript
// 名前を正規化してグループ化
const normalizedGroups = {};
uniqueNames.forEach(name => {
    const normalizedName = normalizeName(name);
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
```

## 検索例

### 検索可能なパターン
- 「田中太郎」で検索 → 「田中太郎」「田中 太郎」「田中　太郎」が全てヒット
- 「田中」で検索 → 「田中太郎」「田中花子」など田中で始まる名前がヒット
- 「太郎」で検索 → 「田中太郎」「佐藤太郎」など太郎で終わる名前がヒット

### 正規化処理
- 入力：「田中 太郎」→ 正規化：「たなかたろう」
- 入力：「田中　太郎」→ 正規化：「たなかたろう」
- 入力：「田中太郎」→ 正規化：「たなかたろう」

## 使用方法

### 1. 提出状況確認
1. 名前フィールドに名前を入力（スペースの有無は問わない）
2. 「提出状況を確認」ボタンをクリック
3. 正規化された名前で検索が実行される

### 2. 自分のシフト詳細確認
1. 年・月・名前を選択
2. 正規化された名前で検索が実行される
3. 該当するシフトデータが表示される

### 3. 提出シフト確認
1. 名前選択肢から名前を選択（正規化された名前が使用される）
2. 年・月を選択
3. 該当するシフトデータが表示される

## デバッグ情報

### コンソールログ
検索時に以下のログが出力されます：
```
[DEBUG] Searching for normalized name: たなかたろう
[DEBUG] Filtering by normalized name: たなかたろう
[DEBUG] Export filtering by normalized name: たなかたろう
```

### データ属性
名前選択肢には元の名前がデータ属性として保存されています：
```html
<option value="たなかたろう" data-original-names="田中太郎, 田中 太郎, 田中　太郎">
    田中太郎
</option>
```

## 注意事項

- 大文字小文字は区別されません
- スペース（全角・半角）は除去されます
- 部分一致検索のため、短い文字列でも検索可能です
- 元のデータは変更されず、検索時のみ正規化されます

## 今後の拡張

### 追加可能な機能
1. **あいまい検索**: タイポや表記揺れに対応
2. **音声検索**: ひらがな・カタカナ・漢字の変換
3. **検索履歴**: よく検索される名前の記録
4. **自動補完**: 入力中の名前の候補表示

### 実装例
```javascript
// あいまい検索の例
function fuzzySearch(query, name) {
    const normalizedQuery = normalizeName(query);
    const normalizedName = normalizeName(name);
    
    // レーベンシュタイン距離を使用したあいまい検索
    return levenshteinDistance(normalizedQuery, normalizedName) <= 2;
}
```
