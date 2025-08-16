/* eslint-env mocha */
/* global cy, describe, it */

describe('Dialog layering', () => {
  it('shows Add Payment above student dialog', () => {
    cy.visit('/dashboard/businesses/coaching-sessions')
    cy.get('[data-testid="student-card"]').first().click()
    cy.contains('Payment History').click()
    cy.get('button[aria-label="Add Payment"]').click()
    cy.get('div[role="dialog"]').should('have.length.at.least', 2)
  })
})
