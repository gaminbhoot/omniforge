export function Cross({ className = "", size = 5 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 5 5" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M3 2H5V3H3V5H2V3H0V2H2V0H3V2Z" fill="#D9D9D9" />
    </svg>
  );
}

export function CrossCorners({ size = 5 }: { size?: number }) {
  return (
    <>
      <Cross className="cx cx--tl" size={size} />
      <Cross className="cx cx--tr" size={size} />
      <Cross className="cx cx--bl" size={size} />
      <Cross className="cx cx--br" size={size} />
    </>
  );
}

export function FrameCorners({ size = 5 }: { size?: number }) {
  return (
    <>
      <span className="absolute -top-[3px] -left-[3px]"><Cross size={size} /></span>
      <span className="absolute -top-[3px] -right-[3px]"><Cross size={size} /></span>
      <span className="absolute -bottom-[3px] -left-[3px]"><Cross size={size} /></span>
      <span className="absolute -bottom-[3px] -right-[3px]"><Cross size={size} /></span>
    </>
  );
}

export function CrossButton({
  children,
  onClick,
  disabled,
  cursorText,
  type = "button",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  cursorText?: string;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} data-cursor-text={cursorText} className={`btn-x ${className}`}>
      <CrossCorners />
      <span>{children}</span>
    </button>
  );
}

export function ArrowTick() {
  return (
    <svg className="tick" width="4" height="4" viewBox="0 0 4 4" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 0H0L4 4V0Z" fill="white" />
    </svg>
  );
}

export function LogoMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="0.5" y="0.5" width="19" height="19" stroke="white" />
      <path d="M10 3V17M3 10H17" stroke="white" />
    </svg>
  );
}
