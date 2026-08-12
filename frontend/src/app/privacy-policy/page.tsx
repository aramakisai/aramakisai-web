import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'プライバシーポリシー',
  description: '荒牧祭公式サイトのプライバシーポリシー',
};

const sectionClass = 'border-t border-slate-200/80 pt-10 sm:pt-12';
const sectionHeadingClass =
  'bg-none bg-clip-border p-0 text-2xl leading-snug font-bold tracking-wide text-slate-950 sm:text-3xl';
const sectionBodyClass =
  'mt-6 space-y-5 text-base leading-8 text-slate-700 sm:text-[1.0625rem] sm:leading-9';
const listClass = 'list-disc space-y-2 pl-6 marker:text-slate-400 sm:pl-7';

export default function PrivacyPolicyPage() {
  return (
    <main className="bg-white">
      <article className="mx-auto max-w-4xl min-w-0 px-6 py-16 text-slate-700 sm:px-8 sm:py-24 lg:py-28">
        <header>
          <h1 className="bg-none bg-clip-border p-0 text-4xl leading-tight font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            プライバシーポリシー
          </h1>
          <div
            aria-hidden="true"
            data-testid="privacy-title-line"
            className="mansai-spectrum-line mt-8 h-px w-full opacity-75"
          />
          <p className="mt-10 text-base leading-8 text-slate-700 sm:mt-12 sm:text-lg sm:leading-9">
            群馬大学荒牧祭実行委員会（以下「当実行委員会」といいます）は、荒牧祭公式サイトにおける利用者の情報の取扱いについて、以下のとおりプライバシーポリシーを定めます。
          </p>
        </header>

        <div className="mt-16 space-y-14 sm:mt-20 sm:space-y-16">
          <section
            aria-labelledby="privacy-information"
            className={sectionClass}
          >
            <h2 id="privacy-information" className={sectionHeadingClass}>
              1. 取得する情報
            </h2>
            <div className={sectionBodyClass}>
              <p>
                当実行委員会は、お問い合わせフォーム等を通じて、氏名、メールアドレス、お問い合わせ内容その他フォーム上で入力いただく情報を取得することがあります。
              </p>
              <p>
                また、当サイトにアクセスした際、Cookieその他の技術を利用して、閲覧したページ、利用日時、端末・ブラウザに関する情報等を取得する場合があります。
              </p>
            </div>
          </section>

          <section aria-labelledby="privacy-purpose" className={sectionClass}>
            <h2 id="privacy-purpose" className={sectionHeadingClass}>
              2. 利用目的
            </h2>
            <div className={sectionBodyClass}>
              <p>取得した情報は、以下の目的で利用します。</p>
              <ul className={listClass}>
                <li>お問い合わせへの回答および必要な連絡</li>
                <li>荒牧祭の運営に必要な範囲での確認、集計および分析</li>
                <li>当サイトの利用状況の把握</li>
                <li>当サイトの利便性および内容の改善</li>
                <li>その他、取得時に明示した目的</li>
              </ul>
              <p>
                取得した情報を、これらの目的を超えて利用することはありません。
              </p>
            </div>
          </section>

          <section
            aria-labelledby="privacy-management"
            className={sectionClass}
          >
            <h2 id="privacy-management" className={sectionHeadingClass}>
              3. 個人情報の管理
            </h2>
            <div className={sectionBodyClass}>
              <p>
                当実行委員会は、取得した個人情報について、不正アクセス、紛失、漏えい、改ざん等を防止するため、必要かつ適切な管理に努めます。
              </p>
              <p>
                また、利用目的を達成するために必要な範囲を超えて個人情報を保持しないよう努めます。
              </p>
            </div>
          </section>

          <section
            aria-labelledby="privacy-third-party"
            className={sectionClass}
          >
            <h2 id="privacy-third-party" className={sectionHeadingClass}>
              4. 第三者への提供
            </h2>
            <div className={sectionBodyClass}>
              <p>
                当実行委員会は、取得した個人情報を、次の場合を除き、本人の同意なく第三者に提供または開示しません。
              </p>
              <ul className={listClass}>
                <li>本人の同意がある場合</li>
                <li>法令に基づき提供または開示を求められた場合</li>
                <li>
                  人の生命、身体または財産の保護のために必要であり、本人の同意を得ることが困難な場合
                </li>
                <li>その他、法令上認められている場合</li>
              </ul>
            </div>
          </section>

          <section aria-labelledby="privacy-cookie" className={sectionClass}>
            <h2 id="privacy-cookie" className={sectionHeadingClass}>
              5. Cookieおよびアクセス解析について
            </h2>
            <div className={sectionBodyClass}>
              <p>
                当サイトでは、サイトの利用状況を把握し、内容や利便性を改善するため、Cookieその他の技術を使用する場合があります。
              </p>
              <p>
                当サイトではGoogle
                Analyticsを利用しており、Googleが提供する仕組みにより、端末・ブラウザに関する情報や当サイト上での利用状況等が収集されます。
              </p>
              <p>
                Cookieはブラウザの設定により無効にすることができます。ただし、Cookieを無効にした場合、当サイトまたは外部サービスの一部機能が正常に利用できない場合があります。
              </p>
            </div>
          </section>

          <section
            aria-labelledby="privacy-external-services"
            className={sectionClass}
          >
            <h2 id="privacy-external-services" className={sectionHeadingClass}>
              6. Google等の外部サービスについて
            </h2>
            <div className={sectionBodyClass}>
              <p>
                当サイトでは、利便性向上のため、以下をはじめとする外部サービスを利用または埋め込む場合があります。
              </p>
              <ul className={listClass}>
                <li>Google Forms</li>
                <li>Google Maps</li>
                <li>YouTube</li>
                <li>X</li>
                <li>Instagram</li>
              </ul>
              <p>
                これらのサービスを利用または表示した場合、各サービスの提供事業者に利用情報等が送信されることがあります。
              </p>
              <p>
                各サービスにおける情報の取扱いについては、それぞれのサービス提供事業者が定めるプライバシーポリシー等をご確認ください。
              </p>
            </div>
          </section>

          <section
            aria-labelledby="privacy-external-links"
            className={sectionClass}
          >
            <h2 id="privacy-external-links" className={sectionHeadingClass}>
              7. 外部サイトへのリンク
            </h2>
            <div className={sectionBodyClass}>
              <p>
                当サイトには、当実行委員会以外の第三者が運営するウェブサイトやサービスへのリンクが含まれる場合があります。
              </p>
              <p>
                リンク先のウェブサイトまたはサービスにおける情報の取扱いについて、当実行委員会は責任を負いません。リンク先が定めるプライバシーポリシー等をご確認ください。
              </p>
            </div>
          </section>

          <section
            aria-labelledby="privacy-disclaimer"
            className={sectionClass}
          >
            <h2 id="privacy-disclaimer" className={sectionHeadingClass}>
              8. 免責事項
            </h2>
            <div className={sectionBodyClass}>
              <p>
                当実行委員会は、当サイトに掲載する情報について、できる限り正確な情報を提供するよう努めますが、その正確性、完全性または最新性を保証するものではありません。
              </p>
              <p>
                当サイトの利用または当サイトに掲載された情報によって生じた損害について、当実行委員会は、法令上責任を負う場合を除き、責任を負いかねます。
              </p>
            </div>
          </section>

          <section aria-labelledby="privacy-changes" className={sectionClass}>
            <h2 id="privacy-changes" className={sectionHeadingClass}>
              9. プライバシーポリシーの変更
            </h2>
            <div className={sectionBodyClass}>
              <p>
                当実行委員会は、必要に応じて本ポリシーを変更することがあります。
              </p>
              <p>変更後の内容は、当サイト上に掲載した時点から適用します。</p>
            </div>
          </section>

          <section aria-labelledby="privacy-contact" className={sectionClass}>
            <h2 id="privacy-contact" className={sectionHeadingClass}>
              10. お問い合わせ
            </h2>
            <div className={sectionBodyClass}>
              <p>
                本ポリシーに関するお問い合わせは、当サイトの「お問い合わせ」からお問い合わせフォームをご利用ください。
              </p>
            </div>
          </section>
        </div>

        <p className="mt-16 border-t border-slate-200/80 pt-8 text-sm leading-7 text-slate-700 sm:mt-20">
          <strong>
            <span className="block">制定・最終更新：2026年8月12日</span>
            <span className="block">群馬大学荒牧祭実行委員会</span>
          </strong>
        </p>
      </article>
    </main>
  );
}
