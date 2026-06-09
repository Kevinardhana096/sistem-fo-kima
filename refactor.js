const fs = require('fs');

let content = fs.readFileSync('frontend/src/features/pelanggan/IspDetailPage.jsx', 'utf8');

// 1. State changes
content = content.replace(
    'const [inlineDrafts, setInlineDrafts] = useState({});\n    const [editingContractRowId, setEditingContractRowId] = useState(null);',
    'const [contractRowEditor, setContractRowEditor] = useState(null);\n    const [isSavingContractRow, setIsSavingContractRow] = useState(false);\n    const isSelectingFileRef = useRef(false);'
);

// 2. remove draft helpers and replace openContractRowEditor
const draftHelpersRegex = /const createRowDraft = \(row\) => \(\{[\s\S]*?clearContractRowFileDraft = \(rowId, type\) => \{[\s\S]*?setError\(""\);\n    \};/m;

const newOpenEditor = `const openContractRowEditor = (row, focusField = null) => {
        if (!canManageIspContracts) return;
        setError("");
        setContractRowEditor({
            rowId: row.id,
            contractReference: row.contractReference ?? "",
            status: getIspContractRowEditStatus(row),
            contractStartDate: row.contractStartDate ?? detail?.contractStartDate ?? detail?.contract_start_date ?? isp.contractStartDate ?? isp.contract_start_date ?? "",
            periodStart: row.periodStart ?? "",
            periodEnd: row.periodEnd ?? "",
            contractUploadedFile: null,
            contractUploadedFileName: "",
            contractFileUrl: row.contractFileUrl ?? "",
            bakUploadedFile: null,
            bakUploadedFileName: "",
            bakFileUrl: row.bakFileUrl ?? "",
            focusField,
        });
    };`;

content = content.replace(draftHelpersRegex, newOpenEditor);

// 3. handleInlineRowSave
const handleInlineRowSaveRegex = /const handleInlineRowSave = async \(row\) => \{[\s\S]*?return true;\n    \};/m;

const newHandleSave = `const handleSaveContractRow = async (event = null, overrides = {}) => {
        if (event) event.preventDefault();
        if (!contractRowEditor) return;

        const currentEditor = { ...contractRowEditor, ...overrides };
        const contractReference = String(currentEditor.contractReference ?? "").trim();
        const contractStartDate = String(currentEditor.contractStartDate ?? "").slice(0, 10);
        const periodStart = String(currentEditor.periodStart ?? "").slice(0, 10);
        const periodEnd = String(currentEditor.periodEnd ?? "").slice(0, 10);

        if (!contractReference) {
            setError("Nomor kontrak wajib diisi.");
            return false;
        }
        if (!periodStart) {
            setError("Periode berjalan awal wajib diisi.");
            return false;
        }
        if (!periodEnd) {
            setError("Periode berjalan akhir wajib diisi.");
            return false;
        }
        if (periodStart > periodEnd) {
            setError("Periode awal tidak boleh lebih besar dari periode akhir.");
            return false;
        }

        const updates = {
            contract_reference: contractReference,
            contract_start_date: contractStartDate || null,
            period_start: periodStart,
            period_end: periodEnd,
            status: currentEditor.status ?? "aktif",
        };
        const pendingReplacementLabels = [
            currentEditor.contractUploadedFile instanceof File && isOpenableFileUrl(currentEditor.contractFileUrl) ? "Kontrak" : null,
            currentEditor.bakUploadedFile instanceof File && isOpenableFileUrl(currentEditor.bakFileUrl) ? "BAK" : null,
        ].filter(Boolean);

        if (pendingReplacementLabels.length > 0) {
            const confirmed = window.confirm(\`Ganti berkas \${pendingReplacementLabels.join(" dan ")} yang sudah tersimpan? Berkas lama akan diganti setelah perubahan disimpan.\`);
            if (!confirmed) return false;
        }

        setError("");
        setIsActionLoading(true);
        setIsSavingContractRow(true);
        try {
            if (currentEditor.contractUploadedFile instanceof File) {
                updates.contract_file_url = await uploadFileForRecord(currentEditor.contractUploadedFile, ["isps", isp.id, "contract"]);
                updates.contract_file_name = currentEditor.contractUploadedFile.name;
            }
            if (currentEditor.bakUploadedFile instanceof File) {
                updates.bak_file_url = await uploadFileForRecord(currentEditor.bakUploadedFile, ["isps", isp.id, "bak"]);
                updates.bak_file_name = currentEditor.bakUploadedFile.name;
            }
            await handleUpdateRow(currentEditor.rowId, updates);
            setContractRowEditor(null);
            return true;
        } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : "Gagal mengunggah berkas pengganti.");
            return false;
        } finally {
            setIsActionLoading(false);
            setIsSavingContractRow(false);
        }
    };

    const triggerAutoSave = async () => {
        if (!contractRowEditor) return;
        if (isSelectingFileRef.current) return;

        const originalRow = contractRows.find(r => r.id === contractRowEditor.rowId);
        if (!originalRow) return;

        const originalContractStartDate = originalRow.contractStartDate ?? detail?.contractStartDate ?? detail?.contract_start_date ?? isp.contractStartDate ?? isp.contract_start_date ?? "";
        const originalStatus = getIspContractRowEditStatus(originalRow);

        const hasChanges =
            String(contractRowEditor.contractReference ?? "").trim() !== String(originalRow.contractReference ?? "").trim() ||
            String(contractRowEditor.status ?? "").trim() !== String(originalStatus ?? "").trim() ||
            String(contractRowEditor.contractStartDate ?? "").slice(0, 10) !== String(originalContractStartDate ?? "").slice(0, 10) ||
            String(contractRowEditor.periodStart ?? "").slice(0, 10) !== String(originalRow.periodStart ?? "").slice(0, 10) ||
            String(contractRowEditor.periodEnd ?? "").slice(0, 10) !== String(originalRow.periodEnd ?? "").slice(0, 10) ||
            contractRowEditor.contractUploadedFile !== null ||
            contractRowEditor.bakUploadedFile !== null;

        if (hasChanges) {
            await handleSaveContractRow();
        } else {
            setContractRowEditor(null);
        }
    };`;

content = content.replace(handleInlineRowSaveRegex, newHandleSave);

// Scoped replacements in filteredContracts.map
const mapStartIdx = content.indexOf('filteredContracts.map((row, idx) => {');
const mapEndIdx = content.indexOf('filteredContracts.length === 0', mapStartIdx);

if (mapStartIdx !== -1 && mapEndIdx !== -1) {
    let mapBlock = content.substring(mapStartIdx, mapEndIdx);

    mapBlock = mapBlock.replace(
        'const isEditingContractRow = editingContractRowId === row.id;\n                                                const draft = getRowDraft(row);',
        'const isEditingContractRow = contractRowEditor?.rowId === row.id;'
    );
    mapBlock = mapBlock.replace(
        'const statusForBadge = isEditingContractRow ? draft.status : getContractRowStatus(row, todayIso);',
        'const statusForBadge = isEditingContractRow ? contractRowEditor.status : getContractRowStatus(row, todayIso);'
    );
    mapBlock = mapBlock.replace(
        'void handleInlineRowSave(row);',
        'void triggerAutoSave();'
    );

    // Nomor Kontrak
    const nomorKontrakOld = `<td className="px-3 py-2.5 text-center border-r border-white/10 min-w-[230px]">
                                                        {isEditingContractRow ? (
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    className="min-h-8 w-full rounded-lg bg-white/10 border border-white/20 px-3 py-1.5 text-[11px] font-bold text-white outline-none focus:border-gold-accent transition-all"
                                                                    value={draft.contractReference || ""}
                                                                    onChange={(e) => setRowDraft(row.id, { contractReference: e.target.value })}
                                                                    onKeyDown={(event) => {
                                                                        if (event.key === "Enter") {
                                                                            event.preventDefault();
                                                                            event.currentTarget.blur();
                                                                        }
                                                                        if (event.key === "Escape") {
                                                                            cancelContractRowEditor(row.id);
                                                                            event.currentTarget.blur();
                                                                        }
                                                                    }}
                                                                />
                                                                <button className="h-8 w-8 shrink-0 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all" onClick={() => void handleInlineRowSave(row)} type="button" title="Simpan perubahan">
                                                                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>check</span>
                                                                </button>
                                                                <button className="h-8 w-8 shrink-0 rounded-lg border border-white/10 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all" onClick={() => cancelContractRowEditor(row.id)} type="button" title="Batalkan edit">
                                                                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>close</span>
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button className={editableCellButtonClass} disabled={!canManageIspContracts} onClick={() => openContractRowEditor(row)} type="button" title={canManageIspContracts ? "Edit baris kontrak" : undefined}>
                                                                {row.contractReference || <span className="text-white/20">Nomor kontrak</span>}
                                                            </button>
                                                        )}
                                                    </td>`;

    const nomorKontrakNew = `<td className="border-r border-white/10 p-0 min-w-[230px]">
                                                        {isEditingContractRow ? (
                                                            <input
                                                                type="text"
                                                                className="min-h-9 w-full bg-transparent px-4 py-2 text-[11px] font-black uppercase tracking-tight text-white border-transparent focus:border-gold-accent/40 focus:bg-white/[0.04] hover:bg-white/[0.02] outline-none transition-all"
                                                                value={contractRowEditor.contractReference || ""}
                                                                onChange={(e) => setContractRowEditor((prev) => prev ? { ...prev, contractReference: e.target.value } : prev)}
                                                                placeholder="Nomor kontrak / BAK"
                                                                onKeyDown={(event) => {
                                                                    if (event.key === "Enter") {
                                                                        event.preventDefault();
                                                                        event.currentTarget.blur();
                                                                    }
                                                                    if (event.key === "Escape") {
                                                                        setContractRowEditor(null);
                                                                        event.currentTarget.blur();
                                                                    }
                                                                }}
                                                            />
                                                        ) : (
                                                            <button
                                                                className="min-h-9 w-full px-4 py-2 text-left text-[11px] font-black uppercase tracking-tight leading-snug text-white whitespace-normal break-words hover:bg-white/[0.02] focus:bg-white/[0.04] focus:outline-none focus:ring-1 focus:ring-gold-accent/40 transition-all"
                                                                disabled={!canManageIspContracts}
                                                                onClick={() => openContractRowEditor(row)}
                                                                type="button"
                                                                title={canManageIspContracts ? "Edit baris kontrak" : undefined}
                                                            >
                                                                {row.contractReference || <span className="text-white/20">Nomor kontrak / BAK</span>}
                                                            </button>
                                                        )}
                                                    </td>`;
    mapBlock = mapBlock.replace(nomorKontrakOld, nomorKontrakNew);

    // Status
    const statusOld = `<td className="px-3 py-2.5 text-center border-r border-white/10">
                                                        <div className="flex flex-col items-center gap-2">
                                                            <span className={\`inline-flex items-center rounded-full border px-3 py-1 text-[8px] font-black uppercase tracking-widest \${statusClasses}\`}>{statusLabel}</span>
                                                            {isEditingContractRow && (
                                                                <select
                                                                    value={draft.status || "aktif"}
                                                                    onChange={(event) => setRowDraft(row.id, { status: event.target.value })}
                                                                    className="w-full rounded-lg bg-white/10 border border-white/20 px-2 py-1.5 text-[10px] font-bold text-white outline-none focus:border-gold-accent transition-all uppercase"
                                                                >
                                                                    <option value="aktif">Beroperasi</option>
                                                                    <option value="expired">Belum Diperpanjang</option>
                                                                    <option value="berhenti">Berhenti</option>
                                                                </select>
                                                            )}
                                                        </div>
                                                    </td>`;
    const statusNew = `<td className="px-3 py-2.5 text-center border-r border-white/10">
                                                        <div className="flex flex-col items-center gap-2">
                                                            <span className={\`inline-flex items-center rounded-full border px-3 py-1 text-[8px] font-black uppercase tracking-widest \${statusClasses}\`}>{statusLabel}</span>
                                                            {isEditingContractRow && (
                                                                <select
                                                                    value={contractRowEditor.status || "aktif"}
                                                                    onChange={(event) => setContractRowEditor((prev) => prev ? { ...prev, status: event.target.value } : prev)}
                                                                    className="w-full rounded-lg bg-white/10 border border-white/20 px-2 py-1.5 text-[10px] font-bold text-white outline-none focus:border-gold-accent transition-all uppercase"
                                                                >
                                                                    <option value="aktif">Beroperasi</option>
                                                                    <option value="expired">Belum Diperpanjang</option>
                                                                    <option value="berhenti">Berhenti</option>
                                                                </select>
                                                            )}
                                                        </div>
                                                    </td>`;
    mapBlock = mapBlock.replace(statusOld, statusNew);

    // Contract File
    const contractFileOld = `<td className="px-3 py-2.5 text-center border-r border-white/10">
                                                        <div className="flex flex-col items-center justify-center gap-2">
                                                            <div className="flex items-center justify-center gap-2 flex-wrap">
                                                                {isOpenableFileUrl(row.contractFileUrl) ? (
                                                                    <button onClick={() => openSafeFile(row.contractFileUrl, row.contractFileName)} className={\`\${fileActionButtonClass} \${fileActionPrimaryClass}\`}><span className="material-symbols-outlined" style={{ fontSize: "14px" }}>description</span>Buka Kontrak</button>
                                                                ) : !canManageIspContracts ? <span className="text-[10px] font-bold text-white/20">Belum diunggah</span> : null}
                                                                {canManageIspContracts && (
                                                                    <FilePickerButton
                                                                        label={isOpenableFileUrl(row.contractFileUrl) ? "Ganti Kontrak" : "Upload Kontrak"}
                                                                        className={\`\${fileActionButtonClass} \${fileActionMutedClass}\`}
                                                                        onPickFile={(file) => setContractRowFileDraft(row, 'contract', file)}
                                                                    />
                                                                )}
                                                            </div>
                                                            {isEditingContractRow && (
                                                                draft.contractUploadedFileName ? (
                                                                    <div className="flex max-w-[190px] items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-left">
                                                                        <span className="material-symbols-outlined text-amber-300" style={{ fontSize: "13px" }}>pending</span>
                                                                        <span className="min-w-0 flex-1 truncate text-[9px] font-bold text-amber-100" title={draft.contractUploadedFileName}>Siap ganti kontrak: {draft.contractUploadedFileName}</span>
                                                                        <button type="button" className="text-white/40 hover:text-white" onClick={() => clearContractRowFileDraft(row.id, 'contract')} title="Batalkan ganti file kontrak">
                                                                            <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>close</span>
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <p className="max-w-[210px] text-center text-[8px] font-bold uppercase tracking-widest text-white/20">Pilih file kontrak baru lalu simpan baris</p>
                                                                )
                                                            )}
                                                        </div>
                                                    </td>`;
    const contractFileNew = `<td className="px-3 py-2.5 text-center border-r border-white/10 p-0">
                                                        <div className="flex items-center justify-center gap-1.5 p-2">
                                                            {isEditingContractRow && contractRowEditor.contractUploadedFile ? (
                                                                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 max-w-[150px]">
                                                                    <span className="text-[8px] font-bold text-blue-400 truncate" title={contractRowEditor.contractUploadedFileName}>
                                                                        {contractRowEditor.contractUploadedFileName}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setContractRowEditor(prev => prev ? { ...prev, contractUploadedFile: null, contractUploadedFileName: "" } : null);
                                                                        }}
                                                                        className="text-white/40 hover:text-white flex items-center justify-center"
                                                                        title="Batal berkas baru"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[10px]">close</span>
                                                                    </button>
                                                                </div>
                                                            ) : (isEditingContractRow ? contractRowEditor.contractFileUrl : row.contractFileUrl) ? (
                                                                <div className="flex items-center gap-1.5">
                                                                    <button type="button" onClick={() => openSafeFile(isEditingContractRow ? contractRowEditor.contractFileUrl : row.contractFileUrl, row.contractFileName)} className={\`\${fileActionButtonClass} \${fileActionPrimaryClass}\`}>
                                                                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>description</span>Buka Kontrak
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (!isEditingContractRow) {
                                                                                openContractRowEditor(row, null);
                                                                                setTimeout(() => {
                                                                                    setContractRowEditor(prev => prev ? { ...prev, contractFileUrl: "" } : null);
                                                                                }, 50);
                                                                            } else {
                                                                                setContractRowEditor(prev => prev ? { ...prev, contractFileUrl: "" } : null);
                                                                            }
                                                                        }}
                                                                        className="h-6 w-6 rounded border border-[#ff2400]/20 bg-[#ff2400]/10 flex items-center justify-center text-[#ff2400] hover:bg-[#ff2400] hover:text-white transition-all"
                                                                        title="Hapus berkas"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[10px]">close</span>
                                                                    </button>
                                                                </div>
                                                            ) : !canManageIspContracts ? (
                                                                <span className="text-[10px] font-bold text-white/20">Belum diunggah</span>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openContractRowEditor(row, "contractFile")}
                                                                    className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 text-[8px] font-black uppercase tracking-widest text-white/40 hover:border-white/20 hover:text-white transition-all"
                                                                >
                                                                    <span className="material-symbols-outlined text-[12px]">upload_file</span>
                                                                    Upload
                                                                </button>
                                                            )}
                                                            {isEditingContractRow && (
                                                                <label
                                                                    className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-white/10 bg-white/5 text-white/40 hover:text-white hover:border-white/20 transition-all"
                                                                    onClick={() => { isSelectingFileRef.current = true; }}
                                                                    title="Ganti berkas"
                                                                >
                                                                    <span className="material-symbols-outlined text-[12px]">upload_file</span>
                                                                    <input
                                                                        type="file"
                                                                        className="hidden"
                                                                        disabled={isSavingContractRow}
                                                                        onChange={async (event) => {
                                                                            isSelectingFileRef.current = false;
                                                                            const file = event.target.files?.[0] ?? null;
                                                                            if (file) {
                                                                                setContractRowEditor((previous) => (
                                                                                    previous ? { ...previous, contractUploadedFile: file, contractUploadedFileName: file.name } : previous
                                                                                ));
                                                                                await handleSaveContractRow(null, { contractUploadedFile: file });
                                                                            }
                                                                        }}
                                                                        ref={(el) => {
                                                                            if (el && contractRowEditor?.focusField === "contractFile") {
                                                                                isSelectingFileRef.current = true;
                                                                                el.click();
                                                                                setContractRowEditor((prev) => prev ? { ...prev, focusField: null } : null);
                                                                            }
                                                                        }}
                                                                    />
                                                                </label>
                                                            )}
                                                        </div>
                                                    </td>`;
    mapBlock = mapBlock.replace(contractFileOld, contractFileNew);

    // Contract Start Date
    const contractStartDateOld = `<td className="px-3 py-2.5 border-r border-white/10 text-center">
                                                        {isEditingContractRow ? (
                                                            <DateInput
                                                                value={draft.contractStartDate || contractStartValue || ""}
                                                                onChange={(val) => setRowDraft(row.id, { contractStartDate: val })}
                                                                onKeyDown={(event) => {
                                                                    if (event.key === "Enter") {
                                                                        event.preventDefault();
                                                                        event.currentTarget.blur();
                                                                    }
                                                                }}
                                                                className="rounded-md bg-white/10 border border-white/20 w-28 h-7"
                                                                hideIcon={true}
                                                                inputClass="w-full h-full bg-transparent px-2 text-center text-[11px] text-white outline-none uppercase"
                                                            />
                                                        ) : (
                                                            <button className={editableCellButtonClass} disabled={!canManageIspContracts} onClick={() => openContractRowEditor(row)} type="button">
                                                                {formatDate(contractStartValue)}
                                                            </button>
                                                        )}
                                                    </td>`;
    const contractStartDateNew = `<td className="border-r border-white/10 text-center p-0">
                                                        <DateInput
                                                            value={isEditingContractRow ? (contractRowEditor.contractStartDate || contractStartValue || "") : (contractStartValue || "")}
                                                            onChange={(val) => setContractRowEditor((prev) => prev ? { ...prev, contractStartDate: val } : prev)}
                                                            onKeyDown={(event) => {
                                                                if (event.key === "Enter") {
                                                                    event.preventDefault();
                                                                    event.currentTarget.blur();
                                                                }
                                                                if (event.key === "Escape") {
                                                                    setContractRowEditor(null);
                                                                    event.currentTarget.blur();
                                                                }
                                                            }}
                                                            onFocus={() => {
                                                                if (!isEditingContractRow && canManageIspContracts) {
                                                                    openContractRowEditor(row);
                                                                }
                                                            }}
                                                            className="h-9 w-full"
                                                            hideIcon={true}
                                                            inputClass="w-full h-full bg-transparent px-2 text-[10px] font-black text-white border-transparent focus:border-gold-accent/40 focus:bg-white/[0.04] hover:bg-white/[0.02] outline-none transition-all text-center uppercase"
                                                            disabled={!canManageIspContracts}
                                                        />
                                                    </td>`;
    mapBlock = mapBlock.replace(contractStartDateOld, contractStartDateNew);

    // Period Start Date
    const periodStartOld = `<td className="px-3 py-2.5 text-center border-r border-white/10">
                                                        {isEditingContractRow ? (
                                                            <DateInput
                                                                value={draft.periodStart || ""}
                                                                onChange={(val) => setRowDraft(row.id, { periodStart: val })}
                                                                onKeyDown={(event) => {
                                                                    if (event.key === "Enter") {
                                                                        event.preventDefault();
                                                                        event.currentTarget.blur();
                                                                    }
                                                                }}
                                                                className="rounded-md bg-white/10 border border-white/20 w-28 h-7"
                                                                hideIcon={true}
                                                                inputClass="w-full h-full bg-transparent px-2 text-center text-[11px] text-white outline-none uppercase"
                                                            />
                                                        ) : (
                                                            <button className={editableCellButtonClass} disabled={!canManageIspContracts} onClick={() => openContractRowEditor(row)} type="button">
                                                                {formatDate(row.periodStart)}
                                                            </button>
                                                        )}
                                                    </td>`;
    const periodStartNew = `<td className="border-r border-white/10 text-center p-0">
                                                        <DateInput
                                                            value={isEditingContractRow ? (contractRowEditor.periodStart || "") : (row.periodStart || "")}
                                                            onChange={(val) => setContractRowEditor((prev) => prev ? { ...prev, periodStart: val } : prev)}
                                                            onKeyDown={(event) => {
                                                                if (event.key === "Enter") {
                                                                    event.preventDefault();
                                                                    event.currentTarget.blur();
                                                                }
                                                                if (event.key === "Escape") {
                                                                    setContractRowEditor(null);
                                                                    event.currentTarget.blur();
                                                                }
                                                            }}
                                                            onFocus={() => {
                                                                if (!isEditingContractRow && canManageIspContracts) {
                                                                    openContractRowEditor(row);
                                                                }
                                                            }}
                                                            className="h-9 w-full"
                                                            hideIcon={true}
                                                            inputClass="w-full h-full bg-transparent px-2 text-[10px] font-black text-white border-transparent focus:border-gold-accent/40 focus:bg-white/[0.04] hover:bg-white/[0.02] outline-none transition-all text-center uppercase"
                                                            disabled={!canManageIspContracts}
                                                        />
                                                    </td>`;
    mapBlock = mapBlock.replace(periodStartOld, periodStartNew);

    // Period End Date
    const periodEndOld = `<td className="px-3 py-2.5 text-center border-r border-white/10">
                                                        {isEditingContractRow ? (
                                                            <DateInput
                                                                value={draft.periodEnd || ""}
                                                                onChange={(val) => setRowDraft(row.id, { periodEnd: val })}
                                                                onKeyDown={(event) => {
                                                                    if (event.key === "Enter") {
                                                                        event.preventDefault();
                                                                        event.currentTarget.blur();
                                                                    }
                                                                }}
                                                                className="rounded-md bg-white/10 border border-white/20 w-28 h-7"
                                                                hideIcon={true}
                                                                inputClass="w-full h-full bg-transparent px-2 text-center text-[11px] text-white outline-none uppercase"
                                                            />
                                                        ) : (
                                                            <button className={editableCellButtonClass} disabled={!canManageIspContracts} onClick={() => openContractRowEditor(row)} type="button">
                                                                {formatDate(row.periodEnd)}
                                                            </button>
                                                        )}
                                                    </td>`;
    const periodEndNew = `<td className="border-r border-white/10 text-center p-0">
                                                        <DateInput
                                                            value={isEditingContractRow ? (contractRowEditor.periodEnd || "") : (row.periodEnd || "")}
                                                            onChange={(val) => setContractRowEditor((prev) => prev ? { ...prev, periodEnd: val } : prev)}
                                                            onKeyDown={(event) => {
                                                                if (event.key === "Enter") {
                                                                    event.preventDefault();
                                                                    event.currentTarget.blur();
                                                                }
                                                                if (event.key === "Escape") {
                                                                    setContractRowEditor(null);
                                                                    event.currentTarget.blur();
                                                                }
                                                            }}
                                                            onFocus={() => {
                                                                if (!isEditingContractRow && canManageIspContracts) {
                                                                    openContractRowEditor(row);
                                                                }
                                                            }}
                                                            className="h-9 w-full"
                                                            hideIcon={true}
                                                            inputClass="w-full h-full bg-transparent px-2 text-[10px] font-black text-white border-transparent focus:border-gold-accent/40 focus:bg-white/[0.04] hover:bg-white/[0.02] outline-none transition-all text-center uppercase"
                                                            disabled={!canManageIspContracts}
                                                        />
                                                    </td>`;
    mapBlock = mapBlock.replace(periodEndOld, periodEndNew);

    // BAK File
    const bakFileOld = `<td className="px-3 py-2.5 text-center border-r border-white/10">
                                                        <div className="flex flex-col items-center justify-center gap-2">
                                                            <div className="flex items-center justify-center gap-2 flex-wrap">
                                                                {isOpenableFileUrl(row.bakFileUrl) ? (
                                                                    <button onClick={() => openSafeFile(row.bakFileUrl, row.bakFileName)} className={\`\${fileActionButtonClass} \${fileActionSuccessClass}\`}><span className="material-symbols-outlined" style={{ fontSize: "14px" }}>task_alt</span>Buka BAK</button>
                                                                ) : !canManageIspContracts ? <span className="text-[10px] font-bold text-white/20">Belum diunggah</span> : null}
                                                                {canManageIspContracts && (
                                                                    <FilePickerButton
                                                                        label={isOpenableFileUrl(row.bakFileUrl) ? "Ganti BAK" : "Upload BAK"}
                                                                        className={\`\${fileActionButtonClass} \${fileActionMutedClass}\`}
                                                                        onPickFile={(file) => setContractRowFileDraft(row, 'bak', file)}
                                                                    />
                                                                )}
                                                            </div>
                                                            {isEditingContractRow && draft.bakUploadedFileName && (
                                                                <div className="flex max-w-[190px] items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-left">
                                                                    <span className="material-symbols-outlined text-amber-300" style={{ fontSize: "13px" }}>pending</span>
                                                                    <span className="min-w-0 flex-1 truncate text-[9px] font-bold text-amber-100" title={draft.bakUploadedFileName}>Siap ganti: {draft.bakUploadedFileName}</span>
                                                                    <button type="button" className="text-white/40 hover:text-white" onClick={() => clearContractRowFileDraft(row.id, 'bak')} title="Batalkan ganti file BAK">
                                                                        <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>close</span>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>`;
    const bakFileNew = `<td className="px-3 py-2.5 text-center border-r border-white/10 p-0">
                                                        <div className="flex items-center justify-center gap-1.5 p-2">
                                                            {isEditingContractRow && contractRowEditor.bakUploadedFile ? (
                                                                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 max-w-[150px]">
                                                                    <span className="text-[8px] font-bold text-blue-400 truncate" title={contractRowEditor.bakUploadedFileName}>
                                                                        {contractRowEditor.bakUploadedFileName}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setContractRowEditor(prev => prev ? { ...prev, bakUploadedFile: null, bakUploadedFileName: "" } : null);
                                                                        }}
                                                                        className="text-white/40 hover:text-white flex items-center justify-center"
                                                                        title="Batal berkas baru"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[10px]">close</span>
                                                                    </button>
                                                                </div>
                                                            ) : (isEditingContractRow ? contractRowEditor.bakFileUrl : row.bakFileUrl) ? (
                                                                <div className="flex items-center gap-1.5">
                                                                    <button type="button" onClick={() => openSafeFile(isEditingContractRow ? contractRowEditor.bakFileUrl : row.bakFileUrl, row.bakFileName)} className={\`\${fileActionButtonClass} \${fileActionSuccessClass}\`}>
                                                                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>task_alt</span>Buka BAK
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (!isEditingContractRow) {
                                                                                openContractRowEditor(row, null);
                                                                                setTimeout(() => {
                                                                                    setContractRowEditor(prev => prev ? { ...prev, bakFileUrl: "" } : null);
                                                                                }, 50);
                                                                            } else {
                                                                                setContractRowEditor(prev => prev ? { ...prev, bakFileUrl: "" } : null);
                                                                            }
                                                                        }}
                                                                        className="h-6 w-6 rounded border border-[#ff2400]/20 bg-[#ff2400]/10 flex items-center justify-center text-[#ff2400] hover:bg-[#ff2400] hover:text-white transition-all"
                                                                        title="Hapus berkas"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[10px]">close</span>
                                                                    </button>
                                                                </div>
                                                            ) : !canManageIspContracts ? (
                                                                <span className="text-[10px] font-bold text-white/20">Belum diunggah</span>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openContractRowEditor(row, "bakFile")}
                                                                    className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 text-[8px] font-black uppercase tracking-widest text-white/40 hover:border-white/20 hover:text-white transition-all"
                                                                >
                                                                    <span className="material-symbols-outlined text-[12px]">upload_file</span>
                                                                    Upload
                                                                </button>
                                                            )}
                                                            {isEditingContractRow && (
                                                                <label
                                                                    className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-white/10 bg-white/5 text-white/40 hover:text-white hover:border-white/20 transition-all"
                                                                    onClick={() => { isSelectingFileRef.current = true; }}
                                                                    title="Ganti berkas"
                                                                >
                                                                    <span className="material-symbols-outlined text-[12px]">upload_file</span>
                                                                    <input
                                                                        type="file"
                                                                        className="hidden"
                                                                        disabled={isSavingContractRow}
                                                                        onChange={async (event) => {
                                                                            isSelectingFileRef.current = false;
                                                                            const file = event.target.files?.[0] ?? null;
                                                                            if (file) {
                                                                                setContractRowEditor((previous) => (
                                                                                    previous ? { ...previous, bakUploadedFile: file, bakUploadedFileName: file.name } : previous
                                                                                ));
                                                                                await handleSaveContractRow(null, { bakUploadedFile: file });
                                                                            }
                                                                        }}
                                                                        ref={(el) => {
                                                                            if (el && contractRowEditor?.focusField === "bakFile") {
                                                                                isSelectingFileRef.current = true;
                                                                                el.click();
                                                                                setContractRowEditor((prev) => prev ? { ...prev, focusField: null } : null);
                                                                            }
                                                                        }}
                                                                    />
                                                                </label>
                                                            )}
                                                        </div>
                                                    </td>`;
    mapBlock = mapBlock.replace(bakFileOld, bakFileNew);

    content = content.substring(0, mapStartIdx) + mapBlock + content.substring(mapEndIdx);
}

fs.writeFileSync('frontend/src/features/pelanggan/IspDetailPage.jsx', content);
console.log("Refactor successful");
