const fs = require('fs');
let content = fs.readFileSync('frontend/src/features/pelanggan/TenantDetailPage.jsx', 'utf8');

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
                                ) : canManageTenantContracts && row.bakFileUrl && (
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
fs.writeFileSync('frontend/src/features/pelanggan/TenantDetailPage.jsx', content);
