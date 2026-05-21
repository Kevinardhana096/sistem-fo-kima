import re

with open('src/components/routes/FoRoutePlanner.jsx', 'r') as f:
    code = f.read()

replacements = {
    r' className="fo-route-planner rounded-\[2rem\] border border-cyan-500/20 bg-\[#07111f\] p-5 text-slate-100 shadow-\[0_20px_80px_rgba\(8,145,178,0\.18\)\]"': ' className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm border border-slate-200 text-on-surface"',
    r' className="fo-section-kicker"': ' className="text-xs font-black uppercase tracking-widest text-on-surface-variant/70"',
    r' className="fo-section-title"': ' className="text-2xl font-bold text-on-surface"',
    r' className="mt-2 max-w-2xl text-sm text-cyan-100/70"': ' className="mt-2 text-sm text-on-surface-variant"',
    
    r' className="fo-stat-card"': ' className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-4"',
    r' className="fo-stat-card__label"': ' className="text-[10px] font-bold uppercase tracking-widest text-slate-500"',
    r' className="fo-stat-card__value"': ' className="text-lg font-bold text-slate-900 break-words"',
    
    r' className="fo-chip"': ' className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"',
    r' className={`fo-chip \$\{([^\}]+) \? "fo-chip--active" : ""\}`}': r' className={`inline-flex items-center justify-center rounded-lg border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-50 ${ \1 ? "border-primary bg-primary text-white hover:bg-primary/90" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50" }`}',
    r' className={`fo-chip \$\{([^\}]+) \? "fo-chip--warning" : ""\}`}': r' className={`inline-flex items-center justify-center rounded-lg border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-50 ${ \1 ? "border-amber-500 bg-amber-500 text-white hover:bg-amber-600" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50" }`}',
    r' className="fo-chip fo-chip--active"': ' className="inline-flex items-center justify-center rounded-lg border border-primary bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"',
    
    r' className="fo-apply-button"': ' className="inline-flex items-center justify-center rounded-lg border border-transparent bg-emerald-600 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"',
    
    r' className="rounded-\[1.5rem\] border border-cyan-500/15 bg-slate-950/70 p-3"': ' className="rounded-2xl border border-slate-200 bg-slate-50 p-3"',
    r' className="overflow-hidden rounded-\[1.25rem\] border border-cyan-500/10"': ' className="overflow-hidden rounded-xl border border-slate-200"',
    r' className="h-\[620px\] w-full bg-slate-950"': ' className="h-[620px] w-full bg-slate-100"',
    r' className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"': ' className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"',
    
    r' className="fo-panel"': ' className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"',
    r' className="fo-panel__kicker"': ' className="text-[10px] font-black uppercase tracking-widest text-slate-500"',
    r' className="fo-panel__title"': ' className="text-lg font-bold text-slate-900"',
    
    r' className="fo-select"': ' className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"',
    
    r' className="fo-mini-card"': ' className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3"',
    r' className="fo-mini-card__label"': ' className="text-[10px] font-bold uppercase tracking-widest text-slate-500"',
    r' className="fo-mini-card__value"': ' className="break-words text-sm font-bold text-slate-900"',
    
    r' className="mt-3 text-xs text-cyan-100/55"': ' className="mt-3 text-xs text-slate-500"',
    r' className="mt-2 text-xs font-bold uppercase tracking-\[0.25em\] text-cyan-300"': ' className="mt-2 text-xs font-bold uppercase tracking-[0.25em] text-primary"',
    
    r' className="fo-input"': ' className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20"',
    r' className="mt-2 text-xs text-rose-300"': ' className="mt-2 text-xs text-rose-600"',
    
    r' className="rounded-xl border border-cyan-500/10 bg-slate-950/60 p-3"': ' className="rounded-xl border border-slate-200 bg-slate-50 p-3"',
    r' className="text-sm font-semibold text-cyan-50"': ' className="text-sm font-semibold text-slate-900"',
    r' className="mt-1 text-\[11px\] font-mono text-cyan-200/55"': ' className="mt-1 text-[11px] font-mono text-slate-500"',
    
    r' className="fo-coordinate-block"': ' className="rounded-xl border border-slate-200 bg-slate-50 p-3"',
    r' className="fo-coordinate-block__title"': ' className="mb-2 text-xs font-bold text-slate-700"',
    r' className="fo-coordinate-grid"': ' className="flex gap-2"',
    
    r' className="text-sm text-cyan-100/55"': ' className="text-sm text-slate-500"',
    r' className="text-xs font-black uppercase tracking-widest text-cyan-300"': ' className="text-xs font-black uppercase tracking-widest text-primary"',
    
    r' className="fo-icon-button"': ' className="inline-flex items-center justify-center rounded bg-slate-200 p-1 text-slate-600 transition hover:bg-slate-300"',
    r' className="fo-icon-button fo-icon-button--danger"': ' className="inline-flex items-center justify-center rounded bg-rose-100 p-1 text-rose-600 transition hover:bg-rose-200"',
    r' className="mt-2 text-\[11px\] font-mono text-cyan-100/50"': ' className="mt-2 text-[11px] font-mono text-slate-500"',
    
    r' className="rounded-xl border border-cyan-500/10 bg-slate-950/60 px-3 py-2"': ' className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"',
    r' className="text-xs font-mono text-cyan-300"': ' className="text-xs font-mono text-primary"',
    r' className="mt-1 text-\[11px\] text-cyan-100/50"': ' className="mt-1 text-[11px] text-slate-500"',
    r'import "./FoRoutePlanner.css";\n': '',    
}

for pattern, repl in replacements.items():
    code = re.sub(pattern, repl, code)

with open('src/components/routes/FoRoutePlanner.jsx', 'w') as f:
    f.write(code)

print("Done replacing.")
