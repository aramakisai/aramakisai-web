import Image from 'next/image';

const campusMapUrl =
  'https://www.google.com/maps/embed?origin=mfe&pb=!1m2!2m1!1z576k6aas5aSn5a2mIOiNkueJp-OCreODo-ODs-ODkeOCuSDjgJIzNzEtODUxMCDnvqTppqznnIzliY3mqYvluILojZLniafnlLo05LiB55uuMg';

export function AboutSection() {
  return (
    <section
      id="about"
      aria-labelledby="about-title"
      className="scroll-mt-24 bg-white"
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-32">
        <header className="mb-14 sm:mb-20 lg:mb-28">
          <h2
            id="about-title"
            aria-label="荒牧祭について"
            className="flex flex-wrap items-center gap-x-4 gap-y-3 bg-none bg-clip-border p-0 text-slate-950"
          >
            <Image
              src="/images/aramakisai.png"
              alt="荒牧祭"
              width={1500}
              height={606}
              sizes="(min-width: 1024px) 198px, (min-width: 640px) 178px, 158px"
              className="h-16 w-auto shrink-0 object-contain sm:h-[4.5rem] lg:h-20"
            />
            <span className="text-3xl leading-none font-black tracking-tight sm:text-4xl lg:text-5xl">
              について
            </span>
          </h2>
          <span
            data-testid="section-divider"
            aria-hidden="true"
            className="mansai-spectrum-line mt-8 block h-px w-full opacity-60"
          />
        </header>

        <div className="space-y-20 sm:space-y-24 lg:space-y-36">
          <section
            id="about-overview"
            aria-labelledby="about-overview-title"
            className="grid grid-cols-1 scroll-mt-24 gap-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-16"
          >
            <h3
              id="about-overview-title"
              className="flex items-baseline gap-5 bg-none bg-clip-border p-0 text-slate-950"
            >
              <span className="mansai-spectrum-text bg-clip-text text-6xl leading-none font-light tracking-tighter text-transparent opacity-65 lg:text-8xl">
                01
              </span>
              <span className="text-2xl tracking-wide lg:text-3xl">概要</span>
            </h3>

            <div className="min-w-0 max-w-4xl">
              <div className="max-w-3xl space-y-6 text-base leading-8 text-slate-700 lg:text-lg lg:leading-9">
                <p className="text-xl leading-9 font-semibold text-slate-950 lg:text-2xl lg:leading-10">
                  群馬大学・荒牧キャンパスを彩る、年に一度の学園祭。
                </p>
                <p>
                  荒牧祭は、群馬大学荒牧キャンパスで毎年秋に開催される学園祭です。
                </p>
                <p>
                  2026年で第73回を迎え、学生による模擬店や教室展示、ステージ発表をはじめ、実行委員会企画やゲスト企画など、キャンパス全体でさまざまな企画が行われます。
                </p>
                <p>昨年度は8,989人の方にご来場いただきました。</p>
                <p>
                  長く受け継がれてきた荒牧祭の伝統を大切にしながら、今年も学生一人ひとりの個性と想いが集まる、特別な2日間をつくりあげます。
                </p>
              </div>
            </div>
          </section>

          <section
            id="about-schedule"
            aria-labelledby="about-schedule-title"
            className="relative grid grid-cols-1 scroll-mt-24 gap-10 pt-16 sm:pt-20 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-16 lg:pt-28"
          >
            <span
              data-testid="section-divider"
              aria-hidden="true"
              className="mansai-spectrum-line absolute inset-x-0 top-0 h-px opacity-60"
            />
            <h3
              id="about-schedule-title"
              className="flex items-baseline gap-5 bg-none bg-clip-border p-0 text-slate-950 lg:flex-col lg:items-start lg:gap-4"
            >
              <span className="mansai-spectrum-text bg-clip-text text-6xl leading-none font-light tracking-tighter text-transparent opacity-65 lg:text-8xl">
                02
              </span>
              <span className="text-2xl tracking-wide lg:text-3xl">
                開催スケジュール
              </span>
            </h3>

            <div className="min-w-0 max-w-5xl space-y-8 text-base leading-8 text-slate-700 lg:text-lg lg:leading-9">
              <div className="space-y-3">
                <p className="text-xl leading-9 font-semibold text-slate-950 lg:text-2xl lg:leading-10">
                  2026年11月14日（土）・15日（日）開催
                </p>
                <p>今年の荒牧祭は、2日間にわたって開催します。</p>
              </div>

              <div
                data-testid="schedule-days"
                className="grid w-full grid-cols-1 gap-5 bg-slate-50/80 p-4 sm:p-6 md:grid-cols-2 lg:p-8"
              >
                <article
                  data-testid="schedule-card"
                  className="relative overflow-hidden border border-slate-200 bg-white p-5 text-slate-900 shadow-[0_12px_36px_rgba(15,23,42,0.07)] sm:p-7 lg:p-9"
                >
                  <span
                    data-testid="spectrum-line"
                    aria-hidden="true"
                    className="mansai-spectrum-line absolute inset-x-0 top-0 h-px"
                  />
                  <p className="mb-7 text-sm font-semibold tracking-[0.22em] text-slate-500">
                    DAY 1
                  </p>
                  <time
                    dateTime="2026-11-14"
                    className="block whitespace-nowrap text-[clamp(1.125rem,5.5vw,1.5rem)] leading-none font-bold tracking-wide text-slate-950 sm:text-2xl lg:text-3xl"
                  >
                    2026.11.14 SAT
                  </time>
                  <p className="mt-5 whitespace-nowrap text-[clamp(1rem,5vw,1.25rem)] font-semibold tracking-wide text-slate-700 sm:text-xl lg:text-2xl">
                    10:00 — 17:30
                  </p>
                </article>

                <article
                  data-testid="schedule-card"
                  className="relative overflow-hidden border border-slate-200 bg-white p-5 text-slate-900 shadow-[0_12px_36px_rgba(15,23,42,0.07)] sm:p-7 lg:p-9"
                >
                  <span
                    data-testid="spectrum-line"
                    aria-hidden="true"
                    className="mansai-spectrum-line absolute inset-x-0 top-0 h-px"
                  />
                  <p className="mb-7 text-sm font-semibold tracking-[0.22em] text-slate-500">
                    DAY 2
                  </p>
                  <time
                    dateTime="2026-11-15"
                    className="block whitespace-nowrap text-[clamp(1.125rem,5.5vw,1.5rem)] leading-none font-bold tracking-wide text-slate-950 sm:text-2xl lg:text-3xl"
                  >
                    2026.11.15 SUN
                  </time>
                  <p className="mt-5 whitespace-nowrap text-[clamp(1rem,5vw,1.25rem)] font-semibold tracking-wide text-slate-700 sm:text-xl lg:text-2xl">
                    10:00 — 16:30
                  </p>
                </article>
              </div>

              <div
                data-testid="venue-details"
                className="border-l-2 border-cyan-500 pl-5"
              >
                <p className="text-sm font-semibold tracking-[0.18em] text-slate-500">
                  会場
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-950">
                  群馬大学 荒牧キャンパス
                </p>
              </div>

              <iframe
                data-testid="campus-map"
                src={campusMapUrl}
                title="群馬大学荒牧キャンパス Google Maps"
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                className="block h-[18rem] w-full max-w-full rounded-sm border-0 sm:h-[20rem] lg:h-[25rem]"
              />

              <p data-testid="schedule-closing">
                <span className="block">
                  学生たちがつくりあげる、年に一度の特別なキャンパスへ。
                </span>
                <span className="block">
                  皆さまのご来場をお待ちしています。
                </span>
              </p>
            </div>
          </section>

          <section
            id="about-theme"
            aria-labelledby="about-theme-title"
            className="relative grid grid-cols-1 scroll-mt-24 gap-10 pt-16 sm:pt-20 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-16 lg:pt-28"
          >
            <span
              data-testid="section-divider"
              aria-hidden="true"
              className="mansai-spectrum-line absolute inset-x-0 top-0 h-px opacity-60"
            />
            <h3
              id="about-theme-title"
              className="flex items-baseline gap-5 bg-none bg-clip-border p-0 text-slate-950 lg:flex-col lg:items-start lg:gap-4"
            >
              <span className="mansai-spectrum-text bg-clip-text text-6xl leading-none font-light tracking-tighter text-transparent opacity-65 lg:text-8xl">
                03
              </span>
              <span className="text-2xl tracking-wide lg:text-3xl">
                今年のテーマ
              </span>
            </h3>

            <div className="min-w-0 max-w-5xl">
              <div className="mb-14">
                <p
                  data-testid="theme-label"
                  className="mb-5 text-xs font-semibold tracking-[0.34em] text-slate-800 sm:text-sm"
                >
                  2026 THEME
                </p>
                <div
                  data-testid="theme-visual"
                  className="relative isolate aspect-[16/10] w-full max-w-full min-w-0 overflow-hidden bg-slate-100 sm:aspect-[40/21]"
                >
                  <Image
                    src="/images/background1.png"
                    alt="荒牧祭2026「万彩」メインビジュアル"
                    width={1920}
                    height={1080}
                    sizes="(min-width: 1280px) 928px, (min-width: 1024px) calc(100vw - 24rem), calc(100vw - 3rem)"
                    className="absolute inset-0 h-full w-full object-cover object-center"
                  />
                  <span
                    data-testid="theme-image-overlay"
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-10 bg-slate-950/10"
                  />
                  <p
                    data-testid="theme-word"
                    className="absolute inset-0 z-20 flex items-center justify-center font-serif text-[clamp(3.25rem,18vw,5.5rem)] leading-none font-black tracking-[0.08em] text-white drop-shadow-[0_4px_24px_rgba(15,23,42,0.38)] sm:text-8xl lg:text-[9rem]"
                  >
                    万彩
                  </p>
                </div>
              </div>

              <div
                data-testid="theme-description"
                className="max-w-3xl space-y-6 text-base leading-8 text-slate-700 lg:text-lg lg:leading-9"
              >
                <p>
                  2026年度、第73回荒牧祭のテーマは「万彩（ばんさい）」です。
                </p>
                <p>
                  いつも何気なく過ごしているキャンパスが、荒牧祭に訪れるお客様や群大生によって、たくさんの色で彩られていく。
                </p>
                <p>そんな荒牧祭の2日間を表現したテーマです。</p>
                <p>
                  一人ひとりが持つ個性や想いを一つの「色」とするなら、荒牧祭には数え切れないほどの色が集まります。
                </p>

                <ul className="grid gap-2 border-l-2 border-fuchsia-400 py-1 pl-5 text-lg font-semibold text-slate-900 sm:grid-cols-2">
                  <li>企画する人。</li>
                  <li>ステージに立つ人。</li>
                  <li>お店を出す人。</li>
                  <li>荒牧祭を支える人。</li>
                  <li className="sm:col-span-2">そして、会場を訪れる人。</li>
                </ul>

                <p>
                  それぞれの色が重なり合うことで、普段とは違う鮮やかな荒牧キャンパスが生まれます。
                </p>
                <p>また、昨年度の来場者数は8,989人でした。</p>

                <p>
                  今年はそこからさらに多くの方に荒牧祭を楽しんでいただき、
                  <strong className="mx-1 font-semibold text-slate-950">
                    「来場者1万人」
                  </strong>
                  を目指します。
                </p>
                <p>
                  その目標である「万」という言葉への想いも、
                  <strong className="mx-1 font-semibold text-slate-950">
                    「万彩」
                  </strong>
                  というテーマに込められています。
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
