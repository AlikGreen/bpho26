import { Renderer, VertexFormat } from './tinygpu/renderer';
import { assert } from './util';
import { Pane } from 'tweakpane';

import './style.css';

import vertWGSL from './assets/shaders/screen.vert.wgsl?raw';
import fragWGSL from './assets/shaders/task6/task6.frag.wgsl?raw';
import blurWGSL from './assets/shaders/blur.wgsl?raw';

import simulationWGSL from './assets/shaders/task6/electronSimulation.wgsl?raw';
import phaseToTexWGSL from './assets/shaders/task6/phaseToImage.wgsl?raw';

import { BufferUsage } from './tinygpu/buffer';
import { uint } from './tinygpu/uniforms';
import { TextureFormat, TextureUsage } from './tinygpu/texture';


const planck =  6.626e-34;
const eMass = 9.109e-31;
const eCharge = 1.602e-19;

class Vec3
{
    public constructor(x: number, y: number, z: number)
    {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    public x = 0.0;
    public y = 0.0;
    public z = 0.0;
}


function generateGraphite(gridRadius: number, numLayers: number): Vec3[] 
{
    const bondLength  = 0.142; 
    const a           = bondLength * Math.sqrt(3);
    const interlayer  = 0.335;

    const a1 = [a * Math.sqrt(3) / 2,  a / 2];
    const a2 = [a * Math.sqrt(3) / 2, -a / 2];

    const atoms: Vec3[] = [];

    for (let layer = 0; layer < numLayers; layer++) 
    {
        const z = layer * interlayer;

        for (let i = -gridRadius; i <= gridRadius; i++) 
        {
            for (let j = -gridRadius; j <= gridRadius; j++) 
            {
                const cx = i * a1[0] + j * a2[0];
                const cy = i * a1[1] + j * a2[1];

                atoms.push(new Vec3(cx, cy, z));
                atoms.push(new Vec3(cx + bondLength, cy, z));
            }
        }
    }

    return atoms; 
}

function generateGrid(gridRadius: number, numLayers: number)
{
    const atomicStructure: Vec3[] = [];
    const latticeSpacing = 0.123;
    const interlayer  = 0.335;

    for(var l = 0; l < numLayers; l++)
    {
        for(var i = -gridRadius; i < gridRadius; i++)
        {
            for(var j = -gridRadius; j < gridRadius; j++)
            {
                atomicStructure.push(new Vec3(i * latticeSpacing, j * latticeSpacing, l * interlayer));
            }
        }
    }

    return atomicStructure;
}

function generatePolycrystallineStructure(numGrains: number, gridRadius: number, numLayers: number, grainFunc: (gr: number, nl: number) => Vec3[]): Vec3[] 
{
    const allAtoms: Vec3[] = [];

    for (let g = 0; g < numGrains; g++) 
    {
        const grainAtoms = grainFunc(gridRadius, numLayers);
    
        const randomAngle = Math.random() * Math.PI * 2;
        const cos = Math.cos(randomAngle);
        const sin = Math.sin(randomAngle);

        for (const atom of grainAtoms) 
        {
            const rx = atom.x * cos - atom.y * sin;
            const ry = atom.x * sin + atom.y * cos;
            allAtoms.push(new Vec3(rx, ry, atom.z));
        }
    }

    return allAtoms;
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
        intensityMultiplier: 2.0,
        texSize: 1024,
        progress: 0,
        blurRadius: 0,
        offset: {x:0.0, y:0.0},
        zoom: 1.0,

        structureType: 'graphite',
        gridRadius: 8,
        numLayers: 8,
        numGrains: 32,
    };

    var atomicStructure: Vec3[] = [];

    const container1 = document.createElement('div');
    container1.style.cssText = `
        position: fixed;
        top: 16px;
        right: 16px;
        width: 312px;
    `;
    document.body.appendChild(container1);

    const container2 = document.createElement('div');
    container2.style.cssText = `
        position: fixed;
        top: 16px;
        right: 344px;
        width: 312px;
    `;

    document.body.appendChild(container2);

    const simPane = new Pane(
    {
        title: 'Simulation',
        expanded: false,
        container: container1,
    });


    const structureFolder = simPane.addFolder({ title: 'Structure' });
    structureFolder.addBinding(PARAMS, 'structureType', 
    {
        view: 'list',
        label: 'type',
        options: [
            { text: 'Graphite', value: 'graphite' },
            { text: 'Uniform Grid', value: 'grid' },
        ],
    });

    structureFolder.addBinding(PARAMS, 'gridRadius', { min: 1, max: 32, step: 1 });
    structureFolder.addBinding(PARAMS, 'numLayers', { min: 1, max: 32, step: 1 });
    structureFolder.addBinding(PARAMS, 'numGrains', { min: 1, max: 128, step: 1 });

    simPane.addBinding(PARAMS, 'voltage', { min: 1000, max: 5000 })

    simPane.addBinding(PARAMS, 'screenDistance', { min: 0, max: 1 })

    simPane.addBinding(PARAMS, 'screenSize', { min: 0.03, max: 1 })

    simPane.addBinding(PARAMS, 'texSize');
    var simulating = false;
    let simTextElement = document.getElementById("simulating_text") as HTMLParagraphElement;

    simPane.addButton({ label: 'simulate', title: 'Simulate' }).on("click", () =>
    {
        if(realStorageTexture.getWidth() != PARAMS.texSize)
        {
            realStorageTexture = renderer.createTexture(PARAMS.texSize, PARAMS.texSize, TextureFormat.R32Float, TextureUsage.StorageBinding | TextureUsage.CopyDst);
            imagStorageTexture = renderer.createTexture(PARAMS.texSize, PARAMS.texSize, TextureFormat.R32Float, TextureUsage.StorageBinding | TextureUsage.CopyDst);
            pingTexture = renderer.createTexture(PARAMS.texSize, PARAMS.texSize, TextureFormat.RGBA8Unorm, TextureUsage.StorageBinding | TextureUsage.CopyDst);
            pongTexture = renderer.createTexture(PARAMS.texSize, PARAMS.texSize, TextureFormat.RGBA8Unorm, TextureUsage.StorageBinding | TextureUsage.CopyDst);
        }else
        {
            realStorageTexture.clear();
            imagStorageTexture.clear();
            pingTexture.clear();
            pongTexture.clear();
        }
        atomsProccessed = 0;

        if(PARAMS.structureType  == 'graphite')
            atomicStructure = generatePolycrystallineStructure(PARAMS.numGrains, PARAMS.gridRadius, PARAMS.numLayers, generateGraphite);
        else if(PARAMS.structureType == 'grid')
            atomicStructure = generatePolycrystallineStructure(PARAMS.numGrains, PARAMS.gridRadius, PARAMS.numLayers, generateGrid);

        simulating = true;
        let i = 0;

        const start = performance.now();

        function tick()
        {
            if (i < atomicStructure.length)
            {
                const frameStart = performance.now();
                while (i < atomicStructure.length && performance.now() - frameStart < 8)
                {
                    stepSimulation();
                    i += BATCH_SIZE;
                }

                PARAMS.progress = i / atomicStructure.length;
                simTextElement.innerText = `Simulating ${i}/${atomicStructure.length}`;
                requestAnimationFrame(tick);
            }
            else
            {
                simTextElement.innerText = "";
                PARAMS.progress = 1;
                simulating = false;
                simTextElement.innerText = `Simulated took ${performance.now()-start}ms`;
            }
        }

        requestAnimationFrame(tick);
    });


    simPane.addBinding(PARAMS, 'progress', {
        readonly: true,
        min: 0,
        max: 1,
        step: 0.01,
    });



    const viewPane = new Pane(
    {
        title: 'Display',
        expanded: false,
        container: container2
    });

    const colorFolder = viewPane.addFolder({ title: 'Colour' });

    colorFolder.addBinding(PARAMS, 'hitColor');

    const intensityBinding = colorFolder.addBinding(PARAMS, 'intensityMultiplier', { min: -3, max: 5 });
    intensityBinding.element.title = 'logarithmic scale 10^x';

    const viewFolder = viewPane.addFolder({ title: 'View' });

    viewFolder.addBinding(PARAMS, 'offset', { min: -1, max: 1 })
    viewFolder.addBinding(PARAMS, 'zoom', { min: 1, max: 10 })

    const ppFolder = viewPane.addFolder({ title: 'PostProcess' });
    ppFolder.addBinding(PARAMS, 'blurRadius', { min: 0, max: 16 });

    const renderer = await Renderer.create(canvas);
    const vertShader = renderer.createShader(vertWGSL);
    const fragShader = renderer.createShader(fragWGSL);
    const computeShader = renderer.createShader(simulationWGSL);
    const blurShader = renderer.createShader(blurWGSL);
    const phaseToTexShader = renderer.createShader(phaseToTexWGSL);

    const quad = renderer.createBuffer(new Float32Array([
        -1,  1, 0, 1,
        -1, -1, 0, 0,
         1, -1, 1, 0,
        -1,  1, 0, 1,
         1, -1, 1, 0,
         1,  1, 1, 1,
    ]), BufferUsage.Vertex);

    const computeUniforms = renderer.createUniforms();
    const drawToTextureUniforms = renderer.createUniforms();
    const blurUniforms = renderer.createUniforms();
    const renderUniforms = renderer.createUniforms();
    // const atomicStructure = generateGrid(32);

    var realStorageTexture = renderer.createTexture(PARAMS.texSize, PARAMS.texSize, TextureFormat.R32Float, TextureUsage.StorageBinding | TextureUsage.CopyDst);
    var imagStorageTexture = renderer.createTexture(PARAMS.texSize, PARAMS.texSize, TextureFormat.R32Float, TextureUsage.StorageBinding | TextureUsage.CopyDst);

    var pingTexture = renderer.createTexture(PARAMS.texSize, PARAMS.texSize, TextureFormat.RGBA8Unorm, TextureUsage.StorageBinding | TextureUsage.CopyDst);
    var pongTexture = renderer.createTexture(PARAMS.texSize, PARAMS.texSize, TextureFormat.RGBA8Unorm, TextureUsage.StorageBinding | TextureUsage.CopyDst);

    var atomsProccessed = 0;

    const BATCH_SIZE = 512;
    const atomBatchData = new Float32Array(BATCH_SIZE * 4);

    renderer.onRender(() => 
    {
        if(simulating) return;

        drawToTextureUniforms.set(0, 
        {
            intensityMultiplier: Math.pow(10, PARAMS.intensityMultiplier),
            hitColor: [PARAMS.hitColor.r/255.0, PARAMS.hitColor.g/255.0, PARAMS.hitColor.b/255.0, PARAMS.hitColor.a],
            atomCount: uint(atomsProccessed),
        });


        drawToTextureUniforms.set(1, realStorageTexture, { storage: true, storageAccess: 'read-only' });
        drawToTextureUniforms.set(2, imagStorageTexture, { storage: true, storageAccess: 'read-only' });
        drawToTextureUniforms.set(3, pingTexture, { storage: true, storageAccess: 'write-only' })

        renderer.beginCompute();

        renderer.setComputeShader(phaseToTexShader);
        renderer.setUniforms(drawToTextureUniforms);
        renderer.dispatch(PARAMS.texSize/8, PARAMS.texSize/8);

        renderer.endCompute();


        if(PARAMS.blurRadius > 1)
        {
            renderer.beginCompute();

            blurUniforms.set(0, 
            {
                vertical: uint(0),
                blurRadius: uint(PARAMS.blurRadius),
            })

            blurUniforms.set(1, pingTexture, { storage: true, storageAccess: 'read-only' });
            blurUniforms.set(2, pongTexture, { storage: true, storageAccess: 'write-only' });

            renderer.setComputeShader(blurShader);
            renderer.setUniforms(blurUniforms);
            renderer.dispatch(PARAMS.texSize/8, PARAMS.texSize/8);

            renderer.endCompute();

            renderer.beginCompute();
      
            blurUniforms.set(0, 
            {
                vertical: uint(1),
                blurRadius: uint(PARAMS.blurRadius),
            })

            blurUniforms.set(1, pongTexture, { storage: true, storageAccess: 'read-only' });
            blurUniforms.set(2, pingTexture, { storage: true, storageAccess: 'write-only' });

            renderer.setComputeShader(blurShader);
            renderer.setUniforms(blurUniforms);
            renderer.dispatch(PARAMS.texSize/8, PARAMS.texSize/8);

            renderer.endCompute();
        }

    

        renderUniforms.set(0, 
        {
            offset: [PARAMS.offset.x, -PARAMS.offset.y],
            zoom: PARAMS.zoom,
        })

        renderUniforms.set(1, pingTexture, { storage: true, storageAccess: 'read-only' })
        
        renderer.beginRender();

        renderer.setVertShader(vertShader);
        renderer.setFragShader(fragShader);

        renderer.setVertexBuffer(quad, [VertexFormat.Float2, VertexFormat.Float2]);
        renderer.setUniforms(renderUniforms);
        renderer.draw(6);

        renderer.endRender();
    });

    renderer.run();

    function stepSimulation()
    {
        PARAMS.progress = atomsProccessed / atomicStructure.length;
        if(atomsProccessed < atomicStructure.length)
        {
            const count = Math.min(BATCH_SIZE, atomicStructure.length - atomsProccessed);

            for (let j = 0; j < count; j++)
            {
                const atom = atomicStructure[atomsProccessed + j];
                atomBatchData[j * 4 + 0] = atom.x;
                atomBatchData[j * 4 + 1] = atom.y;
                atomBatchData[j * 4 + 2] = atom.z;
                atomBatchData[j * 4 + 3] = 0;
            }
            atomsProccessed += count;


            const wavelength = planck / Math.sqrt(2 * eMass * eCharge * PARAMS.voltage);

            computeUniforms.set(0, 
            {
                wavelength: wavelength * 1e9,
                screenDistance: PARAMS.screenDistance * 1e9,
                screenSize: PARAMS.screenSize * 1e9, 
                atomCount: uint(count),
            });

            computeUniforms.set(1,  atomBatchData);

            computeUniforms.set(2, realStorageTexture, { storage: true, storageAccess: 'read-write' });
            computeUniforms.set(3, imagStorageTexture, { storage: true, storageAccess: 'read-write' });

            renderer.beginCompute();

            renderer.setUniforms(computeUniforms);
            renderer.setComputeShader(computeShader);
            renderer.dispatch(PARAMS.texSize/8, PARAMS.texSize/8);

            renderer.endCompute();
        }
    }
})();