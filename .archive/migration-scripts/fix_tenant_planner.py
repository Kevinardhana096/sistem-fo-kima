import re

with open('src/pages/TenantDetailPage.jsx', 'r') as f:
    content = f.read()

# 1. Insert the early return before `const tabs = [`
early_return = """
    if (isPlannerJalurView) {
        return (
            <AppShell activeSection="customers" onNavigate={onNavigate} hideSidebar={hideSidebar}>
                <div className="mx-auto w-full p-4 lg:p-8 space-y-6">
                    <button className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-surface-container" onClick={onBack} type="button">
                        <span className="material-symbols-outlined text-base">arrow_back</span>
                        Kembali ke Detail Tenant
                    </button>
                    
                    <header className="flex flex-col gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-on-surface">Route Planner FO: {tenantName}</h1>
                                <p className="text-sm text-on-surface-variant mt-1">
                                    Paket: {(detail?.paket || customer?.paket || "CORE").toUpperCase()} • ISP: {isps.length > 0 ? isps.map((item) => item.name).join(", ") : "-"}
                                </p>
                            </div>
                        </div>
                    </header>
                    
                    <div className="w-full h-[80vh]">
                        <FoRoutePlanner
                            disabled={routeBusy}
                            onApplyPlannedRoute={(plannedPoints, plannerMeta) => {
                                handleApplyPlannedRoute(plannedPoints, plannerMeta);
                                window.setTimeout(() => onBack?.(), 800);
                            }}
                            mode="full"
                        />
                    </div>
                </div>
            </AppShell>
        );
    }

    const tabs = ["""

content = content.replace("    const tabs = [", early_return)

# 2. Remove the old FoRoutePlanner usage inside the standard JSX tree
# In standard view, we ONLY show the preview when it's not planner view (because planner view returns early now).
# Wait, `isPlannerJalurView` is handled by the early return, so we can just replace the block.
# Let's use regex to replace `{isPlannerJalurView ? ... } : ...}`

pattern = r'\{isPlannerJalurView \? \(\s*<FoRoutePlanner\s*disabled=\{routeBusy\}\s*onApplyPlannedRoute=\{handleApplyPlannedRoute\}\s*\/>\s*\) : \(\s*<FoRoutePlanner\s*mode="preview"\s*onPreviewClick=\{[^}]+\}\s*previewPoints=\{previewRoutePoints\}\s*\/>\s*\)\}'

replacement = """<FoRoutePlanner
                                mode="preview"
                                onPreviewClick={() => onOpenRoutePlanner?.(detail ?? customer)}
                                previewPoints={previewRoutePoints}
                            />"""

content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open('src/pages/TenantDetailPage.jsx', 'w') as f:
    f.write(content)

print("Injected early return for planner view.")
