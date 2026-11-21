
document.addEventListener("DOMContentLoaded", () => {
  const API = "/api";

  const productList = document.getElementById("productList");
  const categoryList = document.getElementById("categoryList");
  const subcategoryList = document.getElementById("subcategoryList");
  const searchForm = document.getElementById("searchForm");
  const searchInput = document.getElementById("searchInput");
  const platformFilter = document.getElementById("platformFilter");
  const typeFilter = document.getElementById("typeFilter");
  const loadMoreButton = document.getElementById("loadMore");

  const PAGE_SIZE = 20;
  let offset = 0;
  let loading = false;
  let hasMore = true;
  let selectedCategory = "";
  let searchText = "";

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function safeURL(value) {
    try {
      const url = new URL(value, window.location.origin);
      return ["http:", "https:"].includes(url.protocol)
        ? url.href
        : "";
    } catch {
      return "";
    }
  }

  function showMessage(message) {
    if (productList) {
      productList.innerHTML = `<p>${escapeHTML(message)}</p>`;
    }
  }

  function getFilters() {
    return {
      search: searchText,
      category: selectedCategory,
      platform: platformFilter?.value || "",
      type: typeFilter?.value || ""
    };
  }

  async function loadProducts(reset = false) {
    if (!productList || loading) return;

    if (reset) {
      offset = 0;
      hasMore = true;
      productList.innerHTML = "";
    }

    if (!hasMore) return;

    loading = true;
    showMessage(offset === 0 ? "Loading products..." : "Loading more...");

    if (loadMoreButton) {
      loadMoreButton.disabled = true;
    }

    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset)
      });

      const filters = getFilters();

      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });

      const response = await fetch(
        `${API}/products?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !Array.isArray(data.products)) {
        throw new Error(data.error || "Invalid API response");
      }

      if (reset) productList.innerHTML = "";

      if (data.products.length === 0 && offset === 0) {
        showMessage("No products found. Products will appear here when added.");
      } else {
        renderProducts(data.products);
      }

      offset += data.products.length;
      hasMore = data.products.length === PAGE_SIZE;

      if (loadMoreButton) {
        loadMoreButton.style.display = hasMore ? "block" : "none";
      }

    } catch (error) {
      console.error("Product loading error:", error);

      if (offset === 0) {
        showMessage("Products load nahi ho paye. Please refresh and try again.");
      } else {
        const errorMessage = document.createElement("p");
        errorMessage.textContent = "More products could not be loaded.";
        productList.appendChild(errorMessage);
      }
    } finally {
      loading = false;

      if (loadMoreButton) {
        loadMoreButton.disabled = false;
      }
    }
  }

  function renderProducts(products) {
    products.forEach((product) => {
      const name = escapeHTML(product.product_name || "Product");
      const brand = escapeHTML(product.brand || "");
      const category = escapeHTML(product.category || "");
      const platform = escapeHTML(product.affiliate_platform || "");
      const price = product.offer_price ?? product.price;
      const mrp = product.mrp;
      const rating = product.rating;
      const image = safeURL(product.image_url);
      const affiliateURL = safeURL(product.profit_url || product.product_url);

      const card = document.createElement("article");
      card.className = "product-card";

      card.innerHTML = `
        ${image ? `
          <img
            src="${escapeHTML(image)}"
            alt="${name}"
            loading="lazy"
            onerror="this.style.display='none'"
          >
        ` : ""}

        <h3>${name}</h3>
        ${brand ? `<p>${brand}</p>` : ""}
        ${category ? `<p>${category}</p>` : ""}

        ${price !== null && price !== undefined
          ? `<p class="price">₹${escapeHTML(price)}</p>`
          : ""}

        ${mrp !== null && mrp !== undefined
          ? `<p>MRP: ₹${escapeHTML(mrp)}</p>`
          : ""}

        ${rating !== null && rating !== undefined
          ? `<p>Rating: ${escapeHTML(rating)} / 5</p>`
          : ""}

        ${platform ? `<p>${platform}</p>` : ""}

        ${affiliateURL ? `
          <a
            href="${escapeHTML(affiliateURL)}"
            target="_blank"
            rel="nofollow sponsored noopener"
          >
            View Deal
          </a>
        ` : `<p>Deal link not available</p>`}
      `;

      productList.appendChild(card);
    });
  }

  async function loadCategories() {
    if (!categoryList) return;

    try {
      const response = await fetch(`${API}/categories`);

      if (!response.ok) throw new Error("Category API failed");

      const data = await response.json();

      if (!data.success || !Array.isArray(data.categories)) {
        throw new Error("Invalid categories response");
      }

      categoryList.innerHTML = "";

      const allButton = document.createElement("button");
      allButton.textContent = "All Categories";
      allButton.addEventListener("click", () => {
        selectedCategory = "";
        loadProducts(true);
      });
      categoryList.appendChild(allButton);

      data.categories
        .filter((category) => !category.parent_id)
        .forEach((category) => {
          const button = document.createElement("button");
          button.textContent = category.category_name;

          button.addEventListener("click", () => {
            selectedCategory = category.category_name;
            loadProducts(true);
            if (subcategoryList) {
              subcategoryList.textContent =
                "Selected: " + category.category_name;
            }
          });

          categoryList.appendChild(button);
        });

      if (data.categories.length === 0) {
        categoryList.textContent = "Categories will appear here.";
      }

    } catch (error) {
      console.error("Category loading error:", error);
      categoryList.textContent = "Categories could not be loaded.";
    }
  }

  if (searchForm) {
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      searchText = searchInput?.value.trim() || "";
      loadProducts(true);
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      searchText = searchInput.value.trim();
      loadProducts(true);
    });
  }

  if (platformFilter) {
    platformFilter.addEventListener("change", () => {
      loadProducts(true);
    });
  }

  if (typeFilter) {
    typeFilter.addEventListener("change", () => {
      loadProducts(true);
    });
  }

  if (loadMoreButton) {
    loadMoreButton.addEventListener("click", () => {
      loadProducts(false);
    });
  }

  loadCategories();
  loadProducts(true);
});
