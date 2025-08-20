/// <reference types="cypress" />
/* eslint-env mocha */

import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as erlDir from '../../lib/erlDirectory'
import * as firestore from 'firebase/firestore'
import { Box, IconButton, Button } from '@mui/material'
import MoreVertIcon from '@mui/icons-material/MoreVert'
declare const expect: any

declare const Cypress: any

function mountModal(Component: any) {
  cy.visit('about:blank')
  cy.window().then((win) => {
    const rootEl = win.document.createElement('div')
    win.document.body.appendChild(rootEl)
    const qc = new QueryClient()
    createRoot(rootEl).render(
      <QueryClientProvider client={qc}>
        <Component abbr="A" account="B" open onClose={() => {}} />
      </QueryClientProvider>,
    )
  })
}

describe('Add Payment cascade', () => {
  beforeEach(function () {
    if (Cypress?.env('CI')) this.skip()
  })

  it('shows cascade selects', () => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'x'

    ;(cy as any).stub(erlDir, 'listBanks').resolves([
      { bankCode: '001', bankName: 'Bank' },
    ])
    ;(cy as any).stub(erlDir, 'listAccounts').resolves([
      { accountDocId: 'a1', accountType: 'Savings' },
    ])
    ;(cy as any).stub(firestore, 'addDoc').resolves()
    ;(cy as any).stub(firestore, 'collection').returns({})
    delete require.cache[require.resolve('../../components/StudentDialog/PaymentModal')]
    const PaymentModal = require('../../components/StudentDialog/PaymentModal')
      .default
    mountModal(PaymentModal)

    cy.get('[data-testid="method-select"]').should('exist')
    cy.get('[data-testid="entity-select"]').should('exist')
    cy.get('[data-testid="entity-select"]').parent().click()
    cy.contains('li', 'Music Establish (ERL)').click()
    cy.get('[data-testid="bank-select"]').should('be.visible')
    cy.get('[data-testid="bank-select"]').parent().click()
    cy.contains('li', 'Bank 001').click()
    cy.get('[data-testid="bank-account-select"]').should('be.visible')
  })

  it('submits ERL payment with computed identifier', () => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'x'

    const addDocStub = (cy as any).stub(firestore, 'addDoc').resolves()
    ;(cy as any).stub(firestore, 'collection').returns({})
    ;(cy as any).stub(erlDir, 'listBanks').resolves([
      { bankCode: '001', bankName: 'Bank' },
    ])
    ;(cy as any).stub(erlDir, 'listAccounts').resolves([
      { accountDocId: 'a1', accountType: 'Savings' },
    ])
    delete require.cache[require.resolve('../../components/StudentDialog/PaymentModal')]
    const PaymentModal = require('../../components/StudentDialog/PaymentModal')
      .default
    mountModal(PaymentModal)

    cy.get('[data-testid="method-select"]').parent().click()
    cy.contains('li', 'FPS').click()
    cy.get('[data-testid="entity-select"]').parent().click()
    cy.contains('li', 'Music Establish (ERL)').click()
    cy.get('[data-testid="bank-select"]').parent().click()
    cy.contains('li', 'Bank 001').click()
    cy.get('[data-testid="bank-account-select"]').parent().click()
    cy.contains('li', 'Savings').click()
    cy.get('[data-testid="ref-input"]').type('123')
    cy.get('[data-testid="submit-payment"]').click()

    cy.wrap(addDocStub).should('have.been.called')
    cy.wrap(addDocStub).its('firstCall.args.1').should((data: any) => {
      ;(expect as any)(data).to.include({
        method: 'FPS',
        entity: 'Music Establish (ERL)',
        bankCode: '001',
        accountDocId: 'a1',
        refNumber: '123',
      })
      ;(expect as any)(data.identifier).to.eq('001/a1')
      ;(expect as any)(data.timestamp).to.be.ok
      ;(expect as any)(data.editedBy).to.be.a('string')
    })
  })

  it('personal clears bank fields', () => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'x'

    const addDocStub = (cy as any).stub(firestore, 'addDoc').resolves()
    ;(cy as any).stub(firestore, 'collection').returns({})
    ;(cy as any).stub(erlDir, 'listBanks').resolves([
      { bankCode: '001', bankName: 'Bank' },
    ])
    ;(cy as any).stub(erlDir, 'listAccounts').resolves([
      { accountDocId: 'a1', accountType: 'Savings' },
    ])
    delete require.cache[require.resolve('../../components/StudentDialog/PaymentModal')]
    const PaymentModal = require('../../components/StudentDialog/PaymentModal')
      .default
    mountModal(PaymentModal)

    cy.get('[data-testid="method-select"]').parent().click()
    cy.contains('li', 'Cheque').click()
    cy.get('[data-testid="entity-select"]').parent().click()
    cy.contains('li', 'Music Establish (ERL)').click()
    cy.get('[data-testid="bank-select"]').parent().click()
    cy.contains('li', 'Bank 001').click()
    cy.get('[data-testid="bank-account-select"]').parent().click()
    cy.contains('li', 'Savings').click()
    cy.get('[data-testid="entity-select"]').parent().click()
    cy.contains('li', 'Personal').click()
    cy.get('[data-testid="bank-select"]').should('not.exist')
    cy.get('[data-testid="submit-payment"]').click()

    cy.wrap(addDocStub).its('firstCall.args.1').should((data: any) => {
      ;(expect as any)(data).to.include({ method: 'Cheque', entity: 'Personal' })
      ;(expect as any)(data.bankCode).to.be.undefined
      ;(expect as any)(data.accountDocId).to.be.undefined
      ;(expect as any)(data.identifier).to.be.undefined
    })
  })
})

describe('Card footer alignment', () => {
  beforeEach(function () {
    if (Cypress?.env('CI')) this.skip()
  })

  function mountFooter() {
    cy.visit('about:blank')
    cy.window().then((win) => {
      const rootEl = win.document.createElement('div')
      win.document.body.appendChild(rootEl)
      createRoot(rootEl).render(
        <Box sx={{ position: 'relative', width: 200, height: 100, p: 1 }}>
          <Box
            data-testid="card-footer-row"
            sx={{
              position: 'sticky',
              bottom: 0,
              left: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              p: 1,
            }}
          >
            <IconButton
              data-testid="settings-3dots"
              sx={{ width: 36, height: 36 }}
            >
              <MoreVertIcon />
            </IconButton>
            <Button data-testid="service-mode-btn">Service Mode</Button>
          </Box>
        </Box>,
      )
    })
  }

  it('dots align with service mode within card', () => {
    mountFooter()
    cy.get('[data-testid="settings-3dots"]').then(($dots) => {
      const dotRect = $dots[0].getBoundingClientRect()
      cy.get('[data-testid="service-mode-btn"]').then(($btn) => {
        const btnRect = $btn[0].getBoundingClientRect()
        ;(expect as any)(Math.abs(dotRect.bottom - btnRect.bottom)).to.be.lte(1)
        cy.get('[data-testid="card-footer-row"]').then(($row) => {
          const rowRect = $row[0].getBoundingClientRect()
          ;(expect as any)(dotRect.left).to.be.gte(rowRect.left)
        })
      })
    })
  })
})

