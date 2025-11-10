/* =======================
   STATE
======================= */
let charts = []; // [{ chart, canvas, color, stats[5], multi, axis[5] }]
let activeChart = 0;

let radar2 = null;
let radar2Ready = false;

const BASE_COLOR = '#92dfec';
const FILL_ALPHA = 0.65; // constant opacity across all layers

/* =======================
   HELPERS
======================= */
function hexToRGBA(hex, alpha) {
  if (!hex) hex = BASE_COLOR;
  if (hex.startsWith('rgb')) return hex.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* Smooth wedge gradient (color at each axis corner; blend mid-wedge) */
function makeConicGradient(chart, axisColors, alpha = FILL_ALPHA) {
  const r = chart.scales.r;
  const ctx = chart.ctx;
  const grad = ctx.createConicGradient(-Math.PI / 2, r.xCenter, r.yCenter);
  const N = axisColors.length;
  for (let i = 0; i <= N; i++) grad.addColorStop(i / N, hexToRGBA(axisColors[i % N], alpha));
  return grad;
}

/* Shared scale: at least 10, expands if any series exceeds 10 */
function getGlobalMax() {
  let maxVal = 10;
  charts.forEach(c => { maxVal = Math.max(maxVal, ...c.stats); });
  return Math.ceil(maxVal);
}

/* =======================
   PLUGINS (background + labels)
======================= */
const fixedCenterPlugin = {
  id: 'fixedCenter',
  beforeLayout(chart) {
    const opt = chart.config.options.fixedCenter;
    if (!opt?.enabled) return;
    const r = chart.scales.r;
    if (opt.centerX && opt.centerY) { r.xCenter = opt.centerX; r.yCenter = opt.centerY; }
  }
};

/* Pentagon background (popup only when enabled) */
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
    // spokes
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = start + (i * 2 * Math.PI / N);
      const x = cx + radius * Math.cos(a);
      const y = cy + radius * Math.sin(a);
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#35727d';
    ctx.lineWidth = 1;
    ctx.stroke();
    // border
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = start + (i * 2 * Math.PI / N);
      const x = cx + radius * Math.cos(a);
      const y = cy + radius * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = '#184046';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
};

/* Axis titles (outlined) */
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
    const extendedRadius = r.drawingArea * 1.15; // popup tweak for speed/defense
    const base = -Math.PI / 2;

    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'italic 18px Candara';
    ctx.strokeStyle = '#8747e6'; // outline color (like earlier)
    ctx.fillStyle = 'white';
    ctx.lineWidth = 4;

    labels.forEach((label, i) => {
      let angle = base + (i * 2 * Math.PI / labels.length);
      let radiusToUse = baseRadius;
      if (isOverlay && (i === 1 || i === 4)) radiusToUse = extendedRadius;

      const x = cx + radiusToUse * Math.cos(angle);
      let y = cy + radiusToUse * Math.sin(angle);
      if (i === 0) y -= 5; // Power slight nudge
      if (isOverlay && (i === 1 || i === 4)) y -= 42; // popup tweak

      ctx.strokeText(label, x, y);
      ctx.fillText(label, x, y);
    });
    ctx.restore();
  }
};

/* Numeric "(value)" labels (shown on both charts; popup has small tweak) */
const valueLabelsPlugin = {
  id: 'valueLabels',
  afterDraw(chart) {
    const ctx = chart.ctx;
    const r = chart.scales.r;
    const ds = chart.data.datasets?.[0];
    if (!ds) return;
    const labels = chart.data.labels;
    const data = ds.data || [];
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
      if (i === 0) y -= 20;
      if (isOverlay && (i === 1 || i === 4)) y -= 22;

      const val = typeof data[i] === 'number' ? data[i] : 0;
      ctx.fillText(`(${Math.round(val * 100) / 100})`, x, y);
    });
    ctx.restore();
  }
};

/* =======================
   CHART FACTORY
======================= */
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
          grid: { display: false },
          angleLines: { color: '#6db5c0', lineWidth: 1 },
          min: 0,
          max: 10,               // base = 10
          suggestedMin: 0,
          suggestedMax: 10,
          ticks: { display: false },
          pointLabels: { color: 'transparent' }
        }
      },
      customBackground: { enabled: withBackground },
      plugins: { legend: { display: false } }
    },
    plugins: [fixedCenterPlugin, radarBackgroundPlugin, outlinedLabelsPlugin, valueLabelsPlugin]
  });
}

/* =======================
   DOM HOOKS
======================= */
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
const overlayImg = document.getElementById('overlayImg');
const overlayName = document.getElementById('overlayName');
const overlayAbility = document.getElementById('overlayAbility');
const overlayLevel = document.getElementById('overlayLevel');
const closeBtn = document.getElementById('closeBtn');
const downloadBtn = document.getElementById('downloadBtn');

const imgInput = document.getElementById('imgInput');
const uploadedImg = document.getElementById('uploadedImg');
const nameInput = document.getElementById('nameInput');
const abilityInput = document.getElementById('abilityInput');
const levelInput = document.getElementById('levelInput');

/* =======================
   INIT
======================= */
window.addEventListener('load', () => {
  // Create base chart (Chart 1)
  const ctx1 = document.getElementById('radarChart1').getContext('2d');
  const baseChart = makeRadar(ctx1, BASE_COLOR, false);
  charts.push({
    chart: baseChart,
    canvas: ctx1.canvas,
    color: BASE_COLOR,
    stats: [0,0,0,0,0],
    multi: false,
    axis: axisColorPickers.map(p => p.value)
  });

  // Add the first "Select Chart 1" button
  const btn = document.createElement('button');
  btn.textContent = 'Select Chart 1';
  btn.addEventListener('click', () => selectChart(0));
  chartButtons.appendChild(btn);

  selectChart(0);      // set active
  refreshActive();     // draw once
});

/* =======================
   ADD / SELECT CHARTS
======================= */
function addChart() {
  const cnv = document.createElement('canvas');
  cnv.className = 'stacked-chart';
  chartArea.appendChild(cnv);

  const ctx = cnv.getContext('2d');
  const hue = Math.floor(Math.random() * 360);
  const color = `hsl(${hue},70%,55%)`;
  const chart = makeRadar(ctx, color, false);

  charts.push({
    chart,
    canvas: cnv,
    color,
    stats: [0,0,0,0,0],
    multi: false,
    axis: axisColorPickers.map(p => p.value)
  });

  const idx = charts.length - 1;
  const btn = document.createElement('button');
  btn.textContent = `Select Chart ${idx + 1}`;
  btn.addEventListener('click', () => selectChart(idx));
  chartButtons.appendChild(btn);

  selectChart(idx);
  refreshActive();
}

function selectChart(index) {
  activeChart = index;
  // button visual
  chartButtons.querySelectorAll('button').forEach((b, i) => {
    b.style.backgroundColor = i === index ? '#6db5c0' : '#92dfec';
    b.style.color = i === index ? '#fff' : '#000';
  });
  // canvas layering
  charts.forEach((c, i) => {
    c.canvas.style.zIndex = i === index ? '2' : '1';
    c.chart.canvas.style.opacity = '1';
  });
  // load values into inputs from active chart
  const c = charts[index];
  [powerInput, speedInput, trickInput, recoveryInput, defenseInput].forEach((el, i) => el.value = c.stats[i]);
  colorPicker.value = c.color;
  multiColorBtn.textContent = c.multi ? 'Single-color' : 'Multi-color';
  axisColorsDiv.style.display = c.multi ? 'flex' : 'none';
  axisColorPickers.forEach((p, i) => p.value = c.axis[i]);
}

/* =======================
   UPDATE + DRAW
======================= */
function applyGlobalScale() {
  const maxVal = getGlobalMax();
  const applied = Math.max(10, maxVal);
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

function refreshActive() {
  // Save inputs to active chart
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

  // Redraw all layers with common scale and correct fill (multi or single)
  applyGlobalScale();
  charts.forEach(obj => {
    const fill = obj.multi ? makeConicGradient(obj.chart, obj.axis, FILL_ALPHA)
                           : hexToRGBA(obj.color, FILL_ALPHA);
    const ds = obj.chart.data.datasets[0];
    ds.data = obj.stats;
    ds.borderColor = obj.color;
    ds.pointBorderColor = obj.color;
    ds.backgroundColor = fill;
    obj.chart.update();
  });
}

/* =======================
   LISTENERS
======================= */
addChartBtn.addEventListener('click', addChart);

[powerInput, speedInput, trickInput, recoveryInput, defenseInput].forEach(el => {
  el.addEventListener('input', refreshActive);
});

colorPicker.addEventListener('input', () => {
  // Keep color independent per chart; do not auto-override axis colors unless desired
  refreshActive();
});

axisColorPickers.forEach(p => p.addEventListener('input', () => {
  const c = charts[activeChart];
  if (c.multi) refreshActive();
}));

multiColorBtn.addEventListener('click', () => {
  const c = charts[activeChart];
  c.multi = !c.multi;
  multiColorBtn.textContent = c.multi ? 'Single-color' : 'Multi-color';
  axisColorsDiv.style.display = c.multi ? 'flex' : 'none';
  refreshActive();
});

imgInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = ev => (uploadedImg.src = ev.target.result);
  r.readAsDataURL(file);
});

/* =======================
   POPUP (View Character Chart)
======================= */
viewBtn.addEventListener('click', () => {
  overlay.classList.remove('hidden');
  overlayImg.src = uploadedImg.src;
  overlayName.textContent = nameInput.value || '-';
  overlayAbility.textContent = abilityInput.value || '-';
  overlayLevel.textContent = levelInput.value || '-';

  setTimeout(() => {
    const ctx2 = document.getElementById('radarChart2').getContext('2d');
    const globalMax = getGlobalMax();

    // Build datasets in the SAME order as charts[]  (oldest first → newest last on top)
    const datasets = charts.map(obj => ({
      data: obj.stats.slice(),
      backgroundColor: hexToRGBA(obj.color, FILL_ALPHA), // replaced with gradient after layout
      borderColor: obj.color,
      borderWidth: 2,
      pointRadius: 0
    }));

    if (!radar2Ready) {
      radar2 = new Chart(ctx2, {
        type: 'radar',
        data: {
          labels: ['Power', 'Speed', 'Trick', 'Recovery', 'Defense'],
          datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          layout: { padding: { top: 25, bottom: 25, left: 10, right: 10 } },
          scales: {
            r: {
              grid: { display: false },
              angleLines: { color: '#6db5c0', lineWidth: 1 },
              min: 0,
              max: Math.max(10, globalMax),
              ticks: { display: false },
              pointLabels: { color: 'transparent' }
            }
          },
          customBackground: { enabled: true }, /* pentagon background ON in popup */
          plugins: { legend: { display: false } }
        },
        plugins: [fixedCenterPlugin, radarBackgroundPlugin, outlinedLabelsPlugin, valueLabelsPlugin]
      });
      radar2Ready = true;
    } else {
      radar2.options.scales.r.min = 0;
      radar2.options.scales.r.max = Math.max(10, globalMax);
      radar2.data.labels = ['Power', 'Speed', 'Trick', 'Recovery', 'Defense'];
      radar2.data.datasets = datasets;
      radar2.update();
    }

    // After layout/centers computed, apply gradients for multi-color datasets
    requestAnimationFrame(() => {
      radar2.data.datasets.forEach((ds, i) => {
        const src = charts[i];
        ds.backgroundColor = src.multi
          ? makeConicGradient(radar2, src.axis, FILL_ALPHA)
          : hexToRGBA(src.color, FILL_ALPHA);
      });
      radar2.update();
    });
  }, 140);
});

closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));

/* Download whole popup (keeps watermark & hides buttons) */
downloadBtn.addEventListener('click', () => {
  downloadBtn.style.visibility = 'hidden';
  closeBtn.style.visibility = 'hidden';
  html2canvas(document.getElementById('characterBox'), { scale: 2 }).then(canvas => {
    const link = document.createElement('a');
    const cleanName = (document.getElementById('nameInput').value || 'Unnamed').replace(/\s+/g, '_');
    link.download = `${cleanName}_CharacterChart.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    downloadBtn.style.visibility = 'visible';
    closeBtn.style.visibility = 'visible';
  });
});
