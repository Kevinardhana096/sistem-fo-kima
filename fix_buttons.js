const fs = require('fs');

function fixFile(filePath, isTenant) {
    let content = fs.readFileSync(filePath, 'utf8');

    const canManageVar = isTenant ? 'canManageTenantContracts' : 'canManageIspContracts';

    // Replace contractFile
    content = content.replace(
        /\{isEditingContractRow && \(\s*<label\s*className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-white\/10 bg-white\/5 text-white\/40 hover:text-white hover:border-white\/20 transition-all"\s*onClick=\{\(\) => \{ isSelectingFileRef\.current = true; \}\}\s*title="Ganti berkas"\s*>\s*<span className="material-symbols-outlined text-\[12px\]">upload_file<\/span>\s*<input([\s\S]*?)focusField === "contractFile"([\s\S]*?)<\/label>\s*\)\}/m,
        `{isEditingContractRow ? (
                                                                <label
                                                                    className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-white/10 bg-white/5 text-white/40 hover:text-white hover:border-white/20 transition-all"
                                                                    onClick={() => { isSelectingFileRef.current = true; }}
                                                                    title="Ganti berkas"
                                                                >
                                                                    <span className="material-symbols-outlined text-[12px]">upload_file</span>
                                                                    <input$1focusField === "contractFile"$2</label>
                                                            ) : ${canManageVar} && row.contractFileUrl && (
                                                                <button
                                                                    type="button"
                                                                    className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-white/10 bg-white/5 text-white/40 hover:text-white hover:border-white/20 transition-all"
                                                                    onClick={() => openContractRowEditor(row, "contractFile")}
                                                                    title="Ganti berkas"
                                                                >
                                                                    <span className="material-symbols-outlined text-[12px]">upload_file</span>
                                                                </button>
                                                            )}`
    );

    // Replace bakFile (only for ISP, Tenant doesn't have bakFile)
    if (!isTenant) {
        content = content.replace(
            /\{isEditingContractRow && \(\s*<label\s*className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-white\/10 bg-white\/5 text-white\/40 hover:text-white hover:border-white\/20 transition-all"\s*onClick=\{\(\) => \{ isSelectingFileRef\.current = true; \}\}\s*title="Ganti berkas"\s*>\s*<span className="material-symbols-outlined text-\[12px\]">upload_file<\/span>\s*<input([\s\S]*?)focusField === "bakFile"([\s\S]*?)<\/label>\s*\)\}/m,
            `{isEditingContractRow ? (
                                                                <label
                                                                    className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-white/10 bg-white/5 text-white/40 hover:text-white hover:border-white/20 transition-all"
                                                                    onClick={() => { isSelectingFileRef.current = true; }}
                                                                    title="Ganti berkas"
                                                                >
                                                                    <span className="material-symbols-outlined text-[12px]">upload_file</span>
                                                                    <input$1focusField === "bakFile"$2</label>
                                                            ) : ${canManageVar} && row.bakFileUrl && (
                                                                <button
                                                                    type="button"
                                                                    className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-white/10 bg-white/5 text-white/40 hover:text-white hover:border-white/20 transition-all"
                                                                    onClick={() => openContractRowEditor(row, "bakFile")}
                                                                    title="Ganti berkas"
                                                                >
                                                                    <span className="material-symbols-outlined text-[12px]">upload_file</span>
                                                                </button>
                                                            )}`
        );
    }

    fs.writeFileSync(filePath, content);
}

fixFile('frontend/src/features/pelanggan/IspDetailPage.jsx', false);
fixFile('frontend/src/features/pelanggan/TenantDetailPage.jsx', true);
console.log("Fix successful");
