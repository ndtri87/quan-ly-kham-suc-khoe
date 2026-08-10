// Chọn tất cả checkbox
function toggleSelectAll(source) {
    let checkboxes = document.querySelectorAll('.row-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
}

// In 1 tem đơn lẻ
function printSingleSTT(sttStr, name, dob, gender) {
    const container = document.getElementById('print-area');
    container.innerHTML = `
        <div class="number-container">
            <span class="number-text">${sttStr}</span>
            <span class="name-text">${name}</span>
            <span class="info-text">NS: ${dob} | GT: ${gender}</span>
        </div>
    `;
    window.print();
}

// In hàng loạt các dòng đã tích chọn checkbox
function printSelected() {
    const selectedCheckboxes = document.querySelectorAll('.row-checkbox:checked');
    if (selectedCheckboxes.length === 0) {
        alert("Vui lòng tích chọn ít nhất một dòng để in!");
        return;
    }

    const container = document.getElementById('print-area');
    let htmlContent = '';

    selectedCheckboxes.forEach(cb => {
        let stt = cb.getAttribute('data-stt');
        let name = cb.getAttribute('data-name');
        let dob = cb.getAttribute('data-dob');
        let gender = cb.getAttribute('data-gender');

        htmlContent += `
            <div class="number-container">
                <span class="number-text">${stt}</span>
                <span class="name-text">${name}</span>
                <span class="info-text">NS: ${dob} | GT: ${gender}</span>
            </div>
        `;
    });

    container.innerHTML = htmlContent;
    window.print();
}

// Tạo tên file an toàn từ tên đợt khám (bỏ ký tự không hợp lệ trong tên file)
function sanitizeFileName(str) {
    return (str || 'DotKham')
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // bỏ dấu tiếng Việt
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

// Xuất toàn bộ lưới ra Excel, giữ nguyên dữ liệu dạng văn bản đúng như hiển thị trên lưới
// (không để Excel tự suy luận số/ngày làm mất số 0 đầu của STT, CCCD hay đổi định dạng Ngày Sinh)
function exportExcel() {
    var table = document.getElementById("dataTable");
    if (table.rows.length <= 1) {
        alert("Chưa có dữ liệu để xuất Excel!");
        return;
    }

    let cloneTable = table.cloneNode(true);

    // Cột Tên chỉ được IN HOA qua CSS (không đổi dữ liệu gốc), nên phải in hoa lại
    // thủ công ở đây để file Excel xuất ra khớp với những gì hiển thị trên lưới
    cloneTable.querySelectorAll('td[data-field="name"]').forEach((td) => {
        td.textContent = td.textContent.toLocaleUpperCase('vi-VN');
    });

    for (let row of cloneTable.rows) {
        row.deleteCell(9); // Xóa cột Thao tác
        row.deleteCell(8); // Xóa cột Người tạo
        row.deleteCell(0); // Xóa cột Chọn
    }

    // raw: true để SheetJS không tự đoán kiểu số/ngày từ nội dung ô, giữ đúng chuỗi hiển thị
    var wb = XLSX.utils.table_to_book(cloneTable, { sheet: "DanhSachCCCD", raw: true });
    var wsName = wb.SheetNames[0];
    var ws = wb.Sheets[wsName];

    // Ép toàn bộ ô dữ liệu (trừ dòng tiêu đề) về kiểu văn bản, phòng trường hợp Excel
    // vẫn tự định dạng lại số/ngày khi mở file
    for (let cellKey in ws) {
        if (cellKey[0] === '!') continue;
        const rowNum = parseInt(cellKey.match(/\d+/)[0], 10);
        if (rowNum === 1 || !ws[cellKey]) continue;
        ws[cellKey].v = String(ws[cellKey].v);
        ws[cellKey].t = 's';
        ws[cellKey].z = '@';
    }

    // Độ rộng cột theo đúng thứ tự: STT, CCCD, Họ và Tên, Ngày Sinh, Giới Tính, Địa Chỉ, Ngày Tạo
    ws['!cols'] = [
        { wch: 6 },
        { wch: 16 },
        { wch: 26 },
        { wch: 12 },
        { wch: 9 },
        { wch: 34 },
        { wch: 20 }
    ];

    const batchName = (window.__appState && window.__appState.activeBatchName) || 'DotKham';
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `DS_CCCD_${sanitizeFileName(batchName)}_${dateStr}.xlsx`);
}
