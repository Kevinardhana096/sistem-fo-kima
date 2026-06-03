import { useEffect, useRef } from "react";

/**
 * DateInput — input tanggal yang bisa diketik (DD/MM/YYYY) sekaligus
 * punya icon kalender di kanan untuk membuka date picker opsional.
 *
 * Props:
 *   value      : string  — format YYYY-MM-DD (nilai internal DB/state)
 *   onChange   : (isoValue: string) => void  — dipanggil dengan YYYY-MM-DD
 *   disabled   : bool
 *   className  : string  — class tambahan untuk wrapper luar (opsional)
 *   inputClass : string  — class tambahan untuk <input> (opsional)
 *   placeholder: string  — default "DD/MM/YYYY"
 *
 * Contoh pemakaian:
 *   <DateInput value={form.tanggal} onChange={val => setForm(f => ({ ...f, tanggal: val }))} />
 */

// ── helpers ──────────────────────────────────────────────────────────────────

/** YYYY-MM-DD → DD/MM/YYYY (untuk ditampilkan di text input) */
function isoToDisplay(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
}

/** DD/MM/YYYY → YYYY-MM-DD (untuk disimpan ke state) */
function displayToIso(display) {
    const clean = display.replace(/[^\d/]/g, "");
    const parts = clean.split("/");
    if (parts.length === 3 && parts[2].length === 4) {
        const [d, m, y] = parts;
        if (d && m && y) return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    return "";
}

/**
 * Auto-format saat user mengetik:
 * - Setiap ketikan digit, sisipkan "/" setelah posisi 2 (hari) dan 5 (bulan).
 * - Hapus (Backspace) biarkan alami — hanya hapus format slash kalau perlu.
 */
function formatAsUserTypes(raw) {
    // Ambil hanya digit
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function DateInput({
    value = "",
    onChange,
    disabled = false,
    className = "",
    inputClass = "",
    placeholder = "DD/MM/YYYY",
}) {
    const textRef = useRef(null);

    // Hidden input type="date" — dipakai hanya untuk membuka kalender
    const hiddenRef = useRef(null);

    // Sinkronisasi jika value dari luar berubah (mis. reset form)
    useEffect(() => {
        const next = isoToDisplay(value);
        if (textRef.current && textRef.current.value !== next) {
            textRef.current.value = next;
        }
        if (hiddenRef.current && hiddenRef.current.value !== (value || "")) {
            hiddenRef.current.value = value || "";
        }
    }, [value]);

    function handleTextChange(e) {
        const raw = e.target.value;
        const formatted = formatAsUserTypes(raw);
        e.target.value = formatted;

        // Coba konversi ke ISO dan panggil onChange jika valid
        const iso = displayToIso(formatted);
        if (iso) {
            onChange?.(iso);
        } else if (!formatted) {
            onChange?.("");
        }
        // Kalau masih mengetik setengah jalan, jangan reset — biarkan state lokal
    }

    function handleTextBlur() {
        // Saat blur, normalkan tampilan dari value ISO yang tersimpan
        if (textRef.current) {
            textRef.current.value = isoToDisplay(value);
        }
    }

    function handleHiddenChange(e) {
        const iso = e.target.value; // YYYY-MM-DD
        onChange?.(iso);
        if (textRef.current) {
            textRef.current.value = isoToDisplay(iso);
        }
    }

    function openPicker() {
        if (disabled) return;
        // Sync dulu hidden input ke value terbaru sebelum buka picker
        if (hiddenRef.current) {
            hiddenRef.current.value = value || "";
            try {
                hiddenRef.current.showPicker();
            } catch {
                // Beberapa browser tidak support showPicker — abaikan
            }
        }
    }

    return (
        <div className={`relative flex items-center ${className}`}>
            {/* Text input — yang user ketik */}
            <input
                ref={textRef}
                type="text"
                inputMode="numeric"
                defaultValue={isoToDisplay(value)}
                onChange={handleTextChange}
                onBlur={handleTextBlur}
                disabled={disabled}
                placeholder={placeholder}
                maxLength={10}
                className={`w-full ${inputClass}`}
            />

            {/* Tombol icon kalender */}
            <button
                type="button"
                onClick={openPicker}
                disabled={disabled}
                tabIndex={-1}
                aria-label="Buka kalender"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-white/30 hover:text-gold-accent transition-colors duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
            </button>

            {/* Hidden date input — hanya untuk native picker */}
            <input
                ref={hiddenRef}
                type="date"
                defaultValue={value || ""}
                onChange={handleHiddenChange}
                disabled={disabled}
                tabIndex={-1}
                aria-hidden="true"
                className="absolute inset-0 opacity-0 pointer-events-none w-full h-full"
                style={{ zIndex: -1 }}
            />
        </div>
    );
}
