/**
 * เทมเพลตโค้ด Google Apps Script (Code.gs)
 * สำหรับนำไปวางในโปรเจกต์ Google Apps Script ของ รพ.เขาชัยสน
 * Sheet ID: 17Ja3Q7hKMt01AxGDhYbCkpE9RMHHCjIbf_aVEvqFROc
 * Folder ID: 1O8MiCSQ43f2aoI7HvcPPY4EM97szYqlb
 */

export function generateGoogleAppsScriptCode(sheetId: string, folderId: string): string {
  return `/**
 * ========================================================
 * ระบบคลังยานอก โรงพยาบาลเขาชัยสน (Google Apps Script Backend)
 * เชื่อมต่อ Google Sheet & Google Drive & LINE Messaging API
 * แสดงสถานะยา: หมดอายุแล้ว / ใกล้หมดอายุ (≤ 70 วัน) / ถึงเกณฑ์ Min
 * ========================================================
 */

// 1. ตั้งค่าคงที่ (Configuration)
const SPREADSHEET_ID = "${sheetId}";
const DRIVE_FOLDER_ID = "${folderId}";
const SHEET_NAME_INVENTORY = "คลังยา";
const SHEET_NAME_DISPENSE = "ประวัติตัดยอด";
const SHEET_NAME_CONFIG = "การตั้งค่า";

// LINE Messaging API Settings
const LINE_CHANNEL_ACCESS_TOKEN = "YOUR_LINE_CHANNEL_ACCESS_TOKEN";
const LINE_DESTINATION_ID = "YOUR_LINE_USER_OR_GROUP_ID";

// หัวตารางคลังยาแบบแสดงสถานะครบถ้วน
const INVENTORY_HEADERS = [
  "รหัสยา (ID)", 
  "ชื่อยา (Drug Name)", 
  "Shelf (ชั้นวาง)", 
  "Lot No.", 
  "บริษัท (Company)",
  "แหล่งที่มา (Source)", 
  "คลังย่อย (Sub-warehouse)", 
  "วันหมดอายุ (Expiry)", 
  "สถานะยา (Drug Status)", 
  "คงเหลือ (Qty)", 
  "หน่วยนับ (Unit)", 
  "Min (ขั้นต่ำ)", 
  "Max (สูงสุด)", 
  "สถานะสต็อก (Stock Status)", 
  "สรุปการแจ้งเตือน (Alert Summary)", 
  "วันที่รับเข้า (Received)", 
  "สถานะ (ปลอดภัย/ใกล้หมดอายุ/หมดอายุ/สต็อกถึงเกณฑ์ min)", 
  "อัปเดตล่าสุด (Last Updated)"
];

/**
 * รองรับการดึงข้อมูลผ่าน GET Request
 */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "getItems";
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    if (action === "getItems") {
      const sheet = getOrCreateSheet(ss, SHEET_NAME_INVENTORY);
      const data = sheet.getDataRange().getValues();
      
      if (data.length <= 1) {
        return createJsonResponse({ status: "success", items: [] });
      }
      
      const items = [];
      const isNewLayout = data[0].length >= 18;
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row[0]) continue;
        
        let qty = 0;
        let unit = "เม็ด";
        let minVal = 0;
        let maxVal = 0;
        let receivedVal = "";
        let notesVal = "";
        let updatedVal = "";
        
        if (isNewLayout) {
          qty = Number(row[9] || 0);
          unit = String(row[10] || "เม็ด");
          minVal = Number(row[11] || 0);
          maxVal = Number(row[12] || 0);
          receivedVal = formatDateValue(row[15]);
          notesVal = String(row[16] || "");
          updatedVal = String(row[17] || "");
        } else {
          // รองรับเลย์เอาต์เดิม
          qty = Number(row[8] || 0);
          unit = String(row[9] || "เม็ด");
          minVal = Number(row[10] || 0);
          maxVal = Number(row[11] || 0);
          receivedVal = formatDateValue(row[12]);
          notesVal = String(row[13] || "");
          updatedVal = String(row[14] || "");
        }
        
        items.push({
          id: String(row[0]),
          name: String(row[1] || ""),
          shelf: String(row[2] || ""),
          lot: String(row[3] || ""),
          company: String(row[4] || ""),
          source: String(row[5] || "GPO"),
          subWarehouse: String(row[6] || "OPD"),
          expiryDate: formatDateValue(row[7]),
          quantity: qty,
          unit: unit,
          min: minVal,
          max: maxVal,
          receivedDate: receivedVal,
          notes: notesVal,
          updatedAt: updatedVal || new Date().toISOString()
        });
      }
      
      return createJsonResponse({ status: "success", items: items });
    }
    
    // อัปเดตสถานะทุกแถวใน Sheet ให้เป็นปัจจุบันตามวันเวลาวันนี้
    if (action === "refreshStatuses") {
      const result = refreshAllStatusesInSheet();
      return createJsonResponse({ status: "success", message: "อัปเดตสถานะยาใน Sheet เรียบร้อย", count: result });
    }
    
    if (action === "test") {
      return createJsonResponse({
        status: "success",
        message: "ระบบเชื่อมต่อ Google Apps Script โรงพยาบาลเขาชัยสน สมบูรณ์",
        sheetId: SPREADSHEET_ID,
        folderId: DRIVE_FOLDER_ID,
        serverTime: new Date().toISOString()
      });
    }
    
    return createJsonResponse({ status: "error", message: "Unknown action" });
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

/**
 * รองรับการบันทึก / ตัดยอด / ซิงค์ / นำเข้าไฟล์ ผ่าน POST Request
 */
function doPost(e) {
  try {
    let payload = {};
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }
    
    const action = payload.action;
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // บันทึกรายการใหม่ หรือแก้ไขรายการ พร้อมคำนวณและเขียนสถานะลง Sheet ทันที
    if (action === "saveItem") {
      const item = payload.item;
      const sheet = getOrCreateSheet(ss, SHEET_NAME_INVENTORY);
      const data = sheet.getDataRange().getValues();
      let rowIndex = -1;
      
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(item.id)) {
          rowIndex = i + 1;
          break;
        }
      }
      
      const statusInfo = computeDrugStatuses(item.expiryDate, Number(item.quantity || 0), Number(item.min || 0), Number(item.max || 0));
      
      const rowData = [
        item.id,
        item.name,
        item.shelf,
        item.lot,
        item.company,
        item.source,
        item.subWarehouse,
        item.expiryDate,
        statusInfo.expiryStatusText,
        Number(item.quantity || 0),
        item.unit,
        Number(item.min || 0),
        Number(item.max || 0),
        statusInfo.stockStatusText,
        statusInfo.alertSummaryText,
        item.receivedDate,
        item.notes || "",
        new Date().toISOString()
      ];
      
      if (rowIndex > 0) {
        sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
      }
      
      formatSheetRows(sheet);
      return createJsonResponse({ status: "success", message: "บันทึกข้อมูลและสถานะยาสำเร็จ" });
    }
    
    // บันทึกทั้งหมด (Sync All Items จากเว็บ) พร้อมสถานะยาลง Sheet
    if (action === "syncAll") {
      const items = payload.items || [];
      const sheet = getOrCreateSheet(ss, SHEET_NAME_INVENTORY);
      sheet.clearContents();
      
      // ใส่หัวตารางใหม่ 18 คอลัมน์
      sheet.appendRow(INVENTORY_HEADERS);
      
      if (items.length > 0) {
        const rows = items.map(function(item) {
          const statusInfo = computeDrugStatuses(
            item.expiryDate, 
            Number(item.quantity || 0), 
            Number(item.min || 0), 
            Number(item.max || 0)
          );
          
          return [
            item.id, 
            item.name, 
            item.shelf, 
            item.lot, 
            item.company,
            item.source, 
            item.subWarehouse, 
            item.expiryDate, 
            statusInfo.expiryStatusText,
            Number(item.quantity || 0),
            item.unit, 
            Number(item.min || 0), 
            Number(item.max || 0),
            statusInfo.stockStatusText,
            statusInfo.alertSummaryText,
            item.receivedDate, 
            item.notes || "", 
            new Date().toISOString()
          ];
        });
        
        sheet.getRange(2, 1, rows.length, INVENTORY_HEADERS.length).setValues(rows);
      }
      
      formatSheetRows(sheet);
      return createJsonResponse({ status: "success", count: items.length });
    }
    
    // ลบรายการ
    if (action === "deleteItem") {
      const id = payload.id;
      const sheet = getOrCreateSheet(ss, SHEET_NAME_INVENTORY);
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(id)) {
          sheet.deleteRow(i + 1);
          return createJsonResponse({ status: "success", message: "ลบรายการสำเร็จ" });
        }
      }
      return createJsonResponse({ status: "not_found", message: "ไม่พบรหัสยา" });
    }
    
    // บันทึกการตัดยอด (Dispense) พร้อมอัปเดตสถานะคงเหลือและสถานะ Min ใน Sheet
    if (action === "dispense") {
      const record = payload.record;
      const invSheet = getOrCreateSheet(ss, SHEET_NAME_INVENTORY);
      const dispSheet = getOrCreateSheet(ss, SHEET_NAME_DISPENSE, [
        "รหัสตัดยอด", "รหัสยา", "ชื่อยา", "Lot", "จำนวนตัดยอด", "หน่วย", "คลังต้นทาง", "แผนกปลายทาง", "ผู้ตัดยอด", "เหตุผล", "ยอดคงเหลือหลังตัด", "วันเวลา"
      ]);
      
      const data = invSheet.getDataRange().getValues();
      const isNewLayout = data[0].length >= 18;
      let updatedRemaining = 0;
      
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(record.drugId)) {
          const qtyCol = isNewLayout ? 10 : 9; // 1-based index (10 = col J)
          const currentQty = Number(data[i][qtyCol - 1] || 0);
          updatedRemaining = Math.max(0, currentQty - Number(record.amount));
          
          invSheet.getRange(i + 1, qtyCol).setValue(updatedRemaining);
          
          // หากเป็นเลย์เอาต์ใหม่ ให้อัปเดตสถานะสต็อกและแจ้งเตือนด้วย
          if (isNewLayout) {
            const expDate = data[i][7];
            const minVal = Number(data[i][11] || 0);
            const maxVal = Number(data[i][12] || 0);
            const newStatus = computeDrugStatuses(expDate, updatedRemaining, minVal, maxVal);
            
            invSheet.getRange(i + 1, 14).setValue(newStatus.stockStatusText);
            invSheet.getRange(i + 1, 15).setValue(newStatus.alertSummaryText);
            invSheet.getRange(i + 1, 18).setValue(new Date().toISOString());
          } else {
            invSheet.getRange(i + 1, 15).setValue(new Date().toISOString());
          }
          break;
        }
      }
      
      // บันทึกประวัติตัดยอด
      dispSheet.appendRow([
        record.id || Utilities.getUuid(),
        record.drugId,
        record.drugName,
        record.lot,
        record.amount,
        record.unit,
        record.fromWarehouse,
        record.toDepartment,
        record.requestedBy,
        record.reason,
        updatedRemaining,
        new Date().toISOString()
      ]);
      
      return createJsonResponse({ status: "success", remaining: updatedRemaining });
    }
    
    // อัปโหลดไฟล์ PDF หรือ Excel เข้า Google Drive Folder
    if (action === "uploadFile") {
      const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      const fileName = payload.fileName || ("Drug_Document_" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd_HHmmss") + ".pdf");
      const base64Data = payload.base64Data;
      const contentType = payload.mimeType || "application/pdf";
      
      const decodedBytes = Utilities.base64Decode(base64Data);
      const blob = Utilities.newBlob(decodedBytes, contentType, fileName);
      const file = folder.createFile(blob);
      
      return createJsonResponse({
        status: "success",
        fileId: file.getId(),
        fileUrl: file.getUrl(),
        fileName: file.getName()
      });
    }

    // ยิงแจ้งเตือน LINE ทันที
    if (action === "sendLineAlert") {
      const lineToken = payload.token || LINE_CHANNEL_ACCESS_TOKEN;
      const targetId = payload.to || LINE_DESTINATION_ID;
      const messageText = payload.messageText;
      
      const lineRes = pushLineMessage(lineToken, targetId, messageText);
      return createJsonResponse(lineRes);
    }
    
    return createJsonResponse({ status: "error", message: "Invalid action" });
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

/**
 * ฟังก์ชันคำนวณสถานะวันหมดอายุและสต็อก Min/Max
 */
function computeDrugStatuses(expiryDateStr, qty, min, max) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let daysLeft = 9999;
  let expiryStatusText = "✅ ปลอดภัย";
  let isExpired = false;
  let isNearExpiry = false;
  
  if (expiryDateStr) {
    const expDate = new Date(expiryDateStr);
    expDate.setHours(0, 0, 0, 0);
    daysLeft = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) {
      isExpired = true;
      expiryStatusText = "🚨 หมดอายุแล้ว (เลยมา " + Math.abs(daysLeft) + " วัน)";
    } else if (daysLeft === 0) {
      isExpired = true;
      expiryStatusText = "🚨 หมดอายุวันนี้";
    } else if (daysLeft <= 70) {
      isNearExpiry = true;
      expiryStatusText = "⏳ ใกล้หมดอายุ (เหลือ " + daysLeft + " วัน)";
    } else {
      expiryStatusText = "✅ ปลอดภัย (เหลือ " + daysLeft + " วัน)";
    }
  }
  
  // สถานะสต็อก Min/Max
  let stockStatusText = "✅ ปกติ";
  let isLowStock = false;
  
  if (qty <= 0) {
    isLowStock = true;
    stockStatusText = "🔴 สต็อกหมด (0)";
  } else if (min > 0 && qty <= min) {
    isLowStock = true;
    stockStatusText = "⚠️ ถึงเกณฑ์ Min หรือต่ำกว่า (เหลือ " + qty + "/" + min + ")";
  } else if (max > 0 && qty > max) {
    stockStatusText = "📦 สต็อกเกิน Max (" + qty + "/" + max + ")";
  } else {
    stockStatusText = "✅ สต็อกปกติ (" + qty + ")";
  }
  
  // สรุปสถานะภาพรวม
  let alertSummaryText = "🟢 ปกติ";
  if (isExpired) {
    alertSummaryText = "🔴 หมดอายุแล้ว (ต้องทำลาย/ส่งคืน)";
  } else if (isNearExpiry && isLowStock) {
    alertSummaryText = "⚡ วิกฤต: ใกล้หมดอายุ & ต่ำกว่า Min";
  } else if (isNearExpiry) {
    alertSummaryText = "🟡 ใกล้หมดอายุ (≤ 70 วัน)";
  } else if (isLowStock) {
    alertSummaryText = "🟠 ถึงเกณฑ์ Min (ต้องสั่งเพิ่ม)";
  }
  
  return {
    daysLeft: daysLeft,
    expiryStatusText: expiryStatusText,
    stockStatusText: stockStatusText,
    alertSummaryText: alertSummaryText,
    isExpired: isExpired,
    isNearExpiry: isNearExpiry,
    isLowStock: isLowStock
  };
}

/**
 * อัปเดตสถานะของยาทุกแถวใน Google Sheet ทันที
 */
function refreshAllStatusesInSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME_INVENTORY);
  if (!sheet) return 0;
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return 0;
  
  const isNewLayout = data[0].length >= 18;
  if (!isNewLayout) {
    // ถ้ายังเป็นตารางเดิม ให้ทำการ sync ใหม่เป็น 18 คอลัมน์
    return 0;
  }
  
  for (let i = 1; i < data.length; i++) {
    const expDate = data[i][7];
    const qty = Number(data[i][9] || 0);
    const minVal = Number(data[i][11] || 0);
    const maxVal = Number(data[i][12] || 0);
    
    const st = computeDrugStatuses(expDate, qty, minVal, maxVal);
    sheet.getRange(i + 1, 9).setValue(st.expiryStatusText);
    sheet.getRange(i + 1, 14).setValue(st.stockStatusText);
    sheet.getRange(i + 1, 15).setValue(st.alertSummaryText);
    sheet.getRange(i + 1, 18).setValue(new Date().toISOString());
  }
  
  formatSheetRows(sheet);
  return data.length - 1;
}

/**
 * ตกแต่งหัวตารางและตรึงแถวบนสุดใน Google Sheet
 */
function formatSheetRows(sheet) {
  try {
    sheet.setFrozenRows(1);
    const headerRange = sheet.getRange(1, 1, 1, INVENTORY_HEADERS.length);
    headerRange.setBackground("#064e3b"); // Dark Green
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    headerRange.setFontSize(10);
    headerRange.setHorizontalAlignment("center");
  } catch (e) {
    // skip formatting if permission restricted
  }
}

/**
 * ส่งข้อความผ่าน LINE Messaging API Push Message
 */
function pushLineMessage(token, to, text) {
  if (!token || token.indexOf("YOUR_") === 0) {
    return { status: "error", message: "ยังไม่ได้ระบุ LINE Channel Access Token" };
  }
  if (!to || to.indexOf("YOUR_") === 0) {
    return { status: "error", message: "ยังไม่ได้ระบุ LINE User ID / Group ID" };
  }
  
  const url = "https://api.line.me/v2/bot/message/push";
  const payload = {
    to: to,
    messages: [{ type: "text", text: text }]
  };
  
  const options = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();
  
  if (responseCode === 200) {
    return { status: "success", message: "ส่งข้อความ LINE สำเร็จ" };
  } else {
    return { status: "error", code: responseCode, details: responseBody };
  }
}

/**
 * ตรวจสอบยาใกล้หมดอายุ 70 วัน, ยาหมดอายุ และสต็อกต่ำกว่า Min
 * รันอัตโนมัติทุกวันผ่าน Time-driven Trigger (เช่น 08:00 น.)
 * พร้อมอัปเดตสถานะใน Sheet อัตโนมัติทุกวัน
 */
function dailyAutoCheckAndNotifyLine() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME_INVENTORY);
  if (!sheet) return;
  
  // อัปเดตสถานะทุกแถวใน Sheet อัตโนมัติทุกเช้า
  refreshAllStatusesInSheet();
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const isNewLayout = data[0].length >= 18;
  const expiredItems = [];
  const nearExpiryItems = [];
  const lowStockItems = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const name = row[1];
    const shelf = row[2];
    const lot = row[3];
    const subWarehouse = row[6];
    const expiryStr = row[7];
    const qty = Number((isNewLayout ? row[9] : row[8]) || 0);
    const unit = String((isNewLayout ? row[10] : row[9]) || "เม็ด");
    const minVal = Number((isNewLayout ? row[11] : row[10]) || 0);
    
    if (!name) continue;
    
    // ตรวจสอบวันหมดอายุ
    if (expiryStr) {
      const expDate = new Date(expiryStr);
      expDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        expiredItems.push("🔴 " + name + " (Lot: " + lot + ", คลัง: " + subWarehouse + ") [หมดอายุแล้ว " + Math.abs(diffDays) + " วัน]");
      } else if (diffDays <= 70) {
        nearExpiryItems.push("🟡 " + name + " (Lot: " + lot + ", Shelf: " + shelf + ", คลัง: " + subWarehouse + ") [เหลืออีก " + diffDays + " วัน]");
      }
    }
    
    // ตรวจสอบ Min
    if (minVal > 0 && qty <= minVal) {
      lowStockItems.push("⚠️ " + name + " (คลัง " + subWarehouse + ") เหลือ " + qty + " " + unit + " (Min: " + minVal + ")");
    }
  }
  
  if (expiredItems.length === 0 && nearExpiryItems.length === 0 && lowStockItems.length === 0) {
    Logger.log("คลังยาปกติ ไม่มีรายการที่ต้องแจ้งเตือน");
    return;
  }
  
  const thaiDateStr = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy HH:mm");
  let message = "🏥 [แจ้งเตือนคลังยานอก รพ.เขาชัยสน]\\n📅 ประจำวันที่: " + thaiDateStr + "\\n";
  
  if (expiredItems.length > 0) {
    message += "\\n🚨 รายการยาหมดอายุแล้ว (" + expiredItems.length + " รายการ):\\n" + expiredItems.slice(0, 5).join("\\n");
    if (expiredItems.length > 5) message += "\\n...และอีก " + (expiredItems.length - 5) + " รายการ";
  }
  
  if (nearExpiryItems.length > 0) {
    message += "\\n\\n⏳ รายการยาใกล้หมดอายุ <= 70 วัน (" + nearExpiryItems.length + " รายการ):\\n" + nearExpiryItems.slice(0, 5).join("\\n");
    if (nearExpiryItems.length > 5) message += "\\n...และอีก " + (nearExpiryItems.length - 5) + " รายการ";
  }
  
  if (lowStockItems.length > 0) {
    message += "\\n\\n📉 ยาถึงเกณฑ์ขั้นต่ำ Min (" + lowStockItems.length + " รายการ):\\n" + lowStockItems.slice(0, 5).join("\\n");
    if (lowStockItems.length > 5) message += "\\n...และอีก " + (lowStockItems.length - 5) + " รายการ";
  }
  
  message += "\\n\\n👉 เข้าตรวจสอบสต็อกได้ที่ระบบคลังยานอก รพ.เขาชัยสน";
  
  pushLineMessage(LINE_CHANNEL_ACCESS_TOKEN, LINE_DESTINATION_ID, message);
}

/**
 * ติดตั้ง Trigger ตรวจสอบและส่ง LINE อัตโนมัติทุกวันเวลา 08:00 - 09:00 น.
 */
function createDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "dailyAutoCheckAndNotifyLine") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  ScriptApp.newTrigger("dailyAutoCheckAndNotifyLine")
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .create();
    
  Logger.log("ติดตั้ง Trigger แจ้งเตือน 08:00 น. เรียบร้อยแล้ว");
}

// Helpers
function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === SHEET_NAME_INVENTORY) {
      sheet.appendRow(INVENTORY_HEADERS);
      formatSheetRows(sheet);
    }
  }
  return sheet;
}

function formatDateValue(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, "GMT+7", "yyyy-MM-dd");
  }
  return String(val).split("T")[0];
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
}
