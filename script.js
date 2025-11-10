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

function getAxisColors() {
  return [
    axisColors.power.value,
    axisColors.speed.value,
    axisColors.trick.value,
    axisColors.recovery.value,
    axisColors.defense.value
  ];
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

/* === OUTLINED LABELS + VALUE PARENTHESIS === */
const outlinedLabelsPlugin = {
  id: 'outlinedLabels',
  afterDraw(chart) {
    const ctx = chart.ctx;
    const r = chart.scales.r;
    const labels = chart.data.labels;
    const dataValues = chart.data.datasets[0].data;
    const isChart1 = chart.canvas.id === 'radarChart1';
    const cx = r.xCenter, cy = r.yCenter;
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
      const radius = r.drawingArea * (isChart1 ? 1.05 : 1.1);
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);

      // draw main label
      ctx.strokeText(label, x, y);
      ctx.fillText(label, x, y);

      if (isChart1) {
        // draw value below label
        ctx.font = 'italic 14px Candara';
        ctx.fillStyle = 'black';
        const val = `(${dataValues[i].toFixed(1)})`;
        const offsetY = y + 20;
        ctx.fillText(val, x, offsetY);
      }
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
        backgroundColor: hexToRGBA(chartColor, 0.65),
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
  power: document.getElementById('powerColor'),
  speed: document.getElementById('speedColor'),
  trick: document.getElementById('trickColor'),
  recovery: document.getElementById('recoveryColor'),
  defense: document.getElementById('defenseColor')
};

const inputElements = [
  powerInput, speedInput, trickInput, recoveryInput, defenseInput,
  colorPicker, ...Object.values(axisColors)
];

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

  const newColor = colorPicker.value;

  // when ability color changes, update all axis colors
  if (chartColor !== newColor) {
    chartColor = newColor;
    Object.values(axisColors).forEach(el => el.value = chartColor);
  }

  const datasetColors = isMulticolor ? getAxisColors() : Array(5).fill(chartColor);
  const fillColor = isMulticolor
    ? datasetColors.reduce((acc, curr, i) => i === 0 ? curr : mixColors(acc, curr, 1 / (i + 1)), datasetColors[0])
    : chartColor;

  if (radar1) {
    radar1.options.abilityColor = chartColor;
    radar1.data.datasets[0].data = vals;
    radar1.data.datasets[0].borderColor = datasetColors;
    radar1.data.datasets[0].pointBorderColor = datasetColors;
    radar1.data.datasets[0].backgroundColor = hexToRGBA(fillColor, 0.65);
    radar1.update();
  }

  if (radar2Ready && radar2) {
    radar2.options.abilityColor = chartColor;
    radar2.data.datasets[0].data = vals.map(v => Math.min(v, 10));
    radar2.data.datasets[0].borderColor = datasetColors;
    radar2.data.datasets[0].pointBorderColor = datasetColors;
    radar2.data.datasets[0].backgroundColor = hexToRGBA(fillColor, 0.65);
    radar2.update();
  }
}

/* === MULTICOLOR TOGGLE === */
multiBtn.addEventListener('click', () => {
  isMulticolor = !isMulticolor;
  multiBtn.textContent = isMulticolor ? 'Single Color' : 'Multicolor';
  Object.values(axisColors).forEach(el => el.classList.toggle('hidden', !isMulticolor));
  if (isMulticolor) Object.values(axisColors).forEach(el => el.value = chartColor);
  updateCharts();
});

/* === INPUT LISTENERS === */
inputElements.forEach(el => {
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

    if (overlayChart.style.height !== `${targetSize}px`) {
      overlayChart.style.height = `${targetSize}px`;
      overlayChart.style.width = `${targetSize}px`;
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
