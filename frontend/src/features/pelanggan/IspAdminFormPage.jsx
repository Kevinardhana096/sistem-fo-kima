import { useEffect, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import { FieldInput, FieldSelect } from "../../components/shared/AppShared";
import { API_BASE_URL, fetchJson, readFileAsDataUrl } from "../../app/utils";

function IspAdminFormPage({ initialData = null, mode = "create", onCancel, onNavigate, onSaved }) {
    const [form, setForm] = useState({
        name: "",
        status: "aktif",
        contractReference: "",
        contractStartDate: "",
        contractPeriodStart: "",
        contractPeriodEnd: "",
        bakFileName: "",
        bakFileDataUrl: "",
        contractFileName: "",
        contractFileDataUrl: "",
        logoUrl: "",
        logoFileDataUrl: "",
    });
    const [submitError, setSubmitError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isEditMode = mode === "edit";

    useEffect(() => {
        if (!initialData) {
            return;
        }

        setForm((previous) => ({
            ...previous,
            name: initialData.name ?? "",
            status: initialData.status ?? "aktif",
            logoUrl: initialData.logoUrl ?? "",
        }));
    }, [initialData]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!form.name.trim()) {
            setSubmitError("Nama ISP wajib diisi.");
            return;
        }

        if (!isEditMode && !form.contractReference.trim()) {
            setSubmitError("Nomor kontrak induk wajib diisi.");
            return;
        }

        if (
            !isEditMode &&
            form.contractPeriodStart &&
            form.contractPeriodEnd &&
            form.contractPeriodStart > form.contractPeriodEnd
        ) {
            setSubmitError("Periode berjalan akhir tidak boleh lebih awal dari tanggal mulai.");
            return;
        }

        setIsSubmitting(true);
        setSubmitError("");
        try {
            const endpoint = isEditMode && initialData?.id
                ? `${API_BASE_URL}/api/isps/${initialData.id}`
                : `${API_BASE_URL}/api/isps`;
            
            const payload = isEditMode
                ? {
                    name: form.name.trim(),
                    status: form.status,
                    logoUrl: form.logoFileDataUrl || form.logoUrl || undefined,
                }
                : {
                    name: form.name.trim(),
                    status: form.status,
                    contractReference: form.contractReference.trim(),
                    contractStartDate: form.contractStartDate || null,
                    contractPeriodStart: form.contractPeriodStart || null,
                    contractPeriodEnd: form.contractPeriodEnd || null,
                    bakFileDataUrl: form.bakFileDataUrl || undefined,
                    bakFileName: form.bakFileName || undefined,
                    contractFileDataUrl: form.contractFileDataUrl || undefined,
                    contractFileName: form.contractFileName || undefined,
                    logoUrl: form.logoFileDataUrl || undefined,
                };

            const result = await fetchJson(endpoint, {
                method: isEditMode ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (onSaved) {
                await onSaved(result);
            }
        } catch (requestError) {
            setSubmitError(requestError instanceof Error ? requestError.message : `Terjadi kesalahan saat ${isEditMode ? "memperbarui" : "menyimpan"} ISP.`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AppShell activeSection="customers" onNavigate={onNavigate}>
            <form className="mx-auto max-w-5xl space-y-8" onSubmit={handleSubmit}>
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant/60">{isEditMode ? "Edit ISP" : "Tambah ISP"}</p>
                        <h1 className="mt-2 text-3xl font-extrabold text-primary">{isEditMode ? "Edit ISP" : "ISP Baru"}</h1>
                    </div>
                    <div className="flex gap-3">
                        <button className="rounded-xl px-6 py-2.5 font-semibold text-on-surface-variant transition-all hover:bg-surface-container-high" onClick={onCancel} type="button">Batalkan</button>
                        <button className="rounded-xl bg-gradient-to-br from-primary to-primary-container px-8 py-2.5 font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting} type="submit">{isSubmitting ? "Menyimpan..." : isEditMode ? "Simpan Perubahan" : "Simpan ISP"}</button>
                    </div>
                </div>

                {submitError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{submitError}</div>}

                <div className="rounded-lg bg-surface-container-lowest p-8 shadow-sm">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <FieldInput label="Nama ISP" value={form.name} onChange={(value) => setForm((previous) => ({ ...previous, name: value }))} />
                        <FieldSelect label="Status" value={form.status} onChange={(value) => setForm((previous) => ({ ...previous, status: value }))} options={[{ value: "aktif", label: "Aktif" }, { value: "nonaktif", label: "Non-aktif" }]} />
                        
                        <div className="md:col-span-2">
                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Logo Perusahaan (Opsional)</label>
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 transition-colors hover:border-primary/50">
                                    {(form.logoFileDataUrl || form.logoUrl) ? (
                                        <img 
                                            src={form.logoFileDataUrl || form.logoUrl} 
                                            alt="Preview" 
                                            className="h-full w-full object-contain p-2"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full flex-col items-center justify-center text-slate-400">
                                            <span className="material-symbols-outlined text-3xl">image</span>
                                            <span className="text-[10px] font-bold uppercase">No Logo</span>
                                        </div>
                                    )}
                                    <input
                                        accept="image/png,image/jpeg,image/webp"
                                        className="absolute inset-0 cursor-pointer opacity-0"
                                        onChange={(event) => {
                                            const file = event.target.files?.[0] ?? null;
                                            if (!file) return;
                                            void readFileAsDataUrl(file).then((url) => {
                                                setForm(prev => ({ ...prev, logoFileDataUrl: url }));
                                            });
                                        }}
                                        type="file"
                                    />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-on-surface">Unggah Logo</p>
                                    <p className="mt-1 text-xs text-on-surface-variant">Format PNG, JPG, atau WebP. Rekomendasi 1:1 (Square).</p>
                                    {form.logoFileDataUrl && (
                                        <button 
                                            className="mt-2 text-xs font-bold text-red-600 hover:underline"
                                            onClick={() => setForm(prev => ({ ...prev, logoFileDataUrl: "" }))}
                                            type="button"
                                        >
                                            Reset ke Logo Lama
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {!isEditMode && (
                            <>
                                <FieldInput label="Nomor kontrak induk" value={form.contractReference} onChange={(value) => setForm((previous) => ({ ...previous, contractReference: value }))} />
                                <FieldInput label="Awal kontrak" type="date" value={form.contractStartDate} onChange={(value) => setForm((previous) => ({ ...previous, contractStartDate: value }))} />
                                <FieldInput label="Periode berjalan mulai" type="date" value={form.contractPeriodStart} onChange={(value) => setForm((previous) => ({ ...previous, contractPeriodStart: value }))} />
                                <FieldInput label="Periode berjalan akhir" type="date" value={form.contractPeriodEnd} onChange={(value) => setForm((previous) => ({ ...previous, contractPeriodEnd: value }))} />
                                
                                <div>
                                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Upload Berkas Kontrak (Opsional)</label>
                                    <input
                                        accept=".pdf,.png,.jpg,.jpeg,.zip"
                                        className="w-full rounded-lg border border-slate-200 bg-surface-container-lowest px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/10"
                                        onChange={(event) => {
                                            const file = event.target.files?.[0] ?? null;
                                            if (!file) {
                                                setForm((previous) => ({
                                                    ...previous,
                                                    contractFileName: "",
                                                    contractFileDataUrl: "",
                                                }));
                                                return;
                                            }

                                            void readFileAsDataUrl(file)
                                                .then((fileDataUrl) => {
                                                    setForm((previous) => ({
                                                        ...previous,
                                                        contractFileName: file.name,
                                                        contractFileDataUrl: fileDataUrl,
                                                    }));
                                                })
                                                .catch((error) => {
                                                    setSubmitError(error instanceof Error ? error.message : "Gagal membaca file kontrak.");
                                                });
                                        }}
                                        type="file"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Upload BAK (Opsional)</label>
                                    <input
                                        accept=".pdf,.png,.jpg,.jpeg,.zip"
                                        className="w-full rounded-lg border border-slate-200 bg-surface-container-lowest px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/10"
                                        onChange={(event) => {
                                            const file = event.target.files?.[0] ?? null;
                                            if (!file) {
                                                setForm((previous) => ({
                                                    ...previous,
                                                    bakFileName: "",
                                                    bakFileDataUrl: "",
                                                }));
                                                return;
                                            }

                                            void readFileAsDataUrl(file)
                                                .then((fileDataUrl) => {
                                                    setForm((previous) => ({
                                                        ...previous,
                                                        bakFileName: file.name,
                                                        bakFileDataUrl: fileDataUrl,
                                                    }));
                                                })
                                                .catch((error) => {
                                                    setSubmitError(error instanceof Error ? error.message : "Gagal membaca file BAK.");
                                                });
                                        }}
                                        type="file"
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </form>
        </AppShell>
    );
}

export default IspAdminFormPage;
