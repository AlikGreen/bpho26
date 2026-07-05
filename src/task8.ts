import "./style.css";

const greenDetectorImg = document.getElementById("green_detector")!;
const greenDetectorSlider = document.getElementById("green_detector_angle") as HTMLInputElement;
const greenDetectorDegrees = document.getElementById("green_detector_degrees")!;

const blueDetectorImg = document.getElementById("blue_detector")!;
const blueDetectorSlider = document.getElementById("blue_detector_angle") as HTMLInputElement;
const blueDetectorDegrees = document.getElementById("blue_detector_degrees")!;

const classicalText = document.getElementById("classical_text")!;
const quantumText = document.getElementById("quantum_text")!;

updateText();

blueDetectorSlider.addEventListener("input", () =>
{
    blueDetectorImg.style.transform = `rotate(${blueDetectorSlider.value}deg)`;
    blueDetectorDegrees.innerText = `θ=${blueDetectorSlider.value}°`
    updateText();
});

greenDetectorSlider.addEventListener("input", () =>
{
    greenDetectorImg.style.transform = `rotate(${greenDetectorSlider.value}deg)`;
    greenDetectorDegrees.innerText = `Φ=${greenDetectorSlider.value}°`
    updateText();
});

function updateText()
{
    let theta: number = parseFloat(blueDetectorSlider.value);
    let phi: number = parseFloat(greenDetectorSlider.value);
    let cosTheta = Math.cos(theta/180*2*Math.PI);
    let sinTheta = Math.sin(theta/180*2*Math.PI);
    let cosPhi = Math.cos(phi/180*2*Math.PI);
    let sinPhi = Math.sin(phi/180*2*Math.PI);
    let sinPhiMinusTheta = Math.sin(phi/180*2*Math.PI-theta/180*2*Math.PI);

    classicalText.innerHTML = `
    P(mismatch) = 1 - cos<sup>2</sup>θ cos<sup>2</sup>Φ - sin<sup>2</sup>θ sin<sup>2</sup>Φ<br>
    P(mismatch) = 1 - cos<sup>2</sup>(${theta}) cos<sup>2</sup>(${phi}) - sin<sup>2</sup>(${theta}) sin<sup>2</sup>(${phi})<br>
    P(mismatch) = 1 - (${cosTheta.toFixed(2)})<sup>2</sup> (${cosPhi.toFixed(2)})<sup>2</sup> - (${sinTheta.toFixed(2)})<sup>2</sup> (${sinPhi.toFixed(2)})<sup>2</sup><br>
    P(mismatch) = 1 - ${(cosTheta*cosTheta*cosPhi*cosPhi).toFixed(2)} - ${(sinTheta*sinTheta*sinPhi*sinPhi).toFixed(2)} = ${(1 - cosTheta*cosTheta*cosPhi*cosPhi - sinTheta*sinTheta*sinPhi*sinPhi).toFixed(2)}
    `;

    quantumText.innerHTML = `
    P(mismatch) = sin<sup>2</sup>(Φ-θ)<br>
    P(mismatch) = sin<sup>2</sup>(${phi-theta}) = ${(sinPhiMinusTheta*sinPhiMinusTheta).toFixed(2)}
    `;
}