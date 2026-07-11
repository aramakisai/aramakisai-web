# Requirements Document

## ステータス: 見送り (2026-07-11)

既存のCloudflare/Directus管理画面等を都度確認する受動監視で障害検知として十分と判断し、能動的なエラー監視・アラート通知(Sentry / Discord webhook直POST等)の導入は見送る。そもそも能動監視の要否を検討すること自体が現時点では時期尚早だった。

恒久判断ではない。受動監視では検知が追いつかなくなった場合は、本spec(および `feature/error-monitoring` ブランチに保存済みのSentry版検討一式)を再開して再検討する。

Sentry版の実装(requirements/design/tasks含む検討一式)は `feature/error-monitoring` ブランチに `wip(error-monitoring)` コミットとして凍結保存済み(main未マージ、いつでも復元・再開可能)。

## Project Description (Input)
エラー監視/分析基盤導入: フロントエンド(Next.js/Cloudflare Pages, Edge Runtime制約あり)とDirectus側にエラートラッキング・分析(例: Sentry等)を導入し、本番障害の早期検知を可能にする。

## Requirements
<!-- 見送りのため未生成 -->
