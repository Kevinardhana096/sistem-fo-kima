import re

with open('src/components/routes/FoRoutePlanner.jsx', 'r') as f:
    code = f.read()

# Replace ToastStack
old_toast = """function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="fo-toast-stack">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`fo-toast fo-toast--${toast.tone}`}
          role="status"
        >
          <div>
            <p className="fo-toast__title">{toast.title}</p>
            <p className="fo-toast__message">{toast.message}</p>
          </div>
          <button
            className="fo-toast__close"
            onClick={() => onDismiss(toast.id)}
            type="button"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      ))}
    </div>
  );
}"""

new_toast = """function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="absolute right-4 top-4 z-[500] flex w-[min(360px,calc(100%-2rem))] flex-col gap-2.5 md:right-8 md:top-8">
      {toasts.map((toast) => {
        const bgClasses = {
          info: "bg-blue-600",
          success: "bg-emerald-600",
          warning: "bg-amber-500",
          error: "bg-rose-600",
        }[toast.tone] || "bg-slate-800";

        return (
          <div
            key={toast.id}
            className={`flex items-start justify-between gap-3 rounded-xl p-4 text-white shadow-lg ${bgClasses}`}
            role="status"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white/90">{toast.title}</p>
              <p className="mt-1 text-sm text-white/90 leading-snug">{toast.message}</p>
            </div>
            <button
              className="text-white/70 transition hover:text-white"
              onClick={() => onDismiss(toast.id)}
              type="button"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}"""

# Python escape `{` and `}` properly if needed, but since we are doing simple replace we can just do:
code = code.replace(old_toast, new_toast)

with open('src/components/routes/FoRoutePlanner.jsx', 'w') as f:
    f.write(code)

print("Replaced ToastStack")
