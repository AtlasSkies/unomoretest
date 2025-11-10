let radar1, radar2;
let radar2Ready = false;
let chartColor = '#92dfec';
let isMulticolor = false;

const CHART1_CENTER = { x: 247, y: 250 };
const CHART_SIZE_MULTIPLIER = 1.0;

/* === UTILITIES === */
function hexToRGBA(hex, alpha) {
  if (hex.startsWith('rgb')) return hex.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function mixColors(c1, c2, weight = 0.5) {
  const toRGB = hex => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)
  ];
  const [r1, g1, b1] = toRGB(c1);
  const [r2, g2, b2] = toRGB(c2);
  const r = Math.round(r1 * (1 - weight) + r2 * weight);
  const g = Math.round(g1 * (1 - weight) + g2 * weight);
  const b = Math.round(b1 * (1 - weight) + b2 * weight);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/* === MULTICOLOR GRADIENT === */
function createAxisGradient(ctx, chartArea, colors) {
  const cx = (chartArea.left + chartArea.right) / 2;
  const cy = (chartArea.top + chartArea.bottom) / 2;
  const grad = ctx.createConicGradient(-Math.PI / 2, cx, cy);
  const n = colors.length;
  const alpha = 0.65;
  colors.forEach((c, i) => {
    const nextColor = colors[(i + 1) % n];
    grad.addColorStop(i / n, hexToRGBA(c, alpha));
    grad.addColorStop((i + 0.5) / n, hexToRGBA(mixColors(c, nextColor, 0.5), alpha));
  });
  grad.addColorStop(1, hexToRGBA(colors[0], alpha));
  return grad;
}

function getAxisColors() {
  return [
    axisColors.powerColor.value,
    axisColors.speedColor.value,
    axisColors.trickColor.value,
    axisColors.recoveryColor.value,
    axisColors.defenseColor.value
  ].map(c => c || chartColor);
}

/* === PLUGINS === */
const fixedCenterPlugin = {
  id: 'fixedCenter',
  beforeLayout(chart) {
    const opt = chart.config.options.fixedCenter;
    if (!opt?.enabled) return;
    const r = chart.scales.r;
    if (opt.centerX && opt.centerY) {
      r.xCenter = opt.centerX;
      r.yCenter = opt.centerY;
    }
  }
};

/* === BACKGROUND PENTAGON + SPOKES === */
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
    gradient.addColorStop(0.33, '#92dfec');
    gradient.addColorStop(1, '#92dfec');

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
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#35727d';
    ctx.lineWidth = 1;
    ctx.stroke();

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

/* === OUTLINED LABELS (MATCH ABILITY COLOR) === */
const outlinedLabelsPlugin = {
  id: 'outlinedLabels',
  afterDraw(chart) {
    const ctx = chart.ctx;
    const r = chart.scales.r;
    const labels = chart.data.labels;
    const cx = r.xCenter, cy = r.yCenter;
    const baseRadius = r.drawingArea * 1.1;
    const base = -Math.PI / 2;
    const labelColor = chart.config.options.abilityColor || chartColor;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic 18px Candara';
    ctx.strokeStyle = labelColor;
    ctx.fillStyle = 'white';
    ctx.lineWidth = 4;

    labels.forEach((label, i) => {
      const angle = base + (i * 2 * Math.PI / labels.length);
      const x = cx + baseRadius * Math.cos(angle);
      const y = cy + baseRadius * Math.sin(angle);
      ctx.strokeText(label, x, y);
      ctx.fillText(label, x, y);
    });
    ctx.restore();
  }
};

/* === CHART CREATION === */
function makeRadar(ctx, showPoints = true, withBackground = false, fixedCenter = null) {
  return new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Power', 'Speed', 'Trick', 'Recovery', 'Defense'],
      datasets: [{
        data: [0, 0, 0, 0, 0],
        borderWidth: 2,
        pointBackgroundColor: '#fff',
        backgroundColor: context => {
          const { chart } = context;
          const { ctx, chartArea } = chart;
          if (!chartArea) return null;
          if (isMulticolor) {
            const axisColors = getAxisColors();
            return createAxisGradient(ctx, chartArea, axisColors);
          } else {
            return hexToRGBA(chartColor, 0.65);
          }
        },
        borderColor: chartColor,
        pointBorderColor: chartColor,
        pointRadius: showPoints ? 5 : 0
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
          suggestedMin: 0,
          suggestedMax: 10,
          ticks: { display: false },
          pointLabels: { color: 'transparent' }
        }
      },
      customBackground: { enabled: withBackground },
      fixedCenter: { enabled: !!fixedCenter, centerX: fixedCenter?.x, centerY: fixedCenter?.y },
      abilityColor: chartColor,
      plugins: { legend: { display: false } }
    },
    plugins: [fixedCenterPlugin, radarBackgroundPlugin, outlinedLabelsPlugin]
  });
}

/* === DOM ELEMENTS === */
const viewBtn = document.getElementById('viewBtn');
const imgInput = document.getElementById('imgInput');
const uploadedImg = document.getElementById('uploadedImg');
const overlay = document.getElementById('overlay');
const overlayImg = document.getElementById('overlayImg');
const overlayName = document.getElementById('overlayName');
const overlayAbility = document.getElementById('overlayAbility');
const overlayLevel = document.getElementById('overlayLevel');
const closeBtn = document.getElementById('closeBtn');
const downloadBtn = document.getElementById('downloadBtn');
const powerInput = document.getElementById('powerInput');
const speedInput = document.getElementById('speedInput');
const trickInput = document.getElementById('trickInput');
const recoveryInput = document.getElementById('recoveryInput');
const defenseInput = document.getElementById('defenseInput');
const colorPicker = document.getElementById('colorPicker');
const multiBtn = document.getElementById('multiBtn');
const nameInput = document.getElementById('nameInput');
const abilityInput = document.getElementById('abilityInput');
const levelInput = document.getElementById('levelInput');

const axisColors = {
  powerColor: document.getElementById('powerColor'),
  speedColor: document.getElementById('speedColor'),
  trickColor: document.getElementById('trickColor'),
  recoveryColor: document.getElementById('recoveryColor'),
  defenseColor: document.getElementById('defenseColor')
};

/* === INIT === */
window.addEventListener('load', () => {
  chartColor = colorPicker.value || chartColor;
  const ctx1 = document.getElementById('radarChart1').getContext('2d');
  radar1 = makeRadar(ctx1, true, false, CHART1_CENTER);
  updateCharts();
});

/* === UPDATE CHARTS === */
function updateCharts() {
  const vals = [
    +powerInput.value || 0,
    +speedInput.value || 0,
    +trickInput.value || 0,
    +recoveryInput.value || 0,
    +defenseInput.value || 0
  ];
  chartColor = colorPicker.value || chartColor;
  const maxVal = Math.max(...vals, 10);
  const cappedVals = vals.map(v => Math.min(v, 10));

  // sync ability color to charts
  if (radar1) radar1.options.abilityColor = chartColor;
  if (radar2) radar2.options.abilityColor = chartColor;

  if (radar1) {
    radar1.options.scales.r.suggestedMax = maxVal;
    radar1.data.datasets[0].data = vals;
    radar1.data.datasets[0].borderColor = chartColor;
    radar1.data.datasets[0].pointBorderColor = chartColor;
    radar1.update();
  }
  if (radar2Ready && radar2) {
    radar2.data.datasets[0].data = cappedVals;
    radar2.data.datasets[0].borderColor = chartColor;
    radar2.data.datasets[0].pointBorderColor = chartColor;
    radar2.update();
  }

  // update text color of buttons to ability color
  multiBtn.style.color = chartColor;
  viewBtn.style.color = chartColor;
}

/* === MULTICOLOR TOGGLE === */
multiBtn.addEventListener('click', () => {
  isMulticolor = !isMulticolor;
  multiBtn.textContent = isMulticolor ? 'Single Color' : 'Multicolor';
  Object.values(axisColors).forEach(el => el.classList.toggle('hidden', !isMulticolor));
  // Default axis colors = ability color
  if (isMulticolor) {
    Object.values(axisColors).forEach(el => el.value = chartColor);
  }
  updateCharts();
});

/* === INPUTS === */
[
  powerInput, speedInput, trickInput, recoveryInput, defenseInput,
  colorPicker, ...Object.values(axisColors)
].forEach(el => {
  el.addEventListener('input', updateCharts);
  el.addEventListener('change', updateCharts);
});

/* === IMAGE UPLOAD === */
imgInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => (uploadedImg.src = ev.target.result);
  reader.readAsDataURL(file);
});

/* === OVERLAY === */
viewBtn.addEventListener('click', () => {
  overlay.classList.remove('hidden');
  overlayImg.src = uploadedImg.src;
  overlayName.textContent = nameInput.value || '-';
  overlayAbility.textContent = abilityInput.value || '-';
  overlayLevel.textContent = levelInput.value || '-';

  setTimeout(() => {
    const img = document.getElementById('overlayImg');
    const textBox = document.querySelector('.text-box');
    const overlayChart = document.querySelector('.overlay-chart');
    const imgHeight = img.offsetHeight;
    const textHeight = textBox.offsetHeight;
    const targetSize = (imgHeight + textHeight) * CHART_SIZE_MULTIPLIER;
    overlayChart.style.height = `${targetSize}px`;
    overlayChart.style.width = `${targetSize}px`;

    const existingWatermark = document.querySelector('.image-section .watermark-image');
    if (!existingWatermark) {
      const wm = document.createElement('div');
      wm.textContent = 'AS';
      wm.className = 'watermark-image';
      Object.assign(wm.style, {
        position: 'absolute',
        bottom: '8px',
        left: '10px',
        fontFamily: 'Candara',
        fontWeight: 'bold',
        fontSize: '9px', // 50% larger
        color: 'rgba(0,0,0,0.15)',
        pointerEvents: 'none',
        zIndex: '2'
      });
      document.querySelector('.image-section').appendChild(wm);
    }

    const ctx2 = document.getElementById('radarChart2').getContext('2d');
    if (!radar2Ready) {
      radar2 = makeRadar(ctx2, false, true, { x: targetSize / 2, y: targetSize / 2 });
      radar2.options.scales.r.suggestedMax = 10;
      radar2Ready = true;
    } else radar2.resize();
    updateCharts();
  }, 200);
});

closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));

/* === DOWNLOAD === */
downloadBtn.addEventListener('click', () => {
  downloadBtn.style.visibility = 'hidden';
  closeBtn.style.visibility = 'hidden';
  const box = document.getElementById('characterBox');
  html2canvas(box, { scale: 2 }).then(canvas => {
    const link = document.createElement('a');
    const cleanName = (nameInput.value || 'Unnamed').replace(/\s+/g, '_');
    link.download = `${cleanName}_CharacterChart.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    downloadBtn.style.visibility = 'visible';
    closeBtn.style.visibility = 'visible';
  });
});
