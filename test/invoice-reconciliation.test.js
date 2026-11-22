'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var coupons = require('../lib/coupons');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

test('invoice GST breakdown and total match checkout for an HSN-rated order', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var invoiced = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(invoiced.rows[0].gstPercent, 5);
  assert.equal(invoiced.rows[0].lineTax, billed.lines[0].tax);
  assert.equal(invoiced.cgst, billed.cgst);
  assert.equal(invoiced.sgst, billed.sgst);
  assert.equal(invoiced.total, billed.total);
});

test('invoice applies the same coupon cap and discounted GST as checkout', function () {
  var items = [{ id: 2, name: 'Bulk oil', hsn: '1512', gstRate: 5, price: 3000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'WHOLESALE15');
  var invoiced = invoice.computeInvoiceFigures({ items: items, coupon: 'WHOLESALE15' });

  assert.equal(billed.discount, 400);
  assert.equal(billed.tax, 130);
  assert.equal(billed.total, 2730);
  assert.equal(invoiced.tax, 130);
  assert.equal(invoiced.discount, 400);
  assert.equal(invoiced.total, 2730);
});

test('invoice ignores an inactive coupon just as checkout does', function () {
  var items = [{ id: 3, name: 'Tea', hsn: '0902', price: 1000, qty: 1 }];
  var check = coupons.validate('DIWALI20', 1000);
  var billed = pricing.computeTotals(items, 'DIWALI20');
  var invoiced = invoice.computeInvoiceFigures({ items: items, coupon: 'DIWALI20' });

  assert.equal(check.valid, false);
  assert.equal(billed.discount, 0);
  assert.equal(billed.total, 1180);
  assert.equal(invoiced.discount, 0);
  assert.equal(invoiced.total, billed.total);
});

test('GST reconciliation reports matching figures for an HSN-rated order', function () {
  var items = [{ id: 4, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var result = reports.getGstReconciliation({
    orders: [{
      id: 1001,
      date: '22/11/2026',
      customer: 'Walk-in',
      coupon: '',
      status: 'completed',
      items: items,
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      total: billed.total
    }]
  });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.rows[0].ledgerTax, 5);
  assert.equal(result.rows[0].invoiceTax, 5);
  assert.equal(result.rows[0].ledgerTotal, 105);
  assert.equal(result.rows[0].invoiceTotal, 105);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});
