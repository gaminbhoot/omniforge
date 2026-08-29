type Props = { active: string; onChange: (m: string) => void };

const MODULES = [
  { id: "ops", label: "OpsForge", icon: "OP", desc: "SRE & Incidents" },
  { id: "security", label: "SecurForge", icon: "SEC", desc: "CVE & Patch" },
  { id: "data", label: "DataForge", icon: "DATA", desc: "ETL & Schema" },
];

export function ModuleSwitcher({ active, onChange }: Props) {
  return (
    <div className="flex gap-2">
      {MODULES.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition border ${
            active === m.id
              ? "bg-white text-ink border-white shadow"
              : "bg-white/[0.06] text-zinc-300 border-white/10 hover:bg-white/[0.10] hover:text-white"
          }`}
        >
          <span className="font-mono text-[10px] tracking-widest opacity-70">{m.icon}</span>
          <span>{m.label}</span>
          <span className={`hidden sm:inline text-xs font-normal ${active === m.id ? "text-ink/60" : "text-muted"}`}>{m.desc}</span>
        </button>
      ))}
    </div>
  );
}
