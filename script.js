let charts = [];
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

function makeConicGradient(chart, axisColors, alpha = 0.6) {
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
          max: 10 // base scale out of 10
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

/* ========== DOM REFERENCES ========== */
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

/* ========== GLOBAL SCALE HANDLING ========== */
function getGlobalMax() {
  let maxVal = 10;
  charts.forEach(c => {
    const localMax = Math.max(...c.stats);
    if (localMax > maxVal) maxVal = localMax;
  });
  return Math.ceil(maxVal);
}

function updateGlobalScale() {
  const newMax = getGlobalMax();
  const appliedMax = newMax < 10 ? 10 : newMax;
  charts.forEach(c => {
    c.chart.options.scales.r.min = 0;
    c.chart.options.scales.r.max = appliedMax;
    c.chart.update();
  });
  if (radar2Ready && radar2) {
    radar2.options.scales.r.max = appliedMax;
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
  updateGlobalScale();
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

  updateGlobalScale();
  selectChart(i);
}

function selectChart(index) {
  activeChart = index;

  // Highlight active button
  chartButtons.querySelectorAll("button").forEach((b, i) => {
    b.style.backgroundColor = i === index ? "#6db5c0" : "#92dfec";
    b.style.color = i === index ? "white" : "black";
  });

  // Keep all charts fully visible
  charts.forEach((c, i) => {
    c.canvas.style.zIndex = i === index ? "2" : "1";
    c.chart.canvas.style.opacity = "1"; // no dimming
  });

  updateInputs(index);
}

/* ========== UPDATE CHARTS + SCALE ========== */
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

  updateGlobalScale();

  charts.forEach(obj => {
    const fill = obj.multi
      ? makeConicGradient(obj.chart, obj.axis, 0.45)
      : hexToRGBA(obj.color, 0.4);
    obj.chart.data.datasets[0].data = obj.stats;
    obj.chart.data.datasets[0].borderColor = obj.color;
    obj.chart.data.datasets[0].backgroundColor = fill;
    obj.chart.update();
  });
}

/* ========== EVENT LISTENERS ========== */
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

/* ========== POPUP ========== */
viewBtn.addEventListener("click", () => {
  const c = charts[activeChart];
  overlay.classList.remove("hidden");
  overlayImg.src = uploadedImg.src;
  overlayName.textContent = nameInput.value || "-";
  overlayAbility.textContent = abilityInput.value || "-";
  overlayLevel.textContent = levelInput.value || "-";

  setTimeout(() => {
    const ctx2 = document.getElementById("radarChart2").getContext("2d");
    if (!radar2Ready) {
      radar2 = makeRadar(ctx2, c.color, c.stats);
      radar2Ready = true;
    }
    const fill = c.multi ? makeConicGradient(radar2, c.axis, 0.45) : hexToRGBA(c.color, 0.4);
    const sharedMax = getGlobalMax();

    radar2.options.scales.r.min = 0;
    radar2.options.scales.r.max = sharedMax < 10 ? 10 : sharedMax;
    radar2.data.datasets[0].data = c.stats;
    radar2.data.datasets[0].borderColor = c.color;
    radar2.data.datasets[0].backgroundColor = fill;
    radar2.update();
  }, 150);
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
