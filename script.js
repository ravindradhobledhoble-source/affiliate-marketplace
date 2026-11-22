
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
  let requestNumber = 0;
  let searchTimer;

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function safeURL(value) {
    try {
      const url = new URL(value, location.origin);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function money(value) {
    if (value === null || value === undefined || value === "") return "";
    const number = Number(value);
    return Number.isFinite(number)
      ? "₹" + number.toLocaleString("en-IN")
      : escapeHTML(value);
  }

  function showMessage(message) {
    productList.innerHTML =
      `<p class="product-message">${escapeHTML(message)}</p>`;
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
    if (!productList) return;

    if (reset) {
      requestNumber++;
      offset = 0;
      hasMore = true;
      loading = false;
      productList.innerHTML = "";
    }

    if (loading || !hasMore) return;

    loading = true;
    const thisRequest = requestNumber;

    if (offset === 0) showMessage("Loading amazing deals...");

    if (loadMoreButton) loadMoreButton.disabled = true;

    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset)
      });

      Object.entries(getFilters()).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });

      const response = await fetch(
        `${API}/products?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      if (thisRequest !== requestNumber) return;

      if (!data.success || !Array.isArray(data.products)) {
        throw new Error(data.error || "Invalid API response");
      }

      if (offset === 0) productList.innerHTML = "";

      if (data.products.length === 0 && offset === 0) {
        showMessage("No products found. Please try another search.");
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

      if (thisRequest === requestNumber && offset === 0) {
        showMessage("Products load nahi ho paye. Please refresh.");
      }
    } finally {
      if (thisRequest === requestNumber) {
        loading = false;
        if (loadMoreButton) loadMoreButton.disabled = false;
      }
    }
  }

  function renderProducts(products) {
    products.forEach(product => {
      const name = escapeHTML(product.product_name || "Product");
      const brand = escapeHTML(product.brand || "");
      const category = escapeHTML(product.category || "");
      const platform = escapeHTML(product.affiliate_platform || "");

      const price = product.offer_price ?? product.price;
      const oldPrice = product.mrp ?? product.original_price;
      const rating = Number(product.rating);
      const reviews = product.review_count ?? product.reviews_count;

      const image = safeURL(product.image_url);
      const dealURL = safeURL(
        product.profit_url || product.product_url
      );

      let discount = product.discount || "";
      if (!discount && Number(oldPrice) > Number(price) && Number(price) > 0) {
        discount = Math.round(
          ((Number(oldPrice) - Number(price)) / Number(oldPrice)) * 100
        ) + "% OFF";
      }

      let saving = "";
      if (Number(oldPrice) > Number(price) && Number(price) > 0) {
        saving = money(Number(oldPrice) - Number(price));
      }

      const card = document.createElement("article");
      card.className = "product-card";

      card.innerHTML = `
        <div class="image-box">
          ${discount ? `<span class="discount">${escapeHTML(discount)}</span>` : ""}

          <button class="wishlist" type="button"
            aria-label="Add to wishlist">♡</button>

          <img
            src="${image || "https://placehold.co/400x400?text=Product"}"
            alt="${name}"
            loading="lazy"
            onerror="this.onerror=null;this.src='https://placehold.co/400x400?text=Product';"
          >

          <span class="prime-badge">👑 Deal</span>
        </div>

        <div class="card-body">
          ${category ? `<div class="category">${category}</div>` : ""}

          <h3 class="product-title">${name}</h3>

          ${brand ? `<p class="brand-name">${brand}</p>` : ""}

          <div class="rating">
            ${Number.isFinite(rating) && rating > 0
              ? `⭐ ${rating.toFixed(1)} / 5`
              : "⭐ Product Deal"}
            <span>${reviews ? `(${escapeHTML(reviews)})` : ""}</span>
          </div>

          <div class="price-row">
            <span class="current-price">${money(price)}</span>
            ${oldPrice && Number(oldPrice) > Number(price)
              ? `<span class="old-price">${money(oldPrice)}</span>`
              : ""}
          </div>

          ${saving
            ? `<div class="saving">✓ You Save ${saving}</div>`
            : ""}

          ${platform ? `<p class="platform-name">${platform}</p>` : ""}

          ${dealURL
            ? `<a class="buy-btn" href="${escapeHTML(dealURL)}"
                 target="_blank" rel="nofollow sponsored noopener">
                 🛒 Buy Now →
               </a>`
            : `<span class="buy-btn unavailable">Deal link unavailable</span>`
          }
        </div>
      `;

      const wishlistButton = card.querySelector(".wishlist");
      wishlistButton.addEventListener("click", () => {
        const active = wishlistButton.classList.toggle("wish-active");
        wishlistButton.textContent = active ? "♥" : "♡";
      });

      productList.appendChild(card);
    });
  }

  function selectCategory(categoryName) {
    selectedCategory = categoryName;
    loadProducts(true);
  }

  function renderSubcategories(parent, allCategories) {
    subcategoryList.innerHTML = "";

    const children = allCategories.filter(
      item => String(item.parent_id) === String(parent.id)
    );

    if (!children.length) {
      subcategoryList.textContent = "No subcategories available.";
      return;
    }

    const heading = document.createElement("p");
    heading.textContent = parent.category_name + " - Subcategories";
    subcategoryList.appendChild(heading);

    children.forEach(child => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = child.category_name;
      button.addEventListener("click", () => {
        selectCategory(child.category_name);
      });
      subcategoryList.appendChild(button);
    });
  }

  async function loadCategories() {
    if (!categoryList) return;

    try {
      const response = await fetch(`${API}/categories`);
      if (!response.ok) throw new Error(`Category API Error: ${response.status}`);

      const data = await response.json();
      if (!data.success || !Array.isArray(data.categories)) {
        throw new Error("Invalid categories response");
      }

      categoryList.innerHTML = "";

      const allButton = document.createElement("button");
      allButton.type = "button";
      allButton.textContent = "All Categories";
      allButton.addEventListener("click", () => {
        selectedCategory = "";
        subcategoryList.innerHTML = "";
        loadProducts(true);
      });
      categoryList.appendChild(allButton);

      const mainCategories = data.categories.filter(
        category => category.parent_id == null
      );

      mainCategories.forEach(category => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = category.category_name;

        button.addEventListener("click", () => {
          selectCategory(category.category_name);
          renderSubcategories(category, data.categories);
        });

        categoryList.appendChild(button);
      });

      if (!mainCategories.length) {
        categoryList.textContent = "Categories will appear here.";
      }

    } catch (error) {
      console.error("Category loading error:", error);
      categoryList.textContent = "Categories could not be loaded.";
    }
  }

  if (searchForm) {
    searchForm.addEventListener("submit", event => {
      event.preventDefault();
      searchText = searchInput?.value.trim() || "";
      loadProducts(true);
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        searchText = searchInput.value.trim();
        loadProducts(true);
      }, 350);
    });
  }

  platformFilter?.addEventListener("change", () => loadProducts(true));
  typeFilter?.addEventListener("change", () => loadProducts(true));
  loadMoreButton?.addEventListener("click", () => loadProducts(false));

  loadCategories();
  loadProducts(true);
});
