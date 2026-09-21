

/* ======================================================
   GLOBAL STATE
====================================================== */

let uploadConfig = [];

window.wakeSuiteSessionReports = {};
window.masterPricingAmazon = null;
window.masterPricingFlipkart = null;
window.amazonPriceDisparityResult = null;
window.flipkartPriceDisparityResult = null;
window.currentAuditSummary = null;


/* ======================================================
   GOOGLE SHEETS
====================================================== */

const GOOGLE_SHEETS_CLIENT_ID =
  "34563161502-ohhc52ja244ei4u7lsvp6196tn992bed.apps.googleusercontent.com";

const GOOGLE_SHEETS_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets.readonly";

const MASTER_PRICING_SPREADSHEET_ID =
  "1QQ7C6duvtNaNPnEiHEBU9jjfKNNFpcKCAZ3oSuWGulw";

const AMAZON_MASTER_RANGE =
  "Amazon!A:D";

const FLIPKART_MASTER_RANGE =
  "Flipkart!A:G";

let sheetsTokenClient = null;
let sheetsAccessToken = null;


/* ======================================================
   CONSTANTS
====================================================== */

const PRICE_THRESHOLD = 5;
const DEFAULT_AMAZON_BUSINESS_REPORT_DAYS = 60;

const BUILTIN_AUDIT_CONFIG = {
  id:"marketplace_audit_report",
  menu:"Audit",
  folder:"Amazon + Flipkart Audit Report",
  active:true,
  sortOrder:70,
  builtIn:true
};

const BUILTIN_AMAZON_ORDER_CONFIG = {
  id:"amazon_order_report",
  menu:"Amazon",
  folder:"Order Report · Exception Insights",
  active:true,
  sortOrder:45,
  builtIn:true,
  optional:true
};


/* ======================================================
   BASIC HELPERS
====================================================== */

function normalizeKey(value){

  return String(
    value ?? ""
  ).trim();

}


function canonicalHeader(value){

  return String(
    value ?? ""
  )
  .replace(/^\uFEFF/,"")
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]/g,"");

}


function cleanHeader(value){

  return String(
    value ?? ""
  )
  .replace(/^\uFEFF/,"")
  .trim();

}


function isUsefulHeader(header){

  const value =
    String(
      header || ""
    ).trim();

  if(!value){
    return false;
  }

  if(value === "__EMPTY"){
    return false;
  }

  if(value.startsWith("__EMPTY_")){
    return false;
  }

  return true;

}


function normalizeRow(row){

  const cleaned = {};

  Object.entries(row)
  .forEach(
    ([key,value]) => {

      const cleanKey =
        cleanHeader(key);

      if(
        !isUsefulHeader(
          cleanKey
        )
      ){
        return;
      }

      cleaned[cleanKey] =
        value;

    }
  );

  return cleaned;

}


function getRowValue(
  row,
  targetHeader
){

  const target =
    canonicalHeader(
      targetHeader
    );

  for(
    const [key,value]
    of Object.entries(row)
  ){

    if(
      canonicalHeader(key) ===
      target
    ){
      return value;
    }

  }

  return "";

}


function parseNumber(value){

  if(
    value === null ||
    value === undefined ||
    value === ""
  ){
    return 0;
  }

  const cleaned =
    String(value)
    .replace(/,/g,"")
    .trim();

  const number =
    Number(cleaned);

  return Number.isFinite(number)
    ? number
    : 0;

}


function parseMoney(value){

  if(
    value === null ||
    value === undefined ||
    value === ""
  ){
    return 0;
  }

  const cleaned =
    String(value)
    .replace(/[^0-9.-]/g,"");

  const number =
    Number(cleaned);

  return Number.isFinite(number)
    ? number
    : 0;

}


function formatINR(value){

  return new Intl.NumberFormat(
    "en-IN",
    {
      style:"currency",
      currency:"INR",
      maximumFractionDigits:2
    }
  )
  .format(
    value || 0
  );

}


function escapeHtml(value){

  return String(
    value ?? ""
  )
  .replaceAll("&","&amp;")
  .replaceAll("<","&lt;")
  .replaceAll(">","&gt;")
  .replaceAll('"',"&quot;")
  .replaceAll("'","&#039;");

}



function parseAuditBoolean(value){

  if(value === true || value === 1){
    return true;
  }

  if(value === false || value === 0){
    return false;
  }

  const text =
    String(value ?? "")
    .trim()
    .toLowerCase();

  if(["true","yes","y","1"].includes(text)){
    return true;
  }

  if(["false","no","n","0"].includes(text)){
    return false;
  }

  return null;

}


function isBlank(value){

  return String(value ?? "")
    .trim() === "";

}


function formatNumber(value){

  return Number(value || 0)
    .toLocaleString("en-IN");

}


function formatPercent(value){

  return (
    (Number(value) || 0) * 100
  ).toFixed(2) + "%";

}


function pill(text,type="neutral"){

  return `<span class="pill ${type}">${escapeHtml(text)}</span>`;

}


function goToSection(id){

  showView(id);

}


const APP_VIEW_META = {
  dashboardHome:[
    "Marketplace Control Center",
    "Wakefit Amazon + Flipkart pricing, audit, suppression, buy box and revenue-impact analysis"
  ],
  disparityHubSection:[
    "Price Disparity",
    "Amazon and Flipkart Listing Price, Live Price and MRP disparity"
  ],
  amazonSuppressionSection:[
    "Amazon Suppressions",
    "Active + in-stock suppressed ASINs with daily revenue impact"
  ],
  amazonBuyBoxSection:[
    "Amazon Buy Box",
    "Active + in-stock Buy Box suppressed ASINs with daily revenue impact"
  ],
  uploadSection:[
    "Data Center",
    "Validate and load marketplace reports into the current browser session"
  ],
  masterPricingSection:[
    "Master Pricing",
    "Live Amazon and Flipkart mapping from Google Sheets"
  ],
  auditSection:[
    "Audit Health",
    "Shared Amazon + Flipkart live audit status"
  ],
  engineSection:[
    "Marketplace Engines",
    "Run Amazon and Flipkart processing after required inputs are loaded"
  ],
  amazonPriceDisparitySection:[
    "Amazon Results",
    "Detailed Amazon processing output"
  ],
  flipkartPriceDisparitySection:[
    "Flipkart Results",
    "Detailed Flipkart processing output"
  ]
};


function showView(id){

  document
  .querySelectorAll(
    ".app-view"
  )
  .forEach(
    element =>
      element.classList.remove(
        "active"
      )
  );

  const target =
    document.getElementById(id);

  if(!target){
    return;
  }

  target.classList.add(
    "active"
  );

  const meta =
    APP_VIEW_META[id];

  if(meta){

    const title =
      document.getElementById(
        "pageTitle"
      );

    const subtitle =
      document.getElementById(
        "pageSubtitle"
      );

    if(title){
      title.textContent =
        meta[0];
    }

    if(subtitle){
      subtitle.textContent =
        meta[1];
    }

  }

  window.scrollTo({
    top:0,
    behavior:"smooth"
  });

}


function getBusinessReportDays(){

  const sessionDays =
    Number(
      window
      .wakeSuiteSessionReports
      ?.amazon_business_reports
      ?.businessReportDays
    );

  if(
    Number.isFinite(sessionDays) &&
    sessionDays > 0
  ){
    return sessionDays;
  }

  const inputDays =
    Number(
      document
      .getElementById(
        "businessReportDaysInput"
      )
      ?.value
    );

  if(
    Number.isFinite(inputDays) &&
    inputDays > 0
  ){
    return inputDays;
  }

  return DEFAULT_AMAZON_BUSINESS_REPORT_DAYS;

}


function updateBusinessDaysVisibility(){

  const menu =
    document
    .getElementById(
      "menu"
    )
    ?.value;

  const folder =
    document
    .getElementById(
      "folder"
    )
    ?.value;

  const config =
    getSelectedConfig(
      menu,
      folder
    );

  const field =
    document.getElementById(
      "businessReportDaysField"
    );

  if(field){
    field.style.display =
      config?.id ===
      "amazon_business_reports"
      ? "block"
      : "none";
  }

}


const READINESS_ITEMS = [
  ["wakefit_daily_pricing","Wakefit · Daily Pricing Sheet"],
  ["amazon_all_listings","Amazon · All Listings Report"],
  ["amazon_fba_inventory","Amazon · FBA Inventory"],
  ["amazon_business_reports","Amazon · Business Reports"],
  ["flipkart_listing_file","Flipkart · Listing File"],
  ["flipkart_order_report","Flipkart · Order Report"],
  ["marketplace_audit_report","Shared · Audit Report"]
];


function updateRunButtons(){

  const reports =
    window.wakeSuiteSessionReports;

  const amazonReady =
    !!window.masterPricingAmazon
    &&
    !!reports.wakefit_daily_pricing
    &&
    !!reports.amazon_all_listings
    &&
    !!reports.amazon_fba_inventory
    &&
    !!reports.amazon_business_reports
    &&
    !!reports.marketplace_audit_report;

  const flipkartReady =
    !!window.masterPricingFlipkart
    &&
    !!reports.wakefit_daily_pricing
    &&
    !!reports.flipkart_listing_file
    &&
    !!reports.flipkart_order_report
    &&
    !!reports.marketplace_audit_report;

  const amazonButton =
    document.getElementById("runAmazonButton");

  const flipkartButton =
    document.getElementById("runFlipkartButton");

  if(amazonButton){
    amazonButton.disabled =
      !amazonReady;
  }

  if(flipkartButton){
    flipkartButton.disabled =
      !flipkartReady;
  }

}


function updateReadiness(){

  const container =
    document.getElementById(
      "readinessList"
    );

  if(!container){
    return;
  }

  let loaded = 0;

  let html = "";

  READINESS_ITEMS.forEach(
    ([id,label]) => {

      const ready =
        !!window
        .wakeSuiteSessionReports[id];

      if(ready){
        loaded += 1;
      }

      html += `
        <div class="ready-row">
          <span>${escapeHtml(label)}</span>
          <span class="ready-badge ${ready ? "ok" : ""}">
            ${ready ? "Loaded" : "Not loaded"}
          </span>
        </div>
      `;

    }
  );

  container.innerHTML =
    html;

  const chip =
    document.getElementById(
      "sessionChip"
    );

  if(chip){

    chip.textContent =
      loaded +
      " report" +
      (loaded === 1 ? "" : "s") +
      " loaded";

  }

  const dashboardLoaded =
    document.getElementById(
      "dashboardReportsLoaded"
    );

  if(dashboardLoaded){
    dashboardLoaded.textContent =
      formatNumber(loaded);
  }

  updateRunButtons();

}


function resetSession(){

  if(
    !confirm(
      "Clear all reports loaded in this browser session?\n\nThis does not delete Firestore metadata."
    )
  ){
    return;
  }

  window.wakeSuiteSessionReports = {};
  window.amazonPriceDisparityResult = null;
  window.flipkartPriceDisparityResult = null;
  window.currentAuditSummary = null;

  [
    ["totalLiveDisparityCount","0"],
    ["amazonSuppressedCount","0"],
    ["amazonBuyBoxSuppressedCount","0"],
    ["flipkartNoBuyBoxCount","0"],
    ["combinedDailyImpact","₹0"],
    ["amazonListingDisparityCount","0"],
    ["amazonLiveDisparityCount","0"],
    ["amazonMrpDisparityCount","0"],
    ["flipkartListingDisparityCount","0"],
    ["flipkartLiveDisparityCount","0"],
    ["flipkartMrpDisparityCount","0"]
  ].forEach(
    ([id,value]) => {

      const el =
        document.getElementById(id);

      if(el){
        el.textContent = value;
      }

    }
  );

  document
  .getElementById(
    "amazonPriceDisparitySection"
  )
  .style.display =
    "none";

  document
  .getElementById(
    "flipkartPriceDisparitySection"
  )
  .style.display =
    "none";

  document
  .getElementById(
    "auditUploadSummary"
  )
  .style.display =
    "none";

  updateReadiness();
  renderDashboardModules();
  showView("dashboardHome");

  setUploadStatus(
    "Session cleared. Master Pricing remains connected.",
    "success"
  );

}

function setMasterPricingStatus(
  message,
  type = ""
){

  const element =
    document.getElementById(
      "masterPricingStatus"
    );

  element.className =
    "master-status" +
    (
      type
      ? " " + type
      : ""
    );

  element.textContent =
    message;

}


function setUploadStatus(
  message,
  type
){

  const element =
    document.getElementById(
      "uploadStatus"
    );

  element.className =
    "upload-status " +
    type;

  element.textContent =
    message;

}


/* ======================================================
   GOOGLE OAUTH
====================================================== */

function connectMasterPricing(){

  if(
    !window.google ||
    !google.accounts ||
    !google.accounts.oauth2
  ){

    alert(
      "Google authorization is still loading. Please wait a few seconds and try again."
    );

    return;

  }

  const button =
    document.getElementById(
      "masterPricingButton"
    );

  button.disabled =
    true;

  button.textContent =
    "Connecting...";

  setMasterPricingStatus(
    "Waiting for Google authorization..."
  );

  if(
    !sheetsTokenClient
  ){

    sheetsTokenClient =
      google.accounts.oauth2
      .initTokenClient({

        client_id:
          GOOGLE_SHEETS_CLIENT_ID,

        scope:
          GOOGLE_SHEETS_SCOPE,

        include_granted_scopes:
          true,

        callback:
          async tokenResponse => {

            if(
              tokenResponse.error
            ){

              console.error(
                "Google OAuth error:",
                tokenResponse
              );

              setMasterPricingStatus(
                "Google authorization failed.",
                "error"
              );

              button.disabled =
                false;

              button.textContent =
                "Connect Master Pricing";

              return;

            }

            sheetsAccessToken =
              tokenResponse.access_token;

            try{

              await loadAllMasterPricing();

              button.textContent =
                "Refresh Master Pricing";

            }
            catch(error){

              console.error(
                "Master Pricing error:",
                error
              );

              setMasterPricingStatus(
                "Unable to load Master Pricing: " +
                error.message,
                "error"
              );

              button.textContent =
                "Connect Master Pricing";

            }
            finally{

              button.disabled =
                false;

            }

          },

        error_callback:
          error => {

            console.error(
              "Google popup error:",
              error
            );

            setMasterPricingStatus(
              "Google authorization window was closed or blocked.",
              "error"
            );

            button.disabled =
              false;

            button.textContent =
              "Connect Master Pricing";

          }

      });

  }

  sheetsTokenClient
  .requestAccessToken({
    // Consent is remembered by Google. Do not force an account chooser on every refresh.
    prompt:""
  });

}


/* ======================================================
   GOOGLE SHEETS FETCH
====================================================== */

async function fetchSheetValues(range){

  if(
    !sheetsAccessToken
  ){

    throw new Error(
      "Google Sheets authorization is missing."
    );

  }

  const url =
    "https://sheets.googleapis.com/v4/spreadsheets/" +
    MASTER_PRICING_SPREADSHEET_ID +
    "/values/" +
    encodeURIComponent(range) +
    "?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE";

  const response =
    await fetch(
      url,
      {
        headers:{
          Authorization:
            "Bearer " +
            sheetsAccessToken
        }
      }
    );

  if(
    !response.ok
  ){

    let errorMessage =
      "Google Sheets request failed.";

    try{

      const errorData =
        await response.json();

      errorMessage =
        errorData?.error?.message
        ||
        errorMessage;

    }
    catch(error){
      // ignore
    }

    if(
      response.status === 401
    ){

      sheetsAccessToken =
        null;

      throw new Error(
        "Google authorization expired. Connect Master Pricing again."
      );

    }

    if(
      response.status === 403
    ){

      throw new Error(
        "The selected Google account cannot access the Master Pricing sheet."
      );

    }

    throw new Error(
      errorMessage
    );

  }

  const data =
    await response.json();

  return data.values || [];

}


function buildHeaderIndex(headers){

  const map = {};

  headers.forEach(
    (header,index) => {

      map[
        canonicalHeader(
          header
        )
      ] = index;

    }
  );

  return map;

}


function requireSheetHeaders(
  headerIndex,
  requiredHeaders,
  sheetName
){

  const missing =
    requiredHeaders.filter(
      header =>
        headerIndex[
          canonicalHeader(
            header
          )
        ] === undefined
    );

  if(
    missing.length > 0
  ){

    throw new Error(
      sheetName +
      " Master Pricing is missing columns: " +
      missing.join(", ")
    );

  }

}


/* ======================================================
   LOAD AMAZON MASTER PRICING
====================================================== */

async function loadAmazonMasterPricing(){

  const values =
    await fetchSheetValues(
      AMAZON_MASTER_RANGE
    );

  if(
    values.length < 2
  ){

    throw new Error(
      "Amazon Master Pricing is empty."
    );

  }

  const headerIndex =
    buildHeaderIndex(
      values[0]
    );

  requireSheetHeaders(
    headerIndex,
    [
      "Az Sku",
      "Asin",
      "Wf Sku",
      "Category"
    ],
    "Amazon"
  );

  const azSkuIndex =
    headerIndex[
      canonicalHeader("Az Sku")
    ];

  const asinIndex =
    headerIndex[
      canonicalHeader("Asin")
    ];

  const wfSkuIndex =
    headerIndex[
      canonicalHeader("Wf Sku")
    ];

  const categoryIndex =
    headerIndex[
      canonicalHeader("Category")
    ];

  const rows = [];
  const byAzSku = new Map();
  const byAsin = new Map();
  const categories = new Set();

  let duplicateAzSkuCount = 0;

  values
  .slice(1)
  .forEach(
    sourceRow => {

      const azSku =
        normalizeKey(
          sourceRow[azSkuIndex]
        );

      const asin =
        normalizeKey(
          sourceRow[asinIndex]
        );

      const wfSku =
        normalizeKey(
          sourceRow[wfSkuIndex]
        );

      const category =
        normalizeKey(
          sourceRow[categoryIndex]
        );

      if(!azSku){
        return;
      }

      const record = {
        azSku,
        asin,
        wfSku,
        category
      };

      rows.push(record);

      if(
        byAzSku.has(
          azSku
        )
      ){
        duplicateAzSkuCount += 1;
      }

      byAzSku.set(
        azSku,
        record
      );

      if(asin){

        if(
          !byAsin.has(
            asin
          )
        ){
          byAsin.set(
            asin,
            []
          );
        }

        byAsin
        .get(asin)
        .push(record);

      }

      if(category){
        categories.add(category);
      }

    }
  );

  window.masterPricingAmazon = {
    loadedAt:new Date(),
    rows,
    byAzSku,
    byAsin,
    categories,
    duplicateAzSkuCount
  };

  document
  .getElementById(
    "amazonMasterMetrics"
  )
  .style.display =
    "grid";

  document
  .getElementById(
    "amazonMasterRowCount"
  )
  .textContent =
    rows.length
    .toLocaleString("en-IN");

  document
  .getElementById(
    "amazonMasterSkuCount"
  )
  .textContent =
    byAzSku.size
    .toLocaleString("en-IN");

  document
  .getElementById(
    "amazonMasterAsinCount"
  )
  .textContent =
    byAsin.size
    .toLocaleString("en-IN");

  document
  .getElementById(
    "amazonMasterCategoryCount"
  )
  .textContent =
    categories.size
    .toLocaleString("en-IN");

  return window.masterPricingAmazon;

}


/* ======================================================
   LOAD FLIPKART MASTER PRICING
====================================================== */

async function loadFlipkartMasterPricing(){

  const values =
    await fetchSheetValues(
      FLIPKART_MASTER_RANGE
    );

  if(
    values.length < 2
  ){

    throw new Error(
      "Flipkart Master Pricing is empty."
    );

  }

  const headerIndex =
    buildHeaderIndex(
      values[0]
    );

  requireSheetHeaders(
    headerIndex,
    [
      "Fk Sku",
      "FSN",
      "Wf Sku",
      "Category"
    ],
    "Flipkart"
  );

  const fkSkuIndex =
    headerIndex[
      canonicalHeader("Fk Sku")
    ];

  const fsnIndex =
    headerIndex[
      canonicalHeader("FSN")
    ];

  const wfSkuIndex =
    headerIndex[
      canonicalHeader("Wf Sku")
    ];

  const categoryIndex =
    headerIndex[
      canonicalHeader("Category")
    ];

  const rows = [];
  const byFkSku = new Map();
  const byFsn = new Map();
  const categories = new Set();

  let duplicateFkSkuCount = 0;

  values
  .slice(1)
  .forEach(
    sourceRow => {

      const fkSku =
        normalizeKey(
          sourceRow[fkSkuIndex]
        );

      const fsn =
        normalizeKey(
          sourceRow[fsnIndex]
        );

      const wfSku =
        normalizeKey(
          sourceRow[wfSkuIndex]
        );

      const category =
        normalizeKey(
          sourceRow[categoryIndex]
        );

      if(!fkSku){
        return;
      }

      const record = {
        fkSku,
        fsn,
        wfSku,
        category
      };

      rows.push(record);

      if(
        byFkSku.has(
          fkSku
        )
      ){
        duplicateFkSkuCount += 1;
      }

      byFkSku.set(
        fkSku,
        record
      );

      if(fsn){

        if(
          !byFsn.has(
            fsn
          )
        ){
          byFsn.set(
            fsn,
            []
          );
        }

        byFsn
        .get(fsn)
        .push(record);

      }

      if(category){
        categories.add(category);
      }

    }
  );

  window.masterPricingFlipkart = {
    loadedAt:new Date(),
    rows,
    byFkSku,
    byFsn,
    categories,
    duplicateFkSkuCount
  };

  document
  .getElementById(
    "flipkartMasterMetrics"
  )
  .style.display =
    "grid";

  document
  .getElementById(
    "flipkartMasterRowCount"
  )
  .textContent =
    rows.length
    .toLocaleString("en-IN");

  document
  .getElementById(
    "flipkartMasterSkuCount"
  )
  .textContent =
    byFkSku.size
    .toLocaleString("en-IN");

  document
  .getElementById(
    "flipkartMasterFsnCount"
  )
  .textContent =
    byFsn.size
    .toLocaleString("en-IN");

  document
  .getElementById(
    "flipkartMasterCategoryCount"
  )
  .textContent =
    categories.size
    .toLocaleString("en-IN");

  return window.masterPricingFlipkart;

}


async function loadAllMasterPricing(){

  setMasterPricingStatus(
    "Reading Amazon and Flipkart Master Pricing..."
  );

  const amazon =
    await loadAmazonMasterPricing();

  const flipkart =
    await loadFlipkartMasterPricing();

  let message =
    "Master Pricing connected successfully. " +
    "Amazon: " +
    amazon.byAzSku.size.toLocaleString("en-IN") +
    " AZ SKUs. Flipkart: " +
    flipkart.byFkSku.size.toLocaleString("en-IN") +
    " FK SKUs.";

  if(
    amazon.duplicateAzSkuCount > 0 ||
    flipkart.duplicateFkSkuCount > 0
  ){

    message +=
      " Duplicate rows detected — exact duplicates will be removed and conflicting mappings will be flagged during processing.";

  }

  setMasterPricingStatus(
    message,
    "success"
  );

  updateRunButtons();

}


/* WakeSuite V7.2: after a successful Google Sheet refresh, persist normalized Master Pricing in Firestore. */
const v72BaseLoadAllMasterPricing = loadAllMasterPricing;
loadAllMasterPricing = async function(){
  const result = await v72BaseLoadAllMasterPricing();
  if(typeof window.saveMasterPricingCache === "function"){
    try{
      await window.saveMasterPricingCache();
      setMasterPricingStatus((document.getElementById("masterPricingStatus")?.textContent||"Master Pricing connected.")+" Saved for automatic reuse on future logins.","success");
    }catch(error){
      console.warn("Unable to cache Master Pricing",error);
      showWakeSuiteToast("Master Pricing loaded, but WakeSuite could not save the reusable cache: "+error.message,"warning");
    }
  }
  return result;
};

/* ======================================================
   REPORT DEFINITIONS
====================================================== */

const REPORT_DEFINITIONS = {

  wakefitDailyPricing:{
    id:"wakefit_daily_pricing",
    label:"Wakefit → Daily Pricing Sheet",
    requiredHeaders:[
      "scm_master_category",
      "item_sku",
      "mrp",
      "sale_price",
      "active"
    ]
  },

  amazonAllListings:{
    id:"amazon_all_listings",
    label:"Amazon → All Listings Report",
    requiredHeaders:[
      "seller-sku",
      "asin1",
      "item-name",
      "price",
      "quantity",
      "status",
      "minimum-seller-allowed-price",
      "maximum-seller-allowed-price",
      "expedited-shipping",
      "fulfillment-channel",
      "merchant-shipping-group",
      "maximum-retail-price"
    ]
  },

  amazonFbaInventory:{
    id:"amazon_fba_inventory",
    label:"Amazon → FBA Inventory",
    requiredHeaders:[
      "seller-sku",
      "fulfillment-channel-sku",
      "asin",
      "condition-type",
      "Warehouse-Condition-code",
      "Quantity Available"
    ]
  },

  amazonOrderReport:{
    id:"amazon_order_report",
    label:"Amazon → Order Report · Exception Insights",
    requiredHeaders:[
      "sku"
    ]
  },

  amazonBusinessReports:{
    id:"amazon_business_reports",
    label:"Amazon → Business Reports",
    requiredHeaders:[
      "(Child) ASIN",
      "Units Ordered",
      "Ordered Product Sales",
      "Total Order Items"
    ]
  },

  flipkartListingFile:{
    id:"flipkart_listing_file",
    label:"Flipkart → Listing File",
    requiredHeaders:[
      "Seller SKU Id",
      "Flipkart Serial Number",
      "Listing Status",
      "MRP",
      "Your Selling Price",
      "System Stock count"
    ]
  },

  flipkartOrderReport:{
    id:"flipkart_order_report",
    label:"Flipkart → Order Report",
    requiredHeaders:[
      "order_id",
      "order_date",
      "order_item_status",
      "fsn",
      "quantity"
    ]
  },

  marketplaceAuditReport:{
    id:"marketplace_audit_report",
    label:"Audit → Amazon + Flipkart Audit Report",
    requiredHeaders:[
      "ASIN",
      "FSN",
      "amazon_has_supersede_issue",
      "amazon_selling_price",
      "amazon_buy_now_present",
      "amazon_edd",
      "amazon_deliver_to",
      "flipkart_selling_price",
      "flipkart_buy_now_present"
    ]
  }

};


/* ======================================================
   FIRESTORE UPLOAD CONFIG
====================================================== */

window.applyUploadConfig =
function(configs){

  const merged =
    [...configs];

  if(
    !merged.some(
      item =>
        item.id ===
        BUILTIN_AUDIT_CONFIG.id
    )
  ){

    merged.push({
      ...BUILTIN_AUDIT_CONFIG
    });

  }

  if(!merged.some(item=>item.id===BUILTIN_AMAZON_ORDER_CONFIG.id)){
    merged.push({...BUILTIN_AMAZON_ORDER_CONFIG});
  }

  uploadConfig =
    merged
    .filter(
      item =>
        item.active === true
    )
    .map(
      item => ({
        ...item,
        menu:
          String(
            item.menu || ""
          ).trim(),
        folder:
          String(
            item.folder || ""
          ).trim()
      })
    )
    .sort(
      (a,b) =>
        Number(
          a.sortOrder || 0
        )
        -
        Number(
          b.sortOrder || 0
        )
    );

  console.log(
    "Upload configuration loaded:",
    uploadConfig
  );

  populateMenus();
  populateFolders();
  updateReadiness();

};


function populateMenus(){

  const element =
    document.getElementById(
      "menu"
    );

  const menus = [];

  uploadConfig.forEach(
    item => {

      if(
        item.menu &&
        !menus.includes(
          item.menu
        )
      ){
        menus.push(
          item.menu
        );
      }

    }
  );

  if(
    menus.length === 0
  ){

    element.innerHTML =
      `<option value="">No menus configured</option>`;

    return;

  }

  let html =
    `<option value="">Select Menu</option>`;

  menus.forEach(
    menu => {

      html +=
        `<option value="${escapeHtml(menu)}">${escapeHtml(menu)}</option>`;

    }
  );

  element.innerHTML =
    html;

}


function populateFolders(){

  const menu =
    document
    .getElementById(
      "menu"
    )
    .value;

  const element =
    document.getElementById(
      "folder"
    );

  if(!menu){

    element.innerHTML =
      `<option value="">Select Menu first</option>`;

    return;

  }

  let html =
    `<option value="">Select Folder</option>`;

  uploadConfig
  .filter(
    item =>
      item.menu === menu
  )
  .forEach(
    item => {

      html +=
        `<option value="${escapeHtml(item.folder)}">${escapeHtml(item.folder)}</option>`;

    }
  );

  element.innerHTML =
    html;

}


document
.getElementById("menu")
.addEventListener(
  "change",
  () => {
    populateFolders();
    updateBusinessDaysVisibility();
  }
);

document
.getElementById("folder")
.addEventListener(
  "change",
  updateBusinessDaysVisibility
);


/* ======================================================
   VALIDATION
====================================================== */

function reportMatchesHeaders(
  headers,
  definition
){

  const available =
    new Set(
      headers.map(
        canonicalHeader
      )
    );

  const missing =
    definition
    .requiredHeaders
    .filter(
      requiredHeader =>
        !available.has(
          canonicalHeader(
            requiredHeader
          )
        )
    );

  return {
    matches:
      missing.length === 0,
    missingHeaders:
      missing
  };

}


function detectReport(headers){

  for(
    const definition
    of Object.values(
      REPORT_DEFINITIONS
    )
  ){

    const check =
      reportMatchesHeaders(
        headers,
        definition
      );

    if(
      check.matches
    ){
      return definition;
    }

  }

  return null;

}


function getSelectedConfig(
  menu,
  folder
){

  return uploadConfig.find(
    item =>
      item.menu === menu
      &&
      item.folder === folder
  )
  ||
  null;

}


function getDefinitionFromConfig(
  config
){

  if(!config){
    return null;
  }

  return Object.values(
    REPORT_DEFINITIONS
  )
  .find(
    definition =>
      definition.id ===
      config.id
  )
  ||
  null;

}


function validateSelectedReport(
  menu,
  folder,
  headers
){

  const selectedConfig =
    getSelectedConfig(
      menu,
      folder
    );

  const selectedDefinition =
    getDefinitionFromConfig(
      selectedConfig
    );

  const detectedDefinition =
    detectReport(
      headers
    );

  if(
    !selectedConfig
  ){

    return {
      valid:false,
      selectedLabel:
        menu +
        " → " +
        folder,
      detectedLabel:
        detectedDefinition
        ? detectedDefinition.label
        : "Unknown report",
      missingHeaders:[],
      message:
        "Upload configuration was not found."
    };

  }

  if(
    !selectedDefinition
  ){

    return {
      valid:false,
      selectedLabel:
        menu +
        " → " +
        folder,
      detectedLabel:
        detectedDefinition
        ? detectedDefinition.label
        : "Validation pending",
      missingHeaders:[],
      message:
        "Validation is not configured yet for this report type."
    };

  }

  const check =
    reportMatchesHeaders(
      headers,
      selectedDefinition
    );

  if(
    check.matches
  ){

    return {
      valid:true,
      selectedLabel:
        selectedDefinition.label,
      detectedLabel:
        selectedDefinition.label,
      detectedId:
        selectedDefinition.id,
      missingHeaders:[],
      message:
        "Report validation passed."
    };

  }

  return {
    valid:false,
    selectedLabel:
      selectedDefinition.label,
    detectedLabel:
      detectedDefinition
      ? detectedDefinition.label
      : "Unknown report",
    missingHeaders:
      check.missingHeaders,
    message:
      "The selected report does not match the uploaded file."
  };

}


/* ======================================================
   FILE READER
====================================================== */

async function readWakeSuiteFile(file){

  if(!file){

    throw new Error(
      "No file selected."
    );

  }

  if(
    typeof XLSX ===
    "undefined"
  ){

    throw new Error(
      "Spreadsheet reader is not loaded."
    );

  }

  const buffer =
    await file.arrayBuffer();

  const workbook =
    XLSX.read(
      buffer,
      {
        type:"array",
        cellDates:false
      }
    );

  if(
    !workbook.SheetNames ||
    workbook.SheetNames.length === 0
  ){

    throw new Error(
      "No worksheet or data was found."
    );

  }

  let selectedSheetName =
    workbook.SheetNames[0];

  let rows = [];

  for(
    const sheetName
    of workbook.SheetNames
  ){

    const worksheet =
      workbook.Sheets[
        sheetName
      ];

    let candidateRows =
      XLSX.utils.sheet_to_json(
        worksheet,
        {
          defval:"",
          raw:false,
          blankrows:false
        }
      );

    candidateRows =
      candidateRows
      .map(
        normalizeRow
      )
      .filter(
        row =>
          Object.values(row)
          .some(
            value =>
              String(
                value ?? ""
              )
              .trim() !== ""
          )
      );

    if(
      candidateRows.length > 0
    ){

      selectedSheetName =
        sheetName;

      rows =
        candidateRows;

      break;

    }

  }

  if(
    rows.length === 0
  ){

    throw new Error(
      "No populated worksheet was found."
    );

  }

  const headers =
    Object.keys(
      rows[0]
    );

  return {
    fileName:file.name,
    fileSize:file.size,
    mimeType:file.type || "unknown",
    sheetName:selectedSheetName,
    headers,
    rowCount:rows.length,
    rows
  };

}


/* ======================================================
   AMAZON BUSINESS REPORT SUMMARY
====================================================== */

function buildBusinessReportAsinMap(rows){

  const asinMap =
    new Map();

  rows.forEach(
    row => {

      const asin =
        normalizeKey(
          getRowValue(
            row,
            "(Child) ASIN"
          )
        );

      if(!asin){
        return;
      }

      const units =
        parseNumber(
          getRowValue(
            row,
            "Units Ordered"
          )
        );

      const revenue =
        parseMoney(
          getRowValue(
            row,
            "Ordered Product Sales"
          )
        );

      const orderItems =
        parseNumber(
          getRowValue(
            row,
            "Total Order Items"
          )
        );

      if(
        !asinMap.has(
          asin
        )
      ){

        asinMap.set(
          asin,
          {
            asin,
            unitsOrdered:0,
            orderedProductSales:0,
            totalOrderItems:0
          }
        );

      }

      const current =
        asinMap.get(
          asin
        );

      current.unitsOrdered +=
        units;

      current.orderedProductSales +=
        revenue;

      current.totalOrderItems +=
        orderItems;

    }
  );

  return asinMap;

}


function processBusinessReport(
  parsedFile,
  reportDays = DEFAULT_AMAZON_BUSINESS_REPORT_DAYS
){

  const asinMap =
    buildBusinessReportAsinMap(
      parsedFile.rows
    );

  const asinRows =
    Array.from(
      asinMap.values()
    );

  let totalUnits = 0;
  let totalRevenue = 0;
  let totalOrderItems = 0;

  asinRows.forEach(
    row => {

      totalUnits +=
        row.unitsOrdered;

      totalRevenue +=
        row.orderedProductSales;

      totalOrderItems +=
        row.totalOrderItems;

    }
  );

  return {
    uniqueAsinCount:
      asinRows.length,
    totalUnitsOrdered:
      totalUnits,
    totalOrderedProductSales:
      totalRevenue,
    totalOrderItems,
    reportDays,
    asinRows,
    asinMap
  };

}


function showBusinessReportSummary(
  summary
){

  document
  .getElementById(
    "businessSummary"
  )
  .style.display =
    "block";

  document
  .getElementById(
    "businessAsinCount"
  )
  .textContent =
    summary
    .uniqueAsinCount
    .toLocaleString("en-IN");

  document
  .getElementById(
    "businessUnits"
  )
  .textContent =
    summary
    .totalUnitsOrdered
    .toLocaleString("en-IN");

  document
  .getElementById(
    "businessRevenue"
  )
  .textContent =
    formatINR(
      summary
      .totalOrderedProductSales
    );

  document
  .getElementById(
    "businessOrderItems"
  )
  .textContent =
    summary
    .totalOrderItems
    .toLocaleString("en-IN");

  const daysEl =
    document.getElementById(
      "businessReportDaysSummary"
    );

  if(daysEl){
    daysEl.textContent =
      formatNumber(
        summary.reportDays
      );
  }

}


function hideBusinessReportSummary(){

  document
  .getElementById(
    "businessSummary"
  )
  .style.display =
    "none";

}



/* ======================================================
   SHARED AUDIT REPORT
====================================================== */

function classifyAmazonAuditRecord(record){

  const suppressed =
    record.suppression === true;

  const notSuppressed =
    record.suppression === false;

  let suppressionStatus =
    "Unknown";

  if(suppressed){
    suppressionStatus =
      "Suppressed";
  }
  else if(notSuppressed){
    suppressionStatus =
      "Not Suppressed";
  }

  let buyBoxStatus =
    "Unknown";

  if(suppressed){

    buyBoxStatus =
      "N/A - Suppressed";

  }
  else if(
    notSuppressed &&
    record.buyNow === true
  ){

    buyBoxStatus =
      "Available";

  }
  else if(
    notSuppressed &&
    record.buyNow === false &&
    isBlank(record.edd) &&
    !isBlank(record.deliverTo)
  ){

    buyBoxStatus =
      "Buy Box Suppressed";

  }
  else if(
    notSuppressed &&
    record.buyNow === false
  ){

    buyBoxStatus =
      "No Buy Now";

  }

  return {
    suppressionStatus,
    buyBoxStatus
  };

}


function buildAuditMaps(rows){

  const amazonMap =
    new Map();

  const flipkartMap =
    new Map();

  rows.forEach(
    row => {

      const asin =
        normalizeKey(
          getRowValue(
            row,
            "ASIN"
          )
        );

      if(
        asin &&
        !amazonMap.has(asin)
      ){

        amazonMap.set(
          asin,
          {
            asin,
            suppression:
              parseAuditBoolean(
                getRowValue(
                  row,
                  "amazon_has_supersede_issue"
                )
              ),
            livePrice:
              parseMoney(
                getRowValue(
                  row,
                  "amazon_selling_price"
                )
              ),
            buyNow:
              parseAuditBoolean(
                getRowValue(
                  row,
                  "amazon_buy_now_present"
                )
              ),
            edd:
              getRowValue(
                row,
                "amazon_edd"
              ),
            deliverTo:
              getRowValue(
                row,
                "amazon_deliver_to"
              )
          }
        );

      }

      const fsn =
        normalizeKey(
          getRowValue(
            row,
            "FSN"
          )
        );

      if(
        fsn &&
        !flipkartMap.has(fsn)
      ){

        flipkartMap.set(
          fsn,
          {
            fsn,
            livePrice:
              parseMoney(
                getRowValue(
                  row,
                  "flipkart_selling_price"
                )
              ),
            buyNow:
              parseAuditBoolean(
                getRowValue(
                  row,
                  "flipkart_buy_now_present"
                )
              )
          }
        );

      }

    }
  );

  return {
    amazonMap,
    flipkartMap
  };

}


function processAuditReport(parsedFile){

  const maps =
    buildAuditMaps(
      parsedFile.rows
    );

  let amazonSuppressed = 0;
  let amazonBuyBoxSuppressed = 0;
  let amazonValidLivePrices = 0;
  let flipkartNoBuyBox = 0;
  let flipkartValidLivePrices = 0;

  maps.amazonMap
  .forEach(
    record => {

      const classification =
        classifyAmazonAuditRecord(
          record
        );

      if(
        classification
        .suppressionStatus ===
        "Suppressed"
      ){
        amazonSuppressed += 1;
      }

      if(
        classification
        .buyBoxStatus ===
        "Buy Box Suppressed"
      ){
        amazonBuyBoxSuppressed += 1;
      }

      if(
        record.suppression === false &&
        record.buyNow === true &&
        record.livePrice > 0
      ){
        amazonValidLivePrices += 1;
      }

    }
  );

  maps.flipkartMap
  .forEach(
    record => {

      if(
        record.buyNow === false
      ){
        flipkartNoBuyBox += 1;
      }

      if(
        record.buyNow === true &&
        record.livePrice > 0
      ){
        flipkartValidLivePrices += 1;
      }

    }
  );

  return {
    rowCount:
      parsedFile.rowCount,
    amazonMap:
      maps.amazonMap,
    flipkartMap:
      maps.flipkartMap,
    uniqueAmazonAsins:
      maps.amazonMap.size,
    uniqueFlipkartFsns:
      maps.flipkartMap.size,
    amazonSuppressed,
    amazonBuyBoxSuppressed,
    amazonValidLivePrices,
    flipkartNoBuyBox,
    flipkartValidLivePrices
  };

}


function showAuditSummary(summary){

  window.currentAuditSummary =
    summary;

  document
  .getElementById(
    "auditUploadSummary"
  )
  .style.display =
    "block";

  const values = {
    auditAmazonAsins:
      formatNumber(
        summary.uniqueAmazonAsins
      ),
    auditAmazonSuppressed:
      formatNumber(
        summary.amazonSuppressed
      ),
    auditFlipkartFsns:
      formatNumber(
        summary.uniqueFlipkartFsns
      ),
    auditFlipkartNoBuyBox:
      formatNumber(
        summary.flipkartNoBuyBox
      ),
    auditHealthAmazonAsins:
      formatNumber(
        summary.uniqueAmazonAsins
      ),
    auditHealthAmazonSuppressed:
      formatNumber(
        summary.amazonSuppressed
      ),
    auditHealthAmazonBuyBox:
      formatNumber(
        summary.amazonBuyBoxSuppressed
      ),
    auditHealthAmazonLive:
      formatNumber(
        summary.amazonValidLivePrices
      ),
    auditHealthFlipkartFsns:
      formatNumber(
        summary.uniqueFlipkartFsns
      ),
    auditHealthFlipkartNoBuyBox:
      formatNumber(
        summary.flipkartNoBuyBox
      ),
    auditHealthFlipkartLive:
      formatNumber(
        summary.flipkartValidLivePrices
      ),
    auditHealthRows:
      formatNumber(
        summary.rowCount
      )
  };

  Object.entries(values)
  .forEach(
    ([id,value]) => {

      const el =
        document.getElementById(id);

      if(el){
        el.textContent = value;
      }

    }
  );

}


/* ======================================================
   FILE INFO
====================================================== */

function showParsedFileInfo(
  parsedFile,
  validation
){

  document
  .getElementById(
    "fileInfo"
  )
  .style.display =
    "block";

  document
  .getElementById(
    "parsedFileName"
  )
  .textContent =
    "File: " +
    parsedFile.fileName;

  document
  .getElementById(
    "parsedSheetName"
  )
  .textContent =
    "Sheet: " +
    parsedFile.sheetName;

  document
  .getElementById(
    "parsedRowCount"
  )
  .textContent =
    "Rows: " +
    parsedFile.rowCount;

  document
  .getElementById(
    "parsedHeaders"
  )
  .textContent =
    "Columns: " +
    parsedFile.headers.join(", ");

  document
  .getElementById(
    "detectedReport"
  )
  .textContent =
    "Detected report: " +
    validation.detectedLabel;

  const validationElement =
    document.getElementById(
      "validationResult"
    );

  if(
    validation.valid
  ){

    validationElement.className =
      "file-info-row validation-success";

    validationElement.textContent =
      "✓ Validation passed";

  }
  else{

    validationElement.className =
      "file-info-row validation-error";

    validationElement.textContent =
      "✕ " +
      validation.message;

  }

}


/* ======================================================
   UPLOAD
====================================================== */

async function uploadData(){

  hideBusinessReportSummary();

  const auditBox =
    document.getElementById(
      "auditUploadSummary"
    );

  if(auditBox){
    auditBox.style.display =
      "none";
  }

  const reportDate =
    document
    .getElementById(
      "reportDate"
    )
    .value;

  const menu =
    document
    .getElementById(
      "menu"
    )
    .value;

  const folder =
    document
    .getElementById(
      "folder"
    )
    .value;

  const file =
    document
    .getElementById(
      "file"
    )
    .files[0];

  const uploadButton =
    document.getElementById(
      "uploadButton"
    );

  if(!reportDate){
    alert("Please select Report Date.");
    return;
  }

  if(!menu){
    alert("Please select Menu.");
    return;
  }

  if(!folder){
    alert("Please select Folder.");
    return;
  }

  if(!file){
    alert("Please choose a file.");
    return;
  }

  if(
    typeof window.saveUploadMetadata !==
    "function"
  ){
    alert("Firebase is not ready. Please refresh WakeSuite.");
    return;
  }

  try{

    uploadButton.disabled =
      true;

    uploadButton.innerText =
      "Reading report...";

    setUploadStatus(
      "Reading and validating report...",
      "success"
    );

    const parsedFile =
      await readWakeSuiteFile(
        file
      );

    const validation =
      validateSelectedReport(
        menu,
        folder,
        parsedFile.headers
      );

    showParsedFileInfo(
      parsedFile,
      validation
    );

    if(
      !validation.valid
    ){

      let message =
        validation.message +
        "\n\nSelected:\n" +
        validation.selectedLabel +
        "\n\nDetected:\n" +
        validation.detectedLabel;

      if(
        validation.missingHeaders &&
        validation.missingHeaders.length > 0
      ){

        message +=
          "\n\nMissing columns:\n" +
          validation
          .missingHeaders
          .join(", ");

      }

      message +=
        "\n\nNothing was saved to Firestore.";

      setUploadStatus(
        validation.message,
        "error"
      );

      alert(message);
      return;

    }

    const selectedConfig =
      getSelectedConfig(
        menu,
        folder
      );

    let businessSummary =
      null;

    let auditSummary =
      null;

    if(
      selectedConfig.id ===
      "amazon_business_reports"
    ){

      const reportDays =
        getBusinessReportDays();

      businessSummary =
        processBusinessReport(
          parsedFile,
          reportDays
        );

      showBusinessReportSummary(
        businessSummary
      );

    }

    if(
      selectedConfig.id ===
      "marketplace_audit_report"
    ){

      auditSummary =
        processAuditReport(
          parsedFile
        );

      showAuditSummary(
        auditSummary
      );

    }

    window.wakeSuiteSessionReports[
      selectedConfig.id
    ] = {
      reportDate,
      menu,
      reportType:folder,
      configId:selectedConfig.id,
      file,
      parsedFile,
      businessSummary,
      businessReportDays:
        businessSummary
        ? businessSummary.reportDays
        : null,
      auditSummary
    };

    uploadButton.innerText =
      "Registering...";

    const metadata = {
      reportDate,
      menu,
      reportType:folder,
      configId:selectedConfig.id,
      detectedReport:
        validation.detectedLabel,
      detectedReportId:
        validation.detectedId,
      validationStatus:"Valid",
      fileName:file.name,
      fileSize:file.size,
      mimeType:file.type || "unknown",
      lastModified:file.lastModified,
      sheetName:parsedFile.sheetName,
      rowCount:parsedFile.rowCount,
      headers:parsedFile.headers,
      status:"Ready for processing",
      processed:false,
      rawFileStored:false
    };

    if(
      businessSummary
    ){

      metadata.businessReportSummary = {
        revenueKey:"Child ASIN",
        uniqueAsinCount:
          businessSummary.uniqueAsinCount,
        totalUnitsOrdered:
          businessSummary.totalUnitsOrdered,
        totalOrderedProductSales:
          businessSummary.totalOrderedProductSales,
        totalOrderItems:
          businessSummary.totalOrderItems,
        reportDays:
          businessSummary.reportDays
      };

    }

    if(
      auditSummary
    ){

      metadata.auditSummary = {
        uniqueAmazonAsins:
          auditSummary.uniqueAmazonAsins,
        uniqueFlipkartFsns:
          auditSummary.uniqueFlipkartFsns,
        amazonSuppressed:
          auditSummary.amazonSuppressed,
        amazonBuyBoxSuppressed:
          auditSummary.amazonBuyBoxSuppressed,
        amazonValidLivePrices:
          auditSummary.amazonValidLivePrices,
        flipkartNoBuyBox:
          auditSummary.flipkartNoBuyBox,
        flipkartValidLivePrices:
          auditSummary.flipkartValidLivePrices
      };

    }

    const uploadId =
      await window
      .saveUploadMetadata(
        metadata
      );

    window.wakeSuiteSessionReports[
      selectedConfig.id
    ].uploadId =
      uploadId;

    setUploadStatus(
      "Validation passed. " +
      formatNumber(
        parsedFile.rowCount
      ) +
      " rows loaded and ready for processing.",
      "success"
    );

    updateReadiness();

    alert(
      "Report validated and loaded successfully.\n\n" +
      "Report: " +
      validation.detectedLabel +
      "\n\nRows: " +
      formatNumber(
        parsedFile.rowCount
      ) +
      "\n\nRaw file is not uploaded to cloud storage."
    );

  }
  catch(error){

    console.error(
      "WakeSuite upload error:",
      error
    );

    setUploadStatus(
      "Unable to process report: " +
      error.message,
      "error"
    );

    alert(
      "Unable to process report.\n\n" +
      error.message
    );

  }
  finally{

    uploadButton.disabled =
      false;

    uploadButton.innerText =
      "Validate & Load Report";

  }

}


/* ======================================================
   SHARED WAKEFIT PRICING
====================================================== */

function buildWakefitPricingMap(rows){

  const map =
    new Map();

  rows.forEach(
    row => {

      const wfSku =
        normalizeKey(
          getRowValue(
            row,
            "item_sku"
          )
        );

      if(!wfSku){
        return;
      }

      map.set(
        wfSku,
        {
          wfSku,
          wfMrp:
            parseMoney(
              getRowValue(
                row,
                "mrp"
              )
            ),
          wfPrice:
            parseMoney(
              getRowValue(
                row,
                "sale_price"
              )
            )
        }
      );

    }
  );

  return map;

}


/* ======================================================
   SHARED PRICE ACTION
====================================================== */

function calculatePriceAction(
  wfPrice,
  marketplacePrice,
  marketplaceName
){

  const lowerLimit =
    wfPrice -
    PRICE_THRESHOLD;

  const upperLimit =
    wfPrice +
    PRICE_THRESHOLD;

  if(
    marketplacePrice <
    lowerLimit
  ){

    return {
      requiredAction:
        "Increase " +
        marketplaceName +
        " Price",
      disparity:true,
      allowedPrice:lowerLimit
    };

  }

  if(
    marketplacePrice >
    upperLimit
  ){

    return {
      requiredAction:
        "Decrease " +
        marketplaceName +
        " Price",
      disparity:true,
      allowedPrice:upperLimit
    };

  }

  return {
    requiredAction:"No Action",
    disparity:false,
    allowedPrice:marketplacePrice
  };

}


/* ======================================================
   AMAZON MASTER DEDUPE
====================================================== */

function prepareAmazonMasterPricing(){

  if(
    !window.masterPricingAmazon ||
    !window.masterPricingAmazon.rows
  ){

    throw new Error(
      "Connect Master Pricing first."
    );

  }

  const masterMap =
    new Map();

  const conflictSkus =
    new Set();

  const conflicts = [];

  let exactDuplicates = 0;

  window.masterPricingAmazon.rows
  .forEach(
    row => {

      const azSku =
        normalizeKey(
          row.azSku
        );

      const asin =
        normalizeKey(
          row.asin
        );

      const wfSku =
        normalizeKey(
          row.wfSku
        );

      const category =
        normalizeKey(
          row.category
        );

      if(!azSku){
        return;
      }

      if(
        conflictSkus.has(
          azSku
        )
      ){
        return;
      }

      const record = {
        azSku,
        asin,
        wfSku,
        category
      };

      if(
        !masterMap.has(
          azSku
        )
      ){

        masterMap.set(
          azSku,
          record
        );

        return;

      }

      const existing =
        masterMap.get(
          azSku
        );

      const exactSame =
        existing.azSku ===
        record.azSku
        &&
        existing.asin ===
        record.asin
        &&
        existing.wfSku ===
        record.wfSku
        &&
        existing.category ===
        record.category;

      if(
        exactSame
      ){

        exactDuplicates += 1;
        return;

      }

      conflicts.push({
        azSku,
        existing,
        conflict:record
      });

      conflictSkus.add(
        azSku
      );

      masterMap.delete(
        azSku
      );

    }
  );

  return {
    masterMap,
    exactDuplicates,
    conflicts,
    conflictSkus
  };

}


/* ======================================================
   AMAZON LISTINGS
====================================================== */

function buildAmazonListingMap(rows){

  const map =
    new Map();

  rows.forEach(
    row => {

      const azSku =
        normalizeKey(
          getRowValue(
            row,
            "seller-sku"
          )
        );

      if(!azSku){
        return;
      }

      map.set(
        azSku,
        {
          azSku,
          asin:
            normalizeKey(
              getRowValue(
                row,
                "asin1"
              )
            ),
          status:
            String(
              getRowValue(
                row,
                "status"
              )
              ||
              ""
            )
            .trim()
            .toLowerCase(),
          azPrice:
            parseMoney(
              getRowValue(
                row,
                "price"
              )
            ),
          azMrp:
            parseMoney(
              getRowValue(
                row,
                "maximum-retail-price"
              )
            ),
          quantity:
            parseNumber(
              getRowValue(
                row,
                "quantity"
              )
            )
        }
      );

    }
  );

  return map;

}


/* ======================================================
   AMAZON FBA INVENTORY
====================================================== */

function buildFbaInventoryMap(rows){

  const map =
    new Map();

  rows.forEach(
    row => {

      const condition =
        String(
          getRowValue(
            row,
            "Warehouse-Condition-code"
          )
          ||
          ""
        )
        .trim()
        .toUpperCase();

      if(
        condition !==
        "SELLABLE"
      ){
        return;
      }

      const azSku =
        normalizeKey(
          getRowValue(
            row,
            "seller-sku"
          )
        );

      if(!azSku){
        return;
      }

      const quantity =
        parseNumber(
          getRowValue(
            row,
            "Quantity Available"
          )
        );

      map.set(
        azSku,
        (
          map.get(azSku)
          ||
          0
        )
        +
        quantity
      );

    }
  );

  return map;

}


/* ======================================================
   AMAZON BUSINESS REVENUE
====================================================== */

function buildAmazonBusinessRevenueMap(rows){

  const map =
    new Map();

  rows.forEach(
    row => {

      const asin =
        normalizeKey(
          getRowValue(
            row,
            "(Child) ASIN"
          )
        );

      if(!asin){
        return;
      }

      const revenue =
        parseMoney(
          getRowValue(
            row,
            "Ordered Product Sales"
          )
        );

      const units =
        parseNumber(
          getRowValue(
            row,
            "Units Ordered"
          )
        );

      const orderItems =
        parseNumber(
          getRowValue(
            row,
            "Total Order Items"
          )
        );

      if(
        !map.has(
          asin
        )
      ){

        map.set(
          asin,
          {
            asin,
            revenue:0,
            unitsOrdered:0,
            totalOrderItems:0
          }
        );

      }

      const current =
        map.get(
          asin
        );

      current.revenue +=
        revenue;

      current.unitsOrdered +=
        units;

      current.totalOrderItems +=
        orderItems;

    }
  );

  return map;

}


/* ======================================================
   AMAZON AUDIT LIVE STATE
====================================================== */

function resolveAmazonLiveState(
  asin,
  listingPrice,
  auditMap
){

  const audit =
    auditMap.get(
      asin
    );

  if(!audit){

    return {
      auditFound:false,
      suppressionStatus:"Audit Missing",
      buyBoxStatus:"Audit Missing",
      finalLivePrice:
        listingPrice,
      priceSource:
        "All Listings",
      eligibleForComparison:
        listingPrice > 0
    };

  }

  const classification =
    classifyAmazonAuditRecord(
      audit
    );

  if(
    audit.suppression ===
    true
  ){

    return {
      auditFound:true,
      suppressionStatus:
        classification.suppressionStatus,
      buyBoxStatus:
        classification.buyBoxStatus,
      finalLivePrice:null,
      priceSource:
        "Ignored - Suppressed",
      eligibleForComparison:false
    };

  }

  if(
    audit.suppression ===
    false &&
    audit.buyNow ===
    false
  ){

    return {
      auditFound:true,
      suppressionStatus:
        classification.suppressionStatus,
      buyBoxStatus:
        classification.buyBoxStatus,
      finalLivePrice:null,
      priceSource:
        "Ignored - Buy Now False",
      eligibleForComparison:false
    };

  }

  if(
    audit.suppression ===
    false &&
    audit.buyNow ===
    true
  ){

    if(
      audit.livePrice > 0
    ){

      return {
        auditFound:true,
        suppressionStatus:
          classification.suppressionStatus,
        buyBoxStatus:
          classification.buyBoxStatus,
        finalLivePrice:
          audit.livePrice,
        priceSource:
          "Audit Live Price",
        eligibleForComparison:true
      };

    }

    return {
      auditFound:true,
      suppressionStatus:
        classification.suppressionStatus,
      buyBoxStatus:
        classification.buyBoxStatus,
      finalLivePrice:
        listingPrice,
      priceSource:
        "All Listings - Audit Price Blank",
      eligibleForComparison:
        listingPrice > 0
    };

  }

  return {
    auditFound:true,
    suppressionStatus:
      classification.suppressionStatus,
    buyBoxStatus:
      classification.buyBoxStatus,
    finalLivePrice:
      listingPrice,
    priceSource:
      "All Listings - Audit State Unknown",
    eligibleForComparison:
      listingPrice > 0
  };

}


/* ======================================================
   AMAZON ASIN IMPACT ALLOCATION
====================================================== */

function allocateAmazonAsinRevenueImpact(
  rows,
  businessMap,
  businessReportDays
){

  const asinGroups =
    new Map();


  rows.forEach(
    row => {

      row.listingDailyRevenueImpact = 0;
      row.liveDailyRevenueImpact = 0;
      row.dailyRevenueImpact = 0;

      if(!row.asin){
        return;
      }

      if(
        !asinGroups.has(
          row.asin
        )
      ){
        asinGroups.set(
          row.asin,
          []
        );
      }

      asinGroups
      .get(
        row.asin
      )
      .push(
        row
      );

    }
  );


  asinGroups.forEach(
    (
      asinRows,
      asin
    ) => {

      const revenue =
        businessMap.get(
          asin
        )?.revenue
        ||
        0;

      if(
        revenue <= 0
      ){
        return;
      }


      /*
        LISTING PRICE IMPACT

        Business Report revenue is ASIN level and must
        not be duplicated across multiple AZ SKUs.
        Use the lowest positive eligible listing price
        mapped to the ASIN as the one listing row that
        carries the ASIN's listing-price impact.
      */

      const listingCandidates =
        asinRows
        .filter(
          row =>
            Number(row.listingPrice) > 0
        )
        .sort(
          (a,b) =>
            Number(a.listingPrice) -
            Number(b.listingPrice)
        );

      if(
        listingCandidates.length
      ){

        const listingImpactRow =
          listingCandidates[0];

        listingImpactRow.asinRevenue =
          revenue;

        if(
          listingImpactRow.listingPriceAction ===
          "Increase Amazon Price"
        ){

          const allowedPrice =
            Number(listingImpactRow.wfPrice) -
            PRICE_THRESHOLD;

          const priceGap =
            allowedPrice -
            Number(listingImpactRow.listingPrice);

          if(
            priceGap > 0 &&
            Number(listingImpactRow.listingPrice) > 0
          ){

            const priceGapPercent =
              priceGap /
              Number(listingImpactRow.listingPrice);

            listingImpactRow.listingDailyRevenueImpact =
              revenue
              *
              priceGapPercent
              /
              businessReportDays;

          }

        }

      }


      /*
        LIVE PRICE IMPACT

        Keep the same ASIN-level no-duplication rule.
        Only Audit-eligible live-price rows participate.
      */

      const liveCandidates =
        asinRows
        .filter(
          row =>
            row.eligibleForComparison &&
            Number(row.finalLivePrice) > 0
        )
        .sort(
          (a,b) =>
            Number(a.finalLivePrice) -
            Number(b.finalLivePrice)
        );

      if(
        liveCandidates.length
      ){

        const liveImpactRow =
          liveCandidates[0];

        liveImpactRow.asinRevenue =
          revenue;

        liveImpactRow.revenueAllocated =
          true;

        if(
          liveImpactRow.requiredAction ===
          "Increase Amazon Price"
        ){

          const allowedPrice =
            Number(liveImpactRow.wfPrice) -
            PRICE_THRESHOLD;

          const priceGap =
            allowedPrice -
            Number(liveImpactRow.finalLivePrice);

          if(
            priceGap > 0 &&
            Number(liveImpactRow.finalLivePrice) > 0
          ){

            const priceGapPercent =
              priceGap /
              Number(liveImpactRow.finalLivePrice);

            liveImpactRow.allowedPrice =
              allowedPrice;

            liveImpactRow.priceGap =
              priceGap;

            liveImpactRow.priceGapPercent =
              priceGapPercent;

            liveImpactRow.liveDailyRevenueImpact =
              revenue
              *
              priceGapPercent
              /
              businessReportDays;

            /*
              Backward-compatible alias used by the
              existing Amazon result engine.
            */
            liveImpactRow.dailyRevenueImpact =
              liveImpactRow.liveDailyRevenueImpact;

          }

        }

      }

    }
  );

}


/* ======================================================
   AMAZON OPERATIONAL ISSUE TABLES/* ======================================================
   AMAZON OPERATIONAL ISSUE TABLES
====================================================== */

function buildAmazonAsinIssueRows(
  rows,
  businessMap,
  businessReportDays,
  predicate
){

  const grouped =
    new Map();

  rows
  .filter(predicate)
  .forEach(
    row => {

      if(!row.asin){
        return;
      }

      const existing =
        grouped.get(
          row.asin
        );

      /*
        One ASIN only once. If multiple active/in-stock
        AZ SKUs map to the ASIN, use the lowest positive
        All Listings price as the representative row.
      */

      if(
        !existing ||
        (
          row.listingPrice > 0 &&
          (
            existing.listingPrice <= 0 ||
            row.listingPrice <
            existing.listingPrice
          )
        )
      ){
        grouped.set(
          row.asin,
          row
        );
      }

    }
  );

  return Array.from(
    grouped.values()
  )
  .map(
    row => {

      const revenue =
        businessMap.get(
          row.asin
        )?.revenue
        ||
        0;

      return {
        ...row,
        businessRevenue:
          revenue,
        revenueImpactPerDay:
          revenue /
          businessReportDays
      };

    }
  )
  .sort(
    (a,b) =>
      b.revenueImpactPerDay -
      a.revenueImpactPerDay
  );

}


/* ======================================================
   BUILD AMAZON PRICE DISPARITY
====================================================== */

function buildAmazonPriceDisparity(){

  const reports =
    window.wakeSuiteSessionReports;

  if(
    !window.masterPricingAmazon
  ){

    throw new Error(
      "Connect Master Pricing first."
    );

  }

  const requiredReports = [
    ["wakefit_daily_pricing","Wakefit Daily Pricing"],
    ["amazon_all_listings","Amazon All Listings"],
    ["amazon_fba_inventory","Amazon FBA Inventory"],
    ["amazon_business_reports","Amazon Business Reports"],
    ["marketplace_audit_report","Shared Audit Report"]
  ];

  const missingReports =
    requiredReports
    .filter(
      ([id]) =>
        !reports[id]
    )
    .map(
      ([,label]) =>
        label
    );

  if(
    missingReports.length > 0
  ){

    throw new Error(
      "Upload these reports first:\n\n" +
      missingReports.join("\n")
    );

  }

  const masterResult =
    prepareAmazonMasterPricing();

  const wfMap =
    buildWakefitPricingMap(
      reports
      .wakefit_daily_pricing
      .parsedFile
      .rows
    );

  const listingMap =
    buildAmazonListingMap(
      reports
      .amazon_all_listings
      .parsedFile
      .rows
    );

  const fbaMap =
    buildFbaInventoryMap(
      reports
      .amazon_fba_inventory
      .parsedFile
      .rows
    );

  const businessMap =
    buildAmazonBusinessRevenueMap(
      reports
      .amazon_business_reports
      .parsedFile
      .rows
    );

  const businessReportDays =
    Number(
      reports
      .amazon_business_reports
      .businessReportDays
    )
    ||
    DEFAULT_AMAZON_BUSINESS_REPORT_DAYS;

  const auditSummary =
    reports
    .marketplace_audit_report
    .auditSummary
    ||
    processAuditReport(
      reports
      .marketplace_audit_report
      .parsedFile
    );

  const auditMap =
    auditSummary.amazonMap;

  const output = [];

  const issues = {
    masterConflicts:
      masterResult.conflicts,
    exactMasterDuplicates:
      masterResult.exactDuplicates,
    missingWakefitPricing:[],
    missingAmazonListing:[],
    invalidPrices:[]
  };

  masterResult.masterMap
  .forEach(
    master => {

      const listing =
        listingMap.get(
          master.azSku
        );

      if(!listing){

        issues
        .missingAmazonListing
        .push(
          master.azSku
        );

        return;

      }

      if(
        listing.status !==
        "active"
      ){
        return;
      }

      const allListingsQty =
        listing.quantity;

      const fbaSellableQty =
        fbaMap.get(
          master.azSku
        )
        ||
        0;

      const inventory =
        allListingsQty > 0
        ?
        allListingsQty
        :
        fbaSellableQty;

      if(
        inventory <= 0
      ){
        return;
      }

      const wf =
        wfMap.get(
          master.wfSku
        );

      if(!wf){

        issues
        .missingWakefitPricing
        .push({
          azSku:
            master.azSku,
          wfSku:
            master.wfSku
        });

        return;

      }

      if(
        wf.wfPrice <= 0
      ){

        issues
        .invalidPrices
        .push(
          master.azSku
        );

        return;

      }

      const asin =
        master.asin
        ||
        listing.asin;

      const listingAction =
        listing.azPrice > 0
        ? calculatePriceAction(
            wf.wfPrice,
            listing.azPrice,
            "Amazon"
          )
        : {
            requiredAction:
              "No Listing Price",
            disparity:false,
            allowedPrice:null
          };

      const mrpDiff =
        listing.azMrp -
        wf.wfMrp;

      const mrpDisparity =
        listing.azMrp > 0 &&
        wf.wfMrp > 0 &&
        Math.abs(mrpDiff) > 0.01;

      const liveState =
        resolveAmazonLiveState(
          asin,
          listing.azPrice,
          auditMap
        );

      let requiredAction =
        "No Price Comparison";

      let disparity =
        false;

      let allowedPrice =
        null;

      if(
        liveState.eligibleForComparison &&
        liveState.finalLivePrice > 0
      ){

        const action =
          calculatePriceAction(
            wf.wfPrice,
            liveState.finalLivePrice,
            "Amazon"
          );

        requiredAction =
          action.requiredAction;

        disparity =
          action.disparity;

        allowedPrice =
          action.allowedPrice;

      }
      else if(
        liveState.suppressionStatus ===
        "Suppressed"
      ){

        requiredAction =
          "Suppressed - No Price Comparison";

      }
      else if(
        liveState.buyBoxStatus ===
        "Buy Box Suppressed"
      ){

        requiredAction =
          "Buy Box Suppressed - No Price Comparison";

      }
      else if(
        liveState.buyBoxStatus ===
        "No Buy Now"
      ){

        requiredAction =
          "No Buy Now - No Price Comparison";

      }

      output.push({
        category:
          master.category,
        wfSku:
          master.wfSku,
        azSku:
          master.azSku,
        asin,
        suppressionStatus:
          liveState.suppressionStatus,
        buyBoxStatus:
          liveState.buyBoxStatus,
        auditFound:
          liveState.auditFound,
        wfMrp:
          wf.wfMrp,
        wfPrice:
          wf.wfPrice,
        azMrp:
          listing.azMrp,
        listingPrice:
          listing.azPrice,
        finalLivePrice:
          liveState.finalLivePrice,
        priceSource:
          liveState.priceSource,
        mrpDiff,
        mrpDisparity,
        listingPriceDiff:
          listing.azPrice > 0
          ? listing.azPrice -
            wf.wfPrice
          : null,
        listingPriceAction:
          listingAction.requiredAction,
        listingPriceDisparity:
          listingAction.disparity,
        livePriceDiff:
          liveState.finalLivePrice !==
          null
          ?
          liveState.finalLivePrice -
          wf.wfPrice
          :
          null,
        livePriceAction:
          requiredAction,
        livePriceDisparity:
          disparity,
        priceDiff:
          liveState.finalLivePrice !==
          null
          ?
          liveState.finalLivePrice -
          wf.wfPrice
          :
          null,
        inventory,
        allListingsQty,
        fbaSellableQty,
        eligibleForComparison:
          liveState.eligibleForComparison,
        requiredAction,
        disparity,
        allowedPrice,
        asinRevenue:0,
        revenueAllocated:false,
        priceGap:0,
        priceGapPercent:0,
        listingDailyRevenueImpact:0,
        liveDailyRevenueImpact:0,
        dailyRevenueImpact:0
      });

    }
  );

  allocateAmazonAsinRevenueImpact(
    output,
    businessMap,
    businessReportDays
  );

  const listingPriceDisparityRows =
    output.filter(
      row =>
        row.listingPriceDisparity
    );

  const livePriceDisparityRows =
    output.filter(
      row =>
        row.livePriceDisparity
    );

  const mrpDisparityRows =
    output.filter(
      row =>
        row.mrpDisparity
    );

  const disparityRows =
    livePriceDisparityRows;

  const suppressionRows =
    buildAmazonAsinIssueRows(
      output,
      businessMap,
      businessReportDays,
      row =>
        row.suppressionStatus ===
        "Suppressed"
    );

  const buyBoxSuppressedRows =
    buildAmazonAsinIssueRows(
      output,
      businessMap,
      businessReportDays,
      row =>
        row.buyBoxStatus ===
        "Buy Box Suppressed"
    );

  const increaseRows =
    output.filter(
      row =>
        row.requiredAction ===
        "Increase Amazon Price"
    );

  const decreaseRows =
    output.filter(
      row =>
        row.requiredAction ===
        "Decrease Amazon Price"
    );

  const listingTotalDailyImpact =
    output.reduce(
      (sum,row) =>
        sum +
        Number(
          row.listingDailyRevenueImpact
          ||
          0
        ),
      0
    );

  const liveTotalDailyImpact =
    output.reduce(
      (sum,row) =>
        sum +
        Number(
          row.liveDailyRevenueImpact
          ||
          row.dailyRevenueImpact
          ||
          0
        ),
      0
    );

  const totalDailyImpact =
    liveTotalDailyImpact;

  const result = {
    generatedAt:new Date(),
    threshold:PRICE_THRESHOLD,
    businessReportDays,
    rows:output,
    disparityRows,
    listingPriceDisparityRows,
    livePriceDisparityRows,
    mrpDisparityRows,
    suppressionRows,
    buyBoxSuppressedRows,
    issues,
    summary:{
      totalActiveInStockSkus:
        output.length,
      disparitySkus:
        livePriceDisparityRows.length,
      listingPriceDisparitySkus:
        listingPriceDisparityRows.length,
      livePriceDisparitySkus:
        livePriceDisparityRows.length,
      mrpDisparitySkus:
        mrpDisparityRows.length,
      suppressedSkus:
        suppressionRows.length,
      suppressedAsins:
        suppressionRows.length,
      buyBoxSuppressedSkus:
        buyBoxSuppressedRows.length,
      buyBoxSuppressedAsins:
        buyBoxSuppressedRows.length,
      suppressionRevenueImpactPerDay:
        suppressionRows.reduce(
          (sum,row) =>
            sum + row.revenueImpactPerDay,
          0
        ),
      buyBoxRevenueImpactPerDay:
        buyBoxSuppressedRows.reduce(
          (sum,row) =>
            sum + row.revenueImpactPerDay,
          0
        ),
      increasePriceRequired:
        increaseRows.length,
      decreasePriceRequired:
        decreaseRows.length,
      listingTotalDailyRevenueImpact:
        listingTotalDailyImpact,
      liveTotalDailyRevenueImpact:
        liveTotalDailyImpact,
      totalDailyRevenueImpact:
        totalDailyImpact,
      masterExactDuplicatesRemoved:
        masterResult.exactDuplicates,
      masterConflicts:
        masterResult.conflicts.length
    }
  };

  window.amazonPriceDisparityResult =
    result;

  console.log(
    "AMAZON PRICE DISPARITY RESULT:",
    result
  );

  return result;

}


/* ======================================================
   AMAZON RESULT FILTER / TABLE
====================================================== */

function getAmazonFilteredRows(){

  const result =
    window.amazonPriceDisparityResult;

  if(!result){
    return [];
  }

  const filter =
    document
    .getElementById(
      "amazonResultFilter"
    )?.value
    ||
    "disparity";

  const search =
    document
    .getElementById(
      "amazonSearch"
    )?.value
    ?.trim()
    .toLowerCase()
    ||
    "";

  let rows =
    result.rows;

  if(
    filter ===
    "disparity"
  ){

    rows =
      rows.filter(
        row =>
          row.disparity
      );

  }
  else if(
    filter ===
    "suppressed"
  ){

    rows =
      rows.filter(
        row =>
          row.suppressionStatus ===
          "Suppressed"
      );

  }
  else if(
    filter ===
    "buybox"
  ){

    rows =
      rows.filter(
        row =>
          row.buyBoxStatus ===
          "Buy Box Suppressed"
      );

  }

  if(search){

    rows =
      rows.filter(
        row =>
          [
            row.category,
            row.wfSku,
            row.azSku,
            row.asin,
            row.requiredAction,
            row.suppressionStatus,
            row.buyBoxStatus
          ]
          .join(" ")
          .toLowerCase()
          .includes(search)
      );

  }

  return rows;

}


function renderAmazonResults(){

  const result =
    window.amazonPriceDisparityResult;

  if(!result){
    return;
  }

  const rows =
    getAmazonFilteredRows();

  const table =
    document.getElementById(
      "amazonPriceDisparityTable"
    );

  let html = `
    <thead>
      <tr>
        <th>Category</th>
        <th>WF SKU</th>
        <th>AZ SKU</th>
        <th>ASIN</th>
        <th>Suppression</th>
        <th>Buy Box</th>
        <th>WF MRP</th>
        <th>WF Price</th>
        <th>AZ MRP</th>
        <th>Listing Price</th>
        <th>Final Live Price</th>
        <th>Price Source</th>
        <th>MRP Diff</th>
        <th>Live Price Diff</th>
        <th>Inventory</th>
        <th>60-Day ASIN Revenue</th>
        <th>Price Gap %</th>
        <th>Daily Revenue Impact</th>
        <th>Required Action</th>
      </tr>
    </thead>
    <tbody>
  `;

  if(
    rows.length === 0
  ){

    html += `
      <tr>
        <td colspan="19">
          <div class="empty-state">
            No rows match this filter.
          </div>
        </td>
      </tr>
    `;

  }
  else{

    rows.forEach(
      row => {

        const suppressionPill =
          row.suppressionStatus ===
          "Suppressed"
          ?
          pill(
            row.suppressionStatus,
            "bad"
          )
          :
          row.suppressionStatus ===
          "Not Suppressed"
          ?
          pill(
            row.suppressionStatus,
            "good"
          )
          :
          pill(
            row.suppressionStatus,
            "neutral"
          );

        const buyBoxPill =
          row.buyBoxStatus ===
          "Available"
          ?
          pill(
            row.buyBoxStatus,
            "good"
          )
          :
          row.buyBoxStatus ===
          "Buy Box Suppressed"
          ?
          pill(
            row.buyBoxStatus,
            "bad"
          )
          :
          row.buyBoxStatus ===
          "No Buy Now"
          ?
          pill(
            row.buyBoxStatus,
            "warn"
          )
          :
          pill(
            row.buyBoxStatus,
            "neutral"
          );

        const actionType =
          row.requiredAction ===
          "No Action"
          ?
          "good"
          :
          row.requiredAction.startsWith(
            "Increase"
          )
          ?
          "bad"
          :
          row.requiredAction.startsWith(
            "Decrease"
          )
          ?
          "warn"
          :
          "neutral";

        html += `
          <tr>
            <td>${escapeHtml(row.category)}</td>
            <td>${escapeHtml(row.wfSku)}</td>
            <td>${escapeHtml(row.azSku)}</td>
            <td>${escapeHtml(row.asin)}</td>
            <td>${suppressionPill}</td>
            <td>${buyBoxPill}</td>
            <td>${formatINR(row.wfMrp)}</td>
            <td>${formatINR(row.wfPrice)}</td>
            <td>${formatINR(row.azMrp)}</td>
            <td>${formatINR(row.listingPrice)}</td>
            <td>${row.finalLivePrice === null ? "—" : formatINR(row.finalLivePrice)}</td>
            <td>${escapeHtml(row.priceSource)}</td>
            <td>${formatINR(row.mrpDiff)}</td>
            <td>${row.priceDiff === null ? "—" : formatINR(row.priceDiff)}</td>
            <td>${formatNumber(row.inventory)}</td>
            <td>${formatINR(row.asinRevenue)}</td>
            <td>${formatPercent(row.priceGapPercent)}</td>
            <td>${formatINR(row.dailyRevenueImpact)}</td>
            <td>${pill(row.requiredAction,actionType)}</td>
          </tr>
        `;

      }
    );

  }

  html += `
    </tbody>
  `;

  table.innerHTML =
    html;

}



/* ======================================================
   DASHBOARD + OPERATIONAL MODULES
====================================================== */

function setText(id,value){

  const element =
    document.getElementById(id);

  if(element){
    element.textContent = value;
  }

}


function updateDashboardMetrics(){

  const amazon =
    window.amazonPriceDisparityResult;

  const flipkart =
    window.flipkartPriceDisparityResult;

  const amazonLive =
    amazon?.summary?.livePriceDisparitySkus
    ||
    0;

  const flipkartLive =
    flipkart?.summary?.livePriceDisparitySkus
    ||
    0;

  setText(
    "totalLiveDisparityCount",
    formatNumber(
      amazonLive +
      flipkartLive
    )
  );

  setText(
    "amazonListingDisparityCount",
    formatNumber(
      amazon?.summary?.listingPriceDisparitySkus
      ||
      0
    )
  );

  setText(
    "amazonLiveDisparityCount",
    formatNumber(
      amazonLive
    )
  );

  setText(
    "amazonMrpDisparityCount",
    formatNumber(
      amazon?.summary?.mrpDisparitySkus
      ||
      0
    )
  );

  setText(
    "flipkartListingDisparityCount",
    formatNumber(
      flipkart?.summary?.listingPriceDisparitySkus
      ||
      0
    )
  );

  setText(
    "flipkartLiveDisparityCount",
    formatNumber(
      flipkartLive
    )
  );

  setText(
    "flipkartMrpDisparityCount",
    formatNumber(
      flipkart?.summary?.mrpDisparitySkus
      ||
      0
    )
  );

  setText(
    "amazonSuppressedCount",
    formatNumber(
      amazon?.summary?.suppressedAsins
      ||
      0
    )
  );

  setText(
    "amazonBuyBoxSuppressedCount",
    formatNumber(
      amazon?.summary?.buyBoxSuppressedAsins
      ||
      0
    )
  );

  setText(
    "flipkartNoBuyBoxCount",
    formatNumber(
      flipkart?.summary?.noBuyBoxSkus
      ||
      0
    )
  );

  setText(
    "amazonSuppressionImpactNote",
    amazon
    ? formatINR(
        amazon.summary
        .suppressionRevenueImpactPerDay
      ) + " revenue / day"
    : "Active + in-stock ASINs only"
  );

  setText(
    "amazonBuyBoxImpactNote",
    amazon
    ? formatINR(
        amazon.summary
        .buyBoxRevenueImpactPerDay
      ) + " revenue / day"
    : "Active + in-stock ASINs only"
  );

  updateCombinedDailyImpact();

}


function renderDashboardModules(){

  updateDashboardMetrics();
  renderAmazonSuppressionTable();
  renderAmazonBuyBoxTable();

}


function openDisparityHub(){

  showView(
    "disparityHubSection"
  );

  updateDashboardMetrics();

}


function getDisparityRows(
  marketplace,
  type
){

  const result =
    marketplace === "amazon"
    ? window.amazonPriceDisparityResult
    : window.flipkartPriceDisparityResult;

  if(!result){
    return null;
  }

  if(type === "listing"){
    return result.listingPriceDisparityRows;
  }

  if(type === "mrp"){
    return result.mrpDisparityRows;
  }

  return result.livePriceDisparityRows;

}


function openMarketplaceDisparity(
  marketplace,
  type
){

  const rows =
    getDisparityRows(
      marketplace,
      type
    );

  if(rows === null){

    alert(
      "Run the " +
      (
        marketplace === "amazon"
        ? "Amazon"
        : "Flipkart"
      ) +
      " engine first."
    );

    return;

  }

  showView(
    "disparityHubSection"
  );

  const marketLabel =
    marketplace === "amazon"
    ? "Amazon"
    : "Flipkart";

  const typeLabel =
    type === "listing"
    ? "Listing Price Disparity"
    : type === "mrp"
    ? "MRP Disparity"
    : "Live Price Disparity";

  setText(
    "disparityDetailTitle",
    marketLabel +
    " · " +
    typeLabel
  );

  setText(
    "disparityDetailNote",
    type === "listing"
    ? "Listing price is compared with WF Price using the ±₹5 tolerance."
    : type === "live"
    ? "Only eligible Audit live prices are compared with WF Price using the ±₹5 tolerance."
    : "Marketplace MRP is compared directly against WF MRP; any non-zero MRP difference is shown."
  );

  renderMarketplaceDisparityTable(
    marketplace,
    type,
    rows
  );

}


function renderMarketplaceDisparityTable(
  marketplace,
  type,
  rows
){

  const table =
    document.getElementById(
      "disparityDetailTable"
    );

  const isAmazon =
    marketplace === "amazon";

  const skuHeader =
    isAmazon
    ? "AZ SKU"
    : "FK SKU";

  const idHeader =
    isAmazon
    ? "ASIN"
    : "FSN";

  let html = "";

  if(type === "mrp"){

    html = `
      <thead>
        <tr>
          <th>Category</th>
          <th>${idHeader}</th>
          <th>WF SKU</th>
          <th>${skuHeader}</th>
          <th>WF MRP</th>
          <th>${isAmazon ? "Amazon MRP" : "Flipkart MRP"}</th>
          <th>MRP Diff</th>
        </tr>
      </thead>
      <tbody>
    `;

    rows.forEach(
      row => {

        html += `
          <tr>
            <td>${escapeHtml(row.category)}</td>
            <td>${escapeHtml(isAmazon ? row.asin : row.fsn)}</td>
            <td>${escapeHtml(row.wfSku)}</td>
            <td>${escapeHtml(isAmazon ? row.azSku : row.fkSku)}</td>
            <td>${formatINR(row.wfMrp)}</td>
            <td>${formatINR(isAmazon ? row.azMrp : row.fkMrp)}</td>
            <td>${formatINR(row.mrpDiff)}</td>
          </tr>
        `;

      }
    );

  }
  else{

    const priceHeader =
      type === "listing"
      ? "Listing Price"
      : "Live Price";

    html = `
      <thead>
        <tr>
          <th>Category</th>
          <th>${idHeader}</th>
          <th>WF SKU</th>
          <th>${skuHeader}</th>
          <th>WF Price</th>
          <th>${priceHeader}</th>
          <th>Price Diff</th>
          <th>Required Action</th>
        </tr>
      </thead>
      <tbody>
    `;

    rows.forEach(
      row => {

        const price =
          type === "listing"
          ? row.listingPrice
          : row.finalLivePrice;

        const diff =
          type === "listing"
          ? row.listingPriceDiff
          : row.livePriceDiff;

        const action =
          type === "listing"
          ? row.listingPriceAction
          : row.livePriceAction;

        html += `
          <tr>
            <td>${escapeHtml(row.category)}</td>
            <td>${escapeHtml(isAmazon ? row.asin : row.fsn)}</td>
            <td>${escapeHtml(row.wfSku)}</td>
            <td>${escapeHtml(isAmazon ? row.azSku : row.fkSku)}</td>
            <td>${formatINR(row.wfPrice)}</td>
            <td>${price === null ? "—" : formatINR(price)}</td>
            <td>${diff === null ? "—" : formatINR(diff)}</td>
            <td>${escapeHtml(action)}</td>
          </tr>
        `;

      }
    );

  }

  if(rows.length === 0){

    const cols =
      type === "mrp"
      ? 7
      : 8;

    html += `
      <tr>
        <td colspan="${cols}">
          <div class="empty-state">No disparity rows found.</div>
        </td>
      </tr>
    `;

  }

  html += "</tbody>";

  table.innerHTML = html;

}


function renderAmazonSuppressionTable(){

  const result =
    window.amazonPriceDisparityResult;

  const rows =
    result?.suppressionRows
    ||
    [];

  setText(
    "suppressionSummaryCount",
    formatNumber(rows.length) +
    " ASINs"
  );

  const impact =
    rows.reduce(
      (sum,row) =>
        sum +
        row.revenueImpactPerDay,
      0
    );

  setText(
    "suppressionSummaryImpact",
    formatINR(impact) +
    " / day"
  );

  const table =
    document.getElementById(
      "amazonSuppressionTable"
    );

  if(!table){
    return;
  }

  let html = `
    <thead>
      <tr>
        <th>Category</th>
        <th>ASIN</th>
        <th>Rev Impact / Day</th>
      </tr>
    </thead>
    <tbody>
  `;

  if(rows.length === 0){

    html += `
      <tr>
        <td colspan="3">
          <div class="empty-state">Run the Amazon engine to populate active + in-stock suppressions.</div>
        </td>
      </tr>
    `;

  }
  else{

    rows.forEach(
      row => {

        html += `
          <tr>
            <td>${escapeHtml(row.category)}</td>
            <td>${escapeHtml(row.asin)}</td>
            <td>${formatINR(row.revenueImpactPerDay)}</td>
          </tr>
        `;

      }
    );

  }

  html += "</tbody>";
  table.innerHTML = html;

}


function renderAmazonBuyBoxTable(){

  const result =
    window.amazonPriceDisparityResult;

  const rows =
    result?.buyBoxSuppressedRows
    ||
    [];

  setText(
    "buyBoxSummaryCount",
    formatNumber(rows.length) +
    " ASINs"
  );

  const impact =
    rows.reduce(
      (sum,row) =>
        sum +
        row.revenueImpactPerDay,
      0
    );

  setText(
    "buyBoxSummaryImpact",
    formatINR(impact) +
    " / day"
  );

  const table =
    document.getElementById(
      "amazonBuyBoxTable"
    );

  if(!table){
    return;
  }

  let html = `
    <thead>
      <tr>
        <th>Category</th>
        <th>ASIN</th>
        <th>WF SKU</th>
        <th>Price</th>
        <th>Rev Impact / Day</th>
      </tr>
    </thead>
    <tbody>
  `;

  if(rows.length === 0){

    html += `
      <tr>
        <td colspan="5">
          <div class="empty-state">Run the Amazon engine to populate active + in-stock Buy Box suppressions.</div>
        </td>
      </tr>
    `;

  }
  else{

    rows.forEach(
      row => {

        html += `
          <tr>
            <td>${escapeHtml(row.category)}</td>
            <td>${escapeHtml(row.asin)}</td>
            <td>${escapeHtml(row.wfSku)}</td>
            <td>${formatINR(row.listingPrice)}</td>
            <td>${formatINR(row.revenueImpactPerDay)}</td>
          </tr>
        `;

      }
    );

  }

  html += "</tbody>";
  table.innerHTML = html;

}


function openAmazonSuppressionModule(){

  renderAmazonSuppressionTable();
  showView(
    "amazonSuppressionSection"
  );

}


function openAmazonBuyBoxModule(){

  renderAmazonBuyBoxTable();
  showView(
    "amazonBuyBoxSection"
  );

}


function openFlipkartNoBuyBox(){

  if(
    !window.flipkartPriceDisparityResult
  ){

    alert(
      "Run the Flipkart engine first."
    );

    return;

  }

  const filter =
    document.getElementById(
      "flipkartResultFilter"
    );

  if(filter){
    filter.value =
      "nobuybox";
  }

  renderFlipkartResults();
  showView(
    "flipkartPriceDisparitySection"
  );

}


/* ======================================================
   RUN AMAZON ENGINE
====================================================== */

function runAmazonPriceDisparity(){

  try{

    const result =
      buildAmazonPriceDisparity();

    document
    .getElementById(
      "amazonResultSummary"
    )
    .textContent =
      "Active/In-stock: " +
      formatNumber(
        result.summary.totalActiveInStockSkus
      ) +
      " · Listing Disparity: " +
      formatNumber(
        result.summary.listingPriceDisparitySkus
      ) +
      " · Live Disparity: " +
      formatNumber(
        result.summary.livePriceDisparitySkus
      ) +
      " · MRP Disparity: " +
      formatNumber(
        result.summary.mrpDisparitySkus
      ) +
      " · Suppressed: " +
      formatNumber(
        result.summary.suppressedSkus
      ) +
      " · Buy Box Suppressed: " +
      formatNumber(
        result.summary.buyBoxSuppressedSkus
      ) +
      " · Daily Impact: " +
      formatINR(
        result.summary.totalDailyRevenueImpact
      );

    renderAmazonResults();
    renderDashboardModules();
    updateDashboardMetrics();

    showView(
      "dashboardHome"
    );

  }
  catch(error){

    console.error(
      "Amazon Price Disparity failed:",
      error
    );

    alert(
      "Unable to run Amazon Price Disparity.\n\n" +
      error.message
    );

  }

}


/* ======================================================
   FLIPKART MASTER DEDUPE
====================================================== */

function prepareFlipkartMasterPricing(){

  if(
    !window.masterPricingFlipkart ||
    !window.masterPricingFlipkart.rows
  ){

    throw new Error(
      "Connect Master Pricing first."
    );

  }

  const masterMap =
    new Map();

  const conflictSkus =
    new Set();

  const conflicts = [];

  let exactDuplicates = 0;

  window.masterPricingFlipkart.rows
  .forEach(
    row => {

      const fkSku =
        normalizeKey(
          row.fkSku
        );

      const fsn =
        normalizeKey(
          row.fsn
        );

      const wfSku =
        normalizeKey(
          row.wfSku
        );

      const category =
        normalizeKey(
          row.category
        );

      if(!fkSku){
        return;
      }

      if(
        conflictSkus.has(
          fkSku
        )
      ){
        return;
      }

      const record = {
        fkSku,
        fsn,
        wfSku,
        category
      };

      if(
        !masterMap.has(
          fkSku
        )
      ){

        masterMap.set(
          fkSku,
          record
        );

        return;

      }

      const existing =
        masterMap.get(
          fkSku
        );

      const exactSame =
        existing.fkSku ===
        record.fkSku
        &&
        existing.fsn ===
        record.fsn
        &&
        existing.wfSku ===
        record.wfSku
        &&
        existing.category ===
        record.category;

      if(
        exactSame
      ){

        exactDuplicates += 1;
        return;

      }

      conflicts.push({
        fkSku,
        existing,
        conflict:record
      });

      conflictSkus.add(
        fkSku
      );

      masterMap.delete(
        fkSku
      );

    }
  );

  return {
    masterMap,
    exactDuplicates,
    conflicts,
    conflictSkus
  };

}


/* ======================================================
   FLIPKART LISTING FILE
====================================================== */

function buildFlipkartListingMap(rows){

  const map =
    new Map();

  rows.forEach(
    row => {

      const fkSku =
        normalizeKey(
          getRowValue(
            row,
            "Seller SKU Id"
          )
        );

      if(!fkSku){
        return;
      }

      const record = {
        fkSku,
        fsn:
          normalizeKey(
            getRowValue(
              row,
              "Flipkart Serial Number"
            )
          ),
        status:
          String(
            getRowValue(
              row,
              "Listing Status"
            )
            ||
            ""
          )
          .trim()
          .toUpperCase(),
        fkMrp:
          parseMoney(
            getRowValue(
              row,
              "MRP"
            )
          ),
        fkPrice:
          parseMoney(
            getRowValue(
              row,
              "Your Selling Price"
            )
          ),
        systemStock:
          parseNumber(
            getRowValue(
              row,
              "System Stock count"
            )
          )
      };

      map.set(
        fkSku,
        record
      );

    }
  );

  return map;

}


/* ======================================================
   FLIPKART ORDER DATE
====================================================== */

function parseOrderDate(value){

  if(
    value === null ||
    value === undefined ||
    value === ""
  ){
    return null;
  }

  if(
    value instanceof Date &&
    !Number.isNaN(
      value.getTime()
    )
  ){

    return new Date(
      Date.UTC(
        value.getFullYear(),
        value.getMonth(),
        value.getDate()
      )
    );

  }

  if(
    typeof value ===
    "number"
  ){

    const parsed =
      XLSX?.SSF?.parse_date_code
      ? XLSX.SSF.parse_date_code(value)
      : null;

    if(parsed){

      return new Date(
        Date.UTC(
          parsed.y,
          parsed.m - 1,
          parsed.d
        )
      );

    }

  }

  const text =
    String(value)
    .trim();

  let match =
    text.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})/
    );

  if(match){

    return new Date(
      Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
      )
    );

  }

  match =
    text.match(
      /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/
    );

  if(match){

    return new Date(
      Date.UTC(
        Number(match[3]),
        Number(match[2]) - 1,
        Number(match[1])
      )
    );

  }

  const parsedTime =
    Date.parse(text);

  if(
    !Number.isNaN(
      parsedTime
    )
  ){

    const parsedDate =
      new Date(
        parsedTime
      );

    return new Date(
      Date.UTC(
        parsedDate.getFullYear(),
        parsedDate.getMonth(),
        parsedDate.getDate()
      )
    );

  }

  return null;

}


function formatDateISO(date){

  if(!date){
    return "";
  }

  const y =
    date.getUTCFullYear();

  const m =
    String(
      date.getUTCMonth() + 1
    )
    .padStart(2,"0");

  const d =
    String(
      date.getUTCDate()
    )
    .padStart(2,"0");

  return `${y}-${m}-${d}`;

}


/* ======================================================
   FLIPKART ORDER TRACKING
====================================================== */

function buildFlipkartOrderTrackingMap(rows){

  const fsnMap =
    new Map();

  let minDate = null;
  let maxDate = null;

  rows.forEach(
    row => {

      const fsn =
        normalizeKey(
          getRowValue(
            row,
            "fsn"
          )
        );

      if(!fsn){
        return;
      }

      const orderId =
        normalizeKey(
          getRowValue(
            row,
            "order_id"
          )
        );

      const status =
        String(
          getRowValue(
            row,
            "order_item_status"
          )
          ||
          ""
        )
        .trim()
        .toUpperCase();

      const quantity =
        parseNumber(
          getRowValue(
            row,
            "quantity"
          )
        );

      const orderDate =
        parseOrderDate(
          getRowValue(
            row,
            "order_date"
          )
        );

      if(orderDate){

        if(
          !minDate ||
          orderDate <
          minDate
        ){
          minDate =
            orderDate;
        }

        if(
          !maxDate ||
          orderDate >
          maxDate
        ){
          maxDate =
            orderDate;
        }

      }

      if(
        !fsnMap.has(
          fsn
        )
      ){

        fsnMap.set(
          fsn,
          {
            fsn,
            orderIds:
              new Set(),
            revenueQuantity:0,
            totalQuantity:0,
            cancelledQuantity:0
          }
        );

      }

      const current =
        fsnMap.get(
          fsn
        );

      if(orderId){

        current
        .orderIds
        .add(
          orderId
        );

      }

      current.totalQuantity +=
        quantity;

      if(
        status ===
        "CANCELLED"
      ){

        current.cancelledQuantity +=
          quantity;

      }
      else{

        current.revenueQuantity +=
          quantity;

      }

    }
  );

  let periodDays = 1;

  if(
    minDate &&
    maxDate
  ){

    periodDays =
      Math.floor(
        (
          maxDate -
          minDate
        )
        /
        86400000
      )
      +
      1;

  }

  if(
    periodDays <= 0
  ){
    periodDays = 1;
  }

  return {
    fsnMap,
    minDate,
    maxDate,
    periodDays
  };

}


/* ======================================================
   FLIPKART AUDIT LIVE STATE
====================================================== */

function resolveFlipkartLiveState(
  fsn,
  listingPrice,
  auditMap
){

  const audit =
    auditMap.get(
      fsn
    );

  if(!audit){

    return {
      auditFound:false,
      buyBoxStatus:"Audit Missing",
      finalLivePrice:
        listingPrice,
      priceSource:
        "Listing File",
      eligibleForComparison:
        listingPrice > 0
    };

  }

  if(
    audit.buyNow ===
    false
  ){

    return {
      auditFound:true,
      buyBoxStatus:"No Buy Box",
      finalLivePrice:null,
      priceSource:
        "Ignored - Buy Now False",
      eligibleForComparison:false
    };

  }

  if(
    audit.buyNow ===
    true
  ){

    if(
      audit.livePrice > 0
    ){

      return {
        auditFound:true,
        buyBoxStatus:"Available",
        finalLivePrice:
          audit.livePrice,
        priceSource:
          "Audit Live Price",
        eligibleForComparison:true
      };

    }

    return {
      auditFound:true,
      buyBoxStatus:"Available",
      finalLivePrice:
        listingPrice,
      priceSource:
        "Listing File - Audit Price Blank",
      eligibleForComparison:
        listingPrice > 0
    };

  }

  return {
    auditFound:true,
    buyBoxStatus:"Unknown",
    finalLivePrice:
      listingPrice,
    priceSource:
      "Listing File - Audit State Unknown",
    eligibleForComparison:
      listingPrice > 0
  };

}



function allocateFlipkartFsnRevenueMetrics(
  rows,
  periodDays
){

  const groups =
    new Map();


  rows.forEach(
    row => {

      row.listingCalculatedRevenue = 0;
      row.liveCalculatedRevenue = 0;
      row.listingDailyRevenueImpact = 0;
      row.liveDailyRevenueImpact = 0;
      row.buyBoxRevenueImpactPerDay = 0;

      /*
        Backward-compatible aliases.
      */
      row.calculatedRevenue = 0;
      row.dailyRevenueImpact = 0;

      if(!row.fsn){
        return;
      }

      if(
        !groups.has(
          row.fsn
        )
      ){
        groups.set(
          row.fsn,
          []
        );
      }

      groups
      .get(
        row.fsn
      )
      .push(
        row
      );

    }
  );


  groups.forEach(
    fsnRows => {

      const representative =
        fsnRows[0];

      const quantity =
        Number(
          representative.revenueQuantity
          ||
          0
        );

      if(
        quantity <= 0 ||
        periodDays <= 0
      ){
        return;
      }


      /*
        LISTING PRICE

        Revenue is joined at FSN level. If multiple FK SKUs
        map to the same FSN, allocate listing revenue and
        price impact once to the lowest positive listing
        price row.
      */

      const listingCandidates =
        fsnRows
        .filter(
          row =>
            Number(row.listingPrice) > 0
        )
        .sort(
          (a,b) =>
            Number(a.listingPrice) -
            Number(b.listingPrice)
        );

      if(
        listingCandidates.length
      ){

        const listingRow =
          listingCandidates[0];

        listingRow.listingCalculatedRevenue =
          quantity
          *
          Number(listingRow.listingPrice);

        if(
          listingRow.listingPriceAction ===
          "Increase Flipkart Price"
        ){

          const allowedPrice =
            Number(listingRow.wfPrice) -
            PRICE_THRESHOLD;

          const priceGap =
            allowedPrice -
            Number(listingRow.listingPrice);

          if(
            priceGap > 0
          ){

            const priceGapPercent =
              priceGap /
              Number(listingRow.listingPrice);

            listingRow.listingDailyRevenueImpact =
              listingRow.listingCalculatedRevenue
              *
              priceGapPercent
              /
              periodDays;

          }

        }

      }


      /*
        LIVE PRICE
      */

      const liveCandidates =
        fsnRows
        .filter(
          row =>
            row.eligibleForComparison &&
            Number(row.finalLivePrice) > 0
        )
        .sort(
          (a,b) =>
            Number(a.finalLivePrice) -
            Number(b.finalLivePrice)
        );

      if(
        liveCandidates.length
      ){

        const liveRow =
          liveCandidates[0];

        liveRow.liveCalculatedRevenue =
          quantity
          *
          Number(liveRow.finalLivePrice);

        liveRow.calculatedRevenue =
          liveRow.liveCalculatedRevenue;

        if(
          liveRow.requiredAction ===
          "Increase Flipkart Price"
        ){

          const allowedPrice =
            Number(liveRow.wfPrice) -
            PRICE_THRESHOLD;

          const priceGap =
            allowedPrice -
            Number(liveRow.finalLivePrice);

          if(
            priceGap > 0
          ){

            const priceGapPercent =
              priceGap /
              Number(liveRow.finalLivePrice);

            liveRow.liveDailyRevenueImpact =
              liveRow.liveCalculatedRevenue
              *
              priceGapPercent
              /
              periodDays;

            liveRow.dailyRevenueImpact =
              liveRow.liveDailyRevenueImpact;

          }

        }

      }


      /*
        BUY BOX UNAVAILABLE

        Audit live price is intentionally ignored when
        Buy Now is false. Revenue exposure therefore uses
        the Listing File selling price.
      */

      const noBuyBoxCandidates =
        fsnRows
        .filter(
          row =>
            row.buyBoxStatus ===
            "No Buy Box"
            &&
            Number(row.listingPrice) > 0
        )
        .sort(
          (a,b) =>
            Number(a.listingPrice) -
            Number(b.listingPrice)
        );

      if(
        noBuyBoxCandidates.length
      ){

        const buyBoxRow =
          noBuyBoxCandidates[0];

        buyBoxRow.buyBoxRevenueImpactPerDay =
          quantity
          *
          Number(buyBoxRow.listingPrice)
          /
          periodDays;

      }

    }
  );

}


/* ======================================================
   BUILD FLIPKART PRICE DISPARITY
====================================================== */

function buildFlipkartPriceDisparity(){

  const reports =
    window.wakeSuiteSessionReports;

  if(
    !window.masterPricingFlipkart
  ){

    throw new Error(
      "Connect Master Pricing first."
    );

  }

  const requiredReports = [
    ["wakefit_daily_pricing","Wakefit Daily Pricing"],
    ["flipkart_listing_file","Flipkart Listing File"],
    ["flipkart_order_report","Flipkart Order Report"],
    ["marketplace_audit_report","Shared Audit Report"]
  ];

  const missingReports =
    requiredReports
    .filter(
      ([id]) =>
        !reports[id]
    )
    .map(
      ([,label]) =>
        label
    );

  if(
    missingReports.length > 0
  ){

    throw new Error(
      "Upload these reports first:\n\n" +
      missingReports.join("\n")
    );

  }

  const masterResult =
    prepareFlipkartMasterPricing();

  const wfMap =
    buildWakefitPricingMap(
      reports
      .wakefit_daily_pricing
      .parsedFile
      .rows
    );

  const listingMap =
    buildFlipkartListingMap(
      reports
      .flipkart_listing_file
      .parsedFile
      .rows
    );

  const orderData =
    buildFlipkartOrderTrackingMap(
      reports
      .flipkart_order_report
      .parsedFile
      .rows
    );

  const auditSummary =
    reports
    .marketplace_audit_report
    .auditSummary
    ||
    processAuditReport(
      reports
      .marketplace_audit_report
      .parsedFile
    );

  const auditMap =
    auditSummary.flipkartMap;

  const output = [];

  const issues = {
    masterConflicts:
      masterResult.conflicts,
    exactMasterDuplicates:
      masterResult.exactDuplicates,
    missingWakefitPricing:[],
    missingFlipkartListing:[],
    invalidPrices:[],
    fsnMismatch:[]
  };

  masterResult.masterMap
  .forEach(
    master => {

      const listing =
        listingMap.get(
          master.fkSku
        );

      if(!listing){

        issues
        .missingFlipkartListing
        .push(
          master.fkSku
        );

        return;

      }

      if(
        listing.status !==
        "ACTIVE"
      ){
        return;
      }

      if(
        listing.systemStock <= 0
      ){
        return;
      }

      const wf =
        wfMap.get(
          master.wfSku
        );

      if(!wf){

        issues
        .missingWakefitPricing
        .push({
          fkSku:
            master.fkSku,
          wfSku:
            master.wfSku
        });

        return;

      }

      if(
        wf.wfPrice <= 0
      ){

        issues
        .invalidPrices
        .push(
          master.fkSku
        );

        return;

      }

      const fsn =
        listing.fsn;

      if(
        master.fsn &&
        fsn &&
        master.fsn !==
        fsn
      ){

        issues
        .fsnMismatch
        .push({
          fkSku:
            master.fkSku,
          masterFsn:
            master.fsn,
          listingFsn:
            fsn
        });

      }

      const listingAction =
        listing.fkPrice > 0
        ? calculatePriceAction(
            wf.wfPrice,
            listing.fkPrice,
            "Flipkart"
          )
        : {
            requiredAction:
              "No Listing Price",
            disparity:false,
            allowedPrice:null
          };

      const mrpDiff =
        listing.fkMrp -
        wf.wfMrp;

      const mrpDisparity =
        listing.fkMrp > 0 &&
        wf.wfMrp > 0 &&
        Math.abs(mrpDiff) > 0.01;

      const liveState =
        resolveFlipkartLiveState(
          fsn,
          listing.fkPrice,
          auditMap
        );

      const orderStats =
        orderData.fsnMap.get(
          fsn
        )
        ||
        {
          orderIds:new Set(),
          revenueQuantity:0,
          totalQuantity:0,
          cancelledQuantity:0
        };

      const ordersReceived =
        orderStats
        .orderIds
        .size;

      const revenueQuantity =
        orderStats
        .revenueQuantity;

      /*
        If Buy Now is false, price is not trusted,
        so calculated revenue is not generated for
        that live-state row.
      */

      const calculatedRevenue =
        liveState.eligibleForComparison &&
        liveState.finalLivePrice > 0
        ?
        revenueQuantity
        *
        liveState.finalLivePrice
        :
        0;

      let requiredAction =
        "No Price Comparison";

      let disparity =
        false;

      let allowedPrice =
        null;

      let priceGap = 0;
      let priceGapPercent = 0;
      let revenueImpact = 0;
      let dailyRevenueImpact = 0;

      if(
        liveState.eligibleForComparison &&
        liveState.finalLivePrice > 0
      ){

        const action =
          calculatePriceAction(
            wf.wfPrice,
            liveState.finalLivePrice,
            "Flipkart"
          );

        requiredAction =
          action.requiredAction;

        disparity =
          action.disparity;

        allowedPrice =
          action.allowedPrice;

        if(
          requiredAction ===
          "Increase Flipkart Price"
        ){

          allowedPrice =
            wf.wfPrice -
            PRICE_THRESHOLD;

          priceGap =
            allowedPrice -
            liveState.finalLivePrice;

          if(
            priceGap > 0
          ){

            priceGapPercent =
              priceGap /
              liveState.finalLivePrice;

            revenueImpact =
              calculatedRevenue
              *
              priceGapPercent;

            dailyRevenueImpact =
              revenueImpact
              /
              orderData.periodDays;

          }

        }

      }
      else if(
        liveState.buyBoxStatus ===
        "No Buy Box"
      ){

        requiredAction =
          "No Buy Box - No Price Comparison";

      }

      output.push({
        category:
          master.category,
        wfSku:
          master.wfSku,
        fkSku:
          master.fkSku,
        fsn,
        masterFsn:
          master.fsn,
        buyBoxStatus:
          liveState.buyBoxStatus,
        auditFound:
          liveState.auditFound,
        wfMrp:
          wf.wfMrp,
        wfPrice:
          wf.wfPrice,
        fkMrp:
          listing.fkMrp,
        listingPrice:
          listing.fkPrice,
        finalLivePrice:
          liveState.finalLivePrice,
        priceSource:
          liveState.priceSource,
        mrpDiff,
        mrpDisparity,
        listingPriceDiff:
          listing.fkPrice > 0
          ? listing.fkPrice -
            wf.wfPrice
          : null,
        listingPriceAction:
          listingAction.requiredAction,
        listingPriceDisparity:
          listingAction.disparity,
        livePriceDiff:
          liveState.finalLivePrice !==
          null
          ?
          liveState.finalLivePrice -
          wf.wfPrice
          :
          null,
        livePriceAction:
          requiredAction,
        livePriceDisparity:
          disparity,
        priceDiff:
          liveState.finalLivePrice !==
          null
          ?
          liveState.finalLivePrice -
          wf.wfPrice
          :
          null,
        inventory:
          listing.systemStock,
        ordersReceived,
        revenueQuantity,
        calculatedRevenue,
        eligibleForComparison:
          liveState.eligibleForComparison,
        requiredAction,
        disparity,
        allowedPrice,
        priceGap,
        priceGapPercent,
        revenueImpact,
        dailyRevenueImpact
      });

    }
  );

  allocateFlipkartFsnRevenueMetrics(
    output,
    orderData.periodDays
  );

  const listingPriceDisparityRows =
    output.filter(
      row =>
        row.listingPriceDisparity
    );

  const livePriceDisparityRows =
    output.filter(
      row =>
        row.livePriceDisparity
    );

  const mrpDisparityRows =
    output.filter(
      row =>
        row.mrpDisparity
    );

  const disparityRows =
    livePriceDisparityRows;

  const noBuyBoxRows =
    output.filter(
      row =>
        row.buyBoxStatus ===
        "No Buy Box"
    );

  const increaseRows =
    output.filter(
      row =>
        row.requiredAction ===
        "Increase Flipkart Price"
    );

  const decreaseRows =
    output.filter(
      row =>
        row.requiredAction ===
        "Decrease Flipkart Price"
    );

  const totalCalculatedRevenue =
    output.reduce(
      (sum,row) =>
        sum +
        Number(
          row.liveCalculatedRevenue
          ||
          row.calculatedRevenue
          ||
          0
        ),
      0
    );

  const listingTotalDailyImpact =
    output.reduce(
      (sum,row) =>
        sum +
        Number(
          row.listingDailyRevenueImpact
          ||
          0
        ),
      0
    );

  const liveTotalDailyImpact =
    output.reduce(
      (sum,row) =>
        sum +
        Number(
          row.liveDailyRevenueImpact
          ||
          row.dailyRevenueImpact
          ||
          0
        ),
      0
    );

  const noBuyBoxRevenueImpactPerDay =
    output.reduce(
      (sum,row) =>
        sum +
        Number(
          row.buyBoxRevenueImpactPerDay
          ||
          0
        ),
      0
    );

  const totalDailyImpact =
    liveTotalDailyImpact;

  const result = {
    generatedAt:new Date(),
    threshold:PRICE_THRESHOLD,
    orderPeriod:{
      startDate:
        formatDateISO(
          orderData.minDate
        ),
      endDate:
        formatDateISO(
          orderData.maxDate
        ),
      days:
        orderData.periodDays
    },
    rows:output,
    disparityRows,
    listingPriceDisparityRows,
    livePriceDisparityRows,
    mrpDisparityRows,
    issues,
    summary:{
      totalActiveInStockSkus:
        output.length,
      disparitySkus:
        livePriceDisparityRows.length,
      listingPriceDisparitySkus:
        listingPriceDisparityRows.length,
      livePriceDisparitySkus:
        livePriceDisparityRows.length,
      mrpDisparitySkus:
        mrpDisparityRows.length,
      noBuyBoxSkus:
        noBuyBoxRows.length,
      increasePriceRequired:
        increaseRows.length,
      decreasePriceRequired:
        decreaseRows.length,
      totalCalculatedRevenue,
      listingTotalDailyRevenueImpact:
        listingTotalDailyImpact,
      liveTotalDailyRevenueImpact:
        liveTotalDailyImpact,
      noBuyBoxRevenueImpactPerDay,
      totalDailyRevenueImpact:
        totalDailyImpact,
      masterExactDuplicatesRemoved:
        masterResult.exactDuplicates,
      masterConflicts:
        masterResult.conflicts.length,
      fsnMismatchCount:
        issues.fsnMismatch.length
    }
  };

  window.flipkartPriceDisparityResult =
    result;

  console.log(
    "FLIPKART PRICE DISPARITY RESULT:",
    result
  );

  return result;

}


/* ======================================================
   FLIPKART RESULT FILTER / TABLE
====================================================== */

function getFlipkartFilteredRows(){

  const result =
    window.flipkartPriceDisparityResult;

  if(!result){
    return [];
  }

  const filter =
    document
    .getElementById(
      "flipkartResultFilter"
    )?.value
    ||
    "disparity";

  const search =
    document
    .getElementById(
      "flipkartSearch"
    )?.value
    ?.trim()
    .toLowerCase()
    ||
    "";

  let rows =
    result.rows;

  if(
    filter ===
    "disparity"
  ){

    rows =
      rows.filter(
        row =>
          row.disparity
      );

  }
  else if(
    filter ===
    "nobuybox"
  ){

    rows =
      rows.filter(
        row =>
          row.buyBoxStatus ===
          "No Buy Box"
      );

  }

  if(search){

    rows =
      rows.filter(
        row =>
          [
            row.category,
            row.wfSku,
            row.fkSku,
            row.fsn,
            row.requiredAction,
            row.buyBoxStatus
          ]
          .join(" ")
          .toLowerCase()
          .includes(search)
      );

  }

  return rows;

}


function renderFlipkartResults(){

  const result =
    window.flipkartPriceDisparityResult;

  if(!result){
    return;
  }

  const rows =
    getFlipkartFilteredRows();

  const table =
    document.getElementById(
      "flipkartPriceDisparityTable"
    );

  let html = `
    <thead>
      <tr>
        <th>Category</th>
        <th>WF SKU</th>
        <th>FK SKU</th>
        <th>FSN</th>
        <th>Buy Box</th>
        <th>WF MRP</th>
        <th>WF Price</th>
        <th>FK MRP</th>
        <th>Listing Price</th>
        <th>Final Live Price</th>
        <th>Price Source</th>
        <th>MRP Diff</th>
        <th>Live Price Diff</th>
        <th>System Stock</th>
        <th>Orders Received</th>
        <th>Revenue Qty</th>
        <th>Calculated Revenue</th>
        <th>Price Gap %</th>
        <th>Daily Revenue Impact</th>
        <th>Required Action</th>
      </tr>
    </thead>
    <tbody>
  `;

  if(
    rows.length === 0
  ){

    html += `
      <tr>
        <td colspan="20">
          <div class="empty-state">
            No rows match this filter.
          </div>
        </td>
      </tr>
    `;

  }
  else{

    rows.forEach(
      row => {

        const buyBoxPill =
          row.buyBoxStatus ===
          "Available"
          ?
          pill(
            row.buyBoxStatus,
            "good"
          )
          :
          row.buyBoxStatus ===
          "No Buy Box"
          ?
          pill(
            row.buyBoxStatus,
            "bad"
          )
          :
          pill(
            row.buyBoxStatus,
            "neutral"
          );

        const actionType =
          row.requiredAction ===
          "No Action"
          ?
          "good"
          :
          row.requiredAction.startsWith(
            "Increase"
          )
          ?
          "bad"
          :
          row.requiredAction.startsWith(
            "Decrease"
          )
          ?
          "warn"
          :
          "neutral";

        html += `
          <tr>
            <td>${escapeHtml(row.category)}</td>
            <td>${escapeHtml(row.wfSku)}</td>
            <td>${escapeHtml(row.fkSku)}</td>
            <td>${escapeHtml(row.fsn)}</td>
            <td>${buyBoxPill}</td>
            <td>${formatINR(row.wfMrp)}</td>
            <td>${formatINR(row.wfPrice)}</td>
            <td>${formatINR(row.fkMrp)}</td>
            <td>${formatINR(row.listingPrice)}</td>
            <td>${row.finalLivePrice === null ? "—" : formatINR(row.finalLivePrice)}</td>
            <td>${escapeHtml(row.priceSource)}</td>
            <td>${formatINR(row.mrpDiff)}</td>
            <td>${row.priceDiff === null ? "—" : formatINR(row.priceDiff)}</td>
            <td>${formatNumber(row.inventory)}</td>
            <td>${formatNumber(row.ordersReceived)}</td>
            <td>${formatNumber(row.revenueQuantity)}</td>
            <td>${formatINR(row.calculatedRevenue)}</td>
            <td>${formatPercent(row.priceGapPercent)}</td>
            <td>${formatINR(row.dailyRevenueImpact)}</td>
            <td>${pill(row.requiredAction,actionType)}</td>
          </tr>
        `;

      }
    );

  }

  html += `
    </tbody>
  `;

  table.innerHTML =
    html;

}


/* ======================================================
   RUN FLIPKART ENGINE
====================================================== */

function runFlipkartPriceDisparity(){

  try{

    const result =
      buildFlipkartPriceDisparity();

    document
    .getElementById(
      "flipkartResultNote"
    )
    .textContent =
      "Order period: " +
      (
        result.orderPeriod.startDate
        ||
        "Unknown"
      ) +
      " to " +
      (
        result.orderPeriod.endDate
        ||
        "Unknown"
      ) +
      " (" +
      result.orderPeriod.days +
      " days) · Active/In-stock: " +
      formatNumber(
        result.summary.totalActiveInStockSkus
      ) +
      " · Listing Disparity: " +
      formatNumber(
        result.summary.listingPriceDisparitySkus
      ) +
      " · Live Disparity: " +
      formatNumber(
        result.summary.livePriceDisparitySkus
      ) +
      " · MRP Disparity: " +
      formatNumber(
        result.summary.mrpDisparitySkus
      ) +
      " · No Buy Box: " +
      formatNumber(
        result.summary.noBuyBoxSkus
      ) +
      " · Daily Impact: " +
      formatINR(
        result.summary.totalDailyRevenueImpact
      );

    renderFlipkartResults();
    updateDashboardMetrics();

    showView(
      "dashboardHome"
    );

  }
  catch(error){

    console.error(
      "Flipkart Price Disparity failed:",
      error
    );

    alert(
      "Unable to run Flipkart Price Disparity.\n\n" +
      error.message
    );

  }

}


/* ======================================================
   COMBINED IMPACT + CSV DOWNLOAD
====================================================== */

function updateCombinedDailyImpact(){

  const amazonImpact =
    window
    .amazonPriceDisparityResult
    ?.summary
    ?.totalDailyRevenueImpact
    ||
    0;

  const flipkartImpact =
    window
    .flipkartPriceDisparityResult
    ?.summary
    ?.totalDailyRevenueImpact
    ||
    0;

  const element =
    document.getElementById(
      "combinedDailyImpact"
    );

  if(element){

    element.textContent =
      formatINR(
        amazonImpact +
        flipkartImpact
      );

  }

}


function csvEscape(value){

  const text =
    String(value ?? "");

  if(
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ){

    return '"' +
      text.replaceAll(
        '"',
        '""'
      ) +
      '"';

  }

  return text;

}


function downloadCsv(
  filename,
  headers,
  rows
){

  if(
    !rows ||
    rows.length === 0
  ){

    alert(
      "No results are available to download."
    );

    return;

  }

  const lines = [
    headers
    .map(
      item =>
        csvEscape(
          item.label
        )
    )
    .join(",")
  ];

  rows.forEach(
    row => {

      lines.push(
        headers
        .map(
          item =>
            csvEscape(
              item.getter(row)
            )
        )
        .join(",")
      );

    }
  );

  const blob =
    new Blob(
      [
        "\uFEFF" +
        lines.join("\n")
      ],
      {
        type:
          "text/csv;charset=utf-8"
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  link.href =
    url;

  link.download =
    filename;

  document.body
  .appendChild(
    link
  );

  link.click();
  link.remove();

  URL.revokeObjectURL(
    url
  );

}


function downloadAmazonResults(){

  const result =
    window.amazonPriceDisparityResult;

  if(!result){

    alert(
      "Run the Amazon engine first."
    );

    return;

  }

  downloadCsv(
    "WakeSuite_Amazon_Results.csv",
    [
      {label:"Category",getter:r=>r.category},
      {label:"WF SKU",getter:r=>r.wfSku},
      {label:"AZ SKU",getter:r=>r.azSku},
      {label:"ASIN",getter:r=>r.asin},
      {label:"Suppression Status",getter:r=>r.suppressionStatus},
      {label:"Buy Box Status",getter:r=>r.buyBoxStatus},
      {label:"WF MRP",getter:r=>r.wfMrp},
      {label:"WF Price",getter:r=>r.wfPrice},
      {label:"AZ MRP",getter:r=>r.azMrp},
      {label:"AZ Listing Price",getter:r=>r.listingPrice},
      {label:"AZ Final Live Price",getter:r=>r.finalLivePrice ?? ""},
      {label:"Price Source",getter:r=>r.priceSource},
      {label:"MRP Diff",getter:r=>r.mrpDiff},
      {label:"Live Price Diff",getter:r=>r.priceDiff ?? ""},
      {label:"Inventory",getter:r=>r.inventory},
      {label:"60-Day ASIN Revenue",getter:r=>r.asinRevenue},
      {label:"Price Gap",getter:r=>r.priceGap},
      {label:"Price Gap %",getter:r=>r.priceGapPercent},
      {label:"Daily Revenue Impact",getter:r=>r.dailyRevenueImpact},
      {label:"Required Action",getter:r=>r.requiredAction}
    ],
    result.rows
  );

}


function downloadFlipkartResults(){

  const result =
    window.flipkartPriceDisparityResult;

  if(!result){

    alert(
      "Run the Flipkart engine first."
    );

    return;

  }

  downloadCsv(
    "WakeSuite_Flipkart_Results.csv",
    [
      {label:"Category",getter:r=>r.category},
      {label:"WF SKU",getter:r=>r.wfSku},
      {label:"FK SKU",getter:r=>r.fkSku},
      {label:"FSN",getter:r=>r.fsn},
      {label:"Buy Box Status",getter:r=>r.buyBoxStatus},
      {label:"WF MRP",getter:r=>r.wfMrp},
      {label:"WF Price",getter:r=>r.wfPrice},
      {label:"FK MRP",getter:r=>r.fkMrp},
      {label:"FK Listing Price",getter:r=>r.listingPrice},
      {label:"FK Final Live Price",getter:r=>r.finalLivePrice ?? ""},
      {label:"Price Source",getter:r=>r.priceSource},
      {label:"MRP Diff",getter:r=>r.mrpDiff},
      {label:"Live Price Diff",getter:r=>r.priceDiff ?? ""},
      {label:"System Stock",getter:r=>r.inventory},
      {label:"Orders Received",getter:r=>r.ordersReceived},
      {label:"Revenue Quantity",getter:r=>r.revenueQuantity},
      {label:"Calculated Revenue",getter:r=>r.calculatedRevenue},
      {label:"Price Gap",getter:r=>r.priceGap},
      {label:"Price Gap %",getter:r=>r.priceGapPercent},
      {label:"Daily Revenue Impact",getter:r=>r.dailyRevenueImpact},
      {label:"Required Action",getter:r=>r.requiredAction}
    ],
    result.rows
  );

}




/* ======================================================
   FINAL WAKESUITE ARCHITECTURE
   - same-date gate
   - IndexedDB local persistence
   - automatic one-time daily processing
   - Firestore daily snapshot history
   - daily / weekly / monthly reporting
====================================================== */

const FINAL_REQUIRED_REPORTS = [
  ["wakefit_daily_pricing","Wakefit · Daily Pricing"],
  ["amazon_all_listings","Amazon · All Listings"],
  ["amazon_fba_inventory","Amazon · FBA Inventory"],
  ["amazon_business_reports","Amazon · Business Reports"],
  ["flipkart_listing_file","Flipkart · Listing File"],
  ["flipkart_order_report","Flipkart · Order Report"],
  ["marketplace_audit_report","Shared · Audit Report"]
];

const FINAL_VIEW_TITLES = {
  dashboardHome:"Dashboard",
  marketplaceInsightsSection:"Marketplace Insights",
  reportModuleSection:"Report",
  uploadSection:"Data Center",
  masterPricingSection:"Master Pricing"
};

let currentHistoricalViewKey = "amazon_live";
let currentHistoricalReport = null;
let currentInsightsReport = null;
let processingLock = false;
let currentSessionDate = null;
const snapshotCache = new Map();

function finalSetText(id,value){
  const el = document.getElementById(id);
  if(el){ el.textContent = value; }
}

function todayIso(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

// V8.1 startup hotfix: compatibility helper used by date-aware modules.
// Accepts a Date, ISO/date-like value, or no argument and always returns YYYY-MM-DD in local time.
function localIsoDate(value = new Date()){
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value || Date.now());
  if(Number.isNaN(d.getTime())) return todayIso();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function showView(id){
  document.querySelectorAll(".app-view").forEach(el=>el.classList.remove("active"));
  const target = document.getElementById(id);
  if(!target){ return; }
  target.classList.add("active");
  finalSetText("pageTitle",FINAL_VIEW_TITLES[id] || "WakeSuite");
  window.scrollTo({top:0,behavior:"smooth"});
}

function updateRunButtons(){
  // Manual processing is intentionally disabled in the final workflow.
}

function getBusinessReportDays(){
  return DEFAULT_AMAZON_BUSINESS_REPORT_DAYS;
}

function updateBusinessDaysVisibility(){
  const field = document.getElementById("businessReportDaysField");
  if(field){ field.style.display = "none"; }
}

/* ---------- IndexedDB ---------- */

function openWakeSuiteDb(){
  return new Promise((resolve,reject)=>{
    const request = indexedDB.open("WakeSuite_Local",1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if(!db.objectStoreNames.contains("reports")){
        const store = db.createObjectStore("reports",{keyPath:"key"});
        store.createIndex("reportDate","reportDate",{unique:false});
      }
    };
    request.onsuccess = ()=>resolve(request.result);
    request.onerror = ()=>reject(request.error);
  });
}

async function idbPutReport(reportDate,configId,record){
  const db = await openWakeSuiteDb();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction("reports","readwrite");
    tx.objectStore("reports").put({
      key:`${reportDate}::${configId}`,
      reportDate,
      configId,
      record
    });
    tx.oncomplete = ()=>resolve();
    tx.onerror = ()=>reject(tx.error);
  });
}

async function idbGetReportsForDate(reportDate){
  const db = await openWakeSuiteDb();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction("reports","readonly");
    const index = tx.objectStore("reports").index("reportDate");
    const req = index.getAll(reportDate);
    req.onsuccess = ()=>resolve(req.result || []);
    req.onerror = ()=>reject(req.error);
  });
}

async function persistCurrentUploadedReport(reportDate,configId){
  const current = window.wakeSuiteSessionReports?.[configId];
  if(!current || current.reportDate !== reportDate){ return; }
  const clone = {
    ...current,
    file:null,
    fileName:current.parsedFile?.fileName || "",
    fileSize:current.parsedFile?.fileSize || 0,
    lastModified:current.lastModified || current.file?.lastModified || 0
  };
  await idbPutReport(reportDate,configId,clone);
}

async function restoreSessionForDate(reportDate){
  if(!reportDate){ return; }
  const items = await idbGetReportsForDate(reportDate);
  const restored = {};
  items.forEach(item=>{ restored[item.configId] = item.record; });
  window.wakeSuiteSessionReports = restored;
  currentSessionDate = reportDate;
  updateReadiness();
}

function getSelectedReportDate(){
  return document.getElementById("reportDate")?.value || currentSessionDate || todayIso();
}

function reportsAllSameDate(date){
  return FINAL_REQUIRED_REPORTS.every(([id])=>{
    const r = window.wakeSuiteSessionReports?.[id];
    return !!r && r.reportDate === date;
  });
}

const PROCESSING_SCHEMA_VERSION =
  "2026-08-17-premium-v5";


function buildInputFingerprint(date){

  const payload =
    FINAL_REQUIRED_REPORTS
    .map(
      ([id]) => {

        const r =
          window
          .wakeSuiteSessionReports
          ?.[id];

        return [
          id,
          r?.reportDate
          ||
          "",
          r?.parsedFile?.fileName
          ||
          r?.fileName
          ||
          "",
          Number(
            r?.parsedFile?.fileSize
            ||
            r?.fileSize
            ||
            0
          ),
          Number(
            r?.lastModified
            ||
            0
          ),
          Number(
            r?.parsedFile?.rowCount
            ||
            0
          )
        ];

      }
    );

  return btoa(
    unescape(
      encodeURIComponent(
        JSON.stringify([
          PROCESSING_SCHEMA_VERSION,
          date,
          payload
        ])
      )
    )
  );

}


function updateReadiness(){
  const date = getSelectedReportDate();
  let loaded = 0;
  let html = "";
  FINAL_REQUIRED_REPORTS.forEach(([id,label])=>{
    const report = window.wakeSuiteSessionReports?.[id];
    const ready = !!report && report.reportDate === date;
    if(ready){ loaded += 1; }
    html += `<div class="ready-row"><span>${escapeHtml(label)}</span><span class="ready-badge ${ready ? "ready" : ""}">${ready ? "Ready" : "Pending"}</span></div>`;
  });
  const box = document.getElementById("readinessList");
  if(box){ box.innerHTML = html; }
  finalSetText("readinessCounter",`${loaded} / ${FINAL_REQUIRED_REPORTS.length}`);
  finalSetText("readinessTitle",date ? `Daily Readiness · ${date}` : "Daily Readiness");
  finalSetText("sessionChipText",`${loaded} / ${FINAL_REQUIRED_REPORTS.length} Ready`);
  const chip = document.getElementById("sessionChip");
  if(chip){ chip.classList.toggle("ready",loaded === FINAL_REQUIRED_REPORTS.length); }
  const old = document.getElementById("dashboardReportsLoaded");
  if(old){ old.textContent = String(loaded); }
}

/* ---------- Compact history serialization ---------- */

function compactAmazonRow(r){
  return [
    r.category,r.wfSku,r.azSku,r.asin,r.wfMrp,r.wfPrice,r.azMrp,
    r.listingPrice,r.finalLivePrice,r.inventory,r.suppressionStatus,
    r.buyBoxStatus,!!r.listingPriceDisparity,!!r.livePriceDisparity,
    !!r.mrpDisparity,r.listingPriceDiff,r.livePriceDiff,r.mrpDiff,
    r.dailyRevenueImpact,r.requiredAction,r.listingPriceAction,
    !!r.eligibleForComparison,
    r.listingDailyRevenueImpact||0,
    r.liveDailyRevenueImpact||r.dailyRevenueImpact||0
  ];
}
function expandAmazonRow(a){
  return {
    category:a[0],wfSku:a[1],azSku:a[2],asin:a[3],wfMrp:a[4],wfPrice:a[5],
    azMrp:a[6],listingPrice:a[7],finalLivePrice:a[8],inventory:a[9],
    suppressionStatus:a[10],buyBoxStatus:a[11],
    listingPriceDisparity:!!a[12],livePriceDisparity:!!a[13],
    mrpDisparity:!!a[14],listingPriceDiff:a[15],livePriceDiff:a[16],
    mrpDiff:a[17],dailyRevenueImpact:a[18]||0,requiredAction:a[19],
    listingPriceAction:a[20],eligibleForComparison:!!a[21],
    listingDailyRevenueImpact:a[22]||0,
    liveDailyRevenueImpact:a[23]||a[18]||0
  };
}
function compactAmazonIssueRow(r){
  return [r.category,r.asin,r.wfSku,r.listingPrice,r.businessRevenue,r.revenueImpactPerDay,r.azSku];
}
function expandAmazonIssueRow(a){
  return {category:a[0],asin:a[1],wfSku:a[2],listingPrice:a[3],businessRevenue:a[4],revenueImpactPerDay:a[5],azSku:a[6]};
}
function compactFlipkartRow(r){
  return [
    r.category,r.wfSku,r.fkSku,r.fsn,r.wfMrp,r.wfPrice,r.fkMrp,
    r.listingPrice,r.finalLivePrice,r.inventory,r.buyBoxStatus,
    !!r.listingPriceDisparity,!!r.livePriceDisparity,!!r.mrpDisparity,
    r.listingPriceDiff,r.livePriceDiff,r.mrpDiff,r.dailyRevenueImpact,
    r.calculatedRevenue,r.ordersReceived,r.revenueQuantity,r.requiredAction,
    r.listingPriceAction,!!r.eligibleForComparison,
    r.listingCalculatedRevenue||0,
    r.liveCalculatedRevenue||r.calculatedRevenue||0,
    r.listingDailyRevenueImpact||0,
    r.liveDailyRevenueImpact||r.dailyRevenueImpact||0,
    r.buyBoxRevenueImpactPerDay||0
  ];
}
function expandFlipkartRow(a){
  return {
    category:a[0],wfSku:a[1],fkSku:a[2],fsn:a[3],wfMrp:a[4],wfPrice:a[5],
    fkMrp:a[6],listingPrice:a[7],finalLivePrice:a[8],inventory:a[9],
    buyBoxStatus:a[10],listingPriceDisparity:!!a[11],
    livePriceDisparity:!!a[12],mrpDisparity:!!a[13],
    listingPriceDiff:a[14],livePriceDiff:a[15],mrpDiff:a[16],
    dailyRevenueImpact:a[17]||0,calculatedRevenue:a[18]||0,
    ordersReceived:a[19]||0,revenueQuantity:a[20]||0,requiredAction:a[21],
    listingPriceAction:a[22],eligibleForComparison:!!a[23],
    listingCalculatedRevenue:a[24]||0,
    liveCalculatedRevenue:a[25]||a[18]||0,
    listingDailyRevenueImpact:a[26]||0,
    liveDailyRevenueImpact:a[27]||a[17]||0,
    buyBoxRevenueImpactPerDay:a[28]||0
  };
}

function calcParityStats(rows,kind,marketplace){
  let eligible = [];
  let disparityCount = 0;
  if(kind === "listing"){
    eligible = rows.filter(r=>Number(r.listingPrice)>0);
    disparityCount = eligible.filter(r=>r.listingPriceDisparity).length;
  }else if(kind === "live"){
    eligible = rows.filter(r=>r.eligibleForComparison && Number(r.finalLivePrice)>0);
    disparityCount = eligible.filter(r=>r.livePriceDisparity).length;
  }else{
    const marketMrpKey = marketplace === "amazon" ? "azMrp" : "fkMrp";
    eligible = rows.filter(r=>Number(r.wfMrp)>0 && Number(r[marketMrpKey])>0);
    disparityCount = eligible.filter(r=>r.mrpDisparity).length;
  }
  return {
    eligible:eligible.length,
    disparity:disparityCount,
    parity:Math.max(0,eligible.length-disparityCount),
    parityPct:eligible.length ? (eligible.length-disparityCount)/eligible.length : 0
  };
}

function buildSnapshotInsights(amazon,flipkart){

  const azListing =
    calcParityStats(
      amazon.rows,
      "listing",
      "amazon"
    );

  const azLive =
    calcParityStats(
      amazon.rows,
      "live",
      "amazon"
    );

  const azMrp =
    calcParityStats(
      amazon.rows,
      "mrp",
      "amazon"
    );

  const fkListing =
    calcParityStats(
      flipkart.rows,
      "listing",
      "flipkart"
    );

  const fkLive =
    calcParityStats(
      flipkart.rows,
      "live",
      "flipkart"
    );

  const fkMrp =
    calcParityStats(
      flipkart.rows,
      "mrp",
      "flipkart"
    );


  return {

    amazon:{
      listing:
        azListing,
      live:
        azLive,
      mrp:
        azMrp,
      suppressions:
        amazon.suppressionRows.length,
      buyBox:
        amazon.buyBoxSuppressedRows.length,
      suppressionImpact:
        amazon.summary
        .suppressionRevenueImpactPerDay
        ||
        0,
      buyBoxImpact:
        amazon.summary
        .buyBoxRevenueImpactPerDay
        ||
        0,
      listingPriceImpact:
        amazon.summary
        .listingTotalDailyRevenueImpact
        ||
        0,
      livePriceImpact:
        amazon.summary
        .liveTotalDailyRevenueImpact
        ||
        amazon.summary
        .totalDailyRevenueImpact
        ||
        0,
      priceImpact:
        amazon.summary
        .liveTotalDailyRevenueImpact
        ||
        amazon.summary
        .totalDailyRevenueImpact
        ||
        0
    },

    flipkart:{
      listing:
        fkListing,
      live:
        fkLive,
      mrp:
        fkMrp,
      noBuyBox:
        new Set(
          flipkart.rows
          .filter(
            row =>
              row.buyBoxStatus ===
              "No Buy Box"
          )
          .map(
            row =>
              row.fsn
          )
          .filter(Boolean)
        )
        .size,
      listingPriceImpact:
        flipkart.summary
        .listingTotalDailyRevenueImpact
        ||
        0,
      livePriceImpact:
        flipkart.summary
        .liveTotalDailyRevenueImpact
        ||
        flipkart.summary
        .totalDailyRevenueImpact
        ||
        0,
      noBuyBoxImpact:
        flipkart.summary
        .noBuyBoxRevenueImpactPerDay
        ||
        0,
      priceImpact:
        flipkart.summary
        .liveTotalDailyRevenueImpact
        ||
        flipkart.summary
        .totalDailyRevenueImpact
        ||
        0
    }

  };

}

function makePersistedSnapshot(date,fingerprint,amazon,flipkart){
  return {
    reportDate:date,
    schemaVersion:PROCESSING_SCHEMA_VERSION,
    fingerprint,
    insights:buildSnapshotInsights(amazon,flipkart),
    amazonSummary:amazon.summary,
    flipkartSummary:flipkart.summary,
    flipkartOrderPeriod:flipkart.orderPeriod || null,
    amazonRows:amazon.rows.map(compactAmazonRow),
    amazonSuppressions:amazon.suppressionRows.map(compactAmazonIssueRow),
    amazonBuyBox:amazon.buyBoxSuppressedRows.map(compactAmazonIssueRow),
    flipkartRows:flipkart.rows.map(compactFlipkartRow)
  };
}

function hydrateSnapshot(snapshot){
  const amazonRows = (snapshot.amazonRows||[]).map(row=>Array.isArray(row)?expandAmazonRow(row):row);
  const suppressionRows = (snapshot.amazonSuppressions||[]).map(row=>Array.isArray(row)?expandAmazonIssueRow(row):row);
  const buyBoxRows = (snapshot.amazonBuyBox||[]).map(row=>Array.isArray(row)?expandAmazonIssueRow(row):row);
  const flipkartRows = (snapshot.flipkartRows||[]).map(row=>Array.isArray(row)?expandFlipkartRow(row):row);
  const amazonSummary = snapshot.amazonSummary || {};
  const flipkartSummary = snapshot.flipkartSummary || {};
  window.amazonPriceDisparityResult = {
    rows:amazonRows,
    listingPriceDisparityRows:amazonRows.filter(r=>r.listingPriceDisparity),
    livePriceDisparityRows:amazonRows.filter(r=>r.livePriceDisparity),
    mrpDisparityRows:amazonRows.filter(r=>r.mrpDisparity),
    suppressionRows,
    buyBoxSuppressedRows:buyBoxRows,
    summary:amazonSummary
  };
  window.flipkartPriceDisparityResult = {
    rows:flipkartRows,
    listingPriceDisparityRows:flipkartRows.filter(r=>r.listingPriceDisparity),
    livePriceDisparityRows:flipkartRows.filter(r=>r.livePriceDisparity),
    mrpDisparityRows:flipkartRows.filter(r=>r.mrpDisparity),
    summary:flipkartSummary,
    orderPeriod:snapshot.flipkartOrderPeriod || null
  };
  renderFinalDashboard(snapshot);
}

async function maybeAutoProcessCurrentDate(){
  const date = getSelectedReportDate();
  if(!date || processingLock){ return; }
  if(!window.masterPricingAmazon || !window.masterPricingFlipkart){ return; }
  if(!reportsAllSameDate(date)){ return; }
  if(typeof window.saveDailySnapshot !== "function"){ return; }

  const fingerprint = buildInputFingerprint(date);
  processingLock = true;
  try{
    setUploadStatus("All required reports are ready. Processing...","success");
    const existing = await window.getDailySnapshotMeta(date);
    if(existing?.status === "completed" && existing?.fingerprint === fingerprint){
      const saved = await window.loadDailySnapshot(date);
      snapshotCache.set(date,saved);
      hydrateSnapshot(saved);
      setUploadStatus(`All 7 reports ready. ${date} is already processed.`,"success");
      return;
    }

    const amazon = buildAmazonPriceDisparity();
    const flipkart = buildFlipkartPriceDisparity();
    const snapshot = makePersistedSnapshot(date,fingerprint,amazon,flipkart);
    const savedMeta = await window.saveDailySnapshot(date,snapshot);
    snapshot.revision = savedMeta.revision;
    snapshotCache.set(date,snapshot);
    hydrateSnapshot(snapshot);
    setUploadStatus(`7 / 7 Ready · ${date} processed and stored.`,"success");
  }catch(error){
    console.error("Automatic processing failed",error);
    setUploadStatus("Automatic processing failed: " + error.message,"error");
  }finally{
    processingLock = false;
    updateReadiness();
  }
}

/* Wrap the proven upload function. */
const coreUploadData = uploadData;
uploadData = async function(){
  const date = document.getElementById("reportDate")?.value;
  if(date && currentSessionDate !== date){
    await restoreSessionForDate(date);
  }
  const menu = document.getElementById("menu")?.value;
  const folder = document.getElementById("folder")?.value;
  const config = getSelectedConfig(menu,folder);
  await coreUploadData();
  if(date && config?.id && window.wakeSuiteSessionReports?.[config.id]?.reportDate === date){
    const sessionRecord = window.wakeSuiteSessionReports[config.id];
    sessionRecord.fileName = sessionRecord.parsedFile?.fileName || "";
    sessionRecord.fileSize = sessionRecord.parsedFile?.fileSize || 0;
    sessionRecord.lastModified = document.getElementById("file")?.files?.[0]?.lastModified || 0;
    await persistCurrentUploadedReport(date,config.id);
    updateReadiness();
    await maybeAutoProcessCurrentDate();
  }
};

const coreLoadAllMasterPricing = loadAllMasterPricing;
loadAllMasterPricing = async function(){
  const result = await coreLoadAllMasterPricing();
  updateReadiness();
  await maybeAutoProcessCurrentDate();
  return result;
};

/* ---------- Dashboard ---------- */

let dashboardLoadedSnapshots = [];


function dashboardCategoryMatches(
  row,
  category
){

  return (
    category ===
    "all"
    ||
    String(
      row?.category
      ||
      ""
    ) ===
    category
  );

}


function getSnapshotAmazonRows(snapshot){

  return (
    snapshot?.amazonRows
    ||
    []
  )
  .map(
    row =>
      Array.isArray(row)
      ?
      expandAmazonRow(row)
      :
      row
  );

}


function getSnapshotFlipkartRows(snapshot){

  return (
    snapshot?.flipkartRows
    ||
    []
  )
  .map(
    row =>
      Array.isArray(row)
      ?
      expandFlipkartRow(row)
      :
      row
  );

}


function getSnapshotAmazonIssueRows(
  snapshot,
  key
){

  return (
    snapshot?.[key]
    ||
    []
  )
  .map(
    row =>
      Array.isArray(row)
      ?
      expandAmazonIssueRow(row)
      :
      row
  );

}


function completedPeriodCaption(
  period,
  anchor,
  snapshotCount
){

  if(
    period ===
    "weekly"
  ){

    const [
      start,
      end
    ] =
      getWeekBounds(
        anchor
      );

    return `Week · ${start} to ${end} · ${snapshotCount} completed day${snapshotCount === 1 ? "" : "s"}`;

  }


  if(
    period ===
    "monthly"
  ){

    return `Month · ${anchor.slice(0,7)} · ${snapshotCount} completed day${snapshotCount === 1 ? "" : "s"}`;

  }


  return snapshotCount
    ?
    `Daily · ${anchor}`
    :
    `Daily · ${anchor} · No completed snapshot`;

}


function dashboardImpactCaption(
  period
){

  return period ===
    "daily"
    ?
    "Rev Impact / Day"
    :
    "Revenue Exposure";

}


function populateCategorySelectFromRows(
  select,
  rows,
  preserveValue = "all"
){

  if(!select){
    return;
  }

  const categories =
    Array.from(
      new Set(
        rows
        .map(
          row =>
            String(
              row?.category
              ||
              ""
            )
            .trim()
        )
        .filter(Boolean)
      )
    )
    .sort(
      (a,b) =>
        a.localeCompare(b)
    );


  select.innerHTML =
    `<option value="all">All Categories</option>`
    +
    categories
    .map(
      category =>
        `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
    )
    .join("");


  if(
    preserveValue !==
    "all"
    &&
    categories.includes(
      preserveValue
    )
  ){

    select.value =
      preserveValue;

  }
  else{

    select.value =
      "all";

  }

}


function uniqueIdentifierCount(
  rows,
  key
){

  return new Set(
    rows
    .map(
      row =>
        String(
          row?.[key]
          ||
          ""
        )
    )
    .filter(Boolean)
  )
  .size;

}


function parityStatsForDashboard(
  rows,
  kind,
  marketplace
){

  return calcParityStats(
    rows,
    kind,
    marketplace
  );

}


async function getSnapshotsForSelectedPeriod(
  period,
  anchor
){

  if(
    typeof window.listDailySnapshotMetas !==
    "function"
  ){
    return [];
  }


  const metas =
    filterMetasForPeriod(
      (
        await window
        .listDailySnapshotMetas()
      )
      .filter(
        meta =>
          meta.status ===
          "completed"
      ),
      period,
      anchor
    )
    .sort(
      (a,b) =>
        a.reportDate
        .localeCompare(
          b.reportDate
        )
    );


  const snapshots = [];


  for(
    const meta
    of metas
  ){

    const snapshot =
      await loadSnapshotCached(
        meta.reportDate
      );

    if(snapshot){
      snapshots.push(
        snapshot
      );
    }

  }


  return snapshots;

}


function renderDashboardFromSnapshots(
  snapshots,
  period,
  anchor,
  category
){

  const amazonRows = [];

  const flipkartRows = [];

  const amazonSuppressionRows = [];

  const amazonBuyBoxRows = [];


  snapshots.forEach(
    snapshot => {

      getSnapshotAmazonRows(
        snapshot
      )
      .forEach(
        row =>
          amazonRows.push(
            {
              ...row,
              reportDate:
                snapshot.reportDate
            }
          )
      );


      getSnapshotFlipkartRows(
        snapshot
      )
      .forEach(
        row =>
          flipkartRows.push(
            {
              ...row,
              reportDate:
                snapshot.reportDate
            }
          )
      );


      getSnapshotAmazonIssueRows(
        snapshot,
        "amazonSuppressions"
      )
      .forEach(
        row =>
          amazonSuppressionRows.push(
            {
              ...row,
              reportDate:
                snapshot.reportDate
            }
          )
      );


      getSnapshotAmazonIssueRows(
        snapshot,
        "amazonBuyBox"
      )
      .forEach(
        row =>
          amazonBuyBoxRows.push(
            {
              ...row,
              reportDate:
                snapshot.reportDate
            }
          )
      );

    }
  );


  const filteredAmazon =
    amazonRows
    .filter(
      row =>
        dashboardCategoryMatches(
          row,
          category
        )
    );

  const filteredFlipkart =
    flipkartRows
    .filter(
      row =>
        dashboardCategoryMatches(
          row,
          category
        )
    );

  const filteredSuppressions =
    amazonSuppressionRows
    .filter(
      row =>
        dashboardCategoryMatches(
          row,
          category
        )
    );

  const filteredAmazonBuyBox =
    amazonBuyBoxRows
    .filter(
      row =>
        dashboardCategoryMatches(
          row,
          category
        )
    );


  const azListing =
    parityStatsForDashboard(
      filteredAmazon,
      "listing",
      "amazon"
    );

  const azLive =
    parityStatsForDashboard(
      filteredAmazon,
      "live",
      "amazon"
    );

  const azMrp =
    parityStatsForDashboard(
      filteredAmazon,
      "mrp",
      "amazon"
    );

  const fkListing =
    parityStatsForDashboard(
      filteredFlipkart,
      "listing",
      "flipkart"
    );

  const fkLive =
    parityStatsForDashboard(
      filteredFlipkart,
      "live",
      "flipkart"
    );

  const fkMrp =
    parityStatsForDashboard(
      filteredFlipkart,
      "mrp",
      "flipkart"
    );


  const amazonPriceImpact =
    filteredAmazon
    .reduce(
      (sum,row) =>
        sum +
        Number(
          row.liveDailyRevenueImpact
          ||
          row.dailyRevenueImpact
          ||
          0
        ),
      0
    );

  const amazonSuppressionImpact =
    filteredSuppressions
    .reduce(
      (sum,row) =>
        sum +
        Number(
          row.revenueImpactPerDay
          ||
          0
        ),
      0
    );

  const amazonBuyBoxImpact =
    filteredAmazonBuyBox
    .reduce(
      (sum,row) =>
        sum +
        Number(
          row.revenueImpactPerDay
          ||
          0
        ),
      0
    );

  const flipkartPriceImpact =
    filteredFlipkart
    .reduce(
      (sum,row) =>
        sum +
        Number(
          row.liveDailyRevenueImpact
          ||
          row.dailyRevenueImpact
          ||
          0
        ),
      0
    );

  const flipkartBuyBoxRows =
    filteredFlipkart
    .filter(
      row =>
        row.buyBoxStatus ===
        "No Buy Box"
    );

  const flipkartBuyBoxImpact =
    flipkartBuyBoxRows
    .reduce(
      (sum,row) =>
        sum +
        Number(
          row.buyBoxRevenueImpactPerDay
          ||
          0
        ),
      0
    );


  finalSetText(
    "amazonLiveParityPercent",
    formatPercent(
      azLive.parityPct
      ||
      0
    )
  );

  finalSetText(
    "amazonLiveParityPercent2",
    formatPercent(
      azLive.parityPct
      ||
      0
    )
  );

  finalSetText(
    "amazonLiveDisparityCount",
    formatNumber(
      azLive.disparity
      ||
      0
    )
  );

  finalSetText(
    "amazonSuppressedCount",
    formatNumber(
      period ===
      "daily"
      ?
      filteredSuppressions.length
      :
      uniqueIdentifierCount(
        filteredSuppressions,
        "asin"
      )
    )
  );

  finalSetText(
    "amazonBuyBoxSuppressedCount",
    formatNumber(
      period ===
      "daily"
      ?
      filteredAmazonBuyBox.length
      :
      uniqueIdentifierCount(
        filteredAmazonBuyBox,
        "asin"
      )
    )
  );


  finalSetText(
    "flipkartLiveParityPercent",
    formatPercent(
      fkLive.parityPct
      ||
      0
    )
  );

  finalSetText(
    "flipkartLiveParityPercent2",
    formatPercent(
      fkLive.parityPct
      ||
      0
    )
  );

  finalSetText(
    "flipkartLiveDisparityCount",
    formatNumber(
      fkLive.disparity
      ||
      0
    )
  );

  finalSetText(
    "flipkartNoBuyBoxCount",
    formatNumber(
      period ===
      "daily"
      ?
      uniqueIdentifierCount(
        flipkartBuyBoxRows,
        "fsn"
      )
      :
      uniqueIdentifierCount(
        flipkartBuyBoxRows,
        "fsn"
      )
    )
  );


  finalSetText(
    "amazonListingParityPercent",
    formatPercent(
      azListing.parityPct
      ||
      0
    )
  );

  finalSetText(
    "amazonMrpParityPercent",
    formatPercent(
      azMrp.parityPct
      ||
      0
    )
  );

  finalSetText(
    "flipkartListingParityPercent",
    formatPercent(
      fkListing.parityPct
      ||
      0
    )
  );

  finalSetText(
    "flipkartMrpParityPercent",
    formatPercent(
      fkMrp.parityPct
      ||
      0
    )
  );


  finalSetText(
    "amazonPriceImpact",
    formatINR(
      amazonPriceImpact
    )
  );

  finalSetText(
    "amazonSuppressionImpact",
    formatINR(
      amazonSuppressionImpact
    )
  );

  finalSetText(
    "amazonBuyBoxImpact",
    formatINR(
      amazonBuyBoxImpact
    )
  );

  finalSetText(
    "flipkartPriceImpact",
    formatINR(
      flipkartPriceImpact
    )
  );

  finalSetText(
    "flipkartBuyBoxImpact",
    formatINR(
      flipkartBuyBoxImpact
    )
  );

  finalSetText(
    "combinedDailyImpact",
    formatINR(
      amazonPriceImpact
      +
      flipkartPriceImpact
    )
  );


  const impactCaption =
    dashboardImpactCaption(
      period
    );

  [
    "amazonPriceImpactLabel",
    "amazonSuppressionImpactLabel",
    "amazonBuyBoxImpactLabel",
    "flipkartPriceImpactLabel",
    "flipkartBuyBoxImpactLabel"
  ]
  .forEach(
    id =>
      finalSetText(
        id,
        impactCaption
      )
  );


  finalSetText(
    "combinedImpactLabel",
    period ===
    "daily"
    ?
    "Amazon + Flipkart / Day"
    :
    "Amazon + Flipkart Exposure"
  );


  finalSetText(
    "dashboardPeriodLabel",
    period
  );


  const categoryText =
    category ===
    "all"
    ?
    "All Categories"
    :
    category;


  finalSetText(
    "dashboardStatusText",
    `${completedPeriodCaption(period,anchor,snapshots.length)} · ${categoryText}`
  );

}


async function loadDashboardOverview(){

  const period =
    document
    .getElementById(
      "dashboardPeriod"
    )
    ?.value
    ||
    "daily";

  const dateInput =
    document
    .getElementById(
      "dashboardDate"
    );

  const anchor =
    dateInput
    ?.value
    ||
    todayIso();

  const categorySelect =
    document
    .getElementById(
      "dashboardCategory"
    );

  const existingCategory =
    categorySelect
    ?.value
    ||
    "all";


  const snapshots =
    await getSnapshotsForSelectedPeriod(
      period,
      anchor
    );

  dashboardLoadedSnapshots =
    snapshots;


  const allRows =
    snapshots.flatMap(
      snapshot => [
        ...getSnapshotAmazonRows(
          snapshot
        ),
        ...getSnapshotFlipkartRows(
          snapshot
        )
      ]
    );


  populateCategorySelectFromRows(
    categorySelect,
    allRows,
    existingCategory
  );


  const category =
    categorySelect
    ?.value
    ||
    "all";


  renderDashboardFromSnapshots(
    snapshots,
    period,
    anchor,
    category
  );


  /*
    Do not allow a stale product lookup to remain visible
    after period/date/category changes.
  */
  clearDashboardSearch(
    false
  );

}


function renderFinalDashboard(snapshot){

  const date =
    snapshot?.reportDate
    ||
    "";


  if(date){

    finalSetText(
      "latestCompletedDateDisplay",
      `As of ${date}`
    );


    const dashboardDate =
      document
      .getElementById(
        "dashboardDate"
      );

    if(
      dashboardDate
      &&
      !dashboardDate.value
    ){
      dashboardDate.value =
        date;
    }

  }


  /*
    Immediate daily render from the hydrated snapshot.
    The asynchronous period-aware render follows below.
  */
  if(snapshot){

    renderDashboardFromSnapshots(
      [snapshot],
      "daily",
      date,
      "all"
    );

  }


  Promise.resolve()
  .then(
    () =>
      loadDashboardOverview()
  )
  .catch(
    error =>
      console.warn(
        "Dashboard refresh failed",
        error
      )
  );

}


function dashboardSearchMatchScore(
  values,
  query
){

  const normalizedQuery =
    String(
      query
      ||
      ""
    )
    .trim()
    .toUpperCase();


  if(!normalizedQuery){
    return null;
  }


  const normalizedValues =
    values
    .map(
      value =>
        String(
          value
          ||
          ""
        )
        .trim()
        .toUpperCase()
    )
    .filter(Boolean);


  if(
    normalizedValues.some(
      value =>
        value ===
        normalizedQuery
    )
  ){
    return 0;
  }


  if(
    normalizedValues.some(
      value =>
        value.startsWith(
          normalizedQuery
        )
    )
  ){
    return 1;
  }


  if(
    normalizedValues.some(
      value =>
        value.includes(
          normalizedQuery
        )
    )
  ){
    return 2;
  }


  return null;

}


function buildDashboardSearchRows(
  snapshots,
  query,
  category
){

  const results = [];


  snapshots.forEach(
    snapshot => {

      const suppressionMap =
        new Map(
          getSnapshotAmazonIssueRows(
            snapshot,
            "amazonSuppressions"
          )
          .map(
            row => [
              row.asin,
              row
            ]
          )
        );

      const buyBoxMap =
        new Map(
          getSnapshotAmazonIssueRows(
            snapshot,
            "amazonBuyBox"
          )
          .map(
            row => [
              row.asin,
              row
            ]
          )
        );


      getSnapshotAmazonRows(
        snapshot
      )
      .forEach(
        row => {

          if(
            !dashboardCategoryMatches(
              row,
              category
            )
          ){
            return;
          }


          const score =
            dashboardSearchMatchScore(
              [
                row.asin,
                row.wfSku,
                row.azSku
              ],
              query
            );


          if(
            score ===
            null
          ){
            return;
          }


          results.push({
            score,
            marketplace:
              "Amazon",
            reportDate:
              snapshot.reportDate,
            category:
              row.category,
            wfSku:
              row.wfSku,
            marketplaceSku:
              row.azSku,
            productId:
              row.asin,
            listingPrice:
              row.listingPrice,
            livePrice:
              row.finalLivePrice,
            listingStatus:
              row.listingPriceDisparity
              ?
              "Disparity"
              :
              "Parity",
            liveStatus:
              row.eligibleForComparison
              ?
              (
                row.livePriceDisparity
                ?
                "Disparity"
                :
                "Parity"
              )
              :
              "N/A",
            issue:
              row.suppressionStatus ===
              "Suppressed"
              ?
              "ASIN Suppressed"
              :
              (
                row.buyBoxStatus ===
                "Buy Box Suppressed"
                ?
                "Buy Box Suppressed"
                :
                "—"
              ),
            priceImpact:
              Number(
                row.liveDailyRevenueImpact
                ||
                row.dailyRevenueImpact
                ||
                0
              ),
            suppressionImpact:
              (
                !suppressionMap
                .get(
                  row.asin
                )
                ||
                !suppressionMap
                .get(
                  row.asin
                )
                ?.azSku
                ||
                suppressionMap
                .get(
                  row.asin
                )
                ?.azSku ===
                row.azSku
              )
              ?
              Number(
                suppressionMap
                .get(
                  row.asin
                )
                ?.revenueImpactPerDay
                ||
                0
              )
              :
              0,
            buyBoxImpact:
              (
                !buyBoxMap
                .get(
                  row.asin
                )
                ||
                !buyBoxMap
                .get(
                  row.asin
                )
                ?.azSku
                ||
                buyBoxMap
                .get(
                  row.asin
                )
                ?.azSku ===
                row.azSku
              )
              ?
              Number(
                buyBoxMap
                .get(
                  row.asin
                )
                ?.revenueImpactPerDay
                ||
                0
              )
              :
              0
          });

        }
      );


      getSnapshotFlipkartRows(
        snapshot
      )
      .forEach(
        row => {

          if(
            !dashboardCategoryMatches(
              row,
              category
            )
          ){
            return;
          }


          const score =
            dashboardSearchMatchScore(
              [
                row.fsn,
                row.wfSku,
                row.fkSku
              ],
              query
            );


          if(
            score ===
            null
          ){
            return;
          }


          results.push({
            score,
            marketplace:
              "Flipkart",
            reportDate:
              snapshot.reportDate,
            category:
              row.category,
            wfSku:
              row.wfSku,
            marketplaceSku:
              row.fkSku,
            productId:
              row.fsn,
            listingPrice:
              row.listingPrice,
            livePrice:
              row.finalLivePrice,
            listingStatus:
              row.listingPriceDisparity
              ?
              "Disparity"
              :
              "Parity",
            liveStatus:
              row.eligibleForComparison
              ?
              (
                row.livePriceDisparity
                ?
                "Disparity"
                :
                "Parity"
              )
              :
              "N/A",
            issue:
              row.buyBoxStatus ===
              "No Buy Box"
              ?
              "Buy Box Unavailable"
              :
              "—",
            priceImpact:
              Number(
                row.liveDailyRevenueImpact
                ||
                row.dailyRevenueImpact
                ||
                0
              ),
            suppressionImpact:
              0,
            buyBoxImpact:
              Number(
                row.buyBoxRevenueImpactPerDay
                ||
                0
              )
          });

        }
      );

    }
  );


  return results
  .sort(
    (a,b) =>
      a.score -
      b.score
      ||
      String(
        b.reportDate
      )
      .localeCompare(
        String(
          a.reportDate
        )
      )
      ||
      String(
        a.marketplace
      )
      .localeCompare(
        String(
          b.marketplace
        )
      )
  );

}


function summarizeDashboardSearchRows(
  rows
){

  const groups =
    new Map();


  rows.forEach(
    row => {

      const key =
        [
          row.marketplace,
          row.productId,
          row.wfSku,
          row.marketplaceSku
        ]
        .join(
          "||"
        );


      if(
        !groups.has(
          key
        )
      ){

        groups.set(
          key,
          {
            marketplace:
              row.marketplace,
            category:
              row.category,
            wfSku:
              row.wfSku,
            marketplaceSku:
              row.marketplaceSku,
            productId:
              row.productId,
            score:
              row.score,
            dates:
              new Set(),
            parityDates:
              new Set(),
            disparityDates:
              new Set(),
            suppressionDates:
              new Set(),
            buyBoxDates:
              new Set(),
            priceExposure:
              0,
            suppressionExposure:
              0,
            buyBoxExposure:
              0
          }
        );

      }


      const group =
        groups.get(
          key
        );


      group.score =
        Math.min(
          group.score,
          row.score
        );


      group.dates.add(
        row.reportDate
      );


      if(
        row.liveStatus ===
        "Parity"
      ){

        group.parityDates.add(
          row.reportDate
        );

      }


      if(
        row.liveStatus ===
        "Disparity"
      ){

        group.disparityDates.add(
          row.reportDate
        );

      }


      if(
        row.issue ===
        "ASIN Suppressed"
        ||
        Number(
          row.suppressionImpact
          ||
          0
        ) > 0
      ){

        group.suppressionDates.add(
          row.reportDate
        );

      }


      if(
        row.issue ===
        "Buy Box Suppressed"
        ||
        row.issue ===
        "Buy Box Unavailable"
        ||
        Number(
          row.buyBoxImpact
          ||
          0
        ) > 0
      ){

        group.buyBoxDates.add(
          row.reportDate
        );

      }


      group.priceExposure +=
        Number(
          row.priceImpact
          ||
          0
        );

      group.suppressionExposure +=
        Number(
          row.suppressionImpact
          ||
          0
        );

      group.buyBoxExposure +=
        Number(
          row.buyBoxImpact
          ||
          0
        );

    }
  );


  return Array.from(
    groups.values()
  )
  .sort(
    (a,b) =>
      a.score -
      b.score
      ||
      (
        b.priceExposure
        +
        b.suppressionExposure
        +
        b.buyBoxExposure
      )
      -
      (
        a.priceExposure
        +
        a.suppressionExposure
        +
        a.buyBoxExposure
      )
  );

}


function renderDashboardSearchResults(
  rows,
  period = "daily"
){

  const panel =
    document
    .getElementById(
      "dashboardSearchResults"
    );

  const table =
    document
    .getElementById(
      "dashboardSearchTable"
    );


  if(
    !panel ||
    !table
  ){
    return;
  }


  panel.hidden =
    false;


  if(
    period !==
    "daily"
  ){

    const summarized =
      summarizeDashboardSearchRows(
        rows
      );


    finalSetText(
      "dashboardSearchCount",
      `${summarized.length} product${summarized.length === 1 ? "" : "s"}`
    );


    if(
      !summarized.length
    ){

      table.innerHTML =
        `<tbody><tr><td class="empty-row">No matching ASIN, FSN or SKU</td></tr></tbody>`;

      return;

    }


    let html =
      `<thead><tr>
        <th>Marketplace</th>
        <th>Category</th>
        <th>WF SKU</th>
        <th>Marketplace SKU</th>
        <th>ASIN / FSN</th>
        <th>Completed Days</th>
        <th>Parity Days</th>
        <th>Disparity Days</th>
        <th>Suppression Days</th>
        <th>Buy Box Days</th>
        <th>Price Revenue Exposure</th>
        <th>Suppression Exposure</th>
        <th>Buy Box Exposure</th>
      </tr></thead><tbody>`;


    summarized
    .slice(
      0,
      500
    )
    .forEach(
      row => {

        html +=
          `<tr>
            <td>${escapeHtml(row.marketplace)}</td>
            <td>${escapeHtml(row.category||"")}</td>
            <td>${escapeHtml(row.wfSku||"")}</td>
            <td>${escapeHtml(row.marketplaceSku||"")}</td>
            <td>${escapeHtml(row.productId||"")}</td>
            <td>${formatNumber(row.dates.size)}</td>
            <td class="parity">${formatNumber(row.parityDates.size)}</td>
            <td class="disparity">${formatNumber(row.disparityDates.size)}</td>
            <td>${formatNumber(row.suppressionDates.size)}</td>
            <td>${formatNumber(row.buyBoxDates.size)}</td>
            <td>${escapeHtml(formatINR(row.priceExposure||0))}</td>
            <td>${escapeHtml(formatINR(row.suppressionExposure||0))}</td>
            <td>${escapeHtml(formatINR(row.buyBoxExposure||0))}</td>
          </tr>`;

      }
    );


    html +=
      "</tbody>";


    table.innerHTML =
      html;


    return;

  }


  finalSetText(
    "dashboardSearchCount",
    `${rows.length} result${rows.length === 1 ? "" : "s"}`
  );


  if(
    !rows.length
  ){

    table.innerHTML =
      `<tbody><tr><td class="empty-row">No matching ASIN, FSN or SKU</td></tr></tbody>`;

    return;

  }


  const visible =
    rows.slice(
      0,
      500
    );


  let html =
    `<thead><tr>
      <th>Marketplace</th>
      <th>Date</th>
      <th>Category</th>
      <th>WF SKU</th>
      <th>Marketplace SKU</th>
      <th>ASIN / FSN</th>
      <th>Listing Price</th>
      <th>Live Price</th>
      <th>Listing Status</th>
      <th>Live Status</th>
      <th>Issue</th>
      <th>Price Impact / Day</th>
      <th>Suppression Impact / Day</th>
      <th>Buy Box Impact / Day</th>
    </tr></thead><tbody>`;


  visible.forEach(
    row => {

      html +=
        `<tr>
          <td>${escapeHtml(row.marketplace)}</td>
          <td>${escapeHtml(row.reportDate)}</td>
          <td>${escapeHtml(row.category||"")}</td>
          <td>${escapeHtml(row.wfSku||"")}</td>
          <td>${escapeHtml(row.marketplaceSku||"")}</td>
          <td>${escapeHtml(row.productId||"")}</td>
          <td>${escapeHtml(formatINR(row.listingPrice||0))}</td>
          <td>${row.livePrice ? escapeHtml(formatINR(row.livePrice)) : "—"}</td>
          <td class="${row.listingStatus === "Parity" ? "parity" : "disparity"}">${escapeHtml(row.listingStatus)}</td>
          <td class="${row.liveStatus === "Parity" ? "parity" : row.liveStatus === "Disparity" ? "disparity" : ""}">${escapeHtml(row.liveStatus)}</td>
          <td>${escapeHtml(row.issue)}</td>
          <td>${escapeHtml(formatINR(row.priceImpact||0))}</td>
          <td>${escapeHtml(formatINR(row.suppressionImpact||0))}</td>
          <td>${escapeHtml(formatINR(row.buyBoxImpact||0))}</td>
        </tr>`;

    }
  );


  html +=
    "</tbody>";


  table.innerHTML =
    html;

}


async function runDashboardSearch(){

  const input =
    document
    .getElementById(
      "dashboardGlobalSearch"
    );

  const query =
    input
    ?.value
    ?.trim()
    ||
    "";


  if(!query){

    clearDashboardSearch();

    return;

  }


  if(
    !dashboardLoadedSnapshots.length
  ){

    await loadDashboardOverview();

  }


  const category =
    document
    .getElementById(
      "dashboardCategory"
    )
    ?.value
    ||
    "all";


  const rows =
    buildDashboardSearchRows(
      dashboardLoadedSnapshots,
      query,
      category
    );


  const period =
    document
    .getElementById(
      "dashboardPeriod"
    )
    ?.value
    ||
    "daily";


  renderDashboardSearchResults(
    rows,
    period
  );

}


function clearDashboardSearch(
  clearInput = true
){

  const panel =
    document
    .getElementById(
      "dashboardSearchResults"
    );

  if(panel){
    panel.hidden =
      true;
  }


  if(clearInput){

    const input =
      document
      .getElementById(
        "dashboardGlobalSearch"
      );

    if(input){
      input.value =
        "";
    }

  }

}


async function initializeWakeSuiteHistory(){

  const today =
    todayIso();

  const reportDate =
    document
    .getElementById(
      "reportDate"
    );

  const insightsDate =
    document
    .getElementById(
      "insightsDate"
    );

  const reportAnchor =
    document
    .getElementById(
      "reportAnchorDate"
    );

  const dashboardDate =
    document
    .getElementById(
      "dashboardDate"
    );


  if(
    reportDate &&
    !reportDate.value
  ){
    reportDate.value =
      today;
  }


  if(
    insightsDate &&
    !insightsDate.value
  ){
    insightsDate.value =
      today;
  }


  if(
    reportAnchor &&
    !reportAnchor.value
  ){
    reportAnchor.value =
      today;
  }


  if(
    dashboardDate &&
    !dashboardDate.value
  ){
    dashboardDate.value =
      today;
  }


  await restoreSessionForDate(
    reportDate?.value
    ||
    today
  );


  try{

    const latest =
      await window
      .getLatestCompletedSnapshot();


    if(latest){

      snapshotCache.set(
        latest.reportDate,
        latest
      );

      hydrateSnapshot(
        latest
      );


      if(insightsDate){
        insightsDate.value =
          latest.reportDate;
      }


      if(reportAnchor){
        reportAnchor.value =
          latest.reportDate;
      }


      if(dashboardDate){
        dashboardDate.value =
          latest.reportDate;
      }


      await loadDashboardOverview();

    }

  }
  catch(error){

    console.warn(
      "Historical dashboard unavailable",
      error
    );

  }


  updateReadiness();


  await maybeAutoProcessCurrentDate();

}


/* ---------- Historical report engine ---------- */

const HISTORICAL_VIEWS = {

  amazon_listing:{
    title:
      "Amazon · Listing Price Disparity",
    type:
      "price",
    marketplace:
      "amazon",
    kind:
      "listing"
  },

  amazon_live:{
    title:
      "Amazon · Live Price Disparity",
    type:
      "price",
    marketplace:
      "amazon",
    kind:
      "live"
  },

  amazon_mrp:{
    title:
      "Amazon · MRP Disparity",
    type:
      "price",
    marketplace:
      "amazon",
    kind:
      "mrp"
  },

  amazon_suppression:{
    title:
      "Amazon · ASIN Suppression",
    type:
      "suppression",
    marketplace:
      "amazon"
  },

  amazon_buybox:{
    title:
      "Amazon · Buy Box Suppression",
    type:
      "amazon_buybox",
    marketplace:
      "amazon"
  },

  flipkart_listing:{
    title:
      "Flipkart · Listing Price Disparity",
    type:
      "price",
    marketplace:
      "flipkart",
    kind:
      "listing"
  },

  flipkart_live:{
    title:
      "Flipkart · Live Price Disparity",
    type:
      "price",
    marketplace:
      "flipkart",
    kind:
      "live"
  },

  flipkart_mrp:{
    title:
      "Flipkart · MRP Disparity",
    type:
      "price",
    marketplace:
      "flipkart",
    kind:
      "mrp"
  },

  flipkart_buybox:{
    title:
      "Flipkart · Buy Box Unavailable",
    type:
      "flipkart_buybox",
    marketplace:
      "flipkart"
  }

};


function openHistoricalModule(
  viewKey
){

  currentHistoricalViewKey =
    viewKey;


  const def =
    HISTORICAL_VIEWS[
      viewKey
    ];


  finalSetText(
    "reportModuleTitle",
    def?.title
    ||
    "Report"
  );


  showView(
    "reportModuleSection"
  );


  const latestDate =
    document
    .getElementById(
      "latestCompletedDateDisplay"
    )
    ?.textContent
    ?.replace(
      "As of ",
      ""
    );


  const input =
    document
    .getElementById(
      "reportAnchorDate"
    );


  if(
    input &&
    latestDate &&
    latestDate !==
    "—"
  ){
    input.value =
      latestDate;
  }


  const category =
    document
    .getElementById(
      "reportCategory"
    );

  if(category){
    category.value =
      "all";
  }


  const search =
    document
    .getElementById(
      "reportSearch"
    );

  if(search){
    search.value =
      "";
  }


  configureReportSort(
    def,
    true
  );


  loadHistoricalModule();

}


function getWeekBounds(
  dateString
){

  const d =
    new Date(
      dateString +
      "T00:00:00"
    );

  const day =
    d.getDay();

  const delta =
    day ===
    0
    ?
    -6
    :
    1 -
    day;

  const start =
    new Date(d);

  start.setDate(
    d.getDate() +
    delta
  );

  const end =
    new Date(start);

  end.setDate(
    start.getDate() +
    6
  );


  const toIso =
    value =>
      `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`;


  return [
    toIso(start),
    toIso(end)
  ];

}


function filterMetasForPeriod(
  metas,
  period,
  anchor
){

  if(
    period ===
    "daily"
  ){

    return metas.filter(
      meta =>
        meta.reportDate ===
        anchor
    );

  }


  if(
    period ===
    "weekly"
  ){

    const [
      start,
      end
    ] =
      getWeekBounds(
        anchor
      );

    return metas.filter(
      meta =>
        meta.reportDate >=
        start
        &&
        meta.reportDate <=
        end
    );

  }


  const month =
    anchor.slice(
      0,
      7
    );


  return metas.filter(
    meta =>
      String(
        meta.reportDate
        ||
        ""
      )
      .startsWith(
        month
      )
  );

}


async function loadSnapshotCached(
  date
){

  if(
    snapshotCache.has(
      date
    )
  ){

    return snapshotCache.get(
      date
    );

  }


  const snapshot =
    await window
    .loadDailySnapshot(
      date
    );


  if(snapshot){

    snapshotCache.set(
      date,
      snapshot
    );

  }


  return snapshot;

}


function priceRowsForSnapshot(
  snapshot,
  def
){

  const source =
    def.marketplace ===
    "amazon"
    ?
    getSnapshotAmazonRows(
      snapshot
    )
    :
    getSnapshotFlipkartRows(
      snapshot
    );


  return source
  .filter(
    row => {

      if(
        def.kind ===
        "listing"
      ){

        return Number(
          row.listingPrice
        ) > 0;

      }


      if(
        def.kind ===
        "live"
      ){

        return (
          row.eligibleForComparison
          &&
          Number(
            row.finalLivePrice
          ) > 0
        );

      }


      const marketMrp =
        def.marketplace ===
        "amazon"
        ?
        row.azMrp
        :
        row.fkMrp;


      return (
        Number(
          row.wfMrp
        ) > 0
        &&
        Number(
          marketMrp
        ) > 0
      );

    }
  )
  .map(
    row => {

      const disparity =
        def.kind ===
        "listing"
        ?
        row.listingPriceDisparity
        :
        (
          def.kind ===
          "live"
          ?
          row.livePriceDisparity
          :
          row.mrpDisparity
        );


      return {
        ...row,
        reportDate:
          snapshot.reportDate,
        parityStatus:
          disparity
          ?
          "Disparity"
          :
          "Parity"
      };

    }
  );

}


function dedupeFlipkartBuyBoxRows(
  rows
){

  const map =
    new Map();


  rows.forEach(
    row => {

      if(!row.fsn){
        return;
      }


      const key =
        `${row.reportDate}||${row.fsn}`;

      const existing =
        map.get(
          key
        );


      if(
        !existing
        ||
        Number(
          row.buyBoxRevenueImpactPerDay
          ||
          0
        )
        >
        Number(
          existing.buyBoxRevenueImpactPerDay
          ||
          0
        )
        ||
        (
          Number(
            row.buyBoxRevenueImpactPerDay
            ||
            0
          ) ===
          Number(
            existing.buyBoxRevenueImpactPerDay
            ||
            0
          )
          &&
          Number(
            row.listingPrice
            ||
            Infinity
          )
          <
          Number(
            existing.listingPrice
            ||
            Infinity
          )
        )
      ){

        map.set(
          key,
          row
        );

      }

    }
  );


  return Array.from(
    map.values()
  );

}


function compileHistoricalView(
  def,
  snapshots
){

  let rows = [];


  if(
    def.type ===
    "price"
  ){

    snapshots.forEach(
      snapshot =>
        rows.push(
          ...priceRowsForSnapshot(
            snapshot,
            def
          )
        )
    );


    return {
      rows
    };

  }


  if(
    def.type ===
    "suppression"
  ){

    snapshots.forEach(
      snapshot => {

        getSnapshotAmazonIssueRows(
          snapshot,
          "amazonSuppressions"
        )
        .forEach(
          row =>
            rows.push({
              ...row,
              reportDate:
                snapshot.reportDate
            })
        );

      }
    );


    return {
      rows
    };

  }


  if(
    def.type ===
    "amazon_buybox"
  ){

    snapshots.forEach(
      snapshot => {

        getSnapshotAmazonIssueRows(
          snapshot,
          "amazonBuyBox"
        )
        .forEach(
          row =>
            rows.push({
              ...row,
              reportDate:
                snapshot.reportDate
            })
        );

      }
    );


    return {
      rows
    };

  }


  snapshots.forEach(
    snapshot => {

      getSnapshotFlipkartRows(
        snapshot
      )
      .filter(
        row =>
          row.buyBoxStatus ===
          "No Buy Box"
      )
      .forEach(
        row =>
          rows.push({
            ...row,
            reportDate:
              snapshot.reportDate
          })
      );

    }
  );


  rows =
    dedupeFlipkartBuyBoxRows(
      rows
    );


  return {
    rows
  };

}


function reportRowImpact(
  def,
  row
){

  if(
    def.type ===
    "price"
  ){

    if(
      def.kind ===
      "listing"
    ){

      return Number(
        row.listingDailyRevenueImpact
        ||
        0
      );

    }


    if(
      def.kind ===
      "live"
    ){

      return Number(
        row.liveDailyRevenueImpact
        ||
        row.dailyRevenueImpact
        ||
        0
      );

    }


    return 0;

  }


  if(
    def.type ===
    "suppression"
    ||
    def.type ===
    "amazon_buybox"
  ){

    return Number(
      row.revenueImpactPerDay
      ||
      0
    );

  }


  return Number(
    row.buyBoxRevenueImpactPerDay
    ||
    0
  );

}


function reportRowDifference(
  def,
  row
){

  if(
    def.type !==
    "price"
  ){
    return 0;
  }


  if(
    def.kind ===
    "listing"
  ){

    return Math.abs(
      Number(
        row.listingPriceDiff
        ||
        0
      )
    );

  }


  if(
    def.kind ===
    "live"
  ){

    return Math.abs(
      Number(
        row.livePriceDiff
        ||
        0
      )
    );

  }


  return Math.abs(
    Number(
      row.mrpDiff
      ||
      0
    )
  );

}


function reportRowSearchValues(
  def,
  row
){

  if(
    def.marketplace ===
    "amazon"
  ){

    return [
      row.asin,
      row.wfSku,
      row.azSku,
      row.category
    ];

  }


  return [
    row.fsn,
    row.wfSku,
    row.fkSku,
    row.category
  ];

}


function reportRowIdentifier(
  def,
  row
){

  if(
    def.marketplace ===
    "amazon"
  ){

    return (
      row.asin
      ||
      row.azSku
      ||
      row.wfSku
      ||
      ""
    );

  }


  return (
    row.fsn
    ||
    row.fkSku
    ||
    row.wfSku
    ||
    ""
  );

}


function configureReportSort(
  def,
  reset = false
){

  const select =
    document
    .getElementById(
      "reportSort"
    );

  if(
    !select ||
    !def
  ){
    return;
  }


  const previous =
    reset
    ?
    ""
    :
    select.value;


  let options;


  if(
    def.type !==
    "price"
  ){

    options = [
      [
        "impact_desc",
        "Revenue Impact · High to Low"
      ],
      [
        "impact_asc",
        "Revenue Impact · Low to High"
      ],
      [
        "category_asc",
        "Category · A to Z"
      ],
      [
        "identifier_asc",
        "Identifier · A to Z"
      ]
    ];

  }
  else if(
    def.kind ===
    "mrp"
  ){

    options = [
      [
        "diff_desc",
        "Difference · High to Low"
      ],
      [
        "category_asc",
        "Category · A to Z"
      ],
      [
        "identifier_asc",
        "Identifier · A to Z"
      ]
    ];

  }
  else{

    options = [
      [
        "impact_desc",
        "Revenue Impact · High to Low"
      ],
      [
        "impact_asc",
        "Revenue Impact · Low to High"
      ],
      [
        "diff_desc",
        "Difference · High to Low"
      ],
      [
        "category_asc",
        "Category · A to Z"
      ],
      [
        "identifier_asc",
        "Identifier · A to Z"
      ]
    ];

  }


  select.innerHTML =
    options
    .map(
      ([value,label]) =>
        `<option value="${value}">${label}</option>`
    )
    .join("");


  if(
    previous
    &&
    options.some(
      ([value]) =>
        value ===
        previous
    )
  ){

    select.value =
      previous;

  }
  else{

    select.value =
      options[0][0];

  }

}


function applyReportFiltersToRows(
  def,
  rows
){

  const category =
    document
    .getElementById(
      "reportCategory"
    )
    ?.value
    ||
    "all";

  const query =
    document
    .getElementById(
      "reportSearch"
    )
    ?.value
    ?.trim()
    .toUpperCase()
    ||
    "";

  const sort =
    document
    .getElementById(
      "reportSort"
    )
    ?.value
    ||
    "impact_desc";


  let filtered =
    rows
    .filter(
      row =>
        category ===
        "all"
        ||
        String(
          row.category
          ||
          ""
        ) ===
        category
    );


  if(query){

    filtered =
      filtered
      .filter(
        row =>
          reportRowSearchValues(
            def,
            row
          )
          .some(
            value =>
              String(
                value
                ||
                ""
              )
              .toUpperCase()
              .includes(
                query
              )
          )
      );

  }


  filtered =
    [...filtered]
    .sort(
      (a,b) => {

        if(
          sort ===
          "impact_desc"
        ){

          return (
            reportRowImpact(
              def,
              b
            )
            -
            reportRowImpact(
              def,
              a
            )
          );

        }


        if(
          sort ===
          "impact_asc"
        ){

          return (
            reportRowImpact(
              def,
              a
            )
            -
            reportRowImpact(
              def,
              b
            )
          );

        }


        if(
          sort ===
          "diff_desc"
        ){

          return (
            reportRowDifference(
              def,
              b
            )
            -
            reportRowDifference(
              def,
              a
            )
          );

        }


        if(
          sort ===
          "category_asc"
        ){

          return String(
            a.category
            ||
            ""
          )
          .localeCompare(
            String(
              b.category
              ||
              ""
            )
          );

        }


        return String(
          reportRowIdentifier(
            def,
            a
          )
        )
        .localeCompare(
          String(
            reportRowIdentifier(
              def,
              b
            )
          )
        );

      }
    );


  return filtered;

}


function makeReportSummary(
  def,
  rows
){

  const categories =
    new Set(
      rows
      .map(
        row =>
          row.category
      )
      .filter(Boolean)
    )
    .size;

  const dates =
    new Set(
      rows
      .map(
        row =>
          row.reportDate
      )
      .filter(Boolean)
    )
    .size;


  if(
    def.type ===
    "price"
  ){

    const parity =
      rows.filter(
        row =>
          row.parityStatus ===
          "Parity"
      )
      .length;

    const disparity =
      rows.length -
      parity;

    const impact =
      rows.reduce(
        (sum,row) =>
          sum +
          reportRowImpact(
            def,
            row
          ),
        0
      );


    if(
      def.kind ===
      "mrp"
    ){

      return [
        {
          label:
            "Eligible",
          value:
            rows.length,
          type:
            "number"
        },
        {
          label:
            "Parity",
          value:
            parity,
          type:
            "number"
        },
        {
          label:
            "Disparity",
          value:
            disparity,
          type:
            "number"
        },
        {
          label:
            "Parity %",
          value:
            rows.length
            ?
            parity /
            rows.length
            :
            0,
          type:
            "percent"
        },
        {
          label:
            "Disparity %",
          value:
            rows.length
            ?
            disparity /
            rows.length
            :
            0,
          type:
            "percent"
        },
        {
          label:
            "Categories",
          value:
            categories,
          type:
            "number"
        }
      ];

    }


    return [
      {
        label:
          "Eligible",
        value:
          rows.length,
        type:
          "number"
      },
      {
        label:
          "Parity",
        value:
          parity,
        type:
          "number"
      },
      {
        label:
          "Disparity",
        value:
          disparity,
        type:
          "number"
      },
      {
        label:
          "Parity %",
        value:
          rows.length
          ?
          parity /
          rows.length
          :
          0,
        type:
          "percent"
      },
      {
        label:
          "Disparity %",
        value:
          rows.length
          ?
          disparity /
          rows.length
          :
          0,
        type:
          "percent"
      },
      {
        label:
          "Revenue Impact",
        value:
          impact,
        type:
          "money"
      }
    ];

  }


  const idKey =
    def.marketplace ===
    "amazon"
    ?
    "asin"
    :
    "fsn";

  const uniqueIssues =
    uniqueIdentifierCount(
      rows,
      idKey
    );

  const exposure =
    rows.reduce(
      (sum,row) =>
        sum +
        reportRowImpact(
          def,
          row
        ),
      0
    );


  return [
    {
      label:
        def.marketplace ===
        "amazon"
        ?
        "Unique ASINs"
        :
        "Unique FSNs",
      value:
        uniqueIssues,
      type:
        "number"
    },
    {
      label:
        def.type ===
        "suppression"
        ?
        "Suppression Days"
        :
        (
          def.type ===
          "amazon_buybox"
          ?
          "Buy Box Days"
          :
          "No Buy Box Days"
        ),
      value:
        rows.length,
      type:
        "number"
    },
    {
      label:
        "Avg / Day",
      value:
        dates
        ?
        rows.length /
        dates
        :
        0,
      type:
        "decimal"
    },
    {
      label:
        "Revenue Exposure",
      value:
        exposure,
      type:
        "money"
    },
    {
      label:
        "Categories",
      value:
        categories,
      type:
        "number"
    },
    {
      label:
        "Completed Dates",
      value:
        dates,
      type:
        "number"
    }
  ];

}


function formatReportSummaryValue(
  item
){

  if(
    item.type ===
    "money"
  ){

    return formatINR(
      item.value
      ||
      0
    );

  }


  if(
    item.type ===
    "percent"
  ){

    return formatPercent(
      item.value
      ||
      0
    );

  }


  if(
    item.type ===
    "decimal"
  ){

    return Number(
      item.value
      ||
      0
    )
    .toFixed(
      1
    );

  }


  return formatNumber(
    item.value
    ||
    0
  );

}


function renderHistoricalSummary(
  summary
){

  for(
    let index = 0;
    index < 6;
    index++
  ){

    const item =
      summary[index]
      ||
      {
        label:
          "—",
        value:
          0,
        type:
          "number"
      };


    finalSetText(
      `reportKpi${index+1}Label`,
      item.label
    );

    finalSetText(
      `reportKpi${index+1}`,
      formatReportSummaryValue(
        item
      )
    );

  }

}


function renderHistoricalTable(
  def,
  rows
){

  const table =
    document
    .getElementById(
      "reportModuleTable"
    );


  if(!table){
    return;
  }


  finalSetText(
    "reportRowInfo",
    `${formatNumber(rows.length)} row${rows.length === 1 ? "" : "s"}`
  );


  if(
    !rows.length
  ){

    table.innerHTML =
      `<tbody><tr><td class="empty-row">No data</td></tr></tbody>`;

    return;

  }


  let columns = [];


  if(
    def.type ===
    "price"
  ){

    const isAmazon =
      def.marketplace ===
      "amazon";


    if(
      def.kind ===
      "mrp"
    ){

      columns = [
        [
          "Date",
          row =>
            row.reportDate
        ],
        [
          "Category",
          row =>
            row.category
        ],
        [
          "WF SKU",
          row =>
            row.wfSku
        ],
        [
          isAmazon
          ?
          "AZ SKU"
          :
          "FK SKU",
          row =>
            isAmazon
            ?
            row.azSku
            :
            row.fkSku
        ],
        [
          isAmazon
          ?
          "ASIN"
          :
          "FSN",
          row =>
            isAmazon
            ?
            row.asin
            :
            row.fsn
        ],
        [
          "WF MRP",
          row =>
            formatINR(
              row.wfMrp
            )
        ],
        [
          isAmazon
          ?
          "AZ MRP"
          :
          "FK MRP",
          row =>
            formatINR(
              isAmazon
              ?
              row.azMrp
              :
              row.fkMrp
            )
        ],
        [
          "Difference",
          row =>
            formatINR(
              row.mrpDiff
            )
        ],
        [
          "Status",
          row =>
            row.parityStatus
        ]
      ];

    }
    else{

      const live =
        def.kind ===
        "live";


      columns = [
        [
          "Date",
          row =>
            row.reportDate
        ],
        [
          "Category",
          row =>
            row.category
        ],
        [
          "WF SKU",
          row =>
            row.wfSku
        ],
        [
          isAmazon
          ?
          "AZ SKU"
          :
          "FK SKU",
          row =>
            isAmazon
            ?
            row.azSku
            :
            row.fkSku
        ],
        [
          isAmazon
          ?
          "ASIN"
          :
          "FSN",
          row =>
            isAmazon
            ?
            row.asin
            :
            row.fsn
        ],
        [
          "WF Price",
          row =>
            formatINR(
              row.wfPrice
            )
        ],
        [
          live
          ?
          "Live Price"
          :
          "Listing Price",
          row =>
            formatINR(
              live
              ?
              row.finalLivePrice
              :
              row.listingPrice
            )
        ],
        [
          "Difference",
          row =>
            formatINR(
              live
              ?
              row.livePriceDiff
              :
              row.listingPriceDiff
            )
        ],
        [
          "Status",
          row =>
            row.parityStatus
        ],
        [
          "Inventory",
          row =>
            formatNumber(
              row.inventory
            )
        ],
        [
          "Rev Impact / Day",
          row =>
            formatINR(
              reportRowImpact(
                def,
                row
              )
            )
        ]
      ];

    }

  }
  else if(
    def.type ===
    "suppression"
  ){

    columns = [
      [
        "Date",
        row =>
          row.reportDate
      ],
      [
        "Category",
        row =>
          row.category
      ],
      [
        "ASIN",
        row =>
          row.asin
      ],
      [
        "Rev Impact / Day",
        row =>
          formatINR(
            row.revenueImpactPerDay
            ||
            0
          )
      ]
    ];

  }
  else if(
    def.type ===
    "amazon_buybox"
  ){

    columns = [
      [
        "Date",
        row =>
          row.reportDate
      ],
      [
        "Category",
        row =>
          row.category
      ],
      [
        "ASIN",
        row =>
          row.asin
      ],
      [
        "WF SKU",
        row =>
          row.wfSku
      ],
      [
        "AZ SKU",
        row =>
          row.azSku
      ],
      [
        "Price",
        row =>
          formatINR(
            row.listingPrice
            ||
            0
          )
      ],
      [
        "Rev Impact / Day",
        row =>
          formatINR(
            row.revenueImpactPerDay
            ||
            0
          )
      ]
    ];

  }
  else{

    columns = [
      [
        "Date",
        row =>
          row.reportDate
      ],
      [
        "Category",
        row =>
          row.category
      ],
      [
        "FSN",
        row =>
          row.fsn
      ],
      [
        "WF SKU",
        row =>
          row.wfSku
      ],
      [
        "FK SKU",
        row =>
          row.fkSku
      ],
      [
        "Listing Price",
        row =>
          formatINR(
            row.listingPrice
            ||
            0
          )
      ],
      [
        "Rev Impact / Day",
        row =>
          formatINR(
            row.buyBoxRevenueImpactPerDay
            ||
            0
          )
      ]
    ];

  }


  const visibleRows =
    rows.slice(
      0,
      1500
    );


  if(
    rows.length >
    visibleRows.length
  ){

    finalSetText(
      "reportRowInfo",
      `${formatNumber(rows.length)} rows · showing first ${formatNumber(visibleRows.length)}`
    );

  }


  let html =
    "<thead><tr>"
    +
    columns
    .map(
      column =>
        `<th>${escapeHtml(column[0])}</th>`
    )
    .join("")
    +
    "</tr></thead><tbody>";


  visibleRows.forEach(
    row => {

      html +=
        "<tr>"
        +
        columns
        .map(
          column => {

            const value =
              column[1](
                row
              );

            const cssClass =
              column[0] ===
              "Status"
              ?
              (
                value ===
                "Parity"
                ?
                "parity"
                :
                "disparity"
              )
              :
              "";


            return `<td class="${cssClass}">${escapeHtml(value)}</td>`;

          }
        )
        .join("")
        +
        "</tr>";

    }
  );


  html +=
    "</tbody>";


  table.innerHTML =
    html;

}


function applyHistoricalFilters(){

  if(
    !currentHistoricalReport
  ){
    return;
  }


  const def =
    currentHistoricalReport.def;

  const rows =
    applyReportFiltersToRows(
      def,
      currentHistoricalReport.baseRows
    );

  const summary =
    makeReportSummary(
      def,
      rows
    );


  currentHistoricalReport.rows =
    rows;

  currentHistoricalReport.summary =
    summary;


  renderHistoricalSummary(
    summary
  );

  renderHistoricalTable(
    def,
    rows
  );

}


async function loadHistoricalModule(){

  const def =
    HISTORICAL_VIEWS[
      currentHistoricalViewKey
    ];


  if(
    !def ||
    typeof window.listDailySnapshotMetas !==
    "function"
  ){
    return;
  }


  const period =
    document
    .getElementById(
      "reportPeriod"
    )
    ?.value
    ||
    "daily";

  const anchor =
    document
    .getElementById(
      "reportAnchorDate"
    )
    ?.value
    ||
    todayIso();


  const metas =
    (
      await window
      .listDailySnapshotMetas()
    )
    .filter(
      meta =>
        meta.status ===
        "completed"
    );


  const selected =
    filterMetasForPeriod(
      metas,
      period,
      anchor
    )
    .sort(
      (a,b) =>
        a.reportDate
        .localeCompare(
          b.reportDate
        )
    );


  const snapshots = [];


  for(
    const meta
    of selected
  ){

    const snapshot =
      await loadSnapshotCached(
        meta.reportDate
      );

    if(snapshot){
      snapshots.push(
        snapshot
      );
    }

  }


  const compiled =
    compileHistoricalView(
      def,
      snapshots
    );


  const categorySelect =
    document
    .getElementById(
      "reportCategory"
    );

  const existingCategory =
    categorySelect
    ?.value
    ||
    "all";


  populateCategorySelectFromRows(
    categorySelect,
    compiled.rows,
    existingCategory
  );


  configureReportSort(
    def,
    false
  );


  currentHistoricalReport = {
    def,
    period,
    anchor,
    snapshots,
    baseRows:
      compiled.rows,
    rows:[],
    summary:[]
  };


  applyHistoricalFilters();

}


function reportFilename(
  prefix,
  period,
  anchor
){

  if(
    period ===
    "daily"
  ){

    return `${prefix}_${anchor}.xlsx`;

  }


  if(
    period ===
    "weekly"
  ){

    const [
      start,
      end
    ] =
      getWeekBounds(
        anchor
      );

    return `${prefix}_${start}_to_${end}.xlsx`;

  }


  return `${prefix}_${anchor.slice(0,7)}.xlsx`;

}


function summaryArrayToObject(
  summary
){

  const object = {};


  summary.forEach(
    item => {

      object[
        item.label
      ] =
        item.value;

    }
  );


  return object;

}


function writeExcelReport(
  filename,
  summary,
  rows
){

  if(
    typeof XLSX ===
    "undefined"
  ){

    alert(
      "Excel library not loaded."
    );

    return;

  }


  const workbook =
    XLSX.utils
    .book_new();


  const summaryRows =
    Object.entries(
      summary
    )
    .map(
      ([Metric,Value]) => ({
        Metric,
        Value:
          typeof Value ===
          "object"
          ?
          JSON.stringify(
            Value
          )
          :
          Value
      })
    );


  XLSX.utils
  .book_append_sheet(
    workbook,
    XLSX.utils
    .json_to_sheet(
      summaryRows
    ),
    "Summary"
  );


  XLSX.utils
  .book_append_sheet(
    workbook,
    XLSX.utils
    .json_to_sheet(
      rows
    ),
    "Data"
  );


  XLSX.writeFile(
    workbook,
    filename
  );

}


function downloadHistoricalModule(){

  if(
    !currentHistoricalReport
  ){

    loadHistoricalModule()
    .then(
      downloadHistoricalModule
    );

    return;

  }


  const {
    def,
    period,
    anchor,
    rows,
    summary
  } =
    currentHistoricalReport;


  const cleanRows =
    rows.map(
      row => {

        if(
          def.type ===
          "price"
        ){

          const isAmazon =
            def.marketplace ===
            "amazon";

          const base = {
            Date:
              row.reportDate,
            Category:
              row.category,
            "WF SKU":
              row.wfSku,
            [isAmazon ? "AZ SKU" : "FK SKU"]:
              isAmazon
              ?
              row.azSku
              :
              row.fkSku,
            [isAmazon ? "ASIN" : "FSN"]:
              isAmazon
              ?
              row.asin
              :
              row.fsn,
            Status:
              row.parityStatus,
            Inventory:
              row.inventory
          };


          if(
            def.kind ===
            "mrp"
          ){

            return {
              ...base,
              "WF MRP":
                row.wfMrp,
              [isAmazon ? "AZ MRP" : "FK MRP"]:
                isAmazon
                ?
                row.azMrp
                :
                row.fkMrp,
              "MRP Diff":
                row.mrpDiff
            };

          }


          const live =
            def.kind ===
            "live";


          return {
            ...base,
            "WF Price":
              row.wfPrice,
            [live ? "Live Price" : "Listing Price"]:
              live
              ?
              row.finalLivePrice
              :
              row.listingPrice,
            "Price Diff":
              live
              ?
              row.livePriceDiff
              :
              row.listingPriceDiff,
            "Rev Impact / Day":
              reportRowImpact(
                def,
                row
              )
          };

        }


        if(
          def.type ===
          "suppression"
        ){

          return {
            Date:
              row.reportDate,
            Category:
              row.category,
            ASIN:
              row.asin,
            "Rev Impact / Day":
              row.revenueImpactPerDay
              ||
              0
          };

        }


        if(
          def.type ===
          "amazon_buybox"
        ){

          return {
            Date:
              row.reportDate,
            Category:
              row.category,
            ASIN:
              row.asin,
            "WF SKU":
              row.wfSku,
            "AZ SKU":
              row.azSku,
            Price:
              row.listingPrice
              ||
              0,
            "Rev Impact / Day":
              row.revenueImpactPerDay
              ||
              0
          };

        }


        return {
          Date:
            row.reportDate,
          Category:
            row.category,
          FSN:
            row.fsn,
          "WF SKU":
            row.wfSku,
          "FK SKU":
            row.fkSku,
          "Listing Price":
            row.listingPrice
            ||
            0,
          "Rev Impact / Day":
            row.buyBoxRevenueImpactPerDay
            ||
            0
        };

      }
    );


  const safePrefix =
    def.title
    .replace(
      /[^A-Za-z0-9]+/g,
      "_"
    );


  writeExcelReport(
    reportFilename(
      safePrefix,
      period,
      anchor
    ),
    summaryArrayToObject(
      summary
    ),
    cleanRows
  );

}


/* ---------- Marketplace Insights uses stored daily summaries only ---------- */

async function loadMarketplaceInsights(){
  if(typeof window.listDailySnapshotMetas !== "function"){ return; }
  const market=document.getElementById("insightsMarketplace")?.value||"amazon";
  const period=document.getElementById("insightsPeriod")?.value||"daily";
  const anchor=document.getElementById("insightsDate")?.value||todayIso();
  const metas=filterMetasForPeriod((await window.listDailySnapshotMetas()).filter(m=>m.status === "completed"),period,anchor).sort((a,b)=>a.reportDate.localeCompare(b.reportDate));
  let liveEligible=0,liveParity=0,liveDisparity=0,impact=0,issues=0;
  const rows=[];
  metas.forEach(m=>{
    const x=m.insights?.[market]||{};
    const live=x.live||{};
    liveEligible += Number(live.eligible||0);
    liveParity += Number(live.parity||0);
    liveDisparity += Number(live.disparity||0);
    impact += Number(x.priceImpact||0);
    const issueCount = market === "amazon" ? Number(x.suppressions||0)+Number(x.buyBox||0) : Number(x.noBuyBox||0);
    issues += issueCount;
    rows.push({Date:m.reportDate,Parity:Number(live.parity||0),Disparity:Number(live.disparity||0),"Parity %":formatPercent(live.parityPct||0),"Revenue Impact":Number(x.priceImpact||0),Issues:issueCount});
  });
  finalSetText("insightsParity",formatPercent(liveEligible ? liveParity/liveEligible : 0));
  finalSetText("insightsDisparity",formatNumber(liveDisparity));
  finalSetText("insightsImpact",formatINR(impact));
  finalSetText("insightsIssues",formatNumber(issues));
  const table=document.getElementById("insightsTable");
  let html="<thead><tr><th>Date</th><th>Parity</th><th>Disparity</th><th>Parity %</th><th>Revenue Impact</th><th>Issues</th></tr></thead><tbody>";
  if(!rows.length) html += `<tr><td class="empty-row" colspan="6">No data</td></tr>`;
  rows.forEach(r=>{html+=`<tr><td>${escapeHtml(r.Date)}</td><td>${formatNumber(r.Parity)}</td><td>${formatNumber(r.Disparity)}</td><td>${escapeHtml(r["Parity %"])}</td><td>${formatINR(r["Revenue Impact"])}</td><td>${formatNumber(r.Issues)}</td></tr>`;});
  html+="</tbody>"; if(table) table.innerHTML=html;
  currentInsightsReport={market,period,anchor,rows,summary:{"Parity %":liveEligible ? liveParity/liveEligible : 0,"Disparity":liveDisparity,"Revenue Impact":impact,Issues:issues}};
}

function downloadMarketplaceInsights(){
  if(!currentInsightsReport){ loadMarketplaceInsights().then(downloadMarketplaceInsights); return; }
  const r=currentInsightsReport;
  writeExcelReport(reportFilename(`${r.market}_Marketplace_Insights`,r.period,r.anchor),r.summary,r.rows);
}

/* ---------- UI event wiring ---------- */

document
.getElementById(
  "reportDate"
)
?.addEventListener(
  "change",
  async event => {

    await restoreSessionForDate(
      event.target.value
    );

    await maybeAutoProcessCurrentDate();

  }
);


document
.getElementById(
  "dashboardPeriod"
)
?.addEventListener(
  "change",
  () =>
    loadDashboardOverview()
);


document
.getElementById(
  "dashboardDate"
)
?.addEventListener(
  "change",
  () =>
    loadDashboardOverview()
);


document
.getElementById(
  "dashboardCategory"
)
?.addEventListener(
  "change",
  () => {

    const period =
      document
      .getElementById(
        "dashboardPeriod"
      )
      ?.value
      ||
      "daily";

    const anchor =
      document
      .getElementById(
        "dashboardDate"
      )
      ?.value
      ||
      todayIso();

    const category =
      document
      .getElementById(
        "dashboardCategory"
      )
      ?.value
      ||
      "all";

    renderDashboardFromSnapshots(
      dashboardLoadedSnapshots,
      period,
      anchor,
      category
    );

    clearDashboardSearch(
      false
    );

  }
);


document
.getElementById(
  "dashboardGlobalSearch"
)
?.addEventListener(
  "keydown",
  event => {

    if(
      event.key ===
      "Enter"
    ){

      event.preventDefault();

      runDashboardSearch();

    }

  }
);


document
.getElementById(
  "reportPeriod"
)
?.addEventListener(
  "change",
  () =>
    loadHistoricalModule()
);


document
.getElementById(
  "reportAnchorDate"
)
?.addEventListener(
  "change",
  () =>
    loadHistoricalModule()
);


document
.getElementById(
  "reportCategory"
)
?.addEventListener(
  "change",
  () =>
    applyHistoricalFilters()
);


document
.getElementById(
  "reportSort"
)
?.addEventListener(
  "change",
  () =>
    applyHistoricalFilters()
);


let reportSearchTimer =
  null;


document
.getElementById(
  "reportSearch"
)
?.addEventListener(
  "input",
  () => {

    clearTimeout(
      reportSearchTimer
    );

    reportSearchTimer =
      setTimeout(
        () =>
          applyHistoricalFilters(),
        180
      );

  }
);


window.openHistoricalModule =
  openHistoricalModule;

window.loadHistoricalModule =
  loadHistoricalModule;

window.downloadHistoricalModule =
  downloadHistoricalModule;

window.loadMarketplaceInsights =
  loadMarketplaceInsights;

window.downloadMarketplaceInsights =
  downloadMarketplaceInsights;

window.initializeWakeSuiteHistory =
  initializeWakeSuiteHistory;

window.maybeAutoProcessCurrentDate =
  maybeAutoProcessCurrentDate;

window.restoreSessionForDate =
  restoreSessionForDate;

window.loadDashboardOverview =
  loadDashboardOverview;

window.runDashboardSearch =
  runDashboardSearch;

window.clearDashboardSearch =
  clearDashboardSearch;

window.applyHistoricalFilters =
  applyHistoricalFilters;




/* ======================================================
   WAKESUITE V4 · MODULAR PROCESSING + DATA EXPLORER
====================================================== */

let currentMarketplaceData = null;
let currentShareEmailPackage = null;

/* ---------- Wakefit eligibility: ACTIVE only ---------- */

function wakefitActiveValue(value){
  if(value === true || value === 1) return true;
  const t = String(value ?? "").trim().toLowerCase();
  return ["true","1","yes","y","active"].includes(t);
}

function buildWakefitPricingMap(rows){
  const map = new Map();
  (rows || []).forEach(row=>{
    if(!wakefitActiveValue(getRowValue(row,"active"))) return;
    const wfSku = normalizeKey(getRowValue(row,"item_sku"));
    if(!wfSku) return;
    map.set(wfSku,{
      wfSku,
      wfMrp: parseMoney(getRowValue(row,"mrp")),
      wfPrice: parseMoney(getRowValue(row,"sale_price")),
      active:true
    });
  });
  return map;
}

/* ---------- Modular source availability ---------- */

function v4ReportForDate(id, reportDate){
  const report = window.wakeSuiteSessionReports?.[id];
  if(!report || report.reportDate !== reportDate) return null;
  return report;
}

function v4SourceAvailability(reportDate){
  return {
    wakefit: !!v4ReportForDate("wakefit_daily_pricing",reportDate),
    amazonListings: !!v4ReportForDate("amazon_all_listings",reportDate),
    amazonFba: !!v4ReportForDate("amazon_fba_inventory",reportDate),
    amazonBusiness: !!v4ReportForDate("amazon_business_reports",reportDate),
    flipkartListing: !!v4ReportForDate("flipkart_listing_file",reportDate),
    flipkartOrders: !!v4ReportForDate("flipkart_order_report",reportDate),
    audit: !!v4ReportForDate("marketplace_audit_report",reportDate)
  };
}

function v4SourceCount(availability){
  return Object.values(availability || {}).filter(Boolean).length;
}

function v4ModuleState(ready, partial=false){
  if(!ready) return "unavailable";
  return partial ? "partial" : "available";
}

function v4DefaultAmazonLiveState(){
  return {
    suppressionStatus:"No Data Available",
    buyBoxStatus:"No Data Available",
    auditFound:false,
    finalLivePrice:null,
    priceSource:"No Audit Data",
    eligibleForComparison:false
  };
}

function v4DefaultFlipkartLiveState(){
  return {
    buyBoxStatus:"No Data Available",
    auditFound:false,
    finalLivePrice:null,
    priceSource:"No Audit Data",
    eligibleForComparison:false
  };
}

function v4BuildAmazonIssueRows(rows,businessMap,businessReportDays,revenueAvailable,predicate){
  const grouped = new Map();
  (rows || []).filter(predicate).forEach(row=>{
    if(!row.asin) return;
    const existing = grouped.get(row.asin);
    if(!existing || (
      Number(row.listingPrice)>0 &&
      (Number(existing.listingPrice)<=0 || Number(row.listingPrice)<Number(existing.listingPrice))
    )){
      grouped.set(row.asin,row);
    }
  });
  return Array.from(grouped.values()).map(row=>{
    const revenue = revenueAvailable ? Number(businessMap.get(row.asin)?.revenue || 0) : 0;
    return {
      ...row,
      businessRevenue: revenueAvailable ? revenue : null,
      revenueImpactPerDay: revenueAvailable ? revenue/businessReportDays : null,
      revenueAvailable
    };
  }).sort((a,b)=>Number(b.revenueImpactPerDay||0)-Number(a.revenueImpactPerDay||0));
}

/* ---------- Amazon modular result ---------- */

function buildAmazonModularResult(reportDate){
  const wfReport = v4ReportForDate("wakefit_daily_pricing",reportDate);
  const listingReport = v4ReportForDate("amazon_all_listings",reportDate);
  if(!window.masterPricingAmazon || !wfReport || !listingReport) return null;

  const fbaReport = v4ReportForDate("amazon_fba_inventory",reportDate);
  const businessReport = v4ReportForDate("amazon_business_reports",reportDate);
  const auditReport = v4ReportForDate("marketplace_audit_report",reportDate);

  const fbaAvailable = !!fbaReport;
  const revenueAvailable = !!businessReport;
  const auditAvailable = !!auditReport;

  const masterResult = prepareAmazonMasterPricing();
  const wfMap = buildWakefitPricingMap(wfReport.parsedFile.rows);
  const listingMap = buildAmazonListingMap(listingReport.parsedFile.rows);
  const fbaMap = fbaAvailable ? buildFbaInventoryMap(fbaReport.parsedFile.rows) : new Map();
  const businessMap = revenueAvailable ? buildAmazonBusinessRevenueMap(businessReport.parsedFile.rows) : new Map();
  const businessReportDays = revenueAvailable
    ? (Number(businessReport.businessReportDays) || DEFAULT_AMAZON_BUSINESS_REPORT_DAYS)
    : DEFAULT_AMAZON_BUSINESS_REPORT_DAYS;

  let auditMap = new Map();
  if(auditAvailable){
    const auditSummary = auditReport.auditSummary || processAuditReport(auditReport.parsedFile);
    auditMap = auditSummary.amazonMap || new Map();
  }

  const output = [];

  masterResult.masterMap.forEach(master=>{
    const listing = listingMap.get(master.azSku);
    if(!listing || listing.status !== "active") return;

    const allListingsQty = Number(listing.quantity || 0);
    const fbaSellableQty = fbaAvailable ? Number(fbaMap.get(master.azSku) || 0) : 0;
    const inventory = allListingsQty > 0 ? allListingsQty : fbaSellableQty;
    if(inventory <= 0) return;

    const wf = wfMap.get(master.wfSku);
    if(!wf || Number(wf.wfPrice)<=0) return;

    const asin = master.asin || listing.asin;
    const listingAction = Number(listing.azPrice)>0
      ? calculatePriceAction(wf.wfPrice,listing.azPrice,"Amazon")
      : {requiredAction:"No Listing Price",disparity:false,allowedPrice:null};

    const mrpDiff = Number(listing.azMrp)-Number(wf.wfMrp);
    const mrpDisparity = Number(listing.azMrp)>0 && Number(wf.wfMrp)>0 && Math.abs(mrpDiff)>0.01;

    const liveState = auditAvailable
      ? resolveAmazonLiveState(asin,listing.azPrice,auditMap)
      : v4DefaultAmazonLiveState();

    let requiredAction = "No Price Comparison";
    let liveDisparity = false;
    let allowedPrice = null;

    if(liveState.eligibleForComparison && Number(liveState.finalLivePrice)>0){
      const action = calculatePriceAction(wf.wfPrice,liveState.finalLivePrice,"Amazon");
      requiredAction = action.requiredAction;
      liveDisparity = action.disparity;
      allowedPrice = action.allowedPrice;
    }else if(liveState.suppressionStatus === "Suppressed"){
      requiredAction = "Suppressed - No Price Comparison";
    }else if(liveState.buyBoxStatus === "Buy Box Suppressed"){
      requiredAction = "Buy Box Suppressed - No Price Comparison";
    }

    const asinRevenue = revenueAvailable ? Number(businessMap.get(asin)?.revenue || 0) : null;

    output.push({
      category:master.category,
      wfSku:master.wfSku,
      azSku:master.azSku,
      asin,
      suppressionStatus:liveState.suppressionStatus,
      buyBoxStatus:liveState.buyBoxStatus,
      auditFound:liveState.auditFound,
      auditAvailable,
      revenueAvailable,
      wfMrp:wf.wfMrp,
      wfPrice:wf.wfPrice,
      azMrp:listing.azMrp,
      listingPrice:listing.azPrice,
      finalLivePrice:liveState.finalLivePrice,
      priceSource:liveState.priceSource,
      mrpDiff,
      mrpDisparity,
      listingPriceDiff:Number(listing.azPrice)>0 ? Number(listing.azPrice)-Number(wf.wfPrice) : null,
      listingPriceAction:listingAction.requiredAction,
      listingPriceDisparity:listingAction.disparity,
      livePriceDiff:Number(liveState.finalLivePrice)>0 ? Number(liveState.finalLivePrice)-Number(wf.wfPrice) : null,
      livePriceAction:requiredAction,
      livePriceDisparity:liveDisparity,
      priceDiff:Number(liveState.finalLivePrice)>0 ? Number(liveState.finalLivePrice)-Number(wf.wfPrice) : null,
      inventory,
      allListingsQty,
      fbaSellableQty,
      eligibleForComparison:liveState.eligibleForComparison,
      requiredAction,
      disparity:liveDisparity,
      allowedPrice,
      asinRevenue,
      businessReportDays:revenueAvailable ? businessReportDays : null,
      revenueAllocated:false,
      priceGap:0,
      priceGapPercent:0,
      listingDailyRevenueImpact:0,
      liveDailyRevenueImpact:0,
      dailyRevenueImpact:0
    });
  });

  if(revenueAvailable){
    allocateAmazonAsinRevenueImpact(output,businessMap,businessReportDays);
    output.forEach(row=>{
      row.asinRevenue = Number(businessMap.get(row.asin)?.revenue || 0);
      row.revenueAvailable = true;
    });
  }

  const listingPriceDisparityRows = output.filter(row=>row.listingPriceDisparity);
  const livePriceDisparityRows = auditAvailable ? output.filter(row=>row.livePriceDisparity) : [];
  const mrpDisparityRows = output.filter(row=>row.mrpDisparity);

  const suppressionRows = auditAvailable
    ? v4BuildAmazonIssueRows(output,businessMap,businessReportDays,revenueAvailable,row=>row.suppressionStatus==="Suppressed")
    : [];
  const buyBoxSuppressedRows = auditAvailable
    ? v4BuildAmazonIssueRows(output,businessMap,businessReportDays,revenueAvailable,row=>row.buyBoxStatus==="Buy Box Suppressed")
    : [];

  const listingImpact = revenueAvailable
    ? output.reduce((sum,row)=>sum+Number(row.listingDailyRevenueImpact||0),0)
    : 0;
  const liveImpact = revenueAvailable && auditAvailable
    ? output.reduce((sum,row)=>sum+Number(row.liveDailyRevenueImpact||row.dailyRevenueImpact||0),0)
    : 0;
  const suppressionImpact = revenueAvailable
    ? suppressionRows.reduce((sum,row)=>sum+Number(row.revenueImpactPerDay||0),0)
    : 0;
  const buyBoxImpact = revenueAvailable
    ? buyBoxSuppressedRows.reduce((sum,row)=>sum+Number(row.revenueImpactPerDay||0),0)
    : 0;

  const inventoryPartial = !fbaAvailable;

  return {
    generatedAt:new Date(),
    threshold:PRICE_THRESHOLD,
    businessReportDays,
    rows:output,
    disparityRows:livePriceDisparityRows,
    listingPriceDisparityRows,
    livePriceDisparityRows,
    mrpDisparityRows,
    suppressionRows,
    buyBoxSuppressedRows,
    moduleStatus:{
      amazonListing:v4ModuleState(true,inventoryPartial),
      amazonLive:v4ModuleState(auditAvailable,inventoryPartial),
      amazonMrp:v4ModuleState(true,inventoryPartial),
      amazonSuppression:v4ModuleState(auditAvailable,inventoryPartial),
      amazonBuyBox:v4ModuleState(auditAvailable,inventoryPartial),
      amazonRevenue:revenueAvailable ? "available" : "unavailable"
    },
    summary:{
      totalActiveInStockSkus:output.length,
      listingPriceDisparitySkus:listingPriceDisparityRows.length,
      livePriceDisparitySkus:livePriceDisparityRows.length,
      mrpDisparitySkus:mrpDisparityRows.length,
      suppressedAsins:suppressionRows.length,
      buyBoxSuppressedAsins:buyBoxSuppressedRows.length,
      suppressionRevenueImpactPerDay:suppressionImpact,
      buyBoxRevenueImpactPerDay:buyBoxImpact,
      listingTotalDailyRevenueImpact:listingImpact,
      liveTotalDailyRevenueImpact:liveImpact,
      totalDailyRevenueImpact:auditAvailable ? liveImpact : listingImpact,
      revenueAvailable,
      auditAvailable,
      fbaAvailable,
      masterExactDuplicatesRemoved:masterResult.exactDuplicates,
      masterConflicts:masterResult.conflicts.length
    }
  };
}

/* ---------- Flipkart modular result ---------- */

function buildFlipkartModularResult(reportDate){
  const wfReport = v4ReportForDate("wakefit_daily_pricing",reportDate);
  const listingReport = v4ReportForDate("flipkart_listing_file",reportDate);
  if(!window.masterPricingFlipkart || !wfReport || !listingReport) return null;

  const orderReport = v4ReportForDate("flipkart_order_report",reportDate);
  const auditReport = v4ReportForDate("marketplace_audit_report",reportDate);
  const revenueAvailable = !!orderReport;
  const auditAvailable = !!auditReport;

  const masterResult = prepareFlipkartMasterPricing();
  const wfMap = buildWakefitPricingMap(wfReport.parsedFile.rows);
  const listingMap = buildFlipkartListingMap(listingReport.parsedFile.rows);

  const orderData = revenueAvailable
    ? buildFlipkartOrderTrackingMap(orderReport.parsedFile.rows)
    : {fsnMap:new Map(),minDate:null,maxDate:null,periodDays:0};

  let auditMap = new Map();
  if(auditAvailable){
    const auditSummary = auditReport.auditSummary || processAuditReport(auditReport.parsedFile);
    auditMap = auditSummary.flipkartMap || new Map();
  }

  const output = [];

  masterResult.masterMap.forEach(master=>{
    const listing = listingMap.get(master.fkSku);
    if(!listing || listing.status !== "ACTIVE" || Number(listing.systemStock)<=0) return;

    const wf = wfMap.get(master.wfSku);
    if(!wf || Number(wf.wfPrice)<=0) return;

    const fsn = listing.fsn;
    const listingAction = Number(listing.fkPrice)>0
      ? calculatePriceAction(wf.wfPrice,listing.fkPrice,"Flipkart")
      : {requiredAction:"No Listing Price",disparity:false,allowedPrice:null};

    const mrpDiff = Number(listing.fkMrp)-Number(wf.wfMrp);
    const mrpDisparity = Number(listing.fkMrp)>0 && Number(wf.wfMrp)>0 && Math.abs(mrpDiff)>0.01;

    const liveState = auditAvailable
      ? resolveFlipkartLiveState(fsn,listing.fkPrice,auditMap)
      : v4DefaultFlipkartLiveState();

    const orderStats = revenueAvailable
      ? (orderData.fsnMap.get(fsn) || {orderIds:new Set(),revenueQuantity:0})
      : {orderIds:new Set(),revenueQuantity:0};

    let requiredAction = "No Price Comparison";
    let liveDisparity = false;
    let allowedPrice = null;

    if(liveState.eligibleForComparison && Number(liveState.finalLivePrice)>0){
      const action = calculatePriceAction(wf.wfPrice,liveState.finalLivePrice,"Flipkart");
      requiredAction = action.requiredAction;
      liveDisparity = action.disparity;
      allowedPrice = action.allowedPrice;
    }else if(liveState.buyBoxStatus === "No Buy Box"){
      requiredAction = "No Buy Box - No Price Comparison";
    }

    output.push({
      category:master.category,
      wfSku:master.wfSku,
      fkSku:master.fkSku,
      fsn,
      masterFsn:master.fsn,
      buyBoxStatus:liveState.buyBoxStatus,
      auditFound:liveState.auditFound,
      auditAvailable,
      revenueAvailable,
      wfMrp:wf.wfMrp,
      wfPrice:wf.wfPrice,
      fkMrp:listing.fkMrp,
      listingPrice:listing.fkPrice,
      finalLivePrice:liveState.finalLivePrice,
      priceSource:liveState.priceSource,
      mrpDiff,
      mrpDisparity,
      listingPriceDiff:Number(listing.fkPrice)>0 ? Number(listing.fkPrice)-Number(wf.wfPrice) : null,
      listingPriceAction:listingAction.requiredAction,
      listingPriceDisparity:listingAction.disparity,
      livePriceDiff:Number(liveState.finalLivePrice)>0 ? Number(liveState.finalLivePrice)-Number(wf.wfPrice) : null,
      livePriceAction:requiredAction,
      livePriceDisparity:liveDisparity,
      priceDiff:Number(liveState.finalLivePrice)>0 ? Number(liveState.finalLivePrice)-Number(wf.wfPrice) : null,
      inventory:listing.systemStock,
      ordersReceived:orderStats.orderIds.size,
      revenueQuantity:Number(orderStats.revenueQuantity||0),
      calculatedRevenue:0,
      listingCalculatedRevenue:0,
      liveCalculatedRevenue:0,
      eligibleForComparison:liveState.eligibleForComparison,
      requiredAction,
      disparity:liveDisparity,
      allowedPrice,
      priceGap:0,
      priceGapPercent:0,
      revenueImpact:0,
      listingDailyRevenueImpact:0,
      liveDailyRevenueImpact:0,
      buyBoxRevenueImpactPerDay:0,
      dailyRevenueImpact:0
    });
  });

  if(revenueAvailable && Number(orderData.periodDays)>0){
    allocateFlipkartFsnRevenueMetrics(output,orderData.periodDays);
    output.forEach(row=>row.revenueAvailable=true);
  }

  const listingPriceDisparityRows = output.filter(row=>row.listingPriceDisparity);
  const livePriceDisparityRows = auditAvailable ? output.filter(row=>row.livePriceDisparity) : [];
  const mrpDisparityRows = output.filter(row=>row.mrpDisparity);
  const noBuyBoxRows = auditAvailable ? output.filter(row=>row.buyBoxStatus==="No Buy Box") : [];

  const listingImpact = revenueAvailable
    ? output.reduce((sum,row)=>sum+Number(row.listingDailyRevenueImpact||0),0)
    : 0;
  const liveImpact = revenueAvailable && auditAvailable
    ? output.reduce((sum,row)=>sum+Number(row.liveDailyRevenueImpact||row.dailyRevenueImpact||0),0)
    : 0;
  const buyBoxImpact = revenueAvailable
    ? output.reduce((sum,row)=>sum+Number(row.buyBoxRevenueImpactPerDay||0),0)
    : 0;

  return {
    generatedAt:new Date(),
    threshold:PRICE_THRESHOLD,
    orderPeriod:revenueAvailable ? {
      startDate:formatDateISO(orderData.minDate),
      endDate:formatDateISO(orderData.maxDate),
      days:orderData.periodDays
    } : null,
    rows:output,
    disparityRows:livePriceDisparityRows,
    listingPriceDisparityRows,
    livePriceDisparityRows,
    mrpDisparityRows,
    moduleStatus:{
      flipkartListing:"available",
      flipkartLive:auditAvailable ? "available" : "unavailable",
      flipkartMrp:"available",
      flipkartBuyBox:auditAvailable ? "available" : "unavailable",
      flipkartRevenue:revenueAvailable ? "available" : "unavailable"
    },
    summary:{
      totalActiveInStockSkus:output.length,
      listingPriceDisparitySkus:listingPriceDisparityRows.length,
      livePriceDisparitySkus:livePriceDisparityRows.length,
      mrpDisparitySkus:mrpDisparityRows.length,
      noBuyBoxSkus:noBuyBoxRows.length,
      listingTotalDailyRevenueImpact:listingImpact,
      liveTotalDailyRevenueImpact:liveImpact,
      noBuyBoxRevenueImpactPerDay:buyBoxImpact,
      totalDailyRevenueImpact:auditAvailable ? liveImpact : listingImpact,
      revenueAvailable,
      auditAvailable,
      masterExactDuplicatesRemoved:masterResult.exactDuplicates,
      masterConflicts:masterResult.conflicts.length
    }
  };
}


/* ---------- V4 compact serialization ---------- */

function compactAmazonRow(r){
  return [
    r.category,r.wfSku,r.azSku,r.asin,r.wfMrp,r.wfPrice,r.azMrp,r.listingPrice,
    r.finalLivePrice,r.inventory,r.suppressionStatus,r.buyBoxStatus,
    !!r.listingPriceDisparity,!!r.livePriceDisparity,!!r.mrpDisparity,
    r.listingPriceDiff,r.livePriceDiff,r.mrpDiff,r.dailyRevenueImpact,
    r.requiredAction,r.listingPriceAction,!!r.eligibleForComparison,
    r.listingDailyRevenueImpact||0,r.liveDailyRevenueImpact||r.dailyRevenueImpact||0,
    !!r.revenueAvailable,!!r.auditAvailable,r.asinRevenue,r.businessReportDays
  ];
}

function expandAmazonRow(a){
  return {
    category:a[0],wfSku:a[1],azSku:a[2],asin:a[3],wfMrp:a[4],wfPrice:a[5],azMrp:a[6],
    listingPrice:a[7],finalLivePrice:a[8],inventory:a[9],suppressionStatus:a[10],
    buyBoxStatus:a[11],listingPriceDisparity:!!a[12],livePriceDisparity:!!a[13],
    mrpDisparity:!!a[14],listingPriceDiff:a[15],livePriceDiff:a[16],mrpDiff:a[17],
    dailyRevenueImpact:a[18]||0,requiredAction:a[19],listingPriceAction:a[20],
    eligibleForComparison:!!a[21],listingDailyRevenueImpact:a[22]||0,
    liveDailyRevenueImpact:a[23]||a[18]||0,
    revenueAvailable:a.length>24 ? !!a[24] : true,
    auditAvailable:a.length>25 ? !!a[25] : true,
    asinRevenue:a.length>26 ? a[26] : null,
    businessReportDays:a.length>27 ? a[27] : DEFAULT_AMAZON_BUSINESS_REPORT_DAYS
  };
}

function compactAmazonIssueRow(r){
  return [r.category,r.asin,r.wfSku,r.listingPrice,r.businessRevenue,r.revenueImpactPerDay,r.azSku,!!r.revenueAvailable];
}

function expandAmazonIssueRow(a){
  return {
    category:a[0],asin:a[1],wfSku:a[2],listingPrice:a[3],
    businessRevenue:a[4],revenueImpactPerDay:a[5],azSku:a[6],
    revenueAvailable:a.length>7 ? !!a[7] : true
  };
}

function compactFlipkartRow(r){
  return [
    r.category,r.wfSku,r.fkSku,r.fsn,r.wfMrp,r.wfPrice,r.fkMrp,r.listingPrice,
    r.finalLivePrice,r.inventory,r.buyBoxStatus,!!r.listingPriceDisparity,
    !!r.livePriceDisparity,!!r.mrpDisparity,r.listingPriceDiff,r.livePriceDiff,
    r.mrpDiff,r.dailyRevenueImpact,r.calculatedRevenue,r.ordersReceived,r.revenueQuantity,
    r.requiredAction,r.listingPriceAction,!!r.eligibleForComparison,
    r.listingCalculatedRevenue||0,r.liveCalculatedRevenue||r.calculatedRevenue||0,
    r.listingDailyRevenueImpact||0,r.liveDailyRevenueImpact||r.dailyRevenueImpact||0,
    r.buyBoxRevenueImpactPerDay||0,!!r.revenueAvailable,!!r.auditAvailable
  ];
}

function expandFlipkartRow(a){
  return {
    category:a[0],wfSku:a[1],fkSku:a[2],fsn:a[3],wfMrp:a[4],wfPrice:a[5],fkMrp:a[6],
    listingPrice:a[7],finalLivePrice:a[8],inventory:a[9],buyBoxStatus:a[10],
    listingPriceDisparity:!!a[11],livePriceDisparity:!!a[12],mrpDisparity:!!a[13],
    listingPriceDiff:a[14],livePriceDiff:a[15],mrpDiff:a[16],dailyRevenueImpact:a[17]||0,
    calculatedRevenue:a[18]||0,ordersReceived:a[19]||0,revenueQuantity:a[20]||0,
    requiredAction:a[21],listingPriceAction:a[22],eligibleForComparison:!!a[23],
    listingCalculatedRevenue:a[24]||0,liveCalculatedRevenue:a[25]||a[18]||0,
    listingDailyRevenueImpact:a[26]||0,liveDailyRevenueImpact:a[27]||a[17]||0,
    buyBoxRevenueImpactPerDay:a[28]||0,
    revenueAvailable:a.length>29 ? !!a[29] : true,
    auditAvailable:a.length>30 ? !!a[30] : true
  };
}

/* ---------- Snapshot ---------- */

function buildSnapshotInsights(amazon,flipkart){
  const safeAmazon = amazon || {rows:[],suppressionRows:[],buyBoxSuppressedRows:[],summary:{}};
  const safeFlipkart = flipkart || {rows:[],summary:{}};

  const azListing = calcParityStats(safeAmazon.rows,"listing","amazon");
  const azLive = calcParityStats(safeAmazon.rows,"live","amazon");
  const azMrp = calcParityStats(safeAmazon.rows,"mrp","amazon");
  const fkListing = calcParityStats(safeFlipkart.rows,"listing","flipkart");
  const fkLive = calcParityStats(safeFlipkart.rows,"live","flipkart");
  const fkMrp = calcParityStats(safeFlipkart.rows,"mrp","flipkart");

  return {
    amazon:{
      listing:azListing,live:azLive,mrp:azMrp,
      suppressions:safeAmazon.suppressionRows?.length||0,
      buyBox:safeAmazon.buyBoxSuppressedRows?.length||0,
      suppressionImpact:Number(safeAmazon.summary?.suppressionRevenueImpactPerDay||0),
      buyBoxImpact:Number(safeAmazon.summary?.buyBoxRevenueImpactPerDay||0),
      listingPriceImpact:Number(safeAmazon.summary?.listingTotalDailyRevenueImpact||0),
      livePriceImpact:Number(safeAmazon.summary?.liveTotalDailyRevenueImpact||0)
    },
    flipkart:{
      listing:fkListing,live:fkLive,mrp:fkMrp,
      noBuyBox:new Set(safeFlipkart.rows.filter(row=>row.buyBoxStatus==="No Buy Box").map(row=>row.fsn).filter(Boolean)).size,
      listingPriceImpact:Number(safeFlipkart.summary?.listingTotalDailyRevenueImpact||0),
      livePriceImpact:Number(safeFlipkart.summary?.liveTotalDailyRevenueImpact||0),
      noBuyBoxImpact:Number(safeFlipkart.summary?.noBuyBoxRevenueImpactPerDay||0)
    }
  };
}

function makePersistedSnapshot(date,fingerprint,amazon,flipkart){
  const availability = v4SourceAvailability(date);
  const moduleStatus = {
    amazonListing:amazon?.moduleStatus?.amazonListing||"unavailable",
    amazonLive:amazon?.moduleStatus?.amazonLive||"unavailable",
    amazonMrp:amazon?.moduleStatus?.amazonMrp||"unavailable",
    amazonSuppression:amazon?.moduleStatus?.amazonSuppression||"unavailable",
    amazonBuyBox:amazon?.moduleStatus?.amazonBuyBox||"unavailable",
    amazonRevenue:amazon?.moduleStatus?.amazonRevenue||"unavailable",
    flipkartListing:flipkart?.moduleStatus?.flipkartListing||"unavailable",
    flipkartLive:flipkart?.moduleStatus?.flipkartLive||"unavailable",
    flipkartMrp:flipkart?.moduleStatus?.flipkartMrp||"unavailable",
    flipkartBuyBox:flipkart?.moduleStatus?.flipkartBuyBox||"unavailable",
    flipkartRevenue:flipkart?.moduleStatus?.flipkartRevenue||"unavailable"
  };

  return {
    reportDate:date,
    schemaVersion:PROCESSING_SCHEMA_VERSION,
    fingerprint,
    dataStatus:v4SourceCount(availability)===FINAL_REQUIRED_REPORTS.length ? "complete" : "partial",
    sourceAvailability:availability,
    moduleStatus,
    processedMarketplaces:{amazon:!!amazon,flipkart:!!flipkart},
    insights:buildSnapshotInsights(amazon,flipkart),
    amazonSummary:amazon?.summary||{},
    flipkartSummary:flipkart?.summary||{},
    flipkartOrderPeriod:flipkart?.orderPeriod||null,
    amazonRows:(amazon?.rows||[]).map(compactAmazonRow),
    amazonSuppressions:(amazon?.suppressionRows||[]).map(compactAmazonIssueRow),
    amazonBuyBox:(amazon?.buyBoxSuppressedRows||[]).map(compactAmazonIssueRow),
    flipkartRows:(flipkart?.rows||[]).map(compactFlipkartRow)
  };
}

function hydrateSnapshot(snapshot){
  if(!snapshot) return;

  const amazonRows=(snapshot.amazonRows||[]).map(row=>Array.isArray(row)?expandAmazonRow(row):row);
  const suppressionRows=(snapshot.amazonSuppressions||[]).map(row=>Array.isArray(row)?expandAmazonIssueRow(row):row);
  const buyBoxRows=(snapshot.amazonBuyBox||[]).map(row=>Array.isArray(row)?expandAmazonIssueRow(row):row);
  const flipkartRows=(snapshot.flipkartRows||[]).map(row=>Array.isArray(row)?expandFlipkartRow(row):row);

  window.amazonPriceDisparityResult={
    rows:amazonRows,
    listingPriceDisparityRows:amazonRows.filter(row=>row.listingPriceDisparity),
    livePriceDisparityRows:amazonRows.filter(row=>row.livePriceDisparity),
    mrpDisparityRows:amazonRows.filter(row=>row.mrpDisparity),
    suppressionRows,
    buyBoxSuppressedRows:buyBoxRows,
    summary:snapshot.amazonSummary||{}
  };

  window.flipkartPriceDisparityResult={
    rows:flipkartRows,
    listingPriceDisparityRows:flipkartRows.filter(row=>row.listingPriceDisparity),
    livePriceDisparityRows:flipkartRows.filter(row=>row.livePriceDisparity),
    mrpDisparityRows:flipkartRows.filter(row=>row.mrpDisparity),
    summary:snapshot.flipkartSummary||{},
    orderPeriod:snapshot.flipkartOrderPeriod||null
  };

  renderFinalDashboard(snapshot);
}

/* ---------- Fingerprint and non-mandatory auto processing ---------- */

function buildInputFingerprint(date){
  const payload=FINAL_REQUIRED_REPORTS.map(([id])=>{
    const report=v4ReportForDate(id,date);
    if(!report) return [id,"NO_DATA"];
    return [
      id,report.reportDate||"",report.parsedFile?.fileName||report.fileName||"",
      Number(report.parsedFile?.fileSize||report.fileSize||0),
      Number(report.lastModified||0),
      Number(report.parsedFile?.rowCount||report.parsedFile?.rows?.length||0)
    ];
  });
  return btoa(unescape(encodeURIComponent(JSON.stringify([PROCESSING_SCHEMA_VERSION,date,payload]))));
}

function v4InferExistingAvailability(existing){
  if(existing?.sourceAvailability) return existing.sourceAvailability;
  if(existing?.status==="completed"){
    return {
      wakefit:true,amazonListings:true,amazonFba:true,amazonBusiness:true,
      flipkartListing:true,flipkartOrders:true,audit:true
    };
  }
  return {};
}

function v4WouldDowngradeSnapshot(existing,currentAvailability){
  if(!existing || existing.status!=="completed") return false;
  const previous=v4InferExistingAvailability(existing);
  return Object.keys(previous).some(key=>previous[key]===true && currentAvailability[key]!==true);
}

async function maybeAutoProcessCurrentDate(){
  const date=getSelectedReportDate();
  if(!date || processingLock) return;
  if(typeof window.saveDailySnapshot!=="function") return;

  const availability=v4SourceAvailability(date);
  const canAmazon=!!window.masterPricingAmazon && availability.wakefit && availability.amazonListings;
  const canFlipkart=!!window.masterPricingFlipkart && availability.wakefit && availability.flipkartListing;

  if(!canAmazon && !canFlipkart){
    setUploadStatus("No processable marketplace module yet. Uploaded sources remain saved.","");
    return;
  }

  const fingerprint=buildInputFingerprint(date);
  processingLock=true;

  try{
    setUploadStatus("Processing available modules...","success");
    const existing=await window.getDailySnapshotMeta(date);

    if(existing?.status==="completed" && existing?.fingerprint===fingerprint){
      const saved=await window.loadDailySnapshot(date);
      if(saved){
        snapshotCache.set(date,saved);
        hydrateSnapshot(saved);
      }
      setUploadStatus(`${date} is already processed for the available sources.`,"success");
      return;
    }

    if(v4WouldDowngradeSnapshot(existing,availability)){
      const saved=await window.loadDailySnapshot(date);
      if(saved){
        snapshotCache.set(date,saved);
        hydrateSnapshot(saved);
      }
      setUploadStatus("Existing stored data for this date is more complete. Upload the missing source(s) before replacing it.","");
      return;
    }

    const amazon=canAmazon ? buildAmazonModularResult(date) : null;
    const flipkart=canFlipkart ? buildFlipkartModularResult(date) : null;
    const snapshot=makePersistedSnapshot(date,fingerprint,amazon,flipkart);
    const savedMeta=await window.saveDailySnapshot(date,snapshot);
    snapshot.revision=savedMeta.revision;
    snapshotCache.set(date,snapshot);
    hydrateSnapshot(snapshot);

    const sourceCount=v4SourceCount(availability);
    setUploadStatus(`${date} processed · ${sourceCount} / ${FINAL_REQUIRED_REPORTS.length} sources available.`,"success");
  }catch(error){
    console.error("Automatic processing failed",error);
    setUploadStatus("Automatic processing failed: "+error.message,"error");
  }finally{
    processingLock=false;
    updateReadiness();
  }
}

function updateReadiness(){
  const date=getSelectedReportDate();
  let loaded=0;
  let html="";

  FINAL_REQUIRED_REPORTS.forEach(([id,label])=>{
    const ready=!!v4ReportForDate(id,date);
    if(ready) loaded+=1;
    html+=`<div class="ready-row">
      <span>${escapeHtml(label)}</span>
      <span class="ready-badge ${ready?"ready":""}">${ready?"Available":"No Data"}</span>
    </div>`;
  });

  const box=document.getElementById("readinessList");
  if(box) box.innerHTML=html;
  finalSetText("readinessCounter",`${loaded} / ${FINAL_REQUIRED_REPORTS.length}`);
  finalSetText("readinessTitle",date?`Source Availability · ${date}`:"Source Availability");
  finalSetText("sessionChipText",`${loaded} / ${FINAL_REQUIRED_REPORTS.length} Sources`);

  const chip=document.getElementById("sessionChip");
  if(chip) chip.classList.toggle("ready",loaded>0);

  const old=document.getElementById("dashboardReportsLoaded");
  if(old) old.textContent=String(loaded);
}


/* ======================================================
   DATE RANGE
====================================================== */

function v4IsoDate(date){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function v4DateRangeForPeriod(period,fromDate,toDate){
  const anchor=fromDate||toDate||todayIso();

  if(period==="daily") return [anchor,anchor];
  if(period==="weekly") return getWeekBounds(anchor);

  if(period==="monthly"){
    const d=new Date(anchor+"T00:00:00");
    return [
      v4IsoDate(new Date(d.getFullYear(),d.getMonth(),1)),
      v4IsoDate(new Date(d.getFullYear(),d.getMonth()+1,0))
    ];
  }

  let start=fromDate||anchor;
  let end=toDate||start;
  if(end<start) [start,end]=[end,start];
  return [start,end];
}

function v4DaysInclusive(fromDate,toDate){
  if(!fromDate||!toDate) return 0;
  const start=new Date(fromDate+"T00:00:00");
  const end=new Date(toDate+"T00:00:00");
  return Math.max(0,Math.round((end-start)/86400000)+1);
}

function v4MetasInRange(metas,fromDate,toDate){
  return (metas||[])
    .filter(meta=>meta.status==="completed" && meta.reportDate>=fromDate && meta.reportDate<=toDate)
    .sort((a,b)=>String(a.reportDate).localeCompare(String(b.reportDate)));
}

function v4SetRangeControls(periodId,fromId,toId,anchorId=null){
  const period=document.getElementById(periodId)?.value||"daily";
  const fromInput=document.getElementById(fromId);
  const toInput=document.getElementById(toId);
  if(!fromInput||!toInput) return [todayIso(),todayIso()];

  const [fromDate,toDate]=v4DateRangeForPeriod(period,fromInput.value||todayIso(),toInput.value);
  fromInput.value=fromDate;
  toInput.value=toDate;
  fromInput.disabled=false;
  toInput.disabled=period!=="custom";

  if(anchorId){
    const anchor=document.getElementById(anchorId);
    if(anchor) anchor.value=fromDate;
  }
  return [fromDate,toDate];
}

/* ======================================================
   DASHBOARD V4
====================================================== */

function v4SnapshotModuleState(snapshot,key){
  const explicit=snapshot?.moduleStatus?.[key];
  if(explicit) return explicit;

  if(snapshot?.status==="completed" || snapshot?.reportDate){
    if(key.startsWith("amazon")) return snapshot.amazonRows?.length ? "available" : "unavailable";
    if(key.startsWith("flipkart")) return snapshot.flipkartRows?.length ? "available" : "unavailable";
  }
  return "unavailable";
}

function v4SnapshotRevenueAvailable(snapshot,marketplace){
  const key=marketplace==="amazon"?"amazonBusiness":"flipkartOrders";
  if(snapshot?.sourceAvailability && key in snapshot.sourceAvailability){
    return !!snapshot.sourceAvailability[key];
  }
  return true;
}

function v4ModuleCoverage(snapshots,moduleKey,totalDays){
  let availableDays=0;
  let hasPartial=false;
  (snapshots||[]).forEach(snapshot=>{
    const state=v4SnapshotModuleState(snapshot,moduleKey);
    if(state!=="unavailable") availableDays+=1;
    if(state==="partial") hasPartial=true;
  });

  let state="unavailable";
  if(availableDays>0){
    state=(availableDays<totalDays||hasPartial)?"partial":"available";
  }
  return {state,availableDays,totalDays};
}

function v4SetAvailabilityChip(id,state,label=null){
  const element=document.getElementById(id);
  if(!element) return;
  element.classList.remove("available","partial","unavailable");
  element.classList.add(state);
  const defaultLabel=state==="available"?"Available":(state==="partial"?"Partial":"No Data Available");
  element.textContent=label||defaultLabel;
}

function v4PriceObservations(snapshot,marketplace,category="all"){
  const rows=marketplace==="amazon"?getSnapshotAmazonRows(snapshot):getSnapshotFlipkartRows(snapshot);
  const filtered=rows.filter(row=>dashboardCategoryMatches(row,category));
  const liveKey=marketplace==="amazon"?"amazonLive":"flipkartLive";
  const listingKey=marketplace==="amazon"?"amazonListing":"flipkartListing";
  const liveAvailable=v4SnapshotModuleState(snapshot,liveKey)!=="unavailable";
  const listingAvailable=v4SnapshotModuleState(snapshot,listingKey)!=="unavailable";

  if(liveAvailable){
    return filtered
      .filter(row=>row.eligibleForComparison && Number(row.finalLivePrice)>0)
      .map(row=>({
        ...row,
        reportDate:snapshot.reportDate,
        priceSignal:"Live",
        parityStatus:row.livePriceDisparity?"Disparity":"Parity",
        priceImpact:v4SnapshotRevenueAvailable(snapshot,marketplace)
          ? Number(row.liveDailyRevenueImpact||row.dailyRevenueImpact||0)
          : null
      }));
  }

  if(listingAvailable){
    return filtered
      .filter(row=>Number(row.listingPrice)>0)
      .map(row=>({
        ...row,
        reportDate:snapshot.reportDate,
        priceSignal:"Listing",
        parityStatus:row.listingPriceDisparity?"Disparity":"Parity",
        priceImpact:v4SnapshotRevenueAvailable(snapshot,marketplace)
          ? Number(row.listingDailyRevenueImpact||0)
          : null
      }));
  }

  return [];
}

function v4UniqueProducts(rows,key){
  return new Set((rows||[]).map(row=>String(row?.[key]||"")).filter(Boolean)).size;
}

function v4AmazonDedupImpactForSnapshot(snapshot,category){
  if(!v4SnapshotRevenueAvailable(snapshot,"amazon")) return null;

  const exposure=new Map();
  const apply=(asin,value)=>{
    if(!asin) return;
    exposure.set(asin,Math.max(Number(exposure.get(asin)||0),Number(value||0)));
  };

  v4PriceObservations(snapshot,"amazon",category).forEach(row=>apply(row.asin,row.priceImpact));

  getSnapshotAmazonIssueRows(snapshot,"amazonSuppressions")
    .filter(row=>dashboardCategoryMatches(row,category))
    .forEach(row=>apply(row.asin,row.revenueImpactPerDay));

  getSnapshotAmazonIssueRows(snapshot,"amazonBuyBox")
    .filter(row=>dashboardCategoryMatches(row,category))
    .forEach(row=>apply(row.asin,row.revenueImpactPerDay));

  return Array.from(exposure.values()).reduce((sum,value)=>sum+Number(value||0),0);
}

function v4FlipkartDedupImpactForSnapshot(snapshot,category){
  if(!v4SnapshotRevenueAvailable(snapshot,"flipkart")) return null;

  const exposure=new Map();
  const apply=(fsn,value)=>{
    if(!fsn) return;
    exposure.set(fsn,Math.max(Number(exposure.get(fsn)||0),Number(value||0)));
  };

  v4PriceObservations(snapshot,"flipkart",category).forEach(row=>apply(row.fsn,row.priceImpact));

  getSnapshotFlipkartRows(snapshot)
    .filter(row=>dashboardCategoryMatches(row,category)&&row.buyBoxStatus==="No Buy Box")
    .forEach(row=>apply(row.fsn,row.buyBoxRevenueImpactPerDay));

  return Array.from(exposure.values()).reduce((sum,value)=>sum+Number(value||0),0);
}

function v4SetMoneyMetric(id,value,available){
  const element=document.getElementById(id);
  if(!element) return;
  if(!available){
    element.textContent="Revenue Data Unavailable";
    element.classList.add("no-data-value");
    return;
  }
  element.classList.remove("no-data-value");
  element.textContent=formatINR(Number(value||0));
}

function v4SetPrimaryMetric(id,value,available){
  const element=document.getElementById(id);
  if(!element) return;
  if(!available){
    element.textContent="—";
    element.classList.add("no-data-value");
    return;
  }
  element.classList.remove("no-data-value");
  element.textContent=value;
}

function renderDashboardFromSnapshots(snapshots,period,anchor,category){
  const fromDate=document.getElementById("dashboardFromDate")?.value||anchor||todayIso();
  const toDate=document.getElementById("dashboardToDate")?.value||fromDate;
  const totalDays=v4DaysInclusive(fromDate,toDate);

  const amazonBaseCoverage=v4ModuleCoverage(snapshots,"amazonListing",totalDays);
  const flipkartBaseCoverage=v4ModuleCoverage(snapshots,"flipkartListing",totalDays);

  v4SetAvailabilityChip("amazonDashboardAvailability",amazonBaseCoverage.state);
  v4SetAvailabilityChip("flipkartDashboardAvailability",flipkartBaseCoverage.state);
  finalSetText("amazonDashboardCoverage",`${amazonBaseCoverage.availableDays} / ${totalDays} days`);
  finalSetText("flipkartDashboardCoverage",`${flipkartBaseCoverage.availableDays} / ${totalDays} days`);
  finalSetText("dashboardRangeCoverage",`${snapshots.length} stored day${snapshots.length===1?"":"s"}`);

  const amazonPriceRows=[],flipkartPriceRows=[],amazonSuppressions=[],amazonBuyBoxes=[],flipkartBuyBoxes=[];
  let amazonPriceImpact=0,amazonSuppressionImpact=0,amazonBuyBoxImpact=0;
  let flipkartPriceImpact=0,flipkartBuyBoxImpact=0;
  let amazonRevenueDays=0,flipkartRevenueDays=0;
  let amazonTotalImpact=0,flipkartTotalImpact=0;

  snapshots.forEach(snapshot=>{
    const azPrice=v4PriceObservations(snapshot,"amazon",category);
    const fkPrice=v4PriceObservations(snapshot,"flipkart",category);
    amazonPriceRows.push(...azPrice);
    flipkartPriceRows.push(...fkPrice);

    const suppressionRows=getSnapshotAmazonIssueRows(snapshot,"amazonSuppressions")
      .filter(row=>dashboardCategoryMatches(row,category))
      .map(row=>({...row,reportDate:snapshot.reportDate}));
    const buyBoxRows=getSnapshotAmazonIssueRows(snapshot,"amazonBuyBox")
      .filter(row=>dashboardCategoryMatches(row,category))
      .map(row=>({...row,reportDate:snapshot.reportDate}));
    const fkBuyBox=getSnapshotFlipkartRows(snapshot)
      .filter(row=>dashboardCategoryMatches(row,category)&&row.buyBoxStatus==="No Buy Box")
      .map(row=>({...row,reportDate:snapshot.reportDate}));

    amazonSuppressions.push(...suppressionRows);
    amazonBuyBoxes.push(...buyBoxRows);
    flipkartBuyBoxes.push(...fkBuyBox);

    const amazonRevenue=v4SnapshotRevenueAvailable(snapshot,"amazon");
    const flipkartRevenue=v4SnapshotRevenueAvailable(snapshot,"flipkart");

    if(amazonRevenue && v4SnapshotModuleState(snapshot,"amazonListing")!=="unavailable"){
      amazonRevenueDays+=1;
      amazonPriceImpact+=azPrice.reduce((s,r)=>s+Number(r.priceImpact||0),0);
      amazonSuppressionImpact+=suppressionRows.reduce((s,r)=>s+Number(r.revenueImpactPerDay||0),0);
      amazonBuyBoxImpact+=buyBoxRows.reduce((s,r)=>s+Number(r.revenueImpactPerDay||0),0);
      amazonTotalImpact+=Number(v4AmazonDedupImpactForSnapshot(snapshot,category)||0);
    }

    if(flipkartRevenue && v4SnapshotModuleState(snapshot,"flipkartListing")!=="unavailable"){
      flipkartRevenueDays+=1;
      flipkartPriceImpact+=fkPrice.reduce((s,r)=>s+Number(r.priceImpact||0),0);
      flipkartBuyBoxImpact+=fkBuyBox.reduce((s,r)=>s+Number(r.buyBoxRevenueImpactPerDay||0),0);
      flipkartTotalImpact+=Number(v4FlipkartDedupImpactForSnapshot(snapshot,category)||0);
    }
  });

  const amazonPriceAvailable=amazonPriceRows.length>0||amazonBaseCoverage.availableDays>0;
  const flipkartPriceAvailable=flipkartPriceRows.length>0||flipkartBaseCoverage.availableDays>0;

  const amazonParity=amazonPriceRows.filter(row=>row.parityStatus==="Parity").length;
  const amazonDisparity=amazonPriceRows.filter(row=>row.parityStatus==="Disparity");
  const amazonParityPct=amazonPriceRows.length?amazonParity/amazonPriceRows.length:0;

  const flipkartParity=flipkartPriceRows.filter(row=>row.parityStatus==="Parity").length;
  const flipkartDisparity=flipkartPriceRows.filter(row=>row.parityStatus==="Disparity");
  const flipkartParityPct=flipkartPriceRows.length?flipkartParity/flipkartPriceRows.length:0;

  const amazonDisparityCount=v4UniqueProducts(amazonDisparity,"asin");
  const flipkartDisparityCount=v4UniqueProducts(flipkartDisparity,"fsn");
  const amazonSuppressionCount=v4UniqueProducts(amazonSuppressions,"asin");
  const amazonBuyBoxCount=v4UniqueProducts(amazonBuyBoxes,"asin");
  const flipkartBuyBoxCount=v4UniqueProducts(flipkartBuyBoxes,"fsn");

  const amazonSuppCov=v4ModuleCoverage(snapshots,"amazonSuppression",totalDays);
  const amazonBbCov=v4ModuleCoverage(snapshots,"amazonBuyBox",totalDays);
  const flipkartBbCov=v4ModuleCoverage(snapshots,"flipkartBuyBox",totalDays);

  v4SetPrimaryMetric("amazonParityPercent",formatPercent(amazonParityPct),amazonPriceAvailable);
  v4SetPrimaryMetric("amazonDisparityCount",formatNumber(amazonDisparityCount),amazonPriceAvailable);
  v4SetPrimaryMetric("amazonSuppressedCount",formatNumber(amazonSuppressionCount),amazonSuppCov.availableDays>0);
  v4SetPrimaryMetric("amazonBuyBoxSuppressedCount",formatNumber(amazonBuyBoxCount),amazonBbCov.availableDays>0);
  v4SetPrimaryMetric("flipkartParityPercent",formatPercent(flipkartParityPct),flipkartPriceAvailable);
  v4SetPrimaryMetric("flipkartDisparityCount",formatNumber(flipkartDisparityCount),flipkartPriceAvailable);
  v4SetPrimaryMetric("flipkartNoBuyBoxCount",formatNumber(flipkartBuyBoxCount),flipkartBbCov.availableDays>0);

  finalSetText("amazonParityDetail",amazonPriceAvailable?`${formatNumber(amazonParity)} parity checks`:"No Data Available");
  finalSetText("flipkartParityDetail",flipkartPriceAvailable?`${formatNumber(flipkartParity)} parity checks`:"No Data Available");
  finalSetText("amazonDisparityDetail",amazonPriceAvailable?`${formatNumber(amazonDisparityCount)} ASIN${amazonDisparityCount===1?"":"s"} affected`:"No Data Available");
  finalSetText("amazonSuppressionDetail",amazonSuppCov.availableDays?`${formatNumber(amazonSuppressionCount)} ASIN${amazonSuppressionCount===1?"":"s"}`:"No Data Available");
  finalSetText("amazonBuyBoxDetail",amazonBbCov.availableDays?`${formatNumber(amazonBuyBoxCount)} ASIN${amazonBuyBoxCount===1?"":"s"}`:"No Data Available");
  finalSetText("flipkartDisparityDetail",flipkartPriceAvailable?`${formatNumber(flipkartDisparityCount)} FSN${flipkartDisparityCount===1?"":"s"} affected`:"No Data Available");
  finalSetText("flipkartBuyBoxDetail",flipkartBbCov.availableDays?`${formatNumber(flipkartBuyBoxCount)} FSN${flipkartBuyBoxCount===1?"":"s"}`:"No Data Available");

  const amazonRevenueAvailable=amazonRevenueDays>0;
  const flipkartRevenueAvailable=flipkartRevenueDays>0;

  v4SetMoneyMetric("amazonPriceImpact",amazonPriceImpact,amazonRevenueAvailable&&amazonPriceAvailable);
  v4SetMoneyMetric("amazonSuppressionImpact",amazonSuppressionImpact,amazonRevenueAvailable&&amazonSuppCov.availableDays>0);
  v4SetMoneyMetric("amazonBuyBoxImpact",amazonBuyBoxImpact,amazonRevenueAvailable&&amazonBbCov.availableDays>0);
  v4SetMoneyMetric("flipkartPriceImpact",flipkartPriceImpact,flipkartRevenueAvailable&&flipkartPriceAvailable);
  v4SetMoneyMetric("flipkartBuyBoxImpact",flipkartBuyBoxImpact,flipkartRevenueAvailable&&flipkartBbCov.availableDays>0);

  v4SetMoneyMetric("amazonTotalImpact",amazonTotalImpact,amazonRevenueAvailable);
  v4SetMoneyMetric("amazonTotalImpactBottom",amazonTotalImpact,amazonRevenueAvailable);
  v4SetMoneyMetric("flipkartTotalImpact",flipkartTotalImpact,flipkartRevenueAvailable);
  v4SetMoneyMetric("flipkartTotalImpactBottom",flipkartTotalImpact,flipkartRevenueAvailable);
  v4SetMoneyMetric("marketplaceTotalImpact",amazonTotalImpact+flipkartTotalImpact,amazonRevenueAvailable||flipkartRevenueAvailable);

  const impactCaption=period==="daily"?"Rev Impact / Day":"Revenue Exposure";
  ["amazonPriceImpactLabel","amazonSuppressionImpactLabel","amazonBuyBoxImpactLabel","flipkartPriceImpactLabel","flipkartBuyBoxImpactLabel","amazonTotalImpactLabel","flipkartTotalImpactLabel"]
    .forEach(id=>finalSetText(id,impactCaption));

  const azMeter=document.getElementById("amazonParityMeter");
  if(azMeter) azMeter.style.width=`${Math.max(0,Math.min(100,amazonParityPct*100))}%`;
  const fkMeter=document.getElementById("flipkartParityMeter");
  if(fkMeter) fkMeter.style.width=`${Math.max(0,Math.min(100,flipkartParityPct*100))}%`;

  finalSetText("amazonLiveParityPercent",amazonPriceAvailable?formatPercent(amazonParityPct):"0%");
  finalSetText("amazonLiveDisparityCount",amazonPriceAvailable?formatNumber(amazonDisparityCount):"0");
  finalSetText("flipkartLiveParityPercent",flipkartPriceAvailable?formatPercent(flipkartParityPct):"0%");
  finalSetText("flipkartLiveDisparityCount",flipkartPriceAvailable?formatNumber(flipkartDisparityCount):"0");
  finalSetText("combinedDailyImpact",formatINR(amazonTotalImpact+flipkartTotalImpact));

  const categoryText=category==="all"?"All Categories":category;
  finalSetText("dashboardStatusText",`${fromDate} to ${toDate} · ${categoryText}`);
}

async function v4LoadSnapshotsForRange(fromDate,toDate){
  if(typeof window.listDailySnapshotMetas!=="function") return [];
  const metas=v4MetasInRange(await window.listDailySnapshotMetas(),fromDate,toDate);
  const snapshots=[];
  for(const meta of metas){
    const snapshot=await loadSnapshotCached(meta.reportDate);
    if(snapshot) snapshots.push(snapshot);
  }
  return snapshots;
}

async function loadDashboardOverview(){
  const period=document.getElementById("dashboardPeriod")?.value||"daily";
  const [fromDate,toDate]=v4SetRangeControls("dashboardPeriod","dashboardFromDate","dashboardToDate","dashboardDate");

  const categorySelect=document.getElementById("dashboardCategory");
  const existingCategory=categorySelect?.value||"all";
  const snapshots=await v4LoadSnapshotsForRange(fromDate,toDate);
  dashboardLoadedSnapshots=snapshots;

  const allRows=snapshots.flatMap(snapshot=>[
    ...getSnapshotAmazonRows(snapshot),
    ...getSnapshotFlipkartRows(snapshot)
  ]);
  populateCategorySelectFromRows(categorySelect,allRows,existingCategory);
  const category=categorySelect?.value||"all";

  renderDashboardFromSnapshots(snapshots,period,fromDate,category);
  clearDashboardSearch(false);
}

function renderFinalDashboard(snapshot){
  const date=snapshot?.reportDate||"";
  if(date){
    finalSetText("latestCompletedDateDisplay",`As of ${date}`);

    try{
      const updatedDate =
        snapshot?.updatedAt?.toDate
        ? snapshot.updatedAt.toDate()
        : (
            snapshot?.completedAt?.toDate
            ? snapshot.completedAt.toDate()
            : null
          );

      if(updatedDate){
        finalSetText(
          "dashboardLastUpdated",
          `Last updated · ${updatedDate.toLocaleDateString("en-GB",{day:"2-digit",month:"short"})} ${updatedDate.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`
        );
      }
    }catch(error){}

    const from=document.getElementById("dashboardFromDate");
    const to=document.getElementById("dashboardToDate");
    if(from&&!from.value) from.value=date;
    if(to&&!to.value) to.value=date;
  }
  Promise.resolve().then(()=>loadDashboardOverview()).catch(error=>console.warn("Dashboard refresh failed",error));
}

function openDashboardPriceView(marketplace){
  const liveKey=marketplace==="amazon"?"amazonLive":"flipkartLive";
  const hasLive=dashboardLoadedSnapshots.some(snapshot=>v4SnapshotModuleState(snapshot,liveKey)!=="unavailable");
  openHistoricalModule(`${marketplace}_${hasLive?"live":"listing"}`);
}


/* ---------- Dashboard product search ---------- */

function v4SearchScore(values,query){
  const q=String(query||"").trim().toUpperCase();
  if(!q) return Infinity;
  let score=Infinity;
  (values||[]).forEach(value=>{
    const t=String(value||"").toUpperCase();
    if(t===q) score=Math.min(score,0);
    else if(t.startsWith(q)) score=Math.min(score,1);
    else if(t.includes(q)) score=Math.min(score,2);
  });
  return score;
}

function v4BuildDashboardSearchRows(snapshots,query,category){
  const results=[];

  snapshots.forEach(snapshot=>{
    const suppressionMap=new Map(getSnapshotAmazonIssueRows(snapshot,"amazonSuppressions").map(row=>[row.asin,row]));
    const amazonBuyBoxMap=new Map(getSnapshotAmazonIssueRows(snapshot,"amazonBuyBox").map(row=>[row.asin,row]));
    const amazonLiveAvailable=v4SnapshotModuleState(snapshot,"amazonLive")!=="unavailable";

    getSnapshotAmazonRows(snapshot).forEach(row=>{
      if(!dashboardCategoryMatches(row,category)) return;
      const score=v4SearchScore([row.asin,row.wfSku,row.azSku],query);
      if(!Number.isFinite(score)) return;

      const suppression=suppressionMap.get(row.asin);
      const buyBox=amazonBuyBoxMap.get(row.asin);
      const priceImpact=v4SnapshotRevenueAvailable(snapshot,"amazon")
        ? (amazonLiveAvailable
          ? Number(row.liveDailyRevenueImpact||row.dailyRevenueImpact||0)
          : Number(row.listingDailyRevenueImpact||0))
        : null;
      const suppressionImpact=suppression?.revenueAvailable===false?null:(suppression?.revenueImpactPerDay??0);
      const buyBoxImpact=buyBox?.revenueAvailable===false?null:(buyBox?.revenueImpactPerDay??0);
      const totalExposure=[priceImpact,suppressionImpact,buyBoxImpact]
        .filter(v=>v!==null).reduce((m,v)=>Math.max(m,Number(v||0)),0);

      let issue="";
      if(suppression) issue="ASIN Suppressed";
      else if(buyBox) issue="Buy Box Suppressed";

      results.push({
        score,marketplace:"Amazon",reportDate:snapshot.reportDate,category:row.category,
        wfSku:row.wfSku,marketplaceSku:row.azSku,productId:row.asin,
        listingPrice:row.listingPrice,livePrice:row.finalLivePrice,
        listingStatus:row.listingPriceDisparity?"Disparity":"Parity",
        liveStatus:amazonLiveAvailable
          ? (row.eligibleForComparison?(row.livePriceDisparity?"Disparity":"Parity"):"N/A")
          : "No Data",
        issue,priceImpact,suppressionImpact,buyBoxImpact,totalExposure
      });
    });

    const flipkartLiveAvailable=v4SnapshotModuleState(snapshot,"flipkartLive")!=="unavailable";
    getSnapshotFlipkartRows(snapshot).forEach(row=>{
      if(!dashboardCategoryMatches(row,category)) return;
      const score=v4SearchScore([row.fsn,row.wfSku,row.fkSku],query);
      if(!Number.isFinite(score)) return;

      const priceImpact=v4SnapshotRevenueAvailable(snapshot,"flipkart")
        ? (flipkartLiveAvailable
          ? Number(row.liveDailyRevenueImpact||row.dailyRevenueImpact||0)
          : Number(row.listingDailyRevenueImpact||0))
        : null;
      const buyBoxImpact=row.buyBoxStatus==="No Buy Box"
        ? (v4SnapshotRevenueAvailable(snapshot,"flipkart")
          ? Number(row.buyBoxRevenueImpactPerDay||0)
          : null)
        : 0;
      const totalExposure=[priceImpact,buyBoxImpact].filter(v=>v!==null)
        .reduce((m,v)=>Math.max(m,Number(v||0)),0);

      results.push({
        score,marketplace:"Flipkart",reportDate:snapshot.reportDate,category:row.category,
        wfSku:row.wfSku,marketplaceSku:row.fkSku,productId:row.fsn,
        listingPrice:row.listingPrice,livePrice:row.finalLivePrice,
        listingStatus:row.listingPriceDisparity?"Disparity":"Parity",
        liveStatus:flipkartLiveAvailable
          ? (row.eligibleForComparison?(row.livePriceDisparity?"Disparity":"Parity"):"N/A")
          : "No Data",
        issue:row.buyBoxStatus==="No Buy Box"?"Buy Box Unavailable":"",
        priceImpact,suppressionImpact:0,buyBoxImpact,totalExposure
      });
    });
  });

  return results.sort((a,b)=>a.score-b.score||String(b.reportDate).localeCompare(String(a.reportDate)));
}

function v4MoneyOrNA(value){
  return value===null||value===undefined ? "Revenue Data Unavailable" : formatINR(Number(value||0));
}

function renderDashboardSearchResults(rows,period="daily"){
  const panel=document.getElementById("dashboardSearchResults");
  const table=document.getElementById("dashboardSearchTable");
  if(!panel||!table) return;
  panel.hidden=false;

  if(!rows.length){
    finalSetText("dashboardSearchCount","0 results");
    table.innerHTML=`<tbody><tr><td class="empty-row">No matching ASIN, FSN or SKU</td></tr></tbody>`;
    return;
  }

  if(period!=="daily"){
    const groups=new Map();
    rows.forEach(row=>{
      const key=[row.marketplace,row.productId,row.marketplaceSku].join("||");
      if(!groups.has(key)){
        groups.set(key,{
          marketplace:row.marketplace,category:row.category,wfSku:row.wfSku,
          marketplaceSku:row.marketplaceSku,productId:row.productId,
          dates:new Set(),parityDates:new Set(),disparityDates:new Set(),
          suppressionDates:new Set(),buyBoxDates:new Set(),
          priceExposure:0,suppressionExposure:0,buyBoxExposure:0,totalExposure:0
        });
      }
      const g=groups.get(key);
      g.dates.add(row.reportDate);
      const finalStatus=row.liveStatus==="No Data"?row.listingStatus:row.liveStatus;
      if(finalStatus==="Parity") g.parityDates.add(row.reportDate);
      if(finalStatus==="Disparity") g.disparityDates.add(row.reportDate);
      if(row.issue==="ASIN Suppressed") g.suppressionDates.add(row.reportDate);
      if(row.issue==="Buy Box Suppressed"||row.issue==="Buy Box Unavailable") g.buyBoxDates.add(row.reportDate);
      g.priceExposure+=Number(row.priceImpact||0);
      g.suppressionExposure+=Number(row.suppressionImpact||0);
      g.buyBoxExposure+=Number(row.buyBoxImpact||0);
      g.totalExposure+=Number(row.totalExposure||0);
    });

    const summarized=Array.from(groups.values()).sort((a,b)=>b.totalExposure-a.totalExposure);
    finalSetText("dashboardSearchCount",`${summarized.length} product${summarized.length===1?"":"s"}`);

    let html=`<thead><tr>
      <th>Marketplace</th><th>Category</th><th>WF SKU</th><th>Marketplace SKU</th>
      <th>ASIN / FSN</th><th>Available Days</th><th>Parity Days</th><th>Disparity Days</th>
      <th>Suppression Days</th><th>Buy Box Days</th><th>Price Exposure</th>
      <th>Suppression Exposure</th><th>Buy Box Exposure</th><th>Total Exposure</th>
    </tr></thead><tbody>`;

    summarized.slice(0,1000).forEach(row=>{
      html+=`<tr>
        <td>${escapeHtml(row.marketplace)}</td><td>${escapeHtml(row.category||"")}</td>
        <td>${escapeHtml(row.wfSku||"")}</td><td>${escapeHtml(row.marketplaceSku||"")}</td>
        <td>${escapeHtml(row.productId||"")}</td><td>${formatNumber(row.dates.size)}</td>
        <td class="parity">${formatNumber(row.parityDates.size)}</td>
        <td class="disparity">${formatNumber(row.disparityDates.size)}</td>
        <td>${formatNumber(row.suppressionDates.size)}</td><td>${formatNumber(row.buyBoxDates.size)}</td>
        <td>${formatINR(row.priceExposure)}</td><td>${formatINR(row.suppressionExposure)}</td>
        <td>${formatINR(row.buyBoxExposure)}</td><td><strong>${formatINR(row.totalExposure)}</strong></td>
      </tr>`;
    });
    html+="</tbody>";
    table.innerHTML=html;
    return;
  }

  finalSetText("dashboardSearchCount",`${rows.length} result${rows.length===1?"":"s"}`);

  let html=`<thead><tr>
    <th>Marketplace</th><th>Date</th><th>Category</th><th>WF SKU</th><th>Marketplace SKU</th>
    <th>ASIN / FSN</th><th>Listing Price</th><th>Live Price</th><th>Listing Status</th>
    <th>Live Status</th><th>Issue</th><th>Price Impact</th><th>Suppression Impact</th>
    <th>Buy Box Impact</th><th>Total Impact</th>
  </tr></thead><tbody>`;

  rows.slice(0,1000).forEach(row=>{
    html+=`<tr>
      <td>${escapeHtml(row.marketplace)}</td><td>${escapeHtml(row.reportDate)}</td>
      <td>${escapeHtml(row.category||"")}</td><td>${escapeHtml(row.wfSku||"")}</td>
      <td>${escapeHtml(row.marketplaceSku||"")}</td><td>${escapeHtml(row.productId||"")}</td>
      <td>${Number(row.listingPrice)>0?formatINR(row.listingPrice):"—"}</td>
      <td>${Number(row.livePrice)>0?formatINR(row.livePrice):"—"}</td>
      <td>${escapeHtml(row.listingStatus||"")}</td><td>${escapeHtml(row.liveStatus||"")}</td>
      <td>${escapeHtml(row.issue||"")}</td><td>${escapeHtml(v4MoneyOrNA(row.priceImpact))}</td>
      <td>${escapeHtml(v4MoneyOrNA(row.suppressionImpact))}</td>
      <td>${escapeHtml(v4MoneyOrNA(row.buyBoxImpact))}</td>
      <td><strong>${formatINR(row.totalExposure||0)}</strong></td>
    </tr>`;
  });
  html+="</tbody>";
  table.innerHTML=html;
}

async function runDashboardSearch(){
  const query=document.getElementById("dashboardGlobalSearch")?.value?.trim()||"";
  if(!query){ clearDashboardSearch(); return; }
  if(!dashboardLoadedSnapshots.length) await loadDashboardOverview();

  const category=document.getElementById("dashboardCategory")?.value||"all";
  const rows=v4BuildDashboardSearchRows(dashboardLoadedSnapshots,query,category);
  const period=document.getElementById("dashboardPeriod")?.value||"daily";
  renderDashboardSearchResults(rows,period);
}

/* ======================================================
   HISTORICAL REPORT V4
====================================================== */

function v4HistoricalModuleKey(def){
  if(def.marketplace==="amazon"){
    if(def.type==="suppression") return "amazonSuppression";
    if(def.type==="amazon_buybox") return "amazonBuyBox";
    if(def.kind==="listing") return "amazonListing";
    if(def.kind==="live") return "amazonLive";
    return "amazonMrp";
  }
  if(def.type==="flipkart_buybox") return "flipkartBuyBox";
  if(def.kind==="listing") return "flipkartListing";
  if(def.kind==="live") return "flipkartLive";
  return "flipkartMrp";
}

function v4RevenueAvailableForDef(snapshot,def){
  if(def.type==="price"&&def.kind==="mrp") return true;
  return v4SnapshotRevenueAvailable(snapshot,def.marketplace);
}

function makeReportSummary(def,rows){
  const categories=new Set(rows.map(row=>row.category).filter(Boolean)).size;
  const dates=new Set(rows.map(row=>row.reportDate).filter(Boolean)).size;

  if(def.type==="price"){
    const parity=rows.filter(row=>row.parityStatus==="Parity").length;
    const disparity=rows.length-parity;

    if(def.kind==="mrp"){
      return [
        {label:"Eligible",value:rows.length,type:"number"},
        {label:"Parity",value:parity,type:"number"},
        {label:"Disparity",value:disparity,type:"number"},
        {label:"Parity %",value:rows.length?parity/rows.length:0,type:"percent"},
        {label:"Disparity %",value:rows.length?disparity/rows.length:0,type:"percent"},
        {label:"Categories",value:categories,type:"number"}
      ];
    }

    const revenueRows=rows.filter(row=>row.revenueAvailable!==false);
    const impact=revenueRows.reduce((sum,row)=>sum+Number(reportRowImpact(def,row)||0),0);

    return [
      {label:"Eligible",value:rows.length,type:"number"},
      {label:"Parity",value:parity,type:"number"},
      {label:"Disparity",value:disparity,type:"number"},
      {label:"Parity %",value:rows.length?parity/rows.length:0,type:"percent"},
      {label:"Disparity %",value:rows.length?disparity/rows.length:0,type:"percent"},
      {label:"Revenue Impact",value:revenueRows.length?impact:"Unavailable",type:revenueRows.length?"money":"text"}
    ];
  }

  const idKey=def.marketplace==="amazon"?"asin":"fsn";
  const uniqueIssues=uniqueIdentifierCount(rows,idKey);
  const revenueRows=rows.filter(row=>row.revenueAvailable!==false);
  const exposure=revenueRows.reduce((sum,row)=>sum+Number(reportRowImpact(def,row)||0),0);

  return [
    {label:def.marketplace==="amazon"?"Unique ASINs":"Unique FSNs",value:uniqueIssues,type:"number"},
    {label:def.type==="suppression"?"Suppression Days":(def.type==="amazon_buybox"?"Buy Box Days":"No Buy Box Days"),value:rows.length,type:"number"},
    {label:"Avg / Day",value:dates?rows.length/dates:0,type:"decimal"},
    {label:"Revenue Exposure",value:revenueRows.length?exposure:"Unavailable",type:revenueRows.length?"money":"text"},
    {label:"Categories",value:categories,type:"number"},
    {label:"Available Dates",value:dates,type:"number"}
  ];
}

function formatReportSummaryValue(item){
  if(item.type==="text") return String(item.value||"—");
  if(item.type==="money") return formatINR(Number(item.value||0));
  if(item.type==="percent") return formatPercent(Number(item.value||0));
  if(item.type==="decimal") return Number(item.value||0).toFixed(1);
  return formatNumber(Number(item.value||0));
}

async function loadHistoricalModule(){
  const def=HISTORICAL_VIEWS[currentHistoricalViewKey];
  if(!def||typeof window.listDailySnapshotMetas!=="function") return;

  const period=document.getElementById("reportPeriod")?.value||"daily";
  const [fromDate,toDate]=v4SetRangeControls("reportPeriod","reportFromDate","reportToDate","reportAnchorDate");

  const metas=v4MetasInRange(await window.listDailySnapshotMetas(),fromDate,toDate);
  const allSnapshots=[];
  for(const meta of metas){
    const snapshot=await loadSnapshotCached(meta.reportDate);
    if(snapshot) allSnapshots.push(snapshot);
  }

  const moduleKey=v4HistoricalModuleKey(def);
  const snapshots=allSnapshots.filter(snapshot=>v4SnapshotModuleState(snapshot,moduleKey)!=="unavailable");
  const totalDays=v4DaysInclusive(fromDate,toDate);
  const coverage=v4ModuleCoverage(allSnapshots,moduleKey,totalDays);

  finalSetText("reportAvailability",coverage.state==="unavailable"?"No Data Available":(coverage.state==="partial"?"Partial Data":"Available"));
  finalSetText("reportCoverage",`${coverage.availableDays} / ${totalDays} days`);

  const compiled=compileHistoricalView(def,snapshots);
  const snapshotMap=new Map(snapshots.map(snapshot=>[snapshot.reportDate,snapshot]));
  compiled.rows.forEach(row=>{
    row.revenueAvailable=v4RevenueAvailableForDef(snapshotMap.get(row.reportDate),def);
  });

  const categorySelect=document.getElementById("reportCategory");
  const existingCategory=categorySelect?.value||"all";
  populateCategorySelectFromRows(categorySelect,compiled.rows,existingCategory);
  configureReportSort(def,false);

  currentHistoricalReport={
    def,period,anchor:fromDate,fromDate,toDate,snapshots,allSnapshots,moduleKey,coverage,
    baseRows:compiled.rows,rows:[],summary:[]
  };

  applyHistoricalFilters();
}

function reportFilename(prefix,period,anchor,toDate=null){
  if(period==="daily") return `${prefix}_${anchor}.xlsx`;
  const finalTo=toDate||(period==="weekly"?getWeekBounds(anchor)[1]:(period==="monthly"?v4DateRangeForPeriod("monthly",anchor,anchor)[1]:anchor));
  return `${prefix}_${anchor}_to_${finalTo}.xlsx`;
}

function v4HistoricalCleanRows(def,rows){
  return rows.map(row=>{
    if(def.type==="price"){
      const isAmazon=def.marketplace==="amazon";
      const base={
        Date:row.reportDate,Category:row.category,"WF SKU":row.wfSku,
        [isAmazon?"AZ SKU":"FK SKU"]:isAmazon?row.azSku:row.fkSku,
        [isAmazon?"ASIN":"FSN"]:isAmazon?row.asin:row.fsn,
        Status:row.parityStatus,Inventory:row.inventory
      };

      if(def.kind==="mrp"){
        return {
          ...base,"WF MRP":row.wfMrp,
          [isAmazon?"AZ MRP":"FK MRP"]:isAmazon?row.azMrp:row.fkMrp,
          "MRP Diff":row.mrpDiff
        };
      }

      const live=def.kind==="live";
      return {
        ...base,"WF Price":row.wfPrice,
        [live?"Live Price":"Listing Price"]:live?row.finalLivePrice:row.listingPrice,
        "Price Diff":live?row.livePriceDiff:row.listingPriceDiff,
        "Rev Impact / Day":row.revenueAvailable===false?"Revenue Data Unavailable":reportRowImpact(def,row)
      };
    }

    if(def.type==="suppression"){
      return {
        Date:row.reportDate,Category:row.category,ASIN:row.asin,
        "Rev Impact / Day":row.revenueAvailable===false?"Revenue Data Unavailable":row.revenueImpactPerDay
      };
    }

    if(def.type==="amazon_buybox"){
      return {
        Date:row.reportDate,Category:row.category,ASIN:row.asin,"WF SKU":row.wfSku,"AZ SKU":row.azSku,
        Price:row.listingPrice,
        "Rev Impact / Day":row.revenueAvailable===false?"Revenue Data Unavailable":row.revenueImpactPerDay
      };
    }

    return {
      Date:row.reportDate,Category:row.category,FSN:row.fsn,"WF SKU":row.wfSku,"FK SKU":row.fkSku,
      "Listing Price":row.listingPrice,
      "Rev Impact / Day":row.revenueAvailable===false?"Revenue Data Unavailable":row.buyBoxRevenueImpactPerDay
    };
  });
}

function downloadHistoricalModule(){
  if(!currentHistoricalReport){
    loadHistoricalModule().then(downloadHistoricalModule);
    return;
  }
  const {def,period,fromDate,toDate,rows,summary}=currentHistoricalReport;
  const cleanRows=v4HistoricalCleanRows(def,rows);
  const safePrefix=def.title.replace(/[^A-Za-z0-9]+/g,"_");
  writeExcelReport(reportFilename(safePrefix,period,fromDate,toDate),summaryArrayToObject(summary),cleanRows);
}


/* ======================================================
   MARKETPLACE INSIGHTS V4
====================================================== */

async function loadMarketplaceInsights(forceMarketplace=null){
  if(typeof window.listDailySnapshotMetas!=="function") return;

  if(forceMarketplace){
    const select=document.getElementById("insightsMarketplace");
    if(select) select.value=forceMarketplace;
  }

  const marketplace=document.getElementById("insightsMarketplace")?.value||"amazon";
  const period=document.getElementById("insightsPeriod")?.value||"daily";
  const [fromDate,toDate]=v4SetRangeControls("insightsPeriod","insightsFromDate","insightsToDate","insightsDate");
  const snapshots=await v4LoadSnapshotsForRange(fromDate,toDate);
  const totalDays=v4DaysInclusive(fromDate,toDate);
  const moduleKey=marketplace==="amazon"?"amazonListing":"flipkartListing";
  const coverage=v4ModuleCoverage(snapshots,moduleKey,totalDays);

  finalSetText("insightsAvailability",coverage.state==="unavailable"?"No Data Available":(coverage.state==="partial"?"Partial Data":"Available"));
  finalSetText("insightsCoverage",`${coverage.availableDays} / ${totalDays} days`);

  let totalObservations=0,parity=0,disparity=0,impact=0,issues=0,revenueDays=0;
  const rows=[];

  snapshots.forEach(snapshot=>{
    const priceRows=v4PriceObservations(snapshot,marketplace,"all");
    const dayParity=priceRows.filter(row=>row.parityStatus==="Parity").length;
    const dayDisparity=priceRows.filter(row=>row.parityStatus==="Disparity").length;

    totalObservations+=priceRows.length;
    parity+=dayParity;
    disparity+=dayDisparity;

    let dayImpact=0;
    let dayIssues=0;

    if(marketplace==="amazon"){
      dayIssues=getSnapshotAmazonIssueRows(snapshot,"amazonSuppressions").length+
        getSnapshotAmazonIssueRows(snapshot,"amazonBuyBox").length;
      const dedup=v4AmazonDedupImpactForSnapshot(snapshot,"all");
      if(dedup!==null){ revenueDays+=1; dayImpact=dedup; impact+=dedup; }
    }else{
      dayIssues=v4UniqueProducts(
        getSnapshotFlipkartRows(snapshot).filter(row=>row.buyBoxStatus==="No Buy Box"),
        "fsn"
      );
      const dedup=v4FlipkartDedupImpactForSnapshot(snapshot,"all");
      if(dedup!==null){ revenueDays+=1; dayImpact=dedup; impact+=dedup; }
    }

    issues+=dayIssues;
    rows.push({
      Date:snapshot.reportDate,
      Parity:dayParity,
      Disparity:dayDisparity,
      "Parity %":priceRows.length?formatPercent(dayParity/priceRows.length):"—",
      "Revenue Impact":v4SnapshotRevenueAvailable(snapshot,marketplace)?dayImpact:"Revenue Data Unavailable",
      Issues:dayIssues
    });
  });

  finalSetText("insightsParity",totalObservations?formatPercent(parity/totalObservations):"—");
  finalSetText("insightsDisparity",totalObservations?formatNumber(disparity):"—");
  finalSetText("insightsImpact",revenueDays?formatINR(impact):"Revenue Data Unavailable");
  finalSetText("insightsIssues",snapshots.length?formatNumber(issues):"—");

  const table=document.getElementById("insightsTable");
  let html=`<thead><tr><th>Date</th><th>Parity</th><th>Disparity</th><th>Parity %</th><th>Revenue Impact</th><th>Issues</th></tr></thead><tbody>`;
  if(!rows.length) html+=`<tr><td class="empty-row" colspan="6">No Data Available</td></tr>`;
  rows.forEach(row=>{
    html+=`<tr>
      <td>${escapeHtml(row.Date)}</td><td>${formatNumber(row.Parity)}</td>
      <td>${formatNumber(row.Disparity)}</td><td>${escapeHtml(row["Parity %"])}</td>
      <td>${typeof row["Revenue Impact"]==="number"?formatINR(row["Revenue Impact"]):escapeHtml(row["Revenue Impact"])}</td>
      <td>${formatNumber(row.Issues)}</td>
    </tr>`;
  });
  html+="</tbody>";
  if(table) table.innerHTML=html;

  currentInsightsReport={
    market:marketplace,period,fromDate,toDate,rows,
    summary:{
      "Parity %":totalObservations?parity/totalObservations:0,
      Disparity:disparity,
      "Revenue Impact":revenueDays?impact:"Revenue Data Unavailable",
      Issues:issues,
      "Available Days":coverage.availableDays
    }
  };
}

function downloadMarketplaceInsights(){
  if(!currentInsightsReport){
    loadMarketplaceInsights().then(downloadMarketplaceInsights);
    return;
  }
  const report=currentInsightsReport;
  writeExcelReport(
    reportFilename(`${report.market}_Marketplace_Insights`,report.period,report.fromDate,report.toDate),
    report.summary,
    report.rows
  );
}

/* ======================================================
   MARKETPLACE DATA
====================================================== */

function openMarketplaceData(){
  showView("marketplaceDataSection");
  const dateInput=document.getElementById("marketplaceDataDate");
  const latest=document.getElementById("latestCompletedDateDisplay")?.textContent?.replace("As of ","");
  if(dateInput&&!dateInput.value&&latest&&latest!=="—") dateInput.value=latest;
  loadMarketplaceData();
}

function v4MarketplaceDataAmazonRows(snapshot){
  return getSnapshotAmazonRows(snapshot).map(row=>({
    Marketplace:"Amazon",
    Category:row.category,
    "WF SKU":row.wfSku,
    "AZ SKU":row.azSku,
    ASIN:row.asin,
    "WF MRP":row.wfMrp,
    "WF Price":row.wfPrice,
    "AZ MRP":row.azMrp,
    "Listing Price":row.listingPrice,
    "Live Price":row.finalLivePrice,
    Inventory:row.inventory,
    "ASIN Revenue":row.revenueAvailable===false?null:row.asinRevenue,
    "Listing Status":row.listingPriceDisparity?"Disparity":"Parity",
    "Live Status":row.auditAvailable
      ? (row.eligibleForComparison?(row.livePriceDisparity?"Disparity":"Parity"):"N/A")
      : "No Data",
    Suppression:row.suppressionStatus,
    "Buy Box":row.buyBoxStatus
  }));
}

function v4MarketplaceDataFlipkartRows(snapshot){
  return getSnapshotFlipkartRows(snapshot).map(row=>({
    Marketplace:"Flipkart",
    Category:row.category,
    "WF SKU":row.wfSku,
    "FK SKU":row.fkSku,
    FSN:row.fsn,
    "WF MRP":row.wfMrp,
    "WF Price":row.wfPrice,
    "FK MRP":row.fkMrp,
    "Listing Price":row.listingPrice,
    "Live Price":row.finalLivePrice,
    Inventory:row.inventory,
    "Orders Received":row.revenueAvailable===false?null:row.ordersReceived,
    "Revenue Quantity":row.revenueAvailable===false?null:row.revenueQuantity,
    Revenue:row.revenueAvailable===false?null:(row.liveCalculatedRevenue||row.listingCalculatedRevenue||row.calculatedRevenue||0),
    "Listing Status":row.listingPriceDisparity?"Disparity":"Parity",
    "Live Status":row.auditAvailable
      ? (row.eligibleForComparison?(row.livePriceDisparity?"Disparity":"Parity"):"N/A")
      : "No Data",
    "Buy Box":row.buyBoxStatus
  }));
}

function v4MarketplaceDataAllRows(snapshot){
  const amazon=v4MarketplaceDataAmazonRows(snapshot).map(row=>({
    Marketplace:"Amazon",Category:row.Category,"WF SKU":row["WF SKU"],
    "Marketplace SKU":row["AZ SKU"],"ASIN / FSN":row.ASIN,
    "WF MRP":row["WF MRP"],"WF Price":row["WF Price"],
    "Marketplace MRP":row["AZ MRP"],"Listing Price":row["Listing Price"],
    "Live Price":row["Live Price"],Inventory:row.Inventory,Revenue:row["ASIN Revenue"],
    Status:row["Live Status"]==="No Data"?row["Listing Status"]:row["Live Status"]
  }));
  const flipkart=v4MarketplaceDataFlipkartRows(snapshot).map(row=>({
    Marketplace:"Flipkart",Category:row.Category,"WF SKU":row["WF SKU"],
    "Marketplace SKU":row["FK SKU"],"ASIN / FSN":row.FSN,
    "WF MRP":row["WF MRP"],"WF Price":row["WF Price"],
    "Marketplace MRP":row["FK MRP"],"Listing Price":row["Listing Price"],
    "Live Price":row["Live Price"],Inventory:row.Inventory,Revenue:row.Revenue,
    Status:row["Live Status"]==="No Data"?row["Listing Status"]:row["Live Status"]
  }));
  return [...amazon,...flipkart];
}

function v4MinPositive(values){
  const nums=values.map(Number).filter(v=>Number.isFinite(v)&&v>0);
  return nums.length?Math.min(...nums):null;
}

function v4MarketplaceMappingRows(snapshot){
  const amazonRows=getSnapshotAmazonRows(snapshot);
  const flipkartRows=getSnapshotFlipkartRows(snapshot);
  const groups=new Map();

  const ensure=(category,wfSku)=>{
    const key=`${category}||${wfSku}`;
    if(!groups.has(key)){
      groups.set(key,{
        Category:category,"WF SKU":wfSku,azSkus:new Set(),asins:new Set(),
        fkSkus:new Set(),fsns:new Set(),amazonPrices:[],flipkartPrices:[],
        amazonLive:[],flipkartLive:[],wfMrps:[],wfPrices:[],
        amazonRevenueByAsin:new Map(),flipkartRevenueByFsn:new Map()
      });
    }
    return groups.get(key);
  };

  amazonRows.forEach(row=>{
    const g=ensure(row.category,row.wfSku);
    if(row.azSku) g.azSkus.add(row.azSku);
    if(row.asin) g.asins.add(row.asin);
    g.amazonPrices.push(row.listingPrice);
    g.amazonLive.push(row.finalLivePrice);
    g.wfMrps.push(row.wfMrp);
    g.wfPrices.push(row.wfPrice);
    if(row.revenueAvailable!==false&&row.asin){
      g.amazonRevenueByAsin.set(
        row.asin,
        Math.max(Number(g.amazonRevenueByAsin.get(row.asin)||0),Number(row.asinRevenue||0))
      );
    }
  });

  flipkartRows.forEach(row=>{
    const g=ensure(row.category,row.wfSku);
    if(row.fkSku) g.fkSkus.add(row.fkSku);
    if(row.fsn) g.fsns.add(row.fsn);
    g.flipkartPrices.push(row.listingPrice);
    g.flipkartLive.push(row.finalLivePrice);
    g.wfMrps.push(row.wfMrp);
    g.wfPrices.push(row.wfPrice);
    if(row.revenueAvailable!==false&&row.fsn){
      g.flipkartRevenueByFsn.set(
        row.fsn,
        Math.max(
          Number(g.flipkartRevenueByFsn.get(row.fsn)||0),
          Number(row.liveCalculatedRevenue||row.listingCalculatedRevenue||row.calculatedRevenue||0)
        )
      );
    }
  });

  return Array.from(groups.values()).map(g=>{
    const amazonRevenue=Array.from(g.amazonRevenueByAsin.values()).reduce((s,v)=>s+Number(v||0),0);
    const flipkartRevenue=Array.from(g.flipkartRevenueByFsn.values()).reduce((s,v)=>s+Number(v||0),0);
    return {
      Category:g.Category,"WF SKU":g["WF SKU"],
      "AZ SKU":Array.from(g.azSkus).sort().join(", "),
      ASIN:Array.from(g.asins).sort().join(", "),
      "FK SKU":Array.from(g.fkSkus).sort().join(", "),
      FSN:Array.from(g.fsns).sort().join(", "),
      "WF MRP":v4MinPositive(g.wfMrps),
      "WF Price":v4MinPositive(g.wfPrices),
      "Amazon Price":v4MinPositive(g.amazonPrices),
      "Amazon Live Price":v4MinPositive(g.amazonLive),
      "Flipkart Price":v4MinPositive(g.flipkartPrices),
      "Flipkart Live Price":v4MinPositive(g.flipkartLive),
      "Amazon Revenue":g.amazonRevenueByAsin.size?amazonRevenue:null,
      "Flipkart Revenue":g.flipkartRevenueByFsn.size?flipkartRevenue:null,
      Availability:g.asins.size&&g.fsns.size?"Amazon + Flipkart":(g.asins.size?"Amazon":"Flipkart")
    };
  });
}

function v4DataTypeColumns(view,type,rows){
  const allColumns=Array.from(new Set(rows.flatMap(row=>Object.keys(row))));
  const sets={
    amazon:{
      core:["Category","WF SKU","AZ SKU","ASIN"],
      pricing:["Category","WF SKU","AZ SKU","ASIN","WF MRP","WF Price","AZ MRP","Listing Price","Live Price","Listing Status","Live Status"],
      inventory:["Category","WF SKU","AZ SKU","ASIN","Inventory"],
      revenue:["Category","WF SKU","AZ SKU","ASIN","ASIN Revenue"]
    },
    flipkart:{
      core:["Category","WF SKU","FK SKU","FSN"],
      pricing:["Category","WF SKU","FK SKU","FSN","WF MRP","WF Price","FK MRP","Listing Price","Live Price","Listing Status","Live Status"],
      inventory:["Category","WF SKU","FK SKU","FSN","Inventory"],
      revenue:["Category","WF SKU","FK SKU","FSN","Orders Received","Revenue Quantity","Revenue"]
    },
    all:{
      core:["Marketplace","Category","WF SKU","Marketplace SKU","ASIN / FSN"],
      pricing:["Marketplace","Category","WF SKU","Marketplace SKU","ASIN / FSN","WF MRP","WF Price","Marketplace MRP","Listing Price","Live Price","Status"],
      inventory:["Marketplace","Category","WF SKU","Marketplace SKU","ASIN / FSN","Inventory"],
      revenue:["Marketplace","Category","WF SKU","Marketplace SKU","ASIN / FSN","Revenue"]
    },
    mapping:{
      core:["Category","WF SKU","AZ SKU","ASIN","FK SKU","FSN","Availability"],
      pricing:["Category","WF SKU","ASIN","FSN","WF MRP","WF Price","Amazon Price","Amazon Live Price","Flipkart Price","Flipkart Live Price"],
      inventory:["Category","WF SKU","ASIN","FSN","Availability"],
      revenue:["Category","WF SKU","ASIN","FSN","Amazon Revenue","Flipkart Revenue"]
    }
  };
  if(type==="full") return allColumns;
  return (sets?.[view]?.[type]||allColumns).filter(column=>allColumns.includes(column));
}

function v4PopulateMarketplaceDataColumns(columns){
  const container=document.getElementById("marketplaceDataColumns");
  if(!container) return;
  container.innerHTML=columns.map(column=>`<label class="column-option">
    <input type="checkbox" value="${escapeHtml(column)}" checked><span>${escapeHtml(column)}</span>
  </label>`).join("");
  container.querySelectorAll("input").forEach(input=>input.addEventListener("change",renderMarketplaceDataTable));
}

function v4SelectedMarketplaceDataColumns(){
  const checked=Array.from(document.querySelectorAll("#marketplaceDataColumns input:checked")).map(input=>input.value);
  return checked.length?checked:(currentMarketplaceData?.defaultColumns||[]);
}

function v4MarketplaceDataSearchMatch(row,query){
  if(!query) return true;
  const q=String(query).toUpperCase();
  return Object.values(row).some(value=>String(value??"").toUpperCase().includes(q));
}

function v4MarketplaceDataRevenue(row){
  return Number(row.Revenue??row["ASIN Revenue"]??row["Amazon Revenue"]??row["Flipkart Revenue"]??0);
}

function v4MarketplaceDataPrice(row){
  return Number(
    row["Live Price"]??row["Listing Price"]??row["Amazon Live Price"]??row["Amazon Price"]??
    row["Flipkart Live Price"]??row["Flipkart Price"]??0
  );
}

function v4ApplyMarketplaceDataFilters(){
  if(!currentMarketplaceData) return [];
  const category=document.getElementById("marketplaceDataCategory")?.value||"all";
  const query=document.getElementById("marketplaceDataSearch")?.value?.trim()||"";
  const sort=document.getElementById("marketplaceDataSort")?.value||"revenue_desc";

  const rows=currentMarketplaceData.baseRows.filter(row=>
    (category==="all"||String(row.Category||"")===category) &&
    v4MarketplaceDataSearchMatch(row,query)
  );

  rows.sort((a,b)=>{
    if(sort==="revenue_desc") return v4MarketplaceDataRevenue(b)-v4MarketplaceDataRevenue(a);
    if(sort==="revenue_asc") return v4MarketplaceDataRevenue(a)-v4MarketplaceDataRevenue(b);
    if(sort==="category_asc") return String(a.Category||"").localeCompare(String(b.Category||""));
    if(sort==="wfsku_asc") return String(a["WF SKU"]||"").localeCompare(String(b["WF SKU"]||""));
    if(sort==="price_desc") return v4MarketplaceDataPrice(b)-v4MarketplaceDataPrice(a);
    return String(a.ASIN||a.FSN||a["ASIN / FSN"]||"").localeCompare(String(b.ASIN||b.FSN||b["ASIN / FSN"]||""));
  });

  currentMarketplaceData.rows=rows;
  return rows;
}

function v4MarketplaceCell(value){
  if(value===null||value===undefined||value==="") return "—";
  if(typeof value==="number"){
    return Number.isInteger(value)?formatNumber(value):Number(value).toLocaleString("en-IN",{maximumFractionDigits:2});
  }
  return escapeHtml(value);
}

function renderMarketplaceDataTable(){
  const table=document.getElementById("marketplaceDataTable");
  if(!table||!currentMarketplaceData) return;

  const rows=v4ApplyMarketplaceDataFilters();
  const columns=v4SelectedMarketplaceDataColumns();
  finalSetText("marketplaceDataRowCount",`${formatNumber(rows.length)} rows`);
  finalSetText("marketplaceDataCategoryCount",`${formatNumber(new Set(rows.map(row=>row.Category).filter(Boolean)).size)} categories`);

  if(!rows.length||!columns.length){
    table.innerHTML=`<tbody><tr><td class="empty-row">No Data Available</td></tr></tbody>`;
    return;
  }

  let html="<thead><tr>"+columns.map(column=>`<th>${escapeHtml(column)}</th>`).join("")+"</tr></thead><tbody>";
  rows.slice(0,2500).forEach(row=>{
    html+="<tr>"+columns.map(column=>`<td>${v4MarketplaceCell(row[column])}</td>`).join("")+"</tr>";
  });
  html+="</tbody>";
  table.innerHTML=html;
}

async function loadMarketplaceData(){
  const date=document.getElementById("marketplaceDataDate")?.value||todayIso();
  const view=document.getElementById("marketplaceDataView")?.value||"all";
  const type=document.getElementById("marketplaceDataType")?.value||"core";
  const snapshot=await loadSnapshotCached(date);

  if(!snapshot){
    currentMarketplaceData={date,view,type,baseRows:[],rows:[],defaultColumns:[]};
    v4SetAvailabilityChip("marketplaceDataAvailability","unavailable","No Data Available");
    finalSetText("marketplaceDataAsOf",`As of ${date}`);
    v4PopulateMarketplaceDataColumns([]);
    renderMarketplaceDataTable();
    return;
  }

  let rows;
  if(view==="amazon") rows=v4MarketplaceDataAmazonRows(snapshot);
  else if(view==="flipkart") rows=v4MarketplaceDataFlipkartRows(snapshot);
  else if(view==="mapping") rows=v4MarketplaceMappingRows(snapshot);
  else rows=v4MarketplaceDataAllRows(snapshot);

  const defaultColumns=v4DataTypeColumns(view,type,rows);
  currentMarketplaceData={date,view,type,snapshot,baseRows:rows,rows:rows.slice(),defaultColumns};

  const categorySelect=document.getElementById("marketplaceDataCategory");
  const categories=Array.from(new Set(rows.map(row=>row.Category).filter(Boolean))).sort((a,b)=>String(a).localeCompare(String(b)));
  const oldCategory=categorySelect?.value||"all";
  if(categorySelect){
    categorySelect.innerHTML=`<option value="all">All Categories</option>`+
      categories.map(category=>`<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
    categorySelect.value=categories.includes(oldCategory)?oldCategory:"all";
  }

  v4PopulateMarketplaceDataColumns(defaultColumns);
  v4SetAvailabilityChip("marketplaceDataAvailability",rows.length?"available":"unavailable",rows.length?"Available":"No Data Available");
  finalSetText("marketplaceDataAsOf",`As of ${date}`);
  renderMarketplaceDataTable();
}

function downloadMarketplaceData(){
  if(!currentMarketplaceData){
    loadMarketplaceData().then(downloadMarketplaceData);
    return;
  }

  const rows=v4ApplyMarketplaceDataFilters();
  const columns=v4SelectedMarketplaceDataColumns();
  const clean=rows.map(row=>{
    const out={};
    columns.forEach(column=>out[column]=row[column]);
    return out;
  });

  const viewLabel={
    all:"All_Marketplace_Data",
    amazon:"Amazon_Data",
    flipkart:"Flipkart_Data",
    mapping:"WF_SKU_Mapping"
  }[currentMarketplaceData.view];

  writeExcelReport(
    `${viewLabel}_${currentMarketplaceData.date}.xlsx`,
    {Date:currentMarketplaceData.date,Rows:clean.length,Category:document.getElementById("marketplaceDataCategory")?.value||"all"},
    clean
  );
}


/* ======================================================
   EMAIL SETTINGS + GMAIL SHARING
====================================================== */

const EMAIL_SETTINGS_STORAGE_KEY_V4="WakeSuite_Email_Settings_v1";
const EMAIL_HISTORY_STORAGE_KEY_V4="WakeSuite_Email_History_v1";
const GMAIL_SCOPE_V4="https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.compose";
let gmailTokenClientV4=null;
let gmailAccessTokenV4=null;

const EMAIL_REPORT_DEFS_V4={
  amazon_listing:{
    label:"Amazon · Listing Price Disparity",
    defaultSubject:"Action Required : Amazon Listing Price Disparity - {{DATE}}",
    greeting:"Hi Team,",
    message:"Please find the Amazon listing price disparity report for {{DATE}}.",
    contentMode:"table_attachment",attachExcel:true
  },
  amazon_live:{
    label:"Amazon · Live Price Disparity",
    defaultSubject:"Action Required : Amazon Live Price Disparity - {{DATE}}",
    greeting:"Hi Simmer,",
    message:"We identified a critical price disparity affecting {{COUNT}} ASINs where frontend prices do not match Wakefit’s pricing. Please find the attached list below and prioritize correcting these listings immediately.",
    contentMode:"message",attachExcel:true
  },
  amazon_mrp:{
    label:"Amazon · MRP Disparity",
    defaultSubject:"Action Required : Amazon MRP Disparity - {{DATE}}",
    greeting:"Hi Team,",
    message:"Please find the Amazon MRP disparity report for {{DATE}}.",
    contentMode:"table_attachment",attachExcel:true
  },
  amazon_suppression:{
    label:"Amazon · ASIN Suppression",
    defaultSubject:"Amazon Suppressed ASINs List - {{DATE}}",
    greeting:"Hi Team,",
    message:"Please find the attached list of Suppressed ASINs and their revenue impact.",
    contentMode:"summary",attachExcel:true
  },
  amazon_buybox:{
    label:"Amazon · Buy Box Suppression",
    defaultSubject:"Amazon Buy Box Suppression - {{DATE}}",
    greeting:"Hi Team,",
    message:"Please find the Amazon Buy Box Suppression report for {{DATE}}.",
    contentMode:"summary",attachExcel:true
  },
  flipkart_listing:{
    label:"Flipkart · Listing Price Disparity",
    defaultSubject:"Action Required : Flipkart Listing Price Disparity - {{DATE}}",
    greeting:"Hi Team,",
    message:"Please find the Flipkart listing price disparity report for {{DATE}}.",
    contentMode:"table_attachment",attachExcel:true
  },
  flipkart_live:{
    label:"Flipkart · Live Price Disparity",
    defaultSubject:"Action Required : Flipkart Live Price Disparity - {{DATE}}",
    greeting:"Hi Tannu,",
    message:"Please update the prices for the FSNs showing a disparity on the front end.",
    contentMode:"table",attachExcel:false
  },
  flipkart_mrp:{
    label:"Flipkart · MRP Disparity",
    defaultSubject:"Action Required : Flipkart MRP Disparity - {{DATE}}",
    greeting:"Hi Team,",
    message:"Please find the Flipkart MRP disparity report for {{DATE}}.",
    contentMode:"table_attachment",attachExcel:true
  },
  flipkart_buybox:{
    label:"Flipkart · Buy Box Unavailable",
    defaultSubject:"Flipkart Buy Box Unavailable - {{DATE}}",
    greeting:"Hi Team,",
    message:"Please find the Flipkart Buy Box Unavailable report for {{DATE}}.",
    contentMode:"summary",attachExcel:true
  }
};

function v4DefaultEmailState(){
  const templates={};
  Object.entries(EMAIL_REPORT_DEFS_V4).forEach(([key,def])=>{
    templates[key]={
      to:"",cc:"",bcc:"",
      subject:def.defaultSubject,greeting:def.greeting,message:def.message,
      contentMode:def.contentMode,attachExcel:def.attachExcel,useSignature:true,inlineLimit:30
    };
  });
  return {templates,groups:[],signature:""};
}

function loadEmailState(){
  const defaults=v4DefaultEmailState();
  try{
    const saved=JSON.parse(localStorage.getItem(EMAIL_SETTINGS_STORAGE_KEY_V4)||"null");
    if(!saved) return defaults;
    return {
      templates:{...defaults.templates,...saved.templates},
      groups:Array.isArray(saved.groups)?saved.groups:[],
      signature:String(saved.signature||"")
    };
  }catch(error){
    console.warn("Unable to read email settings",error);
    return defaults;
  }
}

function saveEmailState(state){
  localStorage.setItem(EMAIL_SETTINGS_STORAGE_KEY_V4,JSON.stringify(state));
}

function showSettingsPane(id,button){
  document.querySelectorAll(".settings-pane").forEach(pane=>pane.classList.remove("active"));
  document.querySelectorAll(".settings-tab").forEach(tab=>tab.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");
  button?.classList.add("active");
  if(id==="emailHistoryPane") renderEmailHistory();
}

function openEmailSettings(){
  showView("emailSettingsSection");
  const select=document.getElementById("emailTemplateReport");
  if(select&&!select.options.length){
    select.innerHTML=Object.entries(EMAIL_REPORT_DEFS_V4)
      .map(([key,def])=>`<option value="${key}">${escapeHtml(def.label)}</option>`).join("");
    select.addEventListener("change",loadCurrentEmailTemplate);
  }
  loadCurrentEmailTemplate();
  renderRecipientGroups();
  renderSignatureSetting();
  renderEmailHistory();
}

function loadCurrentEmailTemplate(){
  const state=loadEmailState();
  const key=document.getElementById("emailTemplateReport")?.value||"amazon_live";
  const template=state.templates[key]||v4DefaultEmailState().templates[key];
  const setValue=(id,value)=>{
    const element=document.getElementById(id);
    if(element) element.value=value??"";
  };

  setValue("emailTemplateTo",template.to);
  setValue("emailTemplateCc",template.cc);
  setValue("emailTemplateBcc",template.bcc);
  setValue("emailTemplateSubject",template.subject);
  setValue("emailTemplateGreeting",template.greeting);
  setValue("emailTemplateMessage",template.message);
  setValue("emailContentMode",template.contentMode);
  setValue("emailAttachExcel",template.attachExcel?"yes":"no");
  setValue("emailUseSignature",template.useSignature?"yes":"no");
  setValue("emailInlineLimit",template.inlineLimit||30);
}

function saveCurrentEmailTemplate(){
  const state=loadEmailState();
  const key=document.getElementById("emailTemplateReport")?.value;
  if(!key) return;

  state.templates[key]={
    to:document.getElementById("emailTemplateTo")?.value?.trim()||"",
    cc:document.getElementById("emailTemplateCc")?.value?.trim()||"",
    bcc:document.getElementById("emailTemplateBcc")?.value?.trim()||"",
    subject:document.getElementById("emailTemplateSubject")?.value||"",
    greeting:document.getElementById("emailTemplateGreeting")?.value||"",
    message:document.getElementById("emailTemplateMessage")?.value||"",
    contentMode:document.getElementById("emailContentMode")?.value||"message",
    attachExcel:document.getElementById("emailAttachExcel")?.value==="yes",
    useSignature:document.getElementById("emailUseSignature")?.value==="yes",
    inlineLimit:Math.max(1,Math.min(100,Number(document.getElementById("emailInlineLimit")?.value||30)))
  };
  saveEmailState(state);
  alert("Email settings saved.");
}

function renderRecipientGroups(){
  const container=document.getElementById("recipientGroupsList");
  if(!container) return;
  const groups=loadEmailState().groups;

  if(!groups.length){
    container.innerHTML=`<div class="group-row recipient-group-row">
      <input class="group-name" placeholder="Group name">
      <input class="group-emails" placeholder="email1@company.com, email2@company.com">
      <button class="secondary-btn" onclick="this.closest('.recipient-group-row').remove()">Remove</button>
    </div>`;
    return;
  }

  container.innerHTML=groups.map(group=>`<div class="group-row recipient-group-row">
    <input class="group-name" value="${escapeHtml(group.name||"")}" placeholder="Group name">
    <input class="group-emails" value="${escapeHtml(group.emails||"")}" placeholder="email1@company.com, email2@company.com">
    <button class="secondary-btn" onclick="this.closest('.recipient-group-row').remove()">Remove</button>
  </div>`).join("");
}

function addRecipientGroup(){
  const container=document.getElementById("recipientGroupsList");
  if(!container) return;
  container.insertAdjacentHTML("beforeend",`<div class="group-row recipient-group-row">
    <input class="group-name" placeholder="Group name">
    <input class="group-emails" placeholder="email1@company.com, email2@company.com">
    <button class="secondary-btn" onclick="this.closest('.recipient-group-row').remove()">Remove</button>
  </div>`);
}

function saveRecipientGroups(){
  const state=loadEmailState();
  state.groups=Array.from(document.querySelectorAll(".recipient-group-row")).map(row=>({
    name:row.querySelector(".group-name")?.value?.trim()||"",
    emails:row.querySelector(".group-emails")?.value?.trim()||""
  })).filter(group=>group.name&&group.emails);
  saveEmailState(state);
  alert("Recipient groups saved.");
}

function renderSignatureSetting(){
  const input=document.getElementById("defaultEmailSignature");
  if(input) input.value=loadEmailState().signature||"";
}

function saveDefaultEmailSignature(){
  const state=loadEmailState();
  state.signature=document.getElementById("defaultEmailSignature")?.value||"";
  saveEmailState(state);
  alert("Email signature saved.");
}

function v4EmailHistory(){
  try{
    const history=JSON.parse(localStorage.getItem(EMAIL_HISTORY_STORAGE_KEY_V4)||"[]");
    return Array.isArray(history)?history:[];
  }catch(error){
    return [];
  }
}

function v4SaveEmailHistory(item){
  const history=v4EmailHistory();
  history.unshift(item);
  localStorage.setItem(EMAIL_HISTORY_STORAGE_KEY_V4,JSON.stringify(history.slice(0,500)));
}

function renderEmailHistory(){
  const table=document.getElementById("emailHistoryTable");
  if(!table) return;

  const history=v4EmailHistory();
  let html=`<thead><tr>
    <th>Sent At</th><th>Report</th><th>Period</th><th>To</th><th>Subject</th><th>Mode</th><th>Status</th>
  </tr></thead><tbody>`;

  if(!history.length) html+=`<tr><td colspan="7" class="empty-row">No email history</td></tr>`;

  history.forEach(item=>{
    html+=`<tr>
      <td>${escapeHtml(item.sentAt||"")}</td><td>${escapeHtml(item.report||"")}</td>
      <td>${escapeHtml(item.period||"")}</td><td>${escapeHtml(item.to||"")}</td>
      <td>${escapeHtml(item.subject||"")}</td><td>${escapeHtml(item.mode||"")}</td>
      <td>${escapeHtml(item.status||"")}</td>
    </tr>`;
  });

  html+="</tbody>";
  table.innerHTML=html;
}

function v4FormatEmailDate(fromDate,toDate){
  const formatOne=value=>new Date(value+"T00:00:00")
    .toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})
    .replace(/,/g,"");
  if(!toDate||toDate===fromDate) return formatOne(fromDate);
  return `${formatOne(fromDate)} to ${formatOne(toDate)}`;
}

function v4EmailVariableContext(report){
  const def=report.def;
  const issueRows=def.type==="price"?report.rows.filter(row=>row.parityStatus==="Disparity"):report.rows;
  const idKey=def.marketplace==="amazon"?"asin":"fsn";
  const count=uniqueIdentifierCount(issueRows,idKey);
  const impact=issueRows.filter(row=>row.revenueAvailable!==false)
    .reduce((sum,row)=>sum+Number(reportRowImpact(def,row)||0),0);

  return {
    DATE:v4FormatEmailDate(report.fromDate,report.toDate),
    COUNT:count,
    PERIOD:report.period,
    REV_IMPACT:formatINR(impact),
    MARKETPLACE:def.marketplace==="amazon"?"Amazon":"Flipkart"
  };
}

function v4ReplaceEmailVars(text,context){
  let result=String(text||"");
  Object.entries(context).forEach(([key,value])=>{
    result=result.replace(new RegExp(`{{${key}}}`,"g"),String(value));
  });
  return result;
}

function v4EmailIssueRows(report){
  return report.def.type==="price"
    ? report.rows.filter(row=>row.parityStatus==="Disparity")
    : report.rows;
}

function v4EmailCategorySummary(rows,def){
  const groups=new Map();
  const idKey=def.marketplace==="amazon"?"asin":"fsn";

  rows.forEach(row=>{
    const category=row.category||"Unmapped";
    if(!groups.has(category)) groups.set(category,{ids:new Set(),impact:0,revenueAvailable:false});
    const group=groups.get(category);
    if(row[idKey]) group.ids.add(row[idKey]);
    if(row.revenueAvailable!==false){
      group.revenueAvailable=true;
      group.impact+=Number(reportRowImpact(def,row)||0);
    }
  });

  return Array.from(groups.entries()).map(([category,value])=>({
    category,count:value.ids.size,impact:value.revenueAvailable?value.impact:null
  })).sort((a,b)=>Number(b.impact||0)-Number(a.impact||0));
}

function v4EmailInlineTable(report,rows,limit){
  const def=report.def;
  const visible=rows.slice(0,limit);

  if(def.marketplace==="flipkart"&&def.kind==="live"){
    let html=`<table><thead><tr>
      <th>Category</th><th>FSN</th><th>WF Item SKU</th><th>WF Price</th><th>FK Live Price</th><th>Diff</th>
    </tr></thead><tbody>`;
    visible.forEach(row=>{
      html+=`<tr>
        <td>${escapeHtml(row.category||"")}</td><td>${escapeHtml(row.fsn||"")}</td>
        <td>${escapeHtml(row.wfSku||"")}</td><td>${formatINR(row.wfPrice||0)}</td>
        <td>${formatINR(row.finalLivePrice||0)}</td><td>${formatINR(row.livePriceDiff||0)}</td>
      </tr>`;
    });
    html+="</tbody></table>";
    return html;
  }

  const clean=v4HistoricalCleanRows(def,visible);
  const columns=clean.length?Object.keys(clean[0]):[];
  let html="<table><thead><tr>"+columns.map(column=>`<th>${escapeHtml(column)}</th>`).join("")+"</tr></thead><tbody>";
  clean.forEach(row=>{
    html+="<tr>"+columns.map(column=>`<td>${escapeHtml(row[column]??"")}</td>`).join("")+"</tr>";
  });
  html+="</tbody></table>";
  return html;
}

function v4BuildEmailHtml(report,template){
  const state=loadEmailState();
  const context=v4EmailVariableContext(report);
  const greeting=v4ReplaceEmailVars(template.greeting,context);
  const message=v4ReplaceEmailVars(template.message,context);
  const rows=v4EmailIssueRows(report);
  let body="";

  if(greeting) body+=`<div style="margin-bottom:12px">${escapeHtml(greeting)}</div>`;
  if(message) body+=`<div>${escapeHtml(message).replace(/\n/g,"<br>")}</div>`;

  if(template.contentMode==="summary"){
    const summary=v4EmailCategorySummary(rows,report.def);
    if(summary.length){
      body+=`<table style="width:100%;border-collapse:collapse;margin-top:14px;font-family:Arial,sans-serif;font-size:12px">
        <thead><tr>
          <th style="border:1px solid #cfd4dc;padding:7px;background:#ffe600;text-align:left">Category</th>
          <th style="border:1px solid #cfd4dc;padding:7px;background:#ffe600;text-align:left">No of ${report.def.marketplace==="amazon"?"ASINs":"FSNs"}</th>
          <th style="border:1px solid #cfd4dc;padding:7px;background:#ffe600;text-align:left">Rev Impact / Day</th>
        </tr></thead><tbody>`;

      let totalCount=0,totalImpact=0,impactAvailable=false;
      summary.forEach(item=>{
        totalCount+=item.count;
        if(item.impact!==null){ impactAvailable=true; totalImpact+=item.impact; }
        body+=`<tr>
          <td style="border:1px solid #cfd4dc;padding:7px">${escapeHtml(item.category)}</td>
          <td style="border:1px solid #cfd4dc;padding:7px">${formatNumber(item.count)}</td>
          <td style="border:1px solid #cfd4dc;padding:7px">${item.impact===null?"Revenue Data Unavailable":formatINR(item.impact)}</td>
        </tr>`;
      });

      body+=`<tr>
        <td style="border:1px solid #cfd4dc;padding:7px;font-weight:700">Total Rev Impact</td>
        <td style="border:1px solid #cfd4dc;padding:7px;font-weight:700">${formatNumber(totalCount)}</td>
        <td style="border:1px solid #cfd4dc;padding:7px;font-weight:700">${impactAvailable?formatINR(totalImpact):"Revenue Data Unavailable"}</td>
      </tr></tbody></table>`;
    }
  }else if(template.contentMode==="table"||template.contentMode==="table_attachment"){
    body+=v4EmailInlineTable(report,rows,template.inlineLimit||30);
    if(rows.length>Number(template.inlineLimit||30)){
      body+=`<div style="margin-top:8px;color:#667085;font-size:11px">Showing first ${Number(template.inlineLimit||30)} of ${rows.length} rows.</div>`;
    }
  }

  if(template.useSignature&&state.signature){
    body+=`<div style="margin-top:18px">${escapeHtml(state.signature).replace(/\n/g,"<br>")}</div>`;
  }
  return body;
}


function v4BuildEmailWorkbook(report){
  const def=report.def;
  const rows=v4EmailIssueRows(report);
  const workbook=XLSX.utils.book_new();

  if(currentHistoricalViewKey==="amazon_live"){
    const data=rows.map(row=>({
      Category:row.category,
      "Seller sku":row.azSku,
      ASIN:row.asin,
      Price:row.finalLivePrice
    }));
    const sheet=XLSX.utils.json_to_sheet(data);
    sheet["!cols"]=[{wch:18},{wch:24},{wch:18},{wch:14}];
    XLSX.utils.book_append_sheet(workbook,sheet,"Temp_Export_Values_Only");
    return workbook;
  }

  if(currentHistoricalViewKey==="amazon_suppression"){
    const details=[
      ["Date","Category","ASIN","Rev Impact/Day"],
      ...rows.map(row=>[
        row.reportDate,row.category,row.asin,
        row.revenueAvailable===false?"Revenue Data Unavailable":row.revenueImpactPerDay
      ])
    ];
    const summary=v4EmailCategorySummary(rows,def);
    const summaryBlock=[
      ["Category","No of ASINs","Revenue Impact"],
      ...summary.map(item=>[
        item.category,item.count,
        item.impact===null?"Revenue Data Unavailable":item.impact
      ])
    ];
    const totalCount=summary.reduce((s,item)=>s+item.count,0);
    const impactItems=summary.filter(item=>item.impact!==null);
    summaryBlock.push([
      "Total Rev Impact",totalCount,
      impactItems.length?impactItems.reduce((s,item)=>s+item.impact,0):"Revenue Data Unavailable"
    ]);

    const sheet=XLSX.utils.aoa_to_sheet(details);
    XLSX.utils.sheet_add_aoa(sheet,summaryBlock,{origin:"F1"});
    sheet["!cols"]=[{wch:14},{wch:18},{wch:18},{wch:18},{wch:4},{wch:18},{wch:16},{wch:18}];
    XLSX.utils.book_append_sheet(workbook,sheet,"Amazon Search Suppressed ASINs");
    return workbook;
  }

  if(currentHistoricalViewKey==="flipkart_live"){
    const data=rows.map(row=>({
      Category:row.category,FSN:row.fsn,"WF Item SKU":row.wfSku,
      "WF Price":row.wfPrice,"FK Live Price":row.finalLivePrice,Diff:row.livePriceDiff
    }));
    const sheet=XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook,sheet,"Flipkart Live Price Disparity");
    return workbook;
  }

  const clean=v4HistoricalCleanRows(def,rows);
  const sheet=XLSX.utils.json_to_sheet(clean);
  XLSX.utils.book_append_sheet(workbook,sheet,"Data");
  return workbook;
}

function v4EmailAttachmentName(report){
  const dateLabel=v4FormatEmailDate(report.fromDate,report.toDate);
  if(currentHistoricalViewKey==="amazon_live") return `Amazon Live Price Disparity ${dateLabel}.xlsx`;
  if(currentHistoricalViewKey==="amazon_suppression") return `Amazon Suppressed ASINs List - ${dateLabel}.xlsx`;
  if(currentHistoricalViewKey==="flipkart_live") return `Flipkart Live Price Disparity - ${dateLabel}.xlsx`;
  return `${report.def.title.replace(/[^\w]+/g,"_")}_${report.fromDate}_to_${report.toDate}.xlsx`;
}

function v4ResolveRecipientTokens(text){
  const state=loadEmailState();
  const groups=new Map(state.groups.map(group=>[String(group.name||"").toLowerCase(),group.emails]));
  const output=[];

  String(text||"").split(/[;,]+/).map(token=>token.trim()).filter(Boolean).forEach(token=>{
    const groupToken=token.replace(/^group:/i,"").trim().toLowerCase();
    if(groups.has(groupToken)){
      String(groups.get(groupToken)||"").split(/[;,]+/).map(email=>email.trim()).filter(Boolean)
        .forEach(email=>output.push(email));
    }else{
      output.push(token);
    }
  });
  return Array.from(new Set(output));
}

async function openShareEmailModal(){
  if(!currentHistoricalReport) await loadHistoricalModule();
  if(!currentHistoricalReport) return;

  const state=loadEmailState();
  const template={...state.templates[currentHistoricalViewKey]};
  const context=v4EmailVariableContext(currentHistoricalReport);
  const subject=v4ReplaceEmailVars(template.subject,context);
  const html=v4BuildEmailHtml(currentHistoricalReport,template);
  const rows=v4EmailIssueRows(currentHistoricalReport);
  const attachExcel=template.attachExcel || (
    template.contentMode==="table" && rows.length>Number(template.inlineLimit||30)
  );

  currentShareEmailPackage={
    report:currentHistoricalReport,template,context,html,attachExcel,
    attachmentName:attachExcel?v4EmailAttachmentName(currentHistoricalReport):null
  };

  const setValue=(id,value)=>{
    const element=document.getElementById(id);
    if(element) element.value=value||"";
  };

  setValue("shareEmailTo",template.to);
  setValue("shareEmailCc",template.cc);
  setValue("shareEmailBcc",template.bcc);
  setValue("shareEmailSubject",subject);
  setValue("shareEmailMessage",v4ReplaceEmailVars(template.message,context));

  finalSetText(
    "shareEmailAttachmentName",
    attachExcel?`Attachment · ${currentShareEmailPackage.attachmentName}`:"No attachment"
  );

  const preview=document.getElementById("shareEmailPreview");
  if(preview) preview.innerHTML=html;

  const modal=document.getElementById("emailShareModal");
  modal?.classList.add("open");
  if(modal) modal.setAttribute("aria-hidden","false");
}

function closeShareEmailModal(){
  const modal=document.getElementById("emailShareModal");
  modal?.classList.remove("open");
  if(modal) modal.setAttribute("aria-hidden","true");
}

function v4GetGmailToken(){
  return new Promise((resolve,reject)=>{
    if(!window.google?.accounts?.oauth2){
      reject(new Error("Google Identity Services is not loaded."));
      return;
    }

    gmailTokenClientV4=gmailTokenClientV4||google.accounts.oauth2.initTokenClient({
      client_id:GOOGLE_SHEETS_CLIENT_ID,
      scope:GMAIL_SCOPE_V4,
      callback:response=>{
        if(response.error){
          reject(new Error(response.error));
          return;
        }
        gmailAccessTokenV4=response.access_token;
        resolve(gmailAccessTokenV4);
      }
    });

    gmailTokenClientV4.requestAccessToken({prompt:gmailAccessTokenV4?"":"consent"});
  });
}

function v4BytesToBase64(bytes){
  const uint8=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  let binary="";
  const chunkSize=0x8000;
  for(let i=0;i<uint8.length;i+=chunkSize){
    binary+=String.fromCharCode(...uint8.subarray(i,i+chunkSize));
  }
  return btoa(binary);
}

function v4Utf8Base64(text){
  return v4BytesToBase64(new TextEncoder().encode(text));
}

function v4Base64Url(base64){
  return base64.replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}

function v4MimeSubject(text){
  return `=?UTF-8?B?${v4Utf8Base64(text)}?=`;
}

function v4AttachmentBytes(report){
  return XLSX.write(v4BuildEmailWorkbook(report),{bookType:"xlsx",type:"array"});
}

function v4BuildMimeMessage({to,cc,bcc,subject,html,attachmentName,attachmentBytes}){
  const boundary=`WakeSuite_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const headers=[
    `To: ${to.join(", ")}`,
    cc.length?`Cc: ${cc.join(", ")}`:"",
    bcc.length?`Bcc: ${bcc.join(", ")}`:"",
    `Subject: ${v4MimeSubject(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`
  ].filter(Boolean).join("\r\n");

  let body=`${headers}\r\n\r\n`+
    `--${boundary}\r\n`+
    `Content-Type: text/html; charset="UTF-8"\r\n`+
    `Content-Transfer-Encoding: base64\r\n\r\n`+
    `${v4Utf8Base64(html)}\r\n`;

  if(attachmentName&&attachmentBytes){
    body+=`--${boundary}\r\n`+
      `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; name="${attachmentName}"\r\n`+
      `Content-Disposition: attachment; filename="${attachmentName}"\r\n`+
      `Content-Transfer-Encoding: base64\r\n\r\n`+
      `${v4BytesToBase64(attachmentBytes)}\r\n`;
  }

  body+=`--${boundary}--`;
  return v4Base64Url(v4Utf8Base64(body));
}

async function sendCurrentReportEmail(mode="send"){
  if(!currentShareEmailPackage) return;

  const to=v4ResolveRecipientTokens(document.getElementById("shareEmailTo")?.value);
  const cc=v4ResolveRecipientTokens(document.getElementById("shareEmailCc")?.value);
  const bcc=v4ResolveRecipientTokens(document.getElementById("shareEmailBcc")?.value);
  const subject=document.getElementById("shareEmailSubject")?.value?.trim()||"";

  if(!to.length){ alert("Add at least one recipient."); return; }
  if(!subject){ alert("Add an email subject."); return; }

  const button=document.getElementById(mode==="draft"?"createGmailDraftButton":"sendGmailButton");
  if(button) button.disabled=true;

  try{
    const token=await v4GetGmailToken();
    let attachmentBytes=null;
    if(currentShareEmailPackage.attachExcel){
      attachmentBytes=v4AttachmentBytes(currentShareEmailPackage.report);
    }

    const editedMessage=document.getElementById("shareEmailMessage")?.value??currentShareEmailPackage.template.message;
    const editedTemplate={...currentShareEmailPackage.template,message:editedMessage};
    const editedHtml=v4BuildEmailHtml(currentShareEmailPackage.report,editedTemplate);

    const raw=v4BuildMimeMessage({
      to,cc,bcc,subject,html:editedHtml,
      attachmentName:currentShareEmailPackage.attachmentName,attachmentBytes
    });

    const endpoint=mode==="draft"
      ?"https://gmail.googleapis.com/gmail/v1/users/me/drafts"
      :"https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
    const payload=mode==="draft"?{message:{raw}}:{raw};

    const response=await fetch(endpoint,{
      method:"POST",
      headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data?.error?.message||`Gmail API error ${response.status}`);

    v4SaveEmailHistory({
      sentAt:new Date().toLocaleString(),
      report:currentShareEmailPackage.report.def.title,
      period:`${currentShareEmailPackage.report.fromDate} to ${currentShareEmailPackage.report.toDate}`,
      to:to.join(", "),subject,mode:mode==="draft"?"Gmail Draft":"Sent",status:"Success",
      gmailId:data.id||data.message?.id||""
    });

    alert(mode==="draft"?"Gmail draft created.":"Email sent.");
    closeShareEmailModal();
  }catch(error){
    console.error("Email sharing failed",error);
    v4SaveEmailHistory({
      sentAt:new Date().toLocaleString(),
      report:currentShareEmailPackage?.report?.def?.title||"",
      period:currentShareEmailPackage?`${currentShareEmailPackage.report.fromDate} to ${currentShareEmailPackage.report.toDate}`:"",
      to:to.join(", "),subject,mode:mode==="draft"?"Gmail Draft":"Sent",
      status:`Failed: ${error.message}`
    });
    alert("Email sharing failed: "+error.message+
      "\n\nIf this is the first email test, confirm the Gmail API is enabled for the same Google Cloud project.");
  }finally{
    if(button) button.disabled=false;
  }
}

/* ======================================================
   INITIALIZATION V4
====================================================== */

async function initializeWakeSuiteHistory(){
  const today=todayIso();
  const reportDate=document.getElementById("reportDate");
  if(reportDate&&!reportDate.value) reportDate.value=today;

  await restoreSessionForDate(reportDate?.value||today);

  let latest=null;
  try{
    latest=await window.getLatestCompletedSnapshot();
  }catch(error){
    console.warn("Historical data unavailable",error);
  }

  const latestDate=latest?.reportDate||today;

  [
    "dashboardFromDate","dashboardToDate","reportFromDate","reportToDate",
    "insightsFromDate","insightsToDate","marketplaceDataDate"
  ].forEach(id=>{
    const input=document.getElementById(id);
    if(input&&!input.value) input.value=latestDate;
  });

  const dashboardDate=document.getElementById("dashboardDate");
  if(dashboardDate) dashboardDate.value=latestDate;
  const reportAnchor=document.getElementById("reportAnchorDate");
  if(reportAnchor) reportAnchor.value=latestDate;
  const insightsDate=document.getElementById("insightsDate");
  if(insightsDate) insightsDate.value=latestDate;

  if(latest){
    snapshotCache.set(latest.reportDate,latest);
    hydrateSnapshot(latest);
    finalSetText("latestCompletedDateDisplay",`As of ${latest.reportDate}`);
  }

  updateReadiness();
  await maybeAutoProcessCurrentDate();
  await loadDashboardOverview();
}

/* ---------- V4 UI wiring ---------- */

[
  ["dashboardPeriod",async()=>{
    v4SetRangeControls("dashboardPeriod","dashboardFromDate","dashboardToDate","dashboardDate");
    await loadDashboardOverview();
  }],
  ["dashboardFromDate",async()=>{
    if(document.getElementById("dashboardPeriod")?.value!=="custom"){
      v4SetRangeControls("dashboardPeriod","dashboardFromDate","dashboardToDate","dashboardDate");
    }
    await loadDashboardOverview();
  }],
  ["dashboardToDate",async()=>loadDashboardOverview()],
  ["dashboardCategory",async()=>loadDashboardOverview()],
  ["reportPeriod",async()=>{
    v4SetRangeControls("reportPeriod","reportFromDate","reportToDate","reportAnchorDate");
    await loadHistoricalModule();
  }],
  ["reportFromDate",async()=>{
    if(document.getElementById("reportPeriod")?.value!=="custom"){
      v4SetRangeControls("reportPeriod","reportFromDate","reportToDate","reportAnchorDate");
    }
    await loadHistoricalModule();
  }],
  ["reportToDate",async()=>loadHistoricalModule()],
  ["insightsPeriod",async()=>{
    v4SetRangeControls("insightsPeriod","insightsFromDate","insightsToDate","insightsDate");
    await loadMarketplaceInsights();
  }],
  ["insightsFromDate",async()=>{
    if(document.getElementById("insightsPeriod")?.value!=="custom"){
      v4SetRangeControls("insightsPeriod","insightsFromDate","insightsToDate","insightsDate");
    }
    await loadMarketplaceInsights();
  }],
  ["insightsToDate",async()=>loadMarketplaceInsights()],
  ["marketplaceDataDate",async()=>loadMarketplaceData()],
  ["marketplaceDataView",async()=>loadMarketplaceData()],
  ["marketplaceDataType",async()=>loadMarketplaceData()],
  ["marketplaceDataCategory",()=>renderMarketplaceDataTable()],
  ["marketplaceDataSort",()=>renderMarketplaceDataTable()]
].forEach(([id,handler])=>{
  document.getElementById(id)?.addEventListener("change",handler);
});

let marketplaceDataSearchTimerV4=null;
document.getElementById("marketplaceDataSearch")?.addEventListener("input",()=>{
  clearTimeout(marketplaceDataSearchTimerV4);
  marketplaceDataSearchTimerV4=setTimeout(renderMarketplaceDataTable,160);
});

/* ---------- V4 global exports ---------- */

window.openDashboardPriceView=openDashboardPriceView;
window.openMarketplaceData=openMarketplaceData;
window.loadMarketplaceData=loadMarketplaceData;
window.downloadMarketplaceData=downloadMarketplaceData;
window.openEmailSettings=openEmailSettings;
window.showSettingsPane=showSettingsPane;
window.saveCurrentEmailTemplate=saveCurrentEmailTemplate;
window.addRecipientGroup=addRecipientGroup;
window.saveRecipientGroups=saveRecipientGroups;
window.saveDefaultEmailSignature=saveDefaultEmailSignature;
window.openShareEmailModal=openShareEmailModal;
window.closeShareEmailModal=closeShareEmailModal;
window.sendCurrentReportEmail=sendCurrentReportEmail;


/* ---------- Final report UI overrides ---------- */

function openHistoricalModule(viewKey){
  currentHistoricalViewKey=viewKey;
  const def=HISTORICAL_VIEWS[viewKey];
  finalSetText("reportModuleTitle",def?.title||"Report");
  showView("reportModuleSection");

  const latestDate=document.getElementById("latestCompletedDateDisplay")?.textContent?.replace("As of ","");
  const from=document.getElementById("reportFromDate");
  const to=document.getElementById("reportToDate");
  const anchor=document.getElementById("reportAnchorDate");

  if(latestDate&&latestDate!=="—"){
    if(from) from.value=latestDate;
    if(to) to.value=latestDate;
    if(anchor) anchor.value=latestDate;
  }

  const category=document.getElementById("reportCategory");
  if(category) category.value="all";
  const search=document.getElementById("reportSearch");
  if(search) search.value="";

  configureReportSort(def,true);
  v4SetRangeControls("reportPeriod","reportFromDate","reportToDate","reportAnchorDate");
  loadHistoricalModule();
}

function renderHistoricalTable(def,rows){
  const table=document.getElementById("reportModuleTable");
  if(!table) return;

  finalSetText("reportRowInfo",`${formatNumber(rows.length)} row${rows.length===1?"":"s"}`);
  if(!rows.length){
    table.innerHTML=`<tbody><tr><td class="empty-row">No Data Available</td></tr></tbody>`;
    return;
  }

  let columns=[];
  if(def.type==="price"){
    const isAmazon=def.marketplace==="amazon";

    if(def.kind==="mrp"){
      columns=[
        ["Date",row=>row.reportDate],
        ["Category",row=>row.category],
        ["WF SKU",row=>row.wfSku],
        [isAmazon?"AZ SKU":"FK SKU",row=>isAmazon?row.azSku:row.fkSku],
        [isAmazon?"ASIN":"FSN",row=>isAmazon?row.asin:row.fsn],
        ["WF MRP",row=>formatINR(row.wfMrp)],
        [isAmazon?"AZ MRP":"FK MRP",row=>formatINR(isAmazon?row.azMrp:row.fkMrp)],
        ["Difference",row=>formatINR(row.mrpDiff)],
        ["Status",row=>row.parityStatus]
      ];
    }else{
      const live=def.kind==="live";
      columns=[
        ["Date",row=>row.reportDate],
        ["Category",row=>row.category],
        ["WF SKU",row=>row.wfSku],
        [isAmazon?"AZ SKU":"FK SKU",row=>isAmazon?row.azSku:row.fkSku],
        [isAmazon?"ASIN":"FSN",row=>isAmazon?row.asin:row.fsn],
        ["WF Price",row=>formatINR(row.wfPrice)],
        [live?"Live Price":"Listing Price",row=>formatINR(live?row.finalLivePrice:row.listingPrice)],
        ["Difference",row=>formatINR(live?row.livePriceDiff:row.listingPriceDiff)],
        ["Status",row=>row.parityStatus],
        ["Inventory",row=>formatNumber(row.inventory)],
        ["Rev Impact / Day",row=>row.revenueAvailable===false?"Revenue Data Unavailable":formatINR(reportRowImpact(def,row))]
      ];
    }
  }else if(def.type==="suppression"){
    columns=[
      ["Date",row=>row.reportDate],["Category",row=>row.category],["ASIN",row=>row.asin],
      ["Rev Impact / Day",row=>row.revenueAvailable===false?"Revenue Data Unavailable":formatINR(row.revenueImpactPerDay||0)]
    ];
  }else if(def.type==="amazon_buybox"){
    columns=[
      ["Date",row=>row.reportDate],["Category",row=>row.category],["ASIN",row=>row.asin],
      ["WF SKU",row=>row.wfSku],["AZ SKU",row=>row.azSku],
      ["Price",row=>formatINR(row.listingPrice||0)],
      ["Rev Impact / Day",row=>row.revenueAvailable===false?"Revenue Data Unavailable":formatINR(row.revenueImpactPerDay||0)]
    ];
  }else{
    columns=[
      ["Date",row=>row.reportDate],["Category",row=>row.category],["FSN",row=>row.fsn],
      ["WF SKU",row=>row.wfSku],["FK SKU",row=>row.fkSku],
      ["Listing Price",row=>formatINR(row.listingPrice||0)],
      ["Rev Impact / Day",row=>row.revenueAvailable===false?"Revenue Data Unavailable":formatINR(row.buyBoxRevenueImpactPerDay||0)]
    ];
  }

  const visibleRows=rows.slice(0,1500);
  if(rows.length>visibleRows.length){
    finalSetText("reportRowInfo",`${formatNumber(rows.length)} rows · showing first ${formatNumber(visibleRows.length)}`);
  }

  let html="<thead><tr>"+columns.map(col=>`<th>${escapeHtml(col[0])}</th>`).join("")+"</tr></thead><tbody>";
  visibleRows.forEach(row=>{
    html+="<tr>"+columns.map(col=>{
      const value=col[1](row);
      const cssClass=col[0]==="Status"?(value==="Parity"?"parity":"disparity"):"";
      return `<td class="${cssClass}">${escapeHtml(value)}</td>`;
    }).join("")+"</tr>";
  });
  html+="</tbody>";
  table.innerHTML=html;
}

try{
  APP_VIEW_META.marketplaceDataSection=["Marketplace Data",""];
  APP_VIEW_META.emailSettingsSection=["Settings",""];
  APP_VIEW_META.reportModuleSection=["Marketplace Report",""];
  APP_VIEW_META.marketplaceInsightsSection=["Marketplace Insights",""];
}catch(error){
  console.warn("Unable to extend view metadata",error);
}



/* ======================================================
   WAKESUITE V5 · EXPERIENCE + FRESHNESS + ACCESS
====================================================== */

const REVENUE_SOURCE_VALID_DAYS = 60;
const REVENUE_SOURCE_DUE_SOON_DAY = 50;
let currentDisparityExplorerMarketplace = "amazon";
let currentDisparityExplorerRows = [];
let currentDisparityExplorerExportRows = [];


/* ---------- Toasts: replace browser alert popups ---------- */

function showWakeSuiteToast(
  message,
  type = "info",
  title = "",
  duration = null
){

  const stack =
    document.getElementById(
      "wsToastStack"
    );

  if(!stack){
    return;
  }

  const normalized =
    ["success","error","warning","info"]
    .includes(type)
    ?
    type
    :
    "info";

  const defaultTitle = {
    success:"Completed",
    error:"Action required",
    warning:"Attention",
    info:"WakeSuite"
  }[normalized];

  const icon = {
    success:"✓",
    error:"!",
    warning:"!",
    info:"i"
  }[normalized];

  const toast =
    document.createElement(
      "div"
    );

  toast.className =
    `ws-toast ${normalized}`;

  toast.innerHTML =
    `<div class="ws-toast-icon">${icon}</div>
     <div>
       <div class="ws-toast-title">${escapeHtml(title || defaultTitle)}</div>
       <div class="ws-toast-message">${escapeHtml(String(message || ""))}</div>
     </div>
     <button class="ws-toast-close" aria-label="Dismiss">×</button>`;

  stack.prepend(
    toast
  );

  const remove = () => {

    if(!toast.isConnected){
      return;
    }

    toast.style.animation =
      "wsToastOut .18s ease forwards";

    setTimeout(
      () => toast.remove(),
      190
    );
  };

  toast
  .querySelector(
    ".ws-toast-close"
  )
  ?.addEventListener(
    "click",
    remove
  );

  const timeout =
    duration
    ??
    (
      normalized ===
      "error"
      ?
      9000
      :
      4300
    );

  if(timeout > 0){
    setTimeout(
      remove,
      timeout
    );
  }

}


window.alert = function(message){
  showWakeSuiteToast(
    message,
    "info"
  );
};


function setProcessingState(
  active,
  title = "Updating WakeSuite",
  detail = "",
  stage = "Processing"
){

  const ribbon =
    document.getElementById(
      "processingRibbon"
    );

  if(!ribbon){
    return;
  }

  ribbon.classList.toggle(
    "active",
    !!active
  );

  finalSetText(
    "processingTitle",
    title
  );

  finalSetText(
    "processingDetail",
    detail
  );

  finalSetText(
    "processingStage",
    stage
  );

}


function setUploadStatus(
  message,
  type = ""
){

  const element =
    document.getElementById(
      "uploadStatus"
    );

  if(element){

    element.className =
      "upload-status "
      +
      (type || "");

    element.textContent =
      message || "";
  }

  const text =
    String(
      message || ""
    );

  const lower =
    text.toLowerCase();

  if(
    lower.includes("reading")
    ||
    lower.includes("validating")
  ){

    setProcessingState(
      true,
      "Reading report",
      text,
      "Validation"
    );
  }
  else if(
    lower.includes("processing available")
    ||
    lower.includes("processing...")
  ){

    setProcessingState(
      true,
      "Processing marketplace data",
      text,
      "Analysis"
    );
  }
  else if(
    lower.includes("registering")
    ||
    lower.includes("saving")
  ){

    setProcessingState(
      true,
      "Saving data",
      text,
      "Storage"
    );
  }
  else if(
    type ===
    "error"
  ){

    setProcessingState(
      false
    );

    showWakeSuiteToast(
      text,
      "error",
      "Upload / processing error"
    );
  }
  else if(
    lower.includes("processed")
    ||
    lower.includes("loaded and ready")
    ||
    lower.includes("already processed")
  ){

    setProcessingState(
      false
    );

    showWakeSuiteToast(
      text,
      "success",
      "Data updated"
    );
  }

}


/* ---------- Mobile navigation ---------- */

function toggleMobileSidebar(){

  const sidebar =
    document.getElementById(
      "mainSidebar"
    );

  const backdrop =
    document.getElementById(
      "mobileSidebarBackdrop"
    );

  const open =
    !sidebar
    ?.classList
    .contains(
      "mobile-open"
    );

  sidebar
  ?.classList
  .toggle(
    "mobile-open",
    open
  );

  backdrop
  ?.classList
  .toggle(
    "open",
    open
  );

}


function closeMobileSidebar(){

  document
  .getElementById(
    "mainSidebar"
  )
  ?.classList
  .remove(
    "mobile-open"
  );

  document
  .getElementById(
    "mobileSidebarBackdrop"
  )
  ?.classList
  .remove(
    "open"
  );

}


const v5ShowViewBase =
  showView;

showView = function(id){

  v5ShowViewBase(
    id
  );

  closeMobileSidebar();

  if(
    id ===
    "emailSettingsSection"
  ){

    applyAccessPermissions();
  }

};


/* ======================================================
   REVENUE SOURCE FRESHNESS · 60 DAYS
====================================================== */

function v5DateDiffDays(
  fromDate,
  toDate
){

  if(
    !fromDate
    ||
    !toDate
  ){
    return null;
  }

  const start =
    new Date(
      fromDate
      +
      "T00:00:00"
    );

  const end =
    new Date(
      toDate
      +
      "T00:00:00"
    );

  return Math.floor(
    (
      end -
      start
    )
    /
    86400000
  );

}


function v5FreshnessState(
  sourceDate,
  referenceDate = todayIso()
){

  if(!sourceDate){

    return {
      status:"missing",
      ageDays:null,
      valid:false,
      label:"No revenue source"
    };
  }

  const age =
    v5DateDiffDays(
      sourceDate,
      referenceDate
    );

  if(
    age ===
    null
    ||
    age < 0
  ){

    return {
      status:"missing",
      ageDays:age,
      valid:false,
      label:"No valid revenue source"
    };
  }

  if(
    age >=
    REVENUE_SOURCE_VALID_DAYS
  ){

    return {
      status:"expired",
      ageDays:age,
      valid:false,
      label:`Expired · ${age} days old`
    };
  }

  if(
    age >=
    REVENUE_SOURCE_DUE_SOON_DAY
  ){

    return {
      status:"due",
      ageDays:age,
      valid:true,
      label:`Due Soon · ${REVENUE_SOURCE_VALID_DAYS-age} days left`
    };
  }

  return {
    status:"fresh",
    ageDays:age,
    valid:true,
    label:`Fresh · ${age} days old`
  };

}


async function idbGetAllReports(){

  const db =
    await openWakeSuiteDb();

  return new Promise(
    (resolve,reject) => {

      const tx =
        db.transaction(
          "reports",
          "readonly"
        );

      const request =
        tx
        .objectStore(
          "reports"
        )
        .getAll();

      request.onsuccess =
        () => resolve(
          request.result
          ||
          []
        );

      request.onerror =
        () => reject(
          request.error
        );

    }
  );

}


function v5FindRevenueItem(
  items,
  configId,
  targetDate,
  allowExpired = false
){

  const candidates =
    (
      items
      ||
      []
    )
    .filter(
      item =>
        item.configId ===
        configId
        &&
        item.reportDate <=
        targetDate
    )
    .sort(
      (a,b) =>
        String(
          b.reportDate
        )
        .localeCompare(
          String(
            a.reportDate
          )
        )
    );

  if(
    allowExpired
  ){
    return candidates[0]
      ||
      null;
  }

  return candidates.find(
    item => {

      const freshness =
        v5FreshnessState(
          item.reportDate,
          targetDate
        );

      return freshness.valid;
    }
  )
  ||
  null;

}


async function restoreSessionForDate(
  reportDate
){

  if(!reportDate){
    return;
  }

  const exactItems =
    await idbGetReportsForDate(
      reportDate
    );

  const allItems =
    await idbGetAllReports();

  const restored = {};

  exactItems.forEach(
    item => {

      restored[
        item.configId
      ] =
        item.record;

    }
  );

  const revenueConfigs = [
    "amazon_business_reports",
    "flipkart_order_report"
  ];

  revenueConfigs.forEach(
    configId => {

      if(
        restored[
          configId
        ]
      ){
        return;
      }

      const item =
        v5FindRevenueItem(
          allItems,
          configId,
          reportDate,
          false
        );

      if(!item){
        return;
      }

      restored[
        configId
      ] = {
        ...item.record,
        reportDate:
          item.reportDate,
        sourceReportDate:
          item.reportDate,
        reusedForDate:
          reportDate,
        reusedRevenueSource:
          true
      };

    }
  );

  window.wakeSuiteSessionReports =
    restored;

  window.wakeSuiteRevenueFreshness = {
    amazon:
      v5FindRevenueItem(
        allItems,
        "amazon_business_reports",
        reportDate,
        true
      ),
    flipkart:
      v5FindRevenueItem(
        allItems,
        "flipkart_order_report",
        reportDate,
        true
      )
  };

  currentSessionDate =
    reportDate;

  updateReadiness();

  refreshRevenueFreshnessUi();

}


function v4ReportForDate(
  id,
  reportDate
){

  const report =
    window
    .wakeSuiteSessionReports
    ?.[id];

  if(!report){
    return null;
  }

  if(
    id ===
    "amazon_business_reports"
    ||
    id ===
    "flipkart_order_report"
  ){

    const sourceDate =
      report.sourceReportDate
      ||
      report.reportDate;

    const freshness =
      v5FreshnessState(
        sourceDate,
        reportDate
      );

    return freshness.valid
      ?
      report
      :
      null;
  }

  return report.reportDate ===
    reportDate
    ?
    report
    :
    null;

}


async function v5LatestRevenueSource(
  configId
){

  try{

    const items =
      await idbGetAllReports();

    return (
      items
      .filter(
        item =>
          item.configId ===
          configId
      )
      .sort(
        (a,b) =>
          String(
            b.reportDate
          )
          .localeCompare(
            String(
              a.reportDate
            )
          )
      )[0]
      ||
      null
    );

  }
  catch(error){

    console.warn(
      "Revenue freshness lookup failed",
      error
    );

    return null;
  }

}


function v5ApplyFreshnessCard(
  cardId,
  textId,
  sourceDate,
  sourceLabel
){

  const card =
    document.getElementById(
      cardId
    );

  const text =
    document.getElementById(
      textId
    );

  if(
    !card
    ||
    !text
  ){
    return;
  }

  const freshness =
    v5FreshnessState(
      sourceDate,
      todayIso()
    );

  card.classList.remove(
    "fresh",
    "due",
    "expired"
  );

  if(
    freshness.status ===
    "fresh"
  ){
    card.classList.add(
      "fresh"
    );

    text.textContent =
      `${freshness.label} · ${sourceDate}`;
  }
  else if(
    freshness.status ===
    "due"
  ){

    card.classList.add(
      "due"
    );

    text.textContent =
      `${freshness.label} · download & upload fresh ${sourceLabel}`;
  }
  else if(
    freshness.status ===
    "expired"
  ){

    card.classList.add(
      "expired"
    );

    text.textContent =
      `Refresh required · download & upload fresh report · last ${sourceDate}`;
  }
  else{

    text.textContent =
      `No ${sourceLabel} available`;
  }

}


async function refreshRevenueFreshnessUi(){

  const [
    amazon,
    flipkart
  ] =
    await Promise.all([
      v5LatestRevenueSource(
        "amazon_business_reports"
      ),
      v5LatestRevenueSource(
        "flipkart_order_report"
      )
    ]);

  v5ApplyFreshnessCard(
    "amazonRevenueFreshnessCard",
    "amazonRevenueFreshnessText",
    amazon?.reportDate || null,
    "Amazon Business Report"
  );

  v5ApplyFreshnessCard(
    "flipkartRevenueFreshnessCard",
    "flipkartRevenueFreshnessText",
    flipkart?.reportDate || null,
    "Flipkart Order Report"
  );

}


/* ---------- Source availability with freshness ---------- */

function updateReadiness(){

  const date =
    getSelectedReportDate();

  let loaded =
    0;

  let html =
    "";

  FINAL_REQUIRED_REPORTS
  .forEach(
    ([id,label]) => {

      const exact =
        window
        .wakeSuiteSessionReports
        ?.[id];

      let ready =
        !!v4ReportForDate(
          id,
          date
        );

      let badge =
        ready
        ?
        "Available"
        :
        "No Data";

      let detail =
        "";

      if(
        id ===
        "amazon_business_reports"
        ||
        id ===
        "flipkart_order_report"
      ){

        const report =
          exact;

        const fallbackItem =
          id ===
          "amazon_business_reports"
          ?
          window.wakeSuiteRevenueFreshness
          ?.amazon
          :
          window.wakeSuiteRevenueFreshness
          ?.flipkart;

        const sourceDate =
          report
          ?.sourceReportDate
          ||
          report
          ?.reportDate
          ||
          fallbackItem
          ?.reportDate;

        const freshness =
          v5FreshnessState(
            sourceDate,
            date
          );

        if(
          sourceDate
          &&
          freshness.valid
        ){

          ready =
            true;

          badge =
            freshness.status ===
            "due"
            ?
            "Due Soon"
            :
            "Fresh";

          detail =
            ` · source ${sourceDate}`;
        }
        else if(
          sourceDate
          &&
          freshness.status ===
          "expired"
        ){

          badge =
            "Expired";

          detail =
            ` · refresh required`;
        }

      }

      if(ready){
        loaded +=
          1;
      }

      html +=
        `<div class="ready-row">
          <span>${escapeHtml(label)}${escapeHtml(detail)}</span>
          <span class="ready-badge ${ready ? "ready" : ""}">${escapeHtml(badge)}</span>
        </div>`;

    }
  );

  const box =
    document.getElementById(
      "readinessList"
    );

  if(box){
    box.innerHTML =
      html;
  }

  finalSetText(
    "readinessCounter",
    `${loaded} / ${FINAL_REQUIRED_REPORTS.length}`
  );

  finalSetText(
    "readinessTitle",
    date
    ?
    `Source Availability · ${date}`
    :
    "Source Availability"
  );

  finalSetText(
    "sessionChipText",
    `${loaded} / ${FINAL_REQUIRED_REPORTS.length} Sources`
  );

  const chip =
    document.getElementById(
      "sessionChip"
    );

  if(chip){
    chip.classList.toggle(
      "ready",
      loaded > 0
    );
  }

  const old =
    document.getElementById(
      "dashboardReportsLoaded"
    );

  if(old){
    old.textContent =
      String(
        loaded
      );
  }

}


/* ---------- Auto processing with real stages + freshness metadata ---------- */

async function maybeAutoProcessCurrentDate(){

  if(
    window.currentWakeSuiteAccess
    &&
    !window.currentWakeSuiteAccess
      ?.permissions
      ?.upload
  ){
    return;
  }

  const date =
    getSelectedReportDate();

  if(
    !date
    ||
    processingLock
  ){
    return;
  }

  if(
    !window.masterPricingAmazon
    ||
    !window.masterPricingFlipkart
  ){
    return;
  }

  if(
    typeof window.saveDailySnapshot !==
    "function"
  ){
    return;
  }

  const availability =
    v4SourceAvailability(
      date
    );

  const canAmazon =
    availability.wakefit
    &&
    availability.amazonListings;

  const canFlipkart =
    availability.wakefit
    &&
    availability.flipkartListing;

  if(
    !canAmazon
    &&
    !canFlipkart
  ){

    setUploadStatus(
      "No processable marketplace module yet. Uploaded sources remain saved.",
      ""
    );

    return;
  }

  const fingerprint =
    buildInputFingerprint(
      date
    );

  processingLock =
    true;

  const startTime =
    performance.now();

  try{

    setProcessingState(
      true,
      "Updating marketplace data",
      `Preparing ${date}`,
      "Preparing"
    );

    setUploadStatus(
      "Processing available modules...",
      "success"
    );

    const existing =
      await window
      .getDailySnapshotMeta(
        date
      );

    if(
      existing
      ?.status ===
      "completed"
      &&
      existing
      ?.fingerprint ===
      fingerprint
    ){

      setProcessingState(
        true,
        "Loading saved analysis",
        `${date} is already processed`,
        "Loading"
      );

      const saved =
        await window
        .loadDailySnapshot(
          date
        );

      if(saved){

        snapshotCache.set(
          date,
          saved
        );

        hydrateSnapshot(
          saved
        );
      }

      setUploadStatus(
        `${date} is already processed for the available sources.`,
        "success"
      );

      return;
    }

    if(
      v4WouldDowngradeSnapshot(
        existing,
        availability
      )
    ){

      const saved =
        await window
        .loadDailySnapshot(
          date
        );

      if(saved){

        snapshotCache.set(
          date,
          saved
        );

        hydrateSnapshot(
          saved
        );
      }

      setUploadStatus(
        "Existing stored data for this date is more complete. Upload the missing source(s) before replacing it.",
        ""
      );

      return;
    }

    setProcessingState(
      true,
      "Running analysis",
      `${canAmazon ? "Amazon " : ""}${canAmazon && canFlipkart ? "+ " : ""}${canFlipkart ? "Flipkart" : ""}`,
      "Analysis"
    );

    const amazon =
      canAmazon
      ?
      buildAmazonModularResult(
        date
      )
      :
      null;

    const flipkart =
      canFlipkart
      ?
      buildFlipkartModularResult(
        date
      )
      :
      null;

    const amazonRevenueSource =
      v4ReportForDate(
        "amazon_business_reports",
        date
      );

    const flipkartRevenueSource =
      v4ReportForDate(
        "flipkart_order_report",
        date
      );

    if(
      amazon
      ?.summary
    ){

      amazon.summary.revenueSourceDate =
        amazonRevenueSource
        ?.sourceReportDate
        ||
        amazonRevenueSource
        ?.reportDate
        ||
        null;
    }

    if(
      flipkart
      ?.summary
    ){

      flipkart.summary.revenueSourceDate =
        flipkartRevenueSource
        ?.sourceReportDate
        ||
        flipkartRevenueSource
        ?.reportDate
        ||
        null;
    }

    const snapshot =
      makePersistedSnapshot(
        date,
        fingerprint,
        amazon,
        flipkart
      );

    setProcessingState(
      true,
      "Saving daily snapshot",
      "Writing processed data in safe chunks",
      "Storage"
    );

    const savedMeta =
      await window
      .saveDailySnapshot(
        date,
        snapshot
      );

    snapshot.revision =
      savedMeta.revision;

    snapshotCache.set(
      date,
      snapshot
    );

    hydrateSnapshot(
      snapshot
    );

    const sourceCount =
      v4SourceCount(
        availability
      );

    const elapsed =
      Math.max(
        .1,
        (
          performance.now()
          -
          startTime
        )
        /
        1000
      );

    finalSetText(
      "dashboardLastUpdated",
      `Last updated · ${new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`
    );

    setUploadStatus(
      `${date} processed · ${sourceCount} / ${FINAL_REQUIRED_REPORTS.length} sources available · ${elapsed.toFixed(1)}s.`,
      "success"
    );

    refreshRevenueFreshnessUi();

  }
  catch(error){

    console.error(
      "Automatic processing failed",
      error
    );

    setUploadStatus(
      "Automatic processing failed: "
      +
      error.message,
      "error"
    );

  }
  finally{

    processingLock =
      false;

    setProcessingState(
      false
    );

    updateReadiness();
  }

}


/* ======================================================
   DASHBOARD VISUALIZATION
====================================================== */

function v5SparklineSvg(
  values
){

  const safe =
    (
      values
      ||
      []
    )
    .map(
      value =>
        Number(
          value || 0
        )
    );

  if(
    safe.length ===
    0
  ){
    return "";
  }

  const width =
    220;

  const height =
    34;

  const pad =
    2;

  const max =
    Math.max(
      ...safe,
      1
    );

  const min =
    Math.min(
      ...safe,
      0
    );

  const range =
    Math.max(
      1,
      max -
      min
    );

  const points =
    safe.map(
      (value,index) => {

        const x =
          safe.length ===
          1
          ?
          width / 2
          :
          pad
          +
          (
            index /
            (
              safe.length -
              1
            )
          )
          *
          (
            width -
            pad * 2
          );

        const y =
          height
          -
          pad
          -
          (
            (
              value -
              min
            )
            /
            range
          )
          *
          (
            height -
            pad * 2
          );

        return [
          x,
          y
        ];
      }
    );

  const path =
    points
    .map(
      (point,index) =>
        `${index ? "L" : "M"}${point[0].toFixed(1)},${point[1].toFixed(1)}`
    )
    .join(
      " "
    );

  const area =
    `${path} L${points[points.length-1][0].toFixed(1)},${height} L${points[0][0].toFixed(1)},${height} Z`;

  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
    <path class="spark-area" d="${area}"></path>
    <path class="spark-line" d="${path}"></path>
  </svg>`;

}


function v5RenderSparkline(
  id,
  values
){

  const element =
    document.getElementById(
      id
    );

  if(element){
    element.innerHTML =
      v5SparklineSvg(
        values
      );
  }

}


function v5DashboardTrendSeries(
  snapshots,
  category
){

  const series = {
    amazonDisparity:[],
    amazonSuppression:[],
    amazonBuyBox:[],
    amazonTotal:[],
    flipkartDisparity:[],
    flipkartBuyBox:[],
    flipkartTotal:[]
  };

  snapshots.forEach(
    snapshot => {

      const azPrice =
        v4PriceObservations(
          snapshot,
          "amazon",
          category
        );

      const fkPrice =
        v4PriceObservations(
          snapshot,
          "flipkart",
          category
        );

      series.amazonDisparity.push(
        v4UniqueProducts(
          azPrice.filter(
            row =>
              row.parityStatus ===
              "Disparity"
          ),
          "asin"
        )
      );

      series.flipkartDisparity.push(
        v4UniqueProducts(
          fkPrice.filter(
            row =>
              row.parityStatus ===
              "Disparity"
          ),
          "fsn"
        )
      );

      const suppressions =
        getSnapshotAmazonIssueRows(
          snapshot,
          "amazonSuppressions"
        )
        .filter(
          row =>
            dashboardCategoryMatches(
              row,
              category
            )
        );

      const azBuyBox =
        getSnapshotAmazonIssueRows(
          snapshot,
          "amazonBuyBox"
        )
        .filter(
          row =>
            dashboardCategoryMatches(
              row,
              category
            )
        );

      const fkBuyBox =
        getSnapshotFlipkartRows(
          snapshot
        )
        .filter(
          row =>
            dashboardCategoryMatches(
              row,
              category
            )
            &&
            row.buyBoxStatus ===
            "No Buy Box"
        );

      series.amazonSuppression.push(
        v4UniqueProducts(
          suppressions,
          "asin"
        )
      );

      series.amazonBuyBox.push(
        v4UniqueProducts(
          azBuyBox,
          "asin"
        )
      );

      series.flipkartBuyBox.push(
        v4UniqueProducts(
          fkBuyBox,
          "fsn"
        )
      );

      series.amazonTotal.push(
        Number(
          v4AmazonDedupImpactForSnapshot(
            snapshot,
            category
          )
          ||
          0
        )
      );

      series.flipkartTotal.push(
        Number(
          v4FlipkartDedupImpactForSnapshot(
            snapshot,
            category
          )
          ||
          0
        )
      );

    }
  );

  return series;
}


const v5RenderDashboardBase =
  renderDashboardFromSnapshots;

renderDashboardFromSnapshots = function(
  snapshots,
  period,
  anchor,
  category
){

  v5RenderDashboardBase(
    snapshots,
    period,
    anchor,
    category
  );

  const trends =
    v5DashboardTrendSeries(
      snapshots,
      category
    );

  v5RenderSparkline(
    "amazonDisparitySpark",
    trends.amazonDisparity
  );

  v5RenderSparkline(
    "amazonSuppressionSpark",
    trends.amazonSuppression
  );

  v5RenderSparkline(
    "amazonBuyBoxSpark",
    trends.amazonBuyBox
  );

  v5RenderSparkline(
    "amazonTotalSpark",
    trends.amazonTotal
  );

  v5RenderSparkline(
    "flipkartDisparitySpark",
    trends.flipkartDisparity
  );

  v5RenderSparkline(
    "flipkartBuyBoxSpark",
    trends.flipkartBuyBox
  );

  v5RenderSparkline(
    "flipkartTotalSpark",
    trends.flipkartTotal
  );

  document
  .querySelectorAll(
    ".metric-card"
  )
  .forEach(
    card => {

      card.style.animation =
        "none";

      card.offsetHeight;

      card.style.animation =
        "";
    }
  );

  refreshRevenueFreshnessUi();

};


/* ======================================================
   DASHBOARD PRICE DISPARITY EXPLORER
====================================================== */

function v5DisparityExplorerBaseRows(
  marketplace
){

  const category =
    document.getElementById(
      "disparityExplorerCategory"
    )
    ?.value
    ||
    "all";

  const type =
    document.getElementById(
      "disparityExplorerType"
    )
    ?.value
    ||
    "all";

  const rows = [];

  dashboardLoadedSnapshots
  .forEach(
    snapshot => {

      const sourceRows =
        marketplace ===
        "amazon"
        ?
        getSnapshotAmazonRows(
          snapshot
        )
        :
        getSnapshotFlipkartRows(
          snapshot
        );

      const liveAvailable =
        v4SnapshotModuleState(
          snapshot,
          marketplace ===
          "amazon"
          ?
          "amazonLive"
          :
          "flipkartLive"
        )
        !==
        "unavailable";

      sourceRows.forEach(
        row => {

          if(
            !dashboardCategoryMatches(
              row,
              category
            )
          ){
            return;
          }

          const issueTypes = [];

          if(
            row.listingPriceDisparity
          ){
            issueTypes.push(
              "Listing"
            );
          }

          if(
            liveAvailable
            &&
            row.livePriceDisparity
          ){
            issueTypes.push(
              "Live"
            );
          }

          if(
            row.mrpDisparity
          ){
            issueTypes.push(
              "MRP"
            );
          }

          if(
            type ===
            "listing"
            &&
            !issueTypes.includes(
              "Listing"
            )
          ){
            return;
          }

          if(
            type ===
            "live"
            &&
            !issueTypes.includes(
              "Live"
            )
          ){
            return;
          }

          if(
            type ===
            "mrp"
            &&
            !issueTypes.includes(
              "MRP"
            )
          ){
            return;
          }

          if(
            type ===
            "all"
            &&
            issueTypes.length ===
            0
          ){
            return;
          }

          const impactApplicable =
            type ===
            "mrp"
            ?
            false
            :
            (
              type ===
              "listing"
              ?
              issueTypes.includes("Listing")
              :
              (
                type ===
                "live"
                ?
                issueTypes.includes("Live")
                :
                (
                  issueTypes.includes("Listing")
                  ||
                  issueTypes.includes("Live")
                )
              )
            );

          let impact =
            null;

          if(
            impactApplicable
            &&
            v4SnapshotRevenueAvailable(
              snapshot,
              marketplace
            )
          ){

            impact =
              type ===
              "listing"
              ?
              Number(
                row.listingDailyRevenueImpact
                ||
                0
              )
              :
              (
                type ===
                "live"
                ?
                Number(
                  row.liveDailyRevenueImpact
                  ||
                  row.dailyRevenueImpact
                  ||
                  0
                )
                :
                Math.max(
                  Number(
                    row.listingDailyRevenueImpact
                    ||
                    0
                  ),
                  Number(
                    row.liveDailyRevenueImpact
                    ||
                    row.dailyRevenueImpact
                    ||
                    0
                  )
                )
              );
          }

          rows.push({
            reportDate:
              snapshot.reportDate,
            marketplace,
            category:
              row.category,
            wfSku:
              row.wfSku,
            marketplaceSku:
              marketplace ===
              "amazon"
              ?
              row.azSku
              :
              row.fkSku,
            identifier:
              marketplace ===
              "amazon"
              ?
              row.asin
              :
              row.fsn,
            listingPrice:
              row.listingPrice,
            livePrice:
              row.finalLivePrice,
            wfPrice:
              row.wfPrice,
            marketplaceMrp:
              marketplace ===
              "amazon"
              ?
              row.azMrp
              :
              row.fkMrp,
            wfMrp:
              row.wfMrp,
            issueTypes,
            impactApplicable,
            impact,
            revenueAvailable:
              v4SnapshotRevenueAvailable(
                snapshot,
                marketplace
              )
          });

        }
      );

    }
  );

  if(
    type !==
    "all"
  ){
    return rows;
  }

  const groups =
    new Map();

  rows.forEach(
    row => {

      const key =
        [
          row.reportDate,
          row.category,
          row.wfSku,
          row.identifier
        ]
        .join(
          "||"
        );

      if(
        !groups.has(
          key
        )
      ){

        groups.set(
          key,
          {
            ...row,
            marketplaceSkus:new Set(),
            issueSet:new Set(),
            impact:
              row.impact,
            impactApplicable:
              row.impactApplicable,
            revenueAvailable:
              row.revenueAvailable
          }
        );
      }

      const group =
        groups.get(
          key
        );

      if(
        row.marketplaceSku
      ){
        group
        .marketplaceSkus
        .add(
          row.marketplaceSku
        );
      }

      row.issueTypes
      .forEach(
        issue =>
          group
          .issueSet
          .add(
            issue
          )
      );

      group.impactApplicable =
        group.impactApplicable
        ||
        row.impactApplicable;

      if(
        row.impact !==
        null
      ){

        group.impact =
          Math.max(
            Number(
              group.impact
              ||
              0
            ),
            Number(
              row.impact
              ||
              0
            )
          );
      }

    }
  );

  return Array.from(
    groups.values()
  )
  .map(
    row => ({
      ...row,
      marketplaceSku:
        Array.from(
          row.marketplaceSkus
        )
        .sort()
        .join(
          ", "
        ),
      issueTypes:
        Array.from(
          row.issueSet
        )
    })
  );

}


function renderDisparityExplorer(){

  const table =
    document.getElementById(
      "disparityExplorerTable"
    );

  if(!table){
    return;
  }

  const query =
    document.getElementById(
      "disparityExplorerSearch"
    )
    ?.value
    ?.trim()
    .toUpperCase()
    ||
    "";

  const sort =
    document.getElementById(
      "disparityExplorerSort"
    )
    ?.value
    ||
    "impact_desc";

  const baseRows =
    v5DisparityExplorerBaseRows(
      currentDisparityExplorerMarketplace
    );

  const rows =
    baseRows.filter(
      row => {

        if(!query){
          return true;
        }

        return [
          row.identifier,
          row.wfSku,
          row.marketplaceSku,
          row.category
        ]
        .some(
          value =>
            String(
              value || ""
            )
            .toUpperCase()
            .includes(
              query
            )
        );
      }
    );

  rows.sort(
    (a,b) => {

      if(
        sort ===
        "category_asc"
      ){
        return String(
          a.category || ""
        )
        .localeCompare(
          String(
            b.category || ""
          )
        );
      }

      if(
        sort ===
        "identifier_asc"
      ){
        return String(
          a.identifier || ""
        )
        .localeCompare(
          String(
            b.identifier || ""
          )
        );
      }

      return Number(
        b.impact || 0
      )
      -
      Number(
        a.impact || 0
      );
    }
  );

  currentDisparityExplorerRows =
    rows;

  currentDisparityExplorerExportRows =
    rows.map(
      row => ({
        Date:
          row.reportDate,
        Category:
          row.category,
        "WF SKU":
          row.wfSku,
        [
          currentDisparityExplorerMarketplace ===
          "amazon"
          ?
          "AZ SKU"
          :
          "FK SKU"
        ]:
          row.marketplaceSku,
        [
          currentDisparityExplorerMarketplace ===
          "amazon"
          ?
          "ASIN"
          :
          "FSN"
        ]:
          row.identifier,
        "Disparity Type":
          row.issueTypes.join(
            ", "
          ),
        "WF Price":
          row.wfPrice,
        "Listing Price":
          row.listingPrice,
        "Live Price":
          row.livePrice,
        "WF MRP":
          row.wfMrp,
        "Marketplace MRP":
          row.marketplaceMrp,
        "Rev Impact / Day":
          !row.impactApplicable
          ?
          "N/A"
          :
          (
            row.revenueAvailable
            ?
            row.impact
            :
            "Revenue Data Unavailable"
          )
      })
    );

  const productCount =
    v4UniqueProducts(
      rows,
      "identifier"
    );

  finalSetText(
    "disparityExplorerProducts",
    formatNumber(
      productCount
    )
  );

  finalSetText(
    "disparityExplorerListing",
    formatNumber(
      v4UniqueProducts(
        rows.filter(
          row =>
            row.issueTypes.includes(
              "Listing"
            )
        ),
        "identifier"
      )
    )
  );

  finalSetText(
    "disparityExplorerLive",
    formatNumber(
      v4UniqueProducts(
        rows.filter(
          row =>
            row.issueTypes.includes(
              "Live"
            )
        ),
        "identifier"
      )
    )
  );

  finalSetText(
    "disparityExplorerMrp",
    formatNumber(
      v4UniqueProducts(
        rows.filter(
          row =>
            row.issueTypes.includes(
              "MRP"
            )
        ),
        "identifier"
      )
    )
  );

  const totalDays =
    v4DaysInclusive(
      document.getElementById(
        "dashboardFromDate"
      )
      ?.value
      ||
      todayIso(),
      document.getElementById(
        "dashboardToDate"
      )
      ?.value
      ||
      todayIso()
    );

  const moduleKey =
    currentDisparityExplorerMarketplace ===
    "amazon"
    ?
    "amazonListing"
    :
    "flipkartListing";

  const coverage =
    v4ModuleCoverage(
      dashboardLoadedSnapshots,
      moduleKey,
      totalDays
    );

  finalSetText(
    "disparityExplorerAvailability",
    coverage.availableDays
    ?
    (
      coverage.availableDays <
      totalDays
      ?
      "Partial Data"
      :
      "Available"
    )
    :
    "No Data Available"
  );

  finalSetText(
    "disparityExplorerCoverage",
    `${coverage.availableDays} / ${totalDays} days`
  );

  if(!rows.length){

    table.innerHTML =
      `<tbody><tr><td class="empty-row">No disparity records found</td></tr></tbody>`;

    return;
  }

  const marketSkuLabel =
    currentDisparityExplorerMarketplace ===
    "amazon"
    ?
    "AZ SKU"
    :
    "FK SKU";

  const identifierLabel =
    currentDisparityExplorerMarketplace ===
    "amazon"
    ?
    "ASIN"
    :
    "FSN";

  let html =
    `<thead><tr>
      <th>Date</th>
      <th>Category</th>
      <th>WF SKU</th>
      <th>${marketSkuLabel}</th>
      <th>${identifierLabel}</th>
      <th>Disparity Type</th>
      <th>WF Price</th>
      <th>Listing Price</th>
      <th>Live Price</th>
      <th>Rev Impact / Day</th>
    </tr></thead><tbody>`;

  rows
  .slice(
    0,
    1800
  )
  .forEach(
    row => {

      const chips =
        row.issueTypes
        .map(
          issue =>
            `<span class="disparity-type-chip">${escapeHtml(issue)}</span>`
        )
        .join(
          ""
        );

      html +=
        `<tr>
          <td>${escapeHtml(row.reportDate)}</td>
          <td>${escapeHtml(row.category||"")}</td>
          <td>${escapeHtml(row.wfSku||"")}</td>
          <td>${escapeHtml(row.marketplaceSku||"")}</td>
          <td>${escapeHtml(row.identifier||"")}</td>
          <td>${chips}</td>
          <td>${Number(row.wfPrice)>0 ? formatINR(row.wfPrice) : "—"}</td>
          <td>${Number(row.listingPrice)>0 ? formatINR(row.listingPrice) : "—"}</td>
          <td>${Number(row.livePrice)>0 ? formatINR(row.livePrice) : "—"}</td>
          <td>${!row.impactApplicable ? "N/A" : (row.revenueAvailable ? formatINR(row.impact||0) : "Revenue Data Unavailable")}</td>
        </tr>`;

    }
  );

  html +=
    "</tbody>";

  table.innerHTML =
    html;

}


function openDashboardPriceView(
  marketplace
){

  currentDisparityExplorerMarketplace =
    marketplace;

  finalSetText(
    "disparityExplorerTitle",
    marketplace ===
    "amazon"
    ?
    "Amazon Price Disparity"
    :
    "Flipkart Price Disparity"
  );

  const type =
    document.getElementById(
      "disparityExplorerType"
    );

  if(type){
    type.value =
      "all";
  }

  const search =
    document.getElementById(
      "disparityExplorerSearch"
    );

  if(search){
    search.value =
      "";
  }

  const categorySelect =
    document.getElementById(
      "disparityExplorerCategory"
    );

  const rows =
    dashboardLoadedSnapshots.flatMap(
      snapshot =>
        marketplace ===
        "amazon"
        ?
        getSnapshotAmazonRows(
          snapshot
        )
        :
        getSnapshotFlipkartRows(
          snapshot
        )
    );

  populateCategorySelectFromRows(
    categorySelect,
    rows,
    "all"
  );

  showView(
    "priceDisparityExplorerSection"
  );

  renderDisparityExplorer();

}


function downloadDisparityExplorer(){

  if(
    !currentDisparityExplorerExportRows
    .length
  ){

    showWakeSuiteToast(
      "No disparity rows are available to download.",
      "warning"
    );

    return;
  }

  const fromDate =
    document.getElementById(
      "dashboardFromDate"
    )
    ?.value
    ||
    todayIso();

  const toDate =
    document.getElementById(
      "dashboardToDate"
    )
    ?.value
    ||
    fromDate;

  writeExcelReport(
    `${currentDisparityExplorerMarketplace}_All_Price_Disparities_${fromDate}_to_${toDate}.xlsx`,
    {
      Marketplace:
        currentDisparityExplorerMarketplace,
      From:
        fromDate,
      To:
        toDate,
      Rows:
        currentDisparityExplorerExportRows.length
    },
    currentDisparityExplorerExportRows
  );

}


[
  "disparityExplorerType",
  "disparityExplorerCategory",
  "disparityExplorerSort"
]
.forEach(
  id =>
    document
    .getElementById(
      id
    )
    ?.addEventListener(
      "change",
      renderDisparityExplorer
    )
);

let disparitySearchTimer =
  null;

document
.getElementById(
  "disparityExplorerSearch"
)
?.addEventListener(
  "input",
  () => {

    clearTimeout(
      disparitySearchTimer
    );

    disparitySearchTimer =
      setTimeout(
        renderDisparityExplorer,
        140
      );
  }
);


/* ======================================================
   MARKETPLACE INSIGHTS · FULL ANALYTICS
====================================================== */

function v5SvgLineChart(
  points,
  valueKey,
  labelKey
){

  const width =
    720;

  const height =
    225;

  const left =
    46;

  const right =
    16;

  const top =
    14;

  const bottom =
    30;

  const values =
    points.map(
      point =>
        Number(
          point[valueKey] || 0
        )
    );

  const max =
    Math.max(
      ...values,
      1
    );

  const chartWidth =
    width -
    left -
    right;

  const chartHeight =
    height -
    top -
    bottom;

  const coords =
    values.map(
      (value,index) => {

        const x =
          left
          +
          (
            values.length ===
            1
            ?
            chartWidth / 2
            :
            (
              index /
              (
                values.length -
                1
              )
            )
            *
            chartWidth
          );

        const y =
          top
          +
          chartHeight
          -
          (
            value /
            max
          )
          *
          chartHeight;

        return [
          x,
          y
        ];
      }
    );

  const path =
    coords
    .map(
      (coord,index) =>
        `${index ? "L" : "M"}${coord[0].toFixed(1)},${coord[1].toFixed(1)}`
    )
    .join(
      " "
    );

  const area =
    coords.length
    ?
    `${path} L${coords[coords.length-1][0].toFixed(1)},${top+chartHeight} L${coords[0][0].toFixed(1)},${top+chartHeight} Z`
    :
    "";

  const grid = [
    0,
    .25,
    .5,
    .75,
    1
  ]
  .map(
    ratio => {

      const y =
        top
        +
        chartHeight
        -
        ratio
        *
        chartHeight;

      return `<line class="chart-gridline" x1="${left}" x2="${width-right}" y1="${y}" y2="${y}"></line>
        <text class="chart-axis-label" x="4" y="${y+3}">${escapeHtml(formatNumber(max*ratio))}</text>`;
    }
  )
  .join(
    ""
  );

  const labels =
    points
    .filter(
      (_,index) =>
        index ===
        0
        ||
        index ===
        points.length -
        1
        ||
        (
          points.length > 5
          &&
          index %
          Math.ceil(
            points.length /
            5
          ) ===
          0
        )
    )
    .map(
      point => {

        const index =
          points.indexOf(
            point
          );

        const x =
          left
          +
          (
            points.length ===
            1
            ?
            chartWidth / 2
            :
            (
              index /
              (
                points.length -
                1
              )
            )
            *
            chartWidth
          );

        const label =
          String(
            point[labelKey] || ""
          )
          .slice(
            5
          );

        return `<text class="chart-axis-label" text-anchor="middle" x="${x}" y="${height-8}">${escapeHtml(label)}</text>`;
    }
  )
  .join(
    ""
  );

  const circles =
    coords
    .map(
      coord =>
        `<circle class="chart-point" cx="${coord[0]}" cy="${coord[1]}" r="3"></circle>`
    )
    .join(
      ""
    );

  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
    <defs>
      <linearGradient id="wsAreaGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#6941c6" stop-opacity=".20"></stop>
        <stop offset="100%" stop-color="#6941c6" stop-opacity=".01"></stop>
      </linearGradient>
    </defs>
    ${grid}
    ${area ? `<path class="chart-area" d="${area}"></path>` : ""}
    ${path ? `<path class="chart-line" d="${path}"></path>` : ""}
    ${circles}
    ${labels}
  </svg>`;

}


function v5SvgParityBars(
  points
){

  const width =
    720;

  const height =
    225;

  const left =
    26;

  const right =
    12;

  const top =
    14;

  const bottom =
    28;

  const chartWidth =
    width -
    left -
    right;

  const chartHeight =
    height -
    top -
    bottom;

  const maxTotal =
    Math.max(
      ...points.map(
        point =>
          Number(
            point.parity || 0
          )
          +
          Number(
            point.disparity || 0
          )
      ),
      1
    );

  const slot =
    chartWidth /
    Math.max(
      points.length,
      1
    );

  const barWidth =
    Math.max(
      4,
      Math.min(
        24,
        slot * .58
      )
    );

  let bars =
    "";

  points.forEach(
    (point,index) => {

      const x =
        left
        +
        index
        *
        slot
        +
        (
          slot -
          barWidth
        )
        /
        2;

      const parityHeight =
        Number(
          point.parity || 0
        )
        /
        maxTotal
        *
        chartHeight;

      const disparityHeight =
        Number(
          point.disparity || 0
        )
        /
        maxTotal
        *
        chartHeight;

      const yParity =
        top
        +
        chartHeight
        -
        parityHeight;

      const yDisparity =
        yParity
        -
        disparityHeight;

      bars +=
        `<rect class="chart-bar-parity" x="${x}" y="${yParity}" width="${barWidth}" height="${parityHeight}" rx="3"></rect>
         <rect class="chart-bar-disparity" x="${x}" y="${Math.max(top,yDisparity)}" width="${barWidth}" height="${disparityHeight}" rx="3"></rect>`;

    }
  );

  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
    <line class="chart-gridline" x1="${left}" x2="${width-right}" y1="${top+chartHeight}" y2="${top+chartHeight}"></line>
    ${bars}
    <text class="chart-axis-label" x="${left}" y="${height-8}">Parity</text>
    <text class="chart-axis-label" x="${left+48}" y="${height-8}">+ Disparity</text>
  </svg>`;

}


function v5TopProductExposure(
  snapshots,
  marketplace,
  category
){

  const groups =
    new Map();

  const apply =
    (
      snapshot,
      key,
      row,
      impact,
      issue
    ) => {

      if(!key){
        return;
      }

      const groupKey =
        `${marketplace}||${key}`;

      if(
        !groups.has(
          groupKey
        )
      ){

        groups.set(
          groupKey,
          {
            marketplace,
            category:
              row.category,
            wfSku:
              row.wfSku,
            marketplaceSku:
              marketplace ===
              "amazon"
              ?
              row.azSku
              :
              row.fkSku,
            identifier:key,
            dates:new Set(),
            issues:new Set(),
            exposureByDate:new Map()
          }
        );
      }

      const group =
        groups.get(
          groupKey
        );

      group.dates.add(
        snapshot.reportDate
      );

      if(issue){
        group.issues.add(
          issue
        );
      }

      const prior =
        Number(
          group.exposureByDate.get(
            snapshot.reportDate
          )
          ||
          0
        );

      group.exposureByDate.set(
        snapshot.reportDate,
        Math.max(
          prior,
          Number(
            impact || 0
          )
        )
      );
    };

  snapshots.forEach(
    snapshot => {

      v4PriceObservations(
        snapshot,
        marketplace,
        category
      )
      .filter(
        row =>
          row.parityStatus ===
          "Disparity"
      )
      .forEach(
        row =>
          apply(
            snapshot,
            marketplace ===
            "amazon"
            ?
            row.asin
            :
            row.fsn,
            row,
            row.priceImpact,
            "Price Disparity"
          )
      );

      if(
        marketplace ===
        "amazon"
      ){

        getSnapshotAmazonIssueRows(
          snapshot,
          "amazonSuppressions"
        )
        .filter(
          row =>
            dashboardCategoryMatches(
              row,
              category
            )
        )
        .forEach(
          row =>
            apply(
              snapshot,
              row.asin,
              row,
              row.revenueImpactPerDay,
              "ASIN Suppression"
            )
        );

        getSnapshotAmazonIssueRows(
          snapshot,
          "amazonBuyBox"
        )
        .filter(
          row =>
            dashboardCategoryMatches(
              row,
              category
            )
        )
        .forEach(
          row =>
            apply(
              snapshot,
              row.asin,
              row,
              row.revenueImpactPerDay,
              "Buy Box Suppression"
            )
        );
      }
      else{

        getSnapshotFlipkartRows(
          snapshot
        )
        .filter(
          row =>
            dashboardCategoryMatches(
              row,
              category
            )
            &&
            row.buyBoxStatus ===
            "No Buy Box"
        )
        .forEach(
          row =>
            apply(
              snapshot,
              row.fsn,
              row,
              row.buyBoxRevenueImpactPerDay,
              "Buy Box Unavailable"
            )
        );
      }

    }
  );

  return Array.from(
    groups.values()
  )
  .map(
    group => ({
      ...group,
      exposure:
        Array.from(
          group.exposureByDate.values()
        )
        .reduce(
          (sum,value) =>
            sum
            +
            Number(
              value || 0
            ),
          0
        )
    })
  )
  .sort(
    (a,b) =>
      b.exposure
      -
      a.exposure
  );

}




function v6InsightImpactForFocus(
  snapshots,
  marketplace,
  category,
  focus
){
  let total = 0;
  let available = false;

  (snapshots || []).forEach(
    snapshot => {
      if(!v4SnapshotRevenueAvailable(snapshot,marketplace)){
        return;
      }

      available = true;
      let rows = [];

      if(focus === "price_disparity"){
        rows =
          v6InsightPriceRows(snapshot,marketplace,category,"all",false)
            .filter(row=>row.impact !== null);
      }
      else if(focus === "amazon_suppression" && marketplace === "amazon"){
        rows =
          v6InsightIssueRows(snapshot,"amazon_suppression",category);
      }
      else if(focus === "amazon_buybox" && marketplace === "amazon"){
        rows =
          v6InsightIssueRows(snapshot,"amazon_buybox",category);
      }
      else if(focus === "flipkart_buybox" && marketplace === "flipkart"){
        rows =
          v6InsightIssueRows(snapshot,"flipkart_buybox",category);
      }

      const byProduct = new Map();

      rows.forEach(
        row => {
          if(!row.identifier || row.impact === null){
            return;
          }

          byProduct.set(
            row.identifier,
            Math.max(
              Number(byProduct.get(row.identifier) || 0),
              Number(row.impact || 0)
            )
          );
        }
      );

      total +=
        Array.from(byProduct.values())
          .reduce((sum,value)=>sum+Number(value||0),0);
    }
  );

  return {
    total,
    available
  };
}


function v6MetricsForMarketplace(
  snapshots,
  marketplace,
  category
){
  const parityIds = new Set();
  const disparityIds = new Set();
  const suppressionIds = new Set();
  const buyBoxIds = new Set();

  let parityObservations = 0;
  let disparityObservations = 0;
  let suppressionObservations = 0;
  let buyBoxObservations = 0;
  let totalImpact = 0;
  let revenueAvailable = false;

  (snapshots || []).forEach(
    snapshot => {
      const parityRows =
        v6InsightPriceRows(snapshot,marketplace,category,"all",true);

      const disparityRows =
        v6InsightPriceRows(snapshot,marketplace,category,"all",false);

      parityObservations +=
        new Set(parityRows.map(row=>row.identifier).filter(Boolean)).size;

      disparityObservations +=
        new Set(disparityRows.map(row=>row.identifier).filter(Boolean)).size;

      parityRows.forEach(row=>{
        if(row.identifier) parityIds.add(row.identifier);
      });

      disparityRows.forEach(row=>{
        if(row.identifier) disparityIds.add(row.identifier);
      });

      if(marketplace === "amazon"){
        const suppressionRows =
          v6InsightIssueRows(snapshot,"amazon_suppression",category);

        const buyBoxRows =
          v6InsightIssueRows(snapshot,"amazon_buybox",category);

        suppressionObservations +=
          new Set(suppressionRows.map(row=>row.identifier).filter(Boolean)).size;

        buyBoxObservations +=
          new Set(buyBoxRows.map(row=>row.identifier).filter(Boolean)).size;

        suppressionRows.forEach(row=>{
          if(row.identifier) suppressionIds.add(row.identifier);
        });

        buyBoxRows.forEach(row=>{
          if(row.identifier) buyBoxIds.add(row.identifier);
        });
      }else{
        const buyBoxRows =
          v6InsightIssueRows(snapshot,"flipkart_buybox",category);

        buyBoxObservations +=
          new Set(buyBoxRows.map(row=>row.identifier).filter(Boolean)).size;

        buyBoxRows.forEach(row=>{
          if(row.identifier) buyBoxIds.add(row.identifier);
        });
      }

      if(v4SnapshotRevenueAvailable(snapshot,marketplace)){
        revenueAvailable = true;
        totalImpact +=
          marketplace === "amazon"
            ? Number(v4AmazonDedupImpactForSnapshot(snapshot,category) || 0)
            : Number(v4FlipkartDedupImpactForSnapshot(snapshot,category) || 0);
      }
    }
  );

  const priceImpact =
    v6InsightImpactForFocus(
      snapshots,
      marketplace,
      category,
      "price_disparity"
    );

  const suppressionImpact =
    marketplace === "amazon"
      ? v6InsightImpactForFocus(
          snapshots,
          marketplace,
          category,
          "amazon_suppression"
        )
      : {total:0,available:false};

  const buyBoxImpact =
    v6InsightImpactForFocus(
      snapshots,
      marketplace,
      category,
      marketplace === "amazon" ? "amazon_buybox" : "flipkart_buybox"
    );

  return {
    parityCount:parityIds.size,
    disparityCount:disparityIds.size,
    suppressionCount:suppressionIds.size,
    buyBoxCount:buyBoxIds.size,
    parityObservations,
    disparityObservations,
    suppressionObservations,
    buyBoxObservations,
    priceImpact:priceImpact.total,
    priceImpactAvailable:priceImpact.available,
    suppressionImpact:suppressionImpact.total,
    suppressionImpactAvailable:suppressionImpact.available,
    buyBoxImpact:buyBoxImpact.total,
    buyBoxImpactAvailable:buyBoxImpact.available,
    totalImpact,
    revenueAvailable,
    priceChecks:parityObservations + disparityObservations
  };
}



async function loadMarketplaceInsights(
  forceMarketplace = null
){

  if(
    typeof window.listDailySnapshotMetas !==
    "function"
  ){
    return;
  }

  if(forceMarketplace){

    const marketSelect =
      document.getElementById(
        "insightsMarketplace"
      );

    if(marketSelect){
      marketSelect.value =
        forceMarketplace;
    }
  }

  const marketplace =
    document.getElementById(
      "insightsMarketplace"
    )
    ?.value
    ||
    "combined";

  const period =
    document.getElementById(
      "insightsPeriod"
    )
    ?.value
    ||
    "daily";

  const [
    fromDate,
    toDate
  ] =
    v4SetRangeControls(
      "insightsPeriod",
      "insightsFromDate",
      "insightsToDate",
      "insightsDate"
    );

  const snapshots =
    await v4LoadSnapshotsForRange(
      fromDate,
      toDate
    );

  const categorySelect =
    document.getElementById(
      "insightsCategory"
    );

  const oldCategory =
    categorySelect
    ?.value
    ||
    "all";

  const allRows =
    snapshots.flatMap(
      snapshot => [
        ...getSnapshotAmazonRows(
          snapshot
        ),
        ...getSnapshotFlipkartRows(
          snapshot
        )
      ]
    );

  populateCategorySelectFromRows(
    categorySelect,
    allRows,
    oldCategory
  );

  const category =
    categorySelect
    ?.value
    ||
    "all";

  const markets =
    marketplace ===
    "combined"
    ?
    [
      "amazon",
      "flipkart"
    ]
    :
    [
      marketplace
    ];

  const dailyRows = [];

  let totalParity =
    0;

  let totalDisparity =
    0;

  let totalImpact =
    0;

  let totalIssues =
    0;

  let revenueAvailableDays =
    0;

  let baseCoverageDays =
    0;

  const categoryExposure =
    new Map();

  snapshots.forEach(
    snapshot => {

      let dayParity =
        0;

      let dayDisparity =
        0;

      let dayImpact =
        0;

      let dayIssues =
        0;

      let dayHasRevenue =
        false;

      let dayHasBase =
        false;

      markets.forEach(
        market => {

          const baseKey =
            market ===
            "amazon"
            ?
            "amazonListing"
            :
            "flipkartListing";

          if(
            v4SnapshotModuleState(
              snapshot,
              baseKey
            )
            !==
            "unavailable"
          ){
            dayHasBase =
              true;
          }

          const priceRows =
            v4PriceObservations(
              snapshot,
              market,
              category
            );

          const parity =
            priceRows.filter(
              row =>
                row.parityStatus ===
                "Parity"
            )
            .length;

          const disparity =
            priceRows.filter(
              row =>
                row.parityStatus ===
                "Disparity"
            )
            .length;

          dayParity +=
            parity;

          dayDisparity +=
            disparity;

          if(
            v4SnapshotRevenueAvailable(
              snapshot,
              market
            )
          ){

            dayHasRevenue =
              true;

            const impact =
              market ===
              "amazon"
              ?
              Number(
                v4AmazonDedupImpactForSnapshot(
                  snapshot,
                  category
                )
                ||
                0
              )
              :
              Number(
                v4FlipkartDedupImpactForSnapshot(
                  snapshot,
                  category
                )
                ||
                0
              );

            dayImpact +=
              impact;

            const productRows =
              v5TopProductExposure(
                [snapshot],
                market,
                category
              );

            productRows.forEach(
              row => {

                const key =
                  row.category
                  ||
                  "Unmapped";

                categoryExposure.set(
                  key,
                  Number(
                    categoryExposure.get(
                      key
                    )
                    ||
                    0
                  )
                  +
                  Number(
                    row.exposure || 0
                  )
                );
              }
            );
          }

          if(
            market ===
            "amazon"
          ){

            dayIssues +=
              v4UniqueProducts(
                getSnapshotAmazonIssueRows(
                  snapshot,
                  "amazonSuppressions"
                )
                .filter(
                  row =>
                    dashboardCategoryMatches(
                      row,
                      category
                    )
                ),
                "asin"
              );

            dayIssues +=
              v4UniqueProducts(
                getSnapshotAmazonIssueRows(
                  snapshot,
                  "amazonBuyBox"
                )
                .filter(
                  row =>
                    dashboardCategoryMatches(
                      row,
                      category
                    )
                ),
                "asin"
              );
          }
          else{

            dayIssues +=
              v4UniqueProducts(
                getSnapshotFlipkartRows(
                  snapshot
                )
                .filter(
                  row =>
                    dashboardCategoryMatches(
                      row,
                      category
                    )
                    &&
                    row.buyBoxStatus ===
                    "No Buy Box"
                ),
                "fsn"
              );
          }

        }
      );

      if(dayHasBase){
        baseCoverageDays +=
          1;
      }

      if(dayHasRevenue){
        revenueAvailableDays +=
          1;
      }

      totalParity +=
        dayParity;

      totalDisparity +=
        dayDisparity;

      totalImpact +=
        dayImpact;

      totalIssues +=
        dayIssues;

      dailyRows.push({
        date:
          snapshot.reportDate,
        parity:
          dayParity,
        disparity:
          dayDisparity,
        impact:
          dayImpact,
        issues:
          dayIssues,
        revenueAvailable:
          dayHasRevenue
      });

    }
  );

  const observationCount =
    totalParity
    +
    totalDisparity;

  const totalDays =
    v4DaysInclusive(
      fromDate,
      toDate
    );

  const coverageState =
    baseCoverageDays ===
    0
    ?
    "unavailable"
    :
    (
      baseCoverageDays <
      totalDays
      ?
      "partial"
      :
      "available"
    );

  finalSetText(
    "insightsAvailability",
    coverageState ===
    "unavailable"
    ?
    "No Data Available"
    :
    (
      coverageState ===
      "partial"
      ?
      "Partial Data"
      :
      "Available"
    )
  );

  finalSetText(
    "insightsCoverage",
    `${baseCoverageDays} / ${totalDays} days`
  );

  finalSetText(
    "insightsParity",
    observationCount
    ?
    formatPercent(
      totalParity /
      observationCount
    )
    :
    "—"
  );

  finalSetText(
    "insightsParitySub",
    observationCount
    ?
    `${formatNumber(totalParity)} parity checks`
    :
    "No Data Available"
  );

  finalSetText(
    "insightsDisparity",
    observationCount
    ?
    formatNumber(
      totalDisparity
    )
    :
    "—"
  );

  finalSetText(
    "insightsDisparitySub",
    observationCount
    ?
    `${formatPercent(totalDisparity/observationCount)} of checks`
    :
    "No Data Available"
  );

  finalSetText(
    "insightsImpact",
    revenueAvailableDays
    ?
    formatINR(
      totalImpact
    )
    :
    "Revenue Data Unavailable"
  );

  finalSetText(
    "insightsImpactSub",
    revenueAvailableDays
    ?
    `${revenueAvailableDays} revenue day${revenueAvailableDays===1?"":"s"}`
    :
    "Refresh revenue source"
  );

  finalSetText(
    "insightsIssues",
    snapshots.length
    ?
    formatNumber(
      totalIssues
    )
    :
    "—"
  );

  finalSetText(
    "insightsIssuesSub",
    marketplace ===
    "amazon"
    ?
    "Suppression + Buy Box"
    :
    (
      marketplace ===
      "flipkart"
      ?
      "Buy Box unavailable"
      :
      "Amazon + Flipkart"
    )
  );

  finalSetText(
    "insightsCoverageKpi",
    `${baseCoverageDays}/${totalDays}`
  );

  finalSetText(
    "insightsCoverageSub",
    coverageState ===
    "available"
    ?
    "Complete selected period"
    :
    (
      coverageState ===
      "partial"
      ?
      "Some dates unavailable"
      :
      "No marketplace data"
    )
  );

  const [
    amazonRevenue,
    flipkartRevenue
  ] =
    await Promise.all([
      v5LatestRevenueSource(
        "amazon_business_reports"
      ),
      v5LatestRevenueSource(
        "flipkart_order_report"
      )
    ]);

  const freshnessItems =
    markets.map(
      market =>
        v5FreshnessState(
          market ===
          "amazon"
          ?
          amazonRevenue?.reportDate
          :
          flipkartRevenue?.reportDate,
          todayIso()
        )
    );

  const worst =
    freshnessItems.some(
      item =>
        item.status ===
        "expired"
        ||
        item.status ===
        "missing"
    )
    ?
    "Refresh Required"
    :
    (
      freshnessItems.some(
        item =>
          item.status ===
          "due"
      )
      ?
      "Due Soon"
      :
      "Fresh"
    );

  finalSetText(
    "insightsFreshnessKpi",
    worst
  );

  finalSetText(
    "insightsFreshnessSub",
    revenueAvailableDays
    ?
    `${revenueAvailableDays}/${snapshots.length || 0} stored days with revenue`
    :
    "Revenue unavailable"
  );

  const revenueChart =
    document.getElementById(
      "insightsRevenueTrend"
    );

  if(revenueChart){

    revenueChart.innerHTML =
      dailyRows.length
      ?
      v5SvgLineChart(
        dailyRows,
        "impact",
        "date"
      )
      :
      `<div class="empty-row">No Data Available</div>`;
  }

  const parityChart =
    document.getElementById(
      "insightsParityChart"
    );

  if(parityChart){

    parityChart.innerHTML =
      dailyRows.length
      ?
      v5SvgParityBars(
        dailyRows
      )
      :
      `<div class="empty-row">No Data Available</div>`;
  }

  const issueChart =
    document.getElementById(
      "insightsIssueTrend"
    );

  if(issueChart){

    issueChart.innerHTML =
      dailyRows.length
      ?
      v5SvgLineChart(
        dailyRows,
        "issues",
        "date"
      )
      :
      `<div class="empty-row">No Data Available</div>`;
  }

  const categoryBox =
    document.getElementById(
      "insightsCategoryContribution"
    );

  if(categoryBox){

    const categories =
      Array.from(
        categoryExposure.entries()
      )
      .sort(
        (a,b) =>
          b[1] -
          a[1]
      )
      .slice(
        0,
        10
      );

    const maxCategory =
      Math.max(
        ...categories.map(
          entry =>
            entry[1]
        ),
        1
      );

    categoryBox.innerHTML =
      categories.length
      ?
      categories
      .map(
        ([name,value]) =>
          `<div class="category-bar-row">
            <div class="category-bar-label" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
            <div class="category-bar-track"><div class="category-bar-fill" style="width:${Math.max(2,(value/maxCategory)*100).toFixed(1)}%"></div></div>
            <div class="category-bar-value">${formatINR(value)}</div>
          </div>`
      )
      .join("")
      :
      `<div class="empty-row">Revenue Data Unavailable</div>`;
  }

  const topProducts = [];

  markets.forEach(
    market =>
      topProducts.push(
        ...v5TopProductExposure(
          snapshots,
          market,
          category
        )
      )
  );

  topProducts.sort(
    (a,b) =>
      b.exposure
      -
      a.exposure
  );

  const topTable =
    document.getElementById(
      "insightsTopProductsTable"
    );

  if(topTable){

    let html =
      `<thead><tr>
        <th>Marketplace</th>
        <th>Category</th>
        <th>WF SKU</th>
        <th>ASIN / FSN</th>
        <th>Issue Types</th>
        <th>Affected Days</th>
        <th>Revenue Exposure</th>
      </tr></thead><tbody>`;

    if(!topProducts.length){

      html +=
        `<tr><td colspan="7" class="empty-row">No impacted products</td></tr>`;
    }

    topProducts
    .slice(
      0,
      20
    )
    .forEach(
      row => {

        html +=
          `<tr>
            <td>${escapeHtml(row.marketplace === "amazon" ? "Amazon" : "Flipkart")}</td>
            <td>${escapeHtml(row.category||"")}</td>
            <td>${escapeHtml(row.wfSku||"")}</td>
            <td>${escapeHtml(row.identifier||"")}</td>
            <td>${escapeHtml(Array.from(row.issues).join(", "))}</td>
            <td>${formatNumber(row.dates.size)}</td>
            <td><strong>${formatINR(row.exposure||0)}</strong></td>
          </tr>`;

      }
    );

    html +=
      "</tbody>";

    topTable.innerHTML =
      html;
  }

  const detailTable =
    document.getElementById(
      "insightsTable"
    );

  if(detailTable){

    let html =
      `<thead><tr>
        <th>Date</th>
        <th>Parity</th>
        <th>Disparity</th>
        <th>Parity %</th>
        <th>Revenue Impact</th>
        <th>Issues</th>
      </tr></thead><tbody>`;

    if(!dailyRows.length){

      html +=
        `<tr><td colspan="6" class="empty-row">No Data Available</td></tr>`;
    }

    dailyRows.forEach(
      row => {

        const checks =
          row.parity
          +
          row.disparity;

        html +=
          `<tr>
            <td>${escapeHtml(row.date)}</td>
            <td class="parity">${formatNumber(row.parity)}</td>
            <td class="disparity">${formatNumber(row.disparity)}</td>
            <td>${checks ? formatPercent(row.parity/checks) : "—"}</td>
            <td>${row.revenueAvailable ? formatINR(row.impact) : "Revenue Data Unavailable"}</td>
            <td>${formatNumber(row.issues)}</td>
          </tr>`;
      }
    );

    html +=
      "</tbody>";

    detailTable.innerHTML =
      html;
  }

  finalSetText(
    "insightsImpactTrendMeta",
    `${fromDate} → ${toDate}`
  );

  finalSetText(
    "insightsDailyDetailMeta",
    `${dailyRows.length} stored day${dailyRows.length===1?"":"s"}`
  );

  currentInsightsReport = {
    market:
      marketplace,
    period,
    fromDate,
    toDate,
    category,
    rows:
      dailyRows.map(
        row => ({
          Date:
            row.date,
          Parity:
            row.parity,
          Disparity:
            row.disparity,
          "Revenue Impact":
            row.revenueAvailable
            ?
            row.impact
            :
            "Revenue Data Unavailable",
          Issues:
            row.issues
        })
      ),
    topProducts:
      topProducts.slice(
        0,
        500
      ),
    summary:{
      Marketplace:
        marketplace,
      Category:
        category,
      From:
        fromDate,
      To:
        toDate,
      "Parity %":
        observationCount
        ?
        totalParity /
        observationCount
        :
        0,
      Disparity:
        totalDisparity,
      "Revenue Impact":
        revenueAvailableDays
        ?
        totalImpact
        :
        "Revenue Data Unavailable",
      Issues:
        totalIssues,
      "Available Days":
        baseCoverageDays
    }
  };

}


function downloadMarketplaceInsights(){

  if(
    !currentInsightsReport
  ){

    loadMarketplaceInsights()
    .then(
      downloadMarketplaceInsights
    );

    return;
  }

  const report =
    currentInsightsReport;

  const workbook =
    XLSX.utils.book_new();

  const summaryRows =
    Object.entries(
      report.summary
    )
    .map(
      ([Metric,Value]) => ({
        Metric,
        Value
      })
    );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      summaryRows
    ),
    "Summary"
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      report.rows
    ),
    "Daily Trend"
  );

  const topRows =
    report.topProducts.map(
      row => ({
        Marketplace:
          row.marketplace ===
          "amazon"
          ?
          "Amazon"
          :
          "Flipkart",
        Category:
          row.category,
        "WF SKU":
          row.wfSku,
        "Marketplace SKU":
          row.marketplaceSku,
        "ASIN / FSN":
          row.identifier,
        "Issue Types":
          Array.from(
            row.issues
          )
          .join(
            ", "
          ),
        "Affected Days":
          row.dates.size,
        "Revenue Exposure":
          row.exposure
      })
    );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      topRows
    ),
    "Top Impacted Products"
  );

  XLSX.writeFile(
    workbook,
    `Marketplace_Insights_${report.market}_${report.fromDate}_to_${report.toDate}.xlsx`
  );

}


/* ======================================================
   MARKETPLACE DATA · ONE WF SKU ROW
====================================================== */

function v5JoinSet(
  values
){

  return Array.from(
    new Set(
      values
      .map(
        value =>
          String(
            value || ""
          )
          .trim()
      )
      .filter(Boolean)
    )
  )
  .sort()
  .join(
    " | "
  );

}


function v4MarketplaceDataAllRows(
  snapshot
){

  const amazonRows =
    getSnapshotAmazonRows(
      snapshot
    );

  const flipkartRows =
    getSnapshotFlipkartRows(
      snapshot
    );

  const groups =
    new Map();

  const ensure =
    (
      category,
      wfSku
    ) => {

      const key =
        `${category||""}||${wfSku||""}`;

      if(
        !groups.has(
          key
        )
      ){

        groups.set(
          key,
          {
            Category:
              category,
            "WF SKU":
              wfSku,
            amazon:[],
            flipkart:[]
          }
        );
      }

      return groups.get(
        key
      );
    };

  amazonRows.forEach(
    row =>
      ensure(
        row.category,
        row.wfSku
      )
      .amazon
      .push(
        row
      )
  );

  flipkartRows.forEach(
    row =>
      ensure(
        row.category,
        row.wfSku
      )
      .flipkart
      .push(
        row
      )
  );

  return Array.from(
    groups.values()
  )
  .map(
    group => {

      const azRevenueMap =
        new Map();

      group.amazon.forEach(
        row => {

          if(
            row.asin
            &&
            row.revenueAvailable !==
            false
          ){

            azRevenueMap.set(
              row.asin,
              Math.max(
                Number(
                  azRevenueMap.get(
                    row.asin
                  )
                  ||
                  0
                ),
                Number(
                  row.asinRevenue
                  ||
                  0
                )
              )
            );
          }
        }
      );

      const fkRevenueMap =
        new Map();

      group.flipkart.forEach(
        row => {

          if(
            row.fsn
            &&
            row.revenueAvailable !==
            false
          ){

            fkRevenueMap.set(
              row.fsn,
              Math.max(
                Number(
                  fkRevenueMap.get(
                    row.fsn
                  )
                  ||
                  0
                ),
                Number(
                  row.liveCalculatedRevenue
                  ||
                  row.listingCalculatedRevenue
                  ||
                  row.calculatedRevenue
                  ||
                  0
                )
              )
            );
          }
        }
      );

      return {
        Category:
          group.Category,
        "WF SKU":
          group["WF SKU"],
        "AZ SKU":
          v5JoinSet(
            group.amazon.map(
              row =>
                row.azSku
            )
          ),
        ASIN:
          v5JoinSet(
            group.amazon.map(
              row =>
                row.asin
            )
          ),
        "FK SKU":
          v5JoinSet(
            group.flipkart.map(
              row =>
                row.fkSku
            )
          ),
        FSN:
          v5JoinSet(
            group.flipkart.map(
              row =>
                row.fsn
            )
          ),
        "WF MRP":
          v4MinPositive(
            [
              ...group.amazon.map(
                row =>
                  row.wfMrp
              ),
              ...group.flipkart.map(
                row =>
                  row.wfMrp
              )
            ]
          ),
        "WF Price":
          v4MinPositive(
            [
              ...group.amazon.map(
                row =>
                  row.wfPrice
              ),
              ...group.flipkart.map(
                row =>
                  row.wfPrice
              )
            ]
          ),
        "Amazon MRP":
          v4MinPositive(
            group.amazon.map(
              row =>
                row.azMrp
            )
          ),
        "Amazon Listing Price":
          v4MinPositive(
            group.amazon.map(
              row =>
                row.listingPrice
            )
          ),
        "Amazon Live Price":
          v4MinPositive(
            group.amazon.map(
              row =>
                row.finalLivePrice
            )
          ),
        "Flipkart MRP":
          v4MinPositive(
            group.flipkart.map(
              row =>
                row.fkMrp
            )
          ),
        "Flipkart Listing Price":
          v4MinPositive(
            group.flipkart.map(
              row =>
                row.listingPrice
            )
          ),
        "Flipkart Live Price":
          v4MinPositive(
            group.flipkart.map(
              row =>
                row.finalLivePrice
            )
          ),
        "Amazon Inventory":
          group.amazon.reduce(
            (sum,row) =>
              sum
              +
              Number(
                row.inventory || 0
              ),
            0
          ),
        "Flipkart Inventory":
          group.flipkart.reduce(
            (sum,row) =>
              sum
              +
              Number(
                row.inventory || 0
              ),
            0
          ),
        "Amazon Revenue":
          azRevenueMap.size
          ?
          Array.from(
            azRevenueMap.values()
          )
          .reduce(
            (sum,value) =>
              sum
              +
              value,
            0
          )
          :
          null,
        "Flipkart Revenue":
          fkRevenueMap.size
          ?
          Array.from(
            fkRevenueMap.values()
          )
          .reduce(
            (sum,value) =>
              sum
              +
              value,
            0
          )
          :
          null,
        Availability:
          group.amazon.length
          &&
          group.flipkart.length
          ?
          "Amazon + Flipkart"
          :
          (
            group.amazon.length
            ?
            "Amazon"
            :
            "Flipkart"
          )
      };
    }
  );

}


function v4MarketplaceMappingRows(
  snapshot
){

  return v4MarketplaceDataAllRows(
    snapshot
  );
}


function v4DataTypeColumns(
  view,
  type,
  rows
){

  const allColumns =
    Array.from(
      new Set(
        rows.flatMap(
          row =>
            Object.keys(
              row
            )
        )
      )
    );

  const combinedCore = [
    "Category",
    "WF SKU",
    "AZ SKU",
    "ASIN",
    "FK SKU",
    "FSN",
    "Availability"
  ];

  const combinedPricing = [
    "Category",
    "WF SKU",
    "AZ SKU",
    "ASIN",
    "FK SKU",
    "FSN",
    "WF MRP",
    "WF Price",
    "Amazon MRP",
    "Amazon Listing Price",
    "Amazon Live Price",
    "Flipkart MRP",
    "Flipkart Listing Price",
    "Flipkart Live Price"
  ];

  const combinedInventory = [
    "Category",
    "WF SKU",
    "AZ SKU",
    "ASIN",
    "FK SKU",
    "FSN",
    "Amazon Inventory",
    "Flipkart Inventory"
  ];

  const combinedRevenue = [
    "Category",
    "WF SKU",
    "AZ SKU",
    "ASIN",
    "FK SKU",
    "FSN",
    "Amazon Revenue",
    "Flipkart Revenue"
  ];

  if(
    view ===
    "all"
    ||
    view ===
    "mapping"
  ){

    const map = {
      core:
        combinedCore,
      pricing:
        combinedPricing,
      inventory:
        combinedInventory,
      revenue:
        combinedRevenue,
      full:
        allColumns
    };

    return (
      map[type]
      ||
      allColumns
    )
    .filter(
      column =>
        allColumns.includes(
          column
        )
    );
  }

  const sets = {
    amazon:{
      core:[
        "Category",
        "WF SKU",
        "AZ SKU",
        "ASIN"
      ],
      pricing:[
        "Category",
        "WF SKU",
        "AZ SKU",
        "ASIN",
        "WF MRP",
        "WF Price",
        "AZ MRP",
        "Listing Price",
        "Live Price",
        "Listing Status",
        "Live Status"
      ],
      inventory:[
        "Category",
        "WF SKU",
        "AZ SKU",
        "ASIN",
        "Inventory"
      ],
      revenue:[
        "Category",
        "WF SKU",
        "AZ SKU",
        "ASIN",
        "ASIN Revenue"
      ]
    },
    flipkart:{
      core:[
        "Category",
        "WF SKU",
        "FK SKU",
        "FSN"
      ],
      pricing:[
        "Category",
        "WF SKU",
        "FK SKU",
        "FSN",
        "WF MRP",
        "WF Price",
        "FK MRP",
        "Listing Price",
        "Live Price",
        "Listing Status",
        "Live Status"
      ],
      inventory:[
        "Category",
        "WF SKU",
        "FK SKU",
        "FSN",
        "Inventory"
      ],
      revenue:[
        "Category",
        "WF SKU",
        "FK SKU",
        "FSN",
        "Orders Received",
        "Revenue Quantity",
        "Revenue"
      ]
    }
  };

  if(
    type ===
    "full"
  ){
    return allColumns;
  }

  return (
    sets
    ?.[view]
    ?.[type]
    ||
    allColumns
  )
  .filter(
    column =>
      allColumns.includes(
        column
      )
  );

}



function v4MarketplaceDataRevenue(
  row
){

  if(
    "Amazon Revenue" in row
    ||
    "Flipkart Revenue" in row
  ){

    return Number(
      row["Amazon Revenue"]
      ||
      0
    )
    +
    Number(
      row["Flipkart Revenue"]
      ||
      0
    );
  }

  return Number(
    row.Revenue
    ??
    row["ASIN Revenue"]
    ??
    0
  );
}


function v4MarketplaceDataPrice(
  row
){

  return Math.max(
    Number(
      row["Live Price"]
      ||
      0
    ),
    Number(
      row["Listing Price"]
      ||
      0
    ),
    Number(
      row["Amazon Live Price"]
      ||
      0
    ),
    Number(
      row["Amazon Listing Price"]
      ||
      row["Amazon Price"]
      ||
      0
    ),
    Number(
      row["Flipkart Live Price"]
      ||
      0
    ),
    Number(
      row["Flipkart Listing Price"]
      ||
      row["Flipkart Price"]
      ||
      0
    )
  );
}


/* ======================================================
   USER ACCESS MANAGEMENT UI
====================================================== */

const ACCESS_ROLE_PRESETS = {
  viewer:{
    view:true,
    upload:false,
    download:true,
    email:false,
    settings:false,
    userAdmin:false
  },
  analyst:{
    view:true,
    upload:true,
    download:true,
    email:true,
    settings:false,
    userAdmin:false
  },
  admin:{
    view:true,
    upload:true,
    download:true,
    email:true,
    settings:true,
    userAdmin:false
  },
  super_admin:{
    view:true,
    upload:true,
    download:true,
    email:true,
    settings:true,
    userAdmin:true
  }
};


function v5CurrentPermissions(){

  return window.currentWakeSuiteAccess
    ?.permissions
    ||
    ACCESS_ROLE_PRESETS.viewer;
}


function applyAccessPermissions(){

  const permissions =
    v5CurrentPermissions();

  const userAdminTab =
    document.getElementById(
      "userAccessSettingsTab"
    );

  if(userAdminTab){
    userAdminTab.style.display =
      permissions.userAdmin
      ?
      ""
      :
      "none";
  }

  document
  .querySelectorAll(
    "button"
  )
  .forEach(
    button => {

      const label =
        String(
          button.textContent || ""
        )
        .trim()
        .toLowerCase();

      if(
        label.includes(
          "download"
        )
      ){
        button.style.display =
          permissions.download
          ?
          ""
          :
          "none";
      }

      if(
        label.includes(
          "share via email"
        )
        ||
        label.includes(
          "send email"
        )
        ||
        label.includes(
          "gmail draft"
        )
      ){
        button.style.display =
          permissions.email
          ?
          ""
          :
          "none";
      }
    }
  );

  const uploadNav =
    Array.from(
      document
      .querySelectorAll(
        ".nav-link"
      )
    )
    .find(
      link =>
        link.textContent
        .toLowerCase()
        .includes(
          "upload center"
        )
    );

  if(uploadNav){
    uploadNav.style.display =
      permissions.upload
      ?
      ""
      :
      "none";
  }

  const settingsLink =
    Array.from(
      document
      .querySelectorAll(
        ".nav-link"
      )
    )
    .find(
      link =>
        link.textContent
        .trim()
        .toLowerCase() ===
        "settings"
    );

  if(settingsLink){
    settingsLink.style.display =
      (
        permissions.settings
        ||
        permissions.userAdmin
      )
      ?
      ""
      :
      "none";
  }

}


function v5PermissionCheckboxes(
  permissions,
  prefix
){

  return Object
  .keys(
    ACCESS_ROLE_PRESETS.super_admin
  )
  .map(
    key =>
      `<label class="permission-check">
        <input type="checkbox" data-permission="${key}" data-prefix="${prefix}" ${permissions?.[key] ? "checked" : ""}>
        ${escapeHtml(key === "userAdmin" ? "User Admin" : key.charAt(0).toUpperCase()+key.slice(1))}
      </label>`
  )
  .join("");

}


async function loadUserAccessManagement(){

  if(
    !window.currentWakeSuiteAccess
    ?.permissions
    ?.userAdmin
  ){

    showWakeSuiteToast(
      "You do not have User Administration permission.",
      "warning"
    );

    return;
  }

  if(
    typeof window.loadWakeSuiteAccessDirectory !==
    "function"
  ){

    showWakeSuiteToast(
      "Access service is still loading.",
      "info"
    );

    return;
  }

  try{

    const directory =
      await window
      .loadWakeSuiteAccessDirectory();

    const invited =
      document.getElementById(
        "invitedAccessUsers"
      );

    const pending =
      document.getElementById(
        "pendingAccessRequests"
      );

    const users =
      document.getElementById(
        "approvedAccessUsers"
      );

    if(invited){

      invited.innerHTML =
        `<div class="analytics-card-head"><strong>Invited Users</strong><span>${directory.invites?.length || 0}</span></div>`
        +
        (
          directory.invites?.length
          ?
          directory.invites.map(
            invite =>
              `<div class="access-card">
                <div class="access-card-head">
                  <div><strong>${escapeHtml(invite.email||"")}</strong><br><small>${escapeHtml(invite.role||"viewer")}</small></div>
                  <span class="access-status-badge pending">Invited</span>
                </div>
              </div>`
          )
          .join("")
          :
          `<div class="empty-row">No pending invitations</div>`
        );
    }

    if(pending){

      pending.innerHTML =
        `<div class="analytics-card-head"><strong>Pending Requests</strong><span>${directory.requests.length}</span></div>`
        +
        (
          directory.requests.length
          ?
          directory.requests.map(
            request =>
              `<div class="access-card">
                <div class="access-card-head">
                  <div><strong>${escapeHtml(request.email||request.uid)}</strong><br><small>${escapeHtml(request.name||"")}</small></div>
                  <span class="access-status-badge pending">Pending</span>
                </div>
                <div class="access-actions">
                  <select id="request-role-${escapeHtml(request.uid)}">
                    <option value="viewer">Viewer</option>
                    <option value="analyst" selected>Analyst</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button class="primary-btn" onclick="approveWakeSuiteRequest('${escapeHtml(request.uid)}')">Approve</button>
                  <button class="secondary-btn" onclick="rejectWakeSuiteRequest('${escapeHtml(request.uid)}')">Reject</button>
                </div>
              </div>`
          )
          .join("")
          :
          `<div class="empty-row">No pending access requests</div>`
        );
    }

    if(users){

      users.innerHTML =
        `<div class="analytics-card-head"><strong>Approved Users</strong><span>${directory.users.length}</span></div>`
        +
        (
          directory.users.length
          ?
          directory.users.map(
            user => {

              const role =
                user.role
                ||
                "viewer";

              const permissions =
                user.permissions
                ||
                ACCESS_ROLE_PRESETS[
                  role
                ]
                ||
                ACCESS_ROLE_PRESETS.viewer;

              return `<div class="access-card" data-access-uid="${escapeHtml(user.uid)}">
                <div class="access-card-head">
                  <div><strong>${escapeHtml(user.email||user.uid)}</strong><br><small>${escapeHtml(user.name||"")} · ${escapeHtml(role)}</small></div>
                  <span class="access-status-badge approved">Approved</span>
                </div>
                <div class="permission-grid">${v5PermissionCheckboxes(permissions,user.uid)}</div>
                <div class="access-actions">
                  <select class="access-role-select">
                    <option value="viewer" ${role==="viewer"?"selected":""}>Viewer</option>
                    <option value="analyst" ${role==="analyst"?"selected":""}>Analyst</option>
                    <option value="admin" ${role==="admin"?"selected":""}>Admin</option>
                    <option value="super_admin" ${role==="super_admin"?"selected":""}>Super Admin</option>
                  </select>
                  <button class="primary-btn" onclick="saveWakeSuiteUserAccess('${escapeHtml(user.uid)}')">Save Access</button>
                  ${role==="super_admin" ? "" : `<button class="secondary-btn" onclick="disableWakeSuiteUser('${escapeHtml(user.uid)}')">Disable</button>`}
                </div>
              </div>`;
            }
          )
          .join("")
          :
          `<div class="empty-row">No approved users</div>`
        );
    }

  }
  catch(error){

    showWakeSuiteToast(
      error.message,
      "error",
      "Unable to load access management"
    );
  }

}


async function inviteWakeSuiteUser(){

  const email =
    document.getElementById(
      "inviteUserEmail"
    )
    ?.value
    ?.trim()
    .toLowerCase();

  const role =
    document.getElementById(
      "inviteUserRole"
    )
    ?.value
    ||
    "viewer";

  if(!email){

    showWakeSuiteToast(
      "Enter the user's email address.",
      "warning"
    );

    return;
  }

  if(
    typeof window.inviteWakeSuiteAccess !==
    "function"
  ){
    return;
  }

  try{

    await window
    .inviteWakeSuiteAccess(
      email,
      role,
      ACCESS_ROLE_PRESETS[
        role
      ]
    );

    document.getElementById(
      "inviteUserEmail"
    ).value =
      "";

    showWakeSuiteToast(
      `${email} added with ${role} access.`,
      "success",
      "User added"
    );

    loadUserAccessManagement();

  }
  catch(error){

    showWakeSuiteToast(
      error.message,
      "error",
      "Unable to add user"
    );
  }

}


async function approveWakeSuiteRequest(
  uid
){

  const role =
    document.getElementById(
      `request-role-${uid}`
    )
    ?.value
    ||
    "analyst";

  await window
  .approveWakeSuiteAccessRequest(
    uid,
    role,
    ACCESS_ROLE_PRESETS[
      role
    ]
  );

  showWakeSuiteToast(
    "Access request approved.",
    "success"
  );

  loadUserAccessManagement();

}


async function rejectWakeSuiteRequest(
  uid
){

  await window
  .rejectWakeSuiteAccessRequest(
    uid
  );

  showWakeSuiteToast(
    "Access request rejected.",
    "success"
  );

  loadUserAccessManagement();

}


async function saveWakeSuiteUserAccess(
  uid
){

  const card =
    document.querySelector(
      `[data-access-uid="${CSS.escape(uid)}"]`
    );

  if(!card){
    return;
  }

  const role =
    card
    .querySelector(
      ".access-role-select"
    )
    ?.value
    ||
    "viewer";

  const permissions = {};

  card
  .querySelectorAll(
    "[data-permission]"
  )
  .forEach(
    input => {

      permissions[
        input.dataset.permission
      ] =
        input.checked;

    }
  );

  await window
  .saveWakeSuiteAccessUser(
    uid,
    role,
    permissions
  );

  showWakeSuiteToast(
    "User access updated.",
    "success"
  );

  loadUserAccessManagement();

}


async function disableWakeSuiteUser(
  uid
){

  await window
  .disableWakeSuiteAccessUser(
    uid
  );

  showWakeSuiteToast(
    "User access disabled.",
    "success"
  );

  loadUserAccessManagement();

}


function showSettingsPane(
  id,
  button
){

  document
  .querySelectorAll(
    ".settings-pane"
  )
  .forEach(
    pane =>
      pane.classList.remove(
        "active"
      )
  );

  document
  .querySelectorAll(
    ".settings-tab"
  )
  .forEach(
    tab =>
      tab.classList.remove(
        "active"
      )
  );

  document.getElementById(
    id
  )
  ?.classList
  .add(
    "active"
  );

  button
  ?.classList
  .add(
    "active"
  );

  if(
    id ===
    "emailHistoryPane"
  ){
    renderEmailHistory();
  }

  if(
    id ===
    "userAccessPane"
  ){
    loadUserAccessManagement();
  }

}


/* ---------- No popup email/settings feedback ---------- */

function saveCurrentEmailTemplate(){

  const state =
    loadEmailState();

  const key =
    document.getElementById(
      "emailTemplateReport"
    )
    ?.value;

  if(!key){
    return;
  }

  state.templates[key] = {
    to:
      document.getElementById("emailTemplateTo")?.value?.trim() || "",
    cc:
      document.getElementById("emailTemplateCc")?.value?.trim() || "",
    bcc:
      document.getElementById("emailTemplateBcc")?.value?.trim() || "",
    subject:
      document.getElementById("emailTemplateSubject")?.value || "",
    greeting:
      document.getElementById("emailTemplateGreeting")?.value || "",
    message:
      document.getElementById("emailTemplateMessage")?.value || "",
    contentMode:
      document.getElementById("emailContentMode")?.value || "message",
    attachExcel:
      document.getElementById("emailAttachExcel")?.value === "yes",
    useSignature:
      document.getElementById("emailUseSignature")?.value === "yes",
    inlineLimit:
      Math.max(
        1,
        Math.min(
          100,
          Number(
            document.getElementById("emailInlineLimit")?.value || 30
          )
        )
      )
  };

  saveEmailState(
    state
  );

  showWakeSuiteToast(
    "Email settings saved.",
    "success"
  );

}


function saveRecipientGroups(){

  const state =
    loadEmailState();

  state.groups =
    Array.from(
      document.querySelectorAll(
        ".recipient-group-row"
      )
    )
    .map(
      row => ({
        name:
          row.querySelector(".group-name")?.value?.trim() || "",
        emails:
          row.querySelector(".group-emails")?.value?.trim() || ""
      })
    )
    .filter(
      group =>
        group.name
        &&
        group.emails
    );

  saveEmailState(
    state
  );

  showWakeSuiteToast(
    "Recipient groups saved.",
    "success"
  );

}


function saveDefaultEmailSignature(){

  const state =
    loadEmailState();

  state.signature =
    document.getElementById(
      "defaultEmailSignature"
    )
    ?.value
    ||
    "";

  saveEmailState(
    state
  );

  showWakeSuiteToast(
    "Email signature saved.",
    "success"
  );

}


/* ---------- V5 page metadata / listeners / exports ---------- */

try{
  FINAL_VIEW_TITLES.priceDisparityExplorerSection =
    "Price Disparity";
}catch(error){}

try{
  APP_VIEW_META.priceDisparityExplorerSection =
    ["Price Disparity",""];
}catch(error){}


document
.getElementById(
  "insightsCategory"
)
?.addEventListener(
  "change",
  () =>
    loadMarketplaceInsights()
);


window.addEventListener(
  "resize",
  () => {

    if(
      window.innerWidth >
      920
    ){
      closeMobileSidebar();
    }
  }
);


window.toggleMobileSidebar =
  toggleMobileSidebar;

window.closeMobileSidebar =
  closeMobileSidebar;

window.showWakeSuiteToast =
  showWakeSuiteToast;

window.openDashboardPriceView =
  openDashboardPriceView;

window.downloadDisparityExplorer =
  downloadDisparityExplorer;

window.loadUserAccessManagement =
  loadUserAccessManagement;

window.inviteWakeSuiteUser =
  inviteWakeSuiteUser;

window.approveWakeSuiteRequest =
  approveWakeSuiteRequest;

window.rejectWakeSuiteRequest =
  rejectWakeSuiteRequest;

window.saveWakeSuiteUserAccess =
  saveWakeSuiteUserAccess;

window.disableWakeSuiteUser =
  disableWakeSuiteUser;

window.applyAccessPermissions =
  applyAccessPermissions;

window.refreshRevenueFreshnessUi =
  refreshRevenueFreshnessUi;



/* ======================================================
   WAKESUITE V6 · FINAL INTERACTION / REPORT OVERRIDES
====================================================== */

const V6_PERIOD_LABELS = {
  today:"Today",
  yesterday:"Yesterday",
  last7:"Last 7 Days",
  last15:"Last 15 Days",
  last30:"Last 30 Days",
  custom:"Custom Range"
};

let v6DisparityExplorerMode = "dashboard";
let v6DisparityExplorerStrictType = "all";
let v6DisparityExplorerSnapshots = [];
let v6DisparityExplorerRawRows = [];
let v6InsightFocus = "all";
let v6InsightsState = null;


/* ======================================================
   DATE PRESETS
====================================================== */

function v6AddDaysIso(
  iso,
  delta
){
  const d = new Date((iso || todayIso()) + "T00:00:00");
  d.setDate(d.getDate() + Number(delta || 0));
  return v4IsoDate(d);
}


v4DateRangeForPeriod = function(
  period,
  fromDate,
  toDate
){
  const today = todayIso();

  if(period === "today"){
    return [today,today];
  }

  if(period === "yesterday"){
    const yesterday = v6AddDaysIso(today,-1);
    return [yesterday,yesterday];
  }

  if(period === "last7"){
    return [v6AddDaysIso(today,-6),today];
  }

  if(period === "last15"){
    return [v6AddDaysIso(today,-14),today];
  }

  if(period === "last30"){
    return [v6AddDaysIso(today,-29),today];
  }

  let start = fromDate || today;
  let end = toDate || start;

  if(end < start){
    [start,end] = [end,start];
  }

  return [start,end];
};


v4SetRangeControls = function(
  periodId,
  fromId,
  toId,
  anchorId = null
){
  const period = document.getElementById(periodId)?.value || "today";
  const fromInput = document.getElementById(fromId);
  const toInput = document.getElementById(toId);

  if(!fromInput || !toInput){
    return [todayIso(),todayIso()];
  }

  const [fromDate,toDate] =
    v4DateRangeForPeriod(
      period,
      fromInput.value || todayIso(),
      toInput.value || todayIso()
    );

  fromInput.value = fromDate;
  toInput.value = toDate;

  const custom = period === "custom";
  fromInput.disabled = !custom;
  toInput.disabled = !custom;

  if(anchorId){
    const anchor = document.getElementById(anchorId);
    if(anchor){
      anchor.value = fromDate;
    }
  }

  return [fromDate,toDate];
};


reportFilename = function(
  prefix,
  period,
  fromDate,
  toDate = null
){
  const end = toDate || fromDate;

  if(fromDate === end){
    return `${prefix}_${fromDate}.xlsx`;
  }

  return `${prefix}_${fromDate}_to_${end}.xlsx`;
};


/* ======================================================
   DASHBOARD CLEANUP / SEARCH MODE
====================================================== */

function v6ReadableDate(
  iso
){
  if(!iso){
    return "—";
  }

  const date = new Date(iso + "T00:00:00");

  return date.toLocaleDateString(
    "en-GB",
    {
      day:"2-digit",
      month:"short",
      year:"numeric"
    }
  );
}


function v6UpdateTopAsOf(
  snapshots
){
  const available = (snapshots || []).filter(Boolean);

  if(!available.length){
    finalSetText(
      "latestCompletedDateDisplay",
      "As of —"
    );
    return;
  }

  const latest = [...available].sort(
    (a,b) => String(a.reportDate || "").localeCompare(String(b.reportDate || ""))
  ).at(-1);

  let updated = null;

  try{
    if(latest?.updatedAt?.toDate){
      updated = latest.updatedAt.toDate();
    }else if(latest?.completedAt?.toDate){
      updated = latest.completedAt.toDate();
    }
  }catch(error){}

  let label = `As of ${v6ReadableDate(latest?.reportDate)}`;

  if(updated){
    label += ` · Updated ${updated.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`;
  }

  finalSetText(
    "latestCompletedDateDisplay",
    label
  );
}


const v6DashboardBaseRenderer = renderDashboardFromSnapshots;

renderDashboardFromSnapshots = function(
  snapshots,
  period,
  anchor,
  category
){
  v6DashboardBaseRenderer(
    snapshots,
    period,
    anchor,
    category
  );

  v6UpdateTopAsOf(
    snapshots
  );

  /*
    Price exposure is product-level even when one ASIN / FSN has
    multiple active marketplace SKUs. Count the highest applicable
    price exposure once per product per day.
  */
  const dedupPriceImpact = marketplace => {
    let total = 0;

    (snapshots || []).forEach(
      snapshot => {
        if(!v4SnapshotRevenueAvailable(snapshot,marketplace)){
          return;
        }

        const rows =
          v4PriceObservations(
            snapshot,
            marketplace,
            category
          )
          .filter(row=>row.parityStatus === "Disparity");

        const byProduct = new Map();

        rows.forEach(
          row => {
            const key = marketplace === "amazon" ? row.asin : row.fsn;
            if(!key){
              return;
            }

            byProduct.set(
              key,
              Math.max(
                Number(byProduct.get(key) || 0),
                Number(row.priceImpact || 0)
              )
            );
          }
        );

        total +=
          Array.from(byProduct.values())
            .reduce((sum,value)=>sum+Number(value||0),0);
      }
    );

    return total;
  };

  const amazonPriceImpactV6 = dedupPriceImpact("amazon");
  const flipkartPriceImpactV6 = dedupPriceImpact("flipkart");

  v4SetMoneyMetric(
    "amazonPriceImpact",
    amazonPriceImpactV6,
    (snapshots || []).some(snapshot=>v4SnapshotRevenueAvailable(snapshot,"amazon"))
  );

  v4SetMoneyMetric(
    "flipkartPriceImpact",
    flipkartPriceImpactV6,
    (snapshots || []).some(snapshot=>v4SnapshotRevenueAvailable(snapshot,"flipkart"))
  );

  const singleDay =
    v4DaysInclusive(
      document.getElementById("dashboardFromDate")?.value,
      document.getElementById("dashboardToDate")?.value
    ) === 1;

  const impactCaption = singleDay ? "Rev Impact / Day" : "Revenue Exposure";

  [
    "amazonPriceImpactLabel",
    "amazonSuppressionImpactLabel",
    "amazonBuyBoxImpactLabel",
    "flipkartPriceImpactLabel",
    "flipkartBuyBoxImpactLabel",
    "amazonTotalImpactLabel",
    "flipkartTotalImpactLabel"
  ].forEach(id=>finalSetText(id,impactCaption));

  const home = document.getElementById("dashboardHome");

  if(home && !document.getElementById("dashboardGlobalSearch")?.value?.trim()){
    home.classList.remove("dashboard-search-active");
  }
};


runDashboardSearch = async function(){
  const query = document.getElementById("dashboardGlobalSearch")?.value?.trim() || "";

  if(!query){
    clearDashboardSearch();
    return;
  }

  if(!dashboardLoadedSnapshots.length){
    await loadDashboardOverview();
  }

  const category = document.getElementById("dashboardCategory")?.value || "all";
  const rows = v4BuildDashboardSearchRows(
    dashboardLoadedSnapshots,
    query,
    category
  );

  const period = document.getElementById("dashboardPeriod")?.value || "today";

  document.getElementById("dashboardHome")?.classList.add("dashboard-search-active");

  renderDashboardSearchResults(
    rows,
    period
  );
};


const v6ClearDashboardSearchBase = clearDashboardSearch;

clearDashboardSearch = function(
  clearInput = true
){
  v6ClearDashboardSearchBase(
    clearInput
  );

  document.getElementById("dashboardHome")?.classList.remove("dashboard-search-active");
};


/* ======================================================
   PRICE DISPARITY EXPLORER
====================================================== */

function v6DisparityTypeLabel(
  type
){
  return {
    all:"All Price Disparities",
    listing:"Listing Price Disparity",
    live:"Live Price Disparity",
    mrp:"MRP Disparity"
  }[type] || "Price Disparity";
}


function v6ExplorerIdentifierKey(){
  return currentDisparityExplorerMarketplace === "amazon" ? "asin" : "fsn";
}


function v6PriceRowImpact(
  row,
  type
){
  if(type === "mrp"){
    return null;
  }

  if(type === "listing"){
    return Number(row.listingDailyRevenueImpact || 0);
  }

  if(type === "live"){
    return Number(row.liveDailyRevenueImpact || row.dailyRevenueImpact || 0);
  }

  if(row.livePriceDisparity){
    return Number(row.liveDailyRevenueImpact || row.dailyRevenueImpact || 0);
  }

  if(row.listingPriceDisparity){
    return Number(row.listingDailyRevenueImpact || 0);
  }

  return null;
}


function v6CollectPriceDisparityRows(
  snapshots,
  marketplace,
  type,
  category = "all"
){
  const rows = [];

  (snapshots || []).forEach(
    snapshot => {
      const source =
        marketplace === "amazon"
        ? getSnapshotAmazonRows(snapshot)
        : getSnapshotFlipkartRows(snapshot);

      const liveAvailable =
        v4SnapshotModuleState(
          snapshot,
          marketplace === "amazon" ? "amazonLive" : "flipkartLive"
        ) !== "unavailable";

      source.forEach(
        row => {
          if(!dashboardCategoryMatches(row,category)){
            return;
          }

          const issueTypes = [];

          if(row.listingPriceDisparity){
            issueTypes.push("Listing");
          }

          if(liveAvailable && row.livePriceDisparity){
            issueTypes.push("Live");
          }

          if(row.mrpDisparity){
            issueTypes.push("MRP");
          }

          const include =
            type === "all"
            ? issueTypes.length > 0
            : (
                type === "listing"
                ? issueTypes.includes("Listing")
                : (
                    type === "live"
                    ? issueTypes.includes("Live")
                    : issueTypes.includes("MRP")
                  )
              );

          if(!include){
            return;
          }

          const marketSku =
            marketplace === "amazon"
            ? row.azSku
            : row.fkSku;

          const identifier =
            marketplace === "amazon"
            ? row.asin
            : row.fsn;

          const rawImpact =
            v4SnapshotRevenueAvailable(snapshot,marketplace)
            ? v6PriceRowImpact(row,type)
            : null;

          rows.push({
            ...row,
            marketplace,
            reportDate:snapshot.reportDate,
            marketSku,
            identifier,
            issueTypes,
            rawImpact,
            countedImpact:rawImpact,
            revenueAvailable:v4SnapshotRevenueAvailable(snapshot,marketplace)
          });
        }
      );
    }
  );

  /*
    Revenue is product-level. Multiple AZ/FK SKU rows may legitimately
    exist for one ASIN/FSN, but only one price exposure is counted per
    product per day in totals / period exposure.
  */
  const dailyProductGroups = new Map();

  rows.forEach(
    row => {
      const key = `${row.reportDate}||${row.identifier}`;

      if(!dailyProductGroups.has(key)){
        dailyProductGroups.set(key,[]);
      }

      dailyProductGroups.get(key).push(row);
    }
  );

  dailyProductGroups.forEach(
    group => {
      const revenueRows = group.filter(row => row.rawImpact !== null);

      if(!revenueRows.length){
        return;
      }

      const winner = [...revenueRows].sort(
        (a,b) => Number(b.rawImpact || 0) - Number(a.rawImpact || 0)
      )[0];

      revenueRows.forEach(
        row => {
          row.countedImpact = row === winner ? Number(row.rawImpact || 0) : 0;
        }
      );
    }
  );

  return rows;
}


function v6AggregatePriceRows(
  rows,
  multiDay
){
  if(!multiDay){
    return [...rows].sort(
      (a,b) => Number(b.countedImpact || 0) - Number(a.countedImpact || 0)
    );
  }

  const groups = new Map();

  rows.forEach(
    row => {
      const key = [
        row.category || "",
        row.wfSku || "",
        row.marketSku || "",
        row.identifier || ""
      ].join("||");

      if(!groups.has(key)){
        groups.set(
          key,
          {
            ...row,
            affectedDates:new Set(),
            issueSet:new Set(),
            periodExposure:0,
            countedRevenueDays:0,
            latestRow:row
          }
        );
      }

      const group = groups.get(key);
      group.affectedDates.add(row.reportDate);
      row.issueTypes.forEach(issue => group.issueSet.add(issue));

      if(row.countedImpact !== null){
        group.periodExposure += Number(row.countedImpact || 0);
        group.countedRevenueDays += 1;
      }

      if(String(row.reportDate) >= String(group.latestRow.reportDate)){
        group.latestRow = row;
      }
    }
  );

  return Array.from(groups.values()).map(
    group => {
      const latest = group.latestRow;

      return {
        ...latest,
        issueTypes:Array.from(group.issueSet),
        affectedDays:group.affectedDates.size,
        periodExposure:group.periodExposure,
        latestImpact:
          latest.rawImpact === null
          ? null
          : Number(latest.rawImpact || 0),
        countedRevenueDays:group.countedRevenueDays
      };
    }
  );
}


function v6SortExplorerRows(
  rows
){
  const sort = document.getElementById("disparityExplorerSort")?.value || "impact_desc";

  return [...rows].sort(
    (a,b) => {
      if(sort === "days_desc"){
        return Number(b.affectedDays || 1) - Number(a.affectedDays || 1);
      }

      if(sort === "category_asc"){
        return String(a.category || "").localeCompare(String(b.category || ""));
      }

      if(sort === "identifier_asc"){
        return String(a.identifier || "").localeCompare(String(b.identifier || ""));
      }

      return Number(
        (b.periodExposure ?? b.countedImpact ?? b.rawImpact) || 0
      ) - Number(
        (a.periodExposure ?? a.countedImpact ?? a.rawImpact) || 0
      );
    }
  );
}


function v6ExplorerSearchRows(
  rows
){
  const query = document.getElementById("disparityExplorerSearch")?.value?.trim().toUpperCase() || "";

  if(!query){
    return rows;
  }

  return rows.filter(
    row => [
      row.identifier,
      row.marketSku,
      row.wfSku,
      row.category
    ].some(
      value => String(value || "").toUpperCase().includes(query)
    )
  );
}


function v6ExplorerType(){
  return v6DisparityExplorerMode === "strict"
    ? v6DisparityExplorerStrictType
    : (document.getElementById("disparityExplorerType")?.value || "all");
}


async function loadDisparityExplorer(){
  const [fromDate,toDate] =
    v4SetRangeControls(
      "disparityExplorerPeriod",
      "disparityExplorerFromDate",
      "disparityExplorerToDate"
    );

  v6DisparityExplorerSnapshots =
    await v4LoadSnapshotsForRange(
      fromDate,
      toDate
    );

  const category = document.getElementById("disparityExplorerCategory")?.value || "all";
  const type = v6ExplorerType();

  v6DisparityExplorerRawRows =
    v6CollectPriceDisparityRows(
      v6DisparityExplorerSnapshots,
      currentDisparityExplorerMarketplace,
      type,
      category
    );

  const sourceRows =
    v6DisparityExplorerSnapshots.flatMap(
      snapshot =>
        currentDisparityExplorerMarketplace === "amazon"
        ? getSnapshotAmazonRows(snapshot)
        : getSnapshotFlipkartRows(snapshot)
    );

  const categorySelect = document.getElementById("disparityExplorerCategory");
  const oldCategory = categorySelect?.value || "all";

  populateCategorySelectFromRows(
    categorySelect,
    sourceRows,
    oldCategory
  );

  renderDisparityExplorer();
}


function renderDisparityExplorer(){
  const type = v6ExplorerType();
  const category = document.getElementById("disparityExplorerCategory")?.value || "all";

  if(
    v6DisparityExplorerRawRows.length === 0
    && v6DisparityExplorerSnapshots.length
  ){
    v6DisparityExplorerRawRows =
      v6CollectPriceDisparityRows(
        v6DisparityExplorerSnapshots,
        currentDisparityExplorerMarketplace,
        type,
        category
      );
  }

  let rows = v6DisparityExplorerRawRows.filter(
    row => category === "all" || String(row.category || "") === category
  );

  const [fromDate,toDate] =
    v4SetRangeControls(
      "disparityExplorerPeriod",
      "disparityExplorerFromDate",
      "disparityExplorerToDate"
    );

  const multiDay = v4DaysInclusive(fromDate,toDate) > 1;

  rows = v6AggregatePriceRows(
    rows,
    multiDay
  );

  rows = v6ExplorerSearchRows(rows);
  rows = v6SortExplorerRows(rows);

  currentDisparityExplorerRows = rows;

  const table = document.getElementById("disparityExplorerTable");
  if(!table){
    return;
  }

  const productLabel =
    currentDisparityExplorerMarketplace === "amazon" ? "ASINs" : "FSNs";

  const skuLabel =
    currentDisparityExplorerMarketplace === "amazon" ? "AZ SKUs" : "FK SKUs";

  const uniqueProducts =
    new Set(rows.map(row => row.identifier).filter(Boolean)).size;

  const uniqueSkus =
    new Set(rows.map(row => row.marketSku).filter(Boolean)).size;

  const listingCount =
    new Set(
      rows.filter(row => row.issueTypes.includes("Listing"))
          .map(row => `${row.marketSku}||${row.identifier}`)
    ).size;

  const liveCount =
    new Set(
      rows.filter(row => row.issueTypes.includes("Live"))
          .map(row => `${row.marketSku}||${row.identifier}`)
    ).size;

  const mrpCount =
    new Set(
      rows.filter(row => row.issueTypes.includes("MRP"))
          .map(row => `${row.marketSku}||${row.identifier}`)
    ).size;

  const dailyProductImpact = new Map();

  v6DisparityExplorerRawRows.forEach(
    row => {
      if(row.countedImpact === null){
        return;
      }

      const key = `${row.reportDate}||${row.identifier}`;
      dailyProductImpact.set(
        key,
        Math.max(
          Number(dailyProductImpact.get(key) || 0),
          Number(row.countedImpact || 0)
        )
      );
    }
  );

  const totalPeriodExposure =
    Array.from(dailyProductImpact.values()).reduce((s,v)=>s+Number(v||0),0);

  const currentDayImpact =
    (() => {
      const latestDate = [...new Set(v6DisparityExplorerRawRows.map(row => row.reportDate))].sort().at(-1);
      if(!latestDate){
        return null;
      }

      const values = [...dailyProductImpact.entries()]
        .filter(([key]) => key.startsWith(latestDate + "||"))
        .map(([,value]) => Number(value || 0));

      return values.length ? values.reduce((s,v)=>s+v,0) : null;
    })();

  if(v6DisparityExplorerMode === "dashboard" && type === "all"){
    finalSetText("disparitySummaryLabel1","Products Affected");
    finalSetText("disparitySummaryLabel2","Listing Disparity");
    finalSetText("disparitySummaryLabel3","Live Disparity");
    finalSetText("disparitySummaryLabel4","MRP Disparity");
    finalSetText("disparityExplorerProducts",formatNumber(uniqueProducts));
    finalSetText("disparityExplorerListing",formatNumber(listingCount));
    finalSetText("disparityExplorerLive",formatNumber(liveCount));
    finalSetText("disparityExplorerMrp",formatNumber(mrpCount));
  }else{
    finalSetText("disparitySummaryLabel1",skuLabel);
    finalSetText("disparitySummaryLabel2",productLabel);

    if(type === "mrp"){
      finalSetText("disparitySummaryLabel3",multiDay ? "MRP Disparity Days" : "Categories");
      finalSetText("disparitySummaryLabel4","Highest MRP Diff");
      finalSetText(
        "disparityExplorerLive",
        multiDay
          ? formatNumber(rows.reduce((s,row)=>s+Number(row.affectedDays||1),0))
          : formatNumber(new Set(rows.map(row=>row.category).filter(Boolean)).size)
      );
      finalSetText(
        "disparityExplorerMrp",
        rows.length
          ? formatINR(Math.max(...rows.map(row=>Math.abs(Number(row.mrpDiff||0)))))
          : "₹0"
      );
    }else{
      finalSetText(
        "disparitySummaryLabel3",
        multiDay ? "Disparity Days" : "Rev Impact / Day"
      );
      finalSetText(
        "disparitySummaryLabel4",
        multiDay ? "Period Exposure" : "Categories"
      );
      finalSetText(
        "disparityExplorerLive",
        multiDay
          ? formatNumber(rows.reduce((s,row)=>s+Number(row.affectedDays||1),0))
          : (
              currentDayImpact === null
              ? "Revenue Data Unavailable"
              : formatINR(currentDayImpact)
            )
      );
      finalSetText(
        "disparityExplorerMrp",
        multiDay
          ? (
              dailyProductImpact.size
              ? formatINR(totalPeriodExposure)
              : "Revenue Data Unavailable"
            )
          : formatNumber(new Set(rows.map(row=>row.category).filter(Boolean)).size)
      );
    }

    finalSetText("disparityExplorerProducts",formatNumber(uniqueSkus));
    finalSetText("disparityExplorerListing",formatNumber(uniqueProducts));
  }

  const periodDays = v4DaysInclusive(fromDate,toDate);
  const moduleKey =
    currentDisparityExplorerMarketplace === "amazon"
    ? (
        type === "live" ? "amazonLive" : (type === "mrp" ? "amazonMrp" : "amazonListing")
      )
    : (
        type === "live" ? "flipkartLive" : (type === "mrp" ? "flipkartMrp" : "flipkartListing")
      );

  const coverage =
    v4ModuleCoverage(
      v6DisparityExplorerSnapshots,
      moduleKey,
      periodDays
    );

  finalSetText(
    "disparityExplorerAvailability",
    coverage.state === "available"
      ? "Available"
      : (coverage.state === "partial" ? "Partial Data" : "No Data Available")
  );

  finalSetText(
    "disparityExplorerCoverage",
    `${coverage.availableDays} / ${periodDays} days`
  );

  finalSetText(
    "disparityExplorerRowInfo",
    `${formatNumber(rows.length)} ${rows.length === 1 ? "row" : "rows"}`
  );

  currentDisparityExplorerExportRows =
    rows.map(
      row => {
        const base = {
          Category:row.category,
          "WF SKU":row.wfSku,
          [currentDisparityExplorerMarketplace === "amazon" ? "AZ SKU" : "FK SKU"]:row.marketSku,
          [currentDisparityExplorerMarketplace === "amazon" ? "ASIN" : "FSN"]:row.identifier
        };

        if(multiDay){
          base["Disparity Days"] = row.affectedDays || 1;
        }else{
          base.Date = row.reportDate;
        }

        base["Disparity Type"] = row.issueTypes.join(" | ");

        if(type === "mrp"){
          base["WF MRP"] = row.wfMrp;
          base[currentDisparityExplorerMarketplace === "amazon" ? "Amazon MRP" : "Flipkart MRP"] =
            currentDisparityExplorerMarketplace === "amazon" ? row.azMrp : row.fkMrp;
          base["MRP Diff"] = row.mrpDiff;
        }else{
          base["WF Price"] = row.wfPrice;

          if(type === "listing"){
            base["Listing Price"] = row.listingPrice;
            base["Price Diff"] = row.listingPriceDiff;
          }else if(type === "live"){
            base["Live Price"] = row.finalLivePrice;
            base["Price Diff"] = row.livePriceDiff;
          }else{
            base["Listing Price"] = row.listingPrice;
            base["Live Price"] = row.finalLivePrice;
          }

          base[multiDay ? "Latest Rev Impact / Day" : "Rev Impact / Day"] =
            row.revenueAvailable
              ? Number((row.latestImpact ?? row.rawImpact) || 0)
              : "Revenue Data Unavailable";

          if(multiDay){
            base["Period Exposure"] =
              row.revenueAvailable
                ? Number(row.periodExposure || 0)
                : "Revenue Data Unavailable";
          }
        }

        return base;
      }
    );

  if(!rows.length){
    table.innerHTML = `<tbody><tr><td class="empty-row">No disparity records found</td></tr></tbody>`;
    return;
  }

  const sku = currentDisparityExplorerMarketplace === "amazon" ? "AZ SKU" : "FK SKU";
  const identifier = currentDisparityExplorerMarketplace === "amazon" ? "ASIN" : "FSN";

  let columns = [
    ["Category",row=>row.category],
    ["WF SKU",row=>row.wfSku],
    [sku,row=>row.marketSku],
    [identifier,row=>row.identifier]
  ];

  if(multiDay){
    columns.push(["Disparity Days",row=>formatNumber(row.affectedDays || 1)]);
  }else{
    columns.unshift(["Date",row=>row.reportDate]);
  }

  columns.push([
    "Disparity Type",
    row=>row.issueTypes.map(issue=>`<span class="disparity-type-chip">${escapeHtml(issue)}</span>`).join("")
  ]);

  if(type === "mrp"){
    columns.push(
      ["WF MRP",row=>formatINR(row.wfMrp)],
      [currentDisparityExplorerMarketplace === "amazon" ? "Amazon MRP" : "Flipkart MRP",
        row=>formatINR(currentDisparityExplorerMarketplace === "amazon" ? row.azMrp : row.fkMrp)],
      ["MRP Diff",row=>formatINR(row.mrpDiff)]
    );
  }else{
    columns.push(["WF Price",row=>formatINR(row.wfPrice)]);

    if(type === "listing"){
      columns.push(
        ["Listing Price",row=>formatINR(row.listingPrice)],
        ["Price Diff",row=>formatINR(row.listingPriceDiff)]
      );
    }else if(type === "live"){
      columns.push(
        ["Live Price",row=>formatINR(row.finalLivePrice)],
        ["Price Diff",row=>formatINR(row.livePriceDiff)]
      );
    }else{
      columns.push(
        ["Listing Price",row=>Number(row.listingPrice)>0?formatINR(row.listingPrice):"—"],
        ["Live Price",row=>Number(row.finalLivePrice)>0?formatINR(row.finalLivePrice):"—"]
      );
    }

    columns.push([
      multiDay ? "Latest Rev Impact / Day" : "Rev Impact / Day",
      row=>row.revenueAvailable
        ? formatINR(Number((row.latestImpact ?? row.rawImpact) || 0))
        : "Revenue Data Unavailable"
    ]);

    if(multiDay){
      columns.push([
        "Period Exposure",
        row=>row.revenueAvailable
          ? formatINR(Number(row.periodExposure || 0))
          : "Revenue Data Unavailable"
      ]);
    }
  }

  const visible = rows.slice(0,1800);

  let html = "<thead><tr>" +
    columns.map(([label])=>`<th>${escapeHtml(label)}</th>`).join("") +
    "</tr></thead><tbody>";

  visible.forEach(
    row => {
      html += "<tr>" + columns.map(
        ([label,getValue]) => {
          const value = getValue(row);
          const trusted = label === "Disparity Type";
          return `<td>${trusted ? value : escapeHtml(value)}</td>`;
        }
      ).join("") + "</tr>";
    }
  );

  html += "</tbody>";
  table.innerHTML = html;
}


openDashboardPriceView = async function(
  marketplace
){
  currentDisparityExplorerMarketplace = marketplace;
  v6DisparityExplorerMode = "dashboard";
  v6DisparityExplorerStrictType = "all";

  finalSetText(
    "disparityExplorerTitle",
    marketplace === "amazon" ? "Amazon Price Disparity" : "Flipkart Price Disparity"
  );
  finalSetText("disparityExplorerModeBadge","All Price Disparities");

  const typeSelect = document.getElementById("disparityExplorerType");
  if(typeSelect){
    typeSelect.hidden = false;
    typeSelect.disabled = false;
    typeSelect.value = "all";
  }

  const emailButton = document.getElementById("disparityExplorerEmailButton");
  if(emailButton){
    emailButton.hidden = true;
  }

  const period = document.getElementById("disparityExplorerPeriod");
  const dashboardPeriod = document.getElementById("dashboardPeriod")?.value || "today";

  if(period){
    period.value = dashboardPeriod;
  }

  const from = document.getElementById("disparityExplorerFromDate");
  const to = document.getElementById("disparityExplorerToDate");
  if(from){
    from.value = document.getElementById("dashboardFromDate")?.value || todayIso();
  }
  if(to){
    to.value = document.getElementById("dashboardToDate")?.value || todayIso();
  }

  const search = document.getElementById("disparityExplorerSearch");
  if(search){
    search.value = "";
  }

  showView("priceDisparityExplorerSection");
  await loadDisparityExplorer();
};


async function openSideMenuPriceView(
  viewKey
){
  const def = HISTORICAL_VIEWS[viewKey];

  if(!def || def.type !== "price"){
    return;
  }

  currentHistoricalViewKey = viewKey;
  currentDisparityExplorerMarketplace = def.marketplace;
  v6DisparityExplorerMode = "strict";
  v6DisparityExplorerStrictType = def.kind;

  finalSetText("disparityExplorerTitle",def.title);
  finalSetText("disparityExplorerModeBadge",v6DisparityTypeLabel(def.kind));

  const typeSelect = document.getElementById("disparityExplorerType");
  if(typeSelect){
    typeSelect.value = def.kind;
    typeSelect.hidden = true;
    typeSelect.disabled = true;
  }

  const emailButton = document.getElementById("disparityExplorerEmailButton");
  if(emailButton){
    emailButton.hidden = false;
  }

  const period = document.getElementById("disparityExplorerPeriod");
  if(period){
    period.value = "today";
  }

  const search = document.getElementById("disparityExplorerSearch");
  if(search){
    search.value = "";
  }

  const category = document.getElementById("disparityExplorerCategory");
  if(category){
    category.value = "all";
  }

  showView("priceDisparityExplorerSection");
  await loadDisparityExplorer();
}


downloadDisparityExplorer = function(){
  if(!currentDisparityExplorerExportRows.length){
    showWakeSuiteToast(
      "No disparity rows are available to download.",
      "warning"
    );
    return;
  }

  const [fromDate,toDate] =
    v4SetRangeControls(
      "disparityExplorerPeriod",
      "disparityExplorerFromDate",
      "disparityExplorerToDate"
    );

  const type = v6ExplorerType();
  const marketplace =
    currentDisparityExplorerMarketplace === "amazon" ? "Amazon" : "Flipkart";

  writeExcelReport(
    `${marketplace}_${v6DisparityTypeLabel(type).replace(/[^A-Za-z0-9]+/g,"_")}_${fromDate}_to_${toDate}.xlsx`,
    {
      Marketplace:marketplace,
      "Report Type":v6DisparityTypeLabel(type),
      Period:V6_PERIOD_LABELS[document.getElementById("disparityExplorerPeriod")?.value] || "",
      From:fromDate,
      To:toDate,
      Category:document.getElementById("disparityExplorerCategory")?.value || "all",
      Rows:currentDisparityExplorerExportRows.length
    },
    currentDisparityExplorerExportRows
  );
};


async function openDisparityExplorerEmail(){
  if(v6DisparityExplorerMode !== "strict"){
    return;
  }

  const def = HISTORICAL_VIEWS[currentHistoricalViewKey];

  if(!def){
    return;
  }

  const [fromDate,toDate] =
    v4SetRangeControls(
      "disparityExplorerPeriod",
      "disparityExplorerFromDate",
      "disparityExplorerToDate"
    );

  currentHistoricalReport = {
    def,
    period:document.getElementById("disparityExplorerPeriod")?.value || "today",
    anchor:fromDate,
    fromDate,
    toDate,
    rows:v6DisparityExplorerRawRows,
    baseRows:v6DisparityExplorerRawRows,
    summary:[
      {label:"Disparity Records",value:v6DisparityExplorerRawRows.length,type:"number"}
    ]
  };

  await openShareEmailModal();
};


/* ======================================================
   SIDE MENU · SUPPRESSION / BUY BOX
====================================================== */

function v6IssueIdentifier(
  def,
  row
){
  return def.marketplace === "amazon" ? row.asin : row.fsn;
}


function v6IssueDailyImpact(
  def,
  row
){
  if(def.type === "flipkart_buybox"){
    return Number(row.buyBoxRevenueImpactPerDay || 0);
  }

  return Number(row.revenueImpactPerDay || 0);
}


function v6AggregateIssueRows(
  def,
  rows,
  multiDay
){
  const byProductDay = new Map();

  rows.forEach(
    row => {
      const identifier = v6IssueIdentifier(def,row);
      if(!identifier){
        return;
      }

      const key = `${row.reportDate}||${identifier}`;
      const existing = byProductDay.get(key);

      if(
        !existing
        || v6IssueDailyImpact(def,row) > v6IssueDailyImpact(def,existing)
      ){
        byProductDay.set(key,row);
      }
    }
  );

  const dayRows = Array.from(byProductDay.values());

  if(!multiDay){
    return dayRows;
  }

  const groups = new Map();

  dayRows.forEach(
    row => {
      const identifier = v6IssueIdentifier(def,row);

      if(!groups.has(identifier)){
        groups.set(
          identifier,
          {
            ...row,
            affectedDates:new Set(),
            periodExposure:0,
            availableRevenueDates:0,
            latestRow:row
          }
        );
      }

      const group = groups.get(identifier);
      group.affectedDates.add(row.reportDate);

      if(row.revenueAvailable !== false){
        group.periodExposure += v6IssueDailyImpact(def,row);
        group.availableRevenueDates += 1;
      }

      if(String(row.reportDate) >= String(group.latestRow.reportDate)){
        group.latestRow = row;
      }
    }
  );

  return Array.from(groups.values()).map(
    group => ({
      ...group.latestRow,
      affectedDays:group.affectedDates.size,
      periodExposure:group.periodExposure,
      latestImpact:
        group.latestRow.revenueAvailable === false
        ? null
        : v6IssueDailyImpact(def,group.latestRow),
      availableRevenueDates:group.availableRevenueDates
    })
  );
}


function v6SortIssueDisplayRows(
  def,
  rows
){
  const sort = document.getElementById("reportSort")?.value || "impact_desc";

  return [...rows].sort(
    (a,b) => {
      if(sort === "impact_asc"){
        return Number(a.periodExposure ?? v6IssueDailyImpact(def,a)) -
          Number(b.periodExposure ?? v6IssueDailyImpact(def,b));
      }

      if(sort === "category_asc"){
        return String(a.category || "").localeCompare(String(b.category || ""));
      }

      if(sort === "identifier_asc"){
        return String(v6IssueIdentifier(def,a) || "")
          .localeCompare(String(v6IssueIdentifier(def,b) || ""));
      }

      return Number(b.periodExposure ?? v6IssueDailyImpact(def,b)) -
        Number(a.periodExposure ?? v6IssueDailyImpact(def,a));
    }
  );
}


function v6IssueSummary(
  def,
  rows,
  availableDays,
  multiDay
){
  const identifierLabel =
    def.marketplace === "amazon" ? "ASINs" : "FSNs";

  const identifiers =
    new Set(
      rows.map(row => v6IssueIdentifier(def,row)).filter(Boolean)
    );

  const periodExposure =
    rows.reduce(
      (sum,row) =>
        sum + (
          row.revenueAvailable === false
          ? 0
          : Number(
              multiDay
              ? row.periodExposure || 0
              : v6IssueDailyImpact(def,row)
            )
        ),
      0
    );

  const revenueAvailable =
    rows.some(row => row.revenueAvailable !== false);

  const averageDailyImpact =
    revenueAvailable
      ? (
          multiDay
          ? periodExposure / Math.max(1,availableDays)
          : periodExposure
        )
      : null;

  const categoryImpact = new Map();

  rows.forEach(
    row => {
      const category = row.category || "Unmapped";
      const impact =
        row.revenueAvailable === false
        ? 0
        : Number(
            multiDay
              ? row.periodExposure || 0
              : v6IssueDailyImpact(def,row)
          );

      categoryImpact.set(
        category,
        Number(categoryImpact.get(category) || 0) + impact
      );
    }
  );

  const topCategory =
    [...categoryImpact.entries()].sort((a,b)=>b[1]-a[1])[0];

  const highest =
    [...rows].sort(
      (a,b) =>
        Number(
          multiDay
            ? b.periodExposure || 0
            : v6IssueDailyImpact(def,b)
        ) -
        Number(
          multiDay
            ? a.periodExposure || 0
            : v6IssueDailyImpact(def,a)
        )
    )[0];

  return [
    {
      label:identifierLabel,
      value:identifiers.size,
      type:"number"
    },
    {
      label:"Rev Impact / Day",
      value:averageDailyImpact === null ? "Unavailable" : averageDailyImpact,
      type:averageDailyImpact === null ? "text" : "money"
    },
    multiDay
      ? {
          label:`Recurring ${identifierLabel}`,
          value:rows.filter(row => Number(row.affectedDays || 1) > 1).length,
          type:"number"
        }
      : {
          label:"Top Category by Impact",
          value:topCategory ? topCategory[0] : "—",
          type:"text"
        },
    {
      label:`Highest Impact ${def.marketplace === "amazon" ? "ASIN" : "FSN"}`,
      value:highest
        ? `${v6IssueIdentifier(def,highest)} · ${
            highest.revenueAvailable === false
              ? "Revenue unavailable"
              : formatINR(
                  Number(
                    multiDay
                      ? highest.periodExposure || 0
                      : v6IssueDailyImpact(def,highest)
                  )
                )
          }`
        : "—",
      type:"text"
    }
  ];
}


openHistoricalModule = async function(
  viewKey
){
  const def = HISTORICAL_VIEWS[viewKey];

  if(def?.type === "price"){
    await openSideMenuPriceView(viewKey);
    return;
  }

  currentHistoricalViewKey = viewKey;
  finalSetText("reportModuleTitle",def?.title || "Report");
  showView("reportModuleSection");

  const period = document.getElementById("reportPeriod");
  if(period){
    period.value = "today";
  }

  const category = document.getElementById("reportCategory");
  if(category){
    category.value = "all";
  }

  const search = document.getElementById("reportSearch");
  if(search){
    search.value = "";
  }

  configureReportSort(def,true);
  v4SetRangeControls(
    "reportPeriod",
    "reportFromDate",
    "reportToDate",
    "reportAnchorDate"
  );

  await loadHistoricalModule();
};


loadHistoricalModule = async function(){
  const def = HISTORICAL_VIEWS[currentHistoricalViewKey];

  if(
    !def
    || def.type === "price"
    || typeof window.listDailySnapshotMetas !== "function"
  ){
    return;
  }

  const period = document.getElementById("reportPeriod")?.value || "today";
  const [fromDate,toDate] =
    v4SetRangeControls(
      "reportPeriod",
      "reportFromDate",
      "reportToDate",
      "reportAnchorDate"
    );

  const metas =
    v4MetasInRange(
      await window.listDailySnapshotMetas(),
      fromDate,
      toDate
    );

  const allSnapshots = [];

  for(const meta of metas){
    const snapshot = await loadSnapshotCached(meta.reportDate);
    if(snapshot){
      allSnapshots.push(snapshot);
    }
  }

  const moduleKey = v4HistoricalModuleKey(def);
  const snapshots =
    allSnapshots.filter(
      snapshot => v4SnapshotModuleState(snapshot,moduleKey) !== "unavailable"
    );

  const totalDays = v4DaysInclusive(fromDate,toDate);
  const coverage = v4ModuleCoverage(allSnapshots,moduleKey,totalDays);

  finalSetText(
    "reportAvailability",
    coverage.state === "available"
      ? "Available"
      : (coverage.state === "partial" ? "Partial Data" : "No Data Available")
  );

  finalSetText(
    "reportCoverage",
    `${coverage.availableDays} / ${totalDays} days`
  );

  const compiled = compileHistoricalView(def,snapshots);
  const snapshotMap = new Map(snapshots.map(snapshot=>[snapshot.reportDate,snapshot]));

  compiled.rows.forEach(
    row => {
      row.revenueAvailable =
        v4RevenueAvailableForDef(
          snapshotMap.get(row.reportDate),
          def
        );
    }
  );

  const categorySelect = document.getElementById("reportCategory");
  const existingCategory = categorySelect?.value || "all";
  populateCategorySelectFromRows(categorySelect,compiled.rows,existingCategory);

  configureReportSort(def,false);

  currentHistoricalReport = {
    def,
    period,
    anchor:fromDate,
    fromDate,
    toDate,
    snapshots,
    allSnapshots,
    moduleKey,
    coverage,
    baseRows:compiled.rows,
    rawRows:compiled.rows,
    rows:[],
    summary:[]
  };

  applyHistoricalFilters();
};


applyHistoricalFilters = function(){
  if(!currentHistoricalReport){
    return;
  }

  const def = currentHistoricalReport.def;

  if(def.type === "price"){
    return;
  }

  const rawFiltered =
    applyReportFiltersToRows(
      def,
      currentHistoricalReport.baseRows
    );

  const multiDay =
    v4DaysInclusive(
      currentHistoricalReport.fromDate,
      currentHistoricalReport.toDate
    ) > 1;

  let rows =
    v6AggregateIssueRows(
      def,
      rawFiltered,
      multiDay
    );

  rows =
    v6SortIssueDisplayRows(
      def,
      rows
    );

  const summary =
    v6IssueSummary(
      def,
      rows,
      currentHistoricalReport.coverage?.availableDays || 0,
      multiDay
    );

  currentHistoricalReport.rows = rows;
  currentHistoricalReport.summary = summary;
  currentHistoricalReport.multiDay = multiDay;

  renderHistoricalSummary(summary);
  renderHistoricalTable(def,rows);
};


renderHistoricalTable = function(
  def,
  rows
){
  const table = document.getElementById("reportModuleTable");

  if(!table){
    return;
  }

  const multiDay = !!currentHistoricalReport?.multiDay;

  finalSetText(
    "reportRowInfo",
    `${formatNumber(rows.length)} ${rows.length === 1 ? "row" : "rows"}`
  );

  if(!rows.length){
    table.innerHTML = `<tbody><tr><td class="empty-row">No Data Available</td></tr></tbody>`;
    return;
  }

  let columns = [];

  if(def.type === "suppression"){
    columns = [
      ["Category",row=>row.category],
      ["ASIN",row=>row.asin]
    ];

    if(multiDay){
      columns.push(["Suppressed Days",row=>formatNumber(row.affectedDays || 1)]);
    }

    columns.push([
      multiDay ? "Latest Rev Impact / Day" : "Rev Impact / Day",
      row=>row.revenueAvailable === false
        ? "Revenue Data Unavailable"
        : formatINR(Number((row.latestImpact ?? row.revenueImpactPerDay) || 0))
    ]);

    if(multiDay){
      columns.push([
        "Period Exposure",
        row=>row.revenueAvailable === false
          ? "Revenue Data Unavailable"
          : formatINR(Number(row.periodExposure || 0))
      ]);
    }
  }
  else if(def.type === "amazon_buybox"){
    columns = [
      ["Category",row=>row.category],
      ["ASIN",row=>row.asin],
      ["WF SKU",row=>row.wfSku]
    ];

    if(multiDay){
      columns.push(["Buy Box Suppressed Days",row=>formatNumber(row.affectedDays || 1)]);
    }

    columns.push(
      ["Price",row=>formatINR(Number(row.listingPrice || 0))],
      [
        multiDay ? "Latest Rev Impact / Day" : "Rev Impact / Day",
        row=>row.revenueAvailable === false
          ? "Revenue Data Unavailable"
          : formatINR(Number((row.latestImpact ?? row.revenueImpactPerDay) || 0))
      ]
    );

    if(multiDay){
      columns.push([
        "Period Exposure",
        row=>row.revenueAvailable === false
          ? "Revenue Data Unavailable"
          : formatINR(Number(row.periodExposure || 0))
      ]);
    }
  }
  else{
    columns = [
      ["Category",row=>row.category],
      ["FSN",row=>row.fsn],
      ["FK SKU",row=>row.fkSku],
      ["WF SKU",row=>row.wfSku]
    ];

    if(multiDay){
      columns.push(["Buy Box Unavailable Days",row=>formatNumber(row.affectedDays || 1)]);
    }

    columns.push(
      ["Listing Price",row=>formatINR(Number(row.listingPrice || 0))],
      [
        multiDay ? "Latest Rev Impact / Day" : "Rev Impact / Day",
        row=>row.revenueAvailable === false
          ? "Revenue Data Unavailable"
          : formatINR(Number((row.latestImpact ?? row.buyBoxRevenueImpactPerDay) || 0))
      ]
    );

    if(multiDay){
      columns.push([
        "Period Exposure",
        row=>row.revenueAvailable === false
          ? "Revenue Data Unavailable"
          : formatINR(Number(row.periodExposure || 0))
      ]);
    }
  }

  let html = "<thead><tr>" +
    columns.map(([label])=>`<th>${escapeHtml(label)}</th>`).join("") +
    "</tr></thead><tbody>";

  rows.slice(0,1800).forEach(
    row => {
      html += "<tr>" +
        columns.map(([,getValue])=>`<td>${escapeHtml(getValue(row))}</td>`).join("") +
        "</tr>";
    }
  );

  html += "</tbody>";
  table.innerHTML = html;
};


function v6HistoricalExportRows(
  report
){
  const {
    def,
    rows,
    multiDay
  } = report;

  return rows.map(
    row => {
      if(def.type === "suppression"){
        return {
          Category:row.category,
          ASIN:row.asin,
          ...(multiDay ? {"Suppressed Days":row.affectedDays || 1} : {}),
          [multiDay ? "Latest Rev Impact / Day" : "Rev Impact / Day"]:
            row.revenueAvailable === false
              ? "Revenue Data Unavailable"
              : Number((row.latestImpact ?? row.revenueImpactPerDay) || 0),
          ...(multiDay ? {
            "Period Exposure":
              row.revenueAvailable === false
                ? "Revenue Data Unavailable"
                : Number(row.periodExposure || 0)
          } : {})
        };
      }

      if(def.type === "amazon_buybox"){
        return {
          Category:row.category,
          ASIN:row.asin,
          "WF SKU":row.wfSku,
          ...(multiDay ? {"Buy Box Suppressed Days":row.affectedDays || 1} : {}),
          Price:row.listingPrice,
          [multiDay ? "Latest Rev Impact / Day" : "Rev Impact / Day"]:
            row.revenueAvailable === false
              ? "Revenue Data Unavailable"
              : Number((row.latestImpact ?? row.revenueImpactPerDay) || 0),
          ...(multiDay ? {
            "Period Exposure":
              row.revenueAvailable === false
                ? "Revenue Data Unavailable"
                : Number(row.periodExposure || 0)
          } : {})
        };
      }

      return {
        Category:row.category,
        FSN:row.fsn,
        "FK SKU":row.fkSku,
        "WF SKU":row.wfSku,
        ...(multiDay ? {"Buy Box Unavailable Days":row.affectedDays || 1} : {}),
        "Listing Price":row.listingPrice,
        [multiDay ? "Latest Rev Impact / Day" : "Rev Impact / Day"]:
          row.revenueAvailable === false
            ? "Revenue Data Unavailable"
            : Number((row.latestImpact ?? row.buyBoxRevenueImpactPerDay) || 0),
        ...(multiDay ? {
          "Period Exposure":
            row.revenueAvailable === false
              ? "Revenue Data Unavailable"
              : Number(row.periodExposure || 0)
        } : {})
      };
    }
  );
}


downloadHistoricalModule = function(){
  if(!currentHistoricalReport){
    loadHistoricalModule().then(downloadHistoricalModule);
    return;
  }

  const report = currentHistoricalReport;
  const safePrefix = report.def.title.replace(/[^A-Za-z0-9]+/g,"_");

  writeExcelReport(
    reportFilename(
      safePrefix,
      report.period,
      report.fromDate,
      report.toDate
    ),
    {
      Report:report.def.title,
      Period:V6_PERIOD_LABELS[report.period] || report.period,
      From:report.fromDate,
      To:report.toDate,
      Category:document.getElementById("reportCategory")?.value || "all",
      Rows:report.rows.length
    },
    v6HistoricalExportRows(report)
  );
};


/* ======================================================
   MARKETPLACE INSIGHTS · INTERACTIVE
====================================================== */

function v6InsightMarketplaces(
  selection
){
  return selection === "combined"
    ? ["amazon","flipkart"]
    : [selection];
}


function v6InsightProductKey(
  marketplace,
  row
){
  return marketplace === "amazon" ? row.asin : row.fsn;
}


function v6InsightPriceRows(
  snapshot,
  marketplace,
  category,
  disparityType = "all",
  parityOnly = false
){
  const source =
    marketplace === "amazon"
      ? getSnapshotAmazonRows(snapshot)
      : getSnapshotFlipkartRows(snapshot);

  const liveAvailable =
    v4SnapshotModuleState(
      snapshot,
      marketplace === "amazon" ? "amazonLive" : "flipkartLive"
    ) !== "unavailable";

  const out = [];

  source.forEach(
    row => {
      if(!dashboardCategoryMatches(row,category)){
        return;
      }

      const marketSku = marketplace === "amazon" ? row.azSku : row.fkSku;
      const identifier = marketplace === "amazon" ? row.asin : row.fsn;

      const disparities = [];
      if(row.listingPriceDisparity) disparities.push("Listing");
      if(liveAvailable && row.livePriceDisparity) disparities.push("Live");
      if(row.mrpDisparity) disparities.push("MRP");

      if(parityOnly){
        if(row.hasPriceException || row.listingPriceException || row.livePriceException || row.mrpException || row.approvedException) return;
        const finalObservation =
          liveAvailable && row.eligibleForComparison && Number(row.finalLivePrice) > 0
            ? !row.livePriceDisparity
            : !row.listingPriceDisparity;

        if(!finalObservation){
          return;
        }

        out.push({
          ...row,
          reportDate:snapshot.reportDate,
          marketplace,
          marketSku,
          identifier,
          issueType:"Price Parity",
          issueTypes:["Price Parity"],
          impact:0,
          revenueAvailable:true
        });

        return;
      }

      const match =
        disparityType === "all"
          ? disparities.length > 0
          : (
              disparityType === "listing"
                ? disparities.includes("Listing")
                : (
                    disparityType === "live"
                      ? disparities.includes("Live")
                      : disparities.includes("MRP")
                  )
            );

      if(!match){
        return;
      }

      const priceImpact =
        disparityType === "mrp"
          ? null
          : (
              v4SnapshotRevenueAvailable(snapshot,marketplace)
                ? v6PriceRowImpact(row,disparityType)
                : null
            );

      out.push({
        ...row,
        reportDate:snapshot.reportDate,
        marketplace,
        marketSku,
        identifier,
        issueType:"Price Disparity",
        issueTypes:
          disparityType === "all"
            ? disparities
            : [v6DisparityTypeLabel(disparityType).replace(" Price Disparity","")],
        impact:priceImpact,
        revenueAvailable:
          disparityType === "mrp"
            ? true
            : v4SnapshotRevenueAvailable(snapshot,marketplace)
      });
    }
  );

  return out;
}


function v6InsightIssueRows(
  snapshot,
  focus,
  category
){
  if(focus === "amazon_suppression"){
    return getSnapshotAmazonIssueRows(snapshot,"amazonSuppressions")
      .filter(row=>dashboardCategoryMatches(row,category))
      .map(row=>({
        ...row,
        reportDate:snapshot.reportDate,
        marketplace:"amazon",
        marketSku:row.azSku || "",
        identifier:row.asin,
        issueType:"ASIN Suppression",
        issueTypes:["ASIN Suppression"],
        impact:
          v4SnapshotRevenueAvailable(snapshot,"amazon")
            ? Number(row.revenueImpactPerDay || 0)
            : null,
        revenueAvailable:v4SnapshotRevenueAvailable(snapshot,"amazon")
      }));
  }

  if(focus === "amazon_buybox"){
    return getSnapshotAmazonIssueRows(snapshot,"amazonBuyBox")
      .filter(row=>dashboardCategoryMatches(row,category))
      .map(row=>({
        ...row,
        reportDate:snapshot.reportDate,
        marketplace:"amazon",
        marketSku:row.azSku || "",
        identifier:row.asin,
        issueType:"Buy Box Suppression",
        issueTypes:["Buy Box Suppression"],
        impact:
          v4SnapshotRevenueAvailable(snapshot,"amazon")
            ? Number(row.revenueImpactPerDay || 0)
            : null,
        revenueAvailable:v4SnapshotRevenueAvailable(snapshot,"amazon")
      }));
  }

  return getSnapshotFlipkartRows(snapshot)
    .filter(
      row =>
        dashboardCategoryMatches(row,category)
        && row.buyBoxStatus === "No Buy Box"
    )
    .map(row=>({
      ...row,
      reportDate:snapshot.reportDate,
      marketplace:"flipkart",
      marketSku:row.fkSku,
      identifier:row.fsn,
      issueType:"Buy Box Unavailable",
      issueTypes:["Buy Box Unavailable"],
      impact:
        v4SnapshotRevenueAvailable(snapshot,"flipkart")
          ? Number(row.buyBoxRevenueImpactPerDay || 0)
          : null,
      revenueAvailable:v4SnapshotRevenueAvailable(snapshot,"flipkart")
    }));
}


function v6InsightDailyProductDedupe(
  rows
){
  const groups = new Map();

  rows.forEach(
    row => {
      const key = `${row.reportDate}||${row.marketplace}||${row.identifier}`;

      if(!groups.has(key)){
        groups.set(
          key,
          {
            ...row,
            issues:new Set(row.issueTypes || [row.issueType]),
            impact:row.impact,
            marketSkus:new Set(row.marketSku ? [row.marketSku] : [])
          }
        );
        return;
      }

      const group = groups.get(key);
      (row.issueTypes || [row.issueType]).forEach(issue=>group.issues.add(issue));
      if(row.marketSku) group.marketSkus.add(row.marketSku);

      if(row.impact !== null){
        group.impact =
          Math.max(
            Number(group.impact || 0),
            Number(row.impact || 0)
          );
      }
    }
  );

  return Array.from(groups.values()).map(
    row => ({
      ...row,
      issueTypes:Array.from(row.issues),
      marketSku:Array.from(row.marketSkus).join(" | ")
    })
  );
}


function v6InsightAllIssueRows(
  snapshots,
  marketplaceSelection,
  category
){
  const markets = v6InsightMarketplaces(marketplaceSelection);
  const all = [];

  snapshots.forEach(
    snapshot => {
      markets.forEach(
        marketplace => {
          all.push(
            ...v6InsightPriceRows(snapshot,marketplace,category,"all",false)
          );

          if(marketplace === "amazon"){
            all.push(
              ...v6InsightIssueRows(snapshot,"amazon_suppression",category),
              ...v6InsightIssueRows(snapshot,"amazon_buybox",category)
            );
          }else{
            all.push(
              ...v6InsightIssueRows(snapshot,"flipkart_buybox",category)
            );
          }
        }
      );
    }
  );

  return v6InsightDailyProductDedupe(all);
}


function v6InsightRowsForFocus(
  snapshots,
  marketplaceSelection,
  category,
  focus,
  disparityType
){
  const markets = v6InsightMarketplaces(marketplaceSelection);

  if(focus === "all"){
    return v6InsightAllIssueRows(snapshots,marketplaceSelection,category);
  }

  if(focus === "parity"){
    return snapshots.flatMap(
      snapshot =>
        markets.flatMap(
          marketplace =>
            v6InsightPriceRows(snapshot,marketplace,category,"all",true)
        )
    );
  }

  if(focus === "price_disparity"){
    return snapshots.flatMap(
      snapshot =>
        markets.flatMap(
          marketplace =>
            v6InsightPriceRows(snapshot,marketplace,category,disparityType,false)
        )
    );
  }

  if(focus === "amazon_suppression"){
    return snapshots.flatMap(snapshot=>v6InsightIssueRows(snapshot,"amazon_suppression",category));
  }

  if(focus === "amazon_buybox"){
    return snapshots.flatMap(snapshot=>v6InsightIssueRows(snapshot,"amazon_buybox",category));
  }

  if(focus === "flipkart_buybox"){
    return snapshots.flatMap(snapshot=>v6InsightIssueRows(snapshot,"flipkart_buybox",category));
  }

  if(focus === "exceptions"){
    return snapshots.flatMap(snapshot=>markets.flatMap(marketplace=>{
      const source=marketplace==="amazon"?getSnapshotAmazonRows(snapshot):getSnapshotFlipkartRows(snapshot);
      return source.filter(row=>dashboardCategoryMatches(row,category)&&(row.hasPriceException||row.listingPriceException||row.livePriceException||row.mrpException)).map(row=>({
        ...row,reportDate:snapshot.reportDate,marketplace,marketSku:marketplace==="amazon"?row.azSku:row.fkSku,identifier:marketplace==="amazon"?row.asin:row.fsn,
        issueType:"Approved Exception",issueTypes:["Approved Exception"],impact:0,revenueAvailable:true
      }));
    }));
  }

  return v6InsightAllIssueRows(snapshots,marketplaceSelection,category);
}


function v6InsightDailySeries(
  snapshots,
  marketplaceSelection,
  category
){
  const markets = v6InsightMarketplaces(marketplaceSelection);

  return snapshots.map(
    snapshot => {
      const priceIds = new Set();
      const parityIds = new Set();
      const suppressionIds = new Set();
      const amazonBuyBoxIds = new Set();
      const flipkartBuyBoxIds = new Set();

      markets.forEach(
        marketplace => {
          v6InsightPriceRows(snapshot,marketplace,category,"all",false).forEach(
            row=>priceIds.add(`${marketplace}||${row.identifier}`)
          );

          v6InsightPriceRows(snapshot,marketplace,category,"all",true).forEach(
            row=>parityIds.add(`${marketplace}||${row.identifier}`)
          );

          if(marketplace === "amazon"){
            v6InsightIssueRows(snapshot,"amazon_suppression",category).forEach(
              row=>suppressionIds.add(row.identifier)
            );

            v6InsightIssueRows(snapshot,"amazon_buybox",category).forEach(
              row=>amazonBuyBoxIds.add(row.identifier)
            );
          }else{
            v6InsightIssueRows(snapshot,"flipkart_buybox",category).forEach(
              row=>flipkartBuyBoxIds.add(row.identifier)
            );
          }
        }
      );

      let impact = 0;
      let revenueAvailable = false;

      markets.forEach(
        marketplace => {
          if(v4SnapshotRevenueAvailable(snapshot,marketplace)){
            revenueAvailable = true;

            impact +=
              marketplace === "amazon"
                ? Number(v4AmazonDedupImpactForSnapshot(snapshot,category) || 0)
                : Number(v4FlipkartDedupImpactForSnapshot(snapshot,category) || 0);
          }
        }
      );

      return {
        date:snapshot.reportDate,
        priceDisparity:priceIds.size,
        parity:parityIds.size,
        amazonSuppression:suppressionIds.size,
        amazonBuyBox:amazonBuyBoxIds.size,
        flipkartBuyBox:flipkartBuyBoxIds.size,
        impact,
        revenueAvailable
      };
    }
  );
}


function v6SetInsightVisibility(
  marketplace
){
  document.querySelectorAll(".amazon-insight").forEach(
    element => {
      element.style.display =
        marketplace === "flipkart" ? "none" : "";
    }
  );

  document.querySelectorAll(".flipkart-insight").forEach(
    element => {
      element.style.display =
        marketplace === "amazon" ? "none" : "";
    }
  );
}


function v6SetInsightChartFocus(){
  const shell = document.getElementById("insightsShell");

  shell?.classList.toggle(
    "has-focus",
    v6InsightFocus !== "all"
  );

  document.querySelectorAll(".insight-chart-card").forEach(
    card => {
      const focus = card.dataset.chartFocus;
      const keep =
        v6InsightFocus === "all"
        || focus === "contribution"
        || (
          v6InsightFocus === "parity"
          && focus === "parity"
        )
        || (
          v6InsightFocus === "price_disparity"
          && focus === "price_disparity"
        )
        || (
          v6InsightFocus === "amazon_suppression"
          && focus === "amazon_suppression"
        )
        || (
          v6InsightFocus === "amazon_buybox"
          && focus === "amazon_buybox"
        )
        || (
          v6InsightFocus === "flipkart_buybox"
          && focus === "flipkart_buybox"
        )
        || (
          v6InsightFocus === "total_impact"
          && focus === "total_impact"
        );

      card.classList.toggle("focus-muted",!keep);
      card.classList.toggle(
        "focus-emphasis",
        v6InsightFocus !== "all" && keep && focus !== "contribution"
      );
    }
  );
}


function setMarketplaceInsightFocus(
  focus
){
  if(v6InsightFocus === focus){
    v6InsightFocus = "all";
  }else{
    v6InsightFocus = focus;
  }

  document.querySelectorAll("[data-insight-card]").forEach(
    card => card.classList.toggle("active",card.dataset.insightCard === v6InsightFocus)
  );

  const label = {
    all:"All Insights",
    parity:"Price Parity",
    price_disparity:"Price Disparity",
    amazon_suppression:"ASIN Suppression",
    amazon_buybox:"Buy Box Suppression",
    flipkart_buybox:"Buy Box Unavailable",
    exceptions:"Approved Exceptions",
    total_impact:"Total Rev Impact"
  }[v6InsightFocus] || "All Insights";

  finalSetText("insightsActiveMode",label);

  const disparitySelect = document.getElementById("insightsDisparityType");
  if(disparitySelect){
    disparitySelect.hidden = v6InsightFocus !== "price_disparity";
  }

  v6SetInsightChartFocus();
  loadMarketplaceInsights();
}


function v6InsightCategoryContribution(
  rows
){
  const map = new Map();

  rows.forEach(
    row => {
      const category = row.category || "Unmapped";
      const value =
        v6InsightFocus === "parity"
          ? 1
          : (
              row.impact === null
                ? 1
                : Math.max(0,Number(row.impact || 0))
            );

      map.set(
        category,
        Number(map.get(category) || 0) + value
      );
    }
  );

  return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
}


function v6RenderInsightBars(
  rows
){
  const box = document.getElementById("insightsCategoryContribution");
  if(!box){
    return;
  }

  const categories = v6InsightCategoryContribution(rows);
  const max = Math.max(...categories.map(([,value])=>value),1);

  box.innerHTML =
    categories.length
      ? categories.map(
          ([name,value]) =>
            `<div class="category-bar-row" data-insight-category="${escapeHtml(name)}" onclick="v6SelectInsightCategory(this.dataset.insightCategory)">
              <div class="category-bar-label" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
              <div class="category-bar-track"><div class="category-bar-fill" style="width:${Math.max(2,(value/max)*100).toFixed(1)}%"></div></div>
              <div class="category-bar-value">${
                v6InsightFocus === "parity"
                  ? formatNumber(value)
                  : (value > 0 ? formatINR(value) : formatNumber(value))
              }</div>
            </div>`
        ).join("")
      : `<div class="empty-row">No Data Available</div>`;
}


function v6SelectInsightCategory(
  category
){
  const select = document.getElementById("insightsCategory");

  if(!select){
    return;
  }

  const option = [...select.options].find(option=>option.value === category);

  if(option){
    select.value = category;
    loadMarketplaceInsights();
  }
}


function v6InsightExportRow(
  row,
  marketplace
){
  const isAmazon = marketplace === "amazon";
  const priceDiff =
    row.livePriceDisparity
      ? row.livePriceDiff
      : row.listingPriceDiff;

  const marketplacePrice =
    row.livePriceDisparity && Number(row.finalLivePrice) > 0
      ? row.finalLivePrice
      : row.listingPrice;

  return {
    Date:row.reportDate,
    Category:row.category,
    "WF SKU":row.wfSku || "",
    [isAmazon ? "AZ SKU" : "FK SKU"]:row.marketSku || (isAmazon ? row.azSku : row.fkSku) || "",
    [isAmazon ? "ASIN" : "FSN"]:row.identifier || (isAmazon ? row.asin : row.fsn) || "",
    "Issue Type":(row.issueTypes || [row.issueType]).join(" | "),
    "WF Price":row.wfPrice || "",
    [isAmazon ? "Amazon Price" : "Flipkart Price"]:marketplacePrice || "",
    "Price Diff":Number.isFinite(Number(priceDiff)) ? Number(priceDiff) : "",
    "Rev Impact / Day":
      row.impact === null
        ? (
            (row.issueTypes || []).includes("MRP")
              ? "N/A"
              : "Revenue Data Unavailable"
          )
        : Number(row.impact || 0)
  };
}


async function loadMarketplaceInsights(
  forceMarketplace = null
){
  if(typeof window.listDailySnapshotMetas !== "function"){
    return;
  }

  if(forceMarketplace){
    const marketSelect = document.getElementById("insightsMarketplace");
    if(marketSelect){
      marketSelect.value = forceMarketplace;
    }

    v6InsightFocus = "total_impact";

    document.querySelectorAll("[data-insight-card]").forEach(
      card => card.classList.toggle("active",card.dataset.insightCard === "total_impact")
    );

    finalSetText("insightsActiveMode","Total Rev Impact");
  }

  const marketplace = document.getElementById("insightsMarketplace")?.value || "combined";
  const period = document.getElementById("insightsPeriod")?.value || "last7";
  const [fromDate,toDate] =
    v4SetRangeControls(
      "insightsPeriod",
      "insightsFromDate",
      "insightsToDate",
      "insightsDate"
    );

  const snapshots = await v4LoadSnapshotsForRange(fromDate,toDate);

  const categorySelect = document.getElementById("insightsCategory");
  const oldCategory = categorySelect?.value || "all";

  const marketSourceRows = snapshots.flatMap(
    snapshot => {
      const rows = [];

      if(marketplace !== "flipkart"){
        rows.push(...getSnapshotAmazonRows(snapshot));
      }

      if(marketplace !== "amazon"){
        rows.push(...getSnapshotFlipkartRows(snapshot));
      }

      return rows;
    }
  );

  populateCategorySelectFromRows(
    categorySelect,
    marketSourceRows,
    oldCategory
  );

  const category = categorySelect?.value || "all";
  const disparityType = document.getElementById("insightsDisparityType")?.value || "all";

  v6SetInsightVisibility(marketplace);
  v6SetInsightChartFocus();

  const daily = v6InsightDailySeries(
    snapshots,
    marketplace,
    category
  );

  const allIssueRows =
    v6InsightAllIssueRows(
      snapshots,
      marketplace,
      category
    );

  const focusRows =
    v6InsightRowsForFocus(
      snapshots,
      marketplace,
      category,
      v6InsightFocus,
      disparityType
    );

  const markets = v6InsightMarketplaces(marketplace);

  const metricsByMarket = {
    amazon:v6MetricsForMarketplace(snapshots,"amazon",category),
    flipkart:v6MetricsForMarketplace(snapshots,"flipkart",category)
  };

  const amazonMetrics = metricsByMarket.amazon;
  const flipkartMetrics = metricsByMarket.flipkart;

  const parityCount =
    marketplace === "amazon"
      ? amazonMetrics.parityCount
      : (
          marketplace === "flipkart"
            ? flipkartMetrics.parityCount
            : amazonMetrics.parityCount + flipkartMetrics.parityCount
        );

  const disparityCount =
    marketplace === "amazon"
      ? amazonMetrics.disparityCount
      : (
          marketplace === "flipkart"
            ? flipkartMetrics.disparityCount
            : amazonMetrics.disparityCount + flipkartMetrics.disparityCount
        );

  const suppressionCount =
    marketplace === "flipkart" ? 0 : amazonMetrics.suppressionCount;

  const amazonBuyBoxCount =
    marketplace === "flipkart" ? 0 : amazonMetrics.buyBoxCount;

  const flipkartBuyBoxCount =
    marketplace === "amazon" ? 0 : flipkartMetrics.buyBoxCount;

  const totalImpact =
    marketplace === "amazon"
      ? amazonMetrics.totalImpact
      : (
          marketplace === "flipkart"
            ? flipkartMetrics.totalImpact
            : amazonMetrics.totalImpact + flipkartMetrics.totalImpact
        );

  const revenueAvailable =
    marketplace === "amazon"
      ? amazonMetrics.revenueAvailable
      : (
          marketplace === "flipkart"
            ? flipkartMetrics.revenueAvailable
            : amazonMetrics.revenueAvailable || flipkartMetrics.revenueAvailable
        );

  const parityObservations =
    marketplace === "amazon"
      ? amazonMetrics.parityObservations
      : (
          marketplace === "flipkart"
            ? flipkartMetrics.parityObservations
            : amazonMetrics.parityObservations + flipkartMetrics.parityObservations
        );

  const disparityObservations =
    marketplace === "amazon"
      ? amazonMetrics.disparityObservations
      : (
          marketplace === "flipkart"
            ? flipkartMetrics.disparityObservations
            : amazonMetrics.disparityObservations + flipkartMetrics.disparityObservations
        );

  const priceChecks = parityObservations + disparityObservations;

  finalSetText(
    "insightsParity",
    priceChecks ? formatPercent(parityObservations / priceChecks) : "—"
  );
  finalSetText(
    "insightsParitySub",
    `${formatNumber(parityObservations)} parity observations`
  );
  finalSetText(
    "insightsDisparity",
    formatNumber(disparityCount)
  );
  const selectedPriceImpact =
    marketplace === "amazon"
      ? amazonMetrics.priceImpact
      : (
          marketplace === "flipkart"
            ? flipkartMetrics.priceImpact
            : amazonMetrics.priceImpact + flipkartMetrics.priceImpact
        );

  const selectedPriceImpactAvailable =
    marketplace === "amazon"
      ? amazonMetrics.priceImpactAvailable
      : (
          marketplace === "flipkart"
            ? flipkartMetrics.priceImpactAvailable
            : amazonMetrics.priceImpactAvailable || flipkartMetrics.priceImpactAvailable
        );

  finalSetText(
    "insightsDisparitySub",
    selectedPriceImpactAvailable
      ? `${formatINR(selectedPriceImpact)} revenue exposure`
      : `${formatNumber(disparityObservations)} disparity observations`
  );
  finalSetText(
    "insightsSuppression",
    marketplace === "flipkart" ? "—" : formatNumber(suppressionCount)
  );
  finalSetText(
    "insightsSuppressionSub",
    marketplace === "flipkart"
      ? "Not applicable"
      : (
          amazonMetrics.suppressionImpactAvailable
            ? `${formatINR(amazonMetrics.suppressionImpact)} revenue exposure`
            : `${formatNumber(amazonMetrics.suppressionObservations)} suppression observations`
        )
  );
  finalSetText(
    "insightsAmazonBuyBox",
    marketplace === "flipkart" ? "—" : formatNumber(amazonBuyBoxCount)
  );
  finalSetText(
    "insightsAmazonBuyBoxSub",
    marketplace === "flipkart"
      ? "Not applicable"
      : (
          amazonMetrics.buyBoxImpactAvailable
            ? `${formatINR(amazonMetrics.buyBoxImpact)} revenue exposure`
            : `${formatNumber(amazonMetrics.buyBoxObservations)} Buy Box observations`
        )
  );
  finalSetText(
    "insightsFlipkartBuyBox",
    marketplace === "amazon" ? "—" : formatNumber(flipkartBuyBoxCount)
  );
  finalSetText(
    "insightsFlipkartBuyBoxSub",
    marketplace === "amazon"
      ? "Not applicable"
      : (
          flipkartMetrics.buyBoxImpactAvailable
            ? `${formatINR(flipkartMetrics.buyBoxImpact)} revenue exposure`
            : `${formatNumber(flipkartMetrics.buyBoxObservations)} Buy Box observations`
        )
  );
  finalSetText(
    "insightsImpact",
    revenueAvailable ? formatINR(totalImpact) : "Revenue Data Unavailable"
  );
  finalSetText(
    "insightsImpactSub",
    revenueAvailable ? "Deduplicated exposure" : "Revenue source required"
  );

  const chartMap = [
    ["insightsParityTrend","parity"],
    ["insightsPriceDisparityTrend","priceDisparity"],
    ["insightsSuppressionTrend","amazonSuppression"],
    ["insightsAmazonBuyBoxTrend","amazonBuyBox"],
    ["insightsFlipkartBuyBoxTrend","flipkartBuyBox"],
    ["insightsRevenueTrend","impact"]
  ];

  chartMap.forEach(
    ([id,key]) => {
      const element = document.getElementById(id);
      if(element){
        element.innerHTML =
          daily.length
            ? v5SvgLineChart(daily,key,"date")
            : `<div class="empty-row">No Data Available</div>`;
      }
    }
  );

  const focusRowsForAnalytics =
    v6InsightDailyProductDedupe(
      focusRows
    );

  v6RenderInsightBars(focusRowsForAnalytics);

  const topProducts = (() => {
    const groups = new Map();

    focusRows.forEach(
      row => {
        const key = `${row.marketplace}||${row.identifier}`;

        if(!groups.has(key)){
          groups.set(
            key,
            {
              marketplace:row.marketplace,
              identifier:row.identifier,
              category:row.category,
              wfSku:row.wfSku,
              marketSkus:new Set(),
              issues:new Set(),
              affectedDates:new Set(),
              exposureByDate:new Map(),
              exposure:0
            }
          );
        }

        const group = groups.get(key);

        if(row.marketSku){
          group.marketSkus.add(row.marketSku);
        }

        (row.issueTypes || [row.issueType]).forEach(issue=>group.issues.add(issue));
        group.affectedDates.add(row.reportDate);

        if(row.impact !== null){
          const prior =
            Number(
              group.exposureByDate.get(row.reportDate)
              || 0
            );

          group.exposureByDate.set(
            row.reportDate,
            Math.max(
              prior,
              Number(row.impact || 0)
            )
          );
        }
      }
    );

    const out = [...groups.values()];

    out.forEach(
      group => {
        group.exposure =
          Array.from(group.exposureByDate.values())
            .reduce((sum,value)=>sum+Number(value||0),0);
      }
    );

    return out.sort((a,b)=>b.exposure-a.exposure);
  })();

  const topTable = document.getElementById("insightsTopProductsTable");

  if(topTable){
    let html = `<thead><tr>
      <th>Marketplace</th>
      <th>Category</th>
      <th>WF SKU</th>
      <th>ASIN / FSN</th>
      <th>Issue Type</th>
      <th>Affected Days</th>
      <th>Exposure</th>
    </tr></thead><tbody>`;

    if(!topProducts.length){
      html += `<tr><td colspan="7" class="empty-row">No Data Available</td></tr>`;
    }

    topProducts.slice(0,20).forEach(
      row => {
        html += `<tr>
          <td>${escapeHtml(row.marketplace === "amazon" ? "Amazon" : "Flipkart")}</td>
          <td>${escapeHtml(row.category || "")}</td>
          <td>${escapeHtml(row.wfSku || "")}</td>
          <td>${escapeHtml(row.identifier || "")}</td>
          <td>${escapeHtml(Array.from(row.issues).join(" | "))}</td>
          <td>${formatNumber(row.affectedDates.size)}</td>
          <td>${row.exposure ? formatINR(row.exposure) : "—"}</td>
        </tr>`;
      }
    );

    html += "</tbody>";
    topTable.innerHTML = html;
  }

  const detailTable = document.getElementById("insightsTable");

  if(detailTable){
    const visible = focusRows.slice(0,1600);

    let html = `<thead><tr>
      <th>Date</th>
      <th>Marketplace</th>
      <th>Category</th>
      <th>WF SKU</th>
      <th>Marketplace SKU</th>
      <th>ASIN / FSN</th>
      <th>Insight</th>
      <th>Rev Impact / Day</th>
    </tr></thead><tbody>`;

    if(!visible.length){
      html += `<tr><td colspan="8" class="empty-row">No Data Available</td></tr>`;
    }

    visible.forEach(
      row => {
        html += `<tr>
          <td>${escapeHtml(row.reportDate || "")}</td>
          <td>${escapeHtml(row.marketplace === "amazon" ? "Amazon" : "Flipkart")}</td>
          <td>${escapeHtml(row.category || "")}</td>
          <td>${escapeHtml(row.wfSku || "")}</td>
          <td>${escapeHtml(row.marketSku || "")}</td>
          <td>${escapeHtml(row.identifier || "")}</td>
          <td>${escapeHtml((row.issueTypes || [row.issueType]).join(" | "))}</td>
          <td>${row.impact === null ? "—" : formatINR(Number(row.impact || 0))}</td>
        </tr>`;
      }
    );

    html += "</tbody>";
    detailTable.innerHTML = html;
  }

  finalSetText(
    "insightsImpactTrendMeta",
    `${v6ReadableDate(fromDate)} → ${v6ReadableDate(toDate)}`
  );

  finalSetText(
    "insightsContributionMeta",
    v6InsightFocus === "all"
      ? "All Insights"
      : (
          document.getElementById("insightsActiveMode")?.textContent
          || "Selected Insight"
        )
  );

  finalSetText(
    "insightsTopProductsMeta",
    `${topProducts.length} impacted products`
  );

  finalSetText(
    "insightsDailyDetailMeta",
    `${focusRows.length} records`
  );

  v6InsightsState = {
    marketplace,
    period,
    fromDate,
    toDate,
    category,
    disparityType,
    focus:v6InsightFocus,
    snapshots,
    focusRows,
    allIssueRows,
    topProducts,
    metrics:{
      parityCount,
      disparityCount,
      suppressionCount,
      amazonBuyBoxCount,
      flipkartBuyBoxCount,
      totalImpact,
      revenueAvailable,
      priceChecks,
      parityObservations,
      disparityObservations
    },
    metricsByMarket
  };
};


function v6InsightSheetRows(
  marketplace,
  state
){
  const rows =
    state.focus === "all"
      ? state.allIssueRows.filter(row=>row.marketplace === marketplace)
      : state.focusRows.filter(row=>row.marketplace === marketplace);

  return rows.map(row=>v6InsightExportRow(row,marketplace));
}


function v6SummarySheetRows(
  state
){
  const singleDay =
    v4DaysInclusive(
      state.fromDate,
      state.toDate
    ) === 1;

  const impactLabel =
    singleDay
      ? "Rev Impact / Day"
      : "Revenue Exposure";

  const rows = [
    ["Selected View","Value"],
    ["Marketplace",state.marketplace === "combined" ? "Combined" : (state.marketplace === "amazon" ? "Amazon" : "Flipkart")],
    ["Category",state.category === "all" ? "All Categories" : state.category],
    ["Period",V6_PERIOD_LABELS[state.period] || state.period],
    ["From Date",state.fromDate],
    ["To Date",state.toDate],
    ["Active Insight",{
      all:"All Insights",
      parity:"Price Parity",
      price_disparity:"Price Disparity",
      amazon_suppression:"ASIN Suppression",
      amazon_buybox:"Buy Box Suppression",
      flipkart_buybox:"Buy Box Unavailable",
      total_impact:"Total Rev Impact"
    }[state.focus] || state.focus]
  ];

  if(state.focus === "price_disparity"){
    rows.push(["Price Disparity Type",v6DisparityTypeLabel(state.disparityType)]);
  }

  rows.push([]);

  const amazon = state.metricsByMarket.amazon;
  const flipkart = state.metricsByMarket.flipkart;

  if(state.marketplace === "combined"){
    rows.push(["Metric","Amazon Count",`Amazon ${impactLabel}`,"Flipkart Count",`Flipkart ${impactLabel}`]);
    rows.push(["Price Parity",amazon.parityCount,"—",flipkart.parityCount,"—"]);
    rows.push(["Price Disparity",amazon.disparityCount,amazon.priceImpactAvailable ? amazon.priceImpact : "Revenue Data Unavailable",flipkart.disparityCount,flipkart.priceImpactAvailable ? flipkart.priceImpact : "Revenue Data Unavailable"]);
    rows.push(["ASIN Suppression",amazon.suppressionCount,amazon.suppressionImpactAvailable ? amazon.suppressionImpact : "Revenue Data Unavailable","NA","NA"]);
    rows.push(["Buy Box Suppression / Unavailable",amazon.buyBoxCount,amazon.buyBoxImpactAvailable ? amazon.buyBoxImpact : "Revenue Data Unavailable",flipkart.buyBoxCount,flipkart.buyBoxImpactAvailable ? flipkart.buyBoxImpact : "Revenue Data Unavailable"]);
    rows.push(["Total Rev Impact","—",amazon.revenueAvailable ? amazon.totalImpact : "Revenue Data Unavailable","—",flipkart.revenueAvailable ? flipkart.totalImpact : "Revenue Data Unavailable"]);
    rows.push([]);
    rows.push(["Combined Total Rev Impact",state.metrics.revenueAvailable ? state.metrics.totalImpact : "Revenue Data Unavailable"]);
  }
  else if(state.marketplace === "amazon"){
    rows.push(["Metric","Count",impactLabel]);
    rows.push(["Price Parity",amazon.parityCount,"—"]);
    rows.push(["Price Disparity",amazon.disparityCount,amazon.priceImpactAvailable ? amazon.priceImpact : "Revenue Data Unavailable"]);
    rows.push(["ASIN Suppression",amazon.suppressionCount,amazon.suppressionImpactAvailable ? amazon.suppressionImpact : "Revenue Data Unavailable"]);
    rows.push(["Buy Box Suppression",amazon.buyBoxCount,amazon.buyBoxImpactAvailable ? amazon.buyBoxImpact : "Revenue Data Unavailable"]);
    rows.push(["Total Rev Impact","—",amazon.revenueAvailable ? amazon.totalImpact : "Revenue Data Unavailable"]);
  }
  else{
    rows.push(["Metric","Count",impactLabel]);
    rows.push(["Price Parity",flipkart.parityCount,"—"]);
    rows.push(["Price Disparity",flipkart.disparityCount,flipkart.priceImpactAvailable ? flipkart.priceImpact : "Revenue Data Unavailable"]);
    rows.push(["Buy Box Unavailable",flipkart.buyBoxCount,flipkart.buyBoxImpactAvailable ? flipkart.buyBoxImpact : "Revenue Data Unavailable"]);
    rows.push(["Total Rev Impact","—",flipkart.revenueAvailable ? flipkart.totalImpact : "Revenue Data Unavailable"]);
  }

  return rows;
}



downloadMarketplaceInsights = function(){
  if(!v6InsightsState){
    loadMarketplaceInsights().then(downloadMarketplaceInsights);
    return;
  }

  const state = v6InsightsState;
  const workbook = XLSX.utils.book_new();

  const summarySheet =
    XLSX.utils.aoa_to_sheet(
      v6SummarySheetRows(state)
    );

  summarySheet["!cols"] = [
    {wch:26},
    {wch:34}
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    summarySheet,
    "Summary"
  );

  const appendMarketSheet = marketplace => {
    const rows = v6InsightSheetRows(marketplace,state);

    const sheet =
      rows.length
        ? XLSX.utils.json_to_sheet(rows)
        : XLSX.utils.aoa_to_sheet([
            ["No data available for the selected marketplace / category / period / insight."]
          ]);

    const sheetName = marketplace === "amazon" ? "Amazon" : "Flipkart";

    XLSX.utils.book_append_sheet(
      workbook,
      sheet,
      sheetName
    );
  };

  if(state.marketplace === "combined"){
    appendMarketSheet("amazon");
    appendMarketSheet("flipkart");
  }else{
    appendMarketSheet(state.marketplace);
  }

  XLSX.writeFile(
    workbook,
    `Marketplace_Insights_${state.marketplace}_${state.fromDate}_to_${state.toDate}.xlsx`
  );
};


/* ======================================================
   MARKETPLACE DATA · SKU TYPES / MAPPING ISSUES
====================================================== */

function v6SkuClass(
  marketplace,
  sku,
  category
){
  const value = String(sku || "");
  const isMattress = String(category || "").toLowerCase() === "mattress";
  const custom = /_cus/i.test(value);

  if(custom && isMattress){
    return "Custom SKU";
  }

  if(marketplace === "amazon"){
    if(!value.includes("_")){
      return "Main SKU";
    }

    return "Duplicate SKU";
  }

  return "Standard SKU";
}


function v6ConflictType(
  marketplace,
  existing,
  conflict
){
  const differences = [];

  if(marketplace === "amazon"){
    if(existing.asin !== conflict.asin) differences.push("ASIN Mismatch");
  }else{
    if(existing.fsn !== conflict.fsn) differences.push("FSN Mismatch");
  }

  if(existing.wfSku !== conflict.wfSku) differences.push("WF SKU Mismatch");
  if(existing.category !== conflict.category) differences.push("Category Mismatch");

  return differences.length > 1
    ? `Multiple Mapping Conflict · ${differences.join(" + ")}`
    : (differences[0] || "Mapping Conflict");
}


function v6AmazonMappingIssueRows(){
  if(!window.masterPricingAmazon){
    return [];
  }

  let result;

  try{
    result = prepareAmazonMasterPricing();
  }catch(error){
    return [];
  }

  return result.conflicts.map(
    item => ({
      "Mapping Source":"Amazon",
      Category:item.existing.category,
      "WF SKU":item.existing.wfSku,
      "AZ SKU":item.azSku,
      ASIN:item.existing.asin,
      "Conflict Type":v6ConflictType("amazon",item.existing,item.conflict),
      "Conflicting ASIN":item.conflict.asin,
      "Conflicting WF SKU":item.conflict.wfSku,
      "Conflicting Category":item.conflict.category,
      Status:"Correction Required"
    })
  );
}


function v6FlipkartMappingIssueRows(){
  if(!window.masterPricingFlipkart){
    return [];
  }

  let result;

  try{
    result = prepareFlipkartMasterPricing();
  }catch(error){
    return [];
  }

  return result.conflicts.map(
    item => ({
      "Mapping Source":"Flipkart",
      Category:item.existing.category,
      "WF SKU":item.existing.wfSku,
      "FK SKU":item.fkSku,
      FSN:item.existing.fsn,
      "Conflict Type":v6ConflictType("flipkart",item.existing,item.conflict),
      "Conflicting FSN":item.conflict.fsn,
      "Conflicting WF SKU":item.conflict.wfSku,
      "Conflicting Category":item.conflict.category,
      Status:"Correction Required"
    })
  );
}


function v6UpdateMarketplaceSkuTypeOptions(){
  const select = document.getElementById("marketplaceDataSkuType");
  if(!select){
    return;
  }

  const view = document.getElementById("marketplaceDataView")?.value || "all";
  const category = document.getElementById("marketplaceDataCategory")?.value || "all";
  const isMattress = String(category).toLowerCase() === "mattress";
  const old = select.value || "all";

  let options = [
    ["all","All SKUs"]
  ];

  if(view === "amazon"){
    options.push(
      ["main","Main SKUs"],
      ["duplicate","Duplicate SKUs"]
    );

    if(isMattress){
      options.push(["custom","Custom SKUs"]);
    }

    options.push(["mapping_issues","Mapping Mismatch / Conflict"]);
  }
  else if(view === "flipkart"){
    if(isMattress){
      options.push(["custom","Custom SKUs"]);
    }

    options.push(["mapping_issues","Mapping Mismatch / Conflict"]);
  }
  else{
    options.push(["mapping_issues","Mapping Mismatch / Conflict"]);
  }

  select.innerHTML =
    options.map(
      ([value,label])=>`<option value="${value}">${label}</option>`
    ).join("");

  select.value =
    options.some(([value])=>value === old)
      ? old
      : "all";
}


const v6AmazonDataRowsBase = v4MarketplaceDataAmazonRows;
const v6FlipkartDataRowsBase = v4MarketplaceDataFlipkartRows;

v4MarketplaceDataAmazonRows = function(
  snapshot
){
  /*
    Detailed Amazon view remains one real marketplace mapping per row.
    Multiple AZ SKUs for one ASIN are intentionally NOT grouped.
  */
  return v6AmazonDataRowsBase(snapshot).map(
    row => ({
      ...row,
      "SKU Type":v6SkuClass("amazon",row["AZ SKU"],row.Category)
    })
  );
};


v4MarketplaceDataFlipkartRows = function(
  snapshot
){
  return v6FlipkartDataRowsBase(snapshot).map(
    row => ({
      ...row,
      "SKU Type":v6SkuClass("flipkart",row["FK SKU"],row.Category)
    })
  );
};


const v6DataTypeColumnsBase = v4DataTypeColumns;

v4DataTypeColumns = function(
  view,
  type,
  rows
){
  if(rows.some(row=>row.Status === "Correction Required")){
    return [
      "Mapping Source",
      "Category",
      "WF SKU",
      view === "flipkart" ? "FK SKU" : "AZ SKU",
      view === "flipkart" ? "FSN" : "ASIN",
      "Conflict Type",
      view === "flipkart" ? "Conflicting FSN" : "Conflicting ASIN",
      "Conflicting WF SKU",
      "Conflicting Category",
      "Status"
    ].filter(column=>rows.some(row=>column in row));
  }

  const columns = v6DataTypeColumnsBase(view,type,rows);

  if(view === "amazon" && type === "core" && !columns.includes("SKU Type")){
    columns.push("SKU Type");
  }

  if(view === "flipkart" && type === "core" && !columns.includes("SKU Type")){
    columns.push("SKU Type");
  }

  return columns;
};


function v6MarketplaceSkuFilterMatch(
  row,
  view,
  filter
){
  if(filter === "all"){
    return true;
  }

  if(filter === "mapping_issues"){
    return row.Status === "Correction Required";
  }

  const marketplace = view === "flipkart" ? "flipkart" : "amazon";
  const sku = marketplace === "amazon" ? row["AZ SKU"] : row["FK SKU"];
  const category = row.Category;

  if(filter === "custom"){
    return String(category || "").toLowerCase() === "mattress"
      && /_cus/i.test(String(sku || ""));
  }

  if(marketplace !== "amazon"){
    return true;
  }

  if(filter === "main"){
    return String(sku || "") !== "" && !String(sku).includes("_");
  }

  if(filter === "duplicate"){
    return String(sku || "").includes("_") && !/_cus/i.test(String(sku || ""));
  }

  return true;
}


v4ApplyMarketplaceDataFilters = function(){
  if(!currentMarketplaceData){
    return [];
  }

  const category = document.getElementById("marketplaceDataCategory")?.value || "all";
  const query = document.getElementById("marketplaceDataSearch")?.value?.trim() || "";
  const sort = document.getElementById("marketplaceDataSort")?.value || "revenue_desc";
  const skuFilter = document.getElementById("marketplaceDataSkuType")?.value || "all";

  const rows =
    currentMarketplaceData.baseRows.filter(
      row =>
        (category === "all" || String(row.Category || "") === category)
        && v4MarketplaceDataSearchMatch(row,query)
        && v6MarketplaceSkuFilterMatch(row,currentMarketplaceData.view,skuFilter)
    );

  rows.sort(
    (a,b) => {
      if(sort === "revenue_desc") return v4MarketplaceDataRevenue(b)-v4MarketplaceDataRevenue(a);
      if(sort === "revenue_asc") return v4MarketplaceDataRevenue(a)-v4MarketplaceDataRevenue(b);
      if(sort === "category_asc") return String(a.Category||"").localeCompare(String(b.Category||""));
      if(sort === "wfsku_asc") return String(a["WF SKU"]||"").localeCompare(String(b["WF SKU"]||""));
      if(sort === "price_desc") return v4MarketplaceDataPrice(b)-v4MarketplaceDataPrice(a);

      return String(a.ASIN || a.FSN || "").localeCompare(String(b.ASIN || b.FSN || ""));
    }
  );

  currentMarketplaceData.rows = rows;
  return rows;
};


loadMarketplaceData = async function(){
  const date = document.getElementById("marketplaceDataDate")?.value || todayIso();
  const view = document.getElementById("marketplaceDataView")?.value || "all";
  const type = document.getElementById("marketplaceDataType")?.value || "core";
  const skuFilter = document.getElementById("marketplaceDataSkuType")?.value || "all";

  const snapshot = await loadSnapshotCached(date);

  let rows = [];

  if(skuFilter === "mapping_issues"){
    if(view === "amazon"){
      rows = v6AmazonMappingIssueRows();
    }else if(view === "flipkart"){
      rows = v6FlipkartMappingIssueRows();
    }else{
      rows = [
        ...v6AmazonMappingIssueRows(),
        ...v6FlipkartMappingIssueRows()
      ];
    }
  }
  else if(snapshot){
    if(view === "amazon"){
      rows = v4MarketplaceDataAmazonRows(snapshot);
    }else if(view === "flipkart"){
      rows = v4MarketplaceDataFlipkartRows(snapshot);
    }else if(view === "mapping"){
      rows = v4MarketplaceMappingRows(snapshot);
    }else{
      rows = v4MarketplaceDataAllRows(snapshot);
    }
  }

  currentMarketplaceData = {
    date,
    view,
    type,
    snapshot,
    baseRows:rows,
    rows:rows.slice(),
    defaultColumns:[]
  };

  const categorySelect = document.getElementById("marketplaceDataCategory");
  const categories =
    Array.from(
      new Set(rows.map(row=>row.Category).filter(Boolean))
    ).sort((a,b)=>String(a).localeCompare(String(b)));

  const oldCategory = categorySelect?.value || "all";

  if(categorySelect){
    categorySelect.innerHTML =
      `<option value="all">All Categories</option>` +
      categories.map(
        category=>`<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
      ).join("");

    categorySelect.value =
      categories.includes(oldCategory)
        ? oldCategory
        : "all";
  }

  v6UpdateMarketplaceSkuTypeOptions();

  const currentSkuFilter = document.getElementById("marketplaceDataSkuType")?.value || "all";

  if(currentSkuFilter === "mapping_issues" && skuFilter !== "mapping_issues"){
    return loadMarketplaceData();
  }

  const defaultColumns = v4DataTypeColumns(view,type,rows);
  currentMarketplaceData.defaultColumns = defaultColumns;

  v4PopulateMarketplaceDataColumns(defaultColumns);

  v4SetAvailabilityChip(
    "marketplaceDataAvailability",
    rows.length ? "available" : "unavailable",
    rows.length ? "Available" : "No Data Available"
  );

  finalSetText(
    "marketplaceDataAsOf",
    `As of ${date}`
  );

  renderMarketplaceDataTable();
};


const v6RenderMarketplaceDataBase = renderMarketplaceDataTable;

renderMarketplaceDataTable = function(){
  v6UpdateMarketplaceSkuTypeOptions();
  v6RenderMarketplaceDataBase();
};


downloadMarketplaceData = function(){
  if(!currentMarketplaceData){
    loadMarketplaceData().then(downloadMarketplaceData);
    return;
  }

  const rows = v4ApplyMarketplaceDataFilters();
  const columns = v4SelectedMarketplaceDataColumns();

  const clean = rows.map(
    row => {
      const out = {};
      columns.forEach(column=>out[column]=row[column]);
      return out;
    }
  );

  const skuFilter = document.getElementById("marketplaceDataSkuType")?.value || "all";

  const viewLabel = {
    all:"All_Marketplace_Data",
    amazon:"Amazon_Data",
    flipkart:"Flipkart_Data",
    mapping:"WF_SKU_Mapping"
  }[currentMarketplaceData.view];

  writeExcelReport(
    `${viewLabel}_${skuFilter}_${currentMarketplaceData.date}.xlsx`,
    {
      Date:currentMarketplaceData.date,
      Rows:clean.length,
      Category:document.getElementById("marketplaceDataCategory")?.value || "all",
      "SKU Type / Mapping":document.getElementById("marketplaceDataSkuType")?.selectedOptions?.[0]?.textContent || "All SKUs"
    },
    clean
  );
};



openMarketplaceData = async function(){
  showView("marketplaceDataSection");

  const dateInput = document.getElementById("marketplaceDataDate");

  if(dateInput && !dateInput.value){
    dateInput.value =
      document.getElementById("dashboardToDate")?.value
      || todayIso();
  }

  await loadMarketplaceData();
};


/* ======================================================
   V6 UI WIRING / DEFAULTS
====================================================== */

function v6InitializeControls(){
  const dashboardPeriod = document.getElementById("dashboardPeriod");
  const reportPeriod = document.getElementById("reportPeriod");
  const insightsPeriod = document.getElementById("insightsPeriod");
  const explorerPeriod = document.getElementById("disparityExplorerPeriod");

  if(dashboardPeriod){
    dashboardPeriod.value = "today";
    v4SetRangeControls("dashboardPeriod","dashboardFromDate","dashboardToDate","dashboardDate");
  }

  if(reportPeriod){
    reportPeriod.value = "today";
    v4SetRangeControls("reportPeriod","reportFromDate","reportToDate","reportAnchorDate");
  }

  if(insightsPeriod){
    insightsPeriod.value = "last7";
    v4SetRangeControls("insightsPeriod","insightsFromDate","insightsToDate","insightsDate");
  }

  if(explorerPeriod){
    explorerPeriod.value = "today";
    v4SetRangeControls("disparityExplorerPeriod","disparityExplorerFromDate","disparityExplorerToDate");
  }

  v6UpdateMarketplaceSkuTypeOptions();
}


[
  ["disparityExplorerPeriod",async()=>loadDisparityExplorer()],
  ["disparityExplorerFromDate",async()=>{
    if(document.getElementById("disparityExplorerPeriod")?.value === "custom"){
      await loadDisparityExplorer();
    }
  }],
  ["disparityExplorerToDate",async()=>{
    if(document.getElementById("disparityExplorerPeriod")?.value === "custom"){
      await loadDisparityExplorer();
    }
  }],
  ["disparityExplorerCategory",async()=>loadDisparityExplorer()],
  ["disparityExplorerType",async()=>{
    if(v6DisparityExplorerMode === "dashboard"){
      await loadDisparityExplorer();
    }
  }],
  ["disparityExplorerSort",()=>renderDisparityExplorer()],
  ["insightsMarketplace",async()=>{
    const market = document.getElementById("insightsMarketplace")?.value || "combined";

    if(
      (market === "flipkart" && ["amazon_suppression","amazon_buybox"].includes(v6InsightFocus))
      || (market === "amazon" && v6InsightFocus === "flipkart_buybox")
    ){
      v6InsightFocus = "all";
      document.querySelectorAll("[data-insight-card]").forEach(card=>card.classList.remove("active"));
      finalSetText("insightsActiveMode","All Insights");
    }

    await loadMarketplaceInsights();
  }],
  ["insightsDisparityType",async()=>loadMarketplaceInsights()],
  ["marketplaceDataView",async()=>{
    v6UpdateMarketplaceSkuTypeOptions();
    await loadMarketplaceData();
  }],
  ["marketplaceDataCategory",async()=>{
    v6UpdateMarketplaceSkuTypeOptions();
    renderMarketplaceDataTable();
  }],
  ["marketplaceDataSkuType",async()=>loadMarketplaceData()]
].forEach(
  ([id,handler]) => {
    document.getElementById(id)?.addEventListener("change",handler);
  }
);


let v6ExplorerSearchTimer = null;

document.getElementById("disparityExplorerSearch")?.addEventListener(
  "input",
  () => {
    clearTimeout(v6ExplorerSearchTimer);
    v6ExplorerSearchTimer = setTimeout(renderDisparityExplorer,130);
  }
);


document.addEventListener(
  "DOMContentLoaded",
  v6InitializeControls,
  {once:true}
);


/* ---------- V6 exports ---------- */

window.loadDisparityExplorer = loadDisparityExplorer;
window.openSideMenuPriceView = openSideMenuPriceView;
window.openDisparityExplorerEmail = openDisparityExplorerEmail;
window.setMarketplaceInsightFocus = setMarketplaceInsightFocus;
window.v6SelectInsightCategory = v6SelectInsightCategory;
window.loadMarketplaceInsights = loadMarketplaceInsights;
window.downloadMarketplaceInsights = downloadMarketplaceInsights;
window.openMarketplaceData = openMarketplaceData;
window.loadMarketplaceData = loadMarketplaceData;
window.downloadMarketplaceData = downloadMarketplaceData;
window.renderMarketplaceDataTable = renderMarketplaceDataTable;


/* ======================================================
   EXPOSE BUTTON FUNCTIONS
====================================================== */

window.connectMasterPricing =
  connectMasterPricing;

window.uploadData =
  uploadData;

window.runAmazonPriceDisparity =
  runAmazonPriceDisparity;

window.runFlipkartPriceDisparity =
  runFlipkartPriceDisparity;

window.renderAmazonResults =
  renderAmazonResults;

window.renderFlipkartResults =
  renderFlipkartResults;

window.downloadAmazonResults =
  downloadAmazonResults;

window.downloadFlipkartResults =
  downloadFlipkartResults;

window.goToSection =
  goToSection;

window.showView = showView;
window.openDisparityHub = openDisparityHub;
window.openMarketplaceDisparity = openMarketplaceDisparity;
window.openAmazonSuppressionModule = openAmazonSuppressionModule;
window.openAmazonBuyBoxModule = openAmazonBuyBoxModule;
window.openFlipkartNoBuyBox = openFlipkartNoBuyBox;

renderDashboardModules();
updateBusinessDaysVisibility();




/* ======================================================
   WAKESUITE V7 · PRICING, HISTORY, ACCESS & OPERATIONS
====================================================== */

const V7_ORG_EMAIL_SUFFIX = "@wakefit.co";
const V7_ALL_MODULES = [
  "dashboard","marketplaceInsights","pricingInsights","inventoryInsights",
  "amazonListing","amazonLive","amazonMrp","amazonPricingIssues","amazonPriceUpdates","amazonMinMaxUpdates",
  "amazonSuppression","amazonBuyBox","suppressionManagement",
  "flipkartListing","flipkartLive","flipkartMrp","flipkartPriceUpdates",
  "pricingHistory","inventoryHistory","dailyCommunications",
  "uploadCenter","masterPricing","marketplaceData","pricingExceptions","settings","dataAdministration"
];
const V7_ACTION_KEYS = [
  "view","upload","download","email","suppressionOverride","pocEscalation",
  "manageSuppressions","raiseCaseId","managePoaQc","managePricingExceptions",
  "priceUpdates","settings","userAdmin","dataAdministration"
];
const V7_ROLE_PRESETS = {
  viewer:{view:true,upload:false,download:true,email:false,suppressionOverride:false,pocEscalation:false,manageSuppressions:false,raiseCaseId:false,managePoaQc:false,managePricingExceptions:false,priceUpdates:false,settings:false,userAdmin:false,dataAdministration:false},
  analyst:{view:true,upload:true,download:true,email:true,suppressionOverride:false,pocEscalation:false,manageSuppressions:false,raiseCaseId:false,managePoaQc:false,managePricingExceptions:false,priceUpdates:true,settings:false,userAdmin:false,dataAdministration:false},
  admin:{view:true,upload:true,download:true,email:true,suppressionOverride:true,pocEscalation:true,manageSuppressions:true,raiseCaseId:true,managePoaQc:true,managePricingExceptions:true,priceUpdates:true,settings:true,userAdmin:false,dataAdministration:false},
  super_admin:{view:true,upload:true,download:true,email:true,suppressionOverride:true,pocEscalation:true,manageSuppressions:true,raiseCaseId:true,managePoaQc:true,managePricingExceptions:true,priceUpdates:true,settings:true,userAdmin:true,dataAdministration:true}
};
const V7_DEFAULT_SCOPES = {marketplaces:["amazon","flipkart"],categories:["*"],modules:[...V7_ALL_MODULES],scopeKeys:[],allData:true};
const V72_ACCESS_CATEGORIES = ["Mattress","Furniture","Accessories","Office Chairs"];

let v7PricingExceptions = [];
let v7PricingExceptionsLoaded = false;
let v7PricingExceptionsVersion = "0";
let v7OperationalControls = {
  suppressionOverrideEnabled:true,
  thresholds:{Accessories:1000,Furniture:2000,Mattress:4000,OfficeChairsAlways:true},
  amazonPoc:{name:"",email:"",additional:""},
  flipkartPoc:{name:"",email:"",additional:""},
  internalMarketplaceRecipients:""
};
let v7PricingHistoryRows = [];
let v7InventoryHistoryRows = [];
let v7SuppressionCases = [];
let v7CommunicationsState = null;
let v7LastDashboardSearchRows = [];

function v7NormalizeEmail(value){ return String(value||"").trim().toLowerCase(); }
function v7IsOrgEmail(value){ const email=v7NormalizeEmail(value); return email.endsWith(V7_ORG_EMAIL_SUFFIX) && email.length>V7_ORG_EMAIL_SUFFIX.length; }
function v7Unique(values){ return Array.from(new Set((values||[]).filter(Boolean))); }
function v7CurrentAccess(){ return window.currentWakeSuiteAccess || {}; }
function v7CurrentPermissions(){
  const access=v7CurrentAccess();
  if(access.role==="super_admin") return {...V7_ROLE_PRESETS.super_admin};
  return {...(V7_ROLE_PRESETS[access.role]||V7_ROLE_PRESETS.viewer),...(access.permissions||{})};
}
function v7CurrentScopes(){
  const access=v7CurrentAccess();
  if(access.role==="super_admin") return {marketplaces:["amazon","flipkart"],categories:["*"],modules:[...V7_ALL_MODULES],allData:true};
  const scopes=access.scopes||{};
  return {
    marketplaces:Array.isArray(scopes.marketplaces)&&scopes.marketplaces.length?scopes.marketplaces:["amazon","flipkart"],
    categories:Array.isArray(scopes.categories)&&scopes.categories.length?scopes.categories:["*"],
    modules:Array.isArray(scopes.modules)&&scopes.modules.length?scopes.modules:[...V7_ALL_MODULES],
    allData:scopes.allData !== false
  };
}
function v7MarketAllowed(market){ return v7CurrentScopes().marketplaces.includes(market); }
function v7CategoryAllowed(category){ const c=v7CurrentScopes().categories; return c.includes("*") || c.includes(String(category||"")); }
function v7ModuleAllowed(module){ return v7CurrentScopes().modules.includes(module); }
function v7HasAction(action){ if(action==="upload" && !v7CurrentScopes().allData) return false; return !!v7CurrentPermissions()[action]; }
function v7HtmlStatus(status){ const c=String(status||"").toLowerCase().replace(/\s+/g,"_"); return `<span class="v7-status ${escapeHtml(c)}">${escapeHtml(status||"—")}</span>`; }
function v7Num(value){ const n=Number(value); return Number.isFinite(n)?n:0; }
function v7DateText(value){ return value ? String(value) : "—"; }
function v7SplitEmails(text){ return v7Unique(String(text||"").split(/[;,]+/).map(v=>v.trim()).filter(Boolean)); }
function v7FormatCategory(category){ return String(category||"Unmapped"); }
function v7SafeSheetName(name){ return String(name||"Data").replace(/[\\/?*\[\]:]/g," ").slice(0,31)||"Data"; }
window.alert=function(message){ showWakeSuiteToast(String(message||""),"info"); };

/* ---------- Settings grouping ---------- */
function v7ShowSettingsGroup(group,button){
  document.querySelectorAll(".settings-group-tab").forEach(b=>b.classList.toggle("active",b===button));
  const tabs=[...document.querySelectorAll("#settingsSubTabs .settings-tab")];
  tabs.forEach(tab=>{ tab.style.display=tab.dataset.settingsGroupChild===group?"":"none"; tab.classList.remove("active"); });
  document.querySelectorAll(".settings-pane").forEach(p=>p.classList.remove("active"));
  const first=tabs.find(tab=>tab.dataset.settingsGroupChild===group && tab.style.display!=="none");
  if(first){ showSettingsPane(first.dataset.settingsPane,first); }
  if(group==="system") loadOperationalControls();
}
window.v7ShowSettingsGroup=v7ShowSettingsGroup;

const v7BaseOpenEmailSettings = openEmailSettings;
openEmailSettings = function(){
  v7BaseOpenEmailSettings();
  const emailBtn=document.querySelector('.settings-group-tab[data-settings-group="email"]');
  v7ShowSettingsGroup("email",emailBtn);
};
function openWakeSuiteSettings(group="access"){
  showView("emailSettingsSection");
  const btn=document.querySelector(`.settings-group-tab[data-settings-group="${group}"]`);
  v7ShowSettingsGroup(group,btn);
}
window.openWakeSuiteSettings=openWakeSuiteSettings;

/* ---------- Unified access directory ---------- */
function v7RoleOptions(role){
  return ["viewer","analyst","admin","super_admin"].map(r=>`<option value="${r}" ${r===role?"selected":""}>${r==="super_admin"?"Super Admin":r.charAt(0).toUpperCase()+r.slice(1)}</option>`).join("");
}
function v7ActionCheckboxes(permissions,prefix){
  return V7_ACTION_KEYS.map(key=>`<label><input type="checkbox" data-v7-action="${key}" data-prefix="${escapeHtml(prefix)}" ${permissions?.[key]?"checked":""}> ${escapeHtml({userAdmin:"User Admin",suppressionOverride:"Suppression Override",pocEscalation:"POC Management",manageSuppressions:"Manage Suppressions",raiseCaseId:"Raise Case ID",managePoaQc:"Manage POA / QC",managePricingExceptions:"Manage Pricing Exceptions",priceUpdates:"Price Updates",dataAdministration:"Data Administration"}[key]||key.charAt(0).toUpperCase()+key.slice(1))}</label>`).join("");
}
function v7ModuleCheckboxes(scopes,prefix){
  const labels={dashboard:"Dashboard",marketplaceInsights:"Marketplace Insights",amazonListing:"Amazon Listing Disparity",amazonLive:"Amazon Live Disparity",amazonMrp:"Amazon MRP Disparity",amazonSuppression:"Amazon ASIN Suppression",amazonBuyBox:"Amazon Buy Box",suppressionManagement:"Suppression Management",flipkartListing:"Flipkart Listing Disparity",flipkartLive:"Flipkart Live Disparity",flipkartMrp:"Flipkart MRP Disparity",flipkartBuyBox:"Flipkart Buy Box",pricingHistory:"Pricing History",inventoryHistory:"Inventory History",dailyCommunications:"Daily Communications",uploadCenter:"Data Center",masterPricing:"Master Pricing",marketplaceData:"Marketplace Data",pricingExceptions:"Pricing Exceptions",settings:"Settings"};
  return V7_ALL_MODULES.map(key=>`<label><input type="checkbox" data-v7-module="${key}" data-prefix="${escapeHtml(prefix)}" ${(scopes.modules||V7_ALL_MODULES).includes(key)?"checked":""}> ${escapeHtml(labels[key]||key)}</label>`).join("");
}
function v7AccessEditor(record){
  const role=record.role||"viewer";
  const isSuper=role==="super_admin";
  const perms=isSuper?{...V7_ROLE_PRESETS.super_admin}:{...(V7_ROLE_PRESETS[role]||V7_ROLE_PRESETS.viewer),...(record.permissions||{})};
  const scopes=isSuper?{...V7_DEFAULT_SCOPES}:{...V7_DEFAULT_SCOPES,...(record.scopes||{})};
  const prefix=record.uid||record.email||record.id;
  const allCategories=(scopes.categories||[]).includes("*");
  const categoryChecks=`<label><input type="checkbox" data-v7-category="*" ${allCategories?"checked":""}> All Categories</label>`+
    V72_ACCESS_CATEGORIES.map(category=>`<label><input type="checkbox" data-v7-category="${escapeHtml(category)}" ${!allCategories&&(scopes.categories||[]).includes(category)?"checked":""}> ${escapeHtml(category)}</label>`).join("");
  const disabled=isSuper?"disabled":"";
  const lockedCategoryChecks=isSuper?`<label><input type="checkbox" data-v7-category="*" checked disabled> All Categories</label>`+V72_ACCESS_CATEGORIES.map(category=>`<label><input type="checkbox" checked disabled> ${escapeHtml(category)}</label>`).join(""):categoryChecks;
  return `<details><summary>Access Scope${isSuper?" · Full access locked":""}</summary><div class="v7-access-editor" data-v7-access-editor="${escapeHtml(prefix)}">
    <fieldset><legend>Marketplace & Categories</legend><div class="v7-check-grid"><label><input type="checkbox" data-v7-market="amazon" ${scopes.marketplaces.includes("amazon")?"checked":""} ${disabled}> Amazon</label><label><input type="checkbox" data-v7-market="flipkart" ${scopes.marketplaces.includes("flipkart")?"checked":""} ${disabled}> Flipkart</label></div><div class="v72-category-grid">${lockedCategoryChecks}</div></fieldset>
    <fieldset><legend>Actions</legend><div class="v7-check-grid">${isSuper?v7ActionCheckboxes(V7_ROLE_PRESETS.super_admin,prefix).replaceAll('> ', ' disabled> '):v7ActionCheckboxes(perms,prefix)}</div></fieldset>
    <fieldset style="grid-column:1/-1"><legend>Menus / Modules</legend><div class="v7-check-grid">${isSuper?v7ModuleCheckboxes(V7_DEFAULT_SCOPES,prefix).replaceAll('> ', ' disabled> '):v7ModuleCheckboxes(scopes,prefix)}</div></fieldset>
  </div></details>`;
}
function v7AccessCounters(records){
  const statuses=["approved","pending","invited","rejected","disabled"];
  return statuses.map(status=>`<button class="v7-counter" onclick="v7FilterUsersByStatus('${status}')">${status.charAt(0).toUpperCase()+status.slice(1)} <strong>${records.filter(r=>r.status===status).length}</strong></button>`).join("");
}
function v7FilterUsersByStatus(status){ const el=document.getElementById("userAccessStatus"); if(el) el.value=status; renderV7UserDirectory(); }
window.v7FilterUsersByStatus=v7FilterUsersByStatus;
let v7AccessRecords=[];
async function loadUserAccessManagement(){
  if(!v7HasAction("userAdmin")){ showWakeSuiteToast("You do not have User Administration permission.","warning"); return; }
  try{
    const directory=await window.loadWakeSuiteAccessDirectory();
    const records=[];
    (directory.users||[]).forEach(r=>records.push({...r,status:r.status||"approved",recordType:"user"}));
    (directory.requests||[]).forEach(r=>records.push({...r,status:r.status||"pending",recordType:"request"}));
    (directory.invites||[]).forEach(r=>records.push({...r,status:r.status||"invited",recordType:"invite",uid:r.uid||""}));
    v7AccessRecords=records.sort((a,b)=>String(a.email||"").localeCompare(String(b.email||"")));
    const counters=document.getElementById("userAccessCounters"); if(counters) counters.innerHTML=v7AccessCounters(v7AccessRecords);
    renderV7UserDirectory();
  }catch(error){ showWakeSuiteToast(error.message,"error","Unable to load access management"); }
}
function renderV7UserDirectory(){
  const container=document.getElementById("userAccessDirectory"); if(!container) return;
  const search=String(document.getElementById("userAccessSearch")?.value||"").trim().toLowerCase();
  const status=document.getElementById("userAccessStatus")?.value||"all";
  const role=document.getElementById("userAccessRoleFilter")?.value||"all";
  let rows=v7AccessRecords.filter(r=>{
    if(search && !`${r.email||""} ${r.name||""}`.toLowerCase().includes(search)) return false;
    if(status==="attention" && !["pending","invited"].includes(r.status)) return false;
    if(status!=="all" && status!=="attention" && r.status!==status) return false;
    if(role!=="all" && (r.role||"viewer")!==role) return false;
    return true;
  });
  if(!rows.length){ container.innerHTML='<div class="empty-row">No users match the selected filters.</div>'; return; }
  let html='<div class="table-wrap"><table class="v7-user-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Access</th><th>Actions</th></tr></thead><tbody>';
  rows.forEach(r=>{
    const key=r.uid||r.email||r.id;
    let actions="";
    if(r.status==="pending") actions=`<select id="v7-role-${escapeHtml(key)}">${v7RoleOptions(r.role||"analyst")}</select><button class="primary-btn" onclick="v7ApproveAccess('${escapeHtml(key)}')">Approve</button><button class="secondary-btn" onclick="v7RejectAccess('${escapeHtml(key)}')">Reject</button>`;
    else if(r.status==="invited") actions=`<button class="secondary-btn" onclick="v7CancelInvite('${escapeHtml(r.email||r.id)}')">Cancel Invite</button>`;
    else if(r.status==="rejected") actions=`<button class="primary-btn" onclick="v7ApproveAccess('${escapeHtml(key)}')">Approve</button>`;
    else if(r.status==="disabled") actions=`<button class="primary-btn" onclick="v7EnableAccess('${escapeHtml(key)}')">Re-enable</button>`;
    else actions=`<select class="v7-role-select" data-v7-role-for="${escapeHtml(key)}">${v7RoleOptions(r.role||"viewer")}</select><button class="primary-btn" onclick="v7SaveAccess('${escapeHtml(key)}')">Save Access</button>${(r.role||"")!=="super_admin"?`<button class="secondary-btn" onclick="disableWakeSuiteUser('${escapeHtml(key)}')">Disable</button>`:""}`;
    html+=`<tr data-v7-record-key="${escapeHtml(key)}"><td><strong>${escapeHtml(r.email||key)}</strong><br><small>${escapeHtml(r.name||"")}</small></td><td>${escapeHtml(r.role||"viewer")}</td><td>${v7HtmlStatus(r.status)}</td><td>${["approved"].includes(r.status)?v7AccessEditor(r):"—"}</td><td><div class="v7-action-row">${actions}</div></td></tr>`;
  });
  html+='</tbody></table></div>'; container.innerHTML=html;
}
window.renderV7UserDirectory=renderV7UserDirectory;
["userAccessSearch","userAccessStatus","userAccessRoleFilter"].forEach(id=>document.addEventListener("input",e=>{if(e.target?.id===id)renderV7UserDirectory();}));
function v7ReadAccessEditor(key,role){
  if(role==="super_admin") return {permissions:{...V7_ROLE_PRESETS.super_admin},scopes:{...V7_DEFAULT_SCOPES}};
  const row=document.querySelector(`[data-v7-record-key="${CSS.escape(key)}"]`);
  const editor=row?.querySelector(`[data-v7-access-editor="${CSS.escape(key)}"]`);
  const permissions={...(V7_ROLE_PRESETS[role]||V7_ROLE_PRESETS.viewer)};
  editor?.querySelectorAll("[data-v7-action]").forEach(el=>permissions[el.dataset.v7Action]=el.checked);
  const marketplaces=[...editor?.querySelectorAll("[data-v7-market]:checked")||[]].map(el=>el.dataset.v7Market);
  const modules=[...editor?.querySelectorAll("[data-v7-module]:checked")||[]].map(el=>el.dataset.v7Module);
  const selectedCategories=[...editor?.querySelectorAll("[data-v7-category]:checked")||[]].map(el=>el.dataset.v7Category);
  const categories=selectedCategories.includes("*")?["*"]:v7Unique(selectedCategories.filter(v=>V72_ACCESS_CATEGORIES.includes(v)));
  const finalMarkets=marketplaces.length?marketplaces:["amazon","flipkart"]; const finalCategories=categories.length?categories:["*"]; const scopeKeys=finalCategories.includes("*")?[]:finalMarkets.flatMap(m=>finalCategories.map(c=>`${m}::${c}`));
  const allData=finalCategories.includes("*")&&finalMarkets.length===2;
  if(permissions.upload && !allData){ permissions.upload=false; showWakeSuiteToast("Upload access was disabled because report uploads contain cross-market/category data. Grant All Marketplaces + All Categories to enable Upload.","info"); }
  return {permissions,scopes:{marketplaces:finalMarkets,categories:finalCategories,modules:modules.length?modules:[...V7_ALL_MODULES],scopeKeys,allData}};
}
async function v7SaveAccess(uid){
  const role=document.querySelector(`[data-v7-role-for="${CSS.escape(uid)}"]`)?.value||"viewer";
  const data=v7ReadAccessEditor(uid,role);
  await window.saveWakeSuiteAccessUser(uid,role,data.permissions,data.scopes); showWakeSuiteToast("User access updated.","success"); loadUserAccessManagement();
}
async function v7ApproveAccess(uid){
  const record=v7AccessRecords.find(r=>(r.uid||r.email||r.id)===uid); const role=document.getElementById(`v7-role-${uid}`)?.value||record?.role||"analyst";
  const permissions=V7_ROLE_PRESETS[role]||V7_ROLE_PRESETS.viewer; const scopes={...V7_DEFAULT_SCOPES};
  if(record?.status==="rejected" && record.recordType==="request") await window.approveWakeSuiteAccessRequest(uid,role,permissions,scopes);
  else await window.approveWakeSuiteAccessRequest(uid,role,permissions,scopes);
  showWakeSuiteToast("Access approved.","success"); loadUserAccessManagement();
}
async function v7RejectAccess(uid){ await window.rejectWakeSuiteAccessRequest(uid); showWakeSuiteToast("Access request rejected.","success"); loadUserAccessManagement(); }
async function v7EnableAccess(uid){ await window.enableWakeSuiteAccessUser(uid); showWakeSuiteToast("User re-enabled.","success"); loadUserAccessManagement(); }
async function v7CancelInvite(email){ await window.cancelWakeSuiteInvite(email); showWakeSuiteToast("Invitation cancelled.","success"); loadUserAccessManagement(); }
window.v7SaveAccess=v7SaveAccess; window.v7ApproveAccess=v7ApproveAccess; window.v7RejectAccess=v7RejectAccess; window.v7EnableAccess=v7EnableAccess; window.v7CancelInvite=v7CancelInvite;

const v7BaseInviteWakeSuiteUser=inviteWakeSuiteUser;
inviteWakeSuiteUser=async function(){
  const email=v7NormalizeEmail(document.getElementById("inviteUserEmail")?.value);
  if(!v7IsOrgEmail(email)){ showWakeSuiteToast(`Only ${V7_ORG_EMAIL_SUFFIX} organization emails can be added.`,"warning"); return; }
  const role=document.getElementById("inviteUserRole")?.value||"viewer";
  try{ await window.inviteWakeSuiteAccess(email,role,V7_ROLE_PRESETS[role],{...V7_DEFAULT_SCOPES}); document.getElementById("inviteUserEmail").value=""; showWakeSuiteToast(`${email} invited.`,"success"); loadUserAccessManagement(); }catch(error){ showWakeSuiteToast(error.message,"error","Unable to add user"); }
};

/* ---------- Apply access to navigation/data ---------- */
const v7BaseApplyAccessPermissions=applyAccessPermissions;
applyAccessPermissions=function(){
  v7BaseApplyAccessPermissions();
  document.querySelectorAll("[data-ws-market]").forEach(el=>{ el.style.display=v7MarketAllowed(el.dataset.wsMarket)?"":"none"; });
  document.querySelectorAll("[data-ws-module]").forEach(el=>{ el.style.display=v7ModuleAllowed(el.dataset.wsModule)?"":"none"; });
  const settingsLink=[...document.querySelectorAll(".nav-link")].find(x=>String(x.textContent||"").trim()==="Settings");
  if(settingsLink) settingsLink.style.display=(v7HasAction("settings")||v7HasAction("userAdmin"))?"":"none";
  const options=document.querySelectorAll("#dashboardMarketplace option"); options.forEach(o=>{ if(o.value!=="all") o.disabled=!v7MarketAllowed(o.value); });
  document.querySelectorAll('.v7-exceptions-panel').forEach(el=>el.style.display=v7ModuleAllowed("pricingExceptions")?"":"none");
};

const v7BaseGetSnapshotAmazonRows=getSnapshotAmazonRows;
getSnapshotAmazonRows=function(snapshot){ return v7BaseGetSnapshotAmazonRows(snapshot).filter(r=>v7MarketAllowed("amazon")&&v7CategoryAllowed(r.category)); };
const v7BaseGetSnapshotFlipkartRows=getSnapshotFlipkartRows;
getSnapshotFlipkartRows=function(snapshot){ return v7BaseGetSnapshotFlipkartRows(snapshot).filter(r=>v7MarketAllowed("flipkart")&&v7CategoryAllowed(r.category)); };
const v7BaseGetSnapshotAmazonIssueRows=getSnapshotAmazonIssueRows;
getSnapshotAmazonIssueRows=function(snapshot,key){
  let rows=v7BaseGetSnapshotAmazonIssueRows(snapshot,key).filter(r=>v7MarketAllowed("amazon")&&v7CategoryAllowed(r.category));
  if(key==="amazonSuppressions"){
    const overrides=new Set(snapshot?.suppressionOverrideAsins||[]);
    rows=rows.filter(r=>!overrides.has(r.asin));
  }
  return rows;
};

/* ---------- Fixed category access checkboxes ---------- */
document.addEventListener("change",event=>{
  const box=event.target?.closest?.("[data-v7-category]");
  if(!box)return;
  const editor=box.closest("[data-v7-access-editor]");
  if(!editor)return;
  const allBox=editor.querySelector('[data-v7-category="*"]');
  const specific=[...editor.querySelectorAll('[data-v7-category]:not([data-v7-category="*"])')];
  if(box.dataset.v7Category==="*"){
    if(box.checked)specific.forEach(item=>item.checked=false);
    else if(!specific.some(item=>item.checked))box.checked=true;
  }else if(box.checked){
    if(allBox)allBox.checked=false;
  }else if(!specific.some(item=>item.checked)){
    if(allBox)allBox.checked=true;
  }
});

/* ---------- No Summary worksheet by default ---------- */
writeExcelReport=function(filename,summary,rows){
  if(typeof XLSX==="undefined"){ showWakeSuiteToast("Excel library not loaded.","error"); return; }
  const workbook=XLSX.utils.book_new();
  const sheet=(rows&&rows.length)?XLSX.utils.json_to_sheet(rows):XLSX.utils.aoa_to_sheet([["No data available"]]);
  XLSX.utils.book_append_sheet(workbook,sheet,"Data");
  XLSX.writeFile(workbook,filename);
};

const v7BaseEmailWorkbook=v4BuildEmailWorkbook;
v4BuildEmailWorkbook=function(report){
  if(currentHistoricalViewKey==="amazon_suppression"){
    const rows=v4EmailIssueRows(report);
    const data=rows.map(row=>({Date:row.reportDate,Category:row.category,ASIN:row.asin,"Rev Impact / Day":row.revenueAvailable===false?"Revenue Data Unavailable":row.revenueImpactPerDay}));
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data),"Amazon Suppressions"); return wb;
  }
  return v7BaseEmailWorkbook(report);
};

/* ---------- Live disparity = frontend mismatch only ---------- */
function v7PricesSame(a,b){
  return Number(a)>0 && Number(b)>0 && Math.abs(Number(a)-Number(b))<=0.01;
}
function v7CorrectLiveClassification(result,marketplace){
  if(!result) return result;
  (result.rows||[]).forEach(row=>{
    const wf=Number(row.wfPrice||0);
    const live=Number(row.finalLivePrice||0);
    const listing=Number(row.listingPrice||0);
    row.liveMatchesListing=v7PricesSame(live,listing);

    // Canonical V9 rule: a valid/eligible live price is compared directly with WF ±₹5.
    // Equality with listing price is informational only and never suppresses a live disparity.
    if(row.eligibleForComparison && wf>0 && live>0){
      row.livePriceDisparity=Math.abs(live-wf)>PRICE_THRESHOLD;
      row.livePriceDiff=live-wf;
      row.livePriceAction=row.livePriceDisparity
        ? (live < wf-PRICE_THRESHOLD ? "Increase Price" : "Decrease Price")
        : "No Action";
    }else{
      row.livePriceDisparity=false;
      row.liveDailyRevenueImpact=0;
    }

    row.dailyRevenueImpact=row.livePriceDisparity
      ? v7Num(row.liveDailyRevenueImpact)
      : (row.listingPriceDisparity?v7Num(row.listingDailyRevenueImpact):0);
  });
  result.livePriceDisparityRows=(result.rows||[]).filter(r=>r.livePriceDisparity);
  result.listingPriceDisparityRows=(result.rows||[]).filter(r=>r.listingPriceDisparity);
  result.mrpDisparityRows=(result.rows||[]).filter(r=>r.mrpDisparity);
  return result;
}

/* ---------- Pricing exceptions ---------- */
function v7ExceptionDate(value){
  if(!value) return "";
  if(value instanceof Date) return formatDateISO(value);
  const raw=String(value).trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d=new Date(raw); return Number.isNaN(d.getTime())?"":formatDateISO(d);
}
function v7ExceptionType(value){
  return String(value||"").trim();
}
function v7ExceptionScope(value){
  return String(value||"").trim();
}
function v9ExceptionAppliesToType(exceptionType,marketplace,type){
  const t=String(exceptionType||"").trim().toLowerCase();
  if(t==="pricing") return true;
  if(t==="amazon deal tag") return marketplace==="amazon";
  if(t==="flipkart opt-in") return marketplace==="flipkart";
  if(t==="category exception") return true;
  // Backward compatibility for any old V7 records.
  if(t.includes("listing")) return type==="listing";
  if(t.includes("live")) return type==="live";
  if(t.includes("mrp")) return type==="mrp";
  return false;
}
function v9ExceptionMatchesIdentifiers(ex,row,marketplace){
  const checks=[];
  const wf=normalizeKey(ex.wfSku||"");
  if(wf) checks.push(wf===normalizeKey(row.wfSku));

  if(marketplace==="amazon"){
    const asin=normalizeKey(ex.asin||"");
    const azSku=normalizeKey(ex.azSku||ex.marketplaceSku||"");
    if(asin) checks.push(asin===normalizeKey(row.asin));
    if(azSku) checks.push(azSku===normalizeKey(row.azSku));

    // Backward compatibility for V7/V8 records.
    if(!asin && !azSku && ex.identifier){
      const legacy=normalizeKey(ex.identifier);
      checks.push(legacy===normalizeKey(row.asin) || legacy===normalizeKey(row.azSku));
    }
  }else{
    const fsn=normalizeKey(ex.fsn||"");
    const fkSku=normalizeKey(ex.fkSku||ex.marketplaceSku||"");
    if(fsn) checks.push(fsn===normalizeKey(row.fsn));
    if(fkSku) checks.push(fkSku===normalizeKey(row.fkSku));

    if(!fsn && !fkSku && ex.identifier){
      const legacy=normalizeKey(ex.identifier);
      checks.push(legacy===normalizeKey(row.fsn) || legacy===normalizeKey(row.fkSku));
    }
  }
  return checks.length>0 && checks.every(Boolean);
}
function v7FindException(row,marketplace,type,reportDate){
  return v7PricingExceptions.find(ex=>{
    const status=String(ex.status||"active").toLowerCase();
    if(status==="disabled" || status==="expired" || status==="rejected") return false;
    if(ex.marketplace && ex.marketplace!==marketplace && ex.marketplace!=="all") return false;
    if(!v9ExceptionAppliesToType(ex.exceptionType,marketplace,type)) return false;

    const exCategory=String(ex.category||"all").trim().toLowerCase();
    const rowCategory=String(row.category||"").trim().toLowerCase();
    if(exCategory && !["all","*","unmapped"].includes(exCategory) && exCategory!==rowCategory) return false;

    if(ex.effectiveFrom && reportDate<ex.effectiveFrom) return false;
    if(ex.effectiveTo && reportDate>ex.effectiveTo) return false;

    return v9ExceptionMatchesIdentifiers(ex,row,marketplace);
  });
}
function v7ApplyExceptions(result,marketplace,reportDate){
  if(!result) return result;
  (result.rows||[]).forEach(row=>{
    const listingEx=row.listingPriceDisparity?v7FindException(row,marketplace,"listing",reportDate):null;
    const liveEx=row.livePriceDisparity?v7FindException(row,marketplace,"live",reportDate):null;
    const mrpEx=row.mrpDisparity?v7FindException(row,marketplace,"mrp",reportDate):null;
    row.listingPriceException=!!listingEx; row.livePriceException=!!liveEx; row.mrpException=!!mrpEx;
    row.approvedException=listingEx||liveEx||mrpEx||null;
    if(listingEx){ row.listingPriceDisparity=false; row.listingDailyRevenueImpact=0; row.listingPriceAction="Approved Exception"; }
    if(liveEx){ row.livePriceDisparity=false; row.liveDailyRevenueImpact=0; row.livePriceAction="Approved Exception"; }
    if(mrpEx){ row.mrpDisparity=false; }
    row.dailyRevenueImpact=row.livePriceDisparity?v7Num(row.liveDailyRevenueImpact):(row.listingPriceDisparity?v7Num(row.listingDailyRevenueImpact):0);
  });
  result.listingPriceDisparityRows=(result.rows||[]).filter(r=>r.listingPriceDisparity);
  result.livePriceDisparityRows=(result.rows||[]).filter(r=>r.livePriceDisparity);
  result.mrpDisparityRows=(result.rows||[]).filter(r=>r.mrpDisparity);
  return result;
}
function v7RefreshResultSummary(result,marketplace){
  if(!result) return;
  const rows=result.rows||[]; const s=result.summary||(result.summary={});
  s.listingPriceDisparitySkus=rows.filter(r=>r.listingPriceDisparity).length;
  s.livePriceDisparitySkus=rows.filter(r=>r.livePriceDisparity).length;
  s.mrpDisparitySkus=rows.filter(r=>r.mrpDisparity).length;
  s.listingTotalDailyRevenueImpact=rows.reduce((a,r)=>a+v7Num(r.listingDailyRevenueImpact),0);
  s.liveTotalDailyRevenueImpact=rows.reduce((a,r)=>a+v7Num(r.liveDailyRevenueImpact),0);
  s.totalDailyRevenueImpact=rows.reduce((a,r)=>a+v7Num(r.dailyRevenueImpact),0);
}
async function v7EnsurePricingExceptionsLoaded(force=false){
  if(v7PricingExceptionsLoaded&&!force) return v7PricingExceptions;
  if(typeof window.loadPricingExceptions!=="function") return [];
  try{
    const rows=await window.loadPricingExceptions();
    v7PricingExceptions=rows||[]; v7PricingExceptionsLoaded=true;
    const versions=rows.map(r=>r.updatedAt?.seconds||r.createdAt?.seconds||0); v7PricingExceptionsVersion=String(Math.max(0,...versions));
  }catch(error){ console.warn("Pricing exceptions unavailable",error); }
  return v7PricingExceptions;
}

const v7BaseBuildAmazonModularResult=buildAmazonModularResult;
buildAmazonModularResult=function(reportDate){ const result=v7BaseBuildAmazonModularResult(reportDate); v7CorrectLiveClassification(result,"amazon"); v7ApplyExceptions(result,"amazon",reportDate); v7RefreshResultSummary(result,"amazon"); return result; };
const v7BaseBuildFlipkartModularResult=buildFlipkartModularResult;
buildFlipkartModularResult=function(reportDate){ const result=v7BaseBuildFlipkartModularResult(reportDate); v7CorrectLiveClassification(result,"flipkart"); v7ApplyExceptions(result,"flipkart",reportDate); v7RefreshResultSummary(result,"flipkart"); return result; };
const v7BaseBuildInputFingerprint=buildInputFingerprint;
buildInputFingerprint=function(date){ return `${v7BaseBuildInputFingerprint(date)}::PX:${v7PricingExceptionsVersion}`; };
const v7BaseMaybeAutoProcessCurrentDate=maybeAutoProcessCurrentDate;
maybeAutoProcessCurrentDate=async function(){ await v7EnsurePricingExceptionsLoaded(); return v7BaseMaybeAutoProcessCurrentDate(); };

const v7BaseCalcParityStats=calcParityStats;
calcParityStats=function(rows,kind,marketplace){
  const filtered=(rows||[]).filter(r=>!(kind==="listing"?r.listingPriceException:(kind==="live"?r.livePriceException:r.mrpException)));
  return v7BaseCalcParityStats(filtered,kind,marketplace);
};
const v7BaseV4PriceObservations=v4PriceObservations;
v4PriceObservations=function(snapshot,marketplace,category="all"){
  const rows=marketplace==="amazon"?getSnapshotAmazonRows(snapshot):getSnapshotFlipkartRows(snapshot);
  const filtered=rows.filter(row=>dashboardCategoryMatches(row,category));
  const liveKey=marketplace==="amazon"?"amazonLive":"flipkartLive";
  const liveAvailable=v4SnapshotModuleState(snapshot,liveKey)!=="unavailable";
  if(liveAvailable){
    return filtered.filter(row=>Number(row.listingPrice)>0 || (row.eligibleForComparison&&Number(row.finalLivePrice)>0)).map(row=>{
      const useLive=row.eligibleForComparison&&Number(row.finalLivePrice)>0&&!v7PricesSame(row.finalLivePrice,row.listingPrice);
      const exception=useLive?row.livePriceException:row.listingPriceException;
      const disparity=useLive?row.livePriceDisparity:row.listingPriceDisparity;
      const impact=v4SnapshotRevenueAvailable(snapshot,marketplace)?(useLive?v7Num(row.liveDailyRevenueImpact):v7Num(row.listingDailyRevenueImpact)):null;
      return {...row,reportDate:snapshot.reportDate,priceSignal:useLive?"Live":"Listing",parityStatus:exception?"Approved Exception":(disparity?"Disparity":"Parity"),priceImpact:exception?0:impact};
    });
  }
  return v7BaseV4PriceObservations(snapshot,marketplace,category).map(row=>({...row,parityStatus:row.listingPriceException?"Approved Exception":row.parityStatus,priceImpact:row.listingPriceException?0:row.priceImpact}));
};

/* Extend compact rows for exception flags */
const v7BaseCompactAmazonRow=compactAmazonRow, v7BaseExpandAmazonRow=expandAmazonRow;
compactAmazonRow=function(r){ return [...v7BaseCompactAmazonRow(r),!!r.listingPriceException,!!r.livePriceException,!!r.mrpException,!!r.liveMatchesListing]; };
expandAmazonRow=function(a){ const r=v7BaseExpandAmazonRow(a); r.listingPriceException=!!a[28]; r.livePriceException=!!a[29]; r.mrpException=!!a[30]; r.liveMatchesListing=!!a[31]; return r; };
const v7BaseCompactFlipkartRow=compactFlipkartRow, v7BaseExpandFlipkartRow=expandFlipkartRow;
compactFlipkartRow=function(r){ return [...v7BaseCompactFlipkartRow(r),!!r.listingPriceException,!!r.livePriceException,!!r.mrpException,!!r.liveMatchesListing]; };
expandFlipkartRow=function(a){ const r=v7BaseExpandFlipkartRow(a); r.listingPriceException=!!a[31]; r.livePriceException=!!a[32]; r.mrpException=!!a[33]; r.liveMatchesListing=!!a[34]; return r; };

/* ---------- Inventory snapshot rows for true OOS history ---------- */
function v7BuildAmazonInventoryRows(reportDate){
  const wfReport=v4ReportForDate("wakefit_daily_pricing",reportDate), listingReport=v4ReportForDate("amazon_all_listings",reportDate); if(!window.masterPricingAmazon||!wfReport||!listingReport)return[];
  const fbaReport=v4ReportForDate("amazon_fba_inventory",reportDate), businessReport=v4ReportForDate("amazon_business_reports",reportDate);
  const master=prepareAmazonMasterPricing().masterMap, wfMap=buildWakefitPricingMap(wfReport.parsedFile.rows), listingMap=buildAmazonListingMap(listingReport.parsedFile.rows), fbaMap=fbaReport?buildFbaInventoryMap(fbaReport.parsedFile.rows):new Map(), businessMap=businessReport?buildAmazonBusinessRevenueMap(businessReport.parsedFile.rows):new Map();
  const days=businessReport?(Number(businessReport.businessReportDays)||DEFAULT_AMAZON_BUSINESS_REPORT_DAYS):0; const out=[];
  master.forEach(m=>{ const l=listingMap.get(m.azSku); const wf=wfMap.get(m.wfSku); if(!l||l.status!=="active"||!wf)return; const allQty=Number(l.quantity||0); const fbaQty=fbaReport?Number(fbaMap.get(m.azSku)||0):0; const known=allQty>0||!!fbaReport; const inv=allQty>0?allQty:(fbaReport?fbaQty:null); const asin=m.asin||l.asin; const revenue=businessReport?Number(businessMap.get(asin)?.revenue||0):null; out.push({marketplace:"amazon",reportDate,category:m.category,wfSku:m.wfSku,marketSku:m.azSku,identifier:asin,inventory:inv,inventoryKnown:known,listingPrice:l.azPrice,avgRevenuePerDay:businessReport&&days?revenue/days:null,revenueAvailable:!!businessReport}); });
  return out;
}
function v7BuildFlipkartInventoryRows(reportDate){
  const wfReport=v4ReportForDate("wakefit_daily_pricing",reportDate), listingReport=v4ReportForDate("flipkart_listing_file",reportDate); if(!window.masterPricingFlipkart||!wfReport||!listingReport)return[];
  const orderReport=v4ReportForDate("flipkart_order_report",reportDate); const master=prepareFlipkartMasterPricing().masterMap, wfMap=buildWakefitPricingMap(wfReport.parsedFile.rows), listingMap=buildFlipkartListingMap(listingReport.parsedFile.rows); const orderData=orderReport?buildFlipkartOrderTrackingMap(orderReport.parsedFile.rows):{fsnMap:new Map(),periodDays:0};
  const fsnPrice=new Map(); master.forEach(m=>{const l=listingMap.get(m.fkSku); if(!l||l.status!=="ACTIVE")return; const p=Number(l.fkPrice||0); if(p>0 && (!fsnPrice.has(l.fsn)||p<fsnPrice.get(l.fsn)))fsnPrice.set(l.fsn,p);});
  const out=[]; master.forEach(m=>{ const l=listingMap.get(m.fkSku),wf=wfMap.get(m.wfSku); if(!l||l.status!=="ACTIVE"||!wf)return; const stats=orderData.fsnMap.get(l.fsn)||{revenueQuantity:0}; const avg=orderReport&&orderData.periodDays?Number(stats.revenueQuantity||0)*Number(fsnPrice.get(l.fsn)||l.fkPrice||0)/orderData.periodDays:null; out.push({marketplace:"flipkart",reportDate,category:m.category,wfSku:m.wfSku,marketSku:m.fkSku,identifier:l.fsn,inventory:Number(l.systemStock||0),inventoryKnown:true,listingPrice:l.fkPrice,avgRevenuePerDay:avg,revenueAvailable:!!orderReport&&orderData.periodDays>0}); }); return out;
}
const v7BaseMakePersistedSnapshot=makePersistedSnapshot;
makePersistedSnapshot=function(date,fingerprint,amazon,flipkart){ const snapshot=v7BaseMakePersistedSnapshot(date,fingerprint,amazon,flipkart); snapshot.amazonInventoryRows=v7BuildAmazonInventoryRows(date); snapshot.flipkartInventoryRows=v7BuildFlipkartInventoryRows(date); snapshot.schemaVersion="v7"; return snapshot; };

/* ---------- Pricing Exceptions template & manager ---------- */
function downloadPricingExceptionsTemplate(){
  const headers=[["Marketplace","Scope","ASIN / FSN","Marketplace SKU","WF SKU","Exception Type","Approved Price From","Approved Price To","Effective From","Effective To","Reason","Remarks"]];
  const example=["Amazon","Product","B0ABC12345","","WFMAT001","Listing Price",8499,8599,"18-Aug-2026","25-Aug-2026","Promotion","Approved campaign price"];
  const instructions=[
    ["Field","Allowed / Notes"],["Marketplace","Amazon or Flipkart"],["Scope","Product or SKU"],["ASIN / FSN","Required"],["Marketplace SKU","Required only when Scope = SKU"],["WF SKU","Optional validation"],["Exception Type","Listing Price, Live Price, or MRP"],["Approved Price From / To","Inclusive approved range"],["Effective From / To","Required dates"],["Reason","Required"],["Remarks","Optional"]
  ];
  const wb=XLSX.utils.book_new(); const input=XLSX.utils.aoa_to_sheet([...headers,example]); XLSX.utils.book_append_sheet(wb,input,"Pricing Exceptions"); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(instructions),"Instructions"); XLSX.writeFile(wb,"WakeSuite_Pricing_Exceptions_Template.xlsx");
}
async function uploadPricingExceptions(){
  if(!v7HasAction("managePricingExceptions")){ showWakeSuiteToast("Manage Pricing Exceptions permission is required.","warning"); return; }
  const file=document.getElementById("pricingExceptionsFile")?.files?.[0]; if(!file){showWakeSuiteToast("Choose the completed Pricing Exceptions file.","warning");return;}
  try{
    const buffer=await file.arrayBuffer(); const wb=XLSX.read(buffer,{type:"array",cellDates:true}); const sheet=wb.Sheets["Pricing Exceptions"]||wb.Sheets[wb.SheetNames[0]]; const rows=XLSX.utils.sheet_to_json(sheet,{defval:"",raw:true});
    const normalized=[]; const invalid=[];
    rows.forEach((r,i)=>{
      const marketplace=String(r["Marketplace"]||"").trim().toLowerCase(); const scope=v7ExceptionScope(r["Scope"]); const identifier=String(r["ASIN / FSN"]||"").trim(); const marketSku=String(r["Marketplace SKU"]||"").trim(); const wfSku=String(r["WF SKU"]||"").trim(); const exceptionType=v7ExceptionType(r["Exception Type"]); const approvedFrom=parseMoney(r["Approved Price From"]),approvedTo=parseMoney(r["Approved Price To"]); const effectiveFrom=v7ExceptionDate(r["Effective From"]),effectiveTo=v7ExceptionDate(r["Effective To"]); const reason=String(r["Reason"]||"").trim(),remarks=String(r["Remarks"]||"").trim();
      if(!["amazon","flipkart"].includes(marketplace)||!identifier||!exceptionType||!(approvedFrom>0)||!(approvedTo>0)||approvedFrom>approvedTo||!effectiveFrom||!effectiveTo||effectiveFrom>effectiveTo||!reason||(scope==="sku"&&!marketSku)){ invalid.push(i+2); return; }
      let category=""; try{ if(marketplace==="amazon"&&window.masterPricingAmazon){ const m=prepareAmazonMasterPricing().masterMap; for(const x of m.values()){if((scope==="sku"?x.azSku===marketSku:x.asin===identifier)&&( !wfSku||x.wfSku===wfSku)){category=x.category;break;}} } else if(marketplace==="flipkart"&&window.masterPricingFlipkart){ const m=prepareFlipkartMasterPricing().masterMap; for(const x of m.values()){if((scope==="sku"?x.fkSku===marketSku:x.fsn===identifier)&&( !wfSku||x.wfSku===wfSku)){category=x.category;break;}} } }catch(_e){}
      normalized.push({marketplace,scope,identifier,marketplaceSku:marketSku,wfSku,category,exceptionType,approvedFrom,approvedTo,effectiveFrom,effectiveTo,reason,remarks});
    });
    if(invalid.length){ showWakeSuiteToast(`Invalid rows: ${invalid.slice(0,12).join(", ")}${invalid.length>12?"…":""}. No exceptions were uploaded.`,"error"); return; }
    await window.savePricingExceptions(normalized); v7PricingExceptionsLoaded=false; await v7EnsurePricingExceptionsLoaded(true); await loadPricingExceptionsManager(); showWakeSuiteToast(`${normalized.length} pricing exceptions uploaded. Re-upload/process affected report dates to refresh stored snapshots.`,"success","Pricing Exceptions");
  }catch(error){showWakeSuiteToast(error.message,"error","Pricing Exceptions upload failed");}
}
async function loadPricingExceptionsManager(){
  await v7EnsurePricingExceptionsLoaded(true);
  const table=document.getElementById("pricingExceptionsTable");
  const kpis=document.getElementById("pricingExceptionsKpis");
  if(!table||!kpis)return;

  const today=todayIso();
  const rows=v7PricingExceptions.map(r=>({
    ...r,
    displayStatus:today<(r.effectiveFrom||"")?"Future":(today>(r.effectiveTo||"9999-12-31")?"Expired":"Active")
  }));
  const counts={Active:0,Future:0,Expired:0};
  rows.forEach(r=>counts[r.displayStatus]=(counts[r.displayStatus]||0)+1);
  kpis.innerHTML=`<div class="v7-kpi"><span>Active Exceptions</span><strong>${counts.Active||0}</strong></div><div class="v7-kpi"><span>Future</span><strong>${counts.Future||0}</strong></div><div class="v7-kpi"><span>Expired</span><strong>${counts.Expired||0}</strong></div><div class="v7-kpi"><span>Total</span><strong>${rows.length}</strong></div>`;

  if(!rows.length){
    table.innerHTML='<tbody><tr><td class="empty-row">No pricing exceptions uploaded.</td></tr></tbody>';
    return;
  }

  const identifierText=r=>[
    r.wfSku&&`WF SKU: ${r.wfSku}`,
    r.azSku&&`AZ SKU: ${r.azSku}`,
    r.asin&&`ASIN: ${r.asin}`,
    r.fkSku&&`FK SKU: ${r.fkSku}`,
    r.fsn&&`FSN: ${r.fsn}`,
    (!r.wfSku&&!r.azSku&&!r.asin&&!r.fkSku&&!r.fsn&&r.identifier)&&`Identifier: ${r.identifier}`
  ].filter(Boolean).join(" · ");

  table.innerHTML='<thead><tr><th>Marketplace</th><th>Category</th><th>Identifiers</th><th>Exception Type</th><th>Effective Period</th><th>Remarks</th><th>Status</th></tr></thead><tbody>'+
    rows.slice(0,1200).map(r=>`<tr><td>${escapeHtml(r.marketplace==="amazon"?"Amazon":"Flipkart")}</td><td>${escapeHtml(["all","*"].includes(String(r.category||"").toLowerCase())?"All Categories":(r.category||"All Categories"))}</td><td>${escapeHtml(identifierText(r)||"—")}</td><td>${escapeHtml(r.exceptionType||"Pricing")}</td><td>${escapeHtml(r.effectiveFrom||"—")} → ${escapeHtml(r.effectiveTo||"—")}</td><td>${escapeHtml(r.remarks||r.reason||"—")}</td><td>${v7HtmlStatus(r.displayStatus)}</td></tr>`).join("")+'</tbody>';
}
window.downloadPricingExceptionsTemplate=downloadPricingExceptionsTemplate; window.uploadPricingExceptions=uploadPricingExceptions; window.loadPricingExceptionsManager=loadPricingExceptionsManager;

/* ---------- Dashboard marketplace + search download ---------- */
function v7DashboardMarketplace(){ return document.getElementById("dashboardMarketplace")?.value||"all"; }
function v7ApplyDashboardMarketplaceVisibility(){
  const market=v7DashboardMarketplace(); const blocks=[...document.querySelectorAll("#dashboardHome .market-dashboard-block")]; blocks.forEach(block=>{const h=String(block.querySelector("h2")?.textContent||"").toLowerCase(); block.classList.toggle("v7-hidden-market",market!=="all" && !h.includes(market));});
  const combined=[...document.querySelectorAll("#dashboardHome .metric-card")].find(c=>String(c.textContent||"").includes("Combined Marketplace Rev Impact")); if(combined) combined.style.display=market==="all"?"":"none";
}
const v7BaseRenderDashboardFromSnapshots=renderDashboardFromSnapshots;
renderDashboardFromSnapshots=function(snapshots,period,anchor,category){ v7BaseRenderDashboardFromSnapshots(snapshots,period,anchor,category); v7ApplyDashboardMarketplaceVisibility(); };
const v7BaseV4BuildDashboardSearchRows=v4BuildDashboardSearchRows;
v4BuildDashboardSearchRows=function(snapshots,query,category){
  const market=v7DashboardMarketplace();
  const baseRows=v7BaseV4BuildDashboardSearchRows(snapshots,query,category)
    .filter(r=>market==="all"||String(r.marketplace||"").toLowerCase()===market);
  const rows=baseRows.map(result=>{
    const snap=(snapshots||[]).find(x=>x.reportDate===result.reportDate);
    const isAmazon=String(result.marketplace||"").toLowerCase()==="amazon";
    const source=(isAmazon?getSnapshotAmazonRows(snap):getSnapshotFlipkartRows(snap)).find(r=>
      (isAmazon?r.asin:r.fsn)===result.productId && (isAmazon?r.azSku:r.fkSku)===result.marketplaceSku
    )||{};
    const suppression=isAmazon?getSnapshotAmazonIssueRows(snap,"amazonSuppressions").find(r=>r.asin===result.productId):null;
    const buyBox=isAmazon?getSnapshotAmazonIssueRows(snap,"amazonBuyBox").find(r=>r.asin===result.productId):null;
    const liveStatus=source.livePriceException?"Approved Exception":(source.liveMatchesListing?"Same as Listing":(source.livePriceDisparity?"Disparity":result.liveStatus));
    const listingStatus=source.listingPriceException?"Approved Exception":(source.listingPriceDisparity?"Disparity":result.listingStatus);
    return {...result,
      wfMrp:source.wfMrp??null,wfPrice:source.wfPrice??null,
      marketMrp:isAmazon?(source.azMrp??null):(source.fkMrp??null),
      inventory:source.inventory??null,
      listingPrice:source.listingPrice??result.listingPrice,
      livePrice:source.finalLivePrice??result.livePrice,
      listingDiff:source.listingPriceDiff??null,liveDiff:source.livePriceDiff??null,mrpDiff:source.mrpDiff??null,
      listingStatus,liveStatus,
      mrpStatus:source.mrpException?"Approved Exception":(source.mrpDisparity?"Disparity":"Parity"),
      suppressionStatus:isAmazon?(suppression?"Suppressed":(source.suppressionStatus||"Active")):"NA",
      buyBoxStatus:isAmazon?(buyBox?"Buy Box Suppressed":(source.buyBoxStatus||"Available")):(source.buyBoxStatus||"Available"),
      revenue:isAmazon?(source.asinRevenue??null):(source.calculatedRevenue??null),
      revenueAvailable:source.revenueAvailable!==false,
      marketplaceSku:result.marketplaceSku,productId:result.productId
    };
  });
  v7LastDashboardSearchRows=rows;
  return rows;
};
function downloadDashboardSearchResults(){
  const rows=v7LastDashboardSearchRows||[]; if(!rows.length){showWakeSuiteToast("Search for a product before downloading.","warning");return;}
  if(!v7HasAction("download")){showWakeSuiteToast("Download permission is required.","warning");return;}
  const wb=XLSX.utils.book_new();
  const append=(market,label)=>{
    const data=rows.filter(r=>String(r.marketplace||"").toLowerCase()===market).map(r=>({
      Date:r.reportDate,Category:r.category,"WF SKU":r.wfSku,
      [market==="amazon"?"AZ SKU":"FK SKU"]:r.marketplaceSku,
      [market==="amazon"?"ASIN":"FSN"]:r.productId,
      "WF MRP":r.wfMrp,"WF Price":r.wfPrice,"Marketplace MRP":r.marketMrp,
      "Listing Price":r.listingPrice,"Listing Status":r.listingStatus,"Listing Diff":r.listingDiff,
      "Live Price":r.livePrice,"Live Status":r.liveStatus,"Live Diff":r.liveDiff,
      "MRP Status":r.mrpStatus,"MRP Diff":r.mrpDiff,Inventory:r.inventory,
      "Suppression Status":r.suppressionStatus||"NA","Buy Box Status":r.buyBoxStatus||"NA",
      [market==="amazon"?"ASIN Revenue (60 Days)":"Calculated Revenue"]:r.revenueAvailable===false?"Revenue Data Refresh Required":r.revenue,
      "Price Rev Impact / Day":r.priceImpact===null?"Revenue Data Refresh Required":r.priceImpact,
      "Suppression Rev Impact / Day":r.suppressionImpact===null?"Revenue Data Refresh Required":r.suppressionImpact,
      "Buy Box Rev Impact / Day":r.buyBoxImpact===null?"Revenue Data Refresh Required":r.buyBoxImpact,
      "Total Exposure / Day":r.totalExposure
    }));
    if(data.length) XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data),label);
  };
  append("amazon","Amazon"); append("flipkart","Flipkart");
  if(!wb.SheetNames.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["No data available"]]),"Data");
  XLSX.writeFile(wb,`WakeSuite_Product_Search_${todayIso()}.xlsx`);
}
window.downloadDashboardSearchResults=downloadDashboardSearchResults;
document.addEventListener("change",e=>{if(e.target?.id==="dashboardMarketplace"){loadDashboardOverview(); if(document.getElementById("dashboardGlobalSearch")?.value)runDashboardSearch();}});

/* ---------- Range helper for new history pages ---------- */
function v7Range(prefix){ return v4SetRangeControls(`${prefix}Period`,`${prefix}FromDate`,`${prefix}ToDate`); }
function v7PopulateCategory(id,rows){ const select=document.getElementById(id); if(!select)return; const current=select.value||"all"; const cats=v7Unique(rows.map(r=>r.category).filter(Boolean)).sort(); select.innerHTML='<option value="all">All Categories</option>'+cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join(""); select.value=["all",...cats].includes(current)?current:"all"; }
async function v7LoadSnapshots(fromDate,toDate){ return v4LoadSnapshotsForRange(fromDate,toDate); }

/* ---------- Pricing History ---------- */
async function openPricingHistory(){ showView("pricingHistorySection"); const p=document.getElementById("pricingHistoryPeriod"); if(p&&!p.value)p.value="last7"; v7Range("pricingHistory"); await loadPricingHistory(); }
async function loadPricingHistory(){
  const [from,to]=v7Range("pricingHistory"),market=document.getElementById("pricingHistoryMarketplace")?.value||"all",category=document.getElementById("pricingHistoryCategory")?.value||"all",type=document.getElementById("pricingHistoryType")?.value||"all",view=document.getElementById("pricingHistoryView")?.value||"daily",search=String(document.getElementById("pricingHistorySearch")?.value||"").trim().toLowerCase();
  const snaps=await v7LoadSnapshots(from,to); let raw=[]; snaps.forEach(s=>{ if((market==="all"||market==="amazon")&&v7MarketAllowed("amazon"))getSnapshotAmazonRows(s).forEach(r=>raw.push({marketplace:"Amazon",marketKey:"amazon",date:s.reportDate,category:r.category,wfSku:r.wfSku,marketSku:r.azSku,identifier:r.asin,wfMrp:r.wfMrp,wfPrice:r.wfPrice,marketMrp:r.azMrp,listingPrice:r.listingPrice,livePrice:r.finalLivePrice,listingStatus:r.listingPriceException?"Approved Exception":(r.listingPriceDisparity?"Disparity":"Parity"),liveStatus:r.livePriceException?"Approved Exception":(r.livePriceDisparity?"Live Disparity":(r.liveMatchesListing?"Same as Listing":"Parity")),mrpStatus:r.mrpException?"Approved Exception":(r.mrpDisparity?"Disparity":"Parity")})); if((market==="all"||market==="flipkart")&&v7MarketAllowed("flipkart"))getSnapshotFlipkartRows(s).forEach(r=>raw.push({marketplace:"Flipkart",marketKey:"flipkart",date:s.reportDate,category:r.category,wfSku:r.wfSku,marketSku:r.fkSku,identifier:r.fsn,wfMrp:r.wfMrp,wfPrice:r.wfPrice,marketMrp:r.fkMrp,listingPrice:r.listingPrice,livePrice:r.finalLivePrice,listingStatus:r.listingPriceException?"Approved Exception":(r.listingPriceDisparity?"Disparity":"Parity"),liveStatus:r.livePriceException?"Approved Exception":(r.livePriceDisparity?"Live Disparity":(r.liveMatchesListing?"Same as Listing":"Parity")),mrpStatus:r.mrpException?"Approved Exception":(r.mrpDisparity?"Disparity":"Parity")})); });
  v7PopulateCategory("pricingHistoryCategory",raw); let rows=raw.filter(r=>(category==="all"||r.category===category)&&(!search||`${r.identifier} ${r.marketSku} ${r.wfSku}`.toLowerCase().includes(search)));
  if(view==="consolidated"){
    const groups=new Map(); rows.forEach(r=>{const k=`${r.marketKey}|${r.marketSku}|${r.identifier}|${r.wfSku}`; if(!groups.has(k))groups.set(k,{...r,firstDate:r.date,lastDate:r.date,dates:new Set(),changes:0,lastSignature:""}); const g=groups.get(k);g.dates.add(r.date);if(r.date<g.firstDate)g.firstDate=r.date;if(r.date>=g.lastDate){g.lastDate=r.date;Object.assign(g,r);} const sig=`${r.wfPrice}|${r.listingPrice}|${r.livePrice}|${r.marketMrp}`;if(g.lastSignature&&g.lastSignature!==sig)g.changes++;g.lastSignature=sig;}); rows=[...groups.values()].map(g=>({...g,days:g.dates.size}));
  }
  const sort=document.getElementById("pricingHistorySort")?.value||"date_desc"; rows.sort((a,b)=>sort==="identifier_asc"?String(a.identifier).localeCompare(String(b.identifier)):sort==="category_asc"?String(a.category).localeCompare(String(b.category)):String(b.date||b.lastDate).localeCompare(String(a.date||a.lastDate)));
  v7PricingHistoryRows=rows; renderPricingHistory(rows,type,view); finalSetText("pricingHistoryInfo",`${rows.length} rows · ${from} to ${to}`);
}
function renderPricingHistory(rows,type,view){ const table=document.getElementById("pricingHistoryTable"); if(!table)return; if(!rows.length){table.innerHTML='<tbody><tr><td class="empty-row">No pricing history available for the selected filters.</td></tr></tbody>';return;} let cols=view==="daily"?[["Date",r=>r.date]]:[["First Date",r=>r.firstDate],["Latest Date",r=>r.lastDate],["Observed Days",r=>r.days]]; cols.push(["Marketplace",r=>r.marketplace],["Category",r=>r.category],["WF SKU",r=>r.wfSku],["Marketplace SKU",r=>r.marketSku],["ASIN / FSN",r=>r.identifier]); if(["all","wf"].includes(type))cols.push(["WF Price",r=>formatINR(r.wfPrice)]); if(["all","listing"].includes(type))cols.push(["Listing Price",r=>formatINR(r.listingPrice)],["Listing Status",r=>r.listingStatus]); if(["all","live"].includes(type))cols.push(["Live Price",r=>Number(r.livePrice)>0?formatINR(r.livePrice):"—"],["Live Status",r=>r.liveStatus]); if(["all","mrp"].includes(type))cols.push(["WF MRP",r=>formatINR(r.wfMrp)],["Marketplace MRP",r=>formatINR(r.marketMrp)],["MRP Status",r=>r.mrpStatus]); if(view==="consolidated")cols.push(["Price Changes",r=>r.changes]); table.innerHTML='<thead><tr>'+cols.map(c=>`<th>${escapeHtml(c[0])}</th>`).join("")+'</tr></thead><tbody>'+rows.slice(0,2500).map(r=>'<tr>'+cols.map(c=>`<td>${escapeHtml(c[1](r))}</td>`).join("")+'</tr>').join("")+'</tbody>'; }
function downloadPricingHistory(){ if(!v7PricingHistoryRows.length){showWakeSuiteToast("No pricing history rows to download.","warning");return;} writeExcelReport(`WakeSuite_Pricing_History_${todayIso()}.xlsx`,{},v7PricingHistoryRows.map(r=>({Date:r.date||r.lastDate,Marketplace:r.marketplace,Category:r.category,"WF SKU":r.wfSku,"Marketplace SKU":r.marketSku,"ASIN / FSN":r.identifier,"WF Price":r.wfPrice,"Listing Price":r.listingPrice,"Live Price":r.livePrice,"WF MRP":r.wfMrp,"Marketplace MRP":r.marketMrp,"Listing Status":r.listingStatus,"Live Status":r.liveStatus,"MRP Status":r.mrpStatus,"Observed Days":r.days||1,"Price Changes":r.changes||0}))); }
window.openPricingHistory=openPricingHistory;window.loadPricingHistory=loadPricingHistory;window.downloadPricingHistory=downloadPricingHistory;

/* ---------- Inventory History + product-level OOS loss ---------- */
function v7SnapshotInventoryRows(snapshot,market){
  const key=market==="amazon"?"amazonInventoryRows":"flipkartInventoryRows"; let rows=snapshot?.[key]||[];
  if(!rows.length){ const base=market==="amazon"?getSnapshotAmazonRows(snapshot):getSnapshotFlipkartRows(snapshot); rows=base.map(r=>({marketplace:market,reportDate:snapshot.reportDate,category:r.category,wfSku:r.wfSku,marketSku:market==="amazon"?r.azSku:r.fkSku,identifier:market==="amazon"?r.asin:r.fsn,inventory:r.inventory,inventoryKnown:true,listingPrice:r.listingPrice,avgRevenuePerDay:null,revenueAvailable:false,legacyInStockOnly:true})); }
  return rows.filter(r=>v7MarketAllowed(market)&&v7CategoryAllowed(r.category));
}
function v7ProductInventoryDays(snapshots,market){
  const byDayProduct=new Map(); snapshots.forEach(s=>v7SnapshotInventoryRows(s,market).forEach(r=>{if(!r.identifier)return;const k=`${r.reportDate}|${r.identifier}`;if(!byDayProduct.has(k))byDayProduct.set(k,{marketplace:market,reportDate:r.reportDate,category:r.category,identifier:r.identifier,wfSkus:new Set(),marketSkus:new Set(),rows:[]});const g=byDayProduct.get(k);g.rows.push(r);g.wfSkus.add(r.wfSku);g.marketSkus.add(r.marketSku);}));
  return [...byDayProduct.values()].map(g=>{const anyStock=g.rows.some(r=>r.inventoryKnown&&v7Num(r.inventory)>0);const allKnown=g.rows.length>0&&g.rows.every(r=>r.inventoryKnown);const status=anyStock?"In Stock":(allKnown?"OOS":"No Data");const totalInv=g.rows.filter(r=>r.inventoryKnown).reduce((a,r)=>a+v7Num(r.inventory),0);const rev=g.rows.find(r=>r.revenueAvailable&&r.avgRevenuePerDay!==null)?.avgRevenuePerDay;return {...g,wfSku:[...g.wfSkus].join(" | "),marketSku:[...g.marketSkus].join(" | "),inventory:allKnown||anyStock?totalInv:null,status,avgRevenuePerDay:rev??null,revenueAvailable:rev!==undefined&&rev!==null,oosLoss:status==="OOS"&&rev!==undefined&&rev!==null?Number(rev):null,legacy:g.rows.some(r=>r.legacyInStockOnly)};});
}
async function openInventoryHistory(){showView("inventoryHistorySection");v7Range("inventoryHistory");await loadInventoryHistory();}
async function loadInventoryHistory(){
  const [from,to]=v7Range("inventoryHistory"),market=document.getElementById("inventoryHistoryMarketplace")?.value||"all",category=document.getElementById("inventoryHistoryCategory")?.value||"all",view=document.getElementById("inventoryHistoryView")?.value||"consolidated",search=String(document.getElementById("inventoryHistorySearch")?.value||"").trim().toLowerCase(); const snaps=await v7LoadSnapshots(from,to); let daily=[]; if(market==="all"||market==="amazon")daily.push(...v7ProductInventoryDays(snaps,"amazon")); if(market==="all"||market==="flipkart")daily.push(...v7ProductInventoryDays(snaps,"flipkart")); v7PopulateCategory("inventoryHistoryCategory",daily); daily=daily.filter(r=>(category==="all"||r.category===category)&&(!search||`${r.identifier} ${r.marketSku} ${r.wfSku}`.toLowerCase().includes(search)));
  let rows=daily;
  if(view==="consolidated"){
    const groups=new Map(); daily.forEach(r=>{const k=`${r.marketplace}|${r.identifier}`;if(!groups.has(k))groups.set(k,{marketplace:r.marketplace,category:r.category,identifier:r.identifier,wfSkus:new Set(),marketSkus:new Set(),dates:[],oosDays:0,inStockDays:0,noDataDays:0,periodLoss:0,lossDaysAvailable:0,opening:null,latest:null,min:null,max:null,latestDate:"",avgRevenuePerDay:null,legacy:false});const g=groups.get(k);r.wfSku.split(" | ").forEach(x=>g.wfSkus.add(x));r.marketSku.split(" | ").forEach(x=>g.marketSkus.add(x));g.dates.push(r.reportDate);if(r.status==="OOS"){g.oosDays++;if(r.oosLoss!==null){g.periodLoss+=r.oosLoss;g.lossDaysAvailable++;}}else if(r.status==="In Stock")g.inStockDays++;else g.noDataDays++;if(r.inventory!==null){if(g.opening===null||r.reportDate<g.openingDate){g.opening=r.inventory;g.openingDate=r.reportDate;}if(g.latest===null||r.reportDate>=g.latestDate){g.latest=r.inventory;g.latestDate=r.reportDate;}g.min=g.min===null?r.inventory:Math.min(g.min,r.inventory);g.max=g.max===null?r.inventory:Math.max(g.max,r.inventory);}if(r.avgRevenuePerDay!==null)g.avgRevenuePerDay=r.avgRevenuePerDay;g.legacy=g.legacy||r.legacy;}); rows=[...groups.values()].map(g=>({...g,wfSku:[...g.wfSkus].join(" | "),marketSku:[...g.marketSkus].join(" | "),observedDays:g.dates.length,lossAvailable:g.oosDays===0||g.lossDaysAvailable===g.oosDays}));
  }
  const sort=document.getElementById("inventoryHistorySort")?.value||"loss_desc"; rows.sort((a,b)=>sort==="oos_desc"?v7Num(b.oosDays)-v7Num(a.oosDays):sort==="inventory_asc"?v7Num(a.latest??a.inventory)-v7Num(b.latest??b.inventory):sort==="identifier_asc"?String(a.identifier).localeCompare(String(b.identifier)):v7Num(b.periodLoss??b.oosLoss)-v7Num(a.periodLoss??a.oosLoss)); v7InventoryHistoryRows=rows; renderInventoryHistory(rows,view); const oosProducts=new Set(daily.filter(r=>r.status==="OOS").map(r=>`${r.marketplace}|${r.identifier}`)).size;const oosDays=daily.filter(r=>r.status==="OOS").length;const loss=daily.reduce((a,r)=>a+v7Num(r.oosLoss),0);document.getElementById("inventoryHistoryKpis").innerHTML=`<div class="v7-kpi"><span>OOS Products</span><strong>${oosProducts}</strong></div><div class="v7-kpi"><span>OOS Product Days</span><strong>${oosDays}</strong></div><div class="v7-kpi"><span>Potential OOS Revenue Loss</span><strong>${formatINR(loss)}</strong></div><div class="v7-kpi"><span>Observed Days</span><strong>${snaps.length}</strong></div>`; finalSetText("inventoryHistoryInfo",`${rows.length} rows · OOS calculated once per ASIN / FSN. Missing inventory snapshots are never assumed OOS.`);
}
function renderInventoryHistory(rows,view){ const table=document.getElementById("inventoryHistoryTable");if(!table)return;if(!rows.length){table.innerHTML='<tbody><tr><td class="empty-row">No inventory history available.</td></tr></tbody>';return;} const cols=view==="daily"?[["Date",r=>r.reportDate],["Marketplace",r=>r.marketplace==="amazon"?"Amazon":"Flipkart"],["Category",r=>r.category],["WF SKU",r=>r.wfSku],["Marketplace SKU(s)",r=>r.marketSku],["ASIN / FSN",r=>r.identifier],["Inventory",r=>r.inventory===null?"No Data":formatNumber(r.inventory)],["Status",r=>r.status],["Avg Rev / Day",r=>r.avgRevenuePerDay===null?"Revenue Data Refresh Required":formatINR(r.avgRevenuePerDay)],["Potential OOS Revenue Loss",r=>r.status!=="OOS"?formatINR(0):(r.oosLoss===null?"Revenue Data Refresh Required":formatINR(r.oosLoss))]]:[["Marketplace",r=>r.marketplace==="amazon"?"Amazon":"Flipkart"],["Category",r=>r.category],["WF SKU",r=>r.wfSku],["Marketplace SKU(s)",r=>r.marketSku],["ASIN / FSN",r=>r.identifier],["Opening Inventory",r=>r.opening===null?"No Data":formatNumber(r.opening)],["Lowest Inventory",r=>r.min===null?"No Data":formatNumber(r.min)],["Highest Inventory",r=>r.max===null?"No Data":formatNumber(r.max)],["Latest Inventory",r=>r.latest===null?"No Data":formatNumber(r.latest)],["OOS Days",r=>r.oosDays],["In-Stock Days",r=>r.inStockDays],["No Data Days",r=>r.noDataDays],["Avg Rev / Day",r=>r.avgRevenuePerDay===null?"Revenue Data Refresh Required":formatINR(r.avgRevenuePerDay)],["Potential OOS Revenue Loss",r=>r.lossAvailable?formatINR(r.periodLoss):"Revenue Data Refresh Required"]]; table.innerHTML='<thead><tr>'+cols.map(c=>`<th>${escapeHtml(c[0])}</th>`).join("")+'</tr></thead><tbody>'+rows.slice(0,2500).map(r=>'<tr>'+cols.map(c=>`<td>${escapeHtml(c[1](r))}</td>`).join("")+'</tr>').join("")+'</tbody>'; }
function downloadInventoryHistory(){if(!v7InventoryHistoryRows.length){showWakeSuiteToast("No inventory history rows to download.","warning");return;}writeExcelReport(`WakeSuite_Inventory_History_${todayIso()}.xlsx`,{},v7InventoryHistoryRows.map(r=>({Marketplace:r.marketplace==="amazon"?"Amazon":"Flipkart",Category:r.category,"WF SKU":r.wfSku,"Marketplace SKU(s)":r.marketSku,"ASIN / FSN":r.identifier,"OOS Days":r.oosDays??(r.status==="OOS"?1:0),"In-Stock Days":r.inStockDays??(r.status==="In Stock"?1:0),"Latest Inventory":r.latest??r.inventory,"Avg Rev / Day":r.avgRevenuePerDay??"Revenue Data Refresh Required","Potential OOS Revenue Loss":r.periodLoss??r.oosLoss??"Revenue Data Refresh Required"})));}
window.openInventoryHistory=openInventoryHistory;window.loadInventoryHistory=loadInventoryHistory;window.downloadInventoryHistory=downloadInventoryHistory;

/* ---------- Suppression Override ---------- */
function openSuppressionOverrideModal(asin,reportDate){ if(!v7OperationalControls.suppressionOverrideEnabled){showWakeSuiteToast("Suppression Override is disabled in Settings.","warning");return;}if(!v7HasAction("suppressionOverride")){showWakeSuiteToast("Suppression Override permission is required.","warning");return;}document.getElementById("suppressionOverrideAsin").value=asin;document.getElementById("suppressionOverrideDate").value=reportDate;document.getElementById("suppressionOverrideReason").value="";const modal=document.getElementById("suppressionOverrideModal");modal?.classList.add("open");modal?.setAttribute("aria-hidden","false");}
function closeSuppressionOverrideModal(){const modal=document.getElementById("suppressionOverrideModal");modal?.classList.remove("open");modal?.setAttribute("aria-hidden","true");}
async function saveCurrentSuppressionOverride(){const asin=document.getElementById("suppressionOverrideAsin")?.value,reportDate=document.getElementById("suppressionOverrideDate")?.value,reason=document.getElementById("suppressionOverrideReason")?.value?.trim();if(!reason){showWakeSuiteToast("Enter a reason for the override.","warning");return;}try{const category=currentHistoricalReport?.baseRows?.find(r=>r.asin===asin&&r.reportDate===reportDate)?.category||currentHistoricalReport?.rows?.find(r=>r.asin===asin)?.category||"Unmapped";await window.saveSuppressionOverride({asin,reportDate,reason,category});snapshotCache.delete(reportDate);closeSuppressionOverrideModal();showWakeSuiteToast(`${asin} overridden for ${reportDate}. Suppression impact for that day is now ₹0.`,"success");if(currentHistoricalViewKey==="amazon_suppression")await loadHistoricalModule();await loadDashboardOverview();}catch(error){showWakeSuiteToast(error.message,"error","Override failed");}}
window.openSuppressionOverrideModal=openSuppressionOverrideModal;window.closeSuppressionOverrideModal=closeSuppressionOverrideModal;window.saveCurrentSuppressionOverride=saveCurrentSuppressionOverride;
const v7BaseRenderHistoricalTable=renderHistoricalTable;
renderHistoricalTable=function(def,rows){ v7BaseRenderHistoricalTable(def,rows); if(def?.type!=="suppression"||currentHistoricalReport?.multiDay||!v7OperationalControls.suppressionOverrideEnabled||!v7HasAction("suppressionOverride"))return; const table=document.getElementById("reportModuleTable"); if(!table||!rows.length)return; const head=table.querySelector("thead tr"); if(head)head.insertAdjacentHTML("beforeend","<th>Action</th>"); const bodyRows=table.querySelectorAll("tbody tr");bodyRows.forEach((tr,i)=>{const row=rows[i];if(!row)return;tr.insertAdjacentHTML("beforeend",`<td class="v7-table-action"><button class="secondary-btn" onclick="openSuppressionOverrideModal('${escapeHtml(row.asin)}','${escapeHtml(row.reportDate)}')">Override</button></td>`);}); };

/* ---------- Operational Controls ---------- */
async function loadOperationalControls(){
  if(typeof window.loadOperationalControlsData==="function"){try{v7OperationalControls={...v7OperationalControls,...await window.loadOperationalControlsData()};}catch(error){console.warn(error);}}
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v??"";};
  set("suppressionOverrideEnabled",String(v7OperationalControls.suppressionOverrideEnabled!==false));
  set("amazonPocName",v7OperationalControls.amazonPoc?.name);
  set("amazonPocEmail",v7OperationalControls.amazonPoc?.email);
  set("amazonPocAdditional",v7OperationalControls.amazonPoc?.additional);
  set("flipkartPocName",v7OperationalControls.flipkartPoc?.name);
  set("flipkartPocEmail",v7OperationalControls.flipkartPoc?.email);
  set("flipkartPocAdditional",v7OperationalControls.flipkartPoc?.additional);
  set("internalMarketplaceRecipients",v7OperationalControls.internalMarketplaceRecipients);
  set("thresholdAccessories",v7OperationalControls.thresholds?.Accessories??1000);
  set("thresholdFurniture",v7OperationalControls.thresholds?.Furniture??2000);
  set("thresholdMattress",v7OperationalControls.thresholds?.Mattress??4000);
  set("amazonMinPriceCorrectionPct",v7OperationalControls.amazonMinPriceCorrectionPct??5);
  set("amazonMaxPriceCorrectionPct",v7OperationalControls.amazonMaxPriceCorrectionPct??5);
  const oc=document.getElementById("thresholdOfficeChairsAlways");if(oc)oc.checked=v7OperationalControls.thresholds?.OfficeChairsAlways!==false;
}
async function saveOperationalControls(){
  if(!v7HasAction("settings")){showWakeSuiteToast("Settings permission is required.","warning");return;}
  const data={
    suppressionOverrideEnabled:document.getElementById("suppressionOverrideEnabled")?.value==="true",
    thresholds:{Accessories:v7Num(document.getElementById("thresholdAccessories")?.value),Furniture:v7Num(document.getElementById("thresholdFurniture")?.value),Mattress:v7Num(document.getElementById("thresholdMattress")?.value),OfficeChairsAlways:!!document.getElementById("thresholdOfficeChairsAlways")?.checked},
    amazonPoc:{name:document.getElementById("amazonPocName")?.value?.trim()||"",email:document.getElementById("amazonPocEmail")?.value?.trim()||"",additional:document.getElementById("amazonPocAdditional")?.value?.trim()||""},
    flipkartPoc:{name:document.getElementById("flipkartPocName")?.value?.trim()||"",email:document.getElementById("flipkartPocEmail")?.value?.trim()||"",additional:document.getElementById("flipkartPocAdditional")?.value?.trim()||""},
    internalMarketplaceRecipients:document.getElementById("internalMarketplaceRecipients")?.value?.trim()||"",
    amazonMinPriceCorrectionPct:Number(document.getElementById("amazonMinPriceCorrectionPct")?.value||5),
    amazonMaxPriceCorrectionPct:Number(document.getElementById("amazonMaxPriceCorrectionPct")?.value||5)
  };
  try{await window.saveOperationalControlsData(data);v7OperationalControls=data;showWakeSuiteToast("Operational controls saved.","success");}catch(error){showWakeSuiteToast(error.message,"error");}
}
window.loadOperationalControls=loadOperationalControls;window.saveOperationalControls=saveOperationalControls;
function v7SuppressionPocRequired(row){const c=String(row.category||"").toLowerCase();const impact=v7Num(row.revenueImpactPerDay);if(c.includes("office")&&c.includes("chair"))return v7OperationalControls.thresholds?.OfficeChairsAlways!==false;if(c.includes("accessor"))return impact>v7Num(v7OperationalControls.thresholds?.Accessories??1000);if(c.includes("furniture"))return impact>v7Num(v7OperationalControls.thresholds?.Furniture??2000);if(c.includes("mattress"))return impact>v7Num(v7OperationalControls.thresholds?.Mattress??4000);return false;}

/* ---------- Suppression Management ---------- */
async function openSuppressionManagement(){if(!v7ModuleAllowed("suppressionManagement")){showWakeSuiteToast("You do not have access to Suppression Management.","warning");return;}showView("suppressionManagementSection");await loadSuppressionManagement();}
async function loadSuppressionManagement(){try{v7SuppressionCases=await window.loadSuppressionCases();v7PopulateCategory("suppressionManagementCategory",v7SuppressionCases);renderSuppressionManagement();}catch(error){showWakeSuiteToast(error.message,"error","Unable to load suppression cases");}}
function renderSuppressionManagement(){const table=document.getElementById("suppressionManagementTable"),kpis=document.getElementById("suppressionManagementKpis");if(!table||!kpis)return;const status=document.getElementById("suppressionManagementStatus")?.value||"all",category=document.getElementById("suppressionManagementCategory")?.value||"all",poc=document.getElementById("suppressionManagementPoc")?.value||"all",search=String(document.getElementById("suppressionManagementSearch")?.value||"").toLowerCase();let rows=v7SuppressionCases.filter(r=>v7CategoryAllowed(r.category)&&(status==="all"||r.status===status)&&(category==="all"||r.category===category)&&(!search||`${r.asin} ${r.caseId||""} ${r.owner||""}`.toLowerCase().includes(search))&&(poc==="all"||(poc==="required"&&r.pocEscalationStatus==="Required")||(poc==="escalated"&&r.pocEscalationStatus==="Escalated")||(poc==="needs_review"&&r.pocEscalationStatus==="Needs Review")||(poc==="not_required"&&r.pocEscalationStatus==="Not Required")));const open=rows.filter(r=>!["Reactivated","Closed"].includes(r.status)).length,react=rows.filter(r=>r.status==="Reactivated").length,required=rows.filter(r=>r.pocEscalationStatus==="Required").length,exposure=rows.filter(r=>!["Reactivated","Closed"].includes(r.status)).reduce((a,r)=>a+v7Num(r.revenueImpactPerDay),0);kpis.innerHTML=`<div class="v7-kpi"><span>Open Suppressions</span><strong>${open}</strong></div><div class="v7-kpi"><span>POC Escalation Required</span><strong>${required}</strong></div><div class="v7-kpi"><span>Reactivated</span><strong>${react}</strong></div><div class="v7-kpi"><span>Open Rev Exposure / Day</span><strong>${formatINR(exposure)}</strong></div>`;if(!rows.length){table.innerHTML='<tbody><tr><td class="empty-row">No suppression cases match the selected filters.</td></tr></tbody>';return;}const canManage=v7HasAction("manageSuppressions"),canEscalate=v7HasAction("pocEscalation");table.innerHTML='<thead><tr><th>Category</th><th>ASIN</th><th>First Detected</th><th>Last Detected</th><th>Rev Impact / Day</th><th>Case ID</th><th>Owner</th><th>Status</th><th>POA</th><th>QC Report</th><th>POC Escalation</th><th>Notes</th><th>Action</th></tr></thead><tbody>'+rows.map(r=>`<tr data-case-id="${escapeHtml(r.id)}"><td>${escapeHtml(r.category)}</td><td><strong>${escapeHtml(r.asin)}</strong></td><td>${escapeHtml(v7DateText(r.firstDetected))}</td><td>${escapeHtml(v7DateText(r.lastDetected))}</td><td>${r.revenueAvailable===false?"Revenue Data Refresh Required":escapeHtml(formatINR(v7Num(r.revenueImpactPerDay)))}</td><td><input class="v7-inline-edit" data-case-field="caseId" value="${escapeHtml(r.caseId||"")}" ${canManage?"":"disabled"}></td><td><input class="v7-inline-edit" data-case-field="owner" value="${escapeHtml(r.owner||"")}" ${canManage?"":"disabled"}></td><td><select data-case-field="status" ${canManage?"":"disabled"}>${["Detected","Under Review","Documents Pending","Case Raised","Awaiting Resolution","Reactivated","Closed"].map(x=>`<option ${r.status===x?"selected":""}>${x}</option>`).join("")}</select></td><td><select data-case-field="poaStatus" ${canManage?"":"disabled"}>${["Not Required","Required","Prepared","Submitted","Accepted","Rework Required"].map(x=>`<option ${r.poaStatus===x?"selected":""}>${x}</option>`).join("")}</select></td><td><select data-case-field="qcStatus" ${canManage?"":"disabled"}>${["Not Required","Required","Prepared","Submitted","Accepted","Rework Required"].map(x=>`<option ${r.qcStatus===x?"selected":""}>${x}</option>`).join("")}</select></td><td>${v7HtmlStatus(r.pocEscalationStatus||"Not Required")}${canEscalate&&r.pocEscalationStatus==="Required"?`<br><button class="secondary-btn" onclick="openDailyCommunications()">Open POC Queue</button>`:""}</td><td><input class="v7-inline-edit" data-case-field="notes" value="${escapeHtml(r.notes||"")}" ${canManage?"":"disabled"}></td><td>${canManage?`<button class="primary-btn" onclick="v7SaveSuppressionCase('${escapeHtml(r.id)}')">Save</button>`:"View only"}</td></tr>`).join("")+'</tbody>';}
async function v7SaveSuppressionCase(id){const tr=document.querySelector(`[data-case-id="${CSS.escape(id)}"]`);if(!tr)return;const patch={};tr.querySelectorAll("[data-case-field]").forEach(e=>patch[e.dataset.caseField]=e.value);await window.updateSuppressionCase(id,patch);showWakeSuiteToast("Suppression case updated.","success");loadSuppressionManagement();}
async function v7MarkCaseEscalated(id){if(!v7HasAction("pocEscalation")){return;}await window.updateSuppressionCase(id,{pocEscalationStatus:"Escalated"});showWakeSuiteToast("POC escalation marked as escalated.","success");loadSuppressionManagement();}
window.openSuppressionManagement=openSuppressionManagement;window.loadSuppressionManagement=loadSuppressionManagement;window.renderSuppressionManagement=renderSuppressionManagement;window.v7SaveSuppressionCase=v7SaveSuppressionCase;window.v7MarkCaseEscalated=v7MarkCaseEscalated;

/* ---------- Marketplace Insights export: no Summary sheet ---------- */
const v7BaseDownloadMarketplaceInsights=downloadMarketplaceInsights;
downloadMarketplaceInsights=function(){
  if(!v6InsightsState){loadMarketplaceInsights().then(downloadMarketplaceInsights);return;}
  const state=v6InsightsState,wb=XLSX.utils.book_new(); const append=market=>{const rows=v6InsightSheetRows(market,state);XLSX.utils.book_append_sheet(wb,rows.length?XLSX.utils.json_to_sheet(rows):XLSX.utils.aoa_to_sheet([["No data available for the selected marketplace / category / period / insight."]]),market==="amazon"?"Amazon":"Flipkart");}; if(state.marketplace==="combined"){append("amazon");append("flipkart");}else append(state.marketplace);XLSX.writeFile(wb,`WakeSuite_Marketplace_Insights_${state.fromDate}_to_${state.toDate}.xlsx`);
};

/* ---------- Communications ---------- */
function v7IssueKey(marketplace,type,id){return `${marketplace}|${type}|${id}`;}
function v7DedupIssueRows(rows,market,idKey,type){const m=new Map();rows.forEach(r=>{const id=r[idKey];if(!id)return;const k=v7IssueKey(market,type,id);const existing=m.get(k);if(!existing||v7Num(r.revenueImpactPerDay||r.liveDailyRevenueImpact||r.buyBoxRevenueImpactPerDay)>v7Num(existing.revenueImpactPerDay||existing.liveDailyRevenueImpact||existing.buyBoxRevenueImpactPerDay))m.set(k,{...r,issueKey:k,issueType:type,productId:id,marketplace:market});});return [...m.values()];}
function v7CommunicationIssues(snapshot){
  const azRows=getSnapshotAmazonRows(snapshot),fkRows=getSnapshotFlipkartRows(snapshot);
  const azLive=v7DedupIssueRows(azRows.filter(r=>r.livePriceDisparity),"amazon","asin","Live Price Disparity");
  const azSuppAll=v7DedupIssueRows(getSnapshotAmazonIssueRows(snapshot,"amazonSuppressions"),"amazon","asin","ASIN Suppression");
  const azSuppQualified=azSuppAll.filter(v7SuppressionPocRequired);
  const azBuy=v7DedupIssueRows(getSnapshotAmazonIssueRows(snapshot,"amazonBuyBox"),"amazon","asin","Buy Box Suppression");
  const fkLive=v7DedupIssueRows(fkRows.filter(r=>r.livePriceDisparity),"flipkart","fsn","Live Price Disparity");
  return {
    amazon:[...azLive,...azSuppQualified,...azBuy],
    amazonUnderlying:[...azLive,...azSuppAll,...azBuy],
    flipkart:fkLive,
    flipkartUnderlying:fkLive,
    internal:{
      amazonListing:azRows.filter(r=>r.listingPriceDisparity),amazonLive:azRows.filter(r=>r.livePriceDisparity),amazonMrp:azRows.filter(r=>r.mrpDisparity),
      amazonSupp:getSnapshotAmazonIssueRows(snapshot,"amazonSuppressions"),amazonBuy:getSnapshotAmazonIssueRows(snapshot,"amazonBuyBox"),
      flipkartListing:fkRows.filter(r=>r.listingPriceDisparity),flipkartLive:fkRows.filter(r=>r.livePriceDisparity),flipkartMrp:fkRows.filter(r=>r.mrpDisparity),flipkartBuy:fkRows.filter(r=>r.buyBoxStatus==="No Buy Box")
    }
  };
}
async function openDailyCommunications(){if(!v7ModuleAllowed("dailyCommunications")){showWakeSuiteToast("You do not have access to Daily Communications.","warning");return;}showView("dailyCommunicationsSection");const d=document.getElementById("communicationsDate");if(d&&!d.value)d.value=todayIso();await loadDailyCommunications();}
async function loadDailyCommunications(){
  const date=document.getElementById("communicationsDate")?.value||todayIso();
  try{
    await loadOperationalControls();
    const snapshot=await loadSnapshotCached(date),cards=document.getElementById("communicationsCards");
    if(!snapshot){cards.innerHTML='<div class="empty-row">No processed snapshot for this date.</div>';return;}
    const issues=v7CommunicationIssues(snapshot);
    const underlyingKeys=v7Unique([...(issues.amazonUnderlying||[]),...(issues.flipkartUnderlying||[])].map(r=>r.issueKey));
    if(snapshot?.sourceAvailability?.audit===true && typeof window.syncPocEscalationResolution==="function"){
      await window.syncPocEscalationResolution(underlyingKeys,date);
    }
    const existing=await window.loadPocEscalations(),logs=await window.loadCommunicationLog(date);
    const active=new Map((existing||[]).filter(x=>x.status!=="Resolved").map(x=>[x.issueKey,x]));
    const buildMarket=market=>{
      const candidates=issues[market]||[],underlying=issues[`${market}Underlying`]||candidates;
      return {current:underlying,newRows:candidates.filter(r=>!active.has(r.issueKey)),follow:underlying.filter(r=>active.has(r.issueKey))};
    };
    v7CommunicationsState={date,snapshot,issues,amazon:buildMarket("amazon"),flipkart:buildMarket("flipkart"),logs};
    renderDailyCommunications();
  }catch(error){showWakeSuiteToast(error.message,"error","Communications unavailable");}
}

function v7CommSent(type,market){return (v7CommunicationsState?.logs||[]).find(l=>l.communicationType===type&&l.marketplace===market&&l.status==="Sent");}
function renderDailyCommunications(){const state=v7CommunicationsState,cards=document.getElementById("communicationsCards"),history=document.getElementById("communicationsHistoryTable");if(!state||!cards)return;const canPoc=v7HasAction("pocEscalation")&&v7HasAction("email"),canEmail=v7HasAction("email");const card=(title,count,meta,action,disabled,sent)=>`<div class="communication-card"><h3>${escapeHtml(title)}</h3><div class="communication-count">${count}</div><div class="communication-meta">${escapeHtml(sent?`Sent ${sent.sentAtText||""} by ${sent.sentBy||""}`:meta)}</div><div class="communication-actions"><button class="primary-btn" onclick="${action}" ${disabled?"disabled":""}>${sent?"Resend":"Preview & Send"}</button></div></div>`;cards.innerHTML=card("Amazon POC Escalation",state.amazon.newRows.length,"New Amazon Live Disparities, threshold-qualified suppressions and Buy Box suppressions.","sendDailyCommunication('poc','amazon')",!canPoc||!state.amazon.newRows.length,v7CommSent("POC Escalation","amazon"))+card("Amazon POC Follow-Up",state.amazon.follow.length,"Previously escalated Amazon issues still unresolved.","sendDailyCommunication('followup','amazon')",!canPoc||!state.amazon.follow.length,v7CommSent("POC Follow-Up","amazon"))+card("Flipkart POC Escalation",state.flipkart.newRows.length,"All actionable Flipkart Live Price Disparities.","sendDailyCommunication('poc','flipkart')",!canPoc||!state.flipkart.newRows.length,v7CommSent("POC Escalation","flipkart"))+card("Flipkart POC Follow-Up",state.flipkart.follow.length,"Previously escalated Flipkart live disparity issues still unresolved.","sendDailyCommunication('followup','flipkart')",!canPoc||!state.flipkart.follow.length,v7CommSent("POC Follow-Up","flipkart"))+card("Daily Marketplace Report",Object.values(state.issues.internal).reduce((a,r)=>a+r.length,0),"Internal Amazon + Flipkart actionable report with detailed tabs and no Summary sheet.","sendDailyCommunication('internal','combined')",!canEmail,v7CommSent("Daily Marketplace Report","combined"));const logs=state.logs||[];finalSetText("communicationsHistoryCount",String(logs.length));if(history)history.innerHTML=logs.length?'<thead><tr><th>Type</th><th>Marketplace</th><th>Sent At</th><th>Sent By</th><th>Recipients</th><th>Status</th></tr></thead><tbody>'+logs.map(l=>`<tr><td>${escapeHtml(l.communicationType)}</td><td>${escapeHtml(l.marketplace)}</td><td>${escapeHtml(l.sentAtText||"")}</td><td>${escapeHtml(l.sentBy||"")}</td><td>${escapeHtml((l.recipients||[]).join(", "))}</td><td>${v7HtmlStatus(l.status)}</td></tr>`).join("")+'</tbody>':'<tbody><tr><td class="empty-row">No communications sent for this date.</td></tr></tbody>';}
function v7CommunicationWorkbook(kind,market,rows,state){const wb=XLSX.utils.book_new();const add=(name,data)=>{if(data?.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data),v7SafeSheetName(name));};const mapPoc=data=>data.map(r=>({Category:r.category,[market==="amazon"?"ASIN":"FSN"]:r.productId,"Issue Type":r.issueType,"WF SKU":r.wfSku||"","Marketplace SKU":market==="amazon"?(r.azSku||""):(r.fkSku||""),"WF Price":r.wfPrice||"","Marketplace Price":r.finalLivePrice||r.listingPrice||"","Rev Impact / Day":r.revenueImpactPerDay??r.liveDailyRevenueImpact??r.buyBoxRevenueImpactPerDay??0}));if(kind!=="internal"){const groups={};rows.forEach(r=>(groups[r.issueType]||(groups[r.issueType]=[])).push(r));Object.entries(groups).forEach(([t,d])=>add(t,mapPoc(d)));}else{const i=state.issues.internal;add("Amazon Listing Disparity",i.amazonListing.map(r=>({Category:r.category,"WF SKU":r.wfSku,"AZ SKU":r.azSku,ASIN:r.asin,"WF Price":r.wfPrice,"Amazon Listing Price":r.listingPrice,Diff:r.listingPriceDiff,"Rev Impact / Day":r.listingDailyRevenueImpact})));add("Amazon Live Disparity",i.amazonLive.map(r=>({Category:r.category,"WF SKU":r.wfSku,"AZ SKU":r.azSku,ASIN:r.asin,"WF Price":r.wfPrice,"Amazon Live Price":r.finalLivePrice,Diff:r.livePriceDiff,"Rev Impact / Day":r.liveDailyRevenueImpact})));add("Amazon MRP Disparity",i.amazonMrp.map(r=>({Category:r.category,"WF SKU":r.wfSku,"AZ SKU":r.azSku,ASIN:r.asin,"WF MRP":r.wfMrp,"Amazon MRP":r.azMrp,"MRP Diff":r.mrpDiff})));add("Amazon ASIN Suppression",i.amazonSupp.map(r=>({Category:r.category,ASIN:r.asin,"Rev Impact / Day":r.revenueAvailable===false?"Revenue Data Refresh Required":r.revenueImpactPerDay})));add("Amazon Buy Box",i.amazonBuy.map(r=>({Category:r.category,ASIN:r.asin,"WF SKU":r.wfSku,Price:r.listingPrice,"Rev Impact / Day":r.revenueAvailable===false?"Revenue Data Refresh Required":r.revenueImpactPerDay})));add("Flipkart Listing Disparity",i.flipkartListing.map(r=>({Category:r.category,"WF SKU":r.wfSku,"FK SKU":r.fkSku,FSN:r.fsn,"WF Price":r.wfPrice,"Flipkart Listing Price":r.listingPrice,Diff:r.listingPriceDiff,"Rev Impact / Day":r.listingDailyRevenueImpact})));add("Flipkart Live Disparity",i.flipkartLive.map(r=>({Category:r.category,"WF SKU":r.wfSku,"FK SKU":r.fkSku,FSN:r.fsn,"WF Price":r.wfPrice,"Flipkart Live Price":r.finalLivePrice,Diff:r.livePriceDiff,"Rev Impact / Day":r.liveDailyRevenueImpact})));add("Flipkart MRP Disparity",i.flipkartMrp.map(r=>({Category:r.category,"WF SKU":r.wfSku,"FK SKU":r.fkSku,FSN:r.fsn,"WF MRP":r.wfMrp,"Flipkart MRP":r.fkMrp,"MRP Diff":r.mrpDiff})));add("Flipkart Buy Box",i.flipkartBuy.map(r=>({Category:r.category,FSN:r.fsn,"FK SKU":r.fkSku,"WF SKU":r.wfSku,"Listing Price":r.listingPrice,"Rev Impact / Day":r.buyBoxRevenueImpactPerDay})));}if(!wb.SheetNames.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["No actionable issues"]]),"Data");return wb;}
async function v7SendGmail({to,cc=[],bcc=[],subject,html,workbook,filename}){const token=await v4GetGmailToken();const bytes=workbook?XLSX.write(workbook,{bookType:"xlsx",type:"array"}):null;const raw=v4BuildMimeMessage({to,cc,bcc,subject,html,attachmentName:filename,attachmentBytes:bytes});const response=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({raw})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.error?.message||`Gmail API error ${response.status}`);return data;}
async function sendDailyCommunication(kind,market){const state=v7CommunicationsState;if(!state)return;if(kind!=="internal"&&!v7HasAction("pocEscalation")){showWakeSuiteToast("POC Escalation permission is required.","warning");return;}if(!v7HasAction("email")){showWakeSuiteToast("Email permission is required.","warning");return;}let rows=[],to=[],subject="",type="",filename="";if(kind==="internal"){type="Daily Marketplace Report";to=v7SplitEmails(v7OperationalControls.internalMarketplaceRecipients);subject=`Daily Marketplace Report - ${state.date}`;filename=`WakeSuite_Daily_Marketplace_Report_${state.date}.xlsx`;}else{rows=kind==="poc"?state[market].newRows:state[market].follow;type=kind==="poc"?"POC Escalation":"POC Follow-Up";const cfg=market==="amazon"?v7OperationalControls.amazonPoc:v7OperationalControls.flipkartPoc;to=v7Unique([cfg?.email,...v7SplitEmails(cfg?.additional)]);subject=`${market==="amazon"?"Amazon":"Flipkart"} ${type} - ${state.date}`;filename=`WakeSuite_${market==="amazon"?"Amazon":"Flipkart"}_${type.replace(/\s+/g,"_")}_${state.date}.xlsx`;}if(!to.length){showWakeSuiteToast("Recipients are not configured in Settings → System → Operational Controls.","warning");return;}if(kind!=="internal"&&!rows.length){showWakeSuiteToast("No issues are ready for this communication.","info");return;}const workbook=v7CommunicationWorkbook(kind,market,rows,state);const html=`<div style="font-family:Arial,sans-serif;font-size:13px"><p>Hi,</p><p>Please find the ${escapeHtml(type)} for ${escapeHtml(state.date)}.</p>${kind!=="internal"?`<p><strong>${rows.length}</strong> actionable issue${rows.length===1?"":"s"} require attention.</p>`:"<p>The attached workbook contains the complete actionable marketplace report for the day.</p>"}<p>Regards,<br>WakeSuite</p></div>`;try{await v7SendGmail({to,subject,html,workbook,filename});if(kind!=="internal")await window.recordPocEscalations(rows,state.date);await window.saveCommunicationLog({reportDate:state.date,communicationType:type,marketplace:market,recipients:to,status:"Sent",issueCount:kind==="internal"?Object.values(state.issues.internal).reduce((a,r)=>a+r.length,0):rows.length});showWakeSuiteToast(`${type} sent successfully.`,"success");await loadDailyCommunications();}catch(error){showWakeSuiteToast(error.message,"error",`${type} failed`);}}
window.openDailyCommunications=openDailyCommunications;window.loadDailyCommunications=loadDailyCommunications;window.sendDailyCommunication=sendDailyCommunication;

/* History filter listeners */
["pricingHistoryPeriod","inventoryHistoryPeriod"].forEach(id=>document.addEventListener("change",e=>{if(e.target?.id===id){const prefix=id.startsWith("pricing")?"pricingHistory":"inventoryHistory";v7Range(prefix);}}));



/* ======================================================
   WAKESUITE V7.2 · PERSISTENT HYDRATION / SNAPSHOT-ONLY DATE LOAD
====================================================== */
async function v72LoadStoredSnapshotOnly(reportDate,{quiet=false}={}){
  if(!reportDate)return null;
  await restoreSessionForDate(reportDate);
  if(typeof window.getDailySnapshotMeta!=="function"||typeof window.loadDailySnapshot!=="function"){
    updateReadiness();
    return null;
  }
  const meta=await window.getDailySnapshotMeta(reportDate);
  if(meta?.status!=="completed"){
    updateReadiness();
    if(!quiet)setUploadStatus(`No completed stored snapshot exists for ${reportDate}. Upload or replace a source file to process this date.`,"");
    return null;
  }
  const snapshot=await window.loadDailySnapshot(reportDate);
  if(snapshot){
    snapshotCache.set(reportDate,snapshot);
    hydrateSnapshot(snapshot);
    finalSetText("latestCompletedDateDisplay",`As of ${reportDate}`);
    if(!quiet){
      setUploadStatus(`${reportDate} snapshot loaded from Firestore. No processing or snapshot write was run.`,"success");
      showWakeSuiteToast(`${reportDate} snapshot loaded.`,"success");
    }
  }
  updateReadiness();
  return snapshot;
}
window.v72LoadStoredSnapshotOnly=v72LoadStoredSnapshotOnly;

/* Existing Data Center date listeners used to call automatic processing.
   Capture the change first and treat date selection strictly as a read operation. */
document.getElementById("reportDate")?.addEventListener("change",async event=>{
  event.stopImmediatePropagation();
  const date=event.target.value;
  try{
    await v72LoadStoredSnapshotOnly(date);
  }catch(error){
    console.error("Stored snapshot load failed",error);
    setUploadStatus("Unable to load stored snapshot: "+error.message,"error");
    showWakeSuiteToast(error.message,"error","Snapshot load failed");
  }
},true);

window.initializeWakeSuiteHistory = async function(){
  const today=todayIso();
  let latest=null;
  try{
    latest=await window.getLatestCompletedSnapshot();
  }catch(error){
    console.warn("Historical data unavailable",error);
    showWakeSuiteToast("Stored WakeSuite data could not be loaded: "+error.message,"error","Data restore failed");
  }
  const latestDate=latest?.reportDate||today;
  const reportDate=document.getElementById("reportDate");
  if(reportDate)reportDate.value=latestDate;
  await restoreSessionForDate(latestDate);
  ["dashboardFromDate","dashboardToDate","reportFromDate","reportToDate","insightsFromDate","insightsToDate","marketplaceDataDate"].forEach(id=>{
    const input=document.getElementById(id); if(input)input.value=latestDate;
  });
  const dashboardDate=document.getElementById("dashboardDate"); if(dashboardDate)dashboardDate.value=latestDate;
  const reportAnchor=document.getElementById("reportAnchorDate"); if(reportAnchor)reportAnchor.value=latestDate;
  const insightsDate=document.getElementById("insightsDate"); if(insightsDate)insightsDate.value=latestDate;
  if(latest){
    snapshotCache.set(latestDate,latest);
    hydrateSnapshot(latest);
    finalSetText("latestCompletedDateDisplay",`As of ${latestDate}`);
    setUploadStatus(`${latestDate} restored from Firestore.`,"success");
  }else{
    setUploadStatus("No completed Firestore snapshot is available yet.","");
  }
  updateReadiness();
  /* Do NOT call maybeAutoProcessCurrentDate here. Refresh/login is read-only. */
  await loadDashboardOverview();
};

window.resetSession =
  resetSession;

updateReadiness();


/* ======================================================
   WAKESUITE V8 · OPERATIONAL UX + PRICING + DATA
====================================================== */
const V9_AMAZON_TEMPLATE_URL = "./assets/PriceAndQuantity.xlsm";
const V8_CATEGORY_OPTIONS = ["Mattress","Furniture","Accessories","Office Chairs"];
const V8_UPLOAD_TYPES = ["wakefit_daily_pricing","amazon_all_listings","amazon_fba_inventory","amazon_business_reports","marketplace_audit_report","flipkart_listing_file","flipkart_order_report","pricing_exceptions"];
const V8_DOWNLOAD_TYPES = ["pricing_exceptions_template","pricing_exceptions","amazon_pricing_update","flipkart_pricing_update","marketplace_data","pricing_history","inventory_history","suppression_management"];

/* ---------- responsive / sidebar ---------- */
function toggleSidebarCollapse(){
  const sidebar=document.getElementById("mainSidebar"); if(!sidebar)return;
  const next=!sidebar.classList.contains("collapsed"); sidebar.classList.toggle("collapsed",next); document.body.classList.toggle("sidebar-collapsed",next);
  try{localStorage.setItem("wakesuite.sidebar.collapsed",next?"1":"0");}catch(_e){}
}
window.toggleSidebarCollapse=toggleSidebarCollapse;
function v8InitSidebar(){try{const c=localStorage.getItem("wakesuite.sidebar.collapsed")==="1";document.getElementById("mainSidebar")?.classList.toggle("collapsed",c);document.body.classList.toggle("sidebar-collapsed",c);}catch(_e){}}

/* ---------- file remove ---------- */
function clearSelectedFile(id){const input=document.getElementById(id);if(input){input.value="";input.dispatchEvent(new Event("change",{bubbles:true}));}if(id==="file"){document.getElementById("fileInfo")?.classList.remove("show");setUploadStatus("File selection cleared.","");}}
window.clearSelectedFile=clearSelectedFile;
function v8WireFileClear(id,buttonId){const input=document.getElementById(id),btn=document.getElementById(buttonId);if(!input||!btn)return;const sync=()=>btn.hidden=!input.files?.length;input.addEventListener("change",sync);sync();}

/* ---------- Local raw-file cache for correction exports ---------- */
openWakeSuiteDb = function(){return new Promise((resolve,reject)=>{const request=indexedDB.open("WakeSuite_Local",2);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains("reports")){const store=db.createObjectStore("reports",{keyPath:"key"});store.createIndex("reportDate","reportDate",{unique:false});}if(!db.objectStoreNames.contains("report_versions")){const store=db.createObjectStore("report_versions",{keyPath:"versionId"});store.createIndex("reportDate","reportDate",{unique:false});store.createIndex("dateConfig","dateConfig",{unique:false});}if(!db.objectStoreNames.contains("raw_files")){const store=db.createObjectStore("raw_files",{keyPath:"versionId"});store.createIndex("dateConfig","dateConfig",{unique:false});}};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});};
async function v8PersistUploadVersion(reportDate,configId,file,record){if(!file)return;const db=await openWakeSuiteDb(),versionId=`${reportDate}::${configId}::${Date.now()}::${Math.random().toString(36).slice(2,7)}`,dateConfig=`${reportDate}::${configId}`;const bytes=await file.arrayBuffer();await new Promise((resolve,reject)=>{const tx=db.transaction(["report_versions","raw_files"],"readwrite");tx.objectStore("report_versions").put({versionId,dateConfig,reportDate,configId,fileName:file.name,fileSize:file.size,lastModified:file.lastModified,createdAt:Date.now(),rowCount:record?.parsedFile?.rowCount||0,status:"successful"});tx.objectStore("raw_files").put({versionId,dateConfig,reportDate,configId,fileName:file.name,mimeType:file.type||"",bytes});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});return versionId;}
async function v8GetLatestRawFile(reportDate,configId){const db=await openWakeSuiteDb(),dateConfig=`${reportDate}::${configId}`;return new Promise((resolve,reject)=>{const tx=db.transaction(["report_versions","raw_files"],"readonly"),idx=tx.objectStore("report_versions").index("dateConfig"),q=idx.getAll(dateConfig);q.onsuccess=()=>{const versions=(q.result||[]).filter(v=>v.status==="successful").sort((a,b)=>b.createdAt-a.createdAt);if(!versions.length){resolve(null);return;}const r=tx.objectStore("raw_files").get(versions[0].versionId);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);};q.onerror=()=>reject(q.error);});}
const v8BaseUploadData=uploadData;
uploadData=async function(){const reportDate=document.getElementById("reportDate")?.value;const menu=document.getElementById("menu")?.value,folder=document.getElementById("folder")?.value,file=document.getElementById("file")?.files?.[0];let config=null;try{config=getSelectedConfig(menu,folder);}catch(_e){}await v8BaseUploadData();if(reportDate&&config?.id&&file&&window.wakeSuiteSessionReports?.[config.id]?.reportDate===reportDate){try{const versionId=await v8PersistUploadVersion(reportDate,config.id,file,window.wakeSuiteSessionReports[config.id]);window.wakeSuiteSessionReports[config.id].versionId=versionId;showWakeSuiteToast("Upload cached locally for correction-file generation.","success");}catch(error){console.warn("Version persistence failed",error);}}};

/* ---------- Amazon min / max fields + corrected live classification ---------- */
buildAmazonListingMap=function(rows){const map=new Map();(rows||[]).forEach(row=>{const azSku=normalizeKey(getRowValue(row,"seller-sku"));if(!azSku)return;map.set(azSku,{azSku,asin:normalizeKey(getRowValue(row,"asin1")),status:String(getRowValue(row,"status")||"").trim().toLowerCase(),azPrice:parseMoney(getRowValue(row,"price")),azMrp:parseMoney(getRowValue(row,"maximum-retail-price")),minAllowedPrice:parseMoney(getRowValue(row,"minimum-seller-allowed-price")),maxAllowedPrice:parseMoney(getRowValue(row,"maximum-seller-allowed-price")),quantity:parseNumber(getRowValue(row,"quantity"))});});return map;};

const v8BaseCompactAmazonRow=compactAmazonRow, v8BaseExpandAmazonRow=expandAmazonRow;
compactAmazonRow=function(r){const a=v8BaseCompactAmazonRow(r);a.push(r.minAllowedPrice??null,r.maxAllowedPrice??null);return a;};
expandAmazonRow=function(a){const r=v8BaseExpandAmazonRow(a);r.minAllowedPrice=a.length>32?a[32]:null;r.maxAllowedPrice=a.length>33?a[33]:null;return r;};

function v8NormalizePriceStates(row,market){
  const out={...row};
  const wf=Number(out.wfPrice||0);
  const listing=Number(out.listingPrice||0);
  const live=Number(out.finalLivePrice||0);

  if(wf>0 && listing>0){
    out.listingPriceDisparity=Math.abs(listing-wf)>PRICE_THRESHOLD;
    out.listingPriceDiff=listing-wf;
    out.listingPriceAction=listing<wf-PRICE_THRESHOLD
      ? "Increase Price"
      : listing>wf+PRICE_THRESHOLD ? "Decrease Price" : "No Action";
  }

  if(market==="flipkart" && live>0){
    out.eligibleForComparison=true;
    out.buyBoxStatus="";
    out.buyBoxRevenueImpactPerDay=0;
  }

  out.liveMatchesListing=v7PricesSame(live,listing);
  if(out.eligibleForComparison && wf>0 && live>0){
    out.livePriceDisparity=Math.abs(live-wf)>PRICE_THRESHOLD;
    out.livePriceDiff=live-wf;
    out.livePriceAction=out.livePriceDisparity
      ? (live<wf-PRICE_THRESHOLD ? "Increase Price" : "Decrease Price")
      : "No Action";
  }else{
    out.livePriceDisparity=false;
  }

  return out;
}
const v8BaseGetSnapshotAmazonRows=getSnapshotAmazonRows;
getSnapshotAmazonRows=function(snapshot){return v8BaseGetSnapshotAmazonRows(snapshot).map(r=>v8NormalizePriceStates(r,"amazon"));};
const v8BaseGetSnapshotFlipkartRows=getSnapshotFlipkartRows;
getSnapshotFlipkartRows=function(snapshot){return v8BaseGetSnapshotFlipkartRows(snapshot).map(r=>v8NormalizePriceStates(r,"flipkart"));};

/* ---------- Dashboard -> Insights ---------- */
function openDashboardInsight(market,focus){showView("marketplaceInsightsSection");const m=document.getElementById("insightsMarketplace"),p=document.getElementById("insightsPeriod");if(m)m.value=market;if(p)p.value="last7";v6InsightFocus=focus;document.querySelectorAll("[data-insight-card]").forEach(card=>card.classList.toggle("active",card.dataset.insightCard===focus));const labels={parity:"Price Parity",price_disparity:"Price Disparity",amazon_suppression:"ASIN Suppression",amazon_buybox:"Buy Box Suppression",total_impact:"Total Rev Impact"};finalSetText("insightsActiveMode",labels[focus]||"All Insights");loadMarketplaceInsights();}
window.openDashboardInsight=openDashboardInsight;

/* ---------- Marketplace Insights list / chart ---------- */
let v8InsightsDisplayMode="list";
function setInsightsDisplayMode(mode){v8InsightsDisplayMode=mode==="chart"?"chart":"list";document.getElementById("insightsListView")?.style.setProperty("display",v8InsightsDisplayMode==="list"?"block":"none");document.getElementById("insightsChartGrid")?.style.setProperty("display",v8InsightsDisplayMode==="chart"?"grid":"none");document.querySelectorAll("[data-v8-insights-view]").forEach(b=>b.classList.toggle("active",b.dataset.v8InsightsView===v8InsightsDisplayMode));try{localStorage.setItem("wakesuite.insights.view",v8InsightsDisplayMode);}catch(_e){}}
window.setInsightsDisplayMode=setInsightsDisplayMode;
function v8RenderInsightsList(){if(!v6InsightsState)return;const state=v6InsightsState,daily=v6InsightDailySeries(state.snapshots,state.marketplace,state.category),table=document.getElementById("insightsDailySnapshotTable");if(!table)return;const focus=state.focus;let html='<thead><tr><th>Date</th><th>Price Parity</th><th>Price Disparity</th><th>Amazon Suppression</th><th>Amazon Buy Box</th><th>Total Rev Impact</th></tr></thead><tbody>';if(!daily.length)html+='<tr><td colspan="6" class="empty-row">No Data Available</td></tr>';daily.forEach(r=>{html+=`<tr><td>${escapeHtml(r.date||"")}</td><td>${formatNumber(r.parity||0)}</td><td>${formatNumber(r.priceDisparity||0)}</td><td>${formatNumber(r.amazonSuppression||0)}</td><td>${formatNumber(r.amazonBuyBox||0)}</td><td>${formatINR(Number(r.impact||0))}</td></tr>`;});html+='</tbody>';table.innerHTML=html;finalSetText("insightsListMeta",`${v6ReadableDate(state.fromDate)} → ${v6ReadableDate(state.toDate)}`);if(focus==="parity"){finalSetText("insightsParitySub",`${formatNumber(state.metrics.parityObservations)} parity observations · No revenue impact`);}}
const v8BaseLoadMarketplaceInsights=loadMarketplaceInsights;
loadMarketplaceInsights=async function(forceMarketplace=null){await v8BaseLoadMarketplaceInsights(forceMarketplace);document.querySelectorAll(".v8-retired-flipkart-buybox").forEach(el=>el.style.display="none");v8RenderInsightsList();setInsightsDisplayMode(v8InsightsDisplayMode);};

/* ---------- Marketplace Data atomic rows ---------- */
function v8SkuType(sku,category){const s=String(sku||"");if(/_cus/i.test(s)&&String(category||"").toLowerCase()==="mattress")return "Custom";if(!s)return "";if(!s.includes("_"))return "Main";return "Duplicate";}
function v8PresenceMaps(snapshot){const a=new Set(getSnapshotAmazonRows(snapshot).map(r=>r.wfSku).filter(Boolean)),f=new Set(getSnapshotFlipkartRows(snapshot).map(r=>r.wfSku).filter(Boolean));return {a,f};}
function v8PriceStatus(r){if(r.approvedException)return "Approved Exception";const parts=[];if(r.listingPriceDisparity)parts.push("Listing Disparity");if(r.livePriceDisparity)parts.push("Live Disparity");if(r.mrpDisparity)parts.push("MRP Disparity");return parts.length?parts.join(" | "):"Parity";}
v4MarketplaceDataAllRows=function(snapshot){const maps=v8PresenceMaps(snapshot),rows=[];getSnapshotAmazonRows(snapshot).forEach(r=>rows.push({Category:r.category,"WF SKU":r.wfSku,Marketplace:"Amazon","SKU Type":v8SkuType(r.azSku,r.category),"Marketplace SKU":r.azSku,"AZ SKU":r.azSku,ASIN:r.asin,"FK SKU":"",FSN:"","WF MRP":r.wfMrp,"WF Price":r.wfPrice,"Marketplace MRP":r.azMrp,"Listing Price":r.listingPrice,"Live Price":r.finalLivePrice,Inventory:r.inventory,Revenue:r.revenueAvailable===false?null:r.asinRevenue,"Price Status":v8PriceStatus(r),"Mapping Status":"Valid Mapping","Marketplace Presence":maps.f.has(r.wfSku)?"Both":"Amazon Only"}));getSnapshotFlipkartRows(snapshot).forEach(r=>rows.push({Category:r.category,"WF SKU":r.wfSku,Marketplace:"Flipkart","SKU Type":v8SkuType(r.fkSku,r.category),"Marketplace SKU":r.fkSku,"AZ SKU":"",ASIN:"","FK SKU":r.fkSku,FSN:r.fsn,"WF MRP":r.wfMrp,"WF Price":r.wfPrice,"Marketplace MRP":r.fkMrp,"Listing Price":r.listingPrice,"Live Price":r.finalLivePrice,Inventory:r.inventory,Revenue:r.revenueAvailable===false?null:(r.liveCalculatedRevenue||r.listingCalculatedRevenue||r.calculatedRevenue||0),"Price Status":v8PriceStatus(r),"Mapping Status":"Valid Mapping","Marketplace Presence":maps.a.has(r.wfSku)?"Both":"Flipkart Only"}));return rows;};
v4MarketplaceMappingRows=v4MarketplaceDataAllRows;
const v8BaseApplyMarketplaceDataFilters=v4ApplyMarketplaceDataFilters;
v4ApplyMarketplaceDataFilters=function(){if(!currentMarketplaceData)return[];const cat=document.getElementById("marketplaceDataCategory")?.value||"all",q=String(document.getElementById("marketplaceDataSearch")?.value||"").trim().toLowerCase(),sku=document.getElementById("marketplaceDataSkuType")?.value||"all",presence=document.getElementById("marketplaceDataPresence")?.value||"all",mapping=document.getElementById("marketplaceDataMappingStatus")?.value||"all",inv=document.getElementById("marketplaceDataInventoryStatus")?.value||"all",price=document.getElementById("marketplaceDataPriceStatus")?.value||"all",sort=document.getElementById("marketplaceDataSort")?.value||"revenue_desc";let rows=currentMarketplaceData.baseRows.filter(r=>{if(cat!=="all"&&String(r.Category)!==cat)return false;if(q&&!Object.values(r).some(v=>String(v??"").toLowerCase().includes(q)))return false;const st=String(r["SKU Type"]||"").toLowerCase();if(sku!=="all"&&sku!=="mapping_issues"&&st!==sku)return false;if(sku==="mapping_issues"&&r["Mapping Status"]!=="Mapping Conflict")return false;const p=String(r["Marketplace Presence"]||"");if(presence==="both"&&p!=="Both")return false;if(presence==="amazon_only"&&p!=="Amazon Only")return false;if(presence==="flipkart_only"&&p!=="Flipkart Only")return false;if(presence==="missing_amazon"&&!['Flipkart Only'].includes(p))return false;if(presence==="missing_flipkart"&&!['Amazon Only'].includes(p))return false;if(mapping==="valid"&&r["Mapping Status"]!=="Valid Mapping")return false;if(mapping==="conflict"&&r["Mapping Status"]!=="Mapping Conflict")return false;const iv=Number(r.Inventory);if(inv==="in_stock"&&!(iv>0))return false;if(inv==="oos"&&!(Number.isFinite(iv)&&iv<=0))return false;if(inv==="no_data"&&Number.isFinite(iv))return false;const ps=String(r["Price Status"]||"");if(price==="parity"&&ps!=="Parity")return false;if(price==="listing"&&!ps.includes("Listing"))return false;if(price==="live"&&!ps.includes("Live"))return false;if(price==="mrp"&&!ps.includes("MRP"))return false;if(price==="approved_exception"&&ps!=="Approved Exception")return false;if(price==="pricing_issue"&&r.Marketplace!=="Amazon")return false;return true;});const revenue=r=>Number(r.Revenue||0),pval=r=>Number(r["Listing Price"]||0);rows.sort((a,b)=>sort==="revenue_desc"?revenue(b)-revenue(a):sort==="revenue_asc"?revenue(a)-revenue(b):sort==="category_asc"?String(a.Category||"").localeCompare(String(b.Category||"")):sort==="wfsku_asc"?String(a["WF SKU"]||"").localeCompare(String(b["WF SKU"]||"")):sort==="price_desc"?pval(b)-pval(a):String(a.ASIN||a.FSN||"").localeCompare(String(b.ASIN||b.FSN||"")));currentMarketplaceData.rows=rows;return rows;};
function setMarketplaceQuickView(type){if(type==="amazon_only"||type==="flipkart_only"){const p=document.getElementById("marketplaceDataPresence");if(p)p.value=type;}if(type==="conflict"){const m=document.getElementById("marketplaceDataMappingStatus");if(m)m.value="conflict";}renderMarketplaceDataTable();}
window.setMarketplaceQuickView=setMarketplaceQuickView;
function v8ColumnInputs(){return [...document.querySelectorAll("#marketplaceDataColumns input[type=checkbox]")];}
function marketplaceColumnsSelectAll(){v8ColumnInputs().forEach(x=>x.checked=true);renderMarketplaceDataTable();}
function marketplaceColumnsClearAll(){v8ColumnInputs().forEach(x=>x.checked=false);renderMarketplaceDataTable();}
function v8ColumnPrefKey(){return `wakesuite.marketplace.columns.${window.currentWakeSuiteAccess?.uid||window.wakeSuiteFirebase?.auth?.currentUser?.uid||"local"}`;}
function marketplaceColumnsSetDefault(){const cols=v8ColumnInputs().filter(x=>x.checked).map(x=>x.value);try{localStorage.setItem(v8ColumnPrefKey(),JSON.stringify(cols));showWakeSuiteToast("Column selection saved as your default.","success");}catch(_e){}}
function marketplaceColumnsRestoreDefault(){try{const cols=JSON.parse(localStorage.getItem(v8ColumnPrefKey())||"[]");if(cols.length){v8ColumnInputs().forEach(x=>x.checked=cols.includes(x.value));}else{v8ColumnInputs().forEach(x=>x.checked=(currentMarketplaceData?.defaultColumns||[]).includes(x.value));}renderMarketplaceDataTable();}catch(_e){}}
Object.assign(window,{marketplaceColumnsSelectAll,marketplaceColumnsClearAll,marketplaceColumnsSetDefault,marketplaceColumnsRestoreDefault});
const v8BasePopulateMarketplaceDataColumns=v4PopulateMarketplaceDataColumns;
v4PopulateMarketplaceDataColumns=function(columns){v8BasePopulateMarketplaceDataColumns(columns);setTimeout(()=>marketplaceColumnsRestoreDefault(),0);};
["marketplaceDataPresence","marketplaceDataMappingStatus","marketplaceDataInventoryStatus","marketplaceDataPriceStatus"].forEach(id=>document.addEventListener("change",e=>{if(e.target?.id===id)renderMarketplaceDataTable();}));

/* ---------- Pricing exceptions: identifier-only ---------- */
function v8ExceptionColumns(){return [...document.querySelectorAll('[data-exception-column]:checked')].map(x=>x.dataset.exceptionColumn);}
function exceptionColumnsSelectAll(){document.querySelectorAll('[data-exception-column]').forEach(x=>x.checked=true)}
function exceptionColumnsClearAll(){document.querySelectorAll('[data-exception-column]').forEach(x=>x.checked=false)}
Object.assign(window,{exceptionColumnsSelectAll,exceptionColumnsClearAll});
downloadPricingExceptionsTemplate=function(){const cols=v8ExceptionColumns();if(!cols.length){showWakeSuiteToast("Select at least one identifier column.","warning");return;}const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([cols]),"Identifiers");XLSX.writeFile(wb,"WakeSuite_Exception_Identifiers.xlsx");};
uploadPricingExceptions=async function(){
  const file=document.getElementById("pricingExceptionsFile")?.files?.[0];
  const cols=v8ExceptionColumns();
  if(!file){showWakeSuiteToast("Choose an identifier file.","warning");return;}
  if(!cols.length){showWakeSuiteToast("Select the identifier columns present in the file.","warning");return;}

  try{
    const wb=XLSX.read(await file.arrayBuffer(),{type:"array"});
    const sheet=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(sheet,{defval:""});
    const selectedMarket=document.getElementById("exceptionMarketplace")?.value||"amazon";
    const category=document.getElementById("exceptionCategory")?.value||"all";
    const exceptionType=document.getElementById("exceptionType")?.value||"Pricing";
    const effectiveFrom=document.getElementById("exceptionEffectiveFrom")?.value||todayIso();
    const effectiveTo=document.getElementById("exceptionEffectiveTo")?.value||effectiveFrom;
    const remarks=String(document.getElementById("exceptionRemarks")?.value||"").trim();

    if(effectiveTo<effectiveFrom) throw new Error("Effective To cannot be before Effective From.");
    if(exceptionType==="Amazon Deal Tag" && selectedMarket==="flipkart") throw new Error("Amazon Deal Tag can only be used for Amazon.");
    if(exceptionType==="Flipkart Opt-In" && selectedMarket==="amazon") throw new Error("Flipkart Opt-In can only be used for Flipkart.");

    const normalized=[];
    const invalid=[];
    const findHeader=(raw,name)=>Object.keys(raw).find(k=>canonicalHeader(k)===canonicalHeader(name));

    rows.forEach((raw,index)=>{
      const values={};
      cols.forEach(c=>{
        const key=findHeader(raw,c);
        values[c]=normalizeKey(key?raw[key]:"");
      });

      if(!Object.values(values).some(Boolean)) return;

      const requestedMarkets=selectedMarket==="all"?["amazon","flipkart"]:[selectedMarket];
      let created=0;
      requestedMarkets.forEach(marketplace=>{
        const record={
          marketplace,
          category,
          exceptionType,
          effectiveFrom,
          effectiveTo,
          remarks,
          sourceColumns:[...cols],
          wfSku:values["WF SKU"]||"",
          azSku:marketplace==="amazon"?(values["AZ SKU"]||""):"",
          asin:marketplace==="amazon"?(values.ASIN||""):"",
          fkSku:marketplace==="flipkart"?(values["FK SKU"]||""):"",
          fsn:marketplace==="flipkart"?(values.FSN||""):""
        };

        const marketHasIdentifier=marketplace==="amazon"
          ? !!(record.wfSku||record.azSku||record.asin)
          : !!(record.wfSku||record.fkSku||record.fsn);
        if(!marketHasIdentifier) return;
        normalized.push(record);
        created++;
      });
      if(!created) invalid.push(index+2);
    });

    if(invalid.length){
      throw new Error(`Rows ${invalid.slice(0,12).join(", ")}${invalid.length>12?"…":""} do not contain an identifier valid for the selected marketplace.`);
    }
    if(!normalized.length){showWakeSuiteToast("No valid exception identifiers found.","warning");return;}
    if(typeof window.savePricingExceptions!=="function") throw new Error("Pricing Exception storage is not ready.");

    await window.savePricingExceptions(normalized);
    v7PricingExceptionsLoaded=false;
    await v7EnsurePricingExceptionsLoaded(true);
    await loadPricingExceptionsManager();
    showWakeSuiteToast(`${normalized.length} pricing exceptions applied.`,"success","Pricing Exceptions");
    clearSelectedFile("pricingExceptionsFile");
  }catch(error){
    showWakeSuiteToast(error.message,"error","Unable to apply exceptions");
  }
};

/* ---------- Amazon Pricing Issues ---------- */
function v8AmazonPricingRows(snapshot){return getSnapshotAmazonRows(snapshot).map(r=>{const min=Number(r.minAllowedPrice||0),max=Number(r.maxAllowedPrice||0),listing=Number(r.listingPrice||0),targetMrp=Number(r.wfMrp||r.azMrp||0);const minIssue=!(min>0)||min>=listing;const maxIssue=!(max>0)||max<listing||(targetMrp>0&&max>targetMrp);return {...r,minIssue,maxIssue,targetMaxSap:targetMrp,pricingIssue:minIssue||maxIssue};});}
async function loadAmazonPricingIssues(){const date=document.getElementById("amazonPricingIssuesDate")?.value||todayIso(),snapshot=await loadSnapshotCached(date);if(!snapshot){showWakeSuiteToast("No stored snapshot for the selected date.","warning");return;}let rows=v8AmazonPricingRows(snapshot);const cat=document.getElementById("amazonPricingIssuesCategory"),old=cat?.value||"all";populateCategorySelectFromRows(cat,rows,old);const category=cat?.value||"all",type=document.getElementById("amazonPricingIssuesType")?.value||"all",skuType=document.getElementById("amazonPricingIssuesSkuType")?.value||"all",q=String(document.getElementById("amazonPricingIssuesSearch")?.value||"").toLowerCase();rows=rows.filter(r=>(category==="all"||r.category===category)&&(!q||`${r.asin} ${r.azSku} ${r.wfSku}`.toLowerCase().includes(q))&&(skuType==="all"||v8SkuType(r.azSku,r.category).toLowerCase()===skuType)&&(type==="all"?r.pricingIssue:type==="min"?r.minIssue:r.maxIssue));window.v8CurrentAmazonPricingRows=rows;const t=document.getElementById("amazonPricingIssuesTable");let h='<thead><tr><th>Category</th><th>WF SKU</th><th>AZ SKU</th><th>ASIN</th><th>SKU Type</th><th>WF Price</th><th>Amazon Listing</th><th>Min Allowed</th><th>Max Allowed</th><th>Amazon MRP</th><th>WF MRP</th><th>Issues</th><th>Action</th></tr></thead><tbody>';if(!rows.length)h+='<tr><td colspan="13" class="empty-row">No Pricing Issues</td></tr>';rows.forEach(r=>{const issues=[];if(r.listingPriceDisparity)issues.push("Listing Price");if(r.mrpDisparity)issues.push("MRP");if(r.minIssue)issues.push("Minimum Price");if(r.maxIssue)issues.push("Maximum Price");h+=`<tr><td>${escapeHtml(r.category||"")}</td><td>${escapeHtml(r.wfSku||"")}</td><td>${escapeHtml(r.azSku||"")}</td><td>${escapeHtml(r.asin||"")}</td><td>${escapeHtml(v8SkuType(r.azSku,r.category))}</td><td>${formatINR(r.wfPrice)}</td><td>${formatINR(r.listingPrice)}</td><td>${r.minAllowedPrice?formatINR(r.minAllowedPrice):"Missing"}</td><td>${r.maxAllowedPrice?formatINR(r.maxAllowedPrice):"Missing"}</td><td>${formatINR(r.azMrp||r.wfMrp)}</td><td>${escapeHtml(issues.join(" | "))}</td></tr>`;});h+='</tbody>';t.innerHTML=h;document.getElementById("amazonPricingIssuesKpis").innerHTML=`<div class="v7-kpi"><span>Pricing Issue SKUs</span><strong>${formatNumber(rows.length)}</strong></div><div class="v7-kpi"><span>Min Issues</span><strong>${formatNumber(rows.filter(r=>r.minIssue).length)}</strong></div><div class="v7-kpi"><span>Max Issues</span><strong>${formatNumber(rows.filter(r=>r.maxIssue).length)}</strong></div>`;}
function openAmazonPricingIssues(){showView("amazonPricingIssuesSection");const d=document.getElementById("amazonPricingIssuesDate");if(d&&!d.value)d.value=document.getElementById("dashboardToDate")?.value||todayIso();loadAmazonPricingIssues();}
window.openAmazonPricingIssues=openAmazonPricingIssues;
let v9AmazonTemplateBuffer=null;
async function v9AmazonTemplateWorkbook(){
  if(!v9AmazonTemplateBuffer){
    const response=await fetch(V9_AMAZON_TEMPLATE_URL,{cache:"no-store"});
    if(!response.ok) throw new Error("Amazon Price & Quantity template could not be loaded from assets/PriceAndQuantity.xlsm.");
    v9AmazonTemplateBuffer=await response.arrayBuffer();
  }
  return XLSX.read(v9AmazonTemplateBuffer.slice(0),{type:"array",bookVBA:true,cellStyles:true});
}
function v8SetCell(sheet,addr,value){
  if(value===undefined||value===null||value==="") delete sheet[addr];
  else sheet[addr]={t:typeof value==="number"?"n":"s",v:value};
}
async function v8BuildAmazonWorkbook(rows,minPct,_maxPct,bulkMode=false,options={}){
  const wb=await v9AmazonTemplateWorkbook();
  const sheet=wb.Sheets.Template||wb.Sheets[wb.SheetNames.find(n=>n==="Template")];
  if(!sheet) throw new Error("Amazon Template sheet not found.");

  const labelRow=4, dataRow=7;
  const labels={};
  const range=XLSX.utils.decode_range(sheet["!ref"]||"A1:AH7");
  for(let c=range.s.c;c<=range.e.c;c++){
    const addr=XLSX.utils.encode_cell({r:labelRow-1,c});
    const label=String(sheet[addr]?.v||"").trim();
    if(label) labels[label]=c;
  }
  const required=[
    "SKU","Your Price INR (Sell on Amazon, IN)","Maximum Retail Price (Sell on Amazon, IN)",
    "Minimum Seller Allowed Price (Sell on Amazon, IN)","Maximum Seller Allowed Price (Sell on Amazon, IN)"
  ];
  const missing=required.filter(label=>labels[label]===undefined);
  if(missing.length) throw new Error(`Amazon Price & Quantity template is missing: ${missing.join(", ")}`);

  const source=rows||[];
  const minReduction=Math.max(0,Number(minPct||5))/100;
  const mode=options.mode||"auto";
  const type=options.updateType||"both";
  const set=(rowIndex,label,value)=>{
    const c=labels[label];
    const addr=XLSX.utils.encode_cell({r:rowIndex-1,c});
    v8SetCell(sheet,addr,value);
  };

  source.forEach((r,index)=>{
    const row=dataRow+index;
    const listing=Number(r.listingPrice||0);
    const wfPrice=Number(r.wfPrice||0);
    const targetMrp=Number(r.wfMrp||r.azMrp||0);
    const minTarget=Math.round((listing*(1-minReduction))*100)/100;
    const maxTarget=targetMrp;
    set(row,"SKU",r.azSku||"");

    if(mode==="price_mrp"){
      if((type==="price"||type==="both") && r.listingPriceDisparity) set(row,"Your Price INR (Sell on Amazon, IN)",wfPrice);
      if((type==="mrp"||type==="both") && r.mrpDisparity) set(row,"Maximum Retail Price (Sell on Amazon, IN)",targetMrp);
    }else if(mode==="min_max"){
      if(type==="min"||type==="both") set(row,"Minimum Seller Allowed Price (Sell on Amazon, IN)",minTarget);
      if(type==="max"||type==="both"){
        set(row,"Maximum Seller Allowed Price (Sell on Amazon, IN)",maxTarget);
        // Max SAP depends on the target MRP. Correct MRP in the same file when Amazon MRP is disparate.
        if(r.mrpDisparity) set(row,"Maximum Retail Price (Sell on Amazon, IN)",targetMrp);
      }
    }else{
      if(!bulkMode&&r.listingPriceDisparity) set(row,"Your Price INR (Sell on Amazon, IN)",wfPrice);
      if(!bulkMode&&r.mrpDisparity) set(row,"Maximum Retail Price (Sell on Amazon, IN)",targetMrp);
      if(bulkMode||r.minIssue) set(row,"Minimum Seller Allowed Price (Sell on Amazon, IN)",minTarget);
      if(bulkMode||r.maxIssue){set(row,"Maximum Seller Allowed Price (Sell on Amazon, IN)",maxTarget);if(r.mrpDisparity)set(row,"Maximum Retail Price (Sell on Amazon, IN)",targetMrp);}
    }
  });

  const endRow=Math.max(6,dataRow+source.length-1);
  sheet["!ref"]=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:endRow-1,c:range.e.c}});
  return wb;
}
async function downloadAmazonPricingCorrection(){
  if(!window.v8CurrentAmazonPricingRows?.length) await loadAmazonPricingIssues();
  const rows=(window.v8CurrentAmazonPricingRows||[]).filter(r=>r.pricingIssue||r.listingPriceDisparity||r.mrpDisparity);
  if(!rows.length){showWakeSuiteToast("No Amazon correction rows for the current filters.","warning");return;}
  const minPct=Number(document.getElementById("amazonBulkMinPct")?.value||5);
  const wb=await v8BuildAmazonWorkbook(rows,minPct,0,false);
  XLSX.writeFile(wb,`Amazon_Pricing_Corrections_${document.getElementById("amazonPricingIssuesDate")?.value||todayIso()}.xlsm`,{bookType:"xlsm",bookVBA:true});
}
async function downloadAmazonBulkMinMax(){
  const date=document.getElementById("amazonPricingIssuesDate")?.value||todayIso();
  const snapshot=await loadSnapshotCached(date);
  if(!snapshot)return;
  const scope=document.getElementById("amazonBulkScope")?.value||"issues";
  const minPct=Number(document.getElementById("amazonBulkMinPct")?.value||5);

  let rows=v8AmazonPricingRows(snapshot);
  if(scope==="issues")rows=rows.filter(r=>r.minIssue||r.maxIssue);
  else if(scope==="main")rows=rows.filter(r=>v8SkuType(r.azSku,r.category)==="Main");
  else if(scope==="duplicate")rows=rows.filter(r=>v8SkuType(r.azSku,r.category)==="Duplicate");
  else if(scope==="main_duplicate")rows=rows.filter(r=>["Main","Duplicate"].includes(v8SkuType(r.azSku,r.category)));
  if(!rows.length){showWakeSuiteToast("No eligible Amazon SKUs for the selected scope.","warning");return;}
  const wb=await v8BuildAmazonWorkbook(rows,minPct,0,true,{mode:"min_max",updateType:"both"});
  XLSX.writeFile(wb,`Amazon_Bulk_Min_Max_${date}.xlsm`,{bookType:"xlsm",bookVBA:true});
}
Object.assign(window,{loadAmazonPricingIssues,downloadAmazonPricingCorrection,downloadAmazonBulkMinMax});

/* ---------- Flipkart correction output from latest listing file ---------- */
async function downloadFlipkartPricingCorrection(reportDate=null){const date=reportDate||document.getElementById("dashboardToDate")?.value||todayIso(),raw=await v8GetLatestRawFile(date,"flipkart_listing_file");if(!raw){showWakeSuiteToast("The latest Flipkart Listing File for this date is not available in this browser. Re-upload that day's latest listing file once to generate the correction file.","warning");return;}const wb=XLSX.read(raw.bytes,{type:"array",cellDates:true}),sheet=wb.Sheets[wb.SheetNames[0]],data=XLSX.utils.sheet_to_json(sheet,{header:1,defval:"",raw:true});if(!data.length)return;const headers=data[0].map(x=>String(x).trim()),skuIdx=headers.findIndex(h=>h==="Seller SKU Id"),priceIdx=headers.findIndex(h=>h==="Your Selling Price"),mrpIdx=headers.findIndex(h=>h==="MRP");if([skuIdx,priceIdx,mrpIdx].some(i=>i<0))throw new Error("Latest Flipkart Listing File is missing Seller SKU Id / Your Selling Price / MRP.");const snapshot=await loadSnapshotCached(date),map=new Map(getSnapshotFlipkartRows(snapshot).map(r=>[String(r.fkSku),r]));let changed=0;for(let i=1;i<data.length;i++){const sku=String(data[i][skuIdx]||"").trim(),r=map.get(sku);if(!r)continue;if(r.listingPriceDisparity){data[i][priceIdx]=Number(r.wfPrice||0);changed++;}if(r.mrpDisparity){data[i][mrpIdx]=Number(r.wfMrp||0);changed++;}}if(!changed){showWakeSuiteToast("No Flipkart Listing Price or MRP corrections are required.","info");return;}const newSheet=XLSX.utils.aoa_to_sheet(data);Object.keys(sheet).filter(k=>k.startsWith('!')).forEach(k=>newSheet[k]=sheet[k]);wb.Sheets[wb.SheetNames[0]]=newSheet;XLSX.writeFile(wb,`Flipkart_Listing_Corrections_${date}.xlsx`);}
window.downloadFlipkartPricingCorrection=downloadFlipkartPricingCorrection;

/* ---------- Suppression management enhancements ---------- */
function openManualSuppressionModal(){if(!v7HasAction?.("raiseCaseId")){showWakeSuiteToast("Raise Case ID permission is required for manual suppression entry.","warning");return;}const m=document.getElementById("manualSuppressionModal");m?.classList.add("open");m?.setAttribute("aria-hidden","false");document.getElementById("manualSuppressionDate").value=todayIso();if(typeof window.loadSuppressionEligibleUsers==="function")window.loadSuppressionEligibleUsers().then(users=>{const s=document.getElementById("manualSuppressionAssignees");if(s)s.innerHTML=users.map(u=>`<option value="${escapeHtml(u.uid)}">${escapeHtml(u.name||u.email)}</option>`).join("");});}
function closeManualSuppressionModal(){const m=document.getElementById("manualSuppressionModal");m?.classList.remove("open");m?.setAttribute("aria-hidden","true");}
async function saveManualSuppression(){const asin=String(document.getElementById("manualSuppressionAsin")?.value||"").trim(),caseId=String(document.getElementById("manualSuppressionCaseId")?.value||"").trim(),date=document.getElementById("manualSuppressionDate")?.value,category=document.getElementById("manualSuppressionCategory")?.value,poa=document.getElementById("manualSuppressionPoa")?.value,qc=document.getElementById("manualSuppressionQc")?.value,notes=document.getElementById("manualSuppressionNotes")?.value||"",assignees=[...document.getElementById("manualSuppressionAssignees")?.selectedOptions||[]].map(o=>o.value);if(!asin||!caseId||!date){showWakeSuiteToast("ASIN, Case ID and Date are required.","warning");return;}try{await window.createManualSuppressionCase({asin,caseId,firstDetected:date,lastDetected:date,category,poaStatus:poa,qcStatus:qc,notes,assignees,source:"Manual",status:"Case Raised"});showWakeSuiteToast("Manual suppression case added.","success");closeManualSuppressionModal();loadSuppressionManagement();}catch(error){showWakeSuiteToast(error.message,"error","Unable to create manual case");}}
Object.assign(window,{openManualSuppressionModal,closeManualSuppressionModal,saveManualSuppression});
const v8BaseLoadSuppressionManagement=loadSuppressionManagement;
loadSuppressionManagement=async function(){await v8BaseLoadSuppressionManagement();};
function downloadSuppressionManagement(){const rows=window.v7SuppressionCases||window.currentSuppressionCases||[];if(!rows.length){showWakeSuiteToast("No suppression management rows to download.","warning");return;}const clean=rows.map(r=>({"Detected Date":r.firstDetected,Category:r.category,ASIN:r.asin,Source:r.source||"Audit","Rev Impact / Day":r.revenueImpactPerDay??"","Assigned Users":Array.isArray(r.assigneeNames)?r.assigneeNames.join(" | "):(r.owner||""),"Case ID":r.caseId||"",Status:r.status||"",POA:r.poaStatus||"",QC:r.qcStatus||"","POC Escalation":r.pocEscalationStatus||"","Last Updated":r.lastDetected||""}));writeExcelReport(`Suppression_Management_${todayIso()}.xlsx`,{},clean);}
window.downloadSuppressionManagement=downloadSuppressionManagement;

/* ---------- Potential OOS revenue loss label only; never total impact ---------- */
const v8BaseDownloadInventoryHistory=downloadInventoryHistory;
downloadInventoryHistory=function(){return v8BaseDownloadInventoryHistory();};

/* ---------- Operational controls min % ---------- */
const v8BaseLoadOperationalControls=loadOperationalControls;
loadOperationalControls=async function(){
  await v8BaseLoadOperationalControls();
  try{
    const minPct=Number(v7OperationalControls?.amazonMinPriceCorrectionPct||localStorage.getItem("wakesuite.amazon.minPct")||5);
    const maxPct=Number(v7OperationalControls?.amazonMaxPriceCorrectionPct||localStorage.getItem("wakesuite.amazon.maxPct")||5);
    const minSetting=document.getElementById("amazonMinPriceCorrectionPct");
    const maxSetting=document.getElementById("amazonMaxPriceCorrectionPct");
    const minBulk=document.getElementById("amazonBulkMinPct");
    const maxBulk=document.getElementById("amazonBulkMaxPct");
    if(minSetting)minSetting.value=minPct;
    if(maxSetting)maxSetting.value=maxPct;
    if(minBulk)minBulk.value=minPct;
    if(maxBulk)maxBulk.value=maxPct;
  }catch(_e){}
};
const v8BaseSaveOperationalControls=saveOperationalControls;
saveOperationalControls=async function(){
  try{
    const minPct=Number(document.getElementById("amazonMinPriceCorrectionPct")?.value||5);
    const maxPct=Number(document.getElementById("amazonMaxPriceCorrectionPct")?.value||5);
    localStorage.setItem("wakesuite.amazon.minPct",String(minPct));
    localStorage.setItem("wakesuite.amazon.maxPct",String(maxPct));
    const minBulk=document.getElementById("amazonBulkMinPct");
    const maxBulk=document.getElementById("amazonBulkMaxPct");
    if(minBulk)minBulk.value=minPct;
    if(maxBulk)maxBulk.value=maxPct;
  }catch(_e){}
  return v8BaseSaveOperationalControls();
};


/* ---------- V8 retire Flipkart Buy Box from communications ---------- */
v7CommunicationIssues=function(snapshot){
  const azRows=getSnapshotAmazonRows(snapshot),fkRows=getSnapshotFlipkartRows(snapshot);
  const azLive=v7DedupIssueRows(azRows.filter(r=>r.livePriceDisparity),"amazon","asin","Live Price Disparity");
  const azSuppAll=v7DedupIssueRows(getSnapshotAmazonIssueRows(snapshot,"amazonSuppressions"),"amazon","asin","ASIN Suppression");
  const azSuppQualified=azSuppAll.filter(v7SuppressionPocRequired);
  const azBuy=v7DedupIssueRows(getSnapshotAmazonIssueRows(snapshot,"amazonBuyBox"),"amazon","asin","Buy Box Suppression");
  const fkLive=v7DedupIssueRows(fkRows.filter(r=>r.livePriceDisparity),"flipkart","fsn","Live Price Disparity");
  return {amazon:[...azLive,...azSuppQualified,...azBuy],amazonUnderlying:[...azLive,...azSuppAll,...azBuy],flipkart:fkLive,flipkartUnderlying:fkLive,internal:{amazonListing:azRows.filter(r=>r.listingPriceDisparity),amazonLive:azRows.filter(r=>r.livePriceDisparity),amazonMrp:azRows.filter(r=>r.mrpDisparity),amazonSupp:getSnapshotAmazonIssueRows(snapshot,"amazonSuppressions"),amazonBuy:getSnapshotAmazonIssueRows(snapshot,"amazonBuyBox"),flipkartListing:fkRows.filter(r=>r.listingPriceDisparity),flipkartLive:fkRows.filter(r=>r.livePriceDisparity),flipkartMrp:fkRows.filter(r=>r.mrpDisparity),flipkartBuy:[]}};
};

/* ---------- V8 Data Center upload filtering ---------- */
const v8BasePopulateMenus=populateMenus;
populateMenus=function(){
  const allowed=typeof window.v8CanUploadType==="function"?uploadConfig.filter(x=>window.v8CanUploadType(x.id)):uploadConfig;
  const el=document.getElementById("menu"); if(!el)return;
  const menus=[...new Set(allowed.map(x=>x.menu).filter(Boolean))];
  el.innerHTML='<option value="">Select Menu</option>'+menus.map(m=>`<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
};
populateFolders=function(){
  const menu=document.getElementById("menu")?.value,el=document.getElementById("folder");if(!el)return;
  if(!menu){el.innerHTML='<option value="">Select Menu first</option>';return;}
  const rows=uploadConfig.filter(x=>x.menu===menu&&(typeof window.v8CanUploadType!=="function"||window.v8CanUploadType(x.id)));
  el.innerHTML='<option value="">Select Folder</option>'+rows.map(x=>`<option value="${escapeHtml(x.folder)}">${escapeHtml(x.folder)}</option>`).join('');
};

/* ---------- V8 Suppression Management full manipulation ---------- */
let v8SuppressionUsers=[];
loadSuppressionManagement=async function(){try{v7SuppressionCases=await window.loadSuppressionCases();try{v8SuppressionUsers=await window.loadSuppressionEligibleUsers();}catch(_e){v8SuppressionUsers=[];}v7PopulateCategory("suppressionManagementCategory",v7SuppressionCases);const owner=document.getElementById("suppressionManagementOwner");if(owner){const current=owner.value||"all";owner.innerHTML='<option value="all">All Assignees</option><option value="me">Assigned to Me</option><option value="my_team">My Team</option>'+v8SuppressionUsers.map(u=>`<option value="${escapeHtml(u.uid)}">${escapeHtml(u.name||u.email)}</option>`).join('');owner.value=[...owner.options].some(o=>o.value===current)?current:"all";}renderSuppressionManagement();}catch(error){showWakeSuiteToast(error.message,"error","Unable to load suppression cases");}};
function v8CaseOwners(r){const ids=Array.isArray(r.assignees)?r.assignees:[];return ids.map(id=>v8SuppressionUsers.find(u=>u.uid===id)).filter(Boolean);}
renderSuppressionManagement=function(){const table=document.getElementById("suppressionManagementTable"),kpis=document.getElementById("suppressionManagementKpis");if(!table||!kpis)return;const period=document.getElementById("suppressionManagementPeriod")?.value||"last7";const range=v4SetRangeControls("suppressionManagementPeriod","suppressionManagementFromDate","suppressionManagementToDate");const from=range[0],to=range[1];const status=document.getElementById("suppressionManagementStatus")?.value||"all",category=document.getElementById("suppressionManagementCategory")?.value||"all",poc=document.getElementById("suppressionManagementPoc")?.value||"all",source=document.getElementById("suppressionManagementSource")?.value||"all",owner=document.getElementById("suppressionManagementOwner")?.value||"all",poa=document.getElementById("suppressionManagementPoa")?.value||"all",qc=document.getElementById("suppressionManagementQc")?.value||"all",search=String(document.getElementById("suppressionManagementSearch")?.value||"").toLowerCase(),sort=document.getElementById("suppressionManagementSort")?.value||"latest",uid=window.wakeSuiteFirebase?.auth?.currentUser?.uid||"";let rows=v7SuppressionCases.filter(r=>{const d=String(r.lastDetected||r.firstDetected||"");if(d&&(d<from||d>to))return false;if(!v7CategoryAllowed(r.category))return false;if(status!=="all"&&r.status!==status)return false;if(category!=="all"&&r.category!==category)return false;if(source!=="all"&&(r.source||"Audit")!==source)return false;if(poa!=="all"&&r.poaStatus!==poa)return false;if(qc!=="all"&&r.qcStatus!==qc)return false;if(poc!=="all"&&!((poc==="required"&&r.pocEscalationStatus==="Required")||(poc==="escalated"&&r.pocEscalationStatus==="Escalated")||(poc==="needs_review"&&r.pocEscalationStatus==="Needs Review")||(poc==="not_required"&&r.pocEscalationStatus==="Not Required")))return false;const ids=Array.isArray(r.assignees)?r.assignees:[];if(owner==="me"&&!ids.includes(uid))return false;if(owner==="my_team"&&!r.teamAssigned)return false;if(owner!=="all"&&!['me','my_team'].includes(owner)&&!ids.includes(owner))return false;const names=v8CaseOwners(r).map(u=>u.name||u.email).join(' ');if(search&&!`${r.asin} ${r.wfSku||''} ${r.azSku||''} ${r.caseId||''} ${names}`.toLowerCase().includes(search))return false;return true;});rows.sort((a,b)=>sort==="impact_desc"?Number(b.revenueImpactPerDay||0)-Number(a.revenueImpactPerDay||0):sort==="asin"?String(a.asin).localeCompare(String(b.asin)):String(b.lastDetected||"").localeCompare(String(a.lastDetected||"")));const open=rows.filter(r=>!['Reactivated','Closed'].includes(r.status)).length,pending=rows.filter(r=>!r.caseId&&!['Reactivated','Closed'].includes(r.status)).length,required=rows.filter(r=>r.pocEscalationStatus==='Required').length,exposure=rows.filter(r=>!['Reactivated','Closed'].includes(r.status)).reduce((a,r)=>a+Number(r.revenueImpactPerDay||0),0);kpis.innerHTML=`<div class="v7-kpi"><span>Open Suppressions</span><strong>${open}</strong></div><div class="v7-kpi"><span>Pending Case IDs</span><strong>${pending}</strong></div><div class="v7-kpi"><span>POC Escalation Required</span><strong>${required}</strong></div><div class="v7-kpi"><span>Open Rev Exposure / Day</span><strong>${formatINR(exposure)}</strong></div>`;if(!rows.length){table.innerHTML='<tbody><tr><td class="empty-row">No suppression cases match the selected filters.</td></tr></tbody>';window.v8VisibleSuppressionCases=[];return;}window.v8VisibleSuppressionCases=rows;const canManage=v7HasAction("manageSuppressions"),canCase=v7HasAction("raiseCaseId"),canDocs=v7HasAction("managePoaQc"),canPoc=v7HasAction("pocEscalation");const ownerOptions=r=>v8SuppressionUsers.map(u=>`<option value="${escapeHtml(u.uid)}" ${(r.assignees||[]).includes(u.uid)?'selected':''}>${escapeHtml(u.name||u.email)}</option>`).join('');table.innerHTML='<thead><tr><th>Date</th><th>Category</th><th>ASIN</th><th>Source</th><th>Rev Impact / Day</th><th>Case ID</th><th>Assignee(s)</th><th>Status</th><th>POA</th><th>QC</th><th>POC Escalation</th><th>Notes</th><th>Action</th></tr></thead><tbody>'+rows.map(r=>`<tr data-case-id="${escapeHtml(r.id)}"><td>${escapeHtml(r.firstDetected||'')}</td><td>${escapeHtml(r.category||'')}</td><td><strong>${escapeHtml(r.asin||'')}</strong></td><td>${escapeHtml(r.source||'Audit')}</td><td>${r.revenueAvailable===false?'Revenue Data Refresh Required':formatINR(Number(r.revenueImpactPerDay||0))}</td><td><input class="v7-inline-edit" data-case-field="caseId" value="${escapeHtml(r.caseId||'')}" ${canCase?'':'disabled'}></td><td><select data-case-field="assignees" multiple size="3" ${canManage?'':'disabled'}>${ownerOptions(r)}</select></td><td><select data-case-field="status" ${canManage?'':'disabled'}>${['Detected','Under Review','Documents Pending','Case Raised','Awaiting Resolution','Reactivated','Closed'].map(x=>`<option ${r.status===x?'selected':''}>${x}</option>`).join('')}</select></td><td><select data-case-field="poaStatus" ${canDocs?'':'disabled'}>${['Not Required','Required','Prepared','Submitted','Accepted','Rework Required'].map(x=>`<option ${r.poaStatus===x?'selected':''}>${x}</option>`).join('')}</select></td><td><select data-case-field="qcStatus" ${canDocs?'':'disabled'}>${['Not Required','Required','Prepared','Submitted','Accepted','Rework Required'].map(x=>`<option ${r.qcStatus===x?'selected':''}>${x}</option>`).join('')}</select></td><td>${v7HtmlStatus(r.pocEscalationStatus||'Not Required')}${canPoc&&r.pocEscalationStatus==='Required'?'<br><button class="secondary-btn" onclick="openDailyCommunications()">Open POC Queue</button>':''}</td><td><input class="v7-inline-edit" data-case-field="notes" value="${escapeHtml(r.notes||'')}" ${canManage?'':'disabled'}></td><td>${(canManage||canCase||canDocs)?`<button class="primary-btn" onclick="v8SaveSuppressionCase('${escapeHtml(r.id)}')">Save</button>`:'View only'}</td></tr>`).join('')+'</tbody>';};
async function v8SaveSuppressionCase(id){const tr=document.querySelector(`tr[data-case-id="${CSS.escape(id)}"]`),patch={};if(!tr)return;tr.querySelectorAll('[data-case-field]').forEach(el=>{const k=el.dataset.caseField;if(k==='assignees')patch[k]=[...el.selectedOptions].map(o=>o.value);else patch[k]=el.value;});try{await window.updateSuppressionCase(id,patch);showWakeSuiteToast('Suppression case updated.','success');loadSuppressionManagement();}catch(error){showWakeSuiteToast(error.message,'error','Unable to update case');}}
window.v8SaveSuppressionCase=v8SaveSuppressionCase;
downloadSuppressionManagement=function(){const rows=window.v8VisibleSuppressionCases||[];if(!rows.length){showWakeSuiteToast('No suppression management rows to download.','warning');return;}const clean=rows.map(r=>({'Detected Date':r.firstDetected,Category:r.category,ASIN:r.asin,Source:r.source||'Audit','Rev Impact / Day':r.revenueImpactPerDay??'','Case ID':r.caseId||'','Assigned Users':v8CaseOwners(r).map(u=>u.name||u.email).join(' | '),Status:r.status||'',POA:r.poaStatus||'',QC:r.qcStatus||'','POC Escalation':r.pocEscalationStatus||'',Notes:r.notes||''}));writeExcelReport(`Suppression_Management_${todayIso()}.xlsx`,{},clean);};


/* ---------- V8 enrich Amazon min/max from the active All Listings source ---------- */
function v8SessionAmazonMinMax(){const report=window.wakeSuiteSessionReports?.amazon_all_listings,rows=report?.parsedFile?.rows||[],map=new Map();rows.forEach(raw=>{const sku=normalizeKey(getRowValue(raw,"seller-sku"));if(sku)map.set(sku,{minAllowedPrice:parseMoney(getRowValue(raw,"minimum-seller-allowed-price")),maxAllowedPrice:parseMoney(getRowValue(raw,"maximum-seller-allowed-price"))});});return map;}
const v8NormalizedGetAmazonRows=getSnapshotAmazonRows;
getSnapshotAmazonRows=function(snapshot){const map=v8SessionAmazonMinMax();return v8NormalizedGetAmazonRows(snapshot).map(r=>({...r,...(map.get(r.azSku)||{})}));};

/* ---------- V8 no-summary default Excel writer ---------- */
writeExcelReport=function(filename,_summary,rows){if(typeof XLSX==="undefined"){showWakeSuiteToast("Excel library not loaded.","error");return;}const wb=XLSX.utils.book_new(),sheet=(rows&&rows.length)?XLSX.utils.json_to_sheet(rows):XLSX.utils.aoa_to_sheet([["No data available"]]);XLSX.utils.book_append_sheet(wb,sheet,"Data");XLSX.writeFile(wb,filename);};

/* ---------- V8 Dashboard personal Case ID workload ---------- */
function openMyPendingCases(){showView("suppressionManagementSection");const owner=document.getElementById("suppressionManagementOwner"),status=document.getElementById("suppressionManagementStatus");if(owner)owner.value="me";if(status)status.value="all";loadSuppressionManagement().then(()=>{const rows=(window.v8VisibleSuppressionCases||[]).filter(r=>!r.caseId&&!['Reactivated','Closed'].includes(r.status));window.v8VisibleSuppressionCases=rows;renderSuppressionManagement();});}
window.openMyPendingCases=openMyPendingCases;
async function v8RefreshDashboardWorkload(){const card=document.getElementById("suppressionCaseWorkloadCard");if(!card||typeof window.loadPendingCaseIdWorkload!=="function")return;try{const w=await window.loadPendingCaseIdWorkload();card.style.display=w.total>0?"flex":"none";finalSetText("pendingCaseIdWorkload",`${formatNumber(w.total)} Pending Case ID${w.total===1?'':'s'}`);finalSetText("pendingCaseIdWorkloadMeta",`Assigned to me: ${w.mine} · My team: ${w.team}`);}catch(_e){card.style.display="none";}}
const v8BaseDashboardOverview=loadDashboardOverview;
loadDashboardOverview=async function(){const result=await v8BaseDashboardOverview();await v8RefreshDashboardWorkload();return result;};

/* ---------- V8 validate configured invite/approval scopes ---------- */
function v8ValidateAccessEditorSelection(key){const row=document.querySelector(`[data-v7-record-key="${CSS.escape(key)}"]`);if(!row)return false;const markets=row.querySelectorAll('[data-v7-market]:checked').length,cats=row.querySelectorAll('[data-v7-category]:checked').length,mods=row.querySelectorAll('[data-v7-module]:checked').length;if(!markets||!cats||!mods){showWakeSuiteToast("Select at least one Marketplace, one Category option and one Menu / Module before saving access.","warning");return false;}return true;}
const v8ConfiguredSaveInvite=v8SaveInviteAccess;v8SaveInviteAccess=async function(key){if(!v8ValidateAccessEditorSelection(key))return;return v8ConfiguredSaveInvite(key);};window.v8SaveInviteAccess=v8SaveInviteAccess;
const v8ConfiguredApprove=v8ApproveConfiguredAccess;v8ApproveConfiguredAccess=async function(key){if(!v8ValidateAccessEditorSelection(key))return;return v8ConfiguredApprove(key);};window.v8ApproveConfiguredAccess=v8ApproveConfiguredAccess;

/* ---------- init ---------- */
document.addEventListener("DOMContentLoaded",()=>{v8InitSidebar();v8WireFileClear("file","clearMainUploadFile");v8WireFileClear("pricingExceptionsFile","clearExceptionFile");try{v8InsightsDisplayMode=localStorage.getItem("wakesuite.insights.view")||"list";}catch(_e){}setInsightsDisplayMode(v8InsightsDisplayMode);document.querySelectorAll(".v8-retired-flipkart-buybox").forEach(el=>el.remove());const d=document.getElementById("amazonPricingIssuesDate");if(d&&!d.value)d.value=todayIso();});


/* ---------- V8 User Access editor: configure invited/pending before approval ---------- */
const V8_ACCESS_UPLOAD_LABELS={wakefit_daily_pricing:"Wakefit Daily Pricing",amazon_all_listings:"Amazon All Listings",amazon_fba_inventory:"Amazon FBA Inventory",amazon_business_reports:"Amazon Business Reports",marketplace_audit_report:"Shared Audit Report",flipkart_listing_file:"Flipkart Listing File",flipkart_order_report:"Flipkart Order Report",pricing_exceptions:"Pricing Exceptions"};
const V8_ACCESS_DOWNLOAD_LABELS={pricing_exceptions_template:"Pricing Exceptions Template",pricing_exceptions:"Current Pricing Exceptions",amazon_pricing_update:"Amazon Pricing Update",flipkart_pricing_update:"Flipkart Pricing Update",marketplace_data:"Marketplace Data",pricing_history:"Pricing History",inventory_history:"Inventory History",suppression_management:"Suppression Management"};
if(typeof V7_ACTION_KEYS!=="undefined"){["raiseCaseId","managePoaQc"].forEach(k=>{if(!V7_ACTION_KEYS.includes(k))V7_ACTION_KEYS.push(k);});if(typeof V7_ALL_MODULES!=="undefined"&&!V7_ALL_MODULES.includes("amazonPricingIssues"))V7_ALL_MODULES.push("amazonPricingIssues");}
const v8BaseAccessEditor=v7AccessEditor;
v7AccessEditor=function(record){const base=v8BaseAccessEditor(record),prefix=record.uid||record.email||record.id,scopes={...V7_DEFAULT_SCOPES,...(record.scopes||{})},uploads=Array.isArray(scopes.uploadTypes)?scopes.uploadTypes:[],downloads=Array.isArray(scopes.downloadTypes)?scopes.downloadTypes:[];return base.replace('</div></details>',`<fieldset class="v8-scope-fieldset" style="grid-column:1/-1"><legend>Data Center · Upload</legend><div class="v7-check-grid">${Object.entries(V8_ACCESS_UPLOAD_LABELS).map(([k,l])=>`<label><input type="checkbox" data-v8-upload-type="${k}" ${uploads.includes(k)?'checked':''}> ${escapeHtml(l)}</label>`).join('')}</div></fieldset><fieldset class="v8-scope-fieldset" style="grid-column:1/-1"><legend>Data Center · Download</legend><div class="v7-check-grid">${Object.entries(V8_ACCESS_DOWNLOAD_LABELS).map(([k,l])=>`<label><input type="checkbox" data-v8-download-type="${k}" ${downloads.includes(k)?'checked':''}> ${escapeHtml(l)}</label>`).join('')}</div></fieldset></div></details>`);};
const v8BaseReadAccessEditor=v7ReadAccessEditor;
v7ReadAccessEditor=function(key,role){const data=v8BaseReadAccessEditor(key,role),row=document.querySelector(`[data-v7-record-key="${CSS.escape(key)}"]`);data.scopes.uploadTypes=[...row?.querySelectorAll('[data-v8-upload-type]:checked')||[]].map(x=>x.dataset.v8UploadType);data.scopes.downloadTypes=[...row?.querySelectorAll('[data-v8-download-type]:checked')||[]].map(x=>x.dataset.v8DownloadType);return data;};
renderV7UserDirectory=function(){const container=document.getElementById("userAccessDirectory");if(!container)return;const search=String(document.getElementById("userAccessSearch")?.value||"").trim().toLowerCase(),status=document.getElementById("userAccessStatus")?.value||"all",roleFilter=document.getElementById("userAccessRoleFilter")?.value||"all";let rows=v7AccessRecords.filter(r=>(!search||`${r.email||""} ${r.name||""}`.toLowerCase().includes(search))&&(status==="all"||(status==="attention"?["pending","invited"].includes(r.status):r.status===status))&&(roleFilter==="all"||(r.role||"viewer")===roleFilter));if(!rows.length){container.innerHTML='<div class="empty-row">No users match the selected filters.</div>';return;}let html='<div class="table-wrap"><table class="v7-user-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Access Scope</th><th>Actions</th></tr></thead><tbody>';rows.forEach(r=>{const key=r.uid||r.email||r.id,role=r.role||"viewer";let actions='';if(r.status==="pending")actions=`<select id="v7-role-${escapeHtml(key)}">${v7RoleOptions(role==="viewer"?"analyst":role)}</select><button class="primary-btn" onclick="v8ApproveConfiguredAccess('${escapeHtml(key)}')">Approve</button><button class="secondary-btn" onclick="v7RejectAccess('${escapeHtml(key)}')">Reject</button>`;else if(r.status==="invited")actions=`<select class="v7-role-select" data-v7-role-for="${escapeHtml(key)}">${v7RoleOptions(role)}</select><button class="primary-btn" onclick="v8SaveInviteAccess('${escapeHtml(key)}')">Save Invite Access</button><button class="secondary-btn" onclick="v7CancelInvite('${escapeHtml(r.email||r.id)}')">Cancel Invite</button>`;else if(r.status==="rejected")actions=`<select id="v7-role-${escapeHtml(key)}">${v7RoleOptions(role)}</select><button class="primary-btn" onclick="v8ApproveConfiguredAccess('${escapeHtml(key)}')">Approve</button>`;else if(r.status==="disabled")actions=`<button class="primary-btn" onclick="v7EnableAccess('${escapeHtml(key)}')">Re-enable</button>`;else actions=`<select class="v7-role-select" data-v7-role-for="${escapeHtml(key)}">${v7RoleOptions(role)}</select><button class="primary-btn" onclick="v7SaveAccess('${escapeHtml(key)}')">Save Access</button>${role!=="super_admin"?`<button class="secondary-btn" onclick="disableWakeSuiteUser('${escapeHtml(key)}')">Disable</button>`:''}`;html+=`<tr data-v7-record-key="${escapeHtml(key)}"><td><strong>${escapeHtml(r.email||key)}</strong><br><small>${escapeHtml(r.name||"")}</small></td><td>${escapeHtml(role)}</td><td>${v7HtmlStatus(r.status)}</td><td>${v7AccessEditor(r)}</td><td><div class="v7-action-row">${actions}</div></td></tr>`;});html+='</tbody></table></div>';container.innerHTML=html;};window.renderV7UserDirectory=renderV7UserDirectory;
async function v8SaveInviteAccess(key){const record=v7AccessRecords.find(r=>(r.uid||r.email||r.id)===key),role=document.querySelector(`[data-v7-role-for="${CSS.escape(key)}"]`)?.value||record?.role||"viewer",data=v7ReadAccessEditor(key,role);await window.updateWakeSuiteInvite(record.email||key,role,data.permissions,data.scopes);showWakeSuiteToast("Invitation access updated.","success");loadUserAccessManagement();}
async function v8ApproveConfiguredAccess(key){const record=v7AccessRecords.find(r=>(r.uid||r.email||r.id)===key),role=document.getElementById(`v7-role-${key}`)?.value||record?.role||"analyst",data=v7ReadAccessEditor(key,role);await window.approveWakeSuiteAccessRequest(key,role,data.permissions,data.scopes);showWakeSuiteToast("Access approved with the selected scope.","success");loadUserAccessManagement();}
window.v8SaveInviteAccess=v8SaveInviteAccess;window.v8ApproveConfiguredAccess=v8ApproveConfiguredAccess;
inviteWakeSuiteUser=async function(){const email=v7NormalizeEmail(document.getElementById("inviteUserEmail")?.value);if(!v7IsOrgEmail(email)){showWakeSuiteToast(`Only ${V7_ORG_EMAIL_SUFFIX} organization emails can be added.`,"warning");return;}const role=document.getElementById("inviteUserRole")?.value||"viewer";const perms={...(V7_ROLE_PRESETS[role]||V7_ROLE_PRESETS.viewer),raiseCaseId:false,managePoaQc:false};const scopes={...V7_DEFAULT_SCOPES,marketplaces:[],categories:[],modules:[],scopeKeys:[],allData:false,uploadTypes:[],downloadTypes:[]};try{await window.inviteWakeSuiteAccess(email,role,perms,scopes);document.getElementById("inviteUserEmail").value="";showWakeSuiteToast(`${email} invited. Configure the Access Scope before they sign in.`,"success");loadUserAccessManagement();}catch(error){showWakeSuiteToast(error.message,"error","Unable to add user");}};

