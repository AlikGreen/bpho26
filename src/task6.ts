import { Renderer, VertexFormat } from './tinygpu/renderer';
import { assert } from './util';
import { Pane } from 'tweakpane';

import './style.css';

import vertWGSL from './assets/shaders/screen.vert.wgsl?raw';
import fragWGSL from './assets/shaders/task6.frag.wgsl?raw';
import { BufferUsage } from './tinygpu/buffer';
import { uint } from './tinygpu/uniforms';


const planck =  6.626e-34;
const eMass = 9.109e-31;
const eCharge = 1.602e-19;

// function generateGraphite(gridRadius: number, numLayers: number = 2): Float32Array {
//     const bondLength  = 0.142; // nm, C-C bond
//     const a           = bondLength * Math.sqrt(3); // lattice constant ~0.246 nm
//     const interlayer  = 0.335; // nm, layer spacing

//     // Primitive lattice vectors
//     const a1 = [a * Math.sqrt(3) / 2,  a / 2];
//     const a2 = [a * Math.sqrt(3) / 2, -a / 2];

//     const atoms: number[] = [];

//     for (let layer = 0; layer < numLayers; layer++) {
//         const z      = layer * interlayer;
//         // AB (Bernal) stacking: each layer shifts by one bond vector
//         const shift  = layer * bondLength;

//         for (let i = -gridRadius; i <= gridRadius; i++) {
//             for (let j = -gridRadius; j <= gridRadius; j++) {
//                 const cx = i * a1[0] + j * a2[0];
//                 const cy = i * a1[1] + j * a2[1];

//                 // A sublattice
//                 atoms.push(cx + shift, cy, z, 0);
//                 // B sublattice
//                 atoms.push(cx + shift + bondLength, cy, z, 0);
//             }
//         }
//     }

//     return new Float32Array(atoms);
// }

function generateGrid(gridSize: number)
{
    const atomicStructure = new Float32Array(gridSize * gridSize * 4);
    const latticeSpacing = 0.123; // nanometers
    let crystalOffset = (gridSize - 1) * latticeSpacing * 0.5;

    var index = 0;
    for(var i = 0; i < gridSize; i++)
    {
        for(var j = 0; j < gridSize; j++)
        {
            atomicStructure[index] = i * latticeSpacing - crystalOffset;
            atomicStructure[index + 1] = j * latticeSpacing - crystalOffset;
            atomicStructure[index + 2] = 0;
            index += 4;
        }
    }

    return atomicStructure;
}


(async () => 
{
    const canvas = document.querySelector<HTMLCanvasElement>('#canvas');
    assert(canvas !== null);

    const PARAMS = 
    {
        voltage: 1000,
        screenDistance: 0.3,
        screenSize: 0.3,
        hitColor: {r: 0, g: 255, b: 0, a: 1.0},
        intensityMultiplier: 0.0,
        autoUpdate: false,
    };

    const pane = new Pane(
    {
        title: 'Settings',
        expanded: false,
    });


    pane.addBinding(PARAMS, 'voltage', { min: 1000, max: 5000 });
    pane.addBinding(PARAMS, 'screenDistance', { min: 0, max: 1 });
    pane.addBinding(PARAMS, 'screenSize', { min: 0.03, max: 1 });
    pane.addBinding(PARAMS, 'hitColor');

    const intensityBinding = pane.addBinding(PARAMS, 'intensityMultiplier', { min: -3, max: 5 });
    intensityBinding.element.title = 'logarithmic scale 10^x';
    pane.addBinding(PARAMS, 'autoUpdate');

    const renderer = await Renderer.create(canvas);
    const vertShader = renderer.createShader(vertWGSL);
    const fragShader = renderer.createShader(fragWGSL);

    const quad = renderer.createBuffer(new Float32Array([
        -1,  1, 0, 1,
        -1, -1, 0, 0,
         1, -1, 1, 0,
        -1,  1, 0, 1,
         1, -1, 1, 0,
         1,  1, 1, 1,
    ]), BufferUsage.Vertex);

    const uniforms = renderer.createUniforms();

    // const atomicStructure = generateGraphite(32, 128);
    const atomicStructure = generateGrid(32);
   

    const atomStructureBuffer = renderer.createBuffer(atomicStructure, BufferUsage.Storage);

    let button = pane.addButton({ label: 'update', title: 'Update' });
    button.hidden = false;
    button.on("click", () =>
    {
        render();
    });

    renderer.onRender(() => 
    {
        if(PARAMS.autoUpdate)
        {
            render();
            button.hidden = true;
        }
        else
        {
            button.hidden = false;
        }
    });

    renderer.run();

    function render()
    {
        assert(canvas != null);
        const wavelength = planck / Math.sqrt(2 * eMass * eCharge * PARAMS.voltage);

        uniforms.set(0, 
        {
            screenDistance: PARAMS.screenDistance * 1e9,
            screenSize: PARAMS.screenSize * 1e9, 
            color: [PARAMS.hitColor.r/255.0, PARAMS.hitColor.g/255.0, PARAMS.hitColor.b/255.0, PARAMS.hitColor.a],
            intensityMultiplier: Math.pow(10, PARAMS.intensityMultiplier),
            aspectRatio: canvas.width/canvas.height,
            wavelength: wavelength * 1e9,
            atomCount: uint(32*32),
        });

        uniforms.set(1, atomStructureBuffer, { readOnly: true });

        renderer.setVertShader(vertShader);
        renderer.setFragShader(fragShader);
        
        renderer.beginRender();
        renderer.setVertexBuffer(quad, [VertexFormat.Float2, VertexFormat.Float2]);
        renderer.setUniforms(uniforms);
        renderer.draw(6);
        renderer.endRender();
    }
})();