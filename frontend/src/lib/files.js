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

export const uploadFileForRecord = async (file, pathParts = []) => {
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
