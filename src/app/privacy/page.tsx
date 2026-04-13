export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6 text-sm">
      <h1 className="text-xl font-bold">プライバシーポリシー</h1>
      <p className="text-muted-foreground">最終更新日: 2026年4月14日</p>

      <section className="space-y-2">
        <h2 className="font-semibold">1. 収集する情報</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>アカウント情報:</strong> メールアドレス、パスワード（ハッシュ化して保存）</li>
          <li><strong>LINE連携情報:</strong> LINEの表示名、プロフィール画像URL（ユーザーの許可を得て取得）</li>
          <li><strong>利用データ:</strong> 登録した町、評価、コメント、スポット写真</li>
          <li><strong>自動取得情報:</strong> アクセス日時、ブラウザ情報</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">2. 情報の利用目的</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>本サービスの提供・運営</li>
          <li>カップル間でのデータ共有</li>
          <li>サービスの改善・新機能開発</li>
          <li>お問い合わせへの対応</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">3. 情報の第三者提供</h2>
        <p>以下の場合を除き、個人情報を第三者に提供しません。</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>ユーザーの同意がある場合</li>
          <li>法令に基づく場合</li>
          <li>人の生命・身体・財産の保護に必要な場合</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">4. 外部サービスの利用</h2>
        <p>本サービスは以下の外部サービスを利用しています。</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Supabase:</strong> データベース・認証（<a href="https://supabase.com/privacy" className="text-primary underline">プライバシーポリシー</a>）</li>
          <li><strong>LINE:</strong> ログイン・Bot連携（<a href="https://line.me/ja/terms/policy/" className="text-primary underline">プライバシーポリシー</a>）</li>
          <li><strong>Google Places API:</strong> 周辺施設検索（<a href="https://policies.google.com/privacy" className="text-primary underline">プライバシーポリシー</a>）</li>
          <li><strong>Vercel:</strong> ホスティング（<a href="https://vercel.com/legal/privacy-policy" className="text-primary underline">プライバシーポリシー</a>）</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">5. データの保管</h2>
        <p>ユーザーデータはSupabase（AWS）のサーバーに保管されます。適切なセキュリティ対策を講じていますが、完全なセキュリティを保証するものではありません。</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">6. ユーザーの権利</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>アカウント情報の確認・修正</li>
          <li>アカウントの削除（設定ページから可能）</li>
          <li>データのエクスポート（お問い合わせにて対応）</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">7. お問い合わせ</h2>
        <p>プライバシーに関するお問い合わせは、アプリ内の設定ページからご連絡ください。</p>
      </section>
    </div>
  );
}
