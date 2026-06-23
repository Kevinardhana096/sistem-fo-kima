/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback } from "react";
import { uploadFileForRecord } from "../lib/files";

const UploadProgressContext = createContext(null);

export const useUpload = () => {
  const context = useContext(UploadProgressContext);
  if (!context) {
    throw new Error("useUpload must be used within an UploadProgressProvider");
  }
  return context;
};

export const UploadProgressProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("idle"); // 'idle' | 'uploading' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState("");

  const uploadWithProgress = useCallback(async (file, pathParts = []) => {
    if (!(file instanceof File)) {
      throw new Error("File tidak valid.");
    }

    setFileName(file.name);
    setProgress(0);
    setStatus("uploading");
    setErrorMessage("");
    setIsOpen(true);

    try {
      const fileUrl = await uploadFileForRecord(file, pathParts, (percent) => {
        setProgress(percent);
      });

      // Complete progress smoothly
      setProgress(100);
      setStatus("success");

      // Auto close after 1 second of success
      setTimeout(() => {
        setIsOpen(false);
        setStatus("idle");
      }, 1000);

      return fileUrl;
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Terjadi kesalahan saat mengunggah berkas.");
      throw error; // Re-throw to allow component to handle locally if needed
    }
  }, []);

  const closeModal = useCallback(() => {
    if (status !== "uploading") {
      setIsOpen(false);
      setStatus("idle");
    }
  }, [status]);

  return (
    <UploadProgressContext.Provider value={{ uploadWithProgress }}>
      {children}

      {isOpen && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md flex items-center justify-center z-[9999] transition-all duration-300">
          <style>{`
            @keyframes scaleIn {
              0% { transform: scale(0.3); opacity: 0; }
              50% { transform: scale(1.1); }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              25% { transform: translateX(-4px); }
              75% { transform: translateX(4px); }
            }
            .animate-scale-in {
              animation: scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            }
            .animate-shake {
              animation: shake 0.3s ease-in-out;
            }
          `}</style>

          <div className="relative glass-premium w-full max-w-md mx-4 p-8 rounded-2xl border border-white/15 shadow-2xl flex flex-col items-center text-center gap-6 overflow-hidden">
            {/* Decorative glowing background mesh */}
            <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/5 to-cyan-500/5 pointer-events-none" />
            
            {/* Icon status with pulse/bounce/spin animations */}
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-white/5 border border-white/10 shadow-inner relative">
              {status === "uploading" && (
                <>
                  <div className="absolute inset-0 rounded-full border border-amber-500/30 animate-ping" />
                  <span className="material-symbols-outlined text-3xl text-amber-500 animate-pulse">
                    cloud_upload
                  </span>
                </>
              )}
              {status === "success" && (
                <span className="material-symbols-outlined text-3xl text-emerald-500 animate-scale-in">
                  check_circle
                </span>
              )}
              {status === "error" && (
                <span className="material-symbols-outlined text-3xl text-rose-500 animate-shake">
                  error
                </span>
              )}
            </div>

            {/* Title & Description */}
            <div className="flex flex-col gap-1.5 w-full">
              <h3 className="text-xl font-bold tracking-tight text-white">
                {status === "uploading" && "Mengunggah Berkas"}
                {status === "success" && "Unggahan Berhasil!"}
                {status === "error" && "Gagal Mengunggah"}
              </h3>
              <p className="text-xs font-mono text-slate-400 truncate max-w-full px-4 py-1.5 bg-black/30 rounded-lg border border-white/5 self-center">
                {fileName}
              </p>
            </div>

            {/* Progress visualization */}
            {status !== "error" && (
              <div className="w-full flex flex-col gap-2 mt-2">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-300">
                  <span>Progres</span>
                  <span className="text-amber-500 font-mono">{Math.round(progress)}%</span>
                </div>
                <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden border border-white/5 p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-cyan-400 rounded-full transition-all duration-350 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error Message if failed */}
            {status === "error" && (
              <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 px-4 py-3 rounded-xl w-full">
                {errorMessage || "Terjadi kesalahan saat mengunggah."}
              </p>
            )}

            {/* Status Description / Buttons */}
            <div className="w-full flex justify-center mt-2 z-10">
              {status === "uploading" && (
                <span className="text-xs text-slate-400 animate-pulse">
                  Harap tidak menutup atau memuat ulang halaman ini
                </span>
              )}
              {status === "success" && (
                <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">done</span> Menyelesaikan proses...
                </span>
              )}
              {status === "error" && (
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-full py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-white/10 border border-white/15 hover:bg-white/20 transition-all duration-200 shadow-sm"
                >
                  Tutup
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </UploadProgressContext.Provider>
  );
};
