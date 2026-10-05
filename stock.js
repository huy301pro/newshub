/**
 * STOCK.JS - Khối Dữ liệu & Phân tích tài chính cổ phiếu cho NewsHub
 * Đóng gói 100% trong IIFE, không tạo bất kỳ biến toàn cục nào trên window.
 * Triển khai BƯỚC 5i (BẢN ĐẦY ĐỦ):
 * - Sửa lỗi biểu tượng kính lúp đè lên chữ (padding-left >= 38px, icon căn chuẩn).
 * - Màn hình mặc định gọn gàng: Toolbar, Thẻ thông tin (bỏ nhãn DN sản xuất/dịch vụ),
 *   Hàng 3 menu thả xuống lọc Excel + Dropdown Bộ nhanh (Presets).
 * - 3 Menu bộ lọc Excel: "Chỉ số tuyệt đối", "Chỉ số tương đối", "Định giá"
 *   (không đóng khi tích/bỏ tích checkbox, cập nhật biểu đồ ngay, tìm kiếm nhanh,
 *   chọn/bỏ chọn tất cả, mobile trượt Bottom Sheet <= 60vh, giữ tối thiểu 1 chỉ số).
 * - Quy tắc trục tọa độ: Tối đa 2 trục Y. 5 nhóm đơn vị (ty_dong, phan_tram, pe, pb, no_vcsh).
 *   Disable nhóm thứ 3 khi đã có 2 đơn vị. Trục P/E chặn max 100 (>100 không có ý nghĩa).
 *   Trục % tăng trưởng cắt -200% đến +200%.
 * - Khối "Tùy chọn nâng cao" đóng sẵn:
 *   + Chế độ so sánh tối đa 5 mã, giới hạn 12 đường, 5 màu, bảng hiện tại, nút xóa tất cả.
 *   + Trung vị ngành & dải p25-p75, Viễn thông hiển thị thông báo (< 5 mã), khử trùng lặp.
 *   + Chuẩn hóa = 100 tại điểm đầu kỳ, 1 trục Y duy nhất, cảnh báo gốc bất thường.
 * - Zoom thời gian: Tải lazy Chart.js 4.4.1, Hammer.js 2.0.8, chartjs-plugin-zoom 2.0.1 kèm SRI.
 *   Nút [+], [-], [⟲]; Ctrl + lăn chuột; Pinch cảm ứng; Pan dịch; 2 ô "Từ ... đến ..." đồng bộ 2 chiều.
 * - BỎ HẲN nút "Thang riêng" và toàn bộ code liên quan.
 * - Tuân thủ an toàn: textContent cho dữ liệu, kiểm tra mã ^[A-Z0-9]{3}$, lazy load, ?v=<version>.
 */
(function () {
  'use strict';

  // ==========================================================================
  // 1. CẤU HÌNH HẰNG SỐ & THƯ VIỆN BÊN NGOÀI KÈM SRI
  // ==========================================================================
  const CHARTJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
  const CHARTJS_SRI = 'sha512-CQBWl4fJHWbryGE+Pc7UAxWMUMNMWzWxF4SQo9CgkJIN1kx6djDQZjh3Y8SZ1d+6I+1zze6Z7kHXO7q3UyZAWw==';

  const HAMMERJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js';
  const HAMMERJS_SRI = 'sha512-UXumZrZNiOwnTcZSHLOfcTs0aos2MzBWHXOHOuB0J/R44QB0dwY5JgfbvljXcklVf65Gc4El6RjZ+lnwd2az2g==';

  const ZOOM_PLUGIN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-zoom/2.0.1/chartjs-plugin-zoom.min.js';
  const ZOOM_PLUGIN_SRI = 'sha512-wUYbRPLV5zs6IqvWd88HIqZU/b8TBx+I8LEioQ/UC0t5EMCLApqhIAnUg7EsAzdbhhdgW07TqYDdH3QEXRcPOQ==';

  const DATA_BASE = 'data/stocks/';
  const DEFAULT_STOCK = 'HPG';

  // Bảng 5 màu phân biệt rõ ràng cho tối đa 5 mã (1 chính + 4 so sánh)
  const STOCK_COLORS = [
    '#0284c7', // Mã 1 (Chính): Xanh lam đậm
    '#ea580c', // Mã 2: Cam sáng
    '#9333ea', // Mã 3: Tím
    '#16a34a', // Mã 4: Xanh lá
    '#e11d48'  // Mã 5: Đỏ hồng
  ];

  // Màu nhận diện cho đường Trung vị ngành
  const INDUSTRY_COLOR = '#64748b'; // Xám xanh Slate
  const INDUSTRY_FILL_COLOR = 'rgba(100, 116, 139, 0.12)'; // Vùng p25-p75 mờ

  // Từ điển ánh xạ lý do null tiếng Việt
  const NULL_REASONS = {
    'thieu_quy': 'Chưa đủ 4 quý liên tiếp',
    'lnst_am': 'Lợi nhuận 4 quý âm (TTM lỗ)',
    'lo_ttm': 'Lợi nhuận 4 quý âm (TTM lỗ)',
    'bctc_qua_cu': 'BCTC quá cũ',
    'thieu_so_cp': 'Thiếu số cổ phiếu',
    'so_cp_nghi_loi': 'Số cổ phiếu nghi sai',
    'khong_co_gia': 'Không có dữ liệu giá',
    'thieu_gia': 'Không có dữ liệu giá',
    'doi_mo_hinh': 'Đổi mô hình BCTC',
    'vcsh_me_am': 'Vốn chủ sở hữu mẹ âm',
    'vcsh_am': 'Vốn chủ sở hữu mẹ âm',
    'it_ma': 'Chưa đủ mã để tính trung vị (< 5 mã)',
    'mốc gốc không nhất quán': 'Mốc gốc không nhất quán (|r0 - 1| > 10%)',
    'moc_goc_khong_nhat_quan': 'Mốc gốc không nhất quán (|r0 - 1| > 10%)',
    'tăng vốn chưa lưu hành': 'Tăng vốn chưa lưu hành',
    'tang_von_chua_luu_hanh': 'Tăng vốn chưa lưu hành',
    'tăng vốn không rõ nguồn': 'Tăng vốn không rõ nguồn',
    'tang_von_khong_ro_nguon': 'Tăng vốn không rõ nguồn',
    'chua_cong_bo': 'Chưa công bố BCTC'
  };

  function hexToRgba(hex, alpha) {
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return hex;
    const c = hex.slice(1);
    if (c.length === 6) {
      const r = parseInt(c.slice(0, 2), 16);
      const g = parseInt(c.slice(2, 4), 16);
      const b = parseInt(c.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return hex;
  }

  // Từ điển cờ cảnh báo
  const FLAG_DESCRIPTIONS = {
    'so_cp_doi_khong_su_kien': 'Số CP đổi 10%–3 lần không có sự kiện',
    'co_phat_hanh_them': 'Có phát hành thêm cổ phiếu trong kỳ',
    'nci_nghi_thieu': 'Nghi thiếu lợi ích CĐ không kiểm soát (NCI)',
    'cong_bo_tre': 'BCTC công bố trễ (>150 ngày)',
    'nim_ngoai_vung': 'NIM nằm ngoài vùng thông thường (1%–7%)'
  };

  // ==========================================================================
  // 2. DANH MỤC ĐẦY ĐỦ CÁC CHỈ SỐ THEO 3 MENU & 5 NHÓM ĐƠN VỊ
  // menuGroup: 'tuyet_doi' | 'tuong_doi' | 'dinh_gia'
  // unitGroup: 'ty_dong' | 'phan_tram' | 'pe' | 'pb' | 'no_vcsh'
  // ==========================================================================
  const ALL_INDICATOR_DEFS = {
    // --- 1. CHỈ SỐ TUYỆT ĐỐI (Tỷ đồng) ---
    'lnst_me': {
      k: 'lnst_me', label: 'LNST của mẹ', fullLabel: 'Lợi nhuận sau thuế của mẹ',
      menuGroup: 'tuyet_doi', unitGroup: 'ty_dong', unitText: 'Tỷ đồng',
      dash: [], marker: 'rect', defaultOn: true
    },
    'doanh_thu_thuan': {
      k: 'doanh_thu_thuan', label: 'Doanh thu thuần', fullLabel: 'Doanh thu thuần',
      menuGroup: 'tuyet_doi', unitGroup: 'ty_dong', unitText: 'Tỷ đồng',
      dash: [5, 4], marker: 'rectRot', defaultOn: false, dnOnly: true
    },
    'loi_nhuan_gop': {
      k: 'loi_nhuan_gop', label: 'Lợi nhuận gộp', fullLabel: 'Lợi nhuận gộp',
      menuGroup: 'tuyet_doi', unitGroup: 'ty_dong', unitText: 'Tỷ đồng',
      dash: [3, 3], marker: 'cross', defaultOn: false, dnOnly: true
    },
    'vcsh': {
      k: 'vcsh', label: 'Vốn chủ sở hữu', fullLabel: 'Vốn chủ sở hữu',
      menuGroup: 'tuyet_doi', unitGroup: 'ty_dong', unitText: 'Tỷ đồng',
      dash: [], marker: 'star', defaultOn: false, dnNhOnly: true
    },
    'vcsh_me': {
      k: 'vcsh_me', label: 'VCSH của mẹ', fullLabel: 'Vốn chủ sở hữu của mẹ',
      menuGroup: 'tuyet_doi', unitGroup: 'ty_dong', unitText: 'Tỷ đồng',
      dash: [], marker: 'star', defaultOn: false, ckBkOnly: true, alt: 'vcsh'
    },
    'tong_tai_san': {
      k: 'tong_tai_san', label: 'Tổng tài sản', fullLabel: 'Tổng tài sản',
      menuGroup: 'tuyet_doi', unitGroup: 'ty_dong', unitText: 'Tỷ đồng',
      dash: [6, 4], marker: 'crossRot', defaultOn: false
    },
    'no_phai_tra': {
      k: 'no_phai_tra', label: 'Nợ phải trả', fullLabel: 'Nợ phải trả',
      menuGroup: 'tuyet_doi', unitGroup: 'ty_dong', unitText: 'Tỷ đồng',
      dash: [2, 3], marker: 'triangle', defaultOn: false, nonBankOnly: true
    },
    'dong_tien_kd': {
      k: 'dong_tien_kd', label: 'Dòng tiền HĐKD', fullLabel: 'Dòng tiền thuần từ HĐKD',
      menuGroup: 'tuyet_doi', unitGroup: 'ty_dong', unitText: 'Tỷ đồng',
      dash: [4, 4], marker: 'rect', defaultOn: false, dnOnly: true
    },
    'thu_nhap_lai_thuan': {
      k: 'thu_nhap_lai_thuan', label: 'Thu nhập lãi thuần', fullLabel: 'Thu nhập lãi thuần',
      menuGroup: 'tuyet_doi', unitGroup: 'ty_dong', unitText: 'Tỷ đồng',
      dash: [], marker: 'rect', defaultOn: false, bankOnly: true
    },
    'toi': {
      k: 'toi', label: 'Tổng thu nhập (TOI)', fullLabel: 'Tổng thu nhập hoạt động (TOI)',
      menuGroup: 'tuyet_doi', unitGroup: 'ty_dong', unitText: 'Tỷ đồng',
      dash: [5, 4], marker: 'triangle', defaultOn: false, bankOnly: true
    },
    'cho_vay_kh': {
      k: 'cho_vay_kh', label: 'Cho vay khách hàng', fullLabel: 'Cho vay khách hàng',
      menuGroup: 'tuyet_doi', unitGroup: 'ty_dong', unitText: 'Tỷ đồng',
      dash: [6, 3], marker: 'rectRot', defaultOn: false, bankOnly: true
    },
    'tien_gui_kh': {
      k: 'tien_gui_kh', label: 'Tiền gửi khách hàng', fullLabel: 'Tiền gửi khách hàng',
      menuGroup: 'tuyet_doi', unitGroup: 'ty_dong', unitText: 'Tỷ đồng',
      dash: [4, 4], marker: 'crossRot', defaultOn: false, bankOnly: true
    },
    'tai_san_sinh_lai': {
      k: 'tai_san_sinh_lai', label: 'Tài sản sinh lãi', fullLabel: 'Tài sản sinh lãi',
      menuGroup: 'tuyet_doi', unitGroup: 'ty_dong', unitText: 'Tỷ đồng',
      dash: [3, 2], marker: 'star', defaultOn: false, bankOnly: true
    },

    // --- 2. CHỈ SỐ TƯƠNG ĐỐI (%) ---
    'roe': {
      k: 'roe', label: 'ROE (%)', fullLabel: 'Tỷ suất sinh lời trên VCSH (ROE)',
      menuGroup: 'tuong_doi', unitGroup: 'phan_tram', unitText: '%',
      dash: [], marker: 'circle', defaultOn: false, hasIndustry: true
    },
    'roa': {
      k: 'roa', label: 'ROA (%)', fullLabel: 'Tỷ suất sinh lời trên Tổng tài sản (ROA)',
      menuGroup: 'tuong_doi', unitGroup: 'phan_tram', unitText: '%',
      dash: [4, 3], marker: 'triangle', defaultOn: false, hasIndustry: true
    },
    'bien_loi_nhuan_gop': {
      k: 'bien_loi_nhuan_gop', label: 'Biên lợi nhuận gộp (%)', fullLabel: 'Biên lợi nhuận gộp',
      menuGroup: 'tuong_doi', unitGroup: 'phan_tram', unitText: '%',
      dash: [2, 3], marker: 'cross', defaultOn: false, dnOnly: true, hasIndustry: true
    },
    'bien_lnst': {
      k: 'bien_lnst', label: 'Biên LNST (%)', fullLabel: 'Biên lợi nhuận sau thuế',
      menuGroup: 'tuong_doi', unitGroup: 'phan_tram', unitText: '%',
      dash: [5, 4], marker: 'rectRot', defaultOn: false, dnOnly: true, hasIndustry: true
    },
    'tang_truong_doanh_thu_yoy': {
      k: 'tang_truong_doanh_thu_yoy', label: 'Tăng trưởng DT YoY (%)', fullLabel: 'Tăng trưởng doanh thu cùng kỳ (YoY)',
      menuGroup: 'tuong_doi', unitGroup: 'phan_tram', unitText: '%',
      dash: [6, 4], marker: 'star', defaultOn: false, dnOnly: true, isGrowth: true, hasIndustry: true
    },
    'tang_truong_lnst_yoy': {
      k: 'tang_truong_lnst_yoy', label: 'Tăng trưởng LNST YoY (%)', fullLabel: 'Tăng trưởng LNST mẹ cùng kỳ (YoY)',
      menuGroup: 'tuong_doi', unitGroup: 'phan_tram', unitText: '%',
      dash: [3, 2], marker: 'circle', defaultOn: false, isGrowth: true, hasIndustry: true
    },
    'cir': {
      k: 'cir', label: 'Tỷ lệ CIR (%)', fullLabel: 'Tỷ lệ chi phí trên thu nhập (CIR)',
      menuGroup: 'tuong_doi', unitGroup: 'phan_tram', unitText: '%',
      dash: [2, 3], marker: 'rect', defaultOn: false, bankOnly: true, hasIndustry: true
    },
    'ldr': {
      k: 'ldr', label: 'Cho vay / tiền gửi KH (%)', fullLabel: 'Cho vay / Tiền gửi KH',
      menuGroup: 'tuong_doi', unitGroup: 'phan_tram', unitText: '%',
      dash: [], marker: 'rectRot', defaultOn: false, bankOnly: true, hasIndustry: true,
      note: 'không phải LDR theo quy định NHNN'
    },
    'nim_uoc_tinh_12t': {
      k: 'nim_uoc_tinh_12t', alt: 'nim_uoc_tinh_nam', label: 'NIM ước tính (12T) (%)', fullLabel: 'NIM ước tính (12 tháng gần nhất)',
      menuGroup: 'tuong_doi', unitGroup: 'phan_tram', unitText: '%',
      dash: [4, 4], marker: 'triangle', defaultOn: false, bankOnly: true, hasIndustry: true
    },
    'tang_truong_tin_dung_yoy': {
      k: 'tang_truong_tin_dung_yoy', label: 'Tăng trưởng tín dụng YoY (%)', fullLabel: 'Tăng trưởng tín dụng cùng kỳ (YoY)',
      menuGroup: 'tuong_doi', unitGroup: 'phan_tram', unitText: '%',
      dash: [5, 4], marker: 'star', defaultOn: false, bankOnly: true, isGrowth: true, hasIndustry: true
    },
    'tang_truong_thu_nhap_lai_thuan_yoy': {
      k: 'tang_truong_thu_nhap_lai_thuan_yoy', label: 'Tăng trưởng lãi thuần YoY (%)', fullLabel: 'Tăng trưởng thu nhập lãi thuần YoY',
      menuGroup: 'tuong_doi', unitGroup: 'phan_tram', unitText: '%',
      dash: [3, 3], marker: 'cross', defaultOn: false, bankOnly: true, isGrowth: true, hasIndustry: true
    },
    'tang_truong_toi_yoy': {
      k: 'tang_truong_toi_yoy', label: 'Tăng trưởng TOI YoY (%)', fullLabel: 'Tăng trưởng tổng thu nhập hoạt động YoY',
      menuGroup: 'tuong_doi', unitGroup: 'phan_tram', unitText: '%',
      dash: [6, 3], marker: 'rect', defaultOn: false, bankOnly: true, isGrowth: true, hasIndustry: true
    },
    'du_phong_toi': {
      k: 'du_phong_toi', label: 'Dự phòng / TOI (%)', fullLabel: 'Chi phí dự phòng rủi ro trên TOI',
      menuGroup: 'tuong_doi', unitGroup: 'phan_tram', unitText: '%',
      dash: [2, 2], marker: 'crossRot', defaultOn: false, bankOnly: true, hasIndustry: true
    },

    // --- 3. ĐỊNH GIÁ & CƠ CẤU NỢ (P/E, P/B, Nợ/VCSH mẹ) ---
    'pe': {
      k: 'pe', label: 'Hệ số P/E', fullLabel: 'Hệ số P/E (Giá / LNST 4Q)',
      menuGroup: 'dinh_gia', unitGroup: 'pe', unitText: 'Lần',
      dash: [], marker: 'circle', isVal: true, hasIndustry: true, defaultOn: true
    },
    'pb': {
      k: 'pb', label: 'Hệ số P/B', fullLabel: 'Hệ số P/B (Giá / VCSH mẹ)',
      menuGroup: 'dinh_gia', unitGroup: 'pb', unitText: 'Lần',
      dash: [4, 4], marker: 'triangle', isVal: true, hasIndustry: true, defaultOn: false
    },
    'no_vcsh': {
      k: 'no_vcsh', label: 'Nợ phải trả / VCSH mẹ', fullLabel: 'Nợ phải trả / VCSH của mẹ',
      menuGroup: 'tuong_doi', unitGroup: 'no_vcsh', unitText: 'Lần',
      dash: [5, 3], marker: 'cross', defaultOn: false, nonBankOnly: true, hasIndustry: true
    }
  };

  // Xác định danh sách chỉ số được hỗ trợ theo mô hình BCTC
  function getIndicatorsForGroup(group) {
    const isNh = (group === 'nh');
    const isCkOrBh = (group === 'ck' || group === 'bh');
    const isDn = (!isNh && !isCkOrBh);

    return Object.keys(ALL_INDICATOR_DEFS).filter(k => {
      const def = ALL_INDICATOR_DEFS[k];
      if (def.bankOnly && !isNh) return false;
      if (def.nonBankOnly && isNh) return false;
      if (def.dnOnly && !isDn) return false;
      if (def.dnNhOnly && isCkOrBh) return false;
      if (def.ckBkOnly && !isCkOrBh) return false;
      return true;
    });
  }

  // ==========================================================================
  // 3. TRẠNG THÁI NỘI BỘ (STATE)
  // ==========================================================================
  const state = {
    initialized: false,
    chartJsLoaded: false,
    metaData: null,
    stockIndex: [],
    stockMap: {},          // ma -> item in index.json
    currentCode: DEFAULT_STOCK,
    currentStockData: null,

    // Chế độ so sánh
    compareMode: false,
    compareCodes: [],      // Tối đa 4 mã (ngoài mã chính)
    compareStockData: {},  // code -> json data

    // Tùy chọn hiển thị
    periodMode: 'QUY',     // 'QUY' | 'NAM'
    timeRange: '3Y',       // '3Y' | '5Y' | 'ALL'
    normalized100: false,  // Chuẩn hóa = 100 tại đầu kỳ
    showIndustryMedian: false, // Hiển thị đường trung vị ngành

    selectedIndicators: new Set(['lnst_me', 'pe']),
    industryCache: {},     // nhom_so_sanh -> json data
    chartInstance: null,   // Một biểu đồ duy nhất

    // Trạng thái Dropdown menu Excel
    activeDropdown: null,  // null | 'tuyet_doi' | 'tuong_doi' | 'dinh_gia' | 'preset'
    filterKeyword: {
      'tuyet_doi': '',
      'tuong_doi': '',
      'dinh_gia': ''
    }
  };

  // ==========================================================================
  // 4. TIỆN ÍCH ĐỊNH DẠNG SỐ & GIAO DIỆN
  // ==========================================================================
  function formatVnNumber(val, decimals = 1) {
    if (val === null || val === undefined || isNaN(val)) return '—';
    const num = Number(val);
    const parts = num.toFixed(decimals).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return parts.length > 1 && decimals > 0 ? parts.join(',') : parts[0];
  }

  // Xóa dấu tiếng Việt phục vụ tìm kiếm nhanh không dấu
  function removeDiacritics(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase();
  }

  function getThemeColors() {
    const isDark = document.body.classList.contains('dark') ||
                   document.documentElement.classList.contains('dark') ||
                   (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    return {
      isDark,
      textColor: isDark ? '#e2e8f0' : '#334155', // Contrast >= 4.5:1
      mutedColor: isDark ? '#94a3b8' : '#64748b',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(100, 116, 139, 0.14)',
      tooltipBg: isDark ? '#0f172a' : '#1e293b',
      tooltipText: '#f8fafc'
    };
  }

  function isMobileScreen() {
    return window.innerWidth <= 640;
  }

  function getStockColor(code) {
    if (code === state.currentCode) return STOCK_COLORS[0];
    const idx = state.compareCodes.indexOf(code);
    if (idx >= 0 && idx < 4) return STOCK_COLORS[idx + 1];
    return STOCK_COLORS[0];
  }

  function getAllActiveStocks() {
    return [state.currentCode, ...state.compareCodes];
  }

  // ==========================================================================
  // 5. LAZY LOAD CHART.JS, HAMMER.JS, ZOOM PLUGIN KÈM SRI
  // ==========================================================================
  function loadScriptWithSri(url, sri) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${url}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', reject);
        return;
      }
      const script = document.createElement('script');
      script.src = url;
      if (sri) {
        script.integrity = sri;
        script.crossOrigin = 'anonymous';
      }
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = () => reject(new Error(`Không thể tải ${url}`));
      document.head.appendChild(script);
    });
  }

  async function loadChartLibraries() {
    if (state.chartJsLoaded && window.Chart) return;
    try {
      // 1. Tải Chart.js (bắt buộc)
      await loadScriptWithSri(CHARTJS_URL, CHARTJS_SRI);
      state.chartJsLoaded = true;

      // 2. Tải Hammer.js & Zoom Plugin (tùy chọn, lỗi thì chỉ mất zoom, không chết biểu đồ)
      try {
        await loadScriptWithSri(HAMMERJS_URL, HAMMERJS_SRI);
        await loadScriptWithSri(ZOOM_PLUGIN_URL, ZOOM_PLUGIN_SRI);
        state.zoomPluginLoaded = true;
      } catch (zoomErr) {
        console.warn('Không thể nạp plugin phóng to (Zoom/Hammer.js). Biểu đồ chính vẫn hoạt động ở chế độ cơ bản:', zoomErr);
        state.zoomPluginLoaded = false;
        // Ẩn cụm nút zoom nếu không tải được plugin
        const zoomBtns = document.querySelector('.stock-zoom-btn-group');
        if (zoomBtns) zoomBtns.style.display = 'none';
        const zoomHint = document.querySelector('.stock-zoom-hint');
        if (zoomHint) zoomHint.textContent = '(Chế độ xem cơ bản - thư viện zoom không khả dụng)';
      }
    } catch (err) {
      console.error('Lỗi nạp thư viện Chart.js:', err);
      throw new Error('Không thể nạp thư viện biểu đồ Chart.js.');
    }
  }

  async function fetchJson(endpoint) {
    const v = state.metaData ? state.metaData.version : Date.now();
    const url = `${DATA_BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}v=${v}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  async function loadIndustryData(nhomSoSanh) {
    if (!nhomSoSanh) return null;
    if (state.industryCache[nhomSoSanh]) {
      return state.industryCache[nhomSoSanh];
    }
    try {
      const data = await fetchJson(`nganh/${nhomSoSanh}.json`);
      state.industryCache[nhomSoSanh] = data;
      return data;
    } catch (e) {
      console.warn(`Không thể tải dữ liệu ngành ${nhomSoSanh}:`, e);
      return null;
    }
  }

  // ==========================================================================
  // 6. XÂY DỰNG GIAO DIỆN DOM KHỐI #target-stock-CK (BƯỚC 5i GỌN GÀNG)
  // ==========================================================================
  function buildBlockDom() {
    const target = document.getElementById('target-stock-CK');
    if (!target) return null;

    target.innerHTML = `
      <details class="card stock-card" id="stockBlockDetails">
        <summary class="stock-summary">
          <div class="stock-summary-left">
            <span class="stock-badge-icon">📈</span>
            <div class="stock-summary-text">
              <span class="stock-summary-title">Dữ liệu & Phân tích tài chính cổ phiếu</span>
              <span class="stock-summary-sub">Tra cứu BCTC, P/E, P/B, so sánh đa mã & trung vị ngành HOSE & HNX</span>
            </div>
          </div>
          <span class="stock-summary-btn" id="stockToggleBtn">Mở tra cứu ▾</span>
        </summary>

        <div class="stock-body" id="stockBody">
          <!-- HÀNG 1: Thanh điều khiển chính (gọn gàng) -->
          <div class="stock-toolbar">
            <div class="stock-search-wrap">
              <div class="stock-search-box">
                <span class="stock-search-icon">🔍</span>
                <input type="text" class="stock-search-input" id="stockSearchInput" placeholder="Tìm mã CP (VD: HPG...)" maxlength="10" autocomplete="off">
              </div>
              <ul class="stock-suggest-list" id="stockSuggestList" hidden></ul>
            </div>

            <div class="stock-btn-groups">
              <!-- Nút Quý / Năm -->
              <div class="stock-btn-group" role="group" aria-label="Chọn chu kỳ">
                <button type="button" class="stock-btn active" data-period="QUY">Quý</button>
                <button type="button" class="stock-btn" data-period="NAM">Năm</button>
              </div>
              <!-- Nút 3N / 5N / Tất cả -->
              <div class="stock-btn-group" role="group" aria-label="Chọn khoảng thời gian">
                <button type="button" class="stock-btn active" data-range="3Y">3 Năm</button>
                <button type="button" class="stock-btn" data-range="5Y">5 Năm</button>
                <button type="button" class="stock-btn" data-range="ALL">Tất cả</button>
              </div>
              <!-- Nút Đặt lại về mặc định -->
              <button type="button" class="stock-reset-btn" id="stkResetBtn" title="Đặt lại về mặc định (HPG, Quý, 3 Năm, tắt so sánh & chuẩn hóa)">
                <span>⟲</span>
                <span>Đặt lại</span>
              </button>
            </div>
          </div>

          <!-- Thông báo trạng thái / lỗi -->
          <div class="stock-msg-box" id="stockMsgBox" hidden></div>

          <div id="stockContent">
            <!-- THẺ THÔNG TIN TỔNG QUAN & ĐỊNH GIÁ -->
            <div class="stock-overview-card" id="stkOverviewCard">
              <div class="stock-info-header">
                <div class="stock-title-row">
                  <span class="stock-code-badge" id="stkCode">—</span>
                  <span class="stock-company-name" id="stkName">—</span>
                  <span class="stock-tag" id="stkSan">—</span>
                  <span class="stock-tag" id="stkIndustryTag">—</span>
                </div>
                <div class="stock-meta-right">
                  <span id="stkLatestReport">BCTC: —</span>
                  <span id="stkUpdateDate">Cập nhật: —</span>
                </div>
              </div>

              <!-- Hộp định giá Hiện tại & Giá thị trường -->
              <div class="stock-val-box" id="stkValBox">
                <div class="stock-val-top">
                  <div class="stock-price-input-wrap">
                    <label for="stkLivePriceInput" class="stock-price-label">Giá thị trường:</label>
                    <input type="text" class="stock-price-input" id="stkLivePriceInput" placeholder="20.050">
                    <span class="stock-price-sub" id="stkRefPriceDate">đồng/CP</span>
                  </div>
                  <div class="stock-flags-row" id="stkFlagsRow"></div>
                </div>

                <div class="stock-val-grid">
                  <div class="stock-val-card">
                    <div class="stock-val-title">
                      <span>Hệ số P/E (Giá / LNST 4Q)</span>
                      <span class="stock-info-icon stock-tooltip-trigger" data-tooltip="P/E = Giá × Số CP × 1.000 ÷ (LNST mẹ 4Q × 1 tỷ). Mặc định tính từ giá phiên gần nhất.">ⓘ</span>
                    </div>
                    <div class="stock-val-nums">
                      <span class="stock-val-current" id="stkLivePe">—</span>
                      <span class="stock-val-ref" id="stkRefPe"></span>
                    </div>
                    <div class="stock-val-null" id="stkPeNullReason" hidden></div>
                  </div>

                  <div class="stock-val-card">
                    <div class="stock-val-title">
                      <span>Hệ số P/B (Giá / VCSH mẹ)</span>
                      <span class="stock-info-icon stock-tooltip-trigger" data-tooltip="P/B = Giá × Số CP × 1.000 ÷ (VCSH mẹ × 1 tỷ). Mặc định tính từ giá phiên gần nhất.">ⓘ</span>
                    </div>
                    <div class="stock-val-nums">
                      <span class="stock-val-current" id="stkLivePb">—</span>
                      <span class="stock-val-ref" id="stkRefPb"></span>
                    </div>
                    <div class="stock-val-null" id="stkPbNullReason" hidden></div>
                  </div>

                  <div class="stock-val-card" id="stkNimCard" hidden>
                    <div class="stock-val-title">
                      <span>NIM ước tính (12 tháng)</span>
                      <span class="stock-info-icon stock-tooltip-trigger" id="stkNimTooltip">ⓘ</span>
                    </div>
                    <div class="stock-val-nums">
                      <span class="stock-val-current" id="stkLiveNim">—</span>
                    </div>
                  </div>
                </div>
                <div class="stock-val-note">
                  <span>P/E, P/B hiện tại dùng giá phiên gần nhất và lợi nhuận mới công bố; điểm trên đồ thị theo quý dùng giá bình quân quý và trễ 1 kỳ nên có thể khác</span>
                </div>
              </div>
            </div>

            <!-- HÀNG 3 MENU CHỌN CHỈ SỐ KIỂU BỘ LỌC EXCEL + 1 DROPDOWN BỘ NHANH -->
            <div class="stock-menus-toolbar">
              <div class="stock-excel-menus-row">
                <!-- Menu 1: Chỉ số tuyệt đối -->
                <div class="stock-excel-menu-wrap" id="wrapMenuTuyetDoi">
                  <button type="button" class="stock-excel-menu-btn" id="btnMenuTuyetDoi" aria-haspopup="true" aria-expanded="false">
                    <span>Chỉ số tuyệt đối</span>
                    <span class="stock-badge-selected-count" id="countTuyetDoi">0</span>
                    <span class="stock-arrow-icon">▾</span>
                  </button>
                  <div class="stock-excel-dropdown" id="dropdownTuyetDoi" hidden></div>
                </div>

                <!-- Menu 2: Chỉ số tương đối -->
                <div class="stock-excel-menu-wrap" id="wrapMenuTuongDoi">
                  <button type="button" class="stock-excel-menu-btn" id="btnMenuTuongDoi" aria-haspopup="true" aria-expanded="false">
                    <span>Chỉ số tương đối</span>
                    <span class="stock-badge-selected-count" id="countTuongDoi">0</span>
                    <span class="stock-arrow-icon">▾</span>
                  </button>
                  <div class="stock-excel-dropdown" id="dropdownTuongDoi" hidden></div>
                </div>

                <!-- Menu 3: Định giá -->
                <div class="stock-excel-menu-wrap" id="wrapMenuDinhGia">
                  <button type="button" class="stock-excel-menu-btn" id="btnMenuDinhGia" aria-haspopup="true" aria-expanded="false">
                    <span>Định giá</span>
                    <span class="stock-badge-selected-count" id="countDinhGia">0</span>
                    <span class="stock-arrow-icon">▾</span>
                  </button>
                  <div class="stock-excel-dropdown" id="dropdownDinhGia" hidden></div>
                </div>

                <!-- Dropdown Bộ nhanh (Presets) -->
                <div class="stock-excel-menu-wrap stock-preset-wrap" id="wrapMenuPreset">
                  <button type="button" class="stock-excel-menu-btn preset-btn" id="btnMenuPreset" aria-haspopup="true" aria-expanded="false" title="Chọn nhanh bộ chỉ số thông dụng">
                    <span>⚡ Bộ nhanh</span>
                    <span class="stock-arrow-icon">▾</span>
                  </button>
                  <div class="stock-preset-dropdown" id="dropdownPreset" hidden>
                    <button type="button" class="stock-preset-item" data-preset="dinh_gia">🎯 Định giá (P/E, P/B)</button>
                    <button type="button" class="stock-preset-item" data-preset="tang_truong">🚀 Tăng trưởng (DT & LNST YoY)</button>
                    <button type="button" class="stock-preset-item" data-preset="hieu_qua">💎 Hiệu quả (ROE, ROA)</button>
                    <button type="button" class="stock-preset-item" data-preset="quy_mo">🏢 Quy mô (Doanh thu, LNST, VCSH, TTS)</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Backdrop overlay cho Mobile Bottom Sheet -->
            <div class="stock-sheet-backdrop" id="stockSheetBackdrop" hidden></div>

            <!-- HÀNG TAGS HIỂN THỊ CÁC CHỈ SỐ ĐANG VẼ (KÈM DẤU ✕) -->
            <div class="stock-active-tags-wrap" id="stkActiveTagsWrap">
              <span class="stock-active-tags-label">Đang hiển thị:</span>
              <div class="stock-active-tags-list" id="stkActiveTagsList"></div>
            </div>

            <!-- BIỂU ĐỒ & BỘ ĐIỀU KHIỂN ZOOM -->
            <div class="stock-chart-section" id="stockMainChartSection">
              <div class="stock-chart-header">
                <div class="stock-chart-title">
                  <span id="stkMainChartTitle">Biểu đồ phân tích tài chính & định giá</span>
                  <span class="stock-chart-units" id="stkMainChartUnits"></span>
                </div>

                <!-- Điều khiển Zoom: Phóng to (+), Thu nhỏ (-), Đặt lại (⟲) -->
                <div class="stock-zoom-btn-group" role="group" aria-label="Điều khiển phóng to thu nhỏ">
                  <button type="button" class="stock-zoom-btn" id="stkZoomInBtn" title="Phóng to thời gian (+)">＋</button>
                  <button type="button" class="stock-zoom-btn" id="stkZoomOutBtn" title="Thu nhỏ thời gian (-)">－</button>
                  <button type="button" class="stock-zoom-btn" id="stkZoomResetBtn" title="Đặt lại góc nhìn thời gian (⟲)">⟲</button>
                </div>
              </div>

              <div class="stock-canvas-container">
                <canvas id="stockMainCanvas"></canvas>
              </div>

              <!-- 2 ô chọn thời gian: Từ [kỳ/tháng] đến [kỳ/tháng] -->
              <div class="stock-time-range-controls">
                <span class="stock-time-range-label">Khoảng thời gian:</span>
                <div class="stock-time-range-inputs">
                  <label for="stkTimeFromSelect">Từ:</label>
                  <select id="stkTimeFromSelect" class="stock-time-select"></select>
                  <label for="stkTimeToSelect">Đến:</label>
                  <select id="stkTimeToSelect" class="stock-time-select"></select>
                </div>
                <span class="stock-zoom-hint">(Mẹo: Giữ Ctrl + cuộn chuột hoặc dùng 2 ngón tay kéo/thu phóng trên biểu đồ)</span>
              </div>
              <div class="stock-chart-footnote" id="stkChartFootnote" hidden></div>
            </div>

            <!-- KHỐI "TÙY CHỌN NÂNG CAO" ĐÓNG SẴN -->
            <details class="stock-advanced-details" id="stockAdvancedDetails">
              <summary class="stock-advanced-summary">
                <span>⚙️ Tùy chọn nâng cao (So sánh mã, Trung vị ngành, Chuẩn hóa = 100)</span>
                <span class="stock-advanced-arrow">▾</span>
              </summary>

              <div class="stock-advanced-body">
                <!-- Hàng switch bật tắt chức năng nâng cao -->
                <div class="stock-advanced-toggles-row">
                  <!-- Switch So sánh mã -->
                  <label class="stock-switch-label">
                    <input type="checkbox" id="stkCompareSwitch" class="stock-switch-input">
                    <span class="stock-switch-slider"></span>
                    <span class="stock-switch-text">🔀 So sánh cổ phiếu</span>
                  </label>

                  <!-- Switch Trung vị ngành -->
                  <label class="stock-switch-label">
                    <input type="checkbox" id="stkIndustrySwitch" class="stock-switch-input">
                    <span class="stock-switch-slider"></span>
                    <span class="stock-switch-text">🏢 Trung vị ngành & dải p25-p75</span>
                  </label>

                  <!-- Switch Chuẩn hóa = 100 -->
                  <label class="stock-switch-label">
                    <input type="checkbox" id="stkNormSwitch" class="stock-switch-input">
                    <span class="stock-switch-slider"></span>
                    <span class="stock-switch-text">⚖️ Chuẩn hóa = 100</span>
                  </label>
                </div>

                <!-- Khối chi tiết Chế độ so sánh -->
                <div class="stock-compare-box" id="stkCompareBox" hidden>
                  <div class="stock-compare-add-row">
                    <div class="stock-compare-search-wrap">
                      <div class="stock-search-box">
                        <span class="stock-search-icon">➕</span>
                        <input type="text" class="stock-search-input" id="stkCompareSearchInput" placeholder="Thêm mã so sánh (VD: VCB, SSI...)" maxlength="10" autocomplete="off">
                      </div>
                      <ul class="stock-suggest-list" id="stkCompareSuggestList" hidden></ul>
                    </div>

                    <button type="button" class="stock-clear-compare-btn" id="stkClearAllCompareBtn" title="Xóa toàn bộ các mã đang so sánh">
                      <span>🗑️</span>
                      <span>Xóa tất cả so sánh</span>
                    </button>
                  </div>

                  <!-- Danh sách thẻ các mã so sánh -->
                  <div class="stock-compare-tags" id="stkCompareTagsContainer"></div>

                  <!-- Bảng Hiện tại của các mã so sánh -->
                  <div class="stock-compare-table-wrap" id="stkCompareTableWrap"></div>

                  <div class="stock-compare-note">
                    ℹ️ Doanh nghiệp, ngân hàng, chứng khoán có cấu trúc BCTC khác nhau; số tuyệt đối tỷ đồng của các mã quy mô khác nhau nên so bằng chế độ chuẩn hóa hoặc chỉ số tỷ lệ.
                  </div>
                </div>

                <!-- Thông báo & ghi chú trong Tùy chọn nâng cao -->
                <div class="stock-notice-list">
                  <div class="stock-notice-item" id="stkNormNote" hidden>
                    <span>⚖️ Chỉ số tương đối (Đầu kỳ = 100), không phải giá trị thật. Chỉ số âm hoặc bằng 0 tại điểm đầu sẽ không chuẩn hóa được.</span>
                  </div>
                  <div class="stock-notice-item" id="stkIndustryNote" hidden>
                    <span>🏢 Trung vị chỉ gồm các mã đang niêm yết HOSE/HNX hiện nay, không tính mã đã hủy niêm yết.</span>
                  </div>
                  <div class="stock-notice-item warn" id="stkTelecomNote" hidden>
                    <span>⚠️ Ngành Viễn thông chưa đủ mã để tính trung vị (&lt; 5 mã).</span>
                  </div>
                  <div class="stock-notice-item warn" id="stkIndOnlyRatioNote" hidden>
                    <span>ℹ️ Chỉ có trung vị ngành cho các tỷ số (tỷ lệ %, P/E, P/B), không có trung vị cho số tuyệt đối (tỷ đồng).</span>
                  </div>
                  <div class="stock-notice-item" id="stkCrossModelNote" hidden></div>
                  <div class="stock-notice-item warn" id="stkMaxLinesWarn" hidden>
                    <span>⚠️ Đã đạt tối đa 12 đường biểu đồ để đảm bảo khả năng quan sát. Vui lòng tắt bớt chỉ số hoặc mã so sánh.</span>
                  </div>
                </div>
              </div>
            </details>
          </div>

          <!-- Chân khối -->
          <div class="stock-footer">
            <p>Dữ liệu từ VNDirect, là số đã điều chỉnh mới nhất, có thể khác số báo cáo gốc. Chuỗi quý và năm có thể không khớp nhau. Chỉ mang tính tham khảo, không phải khuyến nghị đầu tư. <span id="stkFooterDate"></span></p>
          </div>
        </div>
      </details>
    `;
    return target;
  }

  // ==========================================================================
  // 7. TÍCH HỢP THANH ĐIỀU HƯỚNG NHẢY NHANH (#jump)
  // ==========================================================================
  function setupJumpNavigationIntegration() {
    const jumpNav = document.getElementById('jump');
    if (!jumpNav) return;

    function curTabName() {
      const tabMb = document.getElementById('tab-MB');
      return (tabMb && tabMb.getAttribute('aria-selected') === 'true') ? 'MB' : 'CK';
    }

    function updateJumpNav() {
      const isCk = curTabName() === 'CK';
      let stockBtn = jumpNav.querySelector('button[data-go="stock"]');

      if (isCk) {
        if (!stockBtn) {
          stockBtn = document.createElement('button');
          stockBtn.type = 'button';
          stockBtn.dataset.go = 'stock';
          stockBtn.textContent = 'Cổ phiếu';

          const cmtBtn = jumpNav.querySelector('button[data-go="cmt"]');
          if (cmtBtn) {
            jumpNav.insertBefore(stockBtn, cmtBtn);
          } else {
            jumpNav.appendChild(stockBtn);
          }
        }
      } else {
        if (stockBtn) {
          stockBtn.remove();
        }
      }
    }

    jumpNav.addEventListener('click', e => {
      const b = e.target.closest('button[data-go="stock"]');
      if (!b) return;

      const targetBlock = document.getElementById('target-stock-CK');
      const details = document.getElementById('stockBlockDetails');
      if (!targetBlock || !details) return;

      if (!details.open) {
        details.open = true;
      }

      const rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      targetBlock.scrollIntoView({ behavior: rm ? 'auto' : 'smooth', block: 'start' });
    });

    if (window.MutationObserver) {
      let isUpdating = false;
      const observer = new MutationObserver(() => {
        if (isUpdating) return;
        isUpdating = true;
        setTimeout(() => {
          updateJumpNav();
          isUpdating = false;
        }, 10);
      });
      observer.observe(jumpNav, { childList: true });
    }

    document.addEventListener('click', e => {
      if (e.target.closest('.tab')) {
        setTimeout(updateJumpNav, 20);
      }
    });

    updateJumpNav();
  }

  // ==========================================================================
  // 8. KHỞI TẠO DỮ LIỆU LAZY KHI MỞ KHỐI
  // ==========================================================================
  async function initDataOnce() {
    if (state.initialized) return;
    const msgBox = document.getElementById('stockMsgBox');
    const content = document.getElementById('stockContent');

    try {
      if (msgBox) {
        msgBox.hidden = false;
        msgBox.className = 'stock-msg-box';
        msgBox.textContent = 'Đang tải danh mục cổ phiếu và thư viện biểu đồ…';
      }

      await loadChartLibraries();

      const [meta, index] = await Promise.all([
        fetchJson('meta.json'),
        fetchJson('index.json')
      ]);

      state.metaData = meta;
      state.stockIndex = index;
      state.stockMap = {};
      index.forEach(item => {
        state.stockMap[item.ma] = item;
      });

      const footerDate = document.getElementById('stkFooterDate');
      if (footerDate && meta.ngay_tao) {
        footerDate.textContent = `(Cập nhật hệ thống: ${meta.ngay_tao})`;
      }

      await loadStock(state.currentCode, false);

      state.initialized = true;
      if (msgBox) msgBox.hidden = true;
      if (content) content.hidden = false;

      // Render toàn bộ giao diện lần đầu
      renderStockInfo();
      calculateLiveValuation();
      renderCompareSection();
      renderExcelMenus();
      renderActiveTags();
      renderUnifiedChart();
    } catch (err) {
      console.error('Lỗi khởi tạo khối cổ phiếu:', err);
      if (msgBox) {
        msgBox.hidden = false;
        msgBox.className = 'stock-msg-box err';
        msgBox.textContent = 'Không thể tải dữ liệu cổ phiếu. Vui lòng thử tải lại trang. (' + err.message + ')';
      }
    }
  }

  // ==========================================================================
  // 9. TẢI DỮ LIỆU CỔ PHIẾU CHÍNH & MÃ SO SÁNH
  // ==========================================================================
  async function loadStock(code, shouldRender = true) {
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{3}$/.test(code)) {
      alert('Mã cổ phiếu không hợp lệ (cần đúng 3 ký tự viết hoa).');
      return;
    }
    if (!state.stockMap[code]) {
      alert(`Mã cổ phiếu ${code} không nằm trong danh sách HOSE & HNX được hỗ trợ.`);
      return;
    }

    const msgBox = document.getElementById('stockMsgBox');
    try {
      if (msgBox) {
        msgBox.hidden = false;
        msgBox.className = 'stock-msg-box';
        msgBox.textContent = `Đang tải dữ liệu cổ phiếu ${code}…`;
      }

      const stockData = await fetchJson(`${code}.json`);
      state.currentCode = code;
      state.currentStockData = stockData;

      // Nếu mã mới thuộc danh sách so sánh thì xóa khỏi danh sách so sánh
      const compIdx = state.compareCodes.indexOf(code);
      if (compIdx >= 0) {
        state.compareCodes.splice(compIdx, 1);
        delete state.compareStockData[code];
      }

      validateSelectedIndicators();

      if (shouldRender) {
        renderStockInfo();
        calculateLiveValuation();
        renderCompareSection();
        renderExcelMenus();
        renderActiveTags();
        renderUnifiedChart();
      }

      if (msgBox) msgBox.hidden = true;
    } catch (err) {
      console.error(`Lỗi tải mã ${code}:`, err);
      if (msgBox) {
        msgBox.hidden = false;
        msgBox.className = 'stock-msg-box err';
        msgBox.textContent = `Không thể tải dữ liệu mã ${code}: ${err.message}`;
      }
    }
  }

  async function addCompareStock(code) {
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{3}$/.test(code)) {
      alert('Mã cổ phiếu không hợp lệ (cần đúng 3 ký tự viết hoa).');
      return;
    }
    if (!state.stockMap[code]) {
      alert(`Mã ${code} không nằm trong danh mục HOSE/HNX hỗ trợ.`);
      return;
    }
    if (code === state.currentCode) {
      alert(`Mã ${code} đang là mã chính.`);
      return;
    }
    if (state.compareCodes.includes(code)) {
      alert(`Mã ${code} đã có trong danh sách so sánh.`);
      return;
    }
    if (state.compareCodes.length >= 4) {
      alert('Đã đạt tối đa 4 mã so sánh (tổng cộng 5 mã cùng mã chính).');
      return;
    }

    // Kiểm tra giới hạn 12 đường
    if (!checkMaxLinesAllowed({ extraStock: 1 })) {
      return;
    }

    const msgBox = document.getElementById('stockMsgBox');
    try {
      if (msgBox) {
        msgBox.hidden = false;
        msgBox.className = 'stock-msg-box';
        msgBox.textContent = `Đang tải mã so sánh ${code}…`;
      }

      const compData = await fetchJson(`${code}.json`);
      state.compareCodes.push(code);
      state.compareStockData[code] = compData;

      validateSelectedIndicators();
      renderCompareSection();
      renderExcelMenus();
      renderActiveTags();
      renderUnifiedChart();

      if (msgBox) msgBox.hidden = true;
    } catch (e) {
      console.error(`Lỗi tải mã so sánh ${code}:`, e);
      alert(`Không thể tải mã so sánh ${code}: ${e.message}`);
      if (msgBox) msgBox.hidden = true;
    }
  }

  function removeCompareStock(code) {
    const idx = state.compareCodes.indexOf(code);
    if (idx >= 0) {
      state.compareCodes.splice(idx, 1);
      delete state.compareStockData[code];
      validateSelectedIndicators();
      renderCompareSection();
      renderExcelMenus();
      renderActiveTags();
      renderUnifiedChart();
    }
  }

  function clearAllCompareStocks() {
    state.compareCodes = [];
    state.compareStockData = {};
    validateSelectedIndicators();
    renderCompareSection();
    renderExcelMenus();
    renderActiveTags();
    renderUnifiedChart();
  }

  // ==========================================================================
  // 10. QUY TẮC CHỈ SỐ CHUNG, QUY TẮC 2 TRỤC VÀ GIỚI HẠN 12 ĐƯỜNG
  // ==========================================================================
  function getIndicatorsForCode(code) {
    const info = state.stockMap[code];
    if (!info) return [];
    return getIndicatorsForGroup(info.nhom);
  }

  // Tập hợp các chỉ số mà ÍT NHẤT MỘT mã đang xem có hỗ trợ
  function getAvailableIndicators() {
    const allCodes = getAllActiveStocks();
    if (!allCodes.length) return [];
    const available = new Set();
    allCodes.forEach(c => {
      getIndicatorsForCode(c).forEach(k => available.add(k));
    });
    return Array.from(available);
  }

  // Tập các nhóm đơn vị đang active từ các chỉ số được chọn
  function getActiveUnitGroups() {
    const groups = new Set();
    state.selectedIndicators.forEach(k => {
      const def = ALL_INDICATOR_DEFS[k];
      if (def) groups.add(def.unitGroup);
    });
    return Array.from(groups);
  }

  // Kiểm tra chỉ số có bị disabled theo quy tắc 2 trục Y không
  function isIndicatorDisabledByTwoAxisRule(indicatorKey) {
    if (state.normalized100) return false; // Khi chuẩn hóa = 100, dùng 1 trục duy nhất
    if (state.selectedIndicators.has(indicatorKey)) return false; // Chỉ số đang chọn không bị disable

    const activeGroups = getActiveUnitGroups();
    if (activeGroups.length < 2) return false; // Chưa đủ 2 nhóm đơn vị thì vẫn được chọn thêm

    const def = ALL_INDICATOR_DEFS[indicatorKey];
    if (!def) return false;

    // Đã có đủ 2 nhóm đơn vị: chỉ số nào KHÔNG thuộc 2 nhóm đó thì bị disabled
    return !activeGroups.includes(def.unitGroup);
  }

  // Tự động điều chỉnh các chỉ số khi danh sách mã thay đổi
  function validateSelectedIndicators() {
    const available = new Set(getAvailableIndicators());
    const toRemove = [];
    state.selectedIndicators.forEach(k => {
      if (!available.has(k)) toRemove.push(k);
    });
    toRemove.forEach(k => state.selectedIndicators.delete(k));

    if (state.selectedIndicators.size === 0) {
      if (available.has('lnst_me')) state.selectedIndicators.add('lnst_me');
      else if (available.has('pe')) state.selectedIndicators.add('pe');
      else if (available.size > 0) state.selectedIndicators.add(Array.from(available)[0]);
    }
  }

  function estimateTotalLines(opts = {}) {
    const nStocks = getAllActiveStocks().length + (opts.extraStock || 0);
    const selCount = state.selectedIndicators.size + (opts.extraIndicator || 0);
    const willShowIndustry = opts.toggleIndustry !== undefined ? opts.toggleIndustry : state.showIndustryMedian;

    let lines = nStocks * selCount;

    if (willShowIndustry) {
      const groups = new Set();
      getAllActiveStocks().forEach(c => {
        const item = state.stockMap[c];
        if (item && item.nhom_so_sanh && item.nhom_so_sanh !== 'vien_thong') {
          groups.add(item.nhom_so_sanh);
        }
      });

      let indCount = 0;
      state.selectedIndicators.forEach(k => {
        if (ALL_INDICATOR_DEFS[k]?.hasIndustry) indCount++;
      });
      if (opts.extraIndicatorKey && ALL_INDICATOR_DEFS[opts.extraIndicatorKey]?.hasIndustry) {
        indCount++;
      }
      lines += groups.size * indCount;
    }

    return lines;
  }

  function checkMaxLinesAllowed(opts = {}) {
    const total = estimateTotalLines(opts);
    const warnEl = document.getElementById('stkMaxLinesWarn');
    if (total > 12) {
      if (warnEl) warnEl.hidden = false;
      alert(`Vượt quá số lượng 12 đường biểu đồ (${total} đường). Vui lòng tắt bớt chỉ số hoặc mã so sánh trước khi thêm.`);
      return false;
    }
    if (warnEl) warnEl.hidden = (estimateTotalLines() <= 12);
    return true;
  }

  // ==========================================================================
  // 11. RENDER THÔNG TIN TỔNG QUAN & ĐỊNH GIÁ HIỆN TẠI (MÃ CHÍNH)
  // ==========================================================================
  function renderStockInfo() {
    const stock = state.currentStockData;
    const info = state.stockMap[state.currentCode] || {};
    if (!stock) return;

    const elCode = document.getElementById('stkCode');
    const elName = document.getElementById('stkName');
    const elSan = document.getElementById('stkSan');
    const elIndustry = document.getElementById('stkIndustryTag');
    const elLatestReport = document.getElementById('stkLatestReport');
    const elUpdateDate = document.getElementById('stkUpdateDate');

    if (elCode) elCode.textContent = stock.ma;
    if (elName) elName.textContent = info.ten || stock.ma;
    if (elSan) elSan.textContent = info.san || '—';
    if (elIndustry) elIndustry.textContent = info.ten_nhom_so_sanh || info.nganh_icb || '—';

    const ht = stock.hien_tai || {};
    if (elLatestReport) elLatestReport.textContent = `BCTC gần nhất: ${ht.ky_vcsh || '—'}`;
    if (elUpdateDate) elUpdateDate.textContent = `Ngày công bố: ${ht.ngay_cong_bo_moi_nhat || '—'}`;

    // Cờ cảnh báo
    const flagsRow = document.getElementById('stkFlagsRow');
    if (flagsRow) {
      flagsRow.innerHTML = '';
      const flags = stock.canh_bao || [];
      flags.forEach(fl => {
        const span = document.createElement('span');
        span.className = 'stock-flag-chip';
        span.textContent = `⚠️ ${FLAG_DESCRIPTIONS[fl] || fl}`;
        flagsRow.appendChild(span);
      });
    }

    // Giá tham chiếu mặc định
    const priceInput = document.getElementById('stkLivePriceInput');
    const refDateEl = document.getElementById('stkRefPriceDate');
    if (priceInput && ht.gia_tham_chieu) {
      priceInput.value = formatVnNumber(ht.gia_tham_chieu * 1000.0, 0);
    }
    if (refDateEl && ht.ngay_gia) {
      refDateEl.textContent = `đồng (phiên ${ht.ngay_gia})`;
    }
  }

  function calculateLiveValuation(customPriceVnd = null) {
    const stock = state.currentStockData;
    if (!stock || !stock.hien_tai) return;

    const ht = stock.hien_tai;
    const refNghin = ht.gia_tham_chieu || 0;
    const pNghin = customPriceVnd !== null ? customPriceVnd / 1000.0 : refNghin;

    const elLivePe = document.getElementById('stkLivePe');
    const elRefPe = document.getElementById('stkRefPe');
    const elPeNull = document.getElementById('stkPeNullReason');

    const elLivePb = document.getElementById('stkLivePb');
    const elRefPb = document.getElementById('stkRefPb');
    const elPbNull = document.getElementById('stkPbNullReason');

    // P/E
    if (ht.ly_do_null_pe || !ht.so_cp || !ht.ttm_lnst_me || ht.ttm_lnst_me <= 0) {
      if (elLivePe) elLivePe.textContent = '—';
      if (elRefPe) elRefPe.textContent = '';
      if (elPeNull) {
        elPeNull.hidden = false;
        elPeNull.textContent = NULL_REASONS[ht.ly_do_null_pe] || 'Không xác định';
      }
    } else {
      if (elPeNull) elPeNull.hidden = true;
      if (pNghin > 0) {
        const livePe = (pNghin * ht.so_cp * 1000.0) / (ht.ttm_lnst_me * 1e9);
        if (elLivePe) {
          elLivePe.textContent = livePe > 100.0 ? `${formatVnNumber(livePe, 2)} lần (>100)` : `${formatVnNumber(livePe, 2)} lần`;
        }
      } else {
        if (elLivePe) elLivePe.textContent = '—';
      }
      if (refNghin > 0 && Math.abs(pNghin - refNghin) > 0.001) {
        const refPe = (refNghin * ht.so_cp * 1000.0) / (ht.ttm_lnst_me * 1e9);
        if (elRefPe) elRefPe.textContent = `(Phiên chốt: ${formatVnNumber(refPe, 2)} lần)`;
      } else {
        if (elRefPe) elRefPe.textContent = '';
      }
    }

    // P/B
    if (ht.ly_do_null_pb || !ht.so_cp || !ht.vcsh_me || ht.vcsh_me <= 0) {
      if (elLivePb) elLivePb.textContent = '—';
      if (elRefPb) elRefPb.textContent = '';
      if (elPbNull) {
        elPbNull.hidden = false;
        elPbNull.textContent = NULL_REASONS[ht.ly_do_null_pb] || 'Không xác định';
      }
    } else {
      if (elPbNull) elPbNull.hidden = true;
      if (pNghin > 0) {
        const livePb = (pNghin * ht.so_cp * 1000.0) / (ht.vcsh_me * 1e9);
        if (elLivePb) elLivePb.textContent = `${formatVnNumber(livePb, 2)} lần`;
      } else {
        if (elLivePb) elLivePb.textContent = '—';
      }
      if (refNghin > 0 && Math.abs(pNghin - refNghin) > 0.001) {
        const refPb = (refNghin * ht.so_cp * 1000.0) / (ht.vcsh_me * 1e9);
        if (elRefPb) elRefPb.textContent = `(Phiên chốt: ${formatVnNumber(refPb, 2)} lần)`;
      } else {
        if (elRefPb) elRefPb.textContent = '';
      }
    }

    // NIM (ngân hàng)
    const nimCard = document.getElementById('stkNimCard');
    const elLiveNim = document.getElementById('stkLiveNim');
    if (stock.nhom === 'nh') {
      if (nimCard) nimCard.hidden = false;
      const qList = stock.quarterly || [];
      const latestQ = qList.length ? qList[qList.length - 1] : null;
      if (elLiveNim && latestQ && latestQ.nim_uoc_tinh_12t) {
        elLiveNim.textContent = `${formatVnNumber(latestQ.nim_uoc_tinh_12t, 2)}%`;
      }
    } else {
      if (nimCard) nimCard.hidden = true;
    }
  }

  // ==========================================================================
  // 12. RENDER KHỐI SO SÁNH VÀ BẢNG HIỆN TẠI (TRONG TÙY CHỌN NÂNG CAO)
  // ==========================================================================
  function renderCompareSection() {
    const box = document.getElementById('stkCompareBox');
    const switchEl = document.getElementById('stkCompareSwitch');
    const tagsContainer = document.getElementById('stkCompareTagsContainer');
    const tableWrap = document.getElementById('stkCompareTableWrap');

    if (!box) return;

    box.hidden = !state.compareMode;
    if (switchEl) switchEl.checked = state.compareMode;

    if (!state.compareMode) return;

    // Render tags các mã
    if (tagsContainer) {
      tagsContainer.innerHTML = '';

      // Tag mã chính
      const mainTag = document.createElement('div');
      mainTag.className = 'stock-compare-tag';
      mainTag.innerHTML = `
        <span class="stock-compare-dot" style="background:${STOCK_COLORS[0]}"></span>
        <span class="stock-compare-tag-code">${state.currentCode}</span>
        <span class="stock-compare-tag-type">(Chính)</span>
      `;
      tagsContainer.appendChild(mainTag);

      // Tag các mã so sánh
      state.compareCodes.forEach((cd, idx) => {
        const color = STOCK_COLORS[idx + 1] || '#94a3b8';
        const tag = document.createElement('div');
        tag.className = 'stock-compare-tag';

        const dot = document.createElement('span');
        dot.className = 'stock-compare-dot';
        dot.style.background = color;

        const codeSpan = document.createElement('span');
        codeSpan.className = 'stock-compare-tag-code';
        codeSpan.textContent = cd;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'stock-compare-remove';
        removeBtn.title = `Xóa mã ${cd} khỏi so sánh`;
        removeBtn.textContent = '✕';
        removeBtn.addEventListener('click', () => removeCompareStock(cd));

        tag.appendChild(dot);
        tag.appendChild(codeSpan);
        tag.appendChild(removeBtn);
        tagsContainer.appendChild(tag);
      });
    }

    // Render bảng Hiện tại
    if (tableWrap) {
      const allCodes = getAllActiveStocks();
      let tableHtml = `
        <table class="stock-compare-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Sàn / Ngành</th>
              <th>Giá phiên chốt</th>
              <th>Ngày giá</th>
              <th>P/E hiện tại</th>
              <th>P/B hiện tại</th>
            </tr>
          </thead>
          <tbody>
      `;

      allCodes.forEach(cd => {
        const isMain = (cd === state.currentCode);
        const color = getStockColor(cd);
        const info = state.stockMap[cd] || {};
        const sData = isMain ? state.currentStockData : state.compareStockData[cd];
        const ht = sData?.hien_tai || {};

        let peStr = '—';
        if (ht.ttm_lnst_me > 0 && ht.gia_tham_chieu > 0 && ht.so_cp > 0) {
          const peVal = (ht.gia_tham_chieu * ht.so_cp * 1000.0) / (ht.ttm_lnst_me * 1e9);
          peStr = peVal > 100.0 ? `${formatVnNumber(peVal, 2)}x (>100)` : `${formatVnNumber(peVal, 2)}x`;
        } else if (ht.ly_do_null_pe) {
          peStr = `— (${NULL_REASONS[ht.ly_do_null_pe] || ht.ly_do_null_pe})`;
        }

        let pbStr = '—';
        if (ht.vcsh_me > 0 && ht.gia_tham_chieu > 0 && ht.so_cp > 0) {
          const pbVal = (ht.gia_tham_chieu * ht.so_cp * 1000.0) / (ht.vcsh_me * 1e9);
          pbStr = `${formatVnNumber(pbVal, 2)}x`;
        } else if (ht.ly_do_null_pb) {
          pbStr = `— (${NULL_REASONS[ht.ly_do_null_pb] || ht.ly_do_null_pb})`;
        }

        const priceStr = ht.gia_tham_chieu ? `${formatVnNumber(ht.gia_tham_chieu * 1000.0, 0)} đ` : '—';
        const dateStr = ht.ngay_gia || '—';

        tableHtml += `
          <tr>
            <td>
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px"></span>
              <strong>${cd}</strong> ${isMain ? '<small style="color:var(--accent)">(Chính)</small>' : ''}
            </td>
            <td>${info.san || '—'} · ${info.ten_nhom_so_sanh || info.nganh_icb || '—'}</td>
            <td><strong>${priceStr}</strong></td>
            <td>${dateStr}</td>
            <td>${peStr}</td>
            <td>${pbStr}</td>
          </tr>
        `;
      });

      tableHtml += `
          </tbody>
        </table>
      `;
      tableWrap.innerHTML = tableHtml;
    }
  }

  // ==========================================================================
  // 13. RENDER 3 MENU CHỌN CHỈ SỐ KIỂU BỘ LỌC EXCEL
  // ==========================================================================
  function renderExcelMenus() {
    const availableKeys = new Set(getAvailableIndicators());
    const allCodes = getAllActiveStocks();
    const menuConfigs = [
      { id: 'dropdownTuyetDoi', countId: 'countTuyetDoi', group: 'tuyet_doi' },
      { id: 'dropdownTuongDoi', countId: 'countTuongDoi', group: 'tuong_doi' },
      { id: 'dropdownDinhGia', countId: 'countDinhGia', group: 'dinh_gia' }
    ];

    menuConfigs.forEach(({ id, countId, group }) => {
      const dropdownEl = document.getElementById(id);
      const countEl = document.getElementById(countId);
      if (!dropdownEl) return;

      // Đếm số lượng chỉ số đang chọn trong menu này
      let selectedInGroup = 0;
      Object.keys(ALL_INDICATOR_DEFS).forEach(k => {
        const def = ALL_INDICATOR_DEFS[k];
        if (def.menuGroup === group && availableKeys.has(k) && state.selectedIndicators.has(k)) {
          selectedInGroup++;
        }
      });
      if (countEl) countEl.textContent = selectedInGroup;

      // Danh sách các chỉ số thuộc nhóm này
      const indicatorsInGroup = Object.keys(ALL_INDICATOR_DEFS).filter(k => {
        return ALL_INDICATOR_DEFS[k].menuGroup === group && availableKeys.has(k);
      });

      const keyword = (state.filterKeyword[group] || '').trim().toLowerCase();
      const keywordNoMark = removeDiacritics(keyword);

      // Xây dựng DOM cho dropdown
      dropdownEl.innerHTML = `
        <div class="stock-excel-dropdown-inner">
          <div class="stock-excel-dropdown-head">
            <div class="stock-excel-search-box">
              <span class="stock-search-icon">🔍</span>
              <input type="text" class="stock-excel-search-input" data-menu-group="${group}" placeholder="Tìm nhanh chỉ số..." value="${state.filterKeyword[group] || ''}" autocomplete="off">
            </div>
            <div class="stock-excel-actions-row">
              <button type="button" class="stock-excel-action-btn select-all-btn" data-menu-group="${group}">Chọn tất cả</button>
              <button type="button" class="stock-excel-action-btn deselect-all-btn" data-menu-group="${group}">Bỏ chọn</button>
            </div>
          </div>

          <div class="stock-excel-list" role="group">
            ${indicatorsInGroup.map(k => {
              const def = ALL_INDICATOR_DEFS[k];
              const isChecked = state.selectedIndicators.has(k);
              const isDisabled = isIndicatorDisabledByTwoAxisRule(k);
              const fullText = (def.fullLabel || def.label) + ' ' + def.unitText;
              const matches = !keyword ||
                              fullText.toLowerCase().includes(keyword) ||
                              removeDiacritics(fullText).includes(keywordNoMark);

              // Kiểm tra xem chỉ số này có áp dụng cho mọi mã đang xem không
              const notAllApply = allCodes.length > 1 && !allCodes.every(c => getIndicatorsForCode(c).includes(k));
              const scopeText = notAllApply ? (def.bankOnly ? ' (chỉ NH)' : (def.dnOnly ? ' (chỉ DN)' : '')) : '';

              const disabledTitle = isDisabled ? 'Tối đa 2 đơn vị cùng lúc. Muốn so xu hướng nhiều chỉ số khác đơn vị thì bật \'Chuẩn hóa\'.' : '';

              return `
                <label class="stock-excel-item ${isDisabled ? 'disabled' : ''}" style="${matches ? '' : 'display:none;'}" title="${disabledTitle}">
                  <input type="checkbox" class="stock-excel-cb" value="${k}" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}>
                  <span class="stock-excel-label">${def.label}${scopeText ? `<small style="color:var(--accent);font-size:0.75rem">${scopeText}</small>` : ''}</span>
                  <span class="stock-excel-unit">${def.unitText}</span>
                </label>
              `;
            }).join('')}
          </div>

          <div class="stock-excel-dropdown-foot">
            <span class="stock-excel-hint-text">
              ${group === 'tuyet_doi' ? 'Đơn vị: Tỷ đồng' : (group === 'tuong_doi' ? 'Đơn vị: %' : 'Hệ số & Tỷ số')}
            </span>
            <button type="button" class="stock-excel-done-btn" data-menu-group="${group}">Xong</button>
          </div>
        </div>
      `;
    });

    attachExcelDropdownEvents();
  }

  function attachExcelDropdownEvents() {
    // Sự kiện checkbox thay đổi (cập nhật biểu đồ ngay lập tức, không đóng menu)
    document.querySelectorAll('.stock-excel-cb').forEach(cb => {
      cb.addEventListener('change', e => {
        const key = e.target.value;
        const checked = e.target.checked;

        if (checked) {
          if (!checkMaxLinesAllowed({ extraIndicatorKey: key })) {
            e.target.checked = false;
            return;
          }
          state.selectedIndicators.add(key);
        } else {
          // Phải giữ tối thiểu 1 chỉ số
          if (state.selectedIndicators.size <= 1) {
            alert('Cần giữ tối thiểu 1 chỉ số được chọn.');
            e.target.checked = true;
            return;
          }
          state.selectedIndicators.delete(key);
        }

        // Cập nhật lại trạng thái disable của các checkbox khác và re-render
        renderExcelMenus();
        renderActiveTags();
        renderUnifiedChart();
      });
    });

    // Ô tìm kiếm nhanh trong từng menu
    document.querySelectorAll('.stock-excel-search-input').forEach(input => {
      input.addEventListener('input', e => {
        const group = e.target.dataset.menuGroup;
        state.filterKeyword[group] = e.target.value;

        const kw = e.target.value.trim().toLowerCase();
        const kwNoMark = removeDiacritics(kw);
        const dropdown = e.target.closest('.stock-excel-dropdown');
        if (!dropdown) return;

        dropdown.querySelectorAll('.stock-excel-item').forEach(item => {
          const text = item.textContent || '';
          const matches = !kw || text.toLowerCase().includes(kw) || removeDiacritics(text).includes(kwNoMark);
          item.style.display = matches ? 'flex' : 'none';
        });
      });
    });

    // Nút Chọn tất cả
    document.querySelectorAll('.select-all-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const group = e.target.dataset.menuGroup;
        const dropdown = e.target.closest('.stock-excel-dropdown');
        if (!dropdown) return;

        const candidateItems = Array.from(dropdown.querySelectorAll('.stock-excel-item:not(.disabled)')).filter(it => it.style.display !== 'none');
        if (candidateItems.length === 0) {
          alert('Tối đa 2 đơn vị cùng lúc. Muốn so xu hướng nhiều chỉ số khác đơn vị thì bật \'Chuẩn hóa\'.');
          return;
        }

        let reachedLimit = false;
        candidateItems.forEach(item => {
          const cb = item.querySelector('.stock-excel-cb');
          if (cb && !cb.checked) {
            if (estimateTotalLines({ extraIndicatorKey: cb.value }) <= 12) {
              state.selectedIndicators.add(cb.value);
            } else {
              reachedLimit = true;
            }
          }
        });

        if (reachedLimit) {
          const warnEl = document.getElementById('stkMaxLinesWarn');
          if (warnEl) warnEl.hidden = false;
          alert('Đã chọn tối đa số chỉ số cho phép (chạm giới hạn 12 đường biểu đồ). Vui lòng tắt bớt chỉ số hoặc mã so sánh.');
        }

        renderExcelMenus();
        renderActiveTags();
        renderUnifiedChart();
      });
    });

    // Nút Bỏ chọn
    document.querySelectorAll('.deselect-all-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const group = e.target.dataset.menuGroup;
        const dropdown = e.target.closest('.stock-excel-dropdown');
        if (!dropdown) return;

        dropdown.querySelectorAll('.stock-excel-cb:checked').forEach(cb => {
          if (state.selectedIndicators.size > 1) {
            state.selectedIndicators.delete(cb.value);
          }
        });

        renderExcelMenus();
        renderActiveTags();
        renderUnifiedChart();
      });
    });

    // Nút Xong
    document.querySelectorAll('.stock-excel-done-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        closeAllDropdowns();
      });
    });
  }

  // ==========================================================================
  // 14. HÀNG TAGS CHỈ SỐ ĐANG VẼ (KÈM DẤU ✕ ĐỂ XÓA NHANH)
  // ==========================================================================
  function renderActiveTags() {
    const listEl = document.getElementById('stkActiveTagsList');
    if (!listEl) return;

    listEl.innerHTML = '';

    state.selectedIndicators.forEach(k => {
      const def = ALL_INDICATOR_DEFS[k];
      if (!def) return;

      const tag = document.createElement('div');
      tag.className = 'stock-active-tag';

      const labelSpan = document.createElement('span');
      labelSpan.className = 'stock-active-tag-label';
      labelSpan.textContent = `${def.label} (${def.unitText})`;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'stock-active-tag-remove';
      removeBtn.title = `Bỏ chọn ${def.label}`;
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => {
        if (state.selectedIndicators.size <= 1) {
          alert('Cần giữ tối thiểu 1 chỉ số được chọn.');
          return;
        }
        state.selectedIndicators.delete(k);
        renderExcelMenus();
        renderActiveTags();
        renderUnifiedChart();
      });

      tag.appendChild(labelSpan);
      tag.appendChild(removeBtn);
      listEl.appendChild(tag);
    });
  }

  // ==========================================================================
  // 15. ĐIỀU KHIỂN ĐÓNG MỞ DROPDOWNS VÀ BOTTOM SHEET MOBILE
  // ==========================================================================
  function toggleDropdown(menuKey) {
    if (state.activeDropdown === menuKey) {
      closeAllDropdowns();
      return;
    }

    closeAllDropdowns();
    state.activeDropdown = menuKey;

    let dropdownEl = null;
    let btnEl = null;

    if (menuKey === 'tuyet_doi') {
      dropdownEl = document.getElementById('dropdownTuyetDoi');
      btnEl = document.getElementById('btnMenuTuyetDoi');
    } else if (menuKey === 'tuong_doi') {
      dropdownEl = document.getElementById('dropdownTuongDoi');
      btnEl = document.getElementById('btnMenuTuongDoi');
    } else if (menuKey === 'dinh_gia') {
      dropdownEl = document.getElementById('dropdownDinhGia');
      btnEl = document.getElementById('btnMenuDinhGia');
    } else if (menuKey === 'preset') {
      dropdownEl = document.getElementById('dropdownPreset');
      btnEl = document.getElementById('btnMenuPreset');
    }

    if (dropdownEl) {
      dropdownEl.hidden = false;
      if (btnEl) {
        btnEl.setAttribute('aria-expanded', 'true');
        btnEl.classList.add('active');
      }

      // Trên mobile hiển thị backdrop
      const backdrop = document.getElementById('stockSheetBackdrop');
      if (backdrop && isMobileScreen()) {
        backdrop.hidden = false;
      }

      // Focus vào ô tìm kiếm nhanh nếu có
      const searchInp = dropdownEl.querySelector('.stock-excel-search-input');
      if (searchInp) {
        setTimeout(() => searchInp.focus(), 50);
      }
    }
  }

  function closeAllDropdowns() {
    state.activeDropdown = null;
    ['dropdownTuyetDoi', 'dropdownTuongDoi', 'dropdownDinhGia', 'dropdownPreset'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });

    ['btnMenuTuyetDoi', 'btnMenuTuongDoi', 'btnMenuDinhGia', 'btnMenuPreset'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.setAttribute('aria-expanded', 'false');
        el.classList.remove('active');
      }
    });

    const backdrop = document.getElementById('stockSheetBackdrop');
    if (backdrop) backdrop.hidden = true;
  }

  // ==========================================================================
  // 16. CHỌN NHANH BỘ CHỈ SỐ (PRESETS)
  // ==========================================================================
  function applyPreset(presetType) {
    const common = new Set(getCommonIndicators());
    const isNh = (state.currentStockData?.nhom === 'nh');

    state.selectedIndicators.clear();

    if (presetType === 'dinh_gia') {
      // P/E và P/B
      if (common.has('pe')) state.selectedIndicators.add('pe');
      if (common.has('pb')) state.selectedIndicators.add('pb');
    } else if (presetType === 'tang_truong') {
      // Tăng trưởng LNST YoY + Doanh thu (hoặc tín dụng với ngân hàng)
      if (common.has('tang_truong_lnst_yoy')) state.selectedIndicators.add('tang_truong_lnst_yoy');
      if (isNh) {
        if (common.has('tang_truong_tin_dung_yoy')) state.selectedIndicators.add('tang_truong_tin_dung_yoy');
        else if (common.has('tang_truong_toi_yoy')) state.selectedIndicators.add('tang_truong_toi_yoy');
      } else {
        if (common.has('tang_truong_doanh_thu_yoy')) state.selectedIndicators.add('tang_truong_doanh_thu_yoy');
      }
    } else if (presetType === 'hieu_qua') {
      // ROE & ROA
      if (common.has('roe')) state.selectedIndicators.add('roe');
      if (common.has('roa')) state.selectedIndicators.add('roa');
    } else if (presetType === 'quy_mo') {
      // Doanh thu/TOI, LNST, VCSH, TTS
      if (common.has('lnst_me')) state.selectedIndicators.add('lnst_me');
      if (isNh) {
        if (common.has('toi')) state.selectedIndicators.add('toi');
        if (common.has('tong_tai_san')) state.selectedIndicators.add('tong_tai_san');
      } else {
        if (common.has('doanh_thu_thuan')) state.selectedIndicators.add('doanh_thu_thuan');
        if (common.has('tong_tai_san')) state.selectedIndicators.add('tong_tai_san');
      }
    }

    // Nếu không khớp chỉ số nào thì dự phòng
    if (state.selectedIndicators.size === 0) {
      if (common.has('lnst_me')) state.selectedIndicators.add('lnst_me');
      else if (common.has('pe')) state.selectedIndicators.add('pe');
    }

    closeAllDropdowns();
    renderExcelMenus();
    renderActiveTags();
    renderUnifiedChart();
  }

  // ==========================================================================
  // 17. ĐỒNG BỘ 2 CHIỀU GIỮA ZOOM VÀ 2 Ô THỜI GIAN
  // ==========================================================================
  function updateTimeSelects(chart) {
    const fromSel = document.getElementById('stkTimeFromSelect');
    const toSel = document.getElementById('stkTimeToSelect');
    if (!chart || !fromSel || !toSel) return;

    const labels = chart.data.labels || [];
    if (!labels.length) return;

    const xMin = Math.max(0, Math.min(labels.length - 1, Math.round(chart.scales.x.min)));
    const xMax = Math.max(0, Math.min(labels.length - 1, Math.round(chart.scales.x.max)));

    fromSel.value = labels[xMin];
    toSel.value = labels[xMax];
  }

  function setupTimeRangeSelects(labels) {
    const fromSel = document.getElementById('stkTimeFromSelect');
    const toSel = document.getElementById('stkTimeToSelect');
    if (!fromSel || !toSel || !labels.length) return;

    fromSel.innerHTML = '';
    toSel.innerHTML = '';

    labels.forEach(lb => {
      const optFrom = document.createElement('option');
      optFrom.value = lb;
      optFrom.textContent = lb;
      fromSel.appendChild(optFrom);

      const optTo = document.createElement('option');
      optTo.value = lb;
      optTo.textContent = lb;
      toSel.appendChild(optTo);
    });

    fromSel.value = labels[0];
    toSel.value = labels[labels.length - 1];

    fromSel.onchange = () => {
      if (!state.chartInstance) return;
      const fIdx = labels.indexOf(fromSel.value);
      const tIdx = labels.indexOf(toSel.value);
      if (fIdx >= 0 && tIdx >= fIdx) {
        state.chartInstance.zoomScale('x', { min: fIdx, max: tIdx }, 'none');
      }
    };

    toSel.onchange = () => {
      if (!state.chartInstance) return;
      const fIdx = labels.indexOf(fromSel.value);
      const tIdx = labels.indexOf(toSel.value);
      if (tIdx >= 0 && tIdx >= fIdx) {
        state.chartInstance.zoomScale('x', { min: fIdx, max: tIdx }, 'none');
      }
    };
  }

  // ==========================================================================
  // 18. MỘT BIỂU ĐỒ DUY NHẤT & QUY TẮC 2 TRỤC Y TỌA ĐỘ
  // ==========================================================================
  async function renderUnifiedChart() {
    if (!state.chartJsLoaded || !window.Chart || !state.currentStockData) return;
    const mainCanvas = document.getElementById('stockMainCanvas');
    if (!mainCanvas) return;

    const theme = getThemeColors();
    const isMobile = isMobileScreen();
    const fontSize = isMobile ? 11 : 12; // Cỡ chữ >= 12px (điện thoại >= 11px)

    const isQuy = state.periodMode === 'QUY';
    const primarySeries = isQuy ? (state.currentStockData.quarterly || []) : (state.currentStockData.yearly || []);

    // 1. Thu thập mốc thời gian (timeline Quý hoặc Năm từ 2015 trở đi)
    const allPeriods = primarySeries.map(item => item.ky);
    let filterPeriods = allPeriods;
    const totalP = allPeriods.length;
    if (state.timeRange === '3Y') {
      const n = isQuy ? 12 : 3;
      filterPeriods = allPeriods.slice(Math.max(0, totalP - n));
    } else if (state.timeRange === '5Y') {
      const n = isQuy ? 20 : 5;
      filterPeriods = allPeriods.slice(Math.max(0, totalP - n));
    } else if (state.timeRange === 'all') {
      // Với P/E hoặc P/B, trục "Tất cả" bắt đầu từ kỳ đầu tiên có dữ liệu
      const hasValuation = state.selectedIndicators.has('pe') || state.selectedIndicators.has('pb');
      if (hasValuation && primarySeries.length) {
        let firstValidIdx = -1;
        for (let i = 0; i < primarySeries.length; i++) {
          const item = primarySeries[i];
          const hasVal = Array.from(state.selectedIndicators).some(k => item[k] !== null && item[k] !== undefined);
          if (hasVal) {
            firstValidIdx = i;
            break;
          }
        }
        if (firstValidIdx > 0) {
          filterPeriods = allPeriods.slice(firstValidIdx);
        }
      }
    }

    if (!filterPeriods.length) return;

    const activeStocks = getAllActiveStocks();
    const activeIndicators = Array.from(state.selectedIndicators);
    const datasets = [];
    const rawDataStore = {}; // datasetId -> array of numbers

    // 2. Xác định 2 nhóm đơn vị trục Y (nếu không chuẩn hóa = 100)
    const activeUnitGroups = getActiveUnitGroups();
    const primaryUnit = activeUnitGroups[0] || 'ty_dong';
    const secondaryUnit = activeUnitGroups.length > 1 ? activeUnitGroups[1] : null;

    // Cập nhật tiêu đề đơn vị biểu đồ
    const unitsHeaderEl = document.getElementById('stkMainChartUnits');
    if (unitsHeaderEl) {
      if (state.normalized100) {
        unitsHeaderEl.textContent = '(Chỉ số tương đối: Gốc đầu kỳ = 100)';
      } else {
        const uNames = {
          'ty_dong': 'Tỷ đồng',
          'phan_tram': '%',
          'pe': 'P/E (Lần)',
          'pb': 'P/B (Lần)',
          'no_vcsh': 'Nợ/VCSH (Lần)'
        };
        const u1 = uNames[primaryUnit] || primaryUnit;
        const u2 = secondaryUnit ? `, Trục phải: ${uNames[secondaryUnit] || secondaryUnit}` : '';
        unitsHeaderEl.textContent = `(Trục trái: ${u1}${u2})`;
      }
    }

    // 3. Thu thập dữ liệu các mã cổ phiếu
    activeStocks.forEach(code => {
      const isMain = (code === state.currentCode);
      const sData = isMain ? state.currentStockData : state.compareStockData[code];
      if (!sData) return;

      const color = getStockColor(code);
      const bctcSeries = isQuy ? (sData.quarterly || []) : (sData.yearly || []);

      const bctcMap = {};
      bctcSeries.forEach(item => { bctcMap[item.ky] = item; });

      activeIndicators.forEach(k => {
        const def = ALL_INDICATOR_DEFS[k];
        if (!def) return;

        const rawSeries = [];
        const uocTinhArr = [];
        const dangDienRaArr = [];
        const tinCayThapArr = [];
        const chiCoDinhGiaArr = [];
        const nullReasonArr = [];

        filterPeriods.forEach(pStr => {
          const bItem = bctcMap[pStr];
          if (bItem) {
            let v = bItem[k];
            if (v === undefined && def.alt) v = bItem[def.alt];
            const val = (v !== undefined && v !== null) ? v : null;
            rawSeries.push(val);
            if (k === 'pe' || k === 'pb') {
              uocTinhArr.push(!!bItem.uoc_tinh);
              dangDienRaArr.push(!!bItem.dang_dien_ra);
              tinCayThapArr.push(!!bItem.tin_cay_thap);
              chiCoDinhGiaArr.push(!!bItem.chi_co_dinh_gia);
              nullReasonArr.push((val === null) ? (bItem[`ly_do_null_${k}`] || null) : null);
            } else {
              uocTinhArr.push(false);
              dangDienRaArr.push(false);
              tinCayThapArr.push(false);
              chiCoDinhGiaArr.push(false);
              nullReasonArr.push((val === null) ? (bItem[`ly_do_null_${k}`] || null) : null);
            }
          } else {
            rawSeries.push(null);
            uocTinhArr.push(false);
            dangDienRaArr.push(false);
            tinCayThapArr.push(false);
            chiCoDinhGiaArr.push(false);
            nullReasonArr.push('thieu_quy');
          }
        });

        const dsId = `${code}_${k}`;
        rawDataStore[dsId] = rawSeries;

        // Xác định trục Y: Y1 (trái) hay Y2 (phải)
        let axisId = 'y';
        if (!state.normalized100) {
          if (def.unitGroup === secondaryUnit) {
            axisId = 'y1';
          } else {
            axisId = 'y';
          }
        }

        const labelText = (activeStocks.length > 1) ? `${code} - ${def.label}` : def.label;

        // Xử lý giá trị vẽ (plot values)
        let plotVals = rawSeries;
        if (state.normalized100) {
          // Chuẩn hóa = 100 tại điểm dương đầu tiên
          let baseVal = null;
          for (let i = 0; i < rawSeries.length; i++) {
            if (rawSeries[i] !== null && rawSeries[i] !== undefined && rawSeries[i] > 0) {
              baseVal = rawSeries[i];
              break;
            }
          }
          if (baseVal !== null && baseVal > 0) {
            plotVals = rawSeries.map(v => (v !== null && v !== undefined) ? Number(((v / baseVal) * 100.0).toFixed(2)) : null);
          } else {
            plotVals = rawSeries.map(() => null);
          }
        } else if (k === 'pe') {
          // Chặn P/E ở 100
          plotVals = rawSeries.map(v => (v !== null && v > 100.0) ? 100.0 : v);
        } else if (def.isGrowth) {
          // Trục % tăng trưởng cắt khoảng -200% đến +200%
          plotVals = rawSeries.map(v => {
            if (v === null || v === undefined) return null;
            if (v > 200.0) return 200.0;
            if (v < -200.0) return -200.0;
            return v;
          });
        }

        const dsConfig = {
          id: dsId,
          code,
          indicatorKey: k,
          label: labelText,
          data: plotVals,
          borderColor: color,
          backgroundColor: color,
          borderWidth: 2,
          pointStyle: def.marker,
          pointRadius: 3,
          spanGaps: false,
          yAxisID: axisId,
          uocTinh: uocTinhArr,
          dangDienRa: dangDienRaArr,
          tinCayThap: tinCayThapArr,
          chiCoDinhGia: chiCoDinhGiaArr,
          nullReasons: nullReasonArr
        };

        if (k === 'pe' || k === 'pb') {
          dsConfig.segment = {
            borderDash: ctx => {
              const i0 = ctx.p0DataIndex;
              const i1 = ctx.p1DataIndex;
              if (uocTinhArr[i0] || uocTinhArr[i1] || dangDienRaArr[i0] || dangDienRaArr[i1] || tinCayThapArr[i0] || tinCayThapArr[i1]) {
                return [4, 4];
              }
              return (def.dash && def.dash.length) ? def.dash : undefined;
            },
            borderColor: ctx => {
              const i0 = ctx.p0DataIndex;
              const i1 = ctx.p1DataIndex;
              if (tinCayThapArr[i0] || tinCayThapArr[i1]) {
                return hexToRgba(color, 0.4);
              }
              if (dangDienRaArr[i0] || dangDienRaArr[i1]) {
                return hexToRgba(color, 0.5);
              }
              if (uocTinhArr[i0] || uocTinhArr[i1]) {
                return hexToRgba(color, 0.7);
              }
              return color;
            }
          };
          dsConfig.pointBackgroundColor = ctx => {
            const idx = ctx.dataIndex;
            if (dangDienRaArr[idx]) return hexToRgba(color, 0.5);
            if (uocTinhArr[idx]) return hexToRgba(color, 0.7);
            return color;
          };
        } else {
          dsConfig.borderDash = def.dash;
        }

        datasets.push(dsConfig);
      });
    });

    // 4. Thu thập dữ liệu Trung vị ngành
    const telecomWarn = document.getElementById('stkTelecomNote');
    if (telecomWarn) telecomWarn.hidden = true;

    const indOnlyRatioWarn = document.getElementById('stkIndOnlyRatioNote');
    if (indOnlyRatioWarn) indOnlyRatioWarn.hidden = true;

    const hasAnyIndustryIndicator = activeIndicators.some(k => ALL_INDICATOR_DEFS[k]?.hasIndustry);
    if (state.showIndustryMedian && !hasAnyIndustryIndicator) {
      if (indOnlyRatioWarn) indOnlyRatioWarn.hidden = false;
    }

    // Kiểm tra thông báo mã không hỗ trợ chỉ tiêu đặc thù mô hình (ví dụ HPG so với MBB khi chọn CIR/NIM)
    const crossModelNote = document.getElementById('stkCrossModelNote');
    if (crossModelNote) {
      const unsupportedNotes = [];
      activeIndicators.forEach(k => {
        const def = ALL_INDICATOR_DEFS[k];
        if (!def) return;
        const unCodes = activeStocks.filter(c => !getIndicatorsForCode(c).includes(k));
        const suppCodes = activeStocks.filter(c => getIndicatorsForCode(c).includes(k));
        if (unCodes.length > 0 && suppCodes.length > 0) {
          unCodes.forEach(uc => {
            const uInfo = state.stockMap[uc] || {};
            const grpName = uInfo.nhom === 'nh' ? 'Ngân hàng' : (uInfo.nhom === 'ck' ? 'Chứng khoán' : 'Doanh nghiệp sản xuất/dịch vụ');
            unsupportedNotes.push(`Chỉ tiêu "${def.label}" chỉ áp dụng cho mã ${suppCodes.join(', ')}; mã ${uc} (${grpName}) không áp dụng chỉ tiêu này.`);
          });
        }
      });
      if (unsupportedNotes.length > 0) {
        crossModelNote.hidden = false;
        crossModelNote.innerHTML = `<span>ℹ️ ${Array.from(new Set(unsupportedNotes)).join('<br>')}</span>`;
      } else {
        crossModelNote.hidden = true;
      }
    }

    if (state.showIndustryMedian) {
      const uniqueGroups = new Map();
      activeStocks.forEach(c => {
        const item = state.stockMap[c];
        if (item && item.nhom_so_sanh) {
          uniqueGroups.set(item.nhom_so_sanh, item.ten_nhom_so_sanh || item.nganh_icb || item.nhom_so_sanh);
        }
      });

      for (const [gCode, gName] of uniqueGroups.entries()) {
        if (gCode === 'vien_thong') {
          if (telecomWarn) telecomWarn.hidden = false;
          continue;
        }

        const gData = await loadIndustryData(gCode);
        if (!gData) continue;

        const gSeriesSource = isQuy ? (gData.quarterly || []) : (gData.yearly || []);
        const gQuarterlyMap = {};
        gSeriesSource.forEach(q => { gQuarterlyMap[q.ky] = q; });

        activeIndicators.forEach(k => {
          const def = ALL_INDICATOR_DEFS[k];
          if (!def || !def.hasIndustry) return;

          const medSeries = [];
          const p25Series = [];
          const p75Series = [];
          const gUocTinhArr = [];
          const gNullReasonArr = [];

          let hasAnyData = false;
          let latestValidN = 0;
          let totalN = gData.so_ma || 0;

          filterPeriods.forEach(pStr => {
            const q = gQuarterlyMap[pStr];
            let targetK = k;
            if (q && q[k] === undefined && def.alt && q[def.alt] !== undefined) {
              targetK = def.alt;
            }
            if (q && q[targetK] !== null && q[targetK] !== undefined) {
              medSeries.push(q[targetK]);
              p25Series.push(q[`${targetK}_p25`]);
              p75Series.push(q[`${targetK}_p75`]);
              hasAnyData = true;
              latestValidN = q[`n_hop_le_${targetK}`] || q[`${targetK}_n_hop_le`] || latestValidN;
              const isUoc = (targetK === 'pe' || targetK === 'pb') && (pStr <= '2022Q4' || pStr <= '2022');
              gUocTinhArr.push(isUoc);
              gNullReasonArr.push(null);
            } else {
              medSeries.push(null);
              p25Series.push(null);
              p75Series.push(null);
              gUocTinhArr.push(false);
              gNullReasonArr.push(q ? (q[`ly_do_null_${targetK}`] || 'it_ma') : 'it_ma');
            }
          });

          if (!hasAnyData) return;

          const dsId = `ind_${gCode}_${k}`;
          rawDataStore[dsId] = medSeries;

          let axisId = 'y';
          if (!state.normalized100) {
            axisId = (def.unitGroup === secondaryUnit) ? 'y1' : 'y';
          }

          let plotVals = medSeries;
          if (state.normalized100) {
            let baseVal = null;
            for (let i = 0; i < medSeries.length; i++) {
              if (medSeries[i] !== null && medSeries[i] !== undefined && medSeries[i] > 0) {
                baseVal = medSeries[i];
                break;
              }
            }
            if (baseVal && baseVal > 0) {
              plotVals = medSeries.map(v => (v !== null && v !== undefined) ? Number(((v / baseVal) * 100.0).toFixed(2)) : null);
            } else {
              plotVals = medSeries.map(() => null);
            }
          }

          // Dải phân vị p25-p75 nếu vẽ P/E hoặc P/B (khi không chuẩn hóa)
          if (!state.normalized100 && (k === 'pe' || k === 'pb') && p25Series.length) {
            datasets.push({
              id: `p75_${gCode}_${k}`,
              label: `P75 ${gName} - ${def.label}`,
              data: p75Series,
              borderColor: 'rgba(100, 116, 139, 0.25)',
              borderWidth: 0.8,
              borderDash: [2, 2],
              pointRadius: 0,
              fill: false,
              spanGaps: false,
              yAxisID: axisId
            });

            datasets.push({
              id: `p25_${gCode}_${k}`,
              label: `P25 ${gName} - ${def.label}`,
              data: p25Series,
              borderColor: 'rgba(100, 116, 139, 0.25)',
              borderWidth: 0.8,
              borderDash: [2, 2],
              pointRadius: 0,
              fill: '-1',
              backgroundColor: INDUSTRY_FILL_COLOR,
              spanGaps: false,
              yAxisID: axisId
            });
          }

          const indDsConfig = {
            id: dsId,
            isIndustry: true,
            groupName: gName,
            validN: latestValidN,
            totalN,
            indicatorKey: k,
            label: `Trung vị ngành ${gName} (${def.label}) (n=${latestValidN}/${totalN})`,
            data: plotVals,
            borderColor: INDUSTRY_COLOR,
            backgroundColor: INDUSTRY_COLOR,
            borderWidth: 2,
            borderDash: [6, 4],
            pointStyle: 'circle',
            pointRadius: 2.5,
            spanGaps: false,
            yAxisID: axisId,
            uocTinh: gUocTinhArr,
            nullReasons: gNullReasonArr
          };

          if (k === 'pe' || k === 'pb') {
            indDsConfig.segment = {
              borderDash: ctx => {
                const i0 = ctx.p0DataIndex;
                const i1 = ctx.p1DataIndex;
                if (gUocTinhArr[i0] || gUocTinhArr[i1]) return [3, 3];
                return [6, 4];
              },
              borderColor: ctx => {
                const i0 = ctx.p0DataIndex;
                const i1 = ctx.p1DataIndex;
                if (gUocTinhArr[i0] || gUocTinhArr[i1]) return hexToRgba(INDUSTRY_COLOR, 0.6);
                return INDUSTRY_COLOR;
              }
            };
          }

          datasets.push(indDsConfig);
        });
      }
    }

    // 5. Kiểm tra Chuẩn hóa = 100 & Ghi chú gốc bất thường
    if (state.normalized100) {
      datasets.forEach(ds => {
        const raw = rawDataStore[ds.id];
        if (!raw) return;
        const validVals = raw.filter(v => v !== null && v !== undefined && !isNaN(v));
        if (validVals.length >= 3) {
          const sorted = [...validVals].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          const medianVal = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
          const baseVal = validVals[0];

          if (baseVal <= 0 || (medianVal > 0 && baseVal < 0.2 * medianVal)) {
            ds.label += ' (gốc bất thường, mức tăng bị phóng đại)';
          }
        }
      });
    }

    // 6. Xây dựng Scales (Tối đa 2 trục Y: Y bên trái, Y1 bên phải)
    const scalesConfig = {
      x: {
        grid: { color: theme.gridColor },
        ticks: {
          color: theme.textColor,
          font: { size: fontSize },
          maxRotation: 45,
          minRotation: 0,
          autoSkip: true,
          maxTicksLimit: isMobile ? 6 : 10
        }
      }
    };

    function getAxisTitle(uGroup) {
      switch (uGroup) {
        case 'ty_dong': return 'Tỷ đồng';
        case 'phan_tram': return 'Tỷ lệ (%)';
        case 'pe': return 'Hệ số P/E (Lần)';
        case 'pb': return 'Hệ số P/B (Lần)';
        case 'no_vcsh': return 'Nợ / VCSH (Lần)';
        default: return '';
      }
    }

    function getAxisTickFormatter(uGroup) {
      return (val) => {
        if (uGroup === 'phan_tram') return `${formatVnNumber(val, 0)}%`;
        if (uGroup === 'ty_dong') return formatVnNumber(val, 0);
        return formatVnNumber(val, 1);
      };
    }

    if (state.normalized100) {
      scalesConfig.y = {
        type: 'linear',
        position: 'left',
        grid: { color: theme.gridColor },
        ticks: {
          color: theme.textColor,
          font: { size: fontSize },
          callback: v => formatVnNumber(v, 0)
        },
        title: {
          display: true,
          text: 'Điểm (Đầu kỳ = 100)',
          color: theme.textColor,
          font: { size: fontSize, weight: 'bold' }
        }
      };
    } else {
      // Trục Y1 (Bên trái)
      scalesConfig.y = {
        type: 'linear',
        position: 'left',
        grid: { color: theme.gridColor },
        ticks: {
          color: theme.textColor,
          font: { size: fontSize },
          callback: getAxisTickFormatter(primaryUnit)
        },
        title: {
          display: true,
          text: getAxisTitle(primaryUnit),
          color: theme.textColor,
          font: { size: fontSize, weight: 'bold' }
        }
      };
      if (primaryUnit === 'pe') {
        scalesConfig.y.max = 100;
        scalesConfig.y.suggestedMax = 25;
      }

      // Trục Y2 (Bên phải nếu có)
      if (secondaryUnit) {
        scalesConfig.y1 = {
          type: 'linear',
          position: 'right',
          grid: { drawOnChartArea: false }, // Không đè lưới trục trái
          ticks: {
            color: '#16a34a',
            font: { size: fontSize },
            callback: getAxisTickFormatter(secondaryUnit)
          },
          title: {
            display: true,
            text: getAxisTitle(secondaryUnit),
            color: '#16a34a',
            font: { size: fontSize, weight: 'bold' }
          }
        };
        if (secondaryUnit === 'pe') {
          scalesConfig.y1.max = 100;
          scalesConfig.y1.suggestedMax = 25;
        }
      }
    }

    // 7. Khởi tạo/Cập nhật biểu đồ Chart.js
    if (state.chartInstance) {
      state.chartInstance.destroy();
      state.chartInstance = null;
    }

    setupTimeRangeSelects(filterPeriods);

    const ctx = mainCanvas.getContext('2d');
    state.chartInstance = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels: filterPeriods,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: theme.textColor,
              font: { size: fontSize },
              usePointStyle: true,
              boxWidth: 8,
              padding: 12,
              filter: item => !item.text.startsWith('P25 ') && !item.text.startsWith('P75 ')
            }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            padding: 10,
            boxPadding: 4,
            usePointStyle: true,
            filter: item => !item.dataset.label.startsWith('P25 ') && !item.dataset.label.startsWith('P75 '),
            callbacks: {
              label: (context) => {
                const ds = context.dataset;
                const idx = context.dataIndex;
                const rawArr = rawDataStore[ds.id];
                const rawVal = rawArr ? rawArr[idx] : null;
                const def = ALL_INDICATOR_DEFS[ds.indicatorKey];

                if (!ds.isIndustry && !getIndicatorsForCode(ds.code).includes(ds.indicatorKey)) {
                  return ` ${ds.label}: Không áp dụng (mô hình không có chỉ tiêu này)`;
                }
                if (rawVal === null || rawVal === undefined) {
                  const reasonKey = ds.nullReasons ? ds.nullReasons[idx] : null;
                  const reasonText = reasonKey ? (NULL_REASONS[reasonKey] || reasonKey) : 'Không có dữ liệu';
                  return ` ${ds.label}: — (${reasonText})`;
                }

                let valStr = '';
                if (state.normalized100) {
                  valStr = `${formatVnNumber(context.parsed.y, 1)} điểm (Gốc: ${formatVnNumber(rawVal, 1)})`;
                } else if (ds.indicatorKey === 'pe') {
                  if (rawVal > 100.0) {
                    valStr = `${formatVnNumber(rawVal, 2)} lần (>100, không có ý nghĩa)`;
                  } else {
                    valStr = `${formatVnNumber(rawVal, 2)} lần`;
                  }
                } else if (def?.unitGroup === 'ty_dong') {
                  valStr = `${formatVnNumber(rawVal, 1)} tỷ đồng`;
                } else if (def?.unitGroup === 'phan_tram') {
                  valStr = `${formatVnNumber(rawVal, 2)}%`;
                  if (rawVal > 200.0) valStr += ' (vượt mép 200%)';
                  else if (rawVal < -200.0) valStr += ' (dưới mép -200%)';
                } else {
                  valStr = `${formatVnNumber(rawVal, 2)} lần`;
                }

                let flagSuffix = '';
                if (ds.dangDienRa && ds.dangDienRa[idx]) {
                  flagSuffix = ' (đang diễn ra)';
                } else if (ds.uocTinh && ds.uocTinh[idx]) {
                  flagSuffix = ' (ước tính)';
                }
                if (ds.tinCayThap && ds.tinCayThap[idx]) {
                  flagSuffix += ' (tăng vốn chưa xác minh)';
                }
                if (ds.chiCoDinhGia && ds.chiCoDinhGia[idx]) {
                  flagSuffix += ' (chưa có báo cáo quý này; dùng lợi nhuận và vốn chủ trễ 1 kỳ)';
                }

                return ` ${ds.label}: ${valStr}${flagSuffix}`;
              },
              afterLabel: (context) => {
                const ds = context.dataset;
                if (ds.indicatorKey === 'ldr') {
                  return '  ℹ️ Ghi chú: Không phải LDR theo quy định NHNN';
                }
                return null;
              }
            }
          },
          zoom: {
            pan: {
              enabled: true,
              mode: 'x',
              modifierKey: null,
              onPanComplete: ({ chart }) => updateTimeSelects(chart)
            },
            zoom: {
              wheel: {
                enabled: true,
                modifierKey: 'ctrl', // Giữ Ctrl để lăn chuột zoom
                speed: 0.1
              },
              pinch: {
                enabled: true
              },
              mode: 'x',
              onZoomComplete: ({ chart }) => updateTimeSelects(chart)
            }
          }
        },
        scales: scalesConfig
      }
    });

    updateTimeSelects(state.chartInstance);

    // Cập nhật ghi chú công thức P/E, P/B dưới biểu đồ
    const footnoteEl = document.getElementById('stkChartFootnote');
    if (footnoteEl) {
      const hasPE = activeIndicators.includes('pe');
      const hasPB = activeIndicators.includes('pb');
      if (hasPE || hasPB) {
        footnoteEl.hidden = false;
        footnoteEl.textContent = '';
        const iconSpan = document.createElement('span');
        iconSpan.className = 'stock-footnote-icon';
        iconSpan.textContent = 'ℹ️';
        footnoteEl.appendChild(iconSpan);

        let noteText = '';
        if (isQuy) {
          const parts = [];
          if (hasPE) parts.push('P/E quý = Vốn hóa bình quân quý ÷ LNST mẹ của 4 quý liên tiếp (TTM) kết thúc ở quý trước (trễ 1 quý).');
          if (hasPB) parts.push('P/B quý = Vốn hóa bình quân quý ÷ VCSH mẹ cuối quý trước.');
          parts.push('Các kỳ trước 2023 là ước tính (đường nét đứt) dựa trên vốn góp và số cổ phiếu.');
          noteText = parts.join(' ');
        } else {
          const parts = [];
          if (hasPE) parts.push('P/E năm = Vốn hóa bình quân năm ÷ LNST mẹ cả năm trước (trễ 1 năm).');
          if (hasPB) parts.push('P/B năm = Vốn hóa bình quân năm ÷ VCSH mẹ cuối năm trước.');
          parts.push('Các kỳ trước 2023 là ước tính (đường nét đứt) dựa trên vốn góp và số cổ phiếu.');
          noteText = parts.join(' ');
        }
        const textSpan = document.createElement('span');
        textSpan.textContent = ` Ghi chú: ${noteText}`;
        footnoteEl.appendChild(textSpan);
      } else {
        footnoteEl.hidden = true;
        footnoteEl.textContent = '';
      }
    }
  }

  // ==========================================================================
  // 19. ĐẶT LẠI VỀ MẶC ĐỊNH (RESET)
  // ==========================================================================
  function resetToDefault() {
    state.currentCode = DEFAULT_STOCK;
    state.periodMode = 'QUY';
    state.timeRange = '3Y';
    state.compareMode = false;
    state.compareCodes = [];
    state.compareStockData = {};
    state.normalized100 = false;
    state.showIndustryMedian = false;
    state.selectedIndicators = new Set(['lnst_me', 'pe']);
    state.filterKeyword = { 'tuyet_doi': '', 'tuong_doi': '', 'dinh_gia': '' };

    // Reset giao diện Toolbar nút
    document.querySelectorAll('[data-period]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.period === 'QUY');
    });
    document.querySelectorAll('[data-range]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.range === '3Y');
    });

    // Reset switches
    const cmpSw = document.getElementById('stkCompareSwitch');
    if (cmpSw) cmpSw.checked = false;
    const indSw = document.getElementById('stkIndustrySwitch');
    if (indSw) indSw.checked = false;
    const normSw = document.getElementById('stkNormSwitch');
    if (normSw) normSw.checked = false;

    // Reset search input
    const searchInp = document.getElementById('stockSearchInput');
    if (searchInp) searchInp.value = '';

    loadStock(DEFAULT_STOCK, true);
  }

  // ==========================================================================
  // 20. KHỞI TẠO CÁC SỰ KIỆN TƯƠNG TÁC
  // ==========================================================================
  function setupEventListeners() {
    const details = document.getElementById('stockBlockDetails');
    const toggleBtn = document.getElementById('stockToggleBtn');

    if (details) {
      details.addEventListener('toggle', () => {
        if (toggleBtn) {
          toggleBtn.textContent = details.open ? 'Đóng tra cứu ▴' : 'Mở tra cứu ▾';
        }
        if (details.open) {
          initDataOnce();
        }
      });
    }

    // 1. Tìm kiếm mã cổ phiếu chính (Autocomplete)
    const searchInput = document.getElementById('stockSearchInput');
    const suggestList = document.getElementById('stockSuggestList');

    if (searchInput && suggestList) {
      searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim().toUpperCase();
        if (q.length === 0) {
          suggestList.hidden = true;
          return;
        }

        const qNoMark = removeDiacritics(q);
        const matches = state.stockIndex.filter(item => {
          return item.ma.includes(q) ||
                 item.ten.toUpperCase().includes(q) ||
                 removeDiacritics(item.ten).includes(qNoMark);
        }).slice(0, 8);

        if (!matches.length) {
          suggestList.hidden = true;
          return;
        }

        suggestList.innerHTML = '';
        matches.forEach(item => {
          const li = document.createElement('li');
          li.className = 'stock-suggest-item';
          li.innerHTML = `
            <span class="stock-sug-code">${item.ma}</span>
            <span class="stock-sug-name">${item.ten}</span>
            <span class="stock-sug-san">${item.san}</span>
          `;
          li.addEventListener('click', () => {
            searchInput.value = item.ma;
            suggestList.hidden = true;
            loadStock(item.ma, true);
          });
          suggestList.appendChild(li);
        });
        suggestList.hidden = false;
      });

      searchInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const q = searchInput.value.trim().toUpperCase();
          if (q) {
            suggestList.hidden = true;
            loadStock(q, true);
          }
        }
      });
    }

    // 2. Tìm & Thêm mã so sánh
    const cmpSearchInput = document.getElementById('stkCompareSearchInput');
    const cmpSuggestList = document.getElementById('stkCompareSuggestList');

    if (cmpSearchInput && cmpSuggestList) {
      cmpSearchInput.addEventListener('input', () => {
        const q = cmpSearchInput.value.trim().toUpperCase();
        if (q.length === 0) {
          cmpSuggestList.hidden = true;
          return;
        }

        const qNoMark = removeDiacritics(q);
        const matches = state.stockIndex.filter(item => {
          return (item.ma.includes(q) || item.ten.toUpperCase().includes(q) || removeDiacritics(item.ten).includes(qNoMark)) &&
                 item.ma !== state.currentCode &&
                 !state.compareCodes.includes(item.ma);
        }).slice(0, 8);

        if (!matches.length) {
          cmpSuggestList.hidden = true;
          return;
        }

        cmpSuggestList.innerHTML = '';
        matches.forEach(item => {
          const li = document.createElement('li');
          li.className = 'stock-suggest-item';
          li.innerHTML = `
            <span class="stock-sug-code">${item.ma}</span>
            <span class="stock-sug-name">${item.ten}</span>
            <span class="stock-sug-san">${item.san}</span>
          `;
          li.addEventListener('click', () => {
            cmpSearchInput.value = '';
            cmpSuggestList.hidden = true;
            addCompareStock(item.ma);
          });
          cmpSuggestList.appendChild(li);
        });
        cmpSuggestList.hidden = false;
      });

      cmpSearchInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const q = cmpSearchInput.value.trim().toUpperCase();
          if (q) {
            cmpSuggestList.hidden = true;
            cmpSearchInput.value = '';
            addCompareStock(q);
          }
        }
      });
    }

    // Ẩn gợi ý khi click ra ngoài
    document.addEventListener('click', e => {
      if (suggestList && !e.target.closest('.stock-search-wrap')) {
        suggestList.hidden = true;
      }
      if (cmpSuggestList && !e.target.closest('.stock-compare-search-wrap')) {
        cmpSuggestList.hidden = true;
      }
      if (!e.target.closest('.stock-excel-menu-wrap') && !e.target.closest('.stock-sheet-backdrop')) {
        closeAllDropdowns();
      }
    });

    // Phím Escape đóng dropdowns
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeAllDropdowns();
      }
    });

    // Backdrop click đóng mobile sheet
    const backdrop = document.getElementById('stockSheetBackdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => closeAllDropdowns());
    }

    // 3. Nút Quý / Năm
    document.querySelectorAll('[data-period]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-period]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.periodMode = btn.dataset.period;
        renderUnifiedChart();
      });
    });

    // 4. Nút 3N / 5N / Tất cả
    document.querySelectorAll('[data-range]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-range]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.timeRange = btn.dataset.range;
        renderUnifiedChart();
      });
    });

    // 5. Nút Đặt lại về mặc định
    const resetBtn = document.getElementById('stkResetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => resetToDefault());
    }

    // 6. Nhập giá trực tiếp
    const priceInput = document.getElementById('stkLivePriceInput');
    if (priceInput) {
      priceInput.addEventListener('input', () => {
        const clean = priceInput.value.replace(/[^\d]/g, '');
        const val = clean ? Number(clean) : null;
        calculateLiveValuation(val);
      });
    }

    // 7. Mở/đóng 3 Menu Excel & Preset
    const btnTuyetDoi = document.getElementById('btnMenuTuyetDoi');
    if (btnTuyetDoi) btnTuyetDoi.addEventListener('click', () => toggleDropdown('tuyet_doi'));

    const btnTuongDoi = document.getElementById('btnMenuTuongDoi');
    if (btnTuongDoi) btnTuongDoi.addEventListener('click', () => toggleDropdown('tuong_doi'));

    const btnDinhGia = document.getElementById('btnMenuDinhGia');
    if (btnDinhGia) btnDinhGia.addEventListener('click', () => toggleDropdown('dinh_gia'));

    const btnPreset = document.getElementById('btnMenuPreset');
    if (btnPreset) btnPreset.addEventListener('click', () => toggleDropdown('preset'));

    // Bấm vào các mục trong Preset
    document.querySelectorAll('.stock-preset-item').forEach(item => {
      item.addEventListener('click', () => {
        applyPreset(item.dataset.preset);
      });
    });

    // 8. Tùy chọn nâng cao: Switch So sánh, Trung vị ngành, Chuẩn hóa
    const cmpSwitch = document.getElementById('stkCompareSwitch');
    if (cmpSwitch) {
      cmpSwitch.addEventListener('change', () => {
        state.compareMode = cmpSwitch.checked;
        if (!state.compareMode) {
          clearAllCompareStocks();
        } else {
          renderCompareSection();
        }
      });
    }

    const clearAllCmpBtn = document.getElementById('stkClearAllCompareBtn');
    if (clearAllCmpBtn) {
      clearAllCmpBtn.addEventListener('click', () => clearAllCompareStocks());
    }

    const indSwitch = document.getElementById('stkIndustrySwitch');
    const indNote = document.getElementById('stkIndustryNote');
    if (indSwitch) {
      indSwitch.addEventListener('change', () => {
        state.showIndustryMedian = indSwitch.checked;
        if (indNote) indNote.hidden = !indSwitch.checked;
        renderUnifiedChart();
      });
    }

    const normSwitch = document.getElementById('stkNormSwitch');
    const normNote = document.getElementById('stkNormNote');
    if (normSwitch) {
      normSwitch.addEventListener('change', () => {
        state.normalized100 = normSwitch.checked;
        if (normNote) normNote.hidden = !normSwitch.checked;
        renderExcelMenus();
        renderUnifiedChart();
      });
    }

    // 9. Điều khiển Zoom: [+], [-], [⟲]
    const zoomInBtn = document.getElementById('stkZoomInBtn');
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        if (state.chartInstance && state.chartInstance.zoom) {
          state.chartInstance.zoom(1.25);
          updateTimeSelects(state.chartInstance);
        }
      });
    }

    const zoomOutBtn = document.getElementById('stkZoomOutBtn');
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        if (state.chartInstance && state.chartInstance.zoom) {
          state.chartInstance.zoom(0.8);
          updateTimeSelects(state.chartInstance);
        }
      });
    }

    const zoomResetBtn = document.getElementById('stkZoomResetBtn');
    if (zoomResetBtn) {
      zoomResetBtn.addEventListener('click', () => {
        if (state.chartInstance && state.chartInstance.resetZoom) {
          state.chartInstance.resetZoom();
          updateTimeSelects(state.chartInstance);
        }
      });
    }
  }

  // ==========================================================================
  // 21. KHỞI CHẠY KHỐI KHI SẴN SÀNG
  // ==========================================================================
  function init() {
    buildBlockDom();
    setupJumpNavigationIntegration();
    setupEventListeners();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

