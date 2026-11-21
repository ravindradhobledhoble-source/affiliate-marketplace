document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  const productCards = document.querySelectorAll(".product-card");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const searchText = searchInput.value.toLowerCase();

      productCards.forEach((card) => {
        const productName = card.textContent.toLowerCase();

        card.style.display = productName.includes(searchText)
          ? ""
          : "none";
      });
    });
  }
});
