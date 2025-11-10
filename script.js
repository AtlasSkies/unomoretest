let charts = []; // [{ chart, canvas, color, stats[5], multi, axis[5] }]
let activeChart = 0;
let radar2, radar2Ready = false;

const FILL_ALPHA = 0.65; // uniform fill opacity for all layers

/* ========== Helpers ========== */
function hexToRGBA(hex, alpha) {
  if (!hex) hex = "#92dfec";
  if (hex.startsWith("rgb")) return hex.replace(")", `, ${alpha})`).replace("rgb", "rgba");
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Conic gradient: each axis color at the wedge corner; smooth blend mid-wedge
function makeConicGradient(chart, axisColors, alpha = FILL_ALPHA) {
  const r = chart.scales.r;
  const ctx = chart.ctx;
  const grad = ctx.createConicGradient(-Math.PI / 2, r.xCenter, r.yCenter);
  const N = axisColors.length;
  for (let i = 0; i <= N; i++) grad.addColorStop(i / N, hexToRGBA(axisColors[i % N], alpha));
  return grad;
}

/* ========== Plugins: axis titles + numeric () labels ========== */
// Titles with outlined style; in popup, Speed/Defense get extended radius & slight vertical tweak
const outlinedLabelsPlugin = {
  id: 'outlinedLabels',
  afterDraw(chart) {
    const ctx = chart.ctx;
    const r = chart.scales.r;
    const labels = chart.data.labels;
    if (!labels) return;

    const cx = r.xCenter, cy = r.yCenter;
    const isOverlay = chart.canvas.id === 'radarChart2';
    const baseRadius = r.drawingArea * 1.1;
    const extendedRadius = r.drawingArea * 1.15;
    const base = -Math.PI / 2;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic 18px Candara';
    // Outline + fill (like original)
    ctx.strokeStyle = '#8747e6';
    ctx.fillStyle = 'white';
    ctx.lineWidth = 4;

    labels.forEach((label, i) => {
      let angle = base + (i * 2 * Math.PI / labels.length);
      let radiusToUse = baseRadius;
      // In popup only, lift Speed (1) and Defense (4) slightly outward:
      if (isOverlay && (i === 1 || i === 4)) radiusToUse = extendedRadius;

      const x = cx + radiusToUse * Math.cos(angle);
      let y = cy + radiusToUse * Math.sin(angle);

      // Small vertical tweaks like original:
      if (i === 0) y -= 5; // Power
      if (isOverlay && (i === 1 || i === 4)) y -= 42; // Speed/Defense slightly lowered (visual up)

      ctx.strokeText(label, x, y);
      ctx.fillText(label, x, y);
    });
    ctx.restore();
  }
};

// Numeric value "(v)" near each title; same popup tweaks for Speed/Defense
const inputValuePlugin = {
  id: 'inputValuePlugin',
  afterDraw(chart) {
    // Skip if custom background (your style) is active on that chart; here we always draw
    const ctx = chart.ctx;
    const r = chart.scales.r;
    const ds = chart.data.datasets?.[0];
    const data = ds?.data || [];
    const labels = chart.data.labels;
    if (!labels) return;

    const cx = r.xCenter, cy = r.yCenter;
    const baseRadius = r.drawingArea * 1.1;
    const base = -Math.PI / 2;
    const offset = 20;
    const isOverlay = chart.canvas.id === 'radarChart2';

    ctx.save();
    ctx.font = '15px Candara';
    ctx.fillStyle = 'black';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    labels.forEach((label, i) => {
      const angle = base + (i * 2 * Math.PI / labels.length);
      let radiusToUse = baseRadius;
      if (isOverlay && (i === 1 || i === 4)) radiusToUse = r.drawingArea * 1.15;

      const x = cx + (radiusToUse + offset) * Math.cos(angle);
      let y = cy + (radiusToUse + offset) * Math.sin(angle);

      if (i === 0) y -= 20; // Power
      if (isOverlay) {
        if (i === 1 || i === 4) y -= 22; // Speed/Defense
      }

      // Clamp display to at most 2 decimals like before
      const val = typeof data[i] === 'number' ? data[i] : 0;
      const txt = `(${Math.round(val * 100) / 100})`;
      ctx.fillText(txt, x, y);
    });

    ctx.restore();
  }
};

/* ========== Radar factory ========== */
function makeRadar(ctx, color, data) {
  return new Chart(ctx, {
    type: "radar",
    data: {
      labels: ["Power", "Speed", "Trick", "Recovery", "Defense"],
      datasets: [{
        data,
        backgroundColor: hexToRGBA(color, FILL_ALPHA),
        borderColor: color,
        borderWidth: 2,
        pointBackgroundColor: "#fff",
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      layout: { padding: { top: 25, bottom: 25, left: 10, right: 10 } },
      scales: {
        r: {
          grid: { display: false },
          angleLines: { color: "#6db5c0", lineWidth: 1 },
          min: 0,
          max: 10, // base out of 10; we’ll bump globally if needed
          ticks: { display: false },
          pointLabels: { color: "transparent" }
        }
      },
      plugins: { legend: { display: false } }
    },
    plugins: [outlinedLabelsPlugin, inputValuePlugin]
  });
}

/* ========== DOM refs ========== */
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

/* ========== Global scale (shared) ========== */
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

/* ========== Init ========== */
window.addEventListener("load", () => {
  const ctx = document.getElementById("radarChart1").getContext("2d");
  const base = makeRadar(ctx, "#92dfec", [0, 0, 0, 0, 0]);

  charts.push({
    chart: base,
    canvas: ctx.canvas,
    color: "#92dfec",
    stats: [0, 0, 0, 0, 0],
    multi: false,
    axis: axisColorPickers.map(p => p.value) // initialize axis colors
  });

  updateInputs();
  applyGlobalScale();
});

/* ========== Input sync ========== */
function updateInputs(index = activeChart) {
  const c = charts[index];
  [powerInput, speedInput, trickInput, recoveryInput, defenseInput].forEach((input, i) => (input.value = c.stats[i]));
  colorPicker.value = c.color;
  multiColorBtn.textContent = c.multi ? "Single-color" : "Multi-color";
  axisColorsDiv.style.display = c.multi ? "flex" : "none";
  axisColorPickers.forEach((p, i) => (p.value = c.axis[i]));
}

/* ========== Add / Select charts ========== */
function addChart() {
  const newCanvas = document.createElement("canvas");
  newCanvas.classList.add("stacked-chart");
  newCanvas.style.position = 'absolute';
  newCanvas.style.top = '0';
  newCanvas.style.left = '0';
  newCanvas.style.opacity = '1'; // explicit: never dim
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

  chartButtons.querySelectorAll("button").forEach((b, i) => {
    b.style.backgroundColor = i === index ? "#6db5c0" : "#92dfec";
    b.style.color = i === index ? "white" : "black";
  });

  charts.forEach((c, i) => {
    c.canvas.style.zIndex = i === index ? "2" : "1";
    c.chart.canvas.style.opacity = "1"; // never dim
  });

  updateInputs(index);
}

/* ========== Update + Redraw ========== */
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

  applyGlobalScale();

  charts.forEach(obj => {
    const fill = obj.multi
      ? makeConicGradient(obj.chart, obj.axis, FILL_ALPHA)
      : hexToRGBA(obj.color, FILL_ALPHA);
    obj.chart.data.datasets[0].data = obj.stats;
    obj.chart.data.datasets[0].borderColor = obj.color;
    obj.chart.data.datasets[0].backgroundColor = fill;
    obj.chart.update();
  });
}

/* ========== Listeners ========== */
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

/* ========== Popup (overlap all charts; oldest bottom, newest top) ========== */
viewBtn.addEventListener("click", () => {
  overlay.classList.remove("hidden");
  overlayImg.src = uploadedImg.src;
  overlayName.textContent = nameInput.value || "-";
  overlayAbility.textContent = abilityInput.value || "-";
  overlayLevel.textContent = levelInput.value || "-";

  setTimeout(() => {
    const ctx2 = document.getElementById("radarChart2").getContext("2d");
    const globalMax = getGlobalMax();

    // IMPORTANT: Keep dataset order the same as charts[] (oldest first, newest last → newest drawn last = top)
    const datasets = charts.map(obj => ({
      data: obj.stats.slice(),
      backgroundColor: hexToRGBA(obj.color, FILL_ALPHA), // temporary; gradient after layout
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
          plugins: {
            legend: { display: false }
          }
        },
        plugins: [outlinedLabelsPlugin, inputValuePlugin] // draw titles + numbers in popup too
      });
      radar2Ready = true;
    } else {
      radar2.options.scales.r.min = 0;
      radar2.options.scales.r.max = globalMax < 10 ? 10 : globalMax;
      radar2.data.labels = ["Power", "Speed", "Trick", "Recovery", "Defense"];
      radar2.data.datasets = datasets;
      radar2.update();
    }

    // After layout (center computed), apply conic gradients for multi-color datasets
    requestAnimationFrame(() => {
      radar2.data.datasets.forEach((ds, i) => {
        const src = charts[i]; // same order; newest at end
        ds.backgroundColor = src.multi
          ? makeConicGradient(radar2, src.axis, FILL_ALPHA)
          : hexToRGBA(src.color, FILL_ALPHA);
      });
      radar2.update();
    });
  }, 120);
});

closeBtn.addEventListener("click", () => overlay.classList.add("hidden"));

/* Image + Download */
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
