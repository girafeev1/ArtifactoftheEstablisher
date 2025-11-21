import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ProjectInvoiceRecord } from '../../lib/projectInvoices';

// Define styles for the PDF
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    fontSize: 11,
    padding: 40,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  logo: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 48,
  },
  companyInfo: {
    textAlign: 'right',
  },
  main: {
    flexGrow: 1,
  },
  billTo: {
    marginBottom: 20,
  },
  invoiceDetails: {
    textAlign: 'right',
  },
  itemsTable: {
    display: 'flex',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    margin: 'auto',
    flexDirection: 'row',
  },
  tableCol: {
    width: '50%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  tableCell: {
    margin: 5,
    fontSize: 10,
  },
  totalSection: {
    textAlign: 'right',
    marginTop: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 10,
    color: 'grey',
  },
});

type GeneratedInvoicePdfProps = {
  invoice: ProjectInvoiceRecord;
};

const GeneratedInvoicePdf: React.FC<GeneratedInvoicePdfProps> = ({ invoice }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.logo}>E.</Text>
        <View style={styles.companyInfo}>
          <Text>Establish Records Limited</Text>
          <Text>別 樹 唱 片 有 限 公 司</Text>
        </View>
      </View>
      <View style={styles.main}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={styles.billTo}>
                <Text>BILL TO:</Text>
                <Text>{invoice.companyName}</Text>
                <Text>{invoice.addressLine1}</Text>
                <Text>{invoice.addressLine2}</Text>
                <Text>{invoice.addressLine3}</Text>
                <Text>{invoice.region}</Text>
                <Text>Attn: {invoice.representative}</Text>
            </View>
            <View style={styles.invoiceDetails}>
                <Text>INVOICE</Text>
                <Text>Invoice #: {invoice.invoiceNumber}</Text>
                <Text>Issued Date: {invoice.paidOnDisplay}</Text>
            </View>
        </View>
        <View style={styles.itemsTable}>
            <View style={styles.tableRow}>
                <View style={styles.tableCol}>
                    <Text style={styles.tableCell}>DESCRIPTION</Text>
                </View>
                <View style={styles.tableCol}>
                    <Text style={styles.tableCell}>AMOUNT</Text>
                </View>
            </View>
            {invoice.items.map((item, i) => (
                <View style={styles.tableRow} key={i}>
                    <View style={styles.tableCol}>
                        <Text style={styles.tableCell}>{item.title}</Text>
                    </View>
                    <View style={styles.tableCol}>
                        <Text style={styles.tableCell}>{(item.unitPrice || 0) * (item.quantity || 0)}</Text>
                    </View>
                </View>
            ))}
        </View>
        <View style={styles.totalSection}>
            <Text>INVOICE TOTAL (HK): {invoice.total}</Text>
        </View>
      </View>
      <Text style={styles.footer} fixed>
        Payment is due within 7 days.
      </Text>
    </Page>
  </Document>
);

export const buildGeneratedInvoiceDocument = (invoice: ProjectInvoiceRecord) => {
  return <GeneratedInvoicePdf invoice={invoice} />;
};