/*************************
 * GLOBAL STATE
 *************************/
let charts = [];
let activeIndex = 0;
let radarPopup = null;

const BASE_COLOR = '#92dfec';
const FILL_ALPHA = 0.65;

/*************************
 * HELPERS
 *************************/
function hexToRGBA(hex, alpha) {
  if (!hex) hex = BASE_COLOR;
  if (hex.startsWith('rgb')) return hex.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function makeConicGradient(chart, axisColors, alpha = FILL_ALPHA) {
  const r = chart.scales.r;
  const ctx = chart.ctx;
  const grad = ctx.createConicGradient(-Math.PI / 2, r.xCenter, r.yCenter);
  const N = axisColors.length;
  for (let i = 0; i <= N; i++) grad.addColorStop(i / N, hexToRGBA(axisColors[i % N], alpha));
  return grad;
}

function getGlobalScaleMax() {
  let m = 10;
  charts.forEach(c => c.stats.forEach(v => m = Math.max(m, v)));
  return Math.ceil(m);
}

/*************************
 * PLUGINS
 *************************/

/* Pentagon background (popup only) */
const radarBackgroundPlugin = {
  id: 'customPentagonBackground',
  beforeDatasetsDraw(chart) {
    const opts = chart.config.options.customBackground;
    if (!opts?.enabled) return;
    const r = chart.scales.r, ctx = chart.ctx;
    const cx = r.xCenter, cy = r.yCenter, radius = r.drawingArea;
    const N = chart.data.labels.length, start = -Math.PI / 2;

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, '#f8fcff');
    gradient.addColorStop(0.33, BASE_COLOR);
    gradient.addColorStop(1, BASE_COLOR);

    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = start + (i * 2 * Math.PI / N);
      const x = cx + radius * Math.cos(a);
      const y = cy + radius * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();
  },
  afterDatasetsDraw(chart) {
    const opts = chart.config.options.customBackground;
    if (!opts?.enabled) return;
    const r = chart.scales.r, ctx = chart.ctx;
    const cx = r.xCenter, cy = r.yCenter, radius = r.drawingArea;
    const N = chart.data.labels.length, start = -Math.PI / 2;

    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = start + (i * 2 * Math.PI / N);
      const x = cx + radius * Math.cos(a);
      const y = cy + radius * Math.sin(a);
      ctx.moveTo(cx, cy); ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#35727d'; ctx.lineWidth = 1; ctx.stroke();

    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = start + (i * 2 * Math.PI / N);
      const x = cx + radius * Math.cos(a);
      const y = cy + radius * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = '#184046'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }
};

/* Axis titles */
const axisTitlesPlugin = {
  id: 'axisTitles',
  afterDraw(chart) {
    const ctx = chart.ctx, r = chart.scales.r;
    const labels = chart.data.labels;
    if (!labels) return;
    const cx = r.xCenter, cy = r.yCenter;
    const base = -Math.PI / 2;
    const baseRadius = r.drawingArea * 1.1;

    const isPopup = chart.canvas.closest('#overlay') !== null;

    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'italic 18px Candara';
    ctx.strokeStyle = '#8747e6'; ctx.fillStyle = 'white'; ctx.lineWidth = 4;

    labels.forEach((label, i) => {
      const a = base + (i * 2 * Math.PI / labels.length);
      const x = cx + baseRadius * Math.cos(a);
      let y = cy + baseRadius * Math.sin(a);

      // Adjust in popup: raise Speed & Defense
      if (isPopup && (label === 'Speed' || label === 'Defense')) y -= 25;

      if (i === 0) y -= 5; // Power slightly up
      ctx.strokeText(label, x, y);
      ctx.fillText(label, x, y);
    });
    ctx.restore();
  }
};

/* Parentheses plugin (main chart only, live max update) */
const globalValueLabelsPlugin = {
  id: 'globalValueLabels',
  afterDraw(chart) {
    // Only apply to main charts (not popup)
    if (chart.canvas.closest('#overlay')) return;

    const ctx = chart.ctx, r = chart.scales.r;
    const labels = chart.data.labels;
    const cx = r.xCenter, cy = r.yCenter;
    const base = -Math.PI / 2;
    const baseRadius = r.drawingArea * 1.1;
    const offset = 20;

    // Find global max per axis
    const axes = labels.length;
    const maxPerAxis = new Array(axes).fill(0);
    charts.forEach(c => {
      for (let i = 0; i < axes; i++) {
        maxPerAxis[i] = Math.max(maxPerAxis[i], c.stats[i] || 0);
      }
    });

    ctx.save();
    ctx.font = '15px Candara';
    ctx.fillStyle = 'black';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    labels.forEach((_, i) => {
      const angle = base + (i * 2 * Math.PI / axes);
      const x = cx + (baseRadius + offset) * Math.cos(angle);
      let y = cy + (baseRadius + offset) * Math.sin(angle);

      // Lower these slightly
      if (i === 0 || i === 1 || i === 4) y += 20;

      const val = Math.round(maxPerAxis[i] * 100) / 100;
      ctx.fillText(`(${val})`, x, y);
    });
    ctx.restore();
  }
};

/*************************
 * FACTORY
 *************************/
function makeRadar(ctx, color, withBackground = false) {
  return new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Power', 'Speed', 'Trick', 'Recovery', 'Defense'],
      datasets: [{
        data: [0, 0, 0, 0, 0],
        backgroundColor: hexToRGBA(color, FILL_ALPHA),
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
      layout: { padding: { top: 25, bottom: 25, left: 10, right: 10 } },
      scales: {
        r: {
          min: 0,
          max: 10,
          ticks: { display: false },
          grid: { display: false },
          angleLines: { color: '#6db5c0', lineWidth: 1 },
          pointLabels: { color: 'transparent' }
        }
      },
      customBackground: { enabled: withBackground },
      plugins: { legend: { display: false } }
    },
    plugins: [axisTitlesPlugin, radarBackgroundPlugin, globalValueLabelsPlugin]
  });
}

/*************************
 * DOM HOOKS
 *************************/
const chartArea = document.getElementById('chartArea');
const addChartBtn = document.getElementById('addChartBtn');
const chartButtons = document.getElementById('chartButtons');

const powerInput = document.getElementById('powerInput');
const speedInput = document.getElementById('speedInput');
const trickInput = document.getElementById('trickInput');
const recoveryInput = document.getElementById('recoveryInput');
const defenseInput = document.getElementById('defenseInput');

const colorPicker = document.getElementById('colorPicker');
const multiColorBtn = document.getElementById('multiColorBtn');
const axisColorsDiv = document.getElementById('axisColors');
const axisColorPickers = [
  document.getElementById('powerColor'),
  document.getElementById('speedColor'),
  document.getElementById('trickColor'),
  document.getElementById('recoveryColor'),
  document.getElementById('defenseColor')
];

const viewBtn = document.getElementById('viewBtn');
const overlay = document.getElementById('overlay');
const closeBtn = document.getElementById('closeBtn');
const downloadBtn = document.getElementById('downloadBtn');

const uploadedImg = document.getElementById('uploadedImg');
const imgInput = document.getElementById('imgInput');
const overlayImg = document.getElementById('overlayImg');
const overlayName = document.getElementById('overlayName');
const overlayAbility = document.getElementById('overlayAbility');
const overlayLevel = document.getElementById('overlayLevel');
const nameInput = document.getElementById('nameInput');
const abilityInput = document.getElementById('abilityInput');
const levelInput = document.getElementById('levelInput');

/*************************
 * INIT
 *************************/
window.addEventListener('load', () => {
  addChart();
  selectChart(0);
  refreshAll();
});

/*************************
 * ADD / SELECT
 *************************/
function addChart() {
  const canvas = document.createElement('canvas');
  canvas.className = 'layer';
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.zIndex = charts.length + '';
  chartArea.appendChild(canvas);

  const color = charts.length === 0 ? BASE_COLOR : `hsl(${Math.floor(Math.random()*360)},70%,55%)`;
  const chart = makeRadar(canvas.getContext('2d'), color, false);

  const cObj = {
    chart,
    canvas,
    color,
    stats: [0, 0, 0, 0, 0],
    multi: false,
    axis: axisColorPickers.map(p => p.value)
  };
  charts.push(cObj);

  const idx = charts.length - 1;
  const btn = document.createElement('button');
  btn.textContent = `Select Chart ${idx + 1}`;
  btn.addEventListener('click', () => selectChart(idx));
  chartButtons.appendChild(btn);
}

function selectChart(index) {
  activeIndex = index;
  chartButtons.querySelectorAll('button').forEach((b, i) => {
    b.style.backgroundColor = i === index ? '#6db5c0' : '#92dfec';
    b.style.color = i === index ? '#fff' : '#000';
  });
  const c = charts[index];
  [powerInput, speedInput, trickInput, recoveryInput, defenseInput].forEach((el, i) => el.value = c.stats[i]);
  colorPicker.value = c.color;
  multiColorBtn.textContent = c.multi ? 'Single-color' : 'Multi-color';
  axisColorsDiv.style.display = c.multi ? 'flex' : 'none';
}

/*************************
 * UPDATE / DRAW
 *************************/
function applyGlobalScale() {
  const maxV = getGlobalScaleMax();
  charts.forEach(c => {
    c.chart.options.scales.r.max = Math.max(10, maxV);
    c.chart.update();
  });
  if (radarPopup) {
    radarPopup.options.scales.r.max = Math.max(10, maxV);
    radarPopup.update();
  }
}

function refreshAll() {
  applyGlobalScale();
  charts.forEach(obj => {
    const ds = obj.chart.data.datasets[0];
    const fill = obj.multi ? makeConicGradient(obj.chart, obj.axis, FILL_ALPHA)
                           : hexToRGBA(obj.color, FILL_ALPHA);
    ds.data = obj.stats.slice();
    ds.borderColor = obj.color;
    ds.pointBorderColor = obj.color;
    ds.backgroundColor = fill;
    obj.chart.update();
  });
}

function refreshActiveFromInputs() {
  const c = charts[activeIndex];
  c.stats = [
    +powerInput.value || 0,
    +speedInput.value || 0,
    +trickInput.value || 0,
    +recoveryInput.value || 0,
    +defenseInput.value || 0
  ];
  c.color = colorPicker.value;
  c.axis = axisColorPickers.map(p => p.value);
  refreshAll();
}

/*************************
 * LISTENERS
 *************************/
addChartBtn.addEventListener('click', () => addChart());

[powerInput, speedInput, trickInput, recoveryInput, defenseInput].forEach(el => {
  el.addEventListener('input', refreshActiveFromInputs);
});

colorPicker.addEventListener('input', () => {
  charts[activeIndex].color = colorPicker.value;
  refreshAll();
});

axisColorPickers.forEach(p => p.addEventListener('input', () => {
  if (charts[activeIndex].multi) {
    charts[activeIndex].axis = axisColorPickers.map(p => p.value);
    refreshAll();
  }
}));

multiColorBtn.addEventListener('click', () => {
  const c = charts[activeIndex];
  c.multi = !c.multi;
  multiColorBtn.textContent = c.multi ? 'Single-color' : 'Multi-color';
  axisColorsDiv.style.display = c.multi ? 'flex' : 'none';
  refreshAll();
});

imgInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = ev => { uploadedImg.src = ev.target.result; };
  r.readAsDataURL(file);
});

/*************************
 * POPUP
 *************************/
viewBtn.addEventListener('click', () => {
  overlay.classList.remove('hidden');
  overlayImg.src = uploadedImg.src;
  overlayName.textContent = nameInput.value || '-';
  overlayAbility.textContent = abilityInput.value || '-';
  overlayLevel.textContent = levelInput.value || '-';

  const ctx = document.getElementById('overlayChartCanvas').getContext('2d');
  const ds = charts.map(c => ({
    data: c.stats.slice(),
    backgroundColor: hexToRGBA(c.color, FILL_ALPHA),
    borderColor: c.color,
    borderWidth: 2,
    pointRadius: 0
  }));

  if (radarPopup) radarPopup.destroy();

  radarPopup = new Chart(ctx, {
    type: 'radar',
    data: { labels: ['Power', 'Speed', 'Trick', 'Recovery', 'Defense'], datasets: ds },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      layout: { padding: { top: 25, bottom: 25, left: 10, right: 10 } },
      scales: {
        r: {
          min: 0,
          max: Math.max(10, getGlobalScaleMax()),
          ticks: { display: false },
          grid: { display: false },
          angleLines: { color: '#6db5c0', lineWidth: 1 },
          pointLabels: { color: 'transparent' }
        }
      },
      customBackground: { enabled: true },
      plugins: { legend: { display: false } }
    },
    plugins: [radarBackgroundPlugin, axisTitlesPlugin]
  });

  requestAnimationFrame(() => {
    radarPopup.data.datasets.forEach((dataset, i) => {
      const src = charts[i];
      dataset.backgroundColor = src.multi
        ? makeConicGradient(radarPopup, src.axis, FILL_ALPHA)
        : hexToRGBA(src.color, FILL_ALPHA);
    });
    radarPopup.update();
  });
});

closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));
