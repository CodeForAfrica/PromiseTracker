describe("Act Now page", () => {
  beforeEach(() => {
    cy.viewport("macbook-16");
  });
  it("renders Act Now page", () => {
    cy.visit("http://localhost:3000");
    cy.get("[data-cy=navigation-buttons]").contains("Act Now").click();
    cy.location("pathname", { timeout: 10000 }).should("include", "/act-now");
    cy.get("[data-cy=actnow-desc]").contains(
      "Act now and create the change you want in your area."
    );
  });
  it("select promise to petition", () => {
    cy.get("[data-cy=promise-select]").click();
    cy.get("[data-cy=promise-item").first().click();
  });
  it("displays petiton form", () => {
    cy.get("[data-cy=start-petition]").click();
    cy.get("[data-cy=petition-form]").contains("Petition Title");
    cy.get("[data-cy=petition-form]").contains("Category & Promise");
    cy.get("[data-cy=petition-form]").contains("Recipient");
    cy.get("[data-cy=petition-form]").contains("What is the Issue");
    cy.get("[data-cy=petition-form]").contains("Featured Image");
    cy.get("[data-cy=close-form]").click();
  });
});
