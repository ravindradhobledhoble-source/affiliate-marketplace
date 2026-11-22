
document.addEventListener("DOMContentLoaded", () => {

  // ==================================
  // 1. SEARCH PRODUCTS
  // ==================================

  const searchInput = document.getElementById("searchInput");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const searchText = searchInput.value.toLowerCase().trim();

      const productCards = document.querySelectorAll(".product-card");

      productCards.forEach((card) => {
        const productName = card.textContent.toLowerCase();

        card.style.display = productName.includes(searchText)
          ? ""
          : "none";
      });
    });
  }


  // ==================================
  // 2. PREMIUM AUTO CAROUSEL
  // ==================================

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

    // SHOW SLIDE
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


    // START AUTO SLIDE
    const startAutoSlide = () => {

      clearInterval(timer);

      if (slides.length > 1) {
        timer = setInterval(() => {
          show(current + 1);
        }, 5000);
      }

    };


    // STOP AUTO SLIDE
    const stopAutoSlide = () => {
      clearInterval(timer);
    };


    // PREVIOUS BUTTON
    if (previousButton) {
      previousButton.addEventListener("click", () => {
        show(current - 1);
        startAutoSlide();
      });
    }


    // NEXT BUTTON
    if (nextButton) {
      nextButton.addEventListener("click", () => {
        show(current + 1);
        startAutoSlide();
      });
    }


    // DOT BUTTONS
    dots.forEach((dot, index) => {

      dot.addEventListener("click", () => {
        show(index);
        startAutoSlide();
      });

    });


    // PAUSE ON MOUSE HOVER
    carousel.addEventListener("mouseenter", stopAutoSlide);

    carousel.addEventListener("mouseleave", startAutoSlide);


    // PAUSE WHEN TAB IS HIDDEN
    document.addEventListener("visibilitychange", () => {

      if (document.hidden) {
        stopAutoSlide();
      } else {
        startAutoSlide();
      }

    });


    // INITIALIZE CAROUSEL
    show(0);
    startAutoSlide();

  }

});
