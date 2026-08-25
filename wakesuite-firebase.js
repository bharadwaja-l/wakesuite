

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
window.loadSuppressionEligibleUsers=async function(){if(!auth.currentUser||!window.currentWakeSuiteAccess)throw new Error("Approved WakeSuite access is required.");const qs=await getDocsFromServer(collection(db,"access_users")),rows=[];qs.forEach(d=>{const x={uid:d.id,...d.data()};const mods=x.scopes?.modules||[];if(x.status==="approved"&&mods.includes("suppressionManagement"))rows.push(x);});return rows;};
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


/* ======================================================
   WAKESUITE V9.1 · FIREBASE OPERATIONS EXTENSION
   21 Aug 2026
====================================================== */
const WS91_FIREBASE_MODULES = [
  "dashboard","marketplaceInsights","pricingInsights","inventoryInsights",
  "amazonListing","amazonLive","amazonMrp","amazonPricingIssues","amazonPriceUpdates","amazonMinMaxUpdates",
  "amazonSuppression","amazonBuyBox","suppressionManagement",
  "flipkartListing","flipkartLive","flipkartMrp","flipkartPriceUpdates",
  "dailyCommunications","uploadCenter","masterPricing","marketplaceData","pricingExceptions","settings","dataAdministration"
];
const WS91_SUPER_PERMISSIONS = {
  view:true,search:true,download:true,upload:true,email:true,settings:true,userAdmin:true,
  suppressionOverride:true,pocEscalation:true,manageSuppressions:true,managePricingExceptions:true,
  raiseCaseId:true,managePoaQc:true,priceUpdates:true,dataAdministration:true
};
Object.assign(ACCESS_PRESETS.super_admin,WS91_SUPER_PERMISSIONS);
["viewer","analyst","admin"].forEach(role=>{
  if(!ACCESS_PRESETS[role])return;
  if(ACCESS_PRESETS[role].priceUpdates===undefined)ACCESS_PRESETS[role].priceUpdates=role!=="viewer";
  if(ACCESS_PRESETS[role].dataAdministration===undefined)ACCESS_PRESETS[role].dataAdministration=false;
});

// Super Admin cannot be accidentally restricted by stored checkbox overrides.
const ws91BaseV7mPermissions=v7mPermissions;
v7mPermissions=function(access){
  if(access?.role==="super_admin")return {...WS91_SUPER_PERMISSIONS};
  return ws91BaseV7mPermissions(access);
};
const ws91BaseV7mScopes=v7mScopes;
v7mScopes=function(access){
  if(access?.role==="super_admin")return {marketplaces:["amazon","flipkart"],categories:["*"],modules:[...WS91_FIREBASE_MODULES],scopeKeys:[],allData:true,uploadTypes:["*"],downloadTypes:["*"]};
  return ws91BaseV7mScopes(access);
};

v7mAllowedChunkTypes=function(){
  const mods=v7mScopes(window.currentWakeSuiteAccess).modules||[],has=x=>mods.includes(x),out=[];
  if(["dashboard","marketplaceInsights","pricingInsights","amazonListing","amazonLive","amazonMrp","amazonPricingIssues","amazonPriceUpdates","amazonMinMaxUpdates","marketplaceData","dailyCommunications"].some(has))out.push("amazonRows");
  if(["dashboard","marketplaceInsights","amazonSuppression","suppressionManagement","dailyCommunications"].some(has))out.push("amazonSuppressions");
  if(["dashboard","marketplaceInsights","amazonBuyBox","dailyCommunications"].some(has))out.push("amazonBuyBox");
  if(["inventoryInsights","marketplaceData"].some(has))out.push("amazonInventoryRows");
  if(["dashboard","marketplaceInsights","pricingInsights","flipkartListing","flipkartLive","flipkartMrp","flipkartPriceUpdates","marketplaceData","dailyCommunications"].some(has))out.push("flipkartRows");
  if(["inventoryInsights","marketplaceData"].some(has))out.push("flipkartInventoryRows");
  return [...new Set(out)];
};

function ws91FullAccessForRole(role,permissions,scopes){
  if(role!=="super_admin")return {permissions,scopes};
  return {permissions:{...WS91_SUPER_PERMISSIONS},scopes:{marketplaces:["amazon","flipkart"],categories:["*"],modules:[...WS91_FIREBASE_MODULES],scopeKeys:[],allData:true,uploadTypes:["*"],downloadTypes:["*"]}};
}
const ws91BaseInviteAccess=window.inviteWakeSuiteAccess;
window.inviteWakeSuiteAccess=async function(email,role,permissions,scopes){const x=ws91FullAccessForRole(role,permissions,scopes);return ws91BaseInviteAccess(email,role,x.permissions,x.scopes);};
const ws91BaseApproveAccess=window.approveWakeSuiteAccessRequest;
window.approveWakeSuiteAccessRequest=async function(uid,role,permissions,scopes){const x=ws91FullAccessForRole(role,permissions,scopes);return ws91BaseApproveAccess(uid,role,x.permissions,x.scopes);};
const ws91BaseSaveAccess=window.saveWakeSuiteAccessUser;
window.saveWakeSuiteAccessUser=async function(uid,role,permissions,scopes){const x=ws91FullAccessForRole(role,permissions,scopes);return ws91BaseSaveAccess(uid,role,x.permissions,x.scopes);};
if(window.updateWakeSuiteInvite){const base=window.updateWakeSuiteInvite;window.updateWakeSuiteInvite=async function(email,role,permissions,scopes){const x=ws91FullAccessForRole(role,permissions,scopes);return base(email,role,x.permissions,x.scopes);};}

/* ---------- Pricing exceptions: stable uniqueness includes target + rule ---------- */
window.savePricingExceptions = async function(rows){
  if(!v7mHas("managePricingExceptions"))throw new Error("Manage Pricing Exceptions permission is required.");
  const ops=[];
  for(const row of rows||[]){
    const market=String(row.marketplace||"").toLowerCase();if(!["amazon","flipkart"].includes(market))throw new Error("Pricing Exception marketplace must be Amazon or Flipkart.");
    if(!v7mMarketAllowed(market))throw new Error("The exception marketplace is outside your access scope.");
    const category=row.category||"all";if(!["all","*"].includes(String(category).toLowerCase())&&!v7mCategoryAllowed(category))throw new Error("The exception category is outside your access scope.");
    const key=[market,category,row.wfSku||"",row.azSku||"",row.asin||"",row.fkSku||"",row.fsn||"",row.target||"all_pricing",row.rule||"full_exclusion",row.exceptionType||"Pricing",row.effectiveFrom||"",row.effectiveTo||""].join("|");
    const id=`px_${v7mHash(key)}`;
    const ref=doc(db,"pricing_exceptions",id),existing=await getDoc(ref);
    ops.push({type:"set",ref,data:{...cleanForFirestore(row),marketplace:market,category,scopeKey:v7mScopeKey(market,category),status:row.status||"active",updatedBy:auth.currentUser?.email||"",updatedAt:serverTimestamp(),createdBy:existing.exists()?existing.data().createdBy:(auth.currentUser?.email||""),createdAt:existing.exists()?(existing.data().createdAt||serverTimestamp()):serverTimestamp()}});
  }
  if(ops.length)await commitBatchOps(ops,6);
};

/* ---------- Suppression override reads for state-aware management ---------- */
window.loadSuppressionOverrides=async function(fromDate,toDate){
  if(!v7mMarketAllowed("amazon"))return[];
  const from=fromDate||"0000-01-01",to=toDate||"9999-12-31";
  const snap=await getDocsFromServer(query(collection(db,"suppression_overrides"),where("reportDate",">=",from),where("reportDate","<=",to)));
  const rows=[];snap.forEach(d=>{const x={id:d.id,...d.data()};if(x.status==="active"&&v7mCategoryAllowed(x.category))rows.push(x);});
  return rows.sort((a,b)=>String(b.reportDate).localeCompare(String(a.reportDate)));
};

/* ---------- Marketplace update batches + verification ---------- */
window.saveMarketplaceUpdateBatch=async function(data){
  if(!v7mHas("priceUpdates")&&!v7mHas("download"))throw new Error("Price Updates permission is required.");
  const marketplace=String(data.marketplace||"").toLowerCase();if(!v7mMarketAllowed(marketplace))throw new Error("Marketplace is outside your access scope.");
  const rows=(data.rows||[]).filter(r=>v7mCategoryAllowed(r.category));if(!rows.length)throw new Error("No update rows are inside your access scope.");
  const id=`mu_${Date.now()}_${v7mHash(`${data.reportDate}|${marketplace}|${auth.currentUser?.uid||""}`)}`;
  const ref=doc(db,"marketplace_update_batches",id);
  await setDoc(ref,{reportDate:data.reportDate,marketplace,mode:data.mode||"price_mrp",updateType:data.updateType||"both",fileName:data.fileName||"",rowCount:rows.length,status:"Generated",generatedBy:auth.currentUser?.email||"",generatedAt:serverTimestamp(),generatedAtText:new Date().toLocaleString(),scopeKeys:[...new Set(rows.map(r=>v7mScopeKey(marketplace,r.category||"Unmapped")))]});
  const ops=[];chunkRows(rows,200).forEach((chunk,index)=>ops.push({type:"set",ref:doc(db,"marketplace_update_batches",id,"chunks",String(index).padStart(4,"0")),data:{index,rows:cleanForFirestore(chunk)}}));
  if(ops.length)await commitBatchOps(ops,6);
  return {id};
};
window.loadMarketplaceUpdateBatches=async function(){
  if(!window.currentWakeSuiteAccess)return[];
  const metaSnap=await getDocsFromServer(collection(db,"marketplace_update_batches")),metas=[];
  metaSnap.forEach(d=>{const x={id:d.id,...d.data()};if(v7mMarketAllowed(x.marketplace))metas.push(x);});
  metas.sort((a,b)=>String(b.generatedAtText||"").localeCompare(String(a.generatedAtText||"")));
  const out=[];
  for(const m of metas.slice(0,30)){
    const chunks=await getDocsFromServer(collection(db,"marketplace_update_batches",m.id,"chunks")),ordered=[];chunks.forEach(d=>ordered.push(d.data()));ordered.sort((a,b)=>Number(a.index)-Number(b.index));
    const rows=ordered.flatMap(c=>c.rows||[]).filter(r=>v7mCategoryAllowed(r.category));out.push({...m,rows});
  }
  return out;
};

/* ---------- Super Admin processed-data administration ---------- */
const WS91_CLEAR_TYPE_MAP={
  amazon_pricing:["amazonRows"],
  amazon_suppression:["amazonSuppressions"],
  amazon_buybox:["amazonBuyBox"],
  flipkart_pricing:["flipkartRows"],
  inventory:["amazonInventoryRows","flipkartInventoryRows"]
};
function ws91RequireSuperAdmin(){if(!auth.currentUser||!window.currentWakeSuiteAccess)throw new Error("Approved WakeSuite access is required.");if(window.currentWakeSuiteAccess?.role!=="super_admin")throw new Error("Data Administration is restricted to Super Admin.");}
async function ws91SnapshotChunks(reportDate){
  const metaRef=doc(db,"daily_snapshots",reportDate),metaSnap=await getDoc(metaRef);if(!metaSnap.exists())return {metaRef,meta:null,chunks:[]};
  const meta=metaSnap.data(),chunks=[];
  if(meta.schemaVersion==="v7"&&Array.isArray(meta.scopeKeys)){
    for(const scopeId of meta.scopeKeys){const s=await getDocsFromServer(collection(db,"daily_snapshots",reportDate,"scopes",scopeId,"chunks"));s.forEach(d=>chunks.push({ref:d.ref,scopeId,...d.data()}));}
  }else{const s=await getDocsFromServer(collection(db,"daily_snapshots",reportDate,"chunks"));s.forEach(d=>chunks.push({ref:d.ref,scopeId:null,...d.data()}));}
  return {metaRef,meta,chunks};
}
window.previewProcessedDataClear=async function(reportDate,types){
  ws91RequireSuperAdmin();const data=await ws91SnapshotChunks(reportDate);if(!data.meta)return {counts:{}};
  const selected=new Set((types||[]).flatMap(t=>t==="snapshot"?Object.values(WS91_CLEAR_TYPE_MAP).flat():(WS91_CLEAR_TYPE_MAP[t]||[]))),counts={};
  for(const type of selected)counts[type]=0;
  data.chunks.forEach(c=>{if(selected.has(c.type))counts[c.type]=(counts[c.type]||0)+unpackChunkRows(c.rows||[]).length;});
  return {counts,status:data.meta.status||"unknown"};
};
window.clearProcessedData=async function(reportDate,types,reason){
  ws91RequireSuperAdmin();if(!reason)throw new Error("A deletion reason is required.");if(!(types||[]).length)throw new Error("Select at least one processed dataset.");
  const data=await ws91SnapshotChunks(reportDate);if(!data.meta)throw new Error("The selected processed snapshot does not exist.");
  const full=types.includes("snapshot");
  if(full){
    for(const scopeId of data.meta.scopeKeys||[]){await v7mDeleteScope(doc(db,"daily_snapshots",reportDate,"scopes",scopeId));}
    const legacy=await getDocsFromServer(collection(db,"daily_snapshots",reportDate,"chunks"));const dels=[];legacy.forEach(d=>dels.push({type:"delete",ref:d.ref}));if(dels.length)await commitBatchOps(dels,6);await deleteDoc(data.metaRef);
  }else{
    const selected=new Set(types.flatMap(t=>WS91_CLEAR_TYPE_MAP[t]||[])),dels=data.chunks.filter(c=>selected.has(c.type)).map(c=>({type:"delete",ref:c.ref}));if(dels.length)await commitBatchOps(dels,6);
    await setDoc(data.metaRef,{dataStatus:"partial",updatedBy:auth.currentUser?.email||"",updatedAt:serverTimestamp()},{merge:true});
  }
  const auditId=`clear_${Date.now()}_${v7mHash(reportDate+reason)}`;await setDoc(doc(db,"system_audit_log",auditId),{action:"processed_data_clear",reportDate,types:cleanForFirestore(types),reason,deletedBy:auth.currentUser?.email||auth.currentUser?.uid||"",deletedAt:serverTimestamp(),deletedAtText:new Date().toLocaleString()});
};
window.loadDataAdminAudit=async function(){
  ws91RequireSuperAdmin();const snap=await getDocsFromServer(query(collection(db,"system_audit_log"),where("action","==","processed_data_clear"))),rows=[];snap.forEach(d=>rows.push({id:d.id,...d.data()}));return rows.sort((a,b)=>String(b.deletedAtText||"").localeCompare(String(a.deletedAtText||""))).slice(0,100);
};

// Make module namespace reflect V9.1 extension for diagnostics.
window.wakeSuiteFirebase.version="9.1.0";

/* ======================================================
   WakeSuite V9.2 Firebase additions · 22 Aug 2026
====================================================== */
window.updatePricingExceptionRecord = async function(id,patch){
  if(!v7mHas("managePricingExceptions"))throw new Error("Manage Pricing Exceptions permission is required.");
  if(!id)throw new Error("Pricing Exception id is required.");
  const ref=doc(db,"pricing_exceptions",id),snap=await getDoc(ref);if(!snap.exists())throw new Error("Pricing Exception was not found.");
  const current=snap.data(),market=String(current.marketplace||"").toLowerCase(),category=String(current.category||"all");
  if(!v7mMarketAllowed(market)||(!["all","*"].includes(category.toLowerCase())&&!v7mCategoryAllowed(category)))throw new Error("Pricing Exception is outside your access scope.");
  await setDoc(ref,{...cleanForFirestore(patch||{}),updatedBy:auth.currentUser?.email||auth.currentUser?.uid||"",updatedAt:serverTimestamp()},{merge:true});
};
window.removePricingExceptionRecord = async function(id,removalRemarks=""){
  if(!v7mHas("managePricingExceptions"))throw new Error("Manage Pricing Exceptions permission is required.");
  if(!id)throw new Error("Pricing Exception id is required.");
  const ref=doc(db,"pricing_exceptions",id),snap=await getDoc(ref);if(!snap.exists())throw new Error("Pricing Exception was not found.");
  const row=snap.data(),market=String(row.marketplace||"").toLowerCase(),category=String(row.category||"all");
  if(!v7mMarketAllowed(market)||(!["all","*"].includes(category.toLowerCase())&&!v7mCategoryAllowed(category)))throw new Error("Pricing Exception is outside your access scope.");
  await setDoc(ref,{status:"removed",removedBy:auth.currentUser?.email||auth.currentUser?.uid||"",removedAt:serverTimestamp(),removalRemarks:String(removalRemarks||""),updatedBy:auth.currentUser?.email||auth.currentUser?.uid||"",updatedAt:serverTimestamp()},{merge:true});
};
window.saveAmazonPricingIssueOverride = async function(data){
  if(!v7mHas("priceUpdates")&&!v7mHas("managePricingExceptions"))throw new Error("Pricing Issues permission is required.");
  if(!data?.reportDate||!data?.azSku)throw new Error("Report date and AZ SKU are required.");
  if(!v7mMarketAllowed("amazon")||!v7mCategoryAllowed(data.category||"Unmapped"))throw new Error("Pricing Issue is outside your access scope.");
  const issue=String(data.issueType||"min_max").toLowerCase(),id=`${data.reportDate}_${v7mHash(`${data.azSku}|${issue}`)}`;
  await setDoc(doc(db,"amazon_pricing_issue_overrides",id),{...cleanForFirestore(data),marketplace:"amazon",treatment:"No Pricing Issue",status:"active",scopeKey:v7mScopeKey("amazon",data.category||"Unmapped"),updatedBy:auth.currentUser?.email||"",updatedAt:serverTimestamp(),createdBy:auth.currentUser?.email||"",createdAt:serverTimestamp()},{merge:true});
};
window.loadAmazonPricingIssueOverrides = async function(reportDate){
  if(!window.currentWakeSuiteAccess||!v7mMarketAllowed("amazon"))return[];
  const snap=await getDocsFromServer(query(collection(db,"amazon_pricing_issue_overrides"),where("reportDate","==",reportDate)));
  const out=[];snap.forEach(d=>{const x={id:d.id,...d.data()};if(x.status==="active"&&v7mCategoryAllowed(x.category))out.push(x);});return out;
};


/* ======================================================
   WakeSuite V9.3 Firebase additions · 23 Aug 2026
   Granular administration, suppression audit and authoritative access
====================================================== */
const WS93_CLEAR_TYPE_MAP={
  amazon_pricing:["amazonRows"],
  amazon_suppression:["amazonSuppressions"],
  amazon_buybox:["amazonBuyBox"],
  flipkart_pricing:["flipkartRows"],
  inventory:["amazonInventoryRows","flipkartInventoryRows"],
  marketplace_data:["amazonRows","flipkartRows","amazonInventoryRows","flipkartInventoryRows"],
  business_history:["amazonRows","flipkartRows","amazonInventoryRows","flipkartInventoryRows"]
};
function ws93RequireSuperAdmin(){
  if(!auth.currentUser||!window.currentWakeSuiteAccess)throw new Error("Approved WakeSuite access is required.");
  if(window.currentWakeSuiteAccess.role!=="super_admin")throw new Error("Data Administration is restricted to Super Admin.");
}
function ws93ChunkMarket(type){return String(type||"").startsWith("amazon")?"amazon":String(type||"").startsWith("flipkart")?"flipkart":"all";}
function ws93RowMatches(row,opts={}){
  const text=(Array.isArray(row)?row:Object.values(row||{})).map(v=>String(v??"")).join(" ").toLowerCase();
  const identifier=String(opts.identifier||"").trim().toLowerCase();
  const category=String(opts.category||"all").trim().toLowerCase();
  const status=String(opts.status||"all").trim().toLowerCase();
  if(identifier&&!text.includes(identifier))return false;
  if(category!=="all"&&!text.includes(category))return false;
  if(status!=="all"&&!text.includes(status))return false;
  return true;
}
function ws93SelectedChunkTypes(types){
  const out=new Set();
  (types||[]).forEach(t=>{
    if(t==="snapshot")Object.values(WS93_CLEAR_TYPE_MAP).flat().forEach(x=>out.add(x));
    else (WS93_CLEAR_TYPE_MAP[t]||[]).forEach(x=>out.add(x));
  });
  return out;
}
function ws93RowKey(reportDate,type,row){return `snap|${reportDate}|${type}|${v7mHash(JSON.stringify(row))}`;}
function ws93DescribeRow(type,row){
  let x=row;
  try{
    if(Array.isArray(row)&&type==="amazonRows"&&typeof window.expandAmazonRow==="function")x=window.expandAmazonRow(row);
    else if(Array.isArray(row)&&type==="flipkartRows"&&typeof window.expandFlipkartRow==="function")x=window.expandFlipkartRow(row);
  }catch(_e){x=row;}
  const obj=(!Array.isArray(x)&&x&&typeof x==="object")?x:{};
  const identifier=obj.asin||obj.fsn||obj.azSku||obj.fkSku||obj.wfSku||obj.identifier||obj.marketSku||"";
  const category=obj.category||"";
  const status=obj.status||obj.currentState||obj.parityStatus||obj.buyBoxStatus||obj.suppressionStatus||"";
  const fallback=Array.isArray(row)?row.filter(v=>typeof v==="string"&&v.trim()).slice(0,3).join(" · "):"";
  return {identifier:String(identifier||fallback||""),category:String(category||""),status:String(status||"")};
}
async function ws93CollectionRows(collectionName,predicate=()=>true){
  const snap=await getDocsFromServer(collection(db,collectionName)),rows=[];
  snap.forEach(d=>{const x={id:d.id,...d.data()};if(predicate(x))rows.push(x);});
  return rows;
}
async function ws93PreviewExtraCollections(opts,counts,records){
  const types=new Set(opts.types||[]),date=opts.reportDate;
  if(types.has("amazon_pricing_issues")){
    const rows=await ws93CollectionRows("amazon_pricing_issue_overrides",r=>r.reportDate===date&&ws93RowMatches(r,opts));
    counts.amazon_pricing_issues=rows.length;
    rows.forEach(r=>records.push({key:`col|amazon_pricing_issue_overrides|${r.id}`,date,dataset:"amazon_pricing_issues",marketplace:"amazon",category:r.category||"",identifier:r.asin||r.azSku||"",status:r.treatment||r.status||"No Pricing Issue"}));
  }
  if(types.has("amazon_price_updates")||types.has("flipkart_price_updates")){
    const rows=await ws93CollectionRows("marketplace_update_batches",r=>r.reportDate===date&&(!opts.marketplace||opts.marketplace==="all"||r.marketplace===opts.marketplace));
    if(types.has("amazon_price_updates")){
      const az=rows.filter(r=>r.marketplace==="amazon");counts.amazon_price_updates=az.reduce((n,r)=>n+Number(r.rowCount||0),0);
      az.forEach(r=>records.push({key:`batch|marketplace_update_batches|${r.id}`,date,dataset:"amazon_price_updates",marketplace:"amazon",category:"",identifier:r.fileName||r.id,status:r.status||""}));
    }
    if(types.has("flipkart_price_updates")){
      const fk=rows.filter(r=>r.marketplace==="flipkart");counts.flipkart_price_updates=fk.reduce((n,r)=>n+Number(r.rowCount||0),0);
      fk.forEach(r=>records.push({key:`batch|marketplace_update_batches|${r.id}`,date,dataset:"flipkart_price_updates",marketplace:"flipkart",category:"",identifier:r.fileName||r.id,status:r.status||""}));
    }
  }
  if(types.has("pricing_exceptions")){
    const rows=await ws93CollectionRows("pricing_exceptions",r=>{
      const from=String(r.effectiveFrom||r.reportDate||"0000-01-01"),to=String(r.effectiveTo||r.reportDate||"9999-12-31");
      return from<=date&&to>=date&&(!opts.marketplace||opts.marketplace==="all"||String(r.marketplace||"").toLowerCase()===opts.marketplace)&&ws93RowMatches(r,opts);
    });
    counts.pricing_exceptions=rows.length;
    rows.forEach(r=>records.push({key:`col|pricing_exceptions|${r.id}`,date,dataset:"pricing_exceptions",marketplace:r.marketplace||"",category:r.category||"",identifier:r.asin||r.fsn||r.azSku||r.fkSku||r.wfSku||"",status:r.status||"active"}));
  }
}
window.previewProcessedDataV93=async function(opts={}){
  ws93RequireSuperAdmin();
  const reportDate=String(opts.reportDate||"");if(!reportDate)throw new Error("Report date is required.");
  const types=Array.isArray(opts.types)?opts.types:[],counts={},records=[],scope=String(opts.scope||"selected");
  const data=await ws91SnapshotChunks(reportDate),selected=ws93SelectedChunkTypes(types);
  const wholeSnapshot=scope==="snapshot"||(types.includes("snapshot")&&scope==="dataset");
  if(wholeSnapshot){
    counts.snapshot=data.meta?data.chunks.reduce((n,c)=>n+unpackChunkRows(c.rows||[]).length,0):0;
    return {counts,records};
  }
  for(const type of selected)counts[type]=0;
  if(data.meta){
    data.chunks.forEach(c=>{
      if(!selected.has(c.type))return;
      const market=ws93ChunkMarket(c.type);if(opts.marketplace&&opts.marketplace!=="all"&&market!==opts.marketplace)return;
      const matched=unpackChunkRows(c.rows||[]).filter(r=>ws93RowMatches(r,opts));counts[c.type]=(counts[c.type]||0)+matched.length;
      matched.forEach(r=>{const d=ws93DescribeRow(c.type,r);records.push({key:ws93RowKey(reportDate,c.type,r),date:reportDate,dataset:c.type,marketplace:market,category:d.category,identifier:d.identifier,status:d.status});});
    });
  }
  await ws93PreviewExtraCollections(opts,counts,records);
  return {counts,records};
};
async function ws93DeleteBatchDocWithChunks(ref){const chunks=await getDocsFromServer(collection(ref,"chunks")),ops=[];chunks.forEach(d=>ops.push({type:"delete",ref:d.ref}));if(ops.length)await commitBatchOps(ops,6);await deleteDoc(ref);}
async function ws93DeleteExtraCollections(opts){
  const types=new Set(opts.types||[]),date=opts.reportDate,ops=[],selected=new Set(opts.selectedKeys||[]),selectedOnly=opts.scope==="selected"&&selected.size;
  if(types.has("amazon_pricing_issues")){
    const rows=await ws93CollectionRows("amazon_pricing_issue_overrides",r=>r.reportDate===date&&ws93RowMatches(r,opts));
    rows.filter(r=>!selectedOnly||selected.has(`col|amazon_pricing_issue_overrides|${r.id}`)).forEach(r=>ops.push({type:"delete",ref:doc(db,"amazon_pricing_issue_overrides",r.id)}));
  }
  if(types.has("pricing_exceptions")){
    const rows=await ws93CollectionRows("pricing_exceptions",r=>{const from=String(r.effectiveFrom||r.reportDate||"0000-01-01"),to=String(r.effectiveTo||r.reportDate||"9999-12-31");return from<=date&&to>=date&&(!opts.marketplace||opts.marketplace==="all"||String(r.marketplace||"").toLowerCase()===opts.marketplace)&&ws93RowMatches(r,opts);});
    rows.filter(r=>!selectedOnly||selected.has(`col|pricing_exceptions|${r.id}`)).forEach(r=>ops.push({type:"delete",ref:doc(db,"pricing_exceptions",r.id)}));
  }
  if(ops.length)await commitBatchOps(ops,6);
  if(types.has("amazon_price_updates")||types.has("flipkart_price_updates")){
    const rows=await ws93CollectionRows("marketplace_update_batches",r=>r.reportDate===date&&((types.has("amazon_price_updates")&&r.marketplace==="amazon")||(types.has("flipkart_price_updates")&&r.marketplace==="flipkart")));
    for(const r of rows){if(selectedOnly&&!selected.has(`batch|marketplace_update_batches|${r.id}`))continue;await ws93DeleteBatchDocWithChunks(doc(db,"marketplace_update_batches",r.id));}
  }
}
window.clearProcessedDataV93=async function(opts={}){
  ws93RequireSuperAdmin();
  const reportDate=String(opts.reportDate||""),types=Array.isArray(opts.types)?opts.types:[],reason=String(opts.reason||"").trim();
  if(!reportDate)throw new Error("Report date is required.");if(!types.length)throw new Error("Select at least one processed dataset.");if(!reason)throw new Error("A deletion reason is required.");
  const scope=String(opts.scope||"selected"),selectedKeys=new Set(opts.selectedKeys||[]);
  if(scope==="selected"&&!selectedKeys.size)throw new Error("Select at least one preview record before deleting selected records.");
  const wholeSnapshot=scope==="snapshot"||(types.includes("snapshot")&&scope==="dataset");
  if(wholeSnapshot){
    const data=await ws91SnapshotChunks(reportDate);
    if(data.meta){for(const scopeId of data.meta.scopeKeys||[])await v7mDeleteScope(doc(db,"daily_snapshots",reportDate,"scopes",scopeId));const legacy=await getDocsFromServer(collection(db,"daily_snapshots",reportDate,"chunks")),ops=[];legacy.forEach(d=>ops.push({type:"delete",ref:d.ref}));if(ops.length)await commitBatchOps(ops,6);await deleteDoc(data.metaRef);}
  }else{
    const data=await ws91SnapshotChunks(reportDate),selectedTypes=ws93SelectedChunkTypes(types),datasetWide=scope==="dataset",ops=[];
    for(const c of data.chunks){
      if(!selectedTypes.has(c.type))continue;
      const market=ws93ChunkMarket(c.type);if(opts.marketplace&&opts.marketplace!=="all"&&market!==opts.marketplace)continue;
      const rows=unpackChunkRows(c.rows||[]);
      if(datasetWide){ops.push({type:"delete",ref:c.ref});continue;}
      const shouldDelete=r=>scope==="selected"?selectedKeys.has(ws93RowKey(reportDate,c.type,r)):ws93RowMatches(r,opts);
      const kept=rows.filter(r=>!shouldDelete(r));
      if(kept.length===rows.length)continue;
      if(!kept.length)ops.push({type:"delete",ref:c.ref});
      else ops.push({type:"set",ref:c.ref,data:{...c,ref:undefined,rows:packChunkRows(kept)}});
    }
    if(ops.length)await commitBatchOps(ops,6);
    if(data.meta&&ops.length)await setDoc(data.metaRef,{dataStatus:"partial",updatedBy:auth.currentUser?.email||"",updatedAt:serverTimestamp()},{merge:true});
  }
  await ws93DeleteExtraCollections({...opts,selectedKeys:[...selectedKeys]});
  const id=`admin_${Date.now()}_${v7mHash(reportDate+reason+JSON.stringify(types))}`;
  await setDoc(doc(db,"system_audit_log",id),{action:"processed_data_clear",reportDate,types:cleanForFirestore(types),scope,marketplace:opts.marketplace||"all",category:opts.category||"all",status:opts.status||"all",identifier:opts.identifier||"",selectedRecordCount:selectedKeys.size,reason,deletedBy:auth.currentUser?.email||auth.currentUser?.uid||"",deletedAt:serverTimestamp(),deletedAtText:new Date().toLocaleString()});
  return {ok:true};
};
window.deleteSourceVersionV93=async function(data={}){
  ws93RequireSuperAdmin();const reason=String(data.reason||"").trim();if(!reason)throw new Error("A deletion reason is required.");
  const id=`source_${Date.now()}_${v7mHash(String(data.versionId||data.fileName||"")+reason)}`;
  await setDoc(doc(db,"system_audit_log",id),{action:"source_version_delete",reportDate:data.reportDate||"",sourceType:data.configId||data.sourceType||"",fileName:data.fileName||"",versionId:data.versionId||"",affectedProcessedTypes:cleanForFirestore(data.affectedProcessedTypes||[]),reason,deletedBy:auth.currentUser?.email||auth.currentUser?.uid||"",deletedAt:serverTimestamp(),deletedAtText:new Date().toLocaleString()});
  return {ok:true};
};
window.loadDataAdminAudit=async function(){
  ws93RequireSuperAdmin();const snap=await getDocsFromServer(collection(db,"system_audit_log")),rows=[];snap.forEach(d=>{const x={id:d.id,...d.data()};if(["processed_data_clear","source_version_delete","source_file_delete"].includes(x.action))rows.push(x);});return rows.sort((a,b)=>String(b.deletedAtText||b.createdAtText||"").localeCompare(String(a.deletedAtText||a.createdAtText||""))).slice(0,500);
};
window.saveSuppressionCaseAudit=async function(data={}){
  if(!v7mMarketAllowed("amazon"))throw new Error("Amazon access is required.");
  const id=`sca_${Date.now()}_${v7mHash(String(data.asin||data.caseId||"")+JSON.stringify(data))}`;
  await setDoc(doc(db,"suppression_case_audit",id),{...cleanForFirestore(data),marketplace:"amazon",user:auth.currentUser?.email||auth.currentUser?.uid||"",createdAt:serverTimestamp(),createdAtText:new Date().toLocaleString()});
};
window.loadSuppressionCaseAudit=async function(asin=""){
  if(!v7mMarketAllowed("amazon"))return[];const rows=await ws93CollectionRows("suppression_case_audit",r=>!asin||r.asin===asin);return rows.sort((a,b)=>String(b.createdAtText||"").localeCompare(String(a.createdAtText||"")));
};
const ws93BaseUpdateSuppressionCase=window.updateSuppressionCase;
window.updateSuppressionCase=async function(id,patch={}){
  const canManage=v7mHas("manageSuppressions"),canPoc=v7mHas("pocEscalation"),canCase=v7mHas("raiseCaseId"),canDocs=v7mHas("managePoaQc");
  if(!canManage&&!canPoc&&!canCase&&!canDocs)throw new Error("Suppression Management permission is required.");
  const ref=doc(db,"suppression_cases",id),beforeSnap=await getDoc(ref),before=beforeSnap.exists()?beforeSnap.data():{},allowed={},nowText=new Date().toISOString();
  if(canManage)["assignees","teamAssigned","owner","status","notes","followUpDate"].forEach(k=>{if(k in patch)allowed[k]=patch[k];});
  if(canCase&&"caseId" in patch){allowed.caseId=patch.caseId;if(patch.caseId&&!before.caseId)allowed.caseIdRaisedOn=patch.caseIdRaisedOn||nowText;}
  if(canDocs){if("poaStatus" in patch){allowed.poaStatus=patch.poaStatus;if(patch.poaStatus!==before.poaStatus)allowed.poaSubmittedOn=patch.poaSubmittedOn||nowText;}if("qcStatus" in patch){allowed.qcStatus=patch.qcStatus;if(patch.qcStatus!==before.qcStatus)allowed.qcSubmittedOn=patch.qcSubmittedOn||nowText;}}
  if(canPoc&&"pocEscalationStatus" in patch){allowed.pocEscalationStatus=patch.pocEscalationStatus;if(patch.pocEscalationStatus!==before.pocEscalationStatus)allowed.pocEscalatedOn=patch.pocEscalatedOn||nowText;}
  await setDoc(ref,{...cleanForFirestore(allowed),updatedBy:auth.currentUser?.email||"",updatedAt:serverTimestamp()},{merge:true});
};
window.syncSuppressionLifecycleState=async function(id,patch={}){
  if(!v7mHas("manageSuppressions")&&!v7mHas("upload"))return false;
  const allowed={};["suppressionState","firstSeen","lastSeen","resolvedOn","lastAuditDate"].forEach(k=>{if(k in patch)allowed[k]=patch[k];});
  if(!Object.keys(allowed).length)return false;
  await setDoc(doc(db,"suppression_cases",id),{...cleanForFirestore(allowed),updatedBy:auth.currentUser?.email||"",updatedAt:serverTimestamp()},{merge:true});return true;
};
window.loadDataAdminAudit=async function(){
  ws93RequireSuperAdmin();const snap=await getDocsFromServer(collection(db,"system_audit_log")),rows=[];snap.forEach(d=>{const x={id:d.id,...d.data()};if(["processed_data_clear","source_version_delete","source_file_delete"].includes(x.action))rows.push(x);});return rows.sort((a,b)=>String(b.deletedAtText||b.createdAtText||"").localeCompare(String(a.deletedAtText||a.createdAtText||""))).slice(0,500);
};
window.wakeSuiteFirebase.version="9.3.2";
