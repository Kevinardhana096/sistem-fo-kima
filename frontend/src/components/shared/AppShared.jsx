export function MetricCard({ title, value, helper, accentClass }) {
    return (
        <div className={`glass-card rounded-premium p-6 group hover:border-gold-accent/30 transition-all ${accentClass}`}>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant group-hover:text-gold-accent transition-colors">{title}</p>
            <h3 className="text-3xl font-black text-on-surface tracking-tighter">{value}</h3>
            {helper && <p className="mt-3 text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest">{helper}</p>}
        </div>
    );
}

export function IssueCountRow({ label, value }) {
    return (
        <div className="flex items-center justify-between rounded-2xl border border-white/40 bg-white/30 backdrop-blur-md px-5 py-4 transition-all hover:bg-white/50">
            <p className="text-xs font-black uppercase tracking-widest text-on-surface/80">{label}</p>
            <span className="rounded-xl bg-gold-accent text-white px-3 py-1 text-[10px] font-black shadow-gold-glow">
                {value}
            </span>
        </div>
    );
}

export function SummaryCard({ label, value, icon }) {
    return (
        <div className="glass-card rounded-premium p-6 group">
            <div className="flex items-center justify-between gap-6">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/60 group-hover:text-gold-accent transition-colors">
                        {label}
                    </p>
                    <p className="mt-3 text-3xl font-black text-on-surface tracking-tighter">{value}</p>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-accent/10 text-gold-accent shadow-sm group-hover:shadow-gold-glow transition-all backdrop-blur-md">
                    <span className="material-symbols-outlined text-2xl">{icon}</span>
                </div>
            </div>
        </div>
    );
}

export function TodoColumn({ title, items }) {
    return (
        <div className="rounded-3xl bg-black/5 p-6 border border-black/5 backdrop-blur-md">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-on-surface-variant mb-6">{title}</p>
            <div className="space-y-4">
                {items.length > 0 ? items.map((item) => (
                    <div key={item.id} className="glass-card rounded-2xl p-5 hover:bg-white/80 transition-all">
                        <p className="text-sm font-black text-on-surface tracking-tight">{item.title}</p>
                        <p className="mt-2 text-xs font-medium leading-relaxed text-on-surface-variant">{item.message}</p>
                    </div>
                )) : (
                    <div className="py-10 text-center opacity-30 italic font-bold">
                        <span className="material-symbols-outlined text-3xl mb-2">inbox</span>
                        <p className="text-[10px] uppercase tracking-widest">Kosong</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export function FieldInput({ label, type = "text", value, onChange, placeholder = "" }) {
    return (
        <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant ml-1">
                {label}
            </label>
            <input
                className="w-full rounded-2xl bg-black/5 border border-black/5 p-4 text-sm font-bold text-on-surface placeholder:text-on-surface-variant/40 outline-none transition-all focus:bg-white focus:shadow-lg focus:ring-4 focus:ring-gold-accent/5 focus:border-gold-accent/20 backdrop-blur-md"
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                type={type}
                value={value}
            />
        </div>
    );
}

export function FieldSelect({ label, value, onChange, options }) {
    return (
        <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant ml-1">
                {label}
            </label>
            <select
                className="w-full rounded-2xl bg-black/5 border border-black/5 p-4 text-sm font-bold text-on-surface outline-none transition-all focus:bg-white focus:shadow-lg focus:ring-4 focus:ring-gold-accent/5 focus:border-gold-accent/20 appearance-none cursor-pointer backdrop-blur-md"
                onChange={(event) => onChange(event.target.value)}
                value={value}
            >
                {options.map((option) => (
                    <option key={`${label}-${option.value}`} value={option.value} className="bg-white text-on-surface">
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

export function ComplianceItem({ active, label }) {
    return (
        <div className="flex items-center justify-between rounded-2xl bg-white/40 border border-white/60 px-5 py-4 backdrop-blur-sm">
            <span className="text-xs font-black uppercase tracking-wider text-on-surface/70">{label}</span>
            <span
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-1.5 text-[10px] font-black uppercase tracking-widest ${active ? "bg-emerald-100 text-emerald-700 shadow-sm" : "bg-rose-100 text-rose-700 shadow-sm"
                    }`}
            >
                <span className="material-symbols-outlined text-[14px]">
                    {active ? "verified" : "error"}
                </span>
                {active ? "VALID" : "PENDING"}
            </span>
        </div>
    );
}

export function StatCard({ label, value, icon, accent, sub }) {
    const accents = {
        gold: "text-gold-accent bg-gold-accent/10",
        red: "text-red-500 bg-red-500/10",
        emerald: "text-emerald-500 bg-emerald-500/10",
        white: "text-on-surface-variant bg-white/10"
    };
    
    return (
        <div className="glass-card rounded-premium p-6 group hover:border-gold-accent/40 transition-all duration-500"
            style={{ backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}>
            <div className="flex justify-between items-start mb-6">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant group-hover:text-gold-accent transition-colors">{label}</p>
                <div className={`h-12 w-12 flex items-center justify-center rounded-2xl ${accents[accent] || accents.white} shadow-sm group-hover:shadow-gold-glow transition-all`}>
                    <span className="material-symbols-outlined text-2xl">{icon}</span>
                </div>
            </div>
            <h3 className="text-4xl font-black text-on-surface tracking-tighter mb-2">{value}</h3>
            {sub && <p className="text-[10px] font-bold text-on-surface-variant uppercase opacity-40 tracking-widest">{sub}</p>}
        </div>
    );
}

