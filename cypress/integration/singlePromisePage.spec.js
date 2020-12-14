describe("Single Promise page", () => {
  it("renders promise radar", () => {
    cy.visit("/promises");
    cy.get("[data-cy=promises-section]").contains("Promises");
    /* eslint-disable cypress/no-unnecessary-waiting */
    cy.get("[data-cy=promises-section").find("a").first().click().wait(20000);
    cy.get("[data-cy=promise-radar]").should("be.visible");
  });
  it("renders promise chart, dataset and datasource", () => {
    cy.get("[data-cy=datasource]").scrollIntoView();
    cy.get("[data-cy=datasource").should("be.visible");
    cy.get("[data-cy=dataset]").scrollIntoView();
    cy.get("[data-cy=dataset]").should("be.visible");
    cy.get("[data-cy=promise-chart]").scrollIntoView();
    cy.get("[data-cy=promise-chart]").should("be.visible");
  });
});
