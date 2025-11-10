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

/* === OUTLINED LABELS (MATCH ABILITY COLOR) - UPDATED === */
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
    
    // --- 1. Draw Main Labels ---
    ctx.font = 'italic 18px Candara';
    ctx.strokeStyle = labelColor;
    ctx.fillStyle = 'white';
    ctx.lineWidth = 4;
    
    labels.forEach((label, i) => {
      let currentRadius = r.drawingArea * 1.1; // Default
      
      if (isChart1) {
        currentRadius = r.drawingArea * 1.05; // Slightly closer for chart 1 to make room for value
      } else {
        // Chart 2: Apply the increased spacing for Speed and Defense
        if (label === 'Speed' || label === 'Defense') {
          currentRadius = r.drawingArea * 1.15;
        }
      }

      const angle = base + (i * 2 * Math.PI / labels.length);
      const x = cx + currentRadius * Math.cos(angle);
      const y = cy + currentRadius * Math.sin(angle);
      
      // Draw Label (Power, Speed, etc.)
      ctx.strokeText(label, x, y);
      ctx.fillText(label, x, y);
      
      // --- 2. Draw Input Values (Chart 1 only) ---
      if (isChart1) {
        ctx.fillStyle = 'black';
        ctx.strokeStyle = 'transparent';
        ctx.font = 'italic 14px Candara';
        
        let valueY = y + 20; 
        
        if (label === 'Speed' || label === 'Defense') {
          valueY = y + 25; // Push down slightly more due to angle
        }
        
        const valueX = cx + (currentRadius + 8) * Math.cos(angle); 
        const valueText = `(${dataValues[i].toFixed(1)})`;
        
        ctx.fillText(valueText, valueX, valueY);
      }
    });
    ctx.restore();
  }
};

/* === CHART CREATION & OPTIONS === */
function makeRadar(ctx, showPoints = true, withBackground = false, fixedCenter = null) {
  return new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Power', 'Speed', 'Trick', 'Recovery', 'Defense'],
      datasets: [{
        data: [0, 0, 0, 0, 0],
        borderWidth: 2,
        pointBackgroundColor: '#fff',
        backgroundColor: hexToRGBA(chartColor, 0.65), // Placeholder
        borderColor: chartColor, // Placeholder
        pointBorderColor: chartColor, // Placeholder
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
