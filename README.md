# 補助金ポータル（サンプル）

補助金の検索・絞り込み・詳細表示ができる静的サイトです（HTML + JavaScript、バックエンド不要）。

- `index.html` トップ（検索フォーム・新着一覧）
- `search.html` 検索結果（絞り込み・並び替え・ページ送り）
- `detail.html?id=...` 詳細
- `data/subsidies.json` 補助金データ（現在はサンプル13件） / `data/master.json` 都道府県・業種・カテゴリ

## 起動
`fetch` でJSONを読むため、HTTPサーバー経由で開いてください。

```
python3 -m http.server 8000   # http://localhost:8000/
```

## データの追加
`data/subsidies.json` の `subsidies` に1件追加するだけで、一覧・検索・詳細に反映されます。
状態（公募中/公募前/終了）は `startDate` と `deadline` から自動判定します。
