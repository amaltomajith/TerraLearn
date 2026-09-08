
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Diagram } from "../components/terra/Diagram";



export { Landing };

type Chapter = {
  index: string;
  kicker: string;
  title: string;
  body: string;
  status: "LIVE" | "VISION";
  points: string[];
  diagram: string;
};


const CHAPTERS: Chapter[] = [
  {
    index: "01",
    kicker: "Yield",
    title: "Predict the harvest before you plant it.",
    body: "An agronomic model reads temperature, growing degree days and soil pH match to project outcomes for your plot.",
    status: "LIVE",
    points: ["Crop yield simulator", "5-year climate & air-quality trends"],
    diagram: "curve",
  },
  {
    index: "02",
    kicker: "Honesty",
    title: "Reading, estimate, or gap. Never a silent guess.",
    body: "Every number carries its provenance. When the data isn't there, the platform says so instead of filling the hole quietly.",
    status: "LIVE",
    points: ["Data honesty policy", "No silent fallbacks"],
    diagram: "provenance",
  },
  {
    index: "03",
    kicker: "Market",
    title: "Real mandi prices, not distress sales.",
    body: "Agmarknet history and live buyer demand sit side by side, so the selling decision is made with the market in view.",
    status: "LIVE",
    points: ["Agmarknet price history", "Live buyer demand"],
    diagram: "bars",
  },
  {
    index: "04",
    kicker: "Saath",
    title: "One farm's waste is the next farm's input.",
    body: "A hyperlocal feed for equipment, labour and resources — with circular-agriculture matches drawn between neighbouring plots.",
    status: "LIVE",
    points: ["Cooperative exchange feed", "IFS loop matching", "Trust from completed exchanges"],
    diagram: "network",
  },
  {
    index: "05",
    kicker: "Ground truth",
    title: "Your land, from orbit.",
    body: "Satellite imagery with toggleable layers for IFS loops and neighbouring farms, across every plot you manage.",
    status: "LIVE",
    points: ["Satellite mapping layers", "Multi-farm switching", "Role-based access"],
    diagram: "plots",
  },
  {
    index: "06",
    kicker: "Assistant",
    title: "Advice that remembers your field.",
    body: "A memory-aware agent that speaks plainly, knows your land and network, and drafts messages you must confirm before they send.",
    status: "LIVE",
    points: ["Persistent AI assistant", "Draft-and-confirm messaging"],
    diagram: "chat",
  },
  {
    index: "07",
    kicker: "Next",
    title: "One shock, mapped across eight factors.",
    body: "The cascade engine models the farm as a dependency graph — a power cut becomes a visible chain of downstream risk.",
    status: "VISION",
    points: ["FarmRisk cascade engine", "Flood & drought early warning", "Leaf disease scanner"],
    diagram: "cascade",
  },
  {
    index: "08",
    kicker: "Next",
    title: "In the language the farmer already speaks.",
    body: "Voice in, voice out across major Indian languages, AgriStack land records, insurance claim help and a traceable crop ledger.",
    status: "VISION",
    points: ["Multilingual voice", "AgriStack auto-fill", "Traceable provenance"],
    diagram: "wave",
  },
];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (n: number) => 1 - Math.pow(1 - clamp01(n), 3);

function Landing() {
  return (
    <main className="relative bg-background">
      <Header />
      <ScrollFilm />
      <Footer />
    </main>
  );
}

function Header() {
  const navigate = useNavigate();
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-6 py-5 sm:px-10">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between">
        <a href="/" className="flex items-center gap-2.5">
          <span className="size-2.5 rotate-45 border border-soil bg-soil/30" />
          <span className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-bone">
            TerraLearn
          </span>
        </a>
        <button
          onClick={() => navigate('/sign-up')}
          className="rounded-full border border-bone/20 bg-bone/5 px-5 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-bone backdrop-blur-md transition-colors hover:border-soil hover:bg-soil/10 hover:text-soil"
        >
          Enter TerraLearn
        </button>
      </div>
    </header>
  );
}

function ScrollFilm() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    const video = videoRef.current;
    if (!wrap) return;

    let raf = 0;
    let duration = 0;
    let target = 0;
    let current = 0;

    const onMeta = () => {
      duration = video?.duration && isFinite(video.duration) ? video.duration : 0;
    };
    video?.addEventListener("loadedmetadata", onMeta);
    onMeta();

    const tick = () => {
      raf = 0;
      current += (target - current) * 0.085;
      if (video && duration > 0) {
        const t = clamp01(current) * (duration - 0.05);
        if (Math.abs(video.currentTime - t) > 0.02) {
          try {
            video.currentTime = t;
          } catch {
            /* seek not ready */
          }
        }
      }
      setProgress(current);
      if (Math.abs(target - current) > 0.00025) raf = requestAnimationFrame(tick);
    };

    const measure = () => {
      const rect = wrap.getBoundingClientRect();
      const track = rect.height - window.innerHeight;
      target = track > 0 ? clamp01(-rect.top / track) : 0;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    measure();
    current = target;
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      video?.removeEventListener("loadedmetadata", onMeta);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const total = CHAPTERS.length;
  // hero occupies the first slice, chapters share the rest
  const heroOut = clamp01((progress - 0.04) / 0.08);
  const chapterZone = clamp01((progress - 0.1) / 0.88);
  const active = Math.min(total - 1, Math.floor(chapterZone * total));
  const local = chapterZone * total - active;

  return (
    <section ref={wrapRef} className="relative" style={{ height: `${(total + 2) * 100}vh` }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-background">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/terra-scroll-poster.jpg)" }}
        />
        <video
          ref={videoRef}
          poster="/terra-scroll-poster.jpg"
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          className="absolute inset-0 size-full object-cover"
          style={{ transform: `scale(${1.06 + progress * 0.06})` }}
        >
          <source src="/terra-scrub.mp4" type="video/mp4" />
          <source src="/terra-scrub.webm" type="video/webm" />
        </video>

        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-background/25" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/25 to-transparent" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 50%, transparent 35%, oklch(0.04 0.01 150 / 85%) 100%)",
          }}
        />
        <div
          className="absolute inset-0 mix-blend-soft-light"
          style={{
            background: `radial-gradient(60% 60% at ${20 + progress * 60}% ${70 - progress * 40}%, var(--soil) 0%, transparent 60%)`,
            opacity: 0.35,
          }}
        />
        <div className="grain absolute inset-0 opacity-40 mix-blend-overlay" />

        {/* Hero */}
        <div
          className="absolute inset-0 flex items-center px-6 sm:px-10"
          style={{
            opacity: 1 - heroOut,
            transform: `translateY(${-heroOut * 60}px) scale(${1 - heroOut * 0.04})`,
            filter: `blur(${heroOut * 6}px)`,
            pointerEvents: heroOut > 0.5 ? "none" : "auto",
          }}
        >
          <div className="mx-auto w-full max-w-[1400px]">
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.25em] text-soil">
              For the ground under it
            </p>
            <h1 className="text-balance-tight max-w-[14ch] font-display text-[3.2rem] font-semibold text-bone sm:text-[5rem] lg:text-[6.5rem]">
              Real data.<br />
              Honest ground.<br />
              <span className="text-foliage">One pocket.</span>
            </h1>
            <p className="mt-8 max-w-lg text-base leading-relaxed text-bone/65">
              Scroll the field. Every layer below is something the platform already does — or is
              honestly still building.
            </p>
          </div>
        </div>

        {/* Chapters */}
        <div className="pointer-events-none absolute inset-0 px-6 sm:px-10">
          <div className="relative mx-auto h-full w-full max-w-[1400px]">
            {CHAPTERS.map((c, i) => {
              const on = i === active && heroOut > 0.6;
              const inLocal = easeOut(clamp01(local / 0.26));
              const outLocal = 1 - easeOut(clamp01((local - 0.74) / 0.26));
              const o = on ? Math.min(inLocal, outLocal) : 0;
              const words = c.title.split(" ");
              return (
                <div
                  key={c.index}
                  aria-hidden={!on}
                  className="absolute inset-0 flex items-center"
                  style={{
                    opacity: o,
                    transform: `translate3d(0, ${(1 - o) * 34}px, 0)`,
                    visibility: on ? "visible" : "hidden",
                  }}
                >
                  <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)]">
                  <div className="max-w-xl">
                    <div className="mb-5 flex items-center gap-4">
                      <span className="font-mono text-[11px] tracking-[0.22em] text-soil">
                        {c.index}
                      </span>
                      <span
                        className="h-px bg-soil/60"
                        style={{ width: `${o * 44}px`, transition: "width 200ms linear" }}
                      />
                      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/50">
                        {c.kicker}
                      </span>
                      <StatusTag status={c.status} />
                    </div>
                    <h2 className="text-balance-tight font-display text-[2rem] font-semibold text-bone sm:text-[3rem]">
                      {words.map((w, wi) => {
                        const t = clamp01((o - wi * 0.045) * 3);
                        return (
                          <span
                            key={`${w}-${wi}`}
                            className="inline-block"
                            style={{
                              opacity: t,
                              transform: `translateY(${(1 - t) * 26}px)`,
                              filter: `blur(${(1 - t) * 6}px)`,
                            }}
                          >
                            {w}&nbsp;
                          </span>
                        );
                      })}
                    </h2>
                    <p className="mt-6 max-w-md text-[15px] leading-relaxed text-bone/65">
                      {c.body}
                    </p>
                    <ul className="mt-7 space-y-2.5">
                      {c.points.map((p, pi) => {
                        const t = clamp01((o - 0.3 - pi * 0.12) * 4);
                        return (
                          <li
                            key={p}
                            className="flex items-center gap-3 text-[13px] text-bone/80"
                            style={{
                              opacity: t,
                              transform: `translateX(${(1 - t) * 18}px)`,
                            }}
                          >
                            <span
                              className={`size-1.5 rotate-45 ${
                                c.status === "LIVE" ? "bg-soil" : "bg-foliage"
                              }`}
                            />
                            {p}
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div
                    className="hidden lg:block"
                    style={{
                      opacity: o,
                      transform: `translateY(${(1 - o) * -30}px) scale(${0.94 + o * 0.06})`,
                    }}
                  >
                    <div className="relative mx-auto aspect-square w-full max-w-[380px] rounded-2xl border border-bone/10 bg-background/35 p-6 backdrop-blur-md">
                      <div className="absolute inset-x-6 top-4 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.22em] text-bone/35">
                        <span>{c.kicker}</span>
                        <span>{c.status}</span>
                      </div>
                      <div className="pt-6">
                        <Diagram kind={c.diagram} p={on ? clamp01(local * 1.8) : 0} />
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>


        {/* HUD */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-6 pb-8 sm:px-10">
          <div className="mx-auto flex max-w-[1400px] items-end justify-between">
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-bone/45">
              <span>Scroll</span>
              <span
                className="h-6 w-px bg-soil/70"
                style={{ animation: "terra-drift 2.6s ease-in-out infinite" }}
              />
              <span>{String(Math.round(progress * 100)).padStart(2, "0")}%</span>
            </div>
            <div className="hidden items-center gap-1.5 sm:flex">
              {CHAPTERS.map((c, i) => (
                <span
                  key={c.index}
                  className="h-px transition-all duration-300"
                  style={{
                    width: i === active && heroOut > 0.6 ? 34 : 16,
                    background:
                      i === active && heroOut > 0.6
                        ? "var(--soil)"
                        : "oklch(1 0 0 / 22%)",
                  }}
                />
              ))}
            </div>
          </div>
          <div className="mx-auto mt-5 h-px max-w-[1400px] bg-hairline">
            <div className="h-px bg-soil" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusTag({ status }: { status: "LIVE" | "VISION" }) {
  const live = status === "LIVE";
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] font-mono text-[9px] tracking-[0.18em]",
        live ? "border-soil/40 bg-soil/10 text-soil" : "border-foliage/40 bg-foliage/10 text-foliage",
      ].join(" ")}
    >
      <span className={`size-1 rounded-full ${live ? "bg-soil" : "bg-foliage"}`} />
      {status}
    </span>
  );
}

function Footer() {
  const navigate = useNavigate();
  return (
    <footer className="relative z-10 border-t border-hairline bg-background px-6 py-14 sm:px-10">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="size-2.5 rotate-45 border border-soil bg-soil/30" />
            <span className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-bone">
              TerraLearn
            </span>
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            Real readings, honest gaps, and a network that already exists on the ground.
          </p>
        </div>
        <button
          onClick={() => navigate('/sign-up')}
          className="group inline-flex items-center gap-2 self-start rounded-full bg-soil px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-shadow hover:shadow-[0_0_40px_-12px_var(--color-soil)]"
        >
          Enter TerraLearn
          <svg className="size-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </button>
      </div>
    </footer>
  );
}
