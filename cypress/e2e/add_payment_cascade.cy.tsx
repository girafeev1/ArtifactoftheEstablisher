/// <reference types="cypress" />
/* eslint-env mocha */

import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as erlDir from '../../lib/erlDirectory'
import * as firestore from 'firebase/firestore'
import { Box, IconButton, Button } from '@mui/material'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PaymentModal from '../../components/StudentDialog/PaymentModal'

const getCypressEnv = () => {
  const runtimeGlobal = globalThis as typeof globalThis & {
    [key: string]: unknown
  }
  const maybeCypress = runtimeGlobal['Cypress'] as
    | { env?: (name: string) => unknown }
    | undefined
  if (maybeCypress && typeof maybeCypress.env === 'function') {
    return maybeCypress.env
  }
  return null
}

const cyStub = (...args: any[]) => (cy as any).stub(...args)

const ensure = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message)
  }
}

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
    const env = getCypressEnv()
    if (env && env('CI')) {
      this.skip()
    }
  })

  it('shows cascade selects', () => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'x'

    cyStub(erlDir, 'listBanks').resolves([
      { bankCode: '001', bankName: 'Bank', rawCodeSegment: '(001)' },
    ])
    cyStub(erlDir, 'listAccounts').resolves([
      { accountDocId: 'a1', accountType: 'Savings' },
    ])
    cyStub(firestore, 'addDoc').resolves()
    cyStub(firestore, 'collection').returns({})
    mountModal(PaymentModal)

    cy.get('[data-testid="method-select"]').should('exist')
    cy.get('[data-testid="entity-select"]').should('exist')
    cy.get('[data-testid="entity-select"]').parent().click()
    cy.contains('li', 'Music Establish (ERL)').click()
    cy.get('[data-testid="bank-select"]').should('be.visible')
    cy.get('[data-testid="bank-select"]').parent().click()
    cy.contains('li', 'Bank (001)').click()
    cy.get('[data-testid="bank-account-select"]').should('be.visible')
  })

  it('submits ERL payment with computed identifier', () => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'x'

    const addDocStub = cyStub(firestore, 'addDoc').resolves()
    cyStub(firestore, 'collection').returns({})
    cyStub(erlDir, 'listBanks').resolves([
      { bankCode: '001', bankName: 'Bank', rawCodeSegment: '(001)' },
    ])
    cyStub(erlDir, 'listAccounts').resolves([
      { accountDocId: 'a1', accountType: 'Savings' },
    ])
    mountModal(PaymentModal)

    cy.get('[data-testid="method-select"]').parent().click()
    cy.contains('li', 'FPS').click()
    cy.get('[data-testid="entity-select"]').parent().click()
    cy.contains('li', 'Music Establish (ERL)').click()
    cy.get('[data-testid="bank-select"]').parent().click()
    cy.contains('li', 'Bank (001)').click()
    cy.get('[data-testid="bank-account-select"]').parent().click()
    cy.contains('li', 'Savings').click()
    cy.get('[data-testid="ref-input"]').type('123')
    cy.get('[data-testid="submit-payment"]').click()

    cy.wrap(addDocStub).should('have.been.called')
    cy.wrap(addDocStub).its('firstCall.args.1').should((data: any) => {
      ensure(data.method === 'FPS', 'expected method to be FPS')
      ensure(
        data.entity === 'Music Establish (ERL)',
        'expected entity to be Music Establish (ERL)'
      )
      ensure(data.bankCode === '001', 'expected bankCode to be 001')
      ensure(data.accountDocId === 'a1', 'expected accountDocId to be a1')
      ensure(data.refNumber === '123', 'expected refNumber to be 123')
      ensure(data.identifier === '001/a1', 'expected identifier to be 001/a1')
      ensure(Boolean(data.timestamp), 'expected timestamp to be present')
      ensure(typeof data.editedBy === 'string', 'expected editedBy string')
    })
  })

  it('personal clears bank fields', () => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 'x'
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'x'

    const addDocStub = cyStub(firestore, 'addDoc').resolves()
    cyStub(firestore, 'collection').returns({})
    cyStub(erlDir, 'listBanks').resolves([
      { bankCode: '001', bankName: 'Bank', rawCodeSegment: '(001)' },
    ])
    cyStub(erlDir, 'listAccounts').resolves([
      { accountDocId: 'a1', accountType: 'Savings' },
    ])
    mountModal(PaymentModal)

    cy.get('[data-testid="method-select"]').parent().click()
    cy.contains('li', 'Cheque').click()
    cy.get('[data-testid="entity-select"]').parent().click()
    cy.contains('li', 'Music Establish (ERL)').click()
    cy.get('[data-testid="bank-select"]').parent().click()
    cy.contains('li', 'Bank (001)').click()
    cy.get('[data-testid="bank-account-select"]').parent().click()
    cy.contains('li', 'Savings').click()
    cy.get('[data-testid="entity-select"]').parent().click()
    cy.contains('li', 'Personal').click()
    cy.get('[data-testid="bank-select"]').should('not.exist')
    cy.get('[data-testid="submit-payment"]').click()

    cy.wrap(addDocStub).its('firstCall.args.1').should((data: any) => {
      ensure(data.method === 'Cheque', 'expected method to be Cheque')
      ensure(data.entity === 'Personal', 'expected entity to be Personal')
      ensure(data.bankCode === undefined, 'expected bankCode undefined')
      ensure(data.accountDocId === undefined, 'expected accountDocId undefined')
      ensure(data.identifier === undefined, 'expected identifier undefined')
    })
  })
})

describe('Card footer alignment', () => {
  beforeEach(function () {
    const env = getCypressEnv()
    if (env && env('CI')) {
      this.skip()
    }
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
        ensure(
          Math.abs(dotRect.bottom - btnRect.bottom) <= 1,
          'expected dots and button bottoms aligned'
        )
        cy.get('[data-testid="card-footer-row"]').then(($row) => {
          const rowRect = $row[0].getBoundingClientRect()
          ensure(dotRect.left >= rowRect.left, 'expected dots within footer bounds')
        })
      })
    })
  })
})
