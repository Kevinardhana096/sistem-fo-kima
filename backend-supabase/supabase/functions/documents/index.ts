// Supabase Edge Function: Documents API
// Handles document upload and management with Supabase Storage

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    // Extract customerId and documentId from path
    const customerIdIndex = pathParts.indexOf("customers") + 1;
    const customerId = parseInt(pathParts[customerIdIndex]);
    const documentIdIndex = pathParts.indexOf("documents") + 1;
    const documentId = pathParts[documentIdIndex] ? parseInt(pathParts[documentIdIndex]) : null;

    if (isNaN(customerId)) {
      return new Response(JSON.stringify({ error: "Invalid customer ID" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Route: GET /customers/:customerId/documents - List documents
    if (req.method === "GET" && !documentId) {
      const jenisDokumen = url.searchParams.get("jenisDokumen");

      let query = supabaseClient
        .from("documents")
        .select("*")
        .eq("customer_id", customerId)
        .order("tanggal_dokumen", { ascending: false });

      if (jenisDokumen) {
        query = query.eq("jenis_dokumen", jenisDokumen);
      }

      const { data: documents, error } = await query;

      if (error) throw error;

      return new Response(JSON.stringify(documents), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Route: GET /customers/:customerId/documents/:documentId - Get document by ID
    if (req.method === "GET" && documentId) {
      const { data: document, error } = await supabaseClient
        .from("documents")
        .select("*")
        .eq("id", documentId)
        .eq("customer_id", customerId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return new Response(JSON.stringify({ error: "Document not found" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 404,
          });
        }
        throw error;
      }

      return new Response(JSON.stringify(document), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Route: POST /customers/:customerId/documents - Upload document
    if (req.method === "POST") {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const jenisDokumen = formData.get("jenisDokumen") as string;
      const nomorDokumen = formData.get("nomorDokumen") as string;
      const tanggalDokumen = formData.get("tanggalDokumen") as string;
      const contractId = formData.get("contractId") as string;

      if (!file) {
        return new Response(JSON.stringify({ error: "File is required" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      if (!jenisDokumen || !tanggalDokumen) {
        return new Response(JSON.stringify({ error: "jenisDokumen and tanggalDokumen are required" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      // Upload file to Supabase Storage
      const fileName = `${customerId}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from("documents")
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabaseClient.storage
        .from("documents")
        .getPublicUrl(fileName);

      // Create document record
      const { data: document, error: insertError } = await supabaseClient
        .from("documents")
        .insert({
          customer_id: customerId,
          contract_id: contractId ? parseInt(contractId) : null,
          jenis_dokumen: jenisDokumen,
          nomor_dokumen: nomorDokumen || null,
          tanggal_dokumen: tanggalDokumen,
          file_url: urlData.publicUrl,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Trigger automation based on document type
      // This will be handled by database triggers in production
      // For now, we'll do it here
      if (jenisDokumen === "pemutusan") {
        await supabaseClient
          .from("customers")
          .update({ status: "nonaktif" })
          .eq("id", customerId);
      }

      return new Response(JSON.stringify(document), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 201,
      });
    }

    // Route: DELETE /customers/:customerId/documents/:documentId - Delete document
    if (req.method === "DELETE" && documentId) {
      // Get document to get file URL
      const { data: document, error: fetchError } = await supabaseClient
        .from("documents")
        .select("file_url")
        .eq("id", documentId)
        .eq("customer_id", customerId)
        .single();

      if (fetchError) {
        if (fetchError.code === "PGRST116") {
          return new Response(JSON.stringify({ error: "Document not found" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 404,
          });
        }
        throw fetchError;
      }

      // Delete from storage if it's a Supabase Storage URL
      if (document.file_url.includes("supabase.co/storage")) {
        const urlParts = document.file_url.split("/documents/");
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          await supabaseClient.storage.from("documents").remove([filePath]);
        }
      }

      // Delete document record
      const { error: deleteError } = await supabaseClient
        .from("documents")
        .delete()
        .eq("id", documentId)
        .eq("customer_id", customerId);

      if (deleteError) throw deleteError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Route not found
    return new Response(JSON.stringify({ error: "Route not found" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 404,
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
        details: error.toString()
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
