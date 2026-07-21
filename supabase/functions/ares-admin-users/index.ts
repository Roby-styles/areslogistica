import { createClient } from "npm:@supabase/supabase-js@2.110.7";

type JsonRecord = Record<string, unknown>;

type InviteRequest = {
  action: "invite_user";
  email: string;
  username: string;
  fullName?: string;
  role: "admin" | "operatore" | "user" | "cliente";
  client?: {
    mode?: "none" | "existing" | "new";
    clientId?: string;
    siteId?: string;
    code?: string;
    name?: string;
    siteName?: string;
  };
};

type SetActiveRequest = {
  action: "set_active";
  userId: string;
  active: boolean;
};

type AdminRequest = InviteRequest | SetActiveRequest;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";
const ARES_SITE_URL = Deno.env.get("ARES_SITE_URL") ??
  "https://roby-styles.github.io/areslogistica/";

const allowedOrigins = new Set([
  "https://roby-styles.github.io",
  "http://localhost:8000",
]);

const allowedInviteRoles = new Set(["admin", "operatore", "user", "cliente"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin)
      ? origin
      : "https://roby-styles.github.io",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(status: number, body: JsonRecord, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanEmail(value: unknown) {
  return cleanText(value, 254).toLowerCase();
}

function fail(status: number, message: string, origin: string | null) {
  return jsonResponse(status, { ok: false, error: message }, origin);
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");

  if (origin && !allowedOrigins.has(origin)) {
    return fail(403, "Origine non autorizzata.", origin);
  }
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return fail(405, "Metodo non consentito.", origin);
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Configurazione Supabase incompleta nella Edge Function.");
    return fail(500, "Servizio amministrativo non configurato.", origin);
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return fail(401, "Sessione mancante.", origin);
  }

  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = authorization.slice("Bearer ".length);
  const { data: authData, error: authError } = await callerClient.auth.getUser(
    token,
  );
  const caller = authData.user;
  if (authError || !caller) {
    return fail(401, "Sessione non valida o scaduta.", origin);
  }

  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from("ares_profiles")
    .select("role,active")
    .eq("id", caller.id)
    .maybeSingle();
  if (
    callerProfileError || callerProfile?.active !== true ||
    callerProfile?.role !== "super_admin"
  ) {
    return fail(403, "Operazione riservata al Super Amministratore.", origin);
  }

  let body: AdminRequest;
  try {
    const rawBody: unknown = await request.json();
    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      return fail(400, "Richiesta non valida.", origin);
    }
    body = rawBody as AdminRequest;
  } catch {
    return fail(400, "Richiesta non valida.", origin);
  }

  if (body.action === "invite_user") {
    const email = cleanEmail(body.email);
    const username = cleanText(body.username, 80);
    const fullName = cleanText(body.fullName, 120);
    const role = cleanText(body.role, 30);
    if (!emailPattern.test(email)) {
      return fail(400, "Indirizzo email non valido.", origin);
    }
    if (username.length < 2) {
      return fail(400, "Inserisci un nome utente valido.", origin);
    }
    if (!allowedInviteRoles.has(role)) {
      return fail(400, "Ruolo non consentito.", origin);
    }

    let clientId: string | null = null;
    let siteId: string | null = null;
    const clientInput = body.client ?? {};

    if (role === "cliente") {
      if (clientInput.mode === "existing") {
        if (!uuidPattern.test(clientInput.clientId ?? "")) {
          return fail(400, "Seleziona il cliente.", origin);
        }
        clientId = clientInput.clientId ?? null;
        const { data: existingClient, error: existingClientError } =
          await adminClient
            .from("ares_clients")
            .select("id")
            .eq("id", clientId)
            .eq("active", true)
            .maybeSingle();
        if (existingClientError || !existingClient) {
          return fail(400, "Cliente non disponibile.", origin);
        }

        if (clientInput.siteId) {
          if (!uuidPattern.test(clientInput.siteId)) {
            return fail(400, "Cantiere non valido.", origin);
          }
          const { data: existingSite, error: existingSiteError } =
            await adminClient
              .from("ares_sites")
              .select("id")
              .eq("id", clientInput.siteId)
              .eq("client_id", clientId)
              .eq("active", true)
              .maybeSingle();
          if (existingSiteError || !existingSite) {
            return fail(400, "Cantiere non disponibile.", origin);
          }
          siteId = existingSite.id;
        }
      } else if (clientInput.mode === "new") {
        const code = cleanText(clientInput.code, 40).toUpperCase().replace(
          /[^A-Z0-9_-]/g,
          "-",
        );
        const name = cleanText(clientInput.name, 160);
        const siteName = cleanText(clientInput.siteName, 160);
        if (code.length < 2 || name.length < 2 || siteName.length < 2) {
          return fail(400, "Completa codice, cliente e cantiere.", origin);
        }

        const { data: createdClient, error: clientError } = await adminClient
          .from("ares_clients")
          .insert({ code, name, active: true })
          .select("id")
          .single();
        if (clientError || !createdClient) {
          console.error("Creazione cliente fallita:", clientError);
          const duplicateCode = clientError?.code === "23505";
          return fail(
            duplicateCode ? 409 : 500,
            duplicateCode
              ? "Questo codice cliente esiste gia: seleziona il cliente esistente."
              : "Impossibile preparare il cliente.",
            origin,
          );
        }
        clientId = createdClient.id;

        const { data: createdSite, error: siteError } = await adminClient
          .from("ares_sites")
          .insert({ client_id: clientId, name: siteName, active: true })
          .select("id")
          .single();
        if (siteError || !createdSite) {
          console.error("Creazione cantiere fallita:", siteError);
          return fail(500, "Impossibile preparare il cantiere.", origin);
        }
        siteId = createdSite.id;
      } else {
        return fail(
          400,
          "Scegli un cliente esistente oppure creane uno nuovo.",
          origin,
        );
      }
    }

    const { data: invited, error: inviteError } = await adminClient.auth.admin
      .inviteUserByEmail(email, {
        data: { username, full_name: fullName || username },
        redirectTo: ARES_SITE_URL,
      });
    if (inviteError || !invited.user) {
      console.warn("Invito utente non riuscito:", inviteError?.message);
      const duplicate = /already|registered|exists/i.test(
        inviteError?.message ?? "",
      );
      return fail(
        duplicate ? 409 : 400,
        duplicate
          ? "Esiste gia un account con questa email."
          : "Invito non riuscito.",
        origin,
      );
    }

    const targetUserId = invited.user.id;
    const { error: profileError } = await adminClient
      .from("ares_profiles")
      .upsert({
        id: targetUserId,
        email,
        username,
        full_name: fullName || null,
        role,
        client_id: clientId,
        default_site_id: siteId,
        active: true,
      }, { onConflict: "id" });

    if (profileError) {
      console.error("Configurazione profilo invitato fallita:", profileError);
      await adminClient.auth.admin.deleteUser(targetUserId);
      return fail(
        500,
        "Profilo non creato; l’invito e stato annullato.",
        origin,
      );
    }

    if (role === "cliente" && clientId) {
      const { error: membershipError } = await adminClient
        .from("ares_memberships")
        .insert({
          user_id: targetUserId,
          client_id: clientId,
          site_id: siteId,
          membership_role: "viewer",
        });
      if (membershipError) {
        console.error("Membership cliente non creata:", membershipError);
      }
    }

    await adminClient.from("ares_admin_audit").insert({
      actor_user_id: caller.id,
      target_user_id: targetUserId,
      target_email: email,
      action: "invite_user",
      details: { role, client_id: clientId, site_id: siteId },
    });

    return jsonResponse(200, {
      ok: true,
      message: "Invito inviato. L’utente scegliera la propria password.",
      user: {
        id: targetUserId,
        email,
        username,
        full_name: fullName,
        role,
        client_id: clientId,
        default_site_id: siteId,
        active: true,
      },
    }, origin);
  }

  if (body.action === "set_active") {
    if (!uuidPattern.test(body.userId ?? "")) {
      return fail(400, "Utente non valido.", origin);
    }
    if (body.userId === caller.id) {
      return fail(400, "Non puoi disattivare il tuo account.", origin);
    }

    const { data: targetProfile, error: targetError } = await adminClient
      .from("ares_profiles")
      .select("id,email,role,active")
      .eq("id", body.userId)
      .maybeSingle();
    if (targetError || !targetProfile) {
      return fail(404, "Profilo non trovato.", origin);
    }
    if (targetProfile.role === "super_admin") {
      return fail(
        400,
        "Gli account Super Amministratore non si modificano da questa schermata.",
        origin,
      );
    }

    const active = body.active === true;
    const { error: updateError } = await adminClient
      .from("ares_profiles")
      .update({ active })
      .eq("id", body.userId);
    if (updateError) {
      console.error("Aggiornamento stato utente fallito:", updateError);
      return fail(500, "Stato utente non aggiornato.", origin);
    }

    await adminClient.from("ares_admin_audit").insert({
      actor_user_id: caller.id,
      target_user_id: body.userId,
      target_email: targetProfile.email,
      action: active ? "activate_user" : "deactivate_user",
      details: { previous_active: targetProfile.active },
    });

    return jsonResponse(200, {
      ok: true,
      message: active ? "Account riattivato." : "Account disattivato.",
    }, origin);
  }

  return fail(400, "Azione non riconosciuta.", origin);
});
