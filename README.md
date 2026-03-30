# APC Vote — 優秀作品投票システム

## 起動方法

### Docker (推奨)

```bash
# ビルド & 起動
docker compose up -d --build

# ログ確認
docker compose logs -f

# 停止
docker compose down

# データを保持したまま停止・再起動
docker compose restart
```

ブラウザで http://localhost:3000 を開く。

### ローカル開発

```bash
npm install
npm run dev
```

---

## ページ一覧

| URL | 内容 |
|-----|------|
| `/` | 投票ページ |
| `/admin` | 管理者設定（パスワード: `admin1234`） |
| `/admin/votes` | 投票内容確認・無効票削除 |
| `/results` | 投票結果（管理者パスワード必要） |
| `/announce` | 結果発表（管理者パスワード必要） |

## データ永続化

投票データ・設定は Docker Volume `apc-vote-data` に保存されます。
コンテナを削除してもデータは保持されます。

```bash
# データのバックアップ
docker run --rm -v apc-vote-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/vote-data-backup.tar.gz /data

# データ完全削除
docker compose down -v
```
