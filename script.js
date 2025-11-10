let radar1, radar2;
let radar2Ready = false;
let chartColor = '#92dfec';
let multiColorMode = false;

const CHART1_CENTER = { x: 247, y: 250 };
const CHART_SIZE_MULTIPLIER = 1.0;

function hexToRGBA(hex, alpha) {
  if (hex.startsWith('rgb')) return hex.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* === FIXED CENTER === */
const fixedCenterPlugin = {
  id: 'fixedCenter',
  beforeLayout(chart) {
    const opt = chart.config.options.fixedCenter;
    if (!opt?.enabled) return;
    const r = chart.scales.r;
    r.xCenter = opt.centerX;
    r.yCenter = opt.centerY;
  }
};

/* === BACKGROUND PENTAGON RESTORED === */
const radarBackgroundPlugin = {
  id: 'customPentagonBackground',
  beforeDatasetsDraw(chart) {
    if (!chart.config.options.customBackground?.enabled) return;
    const ctx = chart.ctx;
    const r = chart.scales.r;
    const cx = r.xCenter, cy = r.yCenter, radius = r.drawingArea;
    const N = chart.data.labels.length;
    const start = -Math.PI / 2;

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, '#f8fcff');
    gradient.addColorStop(0.33, '#92dfec');
    gradient.addColorStop(1, '#92dfec');

    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const angle = start + (i * 2 * Math.PI / N);
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();
  },
  afterDatasetsDraw(chart) {
    const ctx = chart.ctx;
    const r = chart.scales.r;
    const cx = r.xCenter, cy = r.yCenter, radius = r.drawingArea;
    const N = chart.data.labels.length;
    const start = -Math.PI / 2;

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
    ctx.restore();
  }
};

/* === OUTLINED LABELS RESTORED === */
const outlinedLabelsPlugin = {
  id: 'outlinedLabels',
  afterDraw(chart) {
    const ctx = chart.ctx;
    const r = chart.scales.r;
    const labels = chart.data.labels;
    const cx = r.xCenter, cy = r.yCenter;
    const radius = r.drawingArea * 1.15;
    const base = -Math.PI / 2;

    ctx.save();
    ctx.font = 'italic 18px Candara';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = chartColor;
    ctx.fillStyle = 'white';

    labels.forEach((label, i) => {
      const a = base + (i * 2 * Math.PI / labels.length);
      const x = cx + radius * Math.cos(a);
      const y = cy + radius * Math.sin(a);
      ctx.strokeText(label, x, y);
      ctx.fillText(label, x, y);
    });
    ctx.restore();
  }
};

/* === MULTICOLOR GRADIENT FILL === */
function makeGradientPolygon(ctx, cx, cy, radius, colors) {
  const N = colors.length;
  const gradientCanvas = document.createElement('canvas');
  gradientCanvas.width = 512;
  gradientCanvas.height = 512;
  const gctx = gradientCanvas.getContext('2d');

  const radial = gctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  for (let i = 0; i < N; i++) {
    const stop = i / (N - 1);
    radial.addColorStop(stop, colors[i]);
  }
  gctx.fillStyle = radial;
  gctx.fillRect(0, 0, 512, 512);
  return ctx.createPattern(gradientCanvas, 'no-repeat');
}

/* === CHART CREATOR === */
function makeRadar(ctx, showPoints = true, withBackground = false, fixedCenter = null) {
  return new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Power', 'Speed', 'Trick', 'Recovery', 'Defense'],
      datasets: [{
        data: [0, 0, 0, 0, 0],
        backgroundColor: hexToRGBA(chartColor, 0.65),
        borderColor: chartColor,
        borderWidth: 2,
        pointBackgroundColor: '#fff',
        pointBorderColor: chartColor,
        pointRadius: showPoints ? 5 : 0
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
      customBackground: { enabled: withBackground },
      fixedCenter: { enabled: !!fixedCenter, centerX: fixedCenter?.x, centerY: fixedCenter?.y },
      plugins: { legend: { display: false } }
    },
    plugins: [fixedCenterPlugin, radarBackgroundPlugin, outlinedLabelsPlugin]
  });
}

/* === ELEMENTS === */
const colorPicker = document.getElementById('colorPicker');
const powerInput = document.getElementById('powerInput');
const speedInput = document.getElementById('speedInput');
const trickInput = document.getElementById('trickInput');
const recoveryInput = document.getElementById('recoveryInput');
const defenseInput = document.getElementById('defenseInput');
const multiColorBtn = document.getElementById('multiColorBtn');
const powerColor = document.getElementById('powerColor');
const speedColor = document.getElementById('speedColor');
const trickColor = document.getElementById('trickColor');
const recoveryColor = document.getElementById('recoveryColor');
const defenseColor = document.getElementById('defenseColor');
const viewBtn = document.getElementById('viewBtn');

/* === INIT MAIN CHART === */
window.addEventListener('load', () => {
  const ctx1 = document.getElementById('radarChart1').getContext('2d');
  radar1 = makeRadar(ctx1, true, false, CHART1_CENTER);
  updateCharts();
});

/* === UPDATE CHART === */
function getWedgeColors() {
  const base = hexToRGBA(colorPicker.value, 0.65);
  if (!multiColorMode) return Array(5).fill(base);
  return [
    hexToRGBA(powerColor.value || colorPicker.value, 0.65),
    hexToRGBA(speedColor.value || colorPicker.value, 0.65),
    hexToRGBA(trickColor.value || colorPicker.value, 0.65),
    hexToRGBA(recoveryColor.value || colorPicker.value, 0.65),
    hexToRGBA(defenseColor.value || colorPicker.value, 0.65)
  ];
}

function updateCharts() {
  const vals = [
    +powerInput.value || 0,
    +speedInput.value || 0,
    +trickInput.value || 0,
    +recoveryInput.value || 0,
    +defenseInput.value || 0
  ];
  radar1.data.datasets[0].data = vals;

  const colors = getWedgeColors();
  const ctx = radar1.ctx;
  const r = radar1.scales.r;
  radar1.data.datasets[0].backgroundColor = makeGradientPolygon(ctx, r.xCenter, r.yCenter, r.drawingArea, colors);
  radar1.update();

  if (radar2Ready) {
    radar2.data.datasets[0].data = vals;
    radar2.data.datasets[0].backgroundColor = makeGradientPolygon(
      radar2.ctx,
      radar2.scales.r.xCenter,
      radar2.scales.r.yCenter,
      radar2.scales.r.drawingArea,
      colors
    );
    radar2.update();
  }
}

/* === EVENT LISTENERS === */
[
  powerInput, speedInput, trickInput, recoveryInput, defenseInput,
  colorPicker, powerColor, speedColor, trickColor, recoveryColor, defenseColor
].forEach(el => el.addEventListener('input', updateCharts));

multiColorBtn.addEventListener('click', () => {
  multiColorMode = !multiColorMode;
  multiColorBtn.textContent = multiColorMode ? 'Single-color' : 'Multi-color';
  document.querySelectorAll('.axis-color').forEach(c => c.classList.toggle('hidden', !multiColorMode));
  updateCharts();
});

/* === OVERLAY & WATERMARK RESTORED === */
viewBtn.addEventListener('click', () => {
  const overlay = document.getElementById('overlay');
  overlay.classList.remove('hidden');

  document.getElementById('overlayImg').src = document.getElementById('uploadedImg').src;
  document.getElementById('overlayName').textContent = document.getElementById('nameInput').value || '-';
  document.getElementById('overlayAbility').textContent = document.getElementById('abilityInput').value || '-';
  document.getElementById('overlayLevel').textContent = document.getElementById('levelInput').value || '-';

  setTimeout(() => {
    const img = document.getElementById('overlayImg');
    const textBox = document.querySelector('.text-box');
    const overlayChart = document.querySelector('.overlay-chart');
    const targetSize = (img.offsetHeight + textBox.offsetHeight) * CHART_SIZE_MULTIPLIER;
    overlayChart.style.width = `${targetSize}px`;
    overlayChart.style.height = `${targetSize}px`;

    const ctx2 = document.getElementById('radarChart2').getContext('2d');
    if (!radar2Ready) {
      radar2 = makeRadar(ctx2, false, true, { x: targetSize / 2, y: targetSize / 2 });
      radar2Ready = true;
    }
    updateCharts();

    if (!document.querySelector('.watermark-image')) {
      const wm = document.createElement('div');
      wm.textContent = 'AS';
      wm.className = 'watermark-image';
      Object.assign(wm.style, {
        position: 'absolute',
        bottom: '8px',
        left: '10px',
        fontFamily: 'Candara',
        fontWeight: 'bold',
        fontSize: '12px',
        color: 'rgba(0,0,0,0.05)',
        pointerEvents: 'none',
        zIndex: '2'
      });
      document.querySelector('.image-section').appendChild(wm);
    }
  }, 200);
});

document.getElementById('closeBtn').addEventListener('click', () => {
  document.getElementById('overlay').classList.add('hidden');
});
