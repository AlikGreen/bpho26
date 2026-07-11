import { Renderer, VertexFormat } from './tinygpu/renderer';
import { assert } from './util';
import { Pane } from 'tweakpane';

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
    const bondLength  = 0.132; 
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
        for(var i = -gridRadius; i <= gridRadius; i++)
        {
            for(var j = -gridRadius; j <= gridRadius; j++)
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

        const start = performance.now();

        function tick()
        {
            // If there are still atoms to process within the lattice
            if (atomsProccessed < atomicStructure.length)
            {
                const frameStart = performance.now();
                // Keep processing atoms untill reached 8ms of processing time
                while (atomsProccessed < atomicStructure.length && performance.now() - frameStart < 8)
                {
                    // Process some atoms
                    stepSimulation();
                }

                PARAMS.progress = atomsProccessed / atomicStructure.length;
                simTextElement.innerText = `Simulating ${atomsProccessed}/${atomicStructure.length}`;
                // Run the tick function again to process more attoms next frame
                requestAnimationFrame(tick);
            }
            else // The simulation is finished
            {
                // Display the text showing that the simulation is finished
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

    // Runs every frame to render the image
    renderer.onRender(() => 
    {
        // If currenly simulating dont update the image
        if(simulating) return;

        // Parameters needed to draw the real and imag phase textures to a normal image
        drawToTextureUniforms.set(0, 
        {
            intensityMultiplier: Math.pow(10, PARAMS.intensityMultiplier),
            hitColor: [PARAMS.hitColor.r/255.0, PARAMS.hitColor.g/255.0, PARAMS.hitColor.b/255.0, PARAMS.hitColor.a],
            atomCount: uint(atomsProccessed),
        });


        // The textures used
        drawToTextureUniforms.set(1, realStorageTexture, { storage: true, storageAccess: 'read-only' });
        drawToTextureUniforms.set(2, imagStorageTexture, { storage: true, storageAccess: 'read-only' });
        drawToTextureUniforms.set(3, pingTexture, { storage: true, storageAccess: 'write-only' })

        renderer.beginCompute();

        // Set the compute shader to use
        renderer.setComputeShader(phaseToTexShader);

        // Send the GPU the needed info
        renderer.setUniforms(drawToTextureUniforms);

        // tell the GPU to use (PARAMS.texSize+7)/8 thread groups on the x and y and run the compute shader
        renderer.dispatch((PARAMS.texSize+7)/8, (PARAMS.texSize+7)/8);

        renderer.endCompute();


        // If a blur needs to be applied
        if(PARAMS.blurRadius > 1)
        {
            renderer.beginCompute();

            // Set parameters needed for blur
            blurUniforms.set(0, 
            {
                vertical: uint(0), // Set vertical to 0 (false) so this pass is horizontal
                blurRadius: uint(PARAMS.blurRadius),
            })

            // Set textures needed for blur
            blurUniforms.set(1, pingTexture, { storage: true, storageAccess: 'read-only' });
            blurUniforms.set(2, pongTexture, { storage: true, storageAccess: 'write-only' });

            renderer.setComputeShader(blurShader);

            // Send GPU the data needed for blur
            renderer.setUniforms(blurUniforms);

            // Run the blur shader
            renderer.dispatch((PARAMS.texSize+7)/8, PARAMS.texSize/8);

            renderer.endCompute();

            renderer.beginCompute();
      

            blurUniforms.set(0, 
            {
                vertical: uint(1),  // Set vertical to 1 (true) so this pass is vertical
                blurRadius: uint(PARAMS.blurRadius),
            })

            // Set the textures again but in the other order
            // Since we just wrote to pongTexture so want to read from it
            blurUniforms.set(1, pongTexture, { storage: true, storageAccess: 'read-only' });
            blurUniforms.set(2, pingTexture, { storage: true, storageAccess: 'write-only' });

            renderer.setComputeShader(blurShader);
            renderer.setUniforms(blurUniforms);

            // Run the second pass
            renderer.dispatch(PARAMS.texSize/8, PARAMS.texSize/8);

            renderer.endCompute();
        }

    
        // Set zoom and pan parameters
        renderUniforms.set(0, 
        {
            offset: [PARAMS.offset.x, -PARAMS.offset.y],
            zoom: PARAMS.zoom,
        })

        // Set the texture with the simulation result
        renderUniforms.set(1, pingTexture, { storage: true, storageAccess: 'read-only' })
        
        renderer.beginRender();

        // Set vertex and fragment shader
        renderer.setVertShader(vertShader); // Draws a quad onto the screen
        renderer.setFragShader(fragShader); // Colours each pixel of the quad based on the input texture

        // Set the buffer containing the vertices for the quad
        renderer.setVertexBuffer(quad, [VertexFormat.Float2, VertexFormat.Float2]);
        // Send the needed info to the GPU
        renderer.setUniforms(renderUniforms);
        // Draw the quad to the canvas on the webpage
        renderer.draw(6);

        renderer.endRender();
    });

    renderer.run();

    function stepSimulation()
    {
        // Set the progress bar to keep the user updated
        PARAMS.progress = atomsProccessed / atomicStructure.length;

        // If there are still atoms to process
        if(atomsProccessed < atomicStructure.length)
        {
            // How many atoms to process            
            const count = Math.min(BATCH_SIZE, atomicStructure.length - atomsProccessed);

            // Fill a buffer of the positons of the atoms
            for (let j = 0; j < count; j++)
            {
                const atom = atomicStructure[atomsProccessed + j];
                atomBatchData[j * 4 + 0] = atom.x;
                atomBatchData[j * 4 + 1] = atom.y;
                atomBatchData[j * 4 + 2] = atom.z;
                // 4th component for padding (to keep same alignment as the GPU)
                atomBatchData[j * 4 + 3] = 0; 
            }

            // Calculate wavelenght of electron
            const wavelength = planck / Math.sqrt(2 * eMass * eCharge * PARAMS.voltage);

            // Set the info/params for the sim on the gpu
            computeUniforms.set(0, 
            {
                wavelength: wavelength * 1e9,
                screenDistance: PARAMS.screenDistance * 1e9,
                screenSize: PARAMS.screenSize * 1e9, 
                atomCount: uint(count),
            });

            // Set the buffer of atoms positions
            computeUniforms.set(1,  atomBatchData);

            // Tell the gpu which textures to use for the real and imaginary part of the wave phase
            // Used over frames to accumulate phase in order to find constuctive and destructive interference
            computeUniforms.set(2, realStorageTexture, { storage: true, storageAccess: 'read-write' });
            computeUniforms.set(3, imagStorageTexture, { storage: true, storageAccess: 'read-write' });

     
            renderer.beginCompute();

            // Send all of the data to the gpu
            renderer.setUniforms(computeUniforms);

            // Set what compute shader to use
            // A compute shader is a general purpose program that runs on the GPU
            renderer.setComputeShader(computeShader);

            // Run the compute shader on the gpu
            // The compute shader has 8x8 threads per group
            // We tell the GPU to run (texSize + 7) / 8 thread groups on the x and y
            // This means in total there are up to texSize + 7 total threads
            // So there is enough threads for one per pixel
            renderer.dispatch((PARAMS.texSize+7)/8, (PARAMS.texSize+7)/8);

            renderer.endCompute();

            // Increase total atmos processed counter by the number processed this step
            atomsProccessed += count;
        }
    }
})();