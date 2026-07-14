// js/app.js — DCSG System Architecture & Full Engine
const CLOUD_URL = "https://script.google.com/macros/s/AKfycbyRxwiLp4JYaWkl2oR1omTycfPm3WIsBBfDbw91Ycbdeqi9AC2KGd5Xg0IEO6z2LevM/exec";
const URL_VALUATION = "https://darintrade-7vp8ee75.manus.space"; 
const URL_PAWN = "https://app-tooltify.com/sign-in"; 

// System States
let userPermissions = { val: "No", pawn: "No", calc: "No" };
let allBranchRatesMap = {}; 
let branchRatesConfig = { gb_t1:100, gb_t2:120, gb_t3:150, gb_t4:200, gj_t1:200, gj_t2:220, gj_t3:250, gj_t4:300, gm_t1:200, gm_t2:500, gm_t3:400, gm_t4:300, gm_t5:250, gm_t6:200, gm_t7:150, gm_t8:125, gm_t9:100 }; 
let myAllowedBranches = [];
let currentShopName = ""; 
let currentBranchName = ""; 
let currentUserRole = "";
let batchBillItems = [];
let cloudTransactionsCache = [];

// Classic Calculator States
let ccCurrentMode = 'GOLD'; 
let ccGoldRecords = [];
let ccSilverRecords = [];
let ccPricePerGram = 0;
let ccRawAmount = 0;
let ccFinalPay = 0;
let ccSavedHistory = JSON.parse(localStorage.getItem('darin_calc_history')) || [];

// ================= DEVICE & AUTH ENGINE =================
function getOrCreateDeviceToken() {
    let token = localStorage.getItem('dcsg_device_token');
    if (!token) {
        token = 'DCSG-DEV-' + Math.random().toString(36).substring(2, 11).toUpperCase();
        localStorage.setItem('dcsg_device_token', token);
    }
    return token;
}

function getStoredCredentials() {
    return {
        user: localStorage.getItem('DCSG_CURRENT_USER') || "",
        pass: localStorage.getItem('DCSG_CURRENT_PASS') || "",
        token: getOrCreateDeviceToken()
    };
}

function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(v => {
        v.classList.remove('active');
        v.style.setProperty('display', 'none', 'important');
    });
    
    const target = document.getElementById(viewId);
    if (!target) return;
    target.classList.add('active');
    if (viewId === 'loginView') {
        target.style.setProperty('display', 'flex', 'important');
    } else {
        target.style.setProperty('display', 'block', 'important');
    }
}

// 🔀 ฟังก์ชันสลับแท็บ Login / Register
function switchAuthTab(mode) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const successView = document.getElementById('successView');
    const tabLoginBtn = document.getElementById('tabLoginBtn');
    const tabRegisterBtn = document.getElementById('tabRegisterBtn');
    const errorEl = document.getElementById('loginErrorMsg');

    if (errorEl) errorEl.innerText = "";

    if (mode === 'login') {
        if (tabLoginBtn) tabLoginBtn.className = 'tab-btn active';
        if (tabRegisterBtn) tabRegisterBtn.className = 'tab-btn';
        if (loginForm) loginForm.style.display = 'block';
        if (registerForm) registerForm.style.display = 'none';
        if (successView) successView.style.display = 'none';
    } else {
        if (tabRegisterBtn) tabRegisterBtn.className = 'tab-btn active';
        if (tabLoginBtn) tabLoginBtn.className = 'tab-btn';
        if (loginForm) loginForm.style.display = 'none';
        if (registerForm) registerForm.style.display = 'block';
        if (successView) successView.style.display = 'none';
    }
}

// 📝 ฟังก์ชันยิงข้อมูลลงทะเบียนเข้า Google Sheet
function triggerLiveStoreSignup() {
    const shop = document.getElementById('regShop').value.trim();
    const display = document.getElementById('regDisplay').value.trim();
    const user = document.getElementById('regUser').value.trim();
    const pass = document.getElementById('regPass').value.trim();
    const role = document.getElementById('regRole').value;
    const errorEl = document.getElementById('loginErrorMsg');
    const loadingEl = document.getElementById('authLoading');

    if (!shop || !display || !user || !pass) {
        if (errorEl) errorEl.innerText = "⚠️ กรุณากรอกข้อมูลลงทะเบียนให้ครบทุกช่อง";
        return;
    }

    if (errorEl) errorEl.innerText = "";
    if (loadingEl) loadingEl.style.display = 'flex';

    fetch(`${CLOUD_URL}?action=registerUser&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}&role=${encodeURIComponent(role)}&displayName=${encodeURIComponent(display)}&shop=${encodeURIComponent(shop)}&_ts=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
            if (loadingEl) loadingEl.style.display = 'none';
            document.getElementById('registerForm').style.display = 'none';
            document.getElementById('successView').style.display = 'block';
        })
        .catch(err => {
            console.error("Register Error:", err);
            if (loadingEl) loadingEl.style.display = 'none';
            document.getElementById('registerForm').style.display = 'none';
            document.getElementById('successView').style.display = 'block';
        });
}

function backToLoginView() {
    document.getElementById('regShop').value = "";
    document.getElementById('regDisplay').value = "";
    document.getElementById('regUser').value = "";
    document.getElementById('regPass').value = "";
    switchAuthTab('login');
}

function triggerLiveStoreLogin() {
    const userEl = document.getElementById('loginUser');
    const passEl = document.getElementById('loginPass');
    const errorEl = document.getElementById('loginErrorMsg');
    const loadingEl = document.getElementById('authLoading');

    if (!userEl || !passEl) return;

    const user = userEl.value.trim();
    const pass = passEl.value.trim();
    const token = getOrCreateDeviceToken();

    if (!user || !pass) {
        if (errorEl) errorEl.innerText = "⚠️ กรุณากรอก Username และ Password";
        return;
    }

    if (errorEl) errorEl.innerText = "";
    if (loadingEl) loadingEl.style.display = 'flex';

    fetch(`${CLOUD_URL}?action=loginCheck&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}&token=${encodeURIComponent(token)}&_ts=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
            if (loadingEl) loadingEl.style.display = 'none';
            if (data.success) {
                localStorage.setItem('DCSG_CURRENT_USER', user);
                localStorage.setItem('DCSG_CURRENT_PASS', pass);
                
                userPermissions = data.permissions || { val: "Yes", pawn: "Yes", calc: "Yes" };
                
                const pName = document.getElementById('portalUserDisplayName');
                if (pName) pName.innerText = `${data.displayName || user} (${data.shop || ''})`;

                applyPermissionsUI();
                renderDashboardWorkspace(data, user);
                switchView('portalView');
            } else {
                if (errorEl) errorEl.innerText = "❌ ปฏิเสธการเข้าสู่ระบบ: " + (data.message || "รหัสผ่านไม่ถูกต้อง");
            }
        })
        .catch(err => {
            console.error("Login Error:", err);
            if (loadingEl) loadingEl.style.display = 'none';
            if (errorEl) errorEl.innerText = "❌ ระบบขัดข้อง: ไม่สามารถติดต่อเซิร์ฟเวอร์หลังบ้านได้";
        });
}

function checkAutoLoginSession() {
    const savedUser = localStorage.getItem('DCSG_CURRENT_USER');
    const savedPass = localStorage.getItem('DCSG_CURRENT_PASS');
    const token = getOrCreateDeviceToken();
    const loadingEl = document.getElementById('authLoading');

    if (savedUser && savedPass) {
        if (loadingEl) loadingEl.style.display = 'flex';
        fetch(`${CLOUD_URL}?action=loginCheck&user=${encodeURIComponent(savedUser)}&pass=${encodeURIComponent(savedPass)}&token=${encodeURIComponent(token)}&_ts=${Date.now()}`)
            .then(res => res.json())
            .then(data => {
                if (loadingEl) loadingEl.style.display = 'none';
                if (data.success) {
                    userPermissions = data.permissions || { val: "Yes", pawn: "Yes", calc: "Yes" };
                    const pName = document.getElementById('portalUserDisplayName');
                    if (pName) pName.innerText = `${data.displayName || savedUser} (${data.shop || ''})`;

                    applyPermissionsUI();
                    renderDashboardWorkspace(data, savedUser);
                    switchView('portalView');
                } else {
                    localStorage.removeItem('DCSG_CURRENT_USER');
                    localStorage.removeItem('DCSG_CURRENT_PASS');
                    switchView('loginView');
                }
            })
            .catch(() => {
                if (loadingEl) loadingEl.style.display = 'none';
                switchView('loginView');
            });
    } else {
        switchView('loginView');
    }
}

// ================= PORTAL ACCESS CONTROL =================
function applyPermissionsUI() {
    const cardVal = document.getElementById('cardValuation');
    if (cardVal) {
        if (userPermissions.val === "Yes") cardVal.classList.remove('locked');
        else cardVal.classList.add('locked');
    }

    const cardPawn = document.getElementById('cardPawn');
    if (cardPawn) {
        if (userPermissions.pawn === "Yes") cardPawn.classList.remove('locked');
        else cardPawn.classList.add('locked');
    }

    const cardCalc = document.getElementById('cardCalc');
    if (cardCalc) {
        if (userPermissions.calc === "Yes") cardCalc.classList.remove('locked');
        else cardCalc.classList.add('locked');
    }
}

function launchValuation() {
    if (userPermissions.val !== "Yes") { alert("🚫 บัญชีของคุณไม่มีสิทธิ์เข้าใช้งานระบบประเมินราคา (โปรดติดต่อแอดมิน)"); return; }
    window.open(URL_VALUATION, '_blank');
}

function launchPawn() {
    if (userPermissions.pawn !== "Yes") { alert("🚫 บัญชีของคุณไม่มีสิทธิ์เข้าใช้งานระบบรับฝากจำนำ (โปรดติดต่อแอดมิน)"); return; }
    window.open(URL_PAWN, '_blank');
}

function launchCalculator() {
    if (userPermissions.calc !== "Yes") { alert("🚫 บัญชีของคุณไม่มีสิทธิ์เข้าใช้งานระบบคำนวณราคาทองคำ (โปรดติดต่อแอดมิน)"); return; }
    switchView('calculatorView');
    calculatePriceLogic();
    fetchTransactionsFromCloud();
}

function returnToPortal() {
    switchView('portalView');
}

function triggerStoreLogout() {
    stopAutoRefresh();
    localStorage.removeItem('DCSG_CURRENT_USER');
    localStorage.removeItem('DCSG_CURRENT_PASS');
    currentShopName = ""; currentBranchName = ""; currentUserRole = "";
    
    const uInput = document.getElementById('loginUser');
    const pInput = document.getElementById('loginPass');
    if (uInput) uInput.value = "";
    if (pInput) pInput.value = "";
    
    switchAuthTab('login');
    switchView('loginView');
}

// ================= DASHBOARD & CALCULATOR ENGINE =================
function renderDashboardWorkspace(data, user) {
    currentShopName = data.shop || (user.indexOf("_") !== -1 ? user.split("_")[0] : data.displayName);
    currentUserRole = data.role;
    myAllowedBranches = data.allowedBranches ? data.allowedBranches.split(", ") : ["สาขา 1"];
    currentBranchName = myAllowedBranches[0]; 

    applyRatesFromServer(data.rates);
    
    const shopTitle = document.getElementById('displayShopTitle');
    if (shopTitle) shopTitle.innerText = data.displayName || "Darin Collection";
    
    refreshBranchSelectors();
    
    const roleTag = document.getElementById('displayRoleTag');
    if (roleTag) {
        if (currentUserRole === "Owner") {
            roleTag.innerText = "👑 เจ้าของร้าน (Owner)";
            roleTag.style.background = "#b38e6d";
        } else {
            roleTag.innerText = "👤 พนักงาน (Staff)";
            roleTag.style.background = "#4a3b32";
        }
    }

    calculatePriceLogic();
    fetchTransactionsFromCloud();
    startAutoRefresh();
}

function applyRatesFromServer(serverRates) {
    if (serverRates && typeof serverRates === 'object') {
        if (Object.keys(serverRates).some(k => typeof serverRates[k] === 'object')) {
            allBranchRatesMap = serverRates;
        } else {
            allBranchRatesMap["default"] = serverRates;
        }
        updateActiveBranchRate();
    }
}

function updateActiveBranchRate() {
    if (allBranchRatesMap[currentBranchName]) {
        branchRatesConfig = allBranchRatesMap[currentBranchName];
    } else if (Object.keys(allBranchRatesMap).length > 0) {
        const firstBranch = Object.keys(allBranchRatesMap)[0];
        branchRatesConfig = allBranchRatesMap[firstBranch];
    }
}

function refreshRatesFromCloud() {
    const creds = getStoredCredentials();
    if (!creds.user || !creds.pass) return;
    fetch(`${CLOUD_URL}?action=loginCheck&user=${encodeURIComponent(creds.user)}&pass=${encodeURIComponent(creds.pass)}&token=${encodeURIComponent(creds.token)}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                applyRatesFromServer(data.rates);
                calculatePriceLogic();
            }
        })
        .catch(() => {});
}

function refreshBranchSelectors() {
    const knownBranches = new Set(myAllowedBranches.filter(b => b));
    cloudTransactionsCache.forEach(item => { if (item.branch) knownBranches.add(item.branch); });
    const branchArray = Array.from(knownBranches);

    const calcSel = document.getElementById('calcBranchSelector');
    if (calcSel) {
        const prevValue = calcSel.value || currentBranchName;
        calcSel.innerHTML = branchArray.map(b => `<option value="${b}">${b}</option>`).join('');
        calcSel.value = branchArray.includes(prevValue) ? prevValue : branchArray[0];
        currentBranchName = calcSel.value;
        updateActiveBranchRate();
    }

    const filterSel = document.getElementById('dashboardBranchFilter');
    if (filterSel) {
        const prevFilter = filterSel.value || 'all';
        filterSel.innerHTML = `<option value="all">ทุกสาขา</option>` + branchArray.map(b => `<option value="${b}">${b}</option>`).join('');
        filterSel.value = (prevFilter === 'all' || branchArray.includes(prevFilter)) ? prevFilter : 'all';
    }
}

function onBranchSelectorChange() {
    const calcSel = document.getElementById('calcBranchSelector');
    if (calcSel) {
        currentBranchName = calcSel.value;
        updateActiveBranchRate();
        calculatePriceLogic();
    }
}

function getRateValue(val, fallback) {
    if (val !== undefined && val !== null && val !== "" && !isNaN(Number(val))) {
        return Number(val);
    }
    return fallback;
}

function calculatePriceLogic() {
    const basePriceEl = document.getElementById('basePrice');
    const weightGramsEl = document.getElementById('weightGrams');
    const goldTypeEl = document.getElementById('goldType');
    const silverTypeEl = document.getElementById('silverType');
    const meltedPurityEl = document.getElementById('meltedPurity');
    const cheatSheet = document.getElementById('cheatSheetContent');
    const priceDisplay = document.getElementById('pricePerGram');

    if (!basePriceEl || !weightGramsEl) return;

    const basePrice = parseFloat(basePriceEl.value) || 0; 
    const weightGrams = parseFloat(weightGramsEl.value) || 0; 
    const goldType = goldTypeEl ? goldTypeEl.value : "ทองคำแท่ง"; 
    const silverType = silverTypeEl ? silverTypeEl.value : "ไม่ใช่แร่เงิน"; 
    const purityPercentage = (parseFloat(meltedPurityEl ? meltedPurityEl.value : 96.5) || 0) / 100;
    
    let pricePerGram = 0; 
    const weightInBaht = weightGrams / 15.24; 
    const r = branchRatesConfig;
    
    if (!r) { 
        if (cheatSheet) cheatSheet.innerHTML = "⚠️ สาขานี้ยังไม่ได้รับการกำหนดเรทถอยพรีเมียมจากแอดมิน"; 
        return; 
    }
    
    const refPrice = basePrice - 1000;

    if (goldType !== "ไม่ใช่ทองคำ") {
        let pricePerGramFull = refPrice * 0.0656 * purityPercentage;

        if (goldType === "ทองคำแท่ง") {
            let discount = getRateValue(r.gb_t4, 200);
            if (Math.abs(weightInBaht - 1) < 0.001) discount = getRateValue(r.gb_t1, 100); 
            else if (weightInBaht > 1 && weightInBaht <= 3) discount = getRateValue(r.gb_t2, 120); 
            else if (weightInBaht > 3 && weightInBaht <= 5) discount = getRateValue(r.gb_t3, 150);
            
            pricePerGram = (refPrice - discount) * 0.0656; 
            if (cheatSheet) cheatSheet.innerHTML = `<b>ทองคำแท่ง:</b> หักราคาตั้งค่าบาทละ <b>${discount} บาท</b> ตามช่วงน้ำหนัก`;
        } else if (goldType === "ทองรูปพรรณ") {
            let discount = getRateValue(r.gj_t4, 300); 
            const fee = basePrice * 0.036; 
            if (Math.abs(weightInBaht - 1) < 0.001) discount = getRateValue(r.gj_t1, 200);
            
            pricePerGram = (basePrice - fee - discount) * 0.0656; 
            if (cheatSheet) cheatSheet.innerHTML = `<b>ทองรูปพรรณ:</b> หักเสื่อม 3.6% และหักเรทสาขา <b>${discount} บาท</b>`;
        } else if (goldType === "ทองหลอม") {
            let discount = getRateValue(r.gm_t9, 100); 
            if (weightGrams > 0 && weightGrams <= 1) discount = getRateValue(r.gm_t1, 200); 
            else if (weightGrams > 1 && weightGrams <= 3) discount = getRateValue(r.gm_t2, 500); 
            else if (weightGrams > 3 && weightGrams <= 5) discount = getRateValue(r.gm_t3, 400); 
            else if (weightGrams > 5 && weightGrams <= 10) discount = getRateValue(r.gm_t4, 300); 
            else if (weightGrams > 10 && weightGrams <= 15) discount = getRateValue(r.gm_t5, 250); 
            else if (weightGrams > 15 && weightGrams <= 20) discount = getRateValue(r.gm_t6, 200); 
            else if (weightGrams > 20 && weightGrams <= 25) discount = getRateValue(r.gm_t7, 150); 
            else if (weightGrams > 25 && weightGrams <= 30) discount = getRateValue(r.gm_t8, 125);
            
            pricePerGram = pricePerGramFull - discount; 
            if (cheatSheet) cheatSheet.innerHTML = `<b>ทองหลอม:</b> หักราคาสูตรหลอมหน่วยเนื้อกรัมละ <b>${discount} บาท</b>`;
        }
    } else if (silverType !== "ไม่ใช่แร่เงิน") {
        const baseLabel = document.getElementById('basePriceLabel');
        if (baseLabel) baseLabel.innerText = "ราคาเงินอ้างอิง (ต่อหน่วยกรัม)";
        
        if (silverType === "เงินแท่ง") { 
            pricePerGram = basePrice - (basePrice * 0.07); 
            if (cheatSheet) cheatSheet.innerHTML = `<b>เงินแท่ง:</b> คิดราคาเนื้อเสื่อมสภาพลดทอนหัก 7%`; 
        } else if (silverType === "เงินหลอม") { 
            let discount = getRateValue(r.sm_t3, 5); 
            if (weightGrams > 0 && weightGrams <= 50) discount = getRateValue(r.sm_t1, 15); 
            else if (weightGrams > 50 && weightGrams <= 100) discount = getRateValue(r.sm_t2, 10); 
            pricePerGram = (basePrice * purityPercentage) - discount; 
            if (cheatSheet) cheatSheet.innerHTML = `<b>เงินหลอม:</b> ลบส่วนต่างเรทประจำสาขาออก <b>${discount} บาท</b>`; 
        }
    }
    
    if (pricePerGram < 0) pricePerGram = 0; 
    if (priceDisplay) priceDisplay.value = pricePerGram.toLocaleString('th-TH', {minimumFractionDigits: 2}) + " บาท/กรัม";
}

function onCategoryTypeChange(category) {
    const sType = document.getElementById('silverType');
    const gType = document.getElementById('goldType');
    const mGroup = document.getElementById('meltedPurityGroup');
    const mPurity = document.getElementById('meltedPurity');

    if (category === 'gold') { 
        if (sType) sType.value = "ไม่ใช่แร่เงิน"; 
        if (mGroup) mGroup.classList.remove('hidden'); 
        if (mPurity && gType) mPurity.value = gType.value === "ทองหลอม" ? "90.0" : "96.5"; 
    } else { 
        if (gType) gType.value = "ไม่ใช่ทองคำ"; 
        if (sType && sType.value === "เงินแท่ง") { 
            if (mGroup) mGroup.classList.add('hidden'); 
        } else { 
            if (mGroup) mGroup.classList.remove('hidden'); 
            if (mPurity) mPurity.value = "92.5"; 
        } 
    }
    calculatePriceLogic();
}

function setWeightShortcut(grams) { 
    const wGrams = document.getElementById('weightGrams');
    if (wGrams) wGrams.value = grams; 
    calculatePriceLogic(); 
}

function pushItemToBill() {
    const goldType = document.getElementById('goldType').value; 
    const silverType = document.getElementById('silverType').value; 
    const typeLabel = goldType !== "ไม่ใช่ทองคำ" ? goldType : silverType; 
    const weight = parseFloat(document.getElementById('weightGrams').value) || 0; 
    const purityText = (document.getElementById('meltedPurity').value || "96.5") + "%";
    const priceDisplay = document.getElementById('pricePerGram');
    const pricePerGram = parseFloat(priceDisplay ? priceDisplay.value.replace(/,/g, '') : 0) || 0;
    const currentStatus = "รอขาย";

    if (weight <= 0) { alert("กรุณากรอกน้ำหนักชิ้นงานให้ถูกต้องก่อนครับ"); return; }

    let itemTotalPay = pricePerGram * weight;
    batchBillItems.push({ 
        type: typeLabel, 
        weight: weight, 
        cost: itemTotalPay, 
        purity: purityText,
        status: currentStatus
    }); 
    updateBillTableRender();
}

function updateBillTableRender() {
    const tbody = document.getElementById('itemTableBody'); 
    const totalRes = document.getElementById('totalResult');
    if (!tbody) return;

    if (batchBillItems.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#a39284; padding:30px;">ไม่มีชิ้นงานในบิล</td></tr>`; 
        if (totalRes) totalRes.innerText = "0.00 บาท"; 
        return; 
    }
    
    tbody.innerHTML = ""; 
    let grandTotal = 0; 
    batchBillItems.forEach((item, index) => { 
        grandTotal += item.cost; 
        const row = document.createElement('tr'); 
        row.innerHTML = `
            <td><b>${item.type}</b></td>
            <td>${item.weight.toFixed(2)}</td>
            <td><b>${item.cost.toLocaleString('th-TH')}.-</b></td>
            <td><button class="btn-delete-row" onclick="removeSingleItemRow(${index})">❌ ลบ</button></td>
        `; 
        tbody.appendChild(row); 
    });
    if (totalRes) totalRes.innerText = grandTotal.toLocaleString('th-TH', {minimumFractionDigits:2}) + " บาท";
}

function removeSingleItemRow(index) {
    batchBillItems.splice(index, 1);
    updateBillTableRender();
}

function commitBillToCloudAndDashboard() {
    if (batchBillItems.length === 0) { alert("ไม่มีรายการสินค้าสะสมในบิลตั๋วให้กดบันทึกครับบอส"); return; }

    const saveButton = document.querySelector('.btn-send-sheet');
    if (saveButton) { saveButton.disabled = true; saveButton.innerText = "⏳ กำลังบันทึก..."; }

    const creds = getStoredCredentials();
    const savePromises = batchBillItems.map(item => {
        const params = new URLSearchParams({
            action: "addTransaction",
            user: creds.user,
            pass: creds.pass,
            token: creds.token,
            branch: currentBranchName || "สาขา 1",
            type: item.type,
            weight: item.weight,
            amount: item.cost,
            purity: item.purity,
            status: item.status
        });
        return fetch(`${CLOUD_URL}?${params.toString()}`).then(res => res.json());
    });

    Promise.all(savePromises)
        .then(results => {
            const allOk = results.every(r => r && r.success);
            if (allOk) {
                alert("☁️ บันทึกข้อมูลคลาวด์และลงตารางแดชบอร์ดสรุปเสร็จสิ้น!");
            } else {
                alert("⚠️ บันทึกสำเร็จบางรายการ กรุณาตรวจสอบตารางแดชบอร์ดอีกครั้ง");
            }
            batchBillItems = [];
            updateBillTableRender();
            fetchTransactionsFromCloud();
        })
        .catch(() => {
            alert("❌ บันทึกขึ้นคลาวด์ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
        })
        .finally(() => {
            if (saveButton) { saveButton.disabled = false; saveButton.innerText = "☁️ บันทึกเข้าชีทและแดชบอร์ด"; }
        });
}

// ================= DASHBOARD REPORTING =================
function fetchTransactionsFromCloud(silent) {
    const tbody = document.getElementById('dashboardTableBody');
    if (!silent && tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:#a39284; padding:20px;">⏳ กำลังโหลดข้อมูลธุรกรรมจากคลาวด์...</td></tr>`;
    const creds = getStoredCredentials();
    fetch(`${CLOUD_URL}?action=getTransactions&user=${encodeURIComponent(creds.user)}&pass=${encodeURIComponent(creds.pass)}&token=${encodeURIComponent(creds.token)}`)
        .then(res => res.json())
        .then(data => {
            if (data.success === false) {
                if (!silent) alert("⚠️ " + (data.message || "ไม่สามารถโหลดข้อมูลได้ กรุณาล็อกอินใหม่"));
                return;
            }
            cloudTransactionsCache = data.transactions || [];
            refreshBranchSelectors();
            rebuildLargeDashboardTableHTML();
        })
        .catch(() => {
            if (!silent && tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:#c94c4c; padding:20px;">❌ โหลดข้อมูลจากคลาวด์ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองรีเฟรชใหม่</td></tr>`;
        });
}

function rebuildLargeDashboardTableHTML() {
    const tbody = document.getElementById('dashboardTableBody');
    if (!tbody) return;
    tbody.innerHTML = "";

    let filteredDataset = cloudTransactionsCache;
    if (currentUserRole === "Staff" && myAllowedBranches.length > 0) {
        filteredDataset = filteredDataset.filter(item => myAllowedBranches.includes(item.branch));
    }

    const branchFilterEl = document.getElementById('dashboardBranchFilter');
    const branchFilterValue = branchFilterEl ? branchFilterEl.value : 'all';
    if (branchFilterValue !== 'all') {
        filteredDataset = filteredDataset.filter(item => item.branch === branchFilterValue);
    }

    const filterModeEl = document.getElementById('dashboardDateFilter');
    const filterMode = filterModeEl ? filterModeEl.value : 'all';
    if (filterMode !== 'all') {
        const now = new Date();
        filteredDataset = filteredDataset.filter(item => {
            const d = new Date(item.timestamp);
            if (filterMode === 'today') return d.toDateString() === now.toDateString();
            if (filterMode === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
            if (filterMode === 'year') return d.getFullYear() === now.getFullYear();
            return true;
        });
    }

    if (filteredDataset.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:#a39284; padding:20px;">📭 ไม่พบข้อมูลธุรกรรมตามเงื่อนไขที่เลือก</td></tr>`;
        return;
    }

    const assocPriceEl = document.getElementById('dashboardAssociationPrice');
    const silverPriceEl = document.getElementById('dashboardSilverPriceInput');

    const localAssociationPrice = parseFloat(assocPriceEl ? assocPriceEl.value : 44500) || 44500;
    const localSilverPriceGrams = parseFloat(silverPriceEl ? silverPriceEl.value : 70) || 70;

    const reversedData = [...filteredDataset].reverse();
    reversedData.forEach(item => {
        let netProfitOrLoss = 0;
        let actualPurity = parseFloat(String(item.purity).replace("%", "").trim()) / 100;
        if (isNaN(actualPurity) || actualPurity <= 0) actualPurity = 0;

        if (item.type === "เงินแท่ง" || item.type === "เงินหลอม") {
            let expectedSilverRevenue = localSilverPriceGrams * actualPurity * item.weight;
            netProfitOrLoss = expectedSilverRevenue - item.cost;
        } else {
            let expectedGoldRevenue = localAssociationPrice * 0.0656 * actualPurity * item.weight;
            netProfitOrLoss = expectedGoldRevenue - item.cost;
        }

        let profitBadgeHtml = "";
        if (netProfitOrLoss >= 0) {
            profitBadgeHtml = `<span class="profit-positive">+${Math.abs(netProfitOrLoss).toLocaleString('th-TH', {minimumFractionDigits:0, maximumFractionDigits:0})}</span>`;
        } else {
            profitBadgeHtml = `<span class="profit-negative">-${Math.abs(netProfitOrLoss).toLocaleString('th-TH', {minimumFractionDigits:0, maximumFractionDigits:0})}</span>`;
        }

        const isLocked = item.status === 'ล็อกราคา';
        const statusSelectHtml = `
            <select class="status-badge ${isLocked ? 'badge-lock' : 'badge-wait'}"
                    style="border:none; font-weight:600; cursor:pointer;"
                    onchange="updateItemStatus(${item.rowIndex}, this.value, this)">
                <option value="รอขาย" ${!isLocked ? 'selected' : ''}>⏳ รอขาย</option>
                <option value="ล็อกราคา" ${isLocked ? 'selected' : ''}>🔒 ล็อกราคา</option>
            </select>`;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.date}</td>
            <td><b>${item.branch}</b></td>
            <td><b>${item.id}</b></td>
            <td><b>${item.type}</b></td>
            <td>${item.weight.toFixed(2)}</td>
            <td>${item.purity}%</td>
            <td>${item.cost.toLocaleString('th-TH')}</td>
            <td>${statusSelectHtml}</td>
            <td><b>${item.costPerBaht.toLocaleString('th-TH', {minimumFractionDigits:2})}</b></td>
            <td>${profitBadgeHtml}</td>
        `;
        tbody.appendChild(row);
    });
}

function updateItemStatus(rowIndex, newStatus, selectEl) {
    const creds = getStoredCredentials();
    selectEl.disabled = true;
    fetch(`${CLOUD_URL}?action=updateTransactionStatus&rowIndex=${rowIndex}&status=${encodeURIComponent(newStatus)}&user=${encodeURIComponent(creds.user)}&pass=${encodeURIComponent(creds.pass)}&token=${encodeURIComponent(creds.token)}`)
        .then(res => res.json())
        .then(data => {
            if (!data.success) { alert("⚠️ " + (data.message || "อัปเดตสถานะไม่สำเร็จ")); }
            fetchTransactionsFromCloud(true);
        })
        .catch(() => alert("❌ อัปเดตสถานะไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต"))
        .finally(() => { selectEl.disabled = false; });
}

let autoRefreshTimer = null;
function startAutoRefresh() {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(() => {
        fetchTransactionsFromCloud(true);
        refreshRatesFromCloud();
    }, 12000);
}

function stopAutoRefresh() {
    if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null; }
}

function switchMainTab(tabId, btn) {
    document.querySelectorAll('#calculatorView .tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('#calculatorView .tab-nav-btn').forEach(b => b.classList.remove('active'));
    
    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.add('active');
    if (btn) btn.classList.add('active');

    if (tabId === 'reportTab') {
        fetchTransactionsFromCloud();
    } else if (tabId === 'calcTab') {
        refreshRatesFromCloud();
    }
}

// ================= CLASSIC CALCULATOR ENGINE =================
function ccFormatPricePerGram(value) {
    return (value || 0).toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function ccSwitchTab(tab) {
    if (tab === 'CURRENT') {
        document.getElementById('ccTabCurrentBtn').className = 'cc-tab-btn active-tab';
        document.getElementById('ccTabHistoryBtn').className = 'cc-tab-btn';
        document.getElementById('ccPaneCurrent').classList.remove('hidden-element');
        document.getElementById('ccPaneHistory').classList.add('hidden-element');
    } else {
        document.getElementById('ccTabCurrentBtn').className = 'cc-tab-btn';
        document.getElementById('ccTabHistoryBtn').className = 'cc-tab-btn active-tab';
        document.getElementById('ccPaneCurrent').classList.add('hidden-element');
        document.getElementById('ccPaneHistory').classList.remove('hidden-element');
        ccRenderHistoryList();
    }
}

function ccSwitchMode(mode) {
    ccCurrentMode = mode;
    const extraPriceGroup = document.getElementById('ccExtraPriceFormGroup');
    const silverNetBox = document.getElementById('ccSilverNetPayBox');

    if (mode === 'GOLD') {
        document.getElementById('ccGoldModeBtn').className = 'mode-btn active-gold';
        document.getElementById('ccSilverModeBtn').className = 'mode-btn';
        document.getElementById('ccLblRefPrice').innerText = "1. ราคาอ้างอิงทอง (บาทละ)";
        document.getElementById('ccLblPureGoldBox').innerText = "✨ น้ำหนักทองเพียว 99.99% รวมทั้งหมด";
        document.getElementById('ccThPureGold').innerText = "4. ทองเพียว (กรัม)";
        document.getElementById('ccLblTableTitle').innerText = "📋 รายการบันทึกการซื้อขาย (ทองคำ)";
        if (extraPriceGroup) extraPriceGroup.classList.remove('hidden-element');
        if (silverNetBox) silverNetBox.classList.add('hidden-element'); 
    } else {
        document.getElementById('ccGoldModeBtn').className = 'mode-btn';
        document.getElementById('ccSilverModeBtn').className = 'mode-btn active-silver';
        document.getElementById('ccLblRefPrice').innerText = "1. ราคาอ้างอิงเงิน (บาทละ)";
        document.getElementById('ccLblPureGoldBox').innerText = "✨ น้ำหนักเงินเพียว รวมทั้งหมด";
        document.getElementById('ccThPureGold').innerText = "4. เงินเพียว (กรัม)";
        document.getElementById('ccLblTableTitle').innerText = "📋 รายการบันทึกการซื้อขาย (แร่เงิน)";
        if (extraPriceGroup) extraPriceGroup.classList.add('hidden-element');
        if (silverNetBox) silverNetBox.classList.remove('hidden-element'); 
    }

    document.getElementById('ccWeight').value = "";
    document.getElementById('ccPercent').value = "";
    if (document.getElementById('ccExtraPrice')) document.getElementById('ccExtraPrice').value = ""; 

    ccCalculateGold();
    ccRenderTable(); 
}

function ccCalculateGold() {
    const refPrice = parseFloat(document.getElementById('ccRefPrice').value) || 0;
    const extraPrice = ccCurrentMode === 'GOLD' ? (parseFloat(document.getElementById('ccExtraPrice').value) || 0) : 0;
    const weight = parseFloat(document.getElementById('ccWeight').value) || 0;
    const percent = parseFloat(document.getElementById('ccPercent').value) || 0;

    if (refPrice === 0 || percent === 0) {
        document.getElementById('ccPricePerGram').value = "รอดำเนินการคำนวณ...";
        document.getElementById('ccTotalResult').innerText = "0 บาท";
        ccPricePerGram = 0; ccRawAmount = 0; ccFinalPay = 0;
        return;
    }

    if (ccCurrentMode === 'GOLD') {
        const basePrice = refPrice + extraPrice;
        ccPricePerGram = Math.floor((basePrice * 0.0656) * (percent / 100) * 10) / 10;
    } else {
        const rawPricePerGram = refPrice * (percent / 100);
        ccPricePerGram = Math.floor(rawPricePerGram * 10) / 10; 
    }

    document.getElementById('ccPricePerGram').value = ccFormatPricePerGram(ccPricePerGram) + " บาท";

    if (weight > 0) {
        ccRawAmount = ccPricePerGram * weight;
        ccFinalPay = Math.ceil(ccRawAmount);
        document.getElementById('ccTotalResult').innerText = ccFinalPay.toLocaleString('th-TH') + " บาท";
    } else {
        document.getElementById('ccTotalResult').innerText = "0 บาท";
        ccRawAmount = 0; ccFinalPay = 0;
    }
}

function ccAddRecordToTable() {
    const weight = parseFloat(document.getElementById('ccWeight').value) || 0;
    const percent = parseFloat(document.getElementById('ccPercent').value) || 0;
    if (ccPricePerGram === 0 || weight === 0 || percent === 0) {
        alert("กรุณากรอกข้อมูล ราคาอ้างอิง, เปอร์เซ็นต์ และ น้ำหนัก ให้ครบถ้วนก่อนบันทึกครับ");
        return;
    }

    const recordData = {
        weight: weight, percent: percent, pricePerGram: ccPricePerGram,
        rawAmount: ccRawAmount, finalPay: ccFinalPay, pureGold: weight * (percent / 100)
    };

    if (ccCurrentMode === 'GOLD') {
        ccGoldRecords.push(recordData);
    } else {
        ccSilverRecords.push(recordData);
    }

    ccRenderTable();
    document.getElementById('ccWeight').value = "";
    document.getElementById('ccPercent').value = "";
    document.getElementById('ccTotalResult').innerText = "0 บาท";
    ccRawAmount = 0; ccFinalPay = 0;
}

function ccDeleteRecord(index) {
    if (confirm(`คุณต้องการลบบันทึกข้อมูลแถวนี้ใช่หรือไม่?`)) {
        if (ccCurrentMode === 'GOLD') {
            ccGoldRecords.splice(index, 1);
        } else {
            ccSilverRecords.splice(index, 1);
        }
        ccRenderTable();
    }
}

function ccRenderTable() {
    const leftRefineBox = document.getElementById('ccLeftRefineBoxSection');
    if (leftRefineBox) {
        (ccCurrentMode === 'GOLD') ? leftRefineBox.classList.add('hidden-element') : leftRefineBox.classList.remove('hidden-element');
    }

    const tbody = document.getElementById('ccTableBody');
    if (!tbody) return;
    tbody.innerHTML = ""; 

    let tW=0, tP=0, tA=0, tPay=0;
    const activeRecords = (ccCurrentMode === 'GOLD') ? ccGoldRecords : ccSilverRecords;
    const itemLabel = (ccCurrentMode === 'GOLD') ? `🟡 ทอง` : `⚪ เงิน`;

    activeRecords.forEach((record, index) => {
        tW += record.weight; tP += record.pureGold; tA += record.rawAmount; tPay += record.finalPay;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="item-name-cell" style="text-align:left; padding-left:10px;"><button class="delete-row-btn" onclick="ccDeleteRecord(${index})">✕</button> ${itemLabel}ก้อนที่ ${index+1}</td>
            <td>${record.weight.toFixed(3)}</td>
            <td>${record.percent}%</td>
            <td>${ccFormatPricePerGram(record.pricePerGram)}</td>
            <td>${record.pureGold.toFixed(3)}</td>
            <td>${record.rawAmount.toLocaleString('th-TH', {minimumFractionDigits:3, maximumFractionDigits:3})} บาท</td>
            <td class="pay-column">${record.finalPay.toLocaleString('th-TH')} บาท</td>
        `;
        tbody.appendChild(row);
    });

    for (let i = activeRecords.length; i < 12; i++) {
        const row = document.createElement('tr');
        row.innerHTML = `<td class="empty-row-text" style="text-align:left; padding-left:45px;">ก้อนที่ ${i+1}</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td>`;
        tbody.appendChild(row);
    }

    let refineRate = (tW <= 500) ? 2.25 : (tW <= 1000) ? 2.00 : 1.75;
    let tRef = tW * refineRate;
    let sNet = tPay - tRef;
    let avgPricePerGram = tW > 0 ? (tA / tW) : 0;

    document.getElementById('ccTotalWeightSum').innerText = tW.toFixed(3) + " กรัม";
    document.getElementById('ccAveragePercentSum').innerText = (tW > 0 ? (tP/tW*100).toFixed(3) : "0.000") + "%"; 
    document.getElementById('ccAvgPricePerGramSum').innerText = ccFormatPricePerGram(avgPricePerGram) + " บาท";
    document.getElementById('ccTotalPureGoldSum').innerText = tP.toFixed(3) + " กรัม"; 
    document.getElementById('ccTotalAmountSum').innerText = tA.toLocaleString('th-TH', {minimumFractionDigits:3, maximumFractionDigits:3}) + " บาท";
    document.getElementById('ccTotalPaymentSum').innerText = tPay.toLocaleString('th-TH') + " บาท";

    document.getElementById('ccTotalPureGoldDisplay').innerText = tP.toFixed(3) + " กรัม";
    document.getElementById('ccTotalRefineDisplay').innerText = tRef.toLocaleString('th-TH', {minimumFractionDigits:2, maximumFractionDigits:2}) + " บาท"; 
    document.getElementById('ccSilverNetPayDisplay').innerText = (sNet > 0 ? sNet : 0).toLocaleString('th-TH', {minimumFractionDigits:2, maximumFractionDigits:2}) + " บาท";
}

function ccClearTable() {
    const labelMode = (ccCurrentMode === 'GOLD') ? "ทองคำ" : "แร่เงิน";
    if (confirm(`คุณต้องการล้างรายการบันทึกทั้งหมดของ (${labelMode}) เพื่อเริ่มใหม่ใช่หรือไม่?`)) { 
        if (ccCurrentMode === 'GOLD') {
            ccGoldRecords = []; 
        } else {
            ccSilverRecords = [];
        }
        ccRenderTable(); 
    }
}

function ccSaveCurrentToHistory() {
    const activeRecords = (ccCurrentMode === 'GOLD') ? ccGoldRecords : ccSilverRecords;
    if (activeRecords.length === 0) {
        alert("ไม่มีข้อมูลในตารางปัจจุบันที่จะทำการบันทึกปิดยอดครับ");
        return;
    }

    let customName = prompt("กรุณากรอกชื่อลูกค้าหรือช่างผู้ขาย (หากไม่ระบุให้เว้นว่างไว้แล้วกดตกลง):", "");
    if (customName === null) return;
    if (customName.trim() === "") customName = "ไม่ระบุชื่อ";

    let totalWeight = 0, totalPure = 0, totalPay = 0;
    activeRecords.forEach(r => {
        totalWeight += r.weight;
        totalPure += r.pureGold;
        totalPay += r.finalPay;
    });

    let finalNetPayment = totalPay;
    if (ccCurrentMode === 'SILVER') {
        let refineRate = (totalWeight <= 500) ? 2.25 : (totalWeight <= 1000) ? 2.00 : 1.75;
        let totalRefine = totalWeight * refineRate;
        finalNetPayment = totalPay - totalRefine;
    }

    const now = new Date();
    const timeString = now.toLocaleDateString('th-TH') + " - " + now.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'}) + " น.";

    const billHistoryItem = {
        id: Date.now(),
        type: ccCurrentMode,
        clientName: customName,
        time: timeString,
        weightSum: totalWeight,
        pureSum: totalPure,
        netSum: finalNetPayment,
        details: JSON.parse(JSON.stringify(activeRecords))
    };

    ccSavedHistory.unshift(billHistoryItem);
    localStorage.setItem('darin_calc_history', JSON.stringify(ccSavedHistory));

    alert(`💾 บันทึกประวัติบิลของ "${customName}" เรียบร้อยแล้ว ระบบจะทำการล้างตารางทำงานเพื่อเริ่มงานบิลถัดไปครับ`);

    if (ccCurrentMode === 'GOLD') { ccGoldRecords = []; } else { ccSilverRecords = []; }
    ccRenderTable();
}

function ccRenderHistoryList() {
    const container = document.getElementById('ccHistoryContainer');
    if (!container) return;
    container.innerHTML = "";

    if (ccSavedHistory.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:30px; color:#aaa; font-style:italic;">ยังไม่มีรายการประวัติการปิดยอดในวันนี้</div>`;
        document.getElementById('ccGrandTotalDisplay').innerText = "ทองคำ: 0 บาท | แร่เงิน: 0 บาท";
        return;
    }

    let goldGrandTotal = 0, silverGrandTotal = 0;

    ccSavedHistory.forEach((item) => {
        if (item.type === 'GOLD') { goldGrandTotal += item.netSum; } else { silverGrandTotal += item.netSum; }

        const typeBadge = item.type === 'GOLD' ? '🟡 ทองคำ' : '⚪ แร่เงิน';
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="history-item-header">
                <span>📅 เวลา: ${item.time}</span>
                <strong>ประเภท: ${typeBadge}</strong>
            </div>
            <div class="history-item-body">
                <div class="history-summary-text">
                    👤 ผู้ขาย: <b>${item.clientName}</b> | น้ำหนักรวม: <b>${item.weightSum.toFixed(3)} กรัม</b> | ยอดจ่ายสุทธิ: <b style="color:#27ae60;">${Math.ceil(item.netSum).toLocaleString('th-TH')} บาท</b>
                </div>
                <div class="history-actions">
                    <button class="hist-btn btn-recall" onclick="ccRecallBillToTable(${item.id})">🔍 เรียกคืนข้อมูล</button>
                    <button class="hist-btn btn-delete-hist" onclick="ccDeleteHistoryItem(${item.id})">❌ ลบ</button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });

    document.getElementById('ccGrandTotalDisplay').innerText = `ทองคำ: ${goldGrandTotal.toLocaleString('th-TH')} บาท | แร่เงิน: ${Math.ceil(silverGrandTotal).toLocaleString('th-TH')} บาท`;
}

function ccDeleteHistoryItem(id) {
    if (confirm("คุณต้องการลบประวัติของรายการนี้อย่างถาวรใช่หรือไม่?")) {
        ccSavedHistory = ccSavedHistory.filter(item => item.id !== id);
        localStorage.setItem('darin_calc_history', JSON.stringify(ccSavedHistory));
        ccRenderHistoryList();
    }
}

function ccClearAllHistory() {
    if (confirm("⚠️ คุณแน่ใจหรือไม่ว่าต้องการล้างประวัติการคำนวณทั้งหมดของวันนี้? ข้อมูลทั้งหมดจะหายไปอย่างถาวร")) {
        ccSavedHistory = [];
        localStorage.removeItem('darin_calc_history');
        ccRenderHistoryList();
    }
}

function ccRecallBillToTable(id) {
    const targetBill = ccSavedHistory.find(item => item.id === id);
    if (!targetBill) return;

    if (confirm(`คุณต้องการดึงข้อมูลของ "${targetBill.clientName}" กลับไปแทนที่ในตารางทำงานปัจจุบันใช่หรือไม่?`)) {
        ccSwitchMode(targetBill.type);
        if (targetBill.type === 'GOLD') {
            ccGoldRecords = JSON.parse(JSON.stringify(targetBill.details));
        } else {
            ccSilverRecords = JSON.parse(JSON.stringify(targetBill.details));
        }
        ccRenderTable();
        ccSwitchTab('CURRENT');
        alert("เรียกคืนข้อมูลลงตารางปัจจุบันสำเร็จแล้ว สามารถแก้ไขต่อได้ทันทีครับ");
    }
}

// Event Listeners Initialization
window.addEventListener('DOMContentLoaded', () => {
    checkAutoLoginSession();

    // Event listeners for main calculator
    const baseP = document.getElementById('basePrice');
    const wGrams = document.getElementById('weightGrams');
    const mPurity = document.getElementById('meltedPurity');
    if (baseP) baseP.addEventListener('input', calculatePriceLogic);
    if (wGrams) wGrams.addEventListener('input', calculatePriceLogic);
    if (mPurity) mPurity.addEventListener('input', calculatePriceLogic);

    // Event listeners for classic calculator
    const ccRefP = document.getElementById('ccRefPrice');
    const ccExtraP = document.getElementById('ccExtraPrice');
    const ccW = document.getElementById('ccWeight');
    const ccP = document.getElementById('ccPercent');
    if (ccRefP) ccRefP.addEventListener('input', ccCalculateGold);
    if (ccExtraP) ccExtraP.addEventListener('input', ccCalculateGold);
    if (ccW) ccW.addEventListener('input', ccCalculateGold);
    if (ccP) ccP.addEventListener('input', ccCalculateGold);

    ccRenderTable();
});
