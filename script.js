
document.addEventListener("DOMContentLoaded", () => {

  // ==========================================
  // 1. PRODUCT SETTINGS
  // ==========================================

  const API_URL = "/api/products";
  const productList = document.getElementById("productList");
  const searchInput = document.getElementById("searchInput");
  const platformFilter = document.getElementById("platformFilter");
  const typeFilter = document.getElementById("typeFilter");
  const loadMoreButton = document.getElementById("loadMore");

  let allProducts = [];
  let visibleCount = 12;

  // सुरक्षित HTML टेक्स्ट
  const escapeHTML = (value) => {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  };

  // कीमत दिखाना
  const formatPrice = (value) => {
    if (value === null || value === undefined || value === "") {
      return "";
    }

    const number = Number(value);

    if (!Number.isNaN(number)) {
      return "₹" + number.toLocaleString("en-IN");
    }

    return escapeHTML(value);
  };


  // ==========================================
  // 2. LOAD PRODUCTS FROM CLOUDFLARE D1
  // ==========================================

  async function loadProducts() {

    if (!productList) return;

    productList.innerHTML = "<p>Products loading...</p>";

    try {

      const response = await fetch(API_URL, {
        method: "GET",
        headers: {
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error("API Error: " + response.status);
      }

      const data = await response.json();

      if (!data.success || !Array.isArray(data.products)) {
        throw new Error("Invalid product data received");
      }

      allProducts = data.products;
      visibleCount = 12;

      renderProducts();

    } catch (error) {

      console.error("Product Loading Error:", error);

      productList.innerHTML =
        "<p>Products load nahi ho paye. Please refresh the page.</p>";

    }
  }


  // ==========================================
  // 3. DISPLAY PRODUCT CARDS
  // ==========================================

  function renderProducts() {

    if (!productList) return;

    const searchText = searchInput
      ? searchInput.value.toLowerCase().trim()
      : "";

    const selectedPlatform = platformFilter
      ? platformFilter.value.toLowerCase()
      : "";

    const selectedType = typeFilter
      ? typeFilter.value.toLowerCase()
      : "";

    const filteredProducts = allProducts.filter((product) => {

      const searchableText = [
        product.product_name,
        product.brand,
        product.category,
        product.subcategory,
        product.affiliate_platform
      ].join(" ").toLowerCase();

      const matchesSearch = searchableText.includes(searchText);

      const matchesPlatform =
        !selectedPlatform ||
        selectedPlatform === "all" ||
        String(product.affiliate_platform || "").toLowerCase() === selectedPlatform;

      const matchesType =
        !selectedType ||
        selectedType === "all" ||
        String(product.product_type || "").toLowerCase() === selectedType;

      return matchesSearch && matchesPlatform && matchesType;

    });

    const productsToShow = filteredProducts.slice(0, visibleCount);

    if (productsToShow.length === 0) {

      productList.innerHTML = "<p>No products found.</p>";

    } else {

      productList.innerHTML = productsToShow.map((product) => {

        const name = escapeHTML(product.product_name || "Product");
        const brand = escapeHTML(product.brand || "");
        const category = escapeHTML(product.category || "");
        const image = escapeHTML(
          product.image_url || "https://placehold.co/400x400?text=Product"
        );

        const price = formatPrice(product.price);
        const offerPrice = formatPrice(product.offer_price);

        const buyLink = escapeHTML(
          product.profit_url ||
          product.product_url ||
          "#"
        );

        const rating = product.rating
          ? escapeHTML(product.rating)
          : "";

        const discount = product.discount
          ? escapeHTML(product.discount)
          : "";

        return `
          <div class="product-card">

            <div class="product-image-wrap">

              ${discount ? `
                <span class="deal-badge">${discount} OFF</span>
              ` : ""}

              <img
                src="${image}"
                alt="${name}"
                loading="lazy"
                onerror="this.src='https://placehold.co/400x400?text=Product'"
              >

            </div>

            <div class="product-info">

              <div class="product-category">
                ${category}
              </div>

              <h3 class="product-name">${name}</h3>

              <p class="product-brand">${brand}</p>

              ${rating ? `
                <div class="product-rating">
                  ⭐ ${rating}
                </div>
              ` : ""}

              <div class="product-price-row">

                ${offerPrice ? `
                  <strong>${offerPrice}</strong>
                ` : `
                  <strong>${price}</strong>
                `}

                ${offerPrice && price ? `
                  <del>${price}</del>
                ` : ""}

              </div>

              <a
                class="product-buy"
                href="${buyLink}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Buy Now →
              </a>

            </div>

          </div>
        `;

      }).join("");

    }

    if (loadMoreButton) {
      loadMoreButton.style.display =
        filteredProducts.length > visibleCount ? "block" : "none";
    }

  }


  // ==========================================
  // 4. SEARCH
  // ==========================================

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      visibleCount = 12;
      renderProducts();
    });
  }


  // ==========================================
  // 5. PLATFORM FILTER
  // ==========================================

  if (platformFilter) {
    platformFilter.addEventListener("change", () => {
      visibleCount = 12;
      renderProducts();
    });
  }


  // ==========================================
  // 6. PRODUCT TYPE FILTER
  // ==========================================

  if (typeFilter) {
    typeFilter.addEventListener("change", () => {
      visibleCount = 12;
      renderProducts();
    });
  }


  // ==========================================
  // 7. LOAD MORE PRODUCTS
  // ==========================================

  if (loadMoreButton) {
    loadMoreButton.addEventListener("click", () => {
      visibleCount += 12;
      renderProducts();
    });
  }


  // ==========================================
  // 8. PREMIUM AUTO CAROUSEL
  // ==========================================

  const carousel = document.getElementById("carousel");

  if (carousel) {

    const slides = Array.from(
      carousel.querySelectorAll(".slide")
    );

    const dots = Array.from(
      carousel.querySelectorAll(".dot")
    );

    const previousButton = carousel.querySelector(".prev");
    const nextButton = carousel.querySelector(".next");

    let current = 0;
    let timer = null;

    const show = (index) => {

      if (!slides.length) return;

      current = (index + slides.length) % slides.length;

      slides.forEach((slide, i) => {
        slide.classList.toggle("active", i === current);
      });

      dots.forEach((dot, i) => {
        dot.classList.toggle("active", i === current);
      });

    };

    const stopAutoSlide = () => {
      clearInterval(timer);
    };

    const startAutoSlide = () => {

      stopAutoSlide();

      if (slides.length > 1) {
        timer = setInterval(() => {
          show(current + 1);
        }, 5000);
      }

    };

    if (previousButton) {
      previousButton.addEventListener("click", () => {
        show(current - 1);
        startAutoSlide();
      });
    }

    if (nextButton) {
      nextButton.addEventListener("click", () => {
        show(current + 1);
        startAutoSlide();
      });
    }

    dots.forEach((dot, index) => {
      dot.addEventListener("click", () => {
        show(index);
        startAutoSlide();
      });
    });

    carousel.addEventListener("mouseenter", stopAutoSlide);
    carousel.addEventListener("mouseleave", startAutoSlide);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopAutoSlide();
      } else {
        startAutoSlide();
      }
    });

    show(0);
    startAutoSlide();

  }


  // ==========================================
  // 9. START WEBSITE
  // ==========================================

  loadProducts();

});
