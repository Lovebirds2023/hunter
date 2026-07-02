import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

type JsonRecord = Record<string, unknown>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const supabaseUrl =
  Deno.env.get("SUPABASE_URL") ??
  Deno.env.get("LD_SUPABASE_URL") ??
  "";
const anonKey =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("LD_SUPABASE_ANON_KEY") ??
  Deno.env.get("LD_SUPABASE_PUBLISHABLE_KEY") ??
  "";
const serviceRoleKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  Deno.env.get("LD_SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("LD_SUPABASE_SECRET_KEY") ??
  "";

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  console.error("Missing Supabase Edge Function environment variables.");
}

const supabase = createClient(supabaseUrl, anonKey);
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const errorResponse = (detail: string, status = 400) => jsonResponse({ detail }, status);

const getPath = (request: Request) => {
  const url = new URL(request.url);
  return url.pathname
    .replace(/^\/functions\/v1\/api/, "")
    .replace(/^\/api/, "") || "/";
};

const readJson = async (request: Request): Promise<JsonRecord> => {
  const text = await request.text();
  if (!text.trim()) return {};
  return JSON.parse(text);
};

const readForm = async (request: Request) => {
  const body = await request.text();
  return new URLSearchParams(body);
};

const cleanString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const nowIso = () => new Date().toISOString();
const getPublicAppUrl = () => (
  cleanString(Deno.env.get("PUBLIC_APP_URL")) ||
  cleanString(Deno.env.get("LD_PUBLIC_APP_URL")) ||
  "https://lovedogs360.co.ke"
).replace(/\/+$/, "");
const getPasswordResetRedirectUrl = () => (
  cleanString(Deno.env.get("PASSWORD_RESET_REDIRECT_URL")) ||
  `${getPublicAppUrl()}/reset-password`
);
const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const asArray = (value: unknown) => (Array.isArray(value) ? value : []);
const asStringArray = (value: unknown) => asArray(value).map((item) => String(item));
const asNumber = (value: unknown, fallback = 0) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const asNullableNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
};
const asBoolean = (value: unknown, fallback = false) => (
  typeof value === "boolean" ? value : fallback
);
const firstPathMatch = (path: string, pattern: RegExp) => path.match(pattern)?.[1] ?? "";
const getUrl = (request: Request) => new URL(request.url);

const serializeUser = (profile: JsonRecord | null, authUser?: JsonRecord | null) => ({
  id: cleanString(profile?.id) || cleanString(authUser?.id),
  email: cleanString(profile?.email) || cleanString(authUser?.email),
  full_name:
    cleanString(profile?.full_name) ||
    cleanString((authUser?.user_metadata as JsonRecord | undefined)?.full_name) ||
    cleanString((authUser?.user_metadata as JsonRecord | undefined)?.name),
  role: cleanString(profile?.role) || "buyer",
  auth_provider: cleanString(profile?.auth_provider) || "email",
  google_id: profile?.google_id ?? null,
  phone_number: profile?.phone_number ?? null,
  country: profile?.country ?? null,
  language: cleanString(profile?.language) || "en",
  profile_image: profile?.profile_image ?? null,
  bio: profile?.bio ?? null,
  latitude: profile?.latitude ?? null,
  longitude: profile?.longitude ?? null,
  location_accuracy_meters: profile?.location_accuracy_meters ?? null,
  address: profile?.address ?? null,
  expo_push_token: profile?.expo_push_token ?? null,
  timezone: profile?.timezone ?? null,
  preferred_currency: profile?.preferred_currency ?? null,
  payment_method: profile?.payment_method ?? null,
  mpesa_phone_number: profile?.mpesa_phone_number ?? null,
  average_rating: profile?.average_rating ?? 0,
  total_ratings: profile?.total_ratings ?? 0,
  is_online: profile?.is_online ?? false,
  last_seen: profile?.last_seen ?? null,
  karma_points: profile?.karma_points ?? 0,
  available_karma: profile?.available_karma ?? 0,
  created_at: profile?.created_at ?? null,
});

const getBearerToken = (request: Request) => {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
};

const getCurrentAuthUser = async (request: Request) => {
  const token = getBearerToken(request);
  if (!token) throw new Response("Missing bearer token", { status: 401 });

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Response("Invalid bearer token", { status: 401 });
  return data.user;
};

const getOptionalAuthUser = async (request: Request) => {
  const token = getBearerToken(request);
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
};

const getProfile = async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", userId)
    .is("deleted_at", null)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as JsonRecord | null;
};

const requireProfile = async (request: Request) => {
  const authUser = await getCurrentAuthUser(request);
  const profile = (await getProfile(authUser.id)) ?? await upsertProfile(authUser as unknown as JsonRecord);
  return { authUser, profile };
};

const isAdminProfile = (profile: JsonRecord | null | undefined) => {
  const role = cleanString(profile?.role);
  return role === "admin" || role === "super_admin";
};

const requireAdminProfile = async (request: Request) => {
  const session = await requireProfile(request);
  if (!isAdminProfile(session.profile)) throw new Response("Admin access required", { status: 403 });
  return session;
};

const requireSuperAdminProfile = async (request: Request) => {
  const session = await requireProfile(request);
  if (cleanString(session.profile.role) !== "super_admin") {
    throw new Response("Super admin access required", { status: 403 });
  }
  return session;
};

const fetchAuthor = async (userId: unknown) => {
  const id = cleanString(userId);
  if (!id) return null;
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, full_name, profile_image")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as JsonRecord | null;
};

const countRows = async (table: string, column: string, value: string) => {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, value);
  if (error) throw error;
  return count ?? 0;
};

const notFound = (label: string) => errorResponse(`${label} not found`, 404);

const selectSingle = async (table: string, id: string, label: string) => {
  const { data, error } = await supabaseAdmin.from(table).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Response(`${label} not found`, { status: 404 });
  return data as JsonRecord;
};

const serializeDog = (dog: JsonRecord) => ({
  id: cleanString(dog.id),
  owner_id: cleanString(dog.owner_id),
  name: cleanString(dog.name),
  breed: cleanString(dog.breed),
  color: cleanString(dog.color),
  height: asNumber(dog.height),
  weight: asNumber(dog.weight),
  age: dog.age ?? null,
  pet_type: cleanString(dog.pet_type) || "dog",
  body_structure: cleanString(dog.body_structure),
  nose_print_image: dog.nose_print_image ?? null,
  body_image: dog.body_image ?? null,
  birthmark_image: dog.birthmark_image ?? null,
  vaccination_card_image: dog.vaccination_card_image ?? null,
  bio: dog.bio ?? null,
});

const ensureDogAccess = async (dogId: string, profile: JsonRecord) => {
  const dog = await selectSingle("dogs", dogId, "Dog");
  if (cleanString(dog.owner_id) !== cleanString(profile.id) && !isAdminProfile(profile)) {
    throw new Response("Not authorized", { status: 403 });
  }
  return dog;
};

const handleMyDogs = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const { data, error } = await supabaseAdmin
    .from("dogs")
    .select("*")
    .eq("owner_id", cleanString(profile.id))
    .order("created_at", { ascending: false });
  if (error) throw error;
  return jsonResponse((data ?? []).map((dog) => serializeDog(dog as JsonRecord)));
};

const handleCreateDog = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const body = await readJson(request);
  const name = cleanString(body.name);
  if (!name) return errorResponse("Dog name is required.");

  const payload = {
    owner_id: cleanString(profile.id),
    name,
    breed: cleanString(body.breed),
    color: cleanString(body.color),
    height: asNumber(body.height),
    weight: asNumber(body.weight),
    age: asNullableNumber(body.age),
    pet_type: cleanString(body.pet_type) || "dog",
    body_structure: cleanString(body.body_structure),
    bio: body.bio ?? null,
    nose_print_image: body.nose_print_image ?? null,
    body_image: body.body_image ?? null,
    birthmark_image: body.birthmark_image ?? null,
    vaccination_card_image: body.vaccination_card_image ?? null,
    updated_at: nowIso(),
  };

  const { data, error } = await supabaseAdmin.from("dogs").insert(payload).select("*").single();
  if (error) throw error;
  return jsonResponse(serializeDog(data as JsonRecord), 201);
};

const handleGetDog = async (request: Request, dogId: string) => {
  const { profile } = await requireProfile(request);
  const dog = await ensureDogAccess(dogId, profile);
  return jsonResponse(serializeDog(dog));
};

const handleUpdateDog = async (request: Request, dogId: string) => {
  const { profile } = await requireProfile(request);
  await ensureDogAccess(dogId, profile);
  const body = await readJson(request);
  const allowed = [
    "name",
    "breed",
    "color",
    "height",
    "weight",
    "age",
    "pet_type",
    "body_structure",
    "bio",
    "nose_print_image",
    "body_image",
    "birthmark_image",
    "vaccination_card_image",
  ];
  const updates: JsonRecord = { updated_at: nowIso() };
  for (const key of allowed) if (key in body) updates[key] = body[key];

  const { data, error } = await supabaseAdmin
    .from("dogs")
    .update(updates)
    .eq("id", dogId)
    .select("*")
    .single();
  if (error) throw error;
  return jsonResponse(serializeDog(data as JsonRecord));
};

const handleDogHealthRecords = async (request: Request, dogId: string) => {
  const { profile } = await requireProfile(request);
  await ensureDogAccess(dogId, profile);

  if (request.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("health_records")
      .select("*")
      .eq("dog_id", dogId)
      .order("date", { ascending: false });
    if (error) throw error;
    return jsonResponse(data ?? []);
  }

  const body = await readJson(request);
  const payload = {
    dog_id: dogId,
    record_type: cleanString(body.record_type),
    date: cleanString(body.date) || nowIso(),
    next_due_date: cleanString(body.next_due_date) || null,
    notes: body.notes ?? null,
  };
  if (!payload.record_type) return errorResponse("Record type is required.");

  const { data, error } = await supabaseAdmin
    .from("health_records")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return jsonResponse(data, 201);
};

const serializeService = async (service: JsonRecord, pin?: JsonRecord | null) => {
  const provider = await fetchAuthor(service.provider_id);
  return {
    ...service,
    price: asNumber(service.price),
    images: asStringArray(service.images),
    provider: provider
      ? {
          full_name: provider.full_name ?? null,
          profile_image: provider.profile_image ?? null,
          average_rating: 0,
          total_ratings: 0,
        }
      : null,
    ...pinMetadata(pin),
  };
};

const handleListServices = async (request: Request) => {
  const url = getUrl(request);
  const itemType = cleanString(url.searchParams.get("item_type"));
  const pins = await getActivePins();
  let query = supabaseAdmin
    .from("services")
    .select("*")
    .eq("is_published", true)
    .eq("admin_approved", true)
    .order("title", { ascending: true });
  if (itemType) query = query.eq("item_type", itemType);

  const { data, error } = await query;
  if (error) throw error;
  const rows = await Promise.all((data ?? []).map((service) => {
    const row = service as JsonRecord;
    return serializeService(row, pins.get(`service:${cleanString(row.id)}`));
  }));
  return jsonResponse(sortPinnedFirst(rows as JsonRecord[]));
};

const handleCreateService = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const body = await readJson(request);
  const title = cleanString(body.title);
  if (!title) return errorResponse("Title is required.");

  const payload = {
    provider_id: cleanString(profile.id),
    title,
    description: cleanString(body.description),
    price: asNumber(body.price),
    item_type: cleanString(body.item_type) || "services",
    category: cleanString(body.category),
    image_url: body.image_url ?? null,
    latitude: asNullableNumber(body.latitude),
    longitude: asNullableNumber(body.longitude),
    location_accuracy_meters: asNullableNumber(body.location_accuracy_meters),
    address: body.address ?? null,
    location_landmark: body.location_landmark ?? null,
    is_published: asBoolean(body.is_published, true),
    currency: cleanString(body.currency) || "KES",
    stock_count: asNullableNumber(body.stock_count),
    slots_available: asNullableNumber(body.slots_available),
    is_busy: asBoolean(body.is_busy, false),
    images: asStringArray(body.images),
    admin_approved: isAdminProfile(profile),
    updated_at: nowIso(),
  };

  const { data, error } = await supabaseAdmin.from("services").insert(payload).select("*").single();
  if (error) throw error;

  const formFields = asArray(body.form_fields);
  if (formFields.length) {
    const rows = formFields.map((field, index) => {
      const record = isRecord(field) ? field : {};
      return {
        service_id: cleanString(data.id),
        field_type: cleanString(record.field_type),
        label: cleanString(record.label),
        options: record.options ?? null,
        is_required: asBoolean(record.is_required, false),
        sort_order: Number.isFinite(Number(record.sort_order)) ? Number(record.sort_order) : index,
      };
    }).filter((field) => field.field_type && field.label);
    if (rows.length) {
      const { error: fieldsError } = await supabaseAdmin.from("service_form_fields").insert(rows);
      if (fieldsError) throw fieldsError;
    }
  }

  return jsonResponse(await serializeService(data as JsonRecord), 201);
};

const handleGetService = async (request: Request, serviceId: string) => {
  const service = await selectSingle("services", serviceId, "Service");
  const authUser = await getOptionalAuthUser(request);
  const profile = authUser ? await getProfile(authUser.id) : null;
  if (!service.admin_approved && cleanString(service.provider_id) !== cleanString(profile?.id) && !isAdminProfile(profile)) {
    throw new Response("Service pending admin approval", { status: 403 });
  }
  const pins = await getActivePins();
  return jsonResponse(await serializeService(service, pins.get(`service:${serviceId}`)));
};

const handleUpdateService = async (request: Request, serviceId: string) => {
  const { profile } = await requireProfile(request);
  const service = await selectSingle("services", serviceId, "Service");
  if (cleanString(service.provider_id) !== cleanString(profile.id) && !isAdminProfile(profile)) {
    throw new Response("Not authorized", { status: 403 });
  }
  const body = await readJson(request);
  const allowed = [
    "title",
    "description",
    "price",
    "item_type",
    "category",
    "image_url",
    "latitude",
    "longitude",
    "location_accuracy_meters",
    "address",
    "location_landmark",
    "is_published",
    "currency",
    "stock_count",
    "slots_available",
    "is_busy",
    "images",
  ];
  const updates: JsonRecord = { updated_at: nowIso() };
  for (const key of allowed) if (key in body) updates[key] = key === "images" ? asStringArray(body[key]) : body[key];

  const { data, error } = await supabaseAdmin
    .from("services")
    .update(updates)
    .eq("id", serviceId)
    .select("*")
    .single();
  if (error) throw error;
  return jsonResponse(await serializeService(data as JsonRecord));
};

const handleDeleteService = async (request: Request, serviceId: string) => {
  const { profile } = await requireProfile(request);
  const service = await selectSingle("services", serviceId, "Service");
  if (cleanString(service.provider_id) !== cleanString(profile.id) && !isAdminProfile(profile)) {
    throw new Response("Not authorized", { status: 403 });
  }
  const { error } = await supabaseAdmin.from("services").delete().eq("id", serviceId);
  if (error) throw error;
  return jsonResponse({ message: "Service deleted" });
};

const handleServiceFormFields = async (request: Request, serviceId: string) => {
  if (request.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("service_form_fields")
      .select("*")
      .eq("service_id", serviceId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return jsonResponse(data ?? []);
  }

  const { profile } = await requireProfile(request);
  const service = await selectSingle("services", serviceId, "Service");
  if (cleanString(service.provider_id) !== cleanString(profile.id) && !isAdminProfile(profile)) {
    throw new Response("Not authorized", { status: 403 });
  }
  const fields = asArray(await readJson(request));
  const { error: deleteError } = await supabaseAdmin.from("service_form_fields").delete().eq("service_id", serviceId);
  if (deleteError) throw deleteError;
  const rows = fields.map((field, index) => {
    const record = isRecord(field) ? field : {};
    return {
      service_id: serviceId,
      field_type: cleanString(record.field_type),
      label: cleanString(record.label),
      options: record.options ?? null,
      is_required: asBoolean(record.is_required, false),
      sort_order: Number.isFinite(Number(record.sort_order)) ? Number(record.sort_order) : index,
    };
  }).filter((field) => field.field_type && field.label);
  if (rows.length) {
    const { error } = await supabaseAdmin.from("service_form_fields").insert(rows);
    if (error) throw error;
  }
  return jsonResponse({ status: "success" });
};

const serializeCaseReport = async (report: JsonRecord, userId = "", pin?: JsonRecord | null) => ({
  ...report,
  images: asStringArray(report.images),
  author: await fetchAuthor(report.author_id),
  like_count: await countRows("case_likes", "report_id", cleanString(report.id)),
  comment_count: await countRows("case_comments", "report_id", cleanString(report.id)),
  is_liked: userId
    ? (await countRows("case_likes", "report_id", cleanString(report.id))) > 0 &&
      Boolean((await supabaseAdmin
        .from("case_likes")
        .select("id")
        .eq("report_id", cleanString(report.id))
        .eq("user_id", userId)
        .maybeSingle()).data)
    : false,
  ...pinMetadata(pin),
  match_count: await countRows("pet_match_candidates", "case_report_id", cleanString(report.id)),
  top_match_confidence: null,
});

const handleListCases = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const userId = cleanString(profile.id);
  const pins = await getActivePins();
  const { data, error } = await supabaseAdmin
    .from("case_reports")
    .select("*")
    .or(`is_approved.eq.true,author_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const rows = await Promise.all((data ?? []).map((report) => {
    const row = report as JsonRecord;
    return serializeCaseReport(row, userId, pins.get(`case:${cleanString(row.id)}`));
  }));
  return jsonResponse(sortPinnedFirst(rows as JsonRecord[]));
};

const handleCreateCase = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const body = await readJson(request);
  const title = cleanString(body.title);
  const caseType = cleanString(body.case_type);
  if (!title || !caseType) return errorResponse("Case type and title are required.");

  const payload = {
    author_id: cleanString(profile.id),
    case_type: caseType,
    title,
    description: body.description ?? null,
    image_url: body.image_url ?? null,
    breed: body.breed ?? null,
    color: body.color ?? null,
    pet_type: cleanString(body.pet_type) || "dog",
    sex: body.sex ?? null,
    size: body.size ?? null,
    microchip_id: body.microchip_id ?? null,
    collar_description: body.collar_description ?? null,
    unique_markings: body.unique_markings ?? null,
    location: body.location ?? null,
    latitude: asNullableNumber(body.latitude),
    longitude: asNullableNumber(body.longitude),
    location_accuracy_meters: asNullableNumber(body.location_accuracy_meters),
    images: asStringArray(body.images),
    is_approved: isAdminProfile(profile),
    updated_at: nowIso(),
  };

  const { data, error } = await supabaseAdmin.from("case_reports").insert(payload).select("*").single();
  if (error) throw error;
  return jsonResponse(await serializeCaseReport(data as JsonRecord, cleanString(profile.id)), 201);
};

const handleGetCase = async (request: Request, reportId: string) => {
  const { profile } = await requireProfile(request);
  const report = await selectSingle("case_reports", reportId, "Case report");
  if (!report.is_approved && cleanString(report.author_id) !== cleanString(profile.id) && !isAdminProfile(profile)) {
    throw new Response("Report pending moderation", { status: 403 });
  }
  const pins = await getActivePins();
  return jsonResponse(await serializeCaseReport(report, cleanString(profile.id), pins.get(`case:${reportId}`)));
};

const handleCaseComments = async (request: Request, reportId: string) => {
  const { profile } = await requireProfile(request);
  await selectSingle("case_reports", reportId, "Case report");
  if (request.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("case_comments")
      .select("*")
      .eq("report_id", reportId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    const comments = await Promise.all((data ?? []).map(async (comment) => ({
      ...comment,
      tagged_users: asStringArray((comment as JsonRecord).tagged_users),
      author: await fetchAuthor((comment as JsonRecord).author_id),
    })));
    return jsonResponse(comments);
  }

  const body = await readJson(request);
  const content = cleanString(body.content);
  if (!content) return errorResponse("Comment is required.");
  const { data, error } = await supabaseAdmin
    .from("case_comments")
    .insert({
      report_id: reportId,
      author_id: cleanString(profile.id),
      content,
      tagged_users: asStringArray(body.tagged_users),
    })
    .select("*")
    .single();
  if (error) throw error;
  return jsonResponse({ ...data, author: await fetchAuthor(profile.id) }, 201);
};

const handleCaseLike = async (request: Request, reportId: string) => {
  const { profile } = await requireProfile(request);
  await selectSingle("case_reports", reportId, "Case report");
  const userId = cleanString(profile.id);
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("case_likes")
    .select("id")
    .eq("report_id", reportId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const { error } = await supabaseAdmin.from("case_likes").delete().eq("id", existing.id);
    if (error) throw error;
    return jsonResponse({ liked: false, like_count: await countRows("case_likes", "report_id", reportId) });
  }

  const { error } = await supabaseAdmin.from("case_likes").insert({ report_id: reportId, user_id: userId });
  if (error) throw error;
  return jsonResponse({ liked: true, like_count: await countRows("case_likes", "report_id", reportId) });
};

const handleListEvents = async () => {
  const pins = await getActivePins();
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("*")
    .eq("is_public", 1)
    .order("start_time", { ascending: true })
    .limit(100);
  if (error) throw error;
  const events = await Promise.all((data ?? []).map(async (event) => ({
    ...event,
    images: asStringArray((event as JsonRecord).images),
    registrant_count: await countRows("registrations", "event_id", cleanString((event as JsonRecord).id)),
    ...pinMetadata(pins.get(`event:${cleanString((event as JsonRecord).id)}`)),
  })));
  return jsonResponse(events);
};

const handleCreateEvent = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const role = cleanString(profile.role);
  if (!["admin", "super_admin", "provider"].includes(role)) {
    throw new Response("Not authorized to create events", { status: 403 });
  }
  const body = await readJson(request);
  const title = cleanString(body.title);
  if (!title) return errorResponse("Event title is required.");

  const payload = {
    organizer_id: cleanString(profile.id),
    title,
    description: body.description ?? null,
    location: body.location ?? null,
    poster_url: body.poster_url ?? null,
    images: asStringArray(body.images),
    start_time: cleanString(body.start_time) || nowIso(),
    end_time: cleanString(body.end_time) || cleanString(body.start_time) || nowIso(),
    capacity: asNumber(body.capacity),
    ticket_price: asNumber(body.ticket_price),
    currency: cleanString(body.currency) || "KES",
    ticket_tiers: body.ticket_tiers ?? null,
    attendee_type_question: body.attendee_type_question ?? null,
    available_slots: body.available_slots ?? null,
    category: body.category ?? null,
    is_public: Number.isFinite(Number(body.is_public)) ? Number(body.is_public) : 1,
    admin_created: isAdminProfile(profile),
    scorecard_enabled: asBoolean(body.scorecard_enabled, true),
    scorecard_title: body.scorecard_title ?? null,
    scorecard_description: body.scorecard_description ?? null,
    updated_at: nowIso(),
  };

  const { data, error } = await supabaseAdmin.from("events").insert(payload).select("*").single();
  if (error) throw error;

  let pin: JsonRecord | null = null;
  if (isAdminProfile(profile)) {
    const { data: pinData, error: pinError } = await supabaseAdmin
      .from("content_pins")
      .upsert({
        target_type: "event",
        target_id: cleanString((data as JsonRecord).id),
        title,
        description: body.description ?? null,
        image_url: body.poster_url ?? null,
        priority: 150,
        is_active: true,
        created_by_id: cleanString(profile.id),
        updated_at: nowIso(),
      }, { onConflict: "target_type,target_id" })
      .select("*")
      .single();
    if (pinError) throw pinError;
    pin = pinData as JsonRecord;
  }

  return jsonResponse({ ...data, registrant_count: 0, ...pinMetadata(pin) }, 201);
};

const handleGetEvent = async (eventId: string) => {
  const event = await selectSingle("events", eventId, "Event");
  const pins = await getActivePins();
  return jsonResponse({
    ...event,
    images: asStringArray(event.images),
    registrant_count: await countRows("registrations", "event_id", eventId),
    ...pinMetadata(pins.get(`event:${eventId}`)),
  });
};

const handleRegisterEvent = async (request: Request, eventId: string) => {
  const { profile } = await requireProfile(request);
  const event = await selectSingle("events", eventId, "Event");
  const body = await readJson(request);
  const amount = asNumber(event.ticket_price);
  const payload = {
    event_id: eventId,
    user_id: cleanString(profile.id),
    dog_id: cleanString(body.dog_id) || null,
    status: amount > 0 ? "pending_payment" : "registered",
    role: cleanString(body.role) || "attendee",
    share_phone: asBoolean(body.share_phone, false),
    amount,
    currency: cleanString(event.currency) || "KES",
    payment_status: amount > 0 ? "pending" : "free",
    ticket_tier_id: body.ticket_tier_id ?? null,
    attendee_type_justification: body.attendee_type_justification ?? null,
    booking_slot_id: body.booking_slot_id ?? null,
    updated_at: nowIso(),
  };

  const { data, error } = await supabaseAdmin
    .from("registrations")
    .upsert(payload, { onConflict: "event_id,user_id" })
    .select("*")
    .single();
  if (error) throw error;
  return jsonResponse(data, 201);
};

const handleMyRegistrations = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const { data, error } = await supabaseAdmin
    .from("registrations")
    .select("*, event:events(*)")
    .eq("user_id", cleanString(profile.id))
    .order("created_at", { ascending: false });
  if (error) throw error;
  return jsonResponse(data ?? []);
};

const handleSavedEvents = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const { data, error } = await supabaseAdmin
    .from("saved_events")
    .select("*, event:events(*)")
    .eq("user_id", cleanString(profile.id))
    .order("created_at", { ascending: false });
  if (error) throw error;
  return jsonResponse(data ?? []);
};

const handleSaveEvent = async (request: Request, eventId: string) => {
  const { profile } = await requireProfile(request);
  await selectSingle("events", eventId, "Event");
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("saved_events")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", cleanString(profile.id))
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    const { error } = await supabaseAdmin.from("saved_events").delete().eq("id", existing.id);
    if (error) throw error;
    return jsonResponse({ saved: false });
  }
  const { error } = await supabaseAdmin
    .from("saved_events")
    .insert({ event_id: eventId, user_id: cleanString(profile.id) });
  if (error) throw error;
  return jsonResponse({ saved: true });
};

const handleCreateOrder = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const body = await readJson(request);
  const serviceId = cleanString(body.service_id);
  const service = await selectSingle("services", serviceId, "Service");
  if (!service.is_published || !service.admin_approved) return errorResponse("This marketplace item is not available for purchase.");

  const amount = Math.max(asNumber(service.price), 0);
  const payout = Math.round((amount / 1.235) * 100) / 100;
  const commission = Math.round((amount - payout) * 100) / 100;
  const { data, error } = await supabaseAdmin
    .from("orders")
    .insert({
      buyer_id: cleanString(profile.id),
      service_id: serviceId,
      amount,
      commission,
      payout,
      status: "pending",
      share_phone: asBoolean(body.share_phone, false),
      pesapal_merchant_reference: crypto.randomUUID(),
      updated_at: nowIso(),
    })
    .select("*")
    .single();
  if (error) throw error;

  const formResponses = asArray(body.form_responses);
  if (formResponses.length) {
    const rows = formResponses.map((response) => {
      const record = isRecord(response) ? response : {};
      return {
        order_id: cleanString(data.id),
        field_id: cleanString(record.field_id),
        answer_value: record.answer_value ?? null,
      };
    }).filter((response) => response.field_id);
    if (rows.length) {
      const { error: responsesError } = await supabaseAdmin.from("order_form_responses").insert(rows);
      if (responsesError) throw responsesError;
    }
  }
  return jsonResponse({ ...data, responses: [] }, 201);
};

const handleMyOrders = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const userId = cleanString(profile.id);
  const { data: buyerOrders, error: buyerError } = await supabaseAdmin
    .from("orders")
    .select("*, service:services(*)")
    .eq("buyer_id", userId)
    .order("created_at", { ascending: false });
  if (buyerError) throw buyerError;

  const { data: providerServices, error: serviceError } = await supabaseAdmin
    .from("services")
    .select("id")
    .eq("provider_id", userId);
  if (serviceError) throw serviceError;

  const serviceIds = (providerServices ?? []).map((service) => cleanString((service as JsonRecord).id)).filter(Boolean);
  let providerOrders: unknown[] = [];
  if (serviceIds.length) {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*, service:services(*)")
      .in("service_id", serviceIds)
      .order("created_at", { ascending: false });
    if (error) throw error;
    providerOrders = data ?? [];
  }

  const byId = new Map<string, unknown>();
  for (const order of [...(buyerOrders ?? []), ...providerOrders]) {
    byId.set(cleanString((order as JsonRecord).id), order);
  }
  return jsonResponse(Array.from(byId.values()));
};

const handleWalletSummary = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const userId = cleanString(profile.id);
  const { data: providerServices, error: serviceError } = await supabaseAdmin
    .from("services")
    .select("id")
    .eq("provider_id", userId);
  if (serviceError) throw serviceError;

  const serviceIds = (providerServices ?? []).map((service) => cleanString((service as JsonRecord).id)).filter(Boolean);
  if (!serviceIds.length) {
    return jsonResponse({
      pending_balance: 0,
      available_balance: 0,
      total_earnings: 0,
      currency: cleanString(profile.preferred_currency) || "KES",
    });
  }

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("payout,status")
    .in("service_id", serviceIds);
  if (error) throw error;
  const paid = (data ?? []).filter((order) => ["paid", "completed", "settled"].includes(cleanString((order as JsonRecord).status)));
  const pending = paid.reduce((sum, order) => sum + asNumber((order as JsonRecord).payout), 0);
  return jsonResponse({
    pending_balance: pending,
    available_balance: 0,
    total_earnings: pending,
    currency: cleanString(profile.preferred_currency) || "KES",
  });
};

const handleCreateSupportTicket = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const body = await readJson(request);
  const subject = cleanString(body.subject);
  const message = cleanString(body.message);
  if (!subject || !message) return errorResponse("Subject and message are required.");
  const { data, error } = await supabaseAdmin
    .from("support_tickets")
    .insert({
      user_id: cleanString(profile.id),
      subject,
      message,
      images: asStringArray(body.images),
      updated_at: nowIso(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return jsonResponse(data, 201);
};

const handleListSupportTickets = async (request: Request) => {
  const { profile } = await requireProfile(request);
  let query = supabaseAdmin.from("support_tickets").select("*").order("created_at", { ascending: false });
  if (!isAdminProfile(profile)) query = query.eq("user_id", cleanString(profile.id));
  const { data, error } = await query;
  if (error) throw error;
  return jsonResponse(data ?? []);
};

const handleAnnouncements = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const role = cleanString(profile.role) || "buyer";
  const { data, error } = await supabaseAdmin
    .from("announcements")
    .select("*")
    .or(`target_audience.eq.all,target_audience.eq.${role},target_audience.eq.${role}s`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return jsonResponse(data ?? []);
};

const handleNotifications = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("user_id", cleanString(profile.id))
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return jsonResponse(data ?? []);
};

const handleReadNotification = async (request: Request, notificationId: string) => {
  const { profile } = await requireProfile(request);
  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", cleanString(profile.id));
  if (error) throw error;
  return jsonResponse({ message: "Success" });
};

const PIN_ROUTE_BY_TARGET: Record<string, string> = {
  event: "EventDetail",
  service: "Marketplace",
  case: "CaseDetail",
  community: "Community",
};

const isPinTargetVisible = async (pin: JsonRecord) => {
  const targetType = cleanString(pin.target_type);
  const targetId = cleanString(pin.target_id);
  if (!targetType || !targetId) return false;

  if (targetType === "event") {
    const { data, error } = await supabaseAdmin.from("events").select("is_public").eq("id", targetId).maybeSingle();
    if (error) throw error;
    return asNumber((data as JsonRecord | null)?.is_public) === 1;
  }

  if (targetType === "service") {
    const { data, error } = await supabaseAdmin.from("services").select("is_published,admin_approved").eq("id", targetId).maybeSingle();
    if (error) throw error;
    return Boolean((data as JsonRecord | null)?.is_published) && Boolean((data as JsonRecord | null)?.admin_approved);
  }

  if (targetType === "case") {
    const { data, error } = await supabaseAdmin.from("case_reports").select("is_approved").eq("id", targetId).maybeSingle();
    if (error) throw error;
    return Boolean((data as JsonRecord | null)?.is_approved);
  }

  if (targetType === "community") {
    const { data, error } = await supabaseAdmin.from("community_messages").select("is_hidden").eq("id", targetId).maybeSingle();
    if (error) throw error;
    return data ? !Boolean((data as JsonRecord).is_hidden) : false;
  }

  return false;
};

const handleSpotlight = async () => {
  const pins = await getActivePinRows();
  const visiblePins = (await Promise.all(pins.map(async (pin) => (
    await isPinTargetVisible(pin) ? pin : null
  )))).filter((pin): pin is JsonRecord => Boolean(pin));
  const { data, error } = await supabaseAdmin
    .from("spotlight")
    .select("*")
    .eq("is_active", true)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const pinnedSpotlight = visiblePins.map((pin) => ({
    id: pin.id,
    title: pin.title,
    description: pin.description ?? "",
    image_url: pin.image_url ?? null,
    target_route: PIN_ROUTE_BY_TARGET[cleanString(pin.target_type)] ?? null,
    target_id: pin.target_id,
    is_active: pin.is_active,
    updated_at: pin.updated_at,
    is_pinned: true,
    pin_priority: pin.priority ?? null,
    target_type: pin.target_type,
  }));
  const legacySpotlight = (data ?? []).map((item) => ({ ...item, is_pinned: false, pin_priority: null, target_type: null }));
  return jsonResponse([...pinnedSpotlight, ...legacySpotlight]);
};

const handleCommunityMessages = async (request: Request, globalOnly: boolean) => {
  const authUser = await getOptionalAuthUser(request);
  const pins = await getActivePins();
  let query = supabaseAdmin
    .from("community_messages")
    .select("*")
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(50);
  if (globalOnly) query = query.eq("is_global", true);
  const { data, error } = await query;
  if (error) throw error;
  const messages = await Promise.all((data ?? []).map(async (message) => ({
    ...message,
    hashtags: asStringArray((message as JsonRecord).hashtags),
    author: await fetchAuthor((message as JsonRecord).author_id),
    reactions: [],
    poll_results: {},
    has_voted: null,
    ...pinMetadata(pins.get(`community:${cleanString((message as JsonRecord).id)}`)),
  })));
  if (!authUser) return jsonResponse(sortPinnedFirst(messages as JsonRecord[]));
  return jsonResponse(sortPinnedFirst(messages as JsonRecord[]));
};

const handleCreateCommunityMessage = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const body = await readJson(request);
  const content = cleanString(body.content);
  if (!content) return errorResponse("Message content is required.");
  const { data, error } = await supabaseAdmin
    .from("community_messages")
    .insert({
      author_id: cleanString(profile.id),
      content,
      latitude: asNullableNumber(body.latitude),
      longitude: asNullableNumber(body.longitude),
      is_global: asBoolean(body.is_global, true),
      reshare_id: body.reshare_id ?? null,
      hashtags: asStringArray(body.hashtags),
      is_poll: asBoolean(body.is_poll, false),
      poll_options: body.poll_options ?? null,
      updated_at: nowIso(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return jsonResponse({ ...data, author: await fetchAuthor(profile.id), reactions: [], flag_count: 0, poll_results: {}, has_voted: null }, 201);
};

const handleDirectMessages = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const userId = cleanString(profile.id);
  if (request.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("direct_messages")
      .select("*")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return jsonResponse(await Promise.all((data ?? []).map(async (message) => ({
      ...message,
      sender: await fetchAuthor((message as JsonRecord).sender_id),
      receiver: await fetchAuthor((message as JsonRecord).receiver_id),
    }))));
  }

  const body = await readJson(request);
  const receiverId = cleanString(body.receiver_id);
  const content = cleanString(body.content);
  if (!receiverId || !content) return errorResponse("Receiver and content are required.");
  if (receiverId === userId) return errorResponse("You cannot message yourself.");
  const { data, error } = await supabaseAdmin
    .from("direct_messages")
    .insert({ sender_id: userId, receiver_id: receiverId, content })
    .select("*")
    .single();
  if (error) throw error;
  return jsonResponse({ ...data, sender: await fetchAuthor(userId), receiver: await fetchAuthor(receiverId) }, 201);
};

const handleHeartbeat = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const { error } = await supabaseAdmin
    .from("users")
    .update({ is_online: true, last_seen: nowIso(), updated_at: nowIso() })
    .eq("id", cleanString(profile.id));
  if (error) throw error;
  return jsonResponse({ status: "online" });
};

const handleOnlineUsers = async () => {
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .gte("last_seen", since)
    .is("deleted_at", null)
    .limit(50);
  if (error) throw error;
  return jsonResponse((data ?? []).map((user) => serializeUser(user as JsonRecord)));
};

const HEALTH_MS_PER_DAY = 24 * 60 * 60 * 1000;

const getValidRecordDate = (value: unknown) => {
  const text = cleanString(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};

const daysUntilRecordDate = (date: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / HEALTH_MS_PER_DAY);
};

const formatHealthRecordType = (value: unknown) => {
  const text = cleanString(value).replace(/_/g, " ");
  return text ? text.replace(/\b\w/g, (char) => char.toUpperCase()) : "Health Check";
};

const buildHealthAdvisorResponse = (dog: JsonRecord, records: JsonRecord[]) => {
  const name = cleanString(dog.name) || "Your pet";
  const breed = cleanString(dog.breed);
  const petType = cleanString(dog.pet_type) || "pet";
  const age = asNumber(dog.age);
  const insights: string[] = [];

  const dueRecords = records
    .map((record) => ({ record, dueDate: getValidRecordDate(record.next_due_date) }))
    .filter((item): item is { record: JsonRecord; dueDate: Date } => Boolean(item.dueDate))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const overdue = dueRecords.find((item) => daysUntilRecordDate(item.dueDate) < 0);
  const dueToday = dueRecords.find((item) => daysUntilRecordDate(item.dueDate) === 0);
  const dueSoon = dueRecords.find((item) => {
    const days = daysUntilRecordDate(item.dueDate);
    return days > 0 && days <= 14;
  });

  if (overdue) {
    insights.push(`${name} has an overdue ${formatHealthRecordType(overdue.record.record_type)} date. Book time with a qualified vet or update the record after care is completed.`);
  } else if (dueToday) {
    insights.push(`${name}'s ${formatHealthRecordType(dueToday.record.record_type)} is due today. Keep the appointment or update the record if your vet has already handled it.`);
  } else if (dueSoon) {
    insights.push(`${name}'s ${formatHealthRecordType(dueSoon.record.record_type)} is due in ${daysUntilRecordDate(dueSoon.dueDate)} days. Set a reminder now so it does not slip.`);
  }

  if (records.length === 0) {
    insights.push(`Start ${name}'s passport with the most recent vaccination, deworming, or vet visit record you already have.`);
  }

  if (!records.some((record) => cleanString(record.record_type) === "vaccination")) {
    insights.push(`${name} has no vaccination record yet. Add the latest details or ask your vet what is due next.`);
  }

  if (!records.some((record) => cleanString(record.record_type) === "checkup")) {
    insights.push(`${name} has no checkup record yet. A routine vet visit gives you a useful baseline even when everything looks normal.`);
  }

  const hasMedication = records.some((record) => cleanString(record.record_type) === "medication");
  if (hasMedication) {
    insights.push(`Keep ${name}'s medication notes clear: dose, timing, vet instructions, and any reaction you observe.`);
  }

  const hasSurgery = records.some((record) => cleanString(record.record_type) === "surgery");
  if (hasSurgery) {
    insights.push(`For ${name}'s surgery history, log recovery notes and follow-up dates so your vet has a clean timeline.`);
  }

  const symptomPattern = /\b(vomit|diarrhea|cough|bleed|seizure|letharg|not eating|limp|pain)\b/i;
  if (records.some((record) => symptomPattern.test(cleanString(record.notes)))) {
    insights.push(`Some notes mention possible symptoms. Contact a qualified veterinarian promptly if symptoms are ongoing, severe, or worsening.`);
  }

  if (age > 0 && age < 1) {
    const youngLabel = petType === "cat" ? "kitten" : petType === "dog" ? "puppy" : "young pet";
    insights.push(`${name} is still a ${youngLabel}. Track vaccines, deworming, weight, and feeding changes closely during rapid growth.`);
  } else if (age >= 7) {
    insights.push(`${name} is in the senior range. Ask your vet how often wellness checks, dental care, and weight reviews should happen.`);
  }

  if (breed) {
    insights.push(`Because ${name}'s breed is recorded as ${breed}, ask your vet whether any breed-specific screening or prevention plan is recommended.`);
  }

  const uniqueInsights = [...new Set(insights)].slice(0, 4);
  const proTip = uniqueInsights[0] || `Keep ${name}'s next due dates updated so reminders stay useful and the passport remains easy to trust.`;

  return {
    dog_name: name,
    breed,
    insights: uniqueInsights.length ? uniqueInsights : [proTip],
    pro_tip: proTip,
    engine: "Supabase Wellness Rules",
  };
};

const handleHealthAdvisor = async (request: Request, dogId: string) => {
  const { profile } = await requireProfile(request);
  const dog = await ensureDogAccess(dogId, profile);
  const { data, error } = await supabaseAdmin
    .from("health_records")
    .select("*")
    .eq("dog_id", dogId)
    .order("date", { ascending: false })
    .limit(20);
  if (error) throw error;
  return jsonResponse(buildHealthAdvisorResponse(dog, (data ?? []) as JsonRecord[]));
};

const handleHealthSummary = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const userId = cleanString(profile.id);
  const dogCount = await countRows("dogs", "owner_id", userId);
  return jsonResponse({
    dog_count: dogCount,
    wellness_score: null,
    upcoming_due_count: 0,
    overdue_count: 0,
    recent_records: [],
  });
};

const handleExchangeRates = () => jsonResponse({
  rates: {
    USD: 1,
    KES: 129,
    EUR: 0.92,
    GBP: 0.78,
  },
});

const PAID_ORDER_STATES = new Set(["paid", "completed", "settled"]);

const normalizeStatus = (value: unknown) => cleanString(value).toLowerCase();

const isPaidOrderStatus = (status: unknown) => PAID_ORDER_STATES.has(normalizeStatus(status));

const calculateKarmaReward = (amount: unknown) => {
  const value = asNumber(amount);
  if (value <= 0) return 0;
  return Math.min(500, Math.max(5, Math.floor(value / 100)));
};

const createNotification = async (
  userId: unknown,
  title: string,
  message: string,
  type = "info",
  extra: JsonRecord = {},
) => {
  const id = cleanString(userId);
  if (!id) return;
  const { error } = await supabaseAdmin.from("notifications").insert({
    user_id: id,
    title,
    message,
    type,
    target_type: extra.target_type ?? null,
    target_id: extra.target_id ?? null,
    target_route: extra.target_route ?? null,
  });
  if (error) throw error;
};

const supportStatusKey = (status: unknown) => {
  const raw = normalizeStatus(status).replace("_", "-");
  if (["in progress", "in-progress", "inprogress"].includes(raw)) return "in-progress";
  if (raw === "resolved") return "resolved";
  return "open";
};

const supportStatusLabel = (status: unknown) => {
  const labels: Record<string, string> = {
    open: "Open",
    "in-progress": "In-Progress",
    resolved: "Resolved",
  };
  return labels[supportStatusKey(status)] ?? "Open";
};

const pesapalBaseUrl = () => (
  normalizeStatus(Deno.env.get("PESAPAL_ENV")) === "sandbox"
    ? "https://cybapi.pesapal.com/v3"
    : "https://pay.pesapal.com/v3"
);

const readPesapalJson = async (response: Response) => {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as JsonRecord;
  } catch {
    return { error: text };
  }
};

const pesapalToken = async () => {
  const consumerKey = Deno.env.get("PESAPAL_CONSUMER_KEY") ?? "";
  const consumerSecret = Deno.env.get("PESAPAL_CONSUMER_SECRET") ?? "";
  if (!consumerKey || !consumerSecret) {
    throw new Response("Pesapal checkout is not configured.", { status: 500 });
  }

  const response = await fetch(`${pesapalBaseUrl()}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
  });
  const body = await readPesapalJson(response);
  const token = cleanString(body.token);
  if (!response.ok || !token) {
    throw new Response(`Failed to authenticate with Pesapal: ${cleanString(body.error) || cleanString(body.message) || response.statusText}`, { status: 502 });
  }
  return token;
};

const pesapalRegisterIpn = async (token: string, request: Request) => {
  const fallbackUrl = `${getUrl(request).origin}/api/pesapal/ipn`;
  const ipnUrl = cleanString(Deno.env.get("PESAPAL_IPN_URL")) || fallbackUrl;
  const response = await fetch(`${pesapalBaseUrl()}/api/URLSetup/RegisterIPN`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ url: ipnUrl, ipn_notification_type: "GET" }),
  });
  const body = await readPesapalJson(response);
  const ipnId = cleanString(body.ipn_id);
  if (!response.ok || !ipnId) {
    throw new Response(`Failed to register IPN with Pesapal: ${cleanString(body.error) || cleanString(body.message) || response.statusText}`, { status: 502 });
  }
  return ipnId;
};

const pesapalSubmitOrder = async (
  token: string,
  request: Request,
  details: {
    reference: string;
    amount: number;
    description: string;
    email: string;
    phone: string;
    ipnId: string;
    currency: string;
  },
) => {
  const fallbackCallbackUrl = `${getUrl(request).origin}/api/pesapal/callback`;
  const callbackUrl = cleanString(Deno.env.get("PESAPAL_CALLBACK_URL")) || fallbackCallbackUrl;
  const response = await fetch(`${pesapalBaseUrl()}/api/Transactions/SubmitOrderRequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      id: details.reference,
      currency: details.currency || "KES",
      amount: details.amount,
      description: details.description,
      callback_url: callbackUrl,
      notification_id: details.ipnId,
      billing_address: {
        email_address: details.email,
        phone_number: details.phone || "0700000000",
        country_code: "KE",
        first_name: "Customer",
        last_name: "User",
      },
    }),
  });
  const body = await readPesapalJson(response);
  if (!response.ok || !body.redirect_url) {
    throw new Response(`Failed to start Pesapal checkout: ${cleanString(body.error) || cleanString(body.message) || response.statusText}`, { status: 502 });
  }
  return body;
};

const pesapalTransactionStatus = async (trackingId: string) => {
  const token = await pesapalToken();
  const response = await fetch(`${pesapalBaseUrl()}/api/Transactions/GetTransactionStatus?OrderTrackingId=${encodeURIComponent(trackingId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
  const body = await readPesapalJson(response);
  if (!response.ok) {
    throw new Response(`Pesapal status check failed: ${cleanString(body.error) || cleanString(body.message) || response.statusText}`, { status: 502 });
  }
  return body;
};

const isPesapalPaymentSuccessful = (status: JsonRecord | null | undefined) => {
  if (!status) return false;
  const statusCode = status.payment_status_code ?? status.status_code;
  const statusText = cleanString(
    status.payment_status_description ??
    status.payment_status ??
    status.status,
  ).toLowerCase();
  return String(statusCode) === "1" || ["completed", "paid", "success", "successful"].includes(statusText);
};

const findOrderByReference = async (reference: string) => {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .or(`id.eq.${reference},pesapal_merchant_reference.eq.${reference}`)
    .maybeSingle();
  if (error) throw error;
  return data as JsonRecord | null;
};

const findRegistrationByReference = async (reference: string) => {
  const { data, error } = await supabaseAdmin
    .from("registrations")
    .select("*")
    .or(`id.eq.${reference},pesapal_merchant_reference.eq.${reference}`)
    .maybeSingle();
  if (error) throw error;
  return data as JsonRecord | null;
};

const markOrderPaid = async (order: JsonRecord, trackingId?: string) => {
  const status = normalizeStatus(order.status);
  if (isPaidOrderStatus(status)) {
    if (trackingId && !order.pesapal_tracking_id) {
      const { error } = await supabaseAdmin.from("orders").update({ pesapal_tracking_id: trackingId, updated_at: nowIso() }).eq("id", order.id);
      if (error) throw error;
    }
    return false;
  }
  if (status !== "pending") return false;

  const service = await selectSingle("services", cleanString(order.service_id), "Service");
  const serviceUpdates: JsonRecord = { updated_at: nowIso() };
  if (cleanString(service.item_type) === "products" && service.stock_count !== null && service.stock_count !== undefined) {
    serviceUpdates.stock_count = Math.max(asNumber(service.stock_count) - 1, 0);
  } else if (service.slots_available !== null && service.slots_available !== undefined) {
    serviceUpdates.slots_available = Math.max(asNumber(service.slots_available) - 1, 0);
  }
  if (Object.keys(serviceUpdates).length > 1) {
    const { error: serviceError } = await supabaseAdmin.from("services").update(serviceUpdates).eq("id", service.id);
    if (serviceError) throw serviceError;
  }

  const { error } = await supabaseAdmin
    .from("orders")
    .update({ status: "paid", pesapal_tracking_id: trackingId || order.pesapal_tracking_id || null, updated_at: nowIso() })
    .eq("id", order.id);
  if (error) throw error;

  await createNotification(order.buyer_id, "Payment Confirmed", `Your payment for '${cleanString(service.title) || "Marketplace item"}' was confirmed.`, "payment", {
    target_type: "order",
    target_id: order.id,
  });
  if (service.provider_id) {
    await createNotification(service.provider_id, "New Paid Order", `A buyer paid for '${cleanString(service.title) || "your listing"}'.`, "order", {
      target_type: "order",
      target_id: order.id,
    });
  }
  return true;
};

const markRegistrationPaid = async (registration: JsonRecord, trackingId?: string) => {
  if (normalizeStatus(registration.payment_status) === "paid") return false;
  const { error } = await supabaseAdmin
    .from("registrations")
    .update({
      status: "registered",
      payment_status: "paid",
      pesapal_tracking_id: trackingId || registration.pesapal_tracking_id || null,
      paid_at: nowIso(),
      ticket_token: registration.ticket_token || crypto.randomUUID(),
      updated_at: nowIso(),
    })
    .eq("id", registration.id);
  if (error) throw error;
  await createNotification(registration.user_id, "Event payment confirmed", "Your event ticket payment has been confirmed.", "event", {
    target_type: "event",
    target_id: registration.event_id,
    target_route: "EventDetail",
  });
  return true;
};

const handleInitiatePayment = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const url = getUrl(request);
  const orderId = cleanString(url.searchParams.get("order_id"));
  const email = cleanString(url.searchParams.get("email")) || cleanString(profile.email);
  const phone = cleanString(url.searchParams.get("phone")) || cleanString(profile.phone_number) || "0700000000";
  if (!orderId) return errorResponse("order_id is required.");

  const order = await selectSingle("orders", orderId, "Order");
  if (cleanString(order.buyer_id) !== cleanString(profile.id) && !isAdminProfile(profile)) {
    throw new Response("Not authorized", { status: 403 });
  }
  if (isPaidOrderStatus(order.status)) {
    return jsonResponse({
      message: "Payment already confirmed",
      payment_success: true,
      order_status: order.status,
      order_tracking_id: order.pesapal_tracking_id,
    });
  }

  const service = await selectSingle("services", cleanString(order.service_id), "Service");
  const token = await pesapalToken();
  const ipnId = await pesapalRegisterIpn(token, request);
  const reference = cleanString(order.pesapal_merchant_reference) || cleanString(order.id);
  const { error: refError } = await supabaseAdmin.from("orders").update({ pesapal_merchant_reference: reference, updated_at: nowIso() }).eq("id", order.id);
  if (refError) throw refError;

  const checkout = await pesapalSubmitOrder(token, request, {
    reference,
    amount: asNumber(order.amount),
    description: `Lovedogs 360 - Order ${cleanString(order.id)}`,
    email,
    phone,
    ipnId,
    currency: cleanString(service.currency) || "KES",
  });
  const trackingId = cleanString(checkout.order_tracking_id ?? checkout.OrderTrackingId);
  if (trackingId) {
    const { error } = await supabaseAdmin.from("orders").update({ pesapal_tracking_id: trackingId, updated_at: nowIso() }).eq("id", order.id);
    if (error) throw error;
  }
  return jsonResponse(checkout);
};

const handlePaymentStatus = async (request: Request, orderId: string) => {
  const { profile } = await requireProfile(request);
  const url = getUrl(request);
  const order = await selectSingle("orders", orderId, "Order");
  if (cleanString(order.buyer_id) !== cleanString(profile.id) && !isAdminProfile(profile)) {
    throw new Response("Not authorized", { status: 403 });
  }

  let statusRes: JsonRecord | null = null;
  let paymentSuccess = isPaidOrderStatus(order.status);
  const tracking = cleanString(url.searchParams.get("tracking_id")) || cleanString(order.pesapal_tracking_id);
  if (tracking && !paymentSuccess) {
    statusRes = await pesapalTransactionStatus(tracking);
    if (isPesapalPaymentSuccessful(statusRes)) {
      await markOrderPaid(order, tracking);
      paymentSuccess = true;
    }
  }

  return jsonResponse({
    order_id: order.id,
    order_status: paymentSuccess ? "paid" : order.status,
    payment_success: paymentSuccess,
    payment_status: statusRes,
    pesapal_tracking_id: tracking || order.pesapal_tracking_id,
    pesapal_merchant_reference: order.pesapal_merchant_reference,
    buyer_reward_points: paymentSuccess ? calculateKarmaReward(order.amount) : 0,
    seller_reward_points: paymentSuccess ? calculateKarmaReward(order.payout) : 0,
    discount_amount: order.discount_amount ?? 0,
    karma_points_redeemed: order.karma_points_redeemed ?? 0,
  });
};

const handlePesapalCallback = async (request: Request) => {
  const url = getUrl(request);
  const tracking = cleanString(url.searchParams.get("OrderTrackingId"));
  const reference = cleanString(url.searchParams.get("OrderMerchantReference"));
  if (!tracking || !reference) return errorResponse("Missing Pesapal reference.", 400);

  const statusRes = await pesapalTransactionStatus(tracking);
  const order = await findOrderByReference(reference);
  if (order && isPesapalPaymentSuccessful(statusRes)) {
    await markOrderPaid(order, tracking);
    return jsonResponse({ status: "processed", type: "order", order_status: "paid", data: statusRes });
  }

  const registration = await findRegistrationByReference(reference);
  if (registration && isPesapalPaymentSuccessful(statusRes)) {
    await markRegistrationPaid(registration, tracking);
  }
  return jsonResponse({
    status: "processed",
    type: registration ? "event_registration" : null,
    registration_status: registration ? "registered" : null,
    order_status: order?.status ?? null,
    data: statusRes,
  });
};

const handlePesapalIpn = async (request: Request) => {
  const url = getUrl(request);
  const tracking = cleanString(url.searchParams.get("OrderTrackingId"));
  const reference = cleanString(url.searchParams.get("OrderMerchantReference"));
  if (tracking && reference) {
    const statusRes = await pesapalTransactionStatus(tracking);
    const order = await findOrderByReference(reference);
    if (order && isPesapalPaymentSuccessful(statusRes)) {
      await markOrderPaid(order, tracking);
      return jsonResponse({ status: "acknowledged", type: "order" });
    }
    const registration = await findRegistrationByReference(reference);
    if (registration && isPesapalPaymentSuccessful(statusRes)) {
      await markRegistrationPaid(registration, tracking);
      return jsonResponse({ status: "acknowledged", type: "event_registration" });
    }
  }
  return jsonResponse({ status: "acknowledged" });
};

const handleInitiateEventPayment = async (request: Request, registrationId: string) => {
  const { profile } = await requireProfile(request);
  const url = getUrl(request);
  const email = cleanString(url.searchParams.get("email")) || cleanString(profile.email);
  const phone = cleanString(url.searchParams.get("phone")) || cleanString(profile.phone_number) || "0700000000";
  const registration = await selectSingle("registrations", registrationId, "Registration");
  if (cleanString(registration.user_id) !== cleanString(profile.id) && !isAdminProfile(profile)) {
    throw new Response("Not authorized", { status: 403 });
  }
  if (normalizeStatus(registration.status) === "waitlisted") return errorResponse("Waitlisted registrations cannot be paid until a slot is available.");
  if (asNumber(registration.amount) <= 0) {
    const { error } = await supabaseAdmin
      .from("registrations")
      .update({
        status: "registered",
        payment_status: "free",
        ticket_token: registration.ticket_token || crypto.randomUUID(),
        updated_at: nowIso(),
      })
      .eq("id", registration.id);
    if (error) throw error;
    return jsonResponse({ message: "This event is free", payment_success: true, registration_status: "registered" });
  }
  if (normalizeStatus(registration.payment_status) === "paid") {
    return jsonResponse({ message: "Payment already confirmed", payment_success: true, registration_status: registration.status });
  }
  const event = await selectSingle("events", cleanString(registration.event_id), "Event");
  const token = await pesapalToken();
  const ipnId = await pesapalRegisterIpn(token, request);
  const reference = cleanString(registration.pesapal_merchant_reference) || cleanString(registration.id);
  const { error: refError } = await supabaseAdmin
    .from("registrations")
    .update({ pesapal_merchant_reference: reference, payment_status: "pending", updated_at: nowIso() })
    .eq("id", registration.id);
  if (refError) throw refError;

  const checkout = await pesapalSubmitOrder(token, request, {
    reference,
    amount: asNumber(registration.amount),
    description: `Lovedogs 360 - Event ticket: ${cleanString(event.title)}`,
    email,
    phone,
    ipnId,
    currency: cleanString(registration.currency) || cleanString(event.currency) || "KES",
  });
  const trackingId = cleanString(checkout.order_tracking_id ?? checkout.OrderTrackingId);
  if (trackingId) {
    const { error } = await supabaseAdmin.from("registrations").update({ pesapal_tracking_id: trackingId, updated_at: nowIso() }).eq("id", registration.id);
    if (error) throw error;
  }
  return jsonResponse(checkout);
};

const handleEventPaymentStatus = async (request: Request, registrationId: string) => {
  const { profile } = await requireProfile(request);
  const url = getUrl(request);
  const registration = await selectSingle("registrations", registrationId, "Registration");
  if (cleanString(registration.user_id) !== cleanString(profile.id) && !isAdminProfile(profile)) {
    throw new Response("Not authorized", { status: 403 });
  }

  let statusRes: JsonRecord | null = null;
  let paymentSuccess = normalizeStatus(registration.payment_status) === "paid";
  const tracking = cleanString(url.searchParams.get("tracking_id")) || cleanString(registration.pesapal_tracking_id);
  if (tracking && !paymentSuccess) {
    statusRes = await pesapalTransactionStatus(tracking);
    if (isPesapalPaymentSuccessful(statusRes)) {
      await markRegistrationPaid(registration, tracking);
      paymentSuccess = true;
    }
  }
  return jsonResponse({
    registration_id: registration.id,
    registration_status: paymentSuccess ? "registered" : registration.status,
    payment_status: paymentSuccess ? "paid" : registration.payment_status,
    payment_success: paymentSuccess,
    pesapal_tracking_id: tracking || registration.pesapal_tracking_id,
    pesapal_merchant_reference: registration.pesapal_merchant_reference,
    status: statusRes,
  });
};

const handleAdminAnalytics = async (request: Request) => {
  await requireAdminProfile(request);
  const [users, services, cases, events, orders, tickets, messages] = await Promise.all([
    getRows("users"),
    getRows("services"),
    getRows("case_reports"),
    getRows("events"),
    getRows("orders"),
    getRows("support_tickets"),
    getRows("community_messages"),
  ]);
  const paidOrders = orders.filter((order) => isPaidOrderStatus(order.status));
  const totalRevenue = paidOrders.reduce((sum, order) => sum + asNumber(order.amount), 0);
  const totalCommission = paidOrders.reduce((sum, order) => sum + asNumber(order.commission), 0);
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
  const inRange = (row: JsonRecord, start: number, end = Date.now()) => {
    const time = Date.parse(cleanString(row.created_at));
    return Number.isFinite(time) && time >= start && time < end;
  };
  const groupCount = (rows: JsonRecord[], key: string) => rows.reduce((acc: Record<string, number>, row) => {
    const value = cleanString(row[key]) || "unknown";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
  return jsonResponse({
    total_users: users.filter((user) => !user.deleted_at).length,
    total_services: services.length,
    total_orders: orders.length,
    total_events: events.length,
    total_cases: cases.length,
    total_paid_orders: paidOrders.length,
    total_revenue: Math.round(totalRevenue * 100) / 100,
    total_commission: Math.round(totalCommission * 100) / 100,
    new_users_30d: users.filter((user) => inRange(user, thirtyDaysAgo)).length,
    new_users_prev_30d: users.filter((user) => inRange(user, sixtyDaysAgo, thirtyDaysAgo)).length,
    new_paid_orders_30d: paidOrders.filter((order) => inRange(order, thirtyDaysAgo)).length,
    new_paid_orders_prev_30d: paidOrders.filter((order) => inRange(order, sixtyDaysAgo, thirtyDaysAgo)).length,
    revenue_30d: paidOrders.filter((order) => inRange(order, thirtyDaysAgo)).reduce((sum, order) => sum + asNumber(order.amount), 0),
    revenue_prev_30d: paidOrders.filter((order) => inRange(order, sixtyDaysAgo, thirtyDaysAgo)).reduce((sum, order) => sum + asNumber(order.amount), 0),
    pending_services: services.filter((service) => !service.admin_approved && !service.rejection_reason).length,
    pending_reports: cases.filter((report) => !report.is_approved && !report.rejection_reason).length,
    open_tickets: tickets.filter((ticket) => supportStatusKey(ticket.status) !== "resolved").length,
    flagged_posts: messages.filter((message) => asNumber(message.flag_count) > 0).length,
    open_cases: cases.filter((report) => normalizeStatus(report.status) === "open").length,
    users_by_role: groupCount(users, "role"),
    orders_by_status: groupCount(orders, "status"),
    services_by_type: groupCount(services, "item_type"),
    cases_by_type: groupCount(cases, "case_type"),
    users: users.length,
    services: services.length,
    cases: cases.length,
    events: events.length,
    orders: orders.length,
  });
};

const getRows = async (table: string, select = "*") => {
  const { data, error } = await supabaseAdmin.from(table).select(select);
  if (error) throw error;
  return (data ?? []) as JsonRecord[];
};

const fetchUserFull = async (userId: unknown) => {
  const id = cleanString(userId);
  if (!id) return null;
  const { data, error } = await supabaseAdmin.from("users").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as JsonRecord | null;
};

const getActivePinRows = async () => {
  const { data, error } = await supabaseAdmin
    .from("content_pins")
    .select("*")
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const now = Date.now();
  return ((data ?? []) as JsonRecord[]).filter((pin) => {
    const expiresAt = cleanString(pin.expires_at);
    return !expiresAt || new Date(expiresAt).getTime() > now;
  });
};

const getActivePins = async () => {
  const pins = await getActivePinRows();
  const map = new Map<string, JsonRecord>();
  for (const pin of pins) {
    map.set(`${cleanString(pin.target_type)}:${cleanString(pin.target_id)}`, pin);
  }
  return map;
};

const pinMetadata = (pin: JsonRecord | undefined | null) => ({
  is_pinned: Boolean(pin),
  pin_priority: pin?.priority ?? null,
});

const sortPinnedFirst = (items: JsonRecord[], fallbackDateKey = "created_at") => (
  [...items].sort((a, b) => {
    const aPinned = Boolean(a.is_pinned);
    const bPinned = Boolean(b.is_pinned);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    const priorityDiff = asNumber(b.pin_priority) - asNumber(a.pin_priority);
    if (priorityDiff !== 0) return priorityDiff;
    const aTime = new Date(cleanString(a[fallbackDateKey])).getTime();
    const bTime = new Date(cleanString(b[fallbackDateKey])).getTime();
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  })
);

const serializeAdminOrder = async (order: JsonRecord) => {
  const service = order.service_id ? await selectSingle("services", cleanString(order.service_id), "Service").catch(() => null) : null;
  const buyer = await fetchUserFull(order.buyer_id);
  const provider = service ? await fetchUserFull(service.provider_id) : null;
  const status = normalizeStatus(order.status) || "pending";
  const isPaid = isPaidOrderStatus(status);
  return {
    id: order.id,
    buyer_name: buyer?.full_name ?? "Unknown",
    buyer_email: buyer?.email ?? "",
    buyer_phone: buyer?.phone_number ?? null,
    buyer_id: order.buyer_id,
    provider_name: provider?.full_name ?? "Unknown",
    provider_id: service?.provider_id ?? null,
    service_title: service?.title ?? "Unknown",
    service_id: order.service_id,
    item_type: service?.item_type ?? null,
    amount: asNumber(order.amount),
    commission: asNumber(order.commission),
    payout: asNumber(order.payout),
    discount_amount: asNumber(order.discount_amount),
    karma_points_redeemed: asNumber(order.karma_points_redeemed),
    paid_amount: isPaid ? asNumber(order.amount) : 0,
    paid_commission: isPaid ? asNumber(order.commission) : 0,
    paid_payout: isPaid ? asNumber(order.payout) : 0,
    status,
    is_paid: isPaid,
    share_phone: Boolean(order.share_phone),
    service_stock_count: service?.stock_count ?? null,
    service_slots_available: service?.slots_available ?? null,
    form_responses: [],
    created_at: order.created_at ?? null,
  };
};

const handleAdminUsers = async (request: Request) => {
  await requireAdminProfile(request);
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = await Promise.all((data ?? []).map(async (user) => {
    const row = user as JsonRecord;
    const userId = cleanString(row.id);
    const [dogCount, listingCount, orderCount] = await Promise.all([
      countRows("dogs", "owner_id", userId),
      countRows("services", "provider_id", userId),
      countRows("orders", "buyer_id", userId),
    ]);
    return {
      ...serializeUser(row),
      phone_number: row.phone_number ?? null,
      country: row.country ?? null,
      preferred_currency: row.preferred_currency ?? null,
      is_suspended: normalizeStatus(row.role) === "suspended",
      pre_suspension_role: row.pre_suspension_role ?? null,
      suspended_at: row.suspended_at ?? null,
      suspension_ends_at: row.suspension_ends_at ?? null,
      suspension_reason: row.suspension_reason ?? null,
      dog_count: dogCount,
      listing_count: listingCount,
      order_count: orderCount,
      paid_order_count: 0,
      created_at: row.created_at ?? null,
    };
  }));
  return jsonResponse(rows);
};

const suspensionEndDate = (body: JsonRecord) => {
  const value = Math.max(1, asNumber(body.duration_value, 7));
  const unit = cleanString(body.duration_unit) || "days";
  const hours = unit === "hours" ? value : unit === "weeks" ? value * 7 * 24 : value * 24;
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
};

const handleSuspendUser = async (request: Request, userId: string) => {
  const { profile } = await requireAdminProfile(request);
  if (userId === cleanString(profile.id)) return errorResponse("Admins cannot suspend their own account.");
  const user = await selectSingle("users", userId, "User");
  if (isAdminProfile(user)) return errorResponse("Admin accounts cannot be suspended from this panel.");
  const body = await readJson(request);
  const reason = cleanString(body.reason) || "Account suspended by admin";
  const { error } = await supabaseAdmin.from("users").update({
    pre_suspension_role: cleanString(user.role) || "buyer",
    role: "suspended",
    suspended_at: nowIso(),
    suspension_ends_at: suspensionEndDate(body),
    suspension_reason: reason,
    suspended_by_id: cleanString(profile.id),
    updated_at: nowIso(),
  }).eq("id", userId);
  if (error) throw error;
  await createNotification(userId, "Account suspended", `Your account has been suspended. Reason: ${reason}`, "moderation");
  return jsonResponse({ message: `User ${cleanString(user.email)} suspended`, reason });
};

const handleUnsuspendUser = async (request: Request, userId: string) => {
  await requireAdminProfile(request);
  const user = await selectSingle("users", userId, "User");
  const role = cleanString(user.pre_suspension_role) || "buyer";
  const { error } = await supabaseAdmin.from("users").update({
    role,
    pre_suspension_role: null,
    suspended_at: null,
    suspension_ends_at: null,
    suspension_reason: null,
    suspended_by_id: null,
    updated_at: nowIso(),
  }).eq("id", userId);
  if (error) throw error;
  await createNotification(userId, "Account restored", "Your account suspension has been lifted by an admin.", "moderation");
  return jsonResponse({ message: `User ${cleanString(user.email)} restored`, role });
};

const handleUpdateUserRole = async (request: Request, userId: string) => {
  const { profile } = await requireSuperAdminProfile(request);
  if (userId === cleanString(profile.id)) return errorResponse("You cannot change your own role from this panel.");

  const body = await readJson(request);
  const nextRole = cleanString(body.role);
  const allowedRoles = new Set(["buyer", "provider", "admin"]);
  if (!allowedRoles.has(nextRole)) {
    return errorResponse("Choose buyer, provider, or admin. Super admin changes must be made directly in Supabase.");
  }

  const user = await selectSingle("users", userId, "User");
  const previousRole = cleanString(user.role) || "buyer";
  if (previousRole === "super_admin") {
    return errorResponse("Super admin accounts can only be changed directly in Supabase.");
  }
  if (previousRole === "suspended") {
    return errorResponse("Restore this user before changing their role.");
  }
  if (previousRole === nextRole) {
    return jsonResponse({ message: `User is already ${nextRole}.`, role: nextRole });
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .update({
      role: nextRole,
      pre_suspension_role: null,
      updated_at: nowIso(),
    })
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;

  const { error: auditError } = await supabaseAdmin.from("audit_logs").insert({
    user_id: cleanString(profile.id),
    action: "update_user_role",
    target_type: "user",
    target_id: userId,
    details: JSON.stringify({
      email: cleanString(user.email),
      previous_role: previousRole,
      new_role: nextRole,
    }),
  });
  if (auditError) console.error("Role update audit log failed", auditError);

  await createNotification(
    userId,
    "Account role updated",
    `Your Lovedogs 360 account role was changed from ${previousRole} to ${nextRole}.`,
    "moderation",
  );

  return jsonResponse({
    message: `User ${cleanString(user.email)} changed from ${previousRole} to ${nextRole}.`,
    user: serializeUser(data as JsonRecord),
    previous_role: previousRole,
    role: nextRole,
  });
};

const handleAdminOrders = async (request: Request) => {
  await requireAdminProfile(request);
  const { data, error } = await supabaseAdmin.from("orders").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return jsonResponse(await Promise.all((data ?? []).map((order) => serializeAdminOrder(order as JsonRecord))));
};

const handleAdminCompleteOrder = async (request: Request, orderId: string) => {
  await requireAdminProfile(request);
  const order = await selectSingle("orders", orderId, "Order");
  if (normalizeStatus(order.status) !== "paid") return errorResponse(`Order must be in 'paid' status to mark as completed. Current status: ${order.status}`);
  const { error } = await supabaseAdmin.from("orders").update({ status: "completed", updated_at: nowIso() }).eq("id", orderId);
  if (error) throw error;
  return jsonResponse({ message: "Order marked as completed. Seller earnings are ready for payout request.", status: "completed" });
};

const handleAdminSettleOrder = async (request: Request, orderId: string) => {
  await requireAdminProfile(request);
  const order = await selectSingle("orders", orderId, "Order");
  if (normalizeStatus(order.status) !== "completed") return errorResponse(`Order must be in 'completed' status to settle. Current status: ${order.status}`);
  const service = await selectSingle("services", cleanString(order.service_id), "Service");
  const { error: txError } = await supabaseAdmin.from("transactions").insert({
    order_id: orderId,
    user_id: service.provider_id,
    amount: asNumber(order.payout),
    type: "payout",
    status: "completed",
    processed_at: nowIso(),
  });
  if (txError) throw txError;
  const { error } = await supabaseAdmin.from("orders").update({ status: "settled", updated_at: nowIso() }).eq("id", orderId);
  if (error) throw error;
  return jsonResponse({ message: `Payout of KES ${asNumber(order.payout).toLocaleString()} approved and settled for provider.`, status: "settled", payout_amount: asNumber(order.payout) });
};

const serializeWithdrawal = async (tx: JsonRecord) => {
  const seller = await fetchUserFull(tx.user_id);
  return {
    id: tx.id,
    seller_id: tx.user_id,
    seller_name: seller?.full_name ?? "Unknown",
    seller_email: seller?.email ?? null,
    amount: asNumber(tx.amount),
    status: cleanString(tx.status) || "pending",
    method: tx.payout_method ?? null,
    destination: tx.destination ?? null,
    created_at: tx.created_at ?? null,
    processed_at: tx.processed_at ?? null,
  };
};

const handleWithdrawals = async (request: Request, admin = false) => {
  const { profile } = admin ? await requireAdminProfile(request) : await requireProfile(request);
  let query = supabaseAdmin.from("transactions").select("*").eq("type", "withdrawal").order("created_at", { ascending: false });
  if (!admin) query = query.eq("user_id", cleanString(profile.id));
  const { data, error } = await query;
  if (error) throw error;
  return jsonResponse(await Promise.all((data ?? []).map((tx) => serializeWithdrawal(tx as JsonRecord))));
};

const providerCompletedPayout = async (userId: string) => {
  const { data: services, error: serviceError } = await supabaseAdmin.from("services").select("id").eq("provider_id", userId);
  if (serviceError) throw serviceError;
  const serviceIds = (services ?? []).map((service) => cleanString((service as JsonRecord).id)).filter(Boolean);
  if (!serviceIds.length) return 0;
  const { data, error } = await supabaseAdmin.from("orders").select("payout").in("service_id", serviceIds).eq("status", "completed");
  if (error) throw error;
  return (data ?? []).reduce((sum, order) => sum + asNumber((order as JsonRecord).payout), 0);
};

const handleRequestWithdrawal = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const body = await readJson(request);
  const userId = cleanString(profile.id);
  const available = await providerCompletedPayout(userId);
  const amount = Math.round(asNumber(body.amount, available) * 100) / 100;
  const method = cleanString(body.method) || cleanString(profile.payment_method);
  const destination = method === "mpesa" ? cleanString(profile.mpesa_phone_number) : method ? "Pesapal card/bank payout" : "";
  if (amount <= 0 || amount > available) return errorResponse("Payout request exceeds completed seller earnings.");
  if (!["mpesa", "card"].includes(method)) return errorResponse("Set a payout method first.");
  if (method === "mpesa" && !destination) return errorResponse("Add your M-Pesa phone number before requesting payout.");

  const { data, error } = await supabaseAdmin.from("transactions").insert({
    user_id: userId,
    amount,
    type: "withdrawal",
    status: "pending",
    payout_method: method,
    destination,
  }).select("*").single();
  if (error) throw error;
  return jsonResponse({ message: "Payout request submitted", withdrawal_id: data.id, amount, status: "pending", withdrawal: await serializeWithdrawal(data as JsonRecord) });
};

const handleCompleteWithdrawal = async (request: Request, withdrawalId: string) => {
  await requireAdminProfile(request);
  const tx = await selectSingle("transactions", withdrawalId, "Payout request");
  if (cleanString(tx.type) !== "withdrawal") return notFound("Payout request");
  if (normalizeStatus(tx.status) !== "pending") return errorResponse(`Payout request is already ${tx.status}`);
  const { error } = await supabaseAdmin.from("transactions").update({ status: "completed", processed_at: nowIso() }).eq("id", withdrawalId);
  if (error) throw error;
  return jsonResponse({ message: "Payout request marked as completed", withdrawal_id: withdrawalId, status: "completed" });
};

const serializeAdminService = async (service: JsonRecord) => {
  const provider = await fetchUserFull(service.provider_id);
  return {
    ...service,
    provider_name: provider?.full_name ?? "Unknown",
    provider_email: provider?.email ?? null,
    paid_order_count: 0,
    pending_order_count: 0,
    paid_revenue: 0,
  };
};

const handleAdminServices = async (request: Request) => {
  await requireAdminProfile(request);
  const { data, error } = await supabaseAdmin.from("services").select("*").order("title", { ascending: true });
  if (error) throw error;
  return jsonResponse(await Promise.all((data ?? []).map((service) => serializeAdminService(service as JsonRecord))));
};

const handleAdminDeleteService = async (request: Request, serviceId: string) => {
  await requireAdminProfile(request);
  const orderCount = await countRows("orders", "service_id", serviceId);
  if (orderCount > 0) {
    const { error } = await supabaseAdmin
      .from("services")
      .update({ is_published: false, admin_approved: false, rejection_reason: "Deleted by admin", updated_at: nowIso() })
      .eq("id", serviceId);
    if (error) throw error;
    return jsonResponse({ message: "Listing removed from public view. Order history was retained.", archived: true, order_count: orderCount });
  }
  const { error } = await supabaseAdmin.from("services").delete().eq("id", serviceId);
  if (error) throw error;
  return jsonResponse({ message: "Marketplace listing deleted", archived: false });
};

const handleAdminPendingApprovals = async (request: Request) => {
  await requireAdminProfile(request);
  const [services, reports] = await Promise.all([
    supabaseAdmin.from("services").select("*").eq("admin_approved", false).is("rejection_reason", null).order("title", { ascending: true }),
    supabaseAdmin.from("case_reports").select("*").eq("is_approved", false).is("rejection_reason", null).order("created_at", { ascending: false }),
  ]);
  if (services.error) throw services.error;
  if (reports.error) throw reports.error;
  return jsonResponse({
    pending_services: await Promise.all((services.data ?? []).map((service) => serializeAdminService(service as JsonRecord))),
    pending_reports: await Promise.all((reports.data ?? []).map(async (report) => {
      const author = await fetchUserFull((report as JsonRecord).author_id);
      return {
        ...report,
        author_name: author?.full_name ?? "Unknown",
        author_email: author?.email ?? null,
      };
    })),
  });
};

const handleAdminApprove = async (request: Request, itemType: string, itemId: string) => {
  await requireAdminProfile(request);
  const body = await readJson(request);
  const isApproved = Boolean(body.is_approved);
  const reason = cleanString(body.rejection_reason) || null;
  if (itemType === "service") {
    const { error } = await supabaseAdmin
      .from("services")
      .update({ admin_approved: isApproved, rejection_reason: isApproved ? null : reason, updated_at: nowIso() })
      .eq("id", itemId);
    if (error) throw error;
    return jsonResponse({ message: isApproved ? "Service approved" : "Service rejected" });
  }
  if (itemType === "report") {
    const { error } = await supabaseAdmin
      .from("case_reports")
      .update({ is_approved: isApproved, rejection_reason: isApproved ? null : reason, updated_at: nowIso() })
      .eq("id", itemId);
    if (error) throw error;
    return jsonResponse({ message: isApproved ? "Report approved" : "Report rejected" });
  }
  return errorResponse("Unsupported approval item type.");
};

const handleAdminCasesDelete = async (request: Request, reportId: string) => {
  await requireAdminProfile(request);
  const { error } = await supabaseAdmin.from("case_reports").delete().eq("id", reportId);
  if (error) throw error;
  return jsonResponse({ message: "Case report deleted" });
};

const handleAdminDogs = async (request: Request) => {
  await requireAdminProfile(request);
  const { data, error } = await supabaseAdmin.from("dogs").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return jsonResponse(await Promise.all((data ?? []).map(async (dog) => {
    const owner = await fetchUserFull((dog as JsonRecord).owner_id);
    return { ...dog, owner_name: owner?.full_name ?? "Unknown", owner_email: owner?.email ?? null };
  })));
};

const handleAdminDeleteDog = async (request: Request, dogId: string) => {
  await requireAdminProfile(request);
  const { error } = await supabaseAdmin.from("dogs").delete().eq("id", dogId);
  if (error) throw error;
  return jsonResponse({ message: "Pet registry entry deleted" });
};

const adminEventRow = async (event: JsonRecord, pins?: Map<string, JsonRecord>) => ({
  ...event,
  images: asStringArray(event.images),
  registrant_count: await countRows("registrations", "event_id", cleanString(event.id)),
  ...pinMetadata(pins?.get(`event:${cleanString(event.id)}`)),
});

const handleAdminEvents = async (request: Request) => {
  await requireAdminProfile(request);
  const pins = await getActivePins();
  const { data, error } = await supabaseAdmin.from("events").select("*").order("start_time", { ascending: true });
  if (error) throw error;
  return jsonResponse(await Promise.all((data ?? []).map((event) => adminEventRow(event as JsonRecord, pins))));
};

const handleAdminUpdateEvent = async (request: Request, eventId: string, mode: "ticketing" | "schedule" | "scorecard") => {
  await requireAdminProfile(request);
  const body = await readJson(request);
  const updates: JsonRecord = { updated_at: nowIso() };
  if (mode === "ticketing") {
    updates.ticket_price = asNumber(body.ticket_price);
    updates.currency = cleanString(body.currency) || "KES";
    updates.ticket_tiers = body.ticket_tiers ?? [];
    updates.attendee_type_question = body.attendee_type_question ?? null;
  } else if (mode === "schedule") {
    updates.available_slots = asArray(body.available_slots);
  } else {
    updates.scorecard_enabled = asBoolean(body.scorecard_enabled, true);
    updates.scorecard_title = body.scorecard_title ?? null;
    updates.scorecard_description = body.scorecard_description ?? null;
  }
  const { data, error } = await supabaseAdmin.from("events").update(updates).eq("id", eventId).select("*").single();
  if (error) throw error;
  return jsonResponse(await adminEventRow(data as JsonRecord));
};

const handleAdminDeleteEvent = async (request: Request, eventId: string) => {
  await requireAdminProfile(request);
  const { error } = await supabaseAdmin.from("events").delete().eq("id", eventId);
  if (error) throw error;
  return jsonResponse({ message: "Event deleted" });
};

const handleVerifyTicket = async (request: Request) => {
  await requireAdminProfile(request);
  const token = cleanString(getUrl(request).searchParams.get("token"));
  const { data, error } = await supabaseAdmin.from("registrations").select("*").eq("ticket_token", token).maybeSingle();
  if (error) throw error;
  if (!data) return notFound("Ticket");
  const registration = data as JsonRecord;
  const [user, event] = await Promise.all([fetchUserFull(registration.user_id), selectSingle("events", cleanString(registration.event_id), "Event")]);
  return jsonResponse({
    valid: true,
    checked_in: Boolean(registration.check_in_time),
    check_in_time: registration.check_in_time ?? null,
    registration_status: registration.status,
    user_name: user?.full_name ?? "Unknown",
    user_email: user?.email ?? null,
    event_title: event.title,
    role: registration.role,
  });
};

const handleCheckInTicket = async (request: Request) => {
  await requireAdminProfile(request);
  const token = cleanString(getUrl(request).searchParams.get("token"));
  const { data, error } = await supabaseAdmin.from("registrations").select("*").eq("ticket_token", token).maybeSingle();
  if (error) throw error;
  if (!data) return notFound("Ticket");
  if ((data as JsonRecord).check_in_time) return errorResponse("Ticket has already been used.");
  const time = nowIso();
  const { error: updateError } = await supabaseAdmin.from("registrations").update({ check_in_time: time, status: "checked-in", updated_at: time }).eq("id", (data as JsonRecord).id);
  if (updateError) throw updateError;
  return jsonResponse({ message: "Success", checked_in: true, time });
};

const serializeSupportTicket = async (ticket: JsonRecord) => {
  const user = await fetchUserFull(ticket.user_id);
  return {
    ...ticket,
    status_key: supportStatusKey(ticket.status),
    status: supportStatusLabel(ticket.status),
    user_name: user?.full_name ?? "Unknown",
    user_email: user?.email ?? null,
  };
};

const handleAdminSupportTickets = async (request: Request) => {
  await requireAdminProfile(request);
  const { data, error } = await supabaseAdmin.from("support_tickets").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return jsonResponse(await Promise.all((data ?? []).map((ticket) => serializeSupportTicket(ticket as JsonRecord))));
};

const handleAdminSupportReply = async (request: Request, ticketId: string) => {
  await requireAdminProfile(request);
  const body = await readJson(request);
  const message = cleanString(body.message || body.admin_reply);
  if (!message) return errorResponse("Reply message is required.");
  const { data, error } = await supabaseAdmin
    .from("support_tickets")
    .update({ admin_reply: message, status: "in-progress", updated_at: nowIso() })
    .eq("id", ticketId)
    .select("*")
    .single();
  if (error) throw error;
  await createNotification((data as JsonRecord).user_id, "Support Ticket Reply", `An admin replied to your ticket: ${message}`, "support");
  return jsonResponse({ message: "Reply sent", ticket: data });
};

const handleAdminSupportResolve = async (request: Request, ticketId: string) => {
  await requireAdminProfile(request);
  const { error } = await supabaseAdmin.from("support_tickets").update({ status: "resolved", updated_at: nowIso() }).eq("id", ticketId);
  if (error) throw error;
  return jsonResponse({ message: "Ticket resolved" });
};

const handleAdminCommunity = async (request: Request) => {
  await requireAdminProfile(request);
  const pins = await getActivePins();
  const { data, error } = await supabaseAdmin.from("community_messages").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return jsonResponse(await Promise.all((data ?? []).map(async (message) => ({
    ...message,
    title: cleanString((message as JsonRecord).content).slice(0, 80),
    description: (message as JsonRecord).content,
    author: await fetchAuthor((message as JsonRecord).author_id),
    ...pinMetadata(pins.get(`community:${cleanString((message as JsonRecord).id)}`)),
  }))));
};

const handleAdminCommunityHide = async (request: Request, postId: string) => {
  await requireAdminProfile(request);
  const { error } = await supabaseAdmin.from("community_messages").update({ is_hidden: true, updated_at: nowIso() }).eq("id", postId);
  if (error) throw error;
  return jsonResponse({ message: "Community post hidden" });
};

const handleAdminCommunityDelete = async (request: Request, postId: string) => {
  await requireAdminProfile(request);
  const { error } = await supabaseAdmin.from("community_messages").delete().eq("id", postId);
  if (error) throw error;
  return jsonResponse({ message: "Community post deleted" });
};

const handleAdminPinsCreate = async (request: Request) => {
  const { profile } = await requireAdminProfile(request);
  const body = await readJson(request);
  const targetType = cleanString(body.target_type);
  const targetId = cleanString(body.target_id);
  if (!targetType || !targetId) return errorResponse("target_type and target_id are required.");
  const { data, error } = await supabaseAdmin
    .from("content_pins")
    .upsert({
      target_type: targetType,
      target_id: targetId,
      title: cleanString(body.title) || "Pinned content",
      description: body.description ?? null,
      image_url: body.image_url ?? null,
      priority: asNumber(body.priority, 100),
      is_active: true,
      created_by_id: cleanString(profile.id),
      updated_at: nowIso(),
    }, { onConflict: "target_type,target_id" })
    .select("*")
    .single();
  if (error) throw error;
  return jsonResponse(data, 201);
};

const handleAdminPinDelete = async (request: Request, targetType: string, targetId: string) => {
  await requireAdminProfile(request);
  const { error } = await supabaseAdmin.from("content_pins").delete().eq("target_type", targetType).eq("target_id", targetId);
  if (error) throw error;
  return jsonResponse({ message: "Pin removed" });
};

const handlePinnableContent = async (request: Request) => {
  await requireAdminProfile(request);
  const pins = await getActivePins();
  const [events, services, cases, community] = await Promise.all([
    getRows("events"),
    getRows("services"),
    getRows("case_reports"),
    getRows("community_messages"),
  ]);
  const row = (item: JsonRecord, type: string, title: unknown, description: unknown, meta: string) => ({
    id: item.id,
    title: cleanString(title) || "Untitled",
    description: cleanString(description),
    meta,
    ...pinMetadata(pins.get(`${type}:${cleanString(item.id)}`)),
  });
  const publishedEvents = events.filter((item) => asNumber(item.is_public, 1) === 1);
  const publishedServices = services.filter((item) => Boolean(item.is_published) && Boolean(item.admin_approved));
  const publishedCases = cases.filter((item) => Boolean(item.is_approved));
  const visibleCommunity = community.filter((item) => !Boolean(item.is_hidden));
  return jsonResponse({
    events: publishedEvents.map((item) => row(item, "event", item.title, item.description, cleanString(item.location) || "Event")),
    services: publishedServices.map((item) => row(item, "service", item.title, item.description, cleanString(item.category) || "Marketplace")),
    cases: publishedCases.map((item) => row(item, "case", item.title, item.description, cleanString(item.case_type) || "Case")),
    community: visibleCommunity.map((item) => row(item, "community", cleanString(item.content).slice(0, 80), item.content, "Community")),
  });
};

const campaignRecipients = async (payload: JsonRecord) => {
  const targetGroup = cleanString(payload.target_group);
  const filters = isRecord(payload.filters) ? payload.filters : {};
  if (targetGroup === "event_registrants" && filters.event_id) {
    const { data, error } = await supabaseAdmin.from("registrations").select("user_id").eq("event_id", cleanString(filters.event_id));
    if (error) throw error;
    return [...new Set((data ?? []).map((row) => cleanString((row as JsonRecord).user_id)).filter(Boolean))];
  }
  if (targetGroup === "role_users") {
    let query = supabaseAdmin.from("users").select("id").is("deleted_at", null);
    if (filters.role && cleanString(filters.role) !== "all") query = query.eq("role", cleanString(filters.role));
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => cleanString((row as JsonRecord).id)).filter(Boolean);
  }
  const { data, error } = await supabaseAdmin.from("users").select("id").is("deleted_at", null);
  if (error) throw error;
  return (data ?? []).map((row) => cleanString((row as JsonRecord).id)).filter(Boolean);
};

const handleNotificationOptions = async (request: Request) => {
  await requireAdminProfile(request);
  const events = await getRows("events");
  return jsonResponse({
    target_groups: [
      { id: "event_registrants", label: "Event registrants" },
      { id: "role_users", label: "Users by role" },
      { id: "case_reporters", label: "Case reporters" },
      { id: "listing_publishers", label: "Listing publishers" },
      { id: "product_publishers", label: "Product publishers" },
      { id: "sellers_with_sales", label: "Sellers with sales" },
    ],
    roles: ["buyer", "provider", "admin", "super_admin"],
    events: events.map((event) => ({ id: event.id, title: event.title })),
    case_types: ["lost_dog", "found_dog", "rabies_bite", "vehicle_hit", "injured_stray", "abuse", "other"],
    case_statuses: ["open", "resolved", "closed"],
    item_types: ["services", "products"],
    registration_statuses: ["registered", "pending_payment", "waitlisted", "checked-in"],
    payment_statuses: ["free", "pending", "paid"],
  });
};

const handleNotificationCampaigns = async (request: Request) => {
  await requireAdminProfile(request);
  const { data, error } = await supabaseAdmin.from("notification_campaigns").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return jsonResponse(data ?? []);
};

const handleNotificationPreview = async (request: Request) => {
  await requireAdminProfile(request);
  const body = await readJson(request);
  const recipients = await campaignRecipients(body);
  return jsonResponse({ recipient_count: recipients.length });
};

const handleNotificationSend = async (request: Request) => {
  const { profile } = await requireAdminProfile(request);
  const body = await readJson(request);
  const title = cleanString(body.title);
  const message = cleanString(body.message);
  if (!title || !message) return errorResponse("Title and message are required.");
  const recipients = await campaignRecipients(body);
  const { data: campaign, error } = await supabaseAdmin.from("notification_campaigns").insert({
    title,
    message,
    target_group: cleanString(body.target_group) || "role_users",
    filters: isRecord(body.filters) ? body.filters : {},
    type: cleanString(body.type) || "admin_broadcast",
    recipient_count: recipients.length,
    created_by_id: cleanString(profile.id),
  }).select("*").single();
  if (error) throw error;
  if (recipients.length) {
    const notifications = recipients.map((userId) => ({ user_id: userId, title, message, type: "admin_broadcast" }));
    const { data: inserted, error: notificationError } = await supabaseAdmin.from("notifications").insert(notifications).select("id,user_id");
    if (notificationError) throw notificationError;
    const rows = (inserted ?? []).map((notification) => ({
      campaign_id: (campaign as JsonRecord).id,
      user_id: cleanString((notification as JsonRecord).user_id),
      notification_id: cleanString((notification as JsonRecord).id),
    }));
    if (rows.length) {
      const { error: recipientError } = await supabaseAdmin.from("notification_campaign_recipients").insert(rows);
      if (recipientError) throw recipientError;
    }
  }
  return jsonResponse(campaign, 201);
};

const upsertProfile = async (authUser: JsonRecord, values: JsonRecord = {}) => {
  const metadata = (authUser.user_metadata as JsonRecord | undefined) ?? {};
  const provider =
    cleanString(values.auth_provider) ||
    cleanString(metadata.provider) ||
    cleanString((authUser.app_metadata as JsonRecord | undefined)?.provider) ||
    "email";

  const payload = {
    id: cleanString(authUser.id),
    email: cleanString(values.email) || cleanString(authUser.email),
    full_name:
      cleanString(values.full_name) ||
      cleanString(metadata.full_name) ||
      cleanString(metadata.name) ||
      cleanString(authUser.email),
    role: cleanString(values.role) || "buyer",
    auth_provider: provider,
    google_id: values.google_id ?? metadata.sub ?? null,
    phone_number: values.phone_number ?? null,
    country: values.country ?? null,
    language: cleanString(values.language) || "en",
    bio: values.bio ?? null,
    latitude: values.latitude ?? null,
    longitude: values.longitude ?? null,
    location_accuracy_meters: values.location_accuracy_meters ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("users")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) throw error;
  return data as JsonRecord;
};

const handleRegister = async (request: Request) => {
  const body = await readJson(request);
  const email = cleanString(body.email).toLowerCase();
  const password = cleanString(body.password);
  const requestedRole = cleanString(body.role);
  const publicRole = requestedRole === "provider" ? "provider" : "buyer";

  if (!email || !password) return errorResponse("Email and password are required.");
  if (password.length < 8) return errorResponse("Password must be at least 8 characters.");

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: cleanString(body.full_name),
      role: publicRole,
    },
  });

  if (error || !data.user) return errorResponse(error?.message || "Registration failed.", 400);

  const profile = await upsertProfile(data.user as unknown as JsonRecord, {
    email,
    full_name: body.full_name,
    role: publicRole,
    phone_number: body.phone_number,
    country: body.country,
    language: body.language,
    bio: body.bio,
    latitude: body.latitude,
    longitude: body.longitude,
    location_accuracy_meters: body.location_accuracy_meters,
    auth_provider: "email",
  });

  return jsonResponse(serializeUser(profile, data.user as unknown as JsonRecord), 201);
};

const handleToken = async (request: Request) => {
  const form = await readForm(request);
  const email = cleanString(form.get("username")).toLowerCase();
  const password = cleanString(form.get("password"));

  if (!email || !password) return errorResponse("Email and password are required.");

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    return errorResponse("Incorrect username or password", 401);
  }

  const profile = (await getProfile(data.user.id)) ?? await upsertProfile(data.user as unknown as JsonRecord, {
    email,
    auth_provider: "email",
  });

  return jsonResponse({
    access_token: data.session.access_token,
    token_type: "bearer",
    user: serializeUser(profile, data.user as unknown as JsonRecord),
  });
};

const handleGoogleLogin = async (request: Request) => {
  const body = await readJson(request);
  const idToken = cleanString(body.id_token);
  if (!idToken) return errorResponse("Google ID token is required.");

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });

  if (error || !data.session || !data.user) {
    return errorResponse(error?.message || "Invalid Google token", 401);
  }

  const profile = await upsertProfile(data.user as unknown as JsonRecord, {
    email: data.user.email,
    full_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name,
    auth_provider: "google",
    google_id: data.user.user_metadata?.sub,
  });

  return jsonResponse({
    access_token: data.session.access_token,
    token_type: "bearer",
    user: serializeUser(profile, data.user as unknown as JsonRecord),
  });
};

const handleGetMe = async (request: Request) => {
  const authUser = await getCurrentAuthUser(request);
  const profile = (await getProfile(authUser.id)) ?? await upsertProfile(authUser as unknown as JsonRecord);
  return jsonResponse(serializeUser(profile, authUser as unknown as JsonRecord));
};

const handleUpdateMe = async (request: Request) => {
  const authUser = await getCurrentAuthUser(request);
  const body = await readJson(request);
  const allowed = [
    "full_name",
    "phone_number",
    "country",
    "language",
    "profile_image",
    "bio",
    "latitude",
    "longitude",
    "location_accuracy_meters",
    "address",
    "expo_push_token",
    "timezone",
    "preferred_currency",
    "payment_method",
    "mpesa_phone_number",
  ];
  const updates: JsonRecord = { updated_at: new Date().toISOString() };

  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .update(updates)
    .eq("id", authUser.id)
    .select("*")
    .single();

  if (error) throw error;
  return jsonResponse(serializeUser(data as JsonRecord, authUser as unknown as JsonRecord));
};

const handleDeleteMe = async (request: Request) => {
  const authUser = await getCurrentAuthUser(request);

  const { error } = await supabaseAdmin
    .from("users")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", authUser.id);

  if (error) throw error;

  await supabaseAdmin.auth.admin.deleteUser(authUser.id);
  return jsonResponse({ message: "Your account has been deleted." });
};

const handlePasswordForgot = async (request: Request) => {
  const body = await readJson(request);
  const email = cleanString(body.email).toLowerCase();
  if (!email) return errorResponse("Email is required.");

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getPasswordResetRedirectUrl(),
  });
  if (error) return errorResponse(error.message, 400);

  return jsonResponse({ message: "If that email exists, a password reset link has been sent." });
};

const handlePasswordReset = async () => errorResponse(
  "Password reset confirmation is handled by the Supabase email link flow.",
  501,
);

const routeRequest = async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const path = getPath(request);
  const method = request.method.toUpperCase();

  if (method === "GET" && (path === "/" || path === "/health")) return jsonResponse({ status: "ok" });
  if (method === "POST" && path === "/register") return handleRegister(request);
  if (method === "POST" && path === "/token") return handleToken(request);
  if (method === "POST" && path === "/auth/google") return handleGoogleLogin(request);
  if (method === "GET" && path === "/users/me") return handleGetMe(request);
  if (method === "PUT" && path === "/users/me") return handleUpdateMe(request);
  if (method === "DELETE" && path === "/users/me") return handleDeleteMe(request);
  if (method === "POST" && path === "/password/forgot") return handlePasswordForgot(request);
  if (method === "POST" && path === "/password/reset") return handlePasswordReset();

  if (method === "GET" && path === "/exchange-rates") return handleExchangeRates();
  if (method === "GET" && path === "/my-dogs") return handleMyDogs(request);
  if (method === "POST" && (path === "/dogs" || path === "/dogs/")) return handleCreateDog(request);
  if (method === "POST" && path === "/dogs/identify") return jsonResponse([]);
  if (method === "POST" && path === "/dogs/report-lost") return handleCreateCase(request);
  if (/^\/dogs\/[^/]+\/health-records$/.test(path) && (method === "GET" || method === "POST")) {
    return handleDogHealthRecords(request, firstPathMatch(path, /^\/dogs\/([^/]+)\/health-records$/));
  }
  if (method === "GET" && /^\/dogs\/[^/]+$/.test(path)) return handleGetDog(request, firstPathMatch(path, /^\/dogs\/([^/]+)$/));
  if (method === "PUT" && /^\/dogs\/[^/]+$/.test(path)) return handleUpdateDog(request, firstPathMatch(path, /^\/dogs\/([^/]+)$/));

  if (method === "GET" && path === "/services") return handleListServices(request);
  if (method === "POST" && path === "/services") return handleCreateService(request);
  if (/^\/services\/[^/]+\/form-fields$/.test(path) && (method === "GET" || method === "POST")) {
    return handleServiceFormFields(request, firstPathMatch(path, /^\/services\/([^/]+)\/form-fields$/));
  }
  if (method === "GET" && /^\/services\/[^/]+\/responses$/.test(path)) return jsonResponse([]);
  if (method === "GET" && /^\/services\/[^/]+$/.test(path)) return handleGetService(request, firstPathMatch(path, /^\/services\/([^/]+)$/));
  if (method === "PUT" && /^\/services\/[^/]+$/.test(path)) return handleUpdateService(request, firstPathMatch(path, /^\/services\/([^/]+)$/));
  if (method === "DELETE" && /^\/services\/[^/]+$/.test(path)) return handleDeleteService(request, firstPathMatch(path, /^\/services\/([^/]+)$/));

  if (method === "GET" && path === "/cases") return handleListCases(request);
  if (method === "POST" && path === "/cases") return handleCreateCase(request);
  if (method === "GET" && /^\/cases\/[^/]+\/comments$/.test(path)) return handleCaseComments(request, firstPathMatch(path, /^\/cases\/([^/]+)\/comments$/));
  if (method === "POST" && /^\/cases\/[^/]+\/comments$/.test(path)) return handleCaseComments(request, firstPathMatch(path, /^\/cases\/([^/]+)\/comments$/));
  if (method === "POST" && /^\/cases\/[^/]+\/like$/.test(path)) return handleCaseLike(request, firstPathMatch(path, /^\/cases\/([^/]+)\/like$/));
  if (method === "GET" && /^\/cases\/[^/]+\/matches$/.test(path)) return jsonResponse([]);
  if (method === "POST" && /^\/cases\/[^/]+\/matches\/refresh$/.test(path)) return jsonResponse([]);
  if (method === "POST" && /^\/cases\/[^/]+\/matches\/[^/]+$/.test(path)) return errorResponse("Match updates are not available until pet matching is migrated.", 501);
  if (method === "POST" && /^\/cases\/[^/]+\/flag$/.test(path)) return jsonResponse({ message: "Report submitted successfully. Our moderation team will review this post." });
  if (method === "GET" && /^\/cases\/[^/]+$/.test(path)) return handleGetCase(request, firstPathMatch(path, /^\/cases\/([^/]+)$/));

  if (method === "GET" && path === "/events") return handleListEvents();
  if (method === "POST" && path === "/events") return handleCreateEvent(request);
  if (method === "GET" && path === "/my-registrations") return handleMyRegistrations(request);
  if (method === "GET" && path === "/saved-events") return handleSavedEvents(request);
  if (method === "POST" && /^\/events\/[^/]+\/register$/.test(path)) return handleRegisterEvent(request, firstPathMatch(path, /^\/events\/([^/]+)\/register$/));
  if (method === "POST" && /^\/events\/[^/]+\/save$/.test(path)) return handleSaveEvent(request, firstPathMatch(path, /^\/events\/([^/]+)\/save$/));
  if (method === "GET" && /^\/events\/[^/]+\/form-fields$/.test(path)) return jsonResponse([]);
  if (method === "POST" && /^\/events\/[^/]+\/form-fields$/.test(path)) return jsonResponse({ status: "success" });
  if (method === "GET" && /^\/events\/[^/]+\/responses$/.test(path)) return jsonResponse([]);
  if (method === "GET" && /^\/events\/[^/]+\/journey$/.test(path)) return jsonResponse(null);
  if (method === "POST" && /^\/events\/[^/]+\/sync$/.test(path)) return jsonResponse({ synced: true });
  if (method === "POST" && /^\/events\/[^/]+\/live-log$/.test(path)) return errorResponse("Live observations are not migrated yet.", 501);
  if (method === "POST" && /^\/events\/[^/]+\/scorecard\/surveys$/.test(path)) return errorResponse("Scorecard surveys are not migrated yet.", 501);
  if (method === "GET" && /^\/events\/[^/]+$/.test(path)) return handleGetEvent(firstPathMatch(path, /^\/events\/([^/]+)$/));

  if (method === "POST" && path === "/orders") return handleCreateOrder(request);
  if (method === "GET" && path === "/my-orders") return handleMyOrders(request);
  if (method === "POST" && /^\/orders\/[^/]+\/cancel$/.test(path)) {
    const orderId = firstPathMatch(path, /^\/orders\/([^/]+)\/cancel$/);
    const { profile } = await requireProfile(request);
    let query = supabaseAdmin.from("orders").update({ status: "cancelled", updated_at: nowIso() }).eq("id", orderId);
    if (!isAdminProfile(profile)) query = query.eq("buyer_id", cleanString(profile.id));
    const { error } = await query;
    if (error) throw error;
    return jsonResponse({ message: "Order cancelled", status: "cancelled" });
  }
  if (method === "POST" && /^\/orders\/[^/]+\/pay$/.test(path)) {
    await requireAdminProfile(request);
    const order = await selectSingle("orders", firstPathMatch(path, /^\/orders\/([^/]+)\/pay$/), "Order");
    await markOrderPaid(order);
    return jsonResponse({ message: "Order payment confirmed by admin", status: "paid" });
  }
  if (method === "GET" && /^\/orders\/[^/]+\/receipt$/.test(path)) return errorResponse("Receipt PDFs are not migrated yet.", 501);
  if (method === "POST" && path === "/payments/initiate") return handleInitiatePayment(request);
  if (method === "GET" && /^\/payments\/status\/[^/]+$/.test(path)) return handlePaymentStatus(request, firstPathMatch(path, /^\/payments\/status\/([^/]+)$/));
  if (method === "GET" && path === "/pesapal/callback") return handlePesapalCallback(request);
  if (method === "GET" && path === "/pesapal/ipn") return handlePesapalIpn(request);
  if (method === "POST" && /^\/event-registrations\/[^/]+\/payment\/initiate$/.test(path)) return handleInitiateEventPayment(request, firstPathMatch(path, /^\/event-registrations\/([^/]+)\/payment\/initiate$/));
  if (method === "GET" && /^\/event-registrations\/[^/]+\/payment\/status$/.test(path)) return handleEventPaymentStatus(request, firstPathMatch(path, /^\/event-registrations\/([^/]+)\/payment\/status$/));
  if (method === "GET" && path === "/wallet/summary") return handleWalletSummary(request);
  if (method === "GET" && path === "/my-earnings") return handleWalletSummary(request);
  if (method === "POST" && path === "/withdrawals/request") return handleRequestWithdrawal(request);
  if (method === "GET" && path === "/withdrawals") return handleWithdrawals(request, false);

  if (method === "GET" && path === "/support") return handleListSupportTickets(request);
  if (method === "POST" && path === "/support") return handleCreateSupportTicket(request);
  if (method === "GET" && path === "/announcements") return handleAnnouncements(request);
  if (method === "GET" && path === "/notifications") return handleNotifications(request);
  if (method === "POST" && /^\/notifications\/[^/]+\/read$/.test(path)) return handleReadNotification(request, firstPathMatch(path, /^\/notifications\/([^/]+)\/read$/));
  if (method === "GET" && path === "/spotlight") return handleSpotlight();

  if (method === "GET" && path === "/chat/global") return handleCommunityMessages(request, true);
  if (method === "GET" && path === "/chat/nearby") return handleCommunityMessages(request, false);
  if (method === "POST" && path === "/chat/message") return handleCreateCommunityMessage(request);
  if (method === "GET" && path === "/chat/trending-tags") return jsonResponse([]);
  if (method === "POST" && /^\/chat\/messages\/[^/]+\/flag$/.test(path)) return jsonResponse({ message: "Message flagged" });
  if (method === "POST" && /^\/chat\/messages\/[^/]+\/react$/.test(path)) return jsonResponse({ message: "Reaction saved" });
  if (method === "POST" && /^\/chat\/messages\/[^/]+\/vote$/.test(path)) return jsonResponse({ message: "Vote saved" });
  if ((method === "GET" || method === "POST") && path === "/chat/dms") return handleDirectMessages(request);
  if (method === "POST" && /^\/chat\/dms\/[^/]+\/read$/.test(path)) return jsonResponse({ message: "Success" });
  if (method === "POST" && path === "/users/status/heartbeat") return handleHeartbeat(request);
  if (method === "GET" && path === "/users/online") return handleOnlineUsers();
  if (method === "POST" && /^\/users\/[^/]+\/block$/.test(path)) return jsonResponse({ message: "User has been blocked successfully", blocked: true });
  if (method === "GET" && path === "/users/search") return jsonResponse([]);

  if (method === "GET" && path === "/health/summary") return handleHealthSummary(request);
  if (method === "GET" && path === "/health/wellness-score") return jsonResponse(null);
  if (method === "GET" && /^\/health\/advisor\/[^/]+$/.test(path)) return handleHealthAdvisor(request, firstPathMatch(path, /^\/health\/advisor\/([^/]+)$/));
  if (method === "GET" && path === "/scorecard/questions") return jsonResponse([]);
  if (method === "GET" && path === "/app/version/latest") return jsonResponse(null);

  if (method === "GET" && path === "/admin/analytics") return handleAdminAnalytics(request);
  if (method === "GET" && path === "/admin/stats") return handleAdminAnalytics(request);
  if (method === "GET" && path === "/admin/users") return handleAdminUsers(request);
  if (method === "POST" && /^\/admin\/users\/[^/]+\/role$/.test(path)) return handleUpdateUserRole(request, firstPathMatch(path, /^\/admin\/users\/([^/]+)\/role$/));
  if (method === "POST" && /^\/admin\/users\/[^/]+\/suspend$/.test(path)) return handleSuspendUser(request, firstPathMatch(path, /^\/admin\/users\/([^/]+)\/suspend$/));
  if (method === "POST" && /^\/admin\/users\/[^/]+\/unsuspend$/.test(path)) return handleUnsuspendUser(request, firstPathMatch(path, /^\/admin\/users\/([^/]+)\/unsuspend$/));
  if (method === "GET" && path === "/admin/orders") return handleAdminOrders(request);
  if (method === "POST" && /^\/admin\/orders\/[^/]+\/complete$/.test(path)) return handleAdminCompleteOrder(request, firstPathMatch(path, /^\/admin\/orders\/([^/]+)\/complete$/));
  if (method === "POST" && /^\/admin\/orders\/[^/]+\/settle$/.test(path)) return handleAdminSettleOrder(request, firstPathMatch(path, /^\/admin\/orders\/([^/]+)\/settle$/));
  if (method === "GET" && path === "/admin/withdrawals") return handleWithdrawals(request, true);
  if (method === "POST" && /^\/admin\/withdrawals\/[^/]+\/complete$/.test(path)) return handleCompleteWithdrawal(request, firstPathMatch(path, /^\/admin\/withdrawals\/([^/]+)\/complete$/));
  if (method === "GET" && path === "/admin/services") return handleAdminServices(request);
  if (method === "DELETE" && /^\/admin\/services\/[^/]+$/.test(path)) return handleAdminDeleteService(request, firstPathMatch(path, /^\/admin\/services\/([^/]+)$/));
  if (method === "GET" && path === "/admin/pending-approvals") return handleAdminPendingApprovals(request);
  if (method === "POST" && /^\/admin\/approve\/[^/]+\/[^/]+$/.test(path)) {
    const match = path.match(/^\/admin\/approve\/([^/]+)\/([^/]+)$/);
    return handleAdminApprove(request, match?.[1] ?? "", match?.[2] ?? "");
  }
  if (method === "DELETE" && /^\/admin\/cases\/[^/]+$/.test(path)) return handleAdminCasesDelete(request, firstPathMatch(path, /^\/admin\/cases\/([^/]+)$/));
  if (method === "GET" && path === "/admin/dogs") return handleAdminDogs(request);
  if (method === "DELETE" && /^\/admin\/dogs\/[^/]+$/.test(path)) return handleAdminDeleteDog(request, firstPathMatch(path, /^\/admin\/dogs\/([^/]+)$/));
  if (method === "GET" && path === "/admin/events") return handleAdminEvents(request);
  if (method === "DELETE" && /^\/admin\/events\/[^/]+$/.test(path)) return handleAdminDeleteEvent(request, firstPathMatch(path, /^\/admin\/events\/([^/]+)$/));
  if (method === "PUT" && /^\/admin\/events\/[^/]+\/ticketing$/.test(path)) return handleAdminUpdateEvent(request, firstPathMatch(path, /^\/admin\/events\/([^/]+)\/ticketing$/), "ticketing");
  if (method === "PUT" && /^\/admin\/events\/[^/]+\/schedule$/.test(path)) return handleAdminUpdateEvent(request, firstPathMatch(path, /^\/admin\/events\/([^/]+)\/schedule$/), "schedule");
  if (method === "PUT" && /^\/admin\/events\/[^/]+\/scorecard-settings$/.test(path)) return handleAdminUpdateEvent(request, firstPathMatch(path, /^\/admin\/events\/([^/]+)\/scorecard-settings$/), "scorecard");
  if (method === "GET" && path === "/admin/verify-ticket") return handleVerifyTicket(request);
  if (method === "POST" && path === "/admin/check-in-ticket") return handleCheckInTicket(request);
  if (method === "GET" && path === "/admin/support-tickets") return handleAdminSupportTickets(request);
  if (method === "POST" && /^\/admin\/support-tickets\/[^/]+\/reply$/.test(path)) return handleAdminSupportReply(request, firstPathMatch(path, /^\/admin\/support-tickets\/([^/]+)\/reply$/));
  if (method === "POST" && /^\/admin\/support-tickets\/[^/]+\/resolve$/.test(path)) return handleAdminSupportResolve(request, firstPathMatch(path, /^\/admin\/support-tickets\/([^/]+)\/resolve$/));
  if (method === "GET" && path === "/admin/community") return handleAdminCommunity(request);
  if (method === "POST" && /^\/admin\/community\/[^/]+\/hide$/.test(path)) return handleAdminCommunityHide(request, firstPathMatch(path, /^\/admin\/community\/([^/]+)\/hide$/));
  if (method === "DELETE" && /^\/admin\/community\/[^/]+$/.test(path)) return handleAdminCommunityDelete(request, firstPathMatch(path, /^\/admin\/community\/([^/]+)$/));
  if (method === "GET" && path === "/admin/pinnable-content") return handlePinnableContent(request);
  if (method === "POST" && path === "/admin/pins") return handleAdminPinsCreate(request);
  if (method === "DELETE" && /^\/admin\/pins\/[^/]+\/[^/]+$/.test(path)) {
    const match = path.match(/^\/admin\/pins\/([^/]+)\/([^/]+)$/);
    return handleAdminPinDelete(request, match?.[1] ?? "", match?.[2] ?? "");
  }
  if (method === "GET" && path === "/admin/notification-target-options") return handleNotificationOptions(request);
  if (method === "GET" && path === "/admin/notification-campaigns") return handleNotificationCampaigns(request);
  if (method === "POST" && path === "/admin/notification-campaigns/preview") return handleNotificationPreview(request);
  if (method === "POST" && path === "/admin/notification-campaigns/send") return handleNotificationSend(request);
  if (method === "GET" && path === "/admin/scorecard/events") return jsonResponse([]);
  if (method === "GET" && path === "/admin/export") return jsonResponse({ message: "CSV export is not migrated yet." }, 501);

  return errorResponse(`Endpoint not migrated to Supabase Edge Functions yet: ${method} ${path}`, 501);
};

Deno.serve(async (request) => {
  try {
    return await routeRequest(request);
  } catch (error) {
    if (error instanceof Response) {
      return errorResponse(await error.text(), error.status);
    }

    console.error(error);
    return errorResponse("Unexpected Supabase Edge Function error.", 500);
  }
});
