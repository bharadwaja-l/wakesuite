// ==UserScript==
// @name         Marketplace Reports Workflow Helper
// @namespace    https://wakefit.co/marketplace-reports
// @version      2.2.1
// @description  Runs the visible report workflow on Amazon Seller Central, Flipkart Seller Hub, and Wakefit SQL Explorer.
// @match        https://sellercentral.amazon.in/*
// @match        https://seller.flipkart.com/*
// @match        https://reports.wakefit.co/explorer/play*
// @run-at       document-idle
// @match        https://bharadwaja-l.github.io/wakesuite/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// ==/UserScript==

(() => {
  'use strict';

  // Shared userscript storage carries status only; report retrieval still uses portal UI.
  const BRIDGE_CHANNEL = 'wakesuite-marketplace-helper-v1';
  const BRIDGE_PREFIX = 'mwf-trial-status-v1:';
  const BRIDGE_KINDS = ['inventory', 'asin', 'amazonOrders', 'flipkart', 'fkOrders', 'sql'];
  const bridgeParams = new URLSearchParams(location.search);
  const bridgeRun = bridgeParams.get('mwfRunId');
  const bridgeKind = bridgeParams.get('mwfRun');
  const safeRunId = value => typeof value === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(value);
  let bridgeLatest = null;
  let bridgePhase = 'running';
  function publishBridgeStatus(message, bad = false) {
    if (!safeRunId(bridgeRun) || !BRIDGE_KINDS.includes(bridgeKind)) return;
    bridgeLatest = { runId: bridgeRun, kind: bridgeKind, message: String(message).slice(0, 1200),
      phase: bridgePhase, warning: !!bad, updatedAt: Date.now(), version: '2.2.1' };
    GM_setValue(BRIDGE_PREFIX + bridgeRun + ':' + bridgeKind, bridgeLatest);
  }
  if (location.origin === 'https://bharadwaja-l.github.io' && location.pathname.startsWith('/wakesuite/')) {
    document.documentElement.setAttribute('data-mwf-helper-version','2.2.1');
    function bridgeReply(data) {
      if (data?.channel !== BRIDGE_CHANNEL || data.type !== 'poll' || !safeRunId(data.runId)) return;
      const statuses = BRIDGE_KINDS.map(kind => GM_getValue(BRIDGE_PREFIX + data.runId + ':' + kind, null)).filter(Boolean);
      const reply = {channel:BRIDGE_CHANNEL,type:'status',runId:data.runId,version:'2.2.1',statuses};
      window.postMessage(reply,location.origin);
      document.dispatchEvent(new CustomEvent('mwf-helper-status',{detail:JSON.stringify(reply)}));
    }
    document.addEventListener('mwf-helper-poll',event=>{
      if(typeof event.detail!=='string' || event.detail.length>2048)return;
      try{bridgeReply(JSON.parse(event.detail));}catch{}
    });
    window.addEventListener('message', event => {
      const data = event.data;
      if (event.source !== window || event.origin !== location.origin || data?.channel !== BRIDGE_CHANNEL
        || data.type !== 'poll' || !safeRunId(data.runId)) return;
      bridgeReply(data);
    });
    // Expire status-only records from old trials; never touches report files.
    for (const key of GM_listValues()) {
      if (key.startsWith(BRIDGE_PREFIX) && Date.now() - (GM_getValue(key, {}).updatedAt || 0) > 7 * 86400000) GM_deleteValue(key);
    }
    return;
  }
  if (safeRunId(bridgeRun) && BRIDGE_KINDS.includes(bridgeKind)) {
    publishBridgeStatus('Helper tab opened; waiting for the report controls.');
    setInterval(() => {
      if (bridgeLatest && !['finished', 'attention'].includes(bridgeLatest.phase))
        GM_setValue(BRIDGE_PREFIX + bridgeRun + ':' + bridgeKind, { ...bridgeLatest, updatedAt: Date.now() });
    }, 5000);
  }

  const STYLE_ID = 'mwf-style';
  const PANEL_ID = 'mwf-panel';
  const SQL_RESUME_KEY = 'mwf-sql-export-after-refresh-v4';
  const AMAZON_DOWNLOAD_PENDING_KEY = 'mwf-amazon-download-pending-v1';
  const DAILY_REPORT_DOWNLOAD_PREFIX = 'mwf-daily-report-downloaded-v1';
  const SQL = `SELECT\n    scm_master_category,\n    item_sku,\n    mrp,\n    sale_price,\n    active\nFROM wf_products_pricing\nWHERE active = 1;`;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const visible = (el) => !!el && !!(el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden';
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const isButtonLike = (el) => !!el && (['BUTTON', 'KAT-BUTTON'].includes(el.tagName)
    || (el.tagName === 'INPUT' && ['submit', 'button'].includes(norm(el.type)))
    || el.getAttribute('role') === 'button');
  const buttonText = (el) => {
    const labelledBy = (el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean)
      .map((id) => el.ownerDocument.getElementById(id)?.textContent || '').join(' ');
    return norm(labelledBy || el.getAttribute('aria-label') || (el.tagName === 'INPUT'
      ? el.value : el.innerText || el.textContent));
  };

  function localDayKey() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  function dailyReportDownloadKey(report) {
    return `${DAILY_REPORT_DOWNLOAD_PREFIX}:${report}:${localDayKey()}`;
  }

  function skipIfDownloadedToday(report) {
    if (localStorage.getItem(dailyReportDownloadKey(report)) !== 'done') return false;
    setStatus(`${report} already had a completed helper download action today; skipped to avoid a duplicate.`);
    return true;
  }

  function markDownloadedToday(report) {
    // Mark before clicking so simultaneous tabs from “Run all daily reports”
    // cannot start duplicate exports for the same report on the same day.
    localStorage.setItem(dailyReportDownloadKey(report), 'done');
  }

  function allElements(root = document) {
    const out = [];
    const visit = (node) => {
      if (node.shadowRoot) visit(node.shadowRoot);
      for (const el of Array.from(node.querySelectorAll?.('*') || [])) {
        out.push(el);
        if (el.shadowRoot) visit(el.shadowRoot);
      }
    };
    visit(root);
    return out;
  }

  function exactText(text, { includeHidden = false } = {}) {
    const wanted = norm(text);
    return allElements().filter((el) => norm(el.innerText || el.textContent) === wanted && (includeHidden || visible(el)))
      .sort((a, b) => (a.innerText || a.textContent || '').length - (b.innerText || b.textContent || '').length)[0] || null;
  }

  function clickText(text) {
    const el = exactText(text);
    if (!el) throw new Error(`Could not find the visible “${text}” control.`);
    const clickable = el.closest('button,kat-button,[role="button"],a,[data-testid],li') || el;
    clickable.click();
    return clickable;
  }

  function setStatus(message, bad = false) {
    publishBridgeStatus(message, bad);
    const status = document.querySelector(`#${PANEL_ID} [data-status]`);
    if (status) {
      status.textContent = message;
      status.style.color = bad ? '#b42318' : '#175cd3';
    }
  }

  let workflowBusy = false;
  async function guardedRun(label, run) {
    if (workflowBusy) { setStatus('A workflow is already running in this tab. Wait for its status before starting another.'); return; }
    workflowBusy = true;
    bridgePhase = 'running';
    const buttons = [...document.querySelectorAll('#' + PANEL_ID + ' button')];
    buttons.forEach(button => { button.disabled = true; });
    const history = document.querySelector('#' + PANEL_ID + ' [data-task-log]');
    const entry = document.createElement('li');
    entry.textContent = label + ': running';
    history?.appendChild(entry);
    try { await run(); bridgePhase = 'finished';
      if (bridgeLatest) { bridgeLatest.phase = bridgeLatest.warning ? 'attention' : 'finished'; GM_setValue(BRIDGE_PREFIX + bridgeRun + ':' + bridgeKind, bridgeLatest); }
      entry.textContent = label + ': finished action — check status and Chrome Downloads'; }
    catch (error) { bridgePhase = 'attention'; publishBridgeStatus(error?.message || String(error), true); entry.textContent = label + ': stopped — ' + (error?.message || error); throw error; }
    finally { workflowBusy = false; buttons.forEach(button => { button.disabled = false; }); }
  }

  function addPanel(title, buttons) {
    if (document.getElementById(PANEL_ID)) return;
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        #${PANEL_ID}{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:320px;padding:14px;background:#fff;color:#101828;border:1px solid #d0d5dd;border-radius:10px;box-shadow:0 8px 30px #10182833;font:14px/1.4 system-ui,sans-serif}
        #${PANEL_ID} h3{margin:0 0 8px;font-size:15px} #${PANEL_ID} p{margin:8px 0;color:#475467}
        #${PANEL_ID} button{display:block;width:100%;margin:7px 0;padding:9px 10px;border:0;border-radius:6px;background:#175cd3;color:white;font-weight:600;cursor:pointer}
        #${PANEL_ID} button:disabled{opacity:.55;cursor:wait} #${PANEL_ID} [data-status]{min-height:18px;font-size:12px;overflow-wrap:anywhere}
      `;
      document.head.appendChild(style);
    }
    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    const heading = document.createElement('h3');
    heading.textContent = title;
    panel.appendChild(heading);
    for (const item of buttons) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.label;
      button.addEventListener('click', async () => {
        button.disabled = true;
        try { await guardedRun(item.label, item.run); }
        catch (error) { setStatus(error?.message || String(error), true); }
        finally { button.disabled = false; }
      });
      panel.appendChild(button);
    }
    const status = document.createElement('p');
    status.dataset.status = '1';
    status.textContent = 'Ready. Click once to run this site’s step.';
    panel.appendChild(status);
    const history = document.createElement('ul');
    history.dataset.taskLog = '1';
    history.style.cssText = 'max-height:110px;overflow:auto;padding-left:18px;font-size:11px';
    panel.appendChild(history);
    document.body.appendChild(panel);
  }

  function startDailyReports() {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tasks = [
      ['Amazon Inventory', 'inventory', 'https://sellercentral.amazon.in/listing/reports'],
      ['Amazon ASIN Sales', 'asin', 'https://sellercentral.amazon.in/business-reports#/report?id=102%3ADetailSalesTrafficByChildItem&chartCols=&columns=0%2F1%2F3%2F8%2F10%2F20%2F30%2F34%2F36'],
      ['Amazon All Orders', 'amazonOrders', 'https://sellercentral.amazon.in/order-reports-and-feeds/reports/allOrders#'],
      ['Flipkart Listing', 'flipkart', 'https://seller.flipkart.com/index.html#dashboard/home-page'],
      ['Flipkart Orders', 'fkOrders', flipkartOrderRequestUrl()],
      ['Wakefit SQL CSV', 'sql', 'https://reports.wakefit.co/explorer/play/']
    ];
    let opened = 0;
    for (const [, kind, rawUrl] of tasks) {
      const url = new URL(rawUrl);
      url.searchParams.set('mwfRun', kind);
      url.searchParams.set('mwfRunId', runId);
      if (window.open(url.href, '_blank')) opened++;
    }
    setStatus(opened === tasks.length
      ? `Started all ${tasks.length} daily workflows in new tabs (${runId}). Each tab will use the site’s normal controls.`
      : `Started ${opened} of ${tasks.length} workflows. Chrome blocked some new tabs; allow pop-ups for Seller Central/Seller Hub/SQL Explorer or start the blocked site from its helper panel.`, opened !== tasks.length);
  }

  function dailyReportsAction() {
    return { label: 'Run all daily reports', run: startDailyReports };
  }

  function amazonAsinSalesAction() {
    return {
      label: 'Download rolling 30-day ASIN Sales CSV',
      run: async () => {
        if (location.pathname.startsWith('/business-reports')) return runAmazonAsinSales();
        const url = new URL('https://sellercentral.amazon.in/business-reports');
        url.searchParams.set('mwfRun', 'asin');
        url.searchParams.set('mwfRunId', `${Date.now()}`);
        url.hash = '/report?id=102%3ADetailSalesTrafficByChildItem&chartCols=&columns=0%2F1%2F3%2F8%2F10%2F20%2F30%2F34%2F36';
        location.href = url.href;
      }
    };
  }

  function amazonOrdersAction() {
    return {
      label: 'Request and download Amazon All Orders (last 30 days)',
      run: async () => {
        if (location.pathname.startsWith('/order-reports-and-feeds/reports')) return runAmazonOrders();
        const url = new URL('https://sellercentral.amazon.in/order-reports-and-feeds/reports/allOrders#');
        url.searchParams.set('mwfRun', 'amazonOrders');
        url.searchParams.set('mwfRunId', String(Date.now()));
        location.href = url.href;
      }
    };
  }

  function autoRunRequested(kind, run) {
    const params = new URLSearchParams(location.search);
    if (params.get('mwfRun') !== kind) return;
    const runId = params.get('mwfRunId') || 'manual';
    const key = `mwf-auto-${kind}-${runId}-${params.get("mwfAttempt") || "1"}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, 'started');
    wait(1200).then(() => guardedRun(kind, run)).catch((error) => setStatus(error?.message || String(error), true));
  }

  // Amazon: use the native report selector, request each report, and download
  // the newest completed prior report if all fresh requests for that type fail.
  function amazonRows(type) {
    // Seller Central renders these reports as real table rows. Walk those rows
    // directly: climbing a fixed number of parents from a Download button can
    // land on the whole table, mixing statuses from unrelated reports.
    const wanted = norm(type);
    return Array.from(document.querySelectorAll('table tr')).map((row) => {
      const cells = Array.from(row.cells || []);
      if (cells.length < 3) return null;
      const reportName = norm(cells[0].querySelector('b')?.innerText || cells[0].innerText)
        .replace(/\s+\d{1,2}\s+\w+\s+\d{4}.*$/, '');
      if (reportName !== wanted) return null;
      const batchId = norm(cells[1].innerText);
      const badge = cells[2].querySelector('kat-badge');
      const status = norm(badge?.getAttribute('label') || cells[2].innerText);
      return { row, batchId, status, reportName };
    }).filter(Boolean);
  }

  function amazonDownloadButton(row) {
    return Array.from(row.querySelectorAll('kat-button,button,[role="button"],a'))
      .find((el) => (isButtonLike(el) || el.tagName === 'A') && buttonText(el) === 'download' && visible(el)) || null;
  }

  function amazonTechnicalDifficultyMessage() {
    const body = norm(document.body?.innerText);
    if (body.includes('sorry, we are experiencing technical difficulties. please try again later')
        || body.includes('we are experiencing technical difficulties')) {
      return 'Amazon displayed “Sorry, we are experiencing technical difficulties. Please try again later.” The report was not verified as downloaded.';
    }
    return '';
  }

  async function clickAmazonDownloadAndCheck(button, rowLabel, batchId) {
    if (!button || !visible(button)) throw new Error(`Amazon’s Download button for “${rowLabel}” was not visible.`);
    const startUrl = location.href;
    sessionStorage.setItem(AMAZON_DOWNLOAD_PENDING_KEY, JSON.stringify({
      startedAt: Date.now(), rowLabel, batchId, startUrl
    }));
    button.click();
    // Give the page time to render an inline error. A navigation to an error
    // page is handled from the pending marker when the page script reloads.
    await wait(1500);
    const error = amazonTechnicalDifficultyMessage();
    if (error) {
      sessionStorage.removeItem(AMAZON_DOWNLOAD_PENDING_KEY);
      throw new Error(error);
    }
    if (location.href === startUrl) sessionStorage.removeItem(AMAZON_DOWNLOAD_PENDING_KEY);
    return { initiated: true, verified: false };
  }

  function checkPendingAmazonDownload() {
    let pending;
    try { pending = JSON.parse(sessionStorage.getItem(AMAZON_DOWNLOAD_PENDING_KEY) || 'null'); } catch { pending = null; }
    if (!pending) return;
    if (!pending.startedAt || Date.now() - pending.startedAt > 2 * 60 * 1000) {
      sessionStorage.removeItem(AMAZON_DOWNLOAD_PENDING_KEY);
      return;
    }
    wait(900).then(() => {
      const error = amazonTechnicalDifficultyMessage();
      sessionStorage.removeItem(AMAZON_DOWNLOAD_PENDING_KEY);
      if (error) {
        setStatus(`${pending.rowLabel} batch ${pending.batchId}: ${error}`, true);
      } else {
        setStatus(`Amazon opened a response after the Download click for ${pending.rowLabel} batch ${pending.batchId}. Check Chrome Downloads and open the file to confirm it contains the report.`, true);
      }
    });
  }

  async function downloadPreviousAmazonReport(rowLabel, failedBatchId) {
    const previous = amazonRows(rowLabel).find((entry) => entry.status === 'done' && entry.batchId !== failedBatchId && amazonDownloadButton(entry.row));
    if (!previous) return null;
    setStatus(`Fresh ${rowLabel} requests failed; trying the newest completed report shown in Amazon’s list (batch ${previous.batchId})…`, true);
    try {
      await clickAmazonDownloadAndCheck(amazonDownloadButton(previous.row), rowLabel, previous.batchId);
      return previous;
    } catch (error) {
      throw new Error('The completed fallback also failed to download: ' + error.message);
    }
  }

  async function waitForAmazonReportDropdown(timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const dropdown = Array.from(document.querySelectorAll('kat-dropdown')).find((el) =>
        (el.getAttribute('placeholder') === 'Select Report Type'
          || norm(el.getAttribute('label')).includes('request an inventory report'))
        && visible(el) && el.shadowRoot?.querySelector('.select-header'))
        || allElements().find((el) => el.tagName === 'KAT-DROPDOWN' && visible(el)
          && el.shadowRoot?.querySelector('.select-header'));
      if (dropdown) return dropdown;
      await wait(250);
    }
    return null;
  }

  async function requestAmazonReport(optionLabel, rowLabel) {
    setStatus(`Waiting for Amazon’s report selector to load for ${rowLabel}…`);
    const dropdown = await waitForAmazonReportDropdown();
    if (!dropdown) throw new Error('Amazon’s Inventory Reports form did not finish loading; the report-type dropdown was not visible after 30 seconds.');
    const getSelectedLabel = () => {
      const selected = dropdown.shadowRoot?.querySelector('kat-option[aria-selected="true"]');
      return norm(selected?.innerText || selected?.textContent);
    };
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const dismissNotice = allElements().find((el) => isButtonLike(el) && buttonText(el) === 'dismiss' && visible(el));
      if (dismissNotice) {
        dismissNotice.click();
        await wait(250);
      }
      const technicalErrorBeforeRequest = !!amazonTechnicalDifficultyMessage();
      if (technicalErrorBeforeRequest) {
        const prior = await downloadPreviousAmazonReport(rowLabel, 'none');
        if (prior) return { rowLabel, fresh: false, fallback: true, batchId: prior.batchId };
      }
      // Take a batch-ID snapshot for this attempt so an older report cannot
      // satisfy the wait after a failed request is retried.
      const before = new Set(amazonRows(rowLabel).map((entry) => entry.batchId));
      if (attempt > 1 || getSelectedLabel() !== norm(optionLabel)) {
        // Amazon's Katal dropdown keeps its value inside an open shadow root.
        // Its visible trigger is .select-header; the options are kat-option nodes.
        const header = dropdown.shadowRoot?.querySelector('.select-header');
        if (!header) throw new Error('Amazon’s report dropdown control was not found inside the dropdown.');
        header.click();
        const optionDeadline = Date.now() + 10000;
        let option = null;
        while (Date.now() < optionDeadline) {
          option = Array.from(dropdown.shadowRoot.querySelectorAll('kat-option'))
            .find((el) => norm(el.innerText || el.textContent) === norm(optionLabel));
          if (option && visible(option)) break;
          await wait(150);
        }
        if (!option || !visible(option)) throw new Error(`Amazon’s dropdown option “${optionLabel}” did not become visible within 10 seconds.`);
        option.click();
        await wait(300);
      }
      if (getSelectedLabel() !== norm(optionLabel)) {
        throw new Error(`Amazon did not select “${optionLabel}” (selected value: “${getSelectedLabel() || 'blank'}”); no report was requested.`);
      }

      // Seller Central renders this control as a <kat-button>, not a native
      // <button>, so querying only button tags misses the visible action.
      const request = document.querySelector('kat-button[data-testid="request-report-testid"]')
        || allElements().find((el) => isButtonLike(el) && buttonText(el) === 'request report' && visible(el));
      if (!request) throw new Error('Amazon’s Request Report button was not visible.');
      if (!visible(request)) throw new Error('Amazon’s Request Report button was found but is not visible.');
      request.click();
      setStatus(`Requested ${rowLabel} (attempt ${attempt}/${maxAttempts}); waiting for Amazon…`);

      // Amazon says report generation can take up to 45 minutes; allow a small
      // buffer so the helper does not abandon a valid queued report too early.
      const deadline = Date.now() + 50 * 60 * 1000;
      let newRow = null;
      let technicalErrorAfterRequest = false;
      let lastInventoryRefresh = Date.now();
      while (Date.now() < deadline) {
        await wait(2500);
        const refresh = allElements().find(el => isButtonLike(el) && buttonText(el) === 'refresh' && visible(el) && !el.disabled);
        if (refresh && Date.now() - lastInventoryRefresh >= 15000) { refresh.click(); lastInventoryRefresh = Date.now(); }
        const rows = amazonRows(rowLabel);
        newRow = rows.find((entry) => entry.batchId && !before.has(entry.batchId)) || null;
        if (newRow && ['done', 'failed'].includes(newRow.status)) break;
        // Some Amazon failures appear as an inline technical-difficulties
        // notice before a new row can be associated with this click. Treat a
        // newly shown notice as this attempt's failure instead of waiting 50m.
        if (!technicalErrorBeforeRequest && amazonTechnicalDifficultyMessage()) {
          technicalErrorAfterRequest = true;
          newRow = rows.find((entry) => entry.status === 'failed')
            || { row: null, batchId: `attempt-${attempt}-no-batch`, status: 'failed', reportName: rowLabel };
          break;
        }
      }
      if (!newRow && technicalErrorAfterRequest) {
        newRow = { row: null, batchId: `attempt-${attempt}-no-batch`, status: 'failed', reportName: rowLabel };
      }
      if (!newRow || !['done', 'failed'].includes(newRow.status)) throw new Error(`Timed out waiting for “${rowLabel}”. Check Amazon’s report status on this page.`);
      if (newRow.status === 'failed') {
        const prior = await downloadPreviousAmazonReport(rowLabel, newRow.batchId);
        if (prior) return { rowLabel, fresh: false, fallback: true, batchId: prior.batchId, failedBatchId: newRow.batchId };
        if (attempt === maxAttempts) {
          const previous = await downloadPreviousAmazonReport(rowLabel, newRow.batchId);
          if (previous) {
            return { rowLabel, fresh: false, fallback: true, batchId: previous.batchId, failedBatchId: newRow.batchId };
          }
          return { rowLabel, fresh: false, fallback: false, failedBatchId: newRow.batchId, error: `Amazon marked “${rowLabel}” failed for ${maxAttempts} requests and no previously completed report with a Download button was available.` };
        }
        setStatus(`Amazon marked ${rowLabel} failed (batch ${newRow.batchId}); reselecting it and requesting again (${attempt + 1}/${maxAttempts})…`, true);
        await wait(1200);
        continue;
      }

      const download = amazonDownloadButton(newRow.row);
      if (!download) throw new Error(`Amazon shows “${rowLabel}” as ready but its Download button was not found.`);
      try { await clickAmazonDownloadAndCheck(download, rowLabel, newRow.batchId); }
      catch (error) {
        const prior = await downloadPreviousAmazonReport(rowLabel, newRow.batchId);
        if (prior) return { rowLabel, fresh: false, fallback: true, batchId: prior.batchId, failedBatchId: newRow.batchId };
        throw error;
      }
      setStatus(`Clicked Amazon’s Download for ${rowLabel} (batch ${newRow.batchId}). Check Chrome Downloads and open the file to verify it is the report.`);
      return { rowLabel, fresh: true, fallback: false, batchId: newRow.batchId };
    }
  }

  async function runAmazon() {
    setStatus('Starting Amazon report requests…');
    const outcomes = [];
    for (const [optionLabel, rowLabel] of [
      ['All Listings Report (Custom)', 'All Listings Report (Custom)'],
      ['Amazon-fulfilled Inventory Report', 'Amazon-fulfilled Inventory']
    ]) {
      try {
        outcomes.push(await requestAmazonReport(optionLabel, rowLabel));
      } catch (error) {
        outcomes.push({ rowLabel, error: error?.message || String(error) });
      }
    }
    const summary = outcomes.map((outcome) => {
      if (outcome.error) return `${outcome.rowLabel}: incomplete — ${outcome.error}`;
      if (outcome.fallback) return `${outcome.rowLabel}: fresh requests failed; tried the newest completed batch shown in Amazon’s list (${outcome.batchId}); verify the file in Chrome Downloads`;
      return `${outcome.rowLabel}: requested Download for fresh batch ${outcome.batchId}; verify the file in Chrome Downloads`;
    }).join(' | ');
    setStatus(summary, outcomes.some((outcome) => outcome.error || outcome.fallback));
  }

  const AMAZON_INVENTORY_REPORTS = {
    listings: { optionLabel: 'All Listings Report (Custom)', rowLabel: 'All Listings Report (Custom)' },
    fulfilled: { optionLabel: 'Amazon-fulfilled Inventory Report', rowLabel: 'Amazon-fulfilled Inventory' }
  };

  async function runAmazonSingleReport(kind) {
    const report = AMAZON_INVENTORY_REPORTS[kind];
    if (!report) throw new Error(`Unknown Amazon report type: ${kind}`);
    setStatus(`Starting ${report.rowLabel}…`);
    const outcome = await requestAmazonReport(report.optionLabel, report.rowLabel);
    if (outcome.error) {
      setStatus(`${report.rowLabel}: incomplete — ${outcome.error}`, true);
    } else if (outcome.fallback) {
      setStatus(`${report.rowLabel}: fresh requests failed; tried the newest completed batch shown in Amazon’s list (${outcome.batchId}). Verify the file in Chrome Downloads.`, true);
    } else {
      setStatus(`${report.rowLabel}: requested Download for fresh batch ${outcome.batchId}. Verify the file in Chrome Downloads.`);
    }
  }

  function requestAmazonSingleReportFromPanel(kind) {
    if (location.pathname.startsWith('/listing/reports')) return runAmazonSingleReport(kind);
    const url = new URL('https://sellercentral.amazon.in/listing/reports');
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    url.searchParams.set('mwfAmazonReport', kind);
    url.searchParams.set('mwfAmazonReportRunId', runId);
    setStatus(`Opening Inventory Reports to download ${AMAZON_INVENTORY_REPORTS[kind]?.rowLabel || 'the selected report'}…`);
    location.href = url.href;
  }

  function autoRunAmazonSingleReport() {
    const params = new URLSearchParams(location.search);
    const kind = params.get('mwfAmazonReport');
    if (!kind || !AMAZON_INVENTORY_REPORTS[kind]) return;
    const runId = params.get('mwfAmazonReportRunId') || 'manual';
    const key = `mwf-amazon-single-${kind}-${runId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, 'started');
    wait(1200).then(() => guardedRun(kind, () => runAmazonSingleReport(kind)))
      .catch((error) => setStatus(error?.message || String(error), true));
  }

  function amazonSingleReportActions() {
    return [
      { label: 'Download All Listings Report (Custom)', run: () => requestAmazonSingleReportFromPanel('listings') },
      { label: 'Download Amazon-fulfilled Inventory Report', run: () => requestAmazonSingleReportFromPanel('fulfilled') }
    ];
  }

  function amazonOrderRows() {
    return Array.from(document.querySelectorAll('table tr')).map((row) => {
      const cells = Array.from(row.cells || []);
      if (cells.length < 6) return null;
      const reportType = norm(cells[0].innerText);
      if (reportType !== 'order date') return null;
      const batchId = String(cells[1].innerText || '').trim();
      if (!batchId) return null;
      const statusText = norm(cells[5].innerText);
      const status = /\bready\b/.test(statusText) ? 'done' : /\bfailed\b|\berror\b/.test(statusText) ? 'failed' : 'inprogress';
      return { row, reportType, batchId, status };
    }).filter(Boolean);
  }

  function amazonOrderDownloadButton(row) {
    return Array.from(row.querySelectorAll('kat-button,button,[role="button"],a'))
      .find((el) => (isButtonLike(el) || el.tagName === 'A') && buttonText(el) === 'download' && visible(el)) || null;
  }

  function enabledControl(el) {
    return visible(el) && !el.disabled && !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true';
  }

  async function waitControl(find, label, timeout = 20000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { const el = find(); if (el) return el; await wait(200); }
    throw new Error(label + ' did not become available. No additional report was requested.');
  }

  function selectedText(el) {
    return norm(el.tagName === 'SELECT' ? el.selectedOptions?.[0]?.textContent
      : el.shadowRoot?.querySelector('kat-option[aria-selected="true"]')?.textContent
        || el.shadowRoot?.querySelector('.select-header')?.textContent || el.innerText || el.getAttribute('aria-label'));
  }

  async function selectVisibleOption(host, pattern) {
    if (host.tagName === 'SELECT') {
      const option = [...host.options].find(el => pattern.test(norm(el.textContent)) && !el.disabled);
      if (!option) throw new Error('Required report/date option is unavailable.');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(host, option.value);
      host.dispatchEvent(new Event('input', { bubbles: true }));
      host.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      (host.shadowRoot?.querySelector('.select-header') || host).click();
      const option = await waitControl(() => allElements().find(el =>
        ['KAT-OPTION','OPTION','LI','A'].includes(el.tagName) || el.getAttribute('role') === 'option'
        ? enabledControl(el) && pattern.test(norm(el.innerText || el.textContent)) : false), 'Dropdown option');
      option.click();
    }
    await wait(350);
    if (!pattern.test(selectedText(host))) throw new Error('The selected option could not be verified; stopped before requesting.');
  }

  async function selectAmazonAllOrdersAndLast30Days() {
    const tab = allElements().find(el => enabledControl(el) && norm(el.innerText || el.textContent) === 'all orders'
      && (['A','BUTTON'].includes(el.tagName) || el.getAttribute('role') === 'tab'));
    if (tab) { tab.click(); await wait(500); }
    else {
      const report = await waitControl(() => allElements().find(el => enabledControl(el) && el.tagName === 'SELECT'
        && [...el.options].some(option => norm(option.textContent) === 'all orders')), 'All Orders report selector');
      await selectVisibleOption(report, /^all orders$/);
    }
    const dateRange = await waitControl(() => allElements().find(el => enabledControl(el) && (
      el.tagName === 'SELECT' && [...el.options].some(option => /custom/.test(norm(option.textContent)))
      || (el.tagName === 'KAT-DROPDOWN' || el.getAttribute('role') === 'combobox' || el.getAttribute('aria-haspopup'))
        && /date range|last 30 days|custom/.test(selectedText(el)))), 'All Orders date-range selector');
    await selectVisibleOption(dateRange, /^(date range:\s*)?custom(?: date range| range)?$/);
    const dateHosts = () => allElements().filter(el => enabledControl(el) && (
      el.tagName === 'KAT-INPUT' && /date|dd|mm|yyyy/i.test([el.getAttribute('placeholder'),el.getAttribute('label'),el.getAttribute('type')].join(' '))
      || el.tagName === 'INPUT' && !el.getRootNode().host && (el.type === 'date'
        || /start|end|from|to|date/.test(norm([el.name,el.id,el.placeholder,el.getAttribute('aria-label')].join(' '))) && el.type === 'text')));
    await waitControl(() => dateHosts().length === 2 && dateHosts()[0], 'Both custom date fields');
    const range = rollingThirtyCalendarDays();
    const dates = [range.start, range.end];
    const expected = [];
    for (let i=0; i<2; i++) {
      const host = dateHosts()[i];
      const input = host.tagName === 'INPUT' ? host : host.shadowRoot?.querySelector('input');
      if (!input) throw new Error('Custom date field is not editable.');
      const hint = String(host.getAttribute('placeholder') || input.placeholder || '').toLowerCase();
      const date = dates[i];
      let value;
      if (input.type === 'date') value = date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
      else if (/^mm[/-]dd[/-]yyyy$/.test(hint)) value = String(date.getMonth()+1).padStart(2,'0') + hint[2] + String(date.getDate()).padStart(2,'0') + hint[2] + date.getFullYear();
      else if (/^dd[/-]mm[/-]yyyy$/.test(hint)) value = formatAmazonDate(date).replaceAll('/', hint[2]);
      else throw new Error('Custom date format is not explicit. Set the dates manually; no report was requested.');
      input.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);
      input.dispatchEvent(new Event('input',{bubbles:true,composed:true}));
      input.dispatchEvent(new Event('change',{bubbles:true,composed:true}));
      input.blur(); expected.push(value); await wait(200);
    }
    const fields = dateHosts();
    if (fields.length !== 2 || fields.some((host,i) => String(host.tagName === 'INPUT' ? host.value : host.shadowRoot?.querySelector('input')?.value) !== expected[i]))
      throw new Error('Custom dates did not persist; no report was requested.');
    const radio = allElements().find(el => el.tagName === 'INPUT' && el.type === 'radio'
      && norm(el.labels?.[0]?.innerText || el.parentElement?.innerText).includes('order date'));
    if (!radio) throw new Error('Order Date selection could not be verified.');
    if (!radio.checked) { (radio.labels?.[0] || radio).click(); await wait(150); }
    if (!radio.checked) throw new Error('Order Date was not selected.');
    return range;
  }

  async function runAmazonOrders() {
    if (skipIfDownloadedToday('Amazon All Orders')) return;
    setStatus('Opening Amazon All Orders and selecting the last 30 days…');
    await selectAmazonAllOrdersAndLast30Days();
    let request = null;
    const requestDeadline = Date.now() + 15000;
    while (Date.now() < requestDeadline) {
      request = allElements().find((el) => isButtonLike(el) && /^request(?: report)?$/.test(buttonText(el))
        && enabledControl(el));
      if (request) break;
      await wait(250);
    }
    if (!request) throw new Error('Amazon’s All Orders Request button was not visible or enabled after selecting the date range. No report was requested.');
    const before = new Set(amazonOrderRows().map((entry) => entry.batchId));
    request.click();
    setStatus('Requested Amazon All Orders for the last 30 days; waiting for Seller Central…');
    const deadline = Date.now() + 50 * 60 * 1000;
    let created = null;
    let batchId = null;
    let lastRefresh = Date.now() - 15000;
    while (Date.now() < deadline) {
      await wait(2500);
      const rows = amazonOrderRows();
      const newRows = rows.filter((entry) => !before.has(entry.batchId));
      if (!batchId && newRows.length > 1) throw new Error('Multiple new All Orders reports appeared. Check their date ranges before downloading; the helper cannot safely identify this request.');
      if (!batchId && newRows.length === 1) batchId = newRows[0].batchId;
      created = batchId ? rows.find((entry) => entry.batchId === batchId) || null : null;
      if (created && ['done', 'failed'].includes(created.status)) break;
      if (Date.now() - lastRefresh >= 15000) {
        const refresh = allElements().find((el) => isButtonLike(el) && buttonText(el) === 'refresh'
          && visible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true');
        if (refresh) {
          refresh.click();
          lastRefresh = Date.now();
        }
      }
      setStatus(batchId ? `Amazon All Orders batch ${batchId} is processing; refreshing every 15 seconds…`
        : 'Waiting for the new All Orders report to appear; refreshing every 15 seconds…');
    }
    if (!created || !['done', 'failed'].includes(created.status)) throw new Error('Timed out waiting for Amazon All Orders. Check the report status on this page; no additional request was submitted.');
    if (created.status === 'failed') throw new Error('Amazon All Orders failed. No older report was substituted because its date coverage is unverified.');
    const download = amazonOrderDownloadButton(created.row);
    if (!download) throw new Error('Amazon All Orders is ready, but its Download button was not visible.');
    await clickAmazonDownloadAndCheck(download, 'All Orders', created.batchId);
    markDownloadedToday('Amazon All Orders');
    setStatus('Clicked Download for Amazon All Orders, last 30 days. Verify the file in Chrome Downloads.');
  }

  // Amazon Business Reports: export the 30 completed days ending yesterday.
  function formatAmazonDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
  }

  function amazonRolling30DayRange() {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    start.setDate(start.getDate() - 29);
    return { start: formatAmazonDate(start), end: formatAmazonDate(end) };
  }

  function setAmazonDateInput(host, value) {
    const input = host.shadowRoot?.querySelector('input[part="input"]');
    if (!input) throw new Error('Amazon’s date field did not expose its editable input.');
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setter) throw new Error('Could not update Amazon’s date field.');
    setter.call(input, value);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: value }));
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    input.blur();
    if (String(host.value || input.value) !== value) {
      throw new Error(`Amazon did not accept the date ${value}.`);
    }
  }

  async function runAmazonAsinSales() {
    if (skipIfDownloadedToday('Amazon ASIN Sales')) return;
    const targetHash = '/report?id=102%3ADetailSalesTrafficByChildItem&chartCols=&columns=0%2F1%2F3%2F8%2F10%2F20%2F30%2F34%2F36';
    const isTargetReport = () => {
      const params = new URLSearchParams(location.hash.split('?')[1] || '');
      return params.get('id') === '102:DetailSalesTrafficByChildItem'
        && params.get('columns') === '0/1/3/8/10/20/30/34/36'
        && params.has('chartCols');
    };
    const dateFields = () => allElements().filter((el) => el.tagName === 'KAT-INPUT'
      && el.getAttribute('placeholder') === 'DD/MM/YYYY' && visible(el));
    if (!isTargetReport()) {
      location.hash = targetHash;
      setStatus('Opening the requested Detail Page Sales and Traffic By Child Item report…');
      const navigationDeadline = Date.now() + 30000;
      while (Date.now() < navigationDeadline && (!isTargetReport() || dateFields().length < 2)) await wait(300);
      if (!isTargetReport() || dateFields().length < 2) {
        throw new Error('Amazon did not open the requested Child Item sales report.');
      }
    }
    const fields = dateFields();
    if (fields.length < 2) throw new Error('Amazon’s start and end date fields were not visible.');

    const range = amazonRolling30DayRange();
    setAmazonDateInput(fields[0], range.start);
    setAmazonDateInput(fields[1], range.end);

    // Amazon may briefly replace the date-filter toolbar after the two
    // Katal date inputs update. Re-scan for the visible native button instead
    // of failing on that short render gap.
    const applyDeadline = Date.now() + 10000;
    let apply = null;
    while (Date.now() < applyDeadline) {
      apply = allElements().find((el) => isButtonLike(el) && buttonText(el) === 'apply' && visible(el));
      if (apply) break;
      await wait(250);
    }
    if (!apply) throw new Error('Amazon’s Apply button stayed hidden for 10 seconds after the dates were entered.');
    apply.click();
    setStatus(`Applied ASIN Sales date range ${range.start}–${range.end}; waiting for the report…`);

    const deadline = Date.now() + 60000;
    let applied = false;
    while (Date.now() < deadline) {
      await wait(500);
      const currentFields = allElements().filter((el) => el.tagName === 'KAT-INPUT'
        && el.getAttribute('placeholder') === 'DD/MM/YYYY' && visible(el));
      const body = document.body.innerText;
      if (currentFields.length >= 2
          && String(currentFields[0].value || '') === range.start
          && String(currentFields[1].value || '') === range.end
          && body.includes(`Data from ${range.end}`)) {
        applied = true;
        break;
      }
    }
    if (!applied) throw new Error(`Timed out waiting for Amazon to apply ${range.start}–${range.end}.`);
    await wait(1500);

    const download = allElements().find((el) => isButtonLike(el)
      && buttonText(el) === 'download (.csv)' && visible(el));
    if (!download) throw new Error('Amazon’s Download (.csv) control was not visible after applying the dates.');
    download.click();
    markDownloadedToday('Amazon ASIN Sales');
    setStatus(`Clicked Amazon’s Download (.csv) for ASIN Sales ${range.start}–${range.end}. Check Chrome Downloads for completion.`);
  }

  // Flipkart: open its Downloads History drawer, reuse the newest completed
  // listing file when available, or request a new listing workbook.
  function flipkartOrderRequestUrl() {
    const request = {
      one_time_request: { reportGroup: null, reportName: null, enable: true, status: null },
      repeat_request: { repeat_report_group_name: null, repeat_report_name: null, repeat_enable: false },
      pagination: { page_size: 10, starting_page: 1 },
      request_report: { create_request: true, report_type: 'Fulfilment Reports', report_subtype: 'Orders', repeat_report: false }
    };
    const url = new URL('https://seller.flipkart.com/index.html');
    url.hash = 'dashboard/metrics/report-centre?query=' + encodeURIComponent(JSON.stringify(request));
    return url.href;
  }

  function flipkartOrderReportAction() {
    return {
      label: 'Request and download Flipkart Orders (last 30 days)',
      run: async () => {
        const currentQuery = new URLSearchParams(location.hash.split('?')[1] || '').get('query') || '';
        if (location.hash.includes('metrics/report-centre') && currentQuery.includes('report_subtype')) return runFlipkartOrders();
        const url = new URL(flipkartOrderRequestUrl());
        url.searchParams.set('mwfRun', 'fkOrders');
        url.searchParams.set('mwfRunId', String(Date.now()));
        location.href = url.href;
      }
    };
  }

  function flipkartDateLabel(date) {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(date);
  }

  function rollingThirtyCalendarDays() {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    start.setDate(start.getDate() - 29);
    return { start, end, startLabel: flipkartDateLabel(start), endLabel: flipkartDateLabel(end) };
  }

  function visibleFlipkartDateInput() {
    const monthPattern = /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s+\d{4}/i;
    return allElements().filter((el) => el.tagName === 'INPUT' && visible(el))
      .find((el) => /date|range/i.test(el.getAttribute('placeholder') || el.getAttribute('aria-label') || '')
        || (el.value && monthPattern.test(el.value) && /-|\bto\b/i.test(el.value))) || null;
  }

  function flipkartCalendarDateButton(date) {
    const full = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
    const short = flipkartDateLabel(date);
    const iso = String(date.getFullYear()).padStart(4, '0') + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    const normalizeDateText = (value) => norm(value).replace(/,/g, '').replace(/(\d+)(st|nd|rd|th)\b/g, '$1');
    const fullNeedle = normalizeDateText(full);
    const shortNeedle = normalizeDateText(short);
    return allElements().filter((el) => visible(el) && !el.closest('[data-visible="false"]')
      && !el.disabled && el.getAttribute('aria-disabled') !== 'true'
      && (isButtonLike(el) || el.getAttribute('role') === 'gridcell' || el.hasAttribute('data-date')))
      .find((el) => {
        const label = [el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('data-date'), el.innerText || el.textContent].join(' ');
        const normalized = normalizeDateText(label);
        return normalized.includes(fullNeedle) || normalized.includes(shortNeedle) || label.includes(iso);
      }) || null;
  }

  async function selectFlipkartCalendarDate(date) {
    const deadline = Date.now() + 8000;
    let attempts = 0;
    while (Date.now() < deadline && attempts < 12) {
      const day = flipkartCalendarDateButton(date);
      if (day) { day.click(); await wait(200); return true; }
      const next = allElements().find((el) => isButtonLike(el) && visible(el)
        && /next month|next page|next/i.test([el.getAttribute('aria-label'), el.getAttribute('title'), buttonText(el)].join(' ')));
      const previous = allElements().find((el) => isButtonLike(el) && visible(el)
        && /previous month|prev month|previous page|previous|prev/i.test([el.getAttribute('aria-label'), el.getAttribute('title'), buttonText(el)].join(' ')));
      const targetMonth = date.getFullYear() * 12 + date.getMonth();
      const monthHeader = Array.from(document.querySelectorAll('.CalendarMonth[data-visible="true"] .CalendarMonth_caption')).find(visible) || allElements().find((el) => visible(el) && el.children.length === 0
        && /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+20\d{2}/i.test(el.innerText || el.textContent));
      const header = norm(monthHeader?.innerText || monthHeader?.textContent);
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const monthIndex = monthNames.findIndex((name) => header.startsWith(name));
      const year = Number(header.match(/20\d{2}/)?.[0]);
      const currentMonth = year && monthIndex >= 0 ? year * 12 + monthIndex : null;
      const navigation = currentMonth != null && currentMonth > targetMonth ? previous : next;
      if (!navigation) break;
      navigation.click();
      attempts++;
      await wait(200);
    }
    return false;
  }

  async function selectFlipkartCalendarRange(range) {
    let custom = allElements().find((el) => isButtonLike(el) && visible(el) && buttonText(el) === 'custom');
    if (!custom) {
      const field = Array.from(document.querySelectorAll('div.form-control')).find((el) => visible(el)
        && el.querySelector('.fa-calendar'));
      if (!field) throw new Error('Flipkart’s date-range field was not visible; no report was requested.');
      field.click();
      await wait(300);
      custom = allElements().find((el) => isButtonLike(el) && visible(el) && buttonText(el) === 'custom');
    }
    if (!custom) throw new Error('Flipkart’s Custom date-range tab was not visible; no report was requested.');
    custom.click();
    await wait(500);
    if (!await selectFlipkartCalendarDate(range.start)) {
      throw new Error('Flipkart’s calendar did not expose the custom start date; no report was requested.');
    }
    if (!await selectFlipkartCalendarDate(range.end)) {
      throw new Error('Flipkart’s calendar did not expose the custom end date; no report was requested.');
    }
  }

  async function setFlipkartOrderDates(range) {
    let input = visibleFlipkartDateInput();
    if (!input) {
      await selectFlipkartCalendarRange(range);
      return;
    }
    if (!input) {
      await selectFlipkartCalendarRange(range);
      return;
    }
    const dateToIsoLocal = (date) => String(date.getFullYear()).padStart(4, '0') + '-'
      + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    if (input.type === 'date') {
      const dateInputs = allElements().filter((el) => el.tagName === 'INPUT' && el.type === 'date' && visible(el));
      if (dateInputs.length < 2) throw new Error('Flipkart’s date picker did not expose both start and end dates.');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (!setter) throw new Error('Could not update Flipkart’s custom date range.');
      setter.call(dateInputs[0], dateToIsoLocal(range.start));
      dateInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      dateInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
      setter.call(dateInputs[1], dateToIsoLocal(range.end));
      dateInputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      dateInputs[1].dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      if (input.readOnly) {
        input.click();
        await wait(250);
        await selectFlipkartCalendarRange(range);
        return;
      }
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (!setter) throw new Error('Could not update Flipkart’s custom date range.');
      const value = range.startLabel + '- ' + range.endLabel;
      input.focus();
      setter.call(input, value);
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.blur();
    }
    const startNeedle = norm(range.startLabel).replace(/,/g, '');
    const endNeedle = norm(range.endLabel).replace(/,/g, '');
    const startIso = dateToIsoLocal(range.start);
    const endIso = dateToIsoLocal(range.end);
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const values = allElements().filter((el) => el.tagName === 'INPUT' && visible(el)).map((el) => norm(el.value || el.getAttribute('value') || '')).join(' ');
      const formattedDatesSet = values.replace(/,/g, '').includes(startNeedle) && values.replace(/,/g, '').includes(endNeedle);
      const isoDatesSet = values.includes(startIso) && values.includes(endIso);
      if (formattedDatesSet || isoDatesSet) return;
      input = visibleFlipkartDateInput() || input;
      await wait(100);
    }
    throw new Error('Flipkart did not accept the custom last-30-days date range; no report was requested.');
  }

  function flipkartOrdersRows() {
    return Array.from(document.querySelectorAll('table tr')).map((row) => {
      const cells = Array.from(row.cells || []);
      if (cells.length < 6 || norm(cells[0].innerText) !== 'fulfilment reports' || norm(cells[1].innerText) !== 'orders') return null;
      const rangeText = String(cells[2].innerText || '').trim();
      const requestText = String(cells[3].innerText || '').trim();
      const statusText = norm(cells[5].innerText);
      const key = [rangeText, requestText].join('|');
      return { row, rangeText, requestText, key, status: statusText.includes('generated') ? 'done' : statusText.includes('failed') ? 'failed' : 'inprogress' };
    }).filter(Boolean);
  }

  function flipkartOrderDownloadButton(row) {
    return Array.from(row.querySelectorAll('kat-button,button,[role="button"],a'))
      .find((el) => isButtonLike(el) && buttonText(el).includes('download') && visible(el)) || null;
  }

  function flipkartRangeMatches(text, range) {
    const found = String(text || '').match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/gi) || [];
    const normalizeDate = (value) => norm(value).replace(/,/g, '').replace(/\s+/g, ' ');
    return found.length >= 2 && normalizeDate(found[0]) === normalizeDate(range.startLabel)
      && normalizeDate(found[1]) === normalizeDate(range.endLabel);
  }

  async function runFlipkartOrders() {
    if (skipIfDownloadedToday('Flipkart Orders')) return;
    const range = rollingThirtyCalendarDays();
    setStatus('Preparing Flipkart Fulfilment Reports → Orders for ' + range.startLabel + ' through ' + range.endLabel + '…');
    const formDeadline = Date.now() + 20000;
    while (Date.now() < formDeadline && !document.body.innerText.includes('Please fill below details for one time report generation')) {
      const requestNew = allElements().find((el) => isButtonLike(el) && buttonText(el) === 'request new report' && visible(el));
      if (requestNew) { requestNew.click(); await wait(250); }
      const fulfilment = allElements().find((el) => isButtonLike(el) && buttonText(el) === 'fulfilment reports' && visible(el));
      if (fulfilment) { fulfilment.click(); await wait(250); }
      const description = allElements().find((el) => visible(el)
        && norm(el.innerText || el.textContent).includes('detailed information of all orders and evaluation of past fulfilment performance'));
      if (description) {
        let card = description;
        let requestButton = null;
        for (let depth = 0; depth < 8 && card && !requestButton; depth++, card = card.parentElement) {
          requestButton = allElements(card).find((el) => isButtonLike(el) && buttonText(el) === 'request report' && visible(el));
        }
        if (requestButton) { requestButton.click(); await wait(250); }
      }
      if (document.body.innerText.includes('Please fill below details for one time report generation')) break;
      await wait(250);
    }
    if (!document.body.innerText.includes('Please fill below details for one time report generation')) {
      throw new Error('Flipkart’s Fulfilment Reports → Orders date form did not open.');
    }
    if (!document.body.innerText.includes('Orders')) throw new Error('Flipkart did not open the Orders report request.');
    await setFlipkartOrderDates(range);
    const wantedText = range.startLabel + ' - ' + range.endLabel;
    const selectedRange = allElements().filter((el) => el.tagName === 'INPUT' && visible(el))
      .map((el) => norm(el.value || '')).join(' ');
    const dateRangeLabel = allElements().filter((el) => visible(el)
      && norm(el.innerText || el.textContent).startsWith('select date range'))
      .map((el) => norm(el.innerText || el.textContent)).join(' ');
    const displayedRange = selectedRange + ' ' + dateRangeLabel;
    const expectedStart = norm(range.startLabel).replace(/,/g, '');
    const expectedEnd = norm(range.endLabel).replace(/,/g, '');
    const startIso = String(range.start.getFullYear()).padStart(4, '0') + '-'
      + String(range.start.getMonth() + 1).padStart(2, '0') + '-' + String(range.start.getDate()).padStart(2, '0');
    const endIso = String(range.end.getFullYear()).padStart(4, '0') + '-'
      + String(range.end.getMonth() + 1).padStart(2, '0') + '-' + String(range.end.getDate()).padStart(2, '0');
    const formattedDatesSet = displayedRange.replace(/,/g, '').includes(expectedStart)
      && displayedRange.replace(/,/g, '').includes(expectedEnd);
    const isoDatesSet = displayedRange.includes(startIso) && displayedRange.includes(endIso);
    if (!formattedDatesSet && !isoDatesSet) {
      throw new Error('Flipkart did not visibly confirm both custom dates; no report was requested.');
    }
    const before = new Set(flipkartOrdersRows().map((entry) => entry.key));
    const submit = allElements().find((el) => isButtonLike(el) && buttonText(el) === 'submit' && visible(el));
    if (!submit) throw new Error('Flipkart’s Orders SUBMIT button was not visible.');
    submit.click();
    setStatus('Requested Flipkart Orders for ' + wantedText + '; waiting for the report to finish…');
    const deadline = Date.now() + 20 * 60 * 1000;
    let created = null;
    while (Date.now() < deadline) {
      await wait(2000);
      created = flipkartOrdersRows().find((entry) => !before.has(entry.key) && flipkartRangeMatches(entry.rangeText, range)) || null;
      if (created && ['done', 'failed'].includes(created.status)) break;
      if (created) setStatus('Flipkart Orders is processing; waiting for its report to become available…');
    }
    if (!created) throw new Error('Timed out waiting for the new Flipkart Orders report. Check the Reports list.');
    if (created.status === 'failed') throw new Error('Flipkart marked the new Orders report as failed.');
    const download = flipkartOrderDownloadButton(created.row);
    if (!download) throw new Error('Flipkart marked the Orders report generated, but its Download button was not visible.');
    download.click();
    markDownloadedToday('Flipkart Orders');
    setStatus('Clicked Flipkart Download for Orders (' + wantedText + '). Check Chrome Downloads for completion.');
  }

  function flipkartListingRows() {
    const buttons = allElements().filter((el) => (isButtonLike(el) || el.tagName === 'A') && buttonText(el) === 'download' && visible(el));
    const rows = [];
    for (const button of buttons) {
      let row = button;
      for (let i = 0; i < 10 && row.parentElement; i++) {
        row = row.parentElement;
        const text = norm(row.innerText || row.textContent);
        if (text.includes('.xls') && text.includes('listing')) break;
      }
      const text = norm(row.innerText || row.textContent);
      if (text.includes('.xls') && text.includes('listing') && !rows.includes(row)) rows.push(row);
    }
    return rows;
  }

  async function openFlipkartHistory() {
    if (exactText('Downloads History')) return;
    const recentDownloadsTestId = 'option-item-View Recent Downloads-download-menu-btn';
    let recentDownloads = allElements().find((el) => el.getAttribute('data-testid') === recentDownloadsTestId && visible(el));
    if (!recentDownloads) {
      // Downloads is part of the Listings toolbar; it is absent on the home page.
      let downloadsButton = allElements().find((el) => isButtonLike(el) && buttonText(el) === 'downloads' && visible(el));
      if (!downloadsButton) {
        const listingsNav = document.querySelector('#trigger-nav-menu-Listings')
          || allElements().find((el) => el.getAttribute('data-testid') === 'trigger-nav-menu-Listings' && visible(el));
        if (!listingsNav) throw new Error('Flipkart’s Listings navigation was not visible.');
        listingsNav.click();
        const listingsDeadline = Date.now() + 20000;
        while (Date.now() < listingsDeadline) {
          downloadsButton = allElements().find((el) => isButtonLike(el) && buttonText(el) === 'downloads' && visible(el));
          if (downloadsButton) break;
          await wait(250);
        }
      }
      if (!downloadsButton) throw new Error('Flipkart Listings opened, but its Downloads button did not appear.');
      downloadsButton.click();

      // The menu is rendered asynchronously; the old 150 ms check often ran
      // before its item entered the DOM and falsely reported that it failed.
      const menuDeadline = Date.now() + 10000;
      while (Date.now() < menuDeadline) {
        recentDownloads = allElements().find((el) => el.getAttribute('data-testid') === recentDownloadsTestId && visible(el));
        if (recentDownloads || exactText('View Recent Downloads')) break;
        await wait(150);
      }
    }
    if (!recentDownloads) {
      recentDownloads = allElements().find((el) => el.getAttribute('data-testid') === recentDownloadsTestId && visible(el));
    }
    if (recentDownloads) recentDownloads.click();
    else if (exactText('View Recent Downloads')) clickText('View Recent Downloads');
    else throw new Error('Flipkart’s Downloads menu did not open.');
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline && !exactText('Downloads History')) await wait(300);
    if (!exactText('Downloads History')) throw new Error('Flipkart Downloads History did not open.');
  }
  async function downloadFlipkartListing() {
    await openFlipkartHistory();
    // Let the history drawer finish rendering before deciding that there is no
    // completed file. This button must only download an existing file; creating
    // a new report is an explicit action on the separate “Generate” button.
    let rows = [];
    const renderDeadline = Date.now() + 8000;
    while (Date.now() < renderDeadline) {
      rows = flipkartListingRows();
      if (rows.length) break;
      await wait(300);
    }
    if (!rows.length) throw new Error('No completed Flipkart Listing file with a Download button is visible.');
    const download = allElements(rows[0]).find((el) => (isButtonLike(el) || el.tagName === 'A') && buttonText(el) === 'download' && visible(el));
    if (!download) throw new Error('The newest completed Flipkart Listing row no longer has a visible Download button.');
    download.click();
    setStatus('Clicked Flipkart’s native Download control for the newest completed Listing file. Check Chrome Downloads and confirm it is over 20 MB; Seller Hub does not show file size here.');
  }

  function flipkartListingKey(row) {
    const text = norm(row.innerText || row.textContent);
    return (text.match(/[^\s]+\.xlsx?\b/) || [])[0] || '';
  }

  function listingSizeMb(row) {
    const match = String(row.innerText || row.textContent).match(/(\d+(?:\.\d+)?)\s*(GB|MB|KB|bytes)\b/i);
    if (!match) return null;
    const value = Number(match[1]);
    return /gb/i.test(match[2]) ? value * 1000 : /kb/i.test(match[2]) ? value / 1000 : /bytes/i.test(match[2]) ? value / 1000000 : value;
  }

  async function runFlipkartListingWorkflow() {
    await openFlipkartHistory();
    await wait(1500);
    const latest = flipkartListingRows()[0];
    if (!latest) return generateFreshFlipkartListing();
    const size = listingSizeMb(latest);
    if (size == null) throw new Error('Seller Hub does not expose the latest file size. Use Download latest, check Chrome Downloads, then use Generate fresh only if it is 20 MB or smaller. Automatic generation paused to avoid an unnecessary request.');
    if (size > 20) return downloadFlipkartListing();
    return generateFreshFlipkartListing();
  }

  async function generateFreshFlipkartListing() {
    await openFlipkartHistory();
    await wait(1500);
    const before = new Set(flipkartListingRows().map(flipkartListingKey));
    if (exactText('Downloads History')) {
      const close = allElements().find((el) => isButtonLike(el) && buttonText(el) === 'close' && visible(el));
      if (close) close.click();
      await wait(200);
    }
    if (!exactText('Download Listing File')) clickText('Downloads');
    await wait(150);
    clickText('Download Listing File');
    setStatus('Requested a fresh Flipkart Listing file; waiting for its completed entry…');
    await wait(1500);
    await openFlipkartHistory();
    const deadline = Date.now() + 15 * 60 * 1000;
    let rows = [];
    while (Date.now() < deadline) {
      await wait(2500);
      rows = flipkartListingRows();
      rows = rows.filter(row => flipkartListingKey(row) && !before.has(flipkartListingKey(row)));
      if (rows.length) break;
    }
    if (rows.length !== 1) throw new Error('Could not uniquely identify the new completed Listing file. No old file was downloaded.');
    allElements(rows[0]).find((el) => (isButtonLike(el) || el.tagName === 'A') && buttonText(el) === 'download' && visible(el))?.click();
    setStatus('Clicked Download for the new Flipkart Listing workbook. Verify in Chrome Downloads that it exceeds 20 MB.');
  }

  function sqlEditor() {
    return document.querySelector('.cm-content[contenteditable="true"]') || allElements().find((el) => el.getAttribute('contenteditable') === 'true' && el.getAttribute('data-language') === 'sql');
  }

  function sqlHasResults() {
    return !!document.querySelector('#nav-preview table') && /of\s+[\d,]+\s+total rows/i.test(document.body.innerText);
  }

  function sqlHasEmptyQueryError() {
    const body = norm(document.body?.innerText);
    return body.includes('query was empty') || /\b1065\b/.test(body);
  }

  function sqlResultsMatchExpected() {
    const headers = Array.from(document.querySelectorAll('#nav-preview table thead th'))
      .map((cell) => norm(cell.innerText || cell.textContent))
      .filter(Boolean); // SQL Explorer prepends a blank row-number column.
    return headers.length === 5
      && headers.join('|') === ['scm_master_category', 'item_sku', 'mrp', 'sale_price', 'active'].join('|');
  }

  function sqlEditorText(editor = sqlEditor()) {
    return norm(editor?.innerText || editor?.textContent).replace(/\s/g, '');
  }

  function writeSqlQueryToEditor(editor = sqlEditor()) {
    if (!editor) throw new Error('Could not find SQL Explorer’s SQL editor.');
    editor.focus();
    // Use the editor's own select-all command before inserting. A raw DOM
    // Range changes CodeMirror's rendered text without updating its document
    // model, which caused the form to submit an empty SQL field.
    if (!document.execCommand('selectAll')) {
      throw new Error('Could not select the SQL editor contents; no query was run.');
    }
    editor.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: SQL }));
    if (!document.execCommand('insertText', false, SQL)) {
      throw new Error('The SQL editor rejected text insertion. Paste the query manually, then retry.');
    }
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: SQL }));
    if (sqlEditorText(editor) !== norm(SQL).replace(/\s/g, '')) {
      throw new Error('Could not verify the exact SQL in the editor; no query was run.');
    }
    // SQL Explorer submits a hidden textarea backing its CodeMirror editor.
    // Seed it too so a framework sync delay cannot turn Refresh into an empty query.
    const sqlField = document.querySelector('#id_sql');
    if (sqlField) {
      sqlField.value = SQL;
      sqlField.dispatchEvent(new Event('input', { bubbles: true }));
      sqlField.dispatchEvent(new Event('change', { bubbles: true }));
      if (sqlField.value !== SQL) throw new Error('SQL Explorer’s form field did not accept the query.');
    }
    return editor;
  }

  function armSqlSubmission(runButton) {
    const form = runButton?.closest('form');
    const sqlField = document.querySelector('#id_sql');
    if (!form || !sqlField) throw new Error('SQL Explorer’s query form field was not found.');
    // SQL Explorer uses CodeMirror for the visible editor and a hidden
    // textarea for the Django form. Its submit-time synchronization can
    // replace that textarea with an empty value. Seed it on submit, then set
    // the actual form payload in `formdata`, which runs after submit handlers
    // and immediately before the browser serializes the form.
    const setQuery = () => {
      sqlField.value = SQL;
      sqlField.dispatchEvent(new Event('input', { bubbles: true }));
      sqlField.dispatchEvent(new Event('change', { bubbles: true }));
    };
    form.addEventListener('submit', setQuery, { once: true });
    form.addEventListener('formdata', (event) => {
      event.formData.set('sql', SQL);
    }, { once: true });
  }

  async function downloadSqlCsv() {
    const deadline = Date.now() + 10000;
    let menu = null;
    let csv = null;
    let menuClickSent = false;
    while (Date.now() < deadline) {
      menu = document.querySelector('#download_options');
      if (!menu) throw new Error('SQL Explorer’s Download menu was not found.');
      // Some SQL Explorer layouts leave a hidden CSV control earlier in the
      // DOM. Select the first visible control so we never mistake a hidden
      // menu item for the one the user can click.
      csv = [...document.querySelectorAll('.download-button[data-format="csv"]')]
        .find((button) => visible(button) && !button.disabled);
      if (csv && visible(csv)) break;
      // Click the menu once only. Re-clicking while it is opening can toggle
      // it closed, which made the CSV option appear to be hovered but not run.
      if (!menuClickSent) {
        menu.click();
        menuClickSent = true;
      }
      await wait(150);
    }
    if (!csv || !visible(csv) || csv.disabled) throw new Error('The built-in CSV option did not appear as a visible, enabled control in Download.');
    const rowCount = document.body.innerText.match(/of\s+([\d,]+)\s+total rows/i)?.[1];
    csv.scrollIntoView({ block: 'center', inline: 'nearest' });
    csv.focus({ preventScroll: true });
    setStatus(`Activating the visible Download → CSV control${rowCount ? ` for ${rowCount} returned rows` : ''}…`);
    csv.click();
    await wait(1200);
    if (/ERR_BLOCKED_BY_CLIENT/.test(document.body.innerText)) {
      if (!visible(csv) || !csv.isConnected) throw new Error('Chrome blocked the CSV action. Return to SQL Explorer and retry its normal CSV control once; browser settings were not changed.');
      csv.click();
      await wait(1200);
      if (/ERR_BLOCKED_BY_CLIENT/.test(document.body.innerText)) throw new Error('Chrome still blocked CSV after one retry. Stopped.');
    }
    setStatus(`Activated the visible Download → CSV control${rowCount ? ` for ${rowCount} returned rows` : ''}. Check Chrome Downloads to confirm the file completed.`);
  }

  async function resumeSqlExportAfterRefresh() {
    const saved = sessionStorage.getItem(SQL_RESUME_KEY);
    if (!saved) return;
    let state;
    try { state = JSON.parse(saved); } catch { sessionStorage.removeItem(SQL_RESUME_KEY); return; }
    if (!state?.startedAt || Date.now() - state.startedAt > 10 * 60 * 1000) {
      sessionStorage.removeItem(SQL_RESUME_KEY);
      return;
    }
    const editor = sqlEditor();
    const expected = norm(SQL).replace(/\s/g, '');
    if (!sqlHasResults() && (sqlEditorText(editor) !== expected || sqlHasEmptyQueryError())) {
      // SQL Explorer can clear its CodeMirror editor or submit an empty hidden
      // field even while the visible editor still contains the query. Restore
      // both fields and retry a few times before stopping safely.
      if ((state.recoveries || 0) >= 3) {
        sessionStorage.removeItem(SQL_RESUME_KEY);
        throw new Error('SQL Explorer kept submitting an empty query after three recoveries; no CSV was downloaded.');
      }
      writeSqlQueryToEditor(editor);
      state.recoveries = (state.recoveries || 0) + 1;
      sessionStorage.setItem(SQL_RESUME_KEY, JSON.stringify(state));
      const retry = document.querySelector('#refresh_play_button');
      if (!retry) {
        sessionStorage.removeItem(SQL_RESUME_KEY);
        throw new Error('The query was restored, but SQL Explorer’s Refresh control was not found.');
      }
      armSqlSubmission(retry);
      setStatus(`SQL Explorer returned an empty-query error. Restored the exact query and retrying (${state.recoveries}/3)…`);
      retry.click();
      return;
    }
    setStatus('Query refreshed; waiting for the results, then continuing to CSV…');
    const deadline = Date.now() + 5 * 60 * 1000;
    while (Date.now() < deadline && !sqlHasResults()) {
      const body = document.body.innerText;
      if (sqlHasEmptyQueryError()) {
        if ((state.recoveries || 0) >= 3) {
          sessionStorage.removeItem(SQL_RESUME_KEY);
          throw new Error('SQL Explorer kept submitting an empty query after three recoveries; no CSV was downloaded.');
        }
        writeSqlQueryToEditor(editor);
        state.recoveries = (state.recoveries || 0) + 1;
        sessionStorage.setItem(SQL_RESUME_KEY, JSON.stringify(state));
        const retry = document.querySelector('#refresh_play_button');
        if (!retry) {
          sessionStorage.removeItem(SQL_RESUME_KEY);
          throw new Error('The query was restored, but SQL Explorer’s Refresh control was not found.');
        }
        armSqlSubmission(retry);
        setStatus(`SQL Explorer returned an empty-query error. Restored the exact query and retrying (${state.recoveries}/3)…`);
        retry.click();
        return;
      }
      if (/query error|syntax error|failed to execute|query was empty|1065/i.test(body.slice(-3000))) {
        sessionStorage.removeItem(SQL_RESUME_KEY);
        throw new Error('SQL Explorer reported a query error; no CSV was downloaded.');
      }
      await wait(500);
    }
    if (!sqlHasResults()) { sessionStorage.removeItem(SQL_RESUME_KEY); throw new Error('Timed out waiting for SQL Explorer results after Refresh.'); }
    if (sqlEditorText(editor) !== expected || !sqlResultsMatchExpected()) {
      sessionStorage.removeItem(SQL_RESUME_KEY);
      throw new Error('SQL Explorer results did not match the requested five-column query; CSV was not clicked.');
    }
    sessionStorage.removeItem(SQL_RESUME_KEY);
    await downloadSqlCsv();
  }

  // SQL Explorer: use its normal Refresh and Download → CSV controls. The
  // refresh is a form submission, so keep a short-lived resume marker across
  // the page reload instead of waiting in a script context that will vanish.
  async function runSqlExport() {
    const editor = writeSqlQueryToEditor();

    const run = document.querySelector('#refresh_play_button');
    if (!run) throw new Error('SQL Explorer’s Refresh (run query) control was not found.');
    sessionStorage.setItem(SQL_RESUME_KEY, JSON.stringify({ startedAt: Date.now() }));
    armSqlSubmission(run);
    setStatus('Query submitted; the page may refresh. The helper will continue with CSV when results return…');
    run.click();
  }

  if (location.hostname === 'sellercentral.amazon.in' && location.pathname.startsWith('/business-reports')) {
    addPanel('Amazon Reports', [
      dailyReportsAction(),
      ...amazonSingleReportActions(),
      amazonAsinSalesAction(),
      amazonOrdersAction()
    ]);
    autoRunRequested('asin', runAmazonAsinSales);
  } else if (location.hostname === 'sellercentral.amazon.in' && location.pathname.startsWith('/listing/reports')) {
    addPanel('Amazon Inventory Reports', [dailyReportsAction(), ...amazonSingleReportActions(), { label: 'Request and download both reports', run: runAmazon }, amazonAsinSalesAction(), amazonOrdersAction()]);
    autoRunAmazonSingleReport();
    autoRunRequested('inventory', runAmazon);
  } else if (location.hostname === 'sellercentral.amazon.in' && location.pathname.startsWith('/order-reports-and-feeds/reports')) {
    addPanel('Amazon Order Reports', [dailyReportsAction(), amazonOrdersAction(), amazonAsinSalesAction()]);
    autoRunRequested('amazonOrders', runAmazonOrders);
  } else if (location.hostname === 'sellercentral.amazon.in') {
    addPanel('Amazon Reports Helper', [
      dailyReportsAction(),
      ...amazonSingleReportActions(),
      { label: 'Open Inventory Reports', run: async () => { location.href = 'https://sellercentral.amazon.in/listing/reports'; } },
      amazonAsinSalesAction(),
      amazonOrdersAction()
    ]);
  } else if (location.hostname === 'seller.flipkart.com') {
    addPanel('Flipkart Reports', [
      dailyReportsAction(),
      { label: 'Run Listing workflow (check size / fallback)', run: runFlipkartListingWorkflow },
      { label: 'Download latest completed Listing file', run: downloadFlipkartListing },
      { label: 'Generate and download a fresh Listing file', run: generateFreshFlipkartListing },
      flipkartOrderReportAction()
    ]);
    autoRunRequested('flipkart', runFlipkartListingWorkflow);
    autoRunRequested('fkOrders', runFlipkartOrders);
  } else if (location.hostname === 'reports.wakefit.co' && location.pathname.startsWith('/explorer/play')) {
    addPanel('Wakefit SQL Export', [dailyReportsAction(), { label: 'Run active products query and export CSV', run: runSqlExport }]);
    if (sessionStorage.getItem(SQL_RESUME_KEY)) {
      guardedRun("SQL continuation", resumeSqlExportAfterRefresh).catch((error) => setStatus(error?.message || String(error), true));
    } else {
      autoRunRequested('sql', runSqlExport);
    }
  }
  if (location.hostname === 'sellercentral.amazon.in') checkPendingAmazonDownload();
})();
