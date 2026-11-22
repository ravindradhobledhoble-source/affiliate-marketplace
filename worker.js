function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers });
}

function parseCSV(text) {
  const rows = [];
  let row = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      row.push(value.trim()); value = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(value.trim());
      if (row.some(cell => cell !== "")) rows.push(row);
      row = []; value = "";
    } else value += ch;
  }
  row.push(value.trim());
  if (row.some(cell => cell !== "")) rows.push(row);
  if (rows.length < 2) throw new Error("CSV में Header और कम से कम एक Product होना चाहिए");
  const headers = rows[0].map(h => h.trim().toLowerCase());
  return rows.slice(1).map(cells => {
    const item = {};
    headers.forEach((header, index) => item[header] = cells[index] ?? "");
    return item;
  });
}

function cleanProduct(input) {
  const p = { ...input };
  const aliases = {
    product_name: ["name"],
    product_url: ["product_link", "original_product_url", "source_url"],
    profit_link: ["affiliate_link", "affiliate_url", "profit_url"],
    price_text: ["price"],
    price_value: ["offer_price", "current_price"],
    original_price_value: ["mrp", "original_price"],
    discount_text: ["discount"]
  };
  for (const [key, names] of Object.entries(aliases)) {
    if (p[key] === undefined || p[key] === "") {
      for (const alias of names) {
        if (p[alias] !== undefined && p[alias] !== "") { p[key] = p[alias]; break; }
      }
    }
  }
  p.product_name = String(p.product_name || "").trim();
  p.product_url = String(p.product_url || "").trim();
  p.profit_link = String(p.profit_link || "").trim();
  if (!p.product_name) throw new Error("Product Name जरूरी है");
  if (!p.product_url) throw new Error("Product URL जरूरी है। Jiomart/Amazon/Flipkart का Original Product Link भरें।");
  for (const key of ["price_value", "original_price_value", "rating", "review_count", "reviews_count", "is_active"]) {
    if (p[key] !== undefined && p[key] !== "") {
      const n = Number(p[key]);
      if (!Number.isFinite(n)) throw new Error("गलत numeric value: " + key);
      p[key] = n;
    } else if (p[key] === "") p[key] = null;
  }
  p.is_active = p.is_active ?? 1;
  return p;
}

async function productTableColumns(db) {
  const info = await db.prepare("PRAGMA table_info(products)").all();
  return new Set((info.results || []).map(c => c.name));
}

function toDatabaseRow(p, columns) {
  const row = {
    product_name: p.product_name,
    brand: p.brand || null,
    category: p.category || null,
    subcategory: p.subcategory || null,
    product_type: p.product_type || "Physical",
    affiliate_platform: p.affiliate_platform || p.platform || null,
    product_url: p.product_url,
    profit_link: p.profit_link || null,
    profit_url: p.profit_link || null,
    image_url: p.image_url || null,
    video_url: p.video_url || null,
    image_size: p.image_size || null,
    price_text: p.price_text || null,
    price_value: p.price_value ?? null,
    original_price_value: p.original_price_value ?? null,
    discount_text: p.discount_text || null,
    price: p.price_value ?? null,
    offer_price: p.price_value ?? null,
    mrp: p.original_price_value ?? null,
    discount: p.discount_text || null,
    rating: p.rating ?? null,
    review_count: p.review_count ?? p.reviews_count ?? 0,
    reviews_count: p.review_count ?? p.reviews_count ?? 0,
    is_active: p.is_active
  };
  return Object.fromEntries(Object.entries(row).filter(([key, value]) =>
    columns.has(key) && value !== undefined
  ));
}

async function insertProduct(db, p, columns) {
  const row = toDatabaseRow(p, columns);
  if (!columns.has("product_url")) {
    throw new Error("D1 products table में product_url column नहीं है। Schema जाँचें।");
  }
  if (!row.product_url) throw new Error("Product URL जरूरी है।");
  const keys = Object.keys(row);
  const marks = keys.map(() => "?").join(", ");
  const result = await db.prepare(
    `INSERT INTO products (${keys.join(", ")}) VALUES (${marks})`
  ).bind(...keys.map(k => row[k])).run();
  return result.meta?.last_row_id;
}

async function findDuplicate(db, p) {
  if (p.profit_link) {
    const d = await db.prepare("SELECT id FROM products WHERE profit_link = ? OR profit_url = ? LIMIT 1")
      .bind(p.profit_link, p.profit_link).first();
    if (d) return d;
  }
  return db.prepare("SELECT id FROM products WHERE product_url = ? LIMIT 1")
    .bind(p.product_url).first();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret"
    };
    if (request.method === "OPTIONS") return new Response(null, { headers });
    try {
      if (!env.DB) return json({ success: false, error: "D1 binding DB missing" }, 500, headers);

      if (path.startsWith("/api/admin/")) {
        if (!env.ADMIN_SECRET) return json({ success: false, error: "ADMIN_SECRET is not configured" }, 503, headers);
        const supplied = request.headers.get("X-Admin-Secret") ||
          (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        if (supplied !== env.ADMIN_SECRET) return json({ success: false, error: "Unauthorized: Admin Secret गलत है" }, 401, headers);
      }

      if (path === "/api/admin/auth" && request.method === "POST") {
        return json({ success: true, message: "Admin authentication successful" }, 200, headers);
      }

      if (path === "/api/products" && request.method === "GET") {
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 100);
        const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);
        const search = url.searchParams.get("search") || "";
        const category = url.searchParams.get("category") || "";
        const platform = url.searchParams.get("platform") || "";
        const type = url.searchParams.get("type") || "";
        let where = " WHERE is_active = 1 ";
        const params = [];
        if (search) { where += " AND (product_name LIKE ? OR brand LIKE ?) "; params.push(`%${search}%`, `%${search}%`); }
        if (category) { where += " AND category = ? "; params.push(category); }
        if (platform) { where += " AND affiliate_platform = ? "; params.push(platform); }
        if (type) { where += " AND product_type = ? "; params.push(type); }
        const result = await env.DB.prepare(`SELECT * FROM products ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
          .bind(...params, limit, offset).all();
        const count = await env.DB.prepare(`SELECT COUNT(*) AS total FROM products ${where}`).bind(...params).first();
        return json({ success: true, total: count?.total || 0, count: result.results.length, products: result.results }, 200, headers);
      }

      if (path === "/api/categories" && request.method === "GET") {
        const result = await env.DB.prepare("SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC").all();
        return json({ success: true, categories: result.results }, 200, headers);
      }

      if (path === "/api/admin/products" && request.method === "POST") {
        const p = cleanProduct(await request.json());
        const duplicate = await findDuplicate(env.DB, p);
        if (duplicate) return json({
          success: false, duplicate: true,
          error: "यह Product URL या Affiliate Link पहले से मौजूद है",
          existing_id: duplicate.id
        }, 409, headers);
        const columns = await productTableColumns(env.DB);
        const id = await insertProduct(env.DB, p, columns);
        return json({ success: true, message: "Product सफलतापूर्वक Save हो गया", product_id: id }, 201, headers);
      }

      if (path === "/api/admin/import-csv" && request.method === "POST") {
        const csvText = await request.text();
        if (!csvText || csvText.length > 5 * 1024 * 1024) {
          return json({ success: false, error: "CSV खाली है या 5 MB से बड़ी है" }, 400, headers);
        }
        const rows = parseCSV(csvText);
        if (rows.length > 500) return json({ success: false, error: "एक बार में अधिकतम 500 Products Import कर सकते हैं" }, 400, headers);
        const columns = await productTableColumns(env.DB);
        const imported = [], duplicates = [], errors = [];
        for (let i = 0; i < rows.length; i++) {
          try {
            const p = cleanProduct(rows[i]);
            const duplicate = await findDuplicate(env.DB, p);
            if (duplicate) {
              duplicates.push({ row: i + 2, product: p.product_name, existing_id: duplicate.id });
              continue;
            }
            const id = await insertProduct(env.DB, p, columns);
            imported.push({ row: i + 2, product: p.product_name, id });
          } catch (error) {
            errors.push({ row: i + 2, error: error.message });
          }
        }
        return json({
          success: true, message: "CSV Import पूरा हुआ", total_rows: rows.length,
          imported: imported.length, duplicates: duplicates.length, failed: errors.length,
          imported_products: imported, duplicate_products: duplicates, errors
        }, 200, headers);
      }

      if (path.startsWith("/api/")) return json({ success: false, error: "API route not found" }, 404, headers);
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response("Website assets not configured", { status: 404 });
    } catch (error) {
      return json({ success: false, error: error.message }, 500, headers);
    }
  }
};
