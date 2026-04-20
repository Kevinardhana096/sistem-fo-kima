export function MetricCard({ title, value, helper, accentClass }) {
    return (
        <div className={`rounded-lg border-l-4 bg-surface-container-lowest p-6 shadow-sm ${accentClass}`}>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-on-surface-variant">{title}</p>
            <h3 className="text-3xl font-extrabold text-on-surface">{value}</h3>
            {helper && <p className="mt-2 text-xs text-on-surface-variant">{helper}</p>}
        </div>
    );
}

export function IssueCountRow({ label, value }) {
    return (
        <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <p className="text-sm font-semibold text-on-surface">{label}</p>
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">
                {value}
            </span>
        </div>
    );
}

export function SummaryCard({ label, value, icon }) {
    return (
        <div className="rounded-2xl bg-surface-container-lowest p-5 shadow-card">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant/60">
                        {label}
                    </p>
                    <p className="mt-3 text-3xl font-extrabold text-on-surface">{value}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-container/15 text-primary">
                    <span className="material-symbols-outlined">{icon}</span>
                </div>
            </div>
        </div>
    );
}

export function TodoColumn({ title, items }) {
    return (
        <div className="rounded-xl bg-surface-container-low p-4">
            <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">{title}</p>
            <div className="mt-3 space-y-3">
                {items.length > 0 ? items.map((item) => (
                    <div key={item.id} className="rounded-xl bg-surface-container-lowest p-3 shadow-soft">
                        <p className="text-sm font-semibold text-on-surface">{item.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{item.message}</p>
                    </div>
                )) : (
                    <p className="text-sm text-on-surface-variant">Tidak ada item.</p>
                )}
            </div>
        </div>
    );
}

export function FieldInput({ label, type = "text", value, onChange, placeholder = "" }) {
    return (
        <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                {label}
            </label>
            <input
                className="w-full rounded-xl bg-surface-container-low p-3 text-sm outline-none transition-all glass-input"
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
        <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                {label}
            </label>
            <select
                className="w-full rounded-xl bg-surface-container-low p-3 text-sm outline-none transition-all glass-input"
                onChange={(event) => onChange(event.target.value)}
                value={value}
            >
                {options.map((option) => (
                    <option key={`${label}-${option.value}`} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

export function ComplianceItem({ active, label }) {
    return (
        <div className="flex items-center justify-between rounded-lg bg-surface-container-low px-4 py-3">
            <span className="text-sm font-medium text-on-surface">{label}</span>
            <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${active ? "bg-secondary/10 text-secondary" : "bg-primary-container/20 text-primary"
                    }`}
            >
                <span className="material-symbols-outlined text-sm">
                    {active ? "check_circle" : "cancel"}
                </span>
                {active ? "OK" : "Perlu Tindak Lanjut"}
            </span>
        </div>
    );
}
