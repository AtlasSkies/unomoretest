let charts = []; // [{chart, canvas, color, stats[5], multi, axis[5]}]
let activeChart = 0;
let radar2, radar2Ready = false;

/* ========== UTILITIES ========== */
function hexToRGBA(hex, alpha) {
  if (!hex) hex = "#92dfec";
  if (hex.startsWith("rgb")) return hex.replace(")", `, ${alpha})`).replace("rgb", "rgba");
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function makeConicGradient(chart, axisColors, alpha = 0.45) {
  const r = chart.scales.r;
  const ctx = chart.ctx;
  const grad = ctx.createConicGradient(-Math.PI / 2, r.xCenter, r.yCenter);
  const N = axisColors.length;
  for (let i = 0; i <= N; i++) grad.addColorStop(i / N, hexToRGBA(axisColors[i % N], alpha));
  return grad;
}

/* ========== RADAR FACTORY ========== */
function makeRadar(ctx, color, data) {
  return new Chart(ctx, {
    type: "radar",
    data: {
      labels: ["Power", "Speed", "Trick", "Recovery", "Defense"],
      datasets: [{
        data,
        backgroundColor: hexToRGBA(color, 0.45),
        borderColor: color,
        borderWidth: 2,
        pointBackgroundColor: "#fff",
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          grid: { display: false },
          angleLines: { color: "#6db5c0" },
          ticks: { display: false },
          pointLabels: { color: "transparent" },
          min: 0,
          max: 10 // base scale out of 10 (never below)
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

/* ========== DOM REFS ========== */
const chartArea = document.getElementById("chartArea");
const addChartBtn = document.getElementById("addChartBtn");
const chartButtons = document.getElementById("chartButtons");
const powerInput = document.getElementById("powerInput");
const speedInput = document.getElementById("speedInput");
const trickInput = document.getElementById("trickInput");
const recoveryInput = document.getElementById("recoveryInput");
const defenseInput = document.getElementById("defenseInput");
const colorPicker = document.getElementById("colorPicker");
const axisColorsDiv = document.getElementById("axisColors");
const axisColorPickers = [
  document.getElementById("powerColor"),
  document.getElementById("speedColor"),
  document.getElementById("trickColor"),
  document.getElementById("recoveryColor"),
  document.getElementById("defenseColor")
];
const multiColorBtn = document.getElementById("multiColorBtn");
const viewBtn = document.getElementById("viewBtn");
const overlay = document.getElementById("overlay");
const overlayImg = document.getElementById("overlayImg");
const overlayName = document.getElementById("overlayName");
const overlayAbility = document.getElementById("overlayAbility");
const overlayLevel = document.getElementById("overlayLevel");
const closeBtn = document.getElementById("closeBtn");
const downloadBtn = document.getElementById("downloadBtn");
const imgInput = document.getElementById("imgInput");
const uploadedImg = document.getElementById("uploadedImg");
const nameInput = document.getElementById("nameInput");
const abilityInput = document.getElementById("abilityInput");
const levelInput = document.getElementById("levelInput");

/* ========== GLOBAL SCALE (shared across all charts) ========== */
function getGlobalMax() {
  let maxVal = 10;
  charts.forEach(c => {
    const localMax = Math.max(...c.stats);
    if (localMax > maxVal) maxVal = localMax;
  });
  return Math.ceil(maxVal);
}

function applyGlobalScale() {
  const max = getGlobalMax();
  const applied = max < 10 ? 10 : max;
  charts.forEach(c => {
    c.chart.options.scales.r.min = 0;
    c.chart.options.scales.r.max = applied;
    c.chart.update();
  });
  if (radar2Ready && radar2) {
    radar2.options.scales.r.min = 0;
    radar2.options.scales.r.max = applied;
    radar2.update();
  }
}

/* ========== INIT ========== */
window.addEventListener("load", () => {
  const ctx = document.getElementById("radarChart1").getContext("2d");
  const base = makeRadar(ctx, "#92dfec", [0, 0, 0, 0, 0]);
  charts.push({
    chart: base,
    canvas: ctx.canvas,
    color: "#92dfec",
    stats: [0, 0, 0, 0, 0],
    multi: false,
    axis: axisColorPickers.map(p => p.value)
  });
  updateInputs();
  applyGlobalScale();
});

/* ========== INPUT SYNC ========== */
function updateInputs(index = activeChart) {
  const c = charts[index];
  [powerInput, speedInput, trickInput, recoveryInput, defenseInput].forEach((input, i) => (input.value = c.stats[i]));
  colorPicker.value = c.color;
  multiColorBtn.textContent = c.multi ? "Single-color" : "Multi-color";
  axisColorsDiv.style.display = c.multi ? "flex" : "none";
  axisColorPickers.forEach((p, i) => (p.value = c.axis[i]));
}

/* ========== ADD / SELECT CHARTS ========== */
function addChart() {
  const newCanvas = document.createElement("canvas");
  newCanvas.classList.add("stacked-chart");
  chartArea.appendChild(newCanvas);

  const ctx = newCanvas.getContext("2d");
  const hue = Math.floor(Math.random() * 360);
  const clr = `hsl(${hue}, 70%, 55%)`;
  const c = makeRadar(ctx, clr, [0, 0, 0, 0, 0]);

  charts.push({
    chart: c,
    canvas: newCanvas,
    color: clr,
    stats: [0, 0, 0, 0, 0],
    multi: false,
    axis: axisColorPickers.map(p => p.value)
  });

  const i = charts.length - 1;
  const btn = document.createElement("button");
  btn.textContent = `Select Chart ${i + 1}`;
  btn.addEventListener("click", () => selectChart(i));
  chartButtons.appendChild(btn);

  applyGlobalScale();
  selectChart(i);
}

function selectChart(index) {
  activeChart = index;

  // Highlight active button
  chartButtons.querySelectorAll("button").forEach((b, i) => {
    b.style.backgroundColor = i === index ? "#6db5c0" : "#92dfec";
    b.style.color = i === index ? "white" : "black";
  });

  // Bring active canvas to front; keep ALL fully opaque
  charts.forEach((c, i) => {
    c.canvas.style.zIndex = i === index ? "2" : "1";
    c.chart.canvas.style.opacity = "1"; // no dimming anywhere
  });

  updateInputs(index);
}

/* ========== UPDATE ACTIVE + REDRAW ALL ========== */
function refreshActive() {
  const c = charts[activeChart];
  c.stats = [
    +powerInput.value || 0,
    +speedInput.value || 0,
    +trickInput.value || 0,
    +recoveryInput.value || 0,
    +defenseInput.value || 0
  ];
  c.color = colorPicker.value;
  c.axis = axisColorPickers.map(p => p.value);

  applyGlobalScale(); // keeps shared out-of-10 base and expands if needed

  charts.forEach(obj => {
    const fill = obj.multi
      ? makeConicGradient(obj.chart, obj.axis, 0.45)
      : hexToRGBA(obj.color, 0.45);
    obj.chart.data.datasets[0].data = obj.stats;
    obj.chart.data.datasets[0].borderColor = obj.color;
    obj.chart.data.datasets[0].backgroundColor = fill;
    obj.chart.update();
  });
}

/* ========== EVENTS ========== */
addChartBtn.addEventListener("click", addChart);
[multiColorBtn, colorPicker, powerInput, speedInput, trickInput, recoveryInput, defenseInput]
  .forEach(el => el.addEventListener("input", refreshActive));
axisColorPickers.forEach(p => p.addEventListener("input", refreshActive));

multiColorBtn.addEventListener("click", () => {
  const c = charts[activeChart];
  c.multi = !c.multi;
  multiColorBtn.textContent = c.multi ? "Single-color" : "Multi-color";
  axisColorsDiv.style.display = c.multi ? "flex" : "none";
  refreshActive();
});

/* ========== POPUP (SHOW ALL CHARTS OVERLAPPED) ========== */
viewBtn.addEventListener("click", () => {
  overlay.classList.remove("hidden");
  overlayImg.src = uploadedImg.src;
  overlayName.textContent = nameInput.value || "-";
  overlayAbility.textContent = abilityInput.value || "-";
  overlayLevel.textContent = levelInput.value || "-";

  setTimeout(() => {
    const ctx2 = document.getElementById("radarChart2").getContext("2d");
    const globalMax = getGlobalMax();
    const datasets = charts.map((obj, idx) => ({
      data: obj.stats.slice(),
      // provisional fill (we’ll convert to gradient after first render)
      backgroundColor: obj.multi ? hexToRGBA(obj.color, 0.35) : hexToRGBA(obj.color, 0.35),
      borderColor: obj.color,
      borderWidth: 2,
      pointRadius: 0
    }));

    if (!radar2Ready) {
      radar2 = new Chart(ctx2, {
        type: "radar",
        data: {
          labels: ["Power", "Speed", "Trick", "Recovery", "Defense"],
          datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          scales: {
            r: {
              grid: { display: false },
              angleLines: { color: "#6db5c0" },
              ticks: { display: false },
              pointLabels: { color: "transparent" },
              min: 0,
              max: globalMax < 10 ? 10 : globalMax
            }
          },
          plugins: { legend: { display: false } }
        }
      });
      radar2Ready = true;
    } else {
      radar2.options.scales.r.min = 0;
      radar2.options.scales.r.max = globalMax < 10 ? 10 : globalMax;
      radar2.data.labels = ["Power", "Speed", "Trick", "Recovery", "Defense"];
      radar2.data.datasets = datasets;
      radar2.update();
    }

    // After the popup chart has computed its center, convert fills for multi-color datasets
    requestAnimationFrame(() => {
      radar2.data.datasets.forEach((ds, i) => {
        const src = charts[i];
        if (src.multi) {
          ds.backgroundColor = makeConicGradient(radar2, src.axis, 0.35);
        } else {
          ds.backgroundColor = hexToRGBA(src.color, 0.35);
        }
      });
      radar2.update();
    });
  }, 100);
});

closeBtn.addEventListener("click", () => overlay.classList.add("hidden"));

imgInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = ev => (uploadedImg.src = ev.target.result);
  r.readAsDataURL(file);
});

downloadBtn.addEventListener("click", () => {
  downloadBtn.style.visibility = "hidden";
  closeBtn.style.visibility = "hidden";
  html2canvas(document.getElementById("characterBox"), { scale: 2 }).then(canvas => {
    const a = document.createElement("a");
    a.download = `${nameInput.value || "Unnamed"}_CharacterChart.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
    downloadBtn.style.visibility = "visible";
    closeBtn.style.visibility = "visible";
  });
});
