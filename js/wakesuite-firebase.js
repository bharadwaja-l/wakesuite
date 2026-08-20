

import {
  initializeApp
}
from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged
}
from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocsFromServer,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where
}
from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


const firebaseConfig = {

  apiKey:
    "AIzaSyAwOkR3aemcexscDptHVnRjxSQx3XmjuV4",

  authDomain:
    "wakesuite-4daf9.firebaseapp.com",

  projectId:
    "wakesuite-4daf9",

  storageBucket:
    "wakesuite-4daf9.firebasestorage.app",

  messagingSenderId:
    "34563161502",

  appId:
    "1:34563161502:web:9f0e9bc1e2da2d423d2a8f",

  measurementId:
    "G-VH7V68BSKD"

};


const app =
  initializeApp(
    firebaseConfig
  );

const auth =
  getAuth(
    app
  );

/* Keep the Firebase login across normal page refreshes until the user explicitly logs out. */
await setPersistence(auth,browserLocalPersistence);

const db =
  getFirestore(
    app
  );

const provider =
  new GoogleAuthProvider();


/* LOGIN */

const loginOverlay =
  document.createElement(
    "div"
  );

loginOverlay.innerHTML =
`
<div style="
  background:white;
  width:380px;
  max-width:90%;
  padding:40px;
  border-radius:20px;
  box-shadow:0 20px 60px rgba(0,0,0,.15);
  text-align:center;
  font-family:Inter,Arial,sans-serif;
">

  <div style="
    font-size:34px;
    font-weight:700;
    color:#2563eb;
    margin-bottom:8px;
  ">
    WakeSuite
  </div>

  <div style="
    height:12px;
  "></div>

  <button
    id="firebaseGoogleLogin"
    style="
      width:100%;
      padding:14px;
      border:0;
      border-radius:10px;
      background:#2563eb;
      color:white;
      font-size:15px;
      font-weight:600;
      cursor:pointer;
    "
  >
    Sign in with Google
  </button>

</div>
`;

Object.assign(
  loginOverlay.style,
  {
    position:"fixed",
    inset:"0",
    background:"#f8fafc",
    display:"flex",
    alignItems:"center",
    justifyContent:"center",
    zIndex:"99999"
  }
);

document.body.appendChild(
  loginOverlay
);

document
.getElementById(
  "firebaseGoogleLogin"
)
.addEventListener(
  "click",
  async () => {

    try{

      await signInWithPopup(
        auth,
        provider
      );

    }
    catch(error){

      console.error(
        error
      );

      alert(
        "Google sign-in failed: " +
        error.message
      );

    }

  }
);


/* LOAD CONFIG FROM SERVER */

async function loadUploadConfigFromFirestore(){

  console.log(
    "Reading upload_config directly from Firestore server..."
  );

  const snapshot =
    await getDocsFromServer(
      collection(
        db,
        "upload_config"
      )
    );

  const configs = [];

  snapshot.forEach(
    documentSnapshot => {

      const data =
        documentSnapshot.data();

      configs.push({
        id:
          documentSnapshot.id,
        ...data,
        menu:
          String(
            data.menu || ""
          ).trim(),
        folder:
          String(
            data.folder || ""
          ).trim()
      });

    }
  );

  console.log(
    "LIVE Firestore upload_config:",
    configs
  );

  const wakefitConfig =
    configs.find(
      item =>
        item.id ===
        "wakefit_daily_pricing"
    );

  if(
    !wakefitConfig
  ){

    throw new Error(
      "wakefit_daily_pricing was not returned from Firestore."
    );

  }

  if(
    wakefitConfig.active !==
    true
  ){

    throw new Error(
      "wakefit_daily_pricing exists but active is not Boolean true."
    );

  }

  window.applyUploadConfig(
    configs
  );

}


/* ======================================================
   WAKESUITE V7.2 · REUSABLE MASTER PRICING CACHE
====================================================== */
const V72_MASTER_CACHE_CHUNK_SIZE=600;
function v72MasterCacheRows(marketplace){
  return marketplace==="amazon"?(window.masterPricingAmazon?.rows||[]):(window.masterPricingFlipkart?.rows||[]);
}
async function v72SaveMasterMarketCache(marketplace,rows,duplicateCount){
  if(!auth.currentUser)return;
  const metaRef=doc(db,"master_pricing_cache",marketplace);
  const chunksRef=collection(db,"master_pricing_cache",marketplace,"chunks");
  const old=await getDocsFromServer(chunksRef);
  for(const item of old.docs)await deleteDoc(item.ref);
  for(let i=0;i<rows.length;i+=V72_MASTER_CACHE_CHUNK_SIZE){
    const index=Math.floor(i/V72_MASTER_CACHE_CHUNK_SIZE);
    await setDoc(doc(db,"master_pricing_cache",marketplace,"chunks",String(index).padStart(4,"0")),{
      marketplace,index,rows:rows.slice(i,i+V72_MASTER_CACHE_CHUNK_SIZE)
    });
  }
  await setDoc(metaRef,{marketplace,rowCount:rows.length,duplicateCount:Number(duplicateCount||0),refreshedBy:auth.currentUser.email||"",refreshedAt:serverTimestamp(),schemaVersion:"v7.2"},{merge:true});
}
window.saveMasterPricingCache=async function(){
  const amazon=v72MasterCacheRows("amazon"),flipkart=v72MasterCacheRows("flipkart");
  if(!amazon.length||!flipkart.length)throw new Error("Both Amazon and Flipkart Master Pricing must be loaded before caching.");
  await v72SaveMasterMarketCache("amazon",amazon,window.masterPricingAmazon?.duplicateAzSkuCount||0);
  await v72SaveMasterMarketCache("flipkart",flipkart,window.masterPricingFlipkart?.duplicateFkSkuCount||0);
};
async function v72LoadMasterMarketCache(marketplace){
  const metaSnap=await getDoc(doc(db,"master_pricing_cache",marketplace));
  if(!metaSnap.exists())return null;
  const chunkSnap=await getDocsFromServer(collection(db,"master_pricing_cache",marketplace,"chunks"));
  const chunks=[];chunkSnap.forEach(d=>chunks.push(d.data()));chunks.sort((a,b)=>Number(a.index)-Number(b.index));
  const rows=chunks.flatMap(x=>Array.isArray(x.rows)?x.rows:[]);
  return {meta:metaSnap.data(),rows};
}
function v72HydrateAmazonMasterCache(cache){
  const rows=cache.rows||[],byAzSku=new Map(),byAsin=new Map(),categories=new Set();let duplicate=0;
  rows.forEach(record=>{if(!record?.azSku)return;if(byAzSku.has(record.azSku))duplicate++;byAzSku.set(record.azSku,record);if(record.asin){if(!byAsin.has(record.asin))byAsin.set(record.asin,[]);byAsin.get(record.asin).push(record);}if(record.category)categories.add(record.category);});
  window.masterPricingAmazon={loadedAt:new Date(),rows,byAzSku,byAsin,categories,duplicateAzSkuCount:Number(cache.meta?.duplicateCount??duplicate)};
  const metrics=document.getElementById("amazonMasterMetrics");if(metrics)metrics.style.display="grid";
  finalSetText("amazonMasterRowCount",rows.length.toLocaleString("en-IN"));finalSetText("amazonMasterSkuCount",byAzSku.size.toLocaleString("en-IN"));finalSetText("amazonMasterAsinCount",byAsin.size.toLocaleString("en-IN"));finalSetText("amazonMasterCategoryCount",categories.size.toLocaleString("en-IN"));
}
function v72HydrateFlipkartMasterCache(cache){
  const rows=cache.rows||[],byFkSku=new Map(),byFsn=new Map(),categories=new Set();let duplicate=0;
  rows.forEach(record=>{if(!record?.fkSku)return;if(byFkSku.has(record.fkSku))duplicate++;byFkSku.set(record.fkSku,record);if(record.fsn){if(!byFsn.has(record.fsn))byFsn.set(record.fsn,[]);byFsn.get(record.fsn).push(record);}if(record.category)categories.add(record.category);});
  window.masterPricingFlipkart={loadedAt:new Date(),rows,byFkSku,byFsn,categories,duplicateFkSkuCount:Number(cache.meta?.duplicateCount??duplicate)};
  const metrics=document.getElementById("flipkartMasterMetrics");if(metrics)metrics.style.display="grid";
  finalSetText("flipkartMasterRowCount",rows.length.toLocaleString("en-IN"));finalSetText("flipkartMasterSkuCount",byFkSku.size.toLocaleString("en-IN"));finalSetText("flipkartMasterFsnCount",byFsn.size.toLocaleString("en-IN"));finalSetText("flipkartMasterCategoryCount",categories.size.toLocaleString("en-IN"));
}
window.loadMasterPricingCache=async function(){
  try{
    const [amazon,flipkart]=await Promise.all([v72LoadMasterMarketCache("amazon"),v72LoadMasterMarketCache("flipkart")]);
    if(!amazon||!flipkart||!amazon.rows.length||!flipkart.rows.length)return false;
    v72HydrateAmazonMasterCache(amazon);v72HydrateFlipkartMasterCache(flipkart);
    const button=document.getElementById("masterPricingButton");if(button)button.textContent="Refresh Master Pricing";
    const refreshed=amazon.meta?.refreshedAt?.toDate?amazon.meta.refreshedAt.toDate():null;
    setMasterPricingStatus(`Master Pricing loaded automatically from WakeSuite cache${refreshed?` · refreshed ${refreshed.toLocaleString()}`:""}. Use Refresh Master Pricing only when the source sheet changes.`,"success");
    updateRunButtons();
    return true;
  }catch(error){
    if(String(error?.code||"").includes("permission-denied")){console.warn("Master Pricing cache is outside this user's access scope.");return false;}
    console.warn("Master Pricing cache unavailable",error);return false;
  }
};

/* ---------- Explicit Login / Logout controls ---------- */
function v72RenderAuthControls(user){
  const login=document.getElementById("wsLoginButton"),logout=document.getElementById("wsLogoutButton"),label=document.getElementById("wsAuthUser");
  if(login)login.hidden=!!user;if(logout)logout.hidden=!user;
  if(label){label.hidden=!user;label.textContent=user?.email||"";}
}
async function v72Login(){try{await signInWithPopup(auth,provider);}catch(error){showWakeSuiteToast(error.message,"error","Google sign-in failed");}}
async function v72Logout(){
  try{await signOut(auth);sheetsAccessToken=null;window.masterPricingAmazon=null;window.masterPricingFlipkart=null;showWakeSuiteToast("Signed out of WakeSuite.","success");}
  catch(error){showWakeSuiteToast(error.message,"error","Logout failed");}
}
document.getElementById("wsLoginButton")?.addEventListener("click",v72Login);
document.getElementById("wsLogoutButton")?.addEventListener("click",v72Logout);

/* AUTH STATE + USER ACCESS */

const ACCESS_PRESETS = {
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


function showAccessOverlay(
  title,
  message
){

  const overlay =
    document.getElementById(
      "accessPendingOverlay"
    );

  if(!overlay){
    return;
  }

  const titleElement =
    document.getElementById(
      "accessPendingTitle"
    );

  const messageElement =
    document.getElementById(
      "accessPendingMessage"
    );

  if(titleElement){
    titleElement.textContent =
      title;
  }

  if(messageElement){
    messageElement.textContent =
      message;
  }

  overlay.classList.add(
    "open"
  );
}


function hideAccessOverlay(){

  document.getElementById(
    "accessPendingOverlay"
  )
  ?.classList
  .remove(
    "open"
  );
}


async function getApprovedAccessDoc(
  user
){

  const ref =
    doc(
      db,
      "access_users",
      user.uid
    );

  const snapshot =
    await getDoc(
      ref
    );

  if(!snapshot.exists()){
    return null;
  }

  return {
    uid:user.uid,
    ...snapshot.data()
  };
}


async function consumeEmailInvite(
  user
){

  const email =
    String(
      user.email || ""
    )
    .trim()
    .toLowerCase();

  if(!email){
    return null;
  }

  const inviteRef =
    doc(
      db,
      "access_invites",
      email
    );

  let inviteSnapshot;

  try{

    inviteSnapshot =
      await getDoc(
        inviteRef
      );

  }
  catch(error){

    return null;
  }

  if(
    !inviteSnapshot.exists()
  ){
    return null;
  }

  const invite =
    inviteSnapshot.data();

  if(
    invite.status !==
    "approved"
    &&
    invite.status !==
    "invited"
  ){
    return null;
  }

  const role =
    invite.role
    ||
    "viewer";

  const access = {
    uid:
      user.uid,
    email,
    name:
      user.displayName || "",
    role,
    status:"approved",
    permissions:
      invite.permissions
      ||
      ACCESS_PRESETS[
        role
      ]
      ||
      ACCESS_PRESETS.viewer,
    approvedAt:
      serverTimestamp(),
    approvedBy:
      invite.invitedBy
      ||
      "invite"
  };

  await setDoc(
    doc(
      db,
      "access_users",
      user.uid
    ),
    access,
    {
      merge:true
    }
  );

  return {
    ...access,
    approvedAt:null
  };
}


/*
  One-time migration helper for the existing WakeSuite owner.

  While the old owner-only Firestore rules are still active,
  the already-authorized owner can read upload_config. If no
  access_users document exists, WakeSuite creates that user's
  Super Admin record automatically. After that, the dynamic
  Firestore rules supplied with V5 can be deployed safely.
*/
async function bootstrapLegacyOwner(
  user
){

  try{

    const configSnapshot =
      await getDocsFromServer(
        collection(
          db,
          "upload_config"
        )
      );

    if(
      configSnapshot.empty
    ){
      return null;
    }

    const access = {
      uid:
        user.uid,
      email:
        String(
          user.email || ""
        )
        .trim()
        .toLowerCase(),
      name:
        user.displayName || "",
      role:"super_admin",
      status:"approved",
      permissions:
        ACCESS_PRESETS.super_admin,
      approvedAt:
        serverTimestamp(),
      approvedBy:"legacy-owner-bootstrap"
    };

    await setDoc(
      doc(
        db,
        "access_users",
        user.uid
      ),
      access,
      {
        merge:true
      }
    );

    return {
      ...access,
      approvedAt:null
    };

  }
  catch(error){

    return null;
  }
}


async function ensureWakeSuiteAccess(
  user
){

  let access = null;

  try{

    access =
      await getApprovedAccessDoc(
        user
      );

  }
  catch(error){

    /*
      Under the pre-V5 owner-only rules, access_users may not
      exist yet. Continue to the legacy owner bootstrap.
    */
  }

  if(
    access
    &&
    access.status ===
    "approved"
  ){
    return access;
  }

  if(
    access
    &&
    (
      access.status ===
      "disabled"
      ||
      access.status ===
      "rejected"
    )
  ){

    showAccessOverlay(
      "Access Disabled",
      "Your WakeSuite access is not active. Contact a WakeSuite administrator."
    );

    return null;
  }

  const invited =
    await consumeEmailInvite(
      user
    );

  if(invited){
    return invited;
  }

  const bootstrapped =
    await bootstrapLegacyOwner(
      user
    );

  if(bootstrapped){
    return bootstrapped;
  }

  try{

    await setDoc(
      doc(
        db,
        "access_requests",
        user.uid
      ),
      {
        uid:
          user.uid,
        email:
          String(
            user.email || ""
          )
          .trim()
          .toLowerCase(),
        name:
          user.displayName || "",
        status:"pending",
        requestedAt:
          serverTimestamp()
      },
      {
        merge:true
      }
    );

  }
  catch(error){

    console.warn(
      "Unable to create access request",
      error
    );
  }

  showAccessOverlay(
    "Access Pending",
    "Your WakeSuite access request is waiting for administrator approval."
  );

  return null;
}


onAuthStateChanged(
  auth,
  async user => {

    if(user){

      v72RenderAuthControls(user);

      console.log(
        "WakeSuite user:",
        user.email
      );

      try{

        const access =
          await ensureWakeSuiteAccess(
            user
          );

        if(!access){

          loginOverlay.style.display =
            "none";

          return;
        }

        window.currentWakeSuiteAccess = {
          ...access,
          permissions:
            access.permissions
            ||
            ACCESS_PRESETS[
              access.role
            ]
            ||
            ACCESS_PRESETS.viewer
        };

        hideAccessOverlay();

        loginOverlay.style.display =
          "none";

        await loadUploadConfigFromFirestore();

        if(typeof window.loadMasterPricingCache === "function"){
          await window.loadMasterPricingCache();
        }

        if(
          typeof window.applyAccessPermissions ===
          "function"
        ){
          window.applyAccessPermissions();
        }

        if(
          typeof window.initializeWakeSuiteHistory ===
          "function"
        ){
          await window.initializeWakeSuiteHistory();
        }

      }
      catch(error){

        console.error(
          "WakeSuite startup error:",
          error
        );

        loginOverlay.style.display =
          "none";

        if(
          typeof window.showWakeSuiteToast ===
          "function"
        ){

          window.showWakeSuiteToast(
            "Unable to load WakeSuite.\n" +
            error.message,
            "error",
            "Startup error"
          );
        }

      }

    }
    else{

      v72RenderAuthControls(null);

      window.currentWakeSuiteAccess =
        null;

      hideAccessOverlay();

      loginOverlay.style.display =
        "flex";

    }

  }
);


/* ACCESS MANAGEMENT API */

function requireUserAdmin(){

  const access =
    window.currentWakeSuiteAccess;

  if(
    !access
    ?.permissions
    ?.userAdmin
  ){

    throw new Error(
      "User Administration permission is required."
    );
  }
}


window.loadWakeSuiteAccessDirectory =
async function(){

  requireUserAdmin();

  const [
    usersSnapshot,
    requestsSnapshot,
    invitesSnapshot
  ] =
    await Promise.all([
      getDocsFromServer(
        collection(
          db,
          "access_users"
        )
      ),
      getDocsFromServer(
        collection(
          db,
          "access_requests"
        )
      ),
      getDocsFromServer(
        collection(
          db,
          "access_invites"
        )
      )
    ]);

  const users = [];

  usersSnapshot.forEach(
    item => {

      const data =
        item.data();

      if(
        data.status !==
        "disabled"
      ){

        users.push({
          uid:item.id,
          ...data
        });
      }
    }
  );

  const requests = [];

  requestsSnapshot.forEach(
    item => {

      const data =
        item.data();

      if(
        data.status ===
        "pending"
      ){

        requests.push({
          uid:item.id,
          ...data
        });
      }
    }
  );

  users.sort(
    (a,b) =>
      String(
        a.email || ""
      )
      .localeCompare(
        String(
          b.email || ""
        )
      )
  );

  requests.sort(
    (a,b) =>
      String(
        a.email || ""
      )
      .localeCompare(
        String(
          b.email || ""
        )
      )
  );

  const approvedEmails =
    new Set(
      users
      .map(
        user =>
          String(
            user.email || ""
          )
          .toLowerCase()
      )
      .filter(Boolean)
    );

  const invites = [];

  invitesSnapshot.forEach(
    item => {

      const data =
        item.data();

      const email =
        String(
          data.email || item.id || ""
        )
        .toLowerCase();

      if(
        !approvedEmails.has(
          email
        )
        &&
        (
          data.status ===
          "approved"
          ||
          data.status ===
          "invited"
        )
      ){
        invites.push({
          id:item.id,
          ...data
        });
      }
    }
  );

  invites.sort(
    (a,b) =>
      String(
        a.email || ""
      )
      .localeCompare(
        String(
          b.email || ""
        )
      )
  );

  return {
    users,
    requests,
    invites
  };
};


window.inviteWakeSuiteAccess =
async function(
  email,
  role,
  permissions
){

  requireUserAdmin();

  const normalizedEmail =
    String(
      email || ""
    )
    .trim()
    .toLowerCase();

  if(!normalizedEmail){

    throw new Error(
      "Email is required."
    );
  }

  await setDoc(
    doc(
      db,
      "access_invites",
      normalizedEmail
    ),
    {
      email:
        normalizedEmail,
      role:
        role || "viewer",
      permissions:
        permissions
        ||
        ACCESS_PRESETS.viewer,
      status:"approved",
      invitedBy:
        auth.currentUser
        ?.email
        ||
        auth.currentUser
        ?.uid
        ||
        "",
      invitedAt:
        serverTimestamp()
    },
    {
      merge:true
    }
  );
};


window.approveWakeSuiteAccessRequest =
async function(
  uid,
  role,
  permissions
){

  requireUserAdmin();

  const requestRef =
    doc(
      db,
      "access_requests",
      uid
    );

  const requestSnapshot =
    await getDoc(
      requestRef
    );

  if(!requestSnapshot.exists()){

    throw new Error(
      "Access request was not found."
    );
  }

  const request =
    requestSnapshot.data();

  await setDoc(
    doc(
      db,
      "access_users",
      uid
    ),
    {
      uid,
      email:
        request.email || "",
      name:
        request.name || "",
      role:
        role || "viewer",
      permissions:
        permissions
        ||
        ACCESS_PRESETS.viewer,
      status:"approved",
      approvedBy:
        auth.currentUser
        ?.email
        ||
        auth.currentUser
        ?.uid
        ||
        "",
      approvedAt:
        serverTimestamp()
    },
    {
      merge:true
    }
  );

  await deleteDoc(
    requestRef
  );
};


window.rejectWakeSuiteAccessRequest =
async function(uid){

  requireUserAdmin();

  await setDoc(
    doc(
      db,
      "access_requests",
      uid
    ),
    {
      status:"rejected",
      reviewedBy:
        auth.currentUser
        ?.email
        ||
        auth.currentUser
        ?.uid
        ||
        "",
      reviewedAt:
        serverTimestamp()
    },
    {
      merge:true
    }
  );
};


window.saveWakeSuiteAccessUser =
async function(
  uid,
  role,
  permissions
){

  requireUserAdmin();

  await setDoc(
    doc(
      db,
      "access_users",
      uid
    ),
    {
      role:
        role || "viewer",
      permissions:
        permissions
        ||
        ACCESS_PRESETS.viewer,
      status:"approved",
      updatedBy:
        auth.currentUser
        ?.email
        ||
        auth.currentUser
        ?.uid
        ||
        "",
      updatedAt:
        serverTimestamp()
    },
    {
      merge:true
    }
  );
};


window.disableWakeSuiteAccessUser =
async function(uid){

  requireUserAdmin();

  if(
    uid ===
    auth.currentUser
    ?.uid
  ){

    throw new Error(
      "You cannot disable your own account."
    );
  }

  await setDoc(
    doc(
      db,
      "access_users",
      uid
    ),
    {
      status:"disabled",
      updatedBy:
        auth.currentUser
        ?.email
        ||
        auth.currentUser
        ?.uid
        ||
        "",
      updatedAt:
        serverTimestamp()
    },
    {
      merge:true
    }
  );
};


/* SAVE UPLOAD METADATA */

window.saveUploadMetadata =
async function(metadata){

  const user =
    auth.currentUser;

  if(!user){

    throw new Error(
      "You must be signed in to WakeSuite."
    );

  }

  if(
    !window.currentWakeSuiteAccess
    ?.permissions
    ?.upload
  ){

    throw new Error(
      "Your WakeSuite role does not allow report uploads."
    );
  }

  const documentReference =
    await addDoc(
      collection(
        db,
        "uploads"
      ),
      {
        ...metadata,
        userId:
          user.uid,
        userEmail:
          user.email || "",
        uploadedAt:
          serverTimestamp()
      }
    );

  return documentReference.id;

};




/* ======================================================
   HISTORICAL DAILY SNAPSHOTS
====================================================== */

function cleanForFirestore(value){
  return JSON.parse(JSON.stringify(value));
}


/*
  Keep every Firestore chunk comfortably below the
  1 MiB document ceiling.

  The byte limit is deliberately conservative because
  Firestore also stores field names and document metadata.
*/
function estimateJsonBytes(value){

  const json =
    JSON.stringify(value);

  try{

    return new TextEncoder()
      .encode(json)
      .length;

  }
  catch(error){

    return json.length;

  }

}


function chunkRows(
  rows,
  maxRows = 80,
  maxEstimatedBytes = 450000
){

  const chunks = [];

  let current = [];
  let currentBytes = 0;


  rows.forEach(
    row => {

      const cleaned =
        cleanForFirestore(row);

      /*
        Approximate the eventual r0000/r0001 map-key
        overhead as well.
      */
      const rowBytes =
        estimateJsonBytes(cleaned)
        +
        24;


      if(
        current.length > 0
        &&
        (
          current.length >= maxRows
          ||
          currentBytes + rowBytes >
          maxEstimatedBytes
        )
      ){

        chunks.push(
          current
        );

        current = [];

        currentBytes = 0;

      }


      current.push(
        cleaned
      );

      currentBytes +=
        rowBytes;

    }
  );


  if(
    current.length > 0
  ){

    chunks.push(
      current
    );

  }


  return chunks;

}


/*
  Firestore cannot store an array directly inside another
  array. Compact WakeSuite rows are arrays, so each row is
  stored as a field inside a map.
*/
function packChunkRows(rows){

  const packed = {};


  rows.forEach(
    (row,index) => {

      packed[
        "r" +
        String(index).padStart(4,"0")
      ] =
        cleanForFirestore(row);

    }
  );


  return packed;

}


function unpackChunkRows(packedRows){

  if(
    !packedRows
  ){
    return [];
  }


  if(
    Array.isArray(
      packedRows
    )
  ){

    return packedRows;

  }


  return Object.keys(
    packedRows
  )
  .sort()
  .map(
    key =>
      packedRows[key]
  );

}


/*
  IMPORTANT:
  Do not send hundreds of snapshot documents in one
  Firestore WriteBatch.

  Large atomic batches can exceed Firestore's request-size
  limit even when every individual document is valid.

  We deliberately issue independent writes/deletes with
  small controlled concurrency. This keeps each network
  request small while preserving the same total write count.
*/
async function commitBatchOps(
  ops,
  concurrency = 6
){

  if(
    !ops ||
    ops.length === 0
  ){
    return;
  }


  let cursor = 0;


  async function worker(){

    while(
      true
    ){

      const currentIndex =
        cursor++;


      if(
        currentIndex >=
        ops.length
      ){
        return;
      }


      const op =
        ops[
          currentIndex
        ];


      if(
        op.type ===
        "delete"
      ){

        await deleteDoc(
          op.ref
        );

      }
      else{

        await setDoc(
          op.ref,
          op.data
        );

      }

    }

  }


  const workerCount =
    Math.min(
      concurrency,
      ops.length
    );


  await Promise.all(
    Array.from(
      {
        length:
          workerCount
      },
      () =>
        worker()
    )
  );

}


window.getDailySnapshotMeta = async function(reportDate){
  const ref=doc(db,"daily_snapshots",reportDate);
  const snap=await getDoc(ref);
  return snap.exists() ? {id:snap.id,...snap.data()} : null;
};

window.saveDailySnapshot = async function(reportDate,snapshot){
  if(
    !window.currentWakeSuiteAccess
    ?.permissions
    ?.upload
  ){
    throw new Error(
      "Your WakeSuite role does not allow processed snapshot writes."
    );
  }


  const user=auth.currentUser;
  if(!user) throw new Error("You must be signed in to WakeSuite.");

  const metaRef=doc(db,"daily_snapshots",reportDate);
  const existing=await getDoc(metaRef);
  const previous=existing.exists()?existing.data():null;

  /*
    If the previous automatic run failed while status was "processing",
    retry the same revision instead of creating a false new revision.
  */
  const previousRevision=Number(previous?.revision||0);

  const revision=
    previous?.status === "completed"
      ? previousRevision + 1
      : Math.max(previousRevision,1);

  await setDoc(metaRef,{
    reportDate,
    status:"processing",
    revision,
    schemaVersion:snapshot.schemaVersion||"",
    fingerprint:snapshot.fingerprint,
    dataStatus:snapshot.dataStatus||"partial",
    sourceAvailability:cleanForFirestore(snapshot.sourceAvailability||{}),
    moduleStatus:cleanForFirestore(snapshot.moduleStatus||{}),
    processedMarketplaces:cleanForFirestore(snapshot.processedMarketplaces||{}),
    insights:cleanForFirestore(snapshot.insights),
    amazonSummary:cleanForFirestore(snapshot.amazonSummary),
    flipkartSummary:cleanForFirestore(snapshot.flipkartSummary),
    flipkartOrderPeriod:cleanForFirestore(snapshot.flipkartOrderPeriod),
    updatedBy:user.email||"",
    updatedAt:serverTimestamp()
  },{merge:true});

  const chunkCollection=collection(db,"daily_snapshots",reportDate,"chunks");
  const old=await getDocsFromServer(chunkCollection);
  const deleteOps=[];
  old.forEach(d=>deleteOps.push({type:"delete",ref:d.ref}));
  if(deleteOps.length) await commitBatchOps(deleteOps);

  const groups={
    amazonRows:snapshot.amazonRows||[],
    amazonSuppressions:snapshot.amazonSuppressions||[],
    amazonBuyBox:snapshot.amazonBuyBox||[],
    flipkartRows:snapshot.flipkartRows||[]
  };
  const writeOps=[];
  Object.entries(groups).forEach(([type,rows])=>{
    chunkRows(rows).forEach((chunk,index)=>{
      const id=`${type}_${String(index).padStart(4,"0")}`;
      writeOps.push({
        type:"set",
        ref:doc(
          db,
          "daily_snapshots",
          reportDate,
          "chunks",
          id
        ),
        data:{
          type,
          index,
          rows:packChunkRows(chunk)
        }
      });
    });
  });
  if(writeOps.length) await commitBatchOps(writeOps);

  await setDoc(metaRef,{
    reportDate,
    status:"completed",
    revision,
    schemaVersion:snapshot.schemaVersion||"",
    fingerprint:snapshot.fingerprint,
    dataStatus:snapshot.dataStatus||"partial",
    sourceAvailability:cleanForFirestore(snapshot.sourceAvailability||{}),
    moduleStatus:cleanForFirestore(snapshot.moduleStatus||{}),
    processedMarketplaces:cleanForFirestore(snapshot.processedMarketplaces||{}),
    insights:cleanForFirestore(snapshot.insights),
    amazonSummary:cleanForFirestore(snapshot.amazonSummary),
    flipkartSummary:cleanForFirestore(snapshot.flipkartSummary),
    flipkartOrderPeriod:cleanForFirestore(snapshot.flipkartOrderPeriod),
    completedAt:serverTimestamp(),
    updatedBy:user.email||"",
    updatedAt:serverTimestamp()
  },{merge:true});

  return {revision};
};

window.loadDailySnapshot = async function(reportDate){
  const meta=await window.getDailySnapshotMeta(reportDate);
  if(!meta || meta.status !== "completed") return null;
  const chunks=await getDocsFromServer(collection(db,"daily_snapshots",reportDate,"chunks"));
  const groups={amazonRows:[],amazonSuppressions:[],amazonBuyBox:[],flipkartRows:[]};
  const ordered=[];
  chunks.forEach(d=>ordered.push(d.data()));
  ordered.sort((a,b)=>String(a.type).localeCompare(String(b.type))||Number(a.index)-Number(b.index));
  ordered.forEach(c=>{
    if(groups[c.type]){
      groups[c.type].push(
        ...unpackChunkRows(c.rows)
      );
    }
  });
  return {...meta,...groups};
};

window.listDailySnapshotMetas = async function(){
  const snap=await getDocsFromServer(collection(db,"daily_snapshots"));
  const rows=[];
  snap.forEach(d=>rows.push({id:d.id,...d.data()}));
  return rows.sort((a,b)=>String(a.reportDate||"").localeCompare(String(b.reportDate||"")));
};

window.getLatestCompletedSnapshot = async function(){
  const metas=(await window.listDailySnapshotMetas()).filter(m=>m.status === "completed");
  if(!metas.length) return null;
  const latest=metas[metas.length-1];
  return window.loadDailySnapshot(latest.reportDate);
};











/* ======================================================
   WAKESUITE V7 · FIREBASE ACCESS, SCOPED DATA & OPERATIONS
====================================================== */

const V7_ORG_SUFFIX_MODULE = "@wakefit.co";
const V7_MODULES_MODULE = [
  "dashboard","marketplaceInsights","amazonListing","amazonLive","amazonMrp",
  "amazonSuppression","amazonBuyBox","suppressionManagement",
  "flipkartListing","flipkartLive","flipkartMrp","flipkartBuyBox",
  "pricingHistory","inventoryHistory","dailyCommunications",
  "uploadCenter","masterPricing","marketplaceData","pricingExceptions","settings"
];
const V7_SCOPE_DEFAULT = {marketplaces:["amazon","flipkart"],categories:["*"],modules:V7_MODULES_MODULE,scopeKeys:[],allData:true};
function v7mScopeKey(marketplace,category){return `${marketplace}::${String(category||"Unmapped")}`;}

Object.assign(ACCESS_PRESETS.viewer,{suppressionOverride:false,pocEscalation:false,manageSuppressions:false,managePricingExceptions:false});
Object.assign(ACCESS_PRESETS.analyst,{suppressionOverride:false,pocEscalation:false,manageSuppressions:false,managePricingExceptions:false});
Object.assign(ACCESS_PRESETS.admin,{suppressionOverride:true,pocEscalation:true,manageSuppressions:true,managePricingExceptions:true});
Object.assign(ACCESS_PRESETS.super_admin,{suppressionOverride:true,pocEscalation:true,manageSuppressions:true,managePricingExceptions:true});

function v7mEmail(value){ return String(value||"").trim().toLowerCase(); }
function v7mOrgEmail(value){ const e=v7mEmail(value); return e.endsWith(V7_ORG_SUFFIX_MODULE)&&e.length>V7_ORG_SUFFIX_MODULE.length; }
function v7mPermissions(access){ return {...(ACCESS_PRESETS[access?.role]||ACCESS_PRESETS.viewer),...(access?.permissions||{})}; }
function v7mScopes(access){ const s=access?.scopes||{}; return {marketplaces:Array.isArray(s.marketplaces)&&s.marketplaces.length?s.marketplaces:["amazon","flipkart"],categories:Array.isArray(s.categories)&&s.categories.length?s.categories:["*"],modules:Array.isArray(s.modules)&&s.modules.length?s.modules:[...V7_MODULES_MODULE],scopeKeys:Array.isArray(s.scopeKeys)?s.scopeKeys:[],allData:s.allData!==false}; }
function v7mHas(action){ if(action==="upload" && !v7mScopes(window.currentWakeSuiteAccess).allData)return false; return !!v7mPermissions(window.currentWakeSuiteAccess)[action]; }
function v7mMarketAllowed(m){ return v7mScopes(window.currentWakeSuiteAccess).marketplaces.includes(m); }
function v7mCategoryAllowed(c){ const cats=v7mScopes(window.currentWakeSuiteAccess).categories; return cats.includes("*")||cats.includes(String(c||"")); }
function v7mHash(text){ let h=2166136261; for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36); }
function v7mCategoryKey(category){ return encodeURIComponent(String(category||"Unmapped")).replace(/%/g,"_"); }
function v7mScopeId(marketplace,category){ return `${marketplace}__${v7mCategoryKey(category)}`; }
function v7mRowCategory(type,row){ if(Array.isArray(row)) return String(row[0]||"Unmapped"); return String(row?.category||"Unmapped"); }
function v7mGroupMarketplace(type){ return String(type).startsWith("amazon")?"amazon":"flipkart"; }
function v7mGroupRows(snapshot){ return {amazonRows:snapshot.amazonRows||[],amazonSuppressions:snapshot.amazonSuppressions||[],amazonBuyBox:snapshot.amazonBuyBox||[],flipkartRows:snapshot.flipkartRows||[],amazonInventoryRows:snapshot.amazonInventoryRows||[],flipkartInventoryRows:snapshot.flipkartInventoryRows||[]}; }
function v7mAllowedChunkTypes(){
  const mods=v7mScopes(window.currentWakeSuiteAccess).modules,has=x=>mods.includes(x),out=[];
  if(["dashboard","marketplaceInsights","amazonListing","amazonLive","amazonMrp","marketplaceData","pricingHistory","dailyCommunications"].some(has))out.push("amazonRows");
  if(["dashboard","marketplaceInsights","amazonSuppression","suppressionManagement","dailyCommunications"].some(has))out.push("amazonSuppressions");
  if(["dashboard","marketplaceInsights","amazonBuyBox","dailyCommunications"].some(has))out.push("amazonBuyBox");
  if(["inventoryHistory","marketplaceData"].some(has))out.push("amazonInventoryRows");
  if(["dashboard","marketplaceInsights","flipkartListing","flipkartLive","flipkartMrp","flipkartBuyBox","marketplaceData","pricingHistory","dailyCommunications"].some(has))out.push("flipkartRows");
  if(["inventoryHistory","marketplaceData"].some(has))out.push("flipkartInventoryRows");
  return Array.from(new Set(out));
}

/* ---------- Organization-only sign in ---------- */
consumeEmailInvite = async function(user){
  const email=v7mEmail(user.email); if(!v7mOrgEmail(email)) return null;
  const inviteRef=doc(db,"access_invites",email); let snap; try{snap=await getDoc(inviteRef);}catch(_e){return null;} if(!snap.exists())return null;
  const invite=snap.data(); if(!["approved","invited"].includes(invite.status))return null; const role=invite.role||"viewer";
  const access={uid:user.uid,email,name:user.displayName||"",role,status:"approved",permissions:invite.permissions||ACCESS_PRESETS[role]||ACCESS_PRESETS.viewer,scopes:invite.scopes||V7_SCOPE_DEFAULT,approvedAt:serverTimestamp(),approvedBy:invite.invitedBy||"invite"};
  await setDoc(doc(db,"access_users",user.uid),access,{merge:true}); await setDoc(inviteRef,{status:"accepted",acceptedUid:user.uid,acceptedAt:serverTimestamp()},{merge:true}); return {...access,approvedAt:null};
};

ensureWakeSuiteAccess = async function(user){
  const email=v7mEmail(user.email);
  if(!v7mOrgEmail(email)){
    showAccessOverlay("Organization Access Only",`WakeSuite is restricted to ${V7_ORG_SUFFIX_MODULE} organization accounts.`); return null;
  }
  let access=null; try{access=await getApprovedAccessDoc(user);}catch(_e){}
  if(access&&access.status==="approved") return {...access,scopes:access.scopes||V7_SCOPE_DEFAULT};
  if(access&&["disabled","rejected"].includes(access.status)){showAccessOverlay(access.status==="disabled"?"Access Disabled":"Access Rejected","Your WakeSuite access is not active. Contact a WakeSuite administrator.");return null;}
  const invited=await consumeEmailInvite(user); if(invited)return invited;
  const bootstrapped=await bootstrapLegacyOwner(user); if(bootstrapped){await setDoc(doc(db,"access_users",user.uid),{scopes:V7_SCOPE_DEFAULT,permissions:ACCESS_PRESETS.super_admin},{merge:true});return {...bootstrapped,scopes:V7_SCOPE_DEFAULT,permissions:ACCESS_PRESETS.super_admin};}
  const requestRef=doc(db,"access_requests",user.uid); let requestSnap=null; try{requestSnap=await getDoc(requestRef);}catch(_e){}
  if(requestSnap?.exists()){
    const requestData=requestSnap.data();
    if(requestData.status==="rejected"){showAccessOverlay("Access Rejected","Your WakeSuite access request was rejected. Contact a WakeSuite administrator if access is required.");return null;}
    if(requestData.status==="pending"){showAccessOverlay("Access Pending","Your WakeSuite access request is waiting for administrator approval.");return null;}
  }
  try{await setDoc(requestRef,{uid:user.uid,email,name:user.displayName||"",status:"pending",requestedAt:serverTimestamp()},{merge:true});}catch(error){console.warn("Unable to create access request",error);}
  showAccessOverlay("Access Pending","Your WakeSuite access request is waiting for administrator approval."); return null;
};

/* ---------- Access directory / lifecycle ---------- */
window.loadWakeSuiteAccessDirectory = async function(){
  requireUserAdmin(); const [us,rs,is]=await Promise.all([getDocsFromServer(collection(db,"access_users")),getDocsFromServer(collection(db,"access_requests")),getDocsFromServer(collection(db,"access_invites"))]); const users=[],requests=[],invites=[]; const userEmails=new Set();
  us.forEach(d=>{const x={uid:d.id,...d.data()};users.push(x);if(x.email)userEmails.add(v7mEmail(x.email));});
  rs.forEach(d=>{const x={uid:d.id,...d.data()};if(["pending","rejected"].includes(x.status))requests.push(x);});
  is.forEach(d=>{const x={id:d.id,...d.data()};const e=v7mEmail(x.email||d.id);if(!userEmails.has(e)&&["invited","approved"].includes(x.status))invites.push({...x,email:e,status:"invited"});});
  const sort=a=>a.sort((x,y)=>String(x.email||"").localeCompare(String(y.email||""))); return {users:sort(users),requests:sort(requests),invites:sort(invites)};
};
window.inviteWakeSuiteAccess = async function(email,role,permissions,scopes){
  requireUserAdmin(); const e=v7mEmail(email); if(!v7mOrgEmail(e))throw new Error(`Only ${V7_ORG_SUFFIX_MODULE} organization emails can be invited.`); const r=role||"viewer"; await setDoc(doc(db,"access_invites",e),{email:e,role:r,permissions:permissions||ACCESS_PRESETS[r]||ACCESS_PRESETS.viewer,scopes:scopes||V7_SCOPE_DEFAULT,status:"invited",invitedBy:auth.currentUser?.email||auth.currentUser?.uid||"",invitedAt:serverTimestamp()},{merge:true});
};
window.approveWakeSuiteAccessRequest = async function(uid,role,permissions,scopes){
  requireUserAdmin(); const ref=doc(db,"access_requests",uid),snap=await getDoc(ref); if(!snap.exists())throw new Error("Access request was not found."); const req=snap.data(); if(!v7mOrgEmail(req.email))throw new Error("Only organization accounts can be approved."); const r=role||"viewer"; await setDoc(doc(db,"access_users",uid),{uid,email:req.email||"",name:req.name||"",role:r,permissions:permissions||ACCESS_PRESETS[r]||ACCESS_PRESETS.viewer,scopes:scopes||V7_SCOPE_DEFAULT,status:"approved",approvedBy:auth.currentUser?.email||auth.currentUser?.uid||"",approvedAt:serverTimestamp()},{merge:true}); await setDoc(ref,{status:"approved",reviewedBy:auth.currentUser?.email||"",reviewedAt:serverTimestamp()},{merge:true});
};
window.rejectWakeSuiteAccessRequest = async uid=>{requireUserAdmin();await setDoc(doc(db,"access_requests",uid),{status:"rejected",reviewedBy:auth.currentUser?.email||auth.currentUser?.uid||"",reviewedAt:serverTimestamp()},{merge:true});};
window.saveWakeSuiteAccessUser = async function(uid,role,permissions,scopes){requireUserAdmin();const r=role||"viewer";await setDoc(doc(db,"access_users",uid),{role:r,permissions:permissions||ACCESS_PRESETS[r]||ACCESS_PRESETS.viewer,scopes:scopes||V7_SCOPE_DEFAULT,status:"approved",updatedBy:auth.currentUser?.email||auth.currentUser?.uid||"",updatedAt:serverTimestamp()},{merge:true});};
window.enableWakeSuiteAccessUser = async uid=>{requireUserAdmin();await setDoc(doc(db,"access_users",uid),{status:"approved",updatedBy:auth.currentUser?.email||"",updatedAt:serverTimestamp()},{merge:true});};
window.cancelWakeSuiteInvite = async email=>{requireUserAdmin();await deleteDoc(doc(db,"access_invites",v7mEmail(email)));};

/* ---------- Shared operational settings ---------- */
window.loadOperationalControlsData = async function(){const snap=await getDoc(doc(db,"system_settings","operational_controls"));return snap.exists()?snap.data():{};};
window.saveOperationalControlsData = async function(data){if(!v7mHas("settings")&&!v7mHas("userAdmin"))throw new Error("Settings permission is required.");await setDoc(doc(db,"system_settings","operational_controls"),{...cleanForFirestore(data),updatedBy:auth.currentUser?.email||"",updatedAt:serverTimestamp()},{merge:true});};

/* ---------- Pricing exceptions ---------- */
window.loadPricingExceptions = async function(){
  if(!window.currentWakeSuiteAccess)return[];
  const scopes=v7mScopes(window.currentWakeSuiteAccess),rows=[],snaps=[];

  // Include both category-specific and "all category" exception records.
  if(scopes.categories.includes("*")){
    for(const market of scopes.marketplaces){
      snaps.push(await getDocsFromServer(query(collection(db,"pricing_exceptions"),where("marketplace","==",market))));
    }
  }else{
    const keys=[];
    for(const market of scopes.marketplaces){
      keys.push(v7mScopeKey(market,"all"));
      keys.push(v7mScopeKey(market,"*"));
      for(const category of scopes.categories) keys.push(v7mScopeKey(market,category));
    }
    const unique=[...new Set(keys)];
    for(let i=0;i<unique.length;i+=10){
      snaps.push(await getDocsFromServer(query(collection(db,"pricing_exceptions"),where("scopeKey","in",unique.slice(i,i+10)))));
    }
  }

  snaps.forEach(s=>s.forEach(d=>{
    const x={id:d.id,...d.data()};
    const category=String(x.category||"all");
    const categoryAllowed=["all","*"].includes(category.toLowerCase()) || v7mCategoryAllowed(category);
    if(v7mMarketAllowed(x.marketplace)&&categoryAllowed) rows.push(x);
  }));
  return rows;
};
window.savePricingExceptions = async function(rows){
  if(!v7mHas("managePricingExceptions"))throw new Error("Manage Pricing Exceptions permission is required.");
  const ops=[];
  for(const row of rows){
    const key=[row.marketplace,row.category||"all",row.wfSku||"",row.azSku||"",row.asin||"",row.fkSku||"",row.fsn||"",row.exceptionType,row.effectiveFrom,row.effectiveTo].join("|");
    const id=`px_${v7mHash(key)}`;
    ops.push({type:"set",ref:doc(db,"pricing_exceptions",id),data:{...cleanForFirestore(row),scopeKey:v7mScopeKey(row.marketplace,row.category||"all"),status:"active",updatedBy:auth.currentUser?.email||"",updatedAt:serverTimestamp(),createdBy:auth.currentUser?.email||""}});
  }
  await commitBatchOps(ops,6);
};

/* ---------- Suppression overrides ---------- */
window.saveSuppressionOverride = async function(data){
  if(!v7mHas("suppressionOverride"))throw new Error("Suppression Override permission is required."); if(!data?.asin||!data?.reportDate||!data?.reason)throw new Error("ASIN, report date and reason are required."); const id=`${data.reportDate}_${data.asin}`; await setDoc(doc(db,"suppression_overrides",id),{asin:data.asin,reportDate:data.reportDate,category:data.category||"Unmapped",reason:data.reason,status:"active",overriddenBy:auth.currentUser?.email||auth.currentUser?.uid||"",overriddenAt:serverTimestamp()},{merge:true});
};

/* ---------- Scoped snapshot storage ---------- */
async function v7mDeleteScope(scopeRef){const chunks=await getDocsFromServer(collection(scopeRef,"chunks"));const ops=[];chunks.forEach(d=>ops.push({type:"delete",ref:d.ref}));if(ops.length)await commitBatchOps(ops);await deleteDoc(scopeRef);}
function v7mRebuildSummary(groups,meta){
  const az=(groups.amazonRows||[]).map(a=>Array.isArray(a)?{listing:a[12],live:a[13],mrp:a[14],dailyImpact:a[18]||0,listingImpact:a[22]||0,liveImpact:a[23]||a[18]||0}:a);
  const fk=(groups.flipkartRows||[]).map(a=>Array.isArray(a)?{listing:a[11],live:a[12],mrp:a[13],dailyImpact:a[17]||0,listingImpact:a[26]||0,liveImpact:a[27]||a[17]||0,buyBoxImpact:a[28]||0,buyBoxStatus:a[10]}:a);
  const azListingImpact=az.reduce((s,r)=>s+Number(r.listingImpact||0),0),azLiveImpact=az.reduce((s,r)=>s+Number(r.liveImpact||0),0);
  const fkListingImpact=fk.reduce((s,r)=>s+Number(r.listingImpact||0),0),fkLiveImpact=fk.reduce((s,r)=>s+Number(r.liveImpact||0),0);
  const amazonAudit=!!meta?.sourceAvailability?.audit,flipkartAudit=amazonAudit;
  const amazonSuppressions=(groups.amazonSuppressions||[]),amazonBuyBox=(groups.amazonBuyBox||[]);
  return {
    amazonSummary:{
      totalActiveInStockSkus:az.length,listingPriceDisparitySkus:az.filter(r=>r.listing).length,livePriceDisparitySkus:az.filter(r=>r.live).length,mrpDisparitySkus:az.filter(r=>r.mrp).length,
      suppressedAsins:amazonSuppressions.length,buyBoxSuppressedAsins:amazonBuyBox.length,
      listingTotalDailyRevenueImpact:azListingImpact,liveTotalDailyRevenueImpact:azLiveImpact,totalDailyRevenueImpact:az.reduce((s,r)=>s+Number(r.dailyImpact||0),0),
      suppressionRevenueImpactPerDay:amazonSuppressions.reduce((s,r)=>s+Number((Array.isArray(r)?r[5]:r.revenueImpactPerDay)||0),0),
      buyBoxRevenueImpactPerDay:amazonBuyBox.reduce((s,r)=>s+Number((Array.isArray(r)?r[5]:r.revenueImpactPerDay)||0),0),
      revenueAvailable:!!meta?.sourceAvailability?.amazonBusiness,auditAvailable:amazonAudit
    },
    flipkartSummary:{
      totalActiveInStockSkus:fk.length,listingPriceDisparitySkus:fk.filter(r=>r.listing).length,livePriceDisparitySkus:fk.filter(r=>r.live).length,mrpDisparitySkus:fk.filter(r=>r.mrp).length,
      noBuyBoxSkus:fk.filter(r=>r.buyBoxStatus==="No Buy Box").length,
      listingTotalDailyRevenueImpact:fkListingImpact,liveTotalDailyRevenueImpact:fkLiveImpact,totalDailyRevenueImpact:fk.reduce((s,r)=>s+Number(r.dailyImpact||0),0),
      noBuyBoxRevenueImpactPerDay:fk.reduce((s,r)=>s+Number(r.buyBoxImpact||0),0),
      revenueAvailable:!!meta?.sourceAvailability?.flipkartOrders,auditAvailable:flipkartAudit
    }
  };
}

window.saveDailySnapshot = async function(reportDate,snapshot){
  if(!v7mHas("upload"))throw new Error("Your WakeSuite role does not allow processed snapshot writes."); const user=auth.currentUser;if(!user)throw new Error("You must be signed in to WakeSuite."); const metaRef=doc(db,"daily_snapshots",reportDate),existing=await getDoc(metaRef),previous=existing.exists()?existing.data():null,previousRevision=Number(previous?.revision||0),revision=previous?.status==="completed"?previousRevision+1:Math.max(previousRevision,1);
  await setDoc(metaRef,{reportDate,status:"processing",revision,schemaVersion:"v7",fingerprint:snapshot.fingerprint,dataStatus:snapshot.dataStatus||"partial",sourceAvailability:cleanForFirestore(snapshot.sourceAvailability||{}),moduleStatus:cleanForFirestore(snapshot.moduleStatus||{}),processedMarketplaces:cleanForFirestore(snapshot.processedMarketplaces||{}),flipkartOrderPeriod:cleanForFirestore(snapshot.flipkartOrderPeriod),updatedBy:user.email||"",updatedAt:serverTimestamp()},{merge:true});
  // Remove legacy chunks and prior V7 scopes.
  try{const legacy=await getDocsFromServer(collection(db,"daily_snapshots",reportDate,"chunks"));const dels=[];legacy.forEach(d=>dels.push({type:"delete",ref:d.ref}));if(dels.length)await commitBatchOps(dels);}catch(_e){}
  for(const scopeId of previous?.scopeKeys||[]){try{await v7mDeleteScope(doc(db,"daily_snapshots",reportDate,"scopes",scopeId));}catch(_e){}}
  const scopeMap=new Map(); const groups=v7mGroupRows(snapshot);
  Object.entries(groups).forEach(([type,rows])=>{const market=v7mGroupMarketplace(type);(rows||[]).forEach(row=>{const category=v7mRowCategory(type,row),scopeId=v7mScopeId(market,category);if(!scopeMap.has(scopeId))scopeMap.set(scopeId,{marketplace:market,category,types:new Map()});const scope=scopeMap.get(scopeId);if(!scope.types.has(type))scope.types.set(type,[]);scope.types.get(type).push(row);});});
  const scopeKeys=[]; for(const [scopeId,scope] of scopeMap){scopeKeys.push(scopeId);const scopeRef=doc(db,"daily_snapshots",reportDate,"scopes",scopeId);await setDoc(scopeRef,{marketplace:scope.marketplace,category:scope.category,schemaVersion:"v7",updatedAt:serverTimestamp()});const ops=[];for(const [type,rows] of scope.types){chunkRows(rows).forEach((chunk,index)=>ops.push({type:"set",ref:doc(db,"daily_snapshots",reportDate,"scopes",scopeId,"chunks",`${type}_${String(index).padStart(4,"0")}`),data:{type,index,marketplace:scope.marketplace,category:scope.category,rows:packChunkRows(chunk)}}));}if(ops.length)await commitBatchOps(ops);}
  await setDoc(metaRef,{reportDate,status:"completed",revision,schemaVersion:"v7",fingerprint:snapshot.fingerprint,dataStatus:snapshot.dataStatus||"partial",sourceAvailability:cleanForFirestore(snapshot.sourceAvailability||{}),moduleStatus:cleanForFirestore(snapshot.moduleStatus||{}),processedMarketplaces:cleanForFirestore(snapshot.processedMarketplaces||{}),flipkartOrderPeriod:cleanForFirestore(snapshot.flipkartOrderPeriod),scopeKeys,completedAt:serverTimestamp(),updatedBy:user.email||"",updatedAt:serverTimestamp()},{merge:true});
  try{await v7mSyncSuppressionCases(reportDate,snapshot);}catch(error){console.warn("Suppression case sync skipped",error);} return {revision};
};

async function v7mLoadV7Scopes(reportDate,meta){
  const groups={amazonRows:[],amazonSuppressions:[],amazonBuyBox:[],flipkartRows:[],amazonInventoryRows:[],flipkartInventoryRows:[]};
  const scopes=v7mScopes(window.currentWakeSuiteAccess),types=v7mAllowedChunkTypes();
  const allowed=(meta.scopeKeys||[]).filter(scopeId=>{const market=scopeId.startsWith("amazon__")?"amazon":"flipkart";if(!scopes.marketplaces.includes(market))return false;if(scopes.categories.includes("*"))return true;return scopes.categories.some(c=>scopeId===v7mScopeId(market,c));});
  if(!types.length)return groups;
  const hasAllTypes=types.length===6;
  for(const scopeId of allowed){
    const chunkRef=collection(db,"daily_snapshots",reportDate,"scopes",scopeId,"chunks"),ordered=[];
    // Firestore rules are not filters. Always constrain the chunk query by
    // the exact chunk types this user is allowed to read. An unfiltered
    // collection read can be rejected even when every existing document
    // currently happens to be an allowed type.
    for(let i=0;i<types.length;i+=10){
      const snap=await getDocsFromServer(
        query(chunkRef,where("type","in",types.slice(i,i+10)))
      );
      snap.forEach(d=>ordered.push(d.data()));
    }
    ordered.sort((a,b)=>String(a.type).localeCompare(String(b.type))||Number(a.index)-Number(b.index));
    ordered.forEach(c=>{if(groups[c.type])groups[c.type].push(...unpackChunkRows(c.rows));});
  }
  return groups;
}
async function v7mLoadLegacyChunks(reportDate){
  const groups={amazonRows:[],amazonSuppressions:[],amazonBuyBox:[],flipkartRows:[],amazonInventoryRows:[],flipkartInventoryRows:[]},ordered=[],types=v7mAllowedChunkTypes(),chunkRef=collection(db,"daily_snapshots",reportDate,"chunks");
  if(!types.length)return groups;
  // Legacy V4/V5/V6 snapshot chunks are also queried with an explicit
  // type constraint so the V7 Firestore rules can authorize the query.
  for(let i=0;i<types.length;i+=10){
    const snap=await getDocsFromServer(
      query(chunkRef,where("type","in",types.slice(i,i+10)))
    );
    snap.forEach(d=>ordered.push(d.data()));
  }
  ordered.sort((a,b)=>String(a.type).localeCompare(String(b.type))||Number(a.index)-Number(b.index));ordered.forEach(c=>{if(groups[c.type])groups[c.type].push(...unpackChunkRows(c.rows));});return groups;
}
async function v7mOverrideAsins(reportDate,groups){const issueRows=groups.amazonSuppressions||[];const pairs=issueRows.map(r=>({asin:Array.isArray(r)?r[1]:r.asin,category:Array.isArray(r)?r[0]:r.category})).filter(x=>x.asin);if(!pairs.length)return[];const out=[];const full=v7mScopes(window.currentWakeSuiteAccess).categories.includes("*");if(full){try{const qs=await getDocsFromServer(query(collection(db,"suppression_overrides"),where("reportDate","==",reportDate)));qs.forEach(d=>{const x=d.data();if(x.status==="active"&&v7mCategoryAllowed(x.category))out.push(x.asin);});return out;}catch(_e){}}
  for(const x of pairs){if(!v7mCategoryAllowed(x.category))continue;try{const d=await getDoc(doc(db,"suppression_overrides",`${reportDate}_${x.asin}`));if(d.exists()&&d.data().status==="active")out.push(x.asin);}catch(_e){}}return out;}
window.loadDailySnapshot = async function(reportDate){const meta=await window.getDailySnapshotMeta(reportDate);if(!meta||meta.status!=="completed")return null;let groups;if(meta.schemaVersion==="v7"&&Array.isArray(meta.scopeKeys)){groups=await v7mLoadV7Scopes(reportDate,meta);}else{if(!v7mScopes(window.currentWakeSuiteAccess).allData)throw new Error("This historical snapshot uses the legacy unscoped format. A Super Admin must reprocess that date with WakeSuite V7 before restricted users can access it.");groups=await v7mLoadLegacyChunks(reportDate);}const rebuilt=v7mRebuildSummary(groups,meta);const suppressionOverrideAsins=await v7mOverrideAsins(reportDate,groups);return {...meta,...groups,...rebuilt,suppressionOverrideAsins};};

/* ---------- Suppression Management persistence ---------- */
function v7mPocDecision(category,impact,revenueAvailable,settings){
  const c=String(category||"").toLowerCase(),t=settings?.thresholds||{};
  if(c.includes("office")&&c.includes("chair")&&t.OfficeChairsAlways!==false)return "Required";
  const threshold=c.includes("accessor")?Number(t.Accessories??1000):c.includes("furniture")?Number(t.Furniture??2000):c.includes("mattress")?Number(t.Mattress??4000):null;
  if(threshold===null)return "Not Required";
  if(revenueAvailable===false)return "Needs Review";
  return Number(impact)>threshold?"Required":"Not Required";
}
async function v7mSyncSuppressionCases(reportDate,snapshot){
  if(!v7mHas("upload"))return; const settingsSnap=await getDoc(doc(db,"system_settings","operational_controls"));const settings=settingsSnap.exists()?settingsSnap.data():{};const casesSnap=await getDocsFromServer(collection(db,"suppression_cases"));const cases=[];casesSnap.forEach(d=>cases.push({id:d.id,...d.data()}));const openByAsin=new Map(cases.filter(c=>!["Reactivated","Closed"].includes(c.status)).map(c=>[c.asin,c]));const suppressed=(snapshot.amazonSuppressions||[]).map(a=>Array.isArray(a)?{category:a[0],asin:a[1],wfSku:a[2],listingPrice:a[3],businessRevenue:a[4],revenueImpactPerDay:a[5],azSku:a[6],revenueAvailable:a.length>7?!!a[7]:true}:a);const current=new Set();const ops=[];
  suppressed.forEach(r=>{if(!r.asin)return;current.add(r.asin);const existing=openByAsin.get(r.asin);const decision=v7mPocDecision(r.category,r.revenueImpactPerDay,r.revenueAvailable!==false,settings);const required=decision==="Required";if(existing){const pocStatus=existing.pocEscalationStatus==="Escalated"?"Escalated":decision;ops.push({type:"set",ref:doc(db,"suppression_cases",existing.id),data:{lastDetected:reportDate,category:r.category,revenueImpactPerDay:r.revenueImpactPerDay??null,revenueAvailable:r.revenueAvailable!==false,pocEscalationRequired:required,pocEscalationStatus:pocStatus,updatedAt:serverTimestamp()}});}else{const id=`${r.asin}_${reportDate}`;ops.push({type:"set",ref:doc(db,"suppression_cases",id),data:{asin:r.asin,category:r.category,wfSku:r.wfSku||"",azSku:r.azSku||"",firstDetected:reportDate,lastDetected:reportDate,status:"Detected",caseId:"",owner:"",poaStatus:"Not Required",qcStatus:"Not Required",notes:"",revenueImpactPerDay:r.revenueImpactPerDay??null,revenueAvailable:r.revenueAvailable!==false,pocEscalationRequired:required,pocEscalationStatus:decision,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}});}});
  const activeAsins=new Set((snapshot.amazonRows||[]).map(a=>Array.isArray(a)?a[3]:a.asin).filter(Boolean));cases.filter(c=>!["Reactivated","Closed"].includes(c.status)&&!current.has(c.asin)&&activeAsins.has(c.asin)).forEach(c=>ops.push({type:"set",ref:doc(db,"suppression_cases",c.id),data:{status:"Reactivated",reactivatedDate:reportDate,pocEscalationStatus:c.pocEscalationStatus==="Escalated"?"Resolved":c.pocEscalationStatus,updatedAt:serverTimestamp()}}));if(ops.length)await commitBatchOps(ops,6);
}
window.loadSuppressionCases = async function(){if(!v7mMarketAllowed("amazon"))return[];const scopes=v7mScopes(window.currentWakeSuiteAccess),out=[];let snaps=[];if(scopes.categories.includes("*")||scopes.allData)snaps=[await getDocsFromServer(collection(db,"suppression_cases"))];else for(let i=0;i<scopes.categories.length;i+=10)snaps.push(await getDocsFromServer(query(collection(db,"suppression_cases"),where("category","in",scopes.categories.slice(i,i+10)))));snaps.forEach(s=>s.forEach(d=>{const x={id:d.id,...d.data()};if(v7mCategoryAllowed(x.category))out.push(x);}));return out.sort((a,b)=>String(b.lastDetected||"").localeCompare(String(a.lastDetected||"")));};
window.updateSuppressionCase = async function(id,patch){const canManage=v7mHas("manageSuppressions"),canPoc=v7mHas("pocEscalation");if(!canManage&&!canPoc)throw new Error("Suppression Management permission is required.");const allowed={};if(canManage)["caseId","owner","status","poaStatus","qcStatus","notes"].forEach(k=>{if(k in patch)allowed[k]=patch[k];});if(canPoc&&"pocEscalationStatus" in patch)allowed.pocEscalationStatus=patch.pocEscalationStatus;await setDoc(doc(db,"suppression_cases",id),{...allowed,updatedBy:auth.currentUser?.email||"",updatedAt:serverTimestamp()},{merge:true});};

/* ---------- POC escalation records + communication log ---------- */
window.loadPocEscalations = async function(){if(!v7mHas("pocEscalation"))return[];const scopes=v7mScopes(window.currentWakeSuiteAccess),rows=[],snaps=[];if(scopes.categories.includes("*")&&scopes.marketplaces.length===2)snaps.push(await getDocsFromServer(collection(db,"poc_escalations")));else if(scopes.categories.includes("*")){for(const market of scopes.marketplaces)snaps.push(await getDocsFromServer(query(collection(db,"poc_escalations"),where("marketplace","==",market))));}else{const keys=[];for(const market of scopes.marketplaces)for(const category of scopes.categories)keys.push(v7mScopeKey(market,category));for(let i=0;i<keys.length;i+=10)snaps.push(await getDocsFromServer(query(collection(db,"poc_escalations"),where("scopeKey","in",keys.slice(i,i+10)))));}snaps.forEach(s=>s.forEach(d=>rows.push({id:d.id,...d.data()})));return rows;};
window.recordPocEscalations = async function(rows,reportDate){
  if(!v7mHas("pocEscalation"))throw new Error("POC Escalation permission is required.");
  let suppressionCases=[];
  if((rows||[]).some(r=>r.marketplace==="amazon"&&r.issueType==="ASIN Suppression")){
    try{suppressionCases=await window.loadSuppressionCases();}catch(error){console.warn("Unable to load suppression cases for POC sync",error);}
  }
  for(const r of rows||[]){
    const id=`pe_${v7mHash(r.issueKey)}`,ref=doc(db,"poc_escalations",id),existing=await getDoc(ref);
    const data={issueKey:r.issueKey,marketplace:r.marketplace,category:r.category||"Unmapped",scopeKey:v7mScopeKey(r.marketplace,r.category||"Unmapped"),productId:r.productId,issueType:r.issueType,status:"Escalated",lastEscalatedDate:reportDate,updatedAt:serverTimestamp(),updatedBy:auth.currentUser?.email||""};
    if(!existing.exists()||!existing.data()?.firstEscalatedDate)data.firstEscalatedDate=reportDate;
    await setDoc(ref,data,{merge:true});
    if(r.marketplace==="amazon"&&r.issueType==="ASIN Suppression"){
      const target=suppressionCases.filter(x=>x.asin===r.productId&&!["Reactivated","Closed"].includes(x.status)).sort((a,b)=>String(b.lastDetected||"").localeCompare(String(a.lastDetected||"")))[0];
      if(target){try{await setDoc(doc(db,"suppression_cases",target.id),{pocEscalationStatus:"Escalated",updatedBy:auth.currentUser?.email||"",updatedAt:serverTimestamp()},{merge:true});target.pocEscalationStatus="Escalated";}catch(error){console.warn("Unable to update suppression POC status",error);}}
    }
  }
};
window.syncPocEscalationResolution = async function(currentIssueKeys,reportDate){
  if(!v7mHas("pocEscalation"))return;
  const current=new Set(currentIssueKeys||[]),existing=await window.loadPocEscalations(),ops=[];
  (existing||[]).filter(x=>x.status!=="Resolved"&&!current.has(x.issueKey)).forEach(x=>ops.push({type:"set",ref:doc(db,"poc_escalations",x.id),data:{status:"Resolved",resolvedDate:reportDate,updatedAt:serverTimestamp(),updatedBy:auth.currentUser?.email||""}}));
  if(ops.length)await commitBatchOps(ops,6);
};
window.loadCommunicationLog = async function(reportDate){
  if(!v7mHas("email"))return[];
  const scopes=v7mScopes(window.currentWakeSuiteAccess),rows=[],snaps=[];
  if(scopes.marketplaces.length===2){snaps.push(await getDocsFromServer(query(collection(db,"communication_log"),where("reportDate","==",reportDate))));}
  else{for(const market of scopes.marketplaces){const snap=await getDocsFromServer(query(collection(db,"communication_log"),where("marketplace","==",market)));snaps.push(snap);}}
  snaps.forEach(s=>s.forEach(d=>{const x={id:d.id,...d.data()};if(x.reportDate===reportDate&&(x.marketplace==="combined"?scopes.marketplaces.length===2:scopes.marketplaces.includes(x.marketplace)))rows.push(x);}));
  return rows.sort((a,b)=>String(b.sentAtText||"").localeCompare(String(a.sentAtText||"")));
};
window.saveCommunicationLog = async function(data){if(!v7mHas("email"))throw new Error("Email permission is required.");const id=`${data.reportDate}_${String(data.communicationType).replace(/\W+/g,"_")}_${data.marketplace}_${Date.now()}`;await setDoc(doc(db,"communication_log",id),{...cleanForFirestore(data),sentBy:auth.currentUser?.email||"",sentAt:serverTimestamp(),sentAtText:new Date().toLocaleString()});};




/* ======================================================
   WAKESUITE V8 · ACCESS / FIRESTORE OPERATIONS
====================================================== */
const V8_MODULES_MODULE = [...V7_MODULES_MODULE.filter(x=>x!=="flipkartBuyBox"),"amazonPricingIssues"];
["viewer","analyst","admin","super_admin"].forEach(role=>{if(ACCESS_PRESETS[role]){if(ACCESS_PRESETS[role].raiseCaseId===undefined)ACCESS_PRESETS[role].raiseCaseId=role==="admin"||role==="super_admin";if(ACCESS_PRESETS[role].managePoaQc===undefined)ACCESS_PRESETS[role].managePoaQc=role==="admin"||role==="super_admin";}});

/* User preferences */
window.saveUserPreference=async function(key,value){if(!auth.currentUser)return;await setDoc(doc(db,"user_preferences",auth.currentUser.uid),{[key]:cleanForFirestore(value),updatedAt:serverTimestamp()},{merge:true});};
window.loadUserPreferences=async function(){if(!auth.currentUser)return{};try{const s=await getDoc(doc(db,"user_preferences",auth.currentUser.uid));return s.exists()?s.data():{};}catch(_e){return{};}};

/* Invitation scopes are configured before first login */
window.updateWakeSuiteInvite=async function(email,role,permissions,scopes){requireUserAdmin();const e=v7mEmail(email);if(!v7mOrgEmail(e))throw new Error(`Only ${V7_ORG_SUFFIX_MODULE} organization emails can be invited.`);await setDoc(doc(db,"access_invites",e),{email:e,role,permissions,scopes,status:"invited",updatedBy:auth.currentUser?.email||"",updatedAt:serverTimestamp()},{merge:true});};

/* Granular Data Center permission helper */
window.v8CanUploadType=function(configId){const access=window.currentWakeSuiteAccess||{},scopes=access.scopes||{};if(access.role==="super_admin")return true;const list=Array.isArray(scopes.uploadTypes)?scopes.uploadTypes:[];return list.includes(configId);};
window.v8CanDownloadType=function(type){const access=window.currentWakeSuiteAccess||{},scopes=access.scopes||{};if(access.role==="super_admin")return true;const list=Array.isArray(scopes.downloadTypes)?scopes.downloadTypes:[];return list.includes(type);};

/* Suppression assignees */
window.loadSuppressionEligibleUsers=async function(){requireApprovedAccess();const qs=await getDocsFromServer(collection(db,"access_users")),rows=[];qs.forEach(d=>{const x={uid:d.id,...d.data()};const mods=x.scopes?.modules||[];if(x.status==="approved"&&mods.includes("suppressionManagement"))rows.push(x);});return rows;};
window.createManualSuppressionCase=async function(data){if(!v7mHas("raiseCaseId"))throw new Error("Raise Case ID permission is required.");if(!v7mMarketAllowed("amazon")||!v7mCategoryAllowed(data.category))throw new Error("The selected category is outside your access scope.");if(!data.caseId)throw new Error("Case ID is required for manual suppression entries.");const cases=await window.loadSuppressionCases(),existing=cases.find(c=>c.asin===data.asin&&!['Reactivated','Closed'].includes(c.status));const ref=doc(db,"suppression_cases",existing?.id||`${data.asin}_${data.firstDetected}`);await setDoc(ref,{...cleanForFirestore(data),source:existing?existing.source==="Audit"?"Audit + Manual":"Manual":"Manual",manualEntry:true,assignees:data.assignees||[],createdBy:existing?.createdBy||auth.currentUser?.email||"",createdAt:existing?.createdAt||serverTimestamp(),updatedBy:auth.currentUser?.email||"",updatedAt:serverTimestamp()},{merge:true});};

/* Scope-aware dashboard workload */
window.loadPendingCaseIdWorkload=async function(){if(!v7mHas("raiseCaseId")||!v7mScopes(window.currentWakeSuiteAccess).modules.includes("suppressionManagement"))return{mine:0,team:0,total:0};const cases=await window.loadSuppressionCases(),uid=auth.currentUser?.uid||"";let mine=0,team=0;cases.filter(c=>!c.caseId&&!['Reactivated','Closed'].includes(c.status)).forEach(c=>{const a=Array.isArray(c.assignees)?c.assignees:[];if(a.includes(uid))mine++;else if(c.teamAssigned===true)team++;});return{mine,team,total:mine+team};};

/* Override suppression case updates: Case ID is granular */
window.updateSuppressionCase=async function(id,patch){const canManage=v7mHas("manageSuppressions"),canPoc=v7mHas("pocEscalation"),canCase=v7mHas("raiseCaseId"),canDocs=v7mHas("managePoaQc");if(!canManage&&!canPoc&&!canCase&&!canDocs)throw new Error("Suppression Management permission is required.");const allowed={};if(canManage)["assignees","teamAssigned","status","notes"].forEach(k=>{if(k in patch)allowed[k]=patch[k];});if(canCase&&"caseId" in patch)allowed.caseId=patch.caseId;if(canDocs)["poaStatus","qcStatus"].forEach(k=>{if(k in patch)allowed[k]=patch[k];});if(canPoc&&"pocEscalationStatus" in patch)allowed.pocEscalationStatus=patch.pocEscalationStatus;await setDoc(doc(db,"suppression_cases",id),{...allowed,updatedBy:auth.currentUser?.email||"",updatedAt:serverTimestamp()},{merge:true});};

/* Navigation visibility: hide parents with no visible children */
const v8BaseApplyAccessPermissionsModule=applyAccessPermissions;
applyAccessPermissions=function(){v8BaseApplyAccessPermissionsModule();document.querySelectorAll('[data-ws-module="flipkartBuyBox"]').forEach(el=>el.style.display="none");document.querySelectorAll('.nav-group').forEach(group=>{const children=[...group.querySelectorAll('.nav-link')];if(children.length&&children.every(x=>x.style.display==="none"||getComputedStyle(x).display==="none"))group.style.display="none";else group.style.display="";});const dataLink=[...document.querySelectorAll('.nav-link')].find(x=>String(x.textContent||'').trim()==='Data Center');if(dataLink&&!v7mScopes(window.currentWakeSuiteAccess).modules.includes('uploadCenter'))dataLink.style.display='none';if(window.currentWakeSuiteAccess?.role==='super_admin')document.querySelectorAll('[data-ws-module="amazonPricingIssues"]').forEach(el=>el.style.display='');try{populateMenus();populateFolders();}catch(_e){};};

/* Access editor: invited / pending users retain exact configured scope */

window.wakeSuiteFirebase = {
  app,
  auth,
  db
};

