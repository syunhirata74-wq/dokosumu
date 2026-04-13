export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6 text-sm">
      <h1 className="text-xl font-bold">利用規約</h1>
      <p className="text-muted-foreground">最終更新日: 2026年4月14日</p>

      <section className="space-y-2">
        <h2 className="font-semibold">第1条（適用）</h2>
        <p>本規約は、「どこ住む？」（以下「本サービス」）の利用に関する条件を定めるものです。ユーザーは本規約に同意の上、本サービスを利用するものとします。</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">第2条（アカウント）</h2>
        <p>ユーザーは正確な情報を提供し、アカウントの管理責任を負います。アカウントの不正使用について運営者は責任を負いません。</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">第3条（禁止事項）</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>法令または公序良俗に違反する行為</li>
          <li>他のユーザーへの迷惑行為</li>
          <li>不正アクセスまたはサーバーに負荷をかける行為</li>
          <li>本サービスの運営を妨害する行為</li>
          <li>第三者の知的財産権を侵害する行為</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">第4条（サービスの変更・停止）</h2>
        <p>運営者は、事前の通知なくサービスの内容を変更、または提供を停止できるものとします。これによりユーザーに生じた損害について、運営者は責任を負いません。</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">第5条（免責事項）</h2>
        <p>本サービスで提供される家賃相場、通勤時間、周辺施設などの情報は参考値であり、正確性を保証するものではありません。不動産の契約判断はユーザー自身の責任で行ってください。</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">第6条（知的財産権）</h2>
        <p>本サービスに関する知的財産権は運営者に帰属します。ユーザーが投稿したコンテンツ（写真・コメント等）の著作権はユーザーに帰属しますが、本サービス内での表示に必要な範囲で運営者が利用できるものとします。</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">第7条（準拠法）</h2>
        <p>本規約は日本法に準拠します。</p>
      </section>
    </div>
  );
}
