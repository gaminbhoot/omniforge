type Props = { active: string; onChange: (m: string) => void };

const MODULES = [
  { id: "ops", label: "OpsForge", icon: "OP", desc: "SRE & Incidents" },
  { id: "security", label: "SecurForge", icon: "SEC", desc: "CVE & Patch" },
  { id: "data", label: "DataForge", icon: "DATA", desc: "ETL & Schema" },
];

export function ModuleSwitcher({ active, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {MODULES.map((m) => {
        const on = active === m.id;
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            data-cursor-text={m.desc}
            className={`relative px-4 py-2.5 font-mono text-[12px] uppercase tracking-[1px] transition border ${
              on ? "bg-white text-[#0f0f0f] border-white" : "bg-white/[0.05] text-white border-white/10 hover:border-white/60"
            }`}
          >
            <span className="mr-2 opacity-60 text-[10px]">{m.icon}</span>
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
