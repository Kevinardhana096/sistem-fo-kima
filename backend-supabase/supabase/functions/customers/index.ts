// Supabase Edge Function: Customers API
// Handles customer CRUD operations

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

    // Remove 'customers' from path if present
    const customerId = pathParts[pathParts.length - 1];

    // Route: GET /customers - List all customers
    if (req.method === "GET" && !customerId) {
      const { data: customers, error } = await supabaseClient
        .from("customers")
        .select(`
          id,
          customer_code,
          isp_name,
          name,
          status,
          activation_fee_amount,
          activation_fee_paid_at,
          created_at,
          updated_at,
          contract_start_date,
          contracts:contracts(count),
          documents:documents(count),
          invoices:invoices(count),
          ispMemberships:customer_isp_memberships(
            isp:isps(name)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Transform data to match NestJS response format
      const transformed = customers?.map((customer: any) => ({
        ...customer,
        contractCount: customer.contracts?.[0]?.count || 0,
        documentCount: customer.documents?.[0]?.count || 0,
        invoiceCount: customer.invoices?.[0]?.count || 0,
        isps: customer.ispMemberships?.map((m: any) => m.isp) || [],
      }));

      return new Response(JSON.stringify(transformed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Route: GET /customers/:id - Get customer by ID
    if (req.method === "GET" && customerId) {
      const id = parseInt(customerId);
      if (isNaN(id)) {
        return new Response(JSON.stringify({ error: "Invalid customer ID" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      const { data: customer, error } = await supabaseClient
        .from("customers")
        .select(`
          *,
          contracts:contracts(*),
          documents:documents(*),
          invoices:invoices(*),
          ispMemberships:customer_isp_memberships(
            isp:isps(*)
          ),
          routeVersions:customer_route_versions(
            *,
            points:customer_route_points(*)
          )
        `)
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return new Response(JSON.stringify({ error: "Customer not found" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 404,
          });
        }
        throw error;
      }

      // Transform data
      const transformed = {
        ...customer,
        isps: customer.ispMemberships?.map((m: any) => m.isp) || [],
      };

      return new Response(JSON.stringify(transformed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Route: POST /customers - Create new customer
    if (req.method === "POST") {
      const body = await req.json();

      const { data: customer, error } = await supabaseClient
        .from("customers")
        .insert({
          customer_code: body.customerCode,
          isp_name: body.ispName,
          name: body.name,
          status: body.status || "aktif",
          activation_fee_amount: body.activationFeeAmount || 0,
          activation_fee_paid_at: body.activationFeePaidAt || null,
          contract_start_date: body.contractStartDate || null,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(customer), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 201,
      });
    }

    // Route: PATCH /customers/:id - Update customer
    if (req.method === "PATCH" && customerId) {
      const id = parseInt(customerId);
      if (isNaN(id)) {
        return new Response(JSON.stringify({ error: "Invalid customer ID" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      const body = await req.json();

      const updateData: any = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.status !== undefined) updateData.status = body.status;
      if (body.ispName !== undefined) updateData.isp_name = body.ispName;
      if (body.activationFeeAmount !== undefined) updateData.activation_fee_amount = body.activationFeeAmount;
      if (body.activationFeePaidAt !== undefined) updateData.activation_fee_paid_at = body.activationFeePaidAt;
      if (body.contractStartDate !== undefined) updateData.contract_start_date = body.contractStartDate;

      const { data: customer, error } = await supabaseClient
        .from("customers")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(customer), {
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
