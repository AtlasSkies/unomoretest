/* =======================
   STATE
======================= */
let chartList = []; // holds all radar charts stacked together
let radar2, radar2Ready = false;
let chartColor = '#92dfec';
let multiColorMode = false;
let lastAbilityColor = chartColor;

/* =======================
   HELPERS
======================= */
function hexToRGBA(hex, alpha) {
  if (!hex) hex = '#92dfec';
  if (hex.startsWith('rgb')) return hex.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
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
  for (let i = 0; i <= N; i++) {
    grad.addColorStop(i / N, hexToRGBA(axisColors[i % N], alpha));
  }
  return grad;
}

function computeFill(chart, abilityHex, axisPickers) {
  if (!multiColorMode) return hexToRGBA(abilityHex, 0.45);
  const cols = axisPickers.map(p => p.value || abilityHex);
  return makeConicGradient(chart, cols, 0.45);
}

/* =======================
   CHART CREATOR
======================= */
function makeRadar(ctx, color, data, withBackground = false) {
  return new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Power', 'Speed', 'Trick', 'Recovery', 'Defense'],
      datasets: [{
        data: data || [0, 0, 0, 0, 0],
        backgroundColor: hexToRGBA(color, 0.3),
        borderColor: color,
        borderWidth: 2,
        pointBackgroundColor: '#fff',
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
          angleLines: { color: '#6db5c0', lineWidth: 1 },
          suggestedMin: 0,
          suggestedMax: 10,
          ticks: { display: false },
          pointLabels: { color: 'transparent' }
        }
      },
      layout: { padding: { top: 25, bottom: 25, left: 10, right: 10 } },
      plugins: { legend: { display: false } }
    }
  });
}

/* =======================
   DOM ELEMENTS
======================= */
const addChartBtn = document.getElementById('addChartBtn');
const chartArea = document.getElementById('chartArea');
const colorPicker = document.getElementById('colorPicker');
const powerInput = document.getElementById('powerInput');
const speedInput = document.getElementById('speedInput');
const trickInput = document.getElementById('trickInput');
const recoveryInput = document.getElementById('recoveryInput');
const defenseInput = document.getElementById('defenseInput');
const axisColorPickers = [
  document.getElementById('powerColor'),
  document.getElementById('speedColor'),
  document.getElementById('trickColor'),
  document.getElementById('recoveryColor'),
  document.getElementById('defenseColor')
];

/* =======================
   INIT
======================= */
window.addEventListener('load', () => {
  const ctx1 = document.getElementById('radarChart1').getContext('2d');
  const baseChart = makeRadar(ctx1, chartColor, [0, 0, 0, 0, 0]);
  chartList.push(baseChart);
  updateCharts();
});

/* =======================
   STACK NEW CHART
======================= */
addChartBtn.addEventListener('click', () => {
  const newCanvas = document.createElement('canvas');
  newCanvas.classList.add('stacked-chart');
  chartArea.appendChild(newCanvas);
  const ctx = newCanvas.getContext('2d');

  const randomHue = Math.floor(Math.random() * 360);
  const randomColor = `hsl(${randomHue}, 70%, 55%)`;

  const data = [
    +powerInput.value || 0,
    +speedInput.value || 0,
    +trickInput.value || 0,
    +recoveryInput.value || 0,
    +defenseInput.value || 0
  ];

  const newChart = makeRadar(ctx, randomColor, data);
  chartList.push(newChart);
  updateCharts();
});

/* =======================
   UPDATE ALL CHARTS
======================= */
function updateCharts() {
  const vals = [
    +powerInput.value || 0,
    +speedInput.value || 0,
    +trickInput.value || 0,
    +recoveryInput.value || 0,
    +defenseInput.value || 0
  ];
  chartColor = colorPicker.value;

  chartList.forEach(c => {
    const fill = computeFill(c, chartColor, axisColorPickers);
    c.data.datasets[0].data = vals;
    c.data.datasets[0].backgroundColor = fill;
    c.update();
  });
}

/* =======================
   INPUT EVENT LISTENERS
======================= */
[powerInput, speedInput, trickInput, recoveryInput, defenseInput, colorPicker].forEach(el => {
  el.addEventListener('input', updateCharts);
  el.addEventListener('change', updateCharts);
});
