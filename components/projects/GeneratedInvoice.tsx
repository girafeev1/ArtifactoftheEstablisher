import React from 'react';
import type { ProjectInvoiceRecord } from '../../lib/projectInvoices';

type GeneratedInvoiceProps = {
  invoice: ProjectInvoiceRecord;
  // Add other props as needed, e.g., client, project details
};

const GeneratedInvoice: React.FC<GeneratedInvoiceProps> = ({ invoice }) => {
    const subtotal = invoice.items.reduce((acc, item) => acc + ((item.unitPrice || 0) * (item.quantity || 0)), 0);
    const total = subtotal - invoice.items.reduce((acc, item) => acc + (item.discount || 0), 0);

  return (
    <div className="invoice-container">
      <header>
        <div className="logo">E.</div>
        <div className="company-info">
          <div>Establish Records Limited</div>
          <div>別 樹 唱 片 有 限 公 司</div>
          <div>1/F, 18 Wang Toi Shan Leung Uk Tsuen</div>
          <div>Yuen Long Pat Heung</div>
          <div>New Territories, Hong Kong</div>
          <div>account@establishrecords.com</div>
          <div>+852 6694 9527</div>
        </div>
      </header>

      <main>
        <div className="bill-to">
          <h2>BILL TO:</h2>
          <p>{invoice.companyName}</p>
          <p>{invoice.addressLine1}</p>
          <p>{invoice.addressLine2}</p>
          <p>{invoice.addressLine3}</p>
          <p>{invoice.region}, Hong Kong</p>
          <p>Attn: {invoice.representative}</p>
        </div>

        <div className="invoice-details">
          <h1>Invoice</h1>
          <p><strong>Invoice #:</strong> {invoice.invoiceNumber}</p>
          <p><strong>Issued Date:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          {/* Add FPS QR Code here */}
        </div>

        <div className="project-title">
            {/* These should probably come from the project data */}
            <p>《尋秦記》電影主題曲</p>
            <p>天命最高</p>
        </div>

        <table className="items-table">
          <thead>
            <tr>
              <th>DESCRIPTION</th>
              <th>AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item, index) => (
              <tr key={index}>
                <td>
                  <div>{item.title}</div>
                  <div className="fee-type">{item.feeType}</div>
                </td>
                <td>${((item.unitPrice || 0) * (item.quantity || 0)).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="total-section">
          <div className="total-label">INVOICE TOTAL (HK)</div>
          <div className="total-amount">${(invoice.total || 0).toFixed(2)}</div>
          {/* These should be calculated based on the total */}
          <div className="total-in-words">Five Thousand Dollars Only</div>
          <div className="total-in-chinese">伍仟元正</div>
        </div>
      </main>

      <footer>
        <div className="payment-info">
          <p>Cheque Payable To :</p>
          <p>Establish Records Limited</p>
          <p>Bank:</p>
          <p>Oversea-Chinese Banking Corporation (035)</p>
          <p>Branch Code</p>
          <p>8 0 2</p>
          <p>Account Number:</p>
          <p>7 5 7 6 9 9 - 8 3 1</p>
        </div>
        <div className="payment-terms">
          <p>PAYMENT TERMS: FULL PAYMENT WITHIN 7 DAYS</p>
        </div>
        <div className='fps-id'>
            <p>FPS ID:</p>
            <p>1 1 5 2 7 8 5 3 3</p>
        </div>
      </footer>

      <style jsx>{`
        .invoice-container {
          font-family: 'Roboto Mono', monospace;
          color: #000;
          background-color: #fff;
          padding: 40px;
          max-width: 800px;
          margin: auto;
          border: 1px solid #ccc;
        }
        header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 40px;
        }
        .logo {
          font-family: 'Fascinate', cursive;
          font-size: 48px;
        }
        .company-info {
          text-align: right;
        }
        main {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
        }
        .bill-to {
          grid-column: 1 / 2;
        }
        .invoice-details {
          grid-column: 2 / 3;
          text-align: right;
        }
        .project-title {
          grid-column: 1 / -1;
          text-align: center;
          margin-bottom: 20px;
        }
        .items-table {
          grid-column: 1 / -1;
          width: 100%;
          border-collapse: collapse;
        }
        .items-table th, .items-table td {
          border-bottom: 2px solid #000;
          padding: 10px 0;
        }
        .items-table th {
          text-align: left;
        }
        .items-table th:last-child, .items-table td:last-child {
          text-align: right;
        }
        .fee-type {
          font-style: italic;
          color: #666;
        }
        .total-section {
          grid-column: 2 / 3;
          text-align: right;
          margin-top: 20px;
        }
        .total-label {
          font-weight: bold;
        }
        .total-amount {
          font-size: 24px;
          font-weight: bold;
        }
        .total-in-words, .total-in-chinese {
          margin-top: 5px;
        }
        footer {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #000;
        }
        .payment-info, .payment-terms, .fps-id {
          padding: 0 10px;
        }
        .payment-terms {
            text-align: center;
        }
        .fps-id {
            text-align: right;
        }
      `}</style>
    </div>
  );
};

export default GeneratedInvoice;
