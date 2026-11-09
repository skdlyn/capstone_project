// Fungsi untuk Switch Dark / Light Mode
function toggleDarkMode() {
  const html = document.documentElement;
  const themeIcon = document.getElementById("theme-icon");

  if (html.classList.contains("light")) {
    html.classList.remove("light");
    html.classList.add("dark");
    themeIcon.className = "fa-solid fa-sun text-sm text-amber-400";
    localStorage.setItem("theme", "dark");
  } else {
    html.classList.remove("dark");
    html.classList.add("light");
    themeIcon.className = "fa-solid fa-moon text-sm";
    localStorage.setItem("theme", "light");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("theme") === "dark") {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
    document.getElementById("theme-icon").className =
      "fa-solid fa-sun text-sm text-amber-400";
  }
  fetchOutdoorWeather();
  setInterval(fetchOutdoorWeather, 600000);
});

async function fetchOutdoorWeather() {
  try {
    const url =
      "https://api.open-meteo.com/v1/forecast?latitude=-6.9175&longitude=107.6191&current=temperature_2m";
    const response = await fetch(url);
    const data = await response.json();
    if (data && data.current) {
      document.getElementById("outdoor-temp").innerHTML =
        data.current.temperature_2m +
        ' <span class="text-xl font-bold text-slate-500">°C</span>';
      document.getElementById("outdoor-desc").textContent = "Bandung Outdoor";
    }
  } catch (error) {
    console.error("Gagal mengambil data cuaca API:", error);
  }
}

// === KONFIGURASI MQTT ===
const MQTT_OPTIONS = {
  host: "100.106.70.102",
  port: 9001,
  endpoint: "/mqtt",
  clean: true,
  connectTimeout: 4000,
  clientId: "web_dashboard_" + Math.random().toString(16).substring(2, 8),
  path: "/mqtt",
};

const TOPIC_SENSOR = "airmonitor/esp32-01/sensor";
let totalDataCount = 0;
let alertCount = 0;

// === VAR PENGATURAN PAGINASI TABEL LOG ===
let logDataHistory = []; // Penampung seluruh data riwayat
let currentPage = 1;
const rowsPerPage = 10; // Maksimal 10 data per halaman

// Inisialisasi Chart.js
const ctx = document.getElementById("realtimeChart").getContext("2d");
const realtimeChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "Suhu Ruangan (Indoor °C)",
        data: [],
        borderColor: "#f59e0b",
        backgroundColor: "rgba(245, 158, 11, 0.08)",
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        yAxisID: "y",
      },
      {
        label: "Suhu Luar / Outdoor (°C)",
        data: [],
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.05)",
        borderWidth: 2,
        borderDash: [5, 5],
        tension: 0.4,
        fill: false,
        yAxisID: "y",
      },
      {
        label: "Kelembapan Ruangan (%)",
        data: [],
        borderColor: "#0ea5e9",
        backgroundColor: "rgba(14, 165, 233, 0.05)",
        borderWidth: 2,
        tension: 0.4,
        fill: false,
        yAxisID: "y1",
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { color: "rgba(148, 163, 184, 0.2)" },
        ticks: { color: "#94a3b8", font: { size: 11 } },
      },
      y: {
        type: "linear",
        display: true,
        position: "left",
        grid: { color: "rgba(148, 163, 184, 0.2)" },
        ticks: { color: "#f59e0b" },
        title: {
          display: true,
          text: "Suhu (°C)",
          color: "#f59e0b",
          font: { weight: "bold" },
        },
      },
      y1: {
        type: "linear",
        display: true,
        position: "right",
        grid: { drawOnChartArea: false },
        ticks: { color: "#0ea5e9" },
        title: {
          display: true,
          text: "Kelembapan (%)",
          color: "#0ea5e9",
          font: { weight: "bold" },
        },
      },
    },
    plugins: {
      legend: { labels: { color: "#94a3b8", font: { weight: "bold" } } },
    },
  },
});

// Koneksi MQTT
const brokerUrl = `ws://${MQTT_OPTIONS.host}:${MQTT_OPTIONS.port}${MQTT_OPTIONS.path}`;
const client = mqtt.connect(brokerUrl, MQTT_OPTIONS);

const connStatusElem = document.getElementById("conn-status");
const connTextElem = document.getElementById("conn-text");

client.on("connect", () => {
  connStatusElem.className =
    "flex items-center space-x-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-3.5 py-1.5 rounded-full text-xs font-semibold text-emerald-700 dark:text-emerald-400 shadow-sm transition-all duration-300";
  connTextElem.textContent = "Terhubung Live";

  client.subscribe(TOPIC_SENSOR, (err) => {
    if (!err) console.log("Berhasil subscribe topik:", TOPIC_SENSOR);
  });
});

client.on("error", (err) => {
  connStatusElem.className =
    "flex items-center space-x-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-3.5 py-1.5 rounded-full text-xs font-semibold text-rose-600 dark:text-rose-400 shadow-sm transition-all duration-300";
  connTextElem.textContent = "Koneksi Gagal";
});

client.on("offline", () => {
  connStatusElem.className =
    "flex items-center space-x-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-3.5 py-1.5 rounded-full text-xs font-semibold text-amber-700 dark:text-amber-400 shadow-sm transition-all duration-300";
  connTextElem.textContent = "Offline / Terputus";
});

function checkAirQuality(temp, humidity, timeNow) {
  const alertElem = document.getElementById("air-alert");
  const alertList = document.getElementById("alert-history-list");
  if (!alertElem) return;

  if (temp > 33) {
    alertElem.className =
      "p-3 mb-4 rounded-xl font-semibold text-sm transition-all duration-300 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 shadow-sm flex items-center space-x-2 animate-pulse";
    alertElem.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-base"></i> <span>Peringatan: Suhu Ruangan Panas (${temp}°C)! Periksa ventilasi atau pendingin.</span>`;

    if (alertList) {
      alertCount++;
      if (alertCount === 1) alertList.innerHTML = "";
      const item = document.createElement("div");
      item.className =
        "p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 flex justify-between items-center";
      item.innerHTML = `
        <span class="flex items-center gap-2 font-medium">
          <i class="fa-solid fa-triangle-exclamation text-rose-500"></i>
          Suhu Kritis Terdeteksi: <strong>${temp}°C</strong> (Kelembapan ${humidity}%)
        </span>
        <span class="font-mono text-[11px] opacity-80">${timeNow}</span>
      `;
      alertList.prepend(item);
    }
  } else if (temp < 20) {
    alertElem.className =
      "p-3 mb-4 rounded-xl font-semibold text-sm transition-all duration-300 bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-400 shadow-sm flex items-center space-x-2";
    alertElem.innerHTML = `<i class="fa-solid fa-snowflake text-base"></i> <span>Kondisi Dingin (${temp}°C): Suhu ruangan cukup rendah.</span>`;
  } else {
    alertElem.className =
      "p-3 mb-4 rounded-xl font-semibold text-sm transition-all duration-300 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-sm flex items-center space-x-2";
    alertElem.innerHTML = `<i class="fa-solid fa-circle-check text-base"></i> <span>Kualitas Udara Ideal: Suhu (${temp}°C) & Kelembapan (${humidity}%) dalam batas nyaman.</span>`;
  }
}

// Tangkap Pesan Masuk dari ESP32
client.on("message", (topic, payload) => {
  try {
    const messageStr = payload.toString();
    const data = JSON.parse(messageStr);

    const timeNow = new Date().toLocaleTimeString();
    totalDataCount++;
    document.getElementById("total-data-val").textContent = totalDataCount;

    let currentTemp = data.temperature;
    let currentHum = data.humidity;

    if (currentTemp !== undefined) {
      document.getElementById("temp-val").innerHTML =
        currentTemp +
        ' <span class="text-xl font-bold text-slate-500">°C</span>';
      updateChartData(timeNow, 0, parseFloat(currentTemp));
    }
    if (currentHum !== undefined) {
      document.getElementById("hum-val").innerHTML =
        currentHum + ' <span class="text-xl font-bold text-slate-500">%</span>';
      updateChartData(timeNow, 2, parseFloat(currentHum));
    }

    if (currentTemp !== undefined && currentHum !== undefined) {
      checkAirQuality(parseFloat(currentTemp), parseFloat(currentHum), timeNow);
    }

    // === SIMPAN KE ARRAY DATA DAN RENDER TABEL PAGINASI ===
    logDataHistory.unshift({
      time: timeNow,
      temp: currentTemp !== undefined ? currentTemp + " °C" : "-",
      hum: currentHum !== undefined ? currentHum + " %" : "-",
    });

    renderTablePage();
  } catch (e) {
    console.error("Format data MQTT bukan JSON valid:", e);
  }
});

// === FUNGSI UTAMA UNTUK MEMENTERJEMAHKAN SERTA MEMBAGI HALAMAN TABEL LOG ===
function renderTablePage() {
  const tableBody = document.getElementById("log-table-body");
  if (!tableBody) return;

  const totalItems = logDataHistory.length;
  const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;

  // Jaga agar halaman aktif tidak melebihi total halaman
  if (currentPage > totalPages) currentPage = totalPages;

  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalItems);
  const pageData = logDataHistory.slice(startIndex, endIndex);

  tableBody.innerHTML = "";

  if (pageData.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">Belum ada data riwayat tersimpan.</td></tr>`;
  } else {
    pageData.forEach((item) => {
      const row = document.createElement("tr");
      row.className =
        "hover:bg-slate-100 dark:hover:bg-slate-700/40 transition-colors";
      row.innerHTML = `
        <td class="p-3 font-mono text-slate-600 dark:text-slate-300">${item.time}</td>
        <td class="p-3 font-bold text-amber-500">${item.temp}</td>
        <td class="p-3 font-bold text-sky-500">${item.hum}</td>
        <td class="p-3"><span class="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">Live Normal</span></td>
      `;
      tableBody.appendChild(row);
    });
  }

  // Update Tampilan Angka Statistik Paginasi
  document.getElementById("page-start").textContent = totalItems === 0 ? 0 : startIndex + 1;
  document.getElementById("page-end").textContent = endIndex;
  document.getElementById("page-total-items").textContent = totalItems;
  document.getElementById("current-page").textContent = currentPage;
  document.getElementById("total-pages").textContent = totalPages;

  // Kontrol Status Aktif/Mati Tombol Next & Prev
  document.getElementById("btn-prev").disabled = currentPage === 1;
  document.getElementById("btn-next").disabled = currentPage === totalPages || totalItems === 0;
}

// Fungsi Pindah Halaman saat Tombol Klik Next / Prev
function changePage(direction) {
  currentPage += direction;
  renderTablePage();
}

function updateChartData(timeStr, datasetIndex, value) {
  if (!realtimeChart.data.labels.includes(timeStr)) {
    if (realtimeChart.data.labels.length > 15) {
      realtimeChart.data.labels.shift();
      realtimeChart.data.datasets.forEach((dataset) => dataset.data.shift());
    }
    realtimeChart.data.labels.push(timeStr);
  }

  realtimeChart.data.datasets[datasetIndex].data.push(value);

  const outdoorElem = document.getElementById("outdoor-temp");
  let outdoorVal = 30.0;
  if (outdoorElem && outdoorElem.textContent.includes("°C")) {
    outdoorVal = parseFloat(outdoorElem.textContent);
  }

  if (datasetIndex === 0) {
    realtimeChart.data.datasets[1].data.push(outdoorVal);
  }

  realtimeChart.data.datasets.forEach((ds) => {
    while (ds.data.length < realtimeChart.data.labels.length) {
      const prev = ds.data.slice(-1)[0] || 0;
      ds.data.unshift(prev);
    }
  });

  realtimeChart.update("none");
}

function switchTab(tabName) {
  const views = ["dashboard", "logs", "alerts", "device"];

  views.forEach((v) => {
    const viewElem = document.getElementById(`view-${v}`);
    const navElem = document.getElementById(`nav-${v}`);

    if (viewElem && navElem) {
      if (v === tabName) {
        viewElem.classList.remove("hidden");
        navElem.className =
          "w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold text-sm shadow-sm shadow-emerald-500/20 transition-all text-left";
      } else {
        viewElem.classList.add("hidden");
        navElem.className =
          "w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white font-medium text-sm transition-all text-left";
      }
    }
  });
}

// === VAR PENGATURAN PAGINASI PUSAT PERINGATAN ===
let alertDataHistory = []; // Array penampung seluruh data peringatan
let currentAlertPage = 1;
const alertsPerPage = 5;    // Maksimal 5 kartu peringatan per halaman

// Fungsi untuk mengecek kondisi suhu & mencatat peringatan
function checkAirQuality(temp, humidity, timeNow) {
  const alertElem = document.getElementById("air-alert");
  if (!alertElem) return;

  if (temp > 33) {
    alertElem.className =
      "p-3 mb-4 rounded-xl font-semibold text-sm transition-all duration-300 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 shadow-sm flex items-center space-x-2 animate-pulse";
    alertElem.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-base"></i> <span>Peringatan: Suhu Ruangan Panas (${temp}°C)! Periksa ventilasi atau pendingin.</span>`;

    // Masukkan data peringatan baru ke array paling depan
    alertDataHistory.unshift({
      type: "danger",
      message: `Suhu Kritis Terdeteksi: <strong>${temp}°C</strong> (Kelembapan ${humidity}%)`,
      time: timeNow,
      badgeClass: "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300",
      iconClass: "fa-solid fa-triangle-exclamation text-rose-500"
    });

    renderAlertPage();
  } else if (temp < 20) {
    alertElem.className =
      "p-3 mb-4 rounded-xl font-semibold text-sm transition-all duration-300 bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-400 shadow-sm flex items-center space-x-2";
    alertElem.innerHTML = `<i class="fa-solid fa-snowflake text-base"></i> <span>Kondisi Dingin (${temp}°C): Suhu ruangan cukup rendah.</span>`;
  } else {
    alertElem.className =
      "p-3 mb-4 rounded-xl font-semibold text-sm transition-all duration-300 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-sm flex items-center space-x-2";
    alertElem.innerHTML = `<i class="fa-solid fa-circle-check text-base"></i> <span>Kualitas Udara Ideal: Suhu (${temp}°C) & Kelembapan (${humidity}%) dalam batas nyaman.</span>`;
  }
}

// === FUNGSI RENDER HALAMAN PUSAT PERINGATAN (PAGINATION) ===
function renderAlertPage() {
  const alertList = document.getElementById("alert-history-list");
  const paginationUI = document.getElementById("alert-pagination");
  if (!alertList) return;

  const totalItems = alertDataHistory.length;
  const totalPages = Math.ceil(totalItems / alertsPerPage) || 1;

  if (currentAlertPage > totalPages) currentAlertPage = totalPages;

  const startIndex = (currentAlertPage - 1) * alertsPerPage;
  const endIndex = Math.min(startIndex + alertsPerPage, totalItems);
  const pageData = alertDataHistory.slice(startIndex, endIndex);

  alertList.innerHTML = "";

  if (totalItems === 0) {
    alertList.innerHTML = `
      <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 text-center">
        Belum ada peringatan kritis yang tercatat sesi ini.
      </div>`;
    if (paginationUI) paginationUI.classList.add("hidden");
  } else {
    if (paginationUI) paginationUI.classList.remove("hidden");

    pageData.forEach((item) => {
      const card = document.createElement("div");
      card.className = `p-3.5 rounded-xl border text-xs flex justify-between items-center ${item.badgeClass}`;
      card.innerHTML = `
        <span class="flex items-center gap-2 font-medium">
          <i class="${item.iconClass}"></i>
          ${item.message}
        </span>
        <span class="font-mono text-[11px] opacity-80">${item.time}</span>
      `;
      alertList.appendChild(card);
    });

    // Perbarui teks info paginasi
    document.getElementById("alert-page-start").textContent = startIndex + 1;
    document.getElementById("alert-page-end").textContent = endIndex;
    document.getElementById("alert-total-items").textContent = totalItems;
    document.getElementById("alert-current-page").textContent = currentAlertPage;
    document.getElementById("alert-total-pages").textContent = totalPages;

    // Status tombol pagination
    document.getElementById("btn-alert-prev").disabled = currentAlertPage === 1;
    document.getElementById("btn-alert-next").disabled = currentAlertPage === totalPages;
  }
}

// Fungsi Navigasi Pindah Halaman Peringatan
function changeAlertPage(direction) {
  currentAlertPage += direction;
  renderAlertPage();
}