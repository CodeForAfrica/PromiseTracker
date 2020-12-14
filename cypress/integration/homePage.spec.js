describe("Home page", () => {
  it("renders Key Promises", () => {
    cy.visit("/");
    cy.get("[data-cy=key-promises]").contains("Key Promises");
  });

  it("renders Latest Promises", () => {
    cy.get("[data-cy=latest-promises]").contains("Latest Promises");
    cy.get("[data-cy=latest-promises]")
      .find("img")
      .its("length")
      .then((length) => {
        expect(length).to.equal(5);
      });
  });

  it("renders Latest Articles", () => {
    cy.get("[data-cy=latest-articles]").contains("Latest Articles");
    cy.get("[data-cy=latest-articles]")
      .find("img")
      .its("length")
      .then((length) => {
        expect(length).to.equal(2);
      });
  });

  it("renders Partners", () => {
    cy.get("[data-cy=partners]").contains("Partners");
    cy.get("[data-cy=partners]")
      .find("a")
      .its("length")
      .then((length) => {
        expect(length).to.equal(6);
      });
  });

  it("has Neswletter section", () => {
    cy.get("[data-cy=subscribe]").contains("Subscribe");
  });

  it("has Act Now section", () => {
    cy.get("[data-cy=act-now]").contains("Act Now");
  });

  it("renders Latest Promises", () => {
    cy.get("[data-cy=latest-promises]").contains("Latest Promises");
  });
});
