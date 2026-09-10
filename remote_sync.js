/**
 * iHOMIS+ PhilHealth Universal Synchronizer
 * CENTRAL ADMIN AUTO-UPDATE ENGINE (Vercel-Hosted Remote Loader)
 *
 * NOTE FOR ADMIN:
 * Any updates pushed to Vercel (https://philhealth-oplan-er.vercel.app/remote_sync.js)
 * will automatically run on ALL hospital PCs instantly.
 * Client PCs NO LONGER NEED to click "Reload Extension" in Chrome/Brave!
 */

(function loadCentralAdminScript() {
    try {
        const existing = document.getElementById('ihomis_central_admin_engine');
        if (existing) existing.remove();
        const script = document.createElement('script');
        script.id = 'ihomis_central_admin_engine';
        script.src = 'https://philhealth-oplan-er.vercel.app/remote_sync.js?t=' + Math.floor(Date.now() / 60000);
        (document.head || document.documentElement).appendChild(script);
        console.log('[iHOMIS Central Admin Sync] Auto-loaded remote logic from Vercel Cloud!');
    } catch(e) {}
})();

const SUPABASE_URL = 'https://iaqxrrxwineayfxnpwjt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhcXhycnh3aW5lYXlmeG5wd2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4ODIxNDYsImV4cCI6MjEwMzQ1ODE0Nn0.JRDagYX2ZK4q0OE3XZBwNK3mN8MyAQjA9QRxJ1y4l_4';

console.log('[iHOMIS+ Sync v17.0] STRICT SOA-ONLY & DataTables All-Entries Auto-Sync Active.');

// ─── PAGE CONTEXT INTERCEPTOR & DATATABLES EXPANDER ─────────────────────────
(function injectPageContextInterceptor() {
    try {
        const script = document.createElement('script');
        script.id = 'ihomis_page_interceptor';
        script.textContent = `
            (function() {
                console.log('[iHOMIS Interceptor v17] Injected into page context');

                // Force jQuery DataTables to show ALL entries (-1)
                window.expandDataTablesToAll = function() {
                    try {
                        if (window.jQuery && window.jQuery.fn && window.jQuery.fn.dataTable) {
                            window.jQuery('table').each(function() {
                                if (window.jQuery.fn.dataTable.isDataTable(this)) {
                                    var dt = window.jQuery(this).DataTable();
                                    var pageInfo = dt.page.info();
                                    if (pageInfo && pageInfo.length > 0 && pageInfo.length < pageInfo.recordsDisplay) {
                                        console.log('[iHOMIS Interceptor] Expanding DataTables from ' + pageInfo.length + ' to ALL (' + pageInfo.recordsDisplay + ' entries)...');
                                        dt.page.len(-1).draw(false);
                                    }
                                }
                            });
                        }
                    } catch(e) {}
                };

                if (window.location.href.includes('EclaimsTransmittal')) {
                    setInterval(window.expandDataTablesToAll, 1200);
                }

                // Intercept XHR responses
                var origOpen = XMLHttpRequest.prototype.open;
                var origSend = XMLHttpRequest.prototype.send;
                XMLHttpRequest.prototype.open = function(method, url) {
                    this._url = url;
                    return origOpen.apply(this, arguments);
                };
                XMLHttpRequest.prototype.send = function(body) {
                    this.addEventListener('load', function() {
                        try {
                            if (this.responseText && this.responseText.length > 10) {
                                window.postMessage({
                                    type: 'IHOMIS_AJAX_DATA',
                                    url: this._url,
                                    body: this.responseText
                                }, '*');
                            }
                        } catch(e) {}
                    });
                    return origSend.apply(this, arguments);
                };
            })();
        `;
        (document.head || document.documentElement).appendChild(script);
    } catch(e) {}
})();

window.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'IHOMIS_AJAX_DATA') {
        const text = event.data.body || '';
        if (text.includes('260') || text.includes('CHEQUE') || text.includes('RETURN') || text.includes('DENIED') || text.includes('IN PROCESS')) {
            setTimeout(extractTransmittalList, 600);
        }
    }
});

// ─── Name guard: MUST be a real human patient name ─────────────────────────
const NAME_BLACKLIST = [
    'BABY', 'BB.', 'B.B.', 'NEWBORN', 'NEW BORN',
    'SURGEON', 'PROCEDURE', 'EXPANDED', 'PACKAGE',
    'ANESTHESIOLOGIST', 'PEDIATRICIAN', 'OB-GYNE',
    'SERVICE', 'CHARGE', 'FEE', 'ROOM', 'DELIVERY',
    'ATTENDING', 'PHYSICIAN', 'DOCTOR', 'NURSE',
    'TOTAL', 'SUMMARY', 'DISCOUNT', 'ADJUSTMENT',
    'CASHIER', 'MEDICINE', 'SUPPLIES', 'LABORATORY',
    'XRAY', 'ADMISSION', 'DISCHARGE', 'PARTICULARS',
    'HOSPITAL', 'DR.', 'DR,', 'AMOUNT', 'PAID', 'PCSO', 'HMO', 'PROMISSORY',
    'INDIRECT', 'CONTRIBUTOR', 'LISTAHANAN', 'SPONSORED', 'INDIGENT',
    'INFORMAL', 'FORMAL', 'DEPENDENT', 'ENTERED', 'CATEGORY', 'MEMBERSHIP',
    'NBB', 'POS-FINANCIALLY', 'CLASSIFICATION', 'INCAPABLE', 'DIRECT', 'PAYING'
];

function isGenuinePatientName(name) {
    if (!name || typeof name !== 'string') return false;
    const clean = name.trim().toUpperCase();
    if (clean.length < 4 || clean.length > 60) return false;
    for (let term of NAME_BLACKLIST) {
        if (clean.includes(term)) return false;
    }
    if (!/^[A-ZÑ\s,.\-ñ]+$/.test(clean)) return false;
    const words = clean.split(/[\s,]+/).filter(w => w.length >= 2);
    if (words.length < 2) return false;
    return true;
}

function parseExactDate(dateStr) {
    if (!dateStr) return null;
    const clean = String(dateStr).trim().split(' ')[0];
    const parts = clean.split(/[-/]/);
    if (parts.length === 3) {
        if (parts[2].length === 4) {
            const y = parseInt(parts[2]);
            if (y < 2020 || y > 2030) return null; // Reject obviously wrong years
            return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        } else if (parts[0].length === 4) {
            const y = parseInt(parts[0]);
            if (y < 2020 || y > 2030) return null;
            return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
    }
    return null;
}

function parseName(fullName) {
    if (!fullName) return { last: '', first: '', middle: '' };
    const clean = String(fullName).replace(/\s+/g, ' ').trim();
    if (clean.includes(',')) {
        const parts = clean.split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length >= 3) return { last: parts[0], first: parts[1], middle: parts[2] };
        if (parts.length === 2) return { last: parts[0], first: parts[1], middle: '' };
    }
    const sp = clean.split(' ').filter(Boolean);
    if (sp.length >= 3) return { last: sp[sp.length - 1], first: sp[0], middle: sp.slice(1, sp.length - 1).join(' ') };
    if (sp.length === 2) return { last: sp[1], first: sp[0], middle: '' };
    return { last: clean, first: '', middle: '' };
}

// ─── ICD-10 CODE VALIDATOR ──────────────────────────────────────────────────
// Only accept real-looking ICD-10 or RVS codes, NEVER J18.9 as default
function isValidIcdCode(code) {
    if (!code) return false;
    const c = code.trim().toUpperCase();
    if (c === 'J18.9') return false; // Blanket exclusion – this was placeholder
    if (c.length < 3 || c.length > 20) return false;
    // ICD-10: letter + 2 digits (e.g. A06, N39.0, J18.92)
    if (/^[A-Z][0-9]{2}(\.[0-9A-Z]*)?$/.test(c)) return true;
    // RVS: 5-digit numeric procedure codes (e.g. 90935, 59513, NSD01, OPER1)
    if (/^[0-9]{5}$/.test(c)) return true;
    if (/^(NSD01|NSD02|OPER1|OPER2|CS01|CS02|Z38\.[0-9]|P0000|99460|90935|90375|59[0-9]{3}|25500)$/i.test(c)) return true;
    return false;
}

// ─── 1. SOA / FINAL BILL EXTRACTOR (The ONLY source of ICD + Amount) ────────
async function extractSOA() {
    const text = document.body.innerText;
    const textUp = text.toUpperCase();

    const hasSOA = textUp.includes('SUMMARY OF CHARGES') ||
                   textUp.includes('STATEMENT OF ACCOUNT') ||
                   textUp.includes('FINAL BILL') ||
                   textUp.includes('FINAL DIAGNOSIS');

    if (!hasSOA) return;

    console.log('[iHOMIS Sync v15] SOA page detected, extracting...');

    let patientName = '', memberName = '', caseNo = '', phicNo = '', dateAdmitted = null, dateDischarged = null;
    let icdCode = null, totalAmt = null;

    // Extract patient name — handle BOTH formats:
    // SOA printout: "NAME OF PATIENT : DELA CRUZ, LEONCIA MAG-ASO"
    // Billing screen: "Patient name: DELA CRUZ, LEONCIA MAG-ASO"
    const nameMatch = text.match(/NAME\s*OF\s*PATIENT\s*:\s*([^\n\r:]+)/i) ||
                      text.match(/Patient\s+name\s*:\s*([^\n\r]+)/i) ||
                      text.match(/Patient\s*:\s*([A-Za-zÑñ,.\s\-]+?)(?:\s{2,}|\n)/i);
    if (nameMatch) patientName = nameMatch[1].trim().replace(/\s+/g, ' ');
    console.log('[iHOMIS Sync] Patient name:', patientName);

    // Extract Account Number — handle BOTH formats:
    // SOA printout: "ACCOUNT NUMBER : 2026-000036909"
    // Billing screen: "Account: 2026-000050660"
    const accMatch = text.match(/ACCOUNT\s*NUMBER\s*:\s*(20\d{2}-?\d{4,9})/i) ||
                     text.match(/Account\s*:\s*(20\d{2}-?\d{4,9})/i) ||
                     text.match(/Case\s*#\s*:\s*(20\d{2}-?\d{4,9})/i);
    if (accMatch) caseNo = accMatch[1].trim();
    console.log('[iHOMIS Sync] Case/Account No:', caseNo);

    // Extract PhilHealth PIN and Member Name:
    // Format 1 (iHOMIS Billing/Case Screen): "Philhealth: YAP, MARIEL, CARCOSIA - 122033742337 - INDIRECT CONTRIBUTOR..."
    // Format 2 (SOA Printout): "PHIC MEMBERSHIP: ... 122033742337 - YAP, MARIEL, CARCOSIA"
    const ihomisPhilMatch = text.match(/Philhealth\s*:\s*([A-Za-zÑñ,.\s]+?)\s*[-–]\s*(\d{12})/i);
    const pinFirstMatch = text.match(/(\d{12})\s*[-–]\s*([A-Za-zÑñ,.\s]+?)(?:\s*[-–]|\s*\n|\s*\r|$)/i);

    if (ihomisPhilMatch) {
        const candMember = ihomisPhilMatch[1].trim().replace(/\s+/g, ' ');
        if (isGenuinePatientName(candMember)) memberName = candMember;
        phicNo = ihomisPhilMatch[2].trim();
    } else if (pinFirstMatch) {
        phicNo = pinFirstMatch[1].trim();
        const candMember = pinFirstMatch[2].trim().replace(/\s+/g, ' ');
        if (isGenuinePatientName(candMember)) memberName = candMember;
    }

    if (!phicNo) {
        const phicMatch = text.match(/Philhealth\s*:\s*(\d{12})/i) ||
                          text.match(/PHIC\s*(?:MEMBERSHIP)?\s*:\s*(?:[^\n]*\n\s*)?(\d{12})/i) ||
                          text.match(/\b(\d{12})\b/);
        if (phicMatch) phicNo = phicMatch[1].trim();
    }

    if (!memberName || !isGenuinePatientName(memberName)) {
        memberName = patientName;
    }
    console.log('[iHOMIS Sync] PhilHealth PIN:', phicNo, '| Member Name:', memberName);

    // Extract Admission Date — handles both formats:
    // SOA: "DATE/TIME ADMITTED : 06/29/2026 11:00:00 PM"
    // Billing screen: "Date entered: 08/27/2026 11:38 AM"
    const admMatch = text.match(/DATE(?:\/TIME)?\s*ADMITTED\s*:\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{4})/i) ||
                     text.match(/Date\s*entered\s*:\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{4})/i) ||
                     text.match(/Admitted\s*:\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{4})/i);
    if (admMatch) dateAdmitted = parseExactDate(admMatch[1]);
    console.log('[iHOMIS Sync] Admitted:', dateAdmitted);

    const disMatch = text.match(/DATE(?:\/TIME)?\s*DISCHARGED\s*:\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{4})/i) ||
                     text.match(/Discharged\s*:\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{4})/i);
    if (disMatch) dateDischarged = parseExactDate(disMatch[1]);
    console.log('[iHOMIS Sync] Discharged:', dateDischarged);

    // ─── STRICT RULE: ONLY EXTRACT ICD-10 / RVS CODE & AMOUNT FROM "SUMMARY OF CHARGES - PHIC" ───
    // 1. Extract ICD-10 CODE and RVS CODE headers under SUMMARY OF CHARGES - PHIC
    const icdMatch = text.match(/(?:ICD[\-\s]*10|1ST\s*ICD)\s*CODE\s*:\s*([A-Z0-9.\s]+?)(?:;|\n|\r|RVS|First|Second|$)/i);
    const rvsMatch = text.match(/(?:RVS|1ST\s*RVS)\s*CODE\s*:\s*([A-Z0-9.\s]+?)(?:;|\n|\r|First|Second|$)/i);

    const foundIcd = icdMatch ? icdMatch[1].trim().replace(/[*:]/g, '') : null;
    const foundRvs = rvsMatch ? rvsMatch[1].trim().replace(/[*:]/g, '') : null;

    const validIcd = foundIcd && isValidIcdCode(foundIcd) ? foundIcd : null;
    const validRvs = foundRvs && isValidIcdCode(foundRvs) ? foundRvs : null;

    if (validIcd && validRvs) {
        icdCode = `${validIcd} / ${validRvs}`;
    } else if (validIcd) {
        icdCode = validIcd;
    } else if (validRvs) {
        icdCode = validRvs;
    }

    // Fallback: If no explicit ICD-10/RVS label found under SUMMARY OF CHARGES, look for generic code label
    if (!icdCode) {
        const codeLabelMatch = text.match(/(?:ICD[\-\s]*10|RVS)\s*CODE\s*:\s*([A-Z0-9.\s]+)/i);
        if (codeLabelMatch) {
            const c = codeLabelMatch[1].trim().split(/\s+/)[0].replace(/[*:]/g, '');
            if (isValidIcdCode(c) || /^[0-9]{5}$/.test(c)) icdCode = c;
        }
    }
    console.log('[iHOMIS Sync] Extracted ICD/RVS code from SUMMARY OF CHARGES:', icdCode);

    // 2. Extract Case Rate Amounts from SUMMARY OF CHARGES - PHIC table TOTAL row
    const tables = Array.from(document.querySelectorAll('table'));
    console.log('[iHOMIS Sync] Total tables on page:', tables.length);

    for (const tbl of tables) {
        const tblText = tbl.innerText.toUpperCase();
        if (!tblText.includes('SUMMARY OF CHARGES') && !tblText.includes('CASE RATE') && !tblText.includes('PHIC')) continue;
        console.log('[iHOMIS Sync] Found SUMMARY OF CHARGES table!', tblText.slice(0, 100));

        const trs = Array.from(tbl.querySelectorAll('tr'));
        let firstCaseColIdx = -1;
        let secondCaseColIdx = -1;

        for (const tr of trs) {
            const cells = Array.from(tr.querySelectorAll('th, td')).map(c => c.innerText.trim().toUpperCase());
            const idx1 = cells.findIndex(h => (h.includes('FIRST') || h.includes('1ST')) && h.includes('CASE'));
            if (idx1 !== -1) firstCaseColIdx = idx1;

            const idx2 = cells.findIndex(h => (h.includes('SECOND') || h.includes('2ND')) && h.includes('CASE'));
            if (idx2 !== -1) secondCaseColIdx = idx2;
        }

        // Get TOTAL row
        const totalTr = trs.find(tr => {
            const first = (tr.querySelector('td, th') || {}).innerText || '';
            return first.trim().toUpperCase() === 'TOTAL';
        });

        if (totalTr) {
            const cells = Array.from(totalTr.querySelectorAll('td, th'));
            let firstAmt = 0;
            let secondAmt = 0;

            if (firstCaseColIdx !== -1 && cells[firstCaseColIdx]) {
                const v = parseFloat(cells[firstCaseColIdx].innerText.replace(/[^0-9.]/g, ''));
                if (!isNaN(v) && v > 0) firstAmt = v;
            }
            if (secondCaseColIdx !== -1 && cells[secondCaseColIdx]) {
                const v = parseFloat(cells[secondCaseColIdx].innerText.replace(/[^0-9.]/g, ''));
                if (!isNaN(v) && v > 0) secondAmt = v;
            }

            if (firstAmt + secondAmt > 0) {
                totalAmt = firstAmt + secondAmt;
            }
        }

        if (!totalAmt && totalTr) {
            // Fallback: sum all numeric values >= 500 in TOTAL row
            const cells = Array.from(totalTr.querySelectorAll('td, th'));
            const nums = cells.map(c => parseFloat(c.innerText.replace(/[^0-9.]/g, ''))).filter(n => !isNaN(n) && n >= 500);
            if (nums.length) totalAmt = nums.reduce((a, b) => a + b, 0);
        }

        if (totalAmt) break;
    }

    // Fallback text-based amount extraction
    if (!totalAmt) {
        const amtMatch = text.match(/TOTAL\s+[\d,]+\.?\d*\s+[\d,]+\.?\d*\s+([\d,]+\.?\d*)\s/);
        if (amtMatch) {
            const v = parseFloat(amtMatch[1].replace(/,/g, ''));
            if (!isNaN(v) && v >= 1000) totalAmt = v;
        }
    }

    if (!caseNo) {
        console.log('[iHOMIS Sync] Missing case/account no — skipping save');
        return;
    }

    // If ICD code or Amount is missing (e.g. when Final Bill is rendered inside a PDF viewer iframe/modal),
    // background fetch candidate SOA HTML endpoints for this account number!
    if (caseNo && hasValidName && (!icdCode || !totalAmt)) {
        console.log('[iHOMIS Sync] Missing ICD/Amount for account', caseNo, '— background fetching SOA HTML...');
        const candidateUrls = [
            `${window.location.origin}/Billing/PrintSOA?accountNo=${caseNo}`,
            `${window.location.origin}/Billing/FinalBill?accountNo=${caseNo}`,
            `${window.location.origin}/Billing/SummaryOfCharges?accountNo=${caseNo}`,
            `${window.location.origin}/Billing/GetSOA?accountNo=${caseNo}`,
            `${window.location.origin}/Billing/PrintSOA?account_no=${caseNo}`,
            `${window.location.origin}/Billing/FinalBill?encounter_no=${caseNo}`
        ];

        for (const url of candidateUrls) {
            try {
                const resp = await fetch(url, { credentials: 'include' });
                if (!resp.ok) continue;
                const html = await resp.text();
                if (!html || html.length < 50) continue;

                // Extract ICD-10 from background SOA HTML
                if (!icdCode) {
                    const icdMatch = html.match(/(?:ICD[\-\s]*10|1ST\s*ICD)\s*CODE\s*:\s*([A-Z0-9.\s]+?)(?:;|\n|\r|RVS|First|Second|<|$)/i);
                    const rvsMatch = html.match(/(?:RVS|1ST\s*RVS)\s*CODE\s*:\s*([A-Z0-9.\s]+?)(?:;|\n|\r|First|Second|<|$)/i);
                    const foundIcd = icdMatch ? icdMatch[1].trim().replace(/[*:]/g, '') : null;
                    const foundRvs = rvsMatch ? rvsMatch[1].trim().replace(/[*:]/g, '') : null;
                    const validIcd = foundIcd && isValidIcdCode(foundIcd) ? foundIcd : null;
                    const validRvs = foundRvs && isValidIcdCode(foundRvs) ? foundRvs : null;

                    if (validIcd && validRvs) icdCode = `${validIcd} / ${validRvs}`;
                    else if (validIcd) icdCode = validIcd;
                    else if (validRvs) icdCode = validRvs;
                }

                // Extract Amount from background SOA HTML
                if (!totalAmt) {
                    const totalMatch = html.match(/TOTAL[^\d]*([\d,]+\.?\d*)/i);
                    if (totalMatch) {
                        const v = parseFloat(totalMatch[1].replace(/,/g, ''));
                        if (!isNaN(v) && v >= 500) totalAmt = v;
                    }
                }

                if (icdCode && totalAmt) {
                    console.log(`[iHOMIS Sync] Background SOA fetch SUCCESS for ${caseNo}: ICD=${icdCode}, Amt=₱${totalAmt}`);
                    break;
                }
            } catch(e) {}
        }
    }

    // STRICT IBNR REQUIREMENT: Require Genuine Patient Name AND Valid ICD/RVS Code AND Positive Claim Amount!
    const hasValidIcd  = icdCode && (isValidIcdCode(icdCode) || /^[0-9]{5}$/.test(icdCode) || icdCode.includes('/'));
    const hasValidAmt  = totalAmt && !isNaN(totalAmt) && totalAmt > 0;

    if (!hasValidName || !hasValidIcd || !hasValidAmt) {
        console.log('[iHOMIS Sync] Skipping IBNR save — record incomplete (Name:', hasValidName, '| ICD:', hasValidIcd, '| Amount:', hasValidAmt, ')');
        return;
    }

    try {
        const nameObj = parseName(patientName);
        const memObj = memberName ? parseName(memberName) : nameObj;
        const pin = (phicNo && phicNo.length >= 10) ? phicNo : null;

        // 1. Check if record already exists by encounter_no OR (patient_surname + patient_firstname + date_admission)
        let existingId = null;

        // Query by encounter_no
        const encRes = await fetch(`${SUPABASE_URL}/rest/v1/annex_b_ibnr?encounter_no=eq.${caseNo}&select=id`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        }).catch(() => null);

        if (encRes && encRes.ok) {
            const arr = await encRes.json();
            if (arr && arr.length > 0) existingId = arr[0].id;
        }

        // Fallback query by patient name + date_admission if encounter_no query didn't find anything
        if (!existingId && nameObj && nameObj.last && nameObj.first && dateAdmitted) {
            const nameRes = await fetch(`${SUPABASE_URL}/rest/v1/annex_b_ibnr?patient_surname=eq.${encodeURIComponent(nameObj.last)}&patient_firstname=eq.${encodeURIComponent(nameObj.first)}&date_admission=eq.${dateAdmitted}&select=id`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            }).catch(() => null);

            if (nameRes && nameRes.ok) {
                const arr = await nameRes.json();
                if (arr && arr.length > 0) existingId = arr[0].id;
            }
        }

        if (existingId) {
            // SINGLE ENTRY GUARANTEE: Update existing record!
            const patchBody = {};
            if (icdCode) patchBody.icd_rvs_code = icdCode;
            if (totalAmt) patchBody.claim_amount = totalAmt;
            if (pin) patchBody.member_pin = pin;
            if (dateAdmitted) patchBody.date_admission = dateAdmitted;
            if (dateDischarged) patchBody.date_discharge = dateDischarged;
            if (memObj && memObj.last) {
                patchBody.member_surname = memObj.last;
                patchBody.member_firstname = memObj.first;
                patchBody.member_middlename = memObj.middle || '';
            }

            console.log('[iHOMIS Sync] Single entry match found (ID: ' + existingId + ') — updating existing record:', patchBody);
            await fetch(`${SUPABASE_URL}/rest/v1/annex_b_ibnr?id=eq.${existingId}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(patchBody)
            });
        } else if (nameObj && nameObj.last && nameObj.first && icdCode && totalAmt) {
            // New patient — insert single new record ONLY if both ICD/RVS code and totalAmt exist!
            const payload = {
                encounter_no: caseNo,
                claim_code: caseNo,
                patient_surname: nameObj.last,
                patient_firstname: nameObj.first,
                patient_middlename: nameObj.middle || '',
                member_surname: (memObj && memObj.last) || nameObj.last,
                member_firstname: (memObj && memObj.first) || nameObj.first,
                member_middlename: (memObj && memObj.middle) || nameObj.middle || '',
                member_pin: pin,
                date_admission: dateAdmitted,
                date_discharge: dateDischarged,
                icd_rvs_code: icdCode,
                claim_amount: totalAmt,
                claim_status: 'UNSUBMITTED'
            };

            console.log('[iHOMIS Sync] Inserting single complete patient record with ICD + Amount:', payload);
            await fetch(`${SUPABASE_URL}/rest/v1/annex_b_ibnr`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify([payload])
            });
        }

        // Also update Annex C if transmitted
        if (icdCode && totalAmt) {
            await fetch(`${SUPABASE_URL}/rest/v1/annex_c_claims?encounter_no=eq.${caseNo}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ icd_rvs_code: icdCode, claim_amount: totalAmt })
            });
        }

        const amtDisplay = totalAmt ? `₱${totalAmt.toLocaleString()}` : 'Pending PHIC Summary';
        showBadge(`✅ Synced: ${caseNo} | ${icdCode || 'ICD Pending'} | ${amtDisplay}`);
    } catch(e) {
        console.error('[iHOMIS Sync] Save error:', e);
    }
}


// ─── 2. TRANSMITTAL LIST EXTRACTOR (Annex C only, strict 26... series) ──────
function autoExpandTransmittalPagination() {
    try {
        const lengthSelects = document.querySelectorAll('select[name*="length"], select.custom-select, select.form-control-sm');
        lengthSelects.forEach(select => {
            if (select.value === '10' || select.value === '25') {
                const has100 = Array.from(select.options).some(opt => opt.value === '100');
                const hasAll = Array.from(select.options).some(opt => opt.value === '-1' || opt.value === '1000');
                
                if (hasAll) {
                    select.value = select.options[select.options.length - 1].value;
                } else if (has100) {
                    select.value = '100';
                } else {
                    const newOpt = document.createElement('option');
                    newOpt.value = '1000';
                    newOpt.innerText = '1000';
                    select.appendChild(newOpt);
                    select.value = '1000';
                }
                select.dispatchEvent(new Event('change', { bubbles: true }));
                console.log('[iHOMIS Sync] Expanded pagination to show ALL entries!');
            }
        });
    } catch(e) {
        console.error('[iHOMIS Sync] Pagination expansion error:', e);
    }
}

async function extractTransmittalList() {
    const pageText = document.body.innerText.toUpperCase();
    const isTransmittal = pageText.includes('TRANSMITTAL LIST') || 
                           pageText.includes('CLAIM SERIES LHIO') ||
                           pageText.includes('ECLAIMS TRANSMITTAL');
    if (!isTransmittal) return;

    // Expand pagination if showing only 10 entries
    autoExpandTransmittalPagination();

    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    if (rows.length === 0) return;

    const annexC = [];
    const toDeleteFromIBNR = [];

    rows.forEach((tr, rowIndex) => {
        const tds = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
        if (tds.length < 4) return;

        // Must have a genuine 26... series number (PhilHealth transmittal)
        const seriesCell = tds.find(c => /^26[0-9]{11,16}$/.test(c.replace(/\s/g, '')));
        if (!seriesCell) return;
        const seriesNo = seriesCell.replace(/\s/g, '');

        // Patient name
        const patientFullName = tds.find((c, i) => i >= 1 && isGenuinePatientName(c)) || '';
        if (!patientFullName) return;

        // Dates
        let adm = null, dis = null, filed = null;
        for (const cell of tds) {
            const d = parseExactDate(cell);
            if (d) {
                if (!adm) adm = d;
                else if (!dis) dis = d;
                else if (!filed) filed = d;
            }
        }

        // Status
        let status = 'IN PROCESS';
        for (const cell of tds) {
            const u = cell.toUpperCase().trim();
            if (u === 'WITH CHEQUE' || u === 'CHEQUE' || u === 'PAID') { status = 'WITH CHEQUE'; break; }
            else if (u === 'RETURN TO HOSPITAL' || u === 'RTH' || u.includes('RETURN')) { status = 'RETURN'; break; }
            else if (u === 'DENIED') { status = 'DENIED'; break; }
            else if (u === 'WITH VOUCHER' || u === 'VOUCHER') { status = 'WITH VOUCHER'; break; }
        }

        // Encounter/case number (iHOMIS internal) — look for 2026-XXXXXX pattern or 12-digit hosp claim
        let encNo = tds.find(c => /^2026-[0-9]{6}$/.test(c)) ||
                    tds.find(c => /^[0-9]{10,14}$/.test(c.replace(/\D/g, '')) && c !== seriesNo) || seriesNo;
        if (typeof encNo === 'string') encNo = encNo.replace(/\D/g, '') || seriesNo;

        const nameObj = parseName(patientFullName);
        toDeleteFromIBNR.push(encNo);

        // Collect any eye button links in the row
        const rowLinks = [];
        const anchors = tr.querySelectorAll('a[href], button[onclick]');
        anchors.forEach(a => {
            const href = a.getAttribute('href');
            const onclickStr = a.getAttribute('onclick') || '';
            if (href && href !== '#' && !href.startsWith('javascript')) {
                rowLinks.push(new URL(href, window.location.href).href);
            } else if (onclickStr) {
                const m = onclickStr.match(/['"]([^'"]*(?:Details|View|Claim|Billing|SOA)[^'"]*)['"]/i);
                if (m) rowLinks.push(new URL(m[1], window.location.href).href);
            }
        });

        annexC.push({
            claim_series_no: seriesNo,
            encounter_no: encNo,
            patient_surname: nameObj.last,
            patient_firstname: nameObj.first,
            patient_middlename: nameObj.middle,
            member_surname: nameObj.last,
            member_firstname: nameObj.first,
            member_middlename: nameObj.middle,
            date_admission: adm,
            date_discharge: dis,
            date_filed: filed,
            icd_rvs_code: null,
            claim_amount: null,
            claim_status: status,
            _rowLinks: rowLinks,
            _tr: tr
        });
    });

    if (annexC.length === 0) return;

    // Pre-fetch ICD/Amount from IBNR to preserve complete data
    for (const item of annexC) {
        try {
            const ibnrRes = await fetch(`${SUPABASE_URL}/rest/v1/annex_b_ibnr?patient_surname=eq.${encodeURIComponent(item.patient_surname)}&patient_firstname=eq.${encodeURIComponent(item.patient_firstname)}&select=icd_rvs_code,claim_amount,member_pin`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            if (ibnrRes && ibnrRes.ok) {
                const arr = await ibnrRes.json();
                if (arr && arr.length > 0) {
                    if (arr[0].icd_rvs_code) item.icd_rvs_code = arr[0].icd_rvs_code;
                    if (arr[0].claim_amount) item.claim_amount = arr[0].claim_amount;
                    if (arr[0].member_pin) item.member_pin = arr[0].member_pin;
                }
            }
        } catch(e) {}
    }

    // ─── BACKGROUND AUTO-DIGGER ENGINE ────────────────────────────────────────
    for (let idx = 0; idx < annexC.length; idx++) {
        const item = annexC[idx];

        if (!item.icd_rvs_code || !item.claim_amount) {
            const candidateUrls = [...(item._rowLinks || [])];
            if (item.encounter_no) {
                candidateUrls.push(`${window.location.origin}/EclaimsTransmittal/Details/${item.encounter_no}`);
                candidateUrls.push(`${window.location.origin}/EclaimsTransmittal/ClaimDetails?seriesNo=${item.claim_series_no}`);
                candidateUrls.push(`${window.location.origin}/Billing/SummaryOfCharges?encounter_no=${item.encounter_no}`);
                candidateUrls.push(`${window.location.origin}/SOA/View/${item.encounter_no}`);
            }

            for (const url of candidateUrls) {
                try {
                    console.log('[iHOMIS Auto-Dig] Background fetching:', url, 'for', item.patient_surname);
                    const resp = await fetch(url, { credentials: 'include' });
                    if (!resp.ok) continue;
                    const html = await resp.text();

                    // Extract ICD-10 or RVS code
                    const codeMatch = html.match(/(?:ICD[\-\s]*10|RVS)\s*CODE\s*:\s*([A-Z0-9.\s]+)/i) ||
                                      html.match(/(?:FINAL\s*DIAGNOSIS|PRIMARY\s*DIAGNOSIS|Diagnosis)\s*:[^\(]*\(\s*([A-Z0-9.\s]+?)\s*\)/i) ||
                                      html.match(/\(\s*([A-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?|[0-9]{5}|Z38\.[0-9]|99460|NSD01|NSD02|OPER1|OPER2|CS01)\s*[A-Z0-9*\s]*\)/i) ||
                                      html.match(/\b([A-Z][0-9]{2}\.[0-9A-Z]{1,3})\b/);
                    if (codeMatch) {
                        const c = codeMatch[1].trim().split(/\s+/)[0].replace(/\*$/, '');
                        if (isValidIcdCode(c) || /^[0-9]{5}$/.test(c)) item.icd_rvs_code = c;
                    }

                    // Extract First Case Rate amount
                    const amtMatch = html.match(/(?:First|1st)\s*Case\s*(?:Rate)?\s*(?:Amount)?[^\d]*([\d,]+\.?\d*)/i) ||
                                      html.match(/(?:PHILHEALTH|PHIC)\s*(?:BENEFIT|DEDUCTION|AMOUNT|TOTAL)[^\d]*([\d,]+\.?\d*)/i) ||
                                      html.match(/TOTAL[^\d]*[\d,]+\.?\d*[^\d]*[\d,]+\.?\d*[^\d]*([\d,]+\.?\d*)/i) ||
                                      html.match(/₱\s*([\d,]+\.?\d*)/);
                    if (amtMatch) {
                        const v = parseFloat(amtMatch[1].replace(/,/g, ''));
                        if (!isNaN(v) && v >= 500) item.claim_amount = v;
                    }

                    if (item.icd_rvs_code && item.claim_amount) {
                        console.log(`[iHOMIS Auto-Dig] SUCCESS for ${item.patient_surname}: ICD=${item.icd_rvs_code}, Amt=₱${item.claim_amount}`);
                        break;
                    }
                } catch(err) {
                    console.error('[iHOMIS Auto-Dig] Error fetching URL:', url, err);
                }
            }
        }
    }

    // Upsert to Annex C without null overwrites
    for (let i = 0; i < annexC.length; i += 100) {
        const chunk = annexC.slice(i, i + 100).map(item => {
            const cleanObj = { ...item };
            delete cleanObj._rowLinks;
            delete cleanObj._tr;
            if (cleanObj.icd_rvs_code === null) delete cleanObj.icd_rvs_code;
            if (cleanObj.claim_amount === null) delete cleanObj.claim_amount;
            return cleanObj;
        });
        await fetch(`${SUPABASE_URL}/rest/v1/annex_c_claims?on_conflict=claim_series_no`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(chunk)
        }).catch(() => {});
    }

    showBadge(`✅ Transmittal Synced: ${annexC.length} claims → Annex C on Vercel!`);

    // Auto-walk next pagination page if totalEntries > showingEnd
    setTimeout(harvestAllPagesSequentially, 1000);
}

function harvestAllPagesSequentially() {
    try {
        const summaryEl = document.querySelector('.dataTables_info, #transmittal_table_info, div[id*="info"]');
        if (!summaryEl) return;
        const text = summaryEl.innerText;
        const match = text.match(/Showing\s+\d+\s+to\s+(\d+)\s+of\s+(\d+)\s+entries/i);
        if (!match) return;

        const showingEnd = parseInt(match[1]);
        const totalEntries = parseInt(match[2]);

        if (totalEntries > showingEnd) {
            const nextBtn = document.querySelector('.paginate_button.next:not(.disabled), a.page-link[rel="next"], li.next:not(.disabled) a, .pagination .next:not(.disabled)');
            if (nextBtn) {
                console.log(`[iHOMIS Harvester] Currently showing ${showingEnd} of ${totalEntries} entries. Auto-harvesting next page...`);
                showBadge(`⏳ Auto-harvesting next page (${showingEnd}/${totalEntries} claims)...`);
                nextBtn.click();
                setTimeout(extractTransmittalList, 1000);
            }
        }
    } catch(e) {}
}

// ─── FLOATING BADGE ───────────────────────────────────────────────────────────
function showBadge(msg) {
    let b = document.getElementById('ihomis_sync_badge');
    if (!b) {
        b = document.createElement('div');
        b.id = 'ihomis_sync_badge';
        Object.assign(b.style, {
            position: 'fixed', bottom: '20px', right: '20px',
            background: '#00704a', color: '#fff',
            padding: '10px 18px', borderRadius: '30px',
            fontWeight: 'bold', fontSize: '13px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.25)',
            zIndex: '999999', transition: 'opacity 0.3s ease'
        });
        document.body.appendChild(b);
    }
    b.innerText = msg;
    b.style.display = 'block';
    b.style.opacity = '1';
    clearTimeout(b._timer);
    b._timer = setTimeout(() => {
        b.style.opacity = '0';
        setTimeout(() => { b.style.display = 'none'; }, 400);
    }, 4000);
}

// ─── CHECK CLAIM STATUS EVENT HOOK ───────────────────────────────────────────
function attachStatusCheckListeners() {
    // 1. Intercept user clicking "Check Claim Status", "Check Status", or checking table boxes
    document.addEventListener('click', async (e) => {
        const target = e.target;
        if (!target) return;
        
        const text = (target.innerText || target.value || target.title || '').toUpperCase();
        const isCheckAction = text.includes('CHECK CLAIM STATUS') || 
                              text.includes('CHECK STATUS') || 
                              text.includes('VERIFY STATUS') ||
                              text.includes('CHECK ALL') ||
                              target.id === 'btnCheckStatus' ||
                              (target.type === 'checkbox' && window.location.href.includes('EclaimsTransmittal'));

        if (isCheckAction) {
            console.log('[iHOMIS Sync] Status check / checkbox action detected! Syncing Vercel...');
            showBadge('⏳ Status check active: Syncing Vercel & auto-digging ICD/Amounts...');
            
            setTimeout(async () => {
                await extractTransmittalList();
            }, 1000);

            setTimeout(async () => {
                await extractTransmittalList();
            }, 3000);
        }
    }, true);

    // 2. Observe transmittal table status cell updates
    const transmittalTable = document.querySelector('table');
    if (transmittalTable) {
        const tableObserver = new MutationObserver(() => {
            clearTimeout(window._statusCheckTimer);
            window._statusCheckTimer = setTimeout(() => {
                console.log('[iHOMIS Sync] Transmittal table status updated — syncing to Vercel...');
                extractTransmittalList();
            }, 800);
        });
        tableObserver.observe(transmittalTable, { childList: true, subtree: true, characterData: true });
    }
}

// ─── ENTRY POINTS ─────────────────────────────────────────────────────────────

let _soaLastText = '';
let _soaRunning = false;

async function trySyncSOA() {
    if (_soaRunning) return;
    const textUp = document.body.innerText.toUpperCase();
    // Only re-run if page content has changed significantly
    const snippet = textUp.slice(0, 500);
    if (snippet === _soaLastText) return;
    _soaLastText = snippet;

    const hasSOAContent = textUp.includes('STATEMENT OF ACCOUNT') ||
                          textUp.includes('FINAL BILL') ||
                          textUp.includes('FINAL DIAGNOSIS') ||
                          textUp.includes('SUMMARY OF CHARGES');
    if (!hasSOAContent) return;

    _soaRunning = true;
    console.log('[iHOMIS Sync] SOA content detected via observer — syncing...');
    await extractSOA();
    await extractTransmittalList();
    _soaRunning = false;
}

// 1. MutationObserver — fires every time iHOMIS+ renders new content (AJAX, modal, report)
const _observer = new MutationObserver(() => {
    setTimeout(trySyncSOA, 600);
});
_observer.observe(document.body, { childList: true, subtree: true, characterData: false });

// 2. Click events — user clicks a button (e.g. "Print Final Bill" or "Check Claim Status")
document.addEventListener('click', () => {
    setTimeout(trySyncSOA, 1000);
    setTimeout(extractTransmittalList, 1500);
}, true);

// 3. Scroll events — billing officer scrolls
document.addEventListener('scroll', () => {
    setTimeout(trySyncSOA, 500);
}, { passive: true, capture: true });

// 4. Initial run on page load
setTimeout(attachStatusCheckListeners, 1000);
setTimeout(trySyncSOA, 2000);
setTimeout(trySyncSOA, 4000);
setTimeout(trySyncSOA, 7000);

