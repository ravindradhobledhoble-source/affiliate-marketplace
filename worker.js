
function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers });
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(value.trim());
      if (row.some(cell => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += ch;
    }
  }

  row.push(value.trim());
  if (row.some(cell => cell !== "")) rows.push(row);

  if (rows.length < 2) {
    throw new Error("CSV में Header और कम से कम एक Product होना चाहिए");
  }

  const headers = rows[0].map(h => h.trim().toLowerCase());

  return rows.slice(1).map(cells => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = cells[index] ?? "";
    });
    return item;
  });
}

const PRODUCT_COLUMNS = [
  "source_position",
  "brand",
  "product_name",
  "price_text",
  "price_value",
  "original_price_text",
  "original_price_value",
  "discount_text",
  "badge",
  "profit_link",
  "image_url",
  "category",
  "subcategory",
  "product_type",
  "affiliate_platform",
  "product_category",
  "is_active",
  "rating",
  "reviews_count"
];

function cleanProduct(input) {
  const product = {};

  for (const key of PRODUCT_COLUMNS) {
    if (input[key] !== undefined) {
      product[key] = input[key];
    }
  }

  product.product_name = String(product.product_name || "").trim();

  if (!product.product_name) {
    throw new Error("Product Name जरूरी है");
  }

  for (const key of [
    "price_value",
    "original_price_value",
    "rating",
    "reviews_count",
    "source_position",
    "is_active"
  ]) {
    if (product[key] !== undefined && product[key] !== "") {
      const number = Number(product[key]);

      if (!Number.isFinite(number)) {
        throw new Error("गलत numeric value: " + key);
      }

      product[key] = number;
    } else if (product[key] === "") {
      product[key] = null;
    }
  }

  product.is_active = product.is_active ?? 1;

  return product;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    try {
      if (!env.DB) {
        return json({
          success: false,
          error: "D1 binding DB missing"
        }, 500, headers);
      }

      // PRODUCTS API
      if (path === "/api/products" && request.method === "GET") {
        const limit = Math.min(
          Math.max(Number(url.searchParams.get("limit")) || 20, 1),
          100
        );

        const offset = Math.max(
          Number(url.searchParams.get("offset")) || 0,
          0
        );

        const search = url.searchParams.get("search") || "";
        const category = url.searchParams.get("category") || "";
        const platform = url.searchParams.get("platform") || "";
        const type = url.searchParams.get("type") || "";

        let where = " WHERE is_active = 1 ";
        const params = [];

        if (search) {
          where += " AND (product_name LIKE ? OR brand LIKE ?) ";
          params.push(`%${search}%`, `%${search}%`);
        }

        if (category) {
          where += " AND category = ? ";
          params.push(category);
        }

        if (platform) {
          where += " AND affiliate_platform = ? ";
          params.push(platform);
        }

        if (type) {
          where += " AND product_type = ? ";
          params.push(type);
        }

        const result = await env.DB.prepare(
          `SELECT * FROM products ${where}
           ORDER BY id DESC LIMIT ? OFFSET ?`
        ).bind(...params, limit, offset).all();

        const count = await env.DB.prepare(
          `SELECT COUNT(*) AS total FROM products ${where}`
        ).bind(...params).first();

        return json({
          success: true,
          total: count?.total || 0,
          count: result.results.length,
          products: result.results
        }, 200, headers);
      }

      // CATEGORIES API
      if (path === "/api/categories" && request.method === "GET") {
        const result = await env.DB.prepare(
          `SELECT * FROM categories
           WHERE is_active = 1
           ORDER BY sort_order ASC`
        ).all();

        return json({
          success: true,
          categories: result.results
        }, 200, headers);
      }

      // ADMIN AUTHENTICATION
      const adminRoutes = [
        "/api/admin/products",
        "/api/admin/import-csv"
      ];

      if (adminRoutes.includes(path)) {
        if (!env.ADMIN_SECRET) {
          return json({
            success: false,
            error: "ADMIN_SECRET is not configured"
          }, 503, headers);
        }

        const suppliedSecret =
          request.headers.get("X-Admin-Secret") ||
          (request.headers.get("Authorization") || "")
            .replace(/^Bearer\s+/i, "");

        if (suppliedSecret !== env.ADMIN_SECRET) {
          return json({
            success: false,
            error: "Unauthorized: Admin Secret गलत है"
          }, 401, headers);
        }
      }

      // ADD SINGLE PRODUCT
      if (path === "/api/admin/products" && request.method === "POST") {
        const input = await request.json();
        const product = cleanProduct(input);

        if (product.profit_link) {
          const duplicate = await env.DB.prepare(
            "SELECT id FROM products WHERE profit_link = ? LIMIT 1"
          ).bind(product.profit_link).first();

          if (duplicate) {
            return json({
              success: false,
              duplicate: true,
              error: "यह Affiliate Link वाला Product पहले से मौजूद है",
              existing_id: duplicate.id
            }, 409, headers);
          }
        }

        const columns = Object.keys(product);
        const placeholders = columns.map(() => "?").join(", ");
        const values = columns.map(key => product[key]);

        const result = await env.DB.prepare(
          `INSERT INTO products (${columns.join(", ")})
           VALUES (${placeholders})`
        ).bind(...values).run();

        return json({
          success: true,
          message: "Product सफलतापूर्वक Save हो गया",
          product_id: result.meta?.last_row_id
        }, 201, headers);
      }

      // BULK CSV IMPORT
      if (path === "/api/admin/import-csv" && request.method === "POST") {
        const csvText = await request.text();

        if (!csvText || csvText.length > 5 * 1024 * 1024) {
          return json({
            success: false,
            error: "CSV खाली है या 5 MB से बड़ी है"
          }, 400, headers);
        }

        const rows = parseCSV(csvText);

        if (rows.length > 500) {
          return json({
            success: false,
            error: "एक बार में अधिकतम 500 Products Import कर सकते हैं"
          }, 400, headers);
        }

        const imported = [];
        const duplicates = [];
        const errors = [];

        for (let i = 0; i < rows.length; i++) {
          try {
            const product = cleanProduct(rows[i]);

            if (product.profit_link) {
              const duplicate = await env.DB.prepare(
                "SELECT id FROM products WHERE profit_link = ? LIMIT 1"
              ).bind(product.profit_link).first();

              if (duplicate) {
                duplicates.push({
                  row: i + 2,
                  product: product.product_name,
                  existing_id: duplicate.id
                });
                continue;
              }
            }

            const columns = Object.keys(product);
            const placeholders = columns.map(() => "?").join(", ");
            const values = columns.map(key => product[key]);

            const result = await env.DB.prepare(
              `INSERT INTO products (${columns.join(", ")})
               VALUES (${placeholders})`
            ).bind(...values).run();

            imported.push({
              row: i + 2,
              product: product.product_name,
              id: result.meta?.last_row_id
            });

          } catch (error) {
            errors.push({
              row: i + 2,
              error: error.message
            });
          }
        }

        return json({
          success: true,
          message: "CSV Import पूरा हुआ",
          total_rows: rows.length,
          imported: imported.length,
          duplicates: duplicates.length,
          failed: errors.length,
          imported_products: imported,
          duplicate_products: duplicates,
          errors
        }, 200, headers);
      }

      if (path.startsWith("/api/")) {
        return json({
          success: false,
          error: "API route not found"
        }, 404, headers);
      }

      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return new Response("Website assets not configured", {
        status: 404
      });

    } catch (error) {
      return json({
        success: false,
        error: error.message
      }, 500, headers);
    }
  }
};
// Admin Secret deployment update
