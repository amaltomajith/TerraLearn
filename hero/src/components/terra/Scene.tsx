import { FeatureItem, type Status } from "./FeatureItem";
import { range, useScrollProgress } from "./useScrollProgress";

export type Feature = { text: string; status: Status };

export function Scene({
  index,
  label,
  bigLine,
  copy,
  features,
  image,
  imageAlt,
  note,
}: {
  index: string;
  label: string;
  bigLine: string;
  copy: string;
  features?: Feature[];
  image: string;
  imageAlt: string;
  note?: string;
}) {
  const { ref, progress } = useScrollProgress<HTMLElement>();

  // scroll-scrubbed "film" values
  const enter = range(progress, 0.06, 0.42);
  const exit = range(progress, 0.72, 0.98);
  const scale = 1.22 - 0.22 * range(progress, 0, 0.85);
  const shift = (progress - 0.5) * 90;
  const listOpen = range(progress, 0.3, 0.55) > 0.35;

  return (
    <section
      ref={ref}
      id={`scene-${index}`}
      className="relative h-[260vh]"
      aria-label={label}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* scrubbed media */}
        <div
          className="absolute inset-0"
          style={{
            clipPath: `inset(${(1 - enter) * 12}% ${(1 - enter) * 6}% ${(1 - enter) * 12}% ${(1 - enter) * 6}%)`,
            transition: "clip-path 80ms linear",
          }}
        >
          <img
            src={image}
            alt={imageAlt}
            loading="lazy"
            width={1920}
            height={1088}
            className="size-full object-cover"
            style={{
              transform: `scale(${scale}) translate3d(0, ${shift * 0.25}px, 0)`,
              filter: `saturate(${0.6 + enter * 0.5}) brightness(${0.5 + enter * 0.45})`,
            }}
          />
        </div>
        <div className="scene-veil absolute inset-0" />
        <div className="grain absolute inset-0 opacity-60 mix-blend-overlay" />

        {/* content */}
        <div className="absolute inset-0 flex items-center pt-14">
          <div className="mx-auto w-full max-w-[1400px] px-6 py-10 sm:px-10">
            <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16">
              <div
                style={{
                  opacity: 1 - exit,
                  transform: `translateY(${(1 - enter) * 24 - exit * 24}px)`,
                }}
              >
                <div className="mb-6 flex items-center gap-4">
                  <span className="eyebrow">{index}</span>
                  <span className="h-px w-10 bg-live/60" />
                  <span className="eyebrow">{label}</span>
                </div>
                <h2 className="text-balance-tight max-w-[16ch] font-display text-[2rem] font-semibold sm:text-[2.75rem] lg:text-[3.4rem]">
                  {bigLine}
                </h2>
              </div>

              <div
                className="max-w-2xl"
                style={{
                  opacity: Math.min(range(progress, 0.18, 0.4), 1 - exit),
                  transform: `translateY(${(1 - range(progress, 0.18, 0.4)) * 30}px)`,
                }}
              >
                <p className="text-[15px] leading-relaxed text-foreground/70 sm:text-base">
                  {copy}
                </p>

                {features && (
                  <ul className="mt-8 border-b border-hairline">
                    {features.map((f, i) => (
                      <FeatureItem
                        key={f.text}
                        text={f.text}
                        status={f.status}
                        visible={listOpen}
                        delay={i * 70}
                      />
                    ))}
                  </ul>
                )}

                {note && (
                  <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    {note}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* scrub bar */}
        <div className="absolute bottom-0 left-0 h-px w-full bg-hairline">
          <div
            className="h-px bg-live"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>
    </section>
  );
}
