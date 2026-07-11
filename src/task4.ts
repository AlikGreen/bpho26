import { Pane } from 'tweakpane';
import * as functionPlotModule from "function-plot";
const functionPlot = (functionPlotModule as any).default;

const graphElement = document.getElementById("graph")!;
const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
const ctx = canvas.getContext("2d")!;

const observer = new ResizeObserver(() => 
{
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
});
observer.observe(canvas);

let viewportSize = 20.0;


function drawCircle(x: number, y: number, radius: number, color: string)
{
    ctx.beginPath();
    ctx.arc(x*canvas.width/viewportSize, canvas.width-y*canvas.width/viewportSize, radius*canvas.width/viewportSize, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
}

function drawRect(x: number, y: number, w: number, h: number, color: string)
{
    ctx.fillStyle = color;
    ctx.fillRect(x*canvas.width/viewportSize, canvas.height-y*canvas.width/viewportSize, w*canvas.width/viewportSize, -h*canvas.height/viewportSize);
}

function drawText(x: number, y: number, text: string, style: string, color: string)
{
    ctx.fillStyle = color;
    ctx.font = style;
    ctx.fillText(text, x*canvas.width/viewportSize, canvas.height-y*canvas.width/viewportSize);
}

function drawPolygon(points: { x: number, y: number }[], color: string, alpha: number = 1)
{
    ctx.beginPath();
    ctx.moveTo(
        points[0].x * canvas.width / viewportSize,
        canvas.height - points[0].y * canvas.width / viewportSize
    );
    for (let i = 1; i < points.length; i++)
    {
        ctx.lineTo(
            points[i].x * canvas.width / viewportSize,
            canvas.height - points[i].y * canvas.width / viewportSize
        );
    }
    ctx.closePath();

    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;''
}

const eMass = 9.109e-31;
const eCharge = 1.602e-19;
const planck =  6.626e-34;
const lightSpeed =  3e8;

class Electron
{
    velX = 0.0;
    velY = 0.0;
    x = 0.0;
    y = 0.0;
    active = false;

    constructor()
    {
        
    }

    spawn(x: number, y: number, vel: number)
    {
        this.active = true;
        this.x = x;
        this.y = y;
        this.velX = vel;
    }

    draw()
    {
        if(!this.active) return;
        drawCircle(this.x, this.y, 0.1, "blue")
    }

    // Simulate a step for the electron
    simulate(dt: number)
    {
        // If not active don't simulate
        if(!this.active) return;

        // Calculate electric field strenght
        let electricField = PARAMS.voltage / viewportSize;

        // Calculate force
        let force = eCharge * electricField;

        // Calculate accleration
        let acceleration = force / eMass;

        // Update electrons velocity with the acceleration
        this.velX += acceleration*dt;

        // Update electrons position with velocity
        this.x += this.velX*dt;
        this.y += this.velY*dt;
    }
}

var electrons: Electron[] = [];

for(var i = 0; i < 20000; i++)
{
    electrons.push(new Electron());
}


const PARAMS = 
{
    voltage: -1,
    wavelengthNM: 150,
    intensity: 0.5,
    workFunctionEV: 4.7,
    timeScaleExp: -5,
};


const simPane = new Pane(
{
    title: 'Settings',
    expanded: false,
});


simPane.addBinding(PARAMS, 'voltage', { min: -5, max: 5 }).on('change', () => updateGraph());
simPane.addBinding(PARAMS, 'wavelengthNM', { min: 50, max: 1000 }).on('change', () => updateGraph());
simPane.addBinding(PARAMS, 'workFunctionEV', { min: 0, max: 10 }).on('change', () => updateGraph());
simPane.addBinding(PARAMS, 'intensity', { min: 0, max: 1 }).on('change', () => updateGraph());
simPane.addBinding(PARAMS, 'timeScaleExp', { min: -7, max: -4 }).on('change', () => updateGraph());

simPane.addButton({ label: 'reset', title: 'Reset' }).on('click', () => 
{
    electrons.forEach(e =>
    {
        e.active = false;
    });
});

function wavelengthToRGB(wavelengthNM: number): { r: number, g: number, b: number }
{
    const clamped = Math.max(380, Math.min(750, wavelengthNM));

    let r = 0, g = 0, b = 0;

    if (clamped >= 380 && clamped < 440)
    {
        r = -(clamped - 440) / (440 - 380);
        g = 0;
        b = 1;
    }
    else if (clamped >= 440 && clamped < 490)
    {
        r = 0;
        g = (clamped - 440) / (490 - 440);
        b = 1;
    }
    else if (clamped >= 490 && clamped < 510)
    {
        r = 0;
        g = 1;
        b = -(clamped - 510) / (510 - 490);
    }
    else if (clamped >= 510 && clamped < 580)
    {
        r = (clamped - 510) / (580 - 510);
        g = 1;
        b = 0;
    }
    else if (clamped >= 580 && clamped < 645)
    {
        r = 1;
        g = -(clamped - 645) / (645 - 580);
        b = 0;
    }
    else if (clamped >= 645 && clamped <= 750)
    {
        r = 1;
        g = 0;
        b = 0;
    }

    let factor = 1;
    if (clamped >= 380 && clamped < 420)
        factor = 0.3 + 0.7 * (clamped - 380) / (420 - 380);
    else if (clamped >= 700 && clamped <= 750)
        factor = 0.3 + 0.7 * (750 - clamped) / (750 - 700);

    const gamma = 0.8;
    const intensity = (c: number) => c === 0 ? 0 : Math.round(255 * Math.pow(c * factor, gamma));

    return {
        r: intensity(r),
        g: intensity(g),
        b: intensity(b)
    };
}

function wavelengthToRGBString(wavelengthNM: number, alpha: number = 1): string
{
    const { r, g, b } = wavelengthToRGB(wavelengthNM);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawCircuit()
{
    const rectRightX = 0.05 + 0.5;
    const rectTopY = viewportSize/2 + 3;    
    const rectBottomY = viewportSize/2 - 3; 

    const apex = { x: viewportSize * 0.7, y: viewportSize };

    drawPolygon(
        [
            apex,
            { x: rectRightX, y: rectTopY },
            { x: rectRightX, y: rectBottomY }
        ],
        wavelengthToRGBString(PARAMS.wavelengthNM, 0.4)
    );

    drawRect(0.05, viewportSize/2-3, 0.5, 6, "#B87333");
    drawRect(0.05+0.15, viewportSize/2-3, 0.2, -3, "#B87333");

    drawRect(viewportSize-0.05-0.5, viewportSize/2-3, 0.5, 6, "#B87333");
    drawRect(viewportSize-0.05-0.5+0.15, viewportSize/2-3, 0.2, -3, "#B87333");

    drawRect(0.05+0.15, viewportSize/2-3-3, viewportSize-0.4, 0.2, "#B87333");

    if(PARAMS.voltage < 0)
    {
        drawText(0.15, 13.5, "+", `${24*-PARAMS.voltage}px Arial`, "white");
        drawText(viewportSize-0.15-0.25*-PARAMS.voltage, 13.5, "-", `${24*-PARAMS.voltage}px Arial`, "white");
    }else if(PARAMS.voltage > 0)
    {
        drawText(0.15, 13.5, "-", `${24*PARAMS.voltage}px Arial`, "white");
        drawText(viewportSize-0.05-0.25*PARAMS.voltage, 13.5, "+", `${24*PARAMS.voltage}px Arial`, "white");
    }
}
    

var lastTime: number;

function render(now: number)
{
    // Calculate time delta since last frame
    if (!lastTime) { lastTime = now; }
    var dt = ((now - lastTime)/1000) * Math.pow(10, PARAMS.timeScaleExp);
    lastTime = now;

    // Clear the canvas to render the new frame on to
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the circuit (electrodes, wires and light)
    drawCircuit();

    // Loop over every electron
    electrons.forEach(e =>
    {
        // If it is active skip it
        if(e.active) return;

        // This runs randomly with a higher probability the higher the intensity
        if(Math.random() < dt * Math.pow(10, 3 + (PARAMS.intensity * 6)) / electrons.length)
        {
            // Calculate maximum kinetic energy
            let keMax = ((planck * lightSpeed) / (PARAMS.wavelengthNM * 1E-9)) - 
                                                PARAMS.workFunctionEV * eCharge;

            // Get a random kinetic energy under the maximum energy
            // Uses a simple distribution of photoelectron kinetic energies
            let ke = keMax*(1-Math.sqrt(1-Math.random()));
            
            // If the kinetic energy is positive
            if(ke > 0)
            {
                // Calculate velocity from kinetic energy
                let velocity = Math.sqrt(ke * 2 / eMass);

                // Set the particle active and spawn it
                e.active = true;
                e.spawn(0.6, 10 + (Math.random() - 0.5) * 5.0, velocity);
            }
        }
    });

    // Loop over the electrons again
    electrons.forEach(e =>
    {
        // If its position is within the left electrode remove it
        if(e.x < 0.5)
            e.active = false;

        // If its position is within the right electrode remove it
        if(e.x > viewportSize - 0.5)
            e.active = false;

        // Simulate it 
        e.simulate(dt);

        // Draw it
        e.draw();
    });

    // Render the next frame
    requestAnimationFrame(render);
}

updateGraph();
requestAnimationFrame(render);

function updateGraph()
{
    let gradient = `(${planck}/${eCharge})`

    functionPlot.default({
    target: graphElement,
    title: "Electron recoil speed vs Scattering Angle",
    width: 600,
    disableZoom: true,
    yAxis: { domain: [-5, 5], label: "Stopping Voltage / V" },
    xAxis: { domain: [0, 2], label: "Frequency / Hz × 10¹⁵" },
    grid: true,
    data: [
        {
        fn: `${gradient} * x * 10^15 - ${PARAMS.workFunctionEV}`,
        }
    ]
    });
}