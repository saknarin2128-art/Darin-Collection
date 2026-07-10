const CLOUD_URL = "https://script.google.com/macros/s/AKfycbyRxwiLp4JYaWkl2oR1omTycfPm3WIsBBfDbw91Ycbdeqi9AC2KGd5Xg0IEO6z2LevM/exec";

let allBranchRatesMap = {}; 
let branchRatesConfig = { gb_t1:100, gb_t2:120, gb_t3:150, gb_t4:200, gj_t1:200, gj_t2:220, gj_t3:250, gj_t4:300, gm_t1:200, gm_t2:500, gm_t3:400, gm_t4:300, gm_t5:250, gm_t6:200, gm_t7:150, gm_t8:125, gm_t9:100 }; 
let myAllowedBranches = [];
let currentShopName = ""; let currentBranchName = ""; let currentUserRole = "";
let batchBillItems = [];
let cloudTransactionsCache = [];

function getStoredCredentials() {
    return {
        user: localStorage.getItem('DCSG_CURRENT_USER') || "",
        pass: localStorage.getItem('DCSG_CURRENT_PASS') || "",
        token: getOrCreateDeviceToken()
    };
}

function getOrCreateDeviceToken() {
    let token = localStorage.getItem('dcsg_device_token');
    if (!token) {
        token = 'DCSG-DEV-' + Math.random().toString(36).substring(2, 11).toUpperCase();
        localStorage.setItem('dcsg_device_token', token);
    }
    return token;
}

function switchAuthTab(mode) {
    if (mode === 'login') {
        document.getElementById('tabLogin').className = 'tab-btn active'; document.getElementById('tabRegister').className = 'tab-btn';
        document.getElementById('loginForm').style.display = 'block'; document.getElementById('registerForm').style.display = 'none';
    } else {
        document.getElementById('tabRegister').className = 'tab-btn active'; document.getElementById('tabLogin').className = 'tab-btn';
        document.getElementById('loginForm').style.display = 'none'; document.getElementById('registerForm').style.display = 'block';
    }
}

function triggerLiveStoreSignup() {
    const shop = document.getElementById('regShop').value.trim(); const display = document.getElementById('regDisplay').value.trim(); const user = document.getElementById('regUser').value.trim(); const pass = document.getElementById('regPass').value.trim(); const role = document.getElementById('regRole').value;
    document.getElementById('authLoading').style.display = 'flex';
    fetch(`${CLOUD_URL}?action=registerUser&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}&role=${encodeURIComponent(role)}&displayName=${encodeURIComponent(display)}&shop=${encodeURIComponent(shop)}`, { method: "GET" })
    .then(res => res.json()).then(data => { document.getElementById('authLoading').style.display = 'none'; document.getElementById('authForms').style.display = 'none'; document.getElementById('successView').style.display = 'block'; })
    .catch(err => { document.getElementById('authLoading').style.display = 'none'; document.getElementById('authForms').style.display = 'none'; document.getElementById('successView').style.display = 'block'; });
}

function triggerLiveStoreLogin() {
    const user = document.getElementById('loginUser').value.trim(); const pass = document.getElementById('loginPass').value.trim(); const token = getOrCreateDeviceToken();
    document.getElementById('authLoading').style.display = 'flex';
    fetch(`${CLOUD_URL}?action=loginCheck&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}&token=${encodeURIComponent(token)}`, { method: "GET" })
    .then(res => res.json()).then(data => {
        document.getElementById('authLoading').style.display = 'none';
        if(data.success) {
            localStorage.setItem('DCSG_CURRENT_USER', user); localStorage.setItem('DCSG_CURRENT_PASS', pass);
            renderDashboardWorkspace(data, user);
        } else { alert("⚠️ ปฏิเสธการเข้าใช้งานระบบ: " + data.message); }
    }).catch(err => { document.getElementById('authLoading').style.display = 'none'; alert("❌ ระบบขัดข้อง: ไม่สามารถติดต่อหลังบ้านได้"); });
}

function checkAutoLoginSession() {
    const savedUser = localStorage.getItem('DCSG_CURRENT_USER'); const savedPass = localStorage.getItem('DCSG_CURRENT_PASS'); const token = getOrCreateDeviceToken();
    if (savedUser && savedPass) {
        document.getElementById('authLoading').style.display = 'flex'; document.getElementById('authLoading').innerText = "⏳ กำลังซิงค์กู้คืนเซสชันล็อกอินเดิมอัตโนมัติ...";
        fetch(`${CLOUD_URL}?action=loginCheck&user=${encodeURIComponent(savedUser)}&pass=${encodeURIComponent(savedPass)}&token=${encodeURIComponent(token)}`, { method: "GET" })
        .then(res => res.json()).then(data => {
            document.getElementById('authLoading').style.display = 'none';
            if (data.success) { renderDashboardWorkspace(data, savedUser); } 
            else { localStorage.removeItem('DCSG_CURRENT_USER'); localStorage.removeItem('DCSG_CURRENT_PASS'); }
        }).catch(err => { document.getElementById('authLoading').style.display = 'none'; });
    }
}

function renderDashboardWorkspace(data, user) {
    document.getElementById('authPortal').style.display = 'none'; document.getElementById('mainDashboard').style.display = 'block'; document.body.style.background = "#faf8f5";
    currentShopName = data.shop || (user.indexOf("_") !== -1 ? user.split("_")[0] : data.displayName); currentUserRole = data.role; myAllowedBranches = data.allowedBranches.split(", "); currentBranchName = myAllowedBranches[0]; 
    
    applyRatesFromServer(data.rates);
    document.getElementById('displayShopTitle').innerText = data.displayName;
    refreshBranchSelectors();
    if(currentUserRole === "Owner") {
        document.getElementById('displayRoleTag').innerText = "👑 เจ้าของร้าน (Owner)"; document.getElementById('displayRoleTag').style.background = "#b38e6d";
    } else { document.getElementById('displayRoleTag').innerText = "👤 พนักงาน (Staff)"; document.getElementById('displayRoleTag').style.background = "#4a3b32"; }
    
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

function getRateValue(val, fallback) {
    if (val !== undefined && val !== null && val !== "" && !isNaN(Number(val))) {
        return Number(val);
    }
    return fallback;
}

function calculatePriceLogic() {
    const basePrice = parseFloat(document.getElementById('basePrice').value) || 0; 
    const weightGrams = parseFloat(document.getElementById('weightGrams').value) || 0; 
    const goldType = document.getElementById('goldType').value; 
    const silverType = document.getElementById('silverType').value; 
    const purityPercentage = (parseFloat(document.getElementById('meltedPurity').value) || 0) / 100;
    let pricePerGram = 0; const weightInBaht = weightGrams / 15.24; const cheatSheet = document.getElementById('cheatSheetContent'); const r = branchRatesConfig;
    
    if(!r) { cheatSheet.innerHTML = "⚠️ สาขานี้ยังไม่ได้รับการกำหนดเรทถอยพรีเมียมจากแอดมิน"; return; }
    
    const refPrice = basePrice - 1000;

    if (goldType !== "ไม่ใช่ทองคำ") {
        let pricePerGramFull = refPrice * 0.0656 * purityPercentage;

        if (goldType === "ทองคำแท่ง") {
            let discount = getRateValue(r.gb_t4, 200);
            if (Math.abs(weightInBaht - 1) < 0.001) discount = getRateValue(r.gb_t1, 100); 
            else if (weightInBaht > 1 && weightInBaht <= 3) discount = getRateValue(r.gb_t2, 120); 
            else if (weightInBaht > 3 && weightInBaht <= 5) discount = getRateValue(r.gb_t3, 150);
            
            pricePerGram = (refPrice - discount) * 0.0656; cheatSheet.innerHTML = `<b>ทองคำแท่ง:</b> หักราคาตั้งค่าบาทละ <b>${discount} บาท</b> ตามช่วงน้ำหนัก`;
        } else if (goldType === "ทองรูปพรรณ") {
            let discount = getRateValue(r.gj_t4, 300); const fee = basePrice * 0.036; 
            if (Math.abs(weightInBaht - 1) < 0.001) discount = getRateValue(r.gj_t1, 200);
            
            pricePerGram = (basePrice - fee - discount) * 0.0656; cheatSheet.innerHTML = `<b>ทองรูปพรรณ:</b> หักเสื่อม 3.6% และหักเรทสาขา <b>${discount} บาท</b>`;
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
            
            pricePerGram = pricePerGramFull - discount; cheatSheet.innerHTML = `<b>ทองหลอม:</b> หักราคาสูตรหลอมหน่วยเนื้อกรัมละ <b>${discount} บาท</b>`;
        }
    } else if (silverType !== "ไม่ใช่แร่เงิน") {
        document.getElementById('basePriceLabel').innerText = "ราคาเงินอ้างอิง (ต่อหน่วยกรัม)";
        if (silverType === "เงินแท่ง") { pricePerGram = basePrice - (basePrice * 0.07); cheatSheet.innerHTML = `<b>เงินแท่ง:</b> คิดราคาเนื้อเสื่อมสภาพลดทอนหัก 7%`; }
        else if (silverType === "เงินหลอม") { 
            let discount = getRateValue(r.sm_t3, 5); 
            if (weightGrams > 0 && weightGrams <= 50) discount = getRateValue(r.sm_t1, 15); 
            else if (weightGrams > 50 && weightGrams <= 100) discount = getRateValue(r.sm_t2, 10); 
            pricePerGram = (basePrice * purityPercentage) - discount; cheatSheet.innerHTML = `<b>เงินหลอม:</b> ลบส่วนต่างเรทประจำสาขาออก <b>${discount} บาท</b>`; 
        }
    }
    if(pricePerGram < 0) pricePerGram = 0; document.getElementById('pricePerGram').value = pricePerGram.toLocaleString('th-TH', {minimumFractionDigits: 2}) + " บาท/กรัม";
}

function onCategoryTypeChange(category) {
    if(category === 'gold') { document.getElementById('silverType').value = "ไม่ใช่แร่เงิน"; document.getElementById('meltedPurityGroup').classList.remove('hidden'); document.getElementById('meltedPurity').value = document.getElementById('goldType').value === "ทองหลอม" ? "90.0" : "96.5"; }
    else { document.getElementById('goldType').value = "ไม่ใช่ทองคำ"; if(document.getElementById('silverType').value === "เงินแท่ง") { document.getElementById('meltedPurityGroup').classList.add('hidden'); } else { document.getElementById('meltedPurityGroup').classList.remove('hidden'); document.getElementById('meltedPurity').value = "92.5"; } }
    calculatePriceLogic();
}

function setWeightShortcut(grams) { document.getElementById('weightGrams').value = grams; calculatePriceLogic(); }

function pushItemToBill() {
    const goldType = document.getElementById('goldType').value; const silverType = document.getElementById('silverType').value; const typeLabel = goldType !== "ไม่ใช่ทองคำ" ? goldType : silverType; const weight = parseFloat(document.getElementById('weightGrams').value) || 0; 
    const purityText = document.getElementById('meltedPurity').value + "%";
    const pricePerGram = parseFloat(document.getElementById('pricePerGram').value.replace(/,/g, '')) || 0;
    const currentStatus = "รอขาย";

    if(weight <= 0) { alert("กรุณากรอกน้ำหนักชิ้นงานให้ถูกต้องก่อนครับ"); return; }

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
    const tbody = document.getElementById('itemTableBody'); if(batchBillItems.length === 0) { tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#a39284; padding:30px;">ไม่มีชิ้นงานในบิล</td></tr>`; document.getElementById('totalResult').innerText = "0.00 บาท"; return; }
    tbody.innerHTML = ""; let grandTotal = 0; 
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
    document.getElementById('totalResult').innerText = grandTotal.toLocaleString('th-TH', {minimumFractionDigits:2}) + " บาท";
}

function removeSingleItemRow(index) {
    batchBillItems.splice(index, 1);
    updateBillTableRender();
}

function commitBillToCloudAndDashboard() {
    if(batchBillItems.length === 0) { alert("ไม่มีรายการสินค้าสะสมในบิลตั๋วให้กดบันทึกครับบอส"); return; }

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
                alert("☁️ บันทึกข้อมูลคลาวด์และเข้าหน้าตารางแดชบอร์ดสรุปเสร็จสิ้น!");
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

// 🎯 [จุดที่แก้ไขตามสั่ง] อัปเกรดสูตรคำนวณกำไร/ขาดทุนตาราง Dashboard มวลรวมให้ถูกต้องตามหลักบัญชี
function rebuildLargeDashboardTableHTML() {
    const tbody = document.getElementById('dashboardTableBody');
    if(!tbody) return;
    tbody.innerHTML = "";

    let filteredDataset = cloudTransactionsCache;
    if(currentUserRole === "Staff" && myAllowedBranches.length > 0) {
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

    if(filteredDataset.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:#a39284; padding:20px;">📭 ไม่พบข้อมูลธุรกรรมตามเงื่อนไขที่เลือก</td></tr>`;
        return;
    }

    const localAssociationPrice = parseFloat(document.getElementById('dashboardAssociationPrice').value) || 44500;
    const localSilverPriceGrams = parseFloat(document.getElementById('dashboardSilverPriceInput').value) || 70;

    const reversedData = [...filteredDataset].reverse();
    reversedData.forEach(item => {
        let netProfitOrLoss = 0;
        
        // แปลงเปอร์เซ็นต์ (เช่น 96.5 หรือ 96.5%) ให้เป็นทศนิยมเพื่อนำไปคำนวณสมการ (เช่น 0.965)
        let actualPurity = parseFloat(String(item.purity).replace("%", "").trim()) / 100;
        if (isNaN(actualPurity) || actualPurity <= 0) actualPurity = 0;

        if(item.type === "เงินแท่ง" || item.type === "เงินหลอม") {
            // 🥈 สูตรแร่เงินใหม่: (ราคาเงินอ้างอิง * เปอร์เซ็นต์ * น้ำหนัก) - ต้นทุนรวมชิ้นนั้น
            let expectedSilverRevenue = localSilverPriceGrams * actualPurity * item.weight;
            netProfitOrLoss = expectedSilverRevenue - item.cost;
        } else {
            // 🥇 สูตรทองคำใหม่: (ราคาอ้างอิงสมาคม * 0.0656 * เปอร์เซ็นต์ * น้ำหนัก) - ต้นทุนรวมชิ้นนั้น
            let expectedGoldRevenue = localAssociationPrice * 0.0656 * actualPurity * item.weight;
            netProfitOrLoss = expectedGoldRevenue - item.cost;
        }

        let profitBadgeHtml = "";
        if(netProfitOrLoss >= 0) {
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

function switchDashboardTab(tabId, btn) { 
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active')); 
    document.querySelectorAll('.tab-nav-btn').forEach(b => b.classList.remove('active')); 
    document.getElementById(tabId).classList.add('active'); btn.classList.add('active'); 
    
    if(tabId === 'reportTab') {
        fetchTransactionsFromCloud();
    }
    if(tabId === 'calcTab') {
        refreshRatesFromCloud();
    }
}

function triggerStoreLogout() {
    stopAutoRefresh();
    localStorage.removeItem('DCSG_CURRENT_USER'); localStorage.removeItem('DCSG_CURRENT_PASS');
    currentShopName = ""; currentBranchName = ""; currentUserRole = "";
    document.getElementById('mainDashboard').style.display = 'none'; document.getElementById('authPortal').style.display = 'block';
    document.body.style.background = "radial-gradient(circle at center, #fdfbfa 0%, #f3ede6 100%)";
    switchAuthTab('login');
}

function backToLoginView() { document.getElementById('successView').style.display = 'none'; document.getElementById('authForms').style.display = 'block'; switchAuthTab('login'); }

checkAutoLoginSession();

let ccCurrentMode = 'GOLD'; 
let ccGoldRecords = [];
let ccSilverRecords = [];

let ccPricePerGram = 0;
let ccRawAmount = 0;
let ccFinalPay = 0;

let ccSavedHistory = JSON.parse(localStorage.getItem('darin_calc_history')) || [];

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
    document.getElementById('ccSubTitleText').innerText = "ระบบคำนวณราคาทองคำอัตโนมัติ (คลาสสิก)";
    document.getElementById('ccLblRefPrice').innerText = "1. ราคาอ้างอิงทอง (บาทละ)";
    document.getElementById('ccLblPureGoldBox').innerText = "✨ น้ำหนักทองเพียว 99.99% รวมทั้งหมด";
    document.getElementById('ccThPureGold').innerText = "4. ทองเพียว (กรัม)";
    document.getElementById('ccLblTableTitle').innerText = "📋 รายการบันทึกการซื้อขาย (ทองคำ)";
    extraPriceGroup.classList.remove('hidden-element');
    silverNetBox.classList.add('hidden-element'); 
  } else {
    document.getElementById('ccGoldModeBtn').className = 'mode-btn';
    document.getElementById('ccSilverModeBtn').className = 'mode-btn active-silver';
    document.getElementById('ccSubTitleText').innerText = "ระบบคำนวณราคาแร่เงินอัตโนมัติ (คลาสสิก)";
    document.getElementById('ccLblRefPrice').innerText = "1. ราคาอ้างอิงเงิน (บาทละ)";
    document.getElementById('ccLblPureGoldBox').innerText = "✨ น้ำหนักเงินเพียว รวมทั้งหมด";
    document.getElementById('ccThPureGold').innerText = "4. เงินเพียว (กรัม)";
    document.getElementById('ccLblTableTitle').innerText = "📋 รายการบันทึกการซื้อขาย (แร่เงิน)";
    extraPriceGroup.classList.add('hidden-element');
    silverNetBox.classList.remove('hidden-element'); 
  }

  document.getElementById('ccWeight').value = "";
  document.getElementById('ccPercent').value = "";
  document.getElementById('ccExtraPrice').value = ""; 

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
  (ccCurrentMode === 'GOLD') ? leftRefineBox.classList.add('hidden-element') : leftRefineBox.classList.remove('hidden-element');

  const tbody = document.getElementById('ccTableBody');
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

  for (let i = activeRecords.length; i < 15; i++) {
    const row = document.createElement('tr');
    row.innerHTML = `<td class="empty-row-text" style="text-align:left; padding-left:55px;">ก้อนที่ ${i+1}</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td>`;
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
  container.innerHTML = "";

  if (ccSavedHistory.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:#aaa; font-style:italic;">ยังไม่มีรายการประวัติการปิดยอดในวันนี้</div>`;
    document.getElementById('ccGrandTotalDisplay').innerText = "ทองคำ: 0 บาท | แร่เงิน: 0 บาท";
    return;
  }

  let goldGrandTotal = 0, silverGrandTotal = 0;

  ccSavedHistory.forEach((item, index) => {
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
          <button class="hist-btn btn-view-detail" onclick="ccViewBillDetails(${item.id})">🔎 ดูรายละเอียด</button>
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

function ccViewBillDetails(id) {
  const targetBill = ccSavedHistory.find(item => item.id === id);
  if (!targetBill) return;

  const labelSymbol = targetBill.type === 'GOLD' ? '🟡 ทอง' : '⚪ เงิน';
  document.getElementById('ccModalTitleText').innerText = `🔎 รายละเอียดบิลรับซื้อ [ ประเภท: ${targetBill.type === 'GOLD' ? 'ทองคำ' : 'แร่เงิน'} ]`;
  document.getElementById('ccModalMetaInfo').innerHTML = `👤 ผู้ขาย: <b>${targetBill.clientName}</b> <br>📅 บันทึกเมื่อ: ${targetBill.time}`;

  const mBody = document.getElementById('ccModalTableBody');
  mBody.innerHTML = "";

  targetBill.details.forEach((record, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align:left; padding-left:15px;">${labelSymbol}ก้อนที่ ${index+1}</td>
      <td>${record.weight.toFixed(3)}</td>
      <td>${record.percent}%</td>
      <td>${ccFormatPricePerGram(record.pricePerGram)}</td>
      <td>${record.pureGold.toFixed(3)}</td>
      <td style="font-weight:bold; color:#b59275;">${record.finalPay.toLocaleString('th-TH')} บาท</td>
    `;
    mBody.appendChild(tr);
  });

  const modalTotalAmount = targetBill.details.reduce((sum, r) => sum + (r.rawAmount || 0), 0);
  const modalAvgPricePerGram = targetBill.weightSum > 0 ? (modalTotalAmount / targetBill.weightSum) : 0;

  const trSum = document.createElement('tr');
  trSum.className = "summary-row";
  trSum.innerHTML = `
    <td style="text-align:left; padding-left:15px; font-weight:bold;">ยอดรวมบิล</td>
    <td style="font-weight:bold;">${targetBill.weightSum.toFixed(3)} กรัม</td>
    <td style="font-weight:bold;">-</td>
    <td style="font-weight:bold;">${ccFormatPricePerGram(modalAvgPricePerGram)}</td>
    <td style="font-weight:bold;">${targetBill.pureSum.toFixed(3)} กรัม</td>
    <td style="font-weight:bold; color:#27ae60;">${Math.ceil(targetBill.netSum).toLocaleString('th-TH')} บาท</td>
  `;
  mBody.appendChild(trSum);

  document.getElementById('ccDetailModal').classList.remove('hidden-element');
}

function ccCloseModal() {
  document.getElementById('ccDetailModal').classList.add('hidden-element');
}

ccRenderTable();
document.getElementById('ccRefPrice').addEventListener('input', ccCalculateGold);
document.getElementById('ccExtraPrice').addEventListener('input', ccCalculateGold);
document.getElementById('ccWeight').addEventListener('input', ccCalculateGold);
document.getElementById('ccPercent').addEventListener('input', ccCalculateGold);
