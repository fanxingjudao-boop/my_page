# プランC仕様の反映・確認手順書（誰でも実施可能）

この手順書は、`docs/top-page-spec-plan-c.md` の仕様を
**誰でも同じ手順で反映・確認できる**ようにするためのガイドです。

---

## 1. 対象ドキュメント
- 仕様本体: `docs/top-page-spec-plan-c.md`
- 本手順書: `docs/plan-c-reflect-and-verify-guide.md`

---

## 2. 前提条件
以下のどちらかが使えればOKです。

### A. 最小構成（推奨）
- Git
- Python 3（ローカルサーバ起動用）
- ブラウザ（Chrome / Edge / Firefox など）

### B. Node.js を使う場合（任意）
- Git
- Node.js 18+
- `npx serve` などの静的サーバ

---

## 3. 反映（ローカルで仕様を実装する時の標準フロー）

### Step 1: リポジトリ取得
```bash
git clone <このリポジトリURL>
cd my_page
```

### Step 2: 作業ブランチ作成
```bash
git checkout -b feat/plan-c-implementation
```

### Step 3: 仕様を読み、実装対象を分割
`docs/top-page-spec-plan-c.md` の「4.2 実装段階（推奨）」に沿って進める。

推奨順:
1. Phase 1: 情報設計 + Hero + Value + CTA
2. Phase 2: Projects動的化 + FAQ + 計測
3. Phase 3: CMS連携 + 多言語 + 最適化

### Step 4: 変更をコミット
```bash
git add .
git commit -m "Implement Plan C phase-<番号>"
```

---

## 4. 確認（誰でも同じ結果になる確認方法）

## 4-1. ローカル表示確認
プロジェクトルートで実行:
```bash
python3 -m http.server 8000
```

ブラウザで以下を開く:
- `http://localhost:8000/`

> サーバ停止は `Ctrl + C`。

---

## 4-2. 画面チェックリスト（仕様準拠確認）
`docs/top-page-spec-plan-c.md` のセクション仕様に対して以下を確認。

- [ ] ヘッダーが固定され、スクロール時に状態が変化する
- [ ] Heroで主訴求・副訴求・2つのCTAが明確
- [ ] Value Propositionがカードで読みやすい
- [ ] Social Proofで実績/信頼情報が視覚的に提示される
- [ ] Featured Projectsにフィルタがあり、切替が破綻しない
- [ ] Processが依頼フローとして理解できる
- [ ] Technology Stackがカテゴリ別で確認できる
- [ ] Pricing / Planで比較可能な情報が揃っている
- [ ] FAQの開閉が自然で、内容が実務的
- [ ] News/Insightが最新情報として表示される
- [ ] Contact CTAが明確で、問い合わせ導線が強い
- [ ] Footerに信頼情報・法務導線がある

---

## 4-3. レスポンシブ確認
ブラウザのデバイスモードで以下幅を確認。

- 375px（スマホ）
- 768px（タブレット）
- 1280px以上（PC）

確認観点:
- [ ] レイアウト崩れがない
- [ ] テキストが読める（改行/サイズ/行間）
- [ ] ボタンが押しやすい
- [ ] メニュー操作が成立する

---

## 4-4. アクセシビリティ最低確認
- [ ] `Tab` キーのみで主要導線に到達できる
- [ ] フォーカス位置が視認できる
- [ ] 色コントラストが低すぎない
- [ ] 動きが多い箇所で `prefers-reduced-motion` を考慮している

---

## 4-5. パフォーマンス確認（Lighthouse）
Chrome DevTools で実行:
1. F12 で DevTools を開く
2. 「Lighthouse」タブへ
3. Mobile を選択
4. Performance / Accessibility / Best Practices / SEO をチェック
5. Analyze page load

目標の目安（仕様書準拠）:
- LCP: 2.5s以内
- CLS: 0.1以下
- INP: 200ms以下（実運用で継続監視）

---

## 5. 反映結果の共有テンプレート（チーム向け）
実装者はPRに以下を貼ると、レビューが速くなります。

```md
## 実装フェーズ
- Phase: <1|2|3>

## 実装内容
- <変更1>
- <変更2>

## 仕様対応
- 対応セクション: 2.1, 2.2, 2.3 ...

## 確認結果
- ローカル表示: OK/NG
- レスポンシブ: OK/NG
- A11y簡易確認: OK/NG
- Lighthouse: Performance xx / Accessibility xx / Best Practices xx / SEO xx

## 補足
- 未対応事項 / 次PRで対応予定
```

---

## 6. よくある詰まりポイント

### Q1. `file://` で開くと一部動かない
A. 必ずローカルサーバ（`python3 -m http.server`）経由で確認してください。

### Q2. アニメーションが重い
A. 初回演出を短くし、重い処理は遅延実行。画像最適化とJS分割を優先。

### Q3. 何を優先して実装すべきか迷う
A. まずは Phase 1（Hero/Value/CTA）。第一印象と導線品質が最重要です。

---

## 7. 最短での確認コマンドまとめ
```bash
# 1) 取得
git clone <repo-url>
cd my_page

# 2) ローカルサーバ起動
python3 -m http.server 8000

# 3) ブラウザで確認
# http://localhost:8000/
```
