const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const http = require('http');
const db = require('./config/db');
const app = require('./server');

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

function randomUuid() {
  return crypto.randomUUID();
}

async function requestJson(server, { method = 'GET', path: reqPath, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const options = {
      hostname: '127.0.0.1',
      port: addr.port,
      path: reqPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on('error', reject);
    if (body !== null) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function requestRaw(server, { method = 'GET', path: reqPath, headers = {} }) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const options = {
      hostname: '127.0.0.1',
      port: addr.port,
      path: reqPath,
      method,
      headers,
    };

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          buffer: Buffer.concat(chunks),
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Integration Test Suite ---');
  let failures = 0;
  function assert(cond, desc) {
    if (!cond) {
      console.error(`❌ FAIL: ${desc}`);
      failures++;
    } else {
      console.log(`✅ PASS: ${desc}`);
    }
  }

  // Create ephemeral test server on random port
  const testServer = http.createServer(app);
  await new Promise((resolve) => testServer.listen(0, resolve));

  try {
    // 0. Fetch real menu items from DB to use in test orders
    const menuItemsRes = await db.query(
      `SELECT id, name, price, is_alcoholic FROM menu_items WHERE is_available = TRUE ORDER BY is_alcoholic ASC`
    );
    const foodItem = menuItemsRes.rows.find((i) => !i.is_alcoholic);
    const alcoholItem = menuItemsRes.rows.find((i) => i.is_alcoholic);

    assert(foodItem && alcoholItem, 'Found both non-alcoholic and alcoholic dishes in menu');

    // Ensure manager password in database matches documented credential
    const bcrypt = require('bcrypt');
    const mgrHash = await bcrypt.hash('SeaPalace@123', 10);
    await db.query('UPDATE managers SET password_hash = $1 WHERE username = $2', [mgrHash, 'manager']);

    // Get manager token for manager requests
    const managerRes = await requestJson(testServer, {
      method: 'POST',
      path: '/api/auth/login',
      body: { username: 'manager', password: 'SeaPalace@123' },
    });
    const managerToken = managerRes.body?.data?.accessToken;
    assert(managerToken, 'Manager login successful for test suite');

    // ----------------------------------------------------------------------
    // TEST 1: Two independent demo browsers on Table 1
    // ----------------------------------------------------------------------
    console.log('\n--- Test 1: Two Independent Demo Browsers ---');
    const tokenA = randomToken();
    const tokenB = randomToken();

    const startA = await requestJson(testServer, {
      method: 'POST',
      path: '/api/visits/start',
      body: { tableNumber: 1, visitToken: tokenA },
    });
    const startB = await requestJson(testServer, {
      method: 'POST',
      path: '/api/visits/start',
      body: { tableNumber: 1, visitToken: tokenB },
    });

    assert(startA.status === 201 || startA.status === 200, 'Browser A visit created');
    assert(startB.status === 201 || startB.status === 200, 'Browser B visit created');
    const visitIdA = startA.body.data.visit.id;
    const visitIdB = startB.body.data.visit.id;
    assert(visitIdA !== visitIdB, 'Browser A and Browser B receive distinct visits on Table 1');

    // Browser A places order
    const subKeyA1 = randomUuid();
    const orderA1Res = await requestJson(testServer, {
      method: 'POST',
      path: '/api/orders',
      headers: { 'X-Visit-Token': tokenA },
      body: {
        tableNumber: 1,
        visitId: visitIdA,
        submissionKey: subKeyA1,
        customerName: 'Guest A',
        items: [{ menuItemId: foodItem.id, quantity: 2 }],
      },
    });
    assert(orderA1Res.status === 201, 'Browser A placed order A1');

    // Browser B places order
    const subKeyB1 = randomUuid();
    const orderB1Res = await requestJson(testServer, {
      method: 'POST',
      path: '/api/orders',
      headers: { 'X-Visit-Token': tokenB },
      body: {
        tableNumber: 1,
        visitId: visitIdB,
        submissionKey: subKeyB1,
        customerName: 'Guest B',
        items: [{ menuItemId: alcoholItem.id, quantity: 1 }],
      },
    });
    assert(orderB1Res.status === 201, 'Browser B placed order B1');

    // Verify Browser A orders don't appear in Browser B visit
    const getVisB = await requestJson(testServer, {
      method: 'GET',
      path: `/api/visits/${visitIdB}`,
      headers: { 'X-Visit-Token': tokenB },
    });
    const bOrderIds = getVisB.body.data.orders.map((o) => o.id);
    assert(
      !bOrderIds.includes(orderA1Res.body.data.order.id),
      "Browser A's orders never appear in Browser B's visit orders"
    );

    // ----------------------------------------------------------------------
    // TEST 2: Multiple rounds in one visit
    // ----------------------------------------------------------------------
    console.log('\n--- Test 2: Multiple Rounds in One Visit ---');
    const subKeyA2 = randomUuid();
    const orderA2Res = await requestJson(testServer, {
      method: 'POST',
      path: '/api/orders',
      headers: { 'X-Visit-Token': tokenA },
      body: {
        tableNumber: 1,
        visitId: visitIdA,
        submissionKey: subKeyA2,
        customerName: 'Guest A',
        items: [{ menuItemId: alcoholItem.id, quantity: 1 }],
      },
    });
    assert(orderA2Res.status === 201, 'Browser A placed additional round A2');

    const getVisA = await requestJson(testServer, {
      method: 'GET',
      path: `/api/visits/${visitIdA}`,
      headers: { 'X-Visit-Token': tokenA },
    });
    assert(getVisA.body.data.orders.length >= 2, 'Visit A contains both submitted rounds');

    // ----------------------------------------------------------------------
    // TEST 3: Duplicate clicks and lost-response retry
    // ----------------------------------------------------------------------
    console.log('\n--- Test 3: Duplicate Clicks and Retry ---');
    // Replay exact same submission
    const replayRes = await requestJson(testServer, {
      method: 'POST',
      path: '/api/orders',
      headers: { 'X-Visit-Token': tokenA },
      body: {
        tableNumber: 1,
        visitId: visitIdA,
        submissionKey: subKeyA2,
        customerName: 'Guest A',
        items: [{ menuItemId: alcoholItem.id, quantity: 1 }],
      },
    });
    assert(replayRes.status === 200 && replayRes.body.data.replayed === true, 'Duplicate submission recovered original order with replayed=true');
    assert(replayRes.body.data.order.id === orderA2Res.body.data.order.id, 'Recovered order matches original order ID');

    // Reusing key with different items must be rejected
    const badReplayRes = await requestJson(testServer, {
      method: 'POST',
      path: '/api/orders',
      headers: { 'X-Visit-Token': tokenA },
      body: {
        tableNumber: 1,
        visitId: visitIdA,
        submissionKey: subKeyA2,
        customerName: 'Guest A',
        items: [{ menuItemId: foodItem.id, quantity: 5 }],
      },
    });
    assert(badReplayRes.status === 409, 'Reuse of submission key with different items rejected with 409');

    // ----------------------------------------------------------------------
    // TEST 4 & 5: Notifications & Deduplication
    // ----------------------------------------------------------------------
    console.log('\n--- Test 4 & 5: Notification Deduplication ---');
    const notifs = await requestJson(testServer, {
      method: 'GET',
      path: '/api/notifications',
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const orderA2Notifs = notifs.body.data.filter((n) => n.order_id === orderA2Res.body.data.order.id);
    assert(orderA2Notifs.length === 1, 'Exactly one notification inserted per new order round (replay produced 0 new notifications)');

    // ----------------------------------------------------------------------
    // TEST 6: Cancellation excluded from billing
    // ----------------------------------------------------------------------
    console.log('\n--- Test 6: Cancellation Excluded From Billing ---');
    // Add round A3, then cancel it
    const subKeyA3 = randomUuid();
    const orderA3Res = await requestJson(testServer, {
      method: 'POST',
      path: '/api/orders',
      headers: { 'X-Visit-Token': tokenA },
      body: {
        tableNumber: 1,
        visitId: visitIdA,
        submissionKey: subKeyA3,
        customerName: 'Guest A',
        items: [{ menuItemId: foodItem.id, quantity: 1 }],
      },
    });
    const orderA3Id = orderA3Res.body.data.order.id;

    // Manager cancels round A3
    const cancelRes = await requestJson(testServer, {
      method: 'PATCH',
      path: `/api/orders/${orderA3Id}/status`,
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { status: 'cancelled' },
    });
    assert(cancelRes.status === 200 && cancelRes.body.data.status === 'cancelled', 'Order A3 successfully cancelled by manager');

    // Customer requests final bill for Visit A
    const billRes = await requestJson(testServer, {
      method: 'POST',
      path: `/api/visits/${visitIdA}/bill`,
      headers: { 'X-Visit-Token': tokenA },
    });
    assert(billRes.status === 201, 'Final bill created for Visit A');
    const billData = billRes.body.data.bill;
    const billedSnapshot = typeof billData.items_snapshot === 'string' ? JSON.parse(billData.items_snapshot) : billData.items_snapshot;

    const cancelledInBill = billedSnapshot.some((item) => item.orderNumber === orderA3Res.body.data.order.order_number);
    assert(!cancelledInBill, 'Cancelled round A3 is completely excluded from the final bill snapshot');

    // ----------------------------------------------------------------------
    // TEST 7: Finalization racing and repeated request
    // ----------------------------------------------------------------------
    console.log('\n--- Test 7: Finalization Idempotence ---');
    const repeatBillRes = await requestJson(testServer, {
      method: 'POST',
      path: `/api/visits/${visitIdA}/bill`,
      headers: { 'X-Visit-Token': tokenA },
    });
    assert(repeatBillRes.status === 200, 'Repeated final bill request returns status 200');
    assert(repeatBillRes.body.data.bill.id === billData.id, 'Concurrent/repeated finalization returns identical active bill');

    // Further orders rejected while bill_requested
    const afterBillOrder = await requestJson(testServer, {
      method: 'POST',
      path: '/api/orders',
      headers: { 'X-Visit-Token': tokenA },
      body: {
        tableNumber: 1,
        visitId: visitIdA,
        submissionKey: randomUuid(),
        items: [{ menuItemId: foodItem.id, quantity: 1 }],
      },
    });
    assert(afterBillOrder.status === 409, 'New orders rejected when final bill has already been requested');

    // ----------------------------------------------------------------------
    // TEST 8: Feedback Submit and Skip
    // ----------------------------------------------------------------------
    console.log('\n--- Test 8: Feedback Submit & Skip ---');
    const feedbackRes = await requestJson(testServer, {
      method: 'POST',
      path: `/api/visits/${visitIdA}/feedback`,
      headers: { 'X-Visit-Token': tokenA },
      body: { rating: 5, comment: 'Superb coastal seafood!', recommend: true },
    });
    assert(feedbackRes.status === 201, 'Visit feedback submitted successfully');
    assert(feedbackRes.body.data.rating === 5, 'Feedback rating persisted');

    // Duplicate feedback should update or succeed without throwing 500
    const repeatFeedback = await requestJson(testServer, {
      method: 'POST',
      path: `/api/visits/${visitIdA}/feedback`,
      headers: { 'X-Visit-Token': tokenA },
      body: { rating: 4, comment: 'Updated review' },
    });
    assert(repeatFeedback.status === 201, 'Duplicate/updated feedback handled smoothly');

    // ----------------------------------------------------------------------
    // TEST 9: PDF Generation & Protected Download
    // ----------------------------------------------------------------------
    console.log('\n--- Test 9: PDF Generation and Protected Download ---');
    // Unauthorized request without token
    const unauthPdf = await requestRaw(testServer, {
      method: 'GET',
      path: `/api/visits/${visitIdA}/bill/pdf`,
    });
    assert(unauthPdf.status === 403, 'PDF download rejected without authorization');

    // Authorized customer download
    const authPdf = await requestRaw(testServer, {
      method: 'GET',
      path: `/api/visits/${visitIdA}/bill/pdf`,
      headers: { 'X-Visit-Token': tokenA },
    });
    assert(authPdf.status === 200, 'Protected PDF downloaded with X-Visit-Token');
    assert(authPdf.buffer.slice(0, 4).toString() === '%PDF', 'PDF stream contains valid %PDF magic header');

    // Delete PDF file from disk to test on-demand regeneration from snapshot
    const uploadDirName = require('./config/env').uploadDir;
    const pdfFilePath = path.join(__dirname, uploadDirName, `${billData.bill_number}.pdf`);
    if (fs.existsSync(pdfFilePath)) {
      fs.unlinkSync(pdfFilePath);
    }
    const regenPdf = await requestRaw(testServer, {
      method: 'GET',
      path: `/api/visits/${visitIdA}/bill/pdf`,
      headers: { 'X-Visit-Token': tokenA },
    });
    assert(regenPdf.status === 200 && regenPdf.buffer.slice(0, 4).toString() === '%PDF', 'PDF successfully regenerated on-demand from items_snapshot');

    // ----------------------------------------------------------------------
    // TEST 10: Reopening, Bill Revision, Closure and Fresh Visit
    // ----------------------------------------------------------------------
    console.log('\n--- Test 10: Reopening, Revisions, Closure & Fresh Visit ---');
    // Manager reopens visit
    const reopenRes = await requestJson(testServer, {
      method: 'POST',
      path: `/api/visits/${visitIdA}/reopen`,
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    assert(reopenRes.status === 200, 'Manager reopened visit A');

    // Verify previous bill is superseded in database
    const oldBillRes = await db.query(`SELECT status, is_active FROM visit_bills WHERE id = $1`, [billData.id]);
    assert(oldBillRes.rows[0].status === 'superseded' && oldBillRes.rows[0].is_active === false, 'Previous bill marked superseded and inactive');

    // Customer places round A4 now that visit is reopened
    const subKeyA4 = randomUuid();
    const orderA4Res = await requestJson(testServer, {
      method: 'POST',
      path: '/api/orders',
      headers: { 'X-Visit-Token': tokenA },
      body: {
        tableNumber: 1,
        visitId: visitIdA,
        submissionKey: subKeyA4,
        customerName: 'Guest A',
        items: [{ menuItemId: foodItem.id, quantity: 1 }],
      },
    });
    assert(orderA4Res.status === 201, 'Customer successfully added round A4 to reopened visit');

    // Customer requests final bill again
    const billRev2Res = await requestJson(testServer, {
      method: 'POST',
      path: `/api/visits/${visitIdA}/bill`,
      headers: { 'X-Visit-Token': tokenA },
    });
    assert(billRev2Res.status === 201, 'New final bill created after reopening');
    const billRev2 = billRev2Res.body.data.bill;
    assert(billRev2.revision === 2, 'New bill is labeled revision 2');
    assert(billRev2.id !== billData.id, 'New bill has its own distinct ID and snapshot');

    // Manager closes visit A
    const closeRes = await requestJson(testServer, {
      method: 'POST',
      path: `/api/visits/${visitIdA}/close`,
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    assert(closeRes.status === 200, 'Manager closed visit A');

    // Ordering on closed visit must be rejected
    const orderClosedRes = await requestJson(testServer, {
      method: 'POST',
      path: '/api/orders',
      headers: { 'X-Visit-Token': tokenA },
      body: {
        tableNumber: 1,
        visitId: visitIdA,
        submissionKey: randomUuid(),
        items: [{ menuItemId: foodItem.id, quantity: 1 }],
      },
    });
    assert(orderClosedRes.status === 409, 'New orders on closed visit rejected');

    // Starting with closed token must say visit ended
    const closedStart = await requestJson(testServer, {
      method: 'POST',
      path: '/api/visits/start',
      body: { tableNumber: 1, visitToken: tokenA },
    });
    assert(closedStart.status === 409, 'Re-using closed visit token rejects and directs to start fresh visit');

    // Fresh visit starts cleanly
    const freshToken = randomToken();
    const freshStart = await requestJson(testServer, {
      method: 'POST',
      path: '/api/visits/start',
      body: { tableNumber: 1, visitToken: freshToken },
    });
    assert(freshStart.status === 201, 'Fresh demo visit started successfully on Table 1');

    // ----------------------------------------------------------------------
    // TEST 11: Split Bill Preview & Finalized Flows
    // ----------------------------------------------------------------------
    console.log('\n--- Test 11: Split Bill Preview & Finalized Flows ---');

    // 11a: Split preview BEFORE requesting final bill (visit B is open, no bill exists yet)
    const previewSplitRes = await requestJson(testServer, {
      method: 'POST',
      path: `/api/visits/${visitIdB}/split-bill`,
      headers: { 'X-Visit-Token': tokenB },
      body: {
        people: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
        assignments: {},
      },
    });
    assert(previewSplitRes.status === 200, 'Split Bill preview succeeds BEFORE requesting final bill');
    assert(previewSplitRes.body.data.isFinalized === false, 'Split preview indicates bill is not finalized yet');
    assert(!previewSplitRes.body.data.billId, 'Split preview did not create a bill');

    // Verify visit B is still open and no bill was generated
    const checkVisitB = await requestJson(testServer, {
      method: 'GET',
      path: `/api/visits/${visitIdB}`,
      headers: { 'X-Visit-Token': tokenB },
    });
    assert(checkVisitB.body.data.visit.status === 'open', 'Opening/editing split preview did NOT finalize visit');
    assert(checkVisitB.body.data.activeBill === null, 'Opening/editing split preview did NOT create a bill in database');

    const previewShares = previewSplitRes.body.data.people;
    const previewTotal = previewSplitRes.body.data.totalAmount;
    const sumPreviewShares = Math.round(previewShares.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
    assert(sumPreviewShares === previewTotal, `Preview shares sum (₹${sumPreviewShares}) matches preview total (₹${previewTotal}) exactly to the paisa`);

    // 11b: Additional item added to visit B -> preview refreshes with updated total
    const addOrderRes = await requestJson(testServer, {
      method: 'POST',
      path: '/api/orders',
      headers: { 'X-Visit-Token': tokenB },
      body: {
        tableNumber: 1,
        visitId: visitIdB,
        items: [{ menuItemId: foodItem.id, quantity: 1 }],
        submissionKey: randomUuid(),
      },
    });
    assert(addOrderRes.status === 201, 'Additional order placed successfully on visit B');

    const refreshedSplitRes = await requestJson(testServer, {
      method: 'POST',
      path: `/api/visits/${visitIdB}/split-bill`,
      headers: { 'X-Visit-Token': tokenB },
      body: {
        people: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
        assignments: {},
      },
    });
    assert(refreshedSplitRes.status === 200, 'Refreshed split preview calculated after adding round');
    const refreshedTotal = refreshedSplitRes.body.data.totalAmount;
    assert(refreshedTotal > previewTotal, 'Split preview total updated to reflect newly ordered items');
    const sumRefreshed = Math.round(refreshedSplitRes.body.data.people.reduce((s, p) => s + p.amount, 0) * 100) / 100;
    assert(sumRefreshed === refreshedTotal, `Refreshed shares sum (₹${sumRefreshed}) matches updated total (₹${refreshedTotal}) exactly`);

    // 11c: Split on finalized bill (visit A)
    const splitRes = await requestJson(testServer, {
      method: 'POST',
      path: `/api/visits/${visitIdA}/split-bill`,
      headers: { 'X-Visit-Token': tokenA },
      body: {
        people: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }, { id: 3, name: 'Charlie' }],
        assignments: {},
      },
    });
    assert(splitRes.status === 200, 'Bill split calculated successfully for finalized visit A');
    assert(splitRes.body.data.isFinalized === true, 'Split indicates finalized bill');
    const shares = splitRes.body.data.people;
    const sumShares = Math.round(shares.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
    assert(sumShares === Number(billRev2.total_amount), `Sum of diner shares (₹${sumShares}) matches bill total (₹${billRev2.total_amount}) exactly to the paisa`);

    // 11d: Finalize visit B without requiring split -> normal combined bill generated
    const finalBillB = await requestJson(testServer, {
      method: 'POST',
      path: `/api/visits/${visitIdB}/bill`,
      headers: { 'X-Visit-Token': tokenB },
    });
    assert(finalBillB.status === 201, 'Normal final bill generated without forcing customers to split');
    assert(Number(finalBillB.body.data.bill.total_amount) === refreshedTotal, 'Final bill total matches preview total exactly');

    // ----------------------------------------------------------------------
    // TEST 12: Manager Active Visits View
    // ----------------------------------------------------------------------
    console.log('\n--- Test 12: Manager Active Visits View ---');
    const activeVisitsRes = await requestJson(testServer, {
      method: 'GET',
      path: '/api/visits/active',
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    assert(activeVisitsRes.status === 200, 'Manager active visits endpoint responds 200');
    assert(Array.isArray(activeVisitsRes.body.data) && activeVisitsRes.body.data.length > 0, 'Active visits list returned with visitor labels');

    // ----------------------------------------------------------------------
    // TEST 13: Dashboard Metrics
    // ----------------------------------------------------------------------
    console.log('\n--- Test 13: Dashboard Metrics ---');
    const dashRes = await requestJson(testServer, {
      method: 'GET',
      path: '/api/dashboard',
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    assert(dashRes.status === 200, 'Dashboard endpoint responds 200');
    assert(dashRes.body.data.orderValueTimeRange === 'Today (Asia/Kolkata)', 'Dashboard time range clearly labeled as Today (Asia/Kolkata)');
    assert(typeof dashRes.body.data.orderValue === 'number', 'Order Value returned as number');
    assert(typeof dashRes.body.data.todayOrders === 'number', 'Today Orders returned as number');

  } catch (err) {
    console.error('Unhandled test exception:', err);
    failures++;
  } finally {
    testServer.close();
    await db.pool.end();
  }

  console.log(`\n========================================`);
  if (failures === 0) {
    console.log(`🎉 ALL INTEGRATION TESTS PASSED!`);
    process.exit(0);
  } else {
    console.error(`💥 ${failures} TEST FAILURE(S)!`);
    process.exit(1);
  }
}

runTests();
