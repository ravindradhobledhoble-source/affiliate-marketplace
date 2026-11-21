
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    try {
      if (path === "/api/products" && request.method === "GET") {
        if (!env.DB) {
          return Response.json(
            { success: false, error: "D1 binding DB missing" },
            { status: 500, headers }
          );
        }

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

        let sql = `
          SELECT *
          FROM products
          WHERE is_active = 1
        `;

        const params = [];

        if (search) {
          sql += ` AND (product_name LIKE ? OR brand LIKE ?)`;
          params.push(`%${search}%`, `%${search}%`);
        }

        if (category) {
          sql += ` AND category = ?`;
          params.push(category);
        }

        if (platform) {
          sql += ` AND affiliate_platform = ?`;
          params.push(platform);
        }

        if (type) {
          sql += ` AND product_type = ?`;
          params.push(type);
        }

        sql += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const result = await env.DB.prepare(sql)
          .bind(...params)
          .all();

        const count = await env.DB.prepare(
          `SELECT COUNT(*) AS total
           FROM products
           WHERE is_active = 1`
        ).first();

        return Response.json({
          success: true,
          total: count.total,
          count: result.results.length,
          products: result.results
        }, { headers });
      }

      if (path === "/api/categories" && request.method === "GET") {
        const result = await env.DB.prepare(
          `SELECT * FROM categories
           WHERE is_active = 1
           ORDER BY sort_order ASC`
        ).all();

        return Response.json({
          success: true,
          categories: result.results
        }, { headers });
      }

      if (path.startsWith("/api/")) {
        return Response.json(
          { success: false, error: "API route not found" },
          { status: 404, headers }
        );
      }

      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return new Response("Website assets not configured", {
        status: 404
      });

    } catch (error) {
      return Response.json({
        success: false,
        error: error.message
      }, { status: 500, headers });
    }
  }
};
