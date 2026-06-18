filepath = "/home/farafahirun/Github Repository/sistem-fo-kima/frontend/src/features/pelanggan/IspDetailPage.jsx"
with open(filepath, "r") as f:
    content = f.read()

# We look for the start of the mobile view mapping:
# "{filteredDocs.map((row, idx) => ("
# and the end of that mapping, which is ")}      " (or whatever the closing is up to the filteredDocs.length === 0 check).
# Let's find "{filteredDocs.map((row, idx) => ("
start_str = "{filteredDocs.map((row, idx) => ("
if start_str in content:
    idx_start = content.find(start_str)
    # Let's find the closing for this mapping.
    # The next check is "filteredDocs.length === 0"
    idx_next_check = content.find("filteredDocs.length === 0", idx_start)
    if idx_next_check != -1:
        # We search backwards from idx_next_check to find the closing brackets of map
        # which would end before the next section.
        # Let's find the last "}" or ")" before idx_next_check
        # Actually, let's just replace everything from idx_start to the line before filteredDocs.length === 0
        # Let's find the last newline before "filteredDocs.length === 0"
        idx_newline = content.rfind("\n", 0, idx_next_check)
        # Let's find the last newline before that to find where to cut
        # Or we can search for "})}         " or similar.
        # Let's print the segment to be sure:
        print("Segment to replace:\n", content[idx_start:idx_newline])
        
        replacement = """{filteredDocs.map((row, idx) => (
                                            <div
                                                key={row.id}
                                                className="glass-card rounded-xl border border-white/10 px-2.5 pt-2.5 pb-1 flex flex-col gap-2 shadow-glass-depth transition-all"
                                            >
                                                {/* Row 1: Header (No, Date) */}
                                                <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
                                                     <div className="flex items-center gap-1.5">
                                                         <span className="text-[10px] font-black text-gold-accent/60 tabular-nums">#{String(idx + 1).padStart(2, '0')}</span>
                                                         <span className="text-[10px] font-bold text-white/50 flex items-center gap-1">
                                                             <span className="material-symbols-outlined text-[12px]" style={{ fontSize: '12px' }}>calendar_today</span>
                                                             {formatDate(row.tanggal)}
                                                         </span>
                                                     </div>
                                                </div>

                                                {/* Row 2: Doc Name */}
                                                <div className="flex items-start gap-2 bg-white/[0.02] border border-white/[0.05] rounded-xl px-2.5 py-2">
                                                     <span className="material-symbols-outlined text-white/30 shrink-0 mt-0.5" style={{ fontSize: "14px" }}>description</span>
                                                     <div className="flex-1 min-w-0">
                                                         <p className="text-[8px] font-black uppercase tracking-widest text-white/30 mb-0.5">Nama Dokumen</p>
                                                         <p className="text-[10px] font-bold text-white/80 truncate" title={row.fileName}>
                                                             {row.fileName || "N/A"}
                                                         </p>
                                                     </div>
                                                </div>

                                                {/* Row 3: Action Buttons */}
                                                <div className="flex items-center justify-between pt-1 md:pt-1.5 border-t border-white/[0.06]">
                                                     <div>
                                                         {isOpenableFileUrl(row.fileUrl) ? (
                                                             <button
                                                                 onClick={() => openSafeFile(row.fileUrl, row.fileName)}
                                                                 className="inline-flex items-center gap-1 text-emerald-400 hover:text-white font-bold text-[8.5px] leading-none uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md transition-all"
                                                             >
                                                                 <span className="material-symbols-outlined text-[11px]" style={{ fontSize: "11px" }}>description</span>
                                                                 Buka Berkas
                                                             </button>
                                                         ) : (
                                                             <span className="text-[8.5px] font-black uppercase tracking-widest text-white/20">Kosong</span>
                                                         )}
                                                     </div>

                                                     {!isIsp && (
                                                         <div className="flex items-center gap-1.5">
                                                             <button
                                                                 className="w-6 h-6 flex items-center justify-center rounded-md bg-white/5 border border-white/10 text-gold-accent hover:bg-gold-accent hover:text-white transition-all shadow-sm"
                                                                 onClick={() => handleEditRisalah(row)}
                                                                 title="Edit Dokumen"
                                                             >
                                                                 <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>edit_note</span>
                                                             </button>
                                                             <button
                                                                 className="w-6 h-6 flex items-center justify-center rounded-md bg-white/5 border border-white/10 text-[#ff2400] hover:bg-[#ff2400] hover:text-white transition-all shadow-sm"
                                                                 onClick={() => handleDeleteRisalah(row.id)}
                                                                 title="Hapus Dokumen"
                                                             >
                                                                 <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>delete_forever</span>
                                                             </button>
                                                         </div>
                                                     )}
                                                </div>
                                            </div>
                                        ))}"""
        content = content[:idx_start] + replacement + content[idx_newline:]
        with open(filepath, "w") as f:
            f.write(content)
        print("Done!")
    else:
        print("Not found next check")
else:
    print("Not found start_str")
