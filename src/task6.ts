import { Renderer, VertexFormat } from './tinygpu/renderer';
import { assert } from './util';
import { Pane } from 'tweakpane';

import './style.css';

import vertWGSL from './assets/shaders/screen.vert.wgsl?raw';
import fragWGSL from './assets/shaders/task6.frag.wgsl?raw';
import { BufferUsage } from './tinygpu/buffer';


const planck =  6.626e-34;
const eMass = 9.109e-31;
const eCharge = 1.602e-19;

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
        atomCount: 30,
        update: true,
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
    pane.addBinding(PARAMS, 'atomCount', { min: 5, max: 120 });
    pane.addBinding(PARAMS, 'update');

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

    renderer.onRender(() => 
    {
        if(PARAMS.update)
        {
            const wavelength = planck / Math.sqrt(2 * eMass * eCharge * PARAMS.voltage);

            uniforms.clear();
            uniforms.setFloat(PARAMS.screenDistance * 1e4);
            uniforms.setFloat(PARAMS.screenSize * 1e4);
            uniforms.setColor(PARAMS.hitColor.r, PARAMS.hitColor.g, PARAMS.hitColor.b, PARAMS.hitColor.a);
            uniforms.setFloat(canvas.width/canvas.height);
            uniforms.setUint(PARAMS.atomCount);
            uniforms.setFloat(wavelength * 1e9);
            console.info(wavelength* 1e9)

            renderer.setVertShader(vertShader);
            renderer.setFragShader(fragShader);        
            
            renderer.beginRender();
            renderer.setVertexBuffer(quad, [VertexFormat.Float2, VertexFormat.Float2]);
            renderer.setUniforms(uniforms);

            renderer.draw(6);
            renderer.endRender();
        }
    });

    renderer.run();
})();

