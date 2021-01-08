describe("Promises page", () => {
  it("renders Promises page", () => {
    cy.visit("/");
    cy.get("[data-cy=navigation-buttons]").contains("Promises").click();
    cy.location("pathname", { timeout: 10000 }).should("include", "/promises");
    cy.get("[data-cy=promises-section]").contains("Promises");
  });
  it("renders Promises categories", () => {
    cy.get("[data-cy=promises-section]").contains("Promises by status");
    cy.get("[data-cy=promises-section]").contains("Promises by category");
  });
  it("filter in-progress promises", () => {
    cy.get("[data-cy=promises-section]")
      .find("img")
      .its("length")
      .then((length) => {
        expect(length).to.equal(5);
      });
    cy.get("[data-cy=filter-buttons]").contains("In Progress").click();
    cy.get("[data-cy=promises-section]")
      .find("img")
      .its("length")
      .then((length) => {
        expect(length).to.equal(3);
      });
    cy.get("[data-cy=filter-buttons]").contains("In Progress").click();
  });

  it("filter unrated promises", () => {
    cy.get("[data-cy=promises-section]")
      .find("img")
      .its("length")
      .then((length) => {
        expect(length).to.equal(5);
      });
    cy.get("[data-cy=filter-buttons]").contains("Unrated").click();
    cy.get("[data-cy=promises-section]")
      .find("img")
      .its("length")
      .then((length) => {
        expect(length).to.equal(1);
      });
    cy.get("[data-cy=filter-buttons]").contains("Unrated").click();
  });

  it("filter stalled promises", () => {
    cy.get("[data-cy=promises-section]")
      .find("img")
      .its("length")
      .then((length) => {
        expect(length).to.equal(5);
      });
    cy.get("[data-cy=filter-buttons]").contains("Stalled").click();
    cy.get("[data-cy=promises-section]")
      .find("img")
      .its("length")
      .then((length) => {
        expect(length).to.equal(1);
      });
    cy.get("[data-cy=filter-buttons]").contains("Stalled").click();
  });

  it("filter governance category promises", () => {
    cy.get("[data-cy=promises-section]")
      .find("img")
      .its("length")
      .then((length) => {
        expect(length).to.equal(5);
      });

    cy.get("[data-cy=filter-buttons]").contains("Governance").click();
    cy.get("[data-cy=promises-section]")
      .find("img")
      .its("length")
      .then((length) => {
        expect(length).to.equal(1);
      });
    cy.get("[data-cy=filter-buttons]").contains("Governance").click();
  });

  it("filter health category promises", () => {
    cy.get("[data-cy=promises-section]")
      .find("img")
      .its("length")
      .then((length) => {
        expect(length).to.equal(5);
      });
    cy.get("[data-cy=filter-buttons]").contains("Health").click();
    cy.get("[data-cy=promises-section]")
      .find("img")
      .its("length")
      .then((length) => {
        expect(length).to.equal(2);
      });
    cy.get("[data-cy=filter-buttons]").contains("Health").click();
  });

  it("share promise to social platforms", () => {
    cy.get("[data-cy=share-button").first().click();
    cy.get("[data-cy=twitter]").should("be.visible");
    cy.get("[data-cy=facebook]").should("be.visible");
    cy.get("[data-cy=linkedin]").should("be.visible");
    cy.get("[data-cy=share-button").first().click();
  });
});
