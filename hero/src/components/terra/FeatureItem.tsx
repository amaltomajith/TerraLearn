export type Status = "LIVE" | "VISION";

export function StatusTag({ status }: { status: Status }) {
  const live = status === "LIVE";
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-[3px]",
        "font-mono text-[10px] font-medium tracking-[0.16em]",
        live
          ? "border-live/40 bg-live-soft text-live"
          : "border-vision/40 bg-vision-soft text-vision",
      ].join(" ")}
    >
      <span
        className={[
          "size-1.5 rounded-full",
          live ? "bg-live" : "bg-vision",
        ].join(" ")}
        style={live ? { animation: "terra-drift 2.4s ease-in-out infinite" } : undefined}
      />
      {status}
    </span>
  );
}

export function FeatureItem({
  text,
  status,
  visible,
  delay,
}: {
  text: string;
  status: Status;
  visible: boolean;
  delay: number;
}) {
  return (
    <li
      className="group flex items-start gap-3 border-t border-hairline py-3 transition-all duration-700 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(14px)",
        transitionDelay: `${delay}ms`,
      }}
    >
      <StatusTag status={status} />
      <span
        className={[
          "text-[13.5px] leading-relaxed sm:text-sm",
          status === "LIVE" ? "text-foreground/90" : "text-muted-foreground",
        ].join(" ")}
      >
        {text}
      </span>
    </li>
  );
}
