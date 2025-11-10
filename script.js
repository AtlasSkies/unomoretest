let radar1, radar2;
let radar2Ready = false;
let chartColor = '#92dfec';
let multiColorMode = false;

/* === HELPERS === */
function hexToRGBA(hex, alpha) {
  if (hex.startsWith('rgb')) return hex.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* === GRADIENT GENERATOR === */
function makeGradientFill(ctx, values, colors, alpha = 0.65) {
  const r = radar1.scales.r;
  const cx = r.xCenter, cy = r.yCenter, radius = r.drawingArea;
  const N = values.length, start = -Math.PI / 2;

  const gradCanvas = document.createElement('canvas');
  gradCanvas.width = ctx.canvas.width;
  gradCanvas.height = ctx.canvas.height;
  const gctx = gradCanvas.getContext('2d');

  const grad = gctx.createLinearGradient(0, 0, gradCanvas.width, gradCanvas.height);
  for (let i = 0; i < N; i++) {
    grad.addColorStop(i / (N - 1), hexToRGBA(colors[i], alpha));
  }

  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, gradCanvas.width, gradCanvas.height);
  return gctx.createPattern(gradCanvas, 'no-repeat');
}

/* === CHART CREATOR === */
function makeRadar(ctx, withBackground = false) {
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
        pointRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          grid: { display: false },
          ticks: { display: false },
          pointLabels: { color: 'transparent' }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

/* === DOM ELEMENTS === */
const powerInput = document.getElementById('powerInput');
const speedInput = document.getElementById('speedInput');
const trickInput = document.getElementById('trickInput');
const recoveryInput = document.getElementById('recoveryInput');
const defenseInput = document.getElementById('defenseInput');
const colorPicker = document.getElementById('colorPicker');
const viewBtn = document.getElementById('viewBtn');
const multiColorBtn = document.getElementById('multiColorBtn');
const axisColorsDiv = document.getElementById('axisColors');
const axisColorPickers = [
  document.getElementById('powerColor'),
  document.getElementById('speedColor'),
  document.getElementById('trickColor'),
  document.getElementById('recoveryColor'),
  document.getElementById('defenseColor')
];

/* === INITIALIZATION === */
window.addEventListener('load', () => {
  const ctx1 = document.getElementById('radarChart1').getContext('2d');
  radar1 = makeRadar(ctx1, false);
  updateCharts();
});

/* === UPDATE FUNCTION === */
function updateCharts() {
  const vals = [
    +powerInput.value || 0,
    +speedInput.value || 0,
    +trickInput.value || 0,
    +recoveryInput.value || 0,
    +defenseInput.value || 0
  ];

  chartColor = colorPicker.value;
  let fill = hexToRGBA(chartColor, 0.65);
  const ctx1 = radar1.ctx;

  if (multiColorMode) {
    const axisCols = axisColorPickers.map(p => p.value);
    fill = makeGradientFill(ctx1, vals, axisCols);
  }

  radar1.data.datasets[0].data = vals;
  radar1.data.datasets[0].backgroundColor = fill;
  radar1.data.datasets[0].borderColor = chartColor;
  radar1.update();

  if (radar2Ready) {
    const ctx2 = radar2.ctx;
    let fill2 = hexToRGBA(chartColor, 0.65);
    if (multiColorMode) {
      const axisCols = axisColorPickers.map(p => p.value);
      fill2 = makeGradientFill(ctx2, vals, axisCols);
    }
    radar2.data.datasets[0].data = vals;
    radar2.data.datasets[0].backgroundColor = fill2;
    radar2.data.datasets[0].borderColor = chartColor;
    radar2.update();
  }
}

/* === INPUT LISTENERS === */
[powerInput, speedInput, trickInput, recoveryInput, defenseInput, colorPicker].forEach(el => {
  el.addEventListener('input', updateCharts);
});

axisColorPickers.forEach(p => {
  p.addEventListener('input', updateCharts);
});

/* === MULTICOLOR TOGGLE === */
multiColorBtn.addEventListener('click', () => {
  multiColorMode = !multiColorMode;
  if (multiColorMode) {
    axisColorsDiv.style.display = 'flex';
    multiColorBtn.textContent = 'Single-color';
  } else {
    axisColorsDiv.style.display = 'none';
    multiColorBtn.textContent = 'Multi-color';
  }
  updateCharts();
});

/* === OVERLAY SECTION === */
const overlay = document.getElementById('overlay');
const overlayImg = document.getElementById('overlayImg');
const overlayName = document.getElementById('overlayName');
const overlayAbility = document.getElementById('overlayAbility');
const overlayLevel = document.getElementById('overlayLevel');
const nameInput = document.getElementById('nameInput');
const abilityInput = document.getElementById('abilityInput');
const levelInput = document.getElementById('levelInput');
const closeBtn = document.getElementById('closeBtn');
const downloadBtn = document.getElementById('downloadBtn');
const uploadedImg = document.getElementById('uploadedImg');
const imgInput = document.getElementById('imgInput');

imgInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => { uploadedImg.src = ev.target.result; };
  reader.readAsDataURL(file);
});

viewBtn.addEventListener('click', () => {
  overlay.classList.remove('hidden');
  overlayImg.src = uploadedImg.src;
  overlayName.textContent = nameInput.value || '-';
  overlayAbility.textContent = abilityInput.value || '-';
  overlayLevel.textContent = levelInput.value || '-';

  setTimeout(() => {
    const ctx2 = document.getElementById('radarChart2').getContext('2d');
    if (!radar2Ready) {
      radar2 = makeRadar(ctx2, true);
      radar2Ready = true;
    }
    updateCharts();
  }, 200);
});

closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));

/* === DOWNLOAD CHARACTER CHART === */
downloadBtn.addEventListener('click', () => {
  downloadBtn.style.visibility = 'hidden';
  closeBtn.style.visibility = 'hidden';

  const box = document.getElementById('characterBox');
  const originalFlex = box.style.flexDirection;
  const originalWidth = box.style.width;
  const originalHeight = box.style.height;

  box.style.flexDirection = 'row';
  box.style.width = '52vw';
  box.style.height = '64vh';
  box.style.overflow = 'visible';

  html2canvas(box, { scale: 2 }).then(canvas => {
    const link = document.createElement('a');
    const cleanName = (nameInput.value || 'Unnamed').replace(/\s+/g, '_');
    link.download = `${cleanName}_CharacterChart.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    box.style.flexDirection = originalFlex;
    box.style.width = originalWidth;
    box.style.height = originalHeight;
    downloadBtn.style.visibility = 'visible';
    closeBtn.style.visibility = 'visible';
  });
});
