let charts = []; // All radar charts
let activeChart = 0; // Index of currently selected chart
let multiColorMode = false;
let radar2, radar2Ready = false;
let chartColor = "#92dfec";

function hexToRGBA(hex, alpha) {
  if (!hex) hex = "#92dfec";
  if (hex.startsWith("rgb")) return hex.replace(")", `, ${alpha})`).replace("rgb", "rgba");
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function makeConicGradient(chart, axisColors, alpha = 0.65) {
  const r = chart.scales.r;
  const ctx = chart.ctx;
  const cx = r.xCenter, cy = r.yCenter;
  const N = chart.data.labels.length;
  const grad = ctx.createConicGradient(-Math.PI / 2, cx, cy);
  for (let i = 0; i <= N; i++) grad.addColorStop(i / N, hexToRGBA(axisColors[i % N], alpha));
  return grad;
}

function computeFill(chart, abilityHex, axisPickers) {
  if (!multiColorMode) return hexToRGBA(abilityHex, 0.45);
  const cols = axisPickers.map(p => p.value || abilityHex);
  return makeConicGradient(chart, cols, 0.45);
}

function makeRadar(ctx, color, data = [0, 0, 0, 0, 0]) {
  return new Chart(ctx, {
    type: "radar",
    data: {
      labels: ["Power", "Speed", "Trick", "Recovery", "Defense"],
      datasets: [{
        data,
        backgroundColor: hexToRGBA(color, 0.35),
        borderColor: color,
        borderWidth: 2,
        pointBackgroundColor: "#fff",
        pointBorderColor: color,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          grid: { display: false },
          angleLines: { color: "#6db5c0", lineWidth: 1 },
          suggestedMin: 0,
          suggestedMax: 10,
          ticks: { display: false },
          pointLabels: { color: "transparent" }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

/* === DOM ELEMENTS === */
const chartArea = document.getElementById("chartArea");
const addChartBtn = document.getElementById("addChartBtn");
const chartButtonsDiv = document.getElementById("chartButtons");
const multiColorBtn = document.getElementById("multiColorBtn");
const axisColorsDiv = document.getElementById("axisColors");
const colorPicker = document.getElementById("colorPicker");
const powerInput = document.getElementById("powerInput");
const speedInput = document.getElementById("speedInput");
const trickInput = document.getElementById("trickInput");
const recoveryInput = document.getElementById("recoveryInput");
const defenseInput = document.getElementById("defenseInput");
const axisColorPickers = [
  document.getElementById("powerColor"),
  document.getElementById("speedColor"),
  document.getElementById("trickColor"),
  document.getElementById("recoveryColor"),
  document.getElementById("defenseColor")
];
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

window.addEventListener("load", () => {
  const ctx = document.getElementById("radarChart1").getContext("2d");
  const baseChart = makeRadar(ctx, chartColor);
  charts.push(baseChart);
  updateCharts();
});

function addChart() {
  const newCanvas = document.createElement("canvas");
  newCanvas.classList.add("stacked-chart");
  chartArea.appendChild(newCanvas);
  const ctx = newCanvas.getContext("2d");
  const hue = Math.floor(Math.random() * 360);
  const randColor = `hsl(${hue}, 70%, 55%)`;
  const newChart = makeRadar(ctx, randColor);
  charts.push(newChart);
  const index = charts.length - 1;

  const btn = document.createElement("button");
  btn.textContent = `Select Chart ${index + 1}`;
  btn.addEventListener("click", () => selectChart(index));
  chartButtonsDiv.appendChild(btn);

  selectChart(index);
}

function selectChart(index) {
  activeChart = index;
  document.querySelectorAll("#chartButtons button").forEach((b, i) => {
    b.style.backgroundColor = i === index ? "#6db5c0" : "#92dfec";
    b.style.color = i === index ? "white" : "black";
  });
  updateCharts();
}

function updateCharts() {
  if (!charts.length) return;
  const vals = [
    +powerInput.value || 0,
    +speedInput.value || 0,
    +trickInput.value || 0,
    +recoveryInput.value || 0,
    +defenseInput.value || 0
  ];
  chartColor = colorPicker.value;
  charts.forEach((c, i) => {
    const fill = computeFill(c, chartColor, axisColorPickers);
    c.data.datasets[0].data = vals;
    c.data.datasets[0].backgroundColor = fill;
    c.data.datasets[0].borderColor = i === activeChart ? chartColor : hexToRGBA(chartColor, 0.25);
    c.update();
  });
}

addChartBtn.addEventListener("click", addChart);
[multiColorBtn, colorPicker, powerInput, speedInput, trickInput, recoveryInput, defenseInput]
  .forEach(el => el.addEventListener("input", updateCharts));

multiColorBtn.addEventListener("click", () => {
  multiColorMode = !multiColorMode;
  axisColorsDiv.style.display = multiColorMode ? "flex" : "none";
  multiColorBtn.textContent = multiColorMode ? "Single-color" : "Multi-color";
  updateCharts();
});

axisColorPickers.forEach(p => p.addEventListener("input", updateCharts));

viewBtn.addEventListener("click", () => {
  overlay.classList.remove("hidden");
  overlayImg.src = uploadedImg.src;
  overlayName.textContent = nameInput.value || "-";
  overlayAbility.textContent = abilityInput.value || "-";
  overlayLevel.textContent = levelInput.value || "-";
  setTimeout(() => {
    const ctx2 = document.getElementById("radarChart2").getContext("2d");
    if (!radar2Ready) {
      radar2 = makeRadar(ctx2, chartColor);
      radar2Ready = true;
    }
    radar2.data.datasets[0].data = charts[activeChart].data.datasets[0].data;
    radar2.update();
  }, 200);
});

closeBtn.addEventListener("click", () => overlay.classList.add("hidden"));
imgInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => (uploadedImg.src = ev.target.result);
  reader.readAsDataURL(file);
});

downloadBtn.addEventListener("click", () => {
  downloadBtn.style.visibility = "hidden";
  closeBtn.style.visibility = "hidden";
  const box = document.getElementById("characterBox");
  html2canvas(box, { scale: 2 }).then(canvas => {
    const link = document.createElement("a");
    link.download = `${nameInput.value || "Unnamed"}_CharacterChart.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    downloadBtn.style.visibility = "visible";
    closeBtn.style.visibility = "visible";
  });
});
