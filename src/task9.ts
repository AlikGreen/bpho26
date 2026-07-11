import * as functionPlotModule from "function-plot";
const functionPlot = (functionPlotModule as any).default;

const planck =  6.626e-34;
const eMass = 9.109e-31;
const lightSpeed = 3e8;

const eV = 1.602e-19; // J per eV
var energy = 500 * 1000 * eV; // now in Joules

const evSlider = document.getElementById("evSlider") as HTMLInputElement;
const evText = document.getElementById("evText") as HTMLInputElement;

const wavelengthGraph = document.getElementById("wavelengthGraph")!;
const speedGraph = document.getElementById("speedGraph")!;
const recoilAngleGraph = document.getElementById("recoilAngleGraph")!;

updateGraphs();

function updateGraphs() 
{
    // Original wavelength
    let beforeWL = (planck * lightSpeed) / energy;

    // Shift in wavelength from collision
    let shiftWL = `((${planck / (eMass * lightSpeed)}) * (1 - cos(x*${Math.PI}/180)))`;

    // Final wavelength after collision
    let afterWL = `(${beforeWL} + ${shiftWL})`

    functionPlot.default({
    target: wavelengthGraph,
    title: "Fractional Wavelength Shift vs Scattering Angle",
    width: 600,
    disableZoom: true,
    yAxis: { domain: [0, 4], label: "Δλ/λ" },
    xAxis: { domain: [0, 180], label: "Photon scattering angle θ/deg" },
    grid: true,
    data: [
        {
        fn: `${shiftWL}/${beforeWL}`, // Fractional wavelength shift
        }
    ]
    });


    let mec2 = eMass * lightSpeed * lightSpeed;
    let hc = planck * lightSpeed;

    functionPlot.default({
    target: speedGraph,
    title: "Electron recoil speed vs Scattering Angle",
    width: 600,
    disableZoom: true,
    yAxis: { domain: [0, 1], label: "Electron recoil speed v/c" },
    xAxis: { domain: [0, 180], label: "Photon scattering angle θ/deg" },
    grid: true,
    data: [
    {   // Equation for electron recoil speed
        fn: `sqrt(1 - (${mec2} / (${hc}/${beforeWL} - ${hc}/${afterWL} + ${mec2}))^2)`,
    }
    ]
    });


    // Denominator of the fraction inside of the arctan
    let recoilDenom = `(1 + (${shiftWL}/${beforeWL}) - cos(x*${Math.PI}/180))`
    // Tan of the electron recoil angle
    let tanTheta = `sin(x*${Math.PI}/180)/${recoilDenom}`;

    functionPlot.default({
    target: recoilAngleGraph,
    title: "Electron recoil angle vs Scattering Angle",
    width: 600,
    disableZoom: true,
    yAxis: { domain: [0, 90], label: "Electron recoil angle Φ/deg" },
    xAxis: { domain: [0, 180], label: "Photon scattering angle θ/deg" },
    grid: true,
    data: [
    {   // Arctan to get the angle in radians * 180 / PI to get it in
        fn: `atan(${tanTheta})*180/${Math.PI}`,
    }
    ]
    });
}

evSlider.addEventListener("input", () =>
{
    evText.innerText = `${parseFloat(evSlider.value).toFixed(0)} keV`;
    energy = parseFloat(evSlider.value) * 1000 * eV;
    updateGraphs();
});
