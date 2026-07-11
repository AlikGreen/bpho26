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

    simulate(dt: number)
    {
        if(!this.active) return;
        let electricField = PARAMS.voltage / viewportSize;
        let force = eCharge * electricField;
        let acceleration = force / eMass;

        this.velX += acceleration*dt;

        this.x += this.velX*dt;
        this.y += this.velY*dt;
    }
}

var electrons: Electron[] = [];

for(var i = 0; i < 20000; i++)
{
    electrons.push(new Electron());
}

var lastTime: number;

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
function drawCircuit()
{
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
    

function render(now: number)
{
    if (!lastTime) { lastTime = now; }
    var dt = ((now - lastTime)/1000) * Math.pow(10, PARAMS.timeScaleExp);
    lastTime = now;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawCircuit();

    electrons.forEach(e =>
    {
        if(e.active) return;

        if(Math.random() < dt * Math.pow(10, 3 + (PARAMS.intensity * 6)) / electrons.length)
        {
            let keMax = ((planck * lightSpeed) / (PARAMS.wavelengthNM * 1E-9)) - PARAMS.workFunctionEV * eCharge;
            let ke = keMax*(1-Math.sqrt(1-Math.random())); // Simple distribution of photoelectron kinetic energies
            if(ke > 0)
            {
                let velocity = Math.sqrt(ke * 2 / eMass);
                e.active = true;
                e.spawn(0.6, 10 + (Math.random() - 0.5) * 5.0, velocity);
            }
        }
    });

    electrons.forEach(e =>
    {
        if(e.x < 0.5)
            e.active = false;

        if(e.x > viewportSize - 0.5)
            e.active = false;

        e.simulate(dt);
        e.draw();
    });

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