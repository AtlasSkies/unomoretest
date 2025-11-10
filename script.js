let radar1, radar2;
let radar2Ready = false;
let chartColor = '#92dfec';
let isMulticolor = false;

const CHART1_CENTER = { x: 247, y: 250 };
const CHART_SCALE_FACTOR = 1.0;
const CHART_SIZE_MULTIPLIER = 1.0;

/* === UTILITIES === */
function hexToRGBA(hex, alpha) {
  if (hex.startsWith('rgb')) return hex.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* Get current axis colors */
function getAxisColors() {
  return [
    axisColors.power.value,
    axisColors.speed.value,
    axisColors.trick.value,
    axisColors.recovery.value,
    axisColors.defense.value
  ];
}

/* === NEW: Gradient function for axes === */
function createAxisGradient(chart) {
    const ctx = chart.ctx;
    const r = chart.scales.r;
    const cx = r.xCenter, cy = r.yCenter;
    const radius = r.drawingArea;
    const N = chart.data.labels.length;
    const start = -Math.PI / 2;
    const currentColors = getAxisColors();
    const gradients = [];

    // Helper to get angle point
    const getPoint = (i, factor = 1) => {
        const a = start + (i * 2 * Math.PI / N);
        const x = cx + (radius * factor) * Math.cos(a);
        const y = cy + (radius * factor) * Math.sin(a);
        return { x, y };
    };

    // Create a linear gradient for each axis line (0 to 1.1 times radius)
    for (let i = 0; i < N; i++) {
        const { x: x1, y: y1 } = getPoint(i, 0); // Center point
        const { x: x2, y: y2 } = getPoint(i, 1.1); // Beyond drawing area for smooth axis end

        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        gradient.addColorStop(0, hexToRGBA(currentColors[i], 0.1)); // Start faded
        gradient.addColorStop(1, currentColors[i]); // End in full color
        gradients.push(gradient);
    }
    return gradients;
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

    const isAxisGradientEnabled = chart.config.options.axisGradient?.enabled && chart.canvas.id !== 'radarChart2';
    const axisGradients = isAxisGradientEnabled ? createAxisGradient(chart) : null;

    ctx.save();
    // Draw axes
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = start + (i * 2 * Math.PI / N);
      const x = cx + radius * Math.cos(a);
      const y = cy + radius * Math.sin(a);
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
        if (isAxisGradientEnabled) {
            ctx.strokeStyle = axisGradients[i];
            ctx.lineWidth = 2; // Make lines a bit thicker for gradient visibility
            ctx.stroke();
            ctx.beginPath(); // Start new path for the next axis
        }
    }
    if (!isAxisGradientEnabled) { // Only stroke once if not using individual gradient strokes
        ctx.strokeStyle = '#35727d';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    
    // Draw outer border
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

const outlinedLabelsPlugin = {
  id: 'outlinedLabels',
  afterDraw(chart) {
    const ctx = chart.ctx;
    const r = chart.scales.r;
    const labels = chart.data.labels;
    const cx = r.xCenter, cy = r.yCenter;
    const isOverlayChart = chart.canvas.id === 'radarChart2';
    const baseRadius = r.drawingArea * 1.1;
    const extendedRadius = r.drawingArea * 1.15;
    const base = -Math.PI / 2;
    const currentChartColor = chart.config.options.abilityColor;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic 18px Candara';
    ctx.strokeStyle = currentChartColor;
    ctx.fillStyle = 'white';
    ctx.lineWidth = 4;

    labels.forEach((label, i) => {
      let angle = base + (i * 2 * Math.PI / labels.length);
      let radiusToUse = baseRadius;
      if (isOverlayChart && (i === 1 || i === 4)) radiusToUse = extendedRadius;
      const x = cx + radiusToUse * Math.cos(angle);
      let y = cy + radiusToUse * Math.sin(angle);
      if (i === 0) y -= 5;
      if (isOverlayChart && (i === 1 || i === 4)) y -= 42;

      ctx.strokeText(label, x, y);
      ctx.fillText(label, x, y);
    });
    ctx.restore();
  }
};

const inputValuePlugin = {
  id: 'inputValuePlugin',
  afterDraw(chart) {
    if (chart.config.options.customBackground.enabled) return;
    const ctx = chart.ctx;
    const r = chart.scales.r;
    const data = chart.data.datasets[0].data;
    const labels = chart.data.labels;
    const cx = r.xCenter, cy = r.yCenter;
    const baseRadius = r.drawingArea * 1.1;
    const base = -Math.PI / 2;
    const offset = 20;
    const currentChartColor = chart.config.options.abilityColor;

    ctx.save();
    ctx.font = '15px Candara';
    ctx.fillStyle = 'white';
    ctx.strokeStyle = currentChartColor;
    ctx.lineWidth = 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    labels.forEach((label, i) => {
      const angle = base + (i * 2 * Math.PI / labels.length);
      let radiusToUse = baseRadius;
      if (chart.canvas.id === 'radarChart2' && (i === 1 || i === 4)) radiusToUse = r.drawingArea * 1.15;
      const x = cx + (radiusToUse + offset) * Math.cos(angle);
      let y = cy + (radiusToUse + offset) * Math.sin(angle);
      if (i === 0) y -= 20;
      if (chart.canvas.id === 'radarChart2') {
        if (i === 1 || i === 4) y -= 22;
      } else {
        if (i === 1) y += 20;
        if (i === 4) y += 20;
      }
      const valueText = `(${data[i] ? data[i].toFixed(1) : '0.0'})`;
      ctx.strokeText(valueText, x, y);
      ctx.fillText(valueText, x, y);
    });
    ctx.restore();
  }
};

// NEW PLUGIN for individual axis line drawing in multicolor mode (only for radar1)
const axisGradientPlugin = {
    id: 'axisGradientPlugin',
    afterDraw(chart) {
        if (!chart.config.options.axisGradient?.enabled || chart.canvas.id === 'radarChart2') return;

        const r = chart.scales.r, ctx = chart.ctx;
        const cx = r.xCenter, cy = r.yCenter, radius = r.drawingArea;
        const N = chart.data.labels.length, start = -Math.PI / 2;
        const axisGradients = createAxisGradient(chart);

        ctx.save();
        for (let i = 0; i < N; i++) {
            const a = start + (i * 2 * Math.PI / N);
            const x = cx + radius * Math.cos(a);
            const y = cy + radius * Math.sin(a);
            
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(x, y);

            // Use the gradient for the axis line
            ctx.strokeStyle = axisGradients[i];
            ctx.lineWidth = 2; // Thicker lines for better gradient visibility
            ctx.stroke();
        }
        ctx.restore();
    }
};

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
      layout: { padding: { top: 25, bottom: 25, left: 10, right: 10 } },
      scales: {
        r: {
          grid: { display: false },
          angleLines: { color: '#6db5c0', lineWidth: 1 }, // This will be overridden by the plugin if using gradient
          suggestedMin: 0,
          suggestedMax: 10,
          ticks: { display: false },
          pointLabels: { color: 'transparent' }
        }
      },
      customBackground: { enabled: withBackground },
      fixedCenter: { enabled: !!fixedCenter, centerX: fixedCenter?.x, centerY: fixedCenter?.y },
      axisGradient: { enabled: false }, // NEW OPTION
      abilityColor: chartColor,
      plugins: { legend: { display: false } }
    },
    plugins: withBackground 
        ? [fixedCenterPlugin, radarBackgroundPlugin, outlinedLabelsPlugin, inputValuePlugin]
        : [fixedCenterPlugin, outlinedLabelsPlugin, inputValuePlugin, axisGradientPlugin] // Add gradient plugin to radar1
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

/* === UPDATE === */
function updateCharts() {
  const vals = [
    +powerInput.value || 0,
    +speedInput.value || 0,
    +trickInput.value || 0,
    +recoveryInput.value || 0,
    +defenseInput.value || 0
  ];
  const maxVal = Math.max(...vals, 10);
  chartColor = colorPicker.value || chartColor;
  const fill = hexToRGBA(chartColor, 0.65);
  const capped = vals.map(v => Math.min(v, 10));

  let borderColors, pointBorderColors, backgroundColors;
    
  // Requirement: When in multicolor mode, the ability color wheel should still be visible.
  // When the user selects the ability color, all axis colors should automatically change to that color
  if (isMulticolor) {
    // If not manually selected, keep syncing with main colorPicker
    Object.values(axisColors).forEach(input => {
      if (input.dataset.userSelected !== 'true') { 
            input.value = chartColor; 
        }
    });
    const colors = getAxisColors();
    borderColors = colors;
    pointBorderColors = colors;
    // create gradient fill for the polygon
    const ctx = radar1.ctx;
    const gradient = ctx.createLinearGradient(0, 0, radar1.width, radar1.height);
    const stops = colors.length - 1;
    colors.forEach((c, i) => gradient.addColorStop(i / stops, hexToRGBA(c, 0.5)));
    backgroundColors = gradient;

  } else {
    // Requirement: "single color" button should be the same color as "multicolor" button
    // This means when in single color mode, the axis colors should be synced to the main colorPicker.
    // Reset axis color inputs to main color
    Object.values(axisColors).forEach(input => {
      input.value = chartColor;
      input.dataset.userSelected = false; // Reset manual selection
    });
    borderColors = chartColor;
    pointBorderColors = chartColor;
    backgroundColors = fill;
  }
    
  [radar1, radar2].forEach((chart, i) => {
    if (!chart) return;
    chart.options.scales.r.suggestedMax = i === 0 ? maxVal : 10;
    chart.options.abilityColor = chartColor;
    
    // Toggle axis gradient plugin (Requirement: each axis should be the selected color and should be a gradience)
    // Only applies to radar1 (the main chart) as radar2 has a background plugin.
    if (i === 0) {
        chart.options.axisGradient.enabled = isMulticolor;
        
        // Remove default angleLines color/width if we are using the gradient plugin
        chart.options.scales.r.angleLines.color = isMulticolor ? 'transparent' : '#6db5c0';
        chart.options.scales.r.angleLines.lineWidth = isMulticolor ? 0 : 1;
    }
    
    chart.data.datasets[0].data = i === 0 ? vals : capped;
    // Requirement: The outline of the colored part of the radar chart should be the selected ability color
    // This uses the single chartColor for the border when NOT in multicolor mode, and the axis colors in multicolor mode.
    chart.data.datasets[0].borderColor = isMulticolor ? borderColors : chartColor; 
    chart.data.datasets[0].backgroundColor = backgroundColors;
    chart.data.datasets[0].pointBorderColor = isMulticolor ? pointBorderColors : chartColor;
    chart.update();
  });
}

inputElements.forEach(el => {
  el.addEventListener('input', updateCharts);
  el.addEventListener('change', updateCharts);
});

/* Track manual axis color changes */
Object.values(axisColors).forEach(input => {
  input.addEventListener('input', () => { 
        input.dataset.userSelected = true; 
        updateCharts(); 
    });
});

colorPicker.addEventListener('input', () => {
  chartColor = colorPicker.value;
  // Sync to axis colors if in multicolor mode (Requirement: all axis colors should automatically change)
  if (isMulticolor) {
    Object.values(axisColors).forEach(input => { 
        input.dataset.userSelected = false; // Reset manual flag
        input.value = chartColor; 
    });
  } else {
    // If not in multicolor mode, just update the axis colors directly
    Object.values(axisColors).forEach(input => { 
        input.value = chartColor; 
    });
}
  updateCharts();
});

/* === IMAGE UPLOAD === */
imgInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => { uploadedImg.src = ev.target.result; };
  reader.readAsDataURL(file);
});

/* === MULTICOLOR BUTTON === */
multiBtn.addEventListener('click', () => {
  isMulticolor = !isMulticolor;
  const axisColorInputs = document.querySelectorAll('.axisColor');

  if (isMulticolor) {
    multiBtn.textContent = 'Single Color';
    colorPicker.parentElement.classList.remove('hidden'); 
    axisColorInputs.forEach(input => input.classList.remove('hidden'));
  } else {
    multiBtn.textContent = 'Multicolor';
    axisColorInputs.forEach(input => input.classList.add('hidden'));
  }
  
  // Ensure colors are synced when switching modes (Requirement: single color button should be the same color as multicolor button)
  // This logic is mostly handled in updateCharts, but we call it to refresh.
  updateCharts();
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
        fontSize: '9px',
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
    } else {
      radar2.resize();
    }
    updateCharts();
  }, 200);
});

closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));

/* === DOWNLOAD === */
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
  box.style.maxHeight = 'none';
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
