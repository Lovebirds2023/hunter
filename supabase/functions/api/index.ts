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

const fileResponse = (body: string, contentType: string, fileName: string) =>
  new Response(body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName.replace(/"/g, "")}"`,
    },
  });

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
const trustedAdminRoles = new Set(["admin", "super_admin"]);
const getTrustedAuthRole = (authUser: JsonRecord) => {
  const appMetadata = (authUser.app_metadata as JsonRecord | undefined) ?? {};
  const roleCandidates = [
    cleanString(appMetadata.role),
    ...asStringArray(appMetadata.roles).map(cleanString),
  ];
  return roleCandidates.find((role) => trustedAdminRoles.has(role)) || "";
};
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
const safeFileSlug = (value: unknown) => (
  cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "export"
);
const uniqueStrings = (values: unknown[]) => (
  [...new Set(values.map((value) => cleanString(value)).filter(Boolean))]
);
const normalizeHashtag = (value: unknown) => (
  cleanString(value)
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 50)
);
const extractHashtags = (content: unknown) => (
  [...cleanString(content).matchAll(/#([A-Za-z0-9_]{2,50})/g)]
    .map((match) => normalizeHashtag(match[1]))
    .filter(Boolean)
);
const normalizeMatchText = (value: unknown) => (
  cleanString(value)
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
);
const textTokens = (value: unknown) => (
  new Set(normalizeMatchText(value).split(" ").filter((token) => token.length >= 3))
);
const textSimilarityRatio = (left: unknown, right: unknown) => {
  const leftTokens = textTokens(left);
  const rightTokens = textTokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) overlap += 1;
  });
  return overlap / Math.max(leftTokens.size, rightTokens.size);
};
const stringMatchScore = (left: unknown, right: unknown, exactPoints: number, partialPoints = 0) => {
  const leftNorm = normalizeMatchText(left);
  const rightNorm = normalizeMatchText(right);
  if (!leftNorm || !rightNorm) return { score: 0, result: "missing" };
  if (leftNorm === rightNorm) return { score: exactPoints, result: "exact" };
  if (partialPoints && (leftNorm.includes(rightNorm) || rightNorm.includes(leftNorm) || textSimilarityRatio(leftNorm, rightNorm) >= 0.4)) {
    return { score: partialPoints, result: "partial" };
  }
  return { score: 0, result: "different" };
};
const locationScore = (source: JsonRecord, target: JsonRecord) => {
  const sourceLat = asNullableNumber(source.latitude);
  const sourceLon = asNullableNumber(source.longitude);
  const targetLat = asNullableNumber(target.latitude);
  const targetLon = asNullableNumber(target.longitude);
  if (sourceLat === null || sourceLon === null || targetLat === null || targetLon === null) {
    return { score: 0, distance_km: null };
  }

  const earthRadiusKm = 6371;
  const toRadians = (value: number) => value * Math.PI / 180;
  const latDelta = toRadians(targetLat - sourceLat);
  const lonDelta = toRadians(targetLon - sourceLon);
  const a = Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(sourceLat)) * Math.cos(toRadians(targetLat)) * Math.sin(lonDelta / 2) ** 2;
  const distance = earthRadiusKm * 2 * Math.asin(Math.sqrt(a));
  if (distance <= 1) return { score: 16, distance_km: distance };
  if (distance <= 5) return { score: 12, distance_km: distance };
  if (distance <= 15) return { score: 8, distance_km: distance };
  if (distance <= 50) return { score: 4, distance_km: distance };
  return { score: 0, distance_km: distance };
};
const imageEvidenceCount = (item: JsonRecord) => (
  asStringArray(item.images).length + (cleanString(item.image_url) ? 1 : 0)
);
const registeredPetImageCount = (dog: JsonRecord) => (
  ["nose_print_image", "body_image", "birthmark_image"].filter((key) => cleanString(dog[key])).length
);
const scorecardCategories = [
  "Human Wellbeing",
  "Animal Welfare",
  "Environment",
  "Social Cohesion",
  "Indigenous/Local Knowledge",
];
const defaultReportingFields: JsonRecord = {
  community_members_engaged: 0,
  trainings_story_labs_conducted: 0,
  animals_indirectly_benefiting: 0,
  materials_tools_produced: "",
  human_wellbeing_outcome_notes: "",
  animal_welfare_outcome_notes: "",
  environmental_benefit_notes: "",
  social_cohesion_notes: "",
  evidence_links_or_uploaded_files: "",
};

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
  const profile = await getOrCreateProfileForAuthUser(authUser as unknown as JsonRecord);
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

const handleServiceResponses = async (request: Request, serviceId: string) => {
  const { profile } = await requireProfile(request);
  const service = await selectSingle("services", serviceId, "Service");
  if (cleanString(service.provider_id) !== cleanString(profile.id) && !isAdminProfile(profile)) {
    throw new Response("Not authorized", { status: 403 });
  }

  const { data: orders, error: ordersError } = await supabaseAdmin
    .from("orders")
    .select("*, buyer:users(id, full_name, email, phone_number)")
    .eq("service_id", serviceId)
    .order("created_at", { ascending: false });
  if (ordersError) throw ordersError;

  const orderIds = (orders ?? []).map((order) => cleanString((order as JsonRecord).id)).filter(Boolean);
  const { data: fields, error: fieldsError } = await supabaseAdmin
    .from("service_form_fields")
    .select("id,label")
    .eq("service_id", serviceId);
  if (fieldsError) throw fieldsError;

  const fieldLabels = new Map(
    ((fields ?? []) as JsonRecord[]).map((field) => [cleanString(field.id), cleanString(field.label)])
  );

  let responseRows: JsonRecord[] = [];
  if (orderIds.length) {
    const { data, error } = await supabaseAdmin
      .from("order_form_responses")
      .select("*")
      .in("order_id", orderIds);
    if (error) throw error;
    responseRows = (data ?? []) as JsonRecord[];
  }

  const responsesByOrder = new Map<string, JsonRecord[]>();
  for (const response of responseRows) {
    const orderId = cleanString(response.order_id);
    if (!responsesByOrder.has(orderId)) responsesByOrder.set(orderId, []);
    responsesByOrder.get(orderId)?.push({
      id: response.id,
      field_id: response.field_id,
      field_label: fieldLabels.get(cleanString(response.field_id)) || "",
      answer_value: response.answer_value ?? null,
    });
  }

  return jsonResponse(((orders ?? []) as JsonRecord[]).map((order) => {
    const buyer = isRecord(order.buyer) ? order.buyer : {};
    const canSharePhone = asBoolean(order.share_phone, false) || isAdminProfile(profile);
    return {
      order_id: cleanString(order.id),
      created_at: order.created_at,
      status: cleanString(order.status) || "pending",
      buyer: {
        id: buyer.id ?? null,
        full_name: cleanString(buyer.full_name) || "Unknown",
        email: buyer.email ?? null,
        phone: canSharePhone ? buyer.phone_number ?? null : null,
      },
      responses: responsesByOrder.get(cleanString(order.id)) ?? [],
    };
  }));
};

const getCaseMatchSummary = async (reportId: string) => {
  const { data, error } = await supabaseAdmin
    .from("pet_match_candidates")
    .select("confidence")
    .or(`case_report_id.eq.${reportId},matched_case_report_id.eq.${reportId}`);
  if (error) throw error;
  const rows = (data ?? []) as JsonRecord[];
  return {
    count: rows.length,
    top_confidence: rows.length ? Math.max(...rows.map((row) => asNumber(row.confidence))) : null,
  };
};

const getBlockedRelationshipUserIds = async (userId: string) => {
  if (!userId) return [];
  const { data, error } = await supabaseAdmin
    .from("user_blocks")
    .select("blocker_id,blocked_id")
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  if (error) throw error;
  return uniqueStrings(((data ?? []) as JsonRecord[]).map((row) => (
    cleanString(row.blocker_id) === userId ? row.blocked_id : row.blocker_id
  )));
};

const isBlockedRelationship = async (leftUserId: string, rightUserId: string) => {
  if (!leftUserId || !rightUserId) return false;
  const { data, error } = await supabaseAdmin
    .from("user_blocks")
    .select("blocker_id,blocked_id")
    .or(`blocker_id.eq.${leftUserId},blocked_id.eq.${leftUserId}`);
  if (error) throw error;
  return ((data ?? []) as JsonRecord[]).some((row) => (
    (cleanString(row.blocker_id) === leftUserId && cleanString(row.blocked_id) === rightUserId) ||
    (cleanString(row.blocker_id) === rightUserId && cleanString(row.blocked_id) === leftUserId)
  ));
};

const serializeCaseReport = async (report: JsonRecord, userId = "", pin?: JsonRecord | null) => {
  const reportId = cleanString(report.id);
  const matchSummary = await getCaseMatchSummary(reportId);
  return {
    ...report,
    images: asStringArray(report.images),
    author: await fetchAuthor(report.author_id),
    like_count: await countRows("case_likes", "report_id", reportId),
    comment_count: await countRows("case_comments", "report_id", reportId),
    is_liked: userId
      ? (await countRows("case_likes", "report_id", reportId)) > 0 &&
        Boolean((await supabaseAdmin
          .from("case_likes")
          .select("id")
          .eq("report_id", reportId)
          .eq("user_id", userId)
          .maybeSingle()).data)
      : false,
    ...pinMetadata(pin),
    match_count: matchSummary.count,
    top_match_confidence: matchSummary.top_confidence,
  };
};

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
  const blockedUserIds = new Set(await getBlockedRelationshipUserIds(userId));
  const visibleReports = ((data ?? []) as JsonRecord[]).filter((report) => {
    const authorId = cleanString(report.author_id);
    return authorId === userId || !blockedUserIds.has(authorId);
  });
  const rows = await Promise.all(visibleReports.map((report) => {
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
  if (lostFoundCaseTypes.has(caseType)) await runPetMatchForCase(data as JsonRecord);
  await awardKarma(profile.id, KARMA_CASE_REPORT_REWARD, "case_report", `Reported case: ${title}`);
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
  await awardKarma(profile.id, KARMA_CASE_COMMENT_REWARD, "comment", "Commented on a case report");
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

const lostFoundCaseTypes = new Set(["lost_dog", "found_dog"]);
const oppositeLostFoundType: Record<string, string> = {
  lost_dog: "found_dog",
  found_dog: "lost_dog",
};

const scoreCaseCandidate = (report: JsonRecord, candidate: JsonRecord) => {
  let score = 0;
  const reasons: string[] = [];
  const signals: JsonRecord = {};

  const pet = stringMatchScore(report.pet_type || "dog", candidate.pet_type || "dog", 12);
  score += pet.score;
  signals.pet_type = pet.result;
  if (pet.score) reasons.push(`Same animal type: ${cleanString(candidate.pet_type) || "pet"}`);

  const breed = stringMatchScore(report.breed, candidate.breed, 14, 8);
  score += breed.score;
  signals.breed = breed.result;
  if (breed.score) reasons.push("Breed looks similar");

  const color = stringMatchScore(report.color, candidate.color, 15, 9);
  score += color.score;
  signals.color = color.result;
  if (color.score) reasons.push("Color or pattern looks similar");

  const size = stringMatchScore(report.size, candidate.size, 8, 4);
  score += size.score;
  signals.size = size.result;
  if (size.score) reasons.push("Size is similar");

  const sex = stringMatchScore(report.sex, candidate.sex, 6);
  score += sex.score;
  signals.sex = sex.result;
  if (sex.score) reasons.push("Sex matches");

  const microchip = stringMatchScore(report.microchip_id, candidate.microchip_id, 35);
  score += microchip.score;
  signals.microchip = microchip.result;
  if (microchip.score) reasons.push("Microchip or tag ID matches");

  const markingsRatio = textSimilarityRatio(report.unique_markings, candidate.unique_markings);
  const markingsScore = Math.min(markingsRatio * 14, 14);
  score += markingsScore;
  signals.unique_markings = Math.round(markingsRatio * 100) / 100;
  if (markingsScore >= 5) reasons.push("Unique markings overlap");

  const collarRatio = textSimilarityRatio(report.collar_description, candidate.collar_description);
  const collarScore = Math.min(collarRatio * 8, 8);
  score += collarScore;
  signals.collar = Math.round(collarRatio * 100) / 100;
  if (collarScore >= 4) reasons.push("Collar or tag description overlaps");

  const descriptionRatio = Math.max(
    textSimilarityRatio(report.description, candidate.description),
    textSimilarityRatio(report.title, candidate.title),
  );
  const descriptionScore = Math.min(descriptionRatio * 8, 8);
  score += descriptionScore;
  signals.description = Math.round(descriptionRatio * 100) / 100;

  const location = locationScore(report, candidate);
  score += location.score;
  signals.distance_km = location.distance_km === null ? null : Math.round(location.distance_km * 10) / 10;
  if (location.score && location.distance_km !== null) {
    reasons.push(`Locations are about ${location.distance_km.toFixed(1)} km apart`);
  }

  if (imageEvidenceCount(report) && imageEvidenceCount(candidate)) {
    score += 4;
    reasons.push("Both reports include photos");
    signals.photo_evidence = true;
  }

  const reportDate = new Date(cleanString(report.created_at));
  const candidateDate = new Date(cleanString(candidate.created_at));
  if (!Number.isNaN(reportDate.getTime()) && !Number.isNaN(candidateDate.getTime())) {
    const daysApart = Math.abs((reportDate.getTime() - candidateDate.getTime()) / (24 * 60 * 60 * 1000));
    signals.days_apart = Math.round(daysApart);
    if (daysApart <= 30) score += 5;
    else if (daysApart <= 90) score += 2;
  }

  return {
    confidence: Math.min(Math.round(score * 10) / 10, 100),
    reasons: reasons.slice(0, 6),
    signals,
    candidate_type: "case",
  };
};

const scoreRegisteredPetCandidate = (report: JsonRecord, dog: JsonRecord) => {
  let score = 0;
  const reasons: string[] = [];
  const signals: JsonRecord = {};

  const pet = stringMatchScore(report.pet_type || "dog", dog.pet_type || "dog", 14);
  score += pet.score;
  signals.pet_type = pet.result;
  if (pet.score) reasons.push(`Same animal type: ${cleanString(dog.pet_type) || "pet"}`);

  const breed = stringMatchScore(report.breed, dog.breed, 16, 9);
  score += breed.score;
  signals.breed = breed.result;
  if (breed.score) reasons.push("Breed looks similar");

  const color = stringMatchScore(report.color, dog.color, 18, 10);
  score += color.score;
  signals.color = color.result;
  if (color.score) reasons.push("Color or pattern looks similar");

  const size = stringMatchScore(report.size, dog.body_structure, 9, 4);
  score += size.score;
  signals.size = size.result;
  if (size.score) reasons.push("Body size looks similar");

  const notesRatio = Math.max(
    textSimilarityRatio(report.unique_markings, dog.bio),
    textSimilarityRatio(report.description, dog.bio),
  );
  const notesScore = Math.min(notesRatio * 10, 10);
  score += notesScore;
  signals.profile_notes = Math.round(notesRatio * 100) / 100;
  if (notesScore >= 4) reasons.push("Profile notes overlap with report details");

  const owner = isRecord(dog.owner) ? dog.owner : {};
  const location = locationScore(report, owner);
  score += location.score;
  signals.owner_distance_km = location.distance_km === null ? null : Math.round(location.distance_km * 10) / 10;
  if (location.score && location.distance_km !== null) {
    reasons.push(`Found near registered owner area (${location.distance_km.toFixed(1)} km)`);
  }

  if (imageEvidenceCount(report) && registeredPetImageCount(dog)) {
    score += 5;
    reasons.push("Both records include photos");
    signals.photo_evidence = true;
  }

  return {
    confidence: Math.min(Math.round(score * 10) / 10, 100),
    reasons: reasons.slice(0, 6),
    signals,
    candidate_type: "registered_pet",
  };
};

const runPetMatchForCase = async (report: JsonRecord) => {
  const reportId = cleanString(report.id);
  const caseType = cleanString(report.case_type);
  if (!reportId || !lostFoundCaseTypes.has(caseType)) return [];

  const rows: JsonRecord[] = [];
  const oppositeType = oppositeLostFoundType[caseType];
  const { data: cases, error: casesError } = await supabaseAdmin
    .from("case_reports")
    .select("*")
    .eq("case_type", oppositeType)
    .eq("is_approved", true)
    .neq("id", reportId)
    .limit(150);
  if (casesError) throw casesError;

  for (const candidate of (cases ?? []) as JsonRecord[]) {
    const score = scoreCaseCandidate(report, candidate);
    if (asNumber(score.confidence) >= 35) {
      rows.push({
        case_report_id: reportId,
        matched_case_report_id: cleanString(candidate.id),
        match_source: "rule",
        confidence: score.confidence,
        status: "suggested",
        score_breakdown: score,
        updated_at: nowIso(),
      });
    }
  }

  let dogQuery = supabaseAdmin
    .from("dogs")
    .select("*, owner:users(id, full_name, profile_image, latitude, longitude)")
    .limit(200);
  const petType = cleanString(report.pet_type);
  if (petType) dogQuery = dogQuery.eq("pet_type", petType);
  const { data: dogs, error: dogsError } = await dogQuery;
  if (dogsError) throw dogsError;

  for (const dog of (dogs ?? []) as JsonRecord[]) {
    const score = scoreRegisteredPetCandidate(report, dog);
    if (asNumber(score.confidence) >= 35) {
      rows.push({
        case_report_id: reportId,
        matched_dog_id: cleanString(dog.id),
        match_source: "rule",
        confidence: score.confidence,
        status: "suggested",
        score_breakdown: score,
        updated_at: nowIso(),
      });
    }
  }

  const { error: deleteError } = await supabaseAdmin
    .from("pet_match_candidates")
    .delete()
    .eq("case_report_id", reportId);
  if (deleteError) throw deleteError;

  if (!rows.length) return [];
  const { data, error } = await supabaseAdmin
    .from("pet_match_candidates")
    .insert(rows.sort((a, b) => asNumber(b.confidence) - asNumber(a.confidence)).slice(0, 25))
    .select("*");
  if (error) throw error;
  return (data ?? []) as JsonRecord[];
};

const canViewPetMatch = async (match: JsonRecord, profile: JsonRecord) => {
  if (isAdminProfile(profile)) return true;
  const userId = cleanString(profile.id);
  const caseIds = [cleanString(match.case_report_id), cleanString(match.matched_case_report_id)].filter(Boolean);
  if (caseIds.length) {
    const { data, error } = await supabaseAdmin
      .from("case_reports")
      .select("author_id")
      .in("id", caseIds);
    if (error) throw error;
    if (((data ?? []) as JsonRecord[]).some((row) => cleanString(row.author_id) === userId)) return true;
  }
  const dogId = cleanString(match.matched_dog_id);
  if (dogId) {
    const { data, error } = await supabaseAdmin
      .from("dogs")
      .select("owner_id")
      .eq("id", dogId)
      .maybeSingle();
    if (error) throw error;
    if (cleanString((data as JsonRecord | null)?.owner_id) === userId) return true;
  }
  return false;
};

const serializePetMatch = async (match: JsonRecord, viewpointReportId = "") => {
  let matchedCaseId = cleanString(match.matched_case_report_id);
  if (viewpointReportId && matchedCaseId === viewpointReportId) {
    matchedCaseId = cleanString(match.case_report_id);
  }

  let matchedCase: JsonRecord | null = null;
  if (matchedCaseId) {
    const { data, error } = await supabaseAdmin
      .from("case_reports")
      .select("*")
      .eq("id", matchedCaseId)
      .maybeSingle();
    if (error) throw error;
    matchedCase = data as JsonRecord | null;
  }

  let matchedDog: JsonRecord | null = null;
  const dogId = cleanString(match.matched_dog_id);
  if (dogId) {
    const { data, error } = await supabaseAdmin
      .from("dogs")
      .select("id,name,breed,color,pet_type,body_structure,bio,nose_print_image,body_image,birthmark_image,owner:users(id,full_name,profile_image)")
      .eq("id", dogId)
      .maybeSingle();
    if (error) throw error;
    matchedDog = data as JsonRecord | null;
  }

  return {
    ...match,
    score_breakdown: isRecord(match.score_breakdown) ? match.score_breakdown : {},
    matched_case: matchedCase ? {
      ...matchedCase,
      images: asStringArray(matchedCase.images),
      author: await fetchAuthor(matchedCase.author_id),
    } : null,
    matched_dog: matchedDog ? {
      ...matchedDog,
      owner: isRecord(matchedDog.owner) ? matchedDog.owner : null,
    } : null,
  };
};

const handleCaseMatches = async (request: Request, reportId: string) => {
  const { profile } = await requireProfile(request);
  await handleGetCase(request, reportId);
  const { data, error } = await supabaseAdmin
    .from("pet_match_candidates")
    .select("*")
    .or(`case_report_id.eq.${reportId},matched_case_report_id.eq.${reportId}`)
    .order("confidence", { ascending: false });
  if (error) throw error;
  const visible = [];
  for (const match of (data ?? []) as JsonRecord[]) {
    if (await canViewPetMatch(match, profile)) visible.push(await serializePetMatch(match, reportId));
  }
  return jsonResponse(visible);
};

const handleRefreshCaseMatches = async (request: Request, reportId: string) => {
  const { profile } = await requireProfile(request);
  const report = await selectSingle("case_reports", reportId, "Case report");
  if (cleanString(report.author_id) !== cleanString(profile.id) && !isAdminProfile(profile)) {
    throw new Response("Only the reporter or admin can refresh matches", { status: 403 });
  }
  await runPetMatchForCase(report);
  return handleCaseMatches(request, reportId);
};

const handleUpdateCaseMatchStatus = async (request: Request, reportId: string, matchId: string) => {
  const { profile } = await requireProfile(request);
  const body = await readJson(request);
  const status = cleanString(body.status);
  if (!["suggested", "notified", "confirmed", "rejected"].includes(status)) {
    return errorResponse("Invalid match status.");
  }
  const { data: match, error: matchError } = await supabaseAdmin
    .from("pet_match_candidates")
    .select("*")
    .eq("id", matchId)
    .or(`case_report_id.eq.${reportId},matched_case_report_id.eq.${reportId}`)
    .maybeSingle();
  if (matchError) throw matchError;
  if (!match) throw new Response("Match not found", { status: 404 });
  if (!(await canViewPetMatch(match as JsonRecord, profile))) {
    throw new Response("You cannot update this match", { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("pet_match_candidates")
    .update({ status, reviewed_at: nowIso(), updated_at: nowIso() })
    .eq("id", matchId)
    .select("*")
    .single();
  if (error) throw error;
  return jsonResponse(await serializePetMatch(data as JsonRecord, reportId));
};

const handleDogIdentify = async (request: Request) => {
  await requireProfile(request);
  const body = await readJson(request);
  const reportLike = {
    pet_type: cleanString(body.pet_type) || "dog",
    breed: body.breed ?? null,
    color: body.color ?? null,
    size: body.body_structure ?? body.size ?? null,
    description: body.description ?? null,
    unique_markings: body.unique_markings ?? null,
    image_url: body.image_url ?? body.nose_print_image ?? null,
    images: asStringArray(body.images),
  };

  let query = supabaseAdmin
    .from("dogs")
    .select("*, owner:users(id, full_name, profile_image, latitude, longitude)")
    .limit(100);
  if (cleanString(reportLike.pet_type)) query = query.eq("pet_type", cleanString(reportLike.pet_type));
  const { data, error } = await query;
  if (error) throw error;

  const results = ((data ?? []) as JsonRecord[])
    .map((dog) => ({ dog, score: scoreRegisteredPetCandidate(reportLike, dog) }))
    .filter((item) => asNumber(item.score.confidence) >= 35)
    .sort((a, b) => asNumber(b.score.confidence) - asNumber(a.score.confidence))
    .slice(0, 10)
    .map((item) => ({
      dog: {
        id: item.dog.id,
        name: item.dog.name,
        breed: item.dog.breed,
        color: item.dog.color,
        pet_type: item.dog.pet_type,
        body_image: item.dog.body_image,
      },
      confidence: item.score.confidence,
      match_reason: item.score.reasons.join(", ") || "Similar registered pet profile",
      score_breakdown: item.score,
    }));

  return jsonResponse({
    matches: results.length,
    results,
    message: results.length ? "Potential matches found." : "No strong match found.",
  });
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
    pin = await saveContentPin({
      target_type: "event",
      target_id: cleanString((data as JsonRecord).id),
      title,
      description: body.description ?? null,
      image_url: body.poster_url ?? null,
      priority: 150,
      created_by_id: cleanString(profile.id),
    });
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

const handleEventFormFields = async (request: Request, eventId: string) => {
  if (request.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("event_form_fields")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return jsonResponse(data ?? []);
  }

  const { profile } = await requireProfile(request);
  const event = await selectSingle("events", eventId, "Event");
  if (cleanString(event.organizer_id) !== cleanString(profile.id) && !isAdminProfile(profile)) {
    throw new Response("Not authorized to edit this event's form", { status: 403 });
  }

  const fields = asArray(await readJson(request));
  const { error: deleteError } = await supabaseAdmin.from("event_form_fields").delete().eq("event_id", eventId);
  if (deleteError) throw deleteError;

  const rows = fields.map((field, index) => {
    const record = isRecord(field) ? field : {};
    return {
      event_id: eventId,
      field_type: cleanString(record.field_type),
      label: cleanString(record.label),
      options: record.options ?? null,
      is_required: asBoolean(record.is_required, false),
      sort_order: Number.isFinite(Number(record.sort_order)) ? Number(record.sort_order) : index,
    };
  }).filter((field) => field.field_type && field.label);

  if (!rows.length) return jsonResponse([]);

  const { data, error } = await supabaseAdmin
    .from("event_form_fields")
    .insert(rows)
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return jsonResponse(data ?? []);
};

const handleRegisterEvent = async (request: Request, eventId: string) => {
  const { profile } = await requireProfile(request);
  const event = await selectSingle("events", eventId, "Event");
  const body = await readJson(request);
  const ticketTiers = asArray(event.ticket_tiers).filter(isRecord);
  const selectedTierId = cleanString(body.ticket_tier_id);
  const selectedTier = selectedTierId
    ? ticketTiers.find((tier) => cleanString(tier.id) === selectedTierId) ?? null
    : null;
  if (ticketTiers.length > 0 && !selectedTier) {
    return errorResponse("Choose a registration type before continuing.");
  }

  const availableSlots = asArray(event.available_slots).filter(isRecord);
  const selectedSlotId = cleanString(body.booking_slot_id);
  const selectedSlot = selectedSlotId
    ? availableSlots.find((slot) => cleanString(slot.id) === selectedSlotId) ?? null
    : null;
  if (availableSlots.length > 0 && !selectedSlot) {
    return errorResponse("Choose an available date/time before continuing.");
  }

  const amount = selectedTier ? Math.max(asNumber(selectedTier.price), 0) : Math.max(asNumber(event.ticket_price), 0);
  const currency = cleanString(selectedTier?.currency) || cleanString(event.currency) || "KES";
  const payload = {
    event_id: eventId,
    user_id: cleanString(profile.id),
    dog_id: cleanString(body.dog_id) || null,
    status: amount > 0 ? "pending_payment" : "registered",
    role: cleanString(body.role) || "attendee",
    share_phone: asBoolean(body.share_phone, false),
    amount,
    currency,
    payment_status: amount > 0 ? "pending" : "free",
    ticket_tier_id: selectedTier ? cleanString(selectedTier.id) : null,
    ticket_tier_label: selectedTier ? cleanString(selectedTier.label) : null,
    attendee_type_justification: body.attendee_type_justification ?? null,
    booking_slot_id: selectedSlot ? cleanString(selectedSlot.id) : null,
    booking_slot_label: selectedSlot ? cleanString(selectedSlot.label) : null,
    booking_start_time: selectedSlot ? cleanString(selectedSlot.start_time) || null : null,
    booking_end_time: selectedSlot ? cleanString(selectedSlot.end_time) || null : null,
    updated_at: nowIso(),
  };

  const { data, error } = await supabaseAdmin
    .from("registrations")
    .upsert(payload, { onConflict: "event_id,user_id" })
    .select("*")
    .single();
  if (error) throw error;

  const registrationId = cleanString((data as JsonRecord).id);
  const { error: deleteResponsesError } = await supabaseAdmin
    .from("registration_responses")
    .delete()
    .eq("registration_id", registrationId);
  if (deleteResponsesError) throw deleteResponsesError;

  const formResponses = asArray(body.form_responses);
  const responseRows = formResponses.map((response) => {
    const record = isRecord(response) ? response : {};
    return {
      registration_id: registrationId,
      field_id: cleanString(record.field_id),
      answer_value: record.answer_value ?? null,
    };
  }).filter((response) => response.field_id);
  if (responseRows.length) {
    const { error: responsesError } = await supabaseAdmin.from("registration_responses").insert(responseRows);
    if (responsesError) throw responsesError;
  }

  return jsonResponse({ ...data, responses: responseRows }, 201);
};

const handleEventResponses = async (request: Request, eventId: string) => {
  const { profile } = await requireProfile(request);
  const event = await selectSingle("events", eventId, "Event");
  if (cleanString(event.organizer_id) !== cleanString(profile.id) && !isAdminProfile(profile)) {
    throw new Response("Not authorized to view responses", { status: 403 });
  }

  const { data: registrations, error: registrationsError } = await supabaseAdmin
    .from("registrations")
    .select("*, user:users(id, full_name, email, phone_number), dog:dogs(id, name)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (registrationsError) throw registrationsError;

  const registrationIds = ((registrations ?? []) as JsonRecord[])
    .map((registration) => cleanString(registration.id))
    .filter(Boolean);
  const { data: fields, error: fieldsError } = await supabaseAdmin
    .from("event_form_fields")
    .select("id,label")
    .eq("event_id", eventId);
  if (fieldsError) throw fieldsError;
  const fieldLabels = new Map(
    ((fields ?? []) as JsonRecord[]).map((field) => [cleanString(field.id), cleanString(field.label)])
  );

  let responseRows: JsonRecord[] = [];
  if (registrationIds.length) {
    const { data, error } = await supabaseAdmin
      .from("registration_responses")
      .select("*")
      .in("registration_id", registrationIds);
    if (error) throw error;
    responseRows = (data ?? []) as JsonRecord[];
  }

  const responsesByRegistration = new Map<string, JsonRecord[]>();
  for (const response of responseRows) {
    const registrationId = cleanString(response.registration_id);
    if (!responsesByRegistration.has(registrationId)) responsesByRegistration.set(registrationId, []);
    responsesByRegistration.get(registrationId)?.push({
      id: response.id,
      field_id: response.field_id,
      field_label: fieldLabels.get(cleanString(response.field_id)) || "",
      answer_value: response.answer_value ?? null,
      created_at: response.created_at,
    });
  }

  return jsonResponse(((registrations ?? []) as JsonRecord[]).map((registration) => {
    const user = isRecord(registration.user) ? registration.user : {};
    const dog = isRecord(registration.dog) ? registration.dog : {};
    const canSharePhone = asBoolean(registration.share_phone, false) || isAdminProfile(profile);
    return {
      id: registration.id,
      event_id: registration.event_id,
      user_id: registration.user_id,
      user_name: cleanString(user.full_name) || "Unknown",
      user_email: user.email ?? null,
      user_phone: canSharePhone ? user.phone_number ?? null : null,
      dog_name: dog.name ?? null,
      status: registration.status,
      role: registration.role,
      share_phone: registration.share_phone,
      amount: registration.amount,
      currency: registration.currency,
      payment_status: registration.payment_status,
      ticket_tier_id: registration.ticket_tier_id,
      ticket_tier_label: registration.ticket_tier_label,
      attendee_type_justification: registration.attendee_type_justification,
      booking_slot_id: registration.booking_slot_id,
      booking_slot_label: registration.booking_slot_label,
      booking_start_time: registration.booking_start_time,
      booking_end_time: registration.booking_end_time,
      pesapal_tracking_id: registration.pesapal_tracking_id,
      paid_at: registration.paid_at,
      created_at: registration.created_at,
      responses: responsesByRegistration.get(cleanString(registration.id)) ?? [],
    };
  }));
};

const getEventScorecardTitle = (event: JsonRecord | null) => (
  cleanString(event?.scorecard_title) || "Community Impact Assessment"
);

const getEventScorecardDescription = (event: JsonRecord | null) => (
  cleanString(event?.scorecard_description) || "Collect baseline and follow-up data for M&E, outcome tracking, and partner reporting."
);

const getScorecardQuestions = async (surveyType: string) => {
  let query = supabaseAdmin
    .from("scorecard_questions")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (surveyType) query = query.eq("survey_type", surveyType);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as JsonRecord[];
};

const handleScorecardQuestions = async (request: Request) => {
  const surveyType = cleanString(getUrl(request).searchParams.get("survey_type"));
  if (surveyType && !["baseline", "followup"].includes(surveyType)) {
    return errorResponse("survey_type must be baseline or followup.");
  }
  return jsonResponse(await getScorecardQuestions(surveyType));
};

const calculateScorecardScores = (questionMap: Map<string, JsonRecord>, responses: JsonRecord[]) => {
  const categoryValues = new Map<string, number[]>();
  scorecardCategories.forEach((category) => categoryValues.set(category, []));
  const allValues: number[] = [];

  for (const response of responses) {
    const question = questionMap.get(cleanString(response.question_id));
    if (!question || cleanString(question.question_type) !== "likert") continue;
    const value = asNumber(response.answer_numeric, NaN);
    if (!Number.isFinite(value) || value < 1 || value > 5) {
      throw new Response("Likert responses must be between 1 and 5", { status: 400 });
    }
    const category = cleanString(question.category);
    if (category) categoryValues.set(category, [...(categoryValues.get(category) ?? []), value]);
    allValues.push(value);
  }

  const categoryScores: JsonRecord = {};
  categoryValues.forEach((values, category) => {
    if (values.length) categoryScores[category] = Math.round((values.reduce((sum, value) => sum + value, 0) / (values.length * 5)) * 10000) / 100;
  });

  const coexistenceIndex = allValues.length
    ? Math.round((allValues.reduce((sum, value) => sum + value, 0) / (allValues.length * 5)) * 10000) / 100
    : 0;
  return { categoryScores, coexistenceIndex };
};

const findOrCreateScorecardParticipant = async (eventId: string, profile: JsonRecord) => {
  if (!asBoolean(profile.consent, false)) {
    throw new Response("Consent is required before submitting the impact assessment", { status: 400 });
  }
  const fullName = cleanString(profile.full_name);
  const anonymousCode = cleanString(profile.anonymous_code);
  const phoneNumber = cleanString(profile.phone_number);
  const county = cleanString(profile.county);
  const communityLocation = cleanString(profile.community_location);
  if (!fullName && !anonymousCode) {
    throw new Response("Provide a full name or anonymous participant code", { status: 400 });
  }
  if (!county || !communityLocation) {
    throw new Response("County and community/location are required", { status: 400 });
  }

  let participant: JsonRecord | null = null;
  const baseQuery = () => supabaseAdmin
    .from("scorecard_participants")
    .select("*")
    .eq("event_id", eventId)
    .limit(1);

  if (anonymousCode) {
    const { data, error } = await baseQuery().eq("anonymous_code", anonymousCode).maybeSingle();
    if (error) throw error;
    participant = data as JsonRecord | null;
  }
  if (!participant && phoneNumber) {
    const { data, error } = await baseQuery().eq("phone_number", phoneNumber).maybeSingle();
    if (error) throw error;
    participant = data as JsonRecord | null;
  }
  if (!participant && fullName) {
    const { data, error } = await baseQuery()
      .eq("full_name", fullName)
      .eq("community_location", communityLocation)
      .maybeSingle();
    if (error) throw error;
    participant = data as JsonRecord | null;
  }

  const payload = {
    event_id: eventId,
    full_name: fullName || null,
    anonymous_code: anonymousCode || null,
    phone_number: phoneNumber || null,
    county,
    community_location: communityLocation,
    user_type: cleanString(profile.user_type) || "other",
    participation_type: cleanString(profile.participation_type) || "other",
    consent: true,
    updated_at: nowIso(),
  };

  if (participant) {
    const { data, error } = await supabaseAdmin
      .from("scorecard_participants")
      .update(payload)
      .eq("id", cleanString(participant.id))
      .select("*")
      .single();
    if (error) throw error;
    return data as JsonRecord;
  }

  const { data, error } = await supabaseAdmin
    .from("scorecard_participants")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as JsonRecord;
};

const participantScorePair = async (eventId: string, participantId: string) => {
  const { data, error } = await supabaseAdmin
    .from("scorecard_surveys")
    .select("survey_type,coexistence_index,created_at")
    .eq("event_id", eventId)
    .eq("participant_id", participantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const surveys = (data ?? []) as JsonRecord[];
  const baseline = surveys.find((survey) => cleanString(survey.survey_type) === "baseline");
  const followup = surveys.find((survey) => cleanString(survey.survey_type) === "followup");
  const baselineScore = baseline ? asNumber(baseline.coexistence_index) : null;
  const followupScore = followup ? asNumber(followup.coexistence_index) : null;
  const change = baselineScore !== null && followupScore !== null ? Math.round((followupScore - baselineScore) * 100) / 100 : null;
  return { baselineScore, followupScore, change };
};

const handleSubmitScorecardSurvey = async (request: Request, eventId: string) => {
  const event = await selectSingle("events", eventId, "Event");
  if (event.scorecard_enabled === false) return errorResponse("Impact tracking is not enabled for this event.");
  const body = await readJson(request);
  const surveyType = cleanString(body.survey_type);
  if (!["baseline", "followup"].includes(surveyType)) return errorResponse("survey_type must be baseline or followup.");

  const questions = await getScorecardQuestions(surveyType);
  const questionMap = new Map(questions.map((question) => [cleanString(question.id), question]));
  const responses = asArray(body.responses).filter(isRecord);
  const provided = new Map(responses.map((response) => [cleanString(response.question_id), response]));

  for (const question of questions) {
    const response = provided.get(cleanString(question.id));
    if (!response) return errorResponse(`Missing response for: ${cleanString(question.prompt)}`);
    if (cleanString(question.question_type) === "likert" && !Number.isFinite(asNumber(response.answer_numeric, NaN))) {
      return errorResponse(`Select a 1-5 score for: ${cleanString(question.prompt)}`);
    }
    if (cleanString(question.question_type) === "open" && !cleanString(response.answer_text)) {
      return errorResponse(`Answer required for: ${cleanString(question.prompt)}`);
    }
  }

  const participant = await findOrCreateScorecardParticipant(eventId, isRecord(body.participant) ? body.participant : {});
  const scores = calculateScorecardScores(questionMap, responses);
  const { data: survey, error: surveyError } = await supabaseAdmin
    .from("scorecard_surveys")
    .insert({
      event_id: eventId,
      participant_id: cleanString(participant.id),
      survey_type: surveyType,
      category_scores: scores.categoryScores,
      coexistence_index: scores.coexistenceIndex,
    })
    .select("*")
    .single();
  if (surveyError) throw surveyError;

  const responseRows = responses
    .map((response) => {
      const question = questionMap.get(cleanString(response.question_id));
      if (!question) return null;
      const isLikert = cleanString(question.question_type) === "likert";
      return {
        survey_id: cleanString((survey as JsonRecord).id),
        question_id: cleanString(response.question_id),
        answer_numeric: isLikert ? asNumber(response.answer_numeric) : null,
        answer_text: isLikert ? null : cleanString(response.answer_text),
      };
    })
    .filter((row): row is JsonRecord => Boolean(row));
  if (responseRows.length) {
    const { error } = await supabaseAdmin.from("scorecard_responses").insert(responseRows);
    if (error) throw error;
  }

  const scorePair = await participantScorePair(eventId, cleanString(participant.id));
  return jsonResponse({
    id: (survey as JsonRecord).id,
    event_id: eventId,
    participant_id: participant.id,
    survey_type: surveyType,
    category_scores: scores.categoryScores,
    coexistence_index: scores.coexistenceIndex,
    baseline_score: scorePair.baselineScore,
    followup_score: scorePair.followupScore,
    percentage_change: scorePair.change,
    created_at: (survey as JsonRecord).created_at,
  }, 201);
};

const countByField = (rows: JsonRecord[], field: string) => rows.reduce((acc, row) => {
  const key = cleanString(row[field]) || "Unknown";
  acc[key] = asNumber(acc[key]) + 1;
  return acc;
}, {} as JsonRecord);

const scorecardDashboardPayload = async (eventId: string) => {
  const event = await selectSingle("events", eventId, "Event");
  const { data: participantsData, error: participantsError } = await supabaseAdmin
    .from("scorecard_participants")
    .select("*")
    .eq("event_id", eventId);
  if (participantsError) throw participantsError;
  const participants = (participantsData ?? []) as JsonRecord[];

  const { data: surveysData, error: surveysError } = await supabaseAdmin
    .from("scorecard_surveys")
    .select("*")
    .eq("event_id", eventId);
  if (surveysError) throw surveysError;
  const surveys = (surveysData ?? []) as JsonRecord[];
  const baselineCount = surveys.filter((survey) => cleanString(survey.survey_type) === "baseline").length;
  const followupCount = surveys.filter((survey) => cleanString(survey.survey_type) === "followup").length;
  const avgIndex = surveys.length
    ? Math.round((surveys.reduce((sum, survey) => sum + asNumber(survey.coexistence_index), 0) / surveys.length) * 100) / 100
    : 0;

  const changes: number[] = [];
  for (const participant of participants) {
    const scorePair = await participantScorePair(eventId, cleanString(participant.id));
    if (scorePair.change !== null) changes.push(scorePair.change);
  }
  const avgChange = changes.length ? Math.round((changes.reduce((sum, change) => sum + change, 0) / changes.length) * 100) / 100 : 0;

  const categoryValues = new Map<string, number[]>();
  for (const survey of surveys) {
    const scores = isRecord(survey.category_scores) ? survey.category_scores : {};
    for (const [category, value] of Object.entries(scores)) {
      categoryValues.set(category, [...(categoryValues.get(category) ?? []), asNumber(value)]);
    }
  }
  const categoryAverages: JsonRecord = {};
  categoryValues.forEach((values, category) => {
    if (values.length) categoryAverages[category] = Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
  });

  const { data: evidence, error: evidenceError } = await supabaseAdmin
    .from("scorecard_evidence")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (evidenceError) throw evidenceError;

  const { data: report, error: reportError } = await supabaseAdmin
    .from("scorecard_reporting_exports")
    .select("*")
    .eq("event_id", eventId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (reportError) throw reportError;

  return {
    event: {
      id: event.id,
      title: event.title,
      start_time: event.start_time,
      follow_up_requested_at: event.follow_up_requested_at ?? null,
    },
    total_participants: participants.length,
    baseline_surveys_completed: baselineCount,
    followup_surveys_completed: followupCount,
    average_coexistence_index: avgIndex,
    average_change_from_baseline_to_followup: avgChange,
    participants_by_county: countByField(participants, "county"),
    participants_by_community: countByField(participants, "community_location"),
    participants_by_user_type: countByField(participants, "user_type"),
    participation_type_counts: countByField(participants, "participation_type"),
    story_labs_attended: asNumber(countByField(participants, "participation_type")["story lab"]),
    listening_circles_attended: asNumber(countByField(participants, "participation_type")["listening circle"]),
    podcast_listeners: asNumber(countByField(participants, "participation_type")["podcast listener"]),
    category_averages: categoryAverages,
    evidence: evidence ?? [],
    reporting_fields: { ...defaultReportingFields, ...(isRecord((report as JsonRecord | null)?.fields) ? (report as JsonRecord).fields as JsonRecord : {}) },
  };
};

const handleAdminScorecardEvents = async (request: Request) => {
  await requireAdminProfile(request);
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("*")
    .order("start_time", { ascending: false });
  if (error) throw error;
  const rows = [];
  for (const event of (data ?? []) as JsonRecord[]) {
    const dashboard = await scorecardDashboardPayload(cleanString(event.id));
    rows.push({
      id: event.id,
      title: event.title,
      start_time: event.start_time,
      location: event.location,
      scorecard_enabled: event.scorecard_enabled,
      scorecard_title: getEventScorecardTitle(event),
      scorecard_description: getEventScorecardDescription(event),
      admin_created: event.admin_created,
      total_participants: dashboard.total_participants,
      baseline_surveys_completed: dashboard.baseline_surveys_completed,
      followup_surveys_completed: dashboard.followup_surveys_completed,
    });
  }
  return jsonResponse(rows);
};

const handleAdminScorecardDashboard = async (request: Request, eventId: string) => {
  await requireAdminProfile(request);
  return jsonResponse(await scorecardDashboardPayload(eventId));
};

const handleAdminPromptScorecardFollowup = async (request: Request, eventId: string) => {
  await requireAdminProfile(request);
  const event = await selectSingle("events", eventId, "Event");
  const followUpRequestedAt = nowIso();
  const { error: updateError } = await supabaseAdmin
    .from("events")
    .update({ follow_up_requested_at: followUpRequestedAt, updated_at: followUpRequestedAt })
    .eq("id", eventId);
  if (updateError) throw updateError;

  const { data: registrations, error: registrationsError } = await supabaseAdmin
    .from("registrations")
    .select("user_id")
    .eq("event_id", eventId);
  if (registrationsError) throw registrationsError;
  const recipientIds = uniqueStrings(((registrations ?? []) as JsonRecord[]).map((registration) => registration.user_id));
  if (recipientIds.length) {
    const title = `${getEventScorecardTitle(event)} follow-up`;
    const message = `Please complete the follow-up assessment for ${cleanString(event.title)}.`;
    const notifications = recipientIds.map((userId) => ({
      user_id: userId,
      title,
      message,
      type: "info",
      target_type: "event",
      target_id: eventId,
      target_route: "EventDetail",
    }));
    const { error } = await supabaseAdmin.from("notifications").insert(notifications);
    if (error) throw error;
  }

  const { data: participants, error: participantsError } = await supabaseAdmin
    .from("scorecard_participants")
    .select("id")
    .eq("event_id", eventId)
    .not("phone_number", "is", null);
  if (participantsError) throw participantsError;
  return jsonResponse({
    message: "Follow-up prompt recorded",
    notified_registrants: recipientIds.length,
    participants_with_phone: (participants ?? []).length,
    follow_up_requested_at: followUpRequestedAt,
  });
};

const handleAdminScorecardEvidence = async (request: Request, eventId: string) => {
  const { profile } = await requireAdminProfile(request);
  await selectSingle("events", eventId, "Event");
  const body = await readJson(request);
  const evidenceType = cleanString(body.evidence_type);
  const url = cleanString(body.url);
  if (!evidenceType || !url) return errorResponse("Evidence type and URL are required.");
  const { data, error } = await supabaseAdmin
    .from("scorecard_evidence")
    .insert({
      event_id: eventId,
      evidence_type: evidenceType,
      url,
      notes: body.notes ?? null,
      created_by_id: cleanString(profile.id),
    })
    .select("*")
    .single();
  if (error) throw error;
  return jsonResponse(data, 201);
};

const handleAdminScorecardReporting = async (request: Request, eventId: string) => {
  const { profile } = await requireAdminProfile(request);
  await selectSingle("events", eventId, "Event");
  const body = await readJson(request);
  const fields = { ...defaultReportingFields, ...body };
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("scorecard_reporting_exports")
    .select("id")
    .eq("event_id", eventId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const { error } = await supabaseAdmin
      .from("scorecard_reporting_exports")
      .update({ fields, created_by_id: cleanString(profile.id), updated_at: nowIso() })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin
      .from("scorecard_reporting_exports")
      .insert({ event_id: eventId, fields, created_by_id: cleanString(profile.id) });
    if (error) throw error;
  }

  return jsonResponse({ message: "Reporting fields saved", reporting_fields: fields });
};

const handleProgramJourney = async (request: Request, eventId: string) => {
  const { profile } = await requireProfile(request);
  const userId = cleanString(profile.id);
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("program_journeys")
    .select("*")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return jsonResponse(existing);

  const { data, error } = await supabaseAdmin
    .from("program_journeys")
    .insert({ event_id: eventId, user_id: userId, progress_percentage: 0, current_timepoint: "T1" })
    .select("*")
    .single();
  if (error) throw error;
  return jsonResponse(data, 201);
};

const handleEventSync = async (request: Request, eventId: string) => {
  const { profile } = await requireProfile(request);
  const body = await readJson(request);
  let checkinsSynced = 0;
  let observationsSynced = 0;

  for (const item of asArray(body.checkins).filter(isRecord)) {
    const userId = cleanString(item.user_id) || cleanString(profile.id);
    const timepoint = cleanString(item.timepoint);
    if (!userId || !timepoint) continue;
    const payload = {
      event_id: eventId,
      user_id: userId,
      dog_id: cleanString(item.dog_id) || null,
      timepoint,
      who5_answers: item.who5_answers ?? null,
      pss10_answers: item.pss10_answers ?? null,
      relationship_answers: item.relationship_answers ?? null,
      welfare_snapshot: item.welfare_snapshot ?? null,
    };
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("checkin_data")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .eq("timepoint", timepoint)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) {
      const { error } = await supabaseAdmin.from("checkin_data").insert(payload);
      if (error) throw error;
      checkinsSynced += 1;
    }
  }

  for (const item of asArray(body.observations).filter(isRecord)) {
    const behavior = cleanString(item.behavior);
    if (!behavior) continue;
    const { error } = await supabaseAdmin.from("live_observations").insert({
      event_id: eventId,
      observer_id: cleanString(profile.id),
      participant_id: cleanString(item.participant_id) || null,
      dog_id: cleanString(item.dog_id) || null,
      behavior,
      intensity: cleanString(item.intensity).toLowerCase() || null,
      notes: item.notes ?? null,
      timestamp: cleanString(item.timestamp) || nowIso(),
      is_offline_sync: asBoolean(item.is_offline_sync, true),
      synced_at: nowIso(),
    });
    if (error) throw error;
    observationsSynced += 1;
  }

  return jsonResponse({ message: "Sync successful", checkins_synced: checkinsSynced, observations_synced: observationsSynced });
};

const handleLiveLog = async (request: Request, eventId: string) => {
  const { profile } = await requireProfile(request);
  if (!isAdminProfile(profile) && !["provider", "vet", "facilitator"].includes(cleanString(profile.role))) {
    throw new Response("Not authorized to log observations", { status: 403 });
  }
  const body = await readJson(request);
  const behavior = cleanString(body.behavior);
  if (!behavior) return errorResponse("Behavior is required.");
  const { data, error } = await supabaseAdmin
    .from("live_observations")
    .insert({
      event_id: eventId,
      observer_id: cleanString(profile.id),
      participant_id: cleanString(body.participant_id) || null,
      dog_id: cleanString(body.dog_id) || null,
      behavior,
      intensity: cleanString(body.intensity).toLowerCase() || null,
      notes: body.notes ?? null,
      timestamp: cleanString(body.timestamp) || nowIso(),
      is_offline_sync: false,
      synced_at: nowIso(),
    })
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
  if (cleanString(service.item_type) === "products") {
    if (service.stock_count !== null && service.stock_count !== undefined && asNumber(service.stock_count) <= 0) {
      return errorResponse("This product is out of stock");
    }
  } else {
    if (asBoolean(service.is_busy, false)) return errorResponse("This service is currently unavailable");
    if (service.slots_available !== null && service.slots_available !== undefined && asNumber(service.slots_available) <= 0) {
      return errorResponse("No slots are available for this service");
    }
  }

  const formResponses = asArray(body.form_responses);
  const { data: fields, error: fieldsError } = await supabaseAdmin
    .from("service_form_fields")
    .select("id,label,is_required")
    .eq("service_id", serviceId);
  if (fieldsError) throw fieldsError;
  const provided = new Map(
    formResponses
      .map((response) => (isRecord(response) ? response : {}))
      .map((response) => [cleanString(response.field_id), response.answer_value]),
  );
  for (const field of (fields ?? []) as JsonRecord[]) {
    const answer = provided.get(cleanString(field.id));
    const hasAnswer = answer !== null && answer !== undefined && String(answer).trim() !== "";
    if (asBoolean(field.is_required, false) && !hasAnswer) {
      return errorResponse(`Question '${cleanString(field.label)}' is required`);
    }
  }

  const baseAmount = Math.max(asNumber(service.price), 0);
  const { pointsRedeemed, discountAmount } = calculateKarmaRedemption(profile, baseAmount, body.karma_points_to_redeem);
  const amount = Math.round(Math.max(baseAmount - discountAmount, 1) * 100) / 100;
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
      discount_amount: discountAmount,
      karma_points_redeemed: pointsRedeemed,
      status: "pending",
      share_phone: asBoolean(body.share_phone, false),
      pesapal_merchant_reference: crypto.randomUUID(),
      updated_at: nowIso(),
    })
    .select("*")
    .single();
  if (error) throw error;

  if (pointsRedeemed) {
    await awardKarma(
      profile.id,
      -pointsRedeemed,
      "purchase_discount",
      `Redeemed ${pointsRedeemed} points for order discount on ${cleanString(service.title) || "marketplace item"}`,
    );
  }

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

const escapePdfText = (value: unknown) => cleanString(value)
  .replace(/\\/g, "\\\\")
  .replace(/\(/g, "\\(")
  .replace(/\)/g, "\\)");

const simplePdf = (lines: unknown[]) => {
  const contentLines = lines
    .map((line, index) => `${index === 0 ? "50 780 Td" : "0 -18 Td"} (${escapePdfText(line)}) Tj`)
    .join("\n");
  const stream = `BT\n/F1 12 Tf\n${contentLines}\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
};

const handleOrderReceipt = async (request: Request, orderId: string) => {
  const { profile } = await requireProfile(request);
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("*, service:services(*)")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!order) throw new Response("Order not found", { status: 404 });

  const row = order as JsonRecord;
  const service = isRecord(row.service) ? row.service : {};
  const userId = cleanString(profile.id);
  const isOwner = cleanString(row.buyer_id) === userId || cleanString(service.provider_id) === userId;
  if (!isOwner && !isAdminProfile(profile)) throw new Response("Not authorized", { status: 403 });

  const receipt = simplePdf([
    "Lovedogs 360 Receipt",
    `Order ID: ${cleanString(row.id)}`,
    `Item: ${cleanString(service.title) || "Marketplace item"}`,
    `Status: ${cleanString(row.status) || "pending"}`,
    `Amount: ${asNumber(row.amount).toLocaleString()} ${cleanString(service.currency) || "KES"}`,
    `Commission: ${asNumber(row.commission).toLocaleString()} ${cleanString(service.currency) || "KES"}`,
    `Seller payout: ${asNumber(row.payout).toLocaleString()} ${cleanString(service.currency) || "KES"}`,
    `Created: ${cleanString(row.created_at)}`,
    "",
    "Thank you for using Lovedogs 360.",
  ]);

  return fileResponse(receipt, "application/pdf", `receipt_${safeFileSlug(orderId)}.pdf`);
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
  const userId = cleanString(authUser?.id);
  const tag = normalizeHashtag(getUrl(request).searchParams.get("tag"));
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
  const blockedUserIds = userId ? new Set(await getBlockedRelationshipUserIds(userId)) : new Set<string>();
  let rows = (data ?? []) as JsonRecord[];
  if (blockedUserIds.size) {
    rows = rows.filter((message) => !blockedUserIds.has(cleanString(message.author_id)));
  }
  if (tag) {
    rows = rows.filter((message) => {
      const tags = uniqueStrings([...asStringArray(message.hashtags), ...extractHashtags(message.content)].map(normalizeHashtag));
      return tags.includes(tag);
    });
  }

  const messageIds = rows.map((message) => cleanString(message.id)).filter(Boolean);
  const reactionsByMessage = new Map<string, JsonRecord[]>();
  const pollResultsByMessage = new Map<string, JsonRecord>();
  const hasVotedByMessage = new Map<string, number | null>();

  if (messageIds.length) {
    const { data: reactions, error: reactionsError } = await supabaseAdmin
      .from("chat_reactions")
      .select("*")
      .in("message_id", messageIds);
    if (reactionsError) throw reactionsError;
    for (const reaction of (reactions ?? []) as JsonRecord[]) {
      const messageId = cleanString(reaction.message_id);
      if (!reactionsByMessage.has(messageId)) reactionsByMessage.set(messageId, []);
      reactionsByMessage.get(messageId)?.push(reaction);
    }

    const { data: votes, error: votesError } = await supabaseAdmin
      .from("community_poll_votes")
      .select("*")
      .in("message_id", messageIds);
    if (votesError) throw votesError;
    for (const vote of (votes ?? []) as JsonRecord[]) {
      const messageId = cleanString(vote.message_id);
      const optionId = String(asNumber(vote.option_id));
      const results = pollResultsByMessage.get(messageId) ?? {};
      results[optionId] = asNumber(results[optionId]) + 1;
      pollResultsByMessage.set(messageId, results);
      if (userId && cleanString(vote.user_id) === userId) {
        hasVotedByMessage.set(messageId, asNumber(vote.option_id));
      }
    }
  }

  const messages = await Promise.all(rows.map(async (message) => {
    const messageId = cleanString(message.id);
    const hashtags = uniqueStrings([...asStringArray(message.hashtags), ...extractHashtags(message.content)].map(normalizeHashtag));
    return {
      ...message,
      hashtags,
      author: await fetchAuthor(message.author_id),
      reactions: reactionsByMessage.get(messageId) ?? [],
      poll_results: pollResultsByMessage.get(messageId) ?? {},
      has_voted: hasVotedByMessage.get(messageId) ?? null,
      ...pinMetadata(pins.get(`community:${messageId}`)),
    };
  }));
  return jsonResponse(sortPinnedFirst(messages as JsonRecord[]));
};

const handleCreateCommunityMessage = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const body = await readJson(request);
  const content = cleanString(body.content);
  if (!content) return errorResponse("Message content is required.");
  const hashtags = uniqueStrings([...asStringArray(body.hashtags), ...extractHashtags(content)].map(normalizeHashtag));
  const { data, error } = await supabaseAdmin
    .from("community_messages")
    .insert({
      author_id: cleanString(profile.id),
      content,
      latitude: asNullableNumber(body.latitude),
      longitude: asNullableNumber(body.longitude),
      is_global: asBoolean(body.is_global, true),
      reshare_id: body.reshare_id ?? null,
      hashtags,
      is_poll: asBoolean(body.is_poll, false),
      poll_options: body.poll_options ?? null,
      updated_at: nowIso(),
    })
    .select("*")
    .single();
  if (error) throw error;
  await awardKarma(profile.id, 1, "chat", "Sent a community message");
  return jsonResponse({ ...data, hashtags, author: await fetchAuthor(profile.id), reactions: [], flag_count: 0, poll_results: {}, has_voted: null }, 201);
};

const handleTrendingTags = async () => {
  const { data, error } = await supabaseAdmin
    .from("community_messages")
    .select("hashtags,content")
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const message of (data ?? []) as JsonRecord[]) {
    const tags = uniqueStrings([...asStringArray(message.hashtags), ...extractHashtags(message.content)].map(normalizeHashtag));
    for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  return jsonResponse(
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12)
      .map(([tag, count]) => ({ tag, count })),
  );
};

const handleCommunityReaction = async (request: Request, messageId: string) => {
  const { profile } = await requireProfile(request);
  await selectSingle("community_messages", messageId, "Message");
  const userId = cleanString(profile.id);
  const body = await readJson(request);
  const reactionType = cleanString(body.reaction_type) || "heart";
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("chat_reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .eq("reaction_type", reactionType)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const { error } = await supabaseAdmin.from("chat_reactions").delete().eq("id", existing.id);
    if (error) throw error;
    return jsonResponse({ reacted: false });
  }

  const { error } = await supabaseAdmin
    .from("chat_reactions")
    .insert({ message_id: messageId, user_id: userId, reaction_type: reactionType });
  if (error) throw error;
  return jsonResponse({ reacted: true });
};

const handleCommunityVote = async (request: Request, messageId: string) => {
  const { profile } = await requireProfile(request);
  await selectSingle("community_messages", messageId, "Message");
  const body = await readJson(request);
  const optionId = asNumber(body.option_id, NaN);
  if (!Number.isFinite(optionId)) return errorResponse("Poll option is required.");
  const userId = cleanString(profile.id);
  const payload = { message_id: messageId, user_id: userId, option_id: optionId };

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("community_poll_votes")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const { error } = await supabaseAdmin
      .from("community_poll_votes")
      .update({ option_id: optionId })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin.from("community_poll_votes").insert(payload);
    if (error) throw error;
  }

  return jsonResponse({ voted: true, option_id: optionId });
};

const handleCommunityFlag = async (request: Request, messageId: string) => {
  await requireProfile(request);
  const message = await selectSingle("community_messages", messageId, "Message");
  const { error } = await supabaseAdmin
    .from("community_messages")
    .update({ flag_count: asNumber(message.flag_count) + 1, updated_at: nowIso() })
    .eq("id", messageId);
  if (error) throw error;
  return jsonResponse({ message: "Message flagged" });
};

const handleDirectMessages = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const userId = cleanString(profile.id);
  if (request.method === "GET") {
    const blockedUserIds = new Set(await getBlockedRelationshipUserIds(userId));
    const { data, error } = await supabaseAdmin
      .from("direct_messages")
      .select("*")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const visibleMessages = ((data ?? []) as JsonRecord[]).filter((message) => {
      const otherUserId = cleanString(message.sender_id) === userId ? cleanString(message.receiver_id) : cleanString(message.sender_id);
      return !blockedUserIds.has(otherUserId);
    });
    return jsonResponse(await Promise.all(visibleMessages.map(async (message) => ({
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
  if (await isBlockedRelationship(userId, receiverId)) {
    throw new Response("You cannot message this user.", { status: 403 });
  }
  const { data, error } = await supabaseAdmin
    .from("direct_messages")
    .insert({ sender_id: userId, receiver_id: receiverId, content })
    .select("*")
    .single();
  if (error) throw error;
  return jsonResponse({ ...data, sender: await fetchAuthor(userId), receiver: await fetchAuthor(receiverId) }, 201);
};

const handleDirectMessageRead = async (request: Request, messageId: string) => {
  const { profile } = await requireProfile(request);
  const { error } = await supabaseAdmin
    .from("direct_messages")
    .update({ read_at: nowIso() })
    .eq("id", messageId)
    .eq("receiver_id", cleanString(profile.id));
  if (error) throw error;
  return jsonResponse({ message: "Success", read: true });
};

const handleUserSearch = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const query = cleanString(getUrl(request).searchParams.get("q"));
  if (query.length < 1) return jsonResponse([]);
  const searchTerm = query.replace(/[%_]/g, "").slice(0, 60);
  if (!searchTerm) return jsonResponse([]);
  const userId = cleanString(profile.id);
  const blockedUserIds = new Set(await getBlockedRelationshipUserIds(userId));
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id,full_name,profile_image")
    .ilike("full_name", `%${searchTerm}%`)
    .is("deleted_at", null)
    .limit(10);
  if (error) throw error;
  return jsonResponse(((data ?? []) as JsonRecord[])
    .filter((user) => cleanString(user.id) !== userId && !blockedUserIds.has(cleanString(user.id)))
    .map((user) => ({
      id: user.id,
      full_name: cleanString(user.full_name) || "User",
      profile_image: user.profile_image ?? null,
    })));
};

const handleUserBlock = async (request: Request, blockedUserId: string) => {
  const { profile } = await requireProfile(request);
  const blockerId = cleanString(profile.id);
  const targetId = cleanString(blockedUserId);
  if (!targetId) return errorResponse("User is required.");
  if (targetId === blockerId) return errorResponse("You cannot block yourself.");
  await selectSingle("users", targetId, "User");

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("user_blocks")
    .select("*")
    .eq("blocker_id", blockerId)
    .eq("blocked_id", targetId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return jsonResponse({ message: "User has been blocked successfully", blocked: true });

  const { data, error } = await supabaseAdmin
    .from("user_blocks")
    .insert({ blocker_id: blockerId, blocked_id: targetId })
    .select("*")
    .single();
  if (error) throw error;
  return jsonResponse({ ...data, message: "User has been blocked successfully", blocked: true }, 201);
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

const numericAnswerValues = (value: unknown): number[] => {
  if (Array.isArray(value)) {
    return value.flatMap(numericAnswerValues);
  }
  if (isRecord(value)) {
    return Object.values(value).flatMap(numericAnswerValues);
  }
  const number = asNumber(value, NaN);
  return Number.isFinite(number) ? [number] : [];
};

const answerSetScore = (value: unknown, invert = false) => {
  const values = numericAnswerValues(value);
  if (!values.length) return 0;
  const maxValue = Math.max(...values, 5);
  const scale = maxValue <= 5 ? 5 : maxValue <= 10 ? 10 : 100;
  const score = Math.round((values.reduce((sum, item) => sum + item, 0) / (values.length * scale)) * 100);
  return invert ? Math.max(0, Math.min(100, 100 - score)) : Math.max(0, Math.min(100, score));
};

const handleWellnessScore = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const { data, error } = await supabaseAdmin
    .from("checkin_data")
    .select("*")
    .eq("user_id", cleanString(profile.id))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return jsonResponse({
      overall_score: 0,
      who5_score: 0,
      pss_score: 0,
      relationship_score: 0,
      welfare_score: 0,
      has_data: false,
    });
  }

  const row = data as JsonRecord;
  const who5 = answerSetScore(row.who5_answers);
  const pss = answerSetScore(row.pss10_answers);
  const relationship = answerSetScore(row.relationship_answers);
  const welfare = answerSetScore(row.welfare_snapshot);
  const overall = Math.round((who5 * 0.3) + (welfare * 0.3) + (relationship * 0.2) + ((100 - pss) * 0.2));
  return jsonResponse({
    overall_score: overall,
    who5_score: who5,
    pss_score: pss,
    relationship_score: relationship,
    welfare_score: welfare,
    has_data: true,
    last_checkin: row.created_at ?? null,
  });
};

const normalizeAppPlatform = (platform: unknown) => {
  const normalized = cleanString(platform).toLowerCase() || "all";
  return ["android", "ios", "all"].includes(normalized) ? normalized : "all";
};

const serializeAppVersion = (row: JsonRecord) => ({
  id: row.id,
  platform: row.platform,
  version: row.version,
  build_number: row.build_number ?? null,
  download_url: row.download_url ?? row.update_url ?? null,
  update_url: row.update_url ?? row.download_url ?? null,
  release_notes: row.release_notes ?? null,
  is_required: asBoolean(row.is_required, false),
  is_active: asBoolean(row.is_active, true),
  created_at: row.created_at ?? null,
  updated_at: row.updated_at ?? null,
});

const handleLatestAppVersion = async (request: Request) => {
  const platform = normalizeAppPlatform(getUrl(request).searchParams.get("platform"));
  const eligiblePlatforms = platform === "all" ? ["all"] : [platform, "all"];
  const { data, error } = await supabaseAdmin
    .from("app_versions")
    .select("*")
    .eq("is_active", true)
    .in("platform", eligiblePlatforms)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return jsonResponse(null);
  return jsonResponse(serializeAppVersion(data as JsonRecord));
};

const handleCreateAppVersion = async (request: Request) => {
  await requireAdminProfile(request);
  const body = await readJson(request);
  const version = cleanString(body.version);
  if (!version) return errorResponse("Version is required.");
  const downloadUrl = cleanString(body.download_url) || cleanString(body.update_url) || null;

  const payload = {
    version,
    platform: normalizeAppPlatform(body.platform),
    build_number: asNullableNumber(body.build_number),
    release_notes: body.release_notes ?? null,
    download_url: downloadUrl,
    update_url: downloadUrl,
    is_required: asBoolean(body.is_required, false),
    is_active: asBoolean(body.is_active, true),
    updated_at: nowIso(),
  };

  const { data, error } = await supabaseAdmin.from("app_versions").insert(payload).select("*").single();
  if (error) throw error;
  return jsonResponse(serializeAppVersion(data as JsonRecord));
};

const handleUpdateAppVersion = async (request: Request, versionId: string) => {
  await requireAdminProfile(request);
  const body = await readJson(request);
  const updates: JsonRecord = { updated_at: nowIso() };

  if ("version" in body) updates.version = cleanString(body.version);
  if ("platform" in body) updates.platform = normalizeAppPlatform(body.platform);
  if ("build_number" in body) updates.build_number = asNullableNumber(body.build_number);
  if ("release_notes" in body) updates.release_notes = body.release_notes ?? null;
  if ("download_url" in body || "update_url" in body) {
    const downloadUrl = cleanString(body.download_url) || cleanString(body.update_url) || null;
    updates.download_url = downloadUrl;
    updates.update_url = downloadUrl;
  }
  if ("is_required" in body) updates.is_required = asBoolean(body.is_required, false);
  if ("is_active" in body) updates.is_active = asBoolean(body.is_active, true);

  const { data, error } = await supabaseAdmin
    .from("app_versions")
    .update(updates)
    .eq("id", versionId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) return notFound("App version");
  return jsonResponse(serializeAppVersion(data as JsonRecord));
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
const KARMA_REDEMPTION_TARGET = 100;
const KARMA_POINT_VALUE = 1;
const KARMA_MAX_ORDER_DISCOUNT_RATE = 0.20;
const KARMA_CASE_REPORT_REWARD = 10;
const KARMA_CASE_COMMENT_REWARD = 2;

const normalizeStatus = (value: unknown) => cleanString(value).toLowerCase();

const isPaidOrderStatus = (status: unknown) => PAID_ORDER_STATES.has(normalizeStatus(status));

const calculateKarmaReward = (amount: unknown) => {
  const value = asNumber(amount);
  if (value <= 0) return 0;
  return Math.min(500, Math.max(5, Math.floor(value / 100)));
};

const calculateKarmaRedemption = (profile: JsonRecord, orderTotal: unknown, requestedPoints: unknown) => {
  const requested = Math.floor(asNumber(requestedPoints));
  if (requested <= 0) return { pointsRedeemed: 0, discountAmount: 0 };

  const available = Math.floor(asNumber(profile.available_karma));
  if (available < KARMA_REDEMPTION_TARGET) {
    throw new Response(`You need at least ${KARMA_REDEMPTION_TARGET} points before redeeming a discount.`, { status: 400 });
  }
  if (requested < KARMA_REDEMPTION_TARGET) {
    throw new Response(`Redeem at least ${KARMA_REDEMPTION_TARGET} points.`, { status: 400 });
  }

  const maxDiscountAmount = Math.max(asNumber(orderTotal) * KARMA_MAX_ORDER_DISCOUNT_RATE, 0);
  const maxPointsForOrder = Math.floor(maxDiscountAmount / KARMA_POINT_VALUE);
  const pointsRedeemed = Math.min(requested, available, maxPointsForOrder);
  if (pointsRedeemed < KARMA_REDEMPTION_TARGET) {
    throw new Response(`This order can only use discounts from ${KARMA_REDEMPTION_TARGET} points or more.`, { status: 400 });
  }

  return {
    pointsRedeemed,
    discountAmount: Math.round(pointsRedeemed * KARMA_POINT_VALUE * 100) / 100,
  };
};

const awardKarma = async (userId: unknown, amount: number, category: string, description: string) => {
  const id = cleanString(userId);
  const points = Math.trunc(amount);
  if (!id || !points) return;

  const user = await fetchUserFull(id);
  if (!user) return;

  const updates: JsonRecord = {
    available_karma: Math.max(asNumber(user.available_karma) + points, 0),
    updated_at: nowIso(),
  };
  if (points > 0) updates.karma_points = asNumber(user.karma_points) + points;

  const { error: userError } = await supabaseAdmin.from("users").update(updates).eq("id", id);
  if (userError) throw userError;

  const { error: txError } = await supabaseAdmin.from("karma_transactions").insert({
    user_id: id,
    amount: points,
    category,
    description,
  });
  if (txError) throw txError;
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
  const buyerReward = calculateKarmaReward(order.amount);
  if (buyerReward) {
    await awardKarma(order.buyer_id, buyerReward, "purchase", `Earned for purchase: ${cleanString(service.title) || "Marketplace item"}`);
  }
  const sellerReward = calculateKarmaReward(order.payout);
  if (service.provider_id && sellerReward) {
    await awardKarma(service.provider_id, sellerReward, "sale", `Earned for sale: ${cleanString(service.title) || "Marketplace item"}`);
  }
  return true;
};

const markRegistrationPaid = async (registration: JsonRecord, trackingId?: string) => {
  if (normalizeStatus(registration.payment_status) === "paid") return false;
  const event = await selectSingle("events", cleanString(registration.event_id), "Event");
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
  await createNotification(registration.user_id, "Event payment confirmed", `Your payment for '${cleanString(event.title) || "this event"}' is confirmed. Your ticket is ready.`, "event", {
    target_type: "event",
    target_id: registration.event_id,
    target_route: "EventDetail",
  });
  const reward = calculateKarmaReward(registration.amount);
  if (reward) {
    await awardKarma(registration.user_id, reward, "event_registration", `Registered for paid event: ${cleanString(event.title) || "Event"}`);
  }
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

const handleSubmitRating = async (request: Request) => {
  const { profile } = await requireProfile(request);
  const body = await readJson(request);
  const orderId = cleanString(body.order_id);
  const order = await selectSingle("orders", orderId, "Order");
  if (cleanString(order.buyer_id) !== cleanString(profile.id)) {
    throw new Response("Only the buyer can rate this service", { status: 403 });
  }
  if (!isPaidOrderStatus(order.status)) {
    return errorResponse("Can only rate completed/paid services");
  }

  const service = await selectSingle("services", cleanString(order.service_id), "Service");
  const ratedId = cleanString(body.rated_id) || cleanString(service.provider_id);
  if (cleanString(service.provider_id) !== ratedId) {
    return errorResponse("Rating target does not match the service provider.");
  }

  const score = Math.round(asNumber(body.score));
  if (score < 1 || score > 5) {
    return errorResponse("Rating score must be between 1 and 5.");
  }

  const { data: existingRating, error: existingError } = await supabaseAdmin
    .from("ratings")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existingRating) return errorResponse("Order already rated");

  const { data, error } = await supabaseAdmin
    .from("ratings")
    .insert({
      order_id: orderId,
      rater_id: cleanString(profile.id),
      rated_id: ratedId,
      score,
      comment: body.comment ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;

  const { data: ratings, error: ratingsError } = await supabaseAdmin
    .from("ratings")
    .select("score")
    .eq("rated_id", ratedId);
  if (ratingsError) throw ratingsError;
  const scores = (ratings ?? []).map((rating) => asNumber((rating as JsonRecord).score)).filter((value) => value > 0);
  const totalRatings = scores.length;
  const averageRating = totalRatings
    ? Math.round((scores.reduce((sum, value) => sum + value, 0) / totalRatings) * 10) / 10
    : 0;
  const { error: userError } = await supabaseAdmin
    .from("users")
    .update({ average_rating: averageRating, total_ratings: totalRatings, updated_at: nowIso() })
    .eq("id", ratedId);
  if (userError) throw userError;

  return jsonResponse(data, 201);
};

const handleUserRatings = async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from("ratings")
    .select("*")
    .eq("rated_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const ratings = (data ?? []) as JsonRecord[];
  if (!ratings.length) {
    return jsonResponse({ average_score: 0, count: 0, ratings: [] });
  }

  const raterIds = uniqueStrings(ratings.map((rating) => rating.rater_id));
  const raters = new Map<string, JsonRecord>();
  if (raterIds.length) {
    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id,full_name")
      .in("id", raterIds);
    if (usersError) throw usersError;
    for (const user of users ?? []) raters.set(cleanString((user as JsonRecord).id), user as JsonRecord);
  }

  const scores = ratings.map((rating) => asNumber(rating.score)).filter((value) => value > 0);
  const averageScore = scores.length
    ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10
    : 0;
  return jsonResponse({
    average_score: averageScore,
    count: ratings.length,
    ratings: ratings.map((rating) => ({
      score: asNumber(rating.score),
      comment: rating.comment ?? null,
      created_at: rating.created_at ?? null,
      rater_name: raters.get(cleanString(rating.rater_id))?.full_name ?? null,
    })),
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

const csvCell = (value: unknown) => {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const csvExportResponse = (type: string, rows: JsonRecord[]) => {
  const headerSet = new Set<string>();
  for (const row of rows) {
    Object.keys(row).forEach((key) => headerSet.add(key));
  }
  const headers = Array.from(headerSet);
  const csvRows = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ];
  const today = new Date().toISOString().split("T")[0];
  return fileResponse(`\ufeff${csvRows.join("\r\n")}`, "text/csv; charset=utf-8", `ld360_${safeFileSlug(type)}_${today}.csv`);
};

const handleAdminExport = async (request: Request) => {
  await requireAdminProfile(request);
  const url = getUrl(request);
  const type = cleanString(url.searchParams.get("type"));
  const eventId = cleanString(url.searchParams.get("event_id"));
  const tableByType: Record<string, string> = {
    users: "users",
    orders: "orders",
    registrations: "registrations",
    events: "events",
    dogs: "dogs",
    cases: "case_reports",
    community: "community_messages",
    support: "support_tickets",
    scorecard: "events",
  };
  const table = tableByType[type];
  if (!table) return errorResponse(`Unsupported export type: ${type}`, 400);

  let query = supabaseAdmin.from(table).select("*");
  if (type === "registrations" && eventId) query = query.eq("event_id", eventId);
  if (type === "scorecard") {
    query = query
      .select("id,title,start_time,location,scorecard_enabled,scorecard_title,scorecard_description,follow_up_requested_at,created_at");
    if (eventId) query = query.eq("id", eventId);
  }
  const { data, error } = await query;
  if (error) throw error;

  return csvExportResponse(type, (data ?? []) as JsonRecord[]);
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

const saveContentPin = async (payload: JsonRecord) => {
  const targetType = cleanString(payload.target_type);
  const targetId = cleanString(payload.target_id);
  if (!targetType || !targetId) {
    throw new Response("target_type and target_id are required.", { status: 400 });
  }

  const pinPayload = {
    target_type: targetType,
    target_id: targetId,
    title: cleanString(payload.title) || "Pinned content",
    description: payload.description ?? null,
    image_url: payload.image_url ?? null,
    priority: asNumber(payload.priority, 100),
    is_active: true,
    expires_at: payload.expires_at ?? null,
    created_by_id: cleanString(payload.created_by_id) || null,
    updated_at: nowIso(),
  };

  const { data: updatedRows, error: updateError } = await supabaseAdmin
    .from("content_pins")
    .update(pinPayload)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .select("*");
  if (updateError) throw updateError;

  const updatedPin = ((updatedRows ?? []) as JsonRecord[])[0];
  if (updatedPin) return updatedPin;

  const { data, error } = await supabaseAdmin
    .from("content_pins")
    .insert(pinPayload)
    .select("*")
    .single();
  if (error) throw error;
  return data as JsonRecord;
};

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

const handleAdminCreateUser = async (request: Request) => {
  await requireAdminProfile(request);
  const body = await readJson(request);
  const email = cleanString(body.email).toLowerCase();
  const password = cleanString(body.password);
  const requestedRole = cleanString(body.role);
  const role = ["buyer", "provider", "admin"].includes(requestedRole) ? requestedRole : "buyer";

  if (!email || !password) return errorResponse("Email and password are required.");
  if (password.length < 8) return errorResponse("Password must be at least 8 characters.");

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return errorResponse("Email already registered");

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: cleanString(body.full_name),
      role,
    },
    app_metadata: role === "admin" ? { role } : undefined,
  });
  if (error || !data.user) return errorResponse(error?.message || "User creation failed.", 400);

  const profile = await upsertProfile(data.user as unknown as JsonRecord, {
    email,
    full_name: body.full_name,
    role,
    phone_number: body.phone_number,
    country: body.country,
    language: body.language,
    bio: body.bio,
    auth_provider: "email",
  });
  return jsonResponse(serializeUser(profile, data.user as unknown as JsonRecord), 201);
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
      .update({
        admin_approved: isApproved,
        is_published: isApproved,
        rejection_reason: isApproved ? null : reason,
        updated_at: nowIso(),
      })
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
  const data = await saveContentPin({
    target_type: targetType,
    target_id: targetId,
    title: cleanString(body.title) || "Pinned content",
    description: body.description ?? null,
    image_url: body.image_url ?? null,
    priority: asNumber(body.priority, 100),
    expires_at: body.expires_at ?? null,
    created_by_id: cleanString(profile.id),
  });
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

const hasOwn = (record: JsonRecord, key: string) => Object.prototype.hasOwnProperty.call(record, key);

const valueWithExistingFallback = (
  values: JsonRecord,
  existing: JsonRecord | null,
  key: string,
  fallback: unknown = null,
) => (hasOwn(values, key) ? values[key] ?? null : existing?.[key] ?? fallback);

const upsertProfile = async (authUser: JsonRecord, values: JsonRecord = {}) => {
  const userId = cleanString(authUser.id);
  const existing = userId ? await getProfile(userId) : null;
  const metadata = (authUser.user_metadata as JsonRecord | undefined) ?? {};
  const trustedAuthRole = getTrustedAuthRole(authUser);
  const provider =
    cleanString(values.auth_provider) ||
    cleanString(existing?.auth_provider) ||
    cleanString(metadata.provider) ||
    cleanString((authUser.app_metadata as JsonRecord | undefined)?.provider) ||
    "email";

  const payload = {
    id: userId,
    email: cleanString(values.email) || cleanString(existing?.email) || cleanString(authUser.email),
    full_name:
      cleanString(values.full_name) ||
      cleanString(existing?.full_name) ||
      cleanString(metadata.full_name) ||
      cleanString(metadata.name) ||
      cleanString(authUser.email),
    role: cleanString(values.role) || trustedAuthRole || cleanString(existing?.role) || "buyer",
    auth_provider: provider,
    google_id: valueWithExistingFallback(values, existing, "google_id", metadata.sub ?? null),
    phone_number: valueWithExistingFallback(values, existing, "phone_number"),
    country: valueWithExistingFallback(values, existing, "country"),
    language: cleanString(values.language) || cleanString(existing?.language) || "en",
    bio: valueWithExistingFallback(values, existing, "bio"),
    latitude: valueWithExistingFallback(values, existing, "latitude"),
    longitude: valueWithExistingFallback(values, existing, "longitude"),
    location_accuracy_meters: valueWithExistingFallback(values, existing, "location_accuracy_meters"),
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

const getGoogleIdentity = (authUser: JsonRecord) =>
  asArray(authUser.identities).filter(isRecord).find((identity) => cleanString(identity.provider) === "google");

const getGoogleIdFromAuthUser = (authUser: JsonRecord) => {
  const metadata = (authUser.user_metadata as JsonRecord | undefined) ?? {};
  const googleIdentity = getGoogleIdentity(authUser);
  const identityData = (googleIdentity?.identity_data as JsonRecord | undefined) ?? {};

  return (
    cleanString(metadata.sub) ||
    cleanString(metadata.provider_id) ||
    cleanString(identityData.sub) ||
    cleanString(identityData.provider_id) ||
    cleanString(googleIdentity?.id)
  );
};

const authUserHasGoogleProvider = (authUser: JsonRecord) => {
  const appMetadata = (authUser.app_metadata as JsonRecord | undefined) ?? {};
  const metadata = (authUser.user_metadata as JsonRecord | undefined) ?? {};
  const providers = asStringArray(appMetadata.providers).map((provider) => provider.toLowerCase());

  return (
    cleanString(appMetadata.provider) === "google" ||
    cleanString(metadata.provider) === "google" ||
    providers.includes("google") ||
    Boolean(getGoogleIdentity(authUser))
  );
};

const syncProfileWithAuthIdentity = async (profile: JsonRecord, authUser: JsonRecord) => {
  const googleId = getGoogleIdFromAuthUser(authUser);
  const trustedAuthRole = getTrustedAuthRole(authUser);
  if (!authUserHasGoogleProvider(authUser) && !googleId && !trustedAuthRole) return profile;

  const metadata = (authUser.user_metadata as JsonRecord | undefined) ?? {};
  const updates: JsonRecord = {};

  if (trustedAuthRole && cleanString(profile.role) !== trustedAuthRole) {
    updates.role = trustedAuthRole;
  }

  if (cleanString(profile.auth_provider) !== "google") {
    updates.auth_provider = "google";
  }

  if (googleId && cleanString(profile.google_id) !== googleId) {
    updates.google_id = googleId;
  }

  const fullName = cleanString(metadata.full_name) || cleanString(metadata.name);
  if (!cleanString(profile.full_name) && fullName) {
    updates.full_name = fullName;
  }

  if (!Object.keys(updates).length) return profile;

  updates.updated_at = nowIso();
  const { data, error } = await supabaseAdmin
    .from("users")
    .update(updates)
    .eq("id", cleanString(profile.id))
    .select("*")
    .single();

  if (error) throw error;
  return data as JsonRecord;
};

const getOrCreateProfileForAuthUser = async (authUser: JsonRecord) => {
  const profile = (await getProfile(cleanString(authUser.id))) ?? await upsertProfile(authUser);
  return syncProfileWithAuthIdentity(profile, authUser);
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
  const profile = await getOrCreateProfileForAuthUser(authUser as unknown as JsonRecord);
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
  if (method === "POST" && path === "/dogs/identify") return handleDogIdentify(request);
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
  if (method === "GET" && /^\/services\/[^/]+\/responses$/.test(path)) return handleServiceResponses(request, firstPathMatch(path, /^\/services\/([^/]+)\/responses$/));
  if (method === "GET" && /^\/services\/[^/]+$/.test(path)) return handleGetService(request, firstPathMatch(path, /^\/services\/([^/]+)$/));
  if (method === "PUT" && /^\/services\/[^/]+$/.test(path)) return handleUpdateService(request, firstPathMatch(path, /^\/services\/([^/]+)$/));
  if (method === "DELETE" && /^\/services\/[^/]+$/.test(path)) return handleDeleteService(request, firstPathMatch(path, /^\/services\/([^/]+)$/));

  if (method === "GET" && path === "/cases") return handleListCases(request);
  if (method === "POST" && path === "/cases") return handleCreateCase(request);
  if (method === "GET" && /^\/cases\/[^/]+\/comments$/.test(path)) return handleCaseComments(request, firstPathMatch(path, /^\/cases\/([^/]+)\/comments$/));
  if (method === "POST" && /^\/cases\/[^/]+\/comments$/.test(path)) return handleCaseComments(request, firstPathMatch(path, /^\/cases\/([^/]+)\/comments$/));
  if (method === "POST" && /^\/cases\/[^/]+\/like$/.test(path)) return handleCaseLike(request, firstPathMatch(path, /^\/cases\/([^/]+)\/like$/));
  if (method === "GET" && /^\/cases\/[^/]+\/matches$/.test(path)) return handleCaseMatches(request, firstPathMatch(path, /^\/cases\/([^/]+)\/matches$/));
  if (method === "POST" && /^\/cases\/[^/]+\/matches\/refresh$/.test(path)) return handleRefreshCaseMatches(request, firstPathMatch(path, /^\/cases\/([^/]+)\/matches\/refresh$/));
  if (method === "POST" && /^\/cases\/[^/]+\/matches\/[^/]+$/.test(path)) {
    const match = path.match(/^\/cases\/([^/]+)\/matches\/([^/]+)$/);
    return handleUpdateCaseMatchStatus(request, match?.[1] ?? "", match?.[2] ?? "");
  }
  if (method === "POST" && /^\/cases\/[^/]+\/flag$/.test(path)) return jsonResponse({ message: "Report submitted successfully. Our moderation team will review this post." });
  if (method === "GET" && /^\/cases\/[^/]+$/.test(path)) return handleGetCase(request, firstPathMatch(path, /^\/cases\/([^/]+)$/));

  if (method === "GET" && path === "/events") return handleListEvents();
  if (method === "POST" && path === "/events") return handleCreateEvent(request);
  if (method === "GET" && path === "/my-registrations") return handleMyRegistrations(request);
  if (method === "GET" && path === "/saved-events") return handleSavedEvents(request);
  if (method === "POST" && /^\/events\/[^/]+\/register$/.test(path)) return handleRegisterEvent(request, firstPathMatch(path, /^\/events\/([^/]+)\/register$/));
  if (method === "POST" && /^\/events\/[^/]+\/save$/.test(path)) return handleSaveEvent(request, firstPathMatch(path, /^\/events\/([^/]+)\/save$/));
  if (/^\/events\/[^/]+\/form-fields$/.test(path) && (method === "GET" || method === "POST")) {
    return handleEventFormFields(request, firstPathMatch(path, /^\/events\/([^/]+)\/form-fields$/));
  }
  if (method === "GET" && /^\/events\/[^/]+\/responses$/.test(path)) return handleEventResponses(request, firstPathMatch(path, /^\/events\/([^/]+)\/responses$/));
  if (method === "GET" && /^\/events\/[^/]+\/journey$/.test(path)) return handleProgramJourney(request, firstPathMatch(path, /^\/events\/([^/]+)\/journey$/));
  if (method === "POST" && /^\/events\/[^/]+\/sync$/.test(path)) return handleEventSync(request, firstPathMatch(path, /^\/events\/([^/]+)\/sync$/));
  if (method === "POST" && /^\/events\/[^/]+\/live-log$/.test(path)) return handleLiveLog(request, firstPathMatch(path, /^\/events\/([^/]+)\/live-log$/));
  if (method === "POST" && /^\/events\/[^/]+\/scorecard\/surveys$/.test(path)) return handleSubmitScorecardSurvey(request, firstPathMatch(path, /^\/events\/([^/]+)\/scorecard\/surveys$/));
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
  if (method === "GET" && /^\/orders\/[^/]+\/receipt$/.test(path)) return handleOrderReceipt(request, firstPathMatch(path, /^\/orders\/([^/]+)\/receipt$/));
  if (method === "POST" && path === "/payments/initiate") return handleInitiatePayment(request);
  if (method === "GET" && /^\/payments\/status\/[^/]+$/.test(path)) return handlePaymentStatus(request, firstPathMatch(path, /^\/payments\/status\/([^/]+)$/));
  if (method === "GET" && path === "/pesapal/callback") return handlePesapalCallback(request);
  if (method === "GET" && path === "/pesapal/ipn") return handlePesapalIpn(request);
  if (method === "POST" && path === "/ratings") return handleSubmitRating(request);
  if (method === "GET" && /^\/users\/[^/]+\/ratings$/.test(path)) return handleUserRatings(firstPathMatch(path, /^\/users\/([^/]+)\/ratings$/));
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
  if (method === "GET" && path === "/chat/trending-tags") return handleTrendingTags();
  if (method === "POST" && /^\/chat\/messages\/[^/]+\/flag$/.test(path)) return handleCommunityFlag(request, firstPathMatch(path, /^\/chat\/messages\/([^/]+)\/flag$/));
  if (method === "POST" && /^\/chat\/messages\/[^/]+\/react$/.test(path)) return handleCommunityReaction(request, firstPathMatch(path, /^\/chat\/messages\/([^/]+)\/react$/));
  if (method === "POST" && /^\/chat\/messages\/[^/]+\/vote$/.test(path)) return handleCommunityVote(request, firstPathMatch(path, /^\/chat\/messages\/([^/]+)\/vote$/));
  if ((method === "GET" || method === "POST") && (path === "/chat/dms" || path === "/chat/dm")) return handleDirectMessages(request);
  if (method === "POST" && /^\/chat\/dms\/[^/]+\/read$/.test(path)) return handleDirectMessageRead(request, firstPathMatch(path, /^\/chat\/dms\/([^/]+)\/read$/));
  if (method === "POST" && path === "/users/status/heartbeat") return handleHeartbeat(request);
  if (method === "GET" && path === "/users/online") return handleOnlineUsers();
  if (method === "POST" && /^\/users\/[^/]+\/block$/.test(path)) return handleUserBlock(request, firstPathMatch(path, /^\/users\/([^/]+)\/block$/));
  if (method === "GET" && path === "/users/search") return handleUserSearch(request);

  if (method === "GET" && path === "/health/summary") return handleHealthSummary(request);
  if (method === "GET" && path === "/health/wellness-score") return handleWellnessScore(request);
  if (method === "GET" && /^\/health\/advisor\/[^/]+$/.test(path)) return handleHealthAdvisor(request, firstPathMatch(path, /^\/health\/advisor\/([^/]+)$/));
  if (method === "GET" && path === "/scorecard/questions") return handleScorecardQuestions(request);
  if (method === "GET" && path === "/app/version/latest") return handleLatestAppVersion(request);
  if (method === "POST" && path === "/app/version") return handleCreateAppVersion(request);
  if (method === "PUT" && /^\/app\/version\/[^/]+$/.test(path)) return handleUpdateAppVersion(request, firstPathMatch(path, /^\/app\/version\/([^/]+)$/));

  if (method === "GET" && path === "/admin/analytics") return handleAdminAnalytics(request);
  if (method === "GET" && path === "/admin/stats") return handleAdminAnalytics(request);
  if (method === "GET" && path === "/admin/users") return handleAdminUsers(request);
  if (method === "POST" && path === "/admin/users") return handleAdminCreateUser(request);
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
  if (method === "GET" && path === "/admin/scorecard/events") return handleAdminScorecardEvents(request);
  if (method === "GET" && /^\/admin\/scorecard\/[^/]+\/dashboard$/.test(path)) return handleAdminScorecardDashboard(request, firstPathMatch(path, /^\/admin\/scorecard\/([^/]+)\/dashboard$/));
  if (method === "POST" && /^\/admin\/scorecard\/[^/]+\/prompt-followup$/.test(path)) return handleAdminPromptScorecardFollowup(request, firstPathMatch(path, /^\/admin\/scorecard\/([^/]+)\/prompt-followup$/));
  if (method === "POST" && /^\/admin\/scorecard\/[^/]+\/evidence$/.test(path)) return handleAdminScorecardEvidence(request, firstPathMatch(path, /^\/admin\/scorecard\/([^/]+)\/evidence$/));
  if (method === "POST" && /^\/admin\/scorecard\/[^/]+\/reporting$/.test(path)) return handleAdminScorecardReporting(request, firstPathMatch(path, /^\/admin\/scorecard\/([^/]+)\/reporting$/));
  if (method === "GET" && path === "/admin/export") return handleAdminExport(request);

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
