

import { useEffect, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import { FieldInput, FieldSelect } from "../../components/shared/AppShared";
import { API_BASE_URL, fetchJson } from "../../app/utils";

function TenantAdminFormPage({ initialData = null, isps = [], lockedIsp = null, mode = "create", onCancel, onNavigate, onSaved }) {
    const [form, setForm] = useState({
        name: "",
        status: "aktif",
        paket: "core",
        jumlah: "0",
        ratioLeft: "1",
        ratioRight: "8",
        contractStartDate: "",
        contractPeriodStart: "",
        contractPeriodEnd: "",
        
        billingPeriodMode: "bulanan",
        billingCustomEvery: "",
        billingCustomUnit: "bulan",
        activationFeeAmount: "0",
    });
    const [selectedIspId, setSelectedIspId] = useState(null);
    const [submitError, setSubmitError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // State for Search and Pagination
    const [ispSearchTerm, setIspSearchTerm] = useState("");
    const [ispPage, setIspPage] = useState(1);
    const itemsPerPage = 6;

    const isEditMode = mode === "edit";
    const isLockedToIsp = !isEditMode && Boolean(lockedIsp?.id);

    useEffect(() => {
        if (!initialData) {
            return;
        }

        setForm((previous) => ({
            ...previous,
            name: initialData.name ?? "",
            status: initialData.rawStatus ?? initialData.status ?? "aktif",
        }));
    }, [initialData]);

    useEffect(() => {
        if (!isLockedToIsp) {
            return;
        }

        setSelectedIspId(Number(lockedIsp.id));
    }, [isLockedToIsp, lockedIsp]);

    const selectIsp = (ispId) => {
        setSelectedIspId(ispId);
    };

    // Filter and Paginate ISPs
    const filteredIsps = isps.filter(isp => 
        isp.name.toLowerCase().includes(ispSearchTerm.toLowerCase()) ||
        (isp.contractReference && isp.contractReference.toLowerCase().includes(ispSearchTerm.toLowerCase()))
    );
    
    const totalPages = Math.ceil(filteredIsps.length / itemsPerPage);
    const displayedIsps = filteredIsps.slice((ispPage - 1) * itemsPerPage, ispPage * itemsPerPage);

    useEffect(() => {
        setIspPage(1); // Reset to first page on search
    }, [ispSearchTerm]);

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!form.name.trim()) {
            setSubmitError("Nama tenant wajib diisi.");
            return;
        }

        if (!isEditMode) {
            if (!selectedIspId) {
                setSubmitError("Tenant harus terhubung ke satu ISP.");
                return;
            }
            if (form.paket === "shared" && (!form.ratioLeft || !form.ratioRight || Number(form.ratioLeft) < 1 || Number(form.ratioRight) < 1)) {
                setSubmitError("Shared Core ratio tidak valid. Masukkan angka >= 1 di kedua kolom.");
                return;
            }
            if (!form.contractPeriodStart || !form.contractPeriodEnd || form.contractPeriodStart > form.contractPeriodEnd) {
                setSubmitError("Periode kontrak tenant tidak valid.");
                return;
            }
        }

        setIsSubmitting(true);
        setSubmitError("");

        try {
            const endpoint = isEditMode && initialData?.id
                ? `${API_BASE_URL}/api/customers/${initialData.id}`
                : `${API_BASE_URL}/api/customers`;
            const result = await fetchJson(endpoint, {
                method: isEditMode ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(isEditMode
                    ? {
                        name: form.name.trim(),
                        status: form.status,
                    }
                    : {
                        name: form.name.trim(),
                        status: form.status,
                        ispIds: [selectedIspId],
                        contractStartDate: form.contractStartDate || form.contractPeriodStart,
                        contractPeriodStart: form.contractPeriodStart,
                        contractPeriodEnd: form.contractPeriodEnd,
                        
                        paket: form.paket,
                        jumlah: form.paket === "core" ? Math.round(Number(form.jumlah || 0)) : 0,
                        contractSharingRatio: form.paket === "shared" ? `${form.ratioLeft || 1}:${form.ratioRight || 8}` : undefined,
                        billingPeriodMode: form.billingPeriodMode,
                        billingCustomEvery: form.billingPeriodMode === "custom" ? Number(form.billingCustomEvery) : undefined,
                        billingCustomUnit: form.billingPeriodMode === "custom" ? form.billingCustomUnit : undefined,
                        activationFeeAmount: Math.round(Number(form.activationFeeAmount || 0)),
                    }),
            });

            if (onSaved) {
                await onSaved(result);
            }
        } catch (requestError) {
            setSubmitError(requestError instanceof Error ? requestError.message : `Terjadi kesalahan saat ${isEditMode ? "memperbarui" : "menyimpan"} tenant.`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AppShell activeSection="customers" onNavigate={onNavigate}>
            <form className="mx-auto max-w-6xl space-y-4 md:space-y-8" onSubmit={handleSubmit}>
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end px-2 md:px-0">
                    <div>
                        <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-on-surface-variant/60">{isEditMode ? "Edit Tenant" : "Tambah Tenant"}</p>
                        <h1 className="mt-1 md:mt-2 text-xl md:text-3xl font-extrabold text-primary">{isEditMode ? "Edit Lokasi / Tenant" : "Tenant Baru"}</h1>
                        {!isEditMode && (
                            <p className="mt-1 md:mt-2 max-w-xl text-[11px] md:text-sm text-on-surface-variant">
                                Sistem akan otomatis membuat kontrak dan invoice.
                            </p>
                        )}
                    </div>
                    <div className="flex gap-2 md:gap-3">
                        <button className="flex-1 md:flex-none rounded-xl px-4 md:px-6 py-2 md:py-2.5 text-xs md:text-sm font-semibold text-on-surface-variant transition-all hover:bg-surface-container-high border border-slate-200 md:border-none" onClick={onCancel} type="button">Batalkan</button>
                        <button className="flex-[2] md:flex-none rounded-xl bg-gradient-to-br from-primary to-primary-container px-4 md:px-8 py-2 md:py-2.5 text-xs md:text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting} type="submit">{isSubmitting ? "..." : isEditMode ? "Simpan" : "Simpan Tenant"}</button>
                    </div>
                </div>

                {submitError && <div className="mx-2 md:mx-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] md:text-sm font-medium text-red-700">{submitError}</div>}

                <div className="grid grid-cols-12 gap-3 md:gap-8 px-2 md:px-0">
                    {/* KOLOM KIRI: Detail Utama */}
                    <section className={`${isEditMode ? "col-span-12" : "col-span-7 md:col-span-8"} space-y-3 md:space-y-8`}>
                        <div className="rounded-xl bg-surface-container-lowest p-3 md:p-8 shadow-sm">
                            <div className="grid grid-cols-1 gap-3 md:gap-6">
                                <FieldInput label="Nama Tenant" value={form.name} onChange={(value) => setForm((previous) => ({ ...previous, name: value }))} />
                                <FieldSelect 
                                    label="Status" 
                                    value={form.status} 
                                    onChange={(value) => setForm((previous) => ({ ...previous, status: value }))} 
                                    options={[
                                        { value: "aktif", label: "Beroperasi" }, 
                                        ...(isEditMode ? [{ value: "expired", label: "Expired" }] : []),
                                        { value: "berhenti", label: "Berhenti" }
                                    ]} 
                                />
                                {!isEditMode && (
                                    <>
                                        <FieldSelect label="Paket" value={form.paket} onChange={(value) => setForm((previous) => ({ ...previous, paket: value }))} options={[{ value: "core", label: "Core" }, { value: "shared", label: "Shared" }]} />
                                        {form.paket === "core" ? (
                                            <FieldInput label="Core" type="number" value={form.jumlah} onChange={(value) => setForm((previous) => ({ ...previous, jumlah: value }))} />
                                        ) : (
                                            <div className="space-y-1">
                                                <label className="block text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Ratio</label>
                                                <div className="flex items-center gap-1">
                                                    <input className="w-full rounded-lg border border-slate-200 bg-surface-container-lowest px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary/20" type="number" value={form.ratioLeft} onChange={(event) => setForm((previous) => ({ ...previous, ratioLeft: event.target.value }))} />
                                                    <span className="font-bold text-slate-400">:</span>
                                                    <input className="w-full rounded-lg border border-slate-200 bg-surface-container-lowest px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary/20" type="number" value={form.ratioRight} onChange={(event) => setForm((previous) => ({ ...previous, ratioRight: event.target.value }))} />
                                                </div>
                                            </div>
                                        )}
                                        <FieldInput label="Awal Kontrak (Opsional)" type="date" value={form.contractStartDate} onChange={(value) => setForm((previous) => ({ ...previous, contractStartDate: value }))} />
                                        <FieldInput label="Periode berjalan mulai" type="date" value={form.contractPeriodStart} onChange={(value) => setForm((previous) => ({ ...previous, contractPeriodStart: value }))} />
                                        <FieldInput label="Periode berjalan akhir" type="date" value={form.contractPeriodEnd} onChange={(value) => setForm((previous) => ({ ...previous, contractPeriodEnd: value }))} />
                                    </>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* KOLOM KANAN: Billing & Biaya */}
                    {!isEditMode && (
                        <section className="col-span-5 md:col-span-4 space-y-3 md:space-y-8">
                            <div className="rounded-xl bg-surface-container-lowest p-3 md:p-6 shadow-sm">
                                <div className="space-y-4">
                                    <div>
                                        <label className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-on-surface-variant leading-tight">Billing Period</label>
                                        <div className="grid grid-cols-1 gap-1.5">
                                            {["bulanan", "3bulanan", "custom"].map((modeValue) => (
                                                <button key={modeValue} className={`rounded-lg py-1.5 text-[10px] font-bold transition-colors ${form.billingPeriodMode === modeValue ? "bg-primary text-white" : "bg-surface-container-lowest text-on-surface-variant border border-slate-100 hover:bg-slate-50"}`} onClick={() => setForm((previous) => ({ ...previous, billingPeriodMode: modeValue }))} type="button">{modeValue === "bulanan" ? "Bulanan" : modeValue === "3bulanan" ? "3 Bln" : "Custom"}</button>
                                            ))}
                                        </div>
                                        {form.billingPeriodMode === "custom" && (
                                            <div className="mt-2 rounded-lg bg-surface-container-lowest p-2 ring-1 ring-slate-200/50">
                                                <div className="flex flex-col gap-1.5">
                                                    <input className="w-full rounded border-none bg-surface p-1.5 text-[10px] focus:ring-1 focus:ring-primary/20" min="1" onChange={(event) => setForm((previous) => ({ ...previous, billingCustomEvery: event.target.value }))} step="1" type="number" value={form.billingCustomEvery} placeholder="Every" />
                                                    <select className="w-full rounded border-none bg-surface p-1.5 text-[10px] focus:ring-1 focus:ring-primary/20" onChange={(event) => setForm((previous) => ({ ...previous, billingCustomUnit: event.target.value }))} value={form.billingCustomUnit}>
                                                        <option value="hari">Hari</option>
                                                        <option value="bulan">Bulan</option>
                                                        <option value="tahun">Tahun</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <FieldInput label="Aktivasi" type="number" value={form.activationFeeAmount} onChange={(value) => setForm((previous) => ({ ...previous, activationFeeAmount: value }))} />
                                </div>
                            </div>
                        </section>
                    )}

                    {/* BAGIAN ISP: Lebar Penuh (col-span-12) dengan Search & Pagination */}
                    {!isEditMode && (
                        <section className="col-span-12">
                            <div className="rounded-xl bg-surface-container-lowest p-4 md:p-8 shadow-sm">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                    <div>
                                        <h3 className="text-sm md:text-lg font-bold text-on-surface">Pilih ISP</h3>
                                        <p className="text-[10px] md:text-xs text-on-surface-variant">Hubungkan tenant ke satu penyedia layanan.</p>
                                    </div>
                                    
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            placeholder="Cari ISP..." 
                                            className="w-full md:w-64 rounded-lg border border-slate-200 bg-surface px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20"
                                            value={ispSearchTerm}
                                            onChange={(e) => setIspSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {displayedIsps.map((isp) => (
                                        <label key={isp.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${selectedIspId === isp.id ? "border-primary bg-blue-50/60" : "border-slate-200 bg-white"}`}>
                                            <input checked={selectedIspId === isp.id} className="mt-1" name="selectIspRadio" onChange={() => selectIsp(isp.id)} type="radio" />
                                            <div className="min-w-0">
                                                <p className="text-xs md:text-sm font-bold truncate text-on-surface">{isp.name}</p>
                                                <p className="text-[10px] md:text-xs text-on-surface-variant truncate">{isp.contractReference || "Tanpa referensi"}</p>
                                            </div>
                                        </label>
                                    ))}
                                    {displayedIsps.length === 0 && (
                                        <div className="col-span-full py-8 text-center text-xs text-on-surface-variant">
                                            ISP tidak ditemukan.
                                        </div>
                                    )}
                                </div>

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="mt-6 flex items-center justify-center gap-2">
                                        <button 
                                            type="button"
                                            disabled={ispPage === 1}
                                            onClick={() => setIspPage(p => p - 1)}
                                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-bold disabled:opacity-30"
                                        >
                                            Sebelumnya
                                        </button>
                                        <span className="text-[10px] font-bold text-on-surface-variant">Halaman {ispPage} dari {totalPages}</span>
                                        <button 
                                            type="button"
                                            disabled={ispPage === totalPages}
                                            onClick={() => setIspPage(p => p + 1)}
                                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-bold disabled:opacity-30"
                                        >
                                            Selanjutnya
                                        </button>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}
                </div>
            </form>
        </AppShell>
    );
}

export default TenantAdminFormPage;
