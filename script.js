let radar1, radar2;
let radar2Ready = false;
let chartColor = '#92dfec';
let isMulticolor = false;

// Fixed colors for the spokes and polygon border, as requested
const FIXED_BORDER_COLOR = '#493e3b';
const FIXED_SPOKE_COLOR = '#6db5c0';
const DEFAULT_FILL_OPACITY = 0.65;

/* === UTILITIES === */
function hexToRGBA(hex, alpha) {
    if (!hex || hex.length < 7) return `rgba(0,0,0,${alpha})`; // Safety check
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

/* === PLUGINS === */

// Plugin to draw the polygon as individually colored, blended wedges (for multicolor mode)
const segmentedFillPlugin = {
    id: 'segmentedFill',
    beforeDatasetsDraw(chart, args, options) {
        if (!options.enabled || chart.data.datasets.length === 0) return;

        const ctx = chart.ctx;
        const r = chart.scales.r;
        const dataset = chart.data.datasets[0];
        const data = dataset.data;
        const N = chart.data.labels.length;
        const cx = r.xCenter, cy = r.yCenter;
        const colors = getAxisColors();

        ctx.save();
        ctx.globalAlpha = 0.5; // Global transparency for blending effect

        // Draw each segment (wedge)
        for (let i = 0; i < N; i++) {
            const currentAxisValue = data[i] || 0;
            const nextAxisIndex = (i + 1) % N;
            const nextAxisValue = data[nextAxisIndex] || 0;

            // Get the pixel coordinates for the current data point and the next data point
            const pointPositionCurrent = r.getPointPosition(i, currentAxisValue);
            const pointPositionNext = r.getPointPosition(nextAxisIndex, nextAxisValue);
            
            // Define the path for the wedge: Center -> Current Point -> Next Point -> Center
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(pointPositionCurrent.x, pointPositionCurrent.y);
            ctx.lineTo(pointPositionNext.x, pointPositionNext.y);
            ctx.closePath();

            // Use the current axis color for the fill
            ctx.fillStyle = colors[i];
            ctx.fill();
        }
        ctx.restore();
    },
};

// Plugin to draw the fixed background pentagon and FIXED spokes (Grid)
const radarGridPlugin = {
    id: 'customPentagonBackground',
    // Draw the background pentagon color fill
    beforeDatasetsDraw(chart) {
        const opts = chart.config.options.customBackground;
        if (!opts?.enabled) return;
        const r = chart.scales.r, ctx = chart.ctx;
        const cx = r.xCenter, cy = r.yCenter, radius = r.drawingArea;
        const N = chart.data.labels.length, start = -Math.PI / 2;

        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0, '#f8fcff');
        gradient.addColorStop(0.33, chartColor); // Use the main color for the base
        gradient.addColorStop(1, chartColor);

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
    // Draw the FIXED axes (spokes) and outer border
    afterDatasetsDraw(chart) {
        const opts = chart.config.options.customBackground;
        if (!opts?.enabled) return;
        const r = chart.scales.r, ctx = chart.ctx;
        const cx = r.xCenter, cy = r.yCenter, radius = r.drawingArea;
        const N = chart.data.labels.length, start = -Math.PI / 2;

        ctx.save();
        // Draw axes (spokes) - MUST use FIXED_SPOKE_COLOR
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
            const a = start + (i * 2 * Math.PI / N);
            const x = cx + radius * Math.cos(a);
            const y = cy + radius * Math.sin(a);
            ctx.moveTo(cx, cy);
            ctx.lineTo(x, y);
        }
        ctx.strokeStyle = FIXED_SPOKE_COLOR; // FIXED COLOR
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Draw outer border - MUST use FIXED_BORDER_COLOR
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
            const a = start + (i * 2 * Math.PI / N);
            const x = cx + radius * Math.cos(a);
            const y = cy + radius * Math.sin(a);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = FIXED_BORDER_COLOR; // FIXED COLOR
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    }
};

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

const outlinedLabelsPlugin = {
    id: 'outlinedLabels',
    afterDraw(chart) {
        const ctx = chart.ctx;
        const r = chart.scales.r;
        const labels = chart.data.labels;
        const cx = r.xCenter, cy = r.yCenter;
        const baseRadius = r.drawingArea * 1.1;
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
            const x = cx + radiusToUse * Math.cos(angle);
            let y = cy + radiusToUse * Math.sin(angle);
            if (i === 0) y -= 5;

            ctx.strokeText(label, x, y);
            ctx.fillText(label, x, y);
        });
        ctx.restore();
    }
};

const inputValuePlugin = {
    id: 'inputValuePlugin',
    afterDraw(chart) {
        // Skip for the background chart (chart2)
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

            const x = cx + (radiusToUse + offset) * Math.cos(angle);
            let y = cy + (radiusToUse + offset) * Math.sin(angle);
            
            // Adjust label positioning slightly for visual balance
            if (i === 0) y -= 20;
            else if (i === 1) y += 10;
            else if (i === 4) y += 10;

            const valueText = `(${data[i] ? data[i].toFixed(1) : '0.0'})`;
            ctx.strokeText(valueText, x, y);
            ctx.fillText(valueText, x, y);
        });
        ctx.restore();
    }
};


/* === CHART CREATOR === */
function makeRadar(ctx, showPoints = true, withBackground = false, fixedCenter = null) {
    // Collect all plugins
    const plugins = [
        fixedCenterPlugin, 
        radarGridPlugin, 
        outlinedLabelsPlugin, 
        inputValuePlugin,
        segmentedFillPlugin // Always include, but activation is controlled by options
    ];

    return new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Power', 'Speed', 'Trick', 'Recovery', 'Defense'],
            datasets: [{
                data: [0, 0, 0, 0, 0],
                // Default to single color fill (will be overwritten in updateCharts)
                backgroundColor: hexToRGBA(chartColor, DEFAULT_FILL_OPACITY), 
                // Use fixed colors
                borderColor: FIXED_BORDER_COLOR, 
                borderWidth: 2,
                pointBackgroundColor: '#fff',
                pointBorderColor: FIXED_BORDER_COLOR,
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
                    // CRITICAL: Set angleLines (Spokes) to fixed color
                    angleLines: { color: FIXED_SPOKE_COLOR, lineWidth: 1 }, 
                    suggestedMin: 0,
                    suggestedMax: 10,
                    ticks: { display: false },
                    pointLabels: { color: 'transparent' }
                }
            },
            customBackground: { enabled: withBackground },
            customFill: { enabled: false }, // Controlled by updateCharts
            fixedCenter: { enabled: !!fixedCenter, centerX: fixedCenter?.x, centerY: fixedCenter?.y },
            abilityColor: chartColor,
            plugins: { legend: { display: false } }
        },
        plugins: plugins
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
const powerValueSpan = document.getElementById('powerValue');
const speedValueSpan = document.getElementById('speedValue');
const trickValueSpan = document.getElementById('trickValue');
const recoveryValueSpan = document.getElementById('recoveryValue');
const defenseValueSpan = document.getElementById('defenseValue');
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
    radar1 = makeRadar(ctx1, true, false);
    
    // Initialize axis colors to main color for single color mode clarity
    Object.values(axisColors).forEach(input => {
        input.value = chartColor;
    });

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
    const solidFill = hexToRGBA(chartColor, DEFAULT_FILL_OPACITY);
    const capped = vals.map(v => Math.min(v, 10));

    // Update range value displays
    powerValueSpan.textContent = powerInput.value;
    speedValueSpan.textContent = speedInput.value;
    trickValueSpan.textContent = trickInput.value;
    recoveryValueSpan.textContent = recoveryInput.value;
    defenseValueSpan.textContent = defenseInput.value;

    [radar1, radar2].forEach((chart, i) => {
        if (!chart) return;
        
        // Update general options
        chart.options.scales.r.suggestedMax = i === 0 ? maxVal : 10;
        chart.options.abilityColor = chartColor;
        chart.data.datasets[0].data = i === 0 ? vals : capped;
        
        // Ensure spokes are always fixed color
        chart.options.scales.r.angleLines.color = FIXED_SPOKE_COLOR;
        chart.data.datasets[0].borderColor = FIXED_BORDER_COLOR; 
        chart.data.datasets[0].pointBorderColor = FIXED_BORDER_COLOR;
        chart.options.customFill.enabled = false; // Reset fill plugin

        if (isMulticolor) {
            // MULTICOLOR MODE: Enable custom segmented fill plugin
            chart.options.customFill.enabled = true;
            // Set chart fill to transparent so the plugin drawing is visible
            chart.data.datasets[0].backgroundColor = 'rgba(0,0,0,0)'; 
        } else {
            // SINGLE COLOR MODE: Use solid color fill
            // Sync all axis inputs to main color and use solid fill
            Object.values(axisColors).forEach(input => {
                input.value = chartColor;
                input.dataset.userSelected = false; 
            });
            chart.data.datasets[0].backgroundColor = solidFill;
        }

        chart.update();
    });
}

// Attach event listeners to update chart on input changes
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

// Primary color picker logic
colorPicker.addEventListener('input', () => {
    chartColor = colorPicker.value;
    if (!isMulticolor) {
        // In single color mode, sync all axis inputs
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
    const axisColorGroups = document.querySelectorAll('[data-axis-color-group]');

    if (isMulticolor) {
        multiBtn.textContent = 'Single Color';
        axisColorGroups.forEach(group => group.classList.remove('hidden'));
        document.querySelectorAll('.axisColor').forEach(input => input.classList.remove('hidden'));
    } else {
        multiBtn.textContent = 'Multicolor';
        axisColorGroups.forEach(group => group.classList.add('hidden'));
        document.querySelectorAll('.axisColor').forEach(input => input.classList.add('hidden'));
        // When switching back to single, reset all axis colors to main chart color
        Object.values(axisColors).forEach(input => {
            input.value = chartColor;
            input.dataset.userSelected = false;
        });
    }
    updateCharts();
});

/* === OVERLAY === */
viewBtn.addEventListener('click', () => {
    overlay.classList.remove('hidden');
    overlayImg.src = uploadedImg.src;
    overlayName.textContent = nameInput.value || 'N/A';
    overlayAbility.textContent = abilityInput.value || 'N/A';
    overlayLevel.textContent = levelInput.value || 'N/A';

    setTimeout(() => {
        const box = document.getElementById('characterBox');
        const img = document.getElementById('uploadedImg');
        const textBox = document.querySelector('.text-box');
        const overlayChartContainer = document.querySelector('.overlay-chart');

        // Calculate a target size based on the content height (arbitrary sizing for visual effect)
        const targetSize = Math.max(img.offsetHeight + textBox.offsetHeight, 300) * 1.1; 

        overlayChartContainer.style.height = `${targetSize}px`;
        overlayChartContainer.style.width = `${targetSize}px`;

        const ctx2 = document.getElementById('radarChart2').getContext('2d');
        
        // Only initialize radar2 once
        if (!radar2Ready) {
            // Determine the center position relative to the new container size
            const center = { x: targetSize / 2, y: targetSize / 2 };
            radar2 = makeRadar(ctx2, false, true, center);
            radar2Ready = true;
        } else {
            // Resize and reposition the center if already initialized
            const center = { x: targetSize / 2, y: targetSize / 2 };
            radar2.options.fixedCenter = { enabled: true, centerX: center.x, centerY: center.y };
            radar2.resize();
        }
        
        updateCharts();
    }, 200); // Small delay to allow element sizing to complete
});

closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));

/* === DOWNLOAD === */
downloadBtn.addEventListener('click', () => {
    // Hide controls before capture
    downloadBtn.style.visibility = 'hidden';
    closeBtn.style.visibility = 'hidden';

    const box = document.getElementById('characterBox');
    
    // html2canvas capture
    html2canvas(box, { scale: 3 }).then(canvas => {
        const link = document.createElement('a');
        const cleanName = (nameInput.value || 'Unnamed').replace(/\s+/g, '_');
        link.download = `${cleanName}_CharacterChart.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        // Restore controls visibility
        downloadBtn.style.visibility = 'visible';
        closeBtn.style.visibility = 'visible';
    });
});
