import { readFileAsDataUrl } from "../app/utils";
import { supabase } from "./supabase";

const STORAGE_BUCKET = typeof import.meta.env.VITE_SUPABASE_STORAGE_BUCKET === "string"
  ? import.meta.env.VITE_SUPABASE_STORAGE_BUCKET.trim()
  : "";

const sanitizePathPart = (value) => String(value ?? "")
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9._-]+/g, "-")
  .replace(/^-+|-+$/g, "")
  || "file";

const getFileExtension = (file) => {
  const fileName = typeof file?.name === "string" ? file.name : "";
  const extension = fileName.includes(".") ? fileName.split(".").pop() : "";
  return extension ? `.${sanitizePathPart(extension)}` : "";
};

export const uploadFileForRecord = async (file, pathParts = [], onProgress = null) => {
  if (!(file instanceof File)) {
    throw new Error("File tidak valid.");
  }

  if (!STORAGE_BUCKET) {
    return readFileAsDataUrl(file);
  }

  const safePath = [
    ...pathParts.map(sanitizePathPart),
    `${Date.now()}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}${getFileExtension(file)}`,
  ].join("/");

  // Use XMLHttpRequest if onProgress callback is provided
  if (typeof onProgress === "function") {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    if (!token || !supabaseUrl) {
      console.warn("Sesi atau URL Supabase tidak tersedia, menggunakan fallback standard upload.");
    } else {
      try {
        return await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const uploadUrl = `${supabaseUrl}/storage/v1/object/${STORAGE_BUCKET}/${safePath}`;

          xhr.open("POST", uploadUrl, true);
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
          xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_ANON_KEY);
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
          xhr.setRequestHeader("cache-control", "max-age=31536000");

          if (xhr.upload) {
            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                onProgress(percentComplete);
              }
            };
          }

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(safePath);
              resolve(data.publicUrl);
            } else {
              let errMsg = "Gagal mengunggah berkas ke storage.";
              try {
                const res = JSON.parse(xhr.responseText);
                if (res.message) errMsg = res.message;
              } catch (e) {
                // ignore
              }
              reject(new Error(errMsg));
            }
          };

          xhr.onerror = () => {
            reject(new Error("Kesalahan jaringan saat mengunggah berkas."));
          };

          xhr.send(file);
        });
      } catch (err) {
        console.warn("XHR upload error, falling back:", err);
        throw err;
      }
    }
  }

  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(safePath, file, {
        cacheControl: "31536000",
        upsert: false,
        contentType: file.type || undefined,
      });

    if (error) {
      console.warn("Supabase Storage upload failed, falling back to Data URL:", error);
      return readFileAsDataUrl(file);
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(safePath);
    return data.publicUrl;
  } catch (err) {
    console.warn("Supabase Storage upload threw exception, falling back to Data URL:", err);
    return readFileAsDataUrl(file);
  }
};
